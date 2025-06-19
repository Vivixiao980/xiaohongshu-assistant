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
            $('#analyze-button, #generate-button').prop('disabled', true).addClass('disabled:cursor-not-allowed');
            return;
        }

        fetch('/auth/me', {
            headers: { 'Authorization': `Bearer ${currentToken}` }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                $('#user-username').text(data.user.username);
                $('#user-credits').text(`积分: ${data.user.credits}`);
                $('#user-info').removeClass('hidden');
                $('#auth-buttons').addClass('hidden');
                 // 解锁功能按钮
                $('#analyze-button, #generate-button').prop('disabled', false).removeClass('disabled:cursor-not-allowed');
            } else {
                localStorage.removeItem('token');
                $('#user-info').addClass('hidden');
                $('#auth-buttons').removeClass('hidden');
                $('#analyze-button, #generate-button').prop('disabled', true).addClass('disabled:cursor-not-allowed');
            }
        });
    }

    // 初始加载时检查用户信息
    fetchUserInfo();

    // 登录/注册按钮点击
    $('#login-btn').on('click', () => $('#login-modal').removeClass('hidden'));
    $('.close-modal').on('click', () => $('.modal').addClass('hidden'));

    // 登录表单提交
    $('#login-form').on('submit', async function (e) {
        e.preventDefault();
        const identifier = $('#login-identifier').val();
        const password = $('#login-password').val();
        
        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });
            const data = await response.json();
            if (data.success) {
                showAlert('登录成功！', 'success');
                localStorage.setItem('token', data.token);
                fetchUserInfo();
                $('#login-modal').addClass('hidden');
            } else {
                showAlert(data.message, 'error');
            }
        } catch (error) {
            showAlert('登录请求失败，请检查网络连接。', 'error');
        }
    });

    // 退出登录
    $('#logout-button').on('click', () => {
        localStorage.removeItem('token');
        fetchUserInfo();
        showAlert('您已成功退出登录。', 'info');
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
            return;
        }
        if (!theme) {
            showAlert('请输入仿写主题', 'warning');
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
                    model: 'claude-3-opus-20240229', // Or get from UI
                    deep_analysis: true 
                })
            });

            const data = await response.json();
            
            if (data.success) {
                analysisResultCache = data.analysis;
                displayAnalysisResult(data.analysis);
                fetchUserInfo(); // 更新积分显示
            } else {
                showAlert(data.message || '分析失败，请稍后再试。', 'error');
            }
        } catch (error) {
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
            } else {
                showAlert(data.message || '生成失败，请稍后再试。', 'error');
            }
        } catch (error) {
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
        $('#analysisSection')[0].scrollIntoView({ behavior: 'smooth' });
    }

    function displayGeneratedNotes(content) {
        const notes = parseGeneratedNotes(content);
        const notesContainer = $('#generatedNotes');
        
        if (notes.length === 0) {
            notesContainer.html(`
                <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                    <h3 class="text-lg font-semibold text-primary mb-4">生成的内容 (解析失败)</h3>
                    <div class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">${content}</div>
                    <button onclick="copyToClipboard(this.nextElementSibling.innerText)" 
                            class="mt-4 bg-primary hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors">
                        复制全部内容
                    </button>
                    <pre class="hidden">${content}</pre>
                </div>
            `);
        } else {
            notesContainer.html(notes.map((note, index) => `
                <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="text-lg font-semibold text-primary">笔记 ${index + 1}</h3>
                            <div class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                ${getKeywordStats(note.title + ' ' + note.content)}
                            </div>
                        </div>
                        <button onclick="copyToClipboard(this.dataset.note)"
                                data-note="${note.title}\n\n${note.content}" 
                                class="copy-btn text-gray-500 hover:text-primary transition-colors p-2">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"></path><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"></path></svg>
                        </button>
                    </div>
                    <div class="prose prose-sm max-w-none dark:prose-invert">
                        <h4 class="text-base font-medium text-gray-900 dark:text-white mb-3">${highlightKeywords(note.title)}</h4>
                        <div class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">${highlightKeywords(note.content)}</div>
                    </div>
                </div>
            `).join(''));
        }
        
        $('#notesSection').removeClass('hidden');
        $('#notesSection')[0].scrollIntoView({ behavior: 'smooth' });
    }
    
    // ... (Helper functions below)
});

// Helper functions (can be outside document.ready)
function showAlert(message, type = 'info') {
    const alert = $(`
        <div class="p-4 mb-4 text-sm rounded-lg" role="alert">
            <span class="font-medium">${message}</span>
        </div>
    `);
    const typeClasses = {
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    };
    alert.addClass(typeClasses[type]);
    $('#alert-container').append(alert);
    setTimeout(() => alert.fadeOut(500, () => alert.remove()), 4000);
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
        if (title && noteBody) notes.push({ title, content: noteBody });
    }
    return notes;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('已复制到剪贴板!', 'success');
        if (event.target) {
            const button = $(event.target).closest('.copy-btn');
            if(button.length) {
                const originalColor = 'text-gray-500';
                button.removeClass(originalColor).addClass('text-green-500');
                setTimeout(() => {
                    button.removeClass('text-green-500').addClass(originalColor);
                }, 1500);
            }
        }
    });
}

function showLoading() { $('#analysisLoading').removeClass('hidden'); }
function hideLoading() { $('#analysisLoading').addClass('hidden'); }
function showNotesLoading() { $('#notesLoading').removeClass('hidden'); }
function hideNotesLoading() { $('#notesLoading').addClass('hidden'); }

function highlightKeywords(text) {
    const keywords = $('#keywords').val().trim();
    if (!keywords || !text) return text;
    const keywordList = keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    let highlightedText = text;
    keywordList.forEach(keyword => {
        const regex = new RegExp(`(${escapeRegExp(keyword)})`, 'gi');
        highlightedText = highlightedText.replace(regex, `<mark class="bg-yellow-200 dark:bg-yellow-600 px-1 rounded">$1</mark>`);
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
    const coverageColor = coverage === 100 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    return `字数：${text.length} | <span class="${coverageColor}">关键词覆盖：${coverage}%</span>`;
} 