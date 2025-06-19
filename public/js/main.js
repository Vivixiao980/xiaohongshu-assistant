// 注册表单提交
$('#register-form').on('submit', async function (e) {
    e.preventDefault();
    const username = $('#register-username').val();
    const email = $('#register-email').val();
    const password = $('#register-password').val();
    // 不再从前端获取用户类型，后端将默认为 'trial'
    
    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }) // 移除了 userType
        });
        const data = await response.json();
        if (data.success) {
            showAlert('注册成功！已为您自动登录。', 'success');
            localStorage.setItem('token', data.token);
            await fetchUserInfo();
            $('#register-modal').addClass('hidden');
            $('#login-modal').addClass('hidden');
        } else {
            showAlert(data.message, 'error');
        }
    } catch (error) {
        showAlert('注册请求失败，请检查网络连接。', 'error');
    }
}); 