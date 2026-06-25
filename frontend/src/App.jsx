import React from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import Events from './pages/Events'
import EventDetails from './pages/EventDetails'
import Bookmarks from './pages/Bookmarks'
import ManageEvents from './pages/ManageEvents'
import { AuthProvider } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <div className="flex items-center justify-center py-12">
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
              <Route path="/events/:id" element={<ProtectedRoute><EventDetails /></ProtectedRoute>} />
              <Route path="/bookmarks" element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
              <Route path="/manage" element={<ProtectedRoute><ManageEvents /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </NotificationsProvider>
    </AuthProvider>
  )
}
