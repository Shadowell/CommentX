import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type WeiboConfig = {
  enabled: boolean
  templates: string[]
  requireManualConfirm: boolean
  autoScroll: boolean
  commentInterval: number
  scrollInterval: number
}

const defaultConfig: WeiboConfig = {
  enabled: false,
  templates: [
    '不错，用这个试试#小程序://配料君/0DwAZnZ3DoXw8Je',
    '太赞同了！感觉我们很同频，已经关注啦，欢迎回关交个朋友一起交流~',
    '这篇内容很有价值，学习了！刚好我主页也更新了相关的实操经验，感兴趣可以来看看哦~',
    '说出了我的心声！我也是深耕这方面的，主页有很多干货分享，欢迎来串门鸭！',
  ],
  requireManualConfirm: false, // 默认改为全自动
  autoScroll: false,
  commentInterval: 10, // 默认评论间隔10秒
  scrollInterval: 5 // 默认翻页间隔5秒
}

function App() {
  const [config, setConfig] = useState<WeiboConfig>(defaultConfig)
  const [templateInput, setTemplateInput] = useState('')
  const [isExtension, setIsExtension] = useState(false)

  useEffect(() => {
    // 检测是否在 Chrome 扩展环境中
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      setIsExtension(true)
      chrome.storage.local.get(['weiboConfig'], (result) => {
        if (result.weiboConfig) {
          setConfig(result.weiboConfig as WeiboConfig)
        }
      })
    } else {
      // 本地测试环境的回退
      const saved = localStorage.getItem('weiboConfig')
      if (saved) {
        try {
          setConfig(JSON.parse(saved))
        } catch (e) {
          // ignore
        }
      }
    }
  }, [])

  const saveConfig = (newConfig: WeiboConfig) => {
    setConfig(newConfig)
    if (isExtension) {
      chrome.storage.local.set({ weiboConfig: newConfig })
    } else {
      localStorage.setItem('weiboConfig', JSON.stringify(newConfig))
    }
  }

  const addTemplate = (event: FormEvent) => {
    event.preventDefault()
    const next = templateInput.trim()
    if (!next) return
    saveConfig({ ...config, templates: [...config.templates, next] })
    setTemplateInput('')
  }

  const removeTemplate = (index: number) => {
    saveConfig({
      ...config,
      templates: config.templates.filter((_, idx) => idx !== index),
    })
  }

  const toggleEnabled = () => {
    saveConfig({ ...config, enabled: !config.enabled })
  }

  return (
    <main className="layout" style={{ width: '400px', padding: '20px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <header className="header" style={{ marginBottom: '24px' }}>
        <p className="eyebrow" style={{ color: '#888', fontSize: '12px', margin: 0 }}>CommentX Agent</p>
        <h1 style={{ fontSize: '24px', margin: '8px 0' }}>自动评论机器人</h1>
        <p className="sub" style={{ color: '#555', fontSize: '14px', margin: 0 }}>
          当您打开微博页面时，自动模拟人工操作进行评论和翻页。
        </p>
      </header>

      {!isExtension && (
        <div style={{ background: '#fff3cd', color: '#856404', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          ⚠️ 当前非浏览器扩展环境。配置将仅保存在本地。请将此项目构建并作为 Chrome 扩展加载以使其在微博上生效。
        </div>
      )}

      <section style={{ background: '#f8f9fa', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <strong style={{ fontSize: '16px' }}>主开关：自动处理</strong>
          <button 
            onClick={toggleEnabled}
            style={{ 
              padding: '8px 24px', 
              background: config.enabled ? '#28a745' : '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'background 0.2s'
            }}
          >
            {config.enabled ? '已启动 (运行中)' : '已暂停'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input 
              type="checkbox" 
              checked={config.requireManualConfirm}
              onChange={(e) => saveConfig({ ...config, requireManualConfirm: e.target.checked })}
              style={{ width: '16px', height: '16px' }}
            />
            <span>需人工确认后发送（安全模式）</span>
          </label>
          <p style={{ margin: 0, paddingLeft: '24px', fontSize: '12px', color: '#666' }}>
            开启后，Agent 会帮您填好评论草稿，但需您亲自点击发送。
          </p>

          <div style={{ marginTop: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
              <input 
                type="checkbox" 
                checked={config.autoScroll}
                onChange={(e) => saveConfig({ ...config, autoScroll: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
              <span>开启自动向下翻页</span>
            </label>
            
            {config.autoScroll && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginTop: '8px', paddingLeft: '24px' }}>
                <span>翻页间隔时间（秒）：</span>
                <input 
                  type="number" 
                  min="1"
                  value={config.scrollInterval || 5}
                  onChange={(e) => saveConfig({ ...config, scrollInterval: parseInt(e.target.value) || 5 })}
                  style={{ width: '60px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </label>
            )}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', marginTop: '12px' }}>
            <span>评论间隔时间（秒）：</span>
            <input 
              type="number" 
              min="1"
              value={config.commentInterval || 10}
              onChange={(e) => saveConfig({ ...config, commentInterval: parseInt(e.target.value) || 10 })}
              style={{ width: '60px', padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </label>
          <p style={{ margin: 0, paddingLeft: '24px', fontSize: '12px', color: '#666' }}>
            设置每次评论之间的等待时间，避免频繁操作被封控。
          </p>
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>评论模板库</h2>
          <button 
            onClick={() => saveConfig({ ...config, templates: defaultConfig.templates })}
            style={{ fontSize: '12px', background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', padding: 0 }}
          >
            恢复默认模板
          </button>
        </div>
        <form onSubmit={addTemplate} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input 
            type="text" 
            value={templateInput}
            onChange={(e) => setTemplateInput(e.target.value)}
            placeholder="输入新的评论模板..."
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px' }}
          />
          <button type="submit" style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            添加
          </button>
        </form>

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {config.templates.map((template, idx) => (
            <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f1f3f5', borderRadius: '8px', fontSize: '14px' }}>
              <span>{template}</span>
              <button 
                onClick={() => removeTemplate(idx)}
                style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '18px', padding: '0 8px' }}
                title="删除"
              >
                &times;
              </button>
            </li>
          ))}
          {config.templates.length === 0 && (
            <li style={{ textAlign: 'center', color: '#888', padding: '20px 0' }}>暂无模板，请添加。</li>
          )}
        </ul>
      </section>
    </main>
  )
}

export default App
