#!/usr/bin/env node
/**
 * 交互式Cookie获取工具
 */

const CookieManager = require('../services/cookieManager');

async function interactiveCookieCapture() {
  console.log('🍪 交互式小红书Cookie获取');
  console.log('=====================================');
  
  const cookieManager = new CookieManager();
  
  try {
    console.log('🚀 正在启动浏览器...');
    console.log('⚠️  浏览器窗口将在几秒钟内打开');
    console.log('📋 请在浏览器中完成以下操作：');
    console.log('   1. 等待页面加载完成');
    console.log('   2. 点击登录按钮');
    console.log('   3. 输入您的小红书账号密码');
    console.log('   4. 完成登录验证');
    console.log('   5. 确认已登录（能看到个人头像）');
    console.log('   6. 回到这里按 y 然后 Enter 继续');
    console.log('');
    
    const result = await cookieManager.launchCookieCapture();
    
    if (result.success) {
      console.log('🎉 Cookie获取成功！');
      console.log(`📊 获取到 ${result.cookieCount} 个Cookie`);
      console.log(`✅ 有效性验证: ${result.isValid ? '通过' : '需要进一步验证'}`);
      
      // 立即测试Cookie
      console.log('🧪 正在测试Cookie有效性...');
      const cookieString = await cookieManager.getCookieString();
      console.log(`🔑 Cookie字符串长度: ${cookieString.length} 字符`);
      
      if (cookieString.length > 0) {
        console.log('✅ Cookie配置文件已更新');
        console.log('📁 配置文件位置: config/user-cookies.json');
      }
      
    } else {
      console.log('❌ Cookie获取失败:', result.error);
      console.log('💡 可能的原因：');
      console.log('   - 网络连接问题');
      console.log('   - 登录过程中断');
      console.log('   - 浏览器环境异常');
      console.log('');
      console.log('🔄 建议重新尝试或检查网络连接');
    }
    
  } catch (error) {
    console.log('💥 Cookie获取过程出错:', error.message);
  }
  
  console.log('=====================================');
}

// 运行交互式获取
interactiveCookieCapture().catch(console.error);