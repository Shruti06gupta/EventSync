import React, { useEffect, useState } from 'react';

export default function Toast({ notification, onClose, onClick }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for fade out animation
      }, 5000); // Disappear after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification && !visible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 transform transition-all duration-300 ease-in-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
      }`}
    >
      <div className="flex w-80 max-w-full overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex w-full items-center justify-between p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xl">
              🔔
            </span>
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-gray-900">
                {notification?.type === 'new_event' ? 'New Event' 
                 : notification?.type === 'deadline_reminder' ? 'Deadline Reminder'
                 : 'Notification'}
              </h3>
              <p className="mt-1 text-xs text-gray-500 line-clamp-2">
                {notification?.message}
              </p>
              <button
                type="button"
                onClick={() => {
                  setVisible(false);
                  setTimeout(() => onClick(notification), 300);
                }}
                className="mt-2 w-max rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 transition hover:bg-teal-100"
              >
                View Event
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 300);
            }}
            className="self-start rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <span className="sr-only">Close</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
