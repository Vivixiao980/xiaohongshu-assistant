class XiaohongshuAssistant {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('token');
        this.activeTab = 'analyze';
        this.currentResult = '';
        
        this.initElements();
        this.bindEvents();
        this.checkAuth();
    }

    initElements() {
        // 认证相关
        this.authModal = document.getElementById('auth-modal');
        this.loginForm = document.getElementById('login-form');
        this.registerForm = document.getElementById('register-form');
        this.authTitle = document.getElementById('auth-title');
        this.toggleAuthMode = document.getElementById('toggle-auth-mode');
        this.loginBtn = document.getElementById('login-btn');
        this.registerBtn = document.getElementById('register-btn');
        this.logoutBtn = document.getElementById('logout-btn');
        this.closeAuthModal = document.getElementById('close-auth-modal');
        
        // 用户信息
        this.userInfo = document.getElementById('user-info');
        this.authButtons = document.getElementById('auth-buttons');
        this.username = document.getElementById('username');
        this.userType = document.getElementById('user-type');
        this.credits = document.getElementById('credits');
        this.creditsAlert = document.getElementById('credits-alert');
        
        // 标签页
        this.tabAnalyze = document.getElementById('tab-analyze');
        this.tabGenerate = document.getElementById('tab-generate');
        this.tabHistory = document.getElementById('tab-history');
        
        // 功能区域
        this.analyzeSection = document.getElementById('analyze-section');
        this.generateSection = document.getElementById('generate-section');
        this.historySection = document.getElementById('history-section');
        
        // 功能按钮
        this.analyzeBtn = document.getElementById('analyze-btn');
        this.generateBtn = document.getElementById('generate-btn');
        
        // 输入元素
        this.content = document.getElementById('content');
        this.originalContent = document.getElementById('original-content');
        this.newTopic = document.getElementById('new-topic');
        this.showThinking = document.getElementById('show-thinking');
        this.deepAnalysis = document.getElementById('deep-analysis');
        this.genShowThinking = document.getElementById('gen-show-thinking');
        this.genDeepAnalysis = document.getElementById('gen-deep-analysis');
        
        // 结果相关
        this.result = document.getElementById('result');
        this.resultTitle = document.getElementById('result-title');
        this.copyBtn = document.getElementById('copy-btn');
        this.loading = document.getElementById('loading');
        this.loadingText = document.getElementById('loading-text');
        
        // 历史记录
        this.historyList = document.getElementById('history-list');
        this.historyPagination = document.getElementById('history-pagination');
        this.refreshHistoryBtn = document.getElementById('refresh-history-btn');
    }

    bindEvents() {
        // 认证相关事件
        this.loginBtn.addEventListener('click', () => this.showAuthModal('login'));
        this.registerBtn.addEventListener('click', () => this.showAuthModal('register'));
        this.logoutBtn.addEventListener('click', () => this.logout());
        this.closeAuthModal.addEventListener('click', () => this.hideAuthModal());
        this.toggleAuthMode.addEventListener('click', () => this.toggleAuthModeHandler());
        
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        
        // 标签页切换
        this.tabAnalyze.addEventListener('click', () => this.switchTab('analyze'));
        this.tabGenerate.addEventListener('click', () => this.switchTab('generate'));
        this.tabHistory.addEventListener('click', () => this.switchTab('history'));
        
        // 功能按钮
        this.analyzeBtn.addEventListener('click', () => this.handleAnalyze());
        this.generateBtn.addEventListener('click', () => this.handleGenerate());
        
        // 复制功能
        this.copyBtn.addEventListener('click', () => this.copyResult());
        
        // 历史记录
        this.refreshHistoryBtn.addEventListener('click', () => this.loadHistory());
        
        // 模态框外部点击关闭
        this.authModal.addEventListener('click', (e) => {
            if (e.target === this.authModal) {
                this.hideAuthModal();
            }
        });
    }

    async checkAuth() {
        if (this.token) {
            try {
                const response = await this.api('/auth/me', 'GET');
                if (response.success) {
                    this.currentUser = response.data.user;
                    this.updateUI();
                } else {
                    this.logout();
                }
            } catch (error) {
                console.error('身份验证失败:', error);
                this.logout();
            }
        }
    }

    updateUI() {
        if (this.currentUser) {
            this.userInfo.classList.remove('hidden');
            this.authButtons.classList.add('hidden');
            
            this.username.textContent = this.currentUser.username;
            this.userType.textContent = this.currentUser.userType === 'trial' ? '体验用户' : '正式学员';
            this.credits.textContent = this.currentUser.credits;
            
            // 更新积分警告
            this.updateCreditsAlert();
            
            // 启用功能按钮
            this.analyzeBtn.disabled = false;
            this.generateBtn.disabled = false;
            
            // 更新结果区域提示
            if (this.result.textContent.includes('请先登录')) {
                this.result.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-10">选择功能并点击相应按钮获取结果</p>';
            }
        } else {
            this.userInfo.classList.add('hidden');
            this.authButtons.classList.remove('hidden');
            this.creditsAlert.classList.add('hidden');
            
            // 禁用功能按钮
            this.analyzeBtn.disabled = true;
            this.generateBtn.disabled = true;
            
            // 更新结果区域提示
            this.result.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-10">请先登录，然后选择功能并点击相应按钮获取结果</p>';
        }
    }

    updateCreditsAlert() {
        if (!this.currentUser) return;
        
        const credits = this.currentUser.credits;
        const userType = this.currentUser.userType;
        
        if (credits === 0) {
            this.creditsAlert.classList.remove('hidden', 'credits-warning');
            this.creditsAlert.classList.add('credits-danger');
            this.creditsAlert.querySelector('#credits-alert-title').textContent = '积分已用完';
            this.creditsAlert.querySelector('#credits-alert-message').textContent = 
                userType === 'trial' ? '体验用户积分已用完，请升级为正式学员' : '正式学员积分已用完，请等待下月重置';
        } else if (credits <= 5 && userType === 'student') {
            this.creditsAlert.classList.remove('hidden', 'credits-danger');
            this.creditsAlert.classList.add('credits-warning');
            this.creditsAlert.querySelector('#credits-alert-title').textContent = '积分不足警告';
            this.creditsAlert.querySelector('#credits-alert-message').textContent = `剩余积分不足，请合理安排使用`;
        } else if (credits <= 1 && userType === 'trial') {
            this.creditsAlert.classList.remove('hidden', 'credits-danger');
            this.creditsAlert.classList.add('credits-warning');
            this.creditsAlert.querySelector('#credits-alert-title').textContent = '体验即将结束';
            this.creditsAlert.querySelector('#credits-alert-message').textContent = `仅剩${credits}次使用机会，升级为正式学员享受更多权益`;
        } else {
            this.creditsAlert.classList.add('hidden');
        }
    }

    showAuthModal(mode = 'login') {
        this.authModal.classList.remove('hidden');
        if (mode === 'login') {
            this.authTitle.textContent = '登录';
            this.loginForm.classList.remove('hidden');
            this.registerForm.classList.add('hidden');
            this.toggleAuthMode.textContent = '还没有账户？点击注册';
        } else {
            this.authTitle.textContent = '注册';
            this.loginForm.classList.add('hidden');
            this.registerForm.classList.remove('hidden');
            this.toggleAuthMode.textContent = '已有账户？点击登录';
        }
    }

    hideAuthModal() {
        this.authModal.classList.add('hidden');
    }

    toggleAuthModeHandler() {
        const isLogin = !this.loginForm.classList.contains('hidden');
        this.showAuthModal(isLogin ? 'register' : 'login');
    }

    async handleLogin(e) {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await this.api('/auth/login', 'POST', {
                identifier,
                password
            });
            
            if (response.success) {
                this.token = response.data.token;
                this.currentUser = response.data.user;
                localStorage.setItem('token', this.token);
                this.hideAuthModal();
                this.updateUI();
                this.showToast('登录成功！', 'success');
            } else {
                this.showToast(response.message || '登录失败', 'error');
            }
        } catch (error) {
            console.error('登录错误:', error);
            this.showToast('登录失败，请稍后重试', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const userType = document.getElementById('register-usertype').value;
        
        try {
            const response = await this.api('/auth/register', 'POST', {
                username,
                email,
                password,
                userType
            });
            
            if (response.success) {
                this.token = response.data.token;
                this.currentUser = response.data.user;
                localStorage.setItem('token', this.token);
                this.hideAuthModal();
                this.updateUI();
                this.showToast('注册成功！', 'success');
            } else {
                this.showToast(response.message || '注册失败', 'error');
            }
        } catch (error) {
            console.error('注册错误:', error);
            this.showToast('注册失败，请稍后重试', 'error');
        }
    }

    logout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('token');
        this.updateUI();
        this.showToast('已退出登录', 'info');
    }

    switchTab(tab) {
        this.activeTab = tab;
        
        // 更新标签页样式
        document.querySelectorAll('.tab-active').forEach(el => el.classList.remove('tab-active'));
        
        // 隐藏所有区域
        this.analyzeSection.classList.add('hidden');
        this.generateSection.classList.add('hidden');
        this.historySection.classList.add('hidden');
        
        // 显示对应区域和激活标签页
        if (tab === 'analyze') {
            this.tabAnalyze.classList.add('tab-active');
            this.analyzeSection.classList.remove('hidden');
            this.resultTitle.textContent = '拆解结果';
        } else if (tab === 'generate') {
            this.tabGenerate.classList.add('tab-active');
            this.generateSection.classList.remove('hidden');
            this.resultTitle.textContent = '生成结果';
        } else if (tab === 'history') {
            this.tabHistory.classList.add('tab-active');
            this.historySection.classList.remove('hidden');
            this.resultTitle.textContent = '历史记录';
            this.loadHistory();
        }
    }

    async handleAnalyze() {
        if (!this.currentUser) {
            this.showToast('请先登录', 'error');
            return;
        }
        
        const contentText = this.content.value.trim();
        if (!contentText) {
            this.showToast('请先粘贴小红书笔记内容', 'error');
            return;
        }
        
        const model = this.getSelectedModel('model');
        const showThinking = this.showThinking.checked;
        const useDeepAnalysis = this.deepAnalysis.checked;
        
        this.setLoading(true, `正在使用${model === 'claude' ? 'Claude-3.7-Sonnet' : 'DeepSeek-R1'}拆解文案${useDeepAnalysis ? '（深度分析中）' : ''}...`);
        
        try {
            const response = await this.api('/api/analyze', 'POST', {
                content: contentText,
                model,
                showThinking,
                useDeepAnalysis
            });
            
            if (response.success) {
                this.currentResult = response.data.content;
                this.displayResult(response.data.content, showThinking, model);
                this.updateUserCredits(response.data.remainingCredits);
                this.showToast('拆解完成！', 'success');
            } else {
                this.showToast(response.message || '拆解失败', 'error');
                this.result.innerHTML = `<div class="text-red-500 p-4 border border-red-300 rounded bg-red-50 dark:bg-red-900 dark:border-red-700">拆解失败: ${response.message}</div>`;
            }
        } catch (error) {
            console.error('拆解失败:', error);
            this.showToast('拆解失败，请稍后重试', 'error');
            this.result.innerHTML = `<div class="text-red-500 p-4 border border-red-300 rounded">拆解失败，请稍后重试</div>`;
        } finally {
            this.setLoading(false);
        }
    }

    async handleGenerate() {
        if (!this.currentUser) {
            this.showToast('请先登录', 'error');
            return;
        }
        
        const originalText = this.originalContent.value.trim();
        const topic = this.newTopic.value.trim();
        
        if (!originalText) {
            this.showToast('请先粘贴原始小红书笔记内容', 'error');
            return;
        }
        
        if (!topic) {
            this.showToast('请输入新的主题或产品', 'error');
            return;
        }
        
        const model = this.getSelectedModel('gen-model');
        const showThinking = this.genShowThinking.checked;
        const useDeepAnalysis = this.genDeepAnalysis.checked;
        
        this.setLoading(true, `正在使用${model === 'claude' ? 'Claude-3.7-Sonnet' : 'DeepSeek-R1'}生成新文案${useDeepAnalysis ? '（高质量模式）' : ''}...`);
        
        try {
            const response = await this.api('/api/generate', 'POST', {
                originalContent: originalText,
                newTopic: topic,
                model,
                showThinking,
                useDeepAnalysis
            });
            
            if (response.success) {
                this.currentResult = response.data.content;
                this.displayResult(response.data.content, showThinking, model);
                this.updateUserCredits(response.data.remainingCredits);
                this.showToast('生成完成！', 'success');
            } else {
                this.showToast(response.message || '生成失败', 'error');
                this.result.innerHTML = `<div class="text-red-500 p-4 border border-red-300 rounded bg-red-50 dark:bg-red-900 dark:border-red-700">生成失败: ${response.message}</div>`;
            }
        } catch (error) {
            console.error('生成失败:', error);
            this.showToast('生成失败，请稍后重试', 'error');
            this.result.innerHTML = `<div class="text-red-500 p-4 border border-red-300 rounded">生成失败，请稍后重试</div>`;
        } finally {
            this.setLoading(false);
        }
    }

    displayResult(content, showThinking, model) {
        if (showThinking && model === 'claude') {
            // 处理思考过程的显示
            const thinkingMatch = content.match(/### 思考过程：([\s\S]*?)(?=### 结果：)/);
            const resultMatch = content.match(/### 结果：([\s\S]*)/);
            
            if (thinkingMatch && resultMatch) {
                const thinkingContent = thinkingMatch[1].trim();
                const resultContent = resultMatch[1].trim();
                
                const formattedContent = `
                    <div class="thinking-section">
                        <h3 class="text-purple-600 dark:text-purple-400 font-medium">思考过程</h3>
                        ${marked.parse(thinkingContent)}
                    </div>
                    <h3 class="text-red-500 font-medium">结果</h3>
                    ${marked.parse(resultContent)}
                `;
                
                this.result.innerHTML = formattedContent;
            } else {
                this.result.innerHTML = marked.parse(content);
            }
        } else {
            this.result.innerHTML = marked.parse(content);
        }
    }

    updateUserCredits(credits) {
        if (this.currentUser) {
            this.currentUser.credits = credits;
            this.credits.textContent = credits;
            this.updateCreditsAlert();
        }
    }

    async loadHistory(page = 1) {
        if (!this.currentUser) return;
        
        try {
            const response = await this.api(`/api/history?page=${page}&limit=10`, 'GET');
            
            if (response.success) {
                this.displayHistory(response.data);
            } else {
                this.showToast('加载历史记录失败', 'error');
            }
        } catch (error) {
            console.error('加载历史记录失败:', error);
            this.showToast('加载历史记录失败', 'error');
        }
    }

    displayHistory(data) {
        const { history, page, totalPages, total } = data;
        
        if (history.length === 0) {
            this.historyList.innerHTML = '<p class="text-gray-500 text-center py-4">暂无使用记录</p>';
            this.historyPagination.innerHTML = '';
            return;
        }
        
        // 渲染历史记录
        this.historyList.innerHTML = history.map(item => `
            <div class="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                <div class="flex justify-between items-start mb-2">
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-1 text-xs rounded ${item.actionType === 'analyze' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}">
                            ${item.actionType === 'analyze' ? '拆解' : '生成'}
                        </span>
                        <span class="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">
                            ${item.model === 'claude' ? 'Claude' : 'DeepSeek'}
                        </span>
                        <span class="text-xs text-gray-500">
                            ${item.processingTime}ms
                        </span>
                    </div>
                    <span class="text-xs text-gray-500">
                        ${new Date(item.createdAt).toLocaleString()}
                    </span>
                </div>
                ${item.newTopic ? `<p class="text-sm text-gray-600 dark:text-gray-400 mb-1">主题: ${item.newTopic}</p>` : ''}
                <div class="text-sm text-gray-500">
                    积分消耗: ${item.creditsUsed} | 状态: 
                    <span class="${item.status === 'success' ? 'text-green-600' : 'text-red-600'}">
                        ${item.status === 'success' ? '成功' : '失败'}
                    </span>
                </div>
            </div>
        `).join('');
        
        // 渲染分页
        if (totalPages > 1) {
            const pagination = [];
            for (let i = 1; i <= totalPages; i++) {
                pagination.push(`
                    <button class="px-3 py-1 mx-1 rounded ${i === page ? 'bg-red-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}" 
                            onclick="app.loadHistory(${i})">
                        ${i}
                    </button>
                `);
            }
            this.historyPagination.innerHTML = `
                <div class="flex items-center">
                    <span class="text-sm text-gray-500 mr-4">共 ${total} 条记录</span>
                    ${pagination.join('')}
                </div>
            `;
        } else {
            this.historyPagination.innerHTML = '';
        }
    }

    getSelectedModel(name) {
        const radios = document.getElementsByName(name);
        for (const radio of radios) {
            if (radio.checked) {
                return radio.value;
            }
        }
        return 'claude';
    }

    setLoading(isLoading, text = '处理中...') {
        if (isLoading) {
            this.loading.classList.remove('hidden');
            this.loadingText.textContent = text;
            this.result.innerHTML = '';
        } else {
            this.loading.classList.add('hidden');
        }
    }

    copyResult() {
        const textToCopy = this.currentResult || this.result.textContent.trim();
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                const originalText = this.copyBtn.textContent;
                this.copyBtn.textContent = '已复制';
                setTimeout(() => {
                    this.copyBtn.textContent = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('复制失败:', err);
                this.showToast('复制失败', 'error');
            });
    }

    async api(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        
        if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
        }
        
        if (data) {
            config.body = JSON.stringify(data);
        }
        
        const response = await fetch(endpoint, config);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    }

    showToast(message, type = 'info') {
        // 创建toast通知
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-full`;
        
        switch (type) {
            case 'success':
                toast.className += ' bg-green-500 text-white';
                break;
            case 'error':
                toast.className += ' bg-red-500 text-white';
                break;
            case 'warning':
                toast.className += ' bg-yellow-500 text-white';
                break;
            default:
                toast.className += ' bg-blue-500 text-white';
        }
        
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // 显示动画
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // 自动隐藏
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

// 初始化应用
const app = new XiaohongshuAssistant(); 