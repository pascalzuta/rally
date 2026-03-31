/**
 * Centralized analytics layer for Rally.
 *
 * Wraps Meta Pixel (fbq), Google Ads (gtag), and persists events
 * to Supabase `analytics_events` for the attribution dashboard.
 *
 * Usage:
 *   import { analytics } from './analytics'
 *   analytics.track('CompleteRegistration', { county: 'King County' })
 */

import { getClient } from './supabase'

// ---------------------------------------------------------------------------
// Supabase REST API config (used for analytics reads to bypass authenticated
// client's RLS role — analytics RLS policies are on the anon role)
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://gxiflulfgqahlvdirecz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd4aWZsdWxmZ3FhaGx2ZGlyZWN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE2NjksImV4cCI6MjA4ODkyNzY2OX0.URWQ_FVCB3DqXGKvb-G6eAKUPBmcso6FHl1gxIWLK-I'

/** Fetch from Supabase REST API using the anon key (not the authenticated session) */
async function supabaseRest<T>(table: string, params: Record<string, string> = {}): Promise<T[]> {
  const query = new URLSearchParams(params)
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${await res.text()}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// Type declarations for third-party pixel globals
// ---------------------------------------------------------------------------

declare function fbq(command: string, event: string, params?: Record<string, unknown>): void
declare function gtag(command: string, ...args: unknown[]): void

// ---------------------------------------------------------------------------
// UTM / Attribution
// ---------------------------------------------------------------------------

export interface Attribution {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_term: string | null
  utm_content: string | null
  referrer: string | null
  landing_page: string | null
  channel: string   // derived: 'meta' | 'google' | 'organic' | 'direct' | 'referral' | 'other'
}

const ATTRIBUTION_KEY = 'rally-attribution'

/** Derive a marketing channel from UTM params + referrer */
function deriveChannel(source: string | null, medium: string | null, referrer: string | null): string {
  const s = (source ?? '').toLowerCase()
  const m = (medium ?? '').toLowerCase()
  const r = (referrer ?? '').toLowerCase()

  if (s === 'facebook' || s === 'fb' || s === 'instagram' || s === 'ig' || s === 'meta') return 'meta'
  if (s === 'google' || s === 'adwords') return 'google'
  if (m === 'cpc' || m === 'ppc' || m === 'paid') {
    if (r.includes('google') || r.includes('gclid')) return 'google'
    if (r.includes('facebook') || r.includes('instagram')) return 'meta'
    return 'paid_other'
  }
  if (m === 'social' || r.includes('facebook') || r.includes('instagram') || r.includes('t.co') || r.includes('twitter')) return 'social'
  if (m === 'email') return 'email'
  if (r && r !== '' && !r.includes('play-rally.com')) return 'referral'
  if (s || m) return 'other'
  if (!r || r === '') return 'direct'
  return 'organic'
}

/** Capture UTM params from the current URL on first landing. Persists to sessionStorage. */
export function captureAttribution(): Attribution {
  // Only capture once per session
  const existing = sessionStorage.getItem(ATTRIBUTION_KEY)
  if (existing) {
    try { return JSON.parse(existing) } catch { /* fall through */ }
  }

  const params = new URLSearchParams(window.location.search)
  const attribution: Attribution = {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
    referrer: document.referrer || null,
    landing_page: window.location.pathname + window.location.search,
    channel: 'direct',
  }
  attribution.channel = deriveChannel(attribution.utm_source, attribution.utm_medium, attribution.referrer)

  // Also check for gclid (Google Click ID) and fbclid (Meta Click ID)
  if (params.get('gclid') && attribution.channel === 'direct') {
    attribution.channel = 'google'
    attribution.utm_source = attribution.utm_source ?? 'google'
    attribution.utm_medium = attribution.utm_medium ?? 'cpc'
  }
  if (params.get('fbclid') && attribution.channel === 'direct') {
    attribution.channel = 'meta'
    attribution.utm_source = attribution.utm_source ?? 'facebook'
    attribution.utm_medium = attribution.utm_medium ?? 'cpc'
  }

  sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution))
  return attribution
}

export function getAttribution(): Attribution {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_KEY)
    return raw ? JSON.parse(raw) : captureAttribution()
  } catch {
    return captureAttribution()
  }
}

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

