import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref([])
  const currentConversationId = ref(null)
  const isLoading = ref(false)

  const currentConversation = computed(() => {
    return conversations.value.find(conv => conv.id === currentConversationId.value)
  })

  const createNewConversation = () => {
    const newConversation = {
      id: Date.now().toString(),
      title: '新对话',
      messages: [],
      createdAt: new Date()
    }
    conversations.value.unshift(newConversation)
    currentConversationId.value = newConversation.id
    return newConversation
  }

  // 在 store/chat.js 中添加日志
  const addMessage = (conversationId, message) => {
    console.log('Store: 添加消息到对话', conversationId)
    console.log('Store: 消息内容', message)
    
    const conversation = conversations.value.find(conv => conv.id === conversationId)
    if (conversation) {
      conversation.messages.push(message)
      console.log('Store: 消息已添加，当前消息数量:', conversation.messages.length)
      
      if (conversation.messages.length === 1) {
        conversation.title = message.content.substring(0, 30) + '...'
      }
    } else {
      console.error('Store: 未找到对话', conversationId)
    }
  }

  const updateMessage = (conversationId, messageId, content) => {
    console.log('Store: 更新消息', conversationId, messageId, '内容长度:', content.length)
    
    const conversation = conversations.value.find(conv => conv.id === conversationId)
    if (conversation) {
      const message = conversation.messages.find(msg => msg.id === messageId)
      if (message) {
        message.content = content
        console.log('Store: 消息已更新，新内容长度:', message.content.length)
      } else {
        console.error('Store: 未找到要更新的消息', messageId)
      }
    } else {
      console.error('Store: 未找到对话', conversationId)
    }
  }
  

  const deleteConversation = (conversationId) => {
    const index = conversations.value.findIndex(conv => conv.id === conversationId)
    if (index > -1) {
      conversations.value.splice(index, 1)
      if (currentConversationId.value === conversationId) {
        currentConversationId.value = conversations.value[0]?.id || null
      }
    }
  }

  const setCurrentConversation = (conversationId) => {
    currentConversationId.value = conversationId
  }

  return {
    conversations,
    currentConversationId,
    currentConversation,
    isLoading,
    createNewConversation,
    addMessage,
    updateMessage,
    deleteConversation,
    setCurrentConversation
  }
})