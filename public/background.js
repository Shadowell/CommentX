// 后台服务工作线程，处理状态同步
chrome.runtime.onInstalled.addListener(() => {
  console.log("CommentX Agent 已安装");
  chrome.storage.local.set({
    weiboConfig: {
      enabled: false,
      templates: [
        '这条内容很有启发，感谢分享！',
        '角度很新，已经收藏准备细看。',
        '表达很清晰，期待你后续更新~'
      ],
      requireManualConfirm: true,
      autoScroll: false
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CONFIG') {
    chrome.storage.local.get(['weiboConfig'], (result) => {
      sendResponse(result.weiboConfig);
    });
    return true; // 异步响应
  }
});
