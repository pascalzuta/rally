import { CSSProperties, useMemo } from 'react'
import { PlayerProfile, Trophy } from '../types'
import { useRallyData } from '../context/RallyDataProvider'
import {
  getPlayerRating, getRatingHistory, getPlayerTrophies,
  getCountyLeaderboard,
} from '../store'
import Profile from './Profile'

// ─────────────────────────────────────────────────────────────
// ProfileTabNew — reskinned Profile surface per
// docs/design_handoff_rally_reskin/mocks/ProfileTabV4.jsx.
//
// Shows (top → bottom):
//   1. Hero — gradient-ringed avatar, name, county, rank, bio, pills
//   2. Stats strip — rating, matches, win %, trophies
//   3. Rivals — head-to-head list for opponents played 2+ times
//   4. Season chart — rating history sparkline
//   5. Trophy shelf — earned trophies, dark surface
//   6. Embedded existing <Profile/> for availability editing + logout
//
// Gated behind the `newHome` feature flag.
// ─────────────────────────────────────────────────────────────

interface Props {
  profile: PlayerProfile
  onLogout: () => void
  onNavigate: (tab: 'home' | 'bracket' | 'playnow') => void
  onViewHelp?: () => void
}

function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 360
}

interface Rival {
  opponentId: string
  opponentName: string
  wins: number
  losses: number
  lastResult: 'W' | 'L' | null
  lastDate: string | null
}

function computeRivals(profile: PlayerProfile, tournaments: ReturnType<typeof useRallyData>['tournaments']): Rival[] {
  const stats = new Map<string, Rival>()
  const allMatches: { opponentId: string; opponentName: string; won: boolean; at: string }[] = []
  for (const t of tournaments) {
    for (const m of t.matches) {
      if (!m.completed || !m.winnerId) continue
      const mine = m.player1Id === profile.id || m.player2Id === profile.id
      if (!mine) continue
      const oppId = m.player1Id === profile.id ? m.player2Id : m.player1Id
      if (!oppId) continue
      const oppName = t.players.find(p => p.id === oppId)?.name ?? 'Opponent'
      const won = m.winnerId === profile.id
      allMatches.push({
        opponentId: oppId, opponentName: oppName, won,
        at: m.scoreReportedAt ?? m.scoreConfirmedAt ?? t.createdAt ?? '',
      })
    }
  }
  for (const m of allMatches) {
    const existing = stats.get(m.opponentId)
    if (existing) {
      if (m.won) existing.wins++
      else existing.losses++
      if (m.at && (!existing.lastDate || m.at > existing.lastDate)) {
        existing.lastDate = m.at
        existing.lastResult = m.won ? 'W' : 'L'
      }
    } else {
      stats.set(m.opponentId, {
        opponentId: m.opponentId,
        opponentName: m.opponentName,
        wins: m.won ? 1 : 0,
        losses: m.won ? 0 : 1,
        lastResult: m.won ? 'W' : 'L',
        lastDate: m.at || null,
      })
    }
  }
  return Array.from(stats.values())
    .filter(r => r.wins + r.losses >= 2)
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
    .slice(0, 4)
}

