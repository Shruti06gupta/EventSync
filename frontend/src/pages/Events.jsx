import React from 'react'

const sampleEvents = [
  {
    title: 'Campus Tech Talk',
    time: 'Today, 4:00 PM',
    location: 'Auditorium A',
  },
  {
    title: 'Design Workshop',
    time: 'Friday, 2:30 PM',
    location: 'Lab 3',
  },
  {
    title: 'Career Meetup',
    time: 'Saturday, 11:00 AM',
    location: 'Main Hall',
  },
]

export default function Events() {
  return (
    <div className="w-full max-w-4xl p-8 rounded-2xl glass shadow-lg">
      <h1 className="text-2xl font-semibold text-teal-700 mb-2">Events</h1>
      <p className="text-gray-600 mb-6">Browse upcoming events and announcements.</p>
      <div className="grid gap-4 md:grid-cols-3">
        {sampleEvents.map((event) => (
          <article key={event.title} className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900">{event.title}</h2>
            <p className="mt-2 text-sm text-gray-600">{event.time}</p>
            <p className="text-sm text-gray-600">{event.location}</p>
          </article>
        ))}
      </div>
    </div>
  )
}