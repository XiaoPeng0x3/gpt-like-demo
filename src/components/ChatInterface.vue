<template>
  <div class="chat-interface">
    <!-- 左侧边栏 -->
    <div class="sidebar">
      <div class="sidebar-header">
        <button class="new-chat-btn" @click="createNewChat">
          <span>+</span>
          新建对话
        </button>
      </div>
      
      <div class="conversations-list">
        <div
          v-for="conversation in conversations"
          :key="conversation.id"
          :class="['conversation-item', { active: conversation.id === currentConversationId }]"
          @click="selectConversation(conversation.id)"
        >
          <div class="conversation-title">{{ conversation.title }}</div>
          <button 
            class="delete-btn"
            @click.stop="deleteConversation(conversation.id)"
            title="删除对话"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- 主聊天区域 -->
    <div class="main-chat">
      <!-- 顶部用户信息 -->
      <div class="chat-header">
        <div class="chat-title">
          {{ currentConversation?.title || '新对话' }}
        </div>
        <div class="user-section">
          <div v-if="isAuthenticated" class="user-info">
            <span>{{ user?.name || user?.email }}</span>
            <button class="logout-btn" @click="logout">登出</button>
          </div>
          <div v-else>
            <button class="login-btn" @click="showLoginModal = true">登录</button>
          </div>
        </div>
      </div>

      <!-- 消息列表 -->
      <div class="messages-container" ref="messagesContainer">
        <div
          v-for="message in currentConversation?.messages || []"
          :key="message.id"
          :class="['message', message.role]"
        >
          <div class="message-avatar">
            {{ message.role === 'user' ? '👤' : '🤖' }}
          </div>
          <div class="message-content">
            <!-- 用户消息也支持 Markdown 渲染 -->
            <div v-if="message.role === 'user'" class="markdown-content user-content" v-html="renderMarkdown(message.content)"></div>
            <div v-else class="markdown-content" v-html="renderMarkdown(message.content)"></div>
          </div>
        </div>
        
        <!-- 流式输出指示器 -->
        <div v-if="isLoading && streamingMessageId" class="message assistant">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <!-- 显示当前正在流式输出的实时内容 -->
            <div v-if="streamingContent" class="markdown-content" v-html="renderMarkdown(streamingContent)"></div>
            
            <div class="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-container">
        <div class="input-wrapper">
          <textarea
            v-model="inputMessage"
            @keydown.enter.prevent="sendMessage"
            placeholder="输入消息... (Shift + Enter 换行)"
            class="message-input"
            rows="1"
            ref="messageInput"
          ></textarea>
          <button 
            class="send-btn"
            @click="sendMessage"
            :disabled="!inputMessage.trim() || isLoading"
          >
            发送
          </button>
        </div>
      </div>
    </div>

    <!-- 登录模态框 -->
    <LoginModal 
      v-if="showLoginModal" 
      @close="showLoginModal = false"
      @login="handleLogin"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../stores/chat'
import { useAuthStore } from '../stores/auth'
import LoginModal from './LoginModal.vue'
import { renderMarkdown } from '../utils/markdown'
import { chatAPI, conversationAPI, authAPI } from '../services/api'

const chatStore = useChatStore()
const authStore = useAuthStore()

const inputMessage = ref('')
const showLoginModal = ref(false)
const messagesContainer = ref(null)
const messageInput = ref(null)
const streamingMessageId = ref(null) // 用于跟踪当前流式消息的ID
const streamingContent = ref('') // 用于显示流式输出的实时内容
const isInThinkTag = ref(false) // 标记是否在<think>标签内
const thinkBuffer = ref('') // 用于累积<think>标签内的内容

// 添加清理标志
const isComponentMounted = ref(true)

const conversations = computed(() => chatStore.conversations)
const currentConversationId = computed(() => chatStore.currentConversationId)
const currentConversation = computed(() => chatStore.currentConversation)
const isLoading = computed(() => chatStore.isLoading)
const isAuthenticated = computed(() => authStore.isAuthenticated)
const user = computed(() => authStore.user)

// 初始化
if (conversations.value.length === 0) {
  chatStore.createNewConversation()
}

const createNewChat = async () => {
  try {
    const response = await conversationAPI.createConversation('新对话')
    if (response.success) {
      chatStore.createNewConversation()
      inputMessage.value = ''
      nextTick(() => {
        messageInput.value?.focus()
      })
    }
  } catch (error) {
    console.error('创建对话失败:', error)
    alert('创建对话失败，请重试')
  }
}