function formatDateShort(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${MONTH[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

// ═══════════════════════════════════════════════════════════

export default function ProfileTabNew(props: Props) {
  const { profile } = props
  const { tournaments } = useRallyData()

  const rating = useMemo(() => getPlayerRating(profile.id, profile.name), [profile.id, profile.name, tournaments])
  const ratingHistory = useMemo(() => getRatingHistory(profile.id), [profile.id, tournaments])
  const trophies = useMemo(() => getPlayerTrophies(profile.id), [profile.id, tournaments])
  const leaderboard = useMemo(() => getCountyLeaderboard(profile.county), [profile.county, tournaments])

  const stats = useMemo(() => {
    let matchesPlayed = 0, wins = 0, losses = 0
    let last30 = 0
    const now = Date.now()
    for (const t of tournaments) {
      for (const m of t.matches) {
        if (!m.completed) continue
        const mine = m.player1Id === profile.id || m.player2Id === profile.id
        if (!mine) continue
        matchesPlayed++
        if (m.winnerId === profile.id) wins++
        else if (m.winnerId) losses++
        const at = m.scoreConfirmedAt ?? m.scoreReportedAt
        if (at && (now - new Date(at).getTime()) < 30 * 24 * 60 * 60 * 1000) last30++
      }
    }
    const winPct = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : null
    const ratingDelta = ratingHistory.length >= 2
      ? Math.round(ratingHistory[ratingHistory.length - 1].rating - ratingHistory[0].rating)
      : 0
    const champTrophies = trophies.filter(t => t.tier === 'champion').length
    return { matchesPlayed, wins, losses, last30, winPct, ratingDelta, champTrophies }
  }, [tournaments, profile.id, ratingHistory, trophies])

  const myRank = useMemo(() => {
    const entry = leaderboard.find(e => e.name.toLowerCase() === profile.name.toLowerCase())
    return entry?.rank ?? null
  }, [leaderboard, profile.name])

  const rivals = useMemo(() => computeRivals(profile, tournaments), [profile, tournaments])

  const sinceLabel = useMemo(() => {
    if (!profile.createdAt) return null
    try {
      const d = new Date(profile.createdAt)
      const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `Since ${MONTH[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`
    } catch {
      return null
    }
  }, [profile.createdAt])

  const pills = useMemo(() => {
    const out: { label: string; primary?: boolean }[] = []
    if (profile.skillLevel) out.push({ label: profile.skillLevel[0].toUpperCase() + profile.skillLevel.slice(1), primary: true })
    out.push({ label: 'Singles', primary: true })
    for (const court of (profile.preferredCourts ?? []).slice(0, 2)) out.push({ label: court })
    return out
  }, [profile])

  return (
    <div style={S.root}>
      {/* ═══ 1 · HERO ═══ */}
      <div style={S.heroWrap}>
        <div style={S.heroAvatarRing}>
          <div style={S.heroAvatarInner}>
            <HeroAvatar name={profile.name} hue={hueFromId(profile.id)} photoUrl={profile.photoUrl} />
          </div>
        </div>
        <div style={S.heroName}>{profile.name}</div>
        <div style={S.heroMeta}>
          <span>{profile.county} county</span>
          {myRank !== null && (
            <>
              <span style={S.dotSep} />
              <span style={{ color: 'var(--rally-green)', fontWeight: 700 }}>#{myRank} of {leaderboard.length}</span>
            </>
          )}
          {sinceLabel && (
            <>
              <span style={S.dotSep} />
              <span>{sinceLabel}</span>
            </>
          )}
        </div>
        {profile.bio && (
          <div style={S.heroBio}>"{profile.bio}"</div>
        )}
        {pills.length > 0 && (
          <div style={S.pillRow}>
            {pills.map((p, i) => <Pill key={i} primary={p.primary}>{p.label}</Pill>)}
          </div>
        )}

        {/* stats strip */}
        <div style={S.statsStrip}>
          <StatBlock value={Math.round(rating.rating).toString()} label="Rating" delta={stats.ratingDelta >= 0 ? `+${stats.ratingDelta}` : `${stats.ratingDelta}`} />
          <StatBlock value={stats.matchesPlayed.toString()} label="Matches" delta={`${stats.last30} · 30d`} />
          <StatBlock value={stats.winPct !== null ? `${stats.winPct}%` : '—'} label="Wins" delta={`${stats.wins}–${stats.losses}`} />
          <StatBlock value={trophies.length.toString()} label="Trophies" delta={stats.champTrophies > 0 ? `${stats.champTrophies} champ` : '—'} />
        </div>
      </div>

      {/* ═══ 2 · RIVALS ═══ */}
      {rivals.length > 0 && (
        <div style={{ padding: '24px 20px 0' }}>
          <SectionTitle>Rivals</SectionTitle>
          <div style={S.listWrap}>
            {rivals.map((r, i) => <RivalRow key={r.opponentId} rival={r} divider={i > 0} />)}
          </div>
        </div>
      )}

      {/* ═══ 3 · SEASON CHART ═══ */}
      {ratingHistory.length >= 2 && (
        <div style={{ padding: '24px 20px 0' }}>
          <SectionTitle>Rating over time</SectionTitle>
          <div style={{ ...S.cardWrap, padding: '16px 16px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div className="rally-num" style={{ fontFamily: 'var(--rally-font-sans)', fontWeight: 800, fontSize: 28, letterSpacing: -0.8, color: 'var(--ink)', lineHeight: 1 }}>
                  {stats.ratingDelta >= 0 ? '+' : ''}{stats.ratingDelta}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3, fontWeight: 600 }}>
                  rating change this season
                </div>
              </div>
              <div className="rally-num" style={{ fontFamily: 'var(--rally-font-sans)', fontWeight: 800, fontSize: 20, color: 'var(--ink)', letterSpacing: -0.4 }}>
                {Math.round(rating.rating)}
              </div>
            </div>
            <SeasonChart history={ratingHistory} />
          </div>
        </div>
      )}

      {/* ═══ 4 · TROPHY SHELF ═══ */}
      {trophies.length > 0 && (
        <div style={{ padding: '24px 20px 0' }}>
          <SectionTitle>Trophy shelf</SectionTitle>
          <TrophyShelf trophies={trophies} />
        </div>
      )}

      {/* ═══ 5 · Embed existing Profile for availability + logout ═══ */}
      <div style={{ padding: '32px 0 0' }}>
        <div style={{ padding: '0 20px' }}>
          <SectionTitle>Availability & settings</SectionTitle>
        </div>
        <div style={S.embeddedProfile}>
          <Profile {...props} />
        </div>
      </div>
    </div>
  )
}

// ═══ Sub-components ═══

function HeroAvatar({ name, hue, photoUrl }: { name: string; hue: number; photoUrl?: string }) {
  const size = 88
  const initials = (name || '??').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: 26, objectFit: 'cover', display: 'block' }}
      />
    )
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 26,
      background: `oklch(0.58 0.17 ${hue})`,
      color: `oklch(0.98 0.02 ${hue})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--rally-font-sans)',
      fontWeight: 800, fontSize: size * 0.38, letterSpacing: -0.5,
      boxShadow: `inset 0 -${Math.max(3, size * 0.04)}px 0 oklch(0.42 0.15 ${hue})`,
    }}>
      {initials}
    </div>
  )
}

function Pill({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600,
      padding: '4px 10px', borderRadius: 999,
      background: primary ? 'var(--rally-green)' : 'rgba(255,255,255,0.7)',
      color: primary ? '#fff' : 'var(--ink-2)',
      border: primary ? 'none' : '1px solid var(--hairline-2)',
    }}>{children}</div>
  )
}

function StatBlock({ value, label, delta }: { value: string; label: string; delta: string }) {
  return (
    <div style={{ padding: '14px 4px', textAlign: 'center', borderLeft: '1px solid var(--hairline-2)' }}>
      <div className="rally-num" style={{
        fontFamily: 'var(--rally-font-sans)', fontWeight: 800, fontSize: 20,
        letterSpacing: -0.4, color: 'var(--ink)', lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4, fontWeight: 600 }}>{label}</div>
      <div className="rally-num" style={{
        fontSize: 10, color: 'var(--rally-green)', marginTop: 3, fontWeight: 700,
      }}>{delta}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700,
      letterSpacing: 0.08 * 11, textTransform: 'uppercase',
      color: 'var(--ink-3)', marginBottom: 10,
    }}>{children}</div>
  )
}

function RivalRow({ rival, divider }: { rival: Rival; divider?: boolean }) {
  const total = rival.wins + rival.losses
  const winPct = total > 0 ? (rival.wins / total) * 100 : 0
  const tag = rival.wins > rival.losses ? { label: 'On top',    color: 'var(--rally-green)' }
            : rival.wins < rival.losses ? { label: 'Nemesis',   color: 'var(--urgent)' }
                                        : { label: 'Dead even', color: 'var(--ink-3)' }
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px',
      borderTop: divider ? '1px solid var(--hairline-2)' : 'none',
    }}>
      <SmallAvatar name={rival.opponentName} hue={hueFromId(rival.opponentId)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
          fontWeight: 700, fontSize: 14, color: 'var(--ink)',
        }}>
          {rival.opponentName}
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 0.06 * 10,
            textTransform: 'uppercase', color: tag.color,
          }}>{tag.label}</span>
        </div>
        {rival.lastResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 800,
              color: rival.lastResult === 'W' ? 'var(--confirmed)' : 'var(--urgent)',
              background: rival.lastResult === 'W' ? 'var(--confirmed-tint)' : 'var(--urgent-tint)',
              padding: '1px 5px', borderRadius: 4,
            }}>{rival.lastResult}</span>
            <span className="rally-num" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {formatDateShort(rival.lastDate)}
            </span>
          </div>
        )}
      </div>
      <div style={{ minWidth: 92, textAlign: 'right' }}>
        <div className="rally-num" style={{
          fontFamily: 'var(--rally-font-sans)', fontWeight: 800, fontSize: 16,
          letterSpacing: -0.3,
          color: rival.wins > rival.losses ? 'var(--confirmed)'
               : rival.wins < rival.losses ? 'var(--urgent)' : 'var(--ink-2)',
        }}>
          {rival.wins}–{rival.losses}
        </div>
        <div style={{
          marginTop: 4, height: 4, background: 'var(--hairline-2)',
          borderRadius: 999, overflow: 'hidden', display: 'flex',
        }}>
          <div style={{ width: `${winPct}%`, background: 'var(--rally-green)' }} />
        </div>
      </div>
    </div>
  )
}

function SmallAvatar({ name, hue }: { name: string; hue: number }) {
  const size = 40
  const initials = (name || '??').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `oklch(0.58 0.17 ${hue})`,
      color: `oklch(0.98 0.02 ${hue})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--rally-font-sans)',
      fontWeight: 700, fontSize: size * 0.38, letterSpacing: -0.5,
      flexShrink: 0,
      boxShadow: `inset 0 -${Math.max(2, size * 0.04)}px 0 oklch(0.42 0.15 ${hue})`,
    }}>
      {initials}
    </div>
  )
}

