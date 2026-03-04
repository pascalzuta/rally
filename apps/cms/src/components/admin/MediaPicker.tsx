'use client'

import { useState, useEffect, useCallback } from 'react'
import ImageUpload, { type MediaAssetResponse } from './ImageUpload'

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

interface MediaPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (mediaId: string, mediaUrl: string) => void
}

function getThumbnailUrl(asset: MediaAsset): string {
  const sm = asset.variants?.sm
  if (sm?.webp) return sm.webp
  if (sm?.jpg) return sm.jpg
  return `/uploads/${asset.filename}`
}

function getMediumUrl(asset: MediaAsset): string {
  const md = asset.variants?.md
  if (md?.webp) return md.webp
  if (md?.jpg) return md.jpg
  return getThumbnailUrl(asset)
}

export default function MediaPicker({
  open,
  onClose,
  onSelect,
}: MediaPickerProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showUpload, setShowUpload] = useState(false)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
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
    if (open) {
      fetchAssets()
      setSearch('')
      setShowUpload(false)
    }
  }, [open, fetchAssets])

  const handleUpload = useCallback((asset: MediaAssetResponse) => {
    setAssets((prev) => [{ ...asset, usageCount: 0 }, ...prev])
    setShowUpload(false)
  }, [])

  const handleSelect = useCallback(
    (asset: MediaAsset) => {
      const url = getMediumUrl(asset)
      onSelect(asset.id, url)
    },
    [onSelect]
  )

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const filtered = search
    ? assets.filter((a) =>
        a.originalName.toLowerCase().includes(search.toLowerCase())
      )
    : assets

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Select an Image
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showUpload ? 'Back to Library' : 'Upload New'}
            </button>
            <button
              onClick={onClose}
              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {showUpload ? (
            <ImageUpload onUpload={handleUpload} />
          ) : (
            <>
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by filename..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Grid */}
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <svg
                    className="mx-auto h-10 w-10 text-gray-400"
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
                  <p className="mt-2 text-sm text-gray-500">
                    {search
                      ? 'No images match your search'
                      : 'No images uploaded yet'}
                  </p>
                  {!search && (
                    <button
                      onClick={() => setShowUpload(true)}
                      className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Upload an image
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {filtered.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => handleSelect(asset)}
                      className="group overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition hover:border-blue-400 hover:shadow-md focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <div className="aspect-square overflow-hidden bg-gray-100">
                        <img
                          src={getThumbnailUrl(asset)}
                          alt={asset.alt || asset.originalName}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="truncate text-xs text-gray-600">
                          {asset.originalName}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
