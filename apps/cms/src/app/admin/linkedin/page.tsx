'use client'

import { useState, useEffect, useCallback } from 'react'

interface LinkedInPost {
  id: string
  embedHtml: string
  caption: string
  postDate: string
  active: boolean
  order: number
  createdAt: string
  updatedAt: string
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function toInputDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toISOString().split('T')[0]
}

export default function LinkedInPostsPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New post form
  const [showForm, setShowForm] = useState(false)
  const [newEmbedHtml, setNewEmbedHtml] = useState('')
  const [newCaption, setNewCaption] = useState('')
  const [newPostDate, setNewPostDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [newActive, setNewActive] = useState(true)
  const [newOrder, setNewOrder] = useState(0)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEmbedHtml, setEditEmbedHtml] = useState('')
  const [editCaption, setEditCaption] = useState('')
  const [editPostDate, setEditPostDate] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editOrder, setEditOrder] = useState(0)

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch('/api/linkedin-posts')
      if (res.ok) {
        const data = await res.json()
        setPosts(data)
      }
    } catch {
      setError('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmbedHtml.trim()) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/linkedin-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedHtml: newEmbedHtml,
          caption: newCaption,
          postDate: newPostDate,
          active: newActive,
          order: newOrder,
        }),
      })

      if (res.ok) {
        const post = await res.json()
        setPosts((prev) => [...prev, post])
        setNewEmbedHtml('')
        setNewCaption('')
        setNewPostDate(new Date().toISOString().split('T')[0])
        setNewActive(true)
        setNewOrder(0)
        setShowForm(false)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create post')
      }
    } catch {
      setError('Failed to create post')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (post: LinkedInPost) => {
    setEditingId(post.id)
    setEditEmbedHtml(post.embedHtml)
    setEditCaption(post.caption)
    setEditPostDate(toInputDate(post.postDate))
    setEditActive(post.active)
    setEditOrder(post.order)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const handleUpdate = async (id: string) => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/linkedin-posts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embedHtml: editEmbedHtml,
          caption: editCaption,
          postDate: editPostDate,
          active: editActive,
          order: editOrder,
        }),
      })

      if (res.ok) {
        const updated = await res.json()
        setPosts((prev) => prev.map((p) => (p.id === id ? updated : p)))
        setEditingId(null)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to update post')
      }
    } catch {
      setError('Failed to update post')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return

    try {
      const res = await fetch(`/api/linkedin-posts/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id))
        if (editingId === id) setEditingId(null)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete post')
      }
    } catch {
      setError('Failed to delete post')
    }
  }

  const handleToggleActive = async (post: LinkedInPost) => {
    try {
      const res = await fetch(`/api/linkedin-posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !post.active }),
      })

      if (res.ok) {
        const updated = await res.json()
        setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)))
      }
    } catch {
      setError('Failed to toggle post')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">LinkedIn Posts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : 'Add Post'}
        </button>
      </div>

      {/* Error message */}
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

      {/* Add form */}
      {showForm && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Add LinkedIn Post
          </h2>

          <div className="mb-4 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
            Paste the LinkedIn post URL (e.g.,
            https://www.linkedin.com/posts/...) or the full embed code from
            LinkedIn&apos;s share menu.
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label
                htmlFor="new-embed"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Embed HTML / URL *
              </label>
              <textarea
                id="new-embed"
                value={newEmbedHtml}
                onChange={(e) => setNewEmbedHtml(e.target.value)}
                rows={4}
                required
                placeholder="https://www.linkedin.com/posts/... or paste embed HTML"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="new-caption"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Caption
              </label>
              <input
                id="new-caption"
                type="text"
                value={newCaption}
                onChange={(e) => setNewCaption(e.target.value)}
                placeholder="Optional caption"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="new-date"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Post Date
                </label>
                <input
                  id="new-date"
                  type="date"
                  value={newPostDate}
                  onChange={(e) => setNewPostDate(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="new-order"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Order
                </label>
                <input
                  id="new-order"
                  type="number"
                  value={newOrder}
                  onChange={(e) => setNewOrder(parseInt(e.target.value) || 0)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newActive}
                    onChange={(e) => setNewActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Active
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !newEmbedHtml.trim()}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Posts list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">
          Loading posts...
        </div>
      ) : posts.length === 0 ? (
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
              d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No LinkedIn posts
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding a LinkedIn post embed.
          </p>
          {!showForm && (
            <div className="mt-4">
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
              >
                Add Post
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) =>
            editingId === post.id ? (
              /* Inline edit form */
              <div
                key={post.id}
                className="rounded-lg border border-blue-300 bg-white p-5 shadow-sm ring-1 ring-blue-100"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Editing Post
                  </h3>
                  <button
                    onClick={cancelEdit}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor={`edit-embed-${post.id}`}
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Embed HTML / URL
                    </label>
                    <textarea
                      id={`edit-embed-${post.id}`}
                      value={editEmbedHtml}
                      onChange={(e) => setEditEmbedHtml(e.target.value)}
                      rows={3}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor={`edit-caption-${post.id}`}
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      Caption
                    </label>
                    <input
                      id={`edit-caption-${post.id}`}
                      type="text"
                      value={editCaption}
                      onChange={(e) => setEditCaption(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label
                        htmlFor={`edit-date-${post.id}`}
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Post Date
                      </label>
                      <input
                        id={`edit-date-${post.id}`}
                        type="date"
                        value={editPostDate}
                        onChange={(e) => setEditPostDate(e.target.value)}
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`edit-order-${post.id}`}
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        Order
                      </label>
                      <input
                        id={`edit-order-${post.id}`}
                        type="number"
                        value={editOrder}
                        onChange={(e) =>
                          setEditOrder(parseInt(e.target.value) || 0)
                        }
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-end">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Active
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdate(post.id)}
                      disabled={saving}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Post card */
              <div
                key={post.id}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          post.active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {post.active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs text-gray-400">
                        Order: {post.order}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {post.caption ||
                        post.embedHtml.substring(0, 50) +
                          (post.embedHtml.length > 50 ? '...' : '')}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(post.postDate)}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(post)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                        post.active
                          ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          : 'border-green-300 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {post.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => startEdit(post)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Preview of embed */}
                <div className="mt-3 rounded-md bg-gray-50 px-3 py-2">
                  <p className="truncate font-mono text-xs text-gray-500">
                    {post.embedHtml}
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