function SeasonChart({ history }: { history: { rating: number; timestamp: string }[] }) {
  const points = history.map(h => h.rating)
  const min = Math.min(...points) - 20
  const max = Math.max(...points) + 20
  const w = 320, h = 88
  const path = points.map((p, i) => {
    const x = (i / Math.max(1, points.length - 1)) * w
    const y = h - ((p - min) / Math.max(1, max - min)) * h
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const area = path + ` L${w},${h} L0,${h} Z`
  const lastX = w
  const lastY = h - ((points[points.length - 1] - min) / Math.max(1, max - min)) * h
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 88 }}>
      <defs>
        <linearGradient id="rallyProfileArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1F7A4D" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#1F7A4D" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.33, 0.66].map(t => (
        <line key={t} x1="0" y1={h * t} x2={w} y2={h * t} stroke="var(--hairline-2)" strokeWidth="1" />
      ))}
      <path d={area} fill="url(#rallyProfileArea)" />
      <path d={path} fill="none" stroke="var(--rally-green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX - 2} cy={lastY} r="9" fill="var(--rally-green)" opacity="0.18" />
      <circle cx={lastX - 2} cy={lastY} r="4" fill="var(--rally-green)" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}

function TrophyShelf({ trophies }: { trophies: Trophy[] }) {
  const top = trophies.slice(0, 6)
  return (
    <div style={S.trophyShelf}>
      <div style={{
        position: 'absolute', left: 18, right: 18, bottom: 42,
        height: 1, background: 'rgba(255,255,255,0.12)',
      }} />
      <div style={{
        display: 'flex', gap: 18, justifyContent: top.length <= 3 ? 'space-around' : 'flex-start',
        alignItems: 'flex-end', position: 'relative', paddingBottom: 36, flexWrap: 'wrap',
      }}>
        {top.map(t => <TrophyBlock key={t.id} trophy={t} />)}
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 10,
        textAlign: 'center', fontSize: 10, fontWeight: 700,
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 0.08 * 10, textTransform: 'uppercase',
      }}>{trophies.length} earned</div>
    </div>
  )
}

