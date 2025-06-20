const bcrypt = require('bcrypt');
const { User, sequelize } = require('../config/database');

async function createAdminUser() {
  try {
    // 确保数据库连接
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 同步数据库表
    await sequelize.sync();
    console.log('数据库表同步完成');

    // 检查是否已存在管理员账户
    const existingAdmin = await User.findOne({ 
      where: { username: 'admin' } 
    });

    if (existingAdmin) {
      console.log('管理员账户已存在');
      console.log('用户名: admin');
      console.log('邮箱:', existingAdmin.email);
      console.log('用户类型:', existingAdmin.userType);
      console.log('积分:', existingAdmin.credits);
      return;
    }

    // 创建管理员账户
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await User.create({
      username: 'admin',
      email: 'admin@xiaohongshu-assistant.com',
      password: hashedPassword,
      phone: null,
      userType: 'student', // 设为正式学员，有100积分
      credits: 1000, // 给管理员更多积分
      maxCredits: 1000,
      isActive: true,
      isEmailVerified: true
    });

    console.log('✅ 管理员账户创建成功！');
    console.log('用户名: admin');
    console.log('密码: admin123');
    console.log('邮箱: admin@xiaohongshu-assistant.com');
    console.log('用户类型: student');
    console.log('积分: 1000');
    console.log('');
    console.log('请使用这些凭据登录系统进行测试');

  } catch (error) {
    console.error('创建管理员账户失败:', error);
  } finally {
    await sequelize.close();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  createAdminUser();
}

module.exports = createAdminUser; 