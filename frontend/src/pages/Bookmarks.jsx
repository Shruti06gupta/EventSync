import React, { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import EventCard from '../components/EventCard'
import useBookmarks from '../hooks/useBookmarks'

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


  return (
    <div className="min-h-screen bg-brand-bg pb-12">
      {/* Page Header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-teal">Saved Events</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-text tracking-tight">
            Your Bookmarked Events
          </h1>
          <p className="max-w-2xl text-base text-brand-muted">
            Your bookmarked events, all in one place. Quick access to opportunities you want to come back to.
          </p>
          {!loading && events.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-2 text-sm text-brand-muted">
              <span className="font-semibold text-brand-text">{events.length}</span>
              <span>{events.length === 1 ? 'event saved' : 'events saved'} for later</span>
            </div>
          )}
        </div>
      </div>

      {/* Events Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-96 animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-soft-sm"
              >
                <div className="h-40 rounded-2xl bg-slate-100" />
                <div className="mt-4 h-5 w-3/4 rounded bg-slate-100" />
                <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
                <div className="mt-3 h-4 w-full rounded bg-slate-100" />
                <div className="mt-2 h-4 w-2/3 rounded bg-slate-100" />
                <div className="mt-4 h-8 w-1/3 rounded bg-slate-100" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-white p-12 text-center shadow-soft-sm">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold text-rose-800">Unable to load saved events</h3>
            <p className="mt-2 text-sm text-rose-600">{error}</p>
            <button
              type="button"
              onClick={loadBookmarks}
              className="mt-6 rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95"
            >
              Try Again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-soft-sm">
            <div className="text-5xl mb-4">🔖</div>
            <h3 className="text-xl font-bold text-brand-text">No saved events yet</h3>
            <p className="mt-2 text-sm text-brand-muted">
              Bookmark events you want to come back to later.
            </p>
            <Link
              to="/events"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95"
            >
              Explore Events
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard
                key={event._id}
                event={event}
                isBookmarked={isBookmarked(event._id)}
                onBookmarkToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
