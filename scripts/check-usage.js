#!/usr/bin/env node
const { sequelize, Usage, User } = require('../config/database');
const axios = require('axios');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, text) {
  console.log(colors[color] + text + colors.reset);
}

async function checkDatabaseUsage() {
  try {
    colorLog('cyan', '\n=== 数据库用量统计 ===');
    
    // 测试数据库连接
    await sequelize.authenticate();
    colorLog('green', '✅ 数据库连接成功');
    
    // 获取总用量统计
    const totalUsage = await Usage.count();
    colorLog('bright', `📊 总API调用次数: ${totalUsage}`);
    
    if (totalUsage === 0) {
      colorLog('yellow', '⚠️  数据库中暂无使用记录（可能是免登录模式）');
      return;
    }
    
    // 按模型统计
    const modelStats = await Usage.findAll({
      attributes: [
        'model',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        [sequelize.fn('AVG', sequelize.col('processingTime')), 'avgTime']
      ],
      group: ['model']
    });
    
    colorLog('cyan', '\n📈 按模型统计:');
    modelStats.forEach(stat => {
      const modelName = stat.model === 'claude' ? 'Claude' : 'DeepSeek';
      const avgTime = stat.dataValues.avgTime ? (stat.dataValues.avgTime / 1000).toFixed(2) + 's' : 'N/A';
      colorLog('blue', `  ${modelName}: ${stat.dataValues.count} 次调用，平均响应时间 ${avgTime}`);
    });
    
    // 按功能统计
    const actionStats = await Usage.findAll({
      attributes: [
        'actionType',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['actionType']
    });
    
    colorLog('cyan', '\n🔧 按功能统计:');
    actionStats.forEach(stat => {
      const actionName = stat.actionType === 'analyze' ? '拆解分析' : '生成仿写';
      colorLog('blue', `  ${actionName}: ${stat.dataValues.count} 次`);
    });
    
    // 最近10条记录
    const recentUsage = await Usage.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: ['model', 'actionType', 'processingTime', 'status', 'createdAt']
    });
    
    if (recentUsage.length > 0) {
      colorLog('cyan', '\n📝 最近使用记录:');
      recentUsage.forEach((usage, index) => {
        const modelName = usage.model === 'claude' ? 'Claude' : 'DeepSeek';
        const actionName = usage.actionType === 'analyze' ? '拆解分析' : '生成仿写';
        const time = usage.createdAt.toLocaleString('zh-CN');
        const processingTime = usage.processingTime ? (usage.processingTime / 1000).toFixed(2) + 's' : 'N/A';
        const status = usage.status === 'success' ? '✅' : '❌';
        
        colorLog('blue', `  ${index + 1}. ${time} | ${modelName} | ${actionName} | ${processingTime} ${status}`);
      });
    }
    
  } catch (error) {
    colorLog('red', '❌ 数据库查询失败: ' + error.message);
  }
}

async function checkAPIEndpoints() {
  colorLog('cyan', '\n=== API端点测试 ===');
  
  const baseUrl = 'https://xiaohongshu-assistant-production.up.railway.app';
  
  try {
    // 测试健康检查
    const healthResponse = await axios.get(`${baseUrl}/health`, { timeout: 10000 });
    colorLog('green', '✅ 服务器健康检查通过');
    
    // 测试用量统计API
    try {
      const statsResponse = await axios.get(`${baseUrl}/api/usage/stats`, { timeout: 10000 });
      colorLog('green', '✅ 用量统计API可访问');
      colorLog('blue', `📊 统计数据: ${JSON.stringify(statsResponse.data.data, null, 2)}`);
    } catch (error) {
      colorLog('yellow', '⚠️  用量统计API访问失败: ' + error.message);
    }
    
    // 测试最近记录API
    try {
      const recentResponse = await axios.get(`${baseUrl}/api/usage/recent`, { timeout: 10000 });
      colorLog('green', '✅ 最近记录API可访问');
      if (recentResponse.data.data.length > 0) {
        colorLog('blue', `📝 最近记录: ${recentResponse.data.data.length} 条`);
      } else {
        colorLog('yellow', '⚠️  暂无最近记录（免登录模式）');
      }
    } catch (error) {
      colorLog('yellow', '⚠️  最近记录API访问失败: ' + error.message);
    }
    
  } catch (error) {
    colorLog('red', '❌ 服务器连接失败: ' + error.message);
  }
}

async function checkAPIConfig() {
  colorLog('cyan', '\n=== API配置检查 ===');
  
  // 检查环境变量
  const configs = [
    { name: 'CUSTOM_CLAUDE_API_KEY', value: process.env.CUSTOM_CLAUDE_API_KEY, type: 'Claude API' },
    { name: 'CUSTOM_CLAUDE_BASE_URL', value: process.env.CUSTOM_CLAUDE_BASE_URL, type: 'Claude Base URL' },
    { name: 'CUSTOM_CLAUDE_MODEL', value: process.env.CUSTOM_CLAUDE_MODEL, type: 'Claude Model' },
    { name: 'SILICONFLOW_API_KEY', value: process.env.SILICONFLOW_API_KEY, type: 'SiliconFlow API' },
    { name: 'DATABASE_URL', value: process.env.DATABASE_URL ? '已配置' : undefined, type: 'Database' }
  ];
  
  configs.forEach(config => {
    if (config.value) {
      const displayValue = config.name.includes('KEY') && config.value !== '已配置' 
        ? config.value.substring(0, 10) + '...' 
        : config.value;
      colorLog('green', `✅ ${config.type}: ${displayValue}`);
    } else {
      colorLog('red', `❌ ${config.type}: 未配置`);
    }
  });
}

async function main() {
  colorLog('bright', '🔍 小红书爆文助手 - API用量检查工具');
  colorLog('bright', '==========================================');
  
  // 加载环境变量
  if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
  }
  
  await checkAPIConfig();
  await checkDatabaseUsage();
  await checkAPIEndpoints();
  
  colorLog('bright', '\n==========================================');
  colorLog('green', '✅ 用量检查完成');
  
  // 关闭数据库连接
  await sequelize.close();
}

// 运行主函数
main().catch(error => {
  colorLog('red', '❌ 检查过程中发生错误: ' + error.message);
  console.error(error);
  process.exit(1);
}); 