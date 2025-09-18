const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const winston = require('winston');

class XiaohongshuCrawler {
  constructor() {
    this.crawlerPath = path.join(__dirname, '../../crawler/MediaCrawler');
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/crawler.log' })
      ]
    });
  }

  /**
   * 从小红书URL提取帖子ID
   * @param {string} url 小红书链接
   * @returns {string} 帖子ID
   */
  extractPostId(url) {
    // 小红书链接格式：https://www.xiaohongshu.com/explore/id或https://www.xiaohongshu.com/discovery/item/id
    const regex = /(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * 爬取单个小红书帖子
   * @param {string} url 小红书帖子链接
   * @returns {Promise<Object>} 帖子数据
   */
  async crawlPost(url) {
    try {
      const postId = this.extractPostId(url);
      if (!postId) {
        throw new Error('无效的小红书链接');
      }

      this.logger.info(`开始爬取小红书帖子: ${postId}`);

      // 创建临时配置文件
      const configContent = this.generateConfig('detail', [postId]);
      const configPath = path.join(this.crawlerPath, 'temp_config.py');
      await fs.writeFile(configPath, configContent);

      // 执行爬虫
      const result = await this.runCrawler(configPath);
      
      // 清理临时配置文件
      await fs.unlink(configPath).catch(err => 
        this.logger.warn(`清理临时配置文件失败: ${err.message}`)
      );

      return result;
    } catch (error) {
      this.logger.error(`爬取帖子失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 根据关键词搜索小红书内容
   * @param {string} keyword 搜索关键词
   * @param {number} maxCount 最大获取数量
   * @returns {Promise<Array>} 搜索结果
   */
  async searchPosts(keyword, maxCount = 10) {
    try {
      this.logger.info(`开始搜索小红书内容: ${keyword}`);

      // 创建临时配置文件
      const configContent = this.generateConfig('search', [], keyword, maxCount);
      const configPath = path.join(this.crawlerPath, 'temp_config.py');
      await fs.writeFile(configPath, configContent);

      // 执行爬虫
      const result = await this.runCrawler(configPath);
      
      // 清理临时配置文件
      await fs.unlink(configPath).catch(err => 
        this.logger.warn(`清理临时配置文件失败: ${err.message}`)
      );

      return result;
    } catch (error) {
      this.logger.error(`搜索内容失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成爬虫配置
   * @param {string} crawlerType 爬虫类型
   * @param {Array} postIds 帖子ID列表
   * @param {string} keyword 搜索关键词
   * @param {number} maxCount 最大数量
   * @returns {string} 配置内容
   */
  generateConfig(crawlerType, postIds = [], keyword = '', maxCount = 10) {
    return `# 临时生成的配置文件
# 基础配置
PLATFORM = "xhs"  # 平台
LOGIN_TYPE = "qrcode"  # 登录方式
CRAWLER_TYPE = "${crawlerType}"  # 爬取类型

# 搜索配置
KEYWORDS = "${keyword}"  # 关键词
${crawlerType === 'detail' ? `XHS_SPECIFIED_ID_LIST = ${JSON.stringify(postIds)}` : ''}

# 爬取设置
HEADLESS = True  # 无头浏览器
SAVE_LOGIN_STATE = True  # 保存登录状态
ENABLE_IP_PROXY = False  # 禁用代理

# 数据存储配置
SAVE_DATA_OPTION = "json"  # 保存为JSON格式
MAX_NOTES_COUNT = ${maxCount}  # 最大爬取数量

# 其他配置
CRAWLER_MAX_NOTES_COUNT = ${maxCount}
`;
  }

  /**
   * 运行爬虫
   * @param {string} configPath 配置文件路径
   * @returns {Promise<Object>} 爬取结果
   */
  async runCrawler(configPath) {
    return new Promise((resolve, reject) => {
      const pythonPath = 'python';
      const mainScript = path.join(this.crawlerPath, 'main.py');
      
      // 设置环境变量指向临时配置文件
      const env = { 
        ...process.env, 
        PYTHONPATH: this.crawlerPath,
        XHS_CONFIG_PATH: configPath
      };

      const crawler = spawn(pythonPath, [mainScript], {
        cwd: this.crawlerPath,
        env: env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      crawler.stdout.on('data', (data) => {
        stdout += data.toString();
        this.logger.info(`爬虫输出: ${data.toString().trim()}`);
      });

      crawler.stderr.on('data', (data) => {
        stderr += data.toString();
        this.logger.warn(`爬虫错误输出: ${data.toString().trim()}`);
      });

      crawler.on('close', async (code) => {
        if (code === 0) {
          try {
            // 读取爬虫生成的数据文件
            const result = await this.readCrawlerResult();
            resolve(result);
          } catch (error) {
            reject(error);
          }
        } else {
          reject(new Error(`爬虫进程退出，代码: ${code}, 错误: ${stderr}`));
        }
      });

      crawler.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 读取爬虫结果
   * @returns {Promise<Object>} 爬取的数据
   */
  async readCrawlerResult() {
    try {
      // MediaCrawler通常将结果保存在results目录
      const resultsDir = path.join(this.crawlerPath, 'results');
      const files = await fs.readdir(resultsDir);
      
      // 找到最新的JSON文件
      const jsonFiles = files.filter(f => f.endsWith('.json') && f.includes('xhs'));
      if (jsonFiles.length === 0) {
        throw new Error('未找到爬虫结果文件');
      }

      // 按修改时间排序，获取最新文件
      const statsPromises = jsonFiles.map(async file => {
        const filePath = path.join(resultsDir, file);
        const stats = await fs.stat(filePath);
        return { file, mtime: stats.mtime, path: filePath };
      });

      const fileStats = await Promise.all(statsPromises);
      fileStats.sort((a, b) => b.mtime - a.mtime);

      // 读取最新文件
      const latestFile = fileStats[0];
      const content = await fs.readFile(latestFile.path, 'utf8');
      const data = JSON.parse(content);

      this.logger.info(`读取爬虫结果成功: ${latestFile.file}`);
      return data;
    } catch (error) {
      this.logger.error(`读取爬虫结果失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 格式化小红书帖子数据
   * @param {Object} rawData 原始数据
   * @returns {Object} 格式化后的数据
   */
  formatPostData(rawData) {
    if (!rawData || typeof rawData !== 'object') {
      throw new Error('无效的帖子数据');
    }

    return {
      id: rawData.note_id || rawData.id,
      title: rawData.title || '',
      content: rawData.desc || rawData.content || '',
      author: {
        id: rawData.user?.user_id || rawData.author_id,
        nickname: rawData.user?.nickname || rawData.author_name || '',
        avatar: rawData.user?.avatar || rawData.author_avatar || ''
      },
      images: rawData.images || [],
      tags: rawData.tag_list || rawData.tags || [],
      stats: {
        likeCount: rawData.liked_count || rawData.like_count || 0,
        collectCount: rawData.collected_count || rawData.collect_count || 0,
        commentCount: rawData.comment_count || 0,
        shareCount: rawData.share_count || 0
      },
      publishTime: rawData.time || rawData.publish_time || '',
      url: rawData.note_url || `https://www.xiaohongshu.com/explore/${rawData.note_id || rawData.id}`,
      rawData: rawData // 保留原始数据
    };
  }
}

module.exports = XiaohongshuCrawler;