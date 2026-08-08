import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { getNotifications, markAsRead } from '../services/notifications'

const NotificationsContext = createContext(null)

export const useNotifications = () => useContext(NotificationsContext)

export function NotificationsProvider({ children }) {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [liveToast, setLiveToast] = useState(null)

  const clearToast = useCallback(() => setLiveToast(null), [])

  const loadNotifications = useCallback(
    async ({ silent = false } = {}) => {
      if (!user) {
        setNotifications([])
        setUnreadCount(0)
        setError('')
        setLoading(false)
        return
      }

      try {
        if (!silent) setLoading(true)

        setError('')
        const data = await getNotifications()
        const fetchedNotifications = (data.notifications || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )

        setNotifications((prev) => {
          if (silent && fetchedNotifications.length > 0) {
            const latestNew = fetchedNotifications[0]
            const latestOld = prev.length > 0 ? prev[0] : null

            if (
              (!latestOld || new Date(latestNew.createdAt) > new Date(latestOld.createdAt)) &&
              !latestNew.read
            ) {
              setLiveToast(latestNew)
            }
          }
          return fetchedNotifications
        })

        setUnreadCount(
          fetchedNotifications.reduce((count, notification) => {
            return notification.read ? count : count + 1
          }, 0)
        )
      } catch (err) {
        if (!silent) {
          setError(err.response?.data?.message || 'Unable to load notifications.')
        }
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [user]
  )

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    if (!user) return undefined

    const interval = window.setInterval(() => {
      loadNotifications({ silent: true })
    }, 15000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications({ silent: true })
      }
    }

    const handleFocus = () => {
      loadNotifications({ silent: true })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [loadNotifications, user])

  const refreshNotifications = useCallback(
    () => loadNotifications({ silent: true }),
    [loadNotifications]
  )

  const markNotificationAsRead = useCallback(async (id) => {
    let previousNotification = null
    let shouldDecrementUnread = false

    setNotifications((current) =>
      current.map((notification) => {
        if (notification._id !== id) return notification
        previousNotification = notification
        shouldDecrementUnread = !notification.read
        return { ...notification, read: true }
      })
    )

    if (shouldDecrementUnread) {
      setUnreadCount((current) => Math.max(current - 1, 0))
    }

    try {
      const data = await markAsRead(id)

      setNotifications((current) =>
        current
          .map((notification) =>
            notification._id === id ? data.notification : notification
          )
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      )

      if (typeof data.unreadCount === 'number') {
        setUnreadCount(data.unreadCount)
      } else {
        setUnreadCount((current) => Math.max(current, 0))
      }
    } catch (err) {
      if (previousNotification) {
        setNotifications((current) =>
          current.map((notification) =>
            notification._id === id ? previousNotification : notification
          )
        )
      }
      if (shouldDecrementUnread) {
        setUnreadCount((current) => current + 1)
      }
      throw err
    }
  }, [])

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      liveToast,
      clearToast,
      loadNotifications,
      refreshNotifications,
      markNotificationAsRead,
    }),
    [notifications, unreadCount, loading, error, loadNotifications, refreshNotifications, markNotificationAsRead]
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export default NotificationsContext