// 显示指定的功能区域
function showSection(section) {
    // 隐藏所有区域
    document.getElementById('crawl-section').style.display = 'none';
    document.getElementById('analyze-section').style.display = 'none';
    document.getElementById('generate-section').style.display = 'none';
    
    // 显示选中的区域
    document.getElementById(section + '-section').style.display = 'block';
    
    // 滚动到目标区域
    document.getElementById(section + '-section').scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

// 显示加载状态
function showLoading(section) {
    document.getElementById(section + '-loading').classList.remove('hidden');
    document.getElementById(section + '-result').classList.add('hidden');
}

// 隐藏加载状态
function hideLoading(section) {
    document.getElementById(section + '-loading').classList.add('hidden');
}

// 显示结果
function showResult(section, content) {
    hideLoading(section);
    const resultDiv = document.getElementById(section + '-result');
    resultDiv.innerHTML = content;
    resultDiv.classList.remove('hidden');
}

// 显示错误信息
function showError(section, message) {
    hideLoading(section);
    const resultDiv = document.getElementById(section + '-result');
    resultDiv.innerHTML = `
        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <div class="flex">
                <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                <div>
                    <h4 class="text-red-800 font-medium">操作失败</h4>
                    <p class="text-red-700 mt-1">${message}</p>
                </div>
            </div>
        </div>
    `;
    resultDiv.classList.remove('hidden');
}

// 格式化数字
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 10000) {
        return (num / 10000).toFixed(1) + 'w';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

// 安全显示笔记详情
function showPostDetailSafe(postId, encodedData) {
    try {
        const data = JSON.parse(decodeURIComponent(encodedData));
        showPostDetail(postId, data);
    } catch (error) {
        console.error('解析数据失败:', error);
        alert('显示详情失败，数据格式错误');
    }
}

// 显示笔记详情
function showPostDetail(postId, postData) {
    const data = typeof postData === 'string' ? JSON.parse(postData) : postData;
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-bold">📝 笔记详情</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                        <i class="fas fa-times text-xl"></i>
                    </button>
                </div>
                
                <div class="space-y-4">
                    <!-- 基本信息 -->
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-semibold mb-2">📋 基本信息</h4>
                        <div class="grid md:grid-cols-2 gap-4">
                            <div><span class="text-gray-600">标题：</span>${data.title || '无标题'}</div>
                            <div><span class="text-gray-600">作者：</span>${data.author?.nickname || data.author || '未知作者'}</div>
                            <div><span class="text-gray-600">发布时间：</span>${data.publishTime || '未知时间'}</div>
                            <div><span class="text-gray-600">来源：</span>${data.source || 'Unknown'}</div>
                            <div><span class="text-gray-600">数据状态：</span><span class="${data.isDemo === false ? 'text-green-600' : 'text-yellow-600'}">${data.isDemo === false ? '🔥 真实数据' : '⚠️ 演示数据'}</span></div>
                        </div>
                    </div>
                    
                    <!-- 完整内容 -->
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-semibold mb-2">📄 完整内容</h4>
                        <div class="text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto border rounded p-3 bg-white">
                            ${data.content || '无内容'}
                        </div>
                    </div>
                    
                    <!-- 数据统计 -->
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-semibold mb-2">📊 数据统计</h4>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="text-center bg-white rounded p-3">
                                <div class="text-xl font-bold text-red-500">${formatNumber(data.stats?.likes || data.likes || 0)}</div>
                                <div class="text-sm text-gray-600">点赞</div>
                            </div>
                            <div class="text-center bg-white rounded p-3">
                                <div class="text-xl font-bold text-blue-500">${formatNumber(data.stats?.comments || data.comments || 0)}</div>
                                <div class="text-sm text-gray-600">评论</div>
                            </div>
                            <div class="text-center bg-white rounded p-3">
                                <div class="text-xl font-bold text-green-500">${formatNumber(data.stats?.shares || data.shares || 0)}</div>
                                <div class="text-sm text-gray-600">分享</div>
                            </div>
                            <div class="text-center bg-white rounded p-3">
                                <div class="text-xl font-bold text-yellow-500">${formatNumber(data.stats?.collects || data.collects || 0)}</div>
                                <div class="text-sm text-gray-600">收藏</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 标签 -->
                    ${data.tags && data.tags.length > 0 ? `
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-semibold mb-2">🏷️ 标签</h4>
                        <div class="flex flex-wrap gap-2">
                            ${data.tags.map(tag => `<span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">${tag}</span>`).join('')}
                        </div>
                    </div>
                    ` : ''}
                    
                    <!-- 原始链接 -->
                    <div class="bg-gray-50 rounded-lg p-4">
                        <h4 class="font-semibold mb-2">🔗 原始链接</h4>
                        <a href="${data.url || '#'}" target="_blank" class="text-blue-500 hover:text-blue-700 break-all">
                            ${data.url || '无链接'}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// 安全保存到知识库
async function saveToKnowledgeBaseSafe(postId, encodedData) {
    try {
        const data = JSON.parse(decodeURIComponent(encodedData));
        await saveToKnowledgeBase(postId, data);
    } catch (error) {
        console.error('解析数据失败:', error);
        alert('保存失败，数据格式错误');
    }
}

// 保存到知识库
async function saveToKnowledgeBase(postId, postData) {
    const data = typeof postData === 'string' ? JSON.parse(postData) : postData;
    
    try {
        const response = await fetch('/api/knowledge-base/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: 'xiaohongshu-post',
                title: data.title || '小红书笔记',
                content: data.content,
                metadata: {
                    author: data.author?.nickname || data.author || '未知作者',
                    publishTime: data.publishTime,
                    url: data.url,
                    stats: data.stats || {
                        likes: data.likes || 0,
                        comments: data.comments || 0,
                        shares: data.shares || 0,
                        collects: data.collects || 0
                    },
                    tags: data.tags || [],
                    source: data.source || 'XHSCrawler'
                }
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ 成功保存到知识库！');
        } else {
            alert('❌ 保存失败：' + (result.message || '未知错误'));
        }
    } catch (error) {
        console.error('保存到知识库失败:', error);
        alert('❌ 保存失败：网络错误');
    }
}

// 爬取小红书帖子
async function crawlPost() {
    const url = document.getElementById('crawl-url').value.trim();
    
    if (!url) {
        alert('请输入小红书链接');
        return;
    }
    
    if (!url.includes('xiaohongshu.com')) {
        alert('请输入有效的小红书链接');
        return;
    }
    
    showLoading('crawl');
    
    try {
        const response = await fetch('/api/fetch-xhs-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, maxCount: 1 })
        });
        
        const result = await response.json();
        console.log('🔍 完整API返回:', result);
        
        if (result.success && result.data && result.data.posts && result.data.posts.length > 0) {
            const data = result.data.posts[0];
            console.log('📝 提取的帖子数据:', data);
            const resultHtml = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-check-circle text-green-500 mr-2"></i>
                        <h4 class="text-green-800 font-medium">抓取成功</h4>
                        <span class="ml-auto px-3 py-1 text-xs rounded-full ${data.isDemo === false ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                            ${data.isDemo === false ? '🔥 真实数据' : '📋 演示数据'}
                        </span>
                    </div>
                    
                    <div class="space-y-4">
                        <!-- 基本信息 -->
                        <div class="bg-white rounded-lg p-4">
                            <h5 class="font-semibold mb-2">📝 帖子信息</h5>
                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <span class="text-gray-600">标题：</span>
                                    <span class="font-medium">${data.title || '无标题'}</span>
                                </div>
                                <div>
                                    <span class="text-gray-600">作者：</span>
                                    <span class="font-medium">${typeof data.author === 'object' ? (data.author?.nickname || '未知作者') : (data.author || '未知作者')}</span>
                                </div>
                                <div>
                                    <span class="text-gray-600">发布时间：</span>
                                    <span>${data.publishTime || '未知时间'}</span>
                                </div>
                                <div>
                                    <span class="text-gray-600">数据来源：</span>
                                    <span class="text-xs bg-gray-100 px-2 py-1 rounded">${data.source || 'Unknown'}</span>
                                </div>
                                <div>
                                    <span class="text-gray-600">数据状态：</span>
                                    <span class="${data.isDemo === false ? 'text-green-600 font-medium' : 'text-yellow-600'}">${data.isDemo === false ? '🔥 真实数据' : '📋 演示数据'}</span>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 内容 -->
                        <div class="bg-white rounded-lg p-4">
                            <h5 class="font-semibold mb-2">📄 内容</h5>
                            <div class="text-gray-700 whitespace-pre-wrap max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
                                ${data.content && data.content !== 'undefined' && data.content.trim() && data.content !== 'null' ? data.content : '暂未获取到详细内容'}
                            </div>
                        </div>
                        
                        <!-- 数据表现 -->
                        <div class="bg-white rounded-lg p-4">
                            <h5 class="font-semibold mb-2">📊 数据表现</h5>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-red-500">${formatNumber(data.stats?.likes || data.likes || 0)}</div>
                                    <div class="text-sm text-gray-600">点赞</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-yellow-500">${formatNumber(data.stats?.collects || data.collects || 0)}</div>
                                    <div class="text-sm text-gray-600">收藏</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-blue-500">${formatNumber(data.stats?.comments || data.comments || 0)}</div>
                                    <div class="text-sm text-gray-600">评论</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-2xl font-bold text-green-500">${formatNumber(data.stats?.shares || data.shares || 0)}</div>
                                    <div class="text-sm text-gray-600">分享</div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- 标签 -->
                        ${data.tags && data.tags.length > 0 ? `
                        <div class="bg-white rounded-lg p-4">
                            <h5 class="font-semibold mb-2">🏷️ 标签</h5>
                            <div class="flex flex-wrap gap-2">
                                ${data.tags.map(tag => `<span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">${tag}</span>`).join('')}
                            </div>
                        </div>
                        ` : ''}
                        
                        <!-- 操作按钮 -->
                        <div class="flex gap-2 pt-4">
                            <button onclick="analyzeFromCrawl('${url}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-chart-line mr-1"></i> 分析爆火原因
                            </button>
                            <button onclick="generateFromCrawl('${url}')" class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-magic mr-1"></i> 生成新内容
                            </button>
                        </div>
                    </div>
                </div>
            `;
            showResult('crawl', resultHtml);
        } else {
            showError('crawl', result.message);
        }
    } catch (error) {
        console.error('爬取失败:', error);
        showError('crawl', '网络错误，请稍后重试');
    }
}

