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
    <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
      <h1 className="text-2xl font-semibold text-teal-700 mb-2">Forgot Password?</h1>
      <p className="text-gray-600 text-sm mb-6">
        Enter your email and we'll send you a link to reset your password.
      </p>

      <form onSubmit={sendResetLink} className="space-y-4">
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

        {sent && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            A password reset link has been sent to <strong>{email}</strong>. Redirecting to Sign In...
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400"
        >
          {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Remember your password? <Link to="/login" className="underline text-teal-600 font-semibold">Sign In</Link>
      </div>
    </div>
  )
}
