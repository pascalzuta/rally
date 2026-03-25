import { useRef } from 'react'

/**
 * Freezes the order of items from the first render that has items (or when `key` changes).
 * Rebuilds the output by walking the captured order and pulling from current items,
 * then appending any new items at the end.
 *
 * Key detail: if the first render has zero items (data not yet loaded), the capture
 * is deferred until items actually appear. This prevents capturing an empty order
 * that would make all future items "new" (defeating the purpose).
 */
export function useStableOrder<T>(
  items: T[],
  getId: (item: T) => string,
  key?: string,
): T[] {
  const ref = useRef<{ key: string | undefined; orderedIds: string[] } | null>(null)

  const shouldCapture =
    !ref.current ||
    ref.current.key !== key ||
    (ref.current.orderedIds.length === 0 && items.length > 0)

  if (shouldCapture) {
    ref.current = { key, orderedIds: items.map(getId) }
  }

  // If nothing captured yet, return items as-is
  if (!ref.current || ref.current.orderedIds.length === 0) {
    return items
  }

  // Build a lookup from current items
  const itemById = new Map<string, T>()
  for (const item of items) {
    itemById.set(getId(item), item)
  }

  // Walk captured order, emit items that still exist (with fresh data)
  const result: T[] = []
  const emitted = new Set<string>()

  for (const id of ref.current.orderedIds) {
    const item = itemById.get(id)
    if (item) {
      result.push(item)
      emitted.add(id)
    }
  }

  // Append new items not in the captured order
  for (const item of items) {
    const id = getId(item)
    if (!emitted.has(id)) {
      result.push(item)
    }
  }

  return result
}

/**
 * Returns a cached sort-priority function that freezes priorities from the first render
 * that has items (or when `key` changes). Useful when sorting is applied inline
 * at multiple render points.
 */
export function useStableSortPriority<T>(
  items: T[],
  getId: (item: T) => string,
  getPriority: (item: T) => number,
  key?: string,
): (item: T) => number {
  const ref = useRef<{ key: string | undefined; priorities: Map<string, number> } | null>(null)

  const shouldCapture =
    !ref.current ||
    ref.current.key !== key ||
    (ref.current.priorities.size === 0 && items.length > 0)

  if (shouldCapture) {
    const priorities = new Map<string, number>()
    for (const item of items) {
      priorities.set(getId(item), getPriority(item))
    }
    ref.current = { key, priorities }
  }

  const priorities = ref.current?.priorities ?? new Map<string, number>()
  return (item: T) => priorities.get(getId(item)) ?? getPriority(item)
}
