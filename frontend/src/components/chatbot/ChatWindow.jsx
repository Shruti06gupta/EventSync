import React, { useEffect, useRef } from 'react'
import { useChatbot } from '../../context/ChatbotContext'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'

export default function ChatWindow() {
  const { isOpen, closeChat, messages, isLoading } = useChatbot()
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isLoading, isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200/80 bg-white shadow-soft-xl transition-all duration-300 sm:bottom-24 sm:right-8 sm:inset-auto sm:h-[600px] sm:w-[380px] sm:rounded-3xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-brand-teal to-brand-teal-dark px-5 py-4 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold leading-tight">EventSync AI</h3>
            <p className="text-[11px] font-medium text-white/80">Your personal event assistant</p>
          </div>
        </div>
        <button
          onClick={closeChat}
          aria-label="Close Chat"
          className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-95"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body Area */}
      <div className="flex-1 overflow-y-auto bg-brand-bg p-5">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal-subtle text-brand-teal">
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-brand-text">How can I help you?</p>
            <p className="mt-2 max-w-[280px] text-xs text-brand-muted leading-relaxed">
              Ask me to find hackathons, filter by date and location, or search for online and offline events.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            
            {isLoading && (
              <div className="flex w-full justify-start mb-4">
                <div className="px-4 py-4 rounded-2xl rounded-tl-sm bg-white border border-slate-100 shadow-sm flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Footer / Input Shell */}
      <ChatInput />
    </div>
  )
}
