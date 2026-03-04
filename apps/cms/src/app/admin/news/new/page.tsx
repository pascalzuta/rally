'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface PageContent {
  heading: string
  body: string
}

export default function NewNewsPostPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [author, setAuthor] = useState('Green Room Partners')
  const [publishedAt, setPublishedAt] = useState(() => {
    const now = new Date()
    return now.toISOString().slice(0, 10)
  })
  const [monthKey, setMonthKey] = useState('')
  const [summary, setSummary] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')

  const [pages, setPages] = useState<PageContent[]>([
    { heading: '', body: '' },
    { heading: '', body: '' },
    { heading: '', body: '' },
  ])
  const [activePage, setActivePage] = useState(0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track initial values for dirty detection
  const initialValues = useRef({
    title: '',
    slug: '',
    author: 'Green Room Partners',
    publishedAt: new Date().toISOString().slice(0, 10),
    monthKey: '',
    summary: '',
    tagsInput: '',
    status: 'draft' as const,
    pages: [
      { heading: '', body: '' },
      { heading: '', body: '' },
      { heading: '', body: '' },
    ],
  })

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const init = initialValues.current
      const isDirty =
        title !== init.title ||
        slug !== init.slug ||
        author !== init.author ||
        summary !== init.summary ||
        tagsInput !== init.tagsInput ||
        monthKey !== init.monthKey ||
        status !== init.status ||
        pages.some(
          (p, i) =>
            p.heading !== init.pages[i].heading ||
            p.body !== init.pages[i].body
        )

      if (isDirty) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [title, slug, author, summary, tagsInput, monthKey, status, pages])

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!slugManuallyEdited) {
      setSlug(slugify(value))
    }
  }

  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true)
    setSlug(value)
  }

  function updatePage(index: number, field: keyof PageContent, value: string) {
    setPages((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    const body = {
      title,
      slug,
      author,
      publishedAt: new Date(publishedAt).toISOString(),
      monthKey,
      summary,
      tags,
      status,
      pages: pages.map((p) => ({ heading: p.heading, body: p.body })),
    }

    try {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        router.push('/admin/news')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create post')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/news"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to News
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Post</h1>
        <p className="mt-1 text-sm text-gray-500">Fill in the details below to create a new news post.</p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Post details card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Post Details</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Title */}
              <div className="sm:col-span-2">
                <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Enter post title"
                />
              </div>

              {/* Slug */}
              <div className="sm:col-span-2">
                <label htmlFor="slug" className="mb-1 block text-sm font-medium text-gray-700">
                  Slug <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">/news/</span>
                  <input
                    id="slug"
                    type="text"
                    value={slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    required
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="post-slug"
                  />
                </div>
                {slugManuallyEdited && (
                  <button
                    type="button"
                    onClick={() => {
                      setSlugManuallyEdited(false)
                      setSlug(slugify(title))
                    }}
                    className="mt-1 text-xs text-blue-600 hover:text-blue-800"
                  >
                    Auto-generate from title
                  </button>
                )}
              </div>

              {/* Author */}
              <div>
                <label htmlFor="author" className="mb-1 block text-sm font-medium text-gray-700">
                  Author
                </label>
                <input
                  id="author"
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Author name"
                />
              </div>

              {/* Publish date */}
              <div>
                <label htmlFor="publishedAt" className="mb-1 block text-sm font-medium text-gray-700">
                  Publish Date
                </label>
                <input
                  id="publishedAt"
                  type="date"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Month key */}
              <div>
                <label htmlFor="monthKey" className="mb-1 block text-sm font-medium text-gray-700">
                  Month Key
                </label>
                <input
                  id="monthKey"
                  type="text"
                  value={monthKey}
                  onChange={(e) => setMonthKey(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. 2026-03"
                />
              </div>

              {/* Status */}
              <div>
                <label htmlFor="status" className="mb-1 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              {/* Summary */}
              <div className="sm:col-span-2">
                <label htmlFor="summary" className="mb-1 block text-sm font-medium text-gray-700">
                  Summary
                </label>
                <textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Brief summary of the post"
                />
              </div>

              {/* Tags */}
              <div className="sm:col-span-2">
                <label htmlFor="tags" className="mb-1 block text-sm font-medium text-gray-700">
                  Tags
                </label>
                <input
                  id="tags"
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Separate tags with commas, e.g. ESG, Sustainability, Impact"
                />
                {tagsInput && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tagsInput
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content pages card */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Content Pages</h2>

            {/* Page tabs */}
            <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
              {pages.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePage(idx)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    activePage === idx
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Page {idx + 1}
                  {pages[idx].heading || pages[idx].body ? (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
                  ) : null}
                </button>
              ))}
            </div>

            {/* Active page editor */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor={`page-heading-${activePage}`}
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Heading
                </label>
                <input
                  id={`page-heading-${activePage}`}
                  type="text"
                  value={pages[activePage].heading}
                  onChange={(e) => updatePage(activePage, 'heading', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder={`Page ${activePage + 1} heading`}
                />
              </div>
              <div>
                <label
                  htmlFor={`page-body-${activePage}`}
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Body
                </label>
                <textarea
                  id={`page-body-${activePage}`}
                  value={pages[activePage].body}
                  onChange={(e) => updatePage(activePage, 'body', e.target.value)}
                  rows={12}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  placeholder="Write page content here. Separate paragraphs with blank lines."
                />
                <p className="mt-1 text-xs text-gray-400">
                  Separate paragraphs with blank lines (double newline).
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <Link
              href="/admin/news"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !title.trim() || !slug.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                'Create Post'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
