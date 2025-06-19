# 使用Node.js官方镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制package.json和package-lock.json（如果存在）
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制应用代码
COPY . .

# 创建日志目录
RUN mkdir -p logs

# 移除固定的HEALTHCHECK，让Railway来处理
# HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=10 CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

# 启动命令
CMD ["node", "server.js"] 