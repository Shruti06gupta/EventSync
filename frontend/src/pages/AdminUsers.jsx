import React, { useEffect, useState } from 'react'
import api from '../api'
import {
  StatCard,
  SectionCard,
  DashboardSkeleton,
  formatNumber,
} from '../components/admin/DashboardWidgets'

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

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

export default function AdminUsers() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [activeTab, debouncedSearch])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setError('')
        setLoading(true)
        const params = {
          page,
          limit: 20,
          search: debouncedSearch || undefined,
          role: activeTab === 'all' ? undefined : activeTab,
        }
        const res = await api.get('/admin/users', { params })
        setData(res.data)
      } catch (err) {
        if (err.response?.status === 403) {
          setError('Access denied. Admin privileges are required.')
        } else {
          setError(err.response?.data?.message || 'Unable to load users data.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [page, debouncedSearch, activeTab])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-brand-bg pb-12">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 pt-8">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center shadow-soft-sm">
            <h1 className="text-xl font-bold text-rose-800">Users unavailable</h1>
            <p className="mt-3 text-sm text-rose-700">{error || 'Unable to load users data.'}</p>
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

  const { users, pagination, summary } = data

  const handleTabChange = (tab) => {
    setActiveTab(tab)
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        {/* Page Header */}
        <div className="mb-8 rounded-3xl bg-gradient-to-r from-brand-indigo to-brand-indigo-dark p-8 text-white shadow-soft-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-200">User Management</p>
              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Users</h1>
              <p className="mt-3 max-w-2xl text-sm text-indigo-100 sm:text-base">
                Manage and monitor users on EventSync.
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          <StatCard
            title="Total Users"
            value={formatNumber(summary.totalUsers)}
            subtitle="All registered users"
            icon="👥"
            accent="teal"
          />
          <StatCard
            title="Students"
            value={formatNumber(summary.totalStudents)}
            subtitle="Regular users"
            icon="🎓"
            accent="blue"
          />
          <StatCard
            title="Admins"
            value={formatNumber(summary.totalAdmins)}
            subtitle="Administrators"
            icon="🔐"
            accent="violet"
          />
          <StatCard
            title="Active"
            value={formatNumber(summary.activeUsers)}
            subtitle="Last 30 days"
            icon="✅"
            accent="emerald"
          />
          <StatCard
            title="Inactive"
            value={formatNumber(summary.inactiveUsers)}
            subtitle="Not recently active"
            icon="💤"
            accent="amber"
          />
        </div>

        {/* Search and Filters */}
        <SectionCard>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Role Tabs */}
            <div className="flex gap-2">
              {['all', 'student', 'admin'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition duration-150 ${
                    activeTab === tab
                      ? 'bg-brand-teal text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab === 'all' ? 'All Users' : tab === 'student' ? 'Students' : 'Admins'}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, or college..."
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pl-10 text-sm text-slate-700 placeholder-slate-400 outline-none transition-all duration-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </SectionCard>

        {/* Users Table */}
        <SectionCard
          title={`Users (${pagination.totalUsers})`}
          subtitle={activeTab === 'all' ? 'All registered users' : activeTab === 'student' ? 'Student accounts' : 'Administrator accounts'}
        >
          {users.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-sm font-semibold text-slate-900">No users found</p>
              <p className="mt-1 text-sm text-slate-500">
                {search ? 'Try adjusting your search terms' : 'No users match the current filters'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Role</th>
                      <th className="px-4 py-3 font-semibold">College</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Joined On</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const isActive = user.lastLoginAt && (Date.now() - new Date(user.lastLoginAt).getTime()) < 30 * 24 * 60 * 60 * 1000
                      return (
                        <tr key={user._id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-2 ring-slate-200">
                                {user.profilePicture ? (
                                  <img src={user.profilePicture} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-teal to-brand-teal-light text-xs font-bold text-white">
                                    {getInitials(user.name)}
                                  </span>
                                )}
                              </div>
                              <span className="font-medium text-slate-900">{user.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{user.email}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                user.role === 'admin'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-teal-100 text-teal-800'
                              }`}
                            >
                              {user.role === 'admin' ? 'Administrator' : 'Student'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{user.college}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{formatDate(user.createdAt)}</td>
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              className="text-xs font-semibold text-brand-teal hover:text-brand-teal-dark"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                  disabled={page === 1}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand-teal hover:text-brand-teal disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                >
                  ← Previous
                </button>

                {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, index) => {
                  let pageNum
                  if (pagination.totalPages <= 7) {
                    pageNum = index + 1
                  } else if (page <= 4) {
                    pageNum = index < 5 ? index + 1 : '...'
                  } else if (page >= pagination.totalPages - 3) {
                    pageNum = index < 2 ? (index === 0 ? 1 : '...') : pagination.totalPages - 6 + index
                  } else {
                    pageNum =
                      index === 0
                        ? 1
                        : index === 1
                        ? '...'
                        : index === 2
                        ? page - 1
                        : index === 3
                        ? page
                        : index === 4
                        ? page + 1
                        : index === 5
                        ? '...'
                        : pagination.totalPages
                  }

                  if (pageNum === '...') {
                    return (
                      <span key={`ellipsis-${index}`} className="px-2 text-sm text-slate-400">
                        ...
                      </span>
                    )
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
                  )
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
        </SectionCard>
      </div>
    </div>
  )
}
