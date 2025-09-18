#!/usr/bin/env node
/**
 * 简化版Cookie获取工具 - 避免浏览器实例冲突
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

async function simpleCookieCapture() {
  console.log('🍪 简化版Cookie获取工具');
  console.log('=====================================');
  
  try {
    console.log('🚀 启动浏览器（无头模式关闭，您将看到浏览器窗口）...');
    
    // 使用临时浏览器实例，避免持久化配置冲突
    const browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    console.log('🌐 正在打开小红书首页...');
    await page.goto('https://www.xiaohongshu.com', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('👤 浏览器已打开！请按照以下步骤操作：');
    console.log('');
    console.log('第1步：在浏览器中点击"登录"按钮');
    console.log('第2步：使用您的小红书账号登录');
    console.log('第3步：确认登录成功（能看到个人头像）');
    console.log('第4步：回到这里，按任意键+Enter继续...');
    console.log('');
    
    // 等待用户输入
    await waitForUserInput();
    
    console.log('🍪 正在获取Cookie...');
    
    // 获取所有Cookie
    const cookies = await context.cookies();
    
    // 过滤小红书相关Cookie
    const xhsCookies = cookies.filter(cookie => 
      cookie.domain.includes('xiaohongshu.com')
    );
    
    if (xhsCookies.length === 0) {
      console.log('❌ 未获取到小红书相关Cookie');
      console.log('💡 请确认已在浏览器中成功登录小红书');
      await browser.close();
      return;
    }
    
    // 保存Cookie到配置文件
    const cookieConfig = {
      description: "用户小红书登录Cookie配置",
      lastUpdated: new Date().toISOString(),
      cookies: xhsCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite
      }))
    };
    
    const configPath = path.join(__dirname, '../config/user-cookies.json');
    await fs.writeFile(configPath, JSON.stringify(cookieConfig, null, 2), 'utf8');
    
    console.log(`✅ 成功获取并保存 ${xhsCookies.length} 个Cookie`);
    console.log('📁 配置文件已更新: config/user-cookies.json');
    
    // 测试Cookie有效性
    console.log('🧪 测试Cookie有效性...');
    try {
      await page.goto('https://www.xiaohongshu.com/explore', { 
        waitUntil: 'networkidle',
        timeout: 15000 
      });
      
      const currentUrl = page.url();
      if (!currentUrl.includes('login') && !currentUrl.includes('404')) {
        console.log('✅ Cookie有效性验证通过');
      } else {
        console.log('⚠️ Cookie可能需要进一步验证');
      }
    } catch (error) {
      console.log('⚠️ Cookie有效性测试出错，但Cookie已保存');
    }
    
    await browser.close();
    console.log('🎉 Cookie获取完成！');
    
  } catch (error) {
    console.error('❌ Cookie获取失败:', error.message);
  }
  
  console.log('=====================================');
}

function waitForUserInput() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
}

// 运行Cookie获取
simpleCookieCapture().catch(console.error);