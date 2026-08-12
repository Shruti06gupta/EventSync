import React, { useEffect, useRef, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const formatRole = (role) => {
  if (!role) return 'User'
  if (role === 'student') return 'Student'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export default function UserProfile() {
  const { user, fetchProfile } = useAuth()
  const fileInputRef = useRef(null)
  const [form, setForm] = useState({ name: '', college: '', interests: [], profilePicture: null })
  const [notificationPreferences, setNotificationPreferences] = useState({
    email: true,
    deadlineReminders: true,
    newEvents: true,
    weeklyDigest: true,
  })
  const [availableTags, setAvailableTags] = useState([])
  const [newInterest, setNewInterest] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState('')

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        college: user.college || '',
        interests: user.interests || [],
        profilePicture: user.profilePicture || null,
      })
      setPreview(user.profilePicture || null)

      const fetchPrefs = async () => {
        try {
          const res = await api.get('/user/notification-preferences')
          if (res.data.notificationPreferences) {
            setNotificationPreferences(res.data.notificationPreferences)
          }
        } catch (err) {
          console.error('Failed to fetch notification preferences', err)
        }
      }
      const fetchTags = async () => {
        try {
          const res = await api.get('/events/tags')
          if (res.data.tags) {
            setAvailableTags(res.data.tags)
          }
        } catch (err) {
          console.error('Failed to fetch tags', err)
        }
      }
      fetchTags()
      fetchPrefs()
    }
  }, [user])

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 150
        canvas.height = 150
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, 150, 150)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setPreview(dataUrl)
        setForm((prev) => ({ ...prev, profilePicture: dataUrl }))
      }
      img.src = event.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleDeletePicture = () => {
    setPreview(null)
    setForm((prev) => ({ ...prev, profilePicture: null }))
  }

  const handleTogglePref = async (key) => {
    const updated = { ...notificationPreferences, [key]: !notificationPreferences[key] }
    setNotificationPreferences(updated)
    try {
      await api.patch('/user/notification-preferences', { [key]: updated[key] })
    } catch (err) {
      console.error('Failed to update preference', err)
      setNotificationPreferences(notificationPreferences)
    }
  }

  const handleAddInterest = (e) => {
    e.preventDefault()
    const trimmed = newInterest.trim()
    if (trimmed && !form.interests.includes(trimmed)) {
      setForm((prev) => ({
        ...prev,
        interests: [...prev.interests, trimmed],
      }))
      setNewInterest('')
    }
  }

  const handleRemoveInterest = (interestToRemove) => {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.filter((i) => i !== interestToRemove),
    }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    setMessageType('')
    try {
      const res = await api.patch('/user/profile', form)
      setMessage(res.data.message || 'Profile updated successfully!')
      setMessageType('success')
      await fetchProfile()
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update profile.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
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

  const notificationItems = [
    { key: 'email', label: 'Email Notifications', desc: 'Receive updates directly to your inbox.' },
    { key: 'deadlineReminders', label: 'Deadline Reminders', desc: 'Get notified before event deadlines.' },
    { key: 'newEvents', label: 'New Event Alerts', desc: 'Get notified when a new event matches your interests or college.' },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-8 text-center text-2xl font-bold tracking-tight text-gray-900">My Profile</h1>

      {message && (
        <div
          className={`mb-6 rounded-2xl border p-4 text-sm font-semibold ${
            messageType === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {message}
        </div>
      )}

      {/* Profile Header */}
      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-teal-600 to-cyan-500 px-6 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-white text-3xl font-bold text-teal-700 shadow-lg ring-4 ring-white/30 transition hover:ring-white/50 focus:outline-none focus:ring-4 focus:ring-white/60"
                aria-label="Change profile photo"
              >
                {preview ? (
                  <img src={preview} alt={user?.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-teal-50">
                    {getInitials(user?.name)}
                  </span>
                )}
                <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-white shadow-md transition group-hover:bg-teal-700">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </span>
              </button>
              <input
                ref={fileInputRef}
                id="avatar-file"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <h2 className="mt-5 text-2xl font-bold text-white">{user?.name}</h2>
            <p className="mt-1 text-sm text-teal-50">{user?.email}</p>
            <span className="mt-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {formatRole(user?.role)}
            </span>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Change Profile Photo
              </button>
              {preview && (
                <button
                  type="button"
                  onClick={handleDeletePicture}
                  className="rounded-xl border border-white/30 bg-rose-500/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500/30"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Full Name</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{user?.name || '—'}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Email</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{user?.email || '—'}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Role</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{formatRole(user?.role)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">College</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{user?.college || '—'}</p>
          </div>
        </div>
      </section>

      <form onSubmit={submit} className="mt-8 space-y-8">
        {/* Personal Information */}
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Personal Information</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4">
              <label htmlFor="profile-name" className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                Full Name
              </label>
              <input
                id="profile-name"
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                placeholder="John Doe"
              />
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gray-50/40 p-4">
              <label htmlFor="profile-college" className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                College Name
              </label>
              <input
                id="profile-college"
                type="text"
                required
                value={form.college}
                onChange={(e) => setForm({ ...form, college: e.target.value })}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                placeholder="Delhi Technological University"
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-teal-600 px-8 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
            >
              {loading ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </section>

        {/* Interests & Areas */}
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Interests &amp; Areas</h3>
          <p className="mt-2 text-sm text-gray-500">
            Your interests help EventSync recommend relevant events.
          </p>

          <div className="mt-5 flex min-h-[48px] flex-wrap gap-2 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
            {form.interests.length === 0 ? (
              <span className="self-center text-sm italic text-gray-400">No interests added yet. Add some below!</span>
            ) : (
              form.interests.map((interest) => (
                <span
                  key={interest}
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3.5 py-1.5 text-xs font-semibold text-teal-700"
                >
                  {interest}
                  <button
                    type="button"
                    onClick={() => handleRemoveInterest(interest)}
                    className="ml-0.5 text-sm font-bold leading-none text-teal-500 hover:text-teal-800 focus:outline-none"
                    aria-label={`Remove ${interest}`}
                  >
                    &times;
                  </button>
                </span>
              ))
            )}
          </div>

          {availableTags.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Suggested Interests</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableTags
                  .filter((tag) => !form.interests.includes(tag))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (!form.interests.includes(tag)) {
                          setForm((prev) => ({ ...prev, interests: [...prev.interests, tag] }))
                        }
                      }}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
                    >
                      + {tag}
                    </button>
                  ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <input
              type="text"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              placeholder="Add an interest..."
              className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddInterest(e)
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddInterest}
              className="rounded-2xl border border-teal-200 bg-teal-50 px-5 text-sm font-semibold text-teal-700 transition hover:bg-teal-100"
            >
              Add
            </button>
          </div>
        </section>
      </form>

      {/* Notification Preferences */}
      <section className="mt-8 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">Notification Preferences</h3>
        <div className="mt-5 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100">
          {notificationItems.map((pref) => {
            const isOn = notificationPreferences[pref.key]
            return (
              <div
                key={pref.key}
                className="flex items-center justify-between gap-4 bg-gray-50/40 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{pref.label}</p>
                  <p className="mt-1 text-xs text-gray-500">{pref.desc}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isOn ? 'text-teal-600' : 'text-gray-400'
                    }`}
                  >
                    {isOn ? 'On' : 'Off'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTogglePref(pref.key)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isOn ? 'bg-teal-500' : 'bg-gray-200'
                    }`}
                    aria-label={`Toggle ${pref.label}`}
                    aria-pressed={isOn}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isOn ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
