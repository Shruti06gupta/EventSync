import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useBookmarks from '../hooks/useBookmarks'
import api from '../api'
import EventCard from '../components/EventCard'

export default function Home() {
  const { user } = useAuth()
  const { isBookmarked, toggleBookmark } = useBookmarks()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState([])
  const [featuredEvents, setFeaturedEvents] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [totalEventsCount, setTotalEventsCount] = useState(0)

  // Fetch categories and tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await api.get('/events/tags')
        if (res.data?.tags && res.data.tags.length > 0) {
          setCategories(res.data.tags.slice(0, 8))
        } else {
          setCategories(['Hackathons', 'Workshops', 'Conferences', 'Tech Events', 'Campus Events', 'AI & ML', 'Web3'])
        }
      } catch {
        setCategories(['Hackathons', 'Workshops', 'Conferences', 'Tech Events', 'Campus Events', 'AI & ML', 'Web3'])
      }
    }

    fetchTags()
  }, [])

  // Fetch featured events if user is logged in
  useEffect(() => {
    const fetchHomeEvents = async () => {
      if (!user) {
        setLoadingEvents(false)
        return
      }

      try {
        setLoadingEvents(true)
        const res = await api.get('/events', {
          params: {
            page: 1,
            limit: 6,
          },
        })
        setFeaturedEvents(res.data?.events || [])
        setTotalEventsCount(res.data?.pagination?.totalEvents || res.data?.events?.length || 0)
      } catch (err) {
        console.error('Could not fetch events for home page', err)
      } finally {
        setLoadingEvents(false)
      }
    }

    fetchHomeEvents()
  }, [user])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/events?search=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      navigate('/events')
    }
  }

  const handleCategoryClick = (cat) => {
    navigate(`/events?category=${encodeURIComponent(cat)}`)
  }

  return (
    <div className="relative min-h-screen bg-brand-bg text-brand-text">
      
      {/* Background Subtle Gradient Glows */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
        <div className="hero-gradient absolute inset-0" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[700px] rounded-full bg-gradient-to-tr from-brand-teal/15 via-brand-indigo/10 to-transparent blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-20 space-y-20">

        {/* 1. HERO SECTION */}
        <section className="pt-6 sm:pt-10 lg:pt-14">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            
            {/* Left Column: Hero Copy & Search */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-teal/30 bg-brand-teal-subtle/80 px-4 py-1.5 text-xs font-bold text-brand-teal shadow-soft-sm backdrop-blur-md">
                <span className="flex h-2 w-2 rounded-full bg-brand-teal animate-ping" />
                <span>Discover. Connect. Participate.</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-brand-text leading-[1.15]">
                Discover Events That <br className="hidden sm:inline" />
                <span className="text-gradient-teal">Matter to You</span>
              </h1>

              {/* Supporting Text */}
              <p className="max-w-2xl mx-auto lg:mx-0 text-base sm:text-lg text-brand-muted leading-relaxed">
                Find hackathons, workshops, conferences and campus events in one unified hub. Track registration deadlines and elevate your university journey.
              </p>

              {/* Search Bar Area */}
              <form
                onSubmit={handleSearchSubmit}
                className="mt-6 flex flex-col sm:flex-row items-stretch gap-2.5 max-w-xl mx-auto lg:mx-0 rounded-2xl bg-white p-2 border border-slate-200/90 shadow-soft-md focus-within:border-brand-teal focus-within:ring-2 focus-within:ring-brand-teal/20 transition-all"
              >
                <div className="relative flex flex-1 items-center px-3">
                  <svg className="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search events, hackathons, workshops..."
                    className="w-full bg-transparent px-3 py-2.5 text-sm text-brand-text placeholder-slate-400 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-teal px-6 py-3 text-sm font-bold text-white shadow-sm transition duration-150 hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95 shrink-0"
                >
                  Explore Events
                </button>
              </form>

              {/* Trending Discovery Pills */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 pt-1 text-xs text-brand-muted">
                <span className="font-semibold text-slate-500">Popular:</span>
                {['Hackathons', 'AI & ML', 'Workshops', 'Web3'].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleCategoryClick(item)}
                    className="rounded-lg bg-white px-2.5 py-1 font-medium text-slate-600 border border-slate-200/80 shadow-soft-sm transition hover:border-brand-teal hover:text-brand-teal"
                  >
                    {item}
                  </button>
                ))}
              </div>

            </div>

            {/* Right Column: Hero Visual Graphic / Interactive Showcase */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative w-full max-w-md">
                
                {/* Decorative background glow */}
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-brand-teal/20 to-brand-indigo/20 blur-xl opacity-70" />

                {/* Main Hero Card Showcase */}
                <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-soft-xl space-y-4">
                  
                  {/* Card Header with Badges */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Live Aggregator
                      </span>
                    </div>
                    <span className="rounded-full bg-brand-teal-subtle px-3 py-1 text-[11px] font-bold text-brand-teal">
                      Verified Events
                    </span>
                  </div>

                  {/* Sample Event Feature Preview */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-4 text-white">
                    <div className="flex items-center justify-between text-xs text-brand-teal-light">
                      <span className="font-semibold">🏆 Devfolio Hackathon</span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px]">Online</span>
                    </div>
                    <h4 className="mt-2 text-base font-bold">Smart India Campus Hackathon 2026</h4>
                    <p className="mt-1 text-xs text-slate-300 line-clamp-2">
                      Build real-world solutions for next-gen problems. Cash prizes, certificates, and direct mentorship.
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-[11px] text-slate-300">
                      <span>⏰ Closes in 48 hours</span>
                      <span className="font-bold text-brand-teal-light">Register ↗</span>
                    </div>
                  </div>

                  {/* Floating Stat Widgets */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-center">
                      <div className="text-xl font-extrabold text-brand-teal">
                        {totalEventsCount > 0 ? `${totalEventsCount}+` : '100+'}
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold text-slate-500">Live Opportunities</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 text-center">
                      <div className="text-xl font-extrabold text-brand-indigo">100%</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-slate-500">Verified Sources</div>
                    </div>
                  </div>

                </div>

                {/* Floating Micro Badge - Left */}
                <div className="absolute -bottom-4 -left-4 hidden sm:flex items-center gap-2.5 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-2.5 shadow-soft-lg backdrop-blur-md">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-amber-600 text-xs font-bold">
                    🔔
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-800">Deadline Alerts</div>
                    <div className="text-[10px] text-slate-500">Never miss deadlines</div>
                  </div>
                </div>

                {/* Floating Micro Badge - Right */}
                <div className="absolute -top-4 -right-4 hidden sm:flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 px-3.5 py-2 shadow-soft-lg backdrop-blur-md">
                  <span className="text-brand-teal font-bold text-xs">✨ Devfolio & Unstop</span>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* 2. QUICK DISCOVERY CATEGORIES */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-teal">Explore By Domain</p>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-text">Quick Discovery</h2>
            </div>
            <Link
              to="/events"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-teal hover:text-brand-teal-dark transition"
            >
              Browse All Categories <span>→</span>
            </Link>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => handleCategoryClick(category)}
                className="group inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-soft-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-brand-teal hover:bg-brand-teal-subtle/50 hover:text-brand-teal hover:shadow-soft-md active:scale-95"
              >
                <span>{category}</span>
                <span className="text-slate-400 group-hover:text-brand-teal transition">→</span>
              </button>
            ))}
          </div>
        </section>

        {/* 3. PERSONALIZED SECTION (When User is Authenticated) */}
        {user && (
          <section className="relative overflow-hidden rounded-3xl border border-brand-teal/30 bg-gradient-to-r from-brand-teal/10 via-brand-indigo/5 to-white p-6 sm:p-8 shadow-soft-md">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-teal px-3 py-1 text-[11px] font-bold text-white">
                  <span>🎓 Personalized for You</span>
                </div>
                <h3 className="text-2xl font-bold text-brand-text">
                  Welcome back, {user.name}!
                </h3>
                <p className="text-sm text-brand-muted max-w-xl">
                  {user.college ? (
                    <>
                      Prioritizing campus events from <strong className="text-slate-800">{user.college}</strong> and curated tech opportunities matching your profile.
                    </>
                  ) : (
                    'Discover campus events and stay on top of upcoming hackathons.'
                  )}
                </p>

                {user.interests && user.interests.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    <span className="text-xs font-semibold text-slate-500">Your Interests:</span>
                    {user.interests.map((interest) => (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => handleCategoryClick(interest)}
                        className="rounded-lg bg-white/80 border border-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:border-brand-teal hover:text-brand-teal transition"
                      >
                        #{interest}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 shrink-0">
                <Link
                  to="/events"
                  className="rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-teal-dark active:scale-95"
                >
                  Explore Feed
                </Link>
                {user.role !== 'admin' && (
                  <Link
                    to="/bookmarks"
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-brand-teal hover:text-brand-teal active:scale-95"
                  >
                    View Bookmarks
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 4. FEATURED / DISCOVER EVENTS SECTION */}
        {user && (
          <section className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-brand-teal">Latest Opportunities</p>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-text">Upcoming Verified Events</h2>
              </div>
              <Link
                to="/events"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-teal hover:text-brand-teal-dark transition"
              >
                View all events ({totalEventsCount}) <span>→</span>
              </Link>
            </div>

            {loadingEvents ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-soft-sm"
                  >
                    <div className="h-40 rounded-2xl bg-slate-100" />
                    <div className="mt-4 h-5 w-3/4 rounded bg-slate-100" />
                    <div className="mt-2 h-4 w-1/2 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
            ) : featuredEvents.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-soft-sm">
                <div className="text-3xl mb-2">🎉</div>
                <h3 className="text-lg font-bold text-brand-text">No active events found</h3>
                <p className="mt-1 text-sm text-brand-muted">Check back soon for newly published campus events.</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredEvents.map((event) => (
                  <EventCard
                    key={event._id}
                    event={event}
                    isBookmarked={isBookmarked(event._id)}
                    onBookmarkToggle={toggleBookmark}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* 5. TRUST / VALUE PROPOSITION SECTION */}
        <section className="space-y-8 pt-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-teal">Why EventSync</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-text">
              Everything You Need to Never Miss Out
            </h2>
            <p className="text-sm sm:text-base text-brand-muted">
              Built specifically for ambitious students, club leads, and developers.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Value Card 1 */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-soft-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-teal/50 hover:shadow-soft-lg space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal-subtle text-brand-teal text-2xl shadow-sm">
                ⚡
              </div>
              <h3 className="text-lg font-bold text-brand-text">Multi-Source Aggregator</h3>
              <p className="text-sm text-brand-muted leading-relaxed">
                We automatically aggregate competitions and hackathons from platforms like Devfolio and Unstop alongside verified campus clubs.
              </p>
            </div>

            {/* Value Card 2 */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-soft-sm transition-all duration-200 hover:-translate-y-1 hover:border-brand-indigo/50 hover:shadow-soft-lg space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-brand-indigo text-2xl shadow-sm">
                ⏰
              </div>
              <h3 className="text-lg font-bold text-brand-text">Smart Deadline Tracking</h3>
              <p className="text-sm text-brand-muted leading-relaxed">
                Automated reminders for bookmark deadlines, registration closing dates, and live status badges keep you organized and ahead of time.
              </p>
            </div>

            {/* Value Card 3 */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-soft-sm transition-all duration-200 hover:-translate-y-1 hover:border-purple-200 hover:shadow-soft-lg space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-brand-purple text-2xl shadow-sm">
                🏛️
              </div>
              <h3 className="text-lg font-bold text-brand-text">Campus-Centric Discovery</h3>
              <p className="text-sm text-brand-muted leading-relaxed">
                Personalized college feeds prioritize local workshops, tech fests, and cultural events happening right at your institution.
              </p>
            </div>
          </div>
        </section>

        {/* 6. CALL TO ACTION BANNER */}
        {!user && (
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand-teal via-teal-600 to-brand-indigo p-8 sm:p-12 text-white shadow-soft-xl">
            <div className="relative z-10 max-w-2xl space-y-4 text-center sm:text-left">
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Ready to find your next competition?
              </h2>
              <p className="text-sm sm:text-base text-teal-50 leading-relaxed">
                Join EventSync today to save events, track deadlines, and receive personalized notifications for upcoming hackathons.
              </p>
              <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
                <Link
                  to="/register"
                  className="w-full sm:w-auto rounded-xl bg-white px-6 py-3 text-center text-sm font-bold text-slate-900 shadow-md transition hover:bg-slate-50 active:scale-95"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-center text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
                >
                  Sign In
                </Link>
              </div>
            </div>

            {/* Decorative background shapes */}
            <div className="pointer-events-none absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          </section>
        )}

      </div>

      {/* 7. MODERN FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid gap-8 md:grid-cols-4">
            
            {/* Brand column */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-teal to-brand-indigo text-white shadow-sm">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                  </svg>
                </div>
                <span className="text-lg font-bold tracking-tight text-brand-text">
                  Event<span className="text-brand-teal">Sync</span>
                </span>
              </div>
              <p className="max-w-sm text-xs text-brand-muted leading-relaxed">
                The unified campus and tech event discovery platform. Aggregating verified hackathons, conferences, and workshops across institutions.
              </p>
            </div>

            {/* Navigation Links */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Navigation</h4>
              <ul className="space-y-2 text-xs text-brand-muted">
                <li>
                  <Link to="/events" className="hover:text-brand-teal transition">
                    Explore Events
                  </Link>
                </li>
                {user ? (
                  <>
                    {user.role !== 'admin' && (
                      <li>
                        <Link to="/bookmarks" className="hover:text-brand-teal transition">
                          Saved Bookmarks
                        </Link>
                      </li>
                    )}
                    <li>
                      <Link to="/profile" className="hover:text-brand-teal transition">
                        Your Profile
                      </Link>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link to="/login" className="hover:text-brand-teal transition">
                        Sign In
                      </Link>
                    </li>
                    <li>
                      <Link to="/register" className="hover:text-brand-teal transition">
                        Create Account
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Platform & Categories */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Discovery</h4>
              <ul className="space-y-2 text-xs text-brand-muted">
                <li>
                  <button type="button" onClick={() => handleCategoryClick('Hackathons')} className="hover:text-brand-teal transition">
                    Hackathons
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleCategoryClick('Workshops')} className="hover:text-brand-teal transition">
                    Workshops
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleCategoryClick('Conferences')} className="hover:text-brand-teal transition">
                    Conferences
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleCategoryClick('Campus Events')} className="hover:text-brand-teal transition">
                    Campus Events
                  </button>
                </li>
              </ul>
            </div>

          </div>

          <div className="mt-10 border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} EventSync. All rights reserved.</p>
            <p className="flex items-center gap-1 text-slate-400">
              Designed with <span>❤️</span> for student innovators
            </p>
          </div>
        </div>
      </footer>

    </div>
  )
}
