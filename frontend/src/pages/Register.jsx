import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [college, setCollege] = useState('')
  const [interests, setInterests] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { register, login } = useAuth()
  const navigate = useNavigate()

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

    setLoading(true)
    try {
      await register({ 
        name, 
        email, 
        password, 
        confirmPassword, 
        college,
        interests: interests ? interests.split(',').map(i => i.trim()) : []
      })
      await login(email, password)
      navigate('/profile')
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="w-full max-w-md p-8 rounded-2xl glass shadow-lg">
      <h1 className="text-2xl font-semibold text-teal-700 mb-6">Let's Get Started</h1>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Full Name</label>
          <input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600" 
            placeholder="enter your full name"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Email</label>
          <input 
            type="email"
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600" 
            placeholder="enter your email"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Password</label>
          <div className="relative">
            <input 
              type={showPassword ? 'text' : 'password'}
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="w-full px-4 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600" 
              placeholder="password (min 6 chars)"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-teal-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={loading}
            >
              {showPassword ? '👁️' : '🙈'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Confirm Password</label>
          <div className="relative">
            <input 
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              className="w-full px-4 py-2 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600" 
              placeholder="confirm password"
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

        <div>
          <label className="block text-sm text-gray-600 mb-1">College</label>
          <input 
            value={college} 
            onChange={e => setCollege(e.target.value)} 
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600" 
            placeholder="college name"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Interests (optional)</label>
          <input 
            value={interests} 
            onChange={e => setInterests(e.target.value)} 
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600" 
            placeholder="e.g., coding, design, marketing (comma separated)"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">Separate multiple interests with commas</p>
        </div>

        {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

        <button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 disabled:bg-gray-400 mt-4"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Already have an account? <Link to="/login" className="underline text-teal-600 font-semibold">Sign In</Link>
      </div>
    </div>
  )
}
