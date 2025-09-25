#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
云端语音识别版本 - 使用百度/阿里云/腾讯云API
速度快，准确率高，成本低
"""

import os
import sys
import json
import tempfile
import shutil
import requests
import base64
from pathlib import Path
import yt_dlp
import logging
from opencc import OpenCC

# 设置日志
logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(message)s', stream=sys.stderr)
logger = logging.getLogger(__name__)

class CloudVideoTranscriber:
    def __init__(self):
        """初始化云端语音识别"""
        self.temp_dir = None
        self.cc = OpenCC('t2s')  # 繁体转简体
        
        # 配置API密钥 (需要在Railway环境变量中设置)
        self.baidu_api_key = os.getenv('BAIDU_API_KEY')
        self.baidu_secret_key = os.getenv('BAIDU_SECRET_KEY')
        
    def get_baidu_access_token(self):
        """获取百度API访问令牌"""
        if not self.baidu_api_key or not self.baidu_secret_key:
            return None
            
        url = "https://aip.baidubce.com/oauth/2.0/token"
        params = {
            "grant_type": "client_credentials",
            "client_id": self.baidu_api_key,
            "client_secret": self.baidu_secret_key
        }
        
        try:
            response = requests.post(url, params=params)
            return response.json().get("access_token")
        except:
            return None
    
    def download_video(self, url, output_path):
        """下载视频并提取音频"""
        print("开始下载视频...", file=sys.stderr)
        
        # 配置yt-dlp - 极致优化
        ydl_opts = {
            'format': 'worstaudio/worst',
            'outtmpl': os.path.join(output_path, 'audio.%(ext)s'),
            'extractaudio': True,
            'audioformat': 'wav',
            'quiet': True,
            'no_warnings': True,
            'no_check_certificate': True,
            'socket_timeout': 30,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'wav',
                'preferredquality': '16',  # 16kbps，极小文件
            }],
        }
        
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                title = info.get('title', '未知标题')
                duration = info.get('duration', 0)
                
                print(f"视频信息: {title} ({duration}秒)", file=sys.stderr)
                
                # 下载音频
                ydl.download([url])
                
                # 查找下载的音频文件
                audio_files = list(Path(output_path).glob('audio.*'))
                if audio_files:
                    audio_path = str(audio_files[0])
                    print(f"音频下载完成: {audio_path}", file=sys.stderr)
                    return audio_path, title, duration
                else:
                    raise Exception("音频文件下载失败")
                    
        except Exception as e:
            raise Exception(f"视频下载失败: {str(e)}")
    
    def transcribe_with_baidu(self, audio_path):
        """使用百度语音识别API"""
        print("使用百度云语音识别...", file=sys.stderr)
        
        access_token = self.get_baidu_access_token()
        if not access_token:
            raise Exception("百度API配置错误")
        
        # 读取音频文件
        with open(audio_path, 'rb') as f:
            audio_data = f.read()
        
        # 转换为base64
        audio_base64 = base64.b64encode(audio_data).decode('utf-8')
        
        url = "https://vop.baidu.com/server_api"
        headers = {'Content-Type': 'application/json'}
        
        payload = {
            "format": "wav",
            "rate": 16000,
            "channel": 1,
            "speech": audio_base64,
            "len": len(audio_data),
            "token": access_token,
            "cuid": "xiaohongshu_app"
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers)
            result = response.json()
            
            if result.get('err_no') == 0:
                text = result.get('result', [''])[0]
                # 转换为简体中文
                text = self.cc.convert(text)
                
                return {
                    'text': text,
                    'segments': [{'start': 0, 'end': 0, 'text': text}],
                    'language': 'zh'
                }
            else:
                raise Exception(f"百度API错误: {result.get('err_msg')}")
                
        except Exception as e:
            raise Exception(f"语音识别失败: {str(e)}")
    
    def transcribe_with_openai_api(self, audio_path):
        """使用OpenAI Whisper API (备用方案)"""
        print("使用OpenAI Whisper API...", file=sys.stderr)
        
        openai_key = os.getenv('OPENAI_API_KEY')
        if not openai_key:
            raise Exception("OpenAI API密钥未配置")
        
        url = "https://api.openai.com/v1/audio/transcriptions"
        headers = {"Authorization": f"Bearer {openai_key}"}
        
        with open(audio_path, 'rb') as f:
            files = {"file": f}
            data = {
                "model": "whisper-1",
                "language": "zh",
                "response_format": "json"
            }
            
            response = requests.post(url, headers=headers, files=files, data=data)
            result = response.json()
            
            if 'text' in result:
                text = self.cc.convert(result['text'])
                return {
                    'text': text,
                    'segments': [{'start': 0, 'end': 0, 'text': text}],
                    'language': 'zh'
                }
            else:
                raise Exception(f"OpenAI API错误: {result}")
    
    def process_video_url(self, url):
        """处理视频URL"""
        self.temp_dir = tempfile.mkdtemp()
        
        try:
            print(f"开始处理视频: {url}", file=sys.stderr)
            
            # 下载音频
            audio_path, title, duration = self.download_video(url, self.temp_dir)
            print(f"视频下载完成: {title} ({duration}秒)", file=sys.stderr)
            
            # 尝试云端识别
            result = None
            
            # 方案1: 百度云语音识别
            try:
                if self.baidu_api_key:
                    result = self.transcribe_with_baidu(audio_path)
                    print("百度云识别完成", file=sys.stderr)
            except Exception as e:
                print(f"百度云识别失败: {e}", file=sys.stderr)
            
            # 方案2: OpenAI Whisper API (备用)
            if not result:
                try:
                    result = self.transcribe_with_openai_api(audio_path)
                    print("OpenAI识别完成", file=sys.stderr)
                except Exception as e:
                    print(f"OpenAI识别失败: {e}", file=sys.stderr)
            
            if not result:
                raise Exception("所有云端识别方案都失败了")
            
            # 格式化结果
            formatted_result = self.format_transcript(result, title)
            formatted_result['url'] = url
            formatted_result['duration'] = duration
            
            return {
                'success': True,
                'data': formatted_result
            }
            
        except Exception as e:
            print(f"处理失败: {str(e)}", file=sys.stderr)
            return {
                'success': False,
                'error': str(e)
            }
            
        finally:
            # 清理临时文件
            if self.temp_dir and os.path.exists(self.temp_dir):
                try:
                    shutil.rmtree(self.temp_dir)
                    print("临时文件已清理", file=sys.stderr)
                except:
                    pass
    
    def format_transcript(self, result, title=""):
        """格式化转换结果"""
        full_text = result.get('text', '').strip()
        segments = result.get('segments', [])
        
        # 生成带时间戳的文本
        timestamped_text = ""
        for segment in segments:
            start_time = self.format_time(segment.get('start', 0))
            end_time = self.format_time(segment.get('end', 0))
            text = segment.get('text', '').strip()
            if text:
                timestamped_text += f"[{start_time} - {end_time}] {text}\n"
        
        return {
            'title': title,
            'full_text': full_text,
            'timestamped_text': timestamped_text.strip(),
            'segments': segments,
            'word_count': len(full_text.replace(' ', '')),
            'language': 'zh'
        }
    
    def format_time(self, seconds):
        """格式化时间为 MM:SS 格式"""
        minutes = int(seconds // 60)
        seconds = int(seconds % 60)
        return f"{minutes:02d}:{seconds:02d}"

def main():
    """命令行入口"""
    if len(sys.argv) != 2:
        result = {
            'success': False,
            'error': '使用方法: python video_transcriber_cloud.py <视频链接>'
        }
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(1)
    
    url = sys.argv[1]
    
    try:
        # 创建云端转换器
        transcriber = CloudVideoTranscriber()
        print("云端VideoTranscriber初始化完成", file=sys.stderr)
        
        # 处理视频
        result = transcriber.process_video_url(url)
        print("云端视频处理完成", file=sys.stderr)
        
        # 输出JSON结果
        print(json.dumps(result, ensure_ascii=False))
        
        if result.get('success', False):
            sys.exit(0)
        else:
            sys.exit(2)
            
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
