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
        
        // 更智能的文本解析逻辑
        const lines = text.split('\n');
        let currentSection = '';
        
        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            // 识别不同的章节
            if (line.includes('思考过程') || line.includes('内容概览') || line.includes('总结')) {
                currentSection = 'summary';
                return;
            } else if (line.includes('结构分析') || line.includes('标题') || line.includes('段落结构') || line.includes('框架')) {
                currentSection = 'structure';
                return;
            } else if (line.includes('关键词') || line.includes('标签') || line.includes('词汇')) {
                currentSection = 'keywords';
                // 提取关键词 - 更智能的提取
                const keywordMatches = line.match(/[：:]\s*(.+)/);
                if (keywordMatches) {
                    const keywordText = keywordMatches[1];
                    // 提取中文词汇，排除标点符号
                    const keywords = keywordText.match(/[\u4e00-\u9fa5]{2,}/g);
                    if (keywords) {
                        sections.keywords.push(...keywords.filter(k => 
                            k.length >= 2 && 
                            !['关键词', '标签', '词汇', '使用', '模式', '分析'].includes(k)
                        ));
                    }
                }
                return;
            } else if (line.includes('写作') || line.includes('技巧') || line.includes('手法') || line.includes('方法')) {
                currentSection = 'writingStyle';
                return;
            } else if (line.includes('互动') || line.includes('引导') || line.includes('策略')) {
                currentSection = 'engagement';
                return;
            }
            
            // 将内容添加到对应section，并清理格式
            const cleanLine = cleanTextFormat(line);
            if (cleanLine) {
                if (currentSection === 'summary') {
                    sections.summary += cleanLine + '\n';
                } else if (currentSection === 'structure') {
                    sections.structure += cleanLine + '\n';
                } else if (currentSection === 'writingStyle') {
                    sections.writingStyle += cleanLine + '\n';
                } else if (currentSection === 'engagement') {
                    sections.engagement += cleanLine + '\n';
                }
            }
        });
        
        // 如果没有提取到关键词，尝试从整个文本中提取
        if (sections.keywords.length === 0) {
            const allKeywords = text.match(/[\u4e00-\u9fa5]{2,}/g);
            if (allKeywords) {
                // 统计词频，选择出现频率较高的词作为关键词
                const wordCount = {};
                allKeywords.forEach(word => {
                    if (word.length >= 2 && word.length <= 4) {
                        wordCount[word] = (wordCount[word] || 0) + 1;
                    }
                });
                
                // 选择出现2次以上的词作为关键词
                sections.keywords = Object.keys(wordCount)
                    .filter(word => wordCount[word] >= 2)
                    .filter(word => !['分析', '内容', '使用', '方式', '技巧', '方法', '结构', '段落', '文章', '笔记'].includes(word))
                    .slice(0, 8); // 最多8个关键词
            }
        }
        
        return sections;
    }

    // 清理文本格式的辅助函数
    function cleanTextFormat(text) {
        if (!text) return '';
        
        return text
            // 移除markdown符号
            .replace(/^#+\s*/, '')
            .replace(/^\*+\s*/, '')
            .replace(/^-+\s*/, '')
            .replace(/^\d+\.\s*/, '')
            // 移除方括号
            .replace(/\[([^\]]+)\]/g, '$1')
            // 移除多余的符号
            .replace(/^[：:]\s*/, '')
            .replace(/^[。，、；]/g, '')
            .trim();
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
                <div class="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-200">
                    <div class="flex items-center mb-6">
                        <div class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4">
                            <span class="text-white text-xl">🏷️</span>
                        </div>
                        <h3 class="text-2xl font-bold text-green-900">关键词分析</h3>
                    </div>
                    ${generateKeywordDisplay(analysis.keywords)}
                </div>

                <!-- 写作手法 -->
                <div class="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-8 border border-orange-200">
                    <div class="flex items-center mb-6">
                        <div class="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mr-4">
                            <span class="text-white text-xl">✍️</span>
                        </div>
                        <h3 class="text-2xl font-bold text-orange-900">写作技巧</h3>
                    </div>
                    <div class="prose prose-lg max-w-none text-gray-700">
                        ${formatWritingTechniques(analysis.writingStyle)}
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
        if (!text) return '暂无相关分析内容';
        
        // 将文本转换为HTML，优化可读性
        let formatted = text
            // 基本换行处理
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>')
            
            // 移除技术符号
            .replace(/#+\s*/g, '')
            .replace(/\*+\s*/g, '')
            .replace(/【([^】]+)】/g, '<strong class="text-gray-800">$1</strong>')
            .replace(/\[([^\]]+)\]/g, '$1')
            
            // 数字列表优化
            .replace(/(\d+)\.\s*/g, '<span class="inline-block w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-sm font-bold text-center mr-2">$1</span>')
            
            // 破折号列表优化
            .replace(/^-\s*/gm, '<span class="inline-block w-2 h-2 bg-gray-400 rounded-full mr-3 mt-2"></span>')
            
            // 强调内容
            .replace(/(重要|关键|核心|主要)/g, '<strong class="text-blue-600">$1</strong>')
            .replace(/(技巧|方法|策略|手法)/g, '<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">$1</span>')
            
            // 特殊符号美化
            .replace(/(✓|√)/g, '<span class="text-green-500 font-bold">✓</span>')
            .replace(/(✗|×)/g, '<span class="text-red-500 font-bold">✗</span>')
            .replace(/→/g, '<span class="text-blue-500">→</span>')
            
            // 冒号后内容强调
            .replace(/([^：:]+)[：:]\s*/g, '<strong class="text-gray-700">$1：</strong><br>')
            
            // 增加段落间距
            .replace(/(<br>){3,}/g, '<br><br>')
            
            // 处理空内容
            .trim();
            
        // 如果格式化后内容为空或太短，提供默认内容
        if (!formatted || formatted.length < 10) {
            return '<div class="text-gray-500 italic">AI正在深度分析中，请稍候...</div>';
        }
        
        return `<div class="leading-relaxed space-y-3">${formatted}</div>`;
    }

    // 专门格式化写作技巧的函数
    function formatWritingTechniques(text) {
        if (!text || text.trim().length < 10) {
            return `
                <div class="grid md:grid-cols-2 gap-6">
                    <div class="space-y-4">
                        <div class="flex items-start space-x-3">
                            <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span class="text-orange-600 text-sm">📝</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 mb-2">叙事手法</h4>
                                <p class="text-gray-600 text-sm leading-relaxed">采用第一人称视角，增强真实感和代入感，让读者产生共鸣</p>
                            </div>
                        </div>
                        
                        <div class="flex items-start space-x-3">
                            <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span class="text-orange-600 text-sm">🎯</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 mb-2">结构设计</h4>
                                <p class="text-gray-600 text-sm leading-relaxed">采用总-分-总结构，开头抛出问题，中间详细解答，结尾总结升华</p>
                            </div>
                        </div>
                        
                        <div class="flex items-start space-x-3">
                            <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span class="text-orange-600 text-sm">💡</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 mb-2">表达技巧</h4>
                                <p class="text-gray-600 text-sm leading-relaxed">运用对比、排比等修辞手法，增强表达力和说服力</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="flex items-start space-x-3">
                            <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span class="text-orange-600 text-sm">🔥</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 mb-2">情感调动</h4>
                                <p class="text-gray-600 text-sm leading-relaxed">通过具体场景描述和情感词汇，调动读者情绪</p>
                            </div>
                        </div>
                        
                        <div class="flex items-start space-x-3">
                            <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span class="text-orange-600 text-sm">📊</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 mb-2">数据支撑</h4>
                                <p class="text-gray-600 text-sm leading-relaxed">适当使用具体数字和事实，增强内容可信度</p>
                            </div>
                        </div>
                        
                        <div class="flex items-start space-x-3">
                            <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span class="text-orange-600 text-sm">🎪</span>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 mb-2">互动设计</h4>
                                <p class="text-gray-600 text-sm leading-relaxed">设置问题引导、评论互动等元素，提升参与度</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 如果有内容，则格式化显示
        const formatted = formatAnalysisText(text);
        return `
            <div class="mb-6">${formatted}</div>
            <div class="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <h4 class="font-bold text-orange-800 mb-3 flex items-center">
                    <span class="mr-2">💡</span>
                    实用写作建议
                </h4>
                <div class="grid md:grid-cols-2 gap-4 text-sm">
                    <div class="space-y-2">
                        <p><strong>开头技巧：</strong>用疑问句或惊人数据抓住注意力</p>
                        <p><strong>段落控制：</strong>每段3-5句话，保持节奏感</p>
                        <p><strong>词汇选择：</strong>多用动词，少用形容词</p>
                    </div>
                    <div class="space-y-2">
                        <p><strong>情感表达：</strong>真实分享个人体验和感受</p>
                        <p><strong>结尾设计：</strong>总结要点并引导行动</p>
                        <p><strong>互动引导：</strong>主动邀请评论和分享</p>
                    </div>
                </div>
            </div>
                 `;
    }

    // 生成关键词显示的函数
    function generateKeywordDisplay(keywords) {
        // 如果有解析出的关键词，显示它们
        if (keywords && keywords.length > 0) {
            const uniqueKeywords = [...new Set(keywords)]; // 去重
            return `
                <div class="mb-4">
                    <div class="flex flex-wrap gap-3">
                        ${uniqueKeywords.map((keyword, index) => {
                            const colors = [
                                'bg-green-100 text-green-800 border-green-200',
                                'bg-blue-100 text-blue-800 border-blue-200',
                                'bg-purple-100 text-purple-800 border-purple-200',
                                'bg-orange-100 text-orange-800 border-orange-200',
                                'bg-pink-100 text-pink-800 border-pink-200'
                            ];
                            const colorClass = colors[index % colors.length];
                            return `
                                <span class="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${colorClass} border hover:scale-105 transition-transform cursor-pointer">
                                    ${keyword}
                                </span>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="bg-green-50 rounded-xl p-4 border border-green-200">
                    <p class="text-sm text-green-700">
                        <strong>关键词策略：</strong>这些词汇在原文中频繁出现，是内容的核心要素。在仿写时可以围绕这些关键词展开，保持主题一致性。
                    </p>
                </div>
            `;
        }
        
        // 如果没有关键词，显示默认的关键词类型说明
        return `
            <div class="space-y-4">
                <div class="grid md:grid-cols-3 gap-4">
                    <div class="bg-white rounded-lg p-4 border border-green-200">
                        <h4 class="font-bold text-green-800 mb-2 flex items-center">
                            <span class="mr-2">🎯</span>核心词汇
                        </h4>
                        <p class="text-sm text-gray-600">产品名称、品牌词、功效词等核心概念</p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 border border-green-200">
                        <h4 class="font-bold text-green-800 mb-2 flex items-center">
                            <span class="mr-2">💡</span>情感词汇
                        </h4>
                        <p class="text-sm text-gray-600">表达感受、体验、评价的形容词和动词</p>
                    </div>
                    
                    <div class="bg-white rounded-lg p-4 border border-green-200">
                        <h4 class="font-bold text-green-800 mb-2 flex items-center">
                            <span class="mr-2">🔥</span>热门标签
                        </h4>
                        <p class="text-sm text-gray-600">流行话题、热门标签、互动引导词</p>
                    </div>
                </div>
                
                <div class="bg-green-50 rounded-xl p-4 border border-green-200">
                    <p class="text-sm text-green-700">
                        <strong>提示：</strong>AI正在智能分析文本中的关键词汇，稍后将为您展示详细的词汇分析结果。
                    </p>
                </div>
            </div>
        `;
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