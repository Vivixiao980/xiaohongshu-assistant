const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const winston = require('winston');

// Polyfill for File API in Node.js environments
if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(fileBits, fileName, options = {}) {
      this.name = fileName;
      this.type = options.type || '';
      this.lastModified = options.lastModified || Date.now();
      this.size = 0;
      if (Array.isArray(fileBits)) {
        this.size = fileBits.reduce((acc, bit) => acc + (bit.length || bit.byteLength || 0), 0);
      }
    }
  };
}

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 遵循平台标准：优先使用Railway提供的PORT
const port = process.env.PORT || 3000;
console.log(`环境变量 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`环境变量 PORT (from Railway, if any): ${process.env.PORT}`);
console.log(`应用将监听平台指定的端口: ${port}`);

const app = express();

// =================================================================
// 关键：立即注册健康检查路由，不依赖任何外部模块
// =================================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Healthcheck OK',
    timestamp: new Date().toISOString(),
    port: port,
    env: process.env.NODE_ENV
  });
});

// 添加根路径健康检查
app.get('/healthz', (req, res) => {
  res.status(200).send('OK');
});

// 基本中间件 - 配置宽松的CSP以支持开发工具
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'",  // 允许eval，支持Tailwind CSS等工具
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com",
        "https://code.jquery.com",
        "https:",
        "data:",
        "blob:"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com",
        "https:"
      ],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "wss:", "ws:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "data:", "blob:", "https:"],
      frameSrc: ["'self'", "https:"],
    },
  }
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  // 在服务器成功监听后，再加载和设置其他所有东西
  console.log(`服务器已在端口 ${port} 上成功启动。现在开始加载依赖和初始化数据库...`);

  // 配置日志
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
      new winston.transports.Console({ format: winston.format.simple() }),
    ],
  });

  try {
    const { RateLimiterMemory } = require('rate-limiter-flexible');
    const authRoutes = require('./routes/auth');
    const apiRoutes = require('./routes/api');
    
    // 速率限制 - 调整为更合理的限制
    const rateLimiter = new RateLimiterMemory({
      points: 100, // 每分钟100个请求
      duration: 60, // 1分钟窗口
    });
    const rateLimiterMiddleware = (req, res, next) => {
      rateLimiter.consume(req.ip)
        .then(() => next())
        .catch(() => {
          console.log(`⚠️ 速率限制触发 - IP: ${req.ip}, URL: ${req.url}`);
          res.status(429).json({
            success: false,
            error: '请求过于频繁，请稍后再试',
            retryAfter: 60
          });
        });
    };
    app.use('/api', rateLimiterMiddleware);

    // 路由
    app.use('/auth', authRoutes);
    app.use('/api', apiRoutes);

    // 首页路由
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    console.log('路由和中间件加载完成。');

    // 异步数据库初始化
    initializeDatabaseAsync(logger);

  } catch (err) {
    logger.error('在服务器启动回调中加载依赖时出错:', err);
  }
});

// 异步数据库初始化函数
async function initializeDatabaseAsync(logger) {
  try {
    logger.info('开始异步初始化数据库...');
    
    // 使用setTimeout确保不阻塞主线程
    setTimeout(async () => {
      try {
        const initializeDatabase = require('./scripts/init-db');
        await initializeDatabase();
        logger.info('数据库初始化成功完成。');
      } catch (error) {
        logger.error('数据库初始化过程中发生错误:', error);
        // 不退出进程，让应用继续运行
      }
    }, 1000); // 延迟1秒启动数据库初始化
    
  } catch (error) {
    logger.error('数据库初始化准备过程中发生错误:', error);
  }
}

// =================================================================
// 关键：添加全局错误捕获，确保任何崩溃都会被记录
// =================================================================
process.on('uncaughtException', (err, origin) => {
  console.error(`捕获到未处理的异常: ${err.message}`);
  console.error(`异常源头: ${origin}`);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:');
  console.error(reason);
  // 在生产环境中，关键任务应该在此处退出
  // process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('接收到SIGTERM信号，准备关闭服务器...');
  // 在这里可以添加清理逻辑，比如关闭数据库连接
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('接收到SIGINT信号，正在关闭服务器...');
  // 在这里可以添加清理逻辑，比如关闭数据库连接
  process.exit(0);
}); 