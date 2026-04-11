import { useEffect, useMemo, useState } from 'react'
import type { Tournament, Trophy, TrophyTier } from '../types'

// --- Tier model ---

/**
 * A "victory tier" is how the celebration framing scales with the player's
 * finish. The three trophy tiers get the full podium treatment; everyone
 * else (group-stage finishers) gets the quieter group-tier card.
 */
export type VictoryTier = TrophyTier | 'group'

const TIER_COLORS: Record<VictoryTier, { primary: string; highlight: string; shadow: string; glow: string }> = {
  champion:     { primary: '#D4AF37', highlight: '#F6E27A', shadow: '#9A7C1E', glow: 'rgba(212, 175, 55, 0.35)' },
  finalist:     { primary: '#C0C0C0', highlight: '#E4E4E4', shadow: '#8A8A8A', glow: 'rgba(192, 192, 192, 0.35)' },
  semifinalist: { primary: '#CD7F32', highlight: '#E0A46C', shadow: '#8C5421', glow: 'rgba(205, 127, 50, 0.30)' },
  group:        { primary: '#2A5BD7', highlight: '#7A9BE8', shadow: '#1E4399', glow: 'rgba(42, 91, 215, 0.20)' },
}

const TIER_TITLE: Record<VictoryTier, string> = {
  champion: 'Champion',
  finalist: 'Finalist',
  semifinalist: 'Semifinalist',
  group: 'Tournament Played',
}

const TIER_EYEBROW: Record<VictoryTier, string> = {
  champion: '1ST PLACE',
  finalist: '2ND PLACE',
  semifinalist: 'SEMIFINALS',
  group: 'GROUP STAGE',
}

// --- Stats extraction ---

interface PlayerStats {
  matchesPlayed: number
  matchesWon: number
  setsWon: number
  setsLost: number
}

function computePlayerStats(tournament: Tournament, playerId: string): PlayerStats {
  let matchesPlayed = 0
  let matchesWon = 0
  let setsWon = 0
  let setsLost = 0
  for (const m of tournament.matches) {
    if (!m.completed) continue
    if (m.player1Id !== playerId && m.player2Id !== playerId) continue
    matchesPlayed++
    if (m.winnerId === playerId) matchesWon++
    const isP1 = m.player1Id === playerId
    for (let i = 0; i < m.score1.length; i++) {
      const mine = isP1 ? m.score1[i] : m.score2[i]
      const theirs = isP1 ? m.score2[i] : m.score1[i]
      if (mine > theirs) setsWon++
      else if (theirs > mine) setsLost++
    }
  }
  return { matchesPlayed, matchesWon, setsWon, setsLost }
}

// --- Trophy SVG (reused sizing, enlarged for card) ---

