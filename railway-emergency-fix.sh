#!/bin/bash

echo "🚨 Railway紧急修复脚本"
echo "================================"

# 备份当前文件
echo "📦 备份当前配置文件..."
cp package.json package.json.backup
cp server.js server.js.backup

# 使用极简版配置
echo "🔧 使用极简版依赖配置和服务文件..."
cp package.minimal.json package.json
cp server.minimal.js server.js

# 彻底清理
echo "🧹 清理所有缓存和临时文件..."
rm -rf node_modules
rm -f package-lock.json
rm -rf .npm
rm -rf logs/*.log
rm -f database.sqlite

# 创建必要目录
echo "📁 创建必要目录..."
mkdir -p logs
mkdir -p temp  
mkdir -p knowledge-base

echo ""
echo "✅ 紧急修复完成！"
echo ""
echo "📋 接下来的步骤："
echo "1. git add ."
echo "2. git commit -m 'Emergency fix: simplify dependencies for Railway'"  
echo "3. git push origin main"
echo ""
echo "🔄 如果需要恢复原来的配置："
echo "cp package.json.backup package.json"
echo "cp server.js.backup server.js"
echo ""
echo "⚠️  注意：此版本移除了以下功能："
echo "- Playwright (网页爬虫)"
echo "- MySQL支持 (仅保留SQLite)"
echo "- Multer (文件上传)"
echo "- Sequelize (ORM)"
echo "- Nodemailer (邮件)"
