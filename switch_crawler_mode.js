#!/usr/bin/env node

/**
 * 小红书爬虫模式切换工具
 * 使用方法: node switch_crawler_mode.js [mock|real]
 */

const fs = require('fs');
const path = require('path');

const mode = process.argv[2];

if (!mode || !['mock', 'real'].includes(mode)) {
  console.log('使用方法: node switch_crawler_mode.js [mock|real]');
  console.log('');
  console.log('模式说明:');
  console.log('  mock - 模拟数据模式（默认，用于演示）');
  console.log('  real - 真实爬虫模式（需要配置MediaCrawler）');
  process.exit(1);
}

// 检查是否存在配置文件
const configPath = path.join(__dirname, 'config.js');
const exampleConfigPath = path.join(__dirname, 'config.example.js');

if (!fs.existsSync(configPath)) {
  if (fs.existsSync(exampleConfigPath)) {
    console.log('正在创建配置文件...');
    fs.copyFileSync(exampleConfigPath, configPath);
    console.log('✅ 配置文件已创建: config.js');
  } else {
    console.error('❌ 找不到配置文件模板');
    process.exit(1);
  }
}

// 读取配置文件
let configContent = fs.readFileSync(configPath, 'utf8');

// 更新爬虫模式
const modeRegex = /CRAWLER_MODE:\s*process\.env\.CRAWLER_MODE\s*\|\|\s*['"`]([^'"`]+)['"`]/;
const newModeValue = `CRAWLER_MODE: process.env.CRAWLER_MODE || '${mode}'`;

if (modeRegex.test(configContent)) {
  configContent = configContent.replace(modeRegex, newModeValue);
} else {
  console.error('❌ 无法找到配置项 CRAWLER_MODE');
  process.exit(1);
}

// 写入配置文件
fs.writeFileSync(configPath, configContent);

console.log('');
console.log('🔧 爬虫模式已切换到:', mode.toUpperCase());
console.log('');

if (mode === 'real') {
  console.log('📋 真实爬虫模式启用说明:');
  console.log('');
  console.log('1. 确保MediaCrawler已正确安装:');
  console.log('   cd crawler/MediaCrawler');
  console.log('   source venv/bin/activate');
  console.log('   python main.py --platform xhs --lt qrcode --type search');
  console.log('');
  console.log('2. 首次使用需要扫码登录小红书');
  console.log('');
  console.log('3. 重启服务器使配置生效:');
  console.log('   npm restart');
  console.log('');
  console.log('📖 详细配置请参考: MEDIACRAWLER_SETUP.md');
} else {
  console.log('🎭 模拟数据模式启用说明:');
  console.log('');
  console.log('- 使用高质量模拟数据进行演示');
  console.log('- 无需登录，即开即用');
  console.log('- AI分析功能正常工作');
  console.log('');
  console.log('重启服务器使配置生效:');
  console.log('npm restart');
}

console.log('');