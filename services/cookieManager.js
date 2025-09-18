const fs = require('fs').promises;
const path = require('path');
const { chromium } = require('playwright');

class CookieManager {
  constructor() {
    this.cookiePath = path.join(__dirname, '../config/user-cookies.json');
    this.userDataDir = path.join(__dirname, '../temp/browser-profile');
  }

  /**
   * 启动浏览器获取Cookie
   * 这个方法会打开一个浏览器窗口，用户手动登录后获取Cookie
   */
  async launchCookieCapture() {
    console.log('🚀 启动Cookie获取工具...');
    
    try {
      // 确保用户数据目录存在
      await this.ensureDirectoryExists(this.userDataDir);
      
      const browser = await chromium.launchPersistentContext(this.userDataDir, {
        headless: false, // 显示浏览器窗口
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      const page = browser.pages()[0] || await browser.newPage();
      
      // 添加额外的反检测脚本
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // 移除automation标志
        delete window.chrome.runtime.onConnect;
        
        // 模拟真实的插件数量
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });
      });

      console.log('🌐 正在打开小红书登录页面...');
      await page.goto('https://www.xiaohongshu.com', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      console.log('👤 请在浏览器中完成登录操作...');
      console.log('📋 登录成功后，请在终端按 Enter 键继续...');

      // 等待用户输入
      await this.waitForUserInput();

      // 获取当前页面的Cookie
      const cookies = await browser.cookies();
      
      // 过滤出小红书相关的Cookie
      const xhsCookies = cookies.filter(cookie => 
        cookie.domain.includes('xiaohongshu.com')
      );

      if (xhsCookies.length === 0) {
        throw new Error('未获取到小红书相关的Cookie，请确认已成功登录');
      }

      // 保存Cookie到配置文件
      await this.saveCookies(xhsCookies);

      console.log(`✅ 成功获取 ${xhsCookies.length} 个Cookie并保存`);
      
      // 测试Cookie有效性
      const isValid = await this.testCookieValidity(page);
      
      await browser.close();
      
      return {
        success: true,
        cookieCount: xhsCookies.length,
        isValid,
        message: isValid ? 'Cookie获取成功且有效' : 'Cookie获取成功但可能需要验证'
      };

    } catch (error) {
      console.error('❌ Cookie获取失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 测试Cookie有效性
   */
  async testCookieValidity(page) {
    try {
      console.log('🧪 测试Cookie有效性...');
      
      // 访问一个需要登录的页面
      await page.goto('https://www.xiaohongshu.com/explore', {
        waitUntil: 'networkidle',
        timeout: 15000
      });

      // 检查是否被重定向到登录页面
      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('404')) {
        return false;
      }

      // 检查页面是否包含登录后才有的元素
      const hasUserElements = await page.evaluate(() => {
        // 查找用户头像或其他登录后的元素
        return document.querySelector('[class*="avatar"]') !== null ||
               document.querySelector('[class*="user"]') !== null ||
               document.querySelector('[data-v-*]') !== null;
      });

      return hasUserElements;
    } catch (error) {
      console.log('⚠️ Cookie有效性测试出错:', error.message);
      return false;
    }
  }

  /**
   * 保存Cookie到配置文件
   */
  async saveCookies(cookies) {
    const cookieConfig = {
      description: "用户小红书登录Cookie配置",
      lastUpdated: new Date().toISOString(),
      cookies: cookies.map(cookie => ({
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

    await fs.writeFile(
      this.cookiePath, 
      JSON.stringify(cookieConfig, null, 2), 
      'utf8'
    );
  }

  /**
   * 加载保存的Cookie
   */
  async loadCookies() {
    try {
      const data = await fs.readFile(this.cookiePath, 'utf8');
      const config = JSON.parse(data);
      return config.cookies || [];
    } catch (error) {
      console.log('⚠️ 未找到Cookie配置文件');
      return [];
    }
  }

  /**
   * 检查Cookie是否过期
   */
  async isCookieExpired() {
    try {
      const data = await fs.readFile(this.cookiePath, 'utf8');
      const config = JSON.parse(data);
      const lastUpdated = new Date(config.lastUpdated);
      const now = new Date();
      
      // Cookie通常7天有效期
      const daysDiff = (now - lastUpdated) / (1000 * 60 * 60 * 24);
      return daysDiff > 7;
    } catch (error) {
      return true; // 如果读取失败，认为已过期
    }
  }

  /**
   * 自动刷新Cookie
   */
  async refreshCookiesIfNeeded() {
    const isExpired = await this.isCookieExpired();
    if (isExpired) {
      console.log('🔄 检测到Cookie已过期，启动自动刷新...');
      return await this.launchCookieCapture();
    }
    return { success: true, message: 'Cookie仍然有效' };
  }

  /**
   * 等待用户输入
   */
  async waitForUserInput() {
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

  /**
   * 确保目录存在
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 获取格式化的Cookie字符串（用于HTTP请求）
   */
  async getCookieString() {
    const cookies = await this.loadCookies();
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  }

  /**
   * 获取Cookie对象数组（用于Playwright）
   */
  async getCookieArray() {
    return await this.loadCookies();
  }
}

module.exports = CookieManager;