import React, { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api'
import EventCard from '../components/EventCard'
import useBookmarks from '../hooks/useBookmarks'

export default function Events() {
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''
  const initialCategory = searchParams.get('category') || ''

  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ totalPages: 1, totalEvents: 0 })
  const [search, setSearch] = useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch)
  const [category, setCategory] = useState(initialCategory)
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
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-teal-700 to-emerald-600 p-8 sm:p-12 text-white shadow-soft-xl">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-48 h-48 bg-white/5 rounded-full blur-2xl" />
          <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-white/30 rounded-full" />
          <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-white/20 rounded-full" />
          <div className="absolute bottom-1/3 left-1/4 w-1 h-1 bg-white/25 rounded-full" />
          
          <div className="relative z-10">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-100 mb-2">Discover Events</p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4">
              Find Hackathons, Workshops & Conferences
            </h1>
            <p className="max-w-2xl text-base text-teal-100 mb-6">
              Browse verified events from across EventSync. Track registration deadlines and discover opportunities matching your interests.
            </p>
            {!loading && pagination.totalEvents > 0 && (
              <div className="flex flex-wrap items-center gap-3 text-sm text-teal-100">
                <span className="font-semibold text-white">{pagination.totalEvents}</span>
                <span>events available</span>
                <span className="text-teal-200">·</span>
                <span className="font-semibold text-white">{pagination.totalPages}</span>
                <span>pages</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(event) => resetPageAndFilters(setSearch)(event.target.value)}
            placeholder="Search events, hackathons, workshops..."
            className="w-full rounded-2xl border border-slate-200 bg-white pl-14 pr-4 py-4 text-sm text-slate-900 placeholder-slate-400 shadow-soft-md outline-none transition-all duration-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <select
              value={category}
              onChange={(event) => resetPageAndFilters(setCategory)(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:border-teal-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Category</option>
              {availableCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {/* Mode Filter */}
            <select
              value={mode}
              onChange={(event) => resetPageAndFilters(setMode)(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:border-teal-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Mode</option>
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
              <option value="Hybrid">Hybrid</option>
            </select>

            {/* Source Filter */}
            <select
              value={source}
              onChange={(event) => resetPageAndFilters(setSource)(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:border-teal-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="">Source</option>
              <option value="devfolio">Devfolio</option>
              <option value="unstop">Unstop</option>
              <option value="manual">Manual / Admin</option>
            </select>

            {/* College Filter */}
            <input
              type="text"
              value={college}
              onChange={(event) => resetPageAndFilters(setCollege)(event.target.value)}
              placeholder="College..."
              className="w-40 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition hover:border-teal-500 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
            />

            <div className="flex-1" />

            {/* Clear Filters Button */}
            {(search || category || mode || college || source) && (
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
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
              >
                Clear Filters
              </button>
            )}

            {/* Results Count */}
            <span className="text-xs text-slate-500 font-medium">
              {events.length} events on this page
            </span>
          </div>
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
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-12 text-center shadow-soft-sm">
            <div className="text-4xl mb-3">⚠️</div>
            <h3 className="text-lg font-bold text-rose-800">Unable to load events</h3>
            <p className="mt-2 text-sm text-rose-600">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-soft-sm">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-brand-text">No events found</h3>
            <p className="mt-2 text-sm text-brand-muted">
              Try adjusting your search or filters to find what you're looking for.
            </p>
            {(search || category || mode || college || source) && (
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
                className="mt-6 rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <EventCard
                  key={event._id}
                  event={event}
                  isBookmarked={isBookmarked(event._id)}
                  onBookmarkToggle={toggleBookmark}
                />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                disabled={page === 1}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-teal hover:text-brand-teal disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
              >
                ← Previous
              </button>

              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, index) => {
                let pageNum;
                if (pagination.totalPages <= 7) {
                  pageNum = index + 1;
                } else if (page <= 4) {
                  pageNum = index < 5 ? index + 1 : '...';
                } else if (page >= pagination.totalPages - 3) {
                  pageNum = index < 2 ? (index === 0 ? 1 : '...') : pagination.totalPages - 6 + index;
                } else {
                  pageNum = index === 0 ? 1 : index === 1 ? '...' : index === 2 ? page - 1 : index === 3 ? page : index === 4 ? page + 1 : index === 5 ? '...' : pagination.totalPages;
                }
                
                if (pageNum === '...') {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400">
                      ...
                    </span>
                  );
                }
                
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setPage(pageNum)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition active:scale-95 ${
                      page === pageNum
                        ? 'bg-brand-teal text-white border border-brand-teal'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-brand-teal hover:text-brand-teal'
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
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-teal hover:text-brand-teal disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
