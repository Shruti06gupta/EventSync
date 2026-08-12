import React, { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import BookmarkButton from '../components/BookmarkButton'
import useBookmarks from '../hooks/useBookmarks'
import { getEventImage } from '../utils/imageHelper'

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

export default function Bookmarks() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { isBookmarked, toggleBookmark, refreshBookmarks } = useBookmarks()
  const { user } = useAuth()

  if (user?.role === 'admin') {
    return <Navigate to="/events" replace />
  }

  const loadBookmarks = async () => {
    try {
      setLoading(true)
      setError('')
      const res = await api.get('/user/bookmarks')
      setEvents(res.data.events || [])
      await refreshBookmarks()
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load saved events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBookmarks()
  }, [])

  const handleToggle = async (eventId) => {
    await toggleBookmark(eventId)
    setEvents((current) => current.filter((event) => event._id !== eventId))
  }

  const getDeadlineBadge = (deadlineDate) => {
    if (!deadlineDate) return null
    const now = new Date()
    const deadline = new Date(deadlineDate)
    const timeToDeadline = deadline.getTime() - now.getTime()

    if (timeToDeadline < 0) return null
    if (timeToDeadline <= 3 * 60 * 60 * 1000) {
      return (
        <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 shadow-sm">
          🚨 Last 3 hours
        </span>
      )
    }
    if (timeToDeadline <= 24 * 60 * 60 * 1000) {
      return (
        <span className="flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700 shadow-sm">
          ⚠ Closes tomorrow
        </span>
      )
    }
    if (timeToDeadline <= 48 * 60 * 60 * 1000) {
      return (
        <span className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 shadow-sm">
          ⏰ Closes in 48 hours
        </span>
      )
    }
    return null
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 rounded-3xl bg-gradient-to-r from-teal-600 to-cyan-500 p-8 text-white shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-teal-100">Your collection</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Saved events</h1>
        <p className="mt-3 max-w-2xl text-teal-50">
          Conferences and campus events you bookmarked for later.
        </p>
        {!loading && (
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-white/15 px-4 py-2">
              {events.length} saved {events.length === 1 ? 'event' : 'events'}
            </span>
            {events.slice(0, 3).map((event) =>
              event.category ? (
                <span key={event._id} className="rounded-full bg-white/15 px-4 py-2">
                  {event.category}
                </span>
              ) : null
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-lg">Loading saved events...</div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900">No saved events yet</h2>
          <p className="mt-2 text-gray-600">Tap Save on any event to add it here.</p>
          <Link
            to="/events"
            className="mt-6 inline-block rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 hover:shadow-md active:scale-95 transform duration-150"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <article
              key={event._id}
              className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <img
                src={getEventImage(event.image, event.title, event.organizer, event.category, event.source)}
                alt={event.title}
                className="h-48 w-full shrink-0 object-cover"
              />

              <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
                {getDeadlineBadge(event.registrationDeadline)}
              </div>

              <div className="flex flex-grow flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-1 text-lg font-semibold text-gray-900">{event.title}</h2>
                  <span className="shrink-0 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700">
                    {event.mode}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 flex-grow text-sm text-gray-600">{event.description}</p>

                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-800">Organizer:</span> {event.organizer}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">College:</span> {event.college}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">Starts:</span> {formatDate(event.startDate)}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">Deadline:</span> {formatDate(event.registrationDeadline)}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {event.tags?.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
                  <Link
                    to={`/events/${event._id}`}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-95 transform duration-150"
                  >
                    View details
                  </Link>
                  <BookmarkButton
                    eventId={event._id}
                    isBookmarked={isBookmarked(event._id)}
                    onToggle={handleToggle}
                    size="sm"
                  />
                  {(() => {
                    const isDeadlinePassed = new Date(event.registrationDeadline) < new Date()
                    if (isDeadlinePassed) {
                      return (
                        <button
                          disabled
                          className="cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-400"
                        >
                          Registration Closed
                        </button>
                      )
                    }
                    if (!event.eventLink) {
                      return (
                        <button
                          disabled
                          className="cursor-not-allowed rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-400"
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
                        className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 hover:shadow-md active:scale-95 transform duration-150"
                      >
                        Register Now
                      </a>
                    )
                  })()}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
