const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const winston = require('winston');

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
    message: 'Healthcheck OK - Minimal Version',
    timestamp: new Date().toISOString(),
    port: port,
    env: process.env.NODE_ENV,
    version: 'minimal'
  });
});

// 添加根路径健康检查
app.get('/healthz', (req, res) => {
  res.status(200).send('OK - Minimal');
});

// 基本中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdn.tailwindcss.com",
        "https://code.jquery.com",
        "https://cdnjs.cloudflare.com"
      ],
      styleSrc: [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdn.tailwindcss.com",
        "https://cdnjs.cloudflare.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", "https:", "data:"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 基础API路由（极简版）
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API测试成功',
    timestamp: new Date().toISOString(),
    version: 'minimal'
  });
});

// 基础AI聊天接口（模拟）
app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  
  res.json({
    success: true,
    data: {
      response: `这是一个模拟回复：收到您的消息"${message}"。完整版本部署成功后将提供真实AI功能。`,
      timestamp: new Date().toISOString()
    }
  });
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 极简版服务器已在端口 ${port} 上成功启动！`);
  
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
    
    // 速率限制
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
            resetTime: new Date(Date.now() + 60000).toISOString()
          });
        });
    };

    // 应用速率限制到所有API路由
    app.use('/api', rateLimiterMiddleware);
    
    logger.info('✅ 极简版应用初始化完成');
    logger.info(`🌐 访问地址: http://localhost:${port}`);
    logger.info(`📋 健康检查: http://localhost:${port}/health`);
    
  } catch (error) {
    logger.error('❌ 服务初始化出错:', error.message);
    // 不退出进程，让基础服务继续运行
  }
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('👋 正在优雅关闭服务器...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('👋 收到SIGTERM，正在关闭服务器...');
  process.exit(0);
});