function BigTrophy({ tier, size = 96 }: { tier: VictoryTier; size?: number }) {
  const c = TIER_COLORS[tier]
  if (tier === 'group') {
    // Group tier: a tennis ball — unambiguous, friendly, non-podium energy
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <defs>
          <radialGradient id="ball-gradient" cx="0.35" cy="0.35" r="0.75">
            <stop offset="0%" stopColor="#E8F25A" />
            <stop offset="60%" stopColor="#C4D91F" />
            <stop offset="100%" stopColor="#8FA013" />
          </radialGradient>
        </defs>
        <circle cx="24" cy="24" r="18" fill="url(#ball-gradient)" />
        <path d="M8 18 Q24 26 40 18" stroke="#FFFFFF" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.92" />
        <path d="M8 30 Q24 22 40 30" stroke="#FFFFFF" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.92" />
        <circle cx="24" cy="24" r="18" fill="none" stroke={c.primary} strokeWidth="0.8" opacity="0.4" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`victory-trophy-${tier}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.highlight} />
          <stop offset="50%" stopColor={c.primary} />
          <stop offset="100%" stopColor={c.shadow} />
        </linearGradient>
      </defs>
      <path d="M12 9h24v5c0 8.5-5 14.5-12 17-7-2.5-12-8.5-12-17V9z" fill={`url(#victory-trophy-${tier})`} />
      <path d="M12 11H8c0 4.8 1.8 8.4 3.6 9.6" stroke={c.primary} strokeWidth="1.8" fill="none" />
      <path d="M36 11h4c0 4.8-1.8 8.4-3.6 9.6" stroke={c.primary} strokeWidth="1.8" fill="none" />
      <rect x="21" y="30" width="6" height="6" rx="1" fill={c.shadow} />
      <rect x="15" y="36" width="18" height="4" rx="2" fill={c.primary} />
      <ellipse cx="19" cy="16" rx="3.5" ry="6" fill="white" opacity="0.18" />
    </svg>
  )
}

// --- Canonical share card (used inline AND as the share-image source) ---

interface VictoryShareCardProps {
  tier: VictoryTier
  playerName: string
  tournamentName: string
  county: string
  stats: PlayerStats
  finalMatch?: { opponentName: string; score: string; won: boolean }
  date: string
}

export function VictoryShareCard({
  tier,
  playerName,
  tournamentName,
  county,
  stats,
  finalMatch,
  date,
}: VictoryShareCardProps) {
  const c = TIER_COLORS[tier]
  const prettyDate = useMemo(() => {
    try {
      return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return date
    }
  }, [date])

  return (
    <div className={`victory-card victory-card--${tier}`} style={{ ['--tier-primary' as string]: c.primary, ['--tier-highlight' as string]: c.highlight, ['--tier-shadow' as string]: c.shadow, ['--tier-glow' as string]: c.glow }}>
      <div className="victory-card__glow" aria-hidden="true" />
      <div className="victory-card__eyebrow">{TIER_EYEBROW[tier]}</div>
      <div className="victory-card__trophy">
        <BigTrophy tier={tier} size={112} />
      </div>
      <div className="victory-card__title">{TIER_TITLE[tier]}</div>
      <div className="victory-card__player">{playerName}</div>
      <div className="victory-card__tournament">
        {tournamentName}
        <span className="victory-card__county">· {county}</span>
      </div>

      <div className="victory-card__stats">
        <div className="victory-card__stat">
          <div className="victory-card__stat-value">{stats.matchesWon}<span className="victory-card__stat-divider">/</span>{stats.matchesPlayed}</div>
          <div className="victory-card__stat-label">Matches Won</div>
        </div>
        <div className="victory-card__stat">
          <div className="victory-card__stat-value">{stats.setsWon}<span className="victory-card__stat-divider">/</span>{stats.setsWon + stats.setsLost}</div>
          <div className="victory-card__stat-label">Sets Won</div>
        </div>
      </div>

      {finalMatch && (
        <div className="victory-card__final">
          <div className="victory-card__final-label">{finalMatch.won ? 'Beat' : 'Lost to'} {finalMatch.opponentName}</div>
          <div className="victory-card__final-score">{finalMatch.score}</div>
        </div>
      )}

      <div className="victory-card__footer">
        <span className="victory-card__date">{prettyDate}</span>
        <span className="victory-card__brand">play-rally.com</span>
      </div>
    </div>
  )
}

// --- Full victory screen overlay ---

interface VictoryScreenProps {
  tournament: Tournament
  currentPlayerId: string
  currentPlayerName: string
  trophy?: Trophy  // undefined => group tier
  onDismiss: () => void
}

function buildShareText(tier: VictoryTier, playerName: string, tournamentName: string): string {
  const firstName = playerName.split(' ')[0]
  switch (tier) {
    case 'champion':
      return `${firstName} just won ${tournamentName}. 🏆\nPlay local tennis at play-rally.com`
    case 'finalist':
      return `${firstName} made the final at ${tournamentName}. 🥈\nPlay local tennis at play-rally.com`
    case 'semifinalist':
      return `${firstName} reached the semis at ${tournamentName}. 🥉\nPlay local tennis at play-rally.com`
    case 'group':
      return `${firstName} played ${tournamentName} on Rally. 🎾\nPlay local tennis at play-rally.com`
  }
}

export function VictoryScreen({ tournament, currentPlayerId, currentPlayerName, trophy, onDismiss }: VictoryScreenProps) {
  const tier: VictoryTier = trophy?.tier ?? 'group'
  const stats = useMemo(() => computePlayerStats(tournament, currentPlayerId), [tournament, currentPlayerId])
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const handleShare = async () => {
    const text = buildShareText(tier, currentPlayerName, tournament.name)
    try {
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        await navigator.share({ title: 'Rally', text, url: 'https://play-rally.com' })
        return
      }
    } catch {
      // user cancelled or share failed — fall through to copy
    }
    try {
      await navigator.clipboard.writeText(text + '\nhttps://play-rally.com')
      setShareFeedback('Copied to clipboard')
      setTimeout(() => setShareFeedback(null), 2000)
    } catch {
      setShareFeedback('Could not copy')
      setTimeout(() => setShareFeedback(null), 2000)
    }
  }

  const isPodium = tier !== 'group'

  return (
    <div className={`victory-overlay victory-overlay--${isPodium ? 'podium' : 'group'}`} role="dialog" aria-modal="true" aria-label={`${TIER_TITLE[tier]} celebration`} onClick={onDismiss}>
      {isPodium && <ConfettiBurst tier={tier} />}
      <div className="victory-overlay__inner" onClick={e => e.stopPropagation()}>
        <button className="victory-overlay__close" onClick={onDismiss} aria-label="Close celebration">×</button>

        {isPodium && (
          <div className="victory-overlay__headline">
            <div className="victory-overlay__headline-label">YOU FINISHED</div>
            <div className="victory-overlay__headline-tier">{TIER_TITLE[tier].toUpperCase()}</div>
          </div>
        )}
        {!isPodium && (
          <div className="victory-overlay__headline victory-overlay__headline--group">
            <div className="victory-overlay__headline-label">WELL PLAYED</div>
            <div className="victory-overlay__headline-tier">Tournament complete</div>
          </div>
        )}

        <VictoryShareCard
          tier={tier}
          playerName={currentPlayerName}
          tournamentName={tournament.name}
          county={tournament.county}
          stats={stats}
          finalMatch={trophy?.finalMatch}
          date={tournament.date}
        />

        <div className="victory-overlay__actions">
          <button className="victory-overlay__share" onClick={handleShare}>
            Share
          </button>
          <button className="victory-overlay__done" onClick={onDismiss}>
            Done
          </button>
        </div>

        {shareFeedback && <div className="victory-overlay__toast" role="status">{shareFeedback}</div>}
      </div>
    </div>
  )
}

