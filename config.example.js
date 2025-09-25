// 小红书爬文助手配置文件
// 复制此文件为 config.js 并根据需要修改配置

module.exports = {
  // ===================
  // 爬虫模式设置
  // ===================
  
  // 爬虫模式: 'mock' 使用模拟数据, 'real' 使用真实爬虫
  CRAWLER_MODE: process.env.CRAWLER_MODE || 'mock',

  // ===================
  // MediaCrawler 配置
  // ===================
  
  // Python 虚拟环境路径
  PYTHON_VENV_PATH: process.env.PYTHON_VENV_PATH || 'crawler/MediaCrawler/venv/bin/python',
  
  // 爬虫脚本路径
  CRAWLER_SCRIPT_PATH: process.env.CRAWLER_SCRIPT_PATH || 'crawler_api.py',
  
  // 爬虫超时时间（秒）
  CRAWLER_TIMEOUT: parseInt(process.env.CRAWLER_TIMEOUT) || 60,

  // ===================
  // 小红书登录配置
  // ===================
  
  // 登录类型: 'qrcode' 二维码登录, 'phone' 手机号登录
  XHS_LOGIN_TYPE: process.env.XHS_LOGIN_TYPE || 'qrcode',
  
  // 是否启用无头模式（生产环境建议true）
  XHS_HEADLESS: process.env.XHS_HEADLESS === 'true',
  
  // 是否启用评论爬取
  XHS_ENABLE_COMMENTS: process.env.XHS_ENABLE_COMMENTS !== 'false',

  // ===================
  // 数据库配置
  // ===================
  
  // 数据保存选项: 'sqlite', 'json', 'csv', 'db'
  XHS_SAVE_DATA_OPTION: process.env.XHS_SAVE_DATA_OPTION || 'json',

  // ===================
  // 反爬虫配置
  // ===================
  
  // 是否启用IP代理
  ENABLE_IP_PROXY: process.env.ENABLE_IP_PROXY === 'true',
  
  // 代理池大小
  IP_PROXY_POOL_COUNT: parseInt(process.env.IP_PROXY_POOL_COUNT) || 5,
  
  // 请求延迟（秒）
  REQUEST_DELAY: parseInt(process.env.REQUEST_DELAY) || 2,
  
  // 随机延迟范围（秒）
  REQUEST_DELAY_RANDOM: parseInt(process.env.REQUEST_DELAY_RANDOM) || 1,

  // ===================
  // 日志配置
  // ===================
  
  // 日志级别: 'debug', 'info', 'warn', 'error'
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // 是否启用详细日志
  ENABLE_VERBOSE_LOG: process.env.ENABLE_VERBOSE_LOG === 'true'
};