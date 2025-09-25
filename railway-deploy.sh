#!/bin/bash

# Railway部署前清理脚本
echo "🚀 准备Railway部署..."

# 清理缓存和临时文件
echo "📦 清理npm缓存..."
npm cache clean --force

# 删除node_modules和package-lock.json以避免版本冲突
echo "🔄 清理现有依赖..."
rm -rf node_modules
rm -f package-lock.json

# 删除可能导致部署问题的大文件目录
echo "🗂️ 清理大文件目录..."
rm -rf crawler/MediaCrawler/venv/
rm -rf crawler/MediaCrawler/__pycache__/
rm -rf video_transcribe_env/
rm -rf temp/browser-profile/
rm -f database.sqlite
rm -rf logs/*.log

# 确保必要目录存在
echo "📁 创建必要目录..."
mkdir -p logs
mkdir -p temp
mkdir -p knowledge-base

echo "✅ Railway部署准备完成！"
echo ""
echo "🔧 请确保在Railway中设置以下环境变量："
echo "NODE_ENV=production"
echo "JWT_SECRET=your-secret-key"
echo "CUSTOM_CLAUDE_API_KEY=your-api-key"
echo "SILICONFLOW_API_KEY=your-api-key"
echo ""
echo "📋 接下来的步骤："
echo "1. git add ."
echo "2. git commit -m 'Optimize Railway deployment'"
echo "3. git push origin main"
echo "4. Railway将自动重新部署"

