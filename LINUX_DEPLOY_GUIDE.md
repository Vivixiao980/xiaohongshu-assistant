# 🐧 Linux主机部署指南

小红书爆文助手 - Linux服务器部署完整方案

## 📋 部署选项

### 选项1：直接Node.js部署（推荐）

#### 1. 环境准备
```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2进程管理器
sudo npm install -g pm2

# 安装MySQL
sudo apt install mysql-server -y
sudo mysql_secure_installation
```

#### 2. 上传项目文件
```bash
# 方式1：使用scp上传打包文件
scp RED.tar.gz user@your-server:/home/user/
ssh user@your-server
cd /home/user
tar -xzf RED.tar.gz
cd RED

# 方式2：使用git克隆
git clone https://github.com/Vivixiao980/xiaohongshu-assistant.git
cd xiaohongshu-assistant
```

#### 3. 安装依赖和配置
```bash
# 安装依赖
npm install

# 创建环境变量文件
cp env.example .env
nano .env  # 编辑配置

# 配置数据库
mysql -u root -p
CREATE DATABASE xiaohongshu_assistant;
exit

# 初始化数据库
npm run init-db
```

#### 4. 启动服务
```bash
# 使用PM2启动
pm2 start server.js --name "xiaohongshu-app"

# 设置开机自启
pm2 startup
pm2 save

# 检查状态
pm2 status
pm2 logs xiaohongshu-app
```

### 选项2：Docker部署

#### 1. 安装Docker
```bash
# 安装Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 启动Docker服务
sudo systemctl start docker
sudo systemctl enable docker
```

#### 2. 部署应用
```bash
# 上传并解压项目
tar -xzf RED.tar.gz
cd RED

# 启动所有服务
sudo docker-compose up -d

# 查看状态
sudo docker-compose ps
sudo docker-compose logs -f app
```

## 🔧 配置说明

### 环境变量配置 (.env)
```bash
# 基础配置
NODE_ENV=production
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=xiaohongshu_assistant
DB_USER=root
DB_PASSWORD=your_password

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# AI API配置
CUSTOM_CLAUDE_API_KEY=your_claude_api_key
CUSTOM_CLAUDE_BASE_URL=https://api.anthropic.com
CUSTOM_CLAUDE_MODEL=claude-3-5-haiku-20241022

SILICONFLOW_API_KEY=your_siliconflow_api_key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1

# 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=15

# 积分配置
TRIAL_CREDITS=3
MONTHLY_CREDITS=100
```

### Nginx反向代理配置
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🔒 安全配置

### 防火墙设置
```bash
# 安装ufw
sudo apt install ufw

# 配置防火墙
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# 查看状态
sudo ufw status
```

### SSL证书配置
```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo crontab -e
# 添加: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 监控和维护

### 日志管理
```bash
# PM2日志
pm2 logs xiaohongshu-app
pm2 logs xiaohongshu-app --lines 100

# 系统日志
sudo journalctl -u nginx -f
sudo tail -f /var/log/mysql/error.log
```

### 性能监控
```bash
# 系统资源
htop
df -h
free -h

# PM2监控
pm2 monit

# 数据库状态
mysql -u root -p -e "SHOW PROCESSLIST;"
```

### 备份策略
```bash
# 数据库备份
mysqldump -u root -p xiaohongshu_assistant > backup_$(date +%Y%m%d).sql

# 文件备份
tar -czf app_backup_$(date +%Y%m%d).tar.gz /path/to/app/

# 自动备份脚本
cat > /home/user/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u root -p xiaohongshu_assistant > /backups/db_$DATE.sql
tar -czf /backups/app_$DATE.tar.gz /home/user/xiaohongshu-assistant/
# 保留最近7天的备份
find /backups -name "*.sql" -mtime +7 -delete
find /backups -name "*.tar.gz" -mtime +7 -delete
EOF

chmod +x /home/user/backup.sh
# 添加到crontab每日备份
# 0 2 * * * /home/user/backup.sh
```

## 🚀 快速部署脚本

### 一键部署脚本
```bash
#!/bin/bash
# deploy.sh - 一键部署脚本

echo "🚀 开始部署小红书爆文助手..."

# 检查系统
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "❌ 此脚本仅支持Linux系统"
    exit 1
fi

# 更新系统
echo "📦 更新系统..."
sudo apt update && sudo apt upgrade -y

# 安装Node.js
echo "📦 安装Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2
echo "📦 安装PM2..."
sudo npm install -g pm2

# 创建应用目录
echo "📁 创建应用目录..."
mkdir -p /home/$USER/xiaohongshu-app
cd /home/$USER/xiaohongshu-app

# 下载最新代码（如果有git仓库）
if [ -n "$1" ]; then
    echo "📥 下载代码..."
    git clone $1 .
else
    echo "📥 请上传项目文件到当前目录: $(pwd)"
    read -p "上传完成后按Enter继续..."
fi

# 安装依赖
echo "📦 安装依赖..."
npm install

# 配置环境
echo "⚙️ 配置环境..."
if [ ! -f .env ]; then
    cp env.example .env
    echo "请编辑 .env 文件配置API密钥等信息"
    nano .env
fi

# 启动应用
echo "🚀 启动应用..."
pm2 start server.js --name "xiaohongshu-app"
pm2 startup
pm2 save

echo "✅ 部署完成!"
echo "🌐 应用地址: http://$(curl -s ifconfig.me):3000"
echo "📊 查看状态: pm2 status"
echo "📋 查看日志: pm2 logs xiaohongshu-app"
```

## 🔍 故障排除

### 常见问题

1. **端口被占用**
```bash
sudo lsof -i :3000
sudo kill -9 PID
```

2. **权限问题**
```bash
sudo chown -R $USER:$USER /home/$USER/xiaohongshu-app
chmod +x start.sh
```

3. **数据库连接失败**
```bash
# 检查MySQL状态
sudo systemctl status mysql
# 重启MySQL
sudo systemctl restart mysql
# 检查防火墙
sudo ufw status
```

4. **内存不足**
```bash
# 创建swap文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 性能优化

1. **Nginx缓存配置**
2. **数据库索引优化**
3. **CDN配置**
4. **负载均衡**

---

💡 **提示**: 部署完成后，建议配置域名、SSL证书和监控系统，确保生产环境的稳定性和安全性。

