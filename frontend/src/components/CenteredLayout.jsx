import React from 'react'

export default function CenteredLayout({ children }) {
  return (
    <div className="flex w-full items-center justify-center px-4 py-12">
      {children}
    </div>
  )
}
