'use client'

import { useState, useRef, useCallback } from 'react'

export interface MediaAssetResponse {
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
}

interface ImageUploadProps {
  onUpload: (asset: MediaAssetResponse) => void
  multiple?: boolean
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024

interface UploadItem {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export default function ImageUpload({ onUpload, multiple }: ImageUploadProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return `Invalid file type "${file.type}". Accepted: JPG, PNG, WebP`
    }
    if (file.size > MAX_SIZE) {
      return `File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max 10MB`
    }
    return null
  }, [])

  const uploadFile = useCallback(
    async (file: File, index: number) => {
      setUploads((prev) =>
        prev.map((u, i) =>
          i === index ? { ...u, status: 'uploading' as const, progress: 10 } : u
        )
      )

      const formData = new FormData()
      formData.append('file', file)

      try {
        // Simulate progress steps since fetch doesn't support upload progress natively
        const progressTimer = setInterval(() => {
          setUploads((prev) =>
            prev.map((u, i) =>
              i === index && u.progress < 80
                ? { ...u, progress: u.progress + 15 }
                : u
            )
          )
        }, 200)

        const res = await fetch('/api/media', {
          method: 'POST',
          body: formData,
        })

        clearInterval(progressTimer)

        if (!res.ok) {
          const body = await res.json()
          throw new Error(body.error || 'Upload failed')
        }

        const asset: MediaAssetResponse = await res.json()

        setUploads((prev) =>
          prev.map((u, i) =>
            i === index
              ? { ...u, status: 'done' as const, progress: 100 }
              : u
          )
        )

        onUpload(asset)
      } catch (err) {
        setUploads((prev) =>
          prev.map((u, i) =>
            i === index
              ? {
                  ...u,
                  status: 'error' as const,
                  error: err instanceof Error ? err.message : 'Upload failed',
                }
              : u
          )
        )
      }
    },
    [onUpload]
  )

  const handleFiles = useCallback(
    (fileList: FileList) => {
      const files = multiple
        ? Array.from(fileList)
        : Array.from(fileList).slice(0, 1)

      const newUploads: UploadItem[] = files.map((file) => {
        const error = validateFile(file)
        return {
          file,
          progress: 0,
          status: error ? ('error' as const) : ('pending' as const),
          error: error ?? undefined,
        }
      })

      // Capture current length before updating state, then append
      let startIndex = 0
      setUploads((prev) => {
        startIndex = prev.length
        return [...prev, ...newUploads]
      })

      // Kick off uploads for valid files outside the state updater
      newUploads.forEach((item, i) => {
        if (item.status === 'pending') {
          uploadFile(item.file, startIndex + i)
        }
      })
    },
    [multiple, validateFile, uploadFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles]
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files)
        // Reset the input so the same file can be selected again
        e.target.value = ''
      }
    },
    [handleFiles]
  )

  const clearCompleted = useCallback(() => {
    setUploads((prev) => prev.filter((u) => u.status !== 'done' && u.status !== 'error'))
  }, [])

  const completedCount = uploads.filter(
    (u) => u.status === 'done' || u.status === 'error'
  ).length

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed
          px-6 py-10 text-center cursor-pointer transition-colors
          ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }
        `}
      >
        <svg
          className="mx-auto h-10 w-10 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 48 48"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M24 8v24m-12-12h24M8 40h32a4 4 0 004-4V12a4 4 0 00-4-4H8a4 4 0 00-4 4v24a4 4 0 004 4z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium text-blue-600">Click to upload</span> or
          drag and drop
        </p>
        <p className="mt-1 text-xs text-gray-500">
          JPG, PNG, or WebP up to 10MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Upload progress list */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {uploads.filter((u) => u.status === 'uploading').length} uploading
            </span>
            {completedCount > 0 && (
              <button
                onClick={clearCompleted}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear completed
              </button>
            )}
          </div>
          {uploads.map((item, i) => (
            <div
              key={`${item.file.name}-${i}`}
              className="flex items-center gap-3 rounded bg-white border border-gray-200 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-700">
                  {item.file.name}
                </p>
                {item.status === 'uploading' && (
                  <div className="mt-1 h-1.5 w-full rounded-full bg-gray-200">
                    <div
                      className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <p className="mt-0.5 text-xs text-red-600">{item.error}</p>
                )}
              </div>
              <div className="flex-shrink-0">
                {item.status === 'uploading' && (
                  <span className="text-xs text-blue-600">
                    {item.progress}%
                  </span>
                )}
                {item.status === 'done' && (
                  <svg
                    className="h-5 w-5 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                {item.status === 'error' && (
                  <svg
                    className="h-5 w-5 text-red-500"
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
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
