const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { User, Usage } = require('../config/database');
const aiService = require('../services/aiService');
const usageTracker = require('../services/usageTracker');
const XiaohongshuCrawler = require('../services/crawler/simplifiedXiaohongshuCrawler');
const FeishuBitableService = require('../services/feishuService');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const router = express.Router();

// 初始化飞书服务
const feishuService = new FeishuBitableService();

// 认证中间件 (免登录模式)
const authMiddleware = async (req, res, next) => {
  try {
    // 免登录模式：创建虚拟用户对象
    req.user = {
      id: 'demo-user',
      username: '免登录用户',
      userType: 'trial',
      credits: 999999, // 无限积分
      maxCredits: 999999,
      isActive: true,
      canUseService: () => true,
      useCredit: async () => true, // 总是返回true，不实际扣积分
      save: async () => true
    };
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: '系统错误'
    });
  }
};

// 检查积分中间件 (免登录模式)
const checkCreditsMiddleware = (req, res, next) => {
  // 免登录模式：跳过积分检查
  next();
};

// AI改写服务
router.post('/ai-rewrite', authMiddleware, checkCreditsMiddleware, [
  body('topicIdeas').notEmpty().withMessage('选题思路不能为空'),
  body('contentType').isIn(['image', 'video']).withMessage('内容类型必须是image或video'),
  body('generateCount').isInt({ min: 1, max: 5 }).withMessage('生成数量必须在1-5之间')
], async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '请求参数错误',
        errors: errors.array()
      });
    }

    const {
      topicIdeas,
      referenceContent = '',
      targetKeywords = '',
      targetAudience = '',
      toneStyle = 'energetic',
      contentLength = 'medium',
      generateCount = 3,
      contentType = 'image'
    } = req.body;

    console.log('收到AI改写请求:', {
      topicIdeas,
      contentType,
      generateCount,
      toneStyle,
      contentLength
    });

    // 构建基于Vivi风格的提示词
    const viviStylePrompt = `
你是一位专业的小红书内容创作助手，请根据以下信息生成${contentType === 'image' ? '图文文案' : '视频脚本'}：

**创作者背景：**
- 身份：互联网公司CEO助理
- 风格：元气少女Vivi子✨，活力有趣但有深度
- 擅长：职场成长、商业思维、个人探索

**选题思路：**
${topicIdeas}

${referenceContent ? `**参考文案：**\n${referenceContent}\n` : ''}

**创作要求：**
- 内容类型：${contentType === 'image' ? '小红书图文文案' : '视频口播文案（纯文字脚本，无分镜描述）'}
- 语调风格：${toneStyle === 'professional' ? '专业干练' : toneStyle === 'friendly' ? '亲和友好' : toneStyle === 'energetic' ? '活力有趣' : '励志激昂'}
- 内容长度：${contentLength === 'short' ? '简短精炼(1-2分钟)' : contentLength === 'medium' ? '中等详细(2-3分钟)' : '详细丰富(3-5分钟)'}
- 目标关键词：${targetKeywords || '职场成长,商业思维'}
- 目标受众：${targetAudience || '职场新人,创业者'}

**风格特点：**
${contentType === 'image' ? 
`1. 标题要有提问和感叹，使用适量emoji
2. 内容口语化，像和朋友聊天
3. 结构清晰：痛点引入 -> 个人观点/案例 -> 方法论总结 -> 鼓励式结尾
4. 适量使用emoji和分段提升可读性
5. 结尾要有互动引导` :
`1. 开场要抓人：用疑问句或惊叹句开头，立即吸引注意力
2. 口播节奏：语句简短有力，适合口语表达，避免长句
3. 个人化表达：多用"我"、"你们"、"姐妹们"等亲近称呼
4. 逻辑清晰：开场引入 -> 干货分享 -> 个人体验 -> 行动建议 -> 互动结尾
5. 语言生动：用比喻、举例让内容更有画面感
6. 停顿提示：在关键信息前后自然停顿（用省略号...表示）
7. 强调重点：重要信息可重复表达或用感叹加强语气`}

请生成${generateCount}个不同的方案。

请严格按照以下JSON格式返回（不要包含其他文字）：
[
  {
    "title": "吸引人的标题",
    "content": "主要内容",
    "tags": "建议的话题标签"
  }
]
    `;

    // 调用AI服务
    const aiResponse = await aiService.generateContent(viviStylePrompt);
    
    let results = [];
    try {
      console.log('AI响应长度:', aiResponse.length);
      console.log('AI响应开头:', aiResponse.substring(0, 100));
      console.log('AI响应结尾:', aiResponse.substring(aiResponse.length - 100));
      
      // 清理响应内容，去除首尾空白字符
      const cleanResponse = aiResponse.trim();
      
      // 优先尝试解析数组格式 [...]
      let jsonMatch = cleanResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        console.log('找到数组格式JSON');
        results = JSON.parse(jsonMatch[0]);
      } else {
        // 尝试解析对象格式 {...}
        jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsedJson = JSON.parse(jsonMatch[0]);
          
          // 检查是否有proposals数组
          if (parsedJson.proposals && Array.isArray(parsedJson.proposals)) {
            results = parsedJson.proposals;
          } else if (parsedJson.title && parsedJson.content) {
            // 单个结果格式
            results = [parsedJson];
          } else {
            throw new Error('JSON格式不符合预期');
          }
        } else {
          throw new Error('未找到JSON格式');
        }
      }
      
      // 确保结果是数组
      if (!Array.isArray(results)) {
        results = [results];
      }
      
      // 生成多个方案（如果请求的数量大于1）
      if (results.length === 1 && generateCount > 1) {
        console.log(`需要生成${generateCount}个方案，当前只有1个，生成更多版本`);
        const baseResult = results[0];
        for (let i = 1; i < generateCount; i++) {
          results.push({
            title: baseResult.title + ` (方案${i + 1})`,
            content: baseResult.content,
            tags: baseResult.tags
          });
        }
      }
      
      console.log(`成功解析AI响应，生成了${results.length}个方案`);
    } catch (parseError) {
      console.log('AI回复JSON解析失败:', parseError.message);
      console.log('使用文本解析作为备用方案');
      // 如果解析失败，将整个回复作为内容
      results = [{
        title: `${contentType === 'image' ? '图文' : '视频'}创作方案`,
        content: aiResponse,
        tags: targetKeywords || '职场成长,商业思维'
      }];
    }

    // 记录用量
    await usageTracker.logAPICall({
      userId: req.user.id,
      model: 'ai_rewrite',
      usage: {
        contentType,
        generateCount: results.length,
        inputLength: topicIdeas.length
      }
    });

    console.log('AI改写完成，生成了', results.length, '个方案');

    res.json({
      success: true,
      data: results,
      message: `成功生成${results.length}个${contentType === 'image' ? '图文' : '视频'}方案`
    });

  } catch (error) {
    console.error('AI改写失败:', error);
    
    res.status(500).json({
      success: false,
      message: 'AI创作服务暂时不可用，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 视频转文字服务
router.post('/video-transcribe', authMiddleware, checkCreditsMiddleware, [
  body('videoUrl').isURL().withMessage('请提供有效的视频链接')
], async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '请求参数错误',
        errors: errors.array()
      });
    }

    const { videoUrl } = req.body;

    console.log('收到视频转文字请求:', videoUrl);

    // 调用Python脚本处理视频
    const scriptPath = path.join(__dirname, '..', 'video_transcriber.py');
    const pythonPath = path.join(__dirname, '..', 'video_transcribe_env', 'bin', 'python');

    return new Promise((resolve, reject) => {
      const python = spawn(pythonPath, [scriptPath, videoUrl], {
        cwd: path.join(__dirname, '..')
      });

      let output = '';
      let errorOutput = '';
      let isCompleted = false;

      python.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log('Python输出:', chunk); // 调试信息
      });

      python.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        console.log('Python错误:', chunk); // 调试信息
      });

      python.on('close', async (code) => {
        if (isCompleted) return; // 防止重复处理
        isCompleted = true;

        console.log(`Python脚本执行完成，退出码: ${code}`);

        if (code === 0) {
          try {
            // 清理输出，查找有效的JSON
            let jsonOutput = '';
            
            // 方法1: 直接尝试整个输出
            try {
              const cleanOutput = output.trim();
              JSON.parse(cleanOutput);
              jsonOutput = cleanOutput;
            } catch (e) {
              // 方法2: 按行查找JSON
              const lines = output.trim().split('\n');
              for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                if (line.startsWith('{') && line.endsWith('}')) {
                  try {
                    JSON.parse(line);
                    jsonOutput = line;
                    break;
                  } catch (parseError) {
                    continue;
                  }
                }
              }
              
              // 方法3: 查找JSON对象的开始和结束
              if (!jsonOutput) {
                const match = output.match(/\{.*\}/s);
                if (match) {
                  try {
                    JSON.parse(match[0]);
                    jsonOutput = match[0];
                  } catch (parseError) {
                    // 继续寻找
                  }
                }
              }
            }
            
            if (!jsonOutput) {
              console.error('未找到有效的JSON输出');
              console.error('完整输出:', output);
              console.error('错误输出:', errorOutput);
              throw new Error('未找到有效的JSON输出');
            }
            
            console.log('成功解析Python输出，JSON长度:', jsonOutput.length);
            const result = JSON.parse(jsonOutput);
            
            if (result.success) {
              // 记录用量
              await usageTracker.logAPICall({
                userId: req.user.id,
                model: 'video_transcribe',
                usage: {
                  videoUrl,
                  duration: result.data?.duration || 0,
                  wordCount: result.data?.word_count || 0
                }
              });

              console.log('视频转文字完成，字数:', result.data?.word_count || 0);

              res.json({
                success: true,
                data: result.data,
                message: '视频转文字完成'
              });
            } else {
              console.error('Python脚本返回失败结果:', result.error);
              res.status(500).json({
                success: false,
                message: result.error || '视频处理失败'
              });
            }
          } catch (parseError) {
            console.error('解析输出失败:', parseError);
            console.error('原始输出:', output);
            console.error('错误输出:', errorOutput);
            res.status(500).json({
              success: false,
              message: '处理结果解析失败: ' + parseError.message
            });
          }
        } else {
          console.error('Python脚本执行失败，退出码:', code);
          console.error('标准输出:', output);
          console.error('错误输出:', errorOutput);
          
          // 根据退出码提供更具体的错误信息
          let errorMessage = '视频处理失败';
          if (code === 2) {
            errorMessage = '视频处理逻辑失败，请检查视频链接是否有效';
          } else if (code === 3) {
            errorMessage = '处理被用户中断';
          } else {
            errorMessage = '视频处理异常，请稍后重试';
          }
          
          res.status(500).json({
            success: false,
            message: errorMessage,
            details: errorOutput ? errorOutput.substring(0, 500) : '无详细错误信息'
          });
        }
      });

      // 设置超时（8分钟）- 给更多时间处理大文件
      const timeoutHandle = setTimeout(() => {
        if (isCompleted) return; // 防止重复处理
        isCompleted = true;
        
        python.kill();
        res.status(408).json({
          success: false,
          message: '处理超时，请尝试较短的视频或检查网络连接'
        });
      }, 8 * 60 * 1000);

      // 清理超时句柄
      python.on('close', () => {
        clearTimeout(timeoutHandle);
      });
    });

  } catch (error) {
    console.error('视频转文字失败:', error);
    
    res.status(500).json({
      success: false,
      message: '视频转文字服务暂时不可用，请稍后重试',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 苹果快捷指令 - 保存笔记到知识库
router.post('/shortcuts/save', [
  body('url')
    .isURL()
    .withMessage('请提供有效的小红书链接'),
  body('apiKey')
    .optional()
    .isLength({ min: 10 })
    .withMessage('API密钥格式不正确')
], async (req, res) => {
  try {
    console.log('收到快捷指令保存请求:', req.body);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const { url, apiKey, source = 'shortcuts' } = req.body;

    // 简单的API密钥验证（可以后续完善）
    const expectedApiKey = process.env.SHORTCUTS_API_KEY || 'xiaohongshu-shortcuts-2024';
    if (apiKey && apiKey !== expectedApiKey) {
      return res.status(401).json({
        success: false,
        message: 'API密钥验证失败'
      });
    }

    // 使用增强版爬虫获取内容
    console.log('🚀 开始爬取笔记内容...');
    
    const crawlerResult = await new Promise((resolve, reject) => {
      const pythonPath = process.env.PYTHON_PATH || 'python3';
      const scriptPath = path.join(__dirname, '../enhanced_crawler.py');
      
      const crawler = spawn(pythonPath, [scriptPath, 'note', url], {
        cwd: path.dirname(scriptPath)
      });
      
      let output = '';
      let errorOutput = '';
      
      crawler.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      crawler.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.log('爬虫日志:', data.toString());
      });
      
      crawler.on('close', (code) => {
        try {
          if (output.trim()) {
            const result = JSON.parse(output.trim());
            resolve(result);
          } else {
            reject(new Error('爬虫没有返回数据'));
          }
        } catch (e) {
          reject(new Error(`解析爬虫结果失败: ${e.message}`));
        }
      });
      
      crawler.on('error', (error) => {
        reject(error);
      });
    });

    if (!crawlerResult.success || !crawlerResult.data || !crawlerResult.data.posts.length) {
      return res.status(500).json({
        success: false,
        message: '笔记内容获取失败',
        error: crawlerResult.message || '未知错误'
      });
    }

    const noteData = crawlerResult.data.posts[0];
    console.log('✅ 笔记内容获取成功:', noteData.title);

    // 保存到飞书多维表格
    let feishuResult = null;
    if (feishuService.isConfigured()) {
      console.log('💾 保存到飞书多维表格...');
      feishuResult = await feishuService.saveNote(noteData);
      
      if (feishuResult.success) {
        console.log('✅ 已保存到飞书多维表格');
      } else {
        console.log('⚠️ 飞书保存失败:', feishuResult.error);
      }
    } else {
      console.log('⚠️ 飞书多维表格未配置，跳过保存');
    }

    // 同时保存到本地数据库作为备份
    console.log('💾 保存到本地数据库...');
    // TODO: 实现本地数据库保存逻辑

    // 返回成功响应
    const response = {
      success: true,
      message: `笔记"${noteData.title}"已成功保存到创作库`,
      data: {
        id: noteData.id,
        title: noteData.title,
        author: noteData.author,
        cesScore: feishuService.calculateCES(noteData),
        isPopular: feishuService.isPopular(noteData),
        saveTime: new Date().toISOString(),
        savedTo: []
      }
    };

    if (feishuResult && feishuResult.success) {
      response.data.savedTo.push({
        platform: '飞书多维表格',
        recordId: feishuResult.recordId
      });
    }

    res.json(response);

  } catch (error) {
    console.error('❌ 快捷指令保存失败:', error);
    res.status(500).json({
      success: false,
      message: '保存失败',
      error: error.message
    });
  }
});

// 快捷指令 - 搜索知识库
router.get('/shortcuts/search', async (req, res) => {
  try {
    const { keyword, limit = 10 } = req.query;
    
    if (!keyword) {
      return res.status(400).json({
        success: false,
        message: '请提供搜索关键词'
      });
    }

    console.log(`🔍 搜索关键词: ${keyword}`);

    let results = [];
    
    // 从飞书多维表格搜索
    if (feishuService.isConfigured()) {
      const searchResult = await feishuService.searchNotes(keyword, { limit: parseInt(limit) });
      
      if (searchResult.success) {
        results = searchResult.data.map(note => ({
          id: note.noteId,
          title: note.title,
          content: note.content.substring(0, 200) + '...',
          author: note.author,
          cesScore: note.cesScore,
          isPopular: note.isPopular,
          tags: note.tags,
          crawlTime: note.crawlTime
        }));
      }
    }

    res.json({
      success: true,
      message: `找到 ${results.length} 个相关笔记`,
      data: {
        keyword,
        results,
        total: results.length
      }
    });

  } catch (error) {
    console.error('❌ 搜索失败:', error);
    res.status(500).json({
      success: false,
      message: '搜索失败',
      error: error.message
    });
  }
});

// 快捷指令 - 获取爆款笔记
router.get('/shortcuts/popular', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    console.log('🔥 获取爆款笔记列表');

    let results = [];
    
    if (feishuService.isConfigured()) {
      const popularResult = await feishuService.getPopularNotes({ limit: parseInt(limit) });
      
      if (popularResult.success) {
        results = popularResult.data.map(note => ({
          id: note.noteId,
          title: note.title,
          content: note.content.substring(0, 200) + '...',
          author: note.author,
          cesScore: note.cesScore,
          tags: note.tags,
          crawlTime: note.crawlTime
        }));
      }
    }

    res.json({
      success: true,
      message: `找到 ${results.length} 个爆款笔记`,
      data: {
        results,
        total: results.length
      }
    });

  } catch (error) {
    console.error('❌ 获取爆款笔记失败:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  }
});

// 知识库管理 - 获取统计信息
router.get('/knowledge/stats', async (req, res) => {
  try {
    console.log('📊 获取知识库统计信息');

    if (!feishuService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: '飞书多维表格未配置'
      });
    }

    const statsResult = await feishuService.getTableStats();
    
    if (statsResult.success) {
      res.json({
        success: true,
        message: '统计信息获取成功',
        data: statsResult.stats
      });
    } else {
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: statsResult.error
      });
    }

  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取失败',
      error: error.message
    });
  }
});

router.post('/fetch-xhs-content', [
  authMiddleware,
  body('url')
    .isURL()
    .withMessage('请提供有效的URL'),
], async (req, res) => {
  try {
    console.log('收到获取小红书内容请求:', req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '请求参数错误',
        errors: errors.array()
      });
    }

    const { url } = req.body;
    
    // 验证是否为小红书链接
    if (!isValidXhsUrl(url)) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的小红书链接'
      });
    }

    // 使用爬虫获取内容
    const crawler = new XiaohongshuCrawler();
    
    let posts = [];
    
    try {
      if (isProfileUrl(url)) {
        // 主页链接：获取用户的多篇笔记
        console.log('检测到主页链接，获取用户笔记列表');
        posts = await crawler.getUserPosts(url, 10, req.user.id); // 获取最新10篇，传递用户ID
      } else {
        // 单个帖子链接
        console.log('检测到单个帖子链接，获取帖子内容');
        const post = await crawler.getPostContent(url, req.user.id);
        posts = [post];
      }

      if (!posts || posts.length === 0) {
        return res.status(404).json({
          success: false,
          message: '未能获取到有效内容，请检查链接是否正确'
        });
      }

      console.log(`成功获取${posts.length}篇内容`);

      res.json({
        success: true,
        message: `成功获取${posts.length}篇内容`,
        data: {
          posts: posts,
          url: url,
          fetchTime: new Date().toISOString()
        }
      });

    } catch (crawlerError) {
      console.error('爬虫获取内容失败:', crawlerError);
      
      // 如果爬虫失败，返回模拟数据用于测试
      const mockPosts = generateMockPosts(url);
      
      res.json({
        success: true,
        message: '获取内容成功（演示数据）',
        data: {
          posts: mockPosts,
          url: url,
          fetchTime: new Date().toISOString(),
          isMockData: true
        }
      });
    }

  } catch (error) {
    console.error('获取小红书内容错误:', error);
    res.status(500).json({
      success: false,
      message: '获取内容失败: ' + error.message
    });
  }
});

// 知识库保存
router.post('/knowledge-base/save', [
  authMiddleware,
  body('posts')
    .isArray({ min: 1 })
    .withMessage('至少需要一篇内容'),
  body('folder')
    .isLength({ min: 1, max: 50 })
    .withMessage('文件夹名称长度应在1-50个字符之间'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '请求参数错误',
        errors: errors.array()
      });
    }

    const { posts, folder } = req.body;
    const userId = req.user.id;

    // 创建知识库目录
    const knowledgeBaseDir = path.join(__dirname, '../knowledge-base', userId);
    const folderDir = path.join(knowledgeBaseDir, folder);

    try {
      await fs.mkdir(folderDir, { recursive: true });
    } catch (mkdirError) {
      console.error('创建目录失败:', mkdirError);
    }

    // 保存每篇内容
    const savedFiles = [];
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const fileName = `${Date.now()}_${i + 1}.json`;
      const filePath = path.join(folderDir, fileName);

      const postData = {
        ...post,
        savedAt: new Date().toISOString(),
        folder: folder,
        userId: userId
      };

      try {
        await fs.writeFile(filePath, JSON.stringify(postData, null, 2), 'utf8');
        savedFiles.push({
          fileName,
          title: post.title || '未命名',
          contentLength: (post.content || '').length
        });
      } catch (writeError) {
        console.error('保存文件失败:', writeError);
      }
    }

    res.json({
      success: true,
      message: `成功保存${savedFiles.length}篇内容到【${folder}】`,
      data: {
        folder: folder,
        savedCount: savedFiles.length,
        files: savedFiles
      }
    });

  } catch (error) {
    console.error('保存到知识库错误:', error);
    res.status(500).json({
      success: false,
      message: '保存失败: ' + error.message
    });
  }
});

// 获取知识库文件夹列表
router.get('/knowledge-base/folders', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const knowledgeBaseDir = path.join(__dirname, '../knowledge-base', userId);

    try {
      const folders = await fs.readdir(knowledgeBaseDir);
      const folderStats = [];

      for (const folder of folders) {
        const folderPath = path.join(knowledgeBaseDir, folder);
        const stat = await fs.stat(folderPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(folderPath);
          folderStats.push({
            name: folder,
            fileCount: files.filter(f => f.endsWith('.json')).length,
            createdAt: stat.birthtime,
            modifiedAt: stat.mtime
          });
        }
      }

      res.json({
        success: true,
        data: folderStats
      });

    } catch (readError) {
      // 如果目录不存在，返回空列表
      res.json({
        success: true,
        data: [{ name: 'default', fileCount: 0, createdAt: new Date(), modifiedAt: new Date() }]
      });
    }

  } catch (error) {
    console.error('获取文件夹列表错误:', error);
    res.status(500).json({
      success: false,
      message: '获取文件夹列表失败: ' + error.message
    });
  }
});

// 辅助函数：验证小红书URL
function isValidXhsUrl(url) {
  const patterns = [
    /^https?:\/\/(www\.)?xiaohongshu\.com\/user\/profile\/[a-zA-Z0-9]+/,
    /^https?:\/\/(www\.)?xiaohongshu\.com\/explore\/[a-zA-Z0-9]+/,
    /^https?:\/\/(www\.)?xiaohongshu\.com\/discovery\/item\/[a-zA-Z0-9]+/,
    /^https?:\/\/xhslink\.com\/[a-zA-Z0-9]+/
  ];
  
  return patterns.some(pattern => pattern.test(url));
}

// 辅助函数：判断是否为主页链接
function isProfileUrl(url) {
  return /\/user\/profile\//.test(url);
}

// 生成模拟数据用于测试
function generateMockPosts(url) {
  const isProfile = isProfileUrl(url);
  
  if (isProfile) {
    // 主页链接：返回多篇笔记
    return [
      {
        id: 'mock_1',
        title: '超好用的护肤品分享！真的不踩雷',
        content: '姐妹们！今天要跟大家分享几款我回购无数次的护肤品✨\n\n首先是这款精华，真的太好用了！用了一个月皮肤明显变亮变嫩，而且价格也很亲民，学生党也完全负担得起～\n\n还有这款面霜，质地轻薄不厚重，保湿效果超棒，现在换季用它完全不会干燥起皮！\n\n最后是防晒霜，这个必须安利！不搓泥不泛白，而且防晒效果真的很好，户外活动一整天都不会晒黑。\n\n大家还有什么好用的护肤品推荐吗？评论区分享一下呀～',
        images: [
          'https://placeholder.com/300x400',
          'https://placeholder.com/300x400',
          'https://placeholder.com/300x400'
        ],
        publishTime: '2024-01-15 14:30',
        likes: 1250,
        comments: 89,
        shares: 156,
        popularity: '热门'
      },
      {
        id: 'mock_2',
        title: '秋冬穿搭公式，照着穿就很美！',
        content: '最近天气变冷了，很多小伙伴问我秋冬怎么穿搭～今天整理了几套超实用的穿搭公式！\n\n【公式一】毛衣+半身裙+靴子\n这套组合永远不会错！选择同色系会更加高级，记得腰线很重要哦～\n\n【公式二】大衣+内搭+牛仔裤\n经典不过时的组合，大衣选择oversized款式会更显瘦，内搭可以选择高领毛衣或者衬衫。\n\n【公式三】羽绒服+连衣裙+马丁靴\n甜酷风格的最佳组合！羽绒服选择短款会更显腿长～\n\n这些搭配你们喜欢吗？有什么想看的穿搭主题可以留言告诉我！',
        images: [
          'https://placeholder.com/300x400',
          'https://placeholder.com/300x400'
        ],
        publishTime: '2024-01-12 16:45',
        likes: 890,
        comments: 67,
        shares: 123,
        popularity: '上升'
      },
      {
        id: 'mock_3',
        title: '在家也能做的简单美食！零厨艺也能搞定',
        content: '周末在家想吃点好的，但是不想出门怎么办？教大家几道超简单的家常菜！\n\n🍳【番茄鸡蛋面】\n材料：面条、鸡蛋、番茄、葱花\n步骤超简单，先炒番茄出汁，加水煮开下面条，最后打蛋花～酸甜可口！\n\n🥘【懒人焖饭】\n把米饭、香肠、胡萝卜、豌豆一起放电饭煲，按下开关就搞定！营养均衡还省事～\n\n🧄【蒜蓉西兰花】\n西兰花焯水，热锅爆香蒜末，倒入西兰花炒匀调味即可！清爽不油腻～\n\n这些菜品你们学会了吗？还想看什么简单菜谱就告诉我吧！',
        images: [
          'https://placeholder.com/300x400'
        ],
        publishTime: '2024-01-10 12:20',
        likes: 567,
        comments: 45,
        shares: 78,
        popularity: '稳定'
      }
    ];
  } else {
    // 单个帖子链接：返回一篇笔记
    return [
      {
        id: 'mock_single',
        title: '这样护肤，让你的皮肤越来越好！',
        content: '最近很多姐妹问我护肤心得，今天就来详细分享一下我的护肤routine～\n\n🌅【晨间护肤】\n1. 温和洁面 - 选择氨基酸洁面，不会过度清洁\n2. 爽肤水 - 用化妆棉轻拍，帮助后续吸收\n3. 精华 - 维C精华提亮肤色，记得防晒前30分钟使用\n4. 面霜 - 选择清爽型，不会影响后续上妆\n5. 防晒 - 这步绝对不能省！SPF30+就够了\n\n🌙【晚间护肤】\n1. 卸妆 - 即使没化妆也要卸防晒\n2. 洁面 - 可以选择稍微清洁力强一点的\n3. 爽肤水 - 晚上可以用保湿型的\n4. 精华 - 烟酰胺或者玻尿酸都很好\n5. 面霜 - 滋润型帮助肌肤修复\n\n⭐【护肤小tips】\n- 每周2-3次面膜\n- 多喝水多睡觉\n- 饮食清淡少熬夜\n\n坚持下来你们的皮肤一定会越来越好的！有什么护肤问题可以评论区问我～',
        images: [
          'https://placeholder.com/300x400',
          'https://placeholder.com/300x400',
          'https://placeholder.com/300x400',
          'https://placeholder.com/300x400'
        ],
        publishTime: '2024-01-18 19:30',
        likes: 2340,
        comments: 234,
        shares: 567,
        popularity: '爆款'
      }
    ];
  }
}

// 拆解爆文结构
router.post('/analyze', [
  authMiddleware,
  checkCreditsMiddleware,
  body('content')
    .isLength({ min: 10, max: 10000 })
    .withMessage('内容长度应在10-10000个字符之间'),
  body('model')
    .isIn(['claude', 'deepseek'])
    .withMessage('不支持的AI模型'),
  body('showThinking')
    .optional()
    .isBoolean()
    .withMessage('showThinking必须是布尔值'),
  body('useDeepAnalysis')
    .optional()
    .isBoolean()
    .withMessage('useDeepAnalysis必须是布尔值')
], async (req, res) => {
  const startTime = Date.now();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { content, model, showThinking = false, useDeepAnalysis = false } = req.body;
    const user = req.user;

    // 扣除积分
    const creditUsed = await user.useCredit();
    if (!creditUsed) {
      return res.status(403).json({
        success: false,
        message: '积分不足'
      });
    }

    // 调用AI服务
    const result = await aiService.processRequest(content, 'analyze', model, {
      showThinking,
      useDeepAnalysis
    });

    // 记录使用情况到文件日志（包括免登录模式）
    await usageTracker.logAPICall({
      model,
      action: 'analyze',
      processingTime: result.processingTime,
      status: result.success ? 'success' : 'error',
      inputLength: content.length,
      outputLength: result.content ? result.content.length : 0,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // 记录使用情况到数据库 (免登录模式：跳过数据库记录)
    if (user.id !== 'demo-user') {
      await Usage.create({
        userId: user.id,
        actionType: 'analyze',
        model,
        inputContent: content,
        outputContent: result.success ? result.content : null,
        creditsUsed: 1,
        processingTime: result.processingTime,
        status: result.success ? 'success' : 'error',
        errorMessage: result.success ? null : result.error,
        ipAddress: req.ip
      });
    }

    if (result.success) {
      res.json({
        success: true,
        message: '拆解成功',
        data: {
          content: result.content,
          processingTime: result.processingTime,
          remainingCredits: user.credits - 1,
          model,
          showThinking,
          useDeepAnalysis
        }
      });
    } else {
      // 如果AI处理失败，退还积分
      user.credits += 1;
      await user.save();
      
      res.status(500).json({
        success: false,
        message: '拆解失败: ' + result.error,
        data: {
          remainingCredits: user.credits
        }
      });
    }
  } catch (error) {
    console.error('拆解API错误:', error);
    
    // 发生错误时也要退还积分
    if (req.user) {
      req.user.credits += 1;
      await req.user.save();
    }
    
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      data: {
        remainingCredits: req.user?.credits || 0
      }
    });
  }
});

// 生成类似爆文
router.post('/generate', [
  authMiddleware,
  checkCreditsMiddleware,
  body('originalContent')
    .isLength({ min: 10, max: 10000 })
    .withMessage('原始内容长度应在10-10000个字符之间'),
  body('newTopic')
    .isLength({ min: 1, max: 200 })
    .withMessage('新主题长度应在1-200个字符之间'),
  body('model')
    .isIn(['claude', 'deepseek'])
    .withMessage('不支持的AI模型'),
  body('showThinking')
    .optional()
    .isBoolean()
    .withMessage('showThinking必须是布尔值'),
  body('useDeepAnalysis')
    .optional()
    .isBoolean()
    .withMessage('useDeepAnalysis必须是布尔值')
], async (req, res) => {
  const startTime = Date.now();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { 
      originalContent, 
      newTopic, 
      keywords = '',
      model, 
      showThinking = false, 
      useDeepAnalysis = false 
    } = req.body;
    const user = req.user;

    // 扣除积分
    const creditUsed = await user.useCredit();
    if (!creditUsed) {
      return res.status(403).json({
        success: false,
        message: '积分不足'
      });
    }

    // 调用AI服务
    const result = await aiService.processRequest(originalContent, 'generate', model, {
      newTopic,
      keywords,
      showThinking,
      useDeepAnalysis
    });

    // 记录使用情况到文件日志（包括免登录模式）
    await usageTracker.logAPICall({
      model,
      action: 'generate',
      processingTime: result.processingTime,
      status: result.success ? 'success' : 'error',
      inputLength: originalContent.length,
      outputLength: result.content ? result.content.length : 0,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    });

    // 记录使用情况到数据库 (免登录模式：跳过数据库记录)
    if (user.id !== 'demo-user') {
      await Usage.create({
        userId: user.id,
        actionType: 'generate',
        model,
        inputContent: originalContent,
        outputContent: result.success ? result.content : null,
        newTopic,
        creditsUsed: 1,
        processingTime: result.processingTime,
        status: result.success ? 'success' : 'error',
        errorMessage: result.success ? null : result.error,
        ipAddress: req.ip
      });
    }

    if (result.success) {
      res.json({
        success: true,
        message: '生成成功',
        data: {
          content: result.content,
          processingTime: result.processingTime,
          remainingCredits: user.credits - 1,
          model,
          showThinking,
          useDeepAnalysis,
          newTopic
        }
      });
    } else {
      // 如果AI处理失败，退还积分
      user.credits += 1;
      await user.save();
      
      res.status(500).json({
        success: false,
        message: '生成失败: ' + result.error,
        data: {
          remainingCredits: user.credits
        }
      });
    }
  } catch (error) {
    console.error('生成API错误:', error);
    
    // 发生错误时也要退还积分
    if (req.user) {
      req.user.credits += 1;
      await req.user.save();
    }
    
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      data: {
        remainingCredits: req.user?.credits || 0
      }
    });
  }
});

// 获取使用历史 (免登录模式)
router.get('/history', authMiddleware, async (req, res) => {
  try {
    // 免登录模式：返回空历史记录
    if (req.user.id === 'demo-user') {
      return res.json({
        success: true,
        data: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
          history: []
        }
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await Usage.findAndCountAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: [
        'id', 'actionType', 'model', 'newTopic', 
        'creditsUsed', 'processingTime', 'status', 
        'createdAt'
      ]
    });

    res.json({
      success: true,
      data: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / limit),
        history: rows
      }
    });
  } catch (error) {
    console.error('获取历史记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取历史记录失败'
    });
  }
});

// 重置月度积分（仅限正式学员）
router.post('/reset-credits', authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    
    if (user.userType !== 'student') {
      return res.status(403).json({
        success: false,
        message: '只有正式学员可以重置积分'
      });
    }

    const now = new Date();
    const lastReset = new Date(user.lastCreditReset);
    const daysSinceReset = (now - lastReset) / (1000 * 60 * 60 * 24);

    if (daysSinceReset < 30) {
      return res.status(400).json({
        success: false,
        message: `距离上次重置不足30天，还需等待${Math.ceil(30 - daysSinceReset)}天`
      });
    }

    await user.resetMonthlyCredits();

    res.json({
      success: true,
      message: '积分重置成功',
      data: {
        credits: user.credits,
        maxCredits: user.maxCredits,
        lastCreditReset: user.lastCreditReset
      }
    });
  } catch (error) {
    console.error('重置积分失败:', error);
    res.status(500).json({
      success: false,
      message: '重置积分失败'
    });
  }
});

// 获取用量统计概览
router.get('/usage/stats', authMiddleware, async (req, res) => {
  try {
    // 使用文件日志系统获取统计数据
    const stats = await usageTracker.getUsageStats();
    
    res.json({
      success: true,
      data: {
        totalCalls: stats.totalCalls,
        primaryModel: Object.keys(stats.modelDistribution).reduce((a, b) => 
          (stats.modelDistribution[a] || 0) > (stats.modelDistribution[b] || 0) ? a : b, 'Claude-3.5-Haiku'),
        avgResponseTime: stats.avgResponseTime + 's',
        successRate: stats.successRate + '%',
        modelDistribution: stats.modelDistribution,
        functionDistribution: stats.actionDistribution
      }
    });
  } catch (error) {
    console.error('获取用量统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取用量统计失败'
    });
  }
});

// 获取最近使用记录
router.get('/usage/recent', authMiddleware, async (req, res) => {
  try {
    // 使用文件日志系统获取最近记录
    const stats = await usageTracker.getUsageStats();
    
    res.json({
      success: true,
      data: stats.recentCalls
    });
  } catch (error) {
    console.error('获取最近使用记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取最近使用记录失败'
    });
  }
});

// 获取爬虫模式
router.get('/crawler-mode', async (req, res) => {
  try {
    const mode = process.env.CRAWLER_MODE || 'mock';
    res.json({
      success: true,
      mode: mode
    });
  } catch (error) {
    console.error('获取爬虫模式失败:', error);
    res.status(500).json({
      success: false,
      message: '获取爬虫模式失败'
    });
  }
});

// 切换爬虫模式
router.post('/toggle-crawler-mode', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const currentMode = process.env.CRAWLER_MODE || 'mock';
    const newMode = currentMode === 'real' ? 'mock' : 'real';
    
    // 更新配置文件
    const configPath = path.join(__dirname, '../config.js');
    
    if (fs.existsSync(configPath)) {
      let configContent = fs.readFileSync(configPath, 'utf8');
      const modeRegex = /CRAWLER_MODE:\s*process\.env\.CRAWLER_MODE\s*\|\|\s*['"`]([^'"`]+)['"`]/;
      const newModeValue = `CRAWLER_MODE: process.env.CRAWLER_MODE || '${newMode}'`;
      
      if (modeRegex.test(configContent)) {
        configContent = configContent.replace(modeRegex, newModeValue);
        fs.writeFileSync(configPath, configContent);
        
        // 更新环境变量（当前进程）
        process.env.CRAWLER_MODE = newMode;
        
        res.json({
          success: true,
          mode: newMode,
          message: `已切换到${newMode === 'real' ? '真实爬虫' : '演示'}模式`,
          needRestart: false // 因为我们更新了process.env，不需要重启
        });
      } else {
        res.status(500).json({
          success: false,
          message: '配置文件格式错误，无法自动切换'
        });
      }
    } else {
      res.status(500).json({
        success: false,
        message: '配置文件不存在，请先创建config.js'
      });
    }
  } catch (error) {
    console.error('切换爬虫模式失败:', error);
    res.status(500).json({
      success: false,
      message: '切换爬虫模式失败: ' + error.message
    });
  }
});

// ================== 小红书爬虫相关接口 ==================

// 初始化爬虫实例
const crawler = new XiaohongshuCrawler();

// 爬取小红书单个帖子
router.post('/xiaohongshu/crawl', [
  authMiddleware,
  checkCreditsMiddleware,
  body('url')
    .isURL()
    .withMessage('请提供有效的小红书链接')
    .custom((value) => {
      if (!value.includes('xiaohongshu.com')) {
        throw new Error('请提供小红书链接');
      }
      return true;
    })
], async (req, res) => {
  const startTime = Date.now();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { url } = req.body;

    // 爬取帖子数据
    const rawData = await crawler.crawlPost(url, req.user.id);
    
    // 格式化数据
    const formattedData = crawler.formatPostData(rawData);

    // 记录使用情况
    await usageTracker.logAPICall({
      model: 'crawler',
      action: 'crawl_post',
      processingTime: Date.now() - startTime,
      status: 'success',
      inputLength: url.length,
      outputLength: JSON.stringify(formattedData).length,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    res.json({
      success: true,
      message: '爬取成功',
      data: formattedData
    });

  } catch (error) {
    console.error('爬取小红书帖子失败:', error);
    
    // 记录错误
    await usageTracker.logAPICall({
      model: 'crawler',
      action: 'crawl_post',
      processingTime: Date.now() - startTime,
      status: 'error',
      inputLength: 0,
      outputLength: 0,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: error.message || '爬取失败，请稍后重试'
    });
  }
});

// 分析小红书帖子爆火原因
router.post('/xiaohongshu/analyze', [
  authMiddleware,
  checkCreditsMiddleware,
  body('url')
    .isURL()
    .withMessage('请提供有效的小红书链接')
    .custom((value) => {
      if (!value.includes('xiaohongshu.com')) {
        throw new Error('请提供小红书链接');
      }
      return true;
    }),
  body('model')
    .isIn(['claude', 'deepseek'])
    .withMessage('不支持的AI模型'),
  body('showThinking')
    .optional()
    .isBoolean()
    .withMessage('showThinking必须是布尔值')
], async (req, res) => {
  const startTime = Date.now();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { url, model, showThinking = false } = req.body;

    // 1. 爬取帖子数据
    const rawData = await crawler.crawlPost(url);
    const postData = crawler.formatPostData(rawData);

    // 2. 使用AI分析爆火原因
    const analysisPrompt = `请分析这篇小红书笔记为什么能够爆火，从以下几个维度进行分析：

【帖子信息】
标题：${postData.title}
内容：${postData.content}
标签：${postData.tags.join(', ')}
点赞数：${postData.stats.likeCount}
收藏数：${postData.stats.collectCount}
评论数：${postData.stats.commentCount}

【分析要求】
1. 标题分析：标题的吸引力和关键词使用
2. 内容结构：内容组织逻辑和表达方式
3. 情感共鸣：如何触发用户情感反应
4. 实用价值：提供的价值和解决的问题
5. 传播因子：容易被转发分享的元素
6. 视觉呈现：图片和排版的作用
7. 时机把握：发布时机和热点结合

请给出具体的分析结果和可复制的成功要素。`;

    const analysisResult = await aiService.processRequest(analysisPrompt, 'analyze', model, { showThinking });

    // 记录使用情况
    await usageTracker.logAPICall({
      model: model,
      action: 'analyze_post',
      processingTime: Date.now() - startTime,
      status: 'success',
      inputLength: analysisPrompt.length,
      outputLength: analysisResult.length,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    res.json({
      success: true,
      message: '分析完成',
      data: {
        postInfo: postData,
        analysis: analysisResult,
        analysisTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('分析小红书帖子失败:', error);
    
    // 记录错误
    await usageTracker.logAPICall({
      userId: req.user.id,
      username: req.user.username,
      action: 'analyze_post',
      model: req.body.model || 'unknown',
      responseTime: Date.now() - startTime,
      success: false,
      error: error.message
    });
    
    res.status(500).json({
      success: false,
      message: error.message || '分析失败，请稍后重试'
    });
  }
});

// 基于小红书帖子生成新内容
router.post('/xiaohongshu/generate', [
  authMiddleware,
  checkCreditsMiddleware,
  body('url')
    .isURL()
    .withMessage('请提供有效的小红书链接')
    .custom((value) => {
      if (!value.includes('xiaohongshu.com')) {
        throw new Error('请提供小红书链接');
      }
      return true;
    }),
  body('userBackground')
    .isLength({ min: 10, max: 500 })
    .withMessage('用户背景信息长度应在10-500个字符之间'),
  body('contentType')
    .isIn(['script', 'post', 'title', 'cover', 'tags', 'all'])
    .withMessage('不支持的内容类型'),
  body('model')
    .isIn(['claude', 'deepseek'])
    .withMessage('不支持的AI模型'),
  body('showThinking')
    .optional()
    .isBoolean()
    .withMessage('showThinking必须是布尔值')
], async (req, res) => {
  const startTime = Date.now();
  
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { url, userBackground, contentType, model, showThinking = false } = req.body;

    // 1. 爬取原始帖子数据
    const rawData = await crawler.crawlPost(url);
    const postData = crawler.formatPostData(rawData);

    // 2. 生成内容
    let generationPrompt = '';
    
    if (contentType === 'all') {
      generationPrompt = `基于以下爆火的小红书笔记，为我生成一套完整的小红书内容：

【原始爆火笔记】
标题：${postData.title}
内容：${postData.content}
标签：${postData.tags.join(', ')}
数据表现：点赞${postData.stats.likeCount} 收藏${postData.stats.collectCount} 评论${postData.stats.commentCount}

【我的背景信息】
${userBackground}

【生成要求】
请生成以下完整内容：
1. 视频脚本（口播文案，适合录制短视频）
2. 图文文案（完整的小红书文案）
3. 标题（3-5个备选标题）
4. 封面文字（简短有力的封面标语）
5. 相关标签（10-15个相关标签）

要求：
- 结合我的背景信息进行个性化创作
- 保持原帖的爆火要素和结构逻辑
- 内容要有价值、有共鸣、易传播
- 语言风格要符合小红书平台特色`;
    } else {
      const contentTypeMap = {
        'script': '视频脚本（口播文案）',
        'post': '图文文案（完整的小红书文案）',
        'title': '标题（3-5个备选标题）',
        'cover': '封面文字（简短有力的封面标语）',
        'tags': '相关标签（10-15个相关标签）'
      };

      generationPrompt = `基于以下爆火的小红书笔记，为我生成${contentTypeMap[contentType]}：

【原始爆火笔记】
标题：${postData.title}
内容：${postData.content}
标签：${postData.tags.join(', ')}
数据表现：点赞${postData.stats.likeCount} 收藏${postData.stats.collectCount} 评论${postData.stats.commentCount}

【我的背景信息】
${userBackground}

请结合我的背景信息，生成高质量的${contentTypeMap[contentType]}，要保持原帖的爆火要素。`;
    }

    const generationResult = await aiService.processRequest(generationPrompt, 'generate', model, { showThinking });

    // 记录使用情况
    await usageTracker.logAPICall({
      model: model,
      action: 'generate_content',
      processingTime: Date.now() - startTime,
      status: 'success',
      inputLength: generationPrompt.length,
      outputLength: generationResult.length,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    res.json({
      success: true,
      message: '内容生成完成',
      data: {
        originalPost: postData,
        generatedContent: generationResult,
        contentType: contentType,
        userBackground: userBackground,
        generationTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('生成内容失败:', error);
    
    // 记录错误
    await usageTracker.logAPICall({
      model: req.body.model || 'unknown',
      action: 'generate_content',
      processingTime: Date.now() - startTime,
      status: 'error',
      inputLength: 0,
      outputLength: 0,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    res.status(500).json({
      success: false,
      message: error.message || '生成失败，请稍后重试'
    });
  }
});

// 登录状态管理
let loginSessions = new Map(); // 存储登录会话

// 小红书登录接口
router.post('/login-xiaohongshu', authMiddleware, async (req, res) => {
  try {
    const { method } = req.body;
    console.log('收到小红书登录请求:', { method, user: req.user.username });
    
    // 根据不同登录方式提供不同的登录URL
    let loginUrl;
    switch (method) {
      case 'qr':
        loginUrl = 'https://www.xiaohongshu.com/explore';
        break;
      case 'phone':
        loginUrl = 'https://www.xiaohongshu.com/login';
        break;
      case 'browser':
      default:
        loginUrl = 'https://www.xiaohongshu.com/explore';
        break;
    }
    
    // 生成会话ID
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 记录登录会话
    loginSessions.set(sessionId, {
      userId: req.user.id,
      method: method,
      startTime: Date.now(),
      status: 'pending'
    });
    
    console.log(`为用户 ${req.user.username} 创建登录会话: ${sessionId}`);
    
    res.json({
      success: true,
      sessionId: sessionId,
      loginUrl: loginUrl,
      message: '请在新窗口中完成登录，然后关闭窗口返回'
    });
    
  } catch (error) {
    console.error('启动小红书登录失败:', error);
    res.status(500).json({
      success: false,
      error: '登录启动失败: ' + error.message
    });
  }
});

// 检查登录状态
router.get('/login-status', authMiddleware, async (req, res) => {
  try {
    // 检查是否有有效的登录会话
    const userSessions = Array.from(loginSessions.values()).filter(
      session => session.userId === req.user.id && session.status === 'active'
    );
    
    const isLoggedIn = userSessions.length > 0;
    const latestSession = userSessions.sort((a, b) => b.startTime - a.startTime)[0];
    
    res.json({
      success: true,
      loggedIn: isLoggedIn,
      username: isLoggedIn ? '小红书用户' : null,
      loginTime: latestSession ? new Date(latestSession.startTime).toISOString() : null,
      sessionCount: userSessions.length
    });
    
  } catch (error) {
    console.error('检查登录状态失败:', error);
    res.status(500).json({
      success: false,
      error: '检查登录状态失败'
    });
  }
});

// 确认登录完成
router.post('/confirm-login', async (req, res) => {
  try {
    const { sessionId, cookies } = req.body;
    
    // 检查是否是手动确认或快速确认或Cookie登录
    if (sessionId.startsWith('manual-') || sessionId.startsWith('quick-confirm-') || sessionId.startsWith('cookie-login-')) {
      // 创建新的登录会话
      const userId = req.user ? req.user.id : 'demo-user';
      const username = req.user ? req.user.username : '免登录用户';
      
      const newSession = {
        userId: userId,
        method: sessionId.startsWith('cookie-login-') ? 'cookie' : 'manual',
        startTime: Date.now(),
        status: 'active',
        loginTime: Date.now(),
        cookies: cookies || []
      };
      
      loginSessions.set(sessionId, newSession);
      console.log(`用户 ${username} Cookie登录成功: ${sessionId}, cookies数量: ${cookies ? cookies.length : 0}`);
      
      return res.json({
        success: true,
        message: '登录确认成功',
        cookiesCount: cookies ? cookies.length : 0
      });
    }
    
    // 原有的会话确认逻辑
    const session = loginSessions.get(sessionId);
    if (!session || (req.user && session.userId !== req.user.id)) {
      return res.status(400).json({
        success: false,
        error: '无效的会话ID'
      });
    }
    
    // 更新会话状态
    session.status = 'active';
    session.loginTime = Date.now();
    session.cookies = cookies; // 存储cookies用于后续爬取
    
    loginSessions.set(sessionId, session);
    
    console.log(`用户 ${req.user.username} 登录确认成功: ${sessionId}`);
    
    res.json({
      success: true,
      message: '登录确认成功'
    });
    
  } catch (error) {
    console.error('确认登录失败:', error);
    res.status(500).json({
      success: false,
      error: '确认登录失败'
    });
  }
});

// 退出登录
router.post('/logout-xiaohongshu', authMiddleware, async (req, res) => {
  try {
    // 删除用户的所有登录会话
    for (const [sessionId, session] of loginSessions.entries()) {
      if (session.userId === req.user.id) {
        loginSessions.delete(sessionId);
      }
    }
    
    console.log(`用户 ${req.user.username} 已退出小红书登录`);
    
    res.json({
      success: true,
      message: '已退出登录'
    });
    
  } catch (error) {
    console.error('退出登录失败:', error);
    res.status(500).json({
      success: false,
      error: '退出登录失败'
    });
  }
});

// 获取用户的登录Cookie（供爬虫使用）
function getUserLoginCookies(userId) {
  // 对于demo用户，检查所有demo相关的会话
  let targetUserIds = [userId];
  if (userId === '免登录用户' || userId === 'demo-user') {
    targetUserIds = ['demo-user', '免登录用户'];
  }
  
  const userSessions = Array.from(loginSessions.values()).filter(
    session => targetUserIds.includes(session.userId) && session.status === 'active'
  );
  
  if (userSessions.length > 0) {
    const latestSession = userSessions.sort((a, b) => b.loginTime - a.loginTime)[0];
    console.log(`为用户 ${userId} 找到Cookie会话，cookies数量: ${latestSession.cookies ? latestSession.cookies.length : 0}`);
    return latestSession.cookies || null;
  }
  
  console.log(`未找到用户 ${userId} 的有效Cookie会话`);
  return null;
}

// 加载本地Cookie配置
router.post('/load-local-cookies', async (req, res) => {
  try {
    const fs = require('fs').promises;
    const path = require('path');
    
    const cookiesFilePath = path.join(__dirname, '../config/user-cookies.json');
    
    // 检查文件是否存在
    try {
      await fs.access(cookiesFilePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: '本地Cookie配置文件不存在'
      });
    }
    
    // 读取Cookie配置
    const cookiesData = await fs.readFile(cookiesFilePath, 'utf8');
    const config = JSON.parse(cookiesData);
    
    if (!config.cookies || !Array.isArray(config.cookies)) {
      return res.status(400).json({
        success: false,
        message: 'Cookie配置格式错误'
      });
    }
    
    // 创建登录会话
    const sessionId = 'local-cookies-' + Date.now();
    const newSession = {
      userId: 'demo-user',
      method: 'local-file',
      startTime: Date.now(),
      status: 'active',
      loginTime: Date.now(),
      cookies: config.cookies
    };
    
    loginSessions.set(sessionId, newSession);
    
    console.log(`成功加载本地Cookie配置: ${config.cookies.length}个Cookie`);
    
    res.json({
      success: true,
      message: `成功加载本地Cookie配置`,
      data: {
        cookiesCount: config.cookies.length,
        lastUpdated: config.lastUpdated || '未知',
        sessionId: sessionId
      }
    });
    
  } catch (error) {
    console.error('加载本地Cookie失败:', error);
    res.status(500).json({
      success: false,
      message: '加载本地Cookie失败：' + error.message
    });
  }
});

// 保存Cookie到本地配置文件
router.post('/save-cookies-to-local', async (req, res) => {
  try {
    const { cookies } = req.body;
    
    if (!cookies || !Array.isArray(cookies)) {
      return res.status(400).json({
        success: false,
        message: 'Cookie数据格式错误'
      });
    }
    
    const fs = require('fs').promises;
    const path = require('path');
    
    const configDir = path.join(__dirname, '../config');
    const cookiesFilePath = path.join(configDir, 'user-cookies.json');
    
    // 确保config目录存在
    await fs.mkdir(configDir, { recursive: true });
    
    const config = {
      description: "用户小红书登录Cookie配置",
      lastUpdated: new Date().toISOString(),
      cookies: cookies
    };
    
    await fs.writeFile(cookiesFilePath, JSON.stringify(config, null, 2), 'utf8');
    
    console.log(`成功保存Cookie到本地配置文件: ${cookies.length}个Cookie`);
    
    res.json({
      success: true,
      message: `成功保存${cookies.length}个Cookie到本地配置文件`,
      data: {
        cookiesCount: cookies.length,
        filePath: 'config/user-cookies.json'
      }
    });
    
  } catch (error) {
    console.error('保存Cookie到本地失败:', error);
    res.status(500).json({
      success: false,
      message: '保存Cookie失败：' + error.message
    });
  }
});

// 保存到知识库
router.post('/knowledge-base/save', async (req, res) => {
  try {
    const { type, title, content, metadata } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }
    
    const fs = require('fs').promises;
    const path = require('path');
    
    // 确保知识库目录存在
    const knowledgeBaseDir = path.join(__dirname, '../knowledge-base');
    const userDir = path.join(knowledgeBaseDir, 'demo-user');
    const typeDir = path.join(userDir, type || 'xiaohongshu-posts');
    
    await fs.mkdir(typeDir, { recursive: true });
    
    // 生成文件名
    const timestamp = Date.now();
    const filename = `${timestamp}_${Math.random().toString(36).substr(2, 9)}.json`;
    const filepath = path.join(typeDir, filename);
    
    // 准备保存的数据
    const saveData = {
      id: `${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      type: type || 'xiaohongshu-post',
      title,
      content,
      metadata: metadata || {},
      savedAt: new Date().toISOString(),
      source: 'xiaohongshu-crawler'
    };
    
    // 保存到文件
    await fs.writeFile(filepath, JSON.stringify(saveData, null, 2), 'utf8');
    
    console.log(`知识库保存成功: ${filename}`);
    
    res.json({
      success: true,
      message: '成功保存到知识库',
      data: {
        id: saveData.id,
        filename,
        savedAt: saveData.savedAt
      }
    });
    
  } catch (error) {
    console.error('保存到知识库失败:', error);
    res.status(500).json({
      success: false,
      message: '保存失败：' + error.message
    });
  }
});

// 导出登录管理功能供其他模块使用
router.getUserLoginCookies = getUserLoginCookies;

module.exports = router; 