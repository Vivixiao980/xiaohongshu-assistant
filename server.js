const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { RateLimiterMemory } = require('rate-limiter-flexible');
const winston = require('winston');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 导入路由
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const { sequelize } = require('./config/database');

// 创建Express应用
const app = express();

// 强制应用在容器内部监听3000端口，以匹配Dockerfile的EXPOSE和HEALTHCHECK
const port = 3000;
console.log(`环境变量 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`环境变量 PORT (from Railway, if any): ${process.env.PORT}`);
console.log(`应用将监听端口: ${port}`);

// 配置日志
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'xiaohongshu-assistant' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// 速率限制配置
const rateLimiter = new RateLimiterMemory({
  keyPrefix: 'middleware',
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 15,
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 || 900, // 15分钟
});

const rateLimiterMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
    res.set('Retry-After', String(secs));
    res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试',
      retryAfter: secs
    });
  }
};

// 中间件配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "https://cdn.tailwindcss.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? true // 生产环境允许所有域名
    : ['http://localhost:3000', 'http://127.0.0.1:3000'], // 开发环境
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 应用速率限制到API路由
app.use('/api', rateLimiterMiddleware);

// 路由配置
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// 首页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '服务正常运行',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '请求的资源不存在'
  });
});

// 全局错误处理中间件
app.use((error, req, res, next) => {
  logger.error('未处理的错误:', error);
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? '服务器内部错误' 
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

// 启动服务器
async function startServer() {
  try {
    // 先启动HTTP服务器，确保健康检查能通过
    app.listen(port, () => {
      logger.info(`服务器启动成功，端口: ${port}`);
      logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`访问地址: http://localhost:${port}`);
      
      // 异步初始化数据库，不阻塞服务器启动
      initializeDatabaseAsync();
    });
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 异步数据库初始化函数
async function initializeDatabaseAsync() {
  try {
    logger.info('开始异步初始化数据库...');
    
    // 导入数据库初始化函数
    const initializeDatabase = require('./scripts/init-db');
    await initializeDatabase();
    
    logger.info('数据库初始化完成');
  } catch (error) {
    logger.warn('数据库初始化失败，但服务器继续运行:', error.message);
    logger.info('数据库将在连接可用时自动重连');
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('接收到SIGTERM信号，正在关闭服务器...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('接收到SIGINT信号，正在关闭服务器...');
  await sequelize.close();
  process.exit(0);
});

// 启动服务器
startServer(); 