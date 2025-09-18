#!/usr/bin/env node
/**
 * 手动Cookie配置工具
 */

const fs = require('fs').promises;
const path = require('path');

console.log('🍪 手动Cookie配置工具');
console.log('=====================================');
console.log('');
console.log('如果自动获取Cookie遇到问题，您可以手动配置Cookie：');
console.log('');
console.log('📋 步骤1：打开浏览器，访问 https://www.xiaohongshu.com');
console.log('📋 步骤2：登录您的小红书账号');
console.log('📋 步骤3：按F12打开开发者工具');
console.log('📋 步骤4：切换到Application/应用程序 标签');
console.log('📋 步骤5：左侧选择Cookies > xiaohongshu.com');
console.log('📋 步骤6：找到以下重要Cookie并记录：');
console.log('       - web_session');
console.log('       - a1');
console.log('       - webId');
console.log('       - xsecappid');
console.log('');

async function createCookieTemplate() {
  const cookieTemplate = {
    "description": "用户小红书登录Cookie配置",
    "lastUpdated": new Date().toISOString(),
    "cookies": [
      {
        "name": "web_session", 
        "value": "请替换为您的web_session值",
        "domain": ".xiaohongshu.com",
        "path": "/"
      },
      {
        "name": "xsecappid",
        "value": "xhs-pc-web", 
        "domain": ".xiaohongshu.com",
        "path": "/"
      },
      {
        "name": "a1",
        "value": "请替换为您的a1值",
        "domain": ".xiaohongshu.com",
        "path": "/"
      },
      {
        "name": "webId", 
        "value": "请替换为您的webId值",
        "domain": ".xiaohongshu.com", 
        "path": "/"
      }
    ]
  };
  
  try {
    const configPath = path.join(__dirname, '../config/user-cookies-template.json');
    await fs.writeFile(configPath, JSON.stringify(cookieTemplate, null, 2), 'utf8');
    console.log('📄 已创建Cookie模板文件: config/user-cookies-template.json');
    console.log('📝 请编辑此文件，将模板中的值替换为您实际的Cookie值');
    console.log('✅ 完成后将文件重命名为: user-cookies.json');
  } catch (error) {
    console.error('❌ 创建模板文件失败:', error.message);
  }
}

createCookieTemplate();