import api from '../api'

export const sendChatbotMessage = async (message, conversationContext = []) => {
  const response = await api.post('/chatbot', {
    message,
    conversationContext,
  })
  return response.data
}
