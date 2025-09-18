let analysisResult = null;
let selectedPosts = [];
let fetchedContent = [];

$(document).ready(function() {
    console.log('小红书内容分析助手已加载');
    
    // 初始化UI和事件
    initializeApp();
});

function initializeApp() {
    // 检查用户登录状态
    checkAuthStatus();
    
    // 检查爬虫模式
    checkCrawlerMode();
    
    // 绑定所有UI事件
    bindUIEvents();
    
    // 加载用量统计
    loadUsageStats();
    
    // 默认显示链接模式
    switchMode('link');
}

// 绑定UI事件
function bindUIEvents() {
    // 功能模块选择
    $('#archive-module').click(() => showArchiveInterface());
    $('#archive-module-btn').click(() => showArchiveInterface());
    $('#rewrite-module').click(() => showRewriteInterface());
    $('#video-transcribe-module').click(() => showVideoTranscribeInterface());
    
    // 返回主界面
    $('#back-to-main').click(() => showMainInterface());
    $('#back-to-main-2').click(() => showMainInterface());
    $('#back-to-main-3').click(() => showMainInterface());
    
    // 模式切换
    $('#link-mode, #archive-link-mode').click(() => switchMode('link'));
    $('#text-mode, #archive-text-mode').click(() => switchMode('text'));
    
    // 获取内容
    $('#fetch-content-button').click(fetchXhsContent);
    
    // 操作选择
    $('#analyze-content').click(() => selectAction('analyze'));
    $('#generate-similar').click(() => selectAction('generate'));
    
    // 启动分析/仿写
    $('#start-rewrite').click(startRewrite);
    
    // 知识库管理
    $('#save-to-kb').click(saveToKnowledgeBase);
    
    // 模式切换按钮
    $('#toggle-mode-btn').click(toggleCrawlerMode);
    
    // AI改写相关事件
    $('#content-type-image').click(() => selectContentType('image'));
    $('#content-type-video').click(() => selectContentType('video'));
    $('#start-ai-rewrite').click(startAIRewrite);
    
    // 视频转文字相关事件
    $('#start-video-transcribe').click(startVideoTranscribe);
    
    // 旧的事件（保持兼容）
    $('#analyze-button').click(analyzeContent);
    $('#generate-button').click(generateNotes);
    $('#logout-button').click(logout);
}

// 模式切换
function switchMode(mode) {
    if (mode === 'link') {
        $('#link-mode').removeClass('bg-gray-200 text-gray-700').addClass('bg-blue-500 text-white');
        $('#text-mode').removeClass('bg-blue-500 text-white').addClass('bg-gray-200 text-gray-700');
        $('#link-input-section').removeClass('hidden');
        $('#text-input-section').addClass('hidden');
    } else {
        $('#text-mode').removeClass('bg-gray-200 text-gray-700').addClass('bg-blue-500 text-white');
        $('#link-mode').removeClass('bg-blue-500 text-white').addClass('bg-gray-200 text-gray-700');
        $('#text-input-section').removeClass('hidden');
        $('#link-input-section').addClass('hidden');
    }
    
    // 隐藏相关区域
    $('#fetched-content-section, #knowledge-base-section, #action-selection').addClass('hidden');
}

// 获取小红书内容
async function fetchXhsContent() {
    const xhsLink = $('#xhsLink').val().trim();
    
    if (!xhsLink) {
        showAlert('请输入小红书链接', 'warning');
        return;
    }
    
    // 验证链接格式
    if (!isValidXhsLink(xhsLink)) {
        showAlert('请输入有效的小红书链接', 'warning');
        return;
    }
    
    showLoading('正在获取内容...');
    $('#fetch-content-button').prop('disabled', true);
    
    try {
        const response = await fetch('/api/fetch-xhs-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: xhsLink })
        });
        
        const data = await response.json();
        
        if (data.success) {
            fetchedContent = data.data.posts || [data.data];
            displayFetchedContent(fetchedContent);
            
            // 检查是否为模拟数据
            if (data.data.isMockData) {
                showAlert('📝 当前为演示模式，显示的是模拟数据，非真实小红书内容', 'warning');
            } else {
                showAlert('内容获取成功！', 'success');
            }
        } else {
            showAlert(data.message || '获取内容失败', 'error');
        }
    } catch (error) {
        console.error('获取内容错误:', error);
        showAlert('网络请求失败: ' + error.message, 'error');
    } finally {
        hideLoading();
        $('#fetch-content-button').prop('disabled', false);
    }
}

