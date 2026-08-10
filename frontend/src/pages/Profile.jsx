import React, { useEffect, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, fetchProfile } = useAuth()
  const [form, setForm] = useState({ name: '', college: '', interests: [], profilePicture: null })
  const [notificationPreferences, setNotificationPreferences] = useState({
    email: true,
    deadlineReminders: true,
    newEvents: true,
    weeklyDigest: true
  })
  const [availableTags, setAvailableTags] = useState([])
  const [newInterest, setNewInterest] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState('') // 'success' or 'error'

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
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 150, 150);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPreview(dataUrl);
        setForm(prev => ({ ...prev, profilePicture: dataUrl }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePicture = () => {
    setPreview(null);
    setForm(prev => ({ ...prev, profilePicture: null }));
  };

  const handleTogglePref = async (key) => {
    const updated = { ...notificationPreferences, [key]: !notificationPreferences[key] }
    setNotificationPreferences(updated)
    try {
      await api.patch('/user/notification-preferences', { [key]: updated[key] })
    } catch (err) {
      console.error('Failed to update preference', err)
      setNotificationPreferences(notificationPreferences) // revert on error
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

  // Get user initials for the avatar
  const getInitials = (name) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }

  return (
    <div className="w-full max-w-2xl px-4 py-8">
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl border border-gray-100">
        
        {/* Banner / Avatar Header */}
        <div className="relative h-32 bg-gradient-to-r from-teal-600 to-cyan-500 animate-fadeIn">
          <div className="absolute -bottom-10 left-8 flex items-end">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-xl font-bold text-teal-600 shadow-md ring-4 ring-white overflow-hidden shrink-0">
              {preview ? (
                <img src={preview} alt={user?.name} className="h-full w-full object-cover" />
              ) : (
                getInitials(user?.name)
              )}
            </div>
            <div className="ml-4 mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900 line-clamp-1">{user?.name}</h2>
                <p className="text-xs text-gray-500 font-medium">{user?.email} • {user?.role}</p>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-center">
                <label htmlFor="avatar-file" className="cursor-pointer text-[10px] uppercase tracking-wider font-extrabold bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 px-3 py-1.5 rounded-xl transition duration-150 shadow-sm">
                  Upload Group
                </label>
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {preview && (
                  <button
                    type="button"
                    onClick={handleDeletePicture}
                    className="text-[10px] uppercase tracking-wider font-extrabold bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl transition duration-150 shadow-sm"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Form */}
        <div className="px-8 pb-8 pt-16">
          {message && (
            <div
              className={`mb-6 rounded-2xl p-4 text-sm font-semibold border ${
                messageType === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {message}
            </div>
          )}

          <form onSubmit={submit} className="space-y-6">
            {/* Personal Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Personal Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">College Name</label>
                  <input
                    type="text"
                    required
                    value={form.college}
                    onChange={(e) => setForm({ ...form, college: e.target.value })}
                    className="w-full rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition"
                    placeholder="Delhi Technological University"
                  />
                </div>
              </div>
            </div>

            {/* Interest Tags section */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Interests & Areas</h3>
              
              {/* Existing Tags */}
              <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-2xl border border-gray-100 bg-gray-50/50">
                {form.interests.length === 0 ? (
                  <span className="text-xs text-gray-400 italic self-center">No interests added yet. Add some below!</span>
                ) : (
                  form.interests.map((interest) => (
                    <span
                      key={interest}
                      className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-100 px-3.5 py-1.5 text-xs font-semibold text-teal-700 shadow-sm"
                    >
                      {interest}
                      <button
                        type="button"
                        onClick={() => handleRemoveInterest(interest)}
                        className="text-teal-500 hover:text-teal-800 text-sm font-bold leading-none ml-1 focus:outline-none"
                      >
                        &times;
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Suggested Tags */}
              {availableTags.length > 0 && (
                <div className="mb-4 mt-4">
                  <p className="text-xs text-gray-500 mb-2 font-semibold">Suggested Interests:</p>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.filter(tag => !form.interests.includes(tag)).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          if (!form.interests.includes(tag)) {
                            setForm(prev => ({ ...prev, interests: [...prev.interests, tag] }))
                          }
                        }}
                        className="px-3 py-1 text-xs font-semibold rounded-full border bg-white border-gray-200 text-gray-600 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200 transition"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Tag Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  placeholder="e.g. AI, Web Development, Design"
                  className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddInterest(e)
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddInterest}
                  className="rounded-2xl bg-teal-50 hover:bg-teal-100 border border-teal-200 px-5 text-sm font-semibold text-teal-700 transition active:scale-95 transform"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t border-gray-100">
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto rounded-2xl bg-teal-600 px-8 py-4 text-sm font-bold text-white shadow-md hover:bg-teal-700 hover:shadow-lg transition duration-150 active:scale-95 transform disabled:opacity-50"
              >
                {loading ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Notification Preferences */}
          <div className="mt-8 pt-8 border-t border-gray-100">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-6">Notification Preferences</h3>
            <div className="space-y-4">
              {[
                { key: 'email', label: 'Email Notifications', desc: 'Receive updates directly to your inbox.' },
                { key: 'deadlineReminders', label: 'Deadline Reminders', desc: 'Get notified when an event registration is closing soon (48h, 24h, 3h).' },
                { key: 'newEvents', label: 'New Event Alerts', desc: 'Get notified when a new event matches your interests or college.' },
              ].map((pref) => (
                <div key={pref.key} className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50/50">
                  <div className="pr-4">
                    <p className="text-sm font-bold text-gray-900">{pref.label}</p>
                    <p className="text-xs text-gray-500 mt-1">{pref.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePref(pref.key)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${notificationPreferences[pref.key] ? 'bg-teal-500' : 'bg-gray-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${notificationPreferences[pref.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
