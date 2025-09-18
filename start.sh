#!/bin/bash

# 简单的服务器启动脚本
echo "🚀 启动小红书创作助手..."

# 检查当前目录
if [ ! -f "server.js" ]; then
    echo "❌ 错误: 找不到 server.js 文件"
    echo "请确保在正确的目录运行此脚本"
    exit 1
fi

# 杀死现有进程
echo "🔄 清理现有进程..."
pkill -f "node.*server" 2>/dev/null || true
sleep 2

# 检查端口
PORT_PID=$(lsof -ti:3000 2>/dev/null)
if [ ! -z "$PORT_PID" ]; then
    echo "🔧 清理端口3000..."
    kill -9 $PORT_PID 2>/dev/null || true
    sleep 1
fi

# 启动服务器
echo "✨ 启动服务器..."
node server.js &
SERVER_PID=$!

# 等待启动
echo "⏳ 等待服务器启动..."
sleep 5

# 健康检查
echo "🏥 进行健康检查..."
for i in {1..10}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "✅ 服务器启动成功!"
        echo "🌐 访问地址: http://localhost:3000"
        echo "📋 服务器PID: $SERVER_PID"
        break
    elif [ $i -eq 10 ]; then
        echo "❌ 服务器启动失败"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    else
        echo "⏳ 正在等待服务器启动... ($i/10)"
        sleep 2
    fi
done

# 显示进程信息
echo ""
echo "📊 当前服务器进程:"
ps aux | grep "node.*server" | grep -v grep || echo "未找到服务器进程"