import React from 'react'
import { useAuth } from '../context/AuthContext'
import AdminProfile from './AdminProfile'
import UserProfile from './UserProfile'

export default function Profile() {
  const { user } = useAuth()

  if (user?.role === 'admin') {
    return <AdminProfile />
  }

  return <UserProfile />
}
