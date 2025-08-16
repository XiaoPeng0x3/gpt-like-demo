import { marked } from 'marked'

// 配置marked选项，移除已废弃的参数
marked.setOptions({
  breaks: true,
  gfm: true,
  // 移除已废弃的配置
  // highlight: function(code, lang) { ... },
  // langPrefix: 'language-',
  // mangle: false,
  // headerIds: false
})

export function renderMarkdown(text) {
  if (!text) return ''
  
  try {
    return marked(text)
  } catch (error) {
    console.error('Markdown rendering error:', error)
    return text
  }
}