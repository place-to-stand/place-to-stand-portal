import type { ReactNode } from 'react'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-auto bg-background" style={{ height: '100vh' }}>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pts-logo-black-transparent.png"
            alt="Place To Stand"
            className="h-6 w-auto dark:hidden"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/pts-logo-white-transparent.png"
            alt="Place To Stand"
            className="hidden h-6 w-auto dark:block"
          />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  )
}
