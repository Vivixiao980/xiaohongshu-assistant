const axios = require('axios');
const cheerio = require('cheerio');
const winston = require('winston');
const { spawn } = require('child_process');
const path = require('path');

class SimplifiedXiaohongshuCrawler {
  constructor() {
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
    
    // 爬虫模式配置
    this.crawlerMode = process.env.CRAWLER_MODE || 'mock'; // 'mock' 或 'real'
    this.pythonPath = process.env.PYTHON_VENV_PATH || path.join(__dirname, '../../crawler/MediaCrawler/venv/bin/python');
    this.enableRealCrawler = this.crawlerMode === 'real';
    
    this.logger.info(`爬虫模式: ${this.crawlerMode}`);
    if (this.enableRealCrawler) {
      this.logger.info(`Python路径: ${this.pythonPath}`);
    }
  }

  /**
   * 从小红书URL提取帖子ID
   * @param {string} url 小红书链接
   * @returns {string} 帖子ID
   */
  extractPostId(url) {
    // 小红书链接格式：
    // https://www.xiaohongshu.com/explore/id
    // https://www.xiaohongshu.com/discovery/item/id
    // https://xhslink.com/xxx (短链接)
    const patterns = [
      /(?:explore|discovery\/item)\/([a-zA-Z0-9]+)/,
      /xhslink\.com\/([a-zA-Z0-9]+)/,
      /\/([a-zA-Z0-9]{24})/  // 24位长度的ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    
    return null;
  }

  /**
   * 调用Python爬虫脚本
   * @param {string} url 目标URL
   * @param {string} action 操作类型 ('note' 或 'user')
   * @param {number} limit 限制数量（用于用户帖子）
   * @param {string} userId 用户ID（用于获取登录cookies）
   * @returns {Promise<Object>} 爬取结果
   */
  async crawlWithPython(url, action, limit = 10, userId = null) {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, '../../crawler_api.py');
      
      const args = [scriptPath, action, url];
      if (action === 'user') {
        args.push(limit.toString());
      }

      this.logger.info(`调用Python爬虫: ${this.pythonPath} ${args.join(' ')}`);

      // 准备环境变量
      const env = { 
        ...process.env, 
        PYTHONIOENCODING: 'utf-8' 
      };
      
      // 如果有用户ID，尝试获取登录cookies
      if (userId) {
        try {
          // 引入API路由来获取用户cookies
          const apiRouter = require('../../routes/api');
          const userCookies = apiRouter.getUserLoginCookies(userId);
          if (userCookies && userCookies.length > 0) {
            env.XHS_COOKIES = JSON.stringify(userCookies);
            this.logger.info(`为用户 ${userId} 传递了 ${userCookies.length} 个登录cookies`);
          }
        } catch (error) {
          this.logger.warn(`获取用户cookies失败: ${error.message}`);
        }
      }

      const pythonProcess = spawn(this.pythonPath, args, {
        cwd: path.join(__dirname, '../..'),
        env: env
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (parseError) {
            this.logger.error('解析Python输出失败:', parseError.message);
            this.logger.error('Python输出:', stdout);
            reject(new Error('解析爬虫结果失败'));
          }
        } else {
          this.logger.error(`Python爬虫执行失败，退出码: ${code}`);
          this.logger.error('错误输出:', stderr);
          reject(new Error(`Python爬虫执行失败: ${stderr || '未知错误'}`));
        }
      });

      pythonProcess.on('error', (error) => {
        this.logger.error('启动Python进程失败:', error.message);
        reject(new Error(`启动Python爬虫失败: ${error.message}`));
      });

