/**
 * API client for the Rally backend.
 *
 * Routes writes through the backend Express server instead of writing
 * directly to Supabase. The backend validates inputs, enforces auth,
 * and writes with the service role key (bypassing RLS).
 *
 * The frontend still reads from Supabase directly via Realtime
 * subscriptions for instant updates.
 */
import { getClient } from './supabase'
import type { LobbyEntry, AvailabilitySlot, Tournament } from './types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8788'

/**
 * Get the current Supabase session access token for authenticating
 * with the backend. Returns null if not authenticated.
 */
async function getAccessToken(): Promise<string | null> {
  const client = getClient()
  if (!client) return null
  const { data } = await client.auth.getSession()
  return data.session?.access_token ?? null
}

/**
 * Make an authenticated request to the backend API.
 */
async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: string
    body?: unknown
  } = {}
): Promise<{ ok: boolean; data?: T; error?: string }> {
  let token = await getAccessToken()
  if (!token) {
    return { ok: false, error: 'not_authenticated' }
  }

  async function doFetch(authToken: string): Promise<Response> {
    return fetch(`${API_BASE}/v1/fe${path}`, {
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
  }

  try {
    let response = await doFetch(token)

    // If the access token expired between getSession() and the request, refresh
    // once and retry. Without this, the user gets a spurious "not authenticated"
    // until they reload the page.
    if (response.status === 401) {
      const client = getClient()
      if (client) {
        const { data: refreshed } = await client.auth.refreshSession()
        const newToken = refreshed.session?.access_token
        if (newToken) {
          token = newToken
          response = await doFetch(newToken)
        }
      }
    }

    const data = await response.json() as T & { error?: string }

    if (!response.ok) {
      return { ok: false, error: data.error || `HTTP ${response.status}` }
    }

    return { ok: true, data }
  } catch (err) {
    console.warn('[Rally API] Request failed:', err)
    return { ok: false, error: 'network_error' }
  }
}

// --- Public API ---

export async function apiJoinLobby(entry: LobbyEntry): Promise<boolean> {
  const result = await apiFetch('/lobby/join', {
    body: {
      playerId: entry.playerId,
      playerName: entry.playerName,
      county: entry.county,
    },
  })
  return result.ok
}

export async function apiLeaveLobby(playerId: string): Promise<boolean> {
  const result = await apiFetch('/lobby/leave', {
    body: { playerId },
  })
  return result.ok
}

export async function apiSaveAvailability(
  playerId: string,
  county: string,
  slots: AvailabilitySlot[],
  weeklyCap: number = 2,
): Promise<boolean> {
  const result = await apiFetch('/availability', {
    method: 'PUT',
    body: { playerId, county, slots, weeklyCap },
  })
  return result.ok
}

export async function apiSaveTournament(tournament: Tournament): Promise<boolean> {
  const result = await apiFetch('/tournament', {
    method: 'PUT',
    body: {
      id: tournament.id,
      county: tournament.county,
      data: tournament,
    },
  })
  return result.ok
}

// --- Profile API ---

export interface ServerProfile {
  id: string
  authId: string
  name: string
  county: string
  email?: string
  skillLevel?: string
  gender?: string
  weeklyCap?: number
  createdAt: string
}

/**
 * Fetch the current user's profile from the server.
 * Returns null if no profile exists (new user).
 */
export async function apiFetchProfile(): Promise<ServerProfile | null> {
  const result = await apiFetch<{ profile: ServerProfile }>('/profile', { method: 'GET' })
  if (!result.ok || !result.data?.profile) return null
  return result.data.profile
}

/**
 * Save or update the current user's profile on the server.
 */
export async function apiSaveProfile(profile: {
  playerName: string
  county: string
  email?: string
  skillLevel?: string
  gender?: string
  weeklyCap?: number
}): Promise<boolean> {
  const result = await apiFetch('/profile', { body: profile })
  return result.ok
}

/**
 * Check if the backend API is reachable.
 */
export async function apiHealthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/v1/fe/health`)
    return response.ok
  } catch {
    return false
  }
}

/**
 * Whether the backend API is configured (URL is not localhost in production).
 */
export function isApiConfigured(): boolean {
  const url = import.meta.env.VITE_API_URL
  return !!url && url !== 'http://localhost:8788'
}
