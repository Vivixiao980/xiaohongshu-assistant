const fs = require('fs').promises;
const path = require('path');

class UsageTracker {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/api-usage.json');
    this.ensureLogFile();
  }

  async ensureLogFile() {
    try {
      const logsDir = path.join(__dirname, '../logs');
      await fs.mkdir(logsDir, { recursive: true });
      
      try {
        await fs.access(this.logFile);
      } catch {
        // 文件不存在，创建初始文件
        await fs.writeFile(this.logFile, JSON.stringify([], null, 2));
      }
    } catch (error) {
      console.error('创建用量日志文件失败:', error);
    }
  }

  async logAPICall(data) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        model: data.model,
        action: data.action,
        processingTime: data.processingTime,
        status: data.status,
        inputLength: data.inputLength || 0,
        outputLength: data.outputLength || 0,
        userAgent: data.userAgent,
        ip: data.ip
      };

      // 读取现有日志
      let logs = [];
      try {
        const content = await fs.readFile(this.logFile, 'utf8');
        logs = JSON.parse(content);
      } catch (error) {
        console.warn('读取用量日志失败，创建新日志:', error.message);
        logs = [];
      }

      // 添加新记录
      logs.push(logEntry);

      // 保留最近1000条记录
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }

      // 写入文件
      await fs.writeFile(this.logFile, JSON.stringify(logs, null, 2));
      
      console.log(`📊 API调用已记录: ${data.model} ${data.action} (${data.processingTime}ms)`);
    } catch (error) {
      console.error('记录API调用失败:', error);
    }
  }

  async getUsageStats() {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const logs = JSON.parse(content);

      if (logs.length === 0) {
        return {
          totalCalls: 0,
          modelDistribution: {},
          actionDistribution: {},
          avgResponseTime: 0,
          successRate: 100,
          recentCalls: []
        };
      }

      // 统计数据
      const totalCalls = logs.length;
      const successfulCalls = logs.filter(log => log.status === 'success').length;
      const successRate = ((successfulCalls / totalCalls) * 100).toFixed(1);

      // 模型分布
      const modelDistribution = {};
      logs.forEach(log => {
        const modelName = log.model === 'claude' ? 'Claude' : 'DeepSeek';
        modelDistribution[modelName] = (modelDistribution[modelName] || 0) + 1;
      });

      // 功能分布
      const actionDistribution = {};
      logs.forEach(log => {
        const actionName = log.action === 'analyze' ? '拆解分析' : '生成仿写';
        actionDistribution[actionName] = (actionDistribution[actionName] || 0) + 1;
      });

      // 平均响应时间
      const avgResponseTime = logs.reduce((sum, log) => sum + (log.processingTime || 0), 0) / logs.length;

      // 最近调用
      const recentCalls = logs.slice(-10).reverse().map(log => ({
        time: new Date(log.timestamp).toLocaleString('zh-CN'),
        model: log.model === 'claude' ? 'Claude' : 'DeepSeek',
        action: log.action === 'analyze' ? '拆解分析' : '生成仿写',
        responseTime: log.processingTime ? (log.processingTime / 1000).toFixed(2) + 's' : 'N/A',
        status: log.status === 'success' ? '成功' : '失败'
      }));

      return {
        totalCalls,
        modelDistribution,
        actionDistribution,
        avgResponseTime: (avgResponseTime / 1000).toFixed(2),
        successRate,
        recentCalls
      };
    } catch (error) {
      console.error('获取用量统计失败:', error);
      return {
        totalCalls: 0,
        modelDistribution: {},
        actionDistribution: {},
        avgResponseTime: 0,
        successRate: 100,
        recentCalls: []
      };
    }
  }

  async getTodayStats() {
    try {
      const content = await fs.readFile(this.logFile, 'utf8');
      const logs = JSON.parse(content);

      const today = new Date().toDateString();
      const todayLogs = logs.filter(log => 
        new Date(log.timestamp).toDateString() === today
      );

      return {
        todayCalls: todayLogs.length,
        todayModels: this.getDistribution(todayLogs, 'model'),
        todayActions: this.getDistribution(todayLogs, 'action')
      };
    } catch (error) {
      console.error('获取今日统计失败:', error);
      return { todayCalls: 0, todayModels: {}, todayActions: {} };
    }
  }

  getDistribution(logs, field) {
    const distribution = {};
    logs.forEach(log => {
      distribution[log[field]] = (distribution[log[field]] || 0) + 1;
    });
    return distribution;
  }
}

module.exports = new UsageTracker(); 