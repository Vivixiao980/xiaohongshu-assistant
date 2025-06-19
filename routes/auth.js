const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../config/database');
const router = express.Router();
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');

// 注册
router.post('/register', [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('用户名长度应在3-20个字符之间')
    .matches(/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/)
    .withMessage('用户名只能包含字母、数字、下划线和中文'),
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码长度至少6个字符'),
  body('userType')
    .optional()
    .isIn(['trial', 'student'])
    .withMessage('用户类型无效')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg });
  }

  const { username, email, password } = req.body;

  try {
    let user = await User.findOne({ where: { [Op.or]: [{ username }, { email }] } });

    if (user) {
      return res.status(400).json({ success: false, message: '用户名或邮箱已被注册' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 强制新用户类型为 'trial'
    user = await User.create({
      username,
      email,
      password: hashedPassword,
      userType: 'trial', // 忽略任何来自前端的userType，强制设为trial
      credits: 3, // 体验用户初始积分为3
      creditsResetAt: new Date()
    });

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, token });

  } catch (error) {
    console.error('注册错误:', error.message);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 登录
router.post('/login', [
  body('identifier')
    .notEmpty()
    .withMessage('请输入用户名或邮箱'),
  body('password')
    .notEmpty()
    .withMessage('请输入密码')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '输入验证失败',
        errors: errors.array()
      });
    }

    const { identifier, password } = req.body;

    // 查找用户
    const user = await User.findByEmailOrUsername(identifier);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 验证密码
    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 检查账户是否激活
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: '账户已被禁用'
      });
    }

    // 更新最后登录时间
    user.lastLoginAt = new Date();
    await user.save();

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          userType: user.userType,
          credits: user.credits,
          maxCredits: user.maxCredits,
          lastLoginAt: user.lastLoginAt
        }
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({
      success: false,
      message: '登录失败，请稍后重试'
    });
  }
});

// 获取用户信息
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供认证令牌'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          userType: user.userType,
          credits: user.credits,
          maxCredits: user.maxCredits,
          lastLoginAt: user.lastLoginAt,
          lastCreditReset: user.lastCreditReset
        }
      }
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(401).json({
      success: false,
      message: '认证失败'
    });
  }
});

module.exports = router; 