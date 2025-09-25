const { Sequelize } = require('sequelize');

// 加载环境变量
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

// 从环境变量获取数据库配置
const databaseUrl = process.env.DATABASE_URL;
let sequelize;

if (databaseUrl && typeof databaseUrl === 'string' && databaseUrl.startsWith('mysql://')) {
  // Railway提供的DATABASE_URL格式
  console.log('✅ 使用Railway MySQL数据库:', databaseUrl.substring(0, 30) + '...');
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
  console.warn('⚠️ DATABASE_URL无效或未设置');
  // 使用SQLite作为备选数据库（适用于开发和生产环境）
  console.log('🔧 使用SQLite数据库作为备选方案');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: process.env.NODE_ENV === 'production' ? '/app/database.sqlite' : './database.sqlite',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
  
  if (process.env.NODE_ENV === 'production') {
    console.log('📝 生产环境提示: 如需使用MySQL，请在Railway中配置DATABASE_URL环境变量');
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