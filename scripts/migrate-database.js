const { sequelize } = require('../config/database');

async function migrateDatabase() {
  try {
    console.log('🔄 开始数据库迁移...');
    
    // 检查并添加新字段到Users表
    const queryInterface = sequelize.getQueryInterface();
    
    // 获取Users表的描述
    const tableDescription = await queryInterface.describeTable('Users');
    console.log('📋 当前Users表字段:', Object.keys(tableDescription));
    
    // 检查并添加phone字段
    if (!tableDescription.phone) {
      console.log('➕ 添加phone字段...');
      await queryInterface.addColumn('Users', 'phone', {
        type: sequelize.Sequelize.STRING(20),
        allowNull: true
      });
      console.log('✅ phone字段添加成功');
    } else {
      console.log('ℹ️ phone字段已存在');
    }
    
    // 检查并添加emailVerified字段
    if (!tableDescription.emailVerified) {
      console.log('➕ 添加emailVerified字段...');
      await queryInterface.addColumn('Users', 'emailVerified', {
        type: sequelize.Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
      });
      console.log('✅ emailVerified字段添加成功');
    } else {
      console.log('ℹ️ emailVerified字段已存在');
    }
    
    // 检查并添加emailVerifiedAt字段
    if (!tableDescription.emailVerifiedAt) {
      console.log('➕ 添加emailVerifiedAt字段...');
      await queryInterface.addColumn('Users', 'emailVerifiedAt', {
        type: sequelize.Sequelize.DATE,
        allowNull: true
      });
      console.log('✅ emailVerifiedAt字段添加成功');
    } else {
      console.log('ℹ️ emailVerifiedAt字段已存在');
    }
    
    // 更新现有用户的emailVerified状态为true（假设现有用户都是已验证的）
    const [results] = await sequelize.query(
      "UPDATE Users SET emailVerified = true WHERE emailVerified IS NULL OR emailVerified = false"
    );
    console.log(`✅ 更新了现有用户的邮箱验证状态，影响行数: ${results.affectedRows || 0}`);
    
    console.log('🎉 数据库迁移完成！');
    return true;
    
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateDatabase()
    .then(() => {
      console.log('✅ 迁移脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 迁移脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { migrateDatabase }; 