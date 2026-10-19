import React from 'react'
import { Link } from 'react-router-dom'

/**
 * Reusable loading skeleton grid for recommendation cards
 */
export function RecommendationSkeletonGrid({ count = 6 }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="h-96 animate-pulse rounded-3xl border border-slate-200 bg-white p-5 shadow-soft-sm"
        >
          <div className="h-44 rounded-2xl bg-slate-100" />
          <div className="mt-4 h-5 w-3/4 rounded bg-slate-100" />
          <div className="mt-2.5 h-4 w-1/2 rounded bg-slate-100" />
          <div className="mt-4 h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
          <div className="mt-5 h-8 w-1/3 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}

/**
 * Reusable empty state component
 */
export function RecommendationEmptyState({
  icon = '🔍',
  title = 'No events found',
  description = 'Try adjusting your filters or check back later.',
  actionText,
  actionLink,
  onAction,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 sm:p-14 text-center shadow-soft-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-3xl shadow-soft-sm mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
        {description}
      </p>

      {(actionText && (actionLink || onAction)) && (
        <div className="mt-6 flex justify-center">
          {actionLink ? (
            <Link
              to={actionLink}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-teal-dark active:scale-95"
            >
              <span>{actionText}</span>
              <span>→</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-teal-dark active:scale-95"
            >
              <span>{actionText}</span>
              <span>→</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Reusable error state component with retry action
 */
export function RecommendationErrorState({
  message = 'Unable to load events at this moment.',
  onRetry,
}) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-rose-50 p-10 text-center shadow-soft-sm">
      <div className="text-4xl mb-3">⚠️</div>
      <h3 className="text-lg font-bold text-rose-800">Unable to load recommendations</h3>
      <p className="mt-1.5 text-sm text-rose-600 max-w-md mx-auto">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-rose-500 active:scale-95"
        >
          Try Again
        </button>
      )}
    </div>
  )
}

/**
 * Reusable section heading for tabs
 */
export function TabSectionHeader({
  icon,
  title,
  description,
  count,
  countLabel = 'events',
  rightAction,
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
      <div>
        <div className="flex items-center gap-2">
          {icon && <span className="text-xl">{icon}</span>}
          <h2 className="text-2xl font-bold tracking-tight text-brand-text">
            {title}
          </h2>
        </div>
        {description && (
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {count !== undefined && count !== null && (
          <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
            {count} {countLabel}
          </span>
        )}
        {rightAction}
      </div>
    </div>
  )
}
