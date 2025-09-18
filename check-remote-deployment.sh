#!/bin/bash

# 检查远程Linux主机部署状态脚本
# 使用方法: ./check-remote-deployment.sh [server_ip] [username]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

if [ $# -lt 2 ]; then
    print_message $RED "❌ 用法: $0 [server_ip] [username]"
    exit 1
fi

SERVER_IP=$1
USERNAME=$2
APP_NAME="xiaohongshu-assistant"

print_message $BLUE "🔍 检查 $SERVER_IP 上的应用部署状态..."

# 检查服务器连接
if ! ssh -o ConnectTimeout=10 $USERNAME@$SERVER_IP "echo '连接成功'" 2>/dev/null; then
    print_message $RED "❌ 无法连接到服务器 $SERVER_IP"
    exit 1
fi

print_message $GREEN "✅ 服务器连接正常"

# 检查远程状态
ssh $USERNAME@$SERVER_IP << 'ENDSSH'
    echo "🔍 检查应用状态..."
    
    # 检查Node.js
    if command -v node &> /dev/null; then
        echo "✅ Node.js: $(node --version)"
    else
        echo "❌ Node.js 未安装"
    fi
    
    # 检查PM2
    if command -v pm2 &> /dev/null; then
        echo "✅ PM2: $(pm2 --version)"
    else
        echo "❌ PM2 未安装"
    fi
    
    # 检查应用目录
    APP_DIRS=(
        "/home/$USER/xiaohongshu-assistant"
        "/home/$USER/xiaohongshu-app"
        "/opt/xiaohongshu"
    )
    
    APP_FOUND=false
    for dir in "${APP_DIRS[@]}"; do
        if [ -d "$dir" ]; then
            echo "✅ 发现应用目录: $dir"
            cd "$dir"
            if [ -f "server.js" ]; then
                echo "✅ 找到主程序文件: server.js"
                APP_FOUND=true
                
                # 检查package.json
                if [ -f "package.json" ]; then
                    echo "✅ package.json 存在"
                    if command -v jq &> /dev/null; then
                        APP_VERSION=$(jq -r '.version // "unknown"' package.json)
                        echo "📦 应用版本: $APP_VERSION"
                    fi
                fi
                
                # 检查环境配置
                if [ -f ".env" ]; then
                    echo "✅ 环境配置文件存在"
                else
                    echo "⚠️ 环境配置文件缺失"
                fi
                
                # 检查日志目录
                if [ -d "logs" ]; then
                    echo "✅ 日志目录存在"
                    log_count=$(ls -1 logs/ 2>/dev/null | wc -l)
                    echo "📋 日志文件数量: $log_count"
                else
                    echo "⚠️ 日志目录不存在"
                fi
                
                break
            fi
        fi
    done
    
    if [ "$APP_FOUND" = false ]; then
        echo "❌ 未找到应用安装目录"
    fi
    
    # 检查PM2进程
    if command -v pm2 &> /dev/null; then
        echo ""
        echo "📊 PM2 进程状态:"
        pm2 list
        
        # 检查特定应用
        if pm2 list | grep -q "xiaohongshu"; then
            echo "✅ 发现小红书应用进程"
        else
            echo "❌ 未发现小红书应用进程"
        fi
    fi
    
    # 检查端口占用
    echo ""
    echo "🔌 端口检查:"
    for port in 3000 80 443; do
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            echo "✅ 端口 $port 正在监听"
        elif ss -tuln 2>/dev/null | grep -q ":$port "; then
            echo "✅ 端口 $port 正在监听"
        else
            echo "❌ 端口 $port 未监听"
        fi
    done
    
    # 检查系统资源
    echo ""
    echo "💻 系统资源:"
    if command -v free &> /dev/null; then
        echo "内存使用情况:"
        free -h | head -2
    fi
    
    if command -v df &> /dev/null; then
        echo "磁盘使用情况:"
        df -h / | tail -1
    fi
    
    # 检查网络连接
    echo ""
    echo "🌐 网络测试:"
    if curl -s --connect-timeout 5 http://localhost:3000/health > /dev/null; then
        echo "✅ 本地应用健康检查通过"
    else
        echo "❌ 本地应用健康检查失败"
    fi
    
    # 尝试外部访问测试
    external_ip=$(curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "unknown")
    echo "🌍 外部IP: $external_ip"
    
ENDSSH

print_message $BLUE "🌐 外部访问测试..."
if curl -s --connect-timeout 10 "http://$SERVER_IP:3000/health" > /dev/null; then
    print_message $GREEN "✅ 外部访问正常 - http://$SERVER_IP:3000"
else
    print_message $YELLOW "⚠️ 外部访问失败，可能需要检查防火墙设置"
fi

print_message $BLUE "🔍 检查完成!"

