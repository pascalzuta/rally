'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { getPageDef } from '@/lib/content-fields'
import ContentEditor from '@/components/admin/ContentEditor'

export default function PageContentEditor() {
  const params = useParams()
  const slug = params.slug as string
  const pageDef = getPageDef(slug)

  if (!pageDef) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg
          className="h-12 w-12 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">
          Page not found
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          No page definition exists for &ldquo;{slug}&rdquo;.
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          Back to Dashboard
        </Link>
      </div>
    )
  }

  return (
    <ContentEditor
      pageSlug={pageDef.slug}
      pageTitle={pageDef.title}
      pageDescription={pageDef.description}
      fields={pageDef.fields}
    />
  )
}
