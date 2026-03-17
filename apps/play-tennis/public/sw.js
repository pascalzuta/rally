/* global self, caches, fetch */
const CACHE_NAME = 'rally-v1'
const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/rally-logo.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Skip non-GET requests and cross-origin
  if (request.method !== 'GET') return
  if (!request.url.startsWith(self.location.origin)) return

  // Network-first for API/Supabase calls
  if (request.url.includes('supabase.co')) return

  // Stale-while-revalidate for app assets
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      const fetched = fetch(request).then((response) => {
        if (response.ok) {
          cache.put(request, response.clone())
        }
        return response
      }).catch(() => cached)

      return cached || fetched
    })
  )
})
