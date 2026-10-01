import React, { createContext, useContext, useState, useCallback } from 'react'
import { sendChatbotMessage } from '../services/chatbotService'

const ChatbotContext = createContext()

export const useChatbot = () => useContext(ChatbotContext)

export const ChatbotProvider = ({ children }) => {
  const [messages, setMessages] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSending, setIsSending] = useState(false) // Prevent duplicate sends

  const openChat = useCallback(() => setIsOpen(true), [])
  const closeChat = useCallback(() => setIsOpen(false), [])
  const toggleChat = useCallback(() => setIsOpen((prev) => !prev), [])
  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  const sendMessage = async (text) => {
    if (!text || !text.trim()) return
    if (isSending) return // Prevent duplicate sends

    setIsSending(true)

    const userMessage = {
      id: Date.now().toString() + '-user',
      role: 'user',
      message: text.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      // Keep only recent context, exclude error messages, e.g., last 10 messages
      const recentValidMessages = messages.filter(msg => !msg.isError).slice(-10)
      const conversationContext = recentValidMessages.map((msg) => ({
        role: msg.role,
        message: msg.message,
      }))

      const response = await sendChatbotMessage(text.trim(), conversationContext)

      const assistantMessage = {
        id: Date.now().toString() + '-assistant',
        role: 'assistant',
        ...response, // Preserves needsClarification, events, totalEvents, intent, message, etc.
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chatbot request failed', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
      });

      setError(error.response?.data?.message || 'Failed to connect to the chatbot.')

      const errorMessage = {
        id: Date.now().toString() + '-error',
        role: 'assistant',
        isError: true,
        message: 'Sorry, I encountered an error. Please try again.',
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setIsSending(false)
    }
  }

  return (
    <ChatbotContext.Provider
      value={{
        messages,
        isOpen,
        isLoading,
        error,
        openChat,
        closeChat,
        toggleChat,
        clearChat,
        sendMessage,
      }}
    >
      {children}
    </ChatbotContext.Provider>
  )
}

export default ChatbotContext
