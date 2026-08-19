import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [college, setCollege] = useState('')
  const [accountType, setAccountType] = useState('student')
  const [adminCode, setAdminCode] = useState('')
  const [availableTags, setAvailableTags] = useState([])
  const [interests, setInterests] = useState([])
  const [customInterest, setCustomInterest] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { register, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
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
  }, [])

  const handleToggleInterest = (tag) => {
    if (interests.includes(tag)) {
      setInterests(interests.filter(i => i !== tag))
    } else {
      setInterests([...interests, tag])
    }
  }

  const handleAddCustomInterest = (e) => {
    e.preventDefault()
    const trimmed = customInterest.trim().toLowerCase()
    if (trimmed && !interests.includes(trimmed)) {
      setInterests([...interests, trimmed])
      setCustomInterest('')
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!name || !email || !password || !confirmPassword || !college) {
      setError('Please fill all required fields')
      return
    }

    if (!emailRegex.test(email)) {
      setError('Please enter a valid email')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (accountType === 'admin' && !adminCode.trim()) {
      setError('Admin code is required for admin registration')
      return
    }

    setLoading(true)
    try {
      const payload = {
        name,
        email,
        password,
        confirmPassword,
        college,
        interests,
        accountType,
      }

      if (accountType === 'admin') {
        payload.adminCode = adminCode.trim()
      }

      await register(payload)
      await login(email, password)
      navigate('/profile')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="flex min-h-screen">
        {/* Left Hero Section */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-teal to-brand-indigo flex-col justify-center px-12 xl:px-16">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-white shadow-lg">
                <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <span className="text-3xl font-bold text-white">
                Event<span className="text-teal-200">Sync</span>
              </span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6">
              Join the Community
            </h1>
            <p className="text-lg text-teal-100 leading-relaxed">
              Create your account to discover events, track opportunities, and connect with the campus community.
            </p>
          </div>
        </div>

        {/* Right Form Section */}
        <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
          <div className="w-full max-w-md">
            {/* Mobile Brand Header */}
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-teal to-brand-indigo text-white shadow-sm">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-brand-text">
                Event<span className="text-brand-teal">Sync</span>
              </span>
            </div>

            {/* Register Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-soft-xl">
              <h1 className="text-2xl font-bold text-brand-text mb-2">Create Account</h1>
              <p className="text-sm text-slate-500 mb-6">Fill in your details to get started</p>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label htmlFor="register-name" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Full Name
                  </label>
                  <input 
                    id="register-name"
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20" 
                    placeholder="John Doe"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="register-email" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Email
                  </label>
                  <input 
                    id="register-email"
                    type="email"
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20" 
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label htmlFor="register-password" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input 
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20" 
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-brand-teal transition"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      disabled={loading}
                    >
                      {showPassword ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="register-confirm" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input 
                      id="register-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20" 
                      placeholder="••••••••"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(prev => !prev)}
                      className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-brand-teal transition"
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                      disabled={loading}
                    >
                      {showConfirmPassword ? (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="register-college" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    College
                  </label>
                  <input 
                    id="register-college"
                    value={college} 
                    onChange={e => setCollege(e.target.value)} 
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20" 
                    placeholder="Your college name"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Account Type</label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="accountType"
                        value="student"
                        checked={accountType === 'student'}
                        onChange={() => {
                          setAccountType('student')
                          setAdminCode('')
                        }}
                        disabled={loading}
                        className="text-brand-teal focus:ring-brand-teal"
                      />
                      <span className="text-sm font-semibold text-slate-700">Student</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="accountType"
                        value="admin"
                        checked={accountType === 'admin'}
                        onChange={() => setAccountType('admin')}
                        disabled={loading}
                        className="text-brand-teal focus:ring-brand-teal"
                      />
                      <span className="text-sm font-semibold text-slate-700">Admin</span>
                    </label>
                  </div>
                </div>

                {accountType === 'admin' && (
                  <div>
                    <label htmlFor="register-admin-code" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Admin Code
                    </label>
                    <input
                      id="register-admin-code"
                      type="password"
                      value={adminCode}
                      onChange={e => setAdminCode(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                      placeholder="Enter admin code"
                      disabled={loading}
                    />
                    <p className="mt-1 text-xs text-slate-500">Admin registration requires an authorized admin code</p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Interests (optional)</label>
                  {availableTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {availableTags.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleInterest(tag)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition ${
                            interests.includes(tag) 
                              ? 'bg-brand-teal-subtle border-brand-teal text-brand-teal' 
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input 
                      value={customInterest} 
                      onChange={e => setCustomInterest(e.target.value)} 
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20" 
                      placeholder="Add custom interest..."
                      disabled={loading}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddCustomInterest(e)
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomInterest}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition"
                      disabled={loading}
                    >
                      Add
                    </button>
                  </div>
                  {interests.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="text-xs text-slate-500 mr-1 self-center">Selected:</span>
                      {interests.map(i => (
                        <span key={i} className="text-xs font-bold text-brand-teal bg-brand-teal-subtle px-2 py-0.5 rounded flex items-center gap-1">
                          {i}
                          <button type="button" onClick={() => handleToggleInterest(i)} className="text-brand-teal hover:text-brand-teal-dark">&times;</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
                    {error}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full rounded-xl bg-brand-teal px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md disabled:opacity-50 active:scale-95"
                >
                  {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-brand-teal hover:text-brand-teal-dark transition">
                  Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
