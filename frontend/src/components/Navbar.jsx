import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="w-full bg-white shadow-sm p-4 flex justify-between items-center">
      <div className="text-xl font-bold text-teal-600">EventSync</div>
      <div className="space-x-4">
        <Link to="/" className="text-gray-700">Home</Link>
        <Link to="/events" className="text-gray-700">Events</Link>
        {user?.role === 'student' && <Link to="/bookmarks" className="text-gray-700">Bookmarks</Link>}
        {user?.role === 'admin' && <Link to="/manage" className="text-gray-700">Manage Events</Link>}
        <Link to="/profile" className="text-gray-700">Profile</Link>
        {user ? (
          <button onClick={logout} className="ml-2 text-red-500">Logout</button>
        ) : (
          <Link to="/login" className="text-teal-600">Login</Link>
        )}
      </div>
    </nav>
  )
}