const selectConversation = async (conversationId) => {
  try {
    // 获取对话详情
    const response = await conversationAPI.getConversation(conversationId)
    if (response.success) {
      const conv = response.data
      console.log('选择对话:', conversationId, '消息数量:', conv.messages?.length || 0)
      
      // 更新当前对话的消息
      const conversation = chatStore.conversations.find(c => c.id === conversationId)
      if (conversation) {
        // 确保消息数据正确格式化
        conversation.messages = (conv.messages || []).map(msg => ({
          ...msg,
          id: msg.id || `msg_${Date.now()}_${Math.random()}`,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          content: msg.content || ''
        }))
        
        console.log('对话消息已更新:', conversation.messages.length, '条消息')
        
        // 验证消息内容完整性
        conversation.messages.forEach((msg, index) => {
          if (msg.content && msg.content.length > 0) {
            console.log(`消息 ${index + 1}: ID=${msg.id}, 长度=${msg.content.length}`)
          } else {
            console.warn(`消息 ${index + 1}: 内容为空或未定义`)
          }
        })
      }
      chatStore.setCurrentConversation(conversationId)
    }
  } catch (error) {
    console.error('获取对话详情失败:', error)
    // 即使失败也切换对话
    chatStore.setCurrentConversation(conversationId)
  }
}

const deleteConversation = async (conversationId) => {
  if (confirm('确定要删除这个对话吗？')) {
    try {
      const response = await conversationAPI.deleteConversation(conversationId)
      if (response.success) {
        chatStore.deleteConversation(conversationId)
      }
    } catch (error) {
      console.error('删除对话失败:', error)
      alert('删除对话失败，请重试')
    }
  }
}

const sendMessage = async () => {
  if (!inputMessage.value.trim() || isLoading.value) return
  
  const userMessage = {
    id: Date.now().toString(),
    role: 'user',
    content: inputMessage.value.trim(),
    timestamp: new Date()
  }
  
  // 添加用户消息到对话
  chatStore.addMessage(currentConversationId.value, userMessage)
  const userContent = inputMessage.value
  inputMessage.value = ''
  
  // 调用API获取AI回复
  await sendMessageToAPI(userContent)
  
  nextTick(() => {
    scrollToBottom()
    messageInput.value?.focus()
  })
}

const sendMessageToAPI = async (userMessage) => {
  if (!isComponentMounted.value) return
  
  chatStore.isLoading = true
  const messageId = Date.now().toString()
  streamingMessageId.value = messageId
  streamingContent.value = '' // 清空流式内容
  let isInThinkTag = false    // 标记是否在<think>块内

  try {
    await chatAPI.sendMessageStream({
      conversationId: currentConversationId.value,
      message: userMessage,
      model: 'deepseek'
    }, (chunk) => {
      if (!isComponentMounted.value) return
      
      if (chunk.type === 'start') {
        console.log('Stream started:', chunk.messageId)
        streamingMessageId.value = chunk.messageId
      } else if (chunk.type === 'content') {
        if (chunk.content) {
          let processedContent = chunk.content

          // 处理进入 <think>
          if (processedContent.includes('<think>')) {
            isInThinkTag = true
            thinkBuffer.value = '' // 清空缓冲区
            processedContent = processedContent.replace('<think>', '')
            streamingContent.value += `\n\n> **深度思考**\n`
          }

          // 处理退出 </think>
          if (processedContent.includes('</think>')) {
            isInThinkTag = false
            processedContent = processedContent.replace('</think>', '')
            
            // 将缓冲区中的内容以引用格式显示
            if (thinkBuffer.value.trim()) {
              const quoted = `> ${thinkBuffer.value.trim()}\n\n`
              streamingContent.value += quoted
              thinkBuffer.value = '' // 清空缓冲区
            }
            
            streamingContent.value += `\n\n` // 结束时空两行，避免贴正文
          }

          // 如果在 <think> 内，累积到缓冲区
          if (isInThinkTag) {
            thinkBuffer.value += processedContent
            // 只在有换行符时才分割，避免将正常符号当作分割点
            if (processedContent.includes('\n')) {
              // 有换行符，说明是一个完整的段落或句子
              if (thinkBuffer.value.trim()) {
                const quoted = `> ${thinkBuffer.value.trim()}\n`
                streamingContent.value += quoted
                thinkBuffer.value = '' // 清空缓冲区
              }
            }
          } else {
            streamingContent.value += processedContent
          }

          scrollToBottom()
        }
      } else if (chunk.type === 'end') {
        console.log('Stream ended:', chunk.messageId)
        const finalMessage = {
          id: streamingMessageId.value,
          role: 'assistant',
          content: streamingContent.value,
          timestamp: new Date()
        }
        chatStore.addMessage(currentConversationId.value, finalMessage)

        streamingMessageId.value = null
        streamingContent.value = ''
        chatStore.isLoading = false
        scrollToBottom()
      }
    })
  } catch (error) {
    if (!isComponentMounted.value) return
    console.error('API请求失败:', error)

    const errorMessage = {
      id: streamingMessageId.value,
      role: 'assistant',
      content: `抱歉，请求失败: ${error.message || '未知错误'}`,
      timestamp: new Date()
    }
    chatStore.addMessage(currentConversationId.value, errorMessage)

    streamingMessageId.value = null
    streamingContent.value = ''
    chatStore.isLoading = false
    scrollToBottom()
  }
}



const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const handleLogin = async (userData) => {
  try {
    const response = await authAPI.login(userData)
    if (response.success) {
      localStorage.setItem('token', response.data.token)
      authStore.login(response.data.user)
      showLoginModal.value = false
      
      // 登录成功后初始化数据
      await initializeData()
    }
  } catch (error) {
    console.error('登录失败:', error)
    alert('登录失败，请检查邮箱和密码')
  }
}

const logout = async () => {
  try {
    await authAPI.logout()
  } catch (error) {
    console.error('登出失败:', error)
  } finally {
    localStorage.removeItem('token')
    authStore.logout()
  }
}

// 初始化数据
const initializeData = async () => {
  try {
    // 获取对话列表
    const conversationsResponse = await conversationAPI.getConversations()
    if (conversationsResponse.success) {
      // 清空现有对话
      chatStore.conversations = []
      
      // 添加从API获取的对话
      conversationsResponse.data.forEach(conv => {
        chatStore.conversations.push({
          id: conv.id,
          title: conv.title,
          messages: [],
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt)
        })
      })
      
      // 如果有对话，选择第一个并获取详情
      if (chatStore.conversations.length > 0) {
        await selectConversation(chatStore.conversations[0].id)
      }
    }
  } catch (error) {
    console.error('初始化数据失败:', error)
  }
}

// 监听消息变化，自动滚动到底部
watch(() => currentConversation.value?.messages, () => {
  nextTick(() => {
    scrollToBottom()
  })
}, { deep: true })

// 自动聚焦输入框
watch(currentConversationId, () => {
  nextTick(() => {
    messageInput.value?.focus()
  })
})

// 组件挂载时检查认证状态并初始化数据
onMounted(async () => {
  // 检查本地存储的认证状态
  const token = localStorage.getItem('token')
  if (token) {
    try {
      const userResponse = await authAPI.getCurrentUser()
      if (userResponse.success) {
        authStore.login(userResponse.data)
        await initializeData()
      }
    } catch (error) {
      console.error('获取用户信息失败:', error)
      localStorage.removeItem('token')
    }
  }
})

// 组件卸载时的清理
onUnmounted(() => {
  isComponentMounted.value = false
  // 清理流式消息状态
  streamingMessageId.value = null
  streamingContent.value = ''
  isInThinkTag.value = false
  thinkBuffer.value = ''
  chatStore.isLoading = false
})
</script>

<style scoped>
.chat-interface {
  display: flex;
  height: 100vh;
  background-color: #ffffff;
}

.sidebar {
  width: 260px;
  background-color: #f7f7f8;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.new-chat-btn {
  width: 100%;
  padding: 12px 16px;
  background-color: #10a37f;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}

.new-chat-btn:hover {
  background-color: #0d8c6f;
}

.new-chat-btn span {
  font-size: 18px;
  font-weight: bold;
}

.conversations-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.conversation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin: 4px 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
  position: relative;
}

.conversation-item:hover {
  background-color: #f3f4f6;
}

.conversation-item.active {
  background-color: #e5e7eb;
}

.conversation-title {
  flex: 1;
  font-size: 14px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s;
}

.conversation-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background-color: #f3f4f6;
  color: #ef4444;
}

.main-chat {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #ffffff;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
  background-color: #ffffff;
}

.chat-title {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #6b7280;
}

.login-btn, .logout-btn {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background-color: #ffffff;
  color: #374151;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.login-btn:hover, .logout-btn:hover {
  background-color: #f9fafb;
  border-color: #9ca3af;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  background-color: #ffffff;
}

.message {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  background-color: #f3f4f6;
  flex-shrink: 0;
}

.message-content {
  flex: 1;
  line-height: 1.6;
  color: #374151;
}

.markdown-content {
  line-height: 1.6;
}

.user-content {
  color: #1f2937;
  font-weight: 500;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3) {
  margin: 16px 0 8px 0;
  color: #111827;
}

.markdown-content :deep(p) {
  margin: 8px 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.markdown-content :deep(li) {
  margin: 4px 0;
}

.markdown-content :deep(code) {
  background-color: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
}

.markdown-content :deep(pre) {
  background-color: #f3f4f6;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 16px 0;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #e5e7eb;
  padding-left: 16px;
  margin: 16px 0;
  color: #6b7280;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-top: 8px;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #9ca3af;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.input-container {
  padding: 24px;
  border-top: 1px solid #e5e7eb;
  background-color: #ffffff;
}

.input-wrapper {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  max-width: 768px;
  margin: 0 auto;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  font-family: inherit;
  transition: border-color 0.2s;
}

.message-input:focus {
  outline: none;
  border-color: #10a37f;
  box-shadow: 0 0 0 3px rgba(16, 163, 127, 0.1);
}

.send-btn {
  padding: 12px 24px;
  background-color: #10a37f;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
  white-space: nowrap;
}

.send-btn:hover:not(:disabled) {
  background-color: #0d8c6f;
}

.send-btn:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}
</style>