import React, { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import BookmarkButton from '../components/BookmarkButton'
import useBookmarks from '../hooks/useBookmarks'
import { getEventImage } from '../utils/imageHelper'

const formatDate = (value) =>
  new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value))

export default function EventDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { isBookmarked, toggleBookmark } = useBookmarks()

  useEffect(() => {
    const loadEvent = async () => {
      try {
        setLoading(true)
        setError('')
        const res = await api.get(`/events/${id}`)
        setEvent(res.data.event)
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load this event.')
      } finally {
        setLoading(false)
      }
    }

    loadEvent()
  }, [id])

  if (loading) {
    return <div className="w-full max-w-4xl rounded-3xl bg-white p-8 text-center shadow-lg">Loading event...</div>
  }

  if (error) {
    return (
      <div className="w-full max-w-4xl rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-red-700 shadow-sm">
        <p>{error}</p>
        <Link to="/events" className="mt-4 inline-block rounded-xl bg-gray-900 px-4 py-2 text-white">
          Back to events
        </Link>
      </div>
    )
  }

  const renderDeadlineBanner = () => {
    if (!event || !event.registrationDeadline) return null;
    const now = new Date();
    const deadline = new Date(event.registrationDeadline);
    const timeToDeadline = deadline.getTime() - now.getTime();
    
    if (timeToDeadline < 0) return null;
    if (timeToDeadline <= 3 * 60 * 60 * 1000) {
      return (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-2xl">
          <div className="flex">
            <div className="flex-shrink-0"><span className="text-xl">🚨</span></div>
            <div className="ml-3">
              <p className="text-sm text-red-700 font-bold">Last 3 hours remaining!</p>
              <p className="text-xs text-red-600 mt-1">Hurry up, registration is closing very soon.</p>
            </div>
          </div>
        </div>
      );
    }
    if (timeToDeadline <= 24 * 60 * 60 * 1000) {
      return (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 rounded-r-2xl">
          <div className="flex">
            <div className="flex-shrink-0"><span className="text-xl">⚠</span></div>
            <div className="ml-3">
              <p className="text-sm text-orange-700 font-bold">Registration closes tomorrow!</p>
            </div>
          </div>
        </div>
      );
    }
    if (timeToDeadline <= 48 * 60 * 60 * 1000) {
      return (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6 rounded-r-2xl">
          <div className="flex">
            <div className="flex-shrink-0"><span className="text-xl">⏰</span></div>
            <div className="ml-3">
              <p className="text-sm text-amber-700 font-bold">Registration closes in 48 hours.</p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl">
      <img
        src={getEventImage(event.image, event.title, event.organizer, event.category, event.source)}
        alt={event.title}
        className="h-72 w-full object-cover shrink-0"
      />

      <div className="p-8">
        {renderDeadlineBanner()}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-teal-600">Event details</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{event.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BookmarkButton
              eventId={event._id}
              isBookmarked={isBookmarked(event._id)}
              onToggle={toggleBookmark}
            />
            <button
              onClick={() => navigate(-1)}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 transition"
            >
              Back
            </button>
          </div>
        </div>

        <p className="mt-5 text-gray-600">{event.description}</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoCard label="Organizer" value={event.organizer} />
          <InfoCard label="College" value={event.college} />
          <InfoCard label="Category" value={event.category} />
          <InfoCard label="Mode" value={event.mode} />
          <InfoCard label="Venue" value={event.venue || 'Online'} />
          <InfoCard label="Deadline" value={formatDate(event.registrationDeadline)} />
          <InfoCard label="Starts" value={formatDate(event.startDate)} />
          <InfoCard label="Ends" value={formatDate(event.endDate)} />
          <InfoCard label="Verified" value={event.isVerified ? 'Yes' : 'No'} />
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {event.tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 pt-6 border-t border-gray-100">
          {(() => {
            const isDeadlinePassed = new Date(event.registrationDeadline) < new Date();
            if (isDeadlinePassed) {
              return (
                <button
                  disabled
                  className="rounded-xl bg-gray-50 border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-400 cursor-not-allowed"
                >
                  Registration Closed
                </button>
              );
            }
            if (!event.eventLink) {
              return (
                <button
                  disabled
                  className="rounded-xl bg-gray-50 border border-gray-200 px-6 py-3 text-sm font-semibold text-gray-400 cursor-not-allowed"
                >
                  Link Not Available
                </button>
              );
            }
            return (
              <a
                href={event.eventLink}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 hover:shadow-md active:scale-95 transform duration-150 text-center"
              >
                Register Now
              </a>
            );
          })()}
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-750 hover:bg-gray-50 hover:border-gray-400 transition duration-150"
          >
            Back
          </button>
          <Link to="/events" className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition duration-150">
            Explore more events
          </Link>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  )
}