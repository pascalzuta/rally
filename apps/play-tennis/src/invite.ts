import { InviteLink, LobbyMember, InviteLinkStatus } from './types'
import { getClient } from './supabase'
import { SYNC_EVENT } from './sync'

const INVITE_LINKS_KEY = 'rally-invite-links'
const LOBBY_MEMBERS_KEY = 'rally-lobby-members'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function generateShortcode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function dispatchSync() {
  window.dispatchEvent(new Event(SYNC_EVENT))
}

// --- Local storage helpers ---

export function getInviteLinks(): InviteLink[] {
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

export function getLobbyMembers(inviteLinkId: string): LobbyMember[] {
  try {
    const data = localStorage.getItem(LOBBY_MEMBERS_KEY)
    const all: LobbyMember[] = data ? JSON.parse(data) : []
    return all.filter(m => m.inviteLinkId === inviteLinkId)
  } catch {
    return []
  }
}

function getAllLobbyMembers(): LobbyMember[] {
  try {
    const data = localStorage.getItem(LOBBY_MEMBERS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveLobbyMembers(members: LobbyMember[]): void {
  localStorage.setItem(LOBBY_MEMBERS_KEY, JSON.stringify(members))
}

// --- Create invite link ---

export async function createInviteLink(
  creatorId: string,
  creatorName: string,
  county: string,
  lobbyName?: string,
): Promise<InviteLink> {
  const shortcode = generateShortcode()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const link: InviteLink = {
    id: generateId(),
    shortcode,
    creatorId,
    creatorName,
    lobbyName: lobbyName || `${creatorName}'s Tournament`,
    county,
    maxPlayers: 16,
    status: 'active',
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }

  const links = getInviteLinks()
  links.push(link)
  saveInviteLinks(links)

  const client = getClient()
  if (client) {
    await client.from('invite_links').insert({
      id: link.id,
      shortcode: link.shortcode,
      creator_id: link.creatorId,
      creator_name: link.creatorName,
      lobby_name: link.lobbyName,
      county: link.county.toLowerCase(),
      max_players: link.maxPlayers,
      status: link.status,
      created_at: link.createdAt,
      expires_at: link.expiresAt,
    })
  }

  return link
}

// --- Resolve shortcode ---

export async function resolveShortcode(shortcode: string): Promise<InviteLink | null> {
  const local = getInviteLinks().find(l => l.shortcode === shortcode)
  if (local) return local

  const client = getClient()
  if (!client) return null

  const { data } = await client
    .from('invite_links')
    .select('*')
    .eq('shortcode', shortcode)
    .single()

  if (!data) return null

  const link: InviteLink = {
    id: data.id,
    shortcode: data.shortcode,
    creatorId: data.creator_id,
    creatorName: data.creator_name ?? '',
    lobbyName: data.lobby_name,
    county: data.county,
    maxPlayers: data.max_players ?? 16,
    status: data.status as InviteLinkStatus,
    tournamentId: data.tournament_id,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  }

  const links = getInviteLinks()
  if (!links.find(l => l.id === link.id)) {
    links.push(link)
    saveInviteLinks(links)
  }

  return link
}

// --- Join lobby via invite link ---

export async function joinLobbyViaLink(
  shortcode: string,
  displayName: string,
  playerId?: string,
): Promise<LobbyMember | null> {
  const link = await resolveShortcode(shortcode)
  if (!link || link.status !== 'active') return null

  const existing = getLobbyMembers(link.id)
  if (existing.length >= (link.maxPlayers ?? 16)) return null

  const guestId = playerId || generateId()
  const dupe = existing.find(m => m.guestId === guestId || m.displayName === displayName)
  if (dupe) return dupe

  const member: LobbyMember = {
    id: generateId(),
    inviteLinkId: link.id,
    guestId,
    playerId,
    displayName,
    joinedAt: new Date().toISOString(),
  }

  const allMembers = getAllLobbyMembers()
  allMembers.push(member)
  saveLobbyMembers(allMembers)

  const client = getClient()
  if (client) {
    await client.from('lobby_members').insert({
      id: member.id,
      invite_link_id: member.inviteLinkId,
      guest_id: member.guestId,
      player_id: member.playerId,
      display_name: member.displayName,
      joined_at: member.joinedAt,
    })

    const totalMembers = existing.length + 1
    if (totalMembers >= (link.maxPlayers ?? 16)) {
      await client.from('invite_links')
        .update({ status: 'full' })
        .eq('id', link.id)
    }
  }

  dispatchSync()
  return member
}

// --- Get invite link URL ---

export function getInviteLinkUrl(shortcode: string): string {
  const base = window.location.origin
  return `${base}/t/${shortcode}`
}

// --- Share invite link ---

export function shareInviteLink(link: InviteLink): void {
  const url = getInviteLinkUrl(link.shortcode)
  const message = `Join ${link.lobbyName || 'my tournament'} on Rally Tennis! ${getLobbyMembers(link.id).length} players already in.\n${url}`

  if (navigator.share) {
    navigator.share({ title: 'Rally Tennis', text: message, url }).catch(() => {
      navigator.clipboard.writeText(url)
    })
  } else {
    navigator.clipboard.writeText(url)
  }
}

// --- Refresh lobby members from Supabase ---

export async function refreshLobbyMembersFromRemote(inviteLinkId: string): Promise<LobbyMember[]> {
  const client = getClient()
  if (!client) return getLobbyMembers(inviteLinkId)

  const { data } = await client
    .from('lobby_members')
    .select('*')
    .eq('invite_link_id', inviteLinkId)
    .order('joined_at', { ascending: true })

  if (!data) return getLobbyMembers(inviteLinkId)

  const members: LobbyMember[] = data.map(row => ({
    id: row.id,
    inviteLinkId: row.invite_link_id,
    guestId: row.guest_id,
    playerId: row.player_id,
    displayName: row.display_name,
    email: row.email,
    joinedAt: row.joined_at,
  }))

  const allMembers = getAllLobbyMembers().filter(m => m.inviteLinkId !== inviteLinkId)
  saveLobbyMembers([...allMembers, ...members])

  return members
}

export function getMyInviteLinks(creatorId: string): InviteLink[] {
  return getInviteLinks().filter(l => l.creatorId === creatorId)
}
