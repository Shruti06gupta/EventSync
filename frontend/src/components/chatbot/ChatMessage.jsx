import React from 'react'
import ChatbotEventCard from './ChatbotEventCard'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'
  
  if (message.isError) {
    return (
      <div className="flex w-full justify-start mb-4">
        <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-rose-50 px-4 py-3 text-sm text-rose-700 border border-rose-200 shadow-sm">
          {message.message}
        </div>
      </div>
    )
  }

  const hasEvents = !isUser && Array.isArray(message.events) && message.events.length > 0

  return (
    <div className={`flex w-full mb-4 flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {/* Text Bubble */}
      <div
        className={`max-w-[85%] px-4 py-3 text-sm shadow-sm ${
          isUser
            ? 'rounded-2xl rounded-tr-sm bg-brand-teal text-white'
            : 'rounded-2xl rounded-tl-sm bg-white text-brand-text border border-slate-100'
        }`}
      >
        <div className="whitespace-pre-wrap">{message.message}</div>
        
        {!isUser && message.needsClarification && (
          <div className="mt-2 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded-md inline-block border border-amber-200">
            Needs Clarification
          </div>
        )}
      </div>

      {/* Structured Events Area */}
      {hasEvents && (
        <div className="mt-2.5 w-full max-w-[92%] self-start space-y-2.5">
          {message.events.map((event, index) => (
            <ChatbotEventCard key={event._id || `event-${index}`} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}
