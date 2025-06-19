const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const winston = require('winston');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 最终修复：强制应用在容器内部监听3000端口，以匹配Dockerfile的EXPOSE指令和Railway的流量路由
const port = 3000;
console.log(`环境变量 NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`环境变量 PORT (from Railway, if any): ${process.env.PORT}`);
console.log(`应用将强制监听端口: ${port}，以匹配Dockerfile的EXPOSE设置。`);

const app = express();

// =================================================================
// 关键：立即注册健康检查路由，不依赖任何外部模块
// =================================================================
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Healthcheck OK',
    timestamp: new Date().toISOString(),
  });
});

// 基本中间件
app.use(helmet()); // 移除复杂的CSP策略以简化调试
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器
app.listen(port, () => {
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
    
    // 速率限制
    const rateLimiter = new RateLimiterMemory({
      points: 15,
      duration: 900,
    });
    const rateLimiterMiddleware = (req, res, next) => {
      rateLimiter.consume(req.ip)
        .then(() => next())
        .catch(() => res.status(429).send('Too Many Requests'));
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
    const initializeDatabase = require('./scripts/init-db');
    await initializeDatabase();
    logger.info('数据库初始化成功完成。');
  } catch (error) {
    logger.error('数据库初始化过程中发生错误:', error);
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