function TrophyBlock({ trophy }: { trophy: Trophy }) {
  const size = trophy.tier === 'champion' ? 56 : trophy.tier === 'finalist' ? 48 : 40
  const color = trophy.tier === 'champion' ? '#F2C94C'
              : trophy.tier === 'finalist' ? '#C7CBD1'
                                           : '#CD7F32'
  const label = trophy.tier === 'champion' ? 'Champion'
              : trophy.tier === 'finalist' ? 'Finalist'
                                           : 'Semi'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, position: 'relative', width: 84 }}>
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d="M7 3h10v4a5 5 0 0 1-10 0V3ZM5 5h2v2a4 4 0 0 0 .5 1.9A3 3 0 0 1 5 6V5Zm14 0v1a3 3 0 0 1-2.5 2.9A4 4 0 0 0 17 7V5h2Zm-7 10a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h2v-2a1 1 0 0 1 1-1h1Z"
          fill={color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
      </svg>
      <div style={{ position: 'absolute', bottom: 26, left: '50%', transform: 'translateX(-50%)', width: 36, height: 6, background: 'rgba(255,210,120,0.25)', filter: 'blur(6px)' }} />
      <div style={{
        fontSize: 10, fontWeight: 800, color: '#fff',
        letterSpacing: -0.1, textAlign: 'center', position: 'relative',
        maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{trophy.tournamentName}</div>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 0.08 * 10,
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
        position: 'relative',
      }}>{label}</div>
    </div>
  )
}

