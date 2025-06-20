$(document).ready(function () {
    // =================================================================
    // 1. 认证和用户状态管理
    // =================================================================
    const token = localStorage.getItem('token');

    function fetchUserInfo() {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) {
            $('#user-info').addClass('hidden');
            $('#auth-buttons').removeClass('hidden');
            // 锁定功能按钮
            $('#analyze-button, #generate-button').prop('disabled', true).addClass('opacity-50');
            return;
        }

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

    // 登录/注册按钮点击 - 使用多种方式确保事件绑定成功
    $(document).on('click', '#login-btn', function(e) {
        e.preventDefault();
        console.log('Login button clicked');
        window.location.href = '/auth.html';
    });
    
    // 备用事件绑定方式
    $('#login-btn').off('click').on('click', function(e) {
        e.preventDefault();
        console.log('Login button clicked (backup method)');
        window.location.href = '/auth.html';
    });

    // DOM加载完成后再次绑定
    setTimeout(function() {
        $('#login-btn').off('click').on('click', function(e) {
            e.preventDefault();
            console.log('Login button clicked (delayed binding)');
            window.location.href = '/auth.html';
        });
    }, 1000);

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

    $('#analyze-button').on('click', analyzeNote);
    $('#generate-button').on('click', generateNotes);

    async function analyzeNote() {
        const originalNote = $('#originalNote').val().trim();
        const theme = $('#theme').val().trim();

        if (!originalNote) {
            showAlert('请输入原始笔记内容', 'warning');
            $('#originalNote').focus();
            return;
        }
        if (!theme) {
            showAlert('请输入仿写主题', 'warning');
            $('#theme').focus();
            return;
        }

        showLoading();
        $('#analyze-button, #generate-button').prop('disabled', true);

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    original_post: originalNote,
                    model: 'claude-3-opus-20240229',
                    deep_analysis: true 
                })
            });

            const data = await response.json();
            
            if (data.success) {
                analysisResultCache = data.analysis;
                displayAnalysisResult(data.analysis);
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
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    original_post: originalNote,
                    topic: theme,
                    keywords: keywords,
                    model: 'claude-3-opus-20240229',
                    deep_analysis: true
                })
            });

            const data = await response.json();

            if (data.success) {
                displayGeneratedNotes(data.variations);
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
        // 使用marked.js来渲染Markdown
        const formattedContent = marked.parse(content);
        $('#analysisContent').html(formattedContent);
        $('#analysisSection').removeClass('hidden');
        
        // 平滑滚动到结果区域
        setTimeout(() => {
            $('#analysisSection')[0].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }

    function displayGeneratedNotes(content) {
        const notes = parseGeneratedNotes(content);
        const notesContainer = $('#generatedNotes');
        
        if (notes.length === 0) {
            notesContainer.html(`
                <div class="bg-white rounded-2xl p-10 card-shadow">
                    <h3 class="text-2xl font-bold text-gray-900 mb-6">生成的内容</h3>
                    <div class="text-gray-700 whitespace-pre-wrap leading-relaxed text-lg">${content}</div>
                    <button onclick="copyToClipboard(\`${content.replace(/`/g, '\\`')}\`)" 
                            class="mt-8 btn-primary text-white px-8 py-4 rounded-lg font-medium text-lg">
                        复制全部内容
                    </button>
                </div>
            `);
        } else {
            notesContainer.html(notes.map((note, index) => `
                <div class="bg-white rounded-2xl p-10 card-shadow">
                    <div class="flex justify-between items-start mb-8">
                        <div>
                            <h3 class="text-2xl font-bold text-primary">笔记 ${index + 1}</h3>
                            <div class="text-base text-gray-500 mt-3">
                                ${getKeywordStats(note.title + ' ' + note.content)}
                            </div>
                        </div>
                        <button onclick="copyToClipboard(\`${(note.title + '\n\n' + note.content).replace(/`/g, '\\`')}\`)"
                                class="copy-btn text-gray-400 hover:text-primary transition-colors p-4 rounded-lg hover:bg-gray-100">
                            <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path>
                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="space-y-6">
                        <h4 class="text-xl font-semibold text-gray-900">${highlightKeywords(note.title)}</h4>
                        <div class="text-gray-700 whitespace-pre-wrap leading-relaxed text-lg">${highlightKeywords(note.content)}</div>
                    </div>
                </div>
            `).join(''));
        }
        
        $('#notesSection').removeClass('hidden');
        
        // 平滑滚动到结果区域
        setTimeout(() => {
            $('#notesSection')[0].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
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
            }
        }
        
        if (title && noteBody) {
            notes.push({ title, content: noteBody });
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