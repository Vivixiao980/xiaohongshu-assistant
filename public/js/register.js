$(document).ready(function () {
    // 表单验证规则
    const validators = {
        username: {
            required: true,
            minLength: 3,
            maxLength: 20,
            pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/,
            message: '用户名长度3-20位，只能包含字母、数字、下划线和中文'
        },
        email: {
            required: true,
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: '请输入有效的邮箱地址'
        },
        password: {
            required: true,
            minLength: 6,
            maxLength: 50,
            message: '密码长度必须在6-50位之间'
        }
    };

    // 实时验证
    $('#username').on('input blur', function() {
        validateField('username', $(this).val());
    });

    $('#email').on('input blur', function() {
        validateField('email', $(this).val());
    });

    $('#password').on('input blur', function() {
        validateField('password', $(this).val());
        // 如果确认密码已填写，重新验证确认密码
        const confirmPassword = $('#confirmPassword').val();
        if (confirmPassword) {
            validatePasswordMatch();
        }
    });

    $('#confirmPassword').on('input blur', function() {
        validatePasswordMatch();
    });

    // 表单提交
    $('#register-form').on('submit', async function (e) {
        e.preventDefault();
        
        const username = $('#username').val().trim();
        const email = $('#email').val().trim();
        const password = $('#password').val();
        const confirmPassword = $('#confirmPassword').val();
        const agreement = $('#agreement').is(':checked');

        // 客户端验证
        if (!validateAllFields(username, email, password, confirmPassword, agreement)) {
            return;
        }

        const submitBtn = $(this).find('button[type="submit"]');
        const originalText = submitBtn.text();
        submitBtn.prop('disabled', true).text('创建中...');

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (data.success) {
                showAlert('注册成功！正在跳转到主页...', 'success');
                
                // 自动登录
                if (data.token) {
                    localStorage.setItem('token', data.token);
                }
                
                // 清空表单
                $('#register-form')[0].reset();
                
                // 延迟跳转到主页
                setTimeout(() => {
                    window.location.href = '/';
                }, 2000);
                
            } else {
                showAlert(data.message || '注册失败，请稍后再试', 'error');
            }
        } catch (error) {
            console.error('注册错误:', error);
            showAlert('注册请求失败，请检查网络连接', 'error');
        } finally {
            submitBtn.prop('disabled', false).text(originalText);
        }
    });

    // 验证单个字段
    function validateField(fieldName, value) {
        const validator = validators[fieldName];
        const field = $(`#${fieldName}`);
        
        if (!validator) return true;

        // 必填验证
        if (validator.required && !value) {
            setFieldError(field, '此字段为必填项');
            return false;
        }

        // 长度验证
        if (validator.minLength && value.length < validator.minLength) {
            setFieldError(field, `最少需要${validator.minLength}个字符`);
            return false;
        }

        if (validator.maxLength && value.length > validator.maxLength) {
            setFieldError(field, `最多允许${validator.maxLength}个字符`);
            return false;
        }

        // 格式验证
        if (validator.pattern && !validator.pattern.test(value)) {
            setFieldError(field, validator.message);
            return false;
        }

        // 验证通过
        setFieldSuccess(field);
        return true;
    }

    // 验证密码匹配
    function validatePasswordMatch() {
        const password = $('#password').val();
        const confirmPassword = $('#confirmPassword').val();
        const field = $('#confirmPassword');

        if (!confirmPassword) {
            setFieldError(field, '请确认密码');
            return false;
        }

        if (password !== confirmPassword) {
            setFieldError(field, '两次输入的密码不一致');
            return false;
        }

        setFieldSuccess(field);
        return true;
    }

    // 验证所有字段
    function validateAllFields(username, email, password, confirmPassword, agreement) {
        let isValid = true;

        // 验证各个字段
        if (!validateField('username', username)) isValid = false;
        if (!validateField('email', email)) isValid = false;
        if (!validateField('password', password)) isValid = false;
        if (!validatePasswordMatch()) isValid = false;

        // 验证用户协议
        if (!agreement) {
            showAlert('请阅读并同意用户协议和隐私政策', 'warning');
            isValid = false;
        }

        return isValid;
    }

    // 设置字段错误状态
    function setFieldError(field, message) {
        field.removeClass('border-gray-200 border-green-400')
             .addClass('border-red-400');
        
        // 移除之前的错误消息
        field.siblings('.error-message').remove();
        
        // 添加错误消息
        field.after(`<p class="error-message text-red-500 text-sm mt-1">${message}</p>`);
    }

    // 设置字段成功状态
    function setFieldSuccess(field) {
        field.removeClass('border-gray-200 border-red-400')
             .addClass('border-green-400');
        
        // 移除错误消息
        field.siblings('.error-message').remove();
    }

    // 密码强度检测
    $('#password').on('input', function() {
        const password = $(this).val();
        if (password.length > 0) {
            const strength = calculatePasswordStrength(password);
            showPasswordStrength(strength);
        } else {
            hidePasswordStrength();
        }
    });

    function calculatePasswordStrength(password) {
        let score = 0;
        let feedback = [];

        // 长度检查
        if (password.length >= 8) score += 2;
        else if (password.length >= 6) score += 1;
        else feedback.push('至少6位字符');

        // 包含数字
        if (/\d/.test(password)) score += 1;
        else feedback.push('包含数字');

        // 包含小写字母
        if (/[a-z]/.test(password)) score += 1;
        else feedback.push('包含小写字母');

        // 包含大写字母
        if (/[A-Z]/.test(password)) score += 1;
        else feedback.push('包含大写字母');

        // 包含特殊字符
        if (/[^A-Za-z0-9]/.test(password)) score += 1;
        else feedback.push('包含特殊字符');

        return { score, feedback };
    }

    function showPasswordStrength(strength) {
        // 移除之前的强度指示器
        $('#password').siblings('.password-strength').remove();

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

        $('#password').after(strengthIndicator);
    }

    function hidePasswordStrength() {
        $('#password').siblings('.password-strength').remove();
    }
});

// 全局通知函数
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