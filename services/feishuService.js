const axios = require('axios');

class FeishuBitableService {
  constructor() {
    // 飞书多维表格配置
    this.appId = process.env.FEISHU_APP_ID;
    this.appSecret = process.env.FEISHU_APP_SECRET;
    this.baseUrl = 'https://open.feishu.cn/open-apis';
    this.accessToken = null;
    this.tokenExpiry = null;
    
    // 表格配置
    this.bitableAppToken = process.env.FEISHU_BITABLE_APP_TOKEN; // 多维表格的app_token
    this.tableId = process.env.FEISHU_TABLE_ID; // 数据表的table_id
  }

  /**
   * 获取访问令牌
   */
  async getAccessToken() {
    // 检查token是否仍然有效
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(`${this.baseUrl}/auth/v3/tenant_access_token/internal`, {
        app_id: this.appId,
        app_secret: this.appSecret
      }, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      });

      if (response.data.code === 0) {
        this.accessToken = response.data.tenant_access_token;
        // token有效期为2小时，提前5分钟刷新
        this.tokenExpiry = Date.now() + (response.data.expire - 300) * 1000;
        console.log('🔑 飞书访问令牌获取成功');
        return this.accessToken;
      } else {
        throw new Error(`获取访问令牌失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('❌ 获取飞书访问令牌失败:', error.message);
      throw error;
    }
  }

  /**
   * 保存笔记到飞书多维表格
   */
  async saveNote(noteData) {
    try {
      const token = await this.getAccessToken();
      
      // 构建要保存的记录
      const record = {
        fields: {
          '标题': noteData.title || '',
          '内容': noteData.content || '',
          '作者': noteData.author || '',
          '链接': noteData.url || '',
          '点赞数': noteData.likes || 0,
          '评论数': noteData.comments || 0,
          '收藏数': noteData.collects || 0,
          '转发数': noteData.shares || 0,
          'CES评分': this.calculateCES(noteData),
          '抓取时间': new Date().toISOString(),
          '笔记ID': noteData.id || '',
          '是否爆款': this.isPopular(noteData),
          '数据来源': noteData.isDemo ? '模拟数据' : '真实数据',
          '标签': this.extractTags(noteData.content || '').join(', ')
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/bitable/v1/apps/${this.bitableAppToken}/tables/${this.tableId}/records`,
        { record },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8'
          }
        }
      );

      if (response.data.code === 0) {
        console.log('✅ 笔记已保存到飞书多维表格');
        return {
          success: true,
          recordId: response.data.data.record.record_id,
          message: '保存成功'
        };
      } else {
        throw new Error(`保存失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('❌ 保存到飞书多维表格失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 批量保存笔记
   */
  async saveNotes(notesData) {
    const results = [];
    
    for (const noteData of notesData) {
      const result = await this.saveNote(noteData);
      results.push({
        title: noteData.title,
        success: result.success,
        recordId: result.recordId,
        error: result.error
      });
      
      // 避免请求过于频繁
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    return results;
  }

  /**
   * 从飞书多维表格查询笔记
   */
  async queryNotes(options = {}) {
    try {
      const token = await this.getAccessToken();
      
      const params = {
        page_size: options.limit || 20,
        page_token: options.pageToken || ''
      };
      
      // 添加筛选条件
      if (options.filter) {
        params.filter = options.filter;
      }
      
      // 添加排序
      if (options.sort) {
        params.sort = options.sort;
      }

      const response = await axios.get(
        `${this.baseUrl}/bitable/v1/apps/${this.bitableAppToken}/tables/${this.tableId}/records`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8'
          },
          params
        }
      );

      if (response.data.code === 0) {
        const records = response.data.data.items.map(item => ({
          recordId: item.record_id,
          title: item.fields['标题'],
          content: item.fields['内容'],
          author: item.fields['作者'],
          url: item.fields['链接'],
          likes: item.fields['点赞数'] || 0,
          comments: item.fields['评论数'] || 0,
          collects: item.fields['收藏数'] || 0,
          shares: item.fields['转发数'] || 0,
          cesScore: item.fields['CES评分'] || 0,
          crawlTime: item.fields['抓取时间'],
          noteId: item.fields['笔记ID'],
          isPopular: item.fields['是否爆款'],
          dataSource: item.fields['数据来源'],
          tags: item.fields['标签'] ? item.fields['标签'].split(', ') : []
        }));

        return {
          success: true,
          data: records,
          hasMore: response.data.data.has_more,
          pageToken: response.data.data.page_token
        };
      } else {
        throw new Error(`查询失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('❌ 从飞书多维表格查询失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 搜索笔记
   */
  async searchNotes(keyword, options = {}) {
    const searchOptions = {
      ...options,
      filter: `OR(SEARCH("${keyword}",{标题}),SEARCH("${keyword}",{内容}),SEARCH("${keyword}",{标签}))`
    };
    
    return await this.queryNotes(searchOptions);
  }

  /**
   * 获取爆款笔记
   */
  async getPopularNotes(options = {}) {
    const popularOptions = {
      ...options,
      filter: '{是否爆款}=TRUE()',
      sort: [{ field_name: 'CES评分', desc: true }]
    };
    
    return await this.queryNotes(popularOptions);
  }

  /**
   * 更新笔记数据（用于同步最新的点赞、评论数等）
   */
  async updateNoteStats(recordId, newStats) {
    try {
      const token = await this.getAccessToken();
      
      const updateData = {
        fields: {
          '点赞数': newStats.likes || 0,
          '评论数': newStats.comments || 0,
          '收藏数': newStats.collects || 0,
          '转发数': newStats.shares || 0,
          'CES评分': this.calculateCES(newStats),
          '是否爆款': this.isPopular(newStats),
          '最后更新': new Date().toISOString()
        }
      };

      const response = await axios.put(
        `${this.baseUrl}/bitable/v1/apps/${this.bitableAppToken}/tables/${this.tableId}/records/${recordId}`,
        { record: updateData },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8'
          }
        }
      );

      if (response.data.code === 0) {
        console.log('✅ 笔记数据更新成功');
        return { success: true };
      } else {
        throw new Error(`更新失败: ${response.data.msg}`);
      }
    } catch (error) {
      console.error('❌ 更新笔记数据失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 计算CES评分
   * CES = 点赞数×1 + 收藏数×1 + 评论数×4 + 转发数×4 + 关注数×8
   */
  calculateCES(noteData) {
    const likes = noteData.likes || 0;
    const collects = noteData.collects || 0;
    const comments = noteData.comments || 0;
    const shares = noteData.shares || 0;
    const follows = noteData.follows || 0; // 关注数
    
    return likes * 1 + collects * 1 + comments * 4 + shares * 4 + follows * 8;
  }

  /**
   * 判断是否为爆款
   */
  isPopular(noteData) {
    const cesScore = this.calculateCES(noteData);
    return cesScore >= 1000; // 可配置的爆款阈值
  }

  /**
   * 从内容中提取标签
   */
  extractTags(content) {
    const tags = [];
    
    // 提取#标签
    const hashtagMatches = content.match(/#[^\s#]+/g);
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map(tag => tag.substring(1)));
    }
    
    // 基于关键词的简单分类
    const categories = {
      '美妆护肤': ['护肤', '美妆', '化妆', '面膜', '口红', '粉底'],
      '生活方式': ['生活', '日常', '分享', '推荐', '好物'],
      '知识分享': ['学习', '知识', '技巧', '方法', '教程'],
      '美食': ['美食', '食谱', '做饭', '烘焙', '料理'],
      '时尚': ['穿搭', '时尚', '服装', '搭配', '潮流'],
      '旅行': ['旅行', '旅游', '景点', '攻略', '出行']
    };
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        tags.push(category);
      }
    }
    
    return [...new Set(tags)]; // 去重
  }

  /**
   * 检查配置是否完整
   */
  isConfigured() {
    return !!(this.appId && this.appSecret && this.bitableAppToken && this.tableId);
  }

  /**
   * 获取表格统计信息
   */
  async getTableStats() {
    try {
      const result = await this.queryNotes({ limit: 1000 }); // 获取所有记录进行统计
      
      if (!result.success) {
        return { success: false, error: result.error };
      }
      
      const notes = result.data;
      const totalNotes = notes.length;
      const popularNotes = notes.filter(note => note.isPopular).length;
      
      // 按标签分组统计
      const tagStats = {};
      notes.forEach(note => {
        note.tags.forEach(tag => {
          tagStats[tag] = (tagStats[tag] || 0) + 1;
        });
      });
      
      // 按数据来源统计
      const sourceStats = {};
      notes.forEach(note => {
        sourceStats[note.dataSource] = (sourceStats[note.dataSource] || 0) + 1;
      });
      
      return {
        success: true,
        stats: {
          totalNotes,
          popularNotes,
          popularRate: totalNotes > 0 ? (popularNotes / totalNotes * 100).toFixed(2) : 0,
          tagDistribution: tagStats,
          sourceDistribution: sourceStats,
          averageCesScore: totalNotes > 0 ? 
            (notes.reduce((sum, note) => sum + (note.cesScore || 0), 0) / totalNotes).toFixed(2) : 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = FeishuBitableService;