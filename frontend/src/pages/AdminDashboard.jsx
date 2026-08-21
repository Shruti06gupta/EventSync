import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api'
import {
  StatCard,
  SectionCard,
  DashboardSkeleton,
  formatNumber,
} from '../components/admin/DashboardWidgets'

const formatActivityTime = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))

const formatDeadline = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

const healthStyles = {
  operational: 'bg-emerald-100 text-emerald-700',
  degraded: 'bg-amber-100 text-amber-700',
  unknown: 'bg-gray-100 text-gray-600',
}

const ACTIVITY_PREVIEW_COUNT = 5
const DISMISSED_ACTIVITY_KEY = 'eventsync-admin-dismissed-activity'

const readDismissedActivityIds = () => {
  try {
    const stored = localStorage.getItem(DISMISSED_ACTIVITY_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeDismissedActivityIds = (ids) => {
  localStorage.setItem(DISMISSED_ACTIVITY_KEY, JSON.stringify(ids))
}

const alertStyles = {
  info: 'border-blue-100 bg-blue-50 text-blue-800',
  warning: 'border-amber-100 bg-amber-50 text-amber-800',
  error: 'border-rose-100 bg-rose-50 text-rose-800',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityExpanded, setActivityExpanded] = useState(false)
  const [dismissedActivityIds, setDismissedActivityIds] = useState(readDismissedActivityIds)

  useEffect(() => {
    const loadStats = async () => {
      try {
        setError('')
        setLoading(true)
        const res = await api.get('/admin/dashboard/stats')
        setStats(res.data)
      } catch (err) {
        if (err.response?.status === 403) {
          setError('Access denied. Admin privileges are required.')
        } else if (err.response?.status === 404) {
          setError('Admin dashboard API not found. Restart the backend server to load the latest routes.')
        } else {
          setError(err.response?.data?.message || 'Unable to load admin dashboard data.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-brand-bg pb-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-8">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-soft-sm">
            <h1 className="text-xl font-bold text-rose-800">Dashboard unavailable</h1>
            <p className="mt-3 text-sm text-rose-700">
              {error || 'Unable to load dashboard data. Make sure the backend is running and restart the frontend dev server.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 active:scale-95"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  const {
    kpis = {},
    eventOverview = {},
    recentActivity = [],
    closingEvents = [],
    adminAlerts = [],
    systemHealth = {},
  } = stats

  const visibleActivity = recentActivity.filter((item) => !dismissedActivityIds.includes(item.id))
  const hasHiddenActivity = visibleActivity.length > ACTIVITY_PREVIEW_COUNT
  const displayedActivity = activityExpanded
    ? visibleActivity
    : visibleActivity.slice(0, ACTIVITY_PREVIEW_COUNT)

  const handleClearActivity = () => {
    const nextDismissedIds = [...new Set([...dismissedActivityIds, ...visibleActivity.map((item) => item.id)])]
    setDismissedActivityIds(nextDismissedIds)
    writeDismissedActivityIds(nextDismissedIds)
    setActivityExpanded(false)
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Page Header */}
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-teal-700 to-emerald-600 p-8 text-white shadow-soft-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal-100">Admin Dashboard</p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Admin System Overview</h1>
              <p className="mt-3 max-w-2xl text-sm text-teal-100 sm:text-base">
                Monitor platform health, user growth, event distribution, and events requiring attention.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/manage"
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 active:scale-95"
              >
                Manage Events
              </Link>
              <Link
                to="/events"
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-indigo transition hover:bg-indigo-50 active:scale-95"
              >
                View Events
              </Link>
            </div>
          </div>
        </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total Users"
          value={formatNumber(kpis.totalUsers)}
          subtitle={`+${formatNumber(kpis.newUsers24h)} in last 24h`}
          icon="👥"
          accent="teal"
        />
        <StatCard
          title="Total Events"
          value={formatNumber(kpis.totalEvents)}
          subtitle={`+${formatNumber(kpis.newEventsMonth)} this month`}
          icon="📅"
          accent="blue"
        />
        <StatCard
          title="Event Bookmarks"
          value={formatNumber(kpis.totalBookmarks)}
          subtitle="In-app engagement metric"
          icon="🔖"
          accent="violet"
        />
        <StatCard
          title="New Users (24h)"
          value={formatNumber(kpis.newUsers24h)}
          subtitle="Registered recently"
          icon="✨"
          accent="amber"
        />
        <StatCard
          title="Notifications"
          value={formatNumber(kpis.totalNotifications || 0)}
          subtitle="System notifications sent"
          icon="🔔"
          accent="indigo"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard
            title="Recent Activity"
            subtitle="System activity from the last 24 hours"
            action={
              visibleActivity.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearActivity}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 active:scale-95"
                >
                  Clear all
                </button>
              ) : null
            }
          >
            {visibleActivity.length === 0 ? (
              <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                {recentActivity.length === 0
                  ? 'No recent activity in the last 24 hours.'
                  : 'Recent activity cleared. New activity will appear here after refresh.'}
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {displayedActivity.map((item) => (
                    <div key={item.id} className="flex items-start gap-4 rounded-2xl border border-slate-100 px-4 py-3">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal-subtle text-sm">
                        {item.type === 'user_registered' ? '👤' : '📅'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <p className="text-sm text-slate-500">{item.subtitle}</p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-slate-400">{formatActivityTime(item.timestamp)}</span>
                    </div>
                  ))}
                </div>

                {hasHiddenActivity ? (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setActivityExpanded((prev) => !prev)}
                      className="rounded-xl bg-brand-teal-subtle px-4 py-2 text-sm font-semibold text-brand-teal transition hover:bg-brand-teal/30 active:scale-95"
                    >
                      {activityExpanded
                        ? 'Show less'
                        : `Show more (${visibleActivity.length - ACTIVITY_PREVIEW_COUNT} more)`}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </SectionCard>
        </div>

        <SectionCard title="Admin Alerts" subtitle="Items that may need attention">
          {adminAlerts.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No alerts right now. The system looks stable.
            </p>
          ) : (
            <div className="space-y-3">
              {adminAlerts.map((alert) => (
                <div key={alert.id} className={`rounded-2xl border px-4 py-3 text-sm ${alertStyles[alert.level]}`}>
                  {alert.message}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard
          title="Upcoming & Closing Events"
          subtitle="Events requiring admin attention in the next 7 days"
          action={
            <Link to="/manage" className="text-sm font-semibold text-brand-teal hover:text-brand-teal-dark">
              Manage events →
            </Link>
          }
        >
          {closingEvents.length === 0 ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No verified events are closing within the next 7 days.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3 font-semibold">Event</th>
                    <th className="px-3 py-3 font-semibold">Platform</th>
                    <th className="px-3 py-3 font-semibold">Deadline</th>
                    <th className="px-3 py-3 font-semibold">Time Remaining</th>
                    <th className="px-3 py-3 font-semibold">Bookmarks</th>
                  </tr>
                </thead>
                <tbody>
                  {closingEvents.map((event) => (
                    <tr key={event.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-3 py-4 font-medium text-slate-900">{event.title}</td>
                      <td className="px-3 py-4 text-slate-600">{event.platform}</td>
                      <td className="px-3 py-4 text-slate-600">{formatDeadline(event.registrationDeadline)}</td>
                      <td className="px-3 py-4">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          {event.timeRemaining}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-600">{formatNumber(event.bookmarkCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="System Health" subtitle="Live status based on current application state">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(systemHealth).map(([key, item]) => (
              <div key={key} className="rounded-2xl border border-slate-100 p-4">
                <p className="text-sm font-semibold capitalize text-slate-700">{key.replace(/([A-Z])/g, ' $1')}</p>
                <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${healthStyles[item.status]}`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      </div>
    </div>
  )
}
