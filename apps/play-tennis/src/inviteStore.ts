import { InviteLink, LobbyMember } from './types'
import { getClient } from './supabase'
import { createTournamentForInviteLobby } from './store'

const INVITE_LINKS_KEY = 'rally-invite-links'
const INVITE_MEMBERS_KEY = 'rally-invite-members'

const DEFAULT_MAX_PLAYERS = 16
const LINK_EXPIRY_DAYS = 30

// --- Helpers ---

export function generateShortcode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function loadInviteLinks(): InviteLink[] {
  try {
    const data = localStorage.getItem(INVITE_LINKS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveInviteLinks(links: InviteLink[]): void {
  localStorage.setItem(INVITE_LINKS_KEY, JSON.stringify(links))
}

function loadInviteMembers(): LobbyMember[] {
  try {
    const data = localStorage.getItem(INVITE_MEMBERS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveInviteMembers(members: LobbyMember[]): void {
  localStorage.setItem(INVITE_MEMBERS_KEY, JSON.stringify(members))
}

// --- Core functions ---

/**
 * Create an invite link — writes to localStorage first, then syncs to Supabase.
 */
export async function createInviteLink(
  creatorId: string,
  county: string,
  lobbyName?: string,
): Promise<InviteLink> {
  const shortcode = generateShortcode()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  const link: InviteLink = {
    id: generateId(),
    shortcode,
    creatorId,
    lobbyName: lobbyName || `${county} Tournament`,
    county,
    maxPlayers: DEFAULT_MAX_PLAYERS,
    status: 'open',
    tournamentId: null,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  // Write to localStorage immediately
  const links = loadInviteLinks()
  links.push(link)
  saveInviteLinks(links)

  // Sync to Supabase
  const client = getClient()
  if (client) {
    const { error } = await client.from('invite_links').insert({
      id: link.id,
      shortcode: link.shortcode,
      creator_id: link.creatorId,
      lobby_name: link.lobbyName,
      county: link.county,
      max_players: link.maxPlayers,
      status: link.status,
      tournament_id: link.tournamentId,
      created_at: link.createdAt,
      expires_at: link.expiresAt,
    })
    if (error) {
      console.warn('[Rally] Failed to sync invite link to Supabase:', error.message)
    }
  }

  return link
}

/**
 * Get an invite link by shortcode — checks Supabase first, falls back to localStorage.
 */
export async function getInviteLink(shortcode: string): Promise<InviteLink | null> {
  const client = getClient()
  if (client) {
    const { data, error } = await client
      .from('invite_links')
      .select('*')
      .eq('shortcode', shortcode)
      .maybeSingle()

    if (!error && data) {
      return {
        id: data.id,
        shortcode: data.shortcode,
        creatorId: data.creator_id,
        lobbyName: data.lobby_name,
        county: data.county,
        maxPlayers: data.max_players,
        status: data.status,
        tournamentId: data.tournament_id,
        createdAt: data.created_at,
        expiresAt: data.expires_at,
      }
    }
  }

  // Fall back to localStorage
  const links = loadInviteLinks()
  return links.find(l => l.shortcode === shortcode) ?? null
}

/**
 * Join a lobby via invite shortcode — requires name + email.
 * Automatically triggers tournament creation when lobby hits 6+ members.
 */
export async function joinLobbyViaLink(
  shortcode: string,
  displayName: string,
  email: string,
): Promise<LobbyMember> {
  const link = await getInviteLink(shortcode)
  if (!link) throw new Error('Invite link not found')
  if (link.status !== 'open') throw new Error('This lobby is no longer accepting players')

  const member: LobbyMember = {
    id: generateId(),
    inviteLinkId: link.id,
    playerId: generateId(),
    displayName: displayName.trim(),
    email: email.trim().toLowerCase(),
    joinedAt: new Date().toISOString(),
  }

  // Write locally
  const members = loadInviteMembers()
  members.push(member)
  saveInviteMembers(members)

  // Sync to Supabase
  const client = getClient()
  if (client) {
    const { error } = await client.from('lobby_members').insert({
      id: member.id,
      invite_link_id: member.inviteLinkId,
      player_id: member.playerId,
      display_name: member.displayName,
      email: member.email,
      joined_at: member.joinedAt,
    })
    if (error) {
      console.warn('[Rally] Failed to sync lobby member to Supabase:', error.message)
    }
  }

  // Check if we should auto-trigger a tournament
  await checkAndTriggerTournament(link.id).catch(err =>
    console.warn('[Rally] Tournament trigger check failed:', err)
  )

  return member
}

const MIN_LOBBY_FOR_TOURNAMENT = 6

/**
 * Check if a lobby has enough members to auto-create a tournament.
 * If yes, creates the tournament and marks the invite link as 'tournament_created'.
 * Returns the tournament ID if one was created, null otherwise.
 */
export async function checkAndTriggerTournament(inviteLinkId: string): Promise<string | null> {
  const links = loadInviteLinks()
  const link = links.find(l => l.id === inviteLinkId)
  if (!link || link.status !== 'open') return null

  // Get latest member count
  const members = await getLobbyMembers(link.shortcode)
  if (members.length < MIN_LOBBY_FOR_TOURNAMENT) return null

  // Create the tournament
  const tournament = await createTournamentForInviteLobby(
    link.county,
    members.map(m => ({ playerId: m.playerId, playerName: m.displayName })),
  )
  if (!tournament) return null

  // Update invite link status locally
  const idx = links.findIndex(l => l.id === inviteLinkId)
  if (idx >= 0) {
    links[idx] = { ...links[idx], status: 'tournament_created', tournamentId: tournament.id }
    saveInviteLinks(links)
  }

  // Update in Supabase
  const client = getClient()
  if (client) {
    const { error } = await client
      .from('invite_links')
      .update({ status: 'tournament_created', tournament_id: tournament.id })
      .eq('id', inviteLinkId)
    if (error) {
      console.warn('[Rally] Failed to update invite link status in Supabase:', error.message)
    }
  }

  return tournament.id
}

/**
 * Mark any invite links whose expiry has passed as 'expired'.
 * Call this on app load.
 */
export async function cleanupExpiredLobbies(): Promise<void> {
  const now = new Date()
  const links = loadInviteLinks()
  const expiredIds: string[] = []

  for (const link of links) {
    if (link.status === 'open' && new Date(link.expiresAt) <= now) {
      link.status = 'expired'
      expiredIds.push(link.id)
    }
  }

  if (expiredIds.length === 0) return

  saveInviteLinks(links)

  const client = getClient()
  if (client && expiredIds.length > 0) {
    const { error } = await client
      .from('invite_links')
      .update({ status: 'expired' })
      .in('id', expiredIds)
    if (error) {
      console.warn('[Rally] Failed to expire invite links in Supabase:', error.message)
    }
  }
}

/**
 * Get all lobby members for an invite link.
 */
export async function getLobbyMembers(shortcode: string): Promise<LobbyMember[]> {
  const link = await getInviteLink(shortcode)
  if (!link) return []

  const client = getClient()
  if (client) {
    const { data, error } = await client
      .from('lobby_members')
      .select('*')
      .eq('invite_link_id', link.id)
      .order('joined_at', { ascending: true })

    if (!error && data) {
      return data.map(row => ({
        id: row.id,
        inviteLinkId: row.invite_link_id,
        playerId: row.player_id,
        displayName: row.display_name,
        email: row.email,
        joinedAt: row.joined_at,
      }))
    }
  }

  // Fall back to localStorage
  const members = loadInviteMembers()
  return members.filter(m => m.inviteLinkId === link.id)
}

/**
 * Subscribe to real-time lobby member updates.
 * Returns an unsubscribe function.
 */
export function subscribeLobbyUpdates(
  inviteLinkId: string,
  callback: (members: LobbyMember[]) => void,
): () => void {
  const client = getClient()
  if (!client) return () => {}

  const channel = client
    .channel(`lobby-members-${inviteLinkId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lobby_members',
        filter: `invite_link_id=eq.${inviteLinkId}`,
      },
      async () => {
        // Refetch all members on any change
        const { data } = await client
          .from('lobby_members')
          .select('*')
          .eq('invite_link_id', inviteLinkId)
          .order('joined_at', { ascending: true })

        if (data) {
          callback(
            data.map(row => ({
              id: row.id,
              inviteLinkId: row.invite_link_id,
              playerId: row.player_id,
              displayName: row.display_name,
              email: row.email,
              joinedAt: row.joined_at,
            })),
          )
        }
      },
    )
    .subscribe()

  return () => {
    client.removeChannel(channel)
  }
}

/**
 * Get the shareable URL for an invite link shortcode.
 */
export function getInviteUrl(shortcode: string): string {
  const base = window.location.origin + window.location.pathname.replace(/\/$/, '')
  return `${base}/join?code=${shortcode}`
}

/**
 * Get all invite links created by a player (from localStorage).
 */
export function getMyInviteLinks(creatorId: string): InviteLink[] {
  return loadInviteLinks().filter(l => l.creatorId === creatorId)
}
