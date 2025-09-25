/**
 * 视频转文字工具 - JavaScript
 * 使用 yt-dlp + Whisper 技术
 */

// 全局变量
let currentTranscriptionData = null;
let processingTimeout = null;

// 文档加载完成后初始化
$(document).ready(function() {
    initializeApp();
});

/**
 * 初始化应用
 */
function initializeApp() {
    console.log('🎬 视频转文字工具初始化中...');
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 检查剪贴板权限
    checkClipboardPermission();
    
    console.log('✅ 初始化完成');
}

/**
 * 绑定事件监听器
 */
function bindEventListeners() {
    // 开始转换按钮
    $('#start-transcribe').click(startVideoTranscribe);
    
    // 粘贴按钮
    $('#paste-btn').click(pasteFromClipboard);
    
    // 输入框回车键
    $('#video-url').keypress(function(e) {
        if (e.which === 13) { // Enter键
            startVideoTranscribe();
        }
    });
    
    // 结果操作按钮
    $('#copy-result').click(copyResult);
    $('#download-txt').click(downloadTxt);
    $('#download-srt').click(downloadSrt);
    $('#new-conversion').click(resetInterface);
    
    // 清除错误状态的输入框事件
    $('#video-url').on('input', function() {
        $(this).removeClass('border-red-500').addClass('border-gray-200');
    });
}

/**
 * 检查剪贴板权限
 */
function checkClipboardPermission() {
    if (navigator.clipboard && navigator.clipboard.readText) {
        $('#paste-btn').show();
    } else {
        $('#paste-btn').hide();
    }
}

/**
 * 从剪贴板粘贴内容
 */
async function pasteFromClipboard() {
    try {
        const text = await navigator.clipboard.readText();
        if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
            $('#video-url').val(text);
            showToast('已粘贴链接', 'success');
        } else {
            showToast('剪贴板中没有有效的URL', 'warning');
        }
    } catch (err) {
        console.error('读取剪贴板失败:', err);
        showToast('无法访问剪贴板', 'error');
    }
}

/**
 * 开始视频转文字
 */
function startVideoTranscribe() {
    const videoUrl = $('#video-url').val().trim();
    const quality = $('#transcribe-quality').val();
    const outputFormat = $('#output-format').val();
    
    // 验证输入
    if (!validateInput(videoUrl)) {
        return;
    }
    
    // 显示进度界面
    showProgressSection();
    
    // 准备请求数据
    const requestData = {
        videoUrl: videoUrl,
        quality: quality,
        outputFormat: outputFormat
    };
    
    console.log('🚀 开始视频转文字:', requestData);
    
    // 模拟进度更新
    startProgressSimulation();
    
    // 发送API请求
    $.ajax({
        url: '/api/video-transcribe',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        data: JSON.stringify(requestData),
        timeout: 15 * 60 * 1000, // 15分钟超时
        success: function(response) {
            console.log('✅ 转换成功:', response);
            stopProgressSimulation();
            
            if (response.success) {
                currentTranscriptionData = response.data;
                showResultSection(response.data);
                showToast('视频转文字完成！', 'success');
            } else {
                showError(response.message || '转换失败，请重试');
            }
        },
        error: function(xhr, status, error) {
            console.error('❌ 转换失败:', error);
            stopProgressSimulation();
            
            let errorMessage = '转换失败，请稍后重试';
            
            if (xhr.status === 408) {
                errorMessage = '处理超时，请尝试较短的视频';
            } else if (xhr.status === 400) {
                errorMessage = '请检查视频链接是否正确';
            } else if (xhr.responseJSON && xhr.responseJSON.message) {
                errorMessage = xhr.responseJSON.message;
            } else if (status === 'timeout') {
                errorMessage = '请求超时，视频可能过长或网络不稳定';
            }
            
            showError(errorMessage);
        }
    });
}

/**
 * 验证输入
 */
function validateInput(videoUrl) {
    // 清除之前的错误状态
    $('#video-url').removeClass('border-red-500');
    
    if (!videoUrl) {
        showFieldError('#video-url', '请输入视频链接');
        return false;
    }
    
    if (!isValidUrl(videoUrl)) {
        showFieldError('#video-url', '请输入有效的视频链接');
        return false;
    }
    
    return true;
}

