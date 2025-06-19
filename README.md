# 小红书爆文助手 - 专业版

基于您原有代码改造的独立部署版本，支持用户系统、积分管理、AI模型调用等完整功能。

## 📋 功能特性

### 核心功能
- **爆文结构拆解**: 深度分析小红书笔记的写作结构和技巧
- **类似爆文生成**: 基于现有爆文结构，生成新主题的文案
- **多模型支持**: 集成Claude-3.7-Sonnet和DeepSeek-R1模型
- **思考过程展示**: 可选择显示AI的分析思路

### 用户系统
- **多用户类型**: 支持体验用户和正式学员
- **积分管理**: 体验用户3次免费，正式学员每月100积分
- **使用历史**: 完整的使用记录和统计
- **权限控制**: 基于JWT的安全认证

### 系统特性
- **速率限制**: 防止恶意请求和滥用
- **数据持久化**: MySQL数据库存储
- **日志记录**: 完整的操作和错误日志
- **容器化部署**: Docker + Docker Compose
- **负载均衡**: Nginx反向代理
- **安全防护**: 多层安全机制

## 🚀 快速开始

### 环境要求
- Node.js 18+
- MySQL 8.0+
- Docker & Docker Compose (推荐)

### 方式一：Docker部署（推荐）

1. **克隆项目**
```bash
git clone <repository-url>
cd xiaohongshu-assistant
```

2. **配置环境变量**
```bash
cp env.example .env
# 编辑 .env 文件，配置AI API密钥
```

3. **启动服务**
```bash
docker-compose up -d
```

4. **初始化数据库**
```bash
docker-compose exec app npm run init-db
```

5. **访问应用**
- 应用地址: http://localhost
- 健康检查: http://localhost/health

### 方式二：本地开发

1. **安装依赖**
```bash
npm install
```

2. **配置环境变量**
```bash
cp env.example .env
# 编辑 .env 文件
```

3. **启动MySQL数据库**
```bash
# 确保MySQL服务运行，并创建数据库
mysql -u root -p -e "CREATE DATABASE xiaohongshu_assistant;"
```

4. **初始化数据库**
```bash
npm run init-db
```

5. **启动开发服务器**
```bash
npm run dev
```

## ⚙️ 配置说明

### 环境变量配置

在 `.env` 文件中配置以下参数：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=xiaohongshu_assistant
DB_USER=root
DB_PASSWORD=your_password

# JWT配置
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# AI API配置（必须配置至少一个）
CLAUDE_API_KEY=your_claude_api_key
DEEPSEEK_API_KEY=your_deepseek_api_key

# 自定义Claude API配置（第三方代理）
CUSTOM_CLAUDE_API_KEY=your_custom_claude_api_key
CUSTOM_CLAUDE_BASE_URL=https://api.openai-proxy.com/v1
CUSTOM_CLAUDE_MODEL=claude-3-sonnet-20240229

# SiliconFlow API配置（推荐，支持多种模型）
SILICONFLOW_API_KEY=your_siliconflow_api_key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1

# 服务器配置
PORT=3000
NODE_ENV=development

# 积分配置
TRIAL_CREDITS=3
MONTHLY_CREDITS=100

# 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=15
```

### AI模型配置

#### Claude API（通过DP API）
1. 使用DP API服务访问Claude模型
2. API地址：`https://dpapi.cn/v1`
3. 配置API密钥到 `CUSTOM_CLAUDE_API_KEY`
4. 支持多种Claude模型，如 `claude-3-5-haiku-20241022`

