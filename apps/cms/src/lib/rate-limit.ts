const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(
  key: string,
  limit: number = 5,
  windowMs: number = 15 * 60 * 1000
): { success: boolean; remaining: number } {
  const now = Date.now()

  // Auto-cleanup expired entries
  for (const [k, v] of store) {
    if (v.resetAt <= now) {
      store.delete(k)
    }
  }

  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 }
  }

  entry.count++
  return { success: true, remaining: limit - entry.count }
}
