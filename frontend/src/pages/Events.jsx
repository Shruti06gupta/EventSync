import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import BookmarkButton from '../components/BookmarkButton'
import useBookmarks from '../hooks/useBookmarks'
import { getEventImage } from '../utils/imageHelper'

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

export default function Events() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ totalPages: 1, totalEvents: 0 })
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [mode, setMode] = useState('')
  const [college, setCollege] = useState('')
  const [source, setSource] = useState('')
  const [availableCategories, setAvailableCategories] = useState([])
  const { isBookmarked, toggleBookmark } = useBookmarks()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setError('')

        const res = await api.get('/events', {
          params: {
            page,
            limit: 9,
            search: debouncedSearch || undefined,
            category: category || undefined,
            mode: mode || undefined,
            college: college || undefined,
            source: source || undefined,
          },
        })

        setEvents(res.data.events || [])
        setPagination(res.data.pagination || { totalPages: 1, totalEvents: 0, hasNextPage: false })
        if (res.data.categories) {
          setAvailableCategories(res.data.categories)
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load events right now.')
      } finally {
        setLoading(false)
      }
    }

    loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, category, mode, college])

  const categories = useMemo(() => {
    return [...new Set(events.map((event) => event.category).filter(Boolean))]
  }, [events])

  const resetPageAndFilters = (setter) => (value) => {
    setPage(1)
    setter(value)
  }

  return (
    <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 rounded-3xl bg-gradient-to-r from-teal-600 to-cyan-500 p-8 text-white shadow-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-teal-100">Discover events</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Upcoming campus events</h1>
        <p className="mt-3 max-w-2xl text-teal-50">
          Browse verified events, check registration deadlines, and open the event page directly.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-white/15 px-4 py-2">{pagination.totalEvents} verified events</span>
          <span className="rounded-full bg-white/15 px-4 py-2">{pagination.totalPages} pages</span>
          {availableCategories.slice(0, 3).map((category) => (
            <span key={category} className="rounded-full bg-white/15 px-4 py-2">
              {category}
            </span>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Search</span>
            <input
              type="text"
              value={search}
              onChange={(event) => resetPageAndFilters(setSearch)(event.target.value)}
              placeholder="Search title..."
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-teal-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Category</span>
            <select
              value={category}
              onChange={(event) => resetPageAndFilters(setCategory)(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-teal-500"
            >
              <option value="">All categories</option>
              {availableCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Mode</span>
            <select
              value={mode}
              onChange={(event) => resetPageAndFilters(setMode)(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-teal-500"
            >
              <option value="">All modes</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">College</span>
            <input
              type="text"
              value={college}
              onChange={(event) => resetPageAndFilters(setCollege)(event.target.value)}
              placeholder="Filter by college"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-teal-500"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-gray-700">Source</span>
            <select
              value={source}
              onChange={(event) => resetPageAndFilters(setSource)(event.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-teal-500"
            >
              <option value="">All sources</option>
              <option value="devfolio">Devfolio</option>
              <option value="unstop">Unstop</option>
              <option value="manual">Manual / Admin</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setPage(1)
              setSearch('')
              setCategory('')
              setMode('')
              setCollege('')
              setSource('')
            }}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Clear filters
          </button>
          <p className="flex items-center text-sm text-gray-500">
            Showing page {page} of {pagination.totalPages} · {events.length} events on this page
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl bg-white p-8 text-center shadow-lg">Loading events...</div>
      ) : error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center shadow-lg">
          <h2 className="text-xl font-semibold text-gray-900">No upcoming events yet</h2>
          <p className="mt-2 text-gray-600">Check back later for new verified events.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <article
                key={event._id}
                className="flex flex-col h-full overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                <img
                  src={getEventImage(event.image, event.title, event.organizer, event.category, event.source)}
                  alt={event.title}
                  className="h-48 w-full object-cover shrink-0"
                />
                
                <div className="flex flex-col flex-grow p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-gray-900 line-clamp-1">{event.title}</h2>
                    <span className="shrink-0 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-700">
                      {event.mode}
                    </span>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm text-gray-600 flex-grow">{event.description}</p>

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

                  <div className="mt-5 flex flex-wrap items-center gap-3 pt-4 border-t border-gray-100">
                    <Link
                      to={`/events/${event._id}`}
                      className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-95 transform duration-150"
                    >
                      View details
                    </Link>
                    <BookmarkButton
                      eventId={event._id}
                      isBookmarked={isBookmarked(event._id)}
                      onToggle={toggleBookmark}
                      size="sm"
                    />
                    {(() => {
                      const isDeadlinePassed = new Date(event.registrationDeadline) < new Date();
                      if (isDeadlinePassed) {
                        return (
                          <button
                            disabled
                            className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
                          >
                            Registration Closed
                          </button>
                        );
                      }
                      if (!event.eventLink) {
                        return (
                          <button
                            disabled
                            className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed"
                          >
                            Link Not Available
                          </button>
                        );
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
                      );
                    })()}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
              disabled={page === 1}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-teal-300 hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>

            {Array.from({ length: pagination.totalPages }, (_, index) => {
              const pageNum = index + 1;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    page === pageNum
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'bg-white border border-gray-300 text-gray-700 hover:border-teal-300 hover:text-teal-600'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setPage((currentPage) => Math.min(currentPage + 1, pagination.totalPages))}
              disabled={!pagination.hasNextPage}
              className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-teal-300 hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