// ═══ Styles ═══

const S: Record<string, CSSProperties> = {
  root: {
    minHeight: '100%',
    background: 'var(--canvas)',
    paddingBottom: 32,
  },
  heroWrap: {
    background: 'var(--canvas)',
    paddingTop: 20, paddingBottom: 18,
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 20px 0', textAlign: 'center',
  },
  heroAvatarRing: {
    padding: 3, borderRadius: 28,
    background: 'conic-gradient(from 120deg, #1F7A4D, #3FBF7E, #16603A, #1F7A4D)',
  },
  heroAvatarInner: {
    padding: 2, background: '#fff', borderRadius: 26,
  },
  heroName: {
    fontFamily: 'var(--rally-font-sans)', fontWeight: 800, fontSize: 24,
    letterSpacing: -0.5, marginTop: 12, color: 'var(--ink)',
  },
  heroMeta: {
    fontSize: 13, color: 'var(--ink-3)', marginTop: 2,
    display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dotSep: {
    width: 3, height: 3, borderRadius: 999, background: 'var(--ink-4)',
  } as CSSProperties,
  heroBio: {
    marginTop: 12, fontSize: 14, color: 'var(--ink-2)',
    lineHeight: 1.45, maxWidth: 320,
  },
  pillRow: {
    display: 'flex', gap: 6, flexWrap: 'wrap',
    justifyContent: 'center', marginTop: 12,
  },
  statsStrip: {
    margin: '18px 0 0',
    width: '100%', maxWidth: 520,
    background: 'var(--surface)',
    border: '1px solid var(--hairline-2)', borderRadius: 18,
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
  },
  listWrap: {
    background: 'var(--surface)', borderRadius: 18,
    border: '1px solid var(--hairline-2)', overflow: 'hidden',
    boxShadow: 'var(--rally-shadow-card)',
  },
  cardWrap: {
    background: 'var(--surface)', borderRadius: 18,
    border: '1px solid var(--hairline-2)',
    boxShadow: 'var(--rally-shadow-card)',
  },
  trophyShelf: {
    background: 'linear-gradient(170deg, #1B1411 0%, #0E1421 100%)',
    borderRadius: 20, padding: '22px 18px 14px',
    position: 'relative', overflow: 'hidden',
  },
  embeddedProfile: {
    // The embedded Profile component renders its own padded layout; strip
    // the redundant top padding so the "Availability & settings" header
    // sits flush with the first section of the existing UI.
    marginTop: 8,
  },
}