// 分析小红书帖子
async function analyzePost() {
    const url = document.getElementById('analyze-url').value.trim();
    const model = document.getElementById('analyze-model').value;
    const showThinking = document.getElementById('analyze-thinking').checked;
    
    if (!url) {
        alert('请输入小红书链接');
        return;
    }
    
    if (!url.includes('xiaohongshu.com')) {
        alert('请输入有效的小红书链接');
        return;
    }
    
    showLoading('analyze');
    
    try {
        const response = await fetch('/api/xiaohongshu/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, model, showThinking })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            const resultHtml = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-check-circle text-green-500 mr-2"></i>
                        <h4 class="text-green-800 font-medium">分析完成</h4>
                    </div>
                    
                    <div class="space-y-4">
                        <!-- 帖子概览 -->
                        <div class="bg-white rounded-lg p-4">
                            <h5 class="font-semibold mb-2">📝 帖子概览</h5>
                            <div class="text-sm text-gray-600 mb-2">
                                标题：${data.postInfo.title} | 
                                点赞：${formatNumber(data.postInfo.stats.likeCount)} | 
                                收藏：${formatNumber(data.postInfo.stats.collectCount)} | 
                                评论：${formatNumber(data.postInfo.stats.commentCount)}
                            </div>
                        </div>
                        
                        <!-- AI分析结果 -->
                        <div class="bg-white rounded-lg p-4">
                            <h5 class="font-semibold mb-2">🧠 AI分析结果</h5>
                            <div class="prose max-w-none">
                                ${showThinking && data.analysis.thinking ? `
                                <div class="bg-gray-50 p-3 rounded mb-4">
                                    <h6 class="font-medium text-gray-700 mb-2">💭 AI思考过程</h6>
                                    <div class="text-sm text-gray-600 whitespace-pre-wrap">${data.analysis.thinking}</div>
                                </div>
                                ` : ''}
                                <div class="text-gray-700 whitespace-pre-wrap">${data.analysis.content || data.analysis}</div>
                            </div>
                        </div>
                        
                        <!-- 操作按钮 -->
                        <div class="flex gap-2 pt-4">
                            <button onclick="generateFromAnalyze('${url}')" class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-magic mr-1"></i> 基于分析生成内容
                            </button>
                        </div>
                    </div>
                </div>
            `;
            showResult('analyze', resultHtml);
        } else {
            showError('analyze', result.message);
        }
    } catch (error) {
        console.error('分析失败:', error);
        showError('analyze', '网络错误，请稍后重试');
    }
}

// 生成内容
async function generateContent() {
    const url = document.getElementById('generate-url').value.trim();
    const userBackground = document.getElementById('generate-background').value.trim();
    const contentType = document.getElementById('generate-type').value;
    const model = document.getElementById('generate-model').value;
    const showThinking = document.getElementById('generate-thinking').checked;
    
    if (!url) {
        alert('请输入参考帖子链接');
        return;
    }
    
    if (!url.includes('xiaohongshu.com')) {
        alert('请输入有效的小红书链接');
        return;
    }
    
    if (!userBackground) {
        alert('请填写个人背景信息');
        return;
    }
    
    showLoading('generate');
    
    try {
        const response = await fetch('/api/xiaohongshu/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                url, 
                userBackground, 
                contentType, 
                model, 
                showThinking 
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            const data = result.data;
            const contentTypeNames = {
                'all': '完整内容包',
                'script': '视频脚本',
                'post': '图文文案',
                'title': '标题',
                'cover': '封面文字',
                'tags': '相关标签'
            };
            
            const resultHtml = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div class="flex items-center mb-4">
                        <i class="fas fa-check-circle text-green-500 mr-2"></i>
                        <h4 class="text-green-800 font-medium">内容生成完成</h4>
                    </div>
                    
                    <div class="space-y-4">
                        <!-- 生成信息 -->
                        <div class="bg-white rounded-lg p-4">
                            <h5 class="font-semibold mb-2">ℹ️ 生成信息</h5>
                            <div class="text-sm text-gray-600">
                                参考帖子：${data.originalPost.title} | 
                                生成类型：${contentTypeNames[data.contentType]} | 
                                AI模型：${model.toUpperCase()}
                            </div>
                        </div>
                        
                        <!-- 生成的内容 -->
                        <div class="bg-white rounded-lg p-4">
                            <h5 class="font-semibold mb-2">✨ 生成的内容</h5>
                            ${showThinking && data.generatedContent.thinking ? `
                            <div class="bg-gray-50 p-3 rounded mb-4">
                                <h6 class="font-medium text-gray-700 mb-2">💭 AI思考过程</h6>
                                <div class="text-sm text-gray-600 whitespace-pre-wrap">${data.generatedContent.thinking}</div>
                            </div>
                            ` : ''}
                            <div class="prose max-w-none">
                                <div class="text-gray-700 whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">${data.generatedContent.content || data.generatedContent}</div>
                            </div>
                        </div>
                        
                        <!-- 原始参考 -->
                        <div class="bg-white rounded-lg p-4">
                            <h5 class="font-semibold mb-2">📖 原始参考帖子</h5>
                            <div class="text-sm text-gray-600 mb-2">
                                <strong>标题：</strong>${data.originalPost.title}<br>
                                <strong>数据：</strong>点赞${formatNumber(data.originalPost.stats.likeCount)} 收藏${formatNumber(data.originalPost.stats.collectCount)} 评论${formatNumber(data.originalPost.stats.commentCount)}
                            </div>
                            <details class="mt-2">
                                <summary class="cursor-pointer text-blue-600 hover:text-blue-800">查看原始内容</summary>
                                <div class="mt-2 p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">${data.originalPost.content}</div>
                            </details>
                        </div>
                        
                        <!-- 操作按钮 -->
                        <div class="flex gap-2 pt-4">
                            <button onclick="copyToClipboard(this)" data-content="${escapeHtml(data.generatedContent.content || data.generatedContent)}" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-copy mr-1"></i> 复制内容
                            </button>
                            <button onclick="regenerateContent('${url}', '${escapeHtml(userBackground)}', '${contentType}', '${model}')" class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm">
                                <i class="fas fa-redo mr-1"></i> 重新生成
                            </button>
                        </div>
                    </div>
                </div>
            `;
            showResult('generate', resultHtml);
        } else {
            showError('generate', result.message);
        }
    } catch (error) {
        console.error('生成失败:', error);
        showError('generate', '网络错误，请稍后重试');
    }
}

