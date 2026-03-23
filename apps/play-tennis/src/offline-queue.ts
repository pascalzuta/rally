import { getClient } from './supabase'
import { Tournament, LobbyEntry, PlayerRating, AvailabilitySlot } from './types'

const QUEUE_KEY = 'rally-offline-queue'

export interface QueuedWrite {
  id: string
  type: 'tournament' | 'lobby_add' | 'lobby_remove' | 'rating' | 'availability' | 'match_schedule' | 'feedback'
  payload: unknown
  createdAt: string
}

function loadQueue(): QueuedWrite[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedWrite[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueue(type: QueuedWrite['type'], payload: unknown): void {
  const queue = loadQueue()
  queue.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    type,
    payload,
    createdAt: new Date().toISOString(),
  })
  saveQueue(queue)
}

export async function flushQueue(): Promise<void> {
  const client = getClient()
  if (!client) return

  const queue = loadQueue()
  if (queue.length === 0) return

  const remaining: QueuedWrite[] = []

  for (const item of queue) {
    try {
      switch (item.type) {
        case 'tournament': {
          const t = item.payload as Tournament
          const { error } = await client.from('tournaments').upsert({
            id: t.id,
            county: t.county.toLowerCase(),
            data: t,
          }, { onConflict: 'id' })
          if (error) remaining.push(item)
          break
        }
        case 'lobby_add': {
          const entry = item.payload as LobbyEntry
          const { error } = await client.from('lobby').upsert({
            player_id: entry.playerId,
            player_name: entry.playerName,
            county: entry.county.toLowerCase(),
            joined_at: entry.joinedAt,
          }, { onConflict: 'player_id' })
          if (error) remaining.push(item)
          break
        }
        case 'lobby_remove': {
          const { playerId } = item.payload as { playerId: string }
          const { error } = await client.from('lobby').delete().eq('player_id', playerId)
          if (error) remaining.push(item)
          break
        }
        case 'rating': {
          const { playerId, rating } = item.payload as { playerId: string; rating: PlayerRating }
          const { error } = await client.from('ratings').upsert({
            player_id: playerId,
            data: rating,
          }, { onConflict: 'player_id' })
          if (error) remaining.push(item)
          break
        }
        case 'availability': {
          const { playerId, county, slots, weeklyCap } = item.payload as {
            playerId: string; county: string; slots: AvailabilitySlot[]; weeklyCap: number
          }
          const { error } = await client.from('availability').upsert({
            player_id: playerId,
            county: county.toLowerCase(),
            slots,
            weekly_cap: weeklyCap,
          }, { onConflict: 'player_id' })
          if (error) remaining.push(item)
          break
        }
        case 'match_schedule': {
          // Match schedule updates are embedded in tournament data
          const t = item.payload as Tournament
          const { error } = await client.from('tournaments').upsert({
            id: t.id,
            county: t.county.toLowerCase(),
            data: t,
          }, { onConflict: 'id' })
          if (error) remaining.push(item)
          break
        }
      }
    } catch {
      remaining.push(item)
    }
  }

  saveQueue(remaining)
}
