import React, { useEffect, useState } from 'react'
import api from '../api'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, fetchProfile } = useAuth()
  const [form, setForm] = useState({ name: '', college: '', interests: [] })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(()=>{
    if (user) setForm({ name: user.name, college: user.college, interests: user.interests || [] })
  },[user])

  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const res = await api.patch('/user/profile', form)
      setMessage(res.data.message)
      await fetchProfile()
    } catch (err) {
      setMessage(err.response?.data?.message || 'Error')
    } finally { setLoading(false) }
  }

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
      <h1 className="text-xl font-semibold text-teal-700 mb-4">Profile</h1>
      <form onSubmit={submit} className="space-y-3">
        <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="name" className="w-full px-3 py-2 border rounded" />
        <input value={form.college} onChange={e=>setForm({...form,college:e.target.value})} placeholder="college" className="w-full px-3 py-2 border rounded" />
        <input value={form.interests} onChange={e=>setForm({...form,interests: e.target.value.split(',').map(s=>s.trim())})} placeholder="interests (comma separated)" className="w-full px-3 py-2 border rounded" />
        <button disabled={loading} className="w-full bg-teal-600 text-white py-2 rounded">{loading? 'Saving...' : 'Save'}</button>
      </form>
      {message && <p className="mt-3 text-sm">{message}</p>}
    </div>
  )
}
