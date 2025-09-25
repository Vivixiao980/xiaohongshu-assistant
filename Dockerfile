# 使用Node.js 20 LTS版本以获得更好的Web API支持
FROM node:20-slim

# 安装必要的系统依赖和Python环境
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    sqlite3 \
    curl \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 设置npm配置以避免不必要的输出
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

# 首先复制package.json
COPY package.json ./

# 安装依赖，跳过可选依赖和开发依赖
RUN npm install --only=production --no-optional \
    && npm cache clean --force

# 复制应用代码
COPY server.js ./
COPY routes/ ./routes/
COPY models/ ./models/
COPY services/ ./services/
COPY scripts/ ./scripts/
COPY config/ ./config/
COPY public/ ./public/

# 复制Python相关文件
COPY requirements.txt ./
COPY video_transcriber.py ./

# 创建Python虚拟环境并安装依赖
RUN python3 -m venv video_transcribe_env && \
    . video_transcribe_env/bin/activate && \
    pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 创建必要的目录
RUN mkdir -p logs temp knowledge-base

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# 启动应用
EXPOSE 3000
CMD ["node", "server.js"] 