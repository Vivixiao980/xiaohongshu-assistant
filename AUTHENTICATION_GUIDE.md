# 小红书笔记生成器 - 认证系统指南

## 🚀 功能概述

本系统提供了完整的用户认证功能，包括：

- ✅ 用户注册（支持邮箱验证）
- ✅ 用户登录
- ✅ 邮箱验证码系统
- ✅ 密码强度检测
- ✅ 积分管理系统
- ✅ 安全防护（速率限制、输入验证）

## 📱 页面结构

### 1. 主页 (`/`)
- 展示应用功能
- 登录/注册按钮跳转到认证页面
- 已登录用户显示用户信息和积分

### 2. 认证页面 (`/auth.html`)
- 登录和注册标签切换
- 邮箱验证码输入界面
- 实时表单验证
- 密码强度检测

## 🔐 认证流程

### 注册流程
1. 用户点击主页"登录/注册"按钮
2. 跳转到认证页面，切换到"注册"标签
3. 填写注册信息：
   - 用户名（3-20位，支持字母、数字、下划线、中文）
   - 邮箱地址
   - 密码（至少6位）
   - 确认密码
   - 手机号（可选）
   - 同意用户协议
4. 系统发送6位验证码到用户邮箱
5. 用户输入验证码完成验证
6. 注册成功，自动登录并跳转到主页

### 登录流程
1. 用户在认证页面切换到"登录"标签
2. 输入用户名/邮箱和密码
3. 登录成功后跳转到主页

## 📧 邮箱验证系统

### 验证码特性
- 6位数字验证码
- 10分钟有效期
- 最多尝试5次
- 支持重新发送（60秒冷却）

### 邮件配置
支持两种配置方式：

#### 方式1：使用邮件服务商
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

支持的服务商：
- Gmail
- QQ邮箱
- 163邮箱
- Outlook
- Yahoo

#### 方式2：自定义SMTP
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Gmail配置示例
1. 开启两步验证
2. 生成应用专用密码
3. 配置环境变量：
   ```env
   EMAIL_SERVICE=gmail
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_specific_password
   ```

## 🛡️ 安全特性

### 输入验证
- 用户名：3-20位，支持字母、数字、下划线、中文
- 邮箱：标准邮箱格式验证
- 密码：最少6位字符
- 手机号：中国大陆手机号格式

### 密码安全
- BCrypt加密存储
- 密码强度实时检测
- 支持大小写字母、数字、特殊字符

### 验证码安全
- 内存存储（生产环境建议使用Redis）
- 自动过期清理
- 尝试次数限制
- 防暴力破解

## 🎯 用户类型和积分

### 用户类型
- **体验用户（trial）**：默认类型，3次免费使用
- **正式学员（student）**：每月100积分

### 积分系统
- 拆解分析：消耗1积分
- 生成笔记：消耗1积分
- 积分不足时禁用功能
- 学员用户每月自动重置积分

## 🔧 开发环境设置

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
复制 `env.example` 到 `.env` 并配置：
```env
# 基本配置
NODE_ENV=development
PORT=3000
JWT_SECRET=your_jwt_secret_key

# 数据库
DATABASE_URL=mysql://user:pass@host:port/db

# 邮件服务
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 3. 启动服务
```bash
npm start
```

### 4. 访问应用
- 主页：http://localhost:3000
- 认证页面：http://localhost:3000/auth.html

## 📱 用户界面特性

### 设计风格
- 现代化渐变色彩
- 玻璃拟态效果
- 响应式设计
- 流畅动画过渡

### 交互体验
- 实时表单验证
- 智能焦点跳转
- 密码强度指示器
- 友好的错误提示

### 验证码输入
- 6个独立输入框
- 自动跳转到下一个输入框
- 支持退格键返回
- 输入完成自动提交

## 🚨 错误处理

### 常见错误及解决方案

#### 1. 邮件发送失败
- 检查邮箱配置
- 确认应用密码正确
- 检查网络连接

#### 2. 验证码过期
- 验证码有效期10分钟
- 过期后需要重新获取

#### 3. 登录失败
- 检查用户名/邮箱和密码
- 确认账户未被禁用

#### 4. 数据库连接失败
- 检查DATABASE_URL配置
- 确认数据库服务正常

## 🔄 API接口

### 认证相关
- `POST /auth/send-verification` - 发送验证码
- `POST /auth/register` - 用户注册
- `POST /auth/login` - 用户登录
- `GET /auth/me` - 获取用户信息

### 业务功能
- `POST /api/analyze` - 笔记拆解分析
- `POST /api/generate` - 生成仿写笔记

## 📈 部署说明

### Railway部署
1. 连接GitHub仓库
2. 配置环境变量
3. 自动部署

### 环境变量配置
```env
NODE_ENV=production
DATABASE_URL=mysql://...
JWT_SECRET=...
EMAIL_SERVICE=gmail
EMAIL_USER=...
EMAIL_PASS=...
```

## 🎉 使用建议

### 对于开发者
1. 在开发环境中，验证码会在控制台显示
2. 建议使用测试邮箱进行开发
3. 注意保护API密钥和邮箱密码

### 对于用户
1. 使用真实邮箱地址注册
2. 设置强密码保护账户安全
3. 及时查收验证码邮件

## 📞 技术支持

如果您在使用过程中遇到问题，请检查：
1. 环境变量配置是否正确
2. 数据库连接是否正常
3. 邮件服务配置是否有效
4. 网络连接是否稳定

---

**注意**：本系统为演示版本，生产环境建议：
- 使用Redis存储验证码
- 添加更多安全措施
- 配置专业邮件服务
- 添加日志监控系统 