export type AnalyticsEvent =
  | 'PageView'
  | 'ViewContent'
  | 'Lead'
  | 'CompleteRegistration'
  | 'LobbyJoined'
  | 'TournamentCreated'
  | 'TournamentStarted'
  | 'MatchScheduled'
  | 'MatchPlayed'
  | 'ScoreSubmitted'
  | 'ScoreConfirmed'
  | 'MatchOfferSent'
  | 'MatchOfferAccepted'
  | 'InviteShared'
  | 'ReturnVisit'

// Events that map to standard Meta/Google conversion events
const META_EVENT_MAP: Record<string, string> = {
  PageView: 'PageView',
  ViewContent: 'ViewContent',
  Lead: 'Lead',
  CompleteRegistration: 'CompleteRegistration',
}

const GOOGLE_EVENT_MAP: Record<string, string> = {
  PageView: 'page_view',
  Lead: 'generate_lead',
  CompleteRegistration: 'sign_up',
  LobbyJoined: 'join_group',
  MatchPlayed: 'level_end',
}

// ---------------------------------------------------------------------------
// Core tracking
// ---------------------------------------------------------------------------

interface TrackOptions {
  /** Additional properties to send with the event */
  properties?: Record<string, unknown>
  /** Player/user ID for Supabase storage */
  userId?: string
  /** Skip sending to Meta Pixel */
  skipMeta?: boolean
  /** Skip sending to Google */
  skipGoogle?: boolean
  /** Skip persisting to Supabase */
  skipSupabase?: boolean
}

async function persistToSupabase(
  event: string,
  properties: Record<string, unknown>,
  userId?: string,
) {
  try {
    const client = getClient()
    if (!client) return

    const attribution = getAttribution()
    const { error } = await client.from('analytics_events').insert({
      event_name: event,
      properties,
      user_id: userId ?? null,
      session_id: getSessionId(),
      channel: attribution.channel,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      referrer: attribution.referrer,
      landing_page: attribution.landing_page,
      page_url: window.location.href,
      user_agent: navigator.userAgent,
      created_at: new Date().toISOString(),
    })
    if (error) {
      console.warn('[Analytics] Supabase insert failed:', error.message, error.details)
    }
  } catch (err) {
    console.warn('[Analytics] Supabase insert error:', err)
  }
}

function getSessionId(): string {
  let sid = sessionStorage.getItem('rally-session-id')
  if (!sid) {
    sid = Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
    sessionStorage.setItem('rally-session-id', sid)
  }
  return sid
}

function sendToMeta(event: string, properties?: Record<string, unknown>) {
  try {
    const metaEvent = META_EVENT_MAP[event]
    if (metaEvent && typeof fbq !== 'undefined') {
      fbq('track', metaEvent, properties)
    } else if (typeof fbq !== 'undefined') {
      fbq('trackCustom', event, properties)
    }
  } catch { /* noop */ }
}

function sendToGoogle(event: string, properties?: Record<string, unknown>) {
  try {
    if (typeof gtag === 'undefined') return
    const googleEvent = GOOGLE_EVENT_MAP[event] ?? event.toLowerCase()
    gtag('event', googleEvent, properties)
    // Fire Google Ads conversion event on registration
    if (event === 'CompleteRegistration') {
      gtag('event', 'conversion', { send_to: 'AW-18049668578', value: 1.0, currency: 'USD' })
    }
  } catch { /* noop */ }
}

/** Track an analytics event across all configured destinations */
function track(event: AnalyticsEvent | string, options?: TrackOptions) {
  const props = options?.properties ?? {}

  const userId = options?.userId ?? sessionStorage.getItem('rally-analytics-uid') ?? undefined

  if (!options?.skipMeta) sendToMeta(event, props)
  if (!options?.skipGoogle) sendToGoogle(event, props)
  if (!options?.skipSupabase) persistToSupabase(event, props, userId)

  // Always log so events are visible in browser console on staging too
  console.debug('[Analytics]', event, props)
}

/** Identify a user (called after registration or login) */
function identify(userId: string, traits?: Record<string, unknown>) {
  // Store user ID for subsequent events
  sessionStorage.setItem('rally-analytics-uid', userId)

  // Persist acquisition record to Supabase
  const attribution = getAttribution()
  const client = getClient()
  if (client) {
    client.from('user_acquisitions').upsert({
      user_id: userId,
      channel: attribution.channel,
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_term: attribution.utm_term,
      utm_content: attribution.utm_content,
      referrer: attribution.referrer,
      landing_page: attribution.landing_page,
      registered_at: new Date().toISOString(),
      ...traits,
    }, { onConflict: 'user_id' }).then(() => {}, () => {})
  }
}

// ---------------------------------------------------------------------------
// Dashboard data queries
// ---------------------------------------------------------------------------

