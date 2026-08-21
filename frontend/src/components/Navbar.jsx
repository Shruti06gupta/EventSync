import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import Toast from './Toast'

const formatTimestamp = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(Math.floor(diffMs / (1000 * 60)), 0)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const getInitials = (name) => {
  if (!name) return 'U'
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const {
    notifications,
    unreadCount,
    loading,
    error,
    liveToast,
    clearToast,
    loadNotifications,
    markNotificationAsRead,
  } = useNotifications()

  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(6)
  const [actionError, setActionError] = useState('')
  const dropdownRef = useRef(null)
  const mobileMenuRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
    setIsNotifOpen(false)
  }, [location.pathname])

  // Handle outside click & escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsNotifOpen(false)
      }
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target) &&
        !event.target.closest('#mobile-toggle-btn')
      ) {
        setIsMobileMenuOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsNotifOpen(false)
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const recentNotifications = useMemo(
    () => notifications.slice(0, visibleCount),
    [notifications, visibleCount]
  )

  const handleToggleNotifDropdown = async () => {
    const nextOpen = !isNotifOpen
    setIsNotifOpen(nextOpen)
    setActionError('')

    if (!nextOpen) {
      setVisibleCount(6)
    }

    if (nextOpen) {
      try {
        await loadNotifications({ silent: notifications.length > 0 })
      } catch (err) {
        setActionError(err.response?.data?.message || 'Unable to load notifications.')
      }
    }
  }

  const handleMarkAsRead = async (notification) => {
    try {
      setActionError('')
      if (!notification.read) {
        await markNotificationAsRead(notification._id)
      }
      setIsNotifOpen(false)
      setIsMobileMenuOpen(false)
      if (notification.event) {
        navigate(`/events/${notification.event}`)
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Unable to update notification.')
    }
  }

  const navLinkClass = ({ isActive }) =>
    `relative px-3.5 py-2 text-sm font-semibold transition-all duration-200 rounded-xl ${
      isActive
        ? 'text-brand-teal bg-brand-teal-subtle/80 font-bold'
        : 'text-slate-600 hover:text-brand-teal hover:bg-slate-50'
    }`

  const mobileNavLinkClass = ({ isActive }) =>
    `flex items-center px-4 py-2.5 text-sm font-semibold rounded-xl transition duration-150 ${
      isActive
        ? 'text-brand-teal bg-brand-teal-subtle font-bold'
        : 'text-slate-700 hover:bg-slate-100'
    }`

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Left: Brand / Logo */}
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-2.5 focus:outline-none"
            aria-label="EventSync Home"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-teal to-brand-indigo text-white shadow-sm shadow-brand-teal/20 transition-transform duration-200 group-hover:scale-105">
              {/* EventSync Logo Mark Icon */}
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <path d="M8 14h.01" />
                <path d="M12 14h.01" />
                <path d="M16 14h.01" />
                <path d="M8 18h.01" />
                <path d="M12 18h.01" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-brand-text">
              Event<span className="text-brand-teal">Sync</span>
            </span>
          </Link>
        </div>

        {/* Center: Main Navigation (Desktop) */}
        <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
          <NavLink to="/events" className={navLinkClass}>
            Events
          </NavLink>
          {user && user.role !== 'admin' && (
            <NavLink to="/bookmarks" className={navLinkClass}>
              Bookmarks
            </NavLink>
          )}
          {user && user.role === 'admin' && (
            <>
              <NavLink to="/admin" className={navLinkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/manage" className={navLinkClass}>
                Manage Events
              </NavLink>
              <NavLink to="/admin/users" className={navLinkClass}>
                Users
              </NavLink>
              <NavLink to="/admin/reports" className={navLinkClass}>
                Reports
              </NavLink>
            </>
          )}
        </nav>

        {/* Right: Controls & Profile / Auth (Desktop) */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              {/* Notification Bell Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={handleToggleNotifDropdown}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition duration-150 ${
                    isNotifOpen
                      ? 'border-brand-teal bg-brand-teal-subtle text-brand-teal'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-teal/50 hover:bg-slate-50 hover:text-brand-teal'
                  }`}
                  aria-label="Notifications"
                  aria-expanded={isNotifOpen}
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-teal px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown Panel */}
                {isNotifOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-84 sm:w-96 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft-xl animate-in fade-in zoom-in-95 duration-150">
                    <div className="border-b border-slate-100 bg-gradient-to-r from-brand-teal to-brand-teal-dark px-4 py-3 text-white">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold">Notifications</span>
                          {unreadCount > 0 && (
                            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => loadNotifications()}
                          className="text-xs text-white/80 hover:text-white underline"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="max-h-96 overflow-y-auto p-2">
                      {loading ? (
                        <div className="space-y-2 py-4">
                          {[1, 2, 3].map((n) => (
                            <div key={n} className="animate-pulse rounded-xl border border-slate-100 bg-slate-50 p-3">
                              <div className="flex gap-3">
                                <div className="h-8 w-8 rounded-lg bg-slate-200" />
                                <div className="flex-1 space-y-2">
                                  <div className="h-3 w-3/4 rounded bg-slate-200" />
                                  <div className="h-2 w-1/2 rounded bg-slate-200" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : error ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
                          <div className="text-2xl mb-2">⚠️</div>
                          <p className="text-sm font-semibold text-rose-800">Unable to load notifications</p>
                          <p className="mt-1 text-xs text-rose-600">{error}</p>
                          <button
                            type="button"
                            onClick={() => loadNotifications()}
                            className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 active:scale-95"
                          >
                            Try Again
                          </button>
                        </div>
                      ) : recentNotifications.length === 0 ? (
                        <div className="py-8 text-center">
                          <div className="text-4xl mb-3">🔔</div>
                          <p className="text-sm font-semibold text-slate-900">You're all caught up</p>
                          <p className="mt-1 text-xs text-slate-500">New EventSync activity will appear here</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {recentNotifications.map((notification) => {
                            const getNotificationIcon = (notif) => {
                              const message = notif.message?.toLowerCase() || ''
                              if (message.includes('deadline') || message.includes('reminder') || message.includes('closes')) {
                                return '⏰'
                              }
                              if (message.includes('new event') || message.includes('added')) {
                                return '📅'
                              }
                              if (message.includes('registered') || message.includes('user')) {
                                return '👤'
                              }
                              return '🔔'
                            }

                            return (
                              <button
                                key={notification._id}
                                type="button"
                                onClick={() => handleMarkAsRead(notification)}
                                className={`w-full rounded-xl p-3 text-left transition duration-150 ${
                                  notification.read
                                    ? 'bg-white hover:bg-slate-50 text-slate-700'
                                    : 'bg-brand-teal-subtle/60 hover:bg-brand-teal-subtle text-slate-900 border border-brand-teal/20'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className="mt-0.5 text-lg">{getNotificationIcon(notification)}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-semibold leading-snug text-slate-900">
                                        {notification.message}
                                      </p>
                                      {!notification.read && (
                                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-teal" />
                                      )}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                                      <span>{formatTimestamp(notification.createdAt)}</span>
                                      <span className="font-semibold text-brand-teal">
                                        {notification.read ? 'View' : 'Mark as read'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )
                          })}

                          {notifications.length > visibleCount && (
                            <button
                              type="button"
                              onClick={() => setVisibleCount((prev) => prev + 10)}
                              className="mt-2 w-full rounded-xl bg-slate-50 py-2 text-center text-xs font-semibold text-brand-teal hover:bg-brand-teal-subtle transition active:scale-95"
                            >
                              Load earlier updates
                            </button>
                          )}
                        </div>
                      )}

                      {actionError && (
                        <div className="mt-2 rounded-xl bg-rose-50 p-2 text-xs text-rose-700">
                          {actionError}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Profile Avatar Control (NO "Profile" text, only avatar icon/initials) */}
              <Link
                to="/profile"
                className="group relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-200 transition-all duration-200 hover:ring-brand-teal hover:shadow-soft-sm focus:outline-none"
                aria-label="User Profile"
                title={user.name || 'User Profile'}
              >
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.name || 'User avatar'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-teal to-brand-teal-light text-xs font-bold text-white">
                    {getInitials(user.name)}
                  </span>
                )}
              </Link>

              {/* Logout Button */}
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 transition duration-150 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
                title="Log Out"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Logout</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link
                to="/login"
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 transition duration-150 hover:bg-slate-100 hover:text-brand-teal"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-brand-teal px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle Button */}
        <div className="flex md:hidden items-center gap-2">
          {user && (
            <Link
              to="/profile"
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-slate-300"
              aria-label="User Profile"
              title="Profile"
            >
              {user.profilePicture ? (
                <img src={user.profilePicture} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-brand-teal text-[11px] font-bold text-white">
                  {getInitials(user.name)}
                </span>
              )}
            </Link>
          )}

          <button
            id="mobile-toggle-btn"
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 focus:outline-none"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="border-b border-slate-200 bg-white px-4 pt-2 pb-6 md:hidden shadow-soft-lg animate-in slide-in-from-top-2 duration-200"
        >
          <div className="flex flex-col space-y-1">
            <NavLink to="/events" className={mobileNavLinkClass}>
              Explore Events
            </NavLink>
            {user && user.role !== 'admin' && (
              <NavLink to="/bookmarks" className={mobileNavLinkClass}>
                Bookmarks
              </NavLink>
            )}
            {user && user.role === 'admin' && (
              <>
                <NavLink to="/admin" className={mobileNavLinkClass}>
                  Admin Dashboard
                </NavLink>
                <NavLink to="/manage" className={mobileNavLinkClass}>
                  Manage Events
                </NavLink>
                <NavLink to="/admin/users" className={mobileNavLinkClass}>
                  Users
                </NavLink>
                <NavLink to="/admin/reports" className={mobileNavLinkClass}>
                  Reports
                </NavLink>
              </>
            )}

            {user ? (
              <div className="mt-4 border-t border-slate-100 pt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleToggleNotifDropdown}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <span className="flex items-center gap-2">
                    <span>🔔</span> Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Logout ({user.name})</span>
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4">
                <Link
                  to="/login"
                  className="w-full rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="w-full rounded-xl bg-brand-teal py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-brand-teal-dark"
                >
                  Create Account
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Toast Notifications */}
      <Toast
        notification={liveToast}
        onClose={clearToast}
        onClick={handleMarkAsRead}
      />
    </header>
  )
}
