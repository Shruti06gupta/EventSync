import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/profile'

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const data = await login(email, password)
      const destination = data.user?.role === 'admin' && from === '/profile' ? '/admin' : from
      navigate(destination, { replace: true })
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
      <h1 className="text-2xl font-semibold text-teal-700 mb-6">Welcome back!</h1>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600">Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full px-4 py-3 rounded-lg border focus:outline-none" placeholder="enter your email" />
        </div>

        <div>
          <label className="block text-sm text-gray-600">Password</label>
          <div className="relative mt-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 pr-12 rounded-lg border focus:outline-none"
              placeholder="password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-teal-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '👁️' : '🙈'}
            </button>
          </div>
        </div>

        {error && <div className="text-red-500 text-sm">{error}</div>}

        <button type="submit" disabled={loading} className="w-full bg-teal-600 text-white py-3 rounded-lg mt-2">
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-4 text-center text-sm text-gray-600">
        <div className="mb-2">
          <Link to="/forgot-password" className="underline text-teal-600">Forgot your password?</Link>
        </div>
        <div>Don't have an account? <Link to="/register" className="underline text-teal-600">Sign Up</Link></div>
      </div>
    </div>
  )
}
