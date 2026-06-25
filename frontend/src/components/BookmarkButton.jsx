import React, { useState } from 'react'

export default function BookmarkButton({ eventId, isBookmarked, onToggle, size = 'md' }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleClick = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (saving) return

    try {
      setSaving(true)
      setError('')
      await onToggle(eventId)
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save event. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-1.5 text-xs'
      : 'px-4 py-2 text-sm'

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        aria-label={isBookmarked ? 'Remove from bookmarks' : 'Save to bookmarks'}
        className={`inline-flex items-center gap-1.5 rounded-xl border font-semibold transition duration-150 active:scale-95 transform disabled:opacity-60 disabled:cursor-not-allowed ${sizeClasses} ${
          isBookmarked
            ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
            : 'border-gray-200 bg-white text-gray-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700'
        }`}
      >
        <span aria-hidden="true">{isBookmarked ? '★' : '☆'}</span>
        {saving ? 'Saving...' : isBookmarked ? 'Saved' : 'Save'}
      </button>
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </div>
  )
}
