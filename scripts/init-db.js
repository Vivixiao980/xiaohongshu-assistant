// const { sequelize } = require('../config/database');
// const User = require('../models/User');
// const Usage = require('../models/Usage');
const { sequelize, User, Usage } = require('../config/database'); // 从config/database获取初始化后的模型
const bcrypt = require('bcryptjs');

async function initializeDatabase() {
  try {
    console.log('🚀 正在初始化数据库...');
    
    // 测试数据库连接
    await sequelize.authenticate();
    console.log('✅ 数据库连接成功');
    
    // 同步数据库表
    await sequelize.sync({ force: false });
    console.log('✅ 数据库表同步完成');
    
    // 创建默认管理员账户（可选）
    const adminExists = await User.findOne({ where: { email: 'admin@xiaohongshu.com' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123456', 10);
      await User.create({
        username: 'admin',
        email: 'admin@xiaohongshu.com',
        password: hashedPassword,
        userType: 'student',
        credits: 1000
      });
      console.log('✅ 默认管理员账户创建完成');
      console.log('📧 邮箱: admin@xiaohongshu.com');
      console.log('🔑 密码: admin123456');
    } else {
      console.log('ℹ️  管理员账户已存在');
    }
    
    // 创建演示用户账户
    const demoExists = await User.findOne({ where: { email: 'demo@xiaohongshu.com' } });
    if (!demoExists) {
      const hashedPassword = await bcrypt.hash('demo123456', 10);
      await User.create({
        username: 'demo',
        email: 'demo@xiaohongshu.com',
        password: hashedPassword,
        userType: 'trial',
        credits: 3
      });
      console.log('✅ 演示用户账户创建完成');
      console.log('📧 邮箱: demo@xiaohongshu.com');
      console.log('🔑 密码: demo123456');
    } else {
      console.log('ℹ️  演示用户账户已存在');
    }
    
    console.log('🎉 数据库初始化完成！');
    console.log('📊 数据库状态: 正常');
    console.log('👥 用户账户: 已创建');
    console.log('�� 系统准备就绪');
    
    return true;
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
    console.error('🔍 错误详情:', error);
    
    // 在Railway环境中，如果数据库连接失败，我们仍然继续启动应用
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️  生产环境：继续启动应用，数据库将在连接可用时自动重连');
      return false;
    } else {
      throw error;
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initializeDatabase()
    .then((success) => {
      if (success) {
        console.log('✅ 数据库初始化成功');
        process.exit(0);
      } else {
        console.log('⚠️  数据库初始化部分失败，但应用将继续启动');
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('❌ 数据库初始化失败:', error);
      process.exit(1);
    });
}

module.exports = initializeDatabase; 