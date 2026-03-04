'use client'

import { useState, useEffect, useCallback } from 'react'

interface TeamMember {
  id: string
  firstName: string
  lastName: string
  role: string
  bio: string
  type: 'founder' | 'fund_advisor' | 'stewardship_advisor'
  order: number
  imageUrl: string
  linkedinUrl: string
  createdAt: string
  updatedAt: string
}

type MemberType = TeamMember['type']

interface FormData {
  firstName: string
  lastName: string
  role: string
  bio: string
  type: MemberType
  order: number
  imageUrl: string
  linkedinUrl: string
}

const EMPTY_FORM: FormData = {
  firstName: '',
  lastName: '',
  role: '',
  bio: '',
  type: 'fund_advisor',
  order: 0,
  imageUrl: '',
  linkedinUrl: '',
}

const TYPE_LABELS: Record<MemberType, string> = {
  founder: 'Founder',
  fund_advisor: 'Fund Advisors',
  stewardship_advisor: 'Stewardship Advisors',
}

const TYPE_ORDER: MemberType[] = ['founder', 'fund_advisor', 'stewardship_advisor']

function groupByType(members: TeamMember[]): Record<MemberType, TeamMember[]> {
  const groups: Record<MemberType, TeamMember[]> = {
    founder: [],
    fund_advisor: [],
    stewardship_advisor: [],
  }
  for (const m of members) {
    if (groups[m.type]) {
      groups[m.type].push(m)
    }
  }
  // Sort within each group by order
  for (const key of TYPE_ORDER) {
    groups[key].sort((a, b) => a.order - b.order)
  }
  return groups
}

export default function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team')
      if (res.ok) {
        const data = await res.json()
        setMembers(data)
      } else {
        setError('Failed to load team members')
      }
    } catch {
      setError('Failed to load team members')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  // Auto-dismiss success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openAddForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setError(null)
  }

  function openEditForm(member: TeamMember) {
    setEditingId(member.id)
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      role: member.role,
      bio: member.bio,
      type: member.type,
      order: member.order,
      imageUrl: member.imageUrl,
      linkedinUrl: member.linkedinUrl,
    })
    setShowForm(true)
    setError(null)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError('First name and last name are required')
      return
    }

    if (!form.role.trim()) {
      setError('Role is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const url = editingId ? `/api/team/${editingId}` : '/api/team'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (res.ok) {
        const saved = await res.json()
        if (editingId) {
          setMembers((prev) => prev.map((m) => (m.id === editingId ? saved : m)))
          setSuccess('Team member updated successfully')
        } else {
          setMembers((prev) => [...prev, saved])
          setSuccess('Team member added successfully')
        }
        closeForm()
      } else {
        const data = await res.json()
        setError(data.error || `Failed to ${editingId ? 'update' : 'create'} team member`)
      }
    } catch {
      setError(`Failed to ${editingId ? 'update' : 'create'} team member`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/team/${id}`, { method: 'DELETE' })

      if (res.ok) {
        setMembers((prev) => prev.filter((m) => m.id !== id))
        setSuccess('Team member deleted')
        if (editingId === id) closeForm()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete team member')
      }
    } catch {
      setError('Failed to delete team member')
    } finally {
      setDeleting(false)
      setDeleteConfirmId(null)
    }
  }

  const grouped = groupByType(members)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage founders, fund advisors, and stewardship advisors
          </p>
        </div>
        <button
          onClick={openAddForm}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          Add Member
        </button>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Error message */}
      {error && !showForm && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Add/Edit form panel */}
      {showForm && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Edit Team Member' : 'Add Team Member'}
            </h2>
            <button
              onClick={closeForm}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close form"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Inline error for form */}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-2 font-medium underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  First Name *
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={form.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  required
                  placeholder="e.g. Pascal"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Last Name *
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  required
                  placeholder="e.g. Zuta"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label
                htmlFor="role"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Role *
              </label>
              <input
                id="role"
                type="text"
                value={form.role}
                onChange={(e) => updateField('role', e.target.value)}
                required
                placeholder="e.g. Founder & CIO"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Bio */}
            <div>
              <label
                htmlFor="bio"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Bio
              </label>
              <textarea
                id="bio"
                value={form.bio}
                onChange={(e) => updateField('bio', e.target.value)}
                rows={6}
                placeholder="Brief biography..."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Type and Order row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="type"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Type
                </label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => updateField('type', e.target.value as MemberType)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="order"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Display Order
                </label>
                <input
                  id="order"
                  type="number"
                  value={form.order}
                  onChange={(e) => updateField('order', parseInt(e.target.value) || 0)}
                  min={0}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Image URL with preview */}
            <div>
              <label
                htmlFor="imageUrl"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Profile Image URL
              </label>
              <input
                id="imageUrl"
                type="text"
                value={form.imageUrl}
                onChange={(e) => updateField('imageUrl', e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {form.imageUrl && (
                <div className="mt-2">
                  <img
                    src={form.imageUrl}
                    alt="Profile preview"
                    className="h-20 w-20 rounded-full border border-gray-200 object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                    onLoad={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'block'
                    }}
                  />
                </div>
              )}
            </div>

            {/* LinkedIn URL */}
            <div>
              <label
                htmlFor="linkedinUrl"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                LinkedIn URL
              </label>
              <input
                id="linkedinUrl"
                type="text"
                value={form.linkedinUrl}
                onChange={(e) => updateField('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/username"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? 'Saving...'
                  : editingId
                    ? 'Save Changes'
                    : 'Add Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
        </div>
      ) : members.length === 0 ? (
        /* Empty state */
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No team members
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first team member.
          </p>
          {!showForm && (
            <div className="mt-4">
              <button
                onClick={openAddForm}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Add Member
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Grouped member list */
        <div className="space-y-8">
          {TYPE_ORDER.map((type) => {
            const group = grouped[type]
            if (group.length === 0) return null

            return (
              <section key={type}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {TYPE_LABELS[type]}
                  </h2>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {group.length}
                  </span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>

                <div className="space-y-3">
                  {group.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                      <div className="flex items-center gap-4">
                        {/* Photo thumbnail */}
                        {member.imageUrl ? (
                          <img
                            src={member.imageUrl}
                            alt={`${member.firstName} ${member.lastName}`}
                            className="h-12 w-12 flex-shrink-0 rounded-full border border-gray-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                            <svg
                              className="h-6 w-6"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                              />
                            </svg>
                          </div>
                        )}

                        {/* Name and role */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {member.firstName} {member.lastName}
                            </p>
                            {member.linkedinUrl && (
                              <a
                                href={member.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-600"
                                title="LinkedIn profile"
                              >
                                <svg
                                  className="h-4 w-4"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                                </svg>
                              </a>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{member.role}</p>
                          {member.bio && (
                            <p className="mt-1 line-clamp-2 text-xs text-gray-400">
                              {member.bio}
                            </p>
                          )}
                        </div>

                        {/* Order badge */}
                        <span className="flex-shrink-0 text-xs text-gray-400">
                          Order: {member.order}
                        </span>

                        {/* Action buttons */}
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <button
                            onClick={() => openEditForm(member)}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(member.id)}
                            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 transition-opacity"
            onClick={() => setDeleteConfirmId(null)}
          />

          {/* Dialog */}
          <div className="relative z-10 mx-4 w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-5 w-5 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Delete Team Member
                </h3>
                <p className="text-sm text-gray-500">
                  Are you sure? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
