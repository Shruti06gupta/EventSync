import React from 'react'
import { Link } from 'react-router-dom'
import { getEventImage } from '../../utils/imageHelper'

const formatCompactDate = (value) => {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  } catch (e) {
    return ''
  }
}

export default function ChatbotEventCard({ event }) {
  if (!event) return null

  const imageUrl = getEventImage(event.image, event.title, event.organizer, event.category, event.source)
  const dateStr = formatCompactDate(event.startDate)

  return (
    <article className="group flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft-sm transition-all hover:-translate-y-0.5 hover:border-brand-teal/40 hover:shadow-soft-md focus-within:ring-2 focus-within:ring-brand-teal/50">
      <div className="h-[92px] w-[92px] shrink-0 bg-slate-100 overflow-hidden">
        <img
          src={imageUrl}
          alt={event.title || 'Event image'}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col justify-between p-2.5">
        <div>
          <h4 className="line-clamp-1 text-sm font-bold text-brand-text">
            <Link 
              to={`/events/${event._id}`} 
              className="hover:text-brand-teal transition-colors focus:outline-none"
            >
              {event.title}
            </Link>
          </h4>
          <div className="mt-0.5 flex flex-col gap-0.5 text-[11px] text-slate-500">
            {dateStr && <span className="font-medium text-slate-700">📅 {dateStr}</span>}
            {event.mode && <span>📍 {event.mode}</span>}
          </div>
        </div>
        
        <div className="mt-1 text-right">
          <Link
            to={`/events/${event._id}`}
            aria-label={`View details for ${event.title}`}
            className="inline-flex items-center text-[11px] font-semibold text-brand-teal hover:text-brand-teal-dark transition-colors focus:outline-none focus:underline"
            tabIndex={-1} // Prevent double focus since the title is already a link, but kept clickable. Wait, actually, removing tabIndex so keyboard users can navigate to "View Event" easily.
          >
            View Event &rarr;
          </Link>
        </div>
      </div>
    </article>
  )
}
