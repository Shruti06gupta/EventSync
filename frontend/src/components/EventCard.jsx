import React from 'react'
import { Link } from 'react-router-dom'
import BookmarkButton from './BookmarkButton'
import { getEventImage } from '../utils/imageHelper'

const formatDate = (value) => {
  if (!value) return 'TBA'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch (e) {
    return 'TBA'
  }
}

const getDeadlineStatus = (deadlineDate) => {
  if (!deadlineDate) return null
  const now = new Date()
  const deadline = new Date(deadlineDate)
  const timeToDeadline = deadline.getTime() - now.getTime()

  if (timeToDeadline < 0) {
    return { label: 'Registration Closed', isClosed: true, color: 'bg-slate-100 text-slate-500 border-slate-200' }
  }
  if (timeToDeadline <= 3 * 60 * 60 * 1000) {
    return { label: '🚨 Last 3 hours', isUrgent: true, color: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' }
  }
  if (timeToDeadline <= 24 * 60 * 60 * 1000) {
    return { label: '⚠️ Closes today', isUrgent: true, color: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  if (timeToDeadline <= 48 * 60 * 60 * 1000) {
    return { label: '⏰ 2 days left', isUrgent: false, color: 'bg-sky-50 text-sky-700 border-sky-200' }
  }
  return null
}

const getModeBadgeClass = (mode) => {
  switch (mode?.toLowerCase()) {
    case 'online':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'offline':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    case 'hybrid':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    default:
      return 'bg-brand-teal-subtle text-brand-teal border-brand-teal/20'
  }
}

const getSourceBadgeClass = (source) => {
  switch (source?.toLowerCase()) {
    case 'devfolio':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'unstop':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'manual':
      return 'bg-teal-50 text-teal-700 border-teal-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function EventCard({
  event,
  isBookmarked = false,
  onBookmarkToggle,
  showFullActions = true,
  className = '',
}) {
  if (!event) return null

  const deadlineStatus = getDeadlineStatus(event.registrationDeadline)
  const isDeadlinePassed = event.registrationDeadline && new Date(event.registrationDeadline) < new Date()
  const imageUrl = getEventImage(event.image, event.title, event.organizer, event.category, event.source)

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-teal/40 hover:shadow-soft-lg ${className}`}
    >
      {/* Event Image & Badges */}
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-slate-100">
        <img
          src={imageUrl}
          alt={event.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />

        {/* Top Badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {event.category && (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-800 backdrop-blur-md shadow-sm">
              {event.category}
            </span>
          )}
          {event.source && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md shadow-sm ${getSourceBadgeClass(
                event.source
              )}`}
            >
              {event.source.charAt(0).toUpperCase() + event.source.slice(1)}
            </span>
          )}
        </div>

        {/* Mode & Deadline Top Right */}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          {event.mode && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md shadow-sm ${getModeBadgeClass(
                event.mode
              )}`}
            >
              {event.mode}
            </span>
          )}
          {deadlineStatus && (
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md ${deadlineStatus.color}`}
            >
              {deadlineStatus.label}
            </span>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-5">
        {/* Title */}
        <h3 className="line-clamp-2 text-lg font-bold text-brand-text transition-colors group-hover:text-brand-teal">
          <Link to={`/events/${event._id}`}>{event.title}</Link>
        </h3>

        {/* Description */}
        <p className="mt-2.5 line-clamp-2 flex-1 text-sm text-brand-muted leading-relaxed">
          {event.description || 'No description available for this event.'}
        </p>

        {/* Meta Info */}
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-500">Organizer:</span>
            <span className="font-semibold text-slate-800 truncate max-w-[65%] text-right">
              {event.organizer || 'Campus Club'}
            </span>
          </div>

          {event.college && (
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-500">College:</span>
              <span className="font-semibold text-slate-800 truncate max-w-[65%] text-right">
                {event.college}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-500">Starts:</span>
            <span className="font-medium text-slate-700">{formatDate(event.startDate)}</span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-slate-500">Deadline:</span>
            <span className={`font-medium ${isDeadlinePassed ? 'text-rose-600 line-through' : 'text-slate-700'}`}>
              {formatDate(event.registrationDeadline)}
            </span>
          </div>
        </div>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {event.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Card Actions */}
        {showFullActions && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <Link
                to={`/events/${event._id}`}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition duration-150 hover:bg-slate-800 active:scale-95"
              >
                View details
              </Link>

              {onBookmarkToggle && (
                <BookmarkButton
                  eventId={event._id}
                  isBookmarked={isBookmarked}
                  onToggle={onBookmarkToggle}
                  size="sm"
                />
              )}
            </div>

            {(() => {
              if (isDeadlinePassed) {
                return (
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">
                    Closed
                  </span>
                )
              }
              if (!event.eventLink) {
                return (
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-400">
                    No Link
                  </span>
                )
              }
              return (
                <a
                  href={event.eventLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-xl bg-brand-teal px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition duration-150 hover:bg-brand-teal-dark hover:shadow active:scale-95"
                >
                  Register ↗
                </a>
              )
            })()}
          </div>
        )}
      </div>
    </article>
  )
}
