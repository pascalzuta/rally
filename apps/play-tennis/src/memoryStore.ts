/**
 * In-memory key-value store replacing localStorage.
 *
 * All runtime state lives here. On app start, the store is hydrated
 * from Supabase via initSync(). Writes go to Supabase first, then
 * update this cache. No data touches localStorage.
 */

const store = new Map<string, string>()

export function getItem(key: string): string | null {
  return store.get(key) ?? null
}

export function setItem(key: string, value: string): void {
  store.set(key, value)
}

export function removeItem(key: string): void {
  store.delete(key)
}

export function clear(): void {
  store.clear()
}
