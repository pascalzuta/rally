'use client'

import { useState, useEffect, useCallback } from 'react'
import ImageUpload, { type MediaAssetResponse } from '@/components/admin/ImageUpload'

interface MediaAsset {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  width: number | null
  height: number | null
  alt: string
  variants: Record<string, { jpg: string; webp: string }>
  createdAt: string
  usageCount: number
}

interface MediaDetail extends MediaAsset {
  usage: {
    heroPages: { id: string; title: string; slug: string }[]
    ogPages: { id: string; title: string; slug: string }[]
    galleryPages: { id: string; title: string; slug: string }[]
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getThumbnailUrl(asset: MediaAsset): string {
  const sm = asset.variants?.sm
  if (sm?.webp) return sm.webp
  if (sm?.jpg) return sm.jpg
  return `/uploads/${asset.filename}`
}

export default function MediaLibraryPage() {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MediaDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [altText, setAltText] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fetchAssets = useCallback(async () => {
    try {
      const res = await fetch('/api/media')
      if (res.ok) {
        const data = await res.json()
        setAssets(data)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const fetchDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/media/${id}`)
      if (res.ok) {
        const data: MediaDetail = await res.json()
        setDetail(data)
        setAltText(data.alt)
      }
    } catch {
      // silently fail
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      fetchDetail(selectedId)
    } else {
      setDetail(null)
    }
  }, [selectedId, fetchDetail])

  const handleUpload = useCallback(
    (asset: MediaAssetResponse) => {
      setAssets((prev) => [{ ...asset, usageCount: 0 }, ...prev])
    },
    []
  )

  const handleSaveAlt = async () => {
    if (!detail) return
    setSaving(true)
    try {
      const res = await fetch(`/api/media/${detail.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: altText }),
      })
      if (res.ok) {
        setDetail((prev) => (prev ? { ...prev, alt: altText } : prev))
        setAssets((prev) =>
          prev.map((a) => (a.id === detail.id ? { ...a, alt: altText } : a))
        )
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!detail) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/media/${detail.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== detail.id))
        setSelectedId(null)
      } else if (res.status === 409) {
        const body = await res.json()
        setDeleteError(body.error || 'Cannot delete: media is in use')
      } else {
        setDeleteError('Failed to delete media')
      }
    } catch {
      setDeleteError('Failed to delete media')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = search
    ? assets.filter((a) =>
        a.originalName.toLowerCase().includes(search.toLowerCase())
      )
    : assets

  return (
    <div className="flex h-full min-h-screen bg-gray-50">
      {/* Main content */}
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload and manage images for your pages
          </p>
        </div>

        {/* Upload zone */}
        <div className="mb-6">
          <ImageUpload onUpload={handleUpload} multiple />
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-20 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {search ? 'No images match your search' : 'No images uploaded'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {search
                ? 'Try a different search term'
                : 'Upload images using the area above'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setSelectedId(asset.id)}
                className={`group relative overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:shadow-md ${
                  selectedId === asset.id
                    ? 'border-blue-500 ring-2 ring-blue-500'
                    : 'border-gray-200'
                }`}
              >
                <div className="aspect-square overflow-hidden bg-gray-100">
                  <img
                    src={getThumbnailUrl(asset)}
                    alt={asset.alt || asset.originalName}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium text-gray-700">
                    {asset.originalName}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      {asset.width && asset.height
                        ? `${asset.width}x${asset.height}`
                        : 'Unknown'}
                    </span>
                    <span>{formatSize(asset.size)}</span>
                  </div>
                </div>
                {asset.usageCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {asset.usageCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Side panel for detail */}
      {selectedId && (
        <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Image Details
            </h2>
            <button
              onClick={() => setSelectedId(null)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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

          {detailLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />
            </div>
          ) : detail ? (
            <div className="space-y-4 p-4">
              {/* Preview */}
              <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                <img
                  src={getThumbnailUrl(detail)}
                  alt={detail.alt || detail.originalName}
                  className="w-full object-contain"
                  style={{ maxHeight: 200 }}
                />
              </div>

              {/* Metadata */}
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium text-gray-500">Filename</span>
                  <p className="break-all text-gray-900">
                    {detail.originalName}
                  </p>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="font-medium text-gray-500">
                      Dimensions
                    </span>
                    <p className="text-gray-900">
                      {detail.width && detail.height
                        ? `${detail.width} x ${detail.height}`
                        : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Size</span>
                    <p className="text-gray-900">{formatSize(detail.size)}</p>
                  </div>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Type</span>
                  <p className="text-gray-900">{detail.mimeType}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500">Uploaded</span>
                  <p className="text-gray-900">
                    {new Date(detail.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Alt text */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Alt Text
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Describe the image..."
                    className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSaveAlt}
                    disabled={saving || altText === detail.alt}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? '...' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Usage */}
              <div>
                <h3 className="mb-1 text-sm font-medium text-gray-700">
                  Usage ({detail.usageCount} page
                  {detail.usageCount !== 1 ? 's' : ''})
                </h3>
                {detail.usageCount === 0 ? (
                  <p className="text-sm text-gray-500">Not used by any page</p>
                ) : (
                  <ul className="space-y-1">
                    {detail.usage.heroPages.map((p) => (
                      <li
                        key={`hero-${p.id}`}
                        className="text-sm text-gray-600"
                      >
                        <span className="mr-1 inline-block rounded bg-purple-100 px-1 py-0.5 text-[10px] font-medium text-purple-700">
                          Hero
                        </span>
                        {p.title}
                      </li>
                    ))}
                    {detail.usage.ogPages.map((p) => (
                      <li key={`og-${p.id}`} className="text-sm text-gray-600">
                        <span className="mr-1 inline-block rounded bg-orange-100 px-1 py-0.5 text-[10px] font-medium text-orange-700">
                          OG
                        </span>
                        {p.title}
                      </li>
                    ))}
                    {detail.usage.galleryPages.map((p) => (
                      <li
                        key={`gallery-${p.id}`}
                        className="text-sm text-gray-600"
                      >
                        <span className="mr-1 inline-block rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-700">
                          Gallery
                        </span>
                        {p.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Delete */}
              <div className="border-t border-gray-200 pt-4">
                {deleteError && (
                  <p className="mb-2 text-sm text-red-600">{deleteError}</p>
                )}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete Image'}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