// --- Confetti burst (CSS-only, deterministic seeded positions) ---

function ConfettiBurst({ tier }: { tier: VictoryTier }) {
  const c = TIER_COLORS[tier]
  // 24 pieces, fixed angles so the layout is stable across re-renders
  const pieces = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2
    const distance = 40 + (i % 5) * 12
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance
    const colors = [c.primary, c.highlight, c.shadow, '#ffffff']
    const color = colors[i % colors.length]
    const rotate = (i * 37) % 360
    const delay = (i % 8) * 40
    return { x, y, color, rotate, delay, key: i }
  })
  return (
    <div className="victory-confetti" aria-hidden="true">
      {pieces.map(p => (
        <span
          key={p.key}
          className="victory-confetti__piece"
          style={{
            ['--dx' as string]: `${p.x}vw`,
            ['--dy' as string]: `${p.y}vh`,
            ['--rot' as string]: `${p.rotate}deg`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}ms`,
          }}
        />
      ))}
    </div>
  )
}

// --- Dismissal tracking ---

const DISMISS_KEY_PREFIX = 'rally-victory-dismissed:'
function dismissKey(tournamentId: string, playerId: string): string {
  return `${DISMISS_KEY_PREFIX}${tournamentId}:${playerId}`
}

export function isVictoryDismissed(tournamentId: string, playerId: string): boolean {
  try {
    return localStorage.getItem(dismissKey(tournamentId, playerId)) === '1'
  } catch {
    return false
  }
}

export function markVictoryDismissed(tournamentId: string, playerId: string): void {
  try {
    localStorage.setItem(dismissKey(tournamentId, playerId), '1')
  } catch {
    // localStorage unavailable — silent fail (worst case: screen shows again)
  }
}
