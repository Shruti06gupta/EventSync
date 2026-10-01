import React, { useState, useRef, useEffect } from 'react'
import { useChatbot } from '../../context/ChatbotContext'

export default function ChatInput() {
  const { sendMessage, isLoading } = useChatbot()
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const handleSubmit = (e) => {
    e?.preventDefault()
    if (!text.trim() || isLoading) return
    sendMessage(text)
    setText('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [text])

  return (
    <form
      className="flex items-end gap-2 p-4 border-t border-slate-200 bg-white"
      onSubmit={handleSubmit}
    >
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message EventSync AI..."
          aria-label="Chat message input"
          disabled={isLoading}
          rows={1}
          className="w-full resize-none overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-brand-text placeholder-slate-400 transition-colors focus:border-brand-teal focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-teal-subtle disabled:opacity-60"
          style={{ minHeight: '46px', maxHeight: '120px' }}
        />
      </div>
      <button
        type="submit"
        aria-label="Send Message"
        disabled={!text.trim() || isLoading}
        className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-brand-teal text-white shadow-sm transition-all duration-200 hover:bg-brand-teal-dark hover:shadow active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="h-5 w-5 translate-x-px translate-y-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </form>
  )
}
