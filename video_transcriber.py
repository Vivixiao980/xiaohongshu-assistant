#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
视频转文字工具
支持多种视频平台链接，自动下载并转换为文字稿
"""

import os
import sys
import json
import tempfile
import shutil
from pathlib import Path
import yt_dlp
import whisper
import logging
from opencc import OpenCC

# 设置日志 - 只在开发时输出到stderr，生产时静默
import warnings
warnings.filterwarnings("ignore")

# 设置日志只输出到stderr，避免干扰JSON输出
logging.basicConfig(
    level=logging.WARNING,  # 只显示警告和错误
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stderr  # 输出到stderr而不是stdout
)
logger = logging.getLogger(__name__)

class VideoTranscriber:
    def __init__(self, model_size="tiny"):  # 默认使用最小模型提高速度
        """
        初始化视频转文字工具
        
        Args:
            model_size (str): Whisper模型大小 (tiny, base, small, medium, large)
        """
        self.model_size = model_size
        self.model = None
        self.temp_dir = None
        # 初始化繁简转换器
        self.cc = OpenCC('t2s')  # 繁体转简体
        
    def load_model(self):
        """加载Whisper模型"""
        if self.model is None:
            print(f"正在加载Whisper模型: {self.model_size}", file=sys.stderr)
            self.model = whisper.load_model(self.model_size)
            print("Whisper模型加载完成", file=sys.stderr)
    
    def download_video(self, url, output_path):
        """
        下载视频
        
        Args:
            url (str): 视频链接
            output_path (str): 输出路径
            
        Returns:
            str: 下载的视频文件路径
        """
        # #logger.info(f"开始下载视频: {url}")  # 静默模式
        
        # 配置yt-dlp选项 - 极致优化为最快速度和最小文件
        ydl_opts = {
            'format': 'worstaudio/worst',  # 只要最低质量音频
            'outtmpl': os.path.join(output_path, 'video.%(ext)s'),
            'extractaudio': True,   # 只提取音频，更快
            'audioformat': 'wav',   # 使用wav格式
            'quiet': True,
            'no_warnings': True,
            'no_check_certificate': True,  # 跳过SSL验证加速
            'socket_timeout': 30,   # 设置超时
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '64',  # 64kbps，大幅减少数据量
            }],
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # 获取视频信息
                info = ydl.extract_info(url, download=False)
                title = info.get('title', 'Unknown')
                duration = info.get('duration', 0)
                
                #logger.info(f"视频标题: {title}")
                #logger.info(f"视频时长: {duration}秒")
                
                # 下载视频
                ydl.download([url])
                
                # 查找下载的文件
                for file in os.listdir(output_path):
                    if file.startswith('video.'):
                        video_path = os.path.join(output_path, file)
                        #logger.info(f"视频下载完成: {video_path}")
                        return video_path, title, duration
                        
        except Exception as e:
            logger.error(f"下载视频失败: {str(e)}")
            raise
        
        raise Exception("未找到下载的视频文件")
    
    def transcribe_audio(self, video_path):
        """
        转换音频为文字
        
        Args:
            video_path (str): 视频文件路径
            
        Returns:
            dict: 转换结果
        """
        #logger.info("开始转换语音为文字...")
        
        try:
            # 加载模型
            self.load_model()
            
            # 添加进度回调函数
            import time
            start_time = time.time()
            last_progress_time = start_time
            
            def progress_callback(chunk_idx, total_chunks):
                nonlocal last_progress_time
                current_time = time.time()
                if current_time - last_progress_time >= 10:  # 每10秒输出一次进度
                    elapsed = current_time - start_time
                    progress = (chunk_idx / total_chunks) * 100 if total_chunks > 0 else 0
                    print(f"语音识别进度: {progress:.1f}% ({chunk_idx}/{total_chunks}), 已用时: {elapsed:.1f}秒", file=sys.stderr)
                    last_progress_time = current_time
            
            print(f"开始Whisper转换，预计处理帧数: 约{27483}帧", file=sys.stderr)
            
            # 转换 - 极致优化参数提高速度
            result = self.model.transcribe(
                video_path,
                language="zh",  # 中文
                task="transcribe",
                verbose=True,  # 开启详细输出以便调试
                fp16=False,  # 禁用fp16以提高兼容性
                temperature=0,  # 使用确定性解码，更快
                compression_ratio_threshold=2.4,  # 降低阈值
                logprob_threshold=-1.0,  # 降低阈值
                no_speech_threshold=0.6,  # 提高阈值，跳过静音部分
                beam_size=1,  # 单束搜索，最快速度
                best_of=1,  # 只生成一个候选
                word_timestamps=False,  # 禁用单词时间戳
                condition_on_previous_text=False  # 不依赖前文，更快
            )
            
            end_time = time.time()
            total_time = end_time - start_time
            print(f"Whisper处理完成，总用时: {total_time:.1f}秒", file=sys.stderr)
            
            # 将繁体转换为简体
            if 'text' in result:
                result['text'] = self.cc.convert(result['text'])
            
            if 'segments' in result:
                for segment in result['segments']:
                    if 'text' in segment:
                        segment['text'] = self.cc.convert(segment['text'])
            
            #logger.info("语音转换完成")
            return result
            
        except Exception as e:
            logger.error(f"语音转换失败: {str(e)}")
            raise
    
    def transcribe_audio_chunked(self, video_path, chunk_duration=60):
        """
        分段处理音频以提高速度和稳定性
        
        Args:
            video_path (str): 视频文件路径
            chunk_duration (int): 每段的时长（秒）
            
        Returns:
            dict: 转换结果
        """
        import time
        import subprocess
        import os
        
        start_time = time.time()
        
        try:
            # 加载模型
            self.load_model()
            
            # 获取音频总时长
            try:
                cmd = ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', 
                       '-of', 'csv=p=0', video_path]
                result = subprocess.run(cmd, capture_output=True, text=True)
                total_duration = float(result.stdout.strip()) if result.stdout.strip() else 0
            except:
                # 如果ffprobe失败，回退到原始方法
                print("无法获取音频时长，使用原始处理方法", file=sys.stderr)
                return self.transcribe_audio(video_path)
            
            print(f"音频总时长: {total_duration:.1f}秒，将分{int(total_duration/chunk_duration)+1}段处理", file=sys.stderr)
            
            # 如果视频很短，直接使用原始方法
            if total_duration <= chunk_duration:
                print("视频较短，使用原始方法处理", file=sys.stderr)
                return self.transcribe_audio(video_path)
            
            # 计算分段数量
            num_chunks = int(total_duration / chunk_duration) + 1
            
            all_segments = []
            full_text_parts = []
            
            for i in range(num_chunks):
                chunk_start = i * chunk_duration
                chunk_end = min((i + 1) * chunk_duration, total_duration)
                
                if chunk_start >= total_duration:
                    break
                    
                print(f"处理分段 {i+1}/{num_chunks} ({chunk_start:.1f}s - {chunk_end:.1f}s)", file=sys.stderr)
                
                # 提取音频片段
                chunk_path = os.path.join(os.path.dirname(video_path), f'chunk_{i}.wav')
                cmd = ['ffmpeg', '-y', '-i', video_path, '-ss', str(chunk_start), 
                       '-t', str(chunk_duration), '-acodec', 'pcm_s16le', '-ar', '16000', chunk_path]
                subprocess.run(cmd, capture_output=True, stderr=subprocess.DEVNULL)
                
                try:
                    # 转换当前分段
                    chunk_result = self.model.transcribe(
                        chunk_path,
                        language="zh",
                        task="transcribe",
                        verbose=False,  # 减少输出
                        fp16=False,
                        temperature=0,
                        compression_ratio_threshold=2.4,
                        logprob_threshold=-1.0,
                        no_speech_threshold=0.6,
                        beam_size=1,
                        best_of=1,
                        word_timestamps=False,
                        condition_on_previous_text=False
                    )
                    
                    # 调整时间戳并添加到总结果
                    if 'segments' in chunk_result:
                        for segment in chunk_result['segments']:
                            segment['start'] += chunk_start
                            segment['end'] += chunk_start
                            # 转换繁体到简体
                            if 'text' in segment:
                                segment['text'] = self.cc.convert(segment['text'])
                            all_segments.append(segment)
                    
                    # 添加文本部分
                    if 'text' in chunk_result and chunk_result['text'].strip():
                        text = self.cc.convert(chunk_result['text'])
                        full_text_parts.append(text)
                    
                    progress = ((i + 1) / num_chunks) * 100
                    elapsed = time.time() - start_time
                    print(f"分段处理进度: {progress:.1f}%, 已用时: {elapsed:.1f}秒", file=sys.stderr)
                    
                except Exception as chunk_error:
                    print(f"分段{i+1}处理失败: {chunk_error}, 跳过", file=sys.stderr)
                    
                finally:
                    # 清理临时文件
                    if os.path.exists(chunk_path):
                        try:
                            os.remove(chunk_path)
                        except:
                            pass
            
            # 合并结果
            result = {
                'text': ' '.join(full_text_parts),
                'segments': all_segments,
                'language': 'zh'
            }
            
            end_time = time.time()
            total_time = end_time - start_time
            print(f"分段处理完成，总用时: {total_time:.1f}秒", file=sys.stderr)
            
            return result
            
        except Exception as e:
            print(f"分段处理失败: {str(e)}, 回退到原始方法", file=sys.stderr)
            # 回退到原始方法
            return self.transcribe_audio(video_path)
    
    def format_transcript(self, result, title=""):
        """
        格式化转换结果
        
        Args:
            result (dict): Whisper转换结果
            title (str): 视频标题
            
        Returns:
            dict: 格式化后的结果
        """
        # 提取完整文本
        full_text = result.get('text', '').strip()
        
        # 提取分段信息
        segments = []
        for segment in result.get('segments', []):
            segments.append({
                'start': segment.get('start', 0),
                'end': segment.get('end', 0),
                'text': segment.get('text', '').strip()
            })
        
        # 生成带时间戳的文本
        timestamped_text = ""
        for segment in segments:
            start_time = self.format_time(segment['start'])
            end_time = self.format_time(segment['end'])
            timestamped_text += f"[{start_time} - {end_time}] {segment['text']}\n"
        
        return {
            'title': title,
            'full_text': full_text,
            'segments': segments,
            'timestamped_text': timestamped_text,
            'word_count': len(full_text),
            'segment_count': len(segments)
        }
    
    def format_time(self, seconds):
        """格式化时间为 MM:SS 格式"""
        minutes = int(seconds // 60)
        seconds = int(seconds % 60)
        return f"{minutes:02d}:{seconds:02d}"
    
    def process_video_url(self, url):
        """
        处理视频链接，返回文字稿
        
        Args:
            url (str): 视频链接
            
        Returns:
            dict: 处理结果
        """
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp()
        
        try:
            print("开始下载视频...", file=sys.stderr)
            # 下载视频
            video_path, title, duration = self.download_video(url, self.temp_dir)
            print(f"视频下载完成: {title} ({duration}秒)", file=sys.stderr)
            
            print("开始语音识别...", file=sys.stderr)
            # 转换为文字 - 使用分段处理提高速度
            result = self.transcribe_audio_chunked(video_path)
            print("语音识别完成", file=sys.stderr)
            
            print("格式化结果...", file=sys.stderr)
            # 格式化结果
            formatted_result = self.format_transcript(result, title)
            formatted_result['url'] = url
            formatted_result['duration'] = duration
            
            print("处理完成，准备输出结果", file=sys.stderr)
            return {
                'success': True,
                'data': formatted_result
            }
            
        except yt_dlp.utils.DownloadError as e:
            error_msg = f"视频下载失败: {str(e)}"
            print(error_msg, file=sys.stderr)
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            error_msg = f"处理失败: {str(e)}"
            print(error_msg, file=sys.stderr)
            logger.error(error_msg)
            return {
                'success': False,
                'error': error_msg
            }
            
        finally:
            # 清理临时文件
            if self.temp_dir and os.path.exists(self.temp_dir):
                try:
                    shutil.rmtree(self.temp_dir)
                    print("临时文件已清理", file=sys.stderr)
                except Exception as cleanup_error:
                    print(f"清理临时文件失败: {cleanup_error}", file=sys.stderr)

def main():
    """命令行入口"""
    if len(sys.argv) != 2:
        result = {
            'success': False,
            'error': '使用方法: python video_transcriber.py <视频链接>'
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)
    
    url = sys.argv[1]
    
    try:
        print(f"开始处理视频: {url}", file=sys.stderr)
        
        # 创建转换器 - 使用tiny模型提高速度
        transcriber = VideoTranscriber(model_size="tiny")
        print("VideoTranscriber初始化完成", file=sys.stderr)
        
        # 处理视频
        result = transcriber.process_video_url(url)
        print("视频处理完成", file=sys.stderr)
        
        # 输出JSON结果到stdout
        print(json.dumps(result, ensure_ascii=False))
        
        # 如果处理成功，正常退出
        if result.get('success', False):
            sys.exit(0)
        else:
            # 处理失败，但不是异常，退出码为2
            sys.exit(2)
            
    except KeyboardInterrupt:
        print("用户中断处理", file=sys.stderr)
        result = {
            'success': False,
            'error': '用户中断处理'
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(3)
        
    except Exception as e:
        print(f"未预期的错误: {str(e)}", file=sys.stderr)
        result = {
            'success': False,
            'error': f'未预期的错误: {str(e)}'
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()