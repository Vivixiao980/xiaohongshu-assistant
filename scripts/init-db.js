const { sequelize } = require('../config/database');
const User = require('../models/User');
const Usage = require('../models/Usage');
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
    console.log('🔧 系统准备就绪');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    console.error('🔍 错误详情:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase; 