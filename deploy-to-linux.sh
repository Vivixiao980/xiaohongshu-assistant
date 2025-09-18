#!/bin/bash

# 小红书爆文助手 - Linux主机部署脚本
# 使用方法: ./deploy-to-linux.sh [server_ip] [username]

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印彩色消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 检查参数
if [ $# -lt 2 ]; then
    print_message $RED "❌ 用法: $0 [server_ip] [username]"
    print_message $YELLOW "📝 例子: $0 192.168.1.100 ubuntu"
    exit 1
fi

SERVER_IP=$1
USERNAME=$2
APP_NAME="xiaohongshu-assistant"
DEPLOY_PATH="/home/$USERNAME/$APP_NAME"

print_message $BLUE "🚀 开始部署小红书爆文助手到Linux主机..."
print_message $YELLOW "📡 目标服务器: $SERVER_IP"
print_message $YELLOW "👤 用户名: $USERNAME"
print_message $YELLOW "📁 部署路径: $DEPLOY_PATH"

# 1. 创建部署包
print_message $BLUE "📦 创建部署包..."
cd "$(dirname "$0")"

# 创建临时目录
TEMP_DIR=$(mktemp -d)
DEPLOY_PACKAGE="$TEMP_DIR/xiaohongshu-app.tar.gz"

# 排除不需要的文件
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='*.log' \
    --exclude='browser_data' \
    --exclude='temp' \
    --exclude='*.tar.gz' \
    -czf "$DEPLOY_PACKAGE" .

print_message $GREEN "✅ 部署包创建完成: $DEPLOY_PACKAGE"

# 2. 上传到服务器
print_message $BLUE "📤 上传文件到服务器..."
scp "$DEPLOY_PACKAGE" $USERNAME@$SERVER_IP:/tmp/xiaohongshu-app.tar.gz

if [ $? -ne 0 ]; then
    print_message $RED "❌ 文件上传失败，请检查SSH连接"
    rm -rf "$TEMP_DIR"
    exit 1
fi

print_message $GREEN "✅ 文件上传成功"

# 3. 在服务器上执行部署脚本
print_message $BLUE "🔧 在服务器上执行部署..."

ssh $USERNAME@$SERVER_IP << ENDSSH
    set -e
    
    echo "🔧 开始服务器端部署..."
    
    # 创建应用目录
    mkdir -p $DEPLOY_PATH
    cd $DEPLOY_PATH
    
    # 停止现有服务（如果存在）
    if command -v pm2 &> /dev/null; then
        pm2 stop $APP_NAME 2>/dev/null || true
        pm2 delete $APP_NAME 2>/dev/null || true
    fi
    
    # 解压新版本
    tar -xzf /tmp/xiaohongshu-app.tar.gz -C $DEPLOY_PATH --strip-components=0
    
    # 安装Node.js（如果未安装）
    if ! command -v node &> /dev/null; then
        echo "📦 安装Node.js..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # 安装PM2（如果未安装）
    if ! command -v pm2 &> /dev/null; then
        echo "📦 安装PM2..."
        sudo npm install -g pm2
    fi
    
    # 安装依赖
    echo "📦 安装应用依赖..."
    npm install --production
    
    # 创建必要的目录
    mkdir -p logs
    mkdir -p data
    
    # 检查环境配置文件
    if [ ! -f .env ]; then
        if [ -f env.example ]; then
            cp env.example .env
            echo "⚙️ 已创建 .env 文件，请根据需要修改配置"
        else
            echo "⚠️ 未找到环境配置文件，请手动创建 .env"
        fi
    fi
    
    # 设置执行权限
    chmod +x start.sh 2>/dev/null || true
    
    # 启动应用
    echo "🚀 启动应用..."
    pm2 start server.js --name "$APP_NAME" --time
    
    # 设置开机自启动
    pm2 startup | grep -E '^sudo' | bash 2>/dev/null || true
    pm2 save
    
    echo "✅ 应用部署完成!"
    echo "📊 查看状态: pm2 status"
    echo "📋 查看日志: pm2 logs $APP_NAME"
    
    # 显示应用状态
    sleep 3
    pm2 status
    
    # 清理临时文件
    rm -f /tmp/xiaohongshu-app.tar.gz
    
ENDSSH

if [ $? -eq 0 ]; then
    print_message $GREEN "🎉 部署成功完成!"
    print_message $BLUE "🌐 应用访问地址: http://$SERVER_IP:3000"
    print_message $YELLOW "📋 常用命令:"
    print_message $YELLOW "   查看状态: ssh $USERNAME@$SERVER_IP 'pm2 status'"
    print_message $YELLOW "   查看日志: ssh $USERNAME@$SERVER_IP 'pm2 logs $APP_NAME'"
    print_message $YELLOW "   重启应用: ssh $USERNAME@$SERVER_IP 'pm2 restart $APP_NAME'"
    print_message $YELLOW "   停止应用: ssh $USERNAME@$SERVER_IP 'pm2 stop $APP_NAME'"
else
    print_message $RED "❌ 部署过程中出现错误"
fi

# 清理本地临时文件
rm -rf "$TEMP_DIR"

print_message $BLUE "🧹 清理完成"

