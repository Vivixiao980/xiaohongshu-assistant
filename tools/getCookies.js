#!/usr/bin/env node
/**
 * Cookie获取工具 - 独立运行脚本
 * 使用方法: node tools/getCookies.js
 */

const CookieManager = require('../services/cookieManager');

async function main() {
  console.log('🍪 小红书Cookie获取工具');
  console.log('=====================================');
  
  const cookieManager = new CookieManager();
  
  // 检查现有Cookie状态
  console.log('📋 检查现有Cookie状态...');
  const isExpired = await cookieManager.isCookieExpired();
  
  if (!isExpired) {
    console.log('✅ 当前Cookie仍然有效');
    console.log('如果仍要重新获取，请按 y + Enter，否则按 Enter 退出:');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question('', (input) => {
        rl.close();
        resolve(input.toLowerCase());
      });
    });

    if (answer !== 'y') {
      console.log('👋 退出Cookie获取工具');
      process.exit(0);
    }
  }
  
  // 启动Cookie获取
  console.log('🚀 启动浏览器进行Cookie获取...');
  console.log('⚠️  注意: 请确保网络连接正常，并准备好小红书账号');
  
  const result = await cookieManager.launchCookieCapture();
  
  if (result.success) {
    console.log('🎉 Cookie获取成功!');
    console.log(`📊 获取到 ${result.cookieCount} 个Cookie`);
    console.log(`✅ 有效性验证: ${result.isValid ? '通过' : '需要进一步验证'}`);
    
    // 测试Cookie
    console.log('🧪 正在测试Cookie...');
    const cookieString = await cookieManager.getCookieString();
    console.log(`🔑 Cookie字符串长度: ${cookieString.length} 字符`);
    
  } else {
    console.log('❌ Cookie获取失败:', result.error);
    console.log('💡 建议检查网络连接和浏览器环境');
  }
  
  console.log('=====================================');
  console.log('✨ Cookie获取工具运行完成');
}

// 错误处理
process.on('uncaughtException', (error) => {
  console.error('💥 未捕获的异常:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('💥 未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 运行主函数
main().catch(console.error);