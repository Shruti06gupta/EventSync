import React from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import Events from './pages/Events'
import EventDetails from './pages/EventDetails'
import Bookmarks from './pages/Bookmarks'
import ManageEvents from './pages/ManageEvents'
import AdminDashboard from './pages/AdminDashboard'
import { AuthProvider } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import CenteredLayout from './components/CenteredLayout'
import Navbar from './components/Navbar'

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <div className="min-h-screen bg-brand-bg">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<CenteredLayout><Login /></CenteredLayout>} />
            <Route path="/register" element={<CenteredLayout><Register /></CenteredLayout>} />
            <Route path="/forgot-password" element={<CenteredLayout><ForgotPassword /></CenteredLayout>} />
            <Route path="/reset-password" element={<CenteredLayout><ResetPassword /></CenteredLayout>} />
            <Route path="/profile" element={<ProtectedRoute><CenteredLayout><Profile /></CenteredLayout></ProtectedRoute>} />
            <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
            <Route path="/events/:id" element={<ProtectedRoute><EventDetails /></ProtectedRoute>} />
            <Route path="/bookmarks" element={<ProtectedRoute><Bookmarks /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminDashboard /></AdminRoute></ProtectedRoute>} />
            <Route path="/manage" element={<ProtectedRoute><AdminRoute><ManageEvents /></AdminRoute></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </NotificationsProvider>
    </AuthProvider>
  )
}
