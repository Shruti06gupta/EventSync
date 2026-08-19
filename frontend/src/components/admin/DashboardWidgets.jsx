import React from 'react'

const formatNumber = (value) => new Intl.NumberFormat('en-IN').format(value ?? 0)

export function StatCard({ title, value, subtitle, icon, accent = 'teal' }) {
  const accents = {
    teal: 'from-brand-teal to-brand-teal-dark',
    blue: 'from-brand-cyan to-brand-teal',
    violet: 'from-brand-violet to-brand-purple',
    amber: 'from-amber-500 to-orange-600',
    indigo: 'from-brand-indigo to-brand-indigo-dark',
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft-sm transition hover:shadow-soft-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
          {subtitle ? <p className="mt-2 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${accents[accent]} text-lg text-white shadow-sm`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export function SectionCard({ title, subtitle, children, action }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft-sm">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function SimpleBarChart({ data, barColor = 'bg-brand-teal' }) {
  if (!data?.length) {
    return <p className="text-sm text-slate-500">No trend data available.</p>
  }

  const max = Math.max(...data.map((item) => item.count), 1)

  return (
    <div className="flex h-48 items-end gap-2">
      {data.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">{item.count}</span>
          <div className="flex w-full items-end justify-center" style={{ height: '140px' }}>
            <div
              className={`w-full max-w-[2.5rem] rounded-t-xl ${barColor} transition-all`}
              style={{ height: `${Math.max((item.count / max) * 100, item.count > 0 ? 8 : 0)}%` }}
              title={`${item.label}: ${item.count}`}
            />
          </div>
          <span className="text-[11px] font-medium text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

export function HorizontalBars({ items, valueKey = 'count', labelKey = 'platform' }) {
  if (!items?.length) {
    return <p className="text-sm text-slate-500">No platform data available.</p>
  }

  const max = Math.max(...items.map((item) => item[valueKey]), 1)

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item[labelKey] || item.source}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{item[labelKey]}</span>
            <span className="font-semibold text-slate-900">{formatNumber(item[valueKey])}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-teal to-brand-teal-dark"
              style={{ width: `${(item[valueKey] / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-brand-bg pb-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 animate-pulse">
        <div className="mb-8 h-28 rounded-3xl bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-32 rounded-2xl bg-slate-200" />
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="h-80 rounded-3xl bg-slate-200" />
          <div className="h-80 rounded-3xl bg-slate-200" />
        </div>
      </div>
    </div>
  )
}

export { formatNumber }
