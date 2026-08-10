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
    if (!deadlineDate) return null;
    const now = new Date();
    const deadline = new Date(deadlineDate);
    const timeToDeadline = deadline.getTime() - now.getTime();
    
    if (timeToDeadline < 0) return null;
    if (timeToDeadline <= 3 * 60 * 60 * 1000) {
      return <span className="bg-red-50 text-red-700 text-xs font-bold px-2 py-1 rounded-full border border-red-200 flex items-center gap-1 shadow-sm">🚨 Last 3 hours</span>;
    }
    if (timeToDeadline <= 24 * 60 * 60 * 1000) {
      return <span className="bg-orange-50 text-orange-700 text-xs font-bold px-2 py-1 rounded-full border border-orange-200 flex items-center gap-1 shadow-sm">⚠ Closes tomorrow</span>;
    }
    if (timeToDeadline <= 48 * 60 * 60 * 1000) {
      return <span className="bg-amber-50 text-amber-700 text-xs font-bold px-2 py-1 rounded-full border border-amber-200 flex items-center gap-1 shadow-sm">⏰ Closes in 48 hours</span>;
    }
    return null;
  }

  return (
    <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 rounded-3xl bg-gradient-to-r from-amber-500 to-orange-500 p-8 text-white shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-amber-100">Your collection</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Saved events</h1>
        <p className="mt-2 max-w-2xl text-amber-50">
          Conferences and campus events you bookmarked for later.
        </p>
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
            className="mt-6 inline-block rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700 transition"
          >
            Browse events
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <article
              key={event._id}
              className="flex flex-col h-full overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl relative"
            >
              <img
                src={getEventImage(event.image, event.title, event.organizer, event.category, event.source)}
                alt={event.title}
                className="h-48 w-full object-cover shrink-0"
              />
              
              <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
                {getDeadlineBadge(event.registrationDeadline)}
              </div>

              <div className="flex flex-col flex-grow p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 line-clamp-1">{event.title}</h2>
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700 flex-shrink-0">
                    {event.mode}
                  </span>
                </div>

                <p className="mt-3 line-clamp-3 text-sm text-gray-600 flex-grow">{event.description}</p>

                <div className="mt-4 space-y-2 text-sm text-gray-600">
                  <p>
                    <span className="font-medium text-gray-800">College:</span> {event.college}
                  </p>
                  <p>
                    <span className="font-medium text-gray-800">Deadline:</span> {formatDate(event.registrationDeadline)}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
                  <Link
                    to={`/events/${event._id}`}
                    className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                  >
                    View details
                  </Link>
                  <BookmarkButton
                    eventId={event._id}
                    isBookmarked={isBookmarked(event._id)}
                    onToggle={handleToggle}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
