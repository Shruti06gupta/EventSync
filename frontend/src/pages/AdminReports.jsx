import React, { useEffect, useState } from 'react'
import api from '../api'
import {
  StatCard,
  SectionCard,
  SimpleBarChart,
  HorizontalBars,
  DashboardSkeleton,
  formatNumber,
} from '../components/admin/DashboardWidgets'

export default function AdminReports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRange] = useState('7d')
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    const loadReports = async () => {
      try {
        setError('')
        setLoading(true)
        const res = await api.get('/admin/reports', { params: { range } })
        setData(res.data)
      } catch (err) {
        if (err.response?.status === 403) {
          setError('Access denied. Admin privileges are required.')
        } else {
          setError(err.response?.data?.message || 'Unable to load reports data.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadReports()
  }, [range])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-brand-bg pb-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-8">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-soft-sm">
            <h1 className="text-xl font-bold text-rose-800">Reports unavailable</h1>
            <p className="mt-3 text-sm text-rose-700">{error || 'Unable to load reports data.'}</p>
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

  const { userReports, eventReports, engagementReports, syncReports, deadlineReports } = data

  const exportReport = async () => {
    try {
      setExporting(true)
      setExportError('')
      
      const response = await api.get('/admin/reports/export', { 
        params: { range },
        responseType: 'blob'
      })
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `EventSync_Report_${new Date().toISOString().split('T')[0]}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setExportError('Unable to generate report. Please try again.')
      console.error('Export error:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Page Header */}
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-teal-700 to-emerald-600 p-8 text-white shadow-soft-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-teal-100">Analytics</p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Reports</h1>
              <p className="mt-3 max-w-2xl text-sm text-teal-100 sm:text-base">
                Detailed analytics and insights about EventSync activity.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={range}
                onChange={(e) => setRange(e.target.value)}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20 border border-white/20"
              >
                <option value="7d" className="text-slate-900">Last 7 Days</option>
                <option value="30d" className="text-slate-900">Last 30 Days</option>
                <option value="month" className="text-slate-900">This Month</option>
              </select>
              <button
                onClick={exportReport}
                disabled={exporting}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-teal transition hover:bg-teal-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? 'Generating Report...' : 'Export Report'}
              </button>
            </div>
          </div>
        </div>

        {exportError && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {exportError}
          </div>
        )}

        {/* User Reports */}
        <SectionCard title="User Reports" subtitle="User growth and registration metrics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              title="Total Users"
              value={formatNumber(userReports.totalUsers)}
              subtitle="All registered users"
              icon="👥"
              accent="teal"
            />
            <StatCard
              title={`New Users (${range === '7d' ? '7d' : range === '30d' ? '30d' : 'Month'})`}
              value={formatNumber(userReports.newUsersWeek)}
              subtitle="New registrations"
              icon="✨"
              accent="blue"
            />
            <StatCard
              title="Students"
              value={formatNumber(userReports.studentsCount)}
              subtitle="Regular users"
              icon="🎓"
              accent="violet"
            />
            <StatCard
              title="Admins"
              value={formatNumber(userReports.adminsCount)}
              subtitle="Administrators"
              icon="🔐"
              accent="amber"
            />
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Today</p>
              <p className="text-lg font-bold text-slate-900">{formatNumber(userReports.newUsersToday)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">This Week/Month</p>
              <p className="text-lg font-bold text-slate-900">{formatNumber(userReports.newUsersWeek)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">This Month</p>
              <p className="text-lg font-bold text-slate-900">{formatNumber(userReports.newUsersMonth)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Total Users</p>
              <p className="text-lg font-bold text-slate-900">{formatNumber(userReports.totalUsers)}</p>
            </div>
          </div>
          <SimpleBarChart data={userReports.userGrowth} barColor="bg-teal-500" />
        </SectionCard>

        {/* Event Reports */}
        <SectionCard title="Event Reports" subtitle="Event lifecycle and distribution metrics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              title="Total Events"
              value={formatNumber(eventReports.totalEvents)}
              subtitle="All events in system"
              icon="📅"
              accent="blue"
            />
            <StatCard
              title="Upcoming"
              value={formatNumber(eventReports.upcomingEvents)}
              subtitle="Registration open"
              icon="📆"
              accent="emerald"
            />
            <StatCard
              title="Closing Soon"
              value={formatNumber(eventReports.closingWithin7d)}
              subtitle="Within 7 days"
              icon="⏰"
              accent="amber"
            />
            <StatCard
              title="Expired"
              value={formatNumber(eventReports.expiredEvents)}
              subtitle="Registration closed"
              icon="🔒"
              accent="rose"
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Event Additions Over Time</h3>
              <SimpleBarChart data={eventReports.eventAdditions} barColor="bg-indigo-500" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Events by Platform</h3>
              <HorizontalBars items={eventReports.eventsByPlatform} />
            </div>
          </div>
          {eventReports.eventsByCategory && eventReports.eventsByCategory.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Events by Category</h3>
              <HorizontalBars items={eventReports.eventsByCategory.map(cat => ({ platform: cat.category, source: cat.category, count: cat.count }))} />
            </div>
          )}
        </SectionCard>

        {/* Engagement Reports */}
        <SectionCard title="Engagement Reports" subtitle="In-app engagement metrics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              title="Total Bookmarks"
              value={formatNumber(engagementReports.totalBookmarks)}
              subtitle="Event bookmarks"
              icon="🔖"
              accent="violet"
            />
            <StatCard
              title="Notifications"
              value={formatNumber(engagementReports.totalNotifications)}
              subtitle="System notifications"
              icon="🔔"
              accent="purple"
            />
          </div>
          <SimpleBarChart data={engagementReports.notificationActivity} barColor="bg-purple-500" />
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">About engagement metrics</p>
            <p className="mt-1 text-sm text-slate-500">
              EventSync tracks bookmarks and notifications as in-app engagement metrics. 
              Event registrations happen on external platforms and are not stored locally.
            </p>
          </div>
        </SectionCard>

        {/* Sync Reports */}
        <SectionCard title="Sync Reports" subtitle="Event platform synchronization metrics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatCard
              title="Total Syncs"
              value={formatNumber(syncReports.totalSyncs)}
              subtitle="Sync operations"
              icon="🔄"
              accent="teal"
            />
            <StatCard
              title="Successful"
              value={formatNumber(syncReports.successfulSyncs)}
              subtitle="Completed successfully"
              icon="✅"
              accent="emerald"
            />
            <StatCard
              title="Partial"
              value={formatNumber(syncReports.partialSyncs)}
              subtitle="Completed with warnings"
              icon="⚠️"
              accent="amber"
            />
            <StatCard
              title="Failed"
              value={formatNumber(syncReports.failedSyncs)}
              subtitle="Sync failures"
              icon="❌"
              accent="rose"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Devfolio Events</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(syncReports.devfolioTotal)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unstop Events</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(syncReports.unstopTotal)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duplicates Skipped</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(syncReports.duplicatesSkipped)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sync Errors</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{formatNumber(syncReports.errors)}</p>
            </div>
          </div>
          {syncReports.lastSync && (
            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Sync</p>
              <p className="mt-2 text-sm text-slate-700">
                {new Date(syncReports.lastSync.createdAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
              <p className="mt-1 text-sm text-slate-500">Status: {syncReports.lastSync.status}</p>
            </div>
          )}
        </SectionCard>

        {/* Deadline Reports */}
        <SectionCard title="Deadline Reports" subtitle="Event registration deadline metrics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Closing (24h)"
              value={formatNumber(deadlineReports.closingWithin24h)}
              subtitle="Within 24 hours"
              icon="⚡"
              accent="rose"
            />
            <StatCard
              title="Closing (7d)"
              value={formatNumber(deadlineReports.closingWithin7d)}
              subtitle="Within 7 days"
              icon="⏰"
              accent="amber"
            />
            <StatCard
              title="Recently Closed"
              value={formatNumber(deadlineReports.recentlyClosed)}
              subtitle="Closed in last 3 days"
              icon="🔒"
              accent="slate"
            />
            <StatCard
              title="Expired"
              value={formatNumber(deadlineReports.expiredEvents)}
              subtitle="Closed > 3 days ago"
              icon="🗑️"
              accent="rose"
            />
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