#### 官方Claude API（备选方案）
1. 访问 [Anthropic Console](https://console.anthropic.com/)
2. 创建API密钥
3. 将密钥配置到 `CLAUDE_API_KEY`

#### DeepSeek API（通过SiliconFlow平台）
1. 访问 [SiliconFlow Platform](https://docs.siliconflow.cn/)
2. 创建API密钥
3. 将密钥配置到 `SILICONFLOW_API_KEY`
4. SiliconFlow平台提供多种AI模型，包括DeepSeek-V2.5

#### 原生DeepSeek API（备选方案）
1. 访问 [DeepSeek Platform](https://platform.deepseek.com/)
2. 创建API密钥
3. 将密钥配置到 `DEEPSEEK_API_KEY`

## 📚 API文档

### 认证接口

#### 注册用户
```http
POST /auth/register
Content-Type: application/json

{
  "username": "test_user",
  "email": "test@example.com",
  "password": "password123",
  "userType": "trial"
}
```

#### 用户登录
```http
POST /auth/login
Content-Type: application/json

{
  "identifier": "test_user",
  "password": "password123"
}
```

#### 获取用户信息
```http
GET /auth/me
Authorization: Bearer <token>
```

### 功能接口

#### 拆解爆文结构
```http
POST /api/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "小红书笔记内容...",
  "model": "claude",
  "showThinking": true,
  "useDeepAnalysis": false
}
```

#### 生成类似爆文
```http
POST /api/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "originalContent": "原始爆文内容...",
  "newTopic": "新产品主题",
  "model": "deepseek",
  "showThinking": false,
  "useDeepAnalysis": true
}
```

#### 获取使用历史
```http
GET /api/history?page=1&limit=10
Authorization: Bearer <token>
```

## 🏗️ 架构设计

### 技术栈
- **后端**: Node.js + Express + Sequelize
- **数据库**: MySQL 8.0
- **前端**: HTML + CSS + JavaScript (原生)
- **认证**: JWT Token
- **部署**: Docker + Nginx
- **日志**: Winston

### 项目结构
```
├── config/             # 配置文件
│   └── database.js    # 数据库配置
├── models/            # 数据模型
│   ├── User.js       # 用户模型
│   └── Usage.js      # 使用记录模型
├── routes/            # 路由定义
│   ├── auth.js       # 认证路由
│   └── api.js        # API路由
├── services/          # 业务服务
│   └── aiService.js  # AI服务
├── public/            # 静态文件
│   ├── index.html    # 主页面
│   └── js/app.js     # 前端逻辑
├── scripts/           # 脚本文件
│   └── init-db.js    # 数据库初始化
├── nginx/             # Nginx配置
├── logs/              # 日志目录
├── server.js          # 主服务器文件
├── package.json       # 项目配置
├── Dockerfile         # Docker配置
└── docker-compose.yml # 容器编排
```

## 👥 用户系统

### 用户类型

#### 体验用户 (trial)
- 免费注册
- 3次使用机会
- 支持所有功能
- 用完后需要升级

#### 正式学员 (student)
- 每月100积分
- 每月可重置积分
- 享受完整服务
- 优先技术支持

### 积分管理
- 每次AI调用消耗1积分
- 失败的调用会退还积分
- 正式学员可手动重置月度积分
- 系统记录所有积分变动

## 🛡️ 安全机制

### 认证与授权
- JWT Token认证
- 密码bcrypt加密
- 用户权限控制
- Token过期自动处理

### 速率限制
- API调用频率限制
- 登录尝试限制
- IP级别防护
- 突发请求缓冲

### 数据安全
- SQL注入防护
- XSS攻击防护
- CSRF保护
- 敏感信息加密

## 📊 监控与日志

### 日志系统
- 应用日志：`logs/combined.log`
- 错误日志：`logs/error.log`
- 访问日志：Nginx访问记录
- 数据库日志：MySQL慢查询日志

### 健康检查
- 应用健康检查：`/health`
- 数据库连接检查
- AI服务可用性检查
- 系统资源监控

## 🔧 运维指南

### 日常维护

#### 查看服务状态
```bash
docker-compose ps
```

#### 查看日志
```bash
# 应用日志
docker-compose logs app

# 数据库日志
docker-compose logs mysql

# Nginx日志
docker-compose logs nginx
```

#### 备份数据库
```bash
docker-compose exec mysql mysqldump -u root -p xiaohongshu_assistant > backup.sql
```

#### 重启服务
```bash
docker-compose restart
```

### 生产环境部署

1. **配置HTTPS**
   - 获取SSL证书
   - 修改nginx配置启用HTTPS
   - 强制重定向HTTP到HTTPS

2. **性能优化**
   - 启用Nginx缓存
   - 配置数据库连接池
   - 优化数据库索引
   - 配置CDN加速

3. **监控告警**
   - 配置系统监控
   - 设置错误告警
   - 监控资源使用
   - 定期健康检查

## ❓ 常见问题

### Q: AI模型调用失败怎么办？
A: 
1. 检查API密钥是否正确配置
2. 确认API配额是否充足
3. 检查网络连接是否正常
4. 查看错误日志获取详细信息

### Q: 如何升级用户类型？
A: 
目前需要直接在数据库中修改用户的 `userType` 字段，后续版本会添加管理界面。

### Q: 忘记密码怎么办？
A: 
当前版本暂不支持密码重置，需要联系管理员重置或直接修改数据库。

### Q: 如何修改积分配置？
A: 
修改 `.env` 文件中的 `TRIAL_CREDITS` 和 `MONTHLY_CREDITS` 配置，重启服务生效。

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目基于 MIT 许可证开源 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 项目Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 邮箱: your-email@example.com

---

**注意**: 在生产环境中，请务必：
1. 修改所有默认密码和密钥
2. 配置适当的防火墙规则
3. 启用HTTPS加密传输
4. 定期备份数据库
5. 监控系统性能和安全状态 