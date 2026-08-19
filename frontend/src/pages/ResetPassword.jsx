import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Invalid or missing reset token')
      return
    }

    if (!newPassword || !confirmPassword) {
      setError('All fields are required')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword })
      setSuccess(true)
      setMessage(res.data.message)
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password')
    } finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-soft-xl text-center">
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-brand-text mb-2">Password Reset Successful!</h1>
            <p className="text-sm text-slate-500 mb-6">Your password has been reset. Redirecting to login...</p>
            <Link to="/login" className="inline-block rounded-xl bg-brand-teal px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95">
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-soft-xl text-center">
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-brand-text mb-2">Invalid Reset Link</h1>
            <p className="text-sm text-slate-500 mb-6">This password reset link is invalid or missing. Please request a new one.</p>
            <Link to="/forgot-password" className="inline-block rounded-xl bg-brand-teal px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-teal-dark hover:shadow-soft-md active:scale-95">
              Request New Reset Link
            </Link>
          </div>
        </div>
      </div>
    )
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
              Set New Password
            </h1>
            <p className="text-lg text-teal-100 leading-relaxed">
              Choose a secure new password for your account. Make sure it's something you'll remember.
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

            {/* Reset Password Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-soft-xl">
              <h1 className="text-2xl font-bold text-brand-text mb-2">Reset Password</h1>
              <p className="text-sm text-slate-500 mb-6">Choose a new password for your account</p>

              <form onSubmit={submit} className="space-y-5">
                <div>
                  <label htmlFor="reset-new" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-new"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(prev => !prev)}
                      className="absolute inset-y-0 right-0 px-3 text-slate-400 hover:text-brand-teal transition"
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                      disabled={loading}
                    >
                      {showNewPassword ? (
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
                  <label htmlFor="reset-confirm" className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="reset-confirm"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 pr-12 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
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
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                Back to{' '}
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
