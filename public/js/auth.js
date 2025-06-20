$(document).ready(function () {
    // =================================================================
    // 1. 标签切换功能
    // =================================================================
    $('#login-tab').on('click', function() {
        switchToLogin();
    });

    $('#register-tab').on('click', function() {
        switchToRegister();
    });

    function switchToLogin() {
        $('#login-tab').removeClass('tab-inactive').addClass('tab-active');
        $('#register-tab').removeClass('tab-active').addClass('tab-inactive');
        $('#login-form-container').removeClass('hidden');
        $('#register-form-container').addClass('hidden');
        $('#email-verification-container').addClass('hidden');
    }

    function switchToRegister() {
        $('#register-tab').removeClass('tab-inactive').addClass('tab-active');
        $('#login-tab').removeClass('tab-active').addClass('tab-inactive');
        $('#register-form-container').removeClass('hidden');
        $('#login-form-container').addClass('hidden');
        $('#email-verification-container').addClass('hidden');
    }

    // =================================================================
    // 2. 登录功能
    // =================================================================
    $('#login-form').on('submit', async function (e) {
        e.preventDefault();
        
        const identifier = $('#login-identifier').val().trim();
        const password = $('#login-password').val().trim();
        
        if (!identifier || !password) {
            showAlert('请填写完整的登录信息', 'warning');
            return;
        }

        const submitBtn = $(this).find('button[type="submit"]');
        const originalText = submitBtn.text();
        submitBtn.prop('disabled', true).text('登录中...');
        
        try {
            const response = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('登录成功！正在跳转...', 'success');
                localStorage.setItem('token', data.token);
                
                // 延迟跳转到主页
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);
                
            } else {
                showAlert(data.message || '登录失败，请检查用户名和密码', 'error');
            }
        } catch (error) {
            console.error('登录错误:', error);
            showAlert('登录请求失败，请检查网络连接', 'error');
        } finally {
            submitBtn.prop('disabled', false).text(originalText);
        }
    });

    // =================================================================
    // 3. 注册功能
    // =================================================================
    let registrationData = {};

    $('#register-form').on('submit', async function (e) {
        e.preventDefault();
        
        const username = $('#register-username').val().trim();
        const email = $('#register-email').val().trim();
        const password = $('#register-password').val();
        const confirmPassword = $('#register-confirm-password').val();
        const phone = $('#register-phone').val().trim();
        const agreement = $('#register-agreement').is(':checked');

        // 客户端验证
        if (!validateRegistrationForm(username, email, password, confirmPassword, agreement)) {
            return;
        }

        // 保存注册数据
        registrationData = { username, email, password, phone };

        const submitBtn = $(this).find('button[type="submit"]');
        const originalText = submitBtn.text();
        submitBtn.prop('disabled', true).text('发送验证码...');
        
        try {
            // 发送邮箱验证码
            const response = await fetch('/auth/send-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('验证码已发送到您的邮箱', 'success');
                showEmailVerification(email);
            } else {
                showAlert(data.message || '发送验证码失败', 'error');
            }
        } catch (error) {
            console.error('发送验证码错误:', error);
            showAlert('发送验证码失败，请检查网络连接', 'error');
        } finally {
            submitBtn.prop('disabled', false).text(originalText);
        }
    });

    function validateRegistrationForm(username, email, password, confirmPassword, agreement) {
        // 用户名验证
        if (!username) {
            showAlert('请输入用户名', 'warning');
            $('#register-username').focus();
            return false;
        }
        if (username.length < 3 || username.length > 20) {
            showAlert('用户名长度必须在3-20位之间', 'warning');
            $('#register-username').focus();
            return false;
        }
        if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
            showAlert('用户名只能包含字母、数字、下划线和中文', 'warning');
            $('#register-username').focus();
            return false;
        }

        // 邮箱验证
        if (!email) {
            showAlert('请输入邮箱地址', 'warning');
            $('#register-email').focus();
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showAlert('请输入有效的邮箱地址', 'warning');
            $('#register-email').focus();
            return false;
        }

        // 密码验证
        if (!password) {
            showAlert('请输入密码', 'warning');
            $('#register-password').focus();
            return false;
        }
        if (password.length < 6) {
            showAlert('密码长度至少6位', 'warning');
            $('#register-password').focus();
            return false;
        }

        // 确认密码验证
        if (password !== confirmPassword) {
            showAlert('两次输入的密码不一致', 'warning');
            $('#register-confirm-password').focus();
            return false;
        }

        // 用户协议验证
        if (!agreement) {
            showAlert('请阅读并同意用户协议和隐私政策', 'warning');
            return false;
        }

        return true;
    }

    // =================================================================
    // 4. 邮箱验证功能
    // =================================================================
    function showEmailVerification(email) {
        $('#email-verification-container').removeClass('hidden');
        $('#login-form-container').addClass('hidden');
        $('#register-form-container').addClass('hidden');
        $('#verification-email').text(email);
        
        // 聚焦到第一个验证码输入框
        $('.verification-input').first().focus();
        
        // 开始倒计时
        startResendCountdown();
    }

    // 验证码输入框自动跳转
    $('.verification-input').on('input', function() {
        const value = $(this).val();
        const index = parseInt($(this).data('index'));
        
        if (value && index < 5) {
            $('.verification-input').eq(index + 1).focus();
        }
        
        // 检查是否所有验证码都已输入
        if (getAllVerificationCode().length === 6) {
            // 自动提交验证
            setTimeout(() => {
                $('#verification-form').submit();
            }, 500);
        }
    });

    // 验证码输入框退格处理
    $('.verification-input').on('keydown', function(e) {
        const index = parseInt($(this).data('index'));
        
        if (e.key === 'Backspace' && !$(this).val() && index > 0) {
            $('.verification-input').eq(index - 1).focus();
        }
    });

    function getAllVerificationCode() {
        let code = '';
        $('.verification-input').each(function() {
            code += $(this).val();
        });
        return code;
    }

    // 验证邮箱表单提交
    $('#verification-form').on('submit', async function (e) {
        e.preventDefault();
        
        const verificationCode = getAllVerificationCode();
        
        if (verificationCode.length !== 6) {
            showAlert('请输入完整的6位验证码', 'warning');
            return;
        }

        const submitBtn = $(this).find('button[type="submit"]');
        const originalText = submitBtn.text();
        submitBtn.prop('disabled', true).text('验证中...');
        
        try {
            // 验证邮箱并完成注册
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...registrationData,
                    verificationCode
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('注册成功！正在跳转...', 'success');
                
                // 自动登录
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }
                
                // 延迟跳转到主页
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
                
            } else {
                showAlert(data.message || '验证失败', 'error');
                
                // 如果验证码错误，清空输入框
                if (data.message && data.message.includes('验证码')) {
                    $('.verification-input').val('').first().focus();
                }
            }
        } catch (error) {
            console.error('验证错误:', error);
            showAlert('验证失败，请检查网络连接', 'error');
        } finally {
            submitBtn.prop('disabled', false).text(originalText);
        }
    });

    // 重新发送验证码
    let resendCountdown = 0;
    
    $('#resend-code').on('click', async function() {
        if (resendCountdown > 0) return;
        
        const email = registrationData.email;
        
        try {
            const response = await fetch('/auth/send-verification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showAlert('验证码已重新发送', 'success');
                startResendCountdown();
            } else {
                showAlert(data.message || '重新发送失败', 'error');
            }
        } catch (error) {
            console.error('重新发送错误:', error);
            showAlert('重新发送失败，请检查网络连接', 'error');
        }
    });

    function startResendCountdown() {
        resendCountdown = 60;
        const button = $('#resend-code');
        const countdown = $('#countdown');
        
        button.prop('disabled', true).addClass('opacity-50');
        
        const timer = setInterval(() => {
            countdown.text(`(${resendCountdown}s)`);
            resendCountdown--;
            
            if (resendCountdown < 0) {
                clearInterval(timer);
                button.prop('disabled', false).removeClass('opacity-50');
                countdown.text('');
            }
        }, 1000);
    }

    // =================================================================
    // 5. 表单验证和用户体验优化
    // =================================================================
    
    // 实时验证用户名
    $('#register-username').on('blur', function() {
        const username = $(this).val().trim();
        if (username && !/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(username)) {
            setFieldError($(this), '用户名只能包含字母、数字、下划线和中文');
        } else if (username && (username.length < 3 || username.length > 20)) {
            setFieldError($(this), '用户名长度必须在3-20位之间');
        } else {
            setFieldSuccess($(this));
        }
    });

    // 实时验证邮箱
    $('#register-email').on('blur', function() {
        const email = $(this).val().trim();
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFieldError($(this), '请输入有效的邮箱地址');
        } else {
            setFieldSuccess($(this));
        }
    });

    // 实时验证密码
    $('#register-password').on('input', function() {
        const password = $(this).val();
        if (password.length > 0) {
            const strength = calculatePasswordStrength(password);
            showPasswordStrength(strength, $(this));
        } else {
            hidePasswordStrength($(this));
        }
    });

    // 实时验证确认密码
    $('#register-confirm-password').on('blur', function() {
        const password = $('#register-password').val();
        const confirmPassword = $(this).val();
        
        if (confirmPassword && password !== confirmPassword) {
            setFieldError($(this), '两次输入的密码不一致');
        } else {
            setFieldSuccess($(this));
        }
    });

    function setFieldError(field, message) {
        field.removeClass('border-gray-200 border-green-400').addClass('border-red-400');
        field.siblings('.error-message').remove();
        field.after(`<p class="error-message text-red-500 text-sm mt-1">${message}</p>`);
    }

    function setFieldSuccess(field) {
        field.removeClass('border-gray-200 border-red-400').addClass('border-green-400');
        field.siblings('.error-message').remove();
    }

    function calculatePasswordStrength(password) {
        let score = 0;
        let feedback = [];

        if (password.length >= 8) score += 2;
        else if (password.length >= 6) score += 1;
        else feedback.push('至少6位字符');

        if (/\d/.test(password)) score += 1;
        else feedback.push('包含数字');

        if (/[a-z]/.test(password)) score += 1;
        else feedback.push('包含小写字母');

        if (/[A-Z]/.test(password)) score += 1;
        else feedback.push('包含大写字母');

        if (/[^A-Za-z0-9]/.test(password)) score += 1;
        else feedback.push('包含特殊字符');

        return { score, feedback };
    }

    function showPasswordStrength(strength, field) {
        field.siblings('.password-strength').remove();

        let strengthText, strengthColor, strengthClass;
        
        if (strength.score < 2) {
            strengthText = '弱';
            strengthColor = 'text-red-500';
            strengthClass = 'bg-red-500';
        } else if (strength.score < 4) {
            strengthText = '中';
            strengthColor = 'text-yellow-500';
            strengthClass = 'bg-yellow-500';
        } else {
            strengthText = '强';
            strengthColor = 'text-green-500';
            strengthClass = 'bg-green-500';
        }

        const strengthIndicator = $(`
            <div class="password-strength mt-2">
                <div class="flex items-center space-x-2 mb-1">
                    <span class="text-sm text-gray-600">密码强度：</span>
                    <span class="text-sm font-medium ${strengthColor}">${strengthText}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                    <div class="${strengthClass} h-2 rounded-full transition-all duration-300" style="width: ${(strength.score / 5) * 100}%"></div>
                </div>
                ${strength.feedback.length > 0 ? `<p class="text-xs text-gray-500 mt-1">建议：${strength.feedback.join('、')}</p>` : ''}
            </div>
        `);

        field.after(strengthIndicator);
    }

    function hidePasswordStrength(field) {
        field.siblings('.password-strength').remove();
    }

    // =================================================================
    // 6. 检查是否已登录
    // =================================================================
    const token = localStorage.getItem('token');
    if (token) {
        // 如果已经登录，直接跳转到主页
        window.location.href = '/';
    }
});

// =================================================================
// 7. 全局通知函数
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
    }, 5000);
} 