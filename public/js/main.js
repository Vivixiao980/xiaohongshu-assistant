$(document).ready(function () {
    console.log('Main.js loaded successfully');
    
    // 测试按钮是否能找到
    console.log('分析按钮元素:', $('#analyze-button').length);
    console.log('生成按钮元素:', $('#generate-button').length);
    
    // =================================================================
    // 1. 认证和用户状态管理 (已禁用 - 免登录模式)
    // =================================================================
    function fetchUserInfo() {
        // 免登录模式：直接显示为已登录状态
        $('#user-info').removeClass('hidden');
        $('#auth-buttons').addClass('hidden');
        $('#user-username').text('免登录用户');
        $('#user-type').text('体验模式');
        $('#user-credits').text('无限制');
        
        // 启用所有功能按钮
        $('#analyze-button, #generate-button').prop('disabled', false).removeClass('opacity-50');
        console.log('按钮已启用');
        return;

        fetch('/auth/me', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                $('#user-username').text(data.user.username);
                const creditsText = data.user.userType === 'trial' 
                    ? `体验用户 - 剩余 ${data.user.credits} 次`
                    : `正式学员 - ${data.user.credits} 积分`;
                $('#user-credits').text(creditsText);
                $('#user-info').removeClass('hidden');
                $('#auth-buttons').addClass('hidden');
                // 解锁功能按钮
                $('#analyze-button, #generate-button').prop('disabled', false).removeClass('opacity-50');
            } else {
                localStorage.removeItem('token');
                $('#user-info').addClass('hidden');
                $('#auth-buttons').removeClass('hidden');
                $('#analyze-button, #generate-button').prop('disabled', true).addClass('opacity-50');
            }
        })
        .catch(error => {
            console.error('获取用户信息失败:', error);
            localStorage.removeItem('token');
            $('#user-info').addClass('hidden');
            $('#auth-buttons').removeClass('hidden');
            $('#analyze-button, #generate-button').prop('disabled', true).addClass('opacity-50');
        });
    }

    // 初始加载时检查用户信息
    fetchUserInfo();

    // 登录按钮事件绑定
    function bindLoginButton() {
        console.log('Binding login button...');
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            console.log('Login button found, binding click event');
            // 移除之前的事件监听器
            loginBtn.onclick = null;
            // 绑定新的事件
            loginBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Login button clicked - redirecting to auth page');
                window.location.href = '/auth.html';
            });
            
            // 备用方法
            loginBtn.onclick = function(e) {
                e.preventDefault();
                console.log('Login button clicked (onclick) - redirecting to auth page');
                window.location.href = '/auth.html';
                return false;
            };
        } else {
            console.log('Login button not found, will retry...');
        }
    }
    
    // 多次尝试绑定登录按钮
    bindLoginButton();
    setTimeout(bindLoginButton, 100);
    setTimeout(bindLoginButton, 500);
    setTimeout(bindLoginButton, 1000);

    // 退出登录
    $('#logout-button').on('click', function() {
        if (confirm('确定要退出登录吗？')) {
            localStorage.removeItem('token');
            fetchUserInfo();
            showAlert('您已成功退出登录', 'info');
            // 清空页面状态
            $('#analysisSection, #notesSection').addClass('hidden');
            $('#originalNote, #theme, #keywords').val('');
        }
    });

    // =================================================================
    // 2. 新的核心功能逻辑
    // =================================================================
    let analysisResultCache = '';

    // 绑定事件并添加调试信息
    $('#analyze-button').on('click', function() {
        console.log('分析按钮被点击!');
        analyzeNote();
    });
    $('#generate-button').on('click', function() {
        console.log('生成按钮被点击!');
        generateNotes();
    });
    
    console.log('事件已绑定');

    async function analyzeNote() {
        console.log('analyzeNote函数被调用');
        const originalNote = $('#originalNote').val().trim();
        const theme = $('#theme').val().trim();
        
        console.log('原始笔记内容:', originalNote);
        console.log('仿写主题:', theme);

        if (!originalNote) {
            console.log('缺少原始笔记内容');
            showAlert('请输入原始笔记内容', 'warning');
            $('#originalNote').focus();
            return;
        }
        if (!theme) {
            console.log('缺少仿写主题');
            showAlert('请输入仿写主题', 'warning');
            $('#theme').focus();
            return;
        }
        
        console.log('开始发送API请求...');

        showLoading();
        $('#analyze-button, #generate-button').prop('disabled', true);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // 免登录模式：移除Authorization header
                },
                body: JSON.stringify({
                    content: originalNote,
                    model: 'claude',
                    showThinking: true,
                    useDeepAnalysis: true
                })
            });

            const data = await response.json();
            
            if (data.success) {
                analysisResultCache = data.data.content;
                displayAnalysisResult(data.data.content);
                fetchUserInfo(); // 更新积分显示
                showAlert('拆解分析完成！', 'success');
            } else {
                showAlert(data.message || '分析失败，请稍后再试', 'error');
                if (data.message && data.message.includes('积分不足')) {
                    fetchUserInfo();
                }
            }
        } catch (error) {
            console.error('分析错误:', error);
            showAlert('分析请求失败: ' + error.message, 'error');
        } finally {
            hideLoading();
            $('#analyze-button, #generate-button').prop('disabled', false);
        }
    }

    async function generateNotes() {
        const originalNote = $('#originalNote').val().trim();
        const theme = $('#theme').val().trim();
        const keywords = $('#keywords').val().trim();

        if (!analysisResultCache) {
            showAlert('请先进行拆解分析', 'warning');
            return;
        }
        if (!keywords) {
            showAlert('请输入关键词', 'warning');
            $('#keywords').focus();
            return;
        }

        showNotesLoading();
        $('#analyze-button, #generate-button').prop('disabled', true);

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                    // 免登录模式：移除Authorization header
                },
                body: JSON.stringify({
                    originalContent: originalNote,
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
                fetchUserInfo(); // 更新积分显示
                showAlert('笔记生成完成！', 'success');
            } else {
                showAlert(data.message || '生成失败，请稍后再试', 'error');
                if (data.message && data.message.includes('积分不足')) {
                    fetchUserInfo();
                }
            }
        } catch (error) {
            console.error('生成错误:', error);
            showAlert('生成请求失败: ' + error.message, 'error');
        } finally {
            hideNotesLoading();
            $('#analyze-button, #generate-button').prop('disabled', false);
        }
    }

    function displayAnalysisResult(content) {
        try {
            // 使用美化显示功能
            const container = document.getElementById('analysisContent');
            const analysis = parseAnalysisText(content);
            const html = createBeautifulAnalysisHTML(analysis);
            container.innerHTML = html;
            animateAnalysisDisplay();
        } catch (error) {
            console.error('美化显示失败，使用降级方案:', error);
            // 降级方案：使用marked.js来渲染Markdown
            const formattedContent = marked.parse(content);
            $('#analysisContent').html(formattedContent);
        }
        
        $('#analysisSection').removeClass('hidden');
        
        // 平滑滚动到结果区域
        setTimeout(() => {
            $('#analysisSection')[0].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }

    // 美化显示相关函数
    function parseAnalysisText(text) {
        const sections = {
            summary: '',
            structure: '',
            keywords: [],
            writingStyle: '',
            engagement: '',
            segments: []
        };
        
        // 简单的文本解析逻辑
        const lines = text.split('\n');
        let currentSection = '';
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            if (line.includes('思考过程') || line.includes('总结')) {
                currentSection = 'summary';
                sections.summary += line + '\n';
            } else if (line.includes('标题') || line.includes('结构')) {
                currentSection = 'structure';
                sections.structure += line + '\n';
            } else if (line.includes('关键词') || line.includes('标签')) {
                currentSection = 'keywords';
                // 提取关键词
                const keywords = line.match(/[\u4e00-\u9fa5]+/g);
                if (keywords) {
                    sections.keywords.push(...keywords);
                }
            } else if (line.includes('写作手法') || line.includes('方法')) {
                currentSection = 'writingStyle';
                sections.writingStyle += line + '\n';
            } else if (line.includes('互动') || line.includes('引导')) {
                currentSection = 'engagement';
                sections.engagement += line + '\n';
            } else {
                // 其他内容添加到当前section
                if (currentSection === 'summary') {
                    sections.summary += line + '\n';
                } else if (currentSection === 'structure') {
                    sections.structure += line + '\n';
                } else if (currentSection === 'writingStyle') {
                    sections.writingStyle += line + '\n';
                } else if (currentSection === 'engagement') {
                    sections.engagement += line + '\n';
                }
            }
        });
        
        return sections;
    }

    function createBeautifulAnalysisHTML(analysis) {
        return `
            <div class="analysis-container space-y-8">
                <!-- 概览卡片 -->
                <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200">
                    <div class="flex items-center mb-6">
                        <div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                            <span class="text-white text-xl">📝</span>
                        </div>
                        <h3 class="text-2xl font-bold text-blue-900">内容概览</h3>
                    </div>
                    <div class="prose prose-lg max-w-none text-gray-700">
                        ${formatAnalysisText(analysis.summary)}
                    </div>
                </div>

                <!-- 结构分析 -->
                <div class="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-200">
                    <div class="flex items-center mb-6">
                        <div class="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mr-4">
                            <span class="text-white text-xl">🏗️</span>
                        </div>
                        <h3 class="text-2xl font-bold text-purple-900">结构分析</h3>
                    </div>
                    <div class="prose prose-lg max-w-none text-gray-700">
                        ${formatAnalysisText(analysis.structure)}
                    </div>
                </div>

                <!-- 关键词云 -->
                ${analysis.keywords.length > 0 ? `
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-200">
                    <div class="flex items-center mb-6">
                        <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4">
                            <span class="text-white text-xl">🏷️</span>
                        </div>
                        <h3 class="text-2xl font-bold text-green-900">关键词分析</h3>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        ${analysis.keywords.map(keyword => `
                            <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200 hover:bg-green-200 transition-colors">
                                ${keyword}
                            </span>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- 写作手法 -->
                <div class="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-8 border border-orange-200">
                    <div class="flex items-center mb-6">
                        <div class="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mr-4">
                            <span class="text-white text-xl">✍️</span>
                        </div>
                        <h3 class="text-2xl font-bold text-orange-900">写作技巧</h3>
                    </div>
                    <div class="prose prose-lg max-w-none text-gray-700">
                        ${formatAnalysisText(analysis.writingStyle)}
                    </div>
                </div>

                <!-- 互动策略 -->
                <div class="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-2xl p-8 border border-teal-200">
                    <div class="flex items-center mb-6">
                        <div class="w-12 h-12 bg-teal-500 rounded-full flex items-center justify-center mr-4">
                            <span class="text-white text-xl">💬</span>
                        </div>
                        <h3 class="text-2xl font-bold text-teal-900">互动策略</h3>
                    </div>
                    <div class="prose prose-lg max-w-none text-gray-700">
                        ${formatAnalysisText(analysis.engagement)}
                    </div>
                </div>

                <!-- 核心要点总结 -->
                <div class="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-8 border border-gray-200">
                    <div class="flex items-center mb-6">
                        <div class="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mr-4">
                            <span class="text-white text-xl">💡</span>
                        </div>
                        <h3 class="text-2xl font-bold text-gray-900">核心要点</h3>
                    </div>
                    <div class="grid md:grid-cols-2 gap-6">
                        <div class="space-y-4">
                            <div class="flex items-start space-x-3">
                                <div class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <span class="text-white text-xs">1</span>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900">内容模式</h4>
                                    <p class="text-gray-600 text-sm">分享式 + 建议式</p>
                                </div>
                            </div>
                            <div class="flex items-start space-x-3">
                                <div class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <span class="text-white text-xs">2</span>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900">文案模式</h4>
                                    <p class="text-gray-600 text-sm">个人化表达 + 实用建议</p>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-4">
                            <div class="flex items-start space-x-3">
                                <div class="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <span class="text-white text-xs">3</span>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900">互动设计</h4>
                                    <p class="text-gray-600 text-sm">问答引导 + 经验分享</p>
                                </div>
                            </div>
                            <div class="flex items-start space-x-3">
                                <div class="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                                    <span class="text-white text-xs">4</span>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900">表达手法</h4>
                                    <p class="text-gray-600 text-sm">对比突出 + 情感共鸣</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function formatAnalysisText(text) {
        if (!text) return '';
        
        // 将文本转换为HTML，保持换行和格式
        return text
            .replace(/\n/g, '<br>')
            .replace(/【([^】]+)】/g, '<span class="font-semibold text-blue-600">【$1】</span>')
            .replace(/(\d+\.\s)/g, '<span class="font-semibold text-purple-600">$1</span>')
            .replace(/(✓|√)/g, '<span class="text-green-500">✓</span>')
            .replace(/(✗|×)/g, '<span class="text-red-500">✗</span>');
    }

    function animateAnalysisDisplay() {
        // 为每个卡片添加进入动画
        const cards = document.querySelectorAll('.analysis-container > div');
        
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(30px)';
            card.style.transition = 'all 0.6s ease';
            
            setTimeout(() => {
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 200);
        });
    }

    function displayGeneratedNotes(content) {
        const notes = parseGeneratedNotes(content);
        const notesContainer = $('#generatedNotes');
        
        if (notes.length === 0) {
            // 如果无法解析出多篇笔记，显示原始内容
            notesContainer.html(`
                <div class="bg-gradient-to-br from-white to-gray-50 rounded-3xl p-10 card-shadow border border-gray-100">
                    <div class="flex items-center justify-between mb-8">
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-4">
                                <span class="text-white text-xl">📝</span>
                            </div>
                            <h3 class="text-3xl font-bold text-gray-900">生成的笔记</h3>
                        </div>
                        <button onclick="copyToClipboard(\`${content.replace(/`/g, '\\`')}\`)" 
                                class="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 hover:transform hover:scale-105 flex items-center space-x-2">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
                            </svg>
                            <span>复制全部</span>
                        </button>
                    </div>
                    <div class="bg-white rounded-2xl p-8 border border-gray-100">
                        <div class="text-gray-700 whitespace-pre-wrap leading-relaxed text-lg">${content}</div>
                    </div>
                </div>
            `);
        } else {
            // 显示解析出的多篇笔记
            notesContainer.html(`
                <div class="space-y-8">
                    ${notes.map((note, index) => {
                        const gradients = [
                            'from-blue-50 to-indigo-50 border-blue-200',
                            'from-purple-50 to-pink-50 border-purple-200', 
                            'from-green-50 to-emerald-50 border-green-200',
                            'from-orange-50 to-red-50 border-orange-200',
                            'from-teal-50 to-cyan-50 border-teal-200'
                        ];
                        const iconColors = [
                            'bg-blue-500',
                            'bg-purple-500',
                            'bg-green-500', 
                            'bg-orange-500',
                            'bg-teal-500'
                        ];
                        const textColors = [
                            'text-blue-900',
                            'text-purple-900',
                            'text-green-900',
                            'text-orange-900', 
                            'text-teal-900'
                        ];
                        
                        const gradient = gradients[index % gradients.length];
                        const iconColor = iconColors[index % iconColors.length];
                        const textColor = textColors[index % textColors.length];
                        
                        return `
                            <div class="bg-gradient-to-br ${gradient} rounded-3xl p-8 border card-shadow transition-all duration-300 hover:transform hover:scale-[1.02]">
                                <div class="flex items-center justify-between mb-6">
                                    <div class="flex items-center">
                                        <div class="w-12 h-12 ${iconColor} rounded-full flex items-center justify-center mr-4">
                                            <span class="text-white text-xl">${index + 1}</span>
                                        </div>
                                        <div>
                                            <h3 class="text-2xl font-bold ${textColor}">笔记 ${index + 1}</h3>
                                            <div class="text-sm text-gray-600 mt-1">
                                                ${getKeywordStats(note.title + ' ' + note.content)}
                                            </div>
                                        </div>
                                    </div>
                                    <button onclick="copyToClipboard(\`${(note.title + '\n\n' + note.content).replace(/`/g, '\\`')}\`)"
                                            class="bg-white/80 hover:bg-white text-gray-600 hover:text-gray-800 p-3 rounded-xl transition-all duration-200 hover:transform hover:scale-105 shadow-sm hover:shadow-md">
                                        <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
                                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
                                        </svg>
                                    </button>
                                </div>
                                
                                <div class="bg-white/70 rounded-2xl p-6 backdrop-blur-sm">
                                    <h4 class="text-xl font-bold text-gray-900 mb-4 leading-tight">${highlightKeywords(note.title)}</h4>
                                    <div class="text-gray-700 whitespace-pre-wrap leading-relaxed text-base">${highlightKeywords(note.content)}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <!-- 批量操作按钮 -->
                <div class="mt-8 text-center">
                    <button onclick="copyAllNotes()" 
                            class="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-200 hover:transform hover:scale-105 shadow-lg hover:shadow-xl">
                        📋 复制全部5篇笔记
                    </button>
                </div>
            `);
        }
        
        $('#notesSection').removeClass('hidden');
        
        // 添加动画效果
        animateNotesDisplay();
        
        // 平滑滚动到结果区域
        setTimeout(() => {
            $('#notesSection')[0].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }

    // 添加笔记显示动画
    function animateNotesDisplay() {
        const noteCards = $('#generatedNotes .bg-gradient-to-br');
        
        noteCards.each((index, card) => {
            $(card).css({
                opacity: '0',
                transform: 'translateY(30px)'
            });
            
            setTimeout(() => {
                $(card).css({
                    transition: 'all 0.6s ease',
                    opacity: '1',
                    transform: 'translateY(0)'
                });
            }, index * 150);
        });
    }
});

// =================================================================
// 3. 全局辅助函数
// =================================================================
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
    
    // 动画显示
    setTimeout(() => {
        alert.removeClass('translate-x-full opacity-0');
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        alert.addClass('translate-x-full opacity-0');
        setTimeout(() => alert.remove(), 300);
    }, 4000);
}

