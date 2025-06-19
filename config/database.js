const { Sequelize } = require('sequelize');

if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 从环境变量获取数据库配置
const databaseUrl = process.env.DATABASE_URL;

let sequelize;

if (databaseUrl) {
  // Railway提供的DATABASE_URL格式
  sequelize = new Sequelize(databaseUrl, {
    dialect: 'mysql',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
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
  // 本地开发环境配置
  sequelize = new Sequelize(
    process.env.DB_NAME || 'xiaohongshu_assistant',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
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

// 测试数据库连接
sequelize.authenticate()
  .then(() => {
    console.log('✅ 数据库连接成功');
  })
  .catch(err => {
    console.error('❌ 数据库连接失败:', err);
  });

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