// 显示获取到的内容
function displayFetchedContent(posts) {
    const container = $('#fetched-posts');
    
    // 检查是否为演示数据
    const isDemo = posts.length > 0 && posts[0].isDemo;
    
    // 如果是演示数据，添加警告横幅
    let demoWarning = '';
    if (isDemo) {
        demoWarning = `
            <div class="bg-orange-100 border-l-4 border-orange-400 p-4 mb-4 rounded">
                <div class="flex">
                    <div class="flex-shrink-0">
                        <span class="text-orange-400 text-lg">⚠️</span>
                    </div>
                    <div class="ml-3">
                        <p class="text-sm text-orange-700">
                            <strong>演示模式：</strong>当前显示的是模拟数据，用于功能演示。
                            真实爬虫功能需要额外配置和部署。
                        </p>
                    </div>
                </div>
            </div>
        `;
    }
    
    const html = posts.map((post, index) => {
        return `
            <div class="border ${isDemo ? 'border-orange-200 bg-orange-50' : 'border-gray-200'} rounded-lg p-4 hover:shadow-md transition-shadow">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex items-center space-x-3">
                        <input type="checkbox" class="post-checkbox" data-index="${index}" checked>
                        <div>
                            <h5 class="font-semibold text-gray-800">
                                ${isDemo ? '🎭 ' : ''}${post.title || '未命名笔记'}
                                ${isDemo ? '<span class="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded ml-2">演示</span>' : ''}
                            </h5>
                            <p class="text-sm text-gray-500">字数: ${(post.content || '').length}</p>
                        </div>
                    </div>
                    <div class="text-xs text-gray-400">
                        ${post.publishTime || '未知时间'}
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded p-3 mb-3">
                    <p class="text-sm text-gray-700 line-clamp-3">
                        ${(post.content || '').substring(0, 150)}${(post.content || '').length > 150 ? '...' : ''}
                    </p>
                </div>
                
                ${post.images && post.images.length > 0 ? `
                    <div class="flex space-x-2 mb-3">
                        ${post.images.slice(0, 3).map(img => `
                            <img src="${img}" class="w-16 h-16 object-cover rounded" alt="笔记图片">
                        `).join('')}
                        ${post.images.length > 3 ? `<div class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">+${post.images.length - 3}</div>` : ''}
                    </div>
                ` : ''}
                
                <div class="flex justify-between items-center text-xs text-gray-500">
                    <span>👍 ${post.likes || 0} · 💬 ${post.comments || 0} · 📤 ${post.shares || 0}</span>
                    <span>热度: ${post.popularity || 'N/A'}</span>
                </div>
            </div>
        `;
    }).join('');
    
    container.html(demoWarning + html);
    
    // 绑定复选框事件
    $('.post-checkbox').change(updateSelectedPosts);
    
    // 显示相关区域
    $('#fetched-content-section').removeClass('hidden');
    $('#knowledge-base-section').removeClass('hidden');
    $('#action-selection').removeClass('hidden');
    
    // 滚动到内容区域
    setTimeout(() => {
        $('#fetched-content-section')[0].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

// 更新选中的帖子
function updateSelectedPosts() {
    selectedPosts = [];
    $('.post-checkbox:checked').each(function() {
        const index = $(this).data('index');
        selectedPosts.push(fetchedContent[index]);
    });
    
    console.log('选中的帖子数量:', selectedPosts.length);
}

// 操作选择
function selectAction(action) {
    if (selectedPosts.length === 0) {
        showAlert('请先选择要处理的内容', 'warning');
        return;
    }
    
    if (action === 'analyze') {
        $('#analyze-content').addClass('bg-purple-600').removeClass('bg-purple-500');
        $('#generate-similar').removeClass('bg-pink-600').addClass('bg-pink-500');
        $('#rewrite-params').addClass('hidden');
        
        // 直接开始分析
        setTimeout(startAnalysis, 300);
    } else {
        $('#generate-similar').addClass('bg-pink-600').removeClass('bg-pink-500');
        $('#analyze-content').removeClass('bg-purple-600').addClass('bg-purple-500');
        $('#rewrite-params').removeClass('hidden');
    }
}

// 开始分析
async function startAnalysis() {
    if (selectedPosts.length === 0) {
        showAlert('请先选择要分析的内容', 'warning');
        return;
    }
    
    showLoading('正在拆解分析...');
    
    try {
        const content = selectedPosts.map(post => 
            `标题：${post.title || '未命名'}\n内容：${post.content || ''}`
        ).join('\n\n---\n\n');
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content: content,
                model: 'claude',
                showThinking: true,
                useDeepAnalysis: true
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            analysisResult = data.data.content;
            displayAnalysisResult(data.data.content);
            showAlert('拆解分析完成！', 'success');
        } else {
            showAlert(data.message || '分析失败', 'error');
        }
    } catch (error) {
        console.error('分析错误:', error);
        showAlert('分析请求失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 开始仿写
async function startRewrite() {
    if (selectedPosts.length === 0) {
        showAlert('请先选择要仿写的内容', 'warning');
        return;
    }
    
    const theme = $('#theme').val().trim();
    const keywords = $('#keywords').val().trim();
    
    if (!theme) {
        showAlert('请输入仿写主题', 'warning');
        return;
    }
    
    showLoading('正在生成仿写内容...');
    
    try {
        const originalContent = selectedPosts.map(post => 
            `标题：${post.title || '未命名'}\n内容：${post.content || ''}`
        ).join('\n\n---\n\n');
        
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                originalContent: originalContent,
                newTopic: theme,
                keywords: keywords,
                model: 'claude',
                showThinking: true,
                useDeepAnalysis: true
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayGeneratedNotes(data.data.content);
            showAlert('仿写内容生成完成！', 'success');
        } else {
            showAlert(data.message || '生成失败', 'error');
        }
    } catch (error) {
        console.error('生成错误:', error);
        showAlert('生成请求失败: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// 保存到知识库
async function saveToKnowledgeBase() {
    if (selectedPosts.length === 0) {
        showAlert('请先选择要保存的内容', 'warning');
        return;
    }
    
    const folderName = $('#new-folder').val().trim() || $('#folder-select').val() || 'default';
    
    try {
        const response = await fetch('/api/knowledge-base/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                posts: selectedPosts,
                folder: folderName
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert(`已保存${selectedPosts.length}篇内容到【${folderName}】文件夹`, 'success');
            
            // 更新文件夹列表
            if (folderName !== 'default' && $('#folder-select option[value="' + folderName + '"]').length === 0) {
                $('#folder-select').append(`<option value="${folderName}">${folderName}</option>`);
            }
            
            // 清空输入框
            $('#new-folder').val('');
        } else {
            showAlert(data.message || '保存失败', 'error');
        }
    } catch (error) {
        console.error('保存错误:', error);
        showAlert('保存请求失败: ' + error.message, 'error');
    }
}

// 验证小红书链接
function isValidXhsLink(url) {
    const patterns = [
        /^https?:\/\/(www\.)?xiaohongshu\.com\/user\/profile\/[a-zA-Z0-9]+/,
        /^https?:\/\/(www\.)?xiaohongshu\.com\/explore\/[a-zA-Z0-9]+/,
        /^https?:\/\/(www\.)?xiaohongshu\.com\/discovery\/item\/[a-zA-Z0-9]+/,
        /^https?:\/\/xhslink\.com\/[a-zA-Z0-9]+/
    ];
    
    return patterns.some(pattern => pattern.test(url));
}

// 检查认证状态（保持原有功能）
function checkAuthStatus() {
    // 免登录模式：直接显示为已登录状态
    $('#user-info').removeClass('hidden');
    $('#auth-buttons').addClass('hidden');
    $('#user-username').text('免登录用户');
    $('#user-credits').text('无限制使用');
    console.log('免登录模式已启用');
}

// 兼容原有函数
function analyzeContent() {
    const content = $('#originalNote').val().trim();
    if (!content) {
        showAlert('请输入要分析的内容', 'warning');
        return;
    }
    
    selectedPosts = [{ title: '手动输入', content: content }];
    startAnalysis();
}

function generateNotes() {
    const content = $('#originalNote').val().trim();
    const theme = $('#theme').val().trim();
    const keywords = $('#keywords').val().trim();
    
    if (!content || !theme) {
        showAlert('请填写完整信息', 'warning');
        return;
    }
    
    selectedPosts = [{ title: '手动输入', content: content }];
    startRewrite();
}

function logout() {
    showAlert('当前为免登录模式', 'info');
}

function loadUsageStats() {
    console.log('用量统计功能已加载');
}

// 检查爬虫模式
async function checkCrawlerMode() {
    try {
        const response = await fetch('/api/crawler-mode');
        const data = await response.json();
        
        if (data.success) {
            updateModeUI(data.mode);
        }
    } catch (error) {
        console.error('检查爬虫模式失败:', error);
        // 默认显示模拟模式
        updateModeUI('mock');
    }
}

// 更新模式UI
function updateModeUI(mode) {
    const banner = $('#crawler-mode-banner');
    const icon = $('#mode-icon');
    const title = $('#mode-title');
    const description = $('#mode-description');
    const toggleBtn = $('#toggle-mode-btn');
    
    if (mode === 'real') {
        // 真实爬虫模式
        banner.removeClass().addClass('bg-gradient-to-r from-green-100 to-blue-100 border border-green-300 rounded-lg p-4 mb-4');
        icon.text('🔥');
        title.text('真实爬虫模式').removeClass().addClass('text-lg font-medium text-green-800');
        description.text('当前使用MediaCrawler获取真实小红书数据，AI分析更加精准').removeClass().addClass('text-sm text-green-700');
        toggleBtn.text('切换到演示模式').removeClass().addClass('bg-green-500 hover:bg-green-600 text-white px-4 py-2 text-sm rounded-lg font-medium transition-all hover:transform hover:scale-105');
    } else {
        // 模拟数据模式
        banner.removeClass().addClass('bg-gradient-to-r from-orange-100 to-yellow-100 border border-orange-300 rounded-lg p-4 mb-4');
        icon.text('🎭');
        title.text('演示体验模式').removeClass().addClass('text-lg font-medium text-orange-800');
        description.text('当前为功能演示版本，内容获取功能使用模拟数据，AI分析功能正常使用').removeClass().addClass('text-sm text-orange-700');
        toggleBtn.text('切换到真实模式').removeClass().addClass('bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 text-sm rounded-lg font-medium transition-all hover:transform hover:scale-105');
    }
}

// 切换爬虫模式
async function toggleCrawlerMode() {
    const toggleBtn = $('#toggle-mode-btn');
    const originalText = toggleBtn.text();
    
    toggleBtn.text('切换中...').prop('disabled', true);
    
    try {
        const response = await fetch('/api/toggle-crawler-mode', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            updateModeUI(data.mode);
            showAlert(`已切换到${data.mode === 'real' ? '真实爬虫' : '演示'}模式`, 'success');
            
            // 提示重启服务器
            if (data.needRestart) {
                showAlert('模式切换成功！请重启服务器使配置生效', 'warning');
            }
        } else {
            showAlert(data.message || '模式切换失败', 'error');
        }
    } catch (error) {
        console.error('切换模式失败:', error);
        showAlert('网络错误，模式切换失败', 'error');
    } finally {
        toggleBtn.text(originalText).prop('disabled', false);
    }
}

// 显示分析结果（复用原有函数）
function displayAnalysisResult(content) {
    try {
        const formattedContent = marked.parse(content);
        $('#analysisContent').html(formattedContent);
    } catch (error) {
        $('#analysisContent').html(content.replace(/\n/g, '<br>'));
    }
    
    $('#analysisSection').removeClass('hidden');
    
    setTimeout(() => {
        $('#analysisSection')[0].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

// 显示生成笔记（复用原有函数）
function displayGeneratedNotes(content) {
    const notesContainer = $('#generatedNotes');
    
    notesContainer.html(`
        <div class="bg-white rounded-2xl card-shadow p-8 mb-8">
            <div class="flex items-center justify-between mb-6">
                <h3 class="text-2xl font-bold text-gray-900">生成的仿写内容</h3>
                <button onclick="copyToClipboard(\`${content.replace(/`/g, '\\`')}\`)" 
                        class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200">
                    📋 复制全部
                </button>
            </div>
            <div class="bg-gray-50 rounded-xl p-6">
                <div class="text-gray-700 whitespace-pre-wrap leading-relaxed">${content}</div>
            </div>
        </div>
    `);
    
    $('#notesSection').removeClass('hidden');
    
    setTimeout(() => {
        $('#notesSection')[0].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

// 工具函数
function showAlert(message, type = 'info') {
    const alertId = 'alert-' + Date.now();
    const icons = {
        info: '💡',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    };
    
    const alert = $(`
        <div id="${alertId}" class="alert-notification p-4 rounded-xl shadow-lg border-l-4 mb-3 transform translate-x-full opacity-0 transition-all duration-300">
            <div class="flex items-center">
                <span class="text-lg mr-3">${icons[type]}</span>
                <span class="font-medium">${message}</span>
            </div>
        </div>
    `);
    
    const typeClasses = {
        info: 'bg-blue-50 border-blue-400 text-blue-800',
        success: 'bg-green-50 border-green-400 text-green-800',
        warning: 'bg-yellow-50 border-yellow-400 text-yellow-800',
        error: 'bg-red-50 border-red-400 text-red-800'
    };
    
    alert.addClass(typeClasses[type]);
    $('#alert-container').append(alert);
    
    setTimeout(() => {
        alert.removeClass('translate-x-full opacity-0');
    }, 100);
    
    setTimeout(() => {
        alert.addClass('translate-x-full opacity-0');
        setTimeout(() => alert.remove(), 300);
    }, 4000);
}

function showLoading(message = '正在处理...') {
    $('#analysisLoading p').first().text(message);
    $('#analysisLoading').removeClass('hidden');
}

function hideLoading() {
    $('#analysisLoading').addClass('hidden');
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert('已复制到剪贴板！', 'success');
        }).catch(() => {
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showAlert('已复制到剪贴板！', 'success');
    } catch (err) {
        showAlert('复制失败，请手动复制', 'error');
    }
    
    document.body.removeChild(textArea);
}

// ===== 新增功能函数 =====

// 显示主界面
function showMainInterface() {
    $('.bg-white.rounded-2xl.card-shadow').addClass('hidden');
    $('#archive-interface').addClass('hidden');
    $('#rewrite-interface').addClass('hidden');
    $('#video-transcribe-interface').addClass('hidden');
    $('#analysisSection').addClass('hidden');
    $('#notesSection').addClass('hidden');
    $('.grid.md\\:grid-cols-3.gap-8.mb-12').removeClass('hidden');
}

// 显示爬虫存档界面
function showArchiveInterface() {
    $('.grid.md\\:grid-cols-3.gap-8.mb-12').addClass('hidden');
    $('#rewrite-interface').addClass('hidden');
    $('#video-transcribe-interface').addClass('hidden');
    $('#archive-interface').removeClass('hidden');
    
    // 初始化爬虫存档界面
    switchMode('link');
}

// 显示AI改写界面
function showRewriteInterface() {
    $('.grid.md\\:grid-cols-3.gap-8.mb-12').addClass('hidden');
    $('#archive-interface').addClass('hidden');
    $('#video-transcribe-interface').addClass('hidden');
    $('#rewrite-interface').removeClass('hidden');
    
    // 默认选择图文内容
    selectContentType('image');
}

// 显示视频转文字界面
function showVideoTranscribeInterface() {
    $('.grid.md\\:grid-cols-3.gap-8.mb-12').addClass('hidden');
    $('#archive-interface').addClass('hidden');
    $('#rewrite-interface').addClass('hidden');
    $('#video-transcribe-interface').removeClass('hidden');
}

// 选择内容类型
function selectContentType(type) {
    // 重置所有按钮样式
    $('#content-type-image, #content-type-video').removeClass('border-purple-500 bg-purple-50');
    $('#content-type-image, #content-type-video').addClass('border-gray-200');
    
    // 设置选中状态
    if (type === 'image') {
        $('#content-type-image').removeClass('border-gray-200').addClass('border-purple-500 bg-purple-50');
    } else {
        $('#content-type-video').removeClass('border-gray-200').addClass('border-purple-500 bg-purple-50');
    }
    
    // 保存选择的类型
    window.selectedContentType = type;
}

// 启动AI改写
function startAIRewrite() {
    const topicIdeas = $('#topic-ideas').val().trim();
    const referenceContent = $('#reference-content').val().trim();
    const targetKeywords = $('#target-keywords').val().trim();
    const targetAudience = $('#target-audience').val().trim();
    const toneStyle = $('#tone-style').val();
    const contentLength = $('#content-length').val();
    const generateCount = $('#generate-count').val();
    const contentType = window.selectedContentType || 'image';
    
    // 验证必填字段
    if (!topicIdeas) {
        showAlert('请输入您的选题思路', 'error');
        $('#topic-ideas').focus();
        return;
    }
    
    // 禁用按钮，显示加载状态
    $('#start-ai-rewrite').prop('disabled', true).html('🚀 AI创作中...');
    
    // 准备请求数据
    const requestData = {
        topicIdeas: topicIdeas,
        referenceContent: referenceContent,
        targetKeywords: targetKeywords,
        targetAudience: targetAudience,
        toneStyle: toneStyle,
        contentLength: contentLength,
        generateCount: parseInt(generateCount),
        contentType: contentType
    };
    
    console.log('发送AI改写请求:', requestData);
    
    // 发送API请求
    $.ajax({
        url: '/api/ai-rewrite',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        data: JSON.stringify(requestData),
        success: function(response) {
            console.log('AI改写成功:', response);
            if (response.success) {
                displayAIRewriteResults(response.data);
                showAlert('AI创作完成！', 'success');
            } else {
                showAlert(response.message || 'AI创作失败', 'error');
            }
        },
        error: function(xhr, status, error) {
            console.error('AI改写请求失败:', error);
            let errorMessage = 'AI创作失败，请稍后重试';
            
            if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            }
            
            showAlert(errorMessage, 'error');
        },
        complete: function() {
            // 恢复按钮状态
            $('#start-ai-rewrite').prop('disabled', false).html('🚀 开始AI创作');
        }
    });
}

// 显示AI改写结果
function displayAIRewriteResults(results) {
    const contentType = window.selectedContentType || 'image';
    const typeLabel = contentType === 'image' ? '图文内容' : '视频脚本';
    
    // 隐藏改写界面，显示结果
    $('#rewrite-interface').addClass('hidden');
    
    // 创建结果展示区域
    let resultsHtml = `
        <div class="bg-white rounded-2xl card-shadow p-10 mb-8">
            <div class="flex items-center mb-8">
                <button id="back-to-rewrite" class="mr-4 text-2xl text-gray-600 hover:text-gray-800 transition-colors">←</button>
                <div class="step-indicator w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mr-5 text-xl">
                    ✨
                </div>
                <h3 class="text-3xl font-bold text-gray-900">AI创作结果 - ${typeLabel}</h3>
            </div>
            
            <div class="grid gap-6">
    `;
    
    results.forEach((result, index) => {
        resultsHtml += `
            <div class="bg-gray-50 rounded-xl p-6">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-xl font-bold text-gray-800">方案 ${index + 1}</h4>
                    <button class="copy-result bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm" data-content="${escapeHtml(result.content)}">
                        📋 复制
                    </button>
                </div>
                
                ${result.title ? `<div class="mb-4"><h5 class="font-semibold text-lg text-gray-700 mb-2">标题：</h5><p class="text-gray-800">${result.title}</p></div>` : ''}
                
                <div class="mb-4">
                    <h5 class="font-semibold text-lg text-gray-700 mb-2">内容：</h5>
                    <div class="whitespace-pre-line text-gray-800 leading-relaxed">${result.content}</div>
                </div>
                
                ${result.tags ? `<div class="mb-4"><h5 class="font-semibold text-lg text-gray-700 mb-2">建议标签：</h5><p class="text-gray-600">${result.tags}</p></div>` : ''}
            </div>
        `;
    });
    
    resultsHtml += `
            </div>
            
            <div class="text-center mt-8">
                <button id="rewrite-again" class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-6 rounded-xl text-lg mr-4">
                    🔄 重新创作
                </button>
                <button id="back-to-rewrite" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl text-lg">
                    ← 返回编辑
                </button>
            </div>
        </div>
    `;
    
    // 插入结果HTML
    $('#rewrite-interface').after(resultsHtml);
    
    // 绑定结果页面的事件
    $('#back-to-rewrite, #rewrite-again').click(function() {
        $(this).closest('.bg-white.rounded-2xl.card-shadow').remove();
        $('#rewrite-interface').removeClass('hidden');
    });
    
    $('.copy-result').click(function() {
        const content = $(this).data('content');
        copyToClipboard(content);
    });
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 启动视频转文字
function startVideoTranscribe() {
    const videoUrl = $('#video-url').val().trim();
    const quality = $('#transcribe-quality').val();
    const outputFormat = $('#output-format').val();
    
    // 验证必填字段
    if (!videoUrl) {
        showAlert('请输入视频链接', 'error');
        $('#video-url').focus();
        return;
    }
    
    // 简单的URL验证
    if (!videoUrl.startsWith('http')) {
        showAlert('请输入有效的视频链接', 'error');
        $('#video-url').focus();
        return;
    }
    
    // 显示进度，禁用按钮
    $('#transcribe-progress').removeClass('hidden');
    $('#start-video-transcribe').prop('disabled', true).html('🔄 转换中...');
    
    // 准备请求数据
    const requestData = {
        videoUrl: videoUrl,
        quality: quality,
        outputFormat: outputFormat
    };
    
    console.log('发送视频转文字请求:', requestData);
    
    // 发送API请求
    $.ajax({
        url: '/api/video-transcribe',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        data: JSON.stringify(requestData),
        timeout: 10 * 60 * 1000, // 10分钟超时
        success: function(response) {
            console.log('视频转文字成功:', response);
            if (response.success) {
                displayVideoTranscribeResults(response.data);
                showAlert('视频转文字完成！', 'success');
            } else {
                showAlert(response.message || '视频转文字失败', 'error');
            }
        },
        error: function(xhr, status, error) {
            console.error('视频转文字请求失败:', error);
            let errorMessage = '视频转文字失败，请稍后重试';
            
            if (xhr.status === 408) {
                errorMessage = '处理超时，请尝试较短的视频';
            } else if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            }
            
            showAlert(errorMessage, 'error');
        },
        complete: function() {
            // 恢复UI状态
            $('#transcribe-progress').addClass('hidden');
            $('#start-video-transcribe').prop('disabled', false).html('🚀 开始转换');
        }
    });
}

// 显示视频转文字结果
function displayVideoTranscribeResults(data) {
    // 隐藏转换界面，显示结果
    $('#video-transcribe-interface').addClass('hidden');
    
    // 根据输出格式选择显示内容
    const outputFormat = $('#output-format').val();
    let contentHtml = '';
    
    if (outputFormat === 'both' || outputFormat === 'text') {
        contentHtml += `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h5 class="font-semibold text-lg text-gray-700">完整文稿</h5>
                    <button class="copy-transcript bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm" data-content="${escapeHtml(data.full_text)}">
                        📋 复制文稿
                    </button>
                </div>
                <div class="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <p class="whitespace-pre-line text-gray-800 leading-relaxed">${escapeHtml(data.full_text)}</p>
                </div>
            </div>
        `;
    }
    
    if (outputFormat === 'both' || outputFormat === 'timestamped') {
        contentHtml += `
            <div class="mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h5 class="font-semibold text-lg text-gray-700">带时间戳文稿</h5>
                    <button class="copy-transcript bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm" data-content="${escapeHtml(data.timestamped_text)}">
                        📋 复制时间戳
                    </button>
                </div>
                <div class="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                    <p class="whitespace-pre-line text-gray-800 leading-relaxed font-mono text-sm">${escapeHtml(data.timestamped_text)}</p>
                </div>
            </div>
        `;
    }
    
    // 创建结果展示区域
    let resultsHtml = `
        <div class="bg-white rounded-2xl card-shadow p-10 mb-8">
            <div class="flex items-center mb-8">
                <button id="back-to-transcribe" class="mr-4 text-2xl text-gray-600 hover:text-gray-800 transition-colors">←</button>
                <div class="step-indicator w-12 h-12 rounded-full flex items-center justify-center text-white font-bold mr-5 text-xl">
                    🎬
                </div>
                <h3 class="text-3xl font-bold text-gray-900">转换结果</h3>
            </div>
            
            <!-- 视频信息 -->
            <div class="bg-blue-50 rounded-xl p-6 mb-6">
                <h4 class="text-xl font-bold text-blue-800 mb-4">视频信息</h4>
                <div class="grid md:grid-cols-3 gap-4 text-center">
                    <div>
                        <p class="text-2xl font-bold text-blue-600">${data.title || '未知标题'}</p>
                        <p class="text-sm text-blue-500">视频标题</p>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-blue-600">${Math.floor(data.duration / 60)}:${(data.duration % 60).toString().padStart(2, '0')}</p>
                        <p class="text-sm text-blue-500">视频时长</p>
                    </div>
                    <div>
                        <p class="text-2xl font-bold text-blue-600">${data.word_count}</p>
                        <p class="text-sm text-blue-500">字数统计</p>
                    </div>
                </div>
            </div>
            
            <!-- 文稿内容 -->
            ${contentHtml}
            
            <div class="text-center mt-8">
                <button id="transcribe-another" class="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl text-lg mr-4">
                    🔄 转换其他视频
                </button>
                <button id="back-to-transcribe" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl text-lg">
                    ← 返回编辑
                </button>
            </div>
        </div>
    `;
    
    // 插入结果HTML
    $('#video-transcribe-interface').after(resultsHtml);
    
    // 绑定结果页面的事件
    $('#back-to-transcribe, #transcribe-another').click(function() {
        $(this).closest('.bg-white.rounded-2xl.card-shadow').remove();
        $('#video-transcribe-interface').removeClass('hidden');
        // 清空输入框
        $('#video-url').val('');
    });
    
    $('.copy-transcript').click(function() {
        const content = $(this).data('content');
        copyToClipboard(content);
    });
}