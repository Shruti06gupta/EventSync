import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const navigate = useNavigate()

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const sendResetLink = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!email) {
      setError('Email is required')
      return
    }

    if (!emailRegex.test(email)) {
      setError('Please enter a valid email')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password', { email })
      setSent(true)
      setMessage(res.data.message)

      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset link')
    } finally {
      setLoading(false)
    }
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
              Reset Your Password
            </h1>
            <p className="text-lg text-teal-100 leading-relaxed">
              Enter your registered email and we'll send you instructions to reset your password securely.
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

            {/* Forgot Password Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-soft-xl">
              <h1 className="text-2xl font-bold text-brand-text mb-2">Forgot Password?</h1>
              <p className="text-sm text-slate-500 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form onSubmit={sendResetLink} className="space-y-5">
                <div>
                  <label htmlFor="forgot-email" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Email Address
                  </label>
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
                    {error}
                  </div>
                )}
                {message && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                    {message}
                  </div>
                )}

                {sent && (
                  <div className="rounded-xl border border-brand-teal bg-brand-teal-subtle p-4 text-sm text-brand-teal">
                    <div className="flex items-start gap-3">
                      <svg className="h-5 w-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="font-semibold">Reset link sent</p>
                        <p className="mt-1 text-brand-teal-dark">
                          A password reset link has been sent to <strong>{email}</strong>. Redirecting to Sign In...
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-brand-teal px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md disabled:opacity-50 active:scale-95"
                >
                  {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                Remember your password?{' '}
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
