#!/usr/bin/env node
/**
 * 自动错误恢复和健康检查脚本
 * 解决长时间等待和自动纠错问题
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class AutoRecovery {
    constructor() {
        this.maxRetries = 3;
        this.healthCheckInterval = 10000; // 10秒
        this.serverProcess = null;
        this.isRecovering = false;
    }

    // 日志输出
    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const colors = {
            INFO: '\x1b[36m',
            ERROR: '\x1b[31m',
            SUCCESS: '\x1b[32m',
            WARNING: '\x1b[33m',
            RESET: '\x1b[0m'
        };
        console.log(`${colors[type]}[${timestamp}] ${type}: ${message}${colors.RESET}`);
    }

    // 检查端口是否被占用
    async checkPort(port) {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            exec(`lsof -ti:${port}`, (error, stdout) => {
                resolve(stdout.trim() !== '');
            });
        });
    }

    // 杀死占用端口的进程
    async killPortProcess(port) {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            exec(`lsof -ti:${port} | xargs kill -9`, (error) => {
                setTimeout(resolve, 1000); // 等待进程完全结束
            });
        });
    }

    // 健康检查
    async healthCheck() {
        try {
            const response = await axios.get('http://localhost:3000/health', {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    // 检查必要文件
    checkRequiredFiles() {
        const requiredFiles = [
            'server.js',
            'package.json',
            'routes/api.js',
            'services/aiService.js'
        ];

        const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
        
        if (missingFiles.length > 0) {
            this.log(`缺少必要文件: ${missingFiles.join(', ')}`, 'ERROR');
            return false;
        }
        return true;
    }

    // 启动服务器
    async startServer() {
        if (!this.checkRequiredFiles()) {
            throw new Error('缺少必要文件，无法启动服务器');
        }

        // 检查并清理端口
        if (await this.checkPort(3000)) {
            this.log('端口3000被占用，正在清理...', 'WARNING');
            await this.killPortProcess(3000);
        }

        return new Promise((resolve, reject) => {
            this.log('正在启动服务器...', 'INFO');
            
            this.serverProcess = spawn('node', ['server.js'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });

            let startupOutput = '';
            let startupTimeout = setTimeout(() => {
                reject(new Error('服务器启动超时'));
            }, 30000); // 30秒超时

            this.serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                startupOutput += output;
                
                // 检查启动成功标志
                if (output.includes('路由和中间件加载完成') || output.includes('系统准备就绪')) {
                    clearTimeout(startupTimeout);
                    this.log('服务器启动成功', 'SUCCESS');
                    resolve();
                }
            });

            this.serverProcess.stderr.on('data', (data) => {
                const error = data.toString();
                this.log(`服务器错误: ${error}`, 'ERROR');
            });

            this.serverProcess.on('exit', (code) => {
                clearTimeout(startupTimeout);
                if (code !== 0) {
                    this.log(`服务器异常退出，代码: ${code}`, 'ERROR');
                    reject(new Error(`服务器退出代码: ${code}`));
                }
            });
        });
    }

    // 自动恢复
    async autoRecover() {
        if (this.isRecovering) {
            this.log('正在恢复中，跳过此次检查', 'WARNING');
            return;
        }

        this.isRecovering = true;
        this.log('开始自动恢复流程...', 'WARNING');

        try {
            // 1. 停止现有服务器
            if (this.serverProcess) {
                this.serverProcess.kill();
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // 2. 清理端口
            await this.killPortProcess(3000);

            // 3. 重新启动
            await this.startServer();

            // 4. 验证启动
            await new Promise(resolve => setTimeout(resolve, 5000));
            const isHealthy = await this.healthCheck();
            
            if (isHealthy) {
                this.log('自动恢复成功！', 'SUCCESS');
            } else {
                throw new Error('服务器启动后健康检查失败');
            }

        } catch (error) {
            this.log(`自动恢复失败: ${error.message}`, 'ERROR');
        } finally {
            this.isRecovering = false;
        }
    }

    // 启动监控
    async startMonitoring() {
        this.log('启动服务器监控...', 'INFO');

        // 首次启动
        try {
            await this.startServer();
        } catch (error) {
            this.log(`初始启动失败: ${error.message}`, 'ERROR');
            await this.autoRecover();
        }

        // 定期健康检查
        setInterval(async () => {
            const isHealthy = await this.healthCheck();
            
            if (!isHealthy) {
                this.log('健康检查失败，启动自动恢复...', 'WARNING');
                await this.autoRecover();
            } else {
                this.log('服务器运行正常', 'INFO');
            }
        }, this.healthCheckInterval);

        // 优雅退出处理
        process.on('SIGINT', () => {
            this.log('收到退出信号，正在关闭服务器...', 'INFO');
            if (this.serverProcess) {
                this.serverProcess.kill();
            }
            process.exit(0);
        });
    }

    // 快速修复常见问题
    async quickFix() {
        this.log('执行快速修复...', 'INFO');

        // 1. 检查目录
        const currentDir = process.cwd();
        this.log(`当前目录: ${currentDir}`, 'INFO');

        // 2. 检查必要文件
        if (!this.checkRequiredFiles()) {
            return false;
        }

        // 3. 清理进程和端口
        await this.killPortProcess(3000);

        // 4. 检查依赖
        if (!fs.existsSync('node_modules')) {
            this.log('node_modules不存在，需要运行 npm install', 'WARNING');
            return false;
        }

        this.log('快速修复完成', 'SUCCESS');
        return true;
    }
}

// 命令行使用
if (require.main === module) {
    const recovery = new AutoRecovery();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'start':
            recovery.startMonitoring();
            break;
        case 'fix':
            recovery.quickFix();
            break;
        case 'recover':
            recovery.autoRecover();
            break;
        default:
            console.log(`
使用方法:
  node auto_recovery.js start    - 启动服务器并监控
  node auto_recovery.js fix      - 快速修复常见问题
  node auto_recovery.js recover  - 执行自动恢复
            `);
    }
}

module.exports = AutoRecovery;