/**
 * 检查URL是否有效
 */
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

/**
 * 显示字段错误
 */
function showFieldError(selector, message) {
    $(selector).addClass('border-red-500').focus();
    showToast(message, 'error');
}

/**
 * 显示进度界面
 */
function showProgressSection() {
    $('#progress-section').removeClass('hidden').addClass('fade-in');
    $('#progress-bar').css('width', '0%');
    $('#progress-text').text('准备开始...');
    
    // 禁用表单
    $('#start-transcribe').prop('disabled', true).html('<i class="fas fa-spinner fa-spin mr-2"></i>转换中...');
}

/**
 * 开始进度模拟
 */
function startProgressSimulation() {
    let progress = 0;
    const steps = [
        { progress: 20, text: '正在下载视频...' },
        { progress: 40, text: '视频下载完成，开始语音识别...' },
        { progress: 70, text: 'AI 正在分析语音内容...' },
        { progress: 90, text: '生成文字稿中...' }
    ];
    
    let currentStep = 0;
    
    processingTimeout = setInterval(() => {
        if (currentStep < steps.length) {
            const step = steps[currentStep];
            progress = step.progress;
            $('#progress-bar').css('width', progress + '%');
            $('#progress-text').text(step.text);
            currentStep++;
        }
    }, 3000); // 每3秒更新一次
}

/**
 * 停止进度模拟
 */
function stopProgressSimulation() {
    if (processingTimeout) {
        clearInterval(processingTimeout);
        processingTimeout = null;
    }
    
    // 完成进度
    $('#progress-bar').css('width', '100%');
    $('#progress-text').text('转换完成！');
}

/**
 * 显示结果界面
 */
function showResultSection(data) {
    // 隐藏进度，显示结果
    $('#progress-section').addClass('hidden');
    $('#result-section').removeClass('hidden').addClass('fade-in');
    
    // 设置视频信息
    $('#video-title').html(`<i class="fas fa-video mr-1"></i>${data.title || '未知标题'}`);
    $('#video-duration').html(`<i class="fas fa-clock mr-1"></i>${data.duration || '未知时长'}`);
    
    // 设置转换结果
    let resultText = '';
    if (data.segments && data.segments.length > 0) {
        resultText = formatTranscriptionResult(data);
    } else {
        resultText = data.text || '转换结果为空';
    }
    
    $('#transcription-result').text(resultText);
    
    // 滚动到结果区域
    $('html, body').animate({
        scrollTop: $('#result-section').offset().top - 100
    }, 500);
}

/**
 * 格式化转换结果
 */
function formatTranscriptionResult(data) {
    const outputFormat = $('#output-format').val();
    let result = '';
    
    switch (outputFormat) {
        case 'detailed':
            // 详细格式 - 带时间戳
            if (data.segments) {
                data.segments.forEach((segment, index) => {
                    const startTime = formatTime(segment.start);
                    const endTime = formatTime(segment.end);
                    result += `[${startTime} - ${endTime}] ${segment.text.trim()}\n\n`;
                });
            }
            break;
            
        case 'simple':
            // 简洁格式 - 纯文本
            if (data.segments) {
                data.segments.forEach(segment => {
                    result += segment.text.trim() + ' ';
                });
            } else {
                result = data.text || '';
            }
            result = result.trim();
            break;
            
        case 'srt':
            // SRT 字幕格式
            if (data.segments) {
                data.segments.forEach((segment, index) => {
                    const startTime = formatSrtTime(segment.start);
                    const endTime = formatSrtTime(segment.end);
                    result += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n\n`;
                });
            }
            break;
            
        default:
            result = data.text || '';
    }
    
    return result || '转换结果为空';
}

/**
 * 格式化时间 (MM:SS)
 */
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 格式化SRT时间 (HH:MM:SS,mmm)
 */
function formatSrtTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * 复制结果到剪贴板
 */
async function copyResult() {
    const resultText = $('#transcription-result').text();
    
    try {
        await navigator.clipboard.writeText(resultText);
        showToast('已复制到剪贴板', 'success');
        
        // 临时改变按钮样式
        const $btn = $('#copy-result');
        const originalHtml = $btn.html();
        $btn.html('<i class="fas fa-check mr-2"></i>已复制').removeClass('btn-primary').addClass('bg-green-500');
        
        setTimeout(() => {
            $btn.html(originalHtml).removeClass('bg-green-500').addClass('btn-primary');
        }, 2000);
        
    } catch (err) {
        console.error('复制失败:', err);
        showToast('复制失败，请手动选择文本', 'error');
    }
}

/**
 * 下载TXT文件
 */
function downloadTxt() {
    const resultText = $('#transcription-result').text();
    const title = currentTranscriptionData?.title || 'video-transcription';
    const filename = `${sanitizeFilename(title)}.txt`;
    
    downloadTextFile(resultText, filename, 'text/plain');
    showToast('TXT文件下载开始', 'success');
}

/**
 * 下载SRT文件
 */
function downloadSrt() {
    let srtContent = '';
    
    if (currentTranscriptionData && currentTranscriptionData.segments) {
        currentTranscriptionData.segments.forEach((segment, index) => {
            const startTime = formatSrtTime(segment.start);
            const endTime = formatSrtTime(segment.end);
            srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n\n`;
        });
    } else {
        srtContent = $('#transcription-result').text();
    }
    
    const title = currentTranscriptionData?.title || 'video-transcription';
    const filename = `${sanitizeFilename(title)}.srt`;
    
    downloadTextFile(srtContent, filename, 'text/srt');
    showToast('SRT文件下载开始', 'success');
}

/**
 * 下载文本文件
 */
function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
}

/**
 * 清理文件名
 */
function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.-]/g, '_').substring(0, 50);
}

/**
 * 重置界面
 */
function resetInterface() {
    // 隐藏结果和进度
    $('#result-section, #progress-section').addClass('hidden');
    
    // 重置表单
    $('#video-url').val('').removeClass('border-red-500').addClass('border-gray-200');
    $('#transcribe-quality').val('base');
    $('#output-format').val('detailed');
    
    // 重置按钮
    $('#start-transcribe').prop('disabled', false).html('<i class="fas fa-play mr-2"></i>开始转换');
    
    // 清除数据
    currentTranscriptionData = null;
    
    // 滚动到顶部
    $('html, body').animate({ scrollTop: 0 }, 500);
}

/**
 * 显示错误
 */
function showError(message) {
    $('#progress-section').addClass('hidden');
    $('#result-section').addClass('hidden');
    
    // 重置按钮
    $('#start-transcribe').prop('disabled', false).html('<i class="fas fa-play mr-2"></i>开始转换');
    
    showToast(message, 'error');
}

/**
 * 显示Toast通知
 */
function showToast(message, type = 'info') {
    const $toast = $('#toast');
    const $icon = $('#toast-icon');
    const $message = $('#toast-message');
    
    // 设置图标和样式
    let iconClass = '';
    let bgClass = '';
    
    switch (type) {
        case 'success':
            iconClass = 'fas fa-check-circle text-green-500';
            bgClass = 'border-green-200 bg-green-50';
            break;
        case 'error':
            iconClass = 'fas fa-exclamation-circle text-red-500';
            bgClass = 'border-red-200 bg-red-50';
            break;
        case 'warning':
            iconClass = 'fas fa-exclamation-triangle text-yellow-500';
            bgClass = 'border-yellow-200 bg-yellow-50';
            break;
        default:
            iconClass = 'fas fa-info-circle text-blue-500';
            bgClass = 'border-blue-200 bg-blue-50';
    }
    
    $icon.attr('class', iconClass);
    $toast.find('.bg-white').attr('class', `${bgClass} rounded-lg shadow-lg p-4 max-w-xs`);
    $message.text(message);
    
    // 显示Toast
    $toast.removeClass('hidden').addClass('fade-in');
    
    // 3秒后自动隐藏
    setTimeout(() => {
        $toast.addClass('hidden');
    }, 3000);
}

/**
 * 转义HTML
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 错误处理
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('JavaScript错误:', msg, 'at', url, ':', lineNo);
    return false;
};

// 未处理的Promise拒绝
window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise拒绝:', event.reason);
});

console.log('🎬 视频转文字工具 JavaScript 加载完成');
