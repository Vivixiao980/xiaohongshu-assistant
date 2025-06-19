$(document).ready(function() {
    $('#standalone-register-form').on('submit', async function(e) {
        e.preventDefault();
        
        const username = $('#register-username').val();
        const email = $('#register-email').val();
        const password = $('#register-password').val();

        // 按钮加载状态
        const button = $(this).find('button[type="submit"]');
        const originalButtonText = button.html();
        button.prop('disabled', true).html('注册中...');

        try {
            const response = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            const data = await response.json();

            if (data.success) {
                showAlert('注册成功！正在为您跳转...', 'success');
                localStorage.setItem('token', data.token);
                
                // 延迟2秒后跳转到主页
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 2000);

            } else {
                showAlert(data.message, 'error');
                button.prop('disabled', false).html(originalButtonText);
            }
        } catch (error) {
            showAlert('注册请求失败，请检查网络连接。', 'error');
            button.prop('disabled', false).html(originalButtonText);
        }
    });
});

// 全局的Alert函数
function showAlert(message, type = 'info') {
    const alert = $(`
        <div class="p-4 mb-4 text-sm rounded-lg" role="alert" style="display: none;">
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
    alert.fadeIn(500);
    setTimeout(() => alert.fadeOut(500, () => alert.remove()), 4000);
} 