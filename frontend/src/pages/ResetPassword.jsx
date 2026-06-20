import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api'

export default function ResetPassword() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!email || !otp || !newPassword || !confirmPassword) {
      setError('All fields are required')
      return
    }

    if (!emailRegex.test(email)) {
      setError('Please enter a valid email')
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

    setLoading(true)
    try {
      const res = await api.post('/auth/reset-password', { email, otp, newPassword })
      setSuccess(true)
      setTimeout(() => {
        navigate('/login')
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password')
    } finally { setLoading(false) }
  }

  if (success) {
    return (
      <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
        <div className="text-center">
          <div className="text-5xl text-green-600 mb-4">✓</div>
          <h1 className="text-2xl font-semibold text-teal-700 mb-2">Password Reset Successful!</h1>
          <p className="text-gray-600 mb-6">Your password has been reset. Redirecting to login...</p>
          <Link to="/login" className="text-teal-600 underline font-semibold">Click here if not redirected</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
      <h1 className="text-2xl font-semibold text-teal-700 mb-2">Reset Password</h1>
      <p className="text-gray-600 text-sm mb-6">Enter the OTP sent to your email and choose a new password.</p>

      <form onSubmit={submit} className="space-y-4">
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

        <div>
          <label className="block text-sm text-gray-600 mb-2">OTP (6-digit)</label>
          <input 
            value={otp} 
            onChange={e => setOtp(e.target.value.slice(0, 6))} 
            placeholder="000000" 
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
            disabled={loading}
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
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(prev => !prev)}
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-teal-600"
              aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
              disabled={loading}
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
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(prev => !prev)}
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-teal-600"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              disabled={loading}
            >
              {showConfirmPassword ? '👁️' : '🙈'}
            </button>
          </div>
        </div>

        {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

        <button 
          type="submit"
          disabled={loading} 
          className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400"
        >
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Back to <Link to="/login" className="underline text-teal-600 font-semibold">Sign In</Link>
      </div>
    </div>
  )
}