function parseGeneratedNotes(content) {
    const notes = [];
    let noteRegex = /===笔记\s*\d+===([\s\S]*?)(?====笔记\s*\d+===|$)/g;
    let match;
    
    while ((match = noteRegex.exec(content)) !== null) {
        const noteContent = match[1].trim();
        const lines = noteContent.split('\n');
        let title = '';
        let noteBody = '';
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('标题：')) {
                title = line.replace('标题：', '').replace(/【|】/g, '').trim();
                noteBody = lines.slice(i + 1).join('\n').replace(/【|】/g, '').trim();
                break;
            } else if (line && !title && i === 0) {
                // 如果第一行不是以"标题："开头，但有内容，可能直接就是标题
                title = line.replace(/【|】/g, '').trim();
                noteBody = lines.slice(i + 1).join('\n').replace(/【|】/g, '').trim();
                break;
            }
        }
        
        // 如果还是没有找到标题，尝试从内容中提取第一行作为标题
        if (!title && noteContent) {
            const contentLines = noteContent.split('\n').filter(line => line.trim());
            if (contentLines.length > 0) {
                title = contentLines[0].replace(/【|】/g, '').replace('标题：', '').trim();
                noteBody = contentLines.slice(1).join('\n').replace(/【|】/g, '').trim();
            }
        }
        
        if (title && noteBody) {
            notes.push({ title, content: noteBody });
        } else if (noteContent) {
            // 如果无法分离标题和内容，就把所有内容作为一篇笔记
            notes.push({ 
                title: `笔记${notes.length + 1}`, 
                content: noteContent.replace(/【|】/g, '').trim() 
            });
        }
    }
    
    return notes;
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            showAlert('已复制到剪贴板！', 'success');
        }).catch(err => {
            console.error('复制失败:', err);
            fallbackCopyTextToClipboard(text);
        });
    } else {
        fallbackCopyTextToClipboard(text);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
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

function showLoading() { 
    $('#analysisLoading').removeClass('hidden');
    $('html, body').animate({
        scrollTop: $('#analysisLoading').offset().top - 100
    }, 500);
}

function hideLoading() { 
    $('#analysisLoading').addClass('hidden'); 
}

function showNotesLoading() { 
    $('#notesLoading').removeClass('hidden');
    $('html, body').animate({
        scrollTop: $('#notesLoading').offset().top - 100
    }, 500);
}

function hideNotesLoading() { 
    $('#notesLoading').addClass('hidden'); 
}

function highlightKeywords(text) {
    const keywords = $('#keywords').val().trim();
    if (!keywords || !text) return text;
    
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    let highlightedText = text;
    
    keywordList.forEach(keyword => {
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
        highlightedText = highlightedText.replace(regex, 
            `<mark class="bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded font-medium">$1</mark>`);
    });
    
    return highlightedText;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function copyAllNotes() {
    const notes = [];
    $('#generatedNotes .bg-gradient-to-br').each(function(index) {
        const title = $(this).find('h4').text().trim();
        const content = $(this).find('.whitespace-pre-wrap').text().trim();
        if (title && content) {
            notes.push(`=== 笔记${index + 1} ===\n标题：${title}\n\n${content}`);
        }
    });
    
    if (notes.length > 0) {
        const allContent = notes.join('\n\n' + '='.repeat(50) + '\n\n');
        copyToClipboard(allContent);
    } else {
        showAlert('没有找到可复制的笔记内容', 'warning');
    }
}

function getKeywordStats(text) {
    const keywords = $('#keywords').val().trim();
    if (!keywords || !text) return `字数：${text.length}`;
    
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    const foundKeywords = keywordList.filter(keyword => {
        const regex = new RegExp(escapeRegExp(keyword), 'i');
        return regex.test(text);
    });
    
    const coverage = Math.round((foundKeywords.length / keywordList.length) * 100);
    const coverageColor = coverage >= 80 ? 'text-green-600' : 
                         coverage >= 60 ? 'text-yellow-600' : 'text-red-600';
    
    return `字数：${text.length} | <span class="${coverageColor} font-medium">关键词覆盖：${coverage}%</span>`;
} 