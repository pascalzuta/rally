'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface DashboardStats {
  teamMembers: number | null
  newsPosts: number | null
  newsPublished: number | null
  newsDraft: number | null
  mediaFiles: number | null
  linkedInPosts: number | null
  contentPages: number | null
}

const initialStats: DashboardStats = {
  teamMembers: null,
  newsPosts: null,
  newsPublished: null,
  newsDraft: null,
  mediaFiles: null,
  linkedInPosts: null,
  contentPages: null,
}

const quickLinks = [
  {
    label: 'Edit Home Page',
    href: '/admin/pages/home',
    description: 'Update hero, content, and layout',
    color: 'bg-blue-50 text-blue-700 hover:bg-blue-100',
  },
  {
    label: 'Manage Team',
    href: '/admin/team',
    description: 'Add or edit team members',
    color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  },
  {
    label: 'Write Post',
    href: '/admin/news',
    description: 'Create a new news article',
    color: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
  },
  {
    label: 'Upload Media',
    href: '/admin/media',
    description: 'Add images and files',
    color: 'bg-amber-50 text-amber-700 hover:bg-amber-100',
  },
]

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(initialStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setStats({
            teamMembers: data.teamMembers ?? null,
            newsPosts: data.newsPosts ?? null,
            newsPublished: data.newsPublished ?? null,
            newsDraft: data.newsDraft ?? null,
            mediaFiles: data.mediaFiles ?? null,
            linkedInPosts: data.linkedInPosts ?? null,
            contentPages: data.contentPages ?? null,
          })
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Green Room Partners CMS
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage website content, team members, and news.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Content Areas"
          value={stats.contentPages !== null ? `${stats.contentPages} Pages` : null}
          sublabel="Site pages"
          loading={loading}
        />
        <StatCard
          label="Team Members"
          value={stats.teamMembers}
          loading={loading}
        />
        <StatCard
          label="News Posts"
          value={stats.newsPosts}
          sublabel={
            stats.newsPublished !== null && stats.newsDraft !== null
              ? `${stats.newsPublished} published, ${stats.newsDraft} draft`
              : undefined
          }
          loading={loading}
        />
        <StatCard
          label="Media Files"
          value={stats.mediaFiles}
          loading={loading}
        />
        <StatCard
          label="LinkedIn Posts"
          value={stats.linkedInPosts}
          loading={loading}
        />
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Quick Links
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg border border-gray-200 p-5 transition-colors ${link.color}`}
            >
              <p className="text-sm font-semibold">{link.label}</p>
              <p className="mt-1 text-xs opacity-75">{link.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- Stat card component ---------- */

function StatCard({
  label,
  value,
  sublabel,
  loading,
}: {
  label: string
  value: number | string | null
  sublabel?: string
  loading: boolean
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-gray-900">
          {value ?? '—'}
        </p>
      )}
      {sublabel && !loading && (
        <p className="mt-1 text-xs text-gray-400">{sublabel}</p>
      )}
    </div>
  )
}
