import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import api from '../api'

const formatDateForInput = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const pad = (num) => String(num).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ManageEvents() {
  const { user } = useAuth()
  const { refreshNotifications } = useNotifications()
  const [events, setEvents] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [editingEventId, setEditingEventId] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncReport, setSyncReport] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    organizer: '',
    college: user?.college || '',
    category: 'Technology',
    tags: '',
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    mode: 'Offline',
    venue: '',
    image: '',
    eventLink: '',
    isPublic: false,
  })

  const loadMyEvents = async () => {
    try {
      setLoadingEvents(true)
      const res = await api.get('/events', { params: { limit: 50 } })
      const myEvents = (res.data.events || []).filter(
        (event) => event.createdBy === user?.id || event.createdBy?._id === user?.id
      )
      setEvents(myEvents)
    } catch (err) {
      console.error('Failed to load events', err)
    } finally {
      setLoadingEvents(false)
    }
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      setSyncReport(null)
      const res = await api.post('/aggregation/sync')
      setSyncReport(res.data.report)
      loadMyEvents()
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Sync failed. Please try again.')
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    loadMyEvents()
  }, [user])

  const getLinkType = (url) => {
    if (!url) return null
    try {
      const parsed = new URL(url)
      const host = parsed.hostname.toLowerCase()
      if (host.includes('forms.google.com') || host.includes('docs.google.com/forms')) return 'Google Form'
      if (host.includes('unstop.com')) return 'Unstop'
      if (host.includes('devfolio.co')) return 'Devfolio'
      if (host.includes('forms.office.com') || host.includes('forms.microsoft.com')) return 'Microsoft Form'
      if (host.endsWith('.edu') || host.endsWith('.edu.in') || host.endsWith('.ac.in') || host.includes('college') || host.includes('univ')) return 'College Website'
      return 'Custom Link'
    } catch (e) {
      return 'Invalid URL'
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleStartEdit = (event) => {
    setEditingEventId(event._id)
    setFormData({
      title: event.title || '',
      description: event.description || '',
      organizer: event.organizer || '',
      college: event.college || '',
      category: event.category || 'Technology',
      tags: event.tags ? event.tags.join(', ') : '',
      startDate: formatDateForInput(event.startDate),
      endDate: formatDateForInput(event.endDate),
      registrationDeadline: formatDateForInput(event.registrationDeadline),
      mode: event.mode || 'Offline',
      venue: event.venue || '',
      image: event.image || '',
      eventLink: event.eventLink || '',
      isPublic: event.isPublic || false,
    })
    setSuccessMessage('')
    setErrorMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    setEditingEventId(null)
    setFormData({
      title: '',
      description: '',
      organizer: '',
      college: user?.college || '',
      category: 'Technology',
      tags: '',
      startDate: '',
      endDate: '',
      registrationDeadline: '',
      mode: 'Offline',
      venue: '',
      image: '',
      eventLink: '',
      isPublic: false,
    })
    setSuccessMessage('')
    setErrorMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')

    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    const deadline = new Date(formData.registrationDeadline)

    if (end < start) {
      setErrorMessage('End date must be after start date.')
      return
    }

    if (deadline > start) {
      setErrorMessage('Registration deadline cannot be after the event start date.')
      return
    }

    if (formData.eventLink) {
      const linkType = getLinkType(formData.eventLink)
      if (linkType === 'Invalid URL') {
        setErrorMessage('Please enter a valid URL starting with http:// or https://')
        return
      }
    }

    try {
      setSubmitting(true)
      const payload = {
        ...formData,
        tags: formData.tags
          ? formData.tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      }

      if (editingEventId) {
        await api.patch(`/events/${editingEventId}`, payload)
        setSuccessMessage('Event updated successfully!')
      } else {
        await api.post('/events', payload)
        setSuccessMessage('Event created successfully!')
        refreshNotifications()
      }

      setFormData({
        title: '',
        description: '',
        organizer: '',
        college: user?.college || '',
        category: 'Technology',
        tags: '',
        startDate: '',
        endDate: '',
        registrationDeadline: '',
        mode: 'Offline',
        venue: '',
        image: '',
        eventLink: '',
        isPublic: false,
      })
      setEditingEventId(null)
      loadMyEvents()
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Operation failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const linkType = getLinkType(formData.eventLink)

  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <div className="mb-8 rounded-3xl bg-gradient-to-r from-teal-700 to-emerald-600 p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-teal-100">Admin Control Panel</p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Manage Campus Events</h1>
            <p className="mt-2 max-w-2xl text-teal-50">
              Create, edit, and configure campus events and registration details.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 hover:shadow-lg disabled:opacity-50 border border-white/20"
          >
            {syncing ? (
              <>
                <svg className="h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Auto-Sync Events
              </>
            )}
          </button>
        </div>

        {syncReport && (
          <div className="mt-6 rounded-2xl bg-white/10 backdrop-blur-md p-5 border border-white/20 text-teal-50 animate-fadeIn">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <span className="text-xl">✅</span> Sync Successful
            </h3>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-teal-100 uppercase font-semibold">Devfolio</p>
                <p className="text-2xl font-bold text-white mt-1">{syncReport.devfolioCount} <span className="text-sm font-normal">new</span></p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-teal-100 uppercase font-semibold">Unstop</p>
                <p className="text-2xl font-bold text-white mt-1">{syncReport.unstopCount} <span className="text-sm font-normal">new</span></p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-teal-100 uppercase font-semibold">Duplicates</p>
                <p className="text-2xl font-bold text-white mt-1">{syncReport.duplicatesSkipped} <span className="text-sm font-normal">skipped</span></p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-xs text-teal-100 uppercase font-semibold">Status</p>
                <p className="text-lg font-bold text-white mt-1 capitalize">{syncReport.status}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Event Form */}
        <div className="lg:col-span-2 rounded-3xl bg-white p-6 sm:p-8 shadow-md border border-gray-100">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">
              {editingEventId ? 'Edit Event Details' : 'Create New Event'}
            </h2>
            {editingEventId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline"
              >
                Cancel Editing
              </button>
            )}
          </div>

          {successMessage && (
            <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-semibold text-emerald-800 animate-fadeIn">
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div className="mb-6 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-semibold text-rose-800 animate-fadeIn">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Event Title *</label>
              <input
                type="text"
                name="title"
                required
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Annual Hackathon 2026"
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
              <textarea
                name="description"
                required
                rows="4"
                value={formData.description}
                onChange={handleChange}
                placeholder="Provide a detailed description of the event, itinerary, prizes etc."
                className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
              ></textarea>
            </div>

            {/* Organizer & College */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Organizer *</label>
                <input
                  type="text"
                  name="organizer"
                  required
                  value={formData.organizer}
                  onChange={handleChange}
                  placeholder="e.g. Coding Club"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">College *</label>
                <input
                  type="text"
                  name="college"
                  required
                  value={formData.college}
                  onChange={handleChange}
                  placeholder="e.g. IIT Delhi"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
            </div>

            {/* Category & Tags */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                <select
                  name="category"
                  required
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition bg-white"
                >
                  <option value="Technology">Technology</option>
                  <option value="Programming">Programming</option>
                  <option value="Design">Design</option>
                  <option value="Entrepreneurship">Entrepreneurship</option>
                  <option value="Hackathon">Hackathon</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Communication">Communication</option>
                  <option value="Art">Art</option>
                  <option value="Gaming">Gaming</option>
                  <option value="Social Impact">Social Impact</option>
                  <option value="Culture">Culture</option>
                  <option value="Academics">Academics</option>
                  <option value="Networking">Networking</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tags (comma separated)</label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="e.g. AI, hack, frontend"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
            </div>

            {/* Mode & Venue */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Mode *</label>
                <select
                  name="mode"
                  required
                  value={formData.mode}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition bg-white"
                >
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Venue {formData.mode !== 'Online' && '*'}
                </label>
                <input
                  type="text"
                  name="venue"
                  required={formData.mode !== 'Online'}
                  value={formData.venue}
                  onChange={handleChange}
                  placeholder={formData.mode === 'Online' ? 'e.g. Zoom (optional)' : 'e.g. Seminar Hall A'}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
            </div>

            {/* Dates */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Start Date & Time *</label>
                <input
                  type="datetime-local"
                  name="startDate"
                  required
                  value={formData.startDate}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">End Date & Time *</label>
                <input
                  type="datetime-local"
                  name="endDate"
                  required
                  value={formData.endDate}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Registration Deadline *</label>
                <input
                  type="datetime-local"
                  name="registrationDeadline"
                  required
                  value={formData.registrationDeadline}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
            </div>

            {/* Image URL & Event Registration Link */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Banner Image URL</label>
                <input
                  type="url"
                  name="image"
                  value={formData.image}
                  onChange={handleChange}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Registration/Event Link</label>
                  {linkType && (
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        linkType === 'Invalid URL'
                          ? 'bg-rose-100 text-rose-700'
                          : linkType === 'Custom Link'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-teal-100 text-teal-700'
                      }`}
                    >
                      {linkType}
                    </span>
                  )}
                </div>
                <input
                  type="url"
                  name="eventLink"
                  value={formData.eventLink}
                  onChange={handleChange}
                  placeholder="Google Forms, Unstop, Devfolio, Microsoft Forms, College links"
                  className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Accepts Google Forms, Unstop, Devfolio, Microsoft Forms, or official college domains.
                </p>
              </div>
            </div>

            {/* Is Public Toggle */}
            <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <input
                type="checkbox"
                id="isPublic"
                name="isPublic"
                checked={formData.isPublic}
                onChange={handleChange}
                className="h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500 transition"
              />
              <label htmlFor="isPublic" className="text-sm font-semibold text-gray-800 cursor-pointer">
                Mark as Public Event
                <span className="block text-xs font-normal text-gray-500 mt-0.5">
                  Checking this will notify all users across the platform, regardless of their college or interests.
                </span>
              </label>
            </div>

            {/* Submit & Cancel Buttons */}
            <div className="pt-4 flex flex-wrap gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto rounded-2xl bg-teal-600 px-8 py-4 text-sm font-bold text-white shadow-md hover:bg-teal-700 hover:shadow-lg transition duration-150 active:scale-95 transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting
                  ? editingEventId
                    ? 'Updating...'
                    : 'Creating...'
                  : editingEventId
                  ? 'Update Event'
                  : 'Create Event'}
              </button>
              {editingEventId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full sm:w-auto rounded-2xl bg-gray-100 px-8 py-4 text-sm font-bold text-gray-700 hover:bg-gray-200 transition duration-150 active:scale-95 transform"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Admin Created Events Sidebar */}
        <div className="rounded-3xl bg-white p-6 shadow-md border border-gray-100 h-fit">
          <h2 className="text-xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100">Your Created Events</h2>
          {loadingEvents ? (
            <p className="text-sm text-gray-500">Loading your events...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-500">You haven't created any events yet.</p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {events.map((event) => (
                <div key={event._id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 hover:border-teal-200 transition duration-200">
                  <h3 className="font-semibold text-gray-800 text-sm line-clamp-1">{event.title}</h3>
                  <p className="text-xs text-gray-500 mt-1">{event.category} • {event.mode}</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-medium">
                    Deadline: {new Date(event.registrationDeadline).toLocaleDateString('en-IN', {
                      dateStyle: 'medium',
                    })}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-200/50 pt-2.5">
                    {event.eventLink ? (
                      <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2.5 py-0.5 rounded-full">
                        {getLinkType(event.eventLink)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
                        No Link
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartEdit(event)}
                      className="text-xs font-bold text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 px-3.5 py-1.5 rounded-xl transition duration-150"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
