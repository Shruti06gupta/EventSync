import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import BookmarkButton from '../components/BookmarkButton'
import useBookmarks from '../hooks/useBookmarks'
import { getEventImage } from '../utils/imageHelper'

const formatDate = (value) => {
  if (!value) return 'TBA'
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'full',
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
  if (timeToDeadline <= 7 * 24 * 60 * 60 * 1000) {
    return { label: `⏳ ${Math.ceil(timeToDeadline / (24 * 60 * 60 * 1000))} days left`, isUrgent: false, color: 'bg-brand-teal-subtle text-brand-teal border-brand-teal/20' }
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

export default function EventDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { isBookmarked, toggleBookmark } = useBookmarks()

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await api.get(`/events/${id}`)
        setEvent(res.data.event)
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load this event.')
      } finally {
        setLoading(false)
      }
    }

    loadEvent()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg pb-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-8">
          <div className="animate-pulse space-y-6">
            <div className="h-72 rounded-3xl bg-slate-200" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 rounded bg-slate-200" />
              <div className="h-4 w-1/2 rounded bg-slate-200" />
              <div className="h-32 w-full rounded bg-slate-200" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="h-20 rounded bg-slate-200" />
                <div className="h-20 rounded bg-slate-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-12 text-center shadow-soft-sm">
          <div className="text-5xl mb-4">😕</div>
          <h3 className="text-xl font-bold text-brand-text">Event not found</h3>
          <p className="mt-2 text-sm text-brand-muted">
            This event may have been removed or is currently unavailable.
          </p>
          <Link
            to="/events"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95"
          >
            Back to Events
          </Link>
        </div>
      </div>
    )
  }


  const deadlineStatus = getDeadlineStatus(event.registrationDeadline)
  const isDeadlinePassed = event.registrationDeadline && new Date(event.registrationDeadline) < new Date()
  const imageUrl = getEventImage(event.image, event.title, event.organizer, event.category, event.source)

  return (
    <div className="min-h-screen bg-brand-bg pb-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Back Navigation */}
        <Link
          to="/events"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-muted hover:text-brand-teal transition mb-6"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>

        {/* Event Hero */}
        <div className="rounded-3xl overflow-hidden bg-white shadow-soft-xl">
          {/* Event Image */}
          <div className="relative h-72 sm:h-80 w-full overflow-hidden bg-slate-100">
            <img
              src={imageUrl}
              alt={event.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

            {/* Top Badges */}
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              {event.category && (
                <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-800 backdrop-blur-md shadow-sm">
                  {event.category}
                </span>
              )}
              {event.source && (
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur-md shadow-sm ${getSourceBadgeClass(
                    event.source
                  )}`}
                >
                  {event.source.charAt(0).toUpperCase() + event.source.slice(1)}
                </span>
              )}
              {event.isVerified && (
                <span className="rounded-full bg-emerald-500/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-md shadow-sm">
                  ✓ Verified
                </span>
              )}
            </div>

            {/* Mode Badge Top Right */}
            <div className="absolute right-4 top-4">
              {event.mode && (
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold backdrop-blur-md shadow-sm ${getModeBadgeClass(
                    event.mode
                  )}`}
                >
                  {event.mode}
                </span>
              )}
            </div>
          </div>

          {/* Event Content */}
          <div className="p-6 sm:p-8">
            {/* Title and Bookmark */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-text leading-tight">
                  {event.title}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-brand-muted">
                  <span className="font-semibold text-brand-text">{event.organizer}</span>
                  {event.college && <span>· {event.college}</span>}
                </div>
              </div>
              <BookmarkButton
                eventId={event._id}
                isBookmarked={isBookmarked(event._id)}
                onToggle={toggleBookmark}
              />
            </div>

            {/* Deadline Banner */}
            {deadlineStatus && (
              <div className={`mt-6 rounded-xl border px-4 py-3 ${deadlineStatus.color}`}>
                <p className="text-sm font-bold">{deadlineStatus.label}</p>
              </div>
            )}

            {/* Description */}
            <div className="mt-6">
              <h2 className="text-lg font-bold text-brand-text">About This Event</h2>
              <p className="mt-3 text-base text-brand-muted leading-relaxed whitespace-pre-wrap">
                {event.description || 'No description available for this event.'}
              </p>
            </div>

            {/* Event Details Grid */}
            <div className="mt-8">
              <h2 className="text-lg font-bold text-brand-text mb-4">Event Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem icon="📅" label="Start Date" value={formatDate(event.startDate)} />
                <DetailItem icon="📅" label="End Date" value={formatDate(event.endDate)} />
                <DetailItem icon="⏳" label="Registration Deadline" value={formatDate(event.registrationDeadline)} isUrgent={deadlineStatus?.isUrgent} />
                <DetailItem icon="🌐" label="Mode" value={event.mode} />
                <DetailItem icon="📍" label="Venue" value={event.venue || 'Online'} />
                <DetailItem icon="🏢" label="Organizer" value={event.organizer} />
                {event.college && <DetailItem icon="🎓" label="College" value={event.college} />}
              </div>
            </div>

            {/* Tags */}
            {event.tags && event.tags.length > 0 && (
              <div className="mt-8">
                <h2 className="text-lg font-bold text-brand-text mb-4">Tags</h2>
                <div className="flex flex-wrap gap-2">
                  {event.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3 pt-6 border-t border-slate-100">
              {(() => {
                if (isDeadlinePassed) {
                  return (
                    <button
                      disabled
                      className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed"
                    >
                      Registration Closed
                    </button>
                  )
                }
                if (!event.eventLink) {
                  return (
                    <button
                      disabled
                      className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed"
                    >
                      Link Not Available
                    </button>
                  )
                }
                return (
                  <a
                    href={event.eventLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-brand-teal px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95"
                  >
                    Register Now ↗
                  </a>
                )
              })()}
              <Link
                to="/events"
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-teal hover:text-brand-teal active:scale-95"
              >
                Explore More Events
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ icon, label, value, isUrgent = false }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <span className="text-xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`mt-1 text-sm font-semibold text-slate-900 truncate ${isUrgent ? 'text-rose-600' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  )
}