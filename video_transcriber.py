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
    def __init__(self, model_size="base"):
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
            #logger.info(f"正在加载Whisper模型: {self.model_size}")
            self.model = whisper.load_model(self.model_size)
            #logger.info("模型加载完成")
    
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
        
        # 配置yt-dlp选项
        ydl_opts = {
            'format': 'worst[ext=mp4]/worst',  # 选择最小质量以节省时间和空间
            'outtmpl': os.path.join(output_path, 'video.%(ext)s'),
            'extractaudio': False,
            'quiet': True,
            'no_warnings': True,
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
            
            # 转换
            result = self.model.transcribe(
                video_path,
                language="zh",  # 中文
                task="transcribe",
                verbose=False
            )
            
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
            # 下载视频
            video_path, title, duration = self.download_video(url, self.temp_dir)
            
            # 转换为文字
            result = self.transcribe_audio(video_path)
            
            # 格式化结果
            formatted_result = self.format_transcript(result, title)
            formatted_result['url'] = url
            formatted_result['duration'] = duration
            
            return {
                'success': True,
                'data': formatted_result
            }
            
        except Exception as e:
            logger.error(f"处理失败: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
            
        finally:
            # 清理临时文件
            if self.temp_dir and os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
                #logger.info("临时文件已清理")

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
    
    # 创建转换器
    transcriber = VideoTranscriber(model_size="base")
    
    # 处理视频
    result = transcriber.process_video_url(url)
    
    # 输出JSON结果
    print(json.dumps(result, ensure_ascii=False))

if __name__ == "__main__":
    main()