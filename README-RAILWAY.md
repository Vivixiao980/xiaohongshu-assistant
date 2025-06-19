# 🚀 Railway部署指南

小红书爆文助手 - Railway一键部署版本

## 📋 部署前准备

### 1. 注册Railway账号
- 访问 https://railway.app
- 使用GitHub账号登录

### 2. 准备GitHub仓库
```bash
# 初始化Git仓库
git init
git add .
git commit -m "Initial commit for Railway deployment"

# 推送到GitHub
git remote add origin https://github.com/yourusername/xiaohongshu-assistant.git
git branch -M main
git push -u origin main
```

## 🎯 一键部署步骤

### 第一步：创建Railway项目
1. 登录Railway控制台
2. 点击"New Project"
3. 选择"Deploy from GitHub repo"
4. 选择你的GitHub仓库
5. 点击"Deploy Now"

### 第二步：添加MySQL数据库
1. 在项目页面点击"New"
2. 选择"Database" → "MySQL"
3. Railway会自动创建数据库并设置`DATABASE_URL`环境变量

### 第三步：配置环境变量
在项目设置中添加以下环境变量：

```bash
# 基础配置
NODE_ENV=production
PORT=3000

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# 速率限制
RATE_LIMIT_MAX_REQUESTS=15
RATE_LIMIT_WINDOW_MS=900000

# Claude API配置（DP API）
CUSTOM_CLAUDE_API_KEY=sk-RTGl4XXdYFzOmQBcFc0166466740412dAb4cF6FcC6EeC1F0
CUSTOM_CLAUDE_BASE_URL=https://dpapi.cn/v1
CUSTOM_CLAUDE_MODEL=claude-3-5-haiku-20241022

# SiliconFlow API配置
SILICONFLOW_API_KEY=sk-gkzxwmvpbtxdamblnspepmrwtkficdilkniqwoocahupdukw
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
SILICONFLOW_MODEL=deepseek-ai/DeepSeek-V2.5

# 日志配置
LOG_LEVEL=info
```

### 第四步：等待部署完成
- Railway会自动安装依赖
- 运行数据库初始化脚本
- 启动应用服务
- 提供HTTPS域名

## 🌐 访问网站

部署完成后，Railway会提供：
- **HTTPS域名**：`https://your-app-name.railway.app`
- **自定义域名**：可在设置中绑定自己的域名

## 👥 默认账户

系统会自动创建以下测试账户：

### 管理员账户
- **邮箱**：`admin@xiaohongshu.com`
- **密码**：`admin123456`
- **类型**：正式学员
- **积分**：1000

### 演示账户
- **邮箱**：`demo@xiaohongshu.com`
- **密码**：`demo123456`
- **类型**：体验用户
- **积分**：3

## 🔧 管理功能

### 查看部署状态
- 在Railway控制台查看实时日志
- 监控应用性能和资源使用

### 更新应用
```bash
# 修改代码后推送到GitHub
git add .
git commit -m "Update application"
git push origin main

# Railway会自动重新部署
```

### 查看日志
- 在Railway控制台查看应用日志
- 实时监控错误和性能指标

## 💰 成本说明

### Railway定价
- **免费额度**：每月$5免费额度
- **按使用付费**：超出免费额度后按实际使用量计费
- **预估成本**：个人使用约$5-15/月

### 成本优化建议
1. 设置使用量提醒
2. 监控资源使用情况
3. 合理配置速率限制

## 🛠️ 故障排除

### 部署失败
1. 检查GitHub仓库是否正确
2. 确认环境变量配置完整
3. 查看构建日志排查错误

### 数据库连接失败
1. 确认MySQL服务已启动
2. 检查`DATABASE_URL`环境变量
3. 查看数据库连接日志

### AI调用失败
1. 检查API密钥是否正确
2. 确认网络连接正常
3. 查看API调用日志

## 📞 技术支持

如果遇到问题：
1. 查看Railway官方文档
2. 检查应用日志
3. 联系技术支持

## 🎉 部署完成

恭喜！您的小红书爆文助手已成功部署到Railway！

现在可以：
- ✅ 访问网站开始使用
- ✅ 注册新用户账户
- ✅ 测试AI功能
- ✅ 管理用户和积分

享受您的AI爆文助手吧！🚀 