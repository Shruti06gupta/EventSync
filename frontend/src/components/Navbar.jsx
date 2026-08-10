import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import Toast from './Toast'

const formatTimestamp = (value) => {
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
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export default function Navbar() {
  const { user, logout } = useAuth()
  const { notifications, unreadCount, loading, error, liveToast, clearToast, loadNotifications, markNotificationAsRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(6)
  const [actionError, setActionError] = useState('')
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isOpen) return undefined

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const recentNotifications = useMemo(() => notifications.slice(0, visibleCount), [notifications, visibleCount])

  const handleToggleDropdown = async () => {
    const nextOpen = !isOpen
    setIsOpen(nextOpen)
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
      setIsOpen(false)
      if (notification.event) {
        navigate(`/events/${notification.event}`)
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Unable to update notification.')
    }
  }

  return (
    <nav className="w-full bg-white shadow-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 p-4">
        <div className="text-xl font-bold text-teal-600">EventSync</div>
        {user ? (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-3 sm:gap-6">
            <Link to="/events" className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition duration-150">Events</Link>
            <Link to="/bookmarks" className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition duration-150">Bookmarks</Link>
            {user.role === 'admin' && (
              <Link to="/manage" className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition duration-150">Manage Events</Link>
            )}
            <Link to="/profile" className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition duration-150 flex items-center gap-2">
              {user.profilePicture ? (
                <img src={user.profilePicture} alt={user.name} className="h-6 w-6 rounded-full object-cover border border-gray-200" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-[10px] font-bold text-teal-700">
                  {getInitials(user.name)}
                </span>
              )}
              Profile
            </Link>

            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={handleToggleDropdown}
                className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:border-teal-300 hover:text-teal-600"
                aria-label="Notifications"
                aria-expanded={isOpen}
              >
                <span className="text-lg" aria-hidden="true">🔔</span>
                {unreadCount > 0 ? (
                  <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </button>

              {isOpen ? (
                <div className="absolute right-0 z-30 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
                  <div className="border-b border-gray-100 bg-gradient-to-r from-teal-600 to-cyan-500 px-5 py-4 text-white">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {user.profilePicture ? (
                          <img src={user.profilePicture} alt={user.name} className="h-10 w-10 rounded-xl object-cover border border-white/20" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-sm font-bold text-teal-100">
                            {getInitials(user.name)}
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-teal-100">Notifications</p>
                          <h3 className="mt-1 text-lg font-bold">Recent updates</h3>
                        </div>
                      </div>
                      <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold shrink-0">
                        {unreadCount} unread
                      </span>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto p-3">
                    {loading ? (
                      <div className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        Loading notifications...
                      </div>
                    ) : error ? (
                      <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                        <p>{error}</p>
                        <button
                          type="button"
                          onClick={() => loadNotifications()}
                          className="text-xs font-semibold text-rose-700 underline underline-offset-2"
                        >
                          Retry
                        </button>
                      </div>
                    ) : recentNotifications.length === 0 ? (
                      <div className="rounded-2xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                        No notifications yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recentNotifications.map((notification) => (
                           <button
                             key={notification._id}
                             type="button"
                             onClick={() => handleMarkAsRead(notification)}
                             className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-teal-200 hover:bg-teal-50 ${
                               notification.read
                                 ? 'border-gray-100 bg-white'
                                 : 'border-teal-100 bg-teal-50/70'
                             }`}
                           >
                             <div className="flex items-start justify-between gap-3">
                               <p className="text-sm font-semibold text-gray-800">{notification.message}</p>
                               <span
                                 className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                                   notification.read ? 'bg-gray-300' : 'bg-teal-500'
                                 }`}
                                 aria-hidden="true"
                               />
                             </div>
                             <div className="mt-2 flex items-center justify-between gap-3">
                               <span className="text-xs text-gray-500">{formatTimestamp(notification.createdAt)}</span>
                               <span
                                 className={`text-xs font-semibold ${
                                   notification.read ? 'text-gray-400' : 'text-teal-600'
                                 }`}
                               >
                                 {notification.read ? 'Read' : 'Mark as read'}
                               </span>
                             </div>
                           </button>
                         ))}

                        {notifications.length > visibleCount && (
                          <button
                            type="button"
                            onClick={() => setVisibleCount((prev) => prev + 10)}
                            className="w-full mt-3 py-2 text-center text-xs font-bold text-teal-600 hover:text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-xl transition duration-150"
                          >
                            Load More
                          </button>
                        )}
                      </div>
                    )}

                    {actionError ? (
                      <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {actionError}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              onClick={logout}
              className="text-sm font-semibold text-rose-500 hover:text-rose-600 transition duration-150"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition duration-150">Login</Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition duration-150 shadow-sm"
            >
              Register
            </Link>
          </div>
        )}
      </div>
      <Toast
        notification={liveToast}
        onClose={clearToast}
        onClick={handleMarkAsRead}
      />
    </nav>
  )
}