export interface FunnelStep {
  name: string
  count: number
  rate: number // conversion rate from previous step
}

export interface ChannelMetrics {
  channel: string
  visitors: number
  leads: number
  registrations: number
  active_players: number // played at least 1 match
  spend?: number
  cac?: number
}

export interface CohortRow {
  cohort_week: string
  total_users: number
  retention: number[] // week 0, week 1, week 2, ...
}

export interface DashboardData {
  funnel: FunnelStep[]
  channels: ChannelMetrics[]
  cohorts: CohortRow[]
  totals: {
    total_visitors: number
    total_leads: number
    total_registrations: number
    total_active_players: number
    dau: number
    wau: number
    mau: number
  }
  daily_registrations: Array<{ date: string; count: number; channel: string }>
}

async function fetchDashboardData(dateRange?: { from: string; to: string }): Promise<DashboardData | null> {
  const from = dateRange?.from ?? new Date(Date.now() - 90 * 86400000).toISOString()
  const to = dateRange?.to ?? new Date().toISOString()

  try {
    // Use REST API with anon key to bypass authenticated client RLS issues.
    // The analytics tables have RLS policies for the `anon` role, but the
    // logged-in Supabase client sends requests as `authenticated` role.
    interface AnalyticsEvent { event_name: string; user_id: string | null; session_id: string | null; channel: string | null; created_at: string }
    interface UserAcquisition { user_id: string; channel: string; registered_at: string; [key: string]: unknown }

    const events = await supabaseRest<AnalyticsEvent>('analytics_events', {
      select: 'event_name,user_id,session_id,channel,created_at',
      'created_at': `gte.${from}`,
      order: 'created_at.asc',
    })

    let acquisitions: UserAcquisition[] = []
    try {
      acquisitions = await supabaseRest<UserAcquisition>('user_acquisitions', {
        select: '*',
        'registered_at': `gte.${from}`,
      })
    } catch { /* no acquisitions yet is fine */ }

    console.debug('[Analytics] Dashboard loaded', events.length, 'events,', acquisitions.length, 'acquisitions')

    // Build funnel
    const sessionEvents = new Map<string, Set<string>>()
    for (const e of events) {
      const sid = e.session_id ?? 'unknown'
      if (!sessionEvents.has(sid)) sessionEvents.set(sid, new Set())
      sessionEvents.get(sid)!.add(e.event_name)
    }

    const totalSessions = sessionEvents.size
    const viewContentSessions = [...sessionEvents.values()].filter(s => s.has('ViewContent') || s.has('PageView')).length
    const leadSessions = [...sessionEvents.values()].filter(s => s.has('Lead')).length
    const regSessions = [...sessionEvents.values()].filter(s => s.has('CompleteRegistration')).length
    const matchSessions = [...sessionEvents.values()].filter(s => s.has('MatchPlayed') || s.has('ScoreSubmitted')).length

    const funnel: FunnelStep[] = [
      { name: 'Visitors', count: totalSessions, rate: 100 },
      { name: 'Engaged', count: viewContentSessions, rate: totalSessions > 0 ? (viewContentSessions / totalSessions) * 100 : 0 },
      { name: 'Leads', count: leadSessions, rate: viewContentSessions > 0 ? (leadSessions / viewContentSessions) * 100 : 0 },
      { name: 'Registered', count: regSessions, rate: leadSessions > 0 ? (regSessions / leadSessions) * 100 : 0 },
      { name: 'First Match', count: matchSessions, rate: regSessions > 0 ? (matchSessions / regSessions) * 100 : 0 },
    ]

    // Channel breakdown
    const channelMap = new Map<string, { visitors: Set<string>; leads: Set<string>; registrations: Set<string>; active: Set<string> }>()
    for (const e of events) {
      const ch = e.channel ?? 'direct'
      if (!channelMap.has(ch)) channelMap.set(ch, { visitors: new Set(), leads: new Set(), registrations: new Set(), active: new Set() })
      const bucket = channelMap.get(ch)!
      bucket.visitors.add(e.session_id ?? e.user_id ?? 'anon')
      if (e.event_name === 'Lead') bucket.leads.add(e.user_id ?? e.session_id ?? 'anon')
      if (e.event_name === 'CompleteRegistration') bucket.registrations.add(e.user_id ?? e.session_id ?? 'anon')
      if (e.event_name === 'MatchPlayed' || e.event_name === 'ScoreSubmitted') bucket.active.add(e.user_id ?? 'anon')
    }

    const channels: ChannelMetrics[] = [...channelMap.entries()].map(([channel, data]) => ({
      channel,
      visitors: data.visitors.size,
      leads: data.leads.size,
      registrations: data.registrations.size,
      active_players: data.active.size,
    }))

    // Cohort analysis (weekly cohorts based on registration date)
    const acqs = acquisitions ?? []
    const cohortMap = new Map<string, { users: Set<string> }>()
    for (const a of acqs) {
      const regDate = new Date(a.registered_at)
      const weekStart = getWeekStart(regDate)
      if (!cohortMap.has(weekStart)) cohortMap.set(weekStart, { users: new Set() })
      cohortMap.get(weekStart)!.users.add(a.user_id)
    }

    // For each cohort, calculate retention by checking event activity in subsequent weeks
    const userEvents = new Map<string, string[]>()
    for (const e of events) {
      if (!e.user_id) continue
      if (!userEvents.has(e.user_id)) userEvents.set(e.user_id, [])
      userEvents.get(e.user_id)!.push(e.created_at)
    }

    const cohorts: CohortRow[] = [...cohortMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekStr, { users }]) => {
        const cohortStart = new Date(weekStr)
        const maxWeeks = Math.min(12, Math.ceil((Date.now() - cohortStart.getTime()) / (7 * 86400000)))
        const retention: number[] = []

        for (let w = 0; w < maxWeeks; w++) {
          const weekBegin = new Date(cohortStart.getTime() + w * 7 * 86400000)
          const weekEnd = new Date(weekBegin.getTime() + 7 * 86400000)
          let activeInWeek = 0
          for (const uid of users) {
            const timestamps = userEvents.get(uid) ?? []
            const wasActive = timestamps.some(ts => {
              const t = new Date(ts)
              return t >= weekBegin && t < weekEnd
            })
            if (wasActive) activeInWeek++
          }
          retention.push(users.size > 0 ? Math.round((activeInWeek / users.size) * 100) : 0)
        }

        return {
          cohort_week: weekStr,
          total_users: users.size,
          retention,
        }
      })

    // Daily registrations by channel
    const dailyRegMap = new Map<string, Map<string, number>>()
    for (const e of events) {
      if (e.event_name !== 'CompleteRegistration') continue
      const date = e.created_at.slice(0, 10)
      const ch = e.channel ?? 'direct'
      if (!dailyRegMap.has(date)) dailyRegMap.set(date, new Map())
      const dayMap = dailyRegMap.get(date)!
      dayMap.set(ch, (dayMap.get(ch) ?? 0) + 1)
    }
    const daily_registrations = [...dailyRegMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([date, chMap]) =>
        [...chMap.entries()].map(([channel, count]) => ({ date, channel, count }))
      )

    // Activity totals
    const now = Date.now()
    const dayAgo = new Date(now - 86400000).toISOString()
    const weekAgo = new Date(now - 7 * 86400000).toISOString()
    const monthAgo = new Date(now - 30 * 86400000).toISOString()

    const activeUsers = (range: string) => new Set(
      events.filter(e => e.user_id && e.created_at >= range).map(e => e.user_id)
    ).size

    return {
      funnel,
      channels,
      cohorts,
      totals: {
        total_visitors: totalSessions,
        total_leads: leadSessions,
        total_registrations: regSessions,
        total_active_players: matchSessions,
        dau: activeUsers(dayAgo),
        wau: activeUsers(weekAgo),
        mau: activeUsers(monthAgo),
      },
      daily_registrations,
    }
  } catch (err) {
    console.error('[Analytics] Dashboard fetch failed:', err)
    return null
  }
}

function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Channel spend management (stored in Supabase for persistence)
// ---------------------------------------------------------------------------

export interface ChannelSpend {
  channel: string
  month: string      // YYYY-MM
  spend: number
}

async function saveChannelSpend(channel: string, month: string, spend: number): Promise<void> {
  const client = getClient()
  if (!client) return
  await client.from('channel_spend').upsert(
    { channel, month, spend },
    { onConflict: 'channel,month' }
  )
}

async function getChannelSpend(month?: string): Promise<ChannelSpend[]> {
  const m = month ?? new Date().toISOString().slice(0, 7)
  try {
    return await supabaseRest<ChannelSpend>('channel_spend', {
      select: '*',
      month: `eq.${m}`,
    })
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const analytics = {
  track,
  identify,
  captureAttribution,
  getAttribution,
  fetchDashboardData,
  saveChannelSpend,
  getChannelSpend,
}