// 从爬取结果跳转到分析
function analyzeFromCrawl(url) {
    document.getElementById('analyze-url').value = url;
    showSection('analyze');
}

// 从爬取结果跳转到生成
function generateFromCrawl(url) {
    document.getElementById('generate-url').value = url;
    showSection('generate');
}

// 从分析结果跳转到生成
function generateFromAnalyze(url) {
    document.getElementById('generate-url').value = url;
    showSection('generate');
}

// 复制到剪贴板
async function copyToClipboard(button) {
    const content = button.getAttribute('data-content');
    try {
        await navigator.clipboard.writeText(content);
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check mr-1"></i> 已复制';
        button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        button.classList.add('bg-green-500');
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.classList.remove('bg-green-500');
            button.classList.add('bg-blue-500', 'hover:bg-blue-600');
        }, 2000);
    } catch (err) {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制');
    }
}

// 重新生成内容
function regenerateContent(url, userBackground, contentType, model) {
    document.getElementById('generate-url').value = url;
    document.getElementById('generate-background').value = unescapeHtml(userBackground);
    document.getElementById('generate-type').value = contentType;
    document.getElementById('generate-model').value = model;
    generateContent();
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// HTML反转义
function unescapeHtml(text) {
    const div = document.createElement('div');
    div.innerHTML = text;
    return div.textContent;
}

// 页面加载完成后显示第一个功能区域
document.addEventListener('DOMContentLoaded', function() {
    showSection('crawl');
});