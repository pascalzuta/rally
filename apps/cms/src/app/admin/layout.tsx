'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'

/* ---------- Navigation structure ---------- */

interface NavItem {
  href: string
  label: string
  icon: React.FC<{ className?: string }>
}

const contentItems: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: GridIcon },
  { href: '/admin/pages/home', label: 'Home Page', icon: FileIcon },
  { href: '/admin/pages/structure', label: 'Structure', icon: FileIcon },
  { href: '/admin/pages/investment', label: 'Investment', icon: FileIcon },
  { href: '/admin/pages/sectors', label: 'Sectors', icon: FileIcon },
  { href: '/admin/pages/team-page', label: 'Team Page', icon: FileIcon },
  { href: '/admin/pages/contact', label: 'Contact', icon: FileIcon },
  { href: '/admin/pages/news-config', label: 'News Page', icon: FileIcon },
]

const manageItems: NavItem[] = [
  { href: '/admin/team', label: 'Team Members', icon: UsersIcon },
  { href: '/admin/news', label: 'News Posts', icon: NewspaperIcon },
  { href: '/admin/media', label: 'Media Library', icon: ImageIcon },
  { href: '/admin/linkedin', label: 'LinkedIn Posts', icon: ShareIcon },
]

const accountItems: NavItem[] = [
  { href: '/admin/change-password', label: 'Change Password', icon: KeyIcon },
]

/** Paths that render without the sidebar (clean, full-screen layouts). */
const noSidebarPaths = ['/admin/login', '/admin/change-password']

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  // Login and change-password pages get a clean centered layout
  if (noSidebarPaths.includes(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        {children}
      </div>
    )
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin'
    return pathname === href || pathname.startsWith(href + '/')
  }

  function renderNavItem(item: NavItem) {
    const active = isActive(item.href)
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          className={clsx(
            'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            active
              ? 'border-l-2 border-blue-400 bg-slate-800 text-white'
              : 'border-l-2 border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
          )}
        >
          <item.icon
            className={clsx(
              'h-5 w-5 flex-shrink-0',
              active ? 'text-blue-400' : 'text-slate-400'
            )}
          />
          {item.label}
        </Link>
      </li>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-slate-900 text-white">
        {/* Logo / title */}
        <div className="flex h-16 items-center px-5">
          <h1 className="text-lg font-bold tracking-tight text-white">
            GRP Admin
          </h1>
        </div>

        {/* Scrollable navigation */}
        <nav
          className="flex flex-1 flex-col overflow-y-auto px-3 pb-4"
          aria-label="Admin navigation"
        >
          {/* CONTENT section */}
          <p className="mb-2 mt-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Content
          </p>
          <ul className="space-y-0.5">
            {contentItems.map(renderNavItem)}
          </ul>

          {/* MANAGE section */}
          <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Manage
          </p>
          <ul className="space-y-0.5">
            {manageItems.map(renderNavItem)}
          </ul>

          {/* ACCOUNT section */}
          <p className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Account
          </p>
          <ul className="space-y-0.5">
            {accountItems.map(renderNavItem)}

            {/* Logout button */}
            <li>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <LogoutIcon className="h-5 w-5 flex-shrink-0 text-slate-400" />
                Logout
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto bg-white">
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}

/* ---------- Inline SVG icon components (20x20 viewBox) ---------- */

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 2h8l4 4v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v4h4" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="7" cy="6" r="3" />
      <path strokeLinecap="round" d="M1 17c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="14" cy="6" r="2.5" />
      <path strokeLinecap="round" d="M14 11c2.8 0 5 2.2 5 5" />
    </svg>
  )
}

function NewspaperIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="3" width="16" height="14" rx="1" />
      <path strokeLinecap="round" d="M5 7h5M5 10h10M5 13h10" />
    </svg>
  )
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <rect x="2" y="3" width="16" height="14" rx="1" />
      <circle cx="7" cy="8" r="1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 14l-4-4-3 3-2-2-6 6" />
    </svg>
  )
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="14" cy="4" r="2.5" />
      <circle cx="14" cy="16" r="2.5" />
      <circle cx="5" cy="10" r="2.5" />
      <path d="M7.2 8.8l5.1-3.6M7.2 11.2l5.1 3.6" />
    </svg>
  )
}

function KeyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <circle cx="7" cy="10" r="4" />
      <path strokeLinecap="round" d="M11 10h7m-2-2v4" />
    </svg>
  )
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 3h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3M8 15l-5-5 5-5M3 10h10" />
    </svg>
  )
}
