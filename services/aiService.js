const axios = require('axios');
require('dotenv').config();

class AIService {
  constructor() {
    this.claudeApiKey = process.env.CLAUDE_API_KEY;
    this.deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.siliconflowApiKey = process.env.SILICONFLOW_API_KEY;
    this.siliconflowBaseUrl = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
    // 自定义Claude API配置
    this.customClaudeApiKey = process.env.CUSTOM_CLAUDE_API_KEY;
    this.customClaudeBaseUrl = process.env.CUSTOM_CLAUDE_BASE_URL;
    this.customClaudeModel = process.env.CUSTOM_CLAUDE_MODEL || 'claude-3-sonnet-20240229';
  }

  async callClaude(prompt, showThinking = false, useDeepAnalysis = false) {
    // 优先使用自定义Claude API，如果未配置则使用官方API
    if (this.customClaudeApiKey && this.customClaudeBaseUrl) {
      return this.callCustomClaude(prompt, showThinking, useDeepAnalysis);
    }
    
    if (!this.claudeApiKey) {
      throw new Error('Claude API密钥未配置，请配置CLAUDE_API_KEY或CUSTOM_CLAUDE_API_KEY');
    }

    try {
      const response = await axios.post('https://api.anthropic.com/v1/messages', {
        model: 'claude-3-sonnet-20240229',
        max_tokens: useDeepAnalysis ? 4000 : 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.claudeApiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 60000
      });

      return response.data.content[0].text;
    } catch (error) {
      console.error('Claude API调用失败:', error.response?.data || error.message);
      throw new Error('Claude API调用失败: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  async callCustomClaude(prompt, showThinking = false, useDeepAnalysis = false) {
    if (!this.customClaudeApiKey || !this.customClaudeBaseUrl) {
      throw new Error('自定义Claude API配置不完整');
    }

    try {
      const response = await axios.post(`${this.customClaudeBaseUrl}/chat/completions`, {
        model: this.customClaudeModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: useDeepAnalysis ? 4000 : 2000,
        temperature: 0.7,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.customClaudeApiKey}`
        },
        timeout: 60000
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('自定义Claude API调用失败:', error.response?.data || error.message);
      throw new Error('自定义Claude API调用失败: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  async callDeepSeek(prompt, useDeepAnalysis = false) {
    // 优先使用SiliconFlow平台，如果未配置则使用原始DeepSeek API
    if (this.siliconflowApiKey) {
      return this.callSiliconFlow(prompt, useDeepAnalysis);
    }
    
    if (!this.deepseekApiKey) {
      throw new Error('DeepSeek API密钥未配置，请配置DEEPSEEK_API_KEY或SILICONFLOW_API_KEY');
    }

    try {
      const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: useDeepAnalysis ? 4000 : 2000,
        temperature: 0.7,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.deepseekApiKey}`
        },
        timeout: 60000
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('DeepSeek API调用失败:', error.response?.data || error.message);
      throw new Error('DeepSeek API调用失败: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  async callSiliconFlow(prompt, useDeepAnalysis = false) {
    if (!this.siliconflowApiKey) {
      throw new Error('SiliconFlow API密钥未配置');
    }

    try {
      const response = await axios.post(`${this.siliconflowBaseUrl}/chat/completions`, {
        model: 'deepseek-ai/DeepSeek-V2.5', // SiliconFlow平台上的DeepSeek模型名称
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: useDeepAnalysis ? 4000 : 2000,
        temperature: 0.7,
        stream: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.siliconflowApiKey}`
        },
        timeout: 60000
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('SiliconFlow API调用失败:', error.response?.data || error.message);
      throw new Error('SiliconFlow API调用失败: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  async callOpenAI(prompt, useDeepAnalysis = false) {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API密钥未配置');
    }

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: useDeepAnalysis ? 4000 : 2000,
        temperature: 0.7
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        timeout: 60000
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API调用失败:', error.response?.data || error.message);
      throw new Error('OpenAI API调用失败: ' + (error.response?.data?.error?.message || error.message));
    }
  }

  buildAnalyzePrompt(content, model, showThinking, useDeepAnalysis) {
    if (model === 'claude') {
      if (showThinking) {
        return `我需要你详细拆解一篇小红书笔记的文案结构。请先进行思考，然后提供结果，按照下面的格式输出：

### 思考过程：
在这里详细分析这篇小红书笔记，包括你看到的结构特点、句式模式、表达技巧等。展示你的分析思路，着重关注：
- 标题结构和组成元素
- 各段落的具体功能和作用
- 句式变化和模式
- 特殊表达方式和词汇选择
- 互动设计和话术技巧
- 整体框架和写作风格

### 结果：
在这里提供最终的结构化分析结果，包括：

1. 标题解构：
   - 标题的组成部分和词语选择
   - 标题中的关键词和吸引点
   - 标题使用的修辞手法

2. 开场白分析：
   - 第一段的具体写作方式和句式特点
   - 如何建立共鸣或引起好奇
   - 使用的表达技巧和句型

3. 正文段落结构：
   - 每个段落的写作目的和功能
   - 段落的长短控制和节奏变化
   - 每段的句式模式和关键表达
   - 衔接词和过渡句的使用方法

4. 叙事手法：
   - 故事性元素的编排
   - 情感调动的具体表达方式
   - 话语权建立的细节

5. 关键词和修饰词：
   - 频繁使用的形容词和副词分析
   - 强调词和限定词的使用模式
   - 数字和具体细节的呈现方式

6. 互动设计：
   - 互动引导语的具体句式
   - 设问和悬念的创建方法
   - 评论转化的语言策略

7. 套用模板：
   - 将整篇文章转换为可套用的详细模板
   - 用[方括号]标注需要替换的内容
   - 保留原文的句式结构和表达方式

以下是小红书笔记内容：

"""
${content}
"""

${useDeepAnalysis ? '请进行非常深入和详细的分析，不遗漏任何细节，提供最全面的结构拆解。' : '提供细致但直接的分析，避免过于冗长。'}
在"结果"部分，避免使用表情符号，语言要简洁专业，不要有AI风格的解释和客套话。`;
      } else {
        return `请详细拆解这篇小红书笔记的文案结构，分析到句式和表达方式的细节层面：

"""
${content}
"""

请提供以下详细分析（颗粒度要非常细致）：

1. 标题解构：
   - 标题的组成部分和词语选择
   - 标题中的关键词和吸引点
   - 标题使用的修辞手法

2. 开场白分析：
   - 第一段的具体写作方式和句式特点
   - 如何建立共鸣或引起好奇
   - 使用的表达技巧和句型

3. 正文段落结构：
   - 每个段落的写作目的和功能
   - 段落的长短控制和节奏变化
   - 每段的句式模式和关键表达
   - 衔接词和过渡句的使用方法

4. 叙事手法：
   - 故事性元素的编排
   - 情感调动的具体表达方式
   - 话语权建立的细节

5. 关键词和修饰词：
   - 频繁使用的形容词和副词分析
   - 强调词和限定词的使用模式
   - 数字和具体细节的呈现方式

6. 互动设计：
   - 互动引导语的具体句式
   - 设问和悬念的创建方法
   - 评论转化的语言策略

7. 套用模板：
   - 将整篇文章转换为可套用的详细模板
   - 用[方括号]标注需要替换的内容
   - 保留原文的句式结构和表达方式

${useDeepAnalysis ? '请进行非常深入和详细的分析，不遗漏任何细节，提供最全面的结构拆解。' : ''}
请避免使用表情符号，语言要简洁专业，不要有AI风格的解释和客套话。直接提供结构化的拆解结果，让人能够看懂并模仿这种写作模式。`;
      }
    } else {
      return `详细拆解分析这篇小红书笔记的写作结构和特点：

"""
${content}
"""

请提供细致的结构分析：

1. 标题构造：
   - 标题包含哪些元素组成
   - 使用了什么吸引注意的技巧
   - 关键词的选择和排列方式

2. 开头设计：
   - 第一句话的写法和功能
   - 开场白的句式结构
   - 如何快速吸引读者注意

3. 文章框架：
   - 每个段落的具体功能
   - 段落之间如何衔接过渡
   - 不同段落的长度和密度安排

4. 句式分析：
   - 常用句型和句式模式
   - 重复使用的句式结构
   - 短句与长句的搭配节奏

5. 词汇使用：
   - 高频使用的形容词和动词
   - 关键修饰词的使用模式
   - 如何选词来增强表达效果

6. 互动技巧：
   - 文中设置的问题和引导
   - 互动语句的具体写法
   - 如何鼓励读者评论和点赞

7. 可套用模板：
   - 提供一个精确到句式的完整模板
   - 用[方括号]标注需要替换的部分
   - 保留原文的语言风格和结构特点

${useDeepAnalysis ? '请进行最详细的分析，不放过任何句式和结构细节，提供专业级别的拆解。' : ''}
请直接给出分析结果，不要加入AI风格的客套话，也不要使用表情符号。分析要细致到句式结构层面，让人能够完全理解并复制这种写作模式。`;
    }
  }

  buildGeneratePrompt(originalContent, newTopic, model, showThinking, useDeepAnalysis, keywords = '') {
    const keywordsText = keywords ? `关键词要求：${keywords}` : '';
    
    if (model === 'claude') {
      if (showThinking) {
        return `我有一篇关于某个产品的小红书爆文，现在需要你分析它的结构，然后用相同的句式和结构生成5篇关于新主题的不同爆文。请按照下面的格式输出：

### 思考过程：
在这部分，分析原始爆文的结构特点：
- 标题的构成方式和吸引点
- 开头段落的设计和功能
- 每个段落的作用和衔接方式
- 常用句式和表达模式
- 互动引导技巧
- 产品描述方式
- 如何根据这些特点为新主题创作5篇不同角度的内容

### 结果：

===笔记1===
标题：[第一篇笔记的标题]
[第一篇完整笔记内容]

===笔记2===
标题：[第二篇笔记的标题]
[第二篇完整笔记内容]

===笔记3===
标题：[第三篇笔记的标题]
[第三篇完整笔记内容]

===笔记4===
标题：[第四篇笔记的标题]
[第四篇完整笔记内容]

===笔记5===
标题：[第五篇笔记的标题]
[第五篇完整笔记内容]

原始爆文：
"""
${originalContent}
"""

新主题：${newTopic}
${keywordsText}

要求：
1. 生成5篇不同的笔记，每篇都基于原文结构但角度不同
2. 保持原文的段落划分、句式特点、关键词使用模式和互动设计
3. 每篇笔记都要有吸引人的不同标题
4. 内容要丰富多样，避免重复
5. 如果提供了关键词，请自然地融入到内容中

${useDeepAnalysis ? '请投入更多思考，确保每篇新文案都在保持原文结构的同时，针对新主题进行了最合适的调整，质量极高，且5篇之间有明显差异。' : ''}`;
      } else {
        return `我有一篇关于某个产品的小红书爆文，现在需要你分析它的结构，然后用相同的句式和结构生成5篇关于新主题的不同爆文。

原始爆文：
"""
${originalContent}
"""

新主题：${newTopic}
${keywordsText}

请按照以下格式输出5篇笔记：

===笔记1===
标题：[第一篇笔记的标题]
[第一篇完整笔记内容]

===笔记2===
标题：[第二篇笔记的标题]
[第二篇完整笔记内容]

===笔记3===
标题：[第三篇笔记的标题]
[第三篇完整笔记内容]

===笔记4===
标题：[第四篇笔记的标题]
[第四篇完整笔记内容]

===笔记5===
标题：[第五篇笔记的标题]
[第五篇完整笔记内容]

要求：
1. 分析原始爆文的结构、句式和写作技巧
2. 每篇笔记都使用完全相同的结构和句式，但内容角度不同
3. 保持原文的段落划分、句式特点、关键词使用模式和互动设计
4. 每篇都要有不同的吸引人标题
5. 如果原文中有具体数据、价格或专业术语，请为新主题提供相应的替代内容
6. 如果提供了关键词，请自然地融入到每篇内容中
7. 5篇笔记要从不同角度展现主题，避免内容重复

${useDeepAnalysis ? '请投入更多思考，确保每篇新文案都在保持原文结构的同时，针对新主题进行了最合适的调整，质量极高，且5篇之间有明显差异。' : ''}
不要包含分析过程，不要使用过多表情符号，保持语言风格与原文一致。`;
      }
    } else {
      return `分析下面这篇小红书爆文的结构和表达方式，然后按照完全相同的结构生成5篇关于新主题的不同文章。

原文：
"""
${originalContent}
"""

新主题：${newTopic}
${keywordsText}

请按照以下格式输出5篇笔记：

===笔记1===
标题：[第一篇笔记的标题]
[第一篇完整笔记内容]

===笔记2===
标题：[第二篇笔记的标题]
[第二篇完整笔记内容]

===笔记3===
标题：[第三篇笔记的标题]
[第三篇完整笔记内容]

===笔记4===
标题：[第四篇笔记的标题]
[第四篇完整笔记内容]

===笔记5===
标题：[第五篇笔记的标题]
[第五篇完整笔记内容]

要求：
1. 分析原文的结构、句式和表达特点
2. 每篇笔记都使用完全相同的框架、段落结构、句式风格，但角度不同
3. 保留原文的修辞手法、强调方式和互动设计
4. 替换具体内容为新主题"${newTopic}"相关的信息
5. 保持原文的语言风格、节奏感和吸引力
6. 每篇都要有不同的标题和内容角度
7. 如果提供了关键词，请自然融入内容
8. 5篇笔记要有差异性，避免重复

${useDeepAnalysis ? '请在保持原文结构的同时，确保每篇新文案针对新主题有最专业、最适合的内容，质量必须极高，且5篇之间角度明显不同。' : ''}
直接输出5篇笔记内容，不要包含分析部分。不使用过多表情符号，文风与原文保持一致。`;
    }
  }

  async processRequest(content, actionType, model, options = {}) {
    const {
      newTopic = '',
      keywords = '',
      showThinking = false,
      useDeepAnalysis = false
    } = options;

    let prompt;
    if (actionType === 'analyze') {
      prompt = this.buildAnalyzePrompt(content, model, showThinking, useDeepAnalysis);
    } else {
      prompt = this.buildGeneratePrompt(content, newTopic, model, showThinking, useDeepAnalysis, keywords);
    }

    const startTime = Date.now();
    let result;

    try {
      if (model === 'claude') {
        result = await this.callClaude(prompt, showThinking, useDeepAnalysis);
      } else if (model === 'deepseek') {
        result = await this.callDeepSeek(prompt, useDeepAnalysis);
      } else {
        throw new Error('不支持的模型类型');
      }

      const processingTime = Date.now() - startTime;
      return {
        success: true,
        content: result,
        processingTime
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        processingTime
      };
    }
  }
}

module.exports = new AIService(); 