      // 设置超时
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Python爬虫执行超时'));
      }, 60000); // 60秒超时
    });
  }

  /**
   * 爬取小红书帖子（支持真实爬虫和模拟数据）
   * @param {string} url 小红书帖子链接
   * @param {string} userId 用户ID（用于获取登录cookies）
   * @returns {Promise<Object>} 帖子数据
   */
  async crawlPost(url, userId = null) {
    try {
      const postId = this.extractPostId(url);
      if (!postId) {
        throw new Error('无效的小红书链接');
      }

      this.logger.info(`开始爬取小红书帖子: ${postId}`);

      // 根据配置决定是否使用真实爬虫
      if (this.enableRealCrawler) {
        try {
          const realData = await this.crawlWithPython(url, 'note', 10, userId);
          if (realData && realData.success && realData.data && realData.data.posts && realData.data.posts.length > 0) {
            this.logger.info(`使用真实爬虫成功获取帖子数据: ${postId}`);
            // 标记为真实数据
            realData.data.posts[0].isDemo = false;
            return realData.data.posts[0];
          }
        } catch (pythonError) {
          this.logger.warn(`Python爬虫失败，降级到模拟数据: ${pythonError.message}`);
        }
      } else {
        this.logger.info(`当前为模拟模式，跳过真实爬虫: ${postId}`);
      }

      // 降级到模拟数据
      this.logger.info(`使用模拟数据: ${postId}`);
      const mockData = this.generateMockData(postId, url);
      
      this.logger.info(`成功获取帖子数据: ${postId}`);
      return mockData;
    } catch (error) {
      this.logger.error(`爬取帖子失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 根据关键词搜索小红书内容（演示版本）
   * @param {string} keyword 搜索关键词
   * @param {number} maxCount 最大获取数量
   * @returns {Promise<Array>} 搜索结果
   */
  async searchPosts(keyword, maxCount = 10) {
    try {
      this.logger.info(`开始搜索小红书内容: ${keyword}`);

      // 生成模拟的搜索结果
      const mockResults = [];
      for (let i = 0; i < Math.min(maxCount, 5); i++) {
        mockResults.push(this.generateMockData(`search_${i}`, '', keyword));
      }
      
      this.logger.info(`搜索完成，找到 ${mockResults.length} 条结果`);
      return mockResults;
    } catch (error) {
      this.logger.error(`搜索内容失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成模拟数据
   * @param {string} postId 帖子ID
   * @param {string} url 原始URL
   * @param {string} keyword 关键词（可选）
   * @returns {Object} 模拟的帖子数据
   */
  generateMockData(postId, url = '', keyword = '') {
    const demoDataSets = {
      beauty: {
        titles: [
          '🌟干皮救星！这5款面霜让你水润一整天',
          '💄平价口红推荐，学生党必入的宝藏色号',
          '✨素颜霜测评｜哪款最自然不假白？',
          '🧴护肤顺序大揭秘，新手也能轻松get',
          '🌸春季护肤攻略，告别换季烂脸'
        ],
        contents: [
          `🌟干皮救星来啦！亲测5款超好用面霜
#护肤 #干皮护肤 #面霜推荐 #学生党护肤

姐妹们！作为一个资深干皮，我终于找到了几款真正好用的面霜！今天必须安利给大家✨

💧【兰蔻小黑瓶面霜】
质地：偏厚重但好吸收
效果：保湿效果超棒，第二天起来脸还是嫩嫩的
价格：略贵但值得

🌿【理肤泉B5修复霜】 
质地：轻薄易推开
效果：修复+保湿，敏感肌也能用
价格：学生党友好

🥥【椰子油面霜】
质地：丰润不粘腻  
效果：深层滋润，适合极干肌
价格：超级平价

使用tips：
⭐洁面后先用爽肤水
⭐精华液按摩至吸收
⭐面霜厚敷当晚霜使用

坚持用一个月，你会发现皮肤真的变好了！有什么护肤问题欢迎评论区交流～`,

          `💄平价口红推荐｜学生党必入
#口红推荐 #平价彩妆 #学生党 #美妆种草

学生党集合！今天推荐几款超好用的平价口红，颜值和实用性都在线💕

🍓【花西子同心锁口红】
色号：A05玫瑰豆沙
质地：丝绒哑光，不拔干
显色度：一涂就很显色
适合：日常通勤，温柔知性

🌹【完美日记小黑钻】  
色号：M02红棕色
质地：水润不沾杯
显色度：饱和度刚好
适合：约会必备，超显气质

🥤【橘朵奶茶色系】
色号：218奶茶色
质地：顺滑好涂
显色度：自然显白
适合：学生党日常，减龄必备

💰价格都在50元以内，性价比超高！
颜色都很日常，新手也不会踩雷～

大家还想看什么彩妆推荐？评论区告诉我！`
        ]
      },
      lifestyle: {
        titles: [
          '📚25岁后必须养成的6个好习惯',
          '🏠租房党的精致生活指南',
          '⏰时间管理达人的一天安排',
          '💪健身小白入门必看攻略',
          '🌱极简生活，让我找回内心平静'
        ],
        contents: [
          `📚25岁后，这6个习惯让我越来越优秀
#自我提升 #好习惯养成 #生活方式

25岁是个分水岭，开始意识到习惯的重要性。分享6个让我受益匪浅的习惯💪

🌅【早起习惯】
6:30起床，给自己充足的晨间时光
- 冥想10分钟，清理大脑
- 喝温水，唤醒身体
- 制定今日计划

📖【阅读习惯】
每天至少读书30分钟
- 通勤时间利用起来
- 睡前看纸质书
- 做读书笔记，记录感悟

💰【理财习惯】
每月固定储蓄+投资
- 工资到手先存30%
- 学习基金定投
- 记录每笔支出

🏃‍♀️【运动习惯】
每周至少运动3次
- 瑜伽/跑步/游泳轮换
- 从15分钟开始
- 找运动伙伴互相监督

🎯【复盘习惯】
每周日晚上总结这一周
- 完成了什么目标
- 遇到什么困难
- 下周如何改进

💝【感恩习惯】
睡前写感恩日记
- 记录3件让我开心的事
- 感谢帮助过我的人
- 保持正向心态

这些习惯让我变得更自律、更积极！你们有什么好习惯推荐吗？`
        ]
      },
      food: {
        titles: [
          '🍳10分钟搞定的快手早餐',
          '🥗减脂期也能吃的美味轻食',
          '🍰新手也能成功的免烤甜品',
          '🔥懒人必备的一锅炖菜谱',
          '☕️在家调制网红饮品'
        ],
        contents: [
          `🍳10分钟快手早餐，好吃又营养！
#早餐 #快手菜 #营养搭配 #上班族

每天早上时间紧张？这几道10分钟早餐拯救你！营养均衡又好吃💕

🥪【牛油果吐司】
- 全麦面包2片
- 牛油果1个捣碎
- 煎蛋1个
- 撒点黑胡椒和盐
⏰用时：5分钟

🥣【酸奶杯】  
- 无糖酸奶200ml
- 燕麦片30g
- 蓝莓适量
- 坚果碎少许
⏰用时：3分钟

🍜【番茄鸡蛋面】
- 挂面100g
- 鸡蛋2个
- 番茄1个切丁
- 葱花调味
⏰用时：8分钟

🥤【香蕉奶昔】
- 香蕉1根
- 牛奶250ml
- 燕麦片20g
- 蜂蜜1勺打成奶昔
⏰用时：2分钟

🌯【蔬菜卷饼】
- 墨西哥薄饼1张
- 生菜、番茄、黄瓜丝
- 煎蛋或午餐肉
- 沙拉酱调味
⏰用时：6分钟

提前一晚准备食材，早上快速组装！
你们还有什么快手早餐推荐？`
        ]
      }
    };

    // 根据URL或关键词选择数据集，默认混合
    let selectedDataSet;
    if (keyword) {
      if (keyword.includes('护肤') || keyword.includes('美妆') || keyword.includes('口红')) {
        selectedDataSet = demoDataSets.beauty;
      } else if (keyword.includes('生活') || keyword.includes('习惯') || keyword.includes('自律')) {
        selectedDataSet = demoDataSets.lifestyle;
      } else if (keyword.includes('美食') || keyword.includes('早餐') || keyword.includes('菜谱')) {
        selectedDataSet = demoDataSets.food;
      }
    }
    
    // 如果没有匹配的数据集，随机选择一个
    if (!selectedDataSet) {
      const dataSets = Object.values(demoDataSets);
      selectedDataSet = dataSets[Math.floor(Math.random() * dataSets.length)];
    }
    
    const titles = selectedDataSet.titles;
    const contents = selectedDataSet.contents;

    // 根据数据集选择对应的作者和标签
    const authorsByType = {
      beauty: [
        { nickname: '美妆小达人', avatar: 'https://example.com/avatar1.jpg' },
        { nickname: '护肤心得', avatar: 'https://example.com/avatar2.jpg' },
        { nickname: '彩妆种草机', avatar: 'https://example.com/avatar3.jpg' }
      ],
      lifestyle: [
        { nickname: '自律生活家', avatar: 'https://example.com/avatar4.jpg' },
        { nickname: '习惯养成师', avatar: 'https://example.com/avatar5.jpg' },
        { nickname: '生活美学', avatar: 'https://example.com/avatar6.jpg' }
      ],
      food: [
        { nickname: '厨房小白', avatar: 'https://example.com/avatar7.jpg' },
        { nickname: '美食记录', avatar: 'https://example.com/avatar8.jpg' },
        { nickname: '简食生活', avatar: 'https://example.com/avatar9.jpg' }
      ]
    };

    const tagsByType = {
      beauty: [
        ['护肤', '美妆', '口红', '学生党'],
        ['干皮护肤', '面霜推荐', '平价好物'],
        ['彩妆种草', '美妆测评', '护肤心得']
      ],
      lifestyle: [
        ['自我提升', '好习惯', '自律生活'],
        ['时间管理', '生活方式', '习惯养成'],
        ['生活美学', '极简生活', '个人成长']
      ],
      food: [
        ['美食', '早餐', '快手菜', '上班族'],
        ['轻食', '营养搭配', '简单料理'],
        ['懒人菜谱', '健康饮食', '美食分享']
      ]
    };

    // 确定当前使用的数据类型
    let dataType = 'beauty'; // 默认
    if (selectedDataSet === demoDataSets.lifestyle) dataType = 'lifestyle';
    if (selectedDataSet === demoDataSets.food) dataType = 'food';

    const authors = authorsByType[dataType];
    const tags = tagsByType[dataType];

    // 随机选择数据
    const randomTitle = titles[Math.floor(Math.random() * titles.length)];
    const randomContent = contents[Math.floor(Math.random() * contents.length)];
    const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
    const randomTags = tags[Math.floor(Math.random() * tags.length)];

    // 如果有关键词，在标题和内容中加入关键词
    const finalTitle = keyword ? `${keyword}相关：${randomTitle}` : randomTitle;
    const finalContent = keyword ? `${keyword}\n\n${randomContent}` : randomContent;

    return {
      note_id: postId,
      id: postId,
      title: finalTitle,
      desc: finalContent,
      content: finalContent,
      user: {
        user_id: `user_${Math.random().toString(36).substr(2, 9)}`,
        nickname: randomAuthor.nickname,
        avatar: randomAuthor.avatar
      },
      author_id: `user_${Math.random().toString(36).substr(2, 9)}`,
      author: randomAuthor.nickname,  // 修复：使用author字段而不是author_name
      author_avatar: randomAuthor.avatar,
      images: [
        'https://example.com/image1.jpg',
        'https://example.com/image2.jpg'
      ],
      tag_list: randomTags,
      tags: randomTags,
      liked_count: Math.floor(Math.random() * 10000) + 1000,
      like_count: Math.floor(Math.random() * 10000) + 1000,
      collected_count: Math.floor(Math.random() * 5000) + 500,
      collect_count: Math.floor(Math.random() * 5000) + 500,
      comment_count: Math.floor(Math.random() * 1000) + 100,
      share_count: Math.floor(Math.random() * 500) + 50,
      time: new Date().toISOString(),
      publish_time: new Date().toISOString(),
      note_url: url || `https://www.xiaohongshu.com/explore/${postId}`,
      isDemo: true // 标记为演示数据
    };
  }

  /**
   * 获取用户的帖子列表（支持真实爬虫和模拟数据）
   * @param {string} profileUrl 用户主页链接
   * @param {number} maxCount 最大获取数量
   * @param {string} requestUserId 请求用户ID（用于获取登录cookies）
   * @returns {Promise<Array>} 用户帖子列表
   */
  async getUserPosts(profileUrl, maxCount = 10, requestUserId = null) {
    try {
      const userId = this.extractUserId(profileUrl);
      if (!userId) {
        throw new Error('无效的用户主页链接');
      }

      this.logger.info(`开始获取用户帖子: ${userId}`);

      // 根据配置决定是否使用真实爬虫
      if (this.enableRealCrawler) {
        try {
          const realData = await this.crawlWithPython(profileUrl, 'user', maxCount, requestUserId);
          if (realData && realData.success && realData.data && realData.data.posts && realData.data.posts.length > 0) {
            this.logger.info(`使用真实爬虫成功获取用户帖子，共 ${realData.data.posts.length} 篇`);
            return realData.data.posts.map(post => {
              post.isDemo = false; // 标记为真实数据
              return this.formatPostToSimpleFormat(post);
            });
          }
        } catch (pythonError) {
          this.logger.warn(`Python爬虫失败，降级到模拟数据: ${pythonError.message}`);
        }
      } else {
        this.logger.info(`当前为模拟模式，跳过真实爬虫: ${userId}`);
      }

      // 降级到模拟数据
      this.logger.info(`使用模拟数据获取用户帖子: ${userId}`);
      const mockPosts = [];
      for (let i = 0; i < Math.min(maxCount, 10); i++) {
        const postData = this.generateMockData(`${userId}_post_${i}`, profileUrl);
        mockPosts.push(this.formatPostToSimpleFormat(postData));
      }
      
      this.logger.info(`成功获取用户帖子，共 ${mockPosts.length} 篇`);
      return mockPosts;
    } catch (error) {
      this.logger.error(`获取用户帖子失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取单个帖子内容（支持真实爬虫和模拟数据）
   * @param {string} postUrl 帖子链接
   * @param {string} userId 用户ID（用于获取登录cookies）
   * @returns {Promise<Object>} 帖子内容
   */
  async getPostContent(postUrl, userId = null) {
    try {
      const postId = this.extractPostId(postUrl);
      if (!postId) {
        throw new Error('无效的帖子链接');
      }

      this.logger.info(`开始获取帖子内容: ${postId}`);

      // 根据配置决定是否使用真实爬虫
      if (this.enableRealCrawler) {
        try {
          const realData = await this.crawlWithPython(postUrl, 'note', 10, userId);
          if (realData && realData.success && realData.data && realData.data.posts && realData.data.posts.length > 0) {
            this.logger.info(`使用真实爬虫成功获取帖子内容: ${postId}`);
            realData.data.posts[0].isDemo = false; // 标记为真实数据
            return this.formatPostToSimpleFormat(realData.data.posts[0]);
          }
        } catch (pythonError) {
          this.logger.warn(`Python爬虫失败，降级到模拟数据: ${pythonError.message}`);
        }
      } else {
        this.logger.info(`当前为模拟模式，跳过真实爬虫: ${postId}`);
      }

      // 降级到模拟数据
      this.logger.info(`使用模拟数据获取帖子内容: ${postId}`);
      const mockData = this.generateMockData(postId, postUrl);
      const formattedData = this.formatPostToSimpleFormat(mockData);
      
      this.logger.info(`成功获取帖子内容: ${postId}`);
      return formattedData;
    } catch (error) {
      this.logger.error(`获取帖子内容失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 从用户主页URL提取用户ID
   * @param {string} url 用户主页链接
   * @returns {string} 用户ID
   */
  extractUserId(url) {
    // 小红书用户主页格式：
    // https://www.xiaohongshu.com/user/profile/用户ID
    const pattern = /\/user\/profile\/([a-zA-Z0-9]+)/;
    const match = url.match(pattern);
    return match ? match[1] : null;
  }

  /**
   * 将完整的帖子数据格式化为简化格式（用于前端显示）
   * @param {Object} rawData 原始帖子数据
   * @returns {Object} 简化格式的帖子数据
   */
  formatPostToSimpleFormat(rawData) {
    return {
      id: rawData.note_id || rawData.id,
      title: this.extractTitle(rawData.title || rawData.desc || rawData.content || ''),
      content: rawData.desc || rawData.content || '',
      images: rawData.images || [],
      publishTime: rawData.publishTime || this.formatTime(rawData.time || rawData.publish_time),
      crawlTime: rawData.crawlTime || this.formatTime(new Date()),  // 保留Python的crawlTime字段
      likes: rawData.liked_count || rawData.like_count || rawData.stats?.likes || 0,
      comments: rawData.comment_count || rawData.stats?.comments || 0,
      shares: rawData.share_count || rawData.stats?.shares || 0,
      popularity: this.calculatePopularity(rawData),
      author: rawData.author || rawData.author_name || rawData.user?.nickname || '匿名用户',
      tags: rawData.tag_list || rawData.tags || [],
      url: rawData.url || rawData.note_url || `https://www.xiaohongshu.com/explore/${rawData.note_id || rawData.id}`,
      source: rawData.source || 'SimpleXHSCrawler',  // 保留Python的source字段
      isDemo: rawData.isDemo !== undefined ? rawData.isDemo : true // 默认标记为演示数据
    };
  }

  /**
   * 从内容中提取标题
   * @param {string} content 内容
   * @returns {string} 提取的标题
   */
  extractTitle(content) {
    if (!content) return '未命名笔记';
    
    // 提取第一行作为标题，去掉表情符号
    const firstLine = content.split('\n')[0];
    const cleanTitle = firstLine.replace(/[#@]/g, '').trim();
    
    // 如果标题太长，截取前30个字符
    return cleanTitle.length > 30 ? cleanTitle.substring(0, 30) + '...' : cleanTitle;
  }

  /**
   * 格式化时间
   * @param {string} timeStr 时间字符串
   * @returns {string} 格式化后的时间
   */
  formatTime(timeStr) {
    if (!timeStr) return '未知时间';
    
    try {
      const date = new Date(timeStr);
      const now = new Date();
      const diffMs = now - date;
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHours / 24);
      
      if (diffDays > 7) {
        return date.toLocaleDateString('zh-CN');
      } else if (diffDays > 0) {
        return `${diffDays}天前`;
      } else if (diffHours > 0) {
        return `${diffHours}小时前`;
      } else {
        return '刚刚';
      }
    } catch (error) {
      return '未知时间';
    }
  }

  /**
   * 计算帖子热度
   * @param {Object} rawData 原始数据
   * @returns {string} 热度等级
   */
  calculatePopularity(rawData) {
    const likes = rawData.liked_count || rawData.like_count || 0;
    const comments = rawData.comment_count || 0;
    const shares = rawData.share_count || 0;
    
    const totalEngagement = likes + comments * 10 + shares * 5;
    
    if (totalEngagement > 50000) return '爆款';
    if (totalEngagement > 10000) return '热门';
    if (totalEngagement > 1000) return '上升';
    return '稳定';
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
      isDemo: rawData.isDemo || false,
      rawData: rawData // 保留原始数据
    };
  }
}

module.exports = SimplifiedXiaohongshuCrawler;