const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { User, Usage } = require('../config/database');
const aiService = require('../services/aiService');
const router = express.Router();

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

    // 记录使用情况 (免登录模式：跳过数据库记录)
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

    // 记录使用情况 (免登录模式：跳过数据库记录)
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
    // 免登录模式：返回模拟数据
    if (req.user.id === 'demo-user') {
      return res.json({
        success: true,
        data: {
          totalCalls: 0,
          primaryModel: 'Claude-3.5-Haiku',
          avgResponseTime: '0s',
          successRate: '100%',
          modelDistribution: {},
          functionDistribution: {}
        }
      });
    }

    // 获取用户的所有使用记录
    const usages = await Usage.findAll({
      where: { userId: req.user.id },
      attributes: ['model', 'actionType', 'processingTime', 'status', 'createdAt']
    });

    const totalCalls = usages.length;
    const successfulCalls = usages.filter(u => u.status === 'success').length;
    const successRate = totalCalls > 0 ? ((successfulCalls / totalCalls) * 100).toFixed(1) + '%' : '100%';
    
    // 计算平均响应时间
    const avgTime = usages.length > 0 
      ? usages.reduce((sum, u) => sum + (u.processingTime || 0), 0) / usages.length / 1000
      : 0;
    const avgResponseTime = avgTime.toFixed(1) + 's';

    // 模型分布统计
    const modelDistribution = {};
    usages.forEach(u => {
      const modelName = u.model === 'claude' ? 'Claude' : 'DeepSeek';
      modelDistribution[modelName] = (modelDistribution[modelName] || 0) + 1;
    });

    // 功能分布统计
    const functionDistribution = {};
    usages.forEach(u => {
      const actionName = u.actionType === 'analyze' ? '拆解分析' : '生成仿写';
      functionDistribution[actionName] = (functionDistribution[actionName] || 0) + 1;
    });

    // 主要使用的模型
    const primaryModel = Object.keys(modelDistribution).reduce((a, b) => 
      (modelDistribution[a] || 0) > (modelDistribution[b] || 0) ? a : b, 'Claude-3.5-Haiku');

    res.json({
      success: true,
      data: {
        totalCalls,
        primaryModel,
        avgResponseTime,
        successRate,
        modelDistribution,
        functionDistribution
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
    // 免登录模式：返回空记录
    if (req.user.id === 'demo-user') {
      return res.json({
        success: true,
        data: []
      });
    }

    const recentUsages = await Usage.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 10,
      attributes: ['actionType', 'model', 'processingTime', 'status', 'createdAt']
    });

    const formattedUsages = recentUsages.map(usage => ({
      time: usage.createdAt.toLocaleString('zh-CN'),
      action: usage.actionType === 'analyze' ? '拆解分析' : '生成仿写',
      model: usage.model === 'claude' ? 'Claude' : 'DeepSeek',
      responseTime: usage.processingTime ? (usage.processingTime / 1000).toFixed(1) + 's' : 'N/A',
      status: usage.status === 'success' ? '成功' : '失败'
    }));

    res.json({
      success: true,
      data: formattedUsages
    });
  } catch (error) {
    console.error('获取最近使用记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取最近使用记录失败'
    });
  }
});

module.exports = router; 