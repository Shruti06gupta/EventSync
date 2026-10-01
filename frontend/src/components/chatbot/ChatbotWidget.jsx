import React from 'react'
import { useChatbot } from '../../context/ChatbotContext'
import ChatWindow from './ChatWindow'

export default function ChatbotWidget() {
  const { isOpen, toggleChat } = useChatbot()

  return (
    <>
      <ChatWindow />
      
      {/* Hide FAB on small screens when chat is open to avoid overlapping */}
      <div className={`fixed bottom-6 right-6 z-50 transition-transform sm:bottom-8 sm:right-8 ${isOpen ? 'hidden sm:block' : 'block'}`}>
        <button
          onClick={toggleChat}
          aria-label={isOpen ? 'Close Chatbot' : 'Open Chatbot'}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal text-white shadow-soft-lg transition-all duration-200 hover:scale-105 hover:bg-brand-teal-dark hover:shadow-teal-glow focus:outline-none focus:ring-4 focus:ring-brand-teal/30 active:scale-95"
        >
          {isOpen ? (
            // Close icon (X)
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            // Chat icon
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}
        </button>
      </div>
    </>
  )
}
