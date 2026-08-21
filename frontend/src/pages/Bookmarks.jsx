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
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 to-emerald-600 p-8 sm:p-12 text-white shadow-soft-xl">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute right-1/4 top-1/2 h-2 w-2 rounded-full bg-white/30" />
          <div className="absolute right-1/3 top-1/3 h-1.5 w-1.5 rounded-full bg-white/20" />
          <div className="absolute bottom-1/3 left-1/4 h-1 w-1 rounded-full bg-white/25" />

          <div className="relative z-10">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-teal-100">Saved Events</p>
            <h1 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Your Bookmarked Events
            </h1>
            <p className="mb-6 max-w-2xl text-base text-teal-100">
              Your bookmarked events, all in one place. Quick access to opportunities you want to come back to.
            </p>
            {!loading && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-teal-100">
                <span className="font-semibold text-white">{events.length}</span>
                <span>{events.length === 1 ? 'Saved Event' : 'Saved Events'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
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
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-12 text-center shadow-soft-sm">
            <div className="mb-3 text-4xl">⚠️</div>
            <h3 className="text-lg font-bold text-rose-800">Unable to load saved events</h3>
            <p className="mt-2 text-sm text-rose-600">{error}</p>
            <button
              type="button"
              onClick={loadBookmarks}
              className="mt-6 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 active:scale-95"
            >
              Try Again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-soft-sm">
            <div className="mb-4 text-5xl">🔖</div>
            <h3 className="text-2xl font-bold text-slate-900">No saved events yet</h3>
            <p className="mt-2 text-sm text-slate-600">
              Save events you want to come back to later.
            </p>
            <Link
              to="/events"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95"
            >
              Explore Events
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
