import axios from 'axios'

// 使用相对路径，让Vite代理处理
const api = axios.create({
  baseURL: '/api',  // 改为相对路径
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// ... 其他代码保持不变

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// 响应拦截器 - 处理错误
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

// 认证相关API
export const authAPI = {
  // 用户登录
  login: (credentials) => api.post('/auth/login', credentials),
  
  // 用户注册
  register: (userData) => api.post('/auth/register', userData),
  
  // 用户登出
  logout: () => api.post('/auth/logout'),
  
  // 获取当前用户信息
  getCurrentUser: () => api.get('/auth/me')
}

// 对话相关API
export const conversationAPI = {
  // 获取对话列表
  getConversations: () => api.get('/conversations'),
  
  // 创建新对话
  createConversation: (title) => api.post('/conversations', { title }),
  
  // 获取对话详情
  getConversation: (id) => api.get(`/conversations/${id}`),
  
  // 删除对话
  deleteConversation: (id) => api.delete(`/conversations/${id}`)
}

// 聊天相关API
export const chatAPI = {
  // 发送消息（普通响应）
  sendMessage: (data) => api.post('/chat', data),
  
  // 发送消息（流式响应）
  sendMessageStream: (data, onChunk) => {
    return new Promise((resolve, reject) => {
      const token = localStorage.getItem('token')
      
      console.log('API: 开始流式请求', data)
      
      fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        console.log('API: 流式响应开始')
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = '' // 添加缓冲区处理不完整的数据
        
        function readStream() {
          reader.read().then(({ done, value }) => {
            if (done) {
              console.log('API: 流式响应结束')
              resolve()
              return
            }
            
            const chunk = decoder.decode(value, { stream: true })
            buffer += chunk
            
            // 按行分割，处理可能跨chunk的数据
            const lines = buffer.split('\n')
            buffer = lines.pop() || '' // 保留最后一行（可能不完整）
            
            lines.forEach(line => {
              if (line.trim() && line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  console.log('API: 收到数据块:', data.type, data.content ? `内容长度: ${data.content.length}` : '')
                  onChunk(data)
                } catch (e) {
                  console.error('API: 解析SSE数据失败:', e, '原始数据:', line)
                }
              }
            })
            
            readStream()
          }).catch(error => {
            console.error('API: 读取流失败:', error)
            reject(error)
          })
        }
        
        readStream()
      })
      .catch(error => {
        console.error('API: 流式请求失败:', error)
        reject(error)
      })
    })
  }
}

export default api