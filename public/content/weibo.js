let config = {
    enabled: false,
    templates: [],
    requireManualConfirm: false,
    autoScroll: false,
    commentInterval: 10,
    scrollInterval: 5
};

const processedPosts = new Set();
let isWorking = false;
let isProcessingQueue = false;
const postQueue = [];

// --- 可视化调试面板 ---
function initDebugUI() {
    if (document.getElementById('commentx-debug')) return;
    const panel = document.createElement('div');
    panel.id = 'commentx-debug';
    panel.style.cssText = `
        position: fixed; bottom: 20px; left: 20px; 
        background: rgba(0, 0, 0, 0.85); color: #0f0; 
        padding: 12px 16px; border-radius: 8px; z-index: 9999999; 
        font-size: 13px; width: 300px; pointer-events: none; 
        box-shadow: 0 4px 12px rgba(0,0,0,0.4); font-family: monospace; 
        transition: opacity 0.3s;
    `;
    panel.innerHTML = `
        <div style="font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 8px; display: flex; justify-content: space-between;">
            <span>🤖 CommentX Agent</span>
            <span id="cx-status" style="color: #ff4d4f">已暂停</span>
        </div>
        <div id="commentx-log" style="color: #fff; max-height: 120px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;">
            <div style="color: #888">等待初始化...</div>
        </div>
    `;
    document.body.appendChild(panel);
}

function updateStatus(running) {
    const el = document.getElementById('cx-status');
    if (el) {
        el.textContent = running ? '运行中' : '已暂停';
        el.style.color = running ? '#52c41a' : '#ff4d4f';
    }
}

function log(msg, type = 'info') {
    console.log(`[CommentX] ${msg}`);
    const logContainer = document.getElementById('commentx-log');
    if (logContainer) {
        const color = type === 'error' ? '#ff4d4f' : type === 'warn' ? '#faad14' : '#ffffff';
        const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        
        const line = document.createElement('div');
        line.style.color = color;
        line.textContent = `[${time}] ${msg}`;
        
        logContainer.insertBefore(line, logContainer.firstChild);
        
        // 保持日志不超过 10 条
        while (logContainer.children.length > 10) {
            logContainer.removeChild(logContainer.lastChild);
        }
    }
}

// --- 初始化与监听 ---
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.weiboConfig) {
        config = changes.weiboConfig.newValue;
        initDebugUI();
        if (config.enabled) {
            startAgent();
        } else {
            stopAgent();
        }
    }
});

chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (res) => {
    if (res) {
        config = res;
    }
    initDebugUI();
    if (config.enabled) {
        startAgent();
    } else {
        updateStatus(false);
    }
});

let observer = null;
let scrollInterval = null;

function startAgent() {
    if (isWorking) return;
    
    // 显示调试面板
    const panel = document.getElementById('commentx-debug');
    if (panel) {
        panel.style.display = 'block';
    }
    
    isWorking = true;
    updateStatus(true);
    log('Agent 已启动，正在扫描页面...', 'info');
    
    // 立即执行一次
    setTimeout(findNewPosts, 1000);
    
    // 监听 DOM 变化
    observer = new MutationObserver(() => {
        if (config.enabled) findNewPosts();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    
    // 自动翻页
    if (config.autoScroll) {
        const scrollTimeMs = Math.max((config.scrollInterval || 5) * 1000, 1000);
        scrollInterval = setInterval(() => {
            if (!config.enabled || !config.autoScroll) return;
            // 每次滚动屏幕高度的 80%
            window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
            log(`执行自动向下翻页 (间隔 ${scrollTimeMs/1000}s)`, 'info');
        }, scrollTimeMs);
    }
}

function stopAgent() {
    isWorking = false;
    updateStatus(false);
    if (observer) observer.disconnect();
    if (scrollInterval) clearInterval(scrollInterval);
    log('Agent 已暂停', 'warn');
    
    // 隐藏调试面板
    const panel = document.getElementById('commentx-debug');
    if (panel) {
        panel.style.display = 'none';
    }
}

// 模拟真实的鼠标点击（绕过 Vue/React 拦截）
function simulateClick(el) {
    if (!el) return;
    try {
        // 原生 click 是最可靠的，它会自动冒泡并被 Vue/React 捕获
        // 之前产生双击是因为我们同时用了原生 click 和 dispatchEvent
        el.click();
    } catch (e) {
        // 备用方案
        const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true,
            buttons: 1
        });
        el.dispatchEvent(event);
    }
}

function findNewPosts() {
    if (!config.enabled) return;
    
    // 核心策略改变：不找帖子，直接找页面上所有的“评论按钮”
    // 微博的评论按钮通常包含 title="评论"，或者特定的图标类名
    const commentBtns = Array.from(document.querySelectorAll('div[title="评论"], i.woo-font--comment, span[title="评论"], .woo-box-item-flex[title="评论"]'));
    
    let foundCount = 0;
    
    commentBtns.forEach(btn => {
        // 往上找一个比较大的容器作为帖子的唯一标识，防止重复处理
        const post = btn.closest('article') || 
                     btn.closest('.vue-recycle-scroller__item-view') || 
                     btn.closest('.Feed_retweet_wrapper') || 
                     btn.closest('.woo-panel-main') || 
                     btn.closest('div.card-wrap') || 
                     btn.closest('.wbpro-feed-content');
        
        if (!post) return;
        if (processedPosts.has(post)) return;
        
        // 找到实际可点击的外层区域
        const clickableBtn = btn.closest('.woo-box-item-flex') || btn.closest('div[role="button"]') || btn;
        
        processedPosts.add(post);
        postQueue.push({ post, btn: clickableBtn });
        foundCount++;
    });
    
    if (foundCount > 0) {
        log(`发现 ${foundCount} 个新评论按钮，加入队列`);
        processQueue();
    }
}

async function processQueue() {
    if (isProcessingQueue || postQueue.length === 0 || !config.enabled) return;
    
    isProcessingQueue = true;
    const { post, btn } = postQueue.shift();
    
    await processSinglePost(post, btn);
    
    isProcessingQueue = false;
    
    // 使用用户配置的评论间隔（转换为毫秒），默认最少2秒防止太快
    const intervalMs = Math.max((config.commentInterval || 10) * 1000, 2000);
    log(`等待 ${intervalMs / 1000} 秒后处理下一个...`);
    setTimeout(processQueue, intervalMs);
}

async function processSinglePost(post, commentBtn) {
    if (!config.enabled) return;
    
    if (!config.templates || config.templates.length === 0) {
        log('⚠️ 错误：评论模板库为空！请在扩展中添加。', 'error');
        return;
    }
    
    const template = config.templates[Math.floor(Math.random() * config.templates.length)];

    try {
        log('正在展开评论区...');
        // 稍微滚动到可见区域中心
        commentBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(800);
        
        // 先检查评论区是否已经展开了（寻找 textarea）
        let textarea = post.querySelector('textarea.Form_input_2gtHj, textarea.Form_input_30A14, textarea[placeholder*="评论"], textarea');
        
        if (!textarea || textarea.offsetParent === null) {
            // 点击展开评论
            simulateClick(commentBtn);
            
            // 如果点击外层没反应，尝试点击内层具体元素
            setTimeout(() => {
                const currentTextarea = post.querySelector('textarea');
                if (!currentTextarea || currentTextarea.offsetParent === null) {
                    const inner = commentBtn.querySelector('i, span') || commentBtn;
                    if (inner !== commentBtn) {
                        try { inner.click(); } catch(e){}
                    }
                }
            }, 800);
            
            // 等待输入框渲染（动态轮询等待，最多等待5秒）
            log('等待输入框渲染...');
            textarea = null;
            for (let i = 0; i < 25; i++) {
                await sleep(200);
                
                // 尝试多种可能的输入框选择器，优先找可见的
                const textareas = Array.from(post.querySelectorAll('textarea.Form_input_2gtHj, textarea.Form_input_30A14, textarea[placeholder*="评论"], textarea'));
                textarea = textareas.find(t => t.offsetParent !== null);
                
                // 如果在当前帖子里没找到，尝试在整个文档的活跃元素中找（有些弹窗是挂载在body上的）
                if (!textarea) {
                    const activeEl = document.activeElement;
                    if (activeEl && activeEl.tagName === 'TEXTAREA') {
                        textarea = activeEl;
                    }
                }
                
                if (textarea && textarea.offsetParent !== null) { // 确保是可见的
                    break;
                }
                textarea = null;
            }
        } else {
            log('评论区已处于展开状态');
        }
        
        if (!textarea) {
            log('未找到输入框，可能是该帖子禁止评论或结构变化', 'warn');
            // 既然没找到输入框，也需要进入下一次循环，不应该直接 return 阻断队列
            const intervalMs = Math.max((config.commentInterval || 10) * 1000, 2000);
            log(`等待 ${intervalMs / 1000} 秒后处理下一个...`);
            setTimeout(processQueue, intervalMs);
            return;
        }
        
        log(`正在填入: "${template.substring(0, 10)}..."`);
        
        // 获得焦点
        textarea.focus();
        
        // 绕过底层框架的值绑定拦截
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(textarea, template);
        } else {
            textarea.value = template;
        }
        
        // 触发更加真实的输入事件，确保前端框架捕获到内容变化，激活“发送”按钮
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: template }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        
        // 这里去掉了之前可能导致意外提前提交的 Enter 键触发
        
        if (!config.requireManualConfirm) {
            // 给用户留出视觉停留时间，能看到填入了什么
            await sleep(1500);
            
            // 查找发送按钮 (在 textarea 附近寻找)
            const parent = textarea.closest('.woo-box-flex') || textarea.parentElement.parentElement || post;
            
            // 微博的发送按钮通常包含 'woo-button-main' 类，或者文字是“评论”、“发送”
            const sendBtns = Array.from(parent.querySelectorAll('button, div[role="button"], a')).filter(b => {
                const text = (b.textContent || '').trim();
                const isMainBtn = b.classList && b.classList.contains('woo-button-main');
                return (text === '评论' || text === '发送' || isMainBtn);
            });
            
            // 过滤掉我们刚才点击的那个展开评论区的按钮，通常发送按钮在 DOM 树中比较靠后
            const validSendBtns = sendBtns.filter(b => b !== commentBtn);
            const sendBtn = validSendBtns[validSendBtns.length - 1];
            
            if (sendBtn && !sendBtn.disabled) {
                simulateClick(sendBtn);
                log('✅ 已自动发送评论', 'info');
            } else {
                log('未找到发送按钮或按钮置灰', 'warn');
                // 尝试直接回车提交（部分输入框支持）
                textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
            }
        } else {
            // 注入视觉提示
            if (!textarea.parentElement.querySelector('.commentx-hint')) {
                const hint = document.createElement('div');
                hint.className = 'commentx-hint';
                hint.style.cssText = 'color: #fff; font-size: 13px; margin-top: 8px; padding: 6px 12px; background: #ff4d4f; border-radius: 4px; animation: fadeIn 0.5s; font-weight: bold; display: inline-block; pointer-events: none;';
                hint.textContent = '🤖 CommentX: 已填好草稿，请手动点击发送按钮';
                textarea.parentElement.appendChild(hint);
            }
            log('等待人工确认发送', 'warn');
        }
        
    } catch (error) {
        log(`处理出错: ${error.message}`, 'error');
        console.error('[CommentX]', error);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
