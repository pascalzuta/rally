import { useRef } from 'react'

/**
 * Freezes the order of items from the first render (or when `key` changes).
 * Items keep their initial positions across re-renders; new items appear at the end.
 * Order resets on component unmount or when `key` changes (e.g. switching tournaments).
 */
export function useStableOrder<T>(
  items: T[],
  getId: (item: T) => string,
  key?: string,
): T[] {
  const ref = useRef<{ key: string | undefined; order: Map<string, number> } | null>(null)

  if (!ref.current || ref.current.key !== key) {
    const order = new Map<string, number>()
    items.forEach((item, i) => order.set(getId(item), i))
    ref.current = { key, order }
  }

  const { order } = ref.current
  const fallback = order.size

  return [...items].sort((a, b) => {
    const posA = order.get(getId(a)) ?? fallback
    const posB = order.get(getId(b)) ?? fallback
    return posA - posB
  })
}

/**
 * Returns a cached sort-priority function that freezes priorities from the first render
 * (or when `key` changes). Useful when sorting is applied inline at multiple render points.
 */
export function useStableSortPriority<T>(
  items: T[],
  getId: (item: T) => string,
  getPriority: (item: T) => number,
  key?: string,
): (item: T) => number {
  const ref = useRef<{ key: string | undefined; priorities: Map<string, number> } | null>(null)

  if (!ref.current || ref.current.key !== key) {
    const priorities = new Map<string, number>()
    for (const item of items) {
      priorities.set(getId(item), getPriority(item))
    }
    ref.current = { key, priorities }
  }

  const { priorities } = ref.current
  return (item: T) => priorities.get(getId(item)) ?? getPriority(item)
}
