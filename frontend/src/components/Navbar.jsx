import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <nav className="w-full bg-white shadow-sm p-4 flex justify-between items-center">
      <div className="text-xl font-bold text-teal-600">EventSync</div>
      <div className="flex items-center space-x-6">
        {user ? (
          <>
            <Link to="/events" className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition duration-150">Events</Link>
            {user.role === 'student' && (
              <Link to="/bookmarks" className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition duration-150">Bookmarks</Link>
            )}
            {user.role === 'admin' && (
              <Link to="/manage" className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition duration-150">Manage Events</Link>
            )}
            <Link to="/profile" className="text-sm font-semibold text-gray-700 hover:text-teal-600 transition duration-150">Profile</Link>
            <button
              onClick={logout}
              className="text-sm font-semibold text-rose-500 hover:text-rose-600 transition duration-150 ml-2"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-sm font-semibold text-teal-600 hover:text-teal-700 transition duration-150">Login</Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl transition duration-150 shadow-sm"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
