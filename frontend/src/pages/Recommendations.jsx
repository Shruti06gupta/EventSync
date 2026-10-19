import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useBookmarks from '../hooks/useBookmarks'
import api from '../api'
import EventCard from '../components/EventCard'
import {
  RecommendationSkeletonGrid,
  RecommendationEmptyState,
  RecommendationErrorState,
  TabSectionHeader,
} from '../components/recommendations/RecommendationUI'

export default function Recommendations() {
  const { user } = useAuth()
  const { isBookmarked, toggleBookmark } = useBookmarks()
  const [activeTab, setActiveTab] = useState('for-you')

  // Tab 1: For You State
  const [forYouEvents, setForYouEvents] = useState([])
  const [loadingForYou, setLoadingForYou] = useState(true)
  const [errorForYou, setErrorForYou] = useState('')

  // Tab 3: Interests State
  const userInterests = Array.isArray(user?.interests) ? user.interests : []
  const [selectedInterest, setSelectedInterest] = useState('')
  const [interestEvents, setInterestEvents] = useState([])
  const [loadingInterest, setLoadingInterest] = useState(false)
  const [errorInterest, setErrorInterest] = useState('')

  // Tab 4: Nearby State
  const [locationInput, setLocationInput] = useState('')
  const [locationRadius, setLocationRadius] = useState(100)
  const [nearbySearch, setNearbySearch] = useState({
    active: false,
    name: '',
    latitude: null,
    longitude: null,
    radiusKm: 100,
  })
  const [nearbyEvents, setNearbyEvents] = useState([])
  const [loadingNearby, setLoadingNearby] = useState(false)
  const [errorNearby, setErrorNearby] = useState('')

  // Tab 5: Saved State
  const [savedEvents, setSavedEvents] = useState([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [errorSaved, setErrorSaved] = useState('')

  // Tab definitions
  const tabs = [
    {
      id: 'for-you',
      label: 'For You',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
        </svg>
      ),
    },
    {
      id: 'trending',
      label: 'Trending',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
        </svg>
      ),
    },
    {
      id: 'similar',
      label: 'Similar to Your Interests',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      id: 'nearby',
      label: 'Nearby Events',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      ),
    },
    {
      id: 'saved',
      label: 'Saved Recommendations',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
        </svg>
      ),
    },
  ]

  // Initialize selected interest when user profile loads
  useEffect(() => {
    if (userInterests.length > 0 && !selectedInterest) {
      setSelectedInterest(userInterests[0])
    }
  }, [userInterests, selectedInterest])

  // Fetch "For You" Events (Active verified events)
  const fetchForYouEvents = useCallback(async () => {
    try {
      setLoadingForYou(true)
      setErrorForYou('')
      const res = await api.get('/events', {
        params: {
          page: 1,
          limit: 9,
        },
      })
      setForYouEvents(res.data?.events || [])
    } catch (err) {
      setErrorForYou(err.response?.data?.message || 'Unable to load events right now.')
    } finally {
      setLoadingForYou(false)
    }
  }, [])

  // Fetch "Similar to Your Interests" Events
  const fetchInterestEvents = useCallback(async (interestTag) => {
    if (!interestTag) return
    try {
      setLoadingInterest(true)
      setErrorInterest('')
      const res = await api.get('/events', {
        params: {
          page: 1,
          limit: 9,
          search: interestTag,
        },
      })
      setInterestEvents(res.data?.events || [])
    } catch (err) {
      setErrorInterest(err.response?.data?.message || 'Unable to load interest-based events.')
    } finally {
      setLoadingInterest(false)
    }
  }, [])

  // Fetch "Nearby Events"
  const fetchNearbyEvents = useCallback(async (searchParams) => {
    if (!searchParams.active) return
    try {
      setLoadingNearby(true)
      setErrorNearby('')
      const res = await api.get('/events', {
        params: {
          page: 1,
          limit: 12,
          locationName: searchParams.name || undefined,
          latitude: searchParams.latitude ?? undefined,
          longitude: searchParams.longitude ?? undefined,
          radiusKm: searchParams.radiusKm,
        },
      })
      // Only keep in-person or hybrid events (online events are not physically nearby)
      const physicalOrHybrid = (res.data?.events || []).filter(
        (event) => event.mode && event.mode.toLowerCase() !== 'online'
      )
      setNearbyEvents(physicalOrHybrid)
    } catch (err) {
      setErrorNearby(err.response?.data?.message || 'Unable to load nearby events.')
    } finally {
      setLoadingNearby(false)
    }
  }, [])

  // Fetch "Saved Recommendations"
  const fetchSavedEvents = useCallback(async () => {
    try {
      setLoadingSaved(true)
      setErrorSaved('')
      const res = await api.get('/user/bookmarks')
      setSavedEvents((res.data?.events || []).filter(Boolean))
    } catch (err) {
      setErrorSaved(err.response?.data?.message || 'Unable to load saved events.')
    } finally {
      setLoadingSaved(false)
    }
  }, [])

  // Load data according to active tab
  useEffect(() => {
    if (activeTab === 'for-you' && forYouEvents.length === 0 && !errorForYou) {
      fetchForYouEvents()
    } else if (activeTab === 'similar' && selectedInterest) {
      fetchInterestEvents(selectedInterest)
    } else if (activeTab === 'saved') {
      fetchSavedEvents()
    }
  }, [activeTab, selectedInterest, forYouEvents.length, errorForYou, fetchForYouEvents, fetchInterestEvents, fetchSavedEvents])

  // Handle interest switch
  const handleSelectInterest = (interest) => {
    setSelectedInterest(interest)
    fetchInterestEvents(interest)
  }

  // Handle location search submit
  const handleFindNearby = (e) => {
    if (e) e.preventDefault()
    const trimmed = locationInput.trim()
    if (!trimmed && !nearbySearch.latitude && !nearbySearch.longitude) {
      setErrorNearby('Please enter a city or location to search.')
      return
    }

    const nextSearch = {
      active: true,
      name: trimmed || nearbySearch.name || 'Selected location',
      latitude: nearbySearch.latitude ?? null,
      longitude: nearbySearch.longitude ?? null,
      radiusKm: Number(locationRadius) || 100,
    }

    setNearbySearch(nextSearch)
    fetchNearbyEvents(nextSearch)
  }

  // Handle "Use My Location"
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setErrorNearby('Location access is not supported by your browser.')
      return
    }

    setErrorNearby('')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationInput('')
        const nextSearch = {
          active: true,
          name: 'Your Current Location',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          radiusKm: Number(locationRadius) || 100,
        }
        setNearbySearch(nextSearch)
        fetchNearbyEvents(nextSearch)
      },
      () => {
        setErrorNearby('Unable to access your location. You can enter a city manually.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Clear nearby search
  const handleClearNearby = () => {
    setLocationInput('')
    setNearbySearch({ active: false, name: '', latitude: null, longitude: null, radiusKm: 100 })
    setNearbyEvents([])
    setErrorNearby('')
  }

  // Handle bookmark toggle in Saved tab
  const handleToggleSavedBookmark = async (eventId) => {
    await toggleBookmark(eventId)
    setSavedEvents((current) => current.filter((event) => event._id !== eventId))
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* 1. Page Header (Hero Section) */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="relative overflow-hidden rounded-3xl border border-teal-100/90 bg-gradient-to-r from-teal-50/70 via-white to-teal-50/40 p-6 sm:p-10 shadow-soft-sm">
          {/* Decorative soft glows */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-brand-teal/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-brand-indigo/10 blur-2xl" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            {/* Left Copy */}
            <div className="max-w-2xl space-y-3.5">
              {/* AI Powered Badge */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50 px-3.5 py-1 text-xs font-bold text-brand-teal shadow-soft-sm">
                <svg className="h-3.5 w-3.5 text-brand-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
                <span>AI Powered</span>
              </div>

              {/* Heading */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-brand-text">
                Recommendations — <span className="text-gradient-teal">Tailored for You</span>
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
                Discover events that match your interests, skills, and goals.
              </p>
            </div>

            {/* Right Graphic / Badges Showcase */}
            <div className="hidden sm:flex flex-col items-center lg:items-end gap-2.5 shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-sm backdrop-blur-sm">
                  <span>🎓</span> Your Interests
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-sm backdrop-blur-sm">
                  <span>📍</span> Your Location
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-sm backdrop-blur-sm">
                  <span>📊</span> Your Activity
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-sm backdrop-blur-sm">
                  <span>👥</span> Similar Users
                </span>
              </div>
              <div className="mt-1 rounded-2xl border border-teal-200/70 bg-brand-teal-subtle/80 px-3.5 py-1.5 text-xs font-bold text-brand-teal shadow-soft-sm">
                ✨ Personalized event suggestions just for you
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Five Recommendation Tabs */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-8">
        <div
          role="tablist"
          aria-label="Recommendation Categories"
          className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar sm:flex-wrap"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-controls={`panel-${tab.id}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                  isActive
                    ? 'bg-brand-teal text-white shadow-soft-md shadow-brand-teal/20'
                    : 'border border-slate-200/90 bg-white text-slate-700 shadow-soft-sm hover:border-brand-teal/40 hover:bg-slate-50 hover:text-brand-teal'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 3. Main Content Layout (Main Area + Sidebar) */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Active Tab Content Area */}
          <main className="lg:col-span-8 space-y-6">
            {/* ========================================================================= */}
            {/* TAB 1: FOR YOU                                                            */}
            {/* ========================================================================= */}
            {activeTab === 'for-you' && (
              <section
                id="panel-for-you"
                role="tabpanel"
                aria-labelledby="tab-for-you"
                className="space-y-6 animate-in fade-in duration-200"
              >
                <TabSectionHeader
                  icon="🌟"
                  title="Top Picks for You"
                  description="Events with highest relevance based on your profile, interests, and campus activity."
                  count={loadingForYou ? undefined : forYouEvents.length}
                  countLabel="verified events"
                />

                {/* Honest Transparency Notice */}
                <div className="flex items-start gap-3 rounded-2xl border border-teal-100 bg-teal-50/70 p-4 text-xs text-teal-800">
                  <span className="text-base">ℹ️</span>
                  <div className="leading-relaxed">
                    <p className="font-semibold text-teal-900">
                      Discovery Feed Preview
                    </p>
                    <p className="mt-0.5 text-teal-700">
                      Currently showcasing verified opportunities from EventSync. Individual multi-factor AI match scoring will be calculated once the recommendation engine connects.
                    </p>
                  </div>
                </div>

                {/* Content States */}
                {loadingForYou ? (
                  <RecommendationSkeletonGrid count={6} />
                ) : errorForYou ? (
                  <RecommendationErrorState message={errorForYou} onRetry={fetchForYouEvents} />
                ) : forYouEvents.length === 0 ? (
                  <RecommendationEmptyState
                    icon="🔍"
                    title="No upcoming events available"
                    description="Check back soon for newly published verified opportunities."
                    actionText="Browse Events Directory"
                    actionLink="/events"
                  />
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {forYouEvents.map((event) => (
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

            {/* ========================================================================= */}
            {/* TAB 2: TRENDING                                                           */}
            {/* ========================================================================= */}
            {activeTab === 'trending' && (
              <section
                id="panel-trending"
                role="tabpanel"
                aria-labelledby="tab-trending"
                className="space-y-6 animate-in fade-in duration-200"
              >
                <TabSectionHeader
                  icon="🔥"
                  title="Trending Events"
                  description="Popular hackathons and workshops experiencing rapid registration momentum and community interest."
                />

                {/* Honest Not-Yet-Available State (No fabricated statistics) */}
                <RecommendationEmptyState
                  icon="🔥"
                  title="Trending Ranking Engine Connecting Soon"
                  description="Real-time trending ranking analyzes registration velocity, bookmark spikes, and community interest. We do not display fabricated popularity scores. You can explore all live events right now."
                  actionText="Explore All Events"
                  actionLink="/events"
                />
              </section>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: SIMILAR TO YOUR INTERESTS                                          */}
            {/* ========================================================================= */}
            {activeTab === 'similar' && (
              <section
                id="panel-similar"
                role="tabpanel"
                aria-labelledby="tab-similar"
                className="space-y-6 animate-in fade-in duration-200"
              >
                <TabSectionHeader
                  icon="🎯"
                  title="Similar to Your Interests"
                  description="Opportunities matching your selected technical interests, categories, and tags."
                  count={loadingInterest ? undefined : interestEvents.length}
                  countLabel="matching events"
                />

                {/* Interest Tags Filter Bar */}
                {userInterests.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                      Your Selected Interests:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {userInterests.map((interest) => {
                        const isCurrent = selectedInterest === interest
                        return (
                          <button
                            key={interest}
                            type="button"
                            onClick={() => handleSelectInterest(interest)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                              isCurrent
                                ? 'bg-brand-teal text-white shadow-soft-sm'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            #{interest}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <RecommendationEmptyState
                    icon="🎯"
                    title="No profile interests configured"
                    description="You haven't selected your technical interests or preferred categories yet. Add them in your profile to discover matched events."
                    actionText="Add Interests to Profile"
                    actionLink="/profile"
                  />
                )}

                {/* Events list for selected interest */}
                {userInterests.length > 0 && (
                  <>
                    {loadingInterest ? (
                      <RecommendationSkeletonGrid count={6} />
                    ) : errorInterest ? (
                      <RecommendationErrorState
                        message={errorInterest}
                        onRetry={() => fetchInterestEvents(selectedInterest)}
                      />
                    ) : interestEvents.length === 0 ? (
                      <RecommendationEmptyState
                        icon="🔍"
                        title={`No events found matching #${selectedInterest}`}
                        description="Try selecting another interest tag above or explore all active events in EventSync."
                        actionText="Explore All Events"
                        actionLink="/events"
                      />
                    ) : (
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {interestEvents.map((event) => (
                          <EventCard
                            key={event._id}
                            event={event}
                            isBookmarked={isBookmarked(event._id)}
                            onBookmarkToggle={toggleBookmark}
                            matchReason={`Matches your interest: #${selectedInterest}`}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: NEARBY EVENTS                                                      */}
            {/* ========================================================================= */}
            {activeTab === 'nearby' && (
              <section
                id="panel-nearby"
                role="tabpanel"
                aria-labelledby="tab-nearby"
                className="space-y-6 animate-in fade-in duration-200"
              >
                <TabSectionHeader
                  icon="📍"
                  title="Recommended Near You"
                  description="In-person and hybrid hackathons, workshops, and college events in your area (strictly excludes online events)."
                  count={loadingNearby ? undefined : nearbyEvents.length}
                  countLabel="physical/hybrid events"
                />

                {/* Location Search Control Bar */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-soft-sm space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        📍
                      </span>
                      <input
                        type="text"
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        placeholder="Enter city or area name..."
                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleFindNearby()
                        }}
                      />
                    </div>

                    <select
                      value={locationRadius}
                      onChange={(e) => setLocationRadius(Number(e.target.value))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-brand-teal"
                    >
                      <option value={10}>Within 10 km</option>
                      <option value={25}>Within 25 km</option>
                      <option value={50}>Within 50 km</option>
                      <option value={100}>Within 100 km</option>
                      <option value={250}>Within 250 km</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleFindNearby}
                      className="rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-teal-dark active:scale-95"
                    >
                      Find Nearby
                    </button>

                    <button
                      type="button"
                      onClick={handleUseMyLocation}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-brand-teal hover:text-brand-teal active:scale-95"
                    >
                      Use My Location
                    </button>
                  </div>

                  {nearbySearch.active && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200/60">
                          📍 {nearbySearch.name}
                        </span>
                        <span>within {nearbySearch.radiusKm} km radius</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearNearby}
                        className="text-xs font-bold text-rose-600 hover:underline"
                      >
                        Clear Location Search
                      </button>
                    </div>
                  )}
                </div>

                {/* State rendering */}
                {loadingNearby ? (
                  <RecommendationSkeletonGrid count={6} />
                ) : errorNearby ? (
                  <RecommendationErrorState
                    message={errorNearby}
                    onRetry={() => fetchNearbyEvents(nearbySearch)}
                  />
                ) : !nearbySearch.active ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-soft-sm">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 text-3xl shadow-soft-sm mb-3">
                      📍
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Discover Nearby Offline & Hybrid Events
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 max-w-md mx-auto">
                      Click "Use My Location" or enter your city above to find verified campus hackathons and tech meetups in your area.
                    </p>
                    <div className="mt-5 flex justify-center">
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-teal-dark active:scale-95"
                      >
                        <span>Use My Location</span>
                      </button>
                    </div>
                  </div>
                ) : nearbyEvents.length === 0 ? (
                  <RecommendationEmptyState
                    icon="📍"
                    title={`No offline/hybrid events found near ${nearbySearch.name}`}
                    description={`We couldn't find in-person events within ${nearbySearch.radiusKm} km. Try expanding your search radius or exploring virtual hackathons.`}
                    actionText="Browse Online Events"
                    actionLink="/events?mode=Online"
                  />
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {nearbyEvents.map((event) => (
                      <EventCard
                        key={event._id}
                        event={event}
                        isBookmarked={isBookmarked(event._id)}
                        onBookmarkToggle={toggleBookmark}
                        distanceKm={event.distanceKm}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ========================================================================= */}
            {/* TAB 5: SAVED RECOMMENDATIONS                                              */}
            {/* ========================================================================= */}
            {activeTab === 'saved' && (
              <section
                id="panel-saved"
                role="tabpanel"
                aria-labelledby="tab-saved"
                className="space-y-6 animate-in fade-in duration-200"
              >
                <TabSectionHeader
                  icon="🔖"
                  title="Saved Recommendations"
                  description="Opportunities you have bookmarked from your discovery feed."
                  count={loadingSaved ? undefined : savedEvents.length}
                  countLabel="saved events"
                />

                {loadingSaved ? (
                  <RecommendationSkeletonGrid count={6} />
                ) : errorSaved ? (
                  <RecommendationErrorState message={errorSaved} onRetry={fetchSavedEvents} />
                ) : savedEvents.length === 0 ? (
                  <RecommendationEmptyState
                    icon="🔖"
                    title="No saved recommendations yet"
                    description="When you save events across EventSync, they will be organized here for easy tracking and deadline monitoring."
                    actionText="Discover Events"
                    actionLink="/events"
                  />
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {savedEvents.map((event) => (
                      <EventCard
                        key={event._id}
                        event={event}
                        isBookmarked={true}
                        onBookmarkToggle={handleToggleSavedBookmark}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </main>

          {/* Right Column: Information & Insights Sidebar */}
          <aside className="lg:col-span-4 space-y-6">
            {/* Widget 1: Your Profile Preferences */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-soft-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚙️</span>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Your Profile Preferences
                  </h3>
                </div>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1 text-xs font-bold text-brand-teal hover:text-brand-teal-dark transition"
                >
                  <span>Edit</span>
                  <span>↗</span>
                </Link>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-2.5">
                  Interests influencing your recommendations:
                </p>

                {userInterests.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {userInterests.map((interest) => (
                      <span
                        key={interest}
                        className="inline-flex items-center rounded-xl bg-brand-teal-subtle px-2.5 py-1 text-xs font-semibold text-brand-teal border border-brand-teal/20"
                      >
                        #{interest}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 text-center">
                    <p className="text-xs text-slate-500">
                      No interests added yet.
                    </p>
                    <Link
                      to="/profile"
                      className="mt-2 inline-block text-xs font-bold text-brand-teal hover:underline"
                    >
                      + Add interests in your profile
                    </Link>
                  </div>
                )}
              </div>

              {user?.college && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Campus:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[65%] text-right">
                    {user.college}
                  </span>
                </div>
              )}
            </div>

            {/* Widget 2: AI Insight */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-soft-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
                <span className="text-lg">💡</span>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  AI Insight
                </h3>
              </div>

              <div className="rounded-2xl border border-teal-100/80 bg-teal-50/50 p-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Personalized AI insights will synthesize your profile, activity, and nearby events to highlight where your strongest opportunities lie. Full AI insight generation connects in Step 5.
                </p>
              </div>
            </div>

            {/* Widget 3: Recommendation Factors */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-soft-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Recommendation Factors
                  </h3>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  Planned
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                How profile factors will shape your recommendation scores:
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span>🎯</span> Selected Interests
                    </span>
                    <span className="font-bold text-brand-teal">40%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-teal" style={{ width: '40%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span>📍</span> Location Preference
                    </span>
                    <span className="font-bold text-brand-teal">25%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-teal" style={{ width: '25%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span>🔖</span> Saved & Activity
                    </span>
                    <span className="font-bold text-brand-teal">20%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-teal" style={{ width: '20%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <span>🔥</span> Trending in Network
                    </span>
                    <span className="font-bold text-brand-teal">15%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-teal" style={{ width: '15%' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 4: Explore More Quick Links */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-soft-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3.5">
                <span className="text-lg">🧭</span>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Explore More
                </h3>
              </div>

              <div className="space-y-1.5">
                <Link
                  to="/events"
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-brand-teal"
                >
                  <span>All Verified Events</span>
                  <span className="text-slate-400">→</span>
                </Link>

                <Link
                  to="/events?mode=Online"
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-brand-teal"
                >
                  <span>Online & Virtual Events</span>
                  <span className="text-slate-400">→</span>
                </Link>

                <Link
                  to="/events?mode=Offline"
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-brand-teal"
                >
                  <span>In-Person Campus Events</span>
                  <span className="text-slate-400">→</span>
                </Link>

                <Link
                  to="/bookmarks"
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-brand-teal"
                >
                  <span>Your Saved Bookmarks</span>
                  <span className="text-slate-400">→</span>
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
