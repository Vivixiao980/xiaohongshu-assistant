const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { User } = require('../config/database');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const nodemailer = require('nodemailer');

// 内存存储验证码（生产环境建议使用Redis）
const verificationCodes = new Map();

// 邮件配置
const createTransporter = () => {
  // 使用环境变量配置邮件服务
  if (process.env.EMAIL_SERVICE && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE, // 例如: 'gmail', 'qq', '163'
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    // 开发环境使用Ethereal Email（测试邮箱）
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'ethereal.user@ethereal.email',
        pass: 'ethereal.pass'
      }
    });
  }
};

// 生成6位数验证码
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 发送邮箱验证码
router.post('/send-verification', [
  body('email')
    .isEmail()
    .withMessage('请输入有效的邮箱地址')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const { email } = req.body;

    // 检查邮箱是否已被注册
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '该邮箱已被注册'
      });
    }

    // 生成验证码
    const verificationCode = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10分钟后过期

    // 存储验证码
    verificationCodes.set(email, {
      code: verificationCode,
      expiresAt,
      attempts: 0
    });

    // 发送邮件
    try {
      const transporter = createTransporter();
      
      const mailOptions = {
        from: process.env.EMAIL_USER || 'noreply@xiaohongshu-assistant.com',
        to: email,
        subject: '小红书笔记生成器 - 邮箱验证码',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">小红书笔记生成器</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">邮箱验证</p>
            </div>
            <div style="background: white; padding: 40px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #333; margin-bottom: 20px;">验证您的邮箱地址</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                感谢您注册小红书笔记生成器！请使用以下验证码完成邮箱验证：
              </p>
              <div style="background: #f8f9fa; border: 2px dashed #6366f1; border-radius: 10px; padding: 30px; text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: bold; color: #6366f1; letter-spacing: 8px;">${verificationCode}</div>
                <p style="color: #666; margin: 15px 0 0 0; font-size: 14px;">验证码有效期：10分钟</p>
              </div>
              <p style="color: #666; font-size: 14px; line-height: 1.6;">
                如果您没有申请注册，请忽略此邮件。<br>
                此验证码只能使用一次，请勿泄露给他人。
              </p>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                <p style="color: #999; font-size: 12px; margin: 0;">
                  此邮件由系统自动发送，请勿回复
                </p>
              </div>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      
      res.json({
        success: true,
        message: '验证码已发送到您的邮箱',
        data: {
          email,
          expiresIn: 600 // 10分钟
        }
      });

    } catch (emailError) {
      console.error('邮件发送失败:', emailError);
      
      // 邮件发送失败时，返回成功但提供备用方案
      res.json({
        success: true,
        message: '验证码发送中，请稍后查收邮件',
        data: {
          email,
          expiresIn: 600,
          // 开发环境下提供验证码（生产环境移除）
          ...(process.env.NODE_ENV === 'development' && { devCode: verificationCode })
        }
      });
    }

  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({
      success: false,
      message: '发送验证码失败，请稍后重试'
    });
  }
});

// 验证邮箱并完成注册
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
  body('verificationCode')
    .isLength({ min: 6, max: 6 })
    .withMessage('请输入6位验证码'),
  body('phone')
    .optional()
    .isMobilePhone('zh-CN')
    .withMessage('请输入有效的手机号')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        message: errors.array()[0].msg 
      });
    }

    const { username, email, password, verificationCode, phone } = req.body;

    // 验证邮箱验证码
    const storedVerification = verificationCodes.get(email);
    if (!storedVerification) {
      return res.status(400).json({
        success: false,
        message: '验证码已过期，请重新获取'
      });
    }

    if (Date.now() > storedVerification.expiresAt) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        message: '验证码已过期，请重新获取'
      });
    }

    if (storedVerification.attempts >= 5) {
      verificationCodes.delete(email);
      return res.status(400).json({
        success: false,
        message: '验证码尝试次数过多，请重新获取'
      });
    }

    if (storedVerification.code !== verificationCode) {
      storedVerification.attempts++;
      return res.status(400).json({
        success: false,
        message: '验证码错误，请重新输入'
      });
    }

    // 验证码正确，删除存储的验证码
    verificationCodes.delete(email);

    // 检查用户名和邮箱是否已被注册
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [{ username }, { email }] 
      } 
    });

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: '用户名或邮箱已被注册' 
      });
    }

    // 创建用户（密码会在模型的beforeCreate钩子中自动加密）
    const user = await User.create({
      username,
      email,
      password,
      phone: phone || null,
      userType: 'trial', // 新用户默认为体验用户
      credits: 3, // 体验用户初始积分为3
      creditsResetAt: new Date(),
      isActive: true,
      emailVerified: true,
      emailVerifiedAt: new Date()
    });

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({ 
      success: true, 
      message: '注册成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          userType: user.userType,
          credits: user.credits
        }
      }
    });

  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '注册失败，请稍后重试' 
    });
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
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { username: identifier },
          { email: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
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
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        credits: user.credits
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
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        userType: user.userType,
        credits: user.credits
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

// 清理过期的验证码（定期任务）
setInterval(() => {
  const now = Date.now();
  for (const [email, verification] of verificationCodes.entries()) {
    if (now > verification.expiresAt) {
      verificationCodes.delete(email);
    }
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

module.exports = router; 