import { useCallback, useEffect, useState } from 'react'
import api from '../api'

export default function useBookmarks() {
  const [bookmarkIds, setBookmarkIds] = useState([])
  const [loading, setLoading] = useState(true)

  const loadBookmarkIds = useCallback(async () => {
    try {
      const res = await api.get('/user/bookmarks/ids')
      setBookmarkIds(res.data.bookmarkIds || [])
    } catch {
      setBookmarkIds([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBookmarkIds()
  }, [loadBookmarkIds])

  const isBookmarked = useCallback(
    (eventId) => bookmarkIds.includes(String(eventId)),
    [bookmarkIds]
  )

  const toggleBookmark = async (eventId) => {
    const id = String(eventId)
    const saved = isBookmarked(id)

    try {
      if (saved) {
        const res = await api.delete(`/user/bookmarks/${id}`)
        setBookmarkIds(res.data.bookmarkIds || [])
      } else {
        const res = await api.post(`/user/bookmarks/${id}`)
        setBookmarkIds(res.data.bookmarkIds || [])
      }
      return !saved
    } catch (err) {
      throw err
    }
  }

  return {
    bookmarkIds,
    loading,
    isBookmarked,
    toggleBookmark,
    refreshBookmarks: loadBookmarkIds,
  }
}
