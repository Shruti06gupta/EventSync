import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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

const POPULAR_SUGGESTION_TOPICS = [
  'Web Development',
  'Machine Learning',
  'AI & ML',
  'Cloud',
  'Cybersecurity',
  'Open Source',
  'Mobile Apps',
]

const VALID_TAB_IDS = ['for-you', 'trending', 'similar', 'nearby', 'saved']

export default function Recommendations() {
  const { user } = useAuth()
  const { isBookmarked, toggleBookmark, bookmarkIds } = useBookmarks()
  const [searchParams, setSearchParams] = useSearchParams()

  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    VALID_TAB_IDS.includes(initialTab) ? initialTab : 'for-you'
  )

  // Keep state in sync if URL query parameter changes (e.g. browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && VALID_TAB_IDS.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam)
    }
  }, [searchParams, activeTab])

  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', tabId)
        return next
      },
      { replace: true }
    )
  }

  // ---------------------------------------------------------------------------
  // Tab 1: For You State
  // ---------------------------------------------------------------------------
  const [forYouRecommendations, setForYouRecommendations] = useState([])
  const [isColdStartUser, setIsColdStartUser] = useState(false)
  const [loadingForYou, setLoadingForYou] = useState(true)
  const [errorForYou, setErrorForYou] = useState('')
  const [paginationForYou, setPaginationForYou] = useState(null)
  const [pageForYou, setPageForYou] = useState(1)
  const forYouReqIdRef = useRef(0)

  // ---------------------------------------------------------------------------
  // Tab 2: Trending State
  // ---------------------------------------------------------------------------
  const [trendingEvents, setTrendingEvents] = useState([])
  const [hasEngagementTrending, setHasEngagementTrending] = useState(false)
  const [loadingTrending, setLoadingTrending] = useState(false)
  const [errorTrending, setErrorTrending] = useState('')
  const [paginationTrending, setPaginationTrending] = useState(null)
  const [pageTrending, setPageTrending] = useState(1)
  const trendingReqIdRef = useRef(0)

  // ---------------------------------------------------------------------------
  // Tab 3: Interests State
  // ---------------------------------------------------------------------------
  const userInterests = Array.isArray(user?.interests) ? user.interests : []
  const [selectedInterest, setSelectedInterest] = useState('')
  const [customInterestInput, setCustomInterestInput] = useState('')
  const [interestEvents, setInterestEvents] = useState([])
  const [loadingInterest, setLoadingInterest] = useState(false)
  const [errorInterest, setErrorInterest] = useState('')
  const [paginationInterest, setPaginationInterest] = useState(null)
  const [pageInterest, setPageInterest] = useState(1)
  const interestReqIdRef = useRef(0)

  // ---------------------------------------------------------------------------
  // Tab 4: Nearby State
  // ---------------------------------------------------------------------------
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
  const [paginationNearby, setPaginationNearby] = useState(null)
  const [pageNearby, setPageNearby] = useState(1)
  const nearbyReqIdRef = useRef(0)

  // ---------------------------------------------------------------------------
  // Tab 5: Saved State
  // ---------------------------------------------------------------------------
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
      setSelectedInterest('all')
    } else if (userInterests.length === 0 && !selectedInterest) {
      setSelectedInterest('Web Development')
    }
  }, [userInterests, selectedInterest])

  // ---------------------------------------------------------------------------
  // Data Fetching Handlers
  // ---------------------------------------------------------------------------

  // Fetch "For You" Events
  const fetchForYouEvents = useCallback(async (targetPage = 1) => {
    const reqId = ++forYouReqIdRef.current
    try {
      setLoadingForYou(true)
      setErrorForYou('')
      const res = await api.get('/events/recommended', {
        params: {
          type: 'for-you',
          page: targetPage,
          limit: 12,
        },
      })
      if (reqId !== forYouReqIdRef.current) return

      const recs = res.data?.recommendations || []
      setForYouRecommendations(recs)
      setIsColdStartUser(Boolean(res.data?.isColdStart))
      setPaginationForYou(res.data?.pagination || null)
      setPageForYou(targetPage)
    } catch (err) {
      if (reqId !== forYouReqIdRef.current) return
      setErrorForYou(err.response?.data?.message || 'Unable to load recommendations right now.')
    } finally {
      if (reqId === forYouReqIdRef.current) {
        setLoadingForYou(false)
      }
    }
  }, [])

  // Fetch "Trending" Events
  const fetchTrendingEvents = useCallback(async (targetPage = 1) => {
    const reqId = ++trendingReqIdRef.current
    try {
      setLoadingTrending(true)
      setErrorTrending('')
      const res = await api.get('/events/recommended', {
        params: {
          type: 'trending',
          page: targetPage,
          limit: 12,
        },
      })
      if (reqId !== trendingReqIdRef.current) return

      setTrendingEvents(res.data?.events || [])
      setHasEngagementTrending(Boolean(res.data?.hasEngagementData))
      setPaginationTrending(res.data?.pagination || null)
      setPageTrending(targetPage)
    } catch (err) {
      if (reqId !== trendingReqIdRef.current) return
      setErrorTrending(err.response?.data?.message || 'Unable to load trending events.')
    } finally {
      if (reqId === trendingReqIdRef.current) {
        setLoadingTrending(false)
      }
    }
  }, [])

  // Fetch "Similar to Your Interests" Events
  const fetchInterestEvents = useCallback(async (interestTag, targetPage = 1) => {
    if (!interestTag) return
    const reqId = ++interestReqIdRef.current
    try {
      setLoadingInterest(true)
      setErrorInterest('')
      const res = await api.get('/events/recommended', {
        params: {
          type: 'similar',
          interest: interestTag,
          page: targetPage,
          limit: 12,
        },
      })
      if (reqId !== interestReqIdRef.current) return

      setInterestEvents(res.data?.events || [])
      setPaginationInterest(res.data?.pagination || null)
      setPageInterest(targetPage)
    } catch (err) {
      if (reqId !== interestReqIdRef.current) return
      setErrorInterest(err.response?.data?.message || 'Unable to load interest-based events.')
    } finally {
      if (reqId === interestReqIdRef.current) {
        setLoadingInterest(false)
      }
    }
  }, [])

  // Fetch "Nearby Events"
  const fetchNearbyEvents = useCallback(async (searchParams, targetPage = 1) => {
    if (!searchParams.active) return
    const reqId = ++nearbyReqIdRef.current
    try {
      setLoadingNearby(true)
      setErrorNearby('')
      const res = await api.get('/events/recommended', {
        params: {
          type: 'nearby',
          page: targetPage,
          limit: 12,
          locationName: searchParams.name || undefined,
          latitude: searchParams.latitude ?? undefined,
          longitude: searchParams.longitude ?? undefined,
          radiusKm: searchParams.radiusKm,
        },
      })
      if (reqId !== nearbyReqIdRef.current) return

      const physicalOrHybrid = (res.data?.events || []).filter(
        (event) => event.mode && event.mode.toLowerCase() !== 'online'
      )
      setNearbyEvents(physicalOrHybrid)
      setPaginationNearby(res.data?.pagination || null)
      setPageNearby(targetPage)
    } catch (err) {
      if (reqId !== nearbyReqIdRef.current) return
      setErrorNearby(err.response?.data?.message || 'Unable to load nearby events.')
    } finally {
      if (reqId === nearbyReqIdRef.current) {
        setLoadingNearby(false)
      }
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
    if (activeTab === 'for-you' && forYouRecommendations.length === 0 && !errorForYou) {
      fetchForYouEvents(1)
    } else if (activeTab === 'trending' && trendingEvents.length === 0 && !errorTrending) {
      fetchTrendingEvents(1)
    } else if (activeTab === 'similar' && selectedInterest && interestEvents.length === 0 && !errorInterest) {
      fetchInterestEvents(selectedInterest, 1)
    } else if (activeTab === 'saved') {
      fetchSavedEvents()
    }
  }, [
    activeTab,
    selectedInterest,
    forYouRecommendations.length,
    trendingEvents.length,
    interestEvents.length,
    errorForYou,
    errorTrending,
    errorInterest,
    fetchForYouEvents,
    fetchTrendingEvents,
    fetchInterestEvents,
    fetchSavedEvents,
  ])

  // Handle interest tag switch
  const handleSelectInterest = (interest) => {
    setSelectedInterest(interest)
    fetchInterestEvents(interest, 1)
  }

  // Handle manual keyword topic search in Similar tab
  const handleCustomInterestSubmit = (e) => {
    if (e) e.preventDefault()
    const trimmed = customInterestInput.trim()
    if (!trimmed) return
    setSelectedInterest(trimmed)
    fetchInterestEvents(trimmed, 1)
  }

  // Handle location search submit (resets GPS coords so text matching takes effect)
  const handleFindNearby = (e) => {
    if (e) e.preventDefault()
    const trimmed = locationInput.trim()
    if (!trimmed) {
      setErrorNearby('Please enter a city or location name to search.')
      return
    }

    const nextSearch = {
      active: true,
      name: trimmed,
      latitude: null, // Reset GPS coords so text matching is cleanly used
      longitude: null,
      radiusKm: Number(locationRadius) || 100,
    }

    setNearbySearch(nextSearch)
    fetchNearbyEvents(nextSearch, 1)
  }

  // Handle radius change: immediately updates active nearby search if already active
  const handleRadiusChange = (newRadius) => {
    const radiusNum = Number(newRadius) || 100
    setLocationRadius(radiusNum)
    if (nearbySearch.active) {
      const nextSearch = {
        ...nearbySearch,
        radiusKm: radiusNum,
      }
      setNearbySearch(nextSearch)
      fetchNearbyEvents(nextSearch, 1)
    }
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
        fetchNearbyEvents(nextSearch, 1)
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
    setPaginationNearby(null)
  }

  // Handle bookmark toggle in Saved tab (immediately removes from local list)
  const handleToggleSavedBookmark = async (eventId) => {
    try {
      await toggleBookmark(eventId)
      setSavedEvents((current) => current.filter((event) => (event._id || event.id) !== eventId))
    } catch (err) {
      console.error('Failed to toggle bookmark:', err)
    }
  }

  // ---------------------------------------------------------------------------
  // Sidebar Derived Data
  // ---------------------------------------------------------------------------
  const aiInsightText = useMemo(() => {
    if (userInterests.length > 0 && user?.college) {
      return `Your feed is dynamically tailored to #${userInterests.slice(0, 3).join(', #')} and opportunities hosted at ${user.college}. Upcoming deadlines are elevated for timely applications.`
    }
    if (userInterests.length > 0) {
      return `Your feed is optimized for #${userInterests.slice(0, 3).join(', #')}. Add your college in profile preferences to highlight opportunities on your campus.`
    }
    return 'Your recommendation engine is currently in discovery mode. Add technical interests and your college in profile preferences to unlock precision AI matching scores.'
  }, [userInterests, user?.college])

  const factorWeights = useMemo(() => {
    switch (activeTab) {
      case 'trending':
        return [
          { name: 'Community Bookmark Velocity', weight: 70, icon: '🔥' },
          { name: 'Deadline Urgency Momentum', weight: 20, icon: '⏰' },
          { name: 'Recent Publishing Recency', weight: 10, icon: '✨' },
        ]
      case 'similar':
        return [
          { name: 'Direct Category Match', weight: 50, icon: '🎯' },
          { name: 'Tag Overlap Ratio', weight: 35, icon: '🏷️' },
          { name: 'Title / Description Keywords', weight: 15, icon: '📝' },
        ]
      case 'nearby':
        return [
          { name: 'Geographic Proximity (km)', weight: 70, icon: '📍' },
          { name: 'In-Person / Hybrid Mode', weight: 20, icon: '🏫' },
          { name: 'Upcoming Deadline', weight: 10, icon: '⏰' },
        ]
      case 'saved':
        return [
          { name: 'User Saved Bookmarks', weight: 100, icon: '🔖' },
        ]
      case 'for-you':
      default:
        return [
          { name: 'Technical Interests', weight: 40, icon: '🎯' },
          { name: 'College Affiliation', weight: 20, icon: '🏫' },
          { name: 'Saved Topic History', weight: 20, icon: '🔖' },
          { name: 'Content Relevance', weight: 10, icon: '📝' },
          { name: 'Deadline Urgency', weight: 10, icon: '⏰' },
        ]
    }
  }, [activeTab])

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
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span>AI-Powered Recommendations</span>
              </div>

              {/* Main Heading */}
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-brand-text">
                Recommendations — <span className="text-brand-teal">Tailored for You</span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Discover hackathons, workshops, and campus opportunities that match your interests, skills, and goals.
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
                  <span>📊</span> In-App Momentum
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-soft-sm backdrop-blur-sm">
                  <span>🔖</span> Bookmarked Topics
                </span>
              </div>
              <div className="mt-1 rounded-2xl border border-teal-200/70 bg-brand-teal-subtle/80 px-3.5 py-1.5 text-xs font-bold text-brand-teal shadow-soft-sm">
                ✨ Verified opportunities matched to your goals
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
                onClick={() => handleTabChange(tab.id)}
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
                  count={loadingForYou ? undefined : (paginationForYou?.totalEvents ?? forYouRecommendations.length)}
                  countLabel="recommendations"
                />

                {/* Match Status & Transparency Notice */}
                {!loadingForYou && !errorForYou && forYouRecommendations.length > 0 && (
                  isColdStartUser ? (
                    <div className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/70 p-4 text-xs text-amber-900">
                      <span className="text-base">💡</span>
                      <div className="leading-relaxed">
                        <p className="font-semibold text-amber-900">
                          Complete your profile for personalized scores
                        </p>
                        <p className="mt-0.5 text-amber-800">
                          You haven't set up your interests or college in your profile yet. Showing all upcoming verified events. Add topics to your{' '}
                          <Link to="/profile" className="font-bold underline hover:text-amber-950">
                            profile preferences
                          </Link>{' '}
                          to get personalized match scores!
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 rounded-2xl border border-teal-200/80 bg-teal-50/70 p-4 text-xs text-teal-900">
                      <span className="text-base">✨</span>
                      <div className="leading-relaxed">
                        <p className="font-semibold text-teal-900">
                          Personalized Recommendations Active
                        </p>
                        <p className="mt-0.5 text-teal-700">
                          Ranked using deterministic scoring factoring in your interests{userInterests.length > 0 ? ` (${userInterests.join(', ')})` : ''}, college affiliation, and registration deadlines.
                        </p>
                      </div>
                    </div>
                  )
                )}

                {/* Content States */}
                {loadingForYou ? (
                  <RecommendationSkeletonGrid count={6} />
                ) : errorForYou ? (
                  <RecommendationErrorState message={errorForYou} onRetry={() => fetchForYouEvents(pageForYou)} />
                ) : forYouRecommendations.length === 0 ? (
                  <RecommendationEmptyState
                    icon="🔍"
                    title="No upcoming events available"
                    description="Check back soon for newly published verified opportunities."
                    actionText="Browse Events Directory"
                    actionLink="/events"
                  />
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {forYouRecommendations.map((item) => (
                        <EventCard
                          key={item.event?._id || item.event?.id || item.eventId}
                          event={item.event}
                          isBookmarked={isBookmarked(item.event?._id || item.event?.id || item.eventId)}
                          onBookmarkToggle={toggleBookmark}
                          matchScore={item.matchPercentage}
                          matchReason={item.explanation}
                        />
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {paginationForYou && paginationForYou.totalPages > 1 && (
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-soft-sm text-xs font-semibold text-slate-700">
                        <span>
                          Page {paginationForYou.page} of {paginationForYou.totalPages} ({paginationForYou.totalEvents} events)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!paginationForYou.hasPrevPage || loadingForYou}
                            onClick={() => fetchForYouEvents(paginationForYou.page - 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            ← Previous
                          </button>
                          <button
                            type="button"
                            disabled={!paginationForYou.hasNextPage || loadingForYou}
                            onClick={() => fetchForYouEvents(paginationForYou.page + 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
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
                  count={loadingTrending ? undefined : (paginationTrending?.totalEvents ?? trendingEvents.length)}
                  countLabel="trending events"
                />

                {/* Genuine Momentum Notice */}
                {!loadingTrending && !errorTrending && trendingEvents.length > 0 && (
                  <div className="flex items-start gap-3 rounded-2xl border border-orange-200/80 bg-orange-50/70 p-4 text-xs text-orange-950">
                    <span className="text-base">🔥</span>
                    <div className="leading-relaxed">
                      <p className="font-semibold text-orange-900">
                        {hasEngagementTrending ? 'In-App Bookmark Velocity Active' : 'Upcoming Event Momentum'}
                      </p>
                      <p className="mt-0.5 text-orange-800">
                        {hasEngagementTrending
                          ? 'Ranked based on genuine student bookmark saves across EventSync combined with registration deadline urgency.'
                          : 'Ranked based on approaching registration deadlines and publishing recency. Trending scores adapt in real time as students bookmark events.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Content States */}
                {loadingTrending ? (
                  <RecommendationSkeletonGrid count={6} />
                ) : errorTrending ? (
                  <RecommendationErrorState message={errorTrending} onRetry={() => fetchTrendingEvents(pageTrending)} />
                ) : trendingEvents.length === 0 ? (
                  <RecommendationEmptyState
                    icon="🔥"
                    title="No upcoming events available"
                    description="Trending events will appear as verified hackathons and workshops publish."
                    actionText="Browse Events Directory"
                    actionLink="/events"
                  />
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {trendingEvents.map((event) => (
                        <EventCard
                          key={event._id || event.id}
                          event={event}
                          isBookmarked={isBookmarked(event._id || event.id)}
                          onBookmarkToggle={toggleBookmark}
                          matchScore={event.matchScore}
                          matchReason={event.matchReason}
                        />
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {paginationTrending && paginationTrending.totalPages > 1 && (
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-soft-sm text-xs font-semibold text-slate-700">
                        <span>
                          Page {paginationTrending.page} of {paginationTrending.totalPages} ({paginationTrending.totalEvents} events)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!paginationTrending.hasPrevPage || loadingTrending}
                            onClick={() => fetchTrendingEvents(paginationTrending.page - 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            ← Previous
                          </button>
                          <button
                            type="button"
                            disabled={!paginationTrending.hasNextPage || loadingTrending}
                            onClick={() => fetchTrendingEvents(paginationTrending.page + 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                  count={loadingInterest ? undefined : (paginationInterest?.totalEvents ?? interestEvents.length)}
                  countLabel="matching events"
                />

                {/* Interest Tags & Search Control Bar */}
                <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-soft-sm space-y-3.5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      {userInterests.length > 0 ? 'Your Profile Topics:' : 'Suggested Topic Areas:'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {userInterests.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSelectInterest('all')}
                          className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                            selectedInterest === 'all' || selectedInterest === 'All Interests'
                              ? 'bg-brand-teal text-white shadow-soft-sm'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          🌟 All My Interests
                        </button>
                      )}
                      {(userInterests.length > 0 ? userInterests : POPULAR_SUGGESTION_TOPICS).map((topic) => {
                        const isCurrent = selectedInterest.toLowerCase() === topic.toLowerCase()
                        return (
                          <button
                            key={topic}
                            type="button"
                            onClick={() => handleSelectInterest(topic)}
                            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
                              isCurrent
                                ? 'bg-brand-teal text-white shadow-soft-sm'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            #{topic}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {userInterests.length === 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-xl p-2.5 border border-amber-200/60">
                      💡 Tip: You can configure your permanent interests in{' '}
                      <Link to="/profile" className="font-bold underline hover:text-amber-900">
                        Profile Preferences
                      </Link>{' '}
                      to personalize this feed automatically.
                    </p>
                  )}

                  {/* Manual Keyword Search Bar */}
                  <form onSubmit={handleCustomInterestSubmit} className="flex gap-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={customInterestInput}
                      onChange={(e) => setCustomInterestInput(e.target.value)}
                      placeholder="Search or enter any specific topic (e.g. React, Cloud, AI)..."
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2 px-3.5 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                    />
                    <button
                      type="submit"
                      disabled={!customInterestInput.trim() || loadingInterest}
                      className="rounded-xl bg-brand-teal px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand-teal-dark active:scale-95 disabled:opacity-50"
                    >
                      Explore Topic
                    </button>
                  </form>
                </div>

                {/* Events list for selected interest */}
                {loadingInterest ? (
                  <RecommendationSkeletonGrid count={6} />
                ) : errorInterest ? (
                  <RecommendationErrorState
                    message={errorInterest}
                    onRetry={() => fetchInterestEvents(selectedInterest, pageInterest)}
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
                  <div className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {interestEvents.map((event) => (
                        <EventCard
                          key={event._id || event.id}
                          event={event}
                          isBookmarked={isBookmarked(event._id || event.id)}
                          onBookmarkToggle={toggleBookmark}
                          matchScore={event.matchScore}
                          matchReason={event.matchReason || `Matches your #${selectedInterest} interest`}
                        />
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {paginationInterest && paginationInterest.totalPages > 1 && (
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-soft-sm text-xs font-semibold text-slate-700">
                        <span>
                          Page {paginationInterest.page} of {paginationInterest.totalPages} ({paginationInterest.totalEvents} events)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!paginationInterest.hasPrevPage || loadingInterest}
                            onClick={() => fetchInterestEvents(selectedInterest, paginationInterest.page - 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            ← Previous
                          </button>
                          <button
                            type="button"
                            disabled={!paginationInterest.hasNextPage || loadingInterest}
                            onClick={() => fetchInterestEvents(selectedInterest, paginationInterest.page + 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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
                  count={loadingNearby ? undefined : (paginationNearby?.totalEvents ?? nearbyEvents.length)}
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
                      onChange={(e) => handleRadiusChange(e.target.value)}
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
                    onRetry={() => fetchNearbyEvents(nearbySearch, pageNearby)}
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
                  <div className="space-y-6">
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {nearbyEvents.map((event) => (
                        <EventCard
                          key={event._id || event.id}
                          event={event}
                          isBookmarked={isBookmarked(event._id || event.id)}
                          onBookmarkToggle={toggleBookmark}
                          distanceKm={event.distanceKm}
                          matchReason={event.matchReason}
                        />
                      ))}
                    </div>

                    {/* Pagination Controls */}
                    {paginationNearby && paginationNearby.totalPages > 1 && (
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-soft-sm text-xs font-semibold text-slate-700">
                        <span>
                          Page {paginationNearby.page} of {paginationNearby.totalPages} ({paginationNearby.totalEvents} events)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!paginationNearby.hasPrevPage || loadingNearby}
                            onClick={() => fetchNearbyEvents(nearbySearch, paginationNearby.page - 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            ← Previous
                          </button>
                          <button
                            type="button"
                            disabled={!paginationNearby.hasNextPage || loadingNearby}
                            onClick={() => fetchNearbyEvents(nearbySearch, paginationNearby.page + 1)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}
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
                        key={event._id || event.id}
                        event={event}
                        isBookmarked={true}
                        onBookmarkToggle={() => handleToggleSavedBookmark(event._id || event.id)}
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

              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Saved Events:</span>
                <span className="font-semibold text-slate-800">
                  {bookmarkIds.length} bookmarks
                </span>
              </div>
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
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {aiInsightText}
                </p>
              </div>
            </div>

            {/* Widget 3: Recommendation Factors */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-soft-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📊</span>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    Active Ranking Factors
                  </h3>
                </div>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 capitalize">
                  {activeTab.replace('-', ' ')}
                </span>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Factors determining ranking for the active category:
              </p>

              <div className="space-y-3 text-xs">
                {factorWeights.map((factor) => (
                  <div key={factor.name}>
                    <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
                      <span className="flex items-center gap-1.5">
                        <span>{factor.icon}</span> {factor.name}
                      </span>
                      <span className="font-bold text-brand-teal">{factor.weight}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-teal transition-all duration-300"
                        style={{ width: `${factor.weight}%` }}
                      />
                    </div>
                  </div>
                ))}
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
