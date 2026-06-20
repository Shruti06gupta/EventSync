import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const navigate = useNavigate()

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const sendOtp = async (e) => {
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
      setOtpSent(true)
      setMessage(res.data.message)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (e) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    if (!otp || !newPassword || !confirmPassword) {
      setError('OTP and password fields are required')
      return
    }

    if (!/^\d{6}$/.test(otp)) {
      setError('OTP must be 6 digits')
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

    setResetLoading(true)
    try {
      const res = await api.post('/auth/reset-password', {
        email,
        otp,
        newPassword,
      })

      setResetSuccess(true)
      setMessage(res.data.message)
      setOtp('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password')
    } finally {
      setResetLoading(false)
    }
  }

  if (resetSuccess) {
    return (
      <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
              ✓
            </div>
            <h2 className="text-2xl font-semibold text-teal-700">Password Reset Successful</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your password has been updated successfully. Redirecting to Sign In...
            </p>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full w-full animate-pulse bg-teal-600" />
            </div>
            <Link to="/login" className="mt-4 inline-block text-sm font-semibold text-teal-600 underline">
              Go to Sign In now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
      <h1 className="text-2xl font-semibold text-teal-700 mb-2">Forgot Password?</h1>
      <p className="text-gray-600 text-sm mb-6">
        Enter your email to get an OTP. After that, enter the OTP below to reset your password.
      </p>

      {!otpSent ? (
        <form onSubmit={sendOtp} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="enter your email"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              disabled={loading}
            />
          </div>

          {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
          {message && <div className="text-green-600 text-sm bg-green-50 p-2 rounded">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400"
          >
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={resetPassword} className="space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            OTP sent to <strong>{email}</strong>. Check your email and enter the OTP below.
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">OTP (6-digit)</label>
            <input
              value={otp}
              onChange={e => setOtp(e.target.value.slice(0, 6))}
              placeholder="000000"
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
              disabled={resetLoading}
              maxLength="6"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="enter new password"
                className="w-full px-4 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                disabled={resetLoading}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-teal-600"
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                disabled={resetLoading}
              >
                {showNewPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="confirm new password"
                className="w-full px-4 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                disabled={resetLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-teal-600"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                disabled={resetLoading}
              >
                {showConfirmPassword ? '👁️' : '🙈'}
              </button>
            </div>
          </div>

          {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}
          {message && <div className="text-green-600 text-sm bg-green-50 p-2 rounded">{message}</div>}

          <button
            type="submit"
            disabled={resetLoading}
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400"
          >
            {resetLoading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
      )}

      <div className="mt-6 text-center text-sm text-gray-600">
        Remember your password? <Link to="/login" className="underline text-teal-600 font-semibold">Sign In</Link>
      </div>
    </div>
  )
}
