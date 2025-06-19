const { Sequelize } = require('sequelize');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 从环境变量获取数据库配置
const databaseUrl = process.env.DATABASE_URL;
let sequelize;

if (databaseUrl && typeof databaseUrl === 'string' && databaseUrl.startsWith('mysql://')) {
  // Railway提供的DATABASE_URL格式
  console.log('尝试使用DATABASE_URL连接: ', databaseUrl.substring(0, 30) + '...'); // 仅打印部分URL
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'mysql',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false // Railway 通常需要这个
      }
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  console.warn('DATABASE_URL无效或未设置。');
  if (process.env.NODE_ENV === 'production') {
    // 在生产环境中，如果DATABASE_URL无效，这是个严重问题
    console.error('生产环境错误: DATABASE_URL无效。请检查Railway环境变量配置。');
    // 可以选择抛出错误或尝试一个不可能成功的连接，让应用启动失败并提示
    // throw new Error('生产环境DATABASE_URL无效');
    // 或者，为了让健康检查可能通过（如果应用设计为无数据库也能基本运行），可以尝试连接一个伪造的本地地址
    sequelize = new Sequelize('mysql://invalid:invalid@localhost:1234/invalid_db_for_prod_fallback');
  } else {
    // 本地开发环境配置
    console.log('回退到本地开发环境数据库配置...');
    sequelize = new Sequelize(
      process.env.DB_NAME || 'xiaohongshu_assistant',
      process.env.DB_USER || 'root',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: console.log, // 开发环境始终打印日志
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        timezone: '+08:00'
      }
    );
  }
}

// 测试数据库连接（可选，因为异步初始化时也会测试）
// sequelize.authenticate()
//   .then(() => {
//     console.log('✅ (config/database.js) 数据库连接尝试成功');
//   })
//   .catch(err => {
//     console.error('❌ (config/database.js) 数据库连接尝试失败:', err.message);
//   });

// 导入模型
const User = require('../models/User')(sequelize);
const Usage = require('../models/Usage')(sequelize);

// 设置关联关系
const models = { User, Usage };
Object.keys(models).forEach(modelName => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

// 用户与使用记录的关联
User.hasMany(Usage, {
  foreignKey: 'userId',
  as: 'usages'
});

module.exports = {
  sequelize,
  User,
  Usage
}; 