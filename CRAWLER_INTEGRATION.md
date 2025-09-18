# 小红书爬虫集成指南

## 🚨 重要说明

当前版本使用的是**模拟数据**，用于功能演示。如需获取真实的小红书内容，需要集成真实的爬虫服务。

## 📋 当前状态

- ✅ AI分析功能正常
- ✅ 内容生成功能正常  
- ✅ 知识库功能正常
- ⚠️ 内容获取功能使用模拟数据
- ⚠️ 前端已标识演示模式

## 🔧 集成真实爬虫的方案

### 方案1：使用开源爬虫项目

推荐使用项目中已包含的 `MediaCrawler` 框架：

```bash
# 进入爬虫目录
cd crawler/MediaCrawler

# 安装依赖
pip install -r requirements.txt

# 配置小红书爬虫
python main.py --platform xhs --keywords "测试" --login-type qrcode
```

**修改 `simplifiedXiaohongshuCrawler.js`：**

```javascript
async crawlPost(url) {
  try {
    // 调用 Python 爬虫脚本
    const { exec } = require('child_process');
    const result = await new Promise((resolve, reject) => {
      exec(`cd crawler/MediaCrawler && python -c "
        from media_platform.xhs import XhsCrawler
        crawler = XhsCrawler()
        data = crawler.get_note_detail('${url}')
        print(json.dumps(data))
      "`, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(JSON.parse(stdout));
      });
    });
    
    return this.formatRealData(result);
  } catch (error) {
    // 降级到模拟数据
    return this.generateMockData(postId, url);
  }
}
```

### 方案2：使用第三方API服务

**推荐的第三方服务：**

1. **RapidAPI 小红书接口**
   - 费用：$0.01/请求
   - 稳定性：⭐⭐⭐⭐
   - 集成难度：简单

2. **自建代理池**
   - 费用：服务器成本
   - 稳定性：⭐⭐⭐
   - 集成难度：复杂

**示例代码：**

```javascript
async crawlPost(url) {
  try {
    const response = await axios.post('https://api.example.com/xhs/detail', {
      url: url,
      headers: {
        'X-API-Key': process.env.XHS_API_KEY
      }
    });
    
    return this.formatRealData(response.data);
  } catch (error) {
    this.logger.warn('API调用失败，使用模拟数据');
    return this.generateMockData(postId, url);
  }
}
```

### 方案3：浏览器自动化

使用 Puppeteer 或 Playwright：

```javascript
const puppeteer = require('puppeteer');

async crawlPost(url) {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.goto(url);
    
    // 等待内容加载
    await page.waitForSelector('.note-content');
    
    // 提取数据
    const data = await page.evaluate(() => {
      return {
        title: document.querySelector('.title')?.textContent,
        content: document.querySelector('.content')?.textContent,
        // ... 其他字段
      };
    });
    
    return this.formatRealData(data);
  } finally {
    await browser.close();
  }
}
```

## ⚙️ 环境变量配置

在 `.env` 文件中添加：

```env
# 爬虫配置
CRAWLER_MODE=real  # 设置为 'real' 启用真实爬虫，'mock' 使用模拟数据
XHS_API_KEY=your_api_key_here
XHS_PROXY_URL=http://your-proxy.com

# 浏览器配置（如使用Puppeteer）
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## 🛡️ 法律合规注意事项

1. **遵守robots.txt**：检查目标网站的爬虫协议
2. **频率控制**：避免过于频繁的请求
3. **数据使用**：仅用于合法的分析和学习目的
4. **用户协议**：遵守小红书的用户服务协议

## 🚀 部署建议

### 开发环境
- 使用模拟数据进行功能开发和测试
- 确保核心业务逻辑正确

### 测试环境
- 集成真实爬虫，小规模测试
- 验证数据格式和错误处理

### 生产环境
- 使用稳定的第三方API或自建服务
- 配置监控和降级机制
- 定期备份和更新爬虫策略

## 📞 技术支持

如需集成协助，可以：

1. 查看 `MediaCrawler` 项目文档
2. 参考现有的模拟数据格式
3. 测试API接口的数据结构兼容性

---

**⚠️ 免责声明：请确保你的爬虫行为符合相关法律法规和网站服务条款。**