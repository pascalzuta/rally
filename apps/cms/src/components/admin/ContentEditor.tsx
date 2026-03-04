'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface ContentFieldDef {
  key: string
  label: string
  type: 'text' | 'textarea' | 'image' | 'list' | 'iframe'
  placeholder?: string
}

interface ContentEditorProps {
  pageSlug: string
  pageTitle: string
  pageDescription: string
  fields: ContentFieldDef[]
}

function isImageUrl(value: string): boolean {
  if (!value) return false
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i.test(value)
  )
}

export default function ContentEditor({
  pageSlug,
  pageTitle,
  pageDescription,
  fields,
}: ContentEditorProps) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [savedValues, setSavedValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [toast, setToast] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Determine if there are unsaved changes
  const hasUnsavedChanges = fields.some(
    (f) => (values[f.key] ?? '') !== (savedValues[f.key] ?? '')
  )

  // Fetch current content on mount
  useEffect(() => {
    let cancelled = false

    async function fetchContent() {
      setLoading(true)
      setFetchError(null)
      try {
        const res = await fetch(`/api/content/${pageSlug}`)
        if (!res.ok) {
          throw new Error(`Failed to load content (${res.status})`)
        }
        const data = await res.json()
        const fieldValues: Record<string, string> = {}
        if (data.fields && typeof data.fields === 'object') {
          for (const [key, val] of Object.entries(data.fields)) {
            fieldValues[key] = String(val ?? '')
          }
        }
        if (!cancelled) {
          setValues(fieldValues)
          setSavedValues(fieldValues)
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : 'Failed to load content'
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchContent()
    return () => {
      cancelled = true
    }
  }, [pageSlug])

  // Show toast with auto-dismiss
  const showToast = useCallback(
    (type: 'success' | 'error', message: string) => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      setToast({ type, message })
      toastTimerRef.current = setTimeout(() => setToast(null), 4000)
    },
    []
  )

  // Handle save
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const body: Record<string, string> = {}
      for (const field of fields) {
        body[field.key] = values[field.key] ?? ''
      }

      const res = await fetch(`/api/content/${pageSlug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Save failed (${res.status})`)
      }

      setSavedValues({ ...values })
      showToast('success', 'Content saved successfully')
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Failed to save content'
      )
    } finally {
      setSaving(false)
    }
  }, [fields, values, pageSlug, showToast])

  // Handle field change
  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  // Handle form submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      handleSave()
    },
    [handleSave]
  )

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  // -- Loading state --
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-500" />
          <p className="text-sm text-gray-500">Loading content...</p>
        </div>
      </div>
    )
  }

  // -- Error state --
  if (fetchError) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3 text-center">
          <svg
            className="h-10 w-10 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <p className="text-sm font-medium text-gray-900">
            Failed to load content
          </p>
          <p className="text-sm text-gray-500">{fetchError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // -- Save button component --
  const SaveButton = ({ className }: { className?: string }) => (
    <button
      type="submit"
      disabled={saving || !hasUnsavedChanges}
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed ${
        hasUnsavedChanges
          ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
          : 'bg-gray-400'
      } ${className ?? ''}`}
    >
      {saving ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Saving...
        </>
      ) : (
        'Save Changes'
      )}
    </button>
  )

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed right-6 top-20 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800 ring-1 ring-green-200'
              : 'bg-red-50 text-red-800 ring-1 ring-red-200'
          }`}
        >
          {toast.type === 'success' ? (
            <svg
              className="h-4 w-4 text-green-500"
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
          ) : (
            <svg
              className="h-4 w-4 text-red-500"
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
          {toast.message}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-2 text-current opacity-60 hover:opacity-100"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 flex items-center justify-between border-b border-gray-200 bg-gray-50/95 px-6 py-4 backdrop-blur-sm">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{pageDescription}</p>
        </div>
        <div className="flex items-center gap-3 pl-4">
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1.5 text-sm text-amber-600">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Unsaved changes
            </span>
          )}
          <SaveButton />
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-6">
        {fields.map((field) => (
          <FieldCard
            key={field.key}
            field={field}
            value={values[field.key] ?? ''}
            onChange={(val) => handleChange(field.key, val)}
          />
        ))}
      </div>

      {/* Bottom save bar */}
      <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
        <div>
          {hasUnsavedChanges && (
            <span className="flex items-center gap-1.5 text-sm text-amber-600">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              You have unsaved changes
            </span>
          )}
        </div>
        <SaveButton />
      </div>
    </form>
  )
}

/* ---------- Field Card Component ---------- */

interface FieldCardProps {
  field: ContentFieldDef
  value: string
  onChange: (value: string) => void
}

function FieldCard({ field, value, onChange }: FieldCardProps) {
  const inputClasses =
    'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <label className="mb-2 block text-sm font-medium text-gray-700">
        {field.label}
        <span className="ml-2 text-xs font-normal text-gray-400">
          {field.key}
        </span>
      </label>

      {field.type === 'text' && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClasses}
        />
      )}

      {field.type === 'textarea' && (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClasses}
        />
      )}

      {field.type === 'image' && (
        <div className="space-y-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? 'Image URL'}
            className={inputClasses}
          />
          {value && isImageUrl(value) && (
            <div className="flex items-start gap-3">
              <div className="h-[60px] w-[80px] flex-shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-100">
                <img
                  src={value}
                  alt={`Preview for ${field.label}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                  onLoad={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'block'
                  }}
                />
              </div>
              <span className="mt-1 text-xs text-gray-400">Preview</span>
            </div>
          )}
        </div>
      )}

      {field.type === 'list' && (
        <div className="space-y-1.5">
          <textarea
            rows={6}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? 'One item per line'}
            className={inputClasses}
          />
          <p className="text-xs text-gray-400">
            One item per line.{' '}
            {value
              ? `${value.split('\n').filter((line) => line.trim()).length} item(s)`
              : ''}
          </p>
        </div>
      )}

      {field.type === 'iframe' && (
        <div className="space-y-1.5">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder ?? 'Embed URL (e.g. Google Maps)'}
            className={inputClasses}
          />
          <p className="text-xs text-gray-400">
            Paste the full embed URL for the iframe src attribute.
          </p>
        </div>
      )}
    </div>
  )
}
