import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'
import { useAuth } from '../context/AuthContext'

const getInitials = (name) => {
  if (!name) return 'A'
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const formatDate = (value) => {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function AdminProfile() {
  const { user, fetchProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: '', college: '', profilePicture: null })
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState('')

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        college: user.college || '',
        profilePicture: user.profilePicture || null,
      })
      setPreview(user.profilePicture || null)
    }
  }, [user])

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (loadEvent) => {
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
      img.src = loadEvent.target.result
    }
    reader.readAsDataURL(file)
  }

  const handleDeletePicture = () => {
    setPreview(null)
    setForm((prev) => ({ ...prev, profilePicture: null }))
  }

  const handleSave = async (event) => {
    event?.preventDefault?.()
    setLoading(true)
    setMessage(null)
    setMessageType('')

    try {
      const res = await api.patch('/user/profile', {
        name: form.name,
        college: form.college,
        profilePicture: form.profilePicture,
      })
      setMessage(res.data.message || 'Profile updated successfully.')
      setMessageType('success')
      setEditing(false)
      await fetchProfile()
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to update profile.')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-xl">
        <div className="bg-gradient-to-r from-slate-900 via-teal-900 to-emerald-800 px-8 py-10 text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-100">Admin Profile</p>

          <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-white text-2xl font-bold text-teal-700 shadow-lg ring-4 ring-white/20">
            {preview ? (
              <img src={preview} alt={user?.name} className="h-full w-full object-cover" />
            ) : (
              getInitials(user?.name)
            )}
          </div>

          <h1 className="mt-5 text-2xl font-bold">{user?.name}</h1>
          <p className="mt-1 text-sm text-teal-100">Administrator</p>
          <p className="mt-1 text-sm text-teal-50">{user?.email}</p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-sm font-semibold text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            Active
          </div>
        </div>

        <div className="space-y-6 px-6 py-8 sm:px-8">
          {message ? (
            <div
              className={`rounded-2xl border p-4 text-sm font-semibold ${
                messageType === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {message}
            </div>
          ) : null}

          <section className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Account Information</h2>

            {editing ? (
              <form onSubmit={handleSave} className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-gray-600">Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-gray-600">College / Organization</label>
                  <input
                    type="text"
                    required
                    value={form.college}
                    onChange={(event) => setForm({ ...form, college: event.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false)
                      setForm({
                        name: user.name || '',
                        college: user.college || '',
                        profilePicture: user.profilePicture || null,
                      })
                      setPreview(user.profilePicture || null)
                    }}
                    className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-500">Full Name</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{user?.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-500">Email</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{user?.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-500">Role</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">Administrator</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-500">College / Organization</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{user?.college || 'Not set'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-500">Member Since</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">{formatDate(user?.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-500">Last Login</dt>
                  <dd className="mt-1 text-sm font-semibold text-gray-900">
                    {user?.lastLoginAt ? formatDate(user.lastLoginAt) : 'Not tracked'}
                  </dd>
                </div>
              </dl>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Profile Photo</h2>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-teal-50 text-lg font-bold text-teal-700">
                {preview ? (
                  <img src={preview} alt={user?.name} className="h-full w-full object-cover" />
                ) : (
                  getInitials(user?.name)
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <label
                  htmlFor="admin-avatar-file"
                  className="cursor-pointer rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-100"
                >
                  Change Profile Picture
                </label>
                <input
                  id="admin-avatar-file"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {preview ? (
                  <button
                    type="button"
                    onClick={handleDeletePicture}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                  >
                    Remove Photo
                  </button>
                ) : null}
              </div>
            </div>
            {preview !== user?.profilePicture ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="mt-4 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {loading ? 'Saving Photo...' : 'Save Photo'}
              </button>
            ) : null}
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-700">Account Status</h2>
            <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-800">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Active
            </div>
            <p className="mt-2 text-sm text-emerald-700">Account Type: Administrator</p>
          </section>

          <section className="rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              {!editing ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Edit Profile
                </button>
              ) : null}
              <Link
                to="/forgot-password"
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Change Password
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                Logout
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
