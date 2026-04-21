import { CSSProperties, useMemo } from 'react'
import { PlayerProfile, Tournament, Match, MatchProposal } from '../types'
import { getMatchCardView } from '../matchCardModel'
import { getPlayerRating } from '../store'
import { formatDateCompact, formatHourCompact } from '../dateUtils'

// ─────────────────────────────────────────────────────────────
// HomeTabNew — reskinned home surface per
// docs/design_handoff_rally_reskin/mocks/HomeTab.jsx.
//
// Gated behind the `newHome` feature flag. Wired to Rally's real
// data (Tournament/Match/MatchSchedule); some mock-only fields
// (hue, H2H, courts, explicit deadlines) degrade gracefully.
// ─────────────────────────────────────────────────────────────

interface Props {
  profile: PlayerProfile
  tournaments: Tournament[]
  onViewTournament: (id: string) => void
  onViewMatch: (tournamentId: string, matchId: string) => void
  onViewOffers?: () => void
  onLogout?: () => void
}

const DAY_SHORT_UPPER: Record<string, string> = {
  sunday: 'SUN', monday: 'MON', tuesday: 'TUE', wednesday: 'WED',
  thursday: 'THU', friday: 'FRI', saturday: 'SAT',
}
const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** Derive a deterministic hue (0–360) from an id — for avatar color. */
function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % 360
}

function nextDateFor(dayOfWeek: string): Date {
  const target = DAY_INDEX[dayOfWeek] ?? 1
  const now = new Date()
  const diff = (target - now.getDay() + 7) % 7
  const d = new Date(now)
  d.setDate(now.getDate() + diff)
  return d
}

interface ClassifiedMatch {
  tournament: Tournament
  match: Match
  state: 'needs' | 'confirmed' | 'waiting'
  priority: number
  opponentId: string | null
  opponentName: string
}

function classifyMatch(t: Tournament, m: Match, playerId: string): ClassifiedMatch | null {
  if (!m.player1Id || !m.player2Id) return null
  const mine = m.player1Id === playerId || m.player2Id === playerId
  if (!mine) return null
  const view = getMatchCardView(t, m, playerId)
  if (!view.isMyMatch || m.completed) return null

  const opponentId = view.opponentId
  const opponentName = view.opponentName ?? 'Opponent'

  let state: ClassifiedMatch['state']
  if (view.key === 'confirmed') state = 'confirmed'
  else if (view.showOnHome) state = 'needs'
  else state = 'waiting'

  return { tournament: t, match: m, state, priority: view.priority, opponentId, opponentName }
}

// ═══════════════════════════════════════════════════════════

export default function HomeTabNew({
  profile, tournaments, onViewTournament, onViewMatch, onViewOffers, onLogout,
}: Props) {
  const activeTournaments = useMemo(
    () => tournaments.filter(t =>
      (t.status === 'in-progress' || t.status === 'scheduling') &&
      t.players.some(p => p.id === profile.id)
    ),
    [tournaments, profile.id]
  )

  const classified = useMemo(() => {
    const out: ClassifiedMatch[] = []
    for (const t of activeTournaments) {
      for (const m of t.matches) {
        const c = classifyMatch(t, m, profile.id)
        if (c) out.push(c)
      }
    }
    out.sort((a, b) => a.priority - b.priority)
    return out
  }, [activeTournaments, profile.id])

  // Pick the most urgent 'needs' match as the hero.
  const heroIdx = classified.findIndex(c => c.state === 'needs')
  const hero = heroIdx >= 0 ? classified[heroIdx] : null
  const rest = classified.filter((_, i) => i !== heroIdx)

  const counts = useMemo(() => {
    let upcoming = 0, needs = 0, past = 0
    for (const t of activeTournaments) {
      for (const m of t.matches) {
        const mine = m.player1Id === profile.id || m.player2Id === profile.id
        if (!mine) continue
        if (m.completed) { past++; continue }
        if (!m.player1Id || !m.player2Id) continue
        upcoming++
        const view = getMatchCardView(t, m, profile.id)
        if (view.showOnHome) needs++
      }
    }
    return { upcoming, needs, past }
  }, [activeTournaments, profile.id])

  // Tournament mini strip — show first active tournament with matches-played count
  const miniTournament = activeTournaments[0] ?? null
  const miniStats = useMemo(() => {
    if (!miniTournament) return null
    const played = miniTournament.matches.filter(m => m.completed).length
    const total = miniTournament.matches.filter(m => m.player1Id && m.player2Id).length
    const rank = miniTournament.players.findIndex(p => p.id === profile.id) + 1
    return { played, total, rank }
  }, [miniTournament, profile.id])

  const greeting = useMemo(() => {
    const now = new Date()
    return {
      eyebrow: `${WEEKDAY_LONG[now.getDay()]} · ${MONTH_LONG[now.getMonth()]} ${now.getDate()}`,
      firstName: profile.name.split(' ')[0] || profile.name,
    }
  }, [profile.name])

  return (
    <div style={S.root} className="rally-no-scrollbar">
      {/* ── Top bar ── */}
      <div style={S.topBar}>
        <div>
          <div style={S.topBarEyebrow}>{greeting.eyebrow}</div>
          <div style={S.topBarTitle}>Hi, {greeting.firstName}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <InboxBell count={counts.needs} onClick={onViewOffers} />
          <Avatar name={profile.name} size={40} hue={hueFromId(profile.id)} />
        </div>
      </div>

      {/* ── Filter row ── */}
      <HomeFilterRow counts={counts} />

      {/* ── URGENT hero ── */}
      {hero && (
        <div style={{ padding: '14px 16px 0' }}>
          <UrgentHeroCard
            match={hero}
            currentPlayerId={profile.id}
            onOpen={() => onViewMatch(hero.tournament.id, hero.match.id)}
          />
        </div>
      )}

      {/* ── Queue cards ── */}
      {rest.length > 0 && (
        <div style={{ padding: '10px 16px 0', display: 'grid', gap: 10 }}>
          {rest.map(c => (
            <HomeQueueCard
              key={`${c.tournament.id}-${c.match.id}`}
              item={c}
              currentPlayerId={profile.id}
              onOpen={() => onViewMatch(c.tournament.id, c.match.id)}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!hero && rest.length === 0 && (
        <div style={{ padding: '14px 16px 0' }}>
          <div style={{
            ...S.cardBase, padding: 20,
            textAlign: 'center', color: 'var(--ink-3)', fontSize: 14,
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>🎾</div>
            No matches in the queue yet.
            {miniTournament && (
              <div style={{ marginTop: 4, fontSize: 12 }}>
                You're in <strong style={{ color: 'var(--ink)' }}>{miniTournament.name}</strong> — check the Tournament tab.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tournament mini strip ── */}
      {miniTournament && miniStats && (
        <div style={{ padding: '18px 16px 0' }}>
          <TournamentMini
            name={miniTournament.name}
            played={miniStats.played}
            total={miniStats.total}
            rank={miniStats.rank}
            onClick={() => onViewTournament(miniTournament.id)}
          />
        </div>
      )}

      {/* ── Sign out (parity with existing Home) ── */}
      {onLogout && (
        <div style={{ padding: '24px 16px 0' }}>
          <button
            onClick={() => { if (confirm('Sign out? You can sign back in with your email.')) onLogout() }}
            style={{
              width: '100%', padding: '12px 16px',
              background: 'var(--surface)', color: 'var(--ink-3)',
              border: '1px solid var(--hairline-2)',
              borderRadius: 14, fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ═══ Filter row ═══

function HomeFilterRow({ counts }: { counts: { upcoming: number; needs: number; past: number } }) {
  const tabs = [
    { id: 'upcoming', label: 'Upcoming',  count: counts.upcoming, active: true },
    { id: 'needs',    label: 'Needs you', count: counts.needs },
    { id: 'past',     label: 'Past',      count: counts.past },
  ]
  return (
    <div style={{
      display: 'flex', gap: 6, padding: '4px 20px 0',
      borderBottom: '1px solid var(--hairline-2)',
    }}>
      {tabs.map(t => (
        <div key={t.id} style={{
          padding: '10px 4px', position: 'relative',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, fontWeight: 700,
          color: t.active ? 'var(--ink)' : 'var(--ink-3)',
          borderBottom: t.active ? '2px solid var(--rally-green)' : '2px solid transparent',
          marginBottom: -1,
        }}>
          {t.label}
          <span className="rally-num" style={{
            fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 999,
            background: t.active ? 'var(--rally-green)' : 'var(--hairline-2)',
            color: t.active ? '#fff' : 'var(--ink-3)',
            minWidth: 18, textAlign: 'center',
          }}>{t.count}</span>
        </div>
      ))}
    </div>
  )
}

// ═══ Urgent hero card ═══

function UrgentHeroCard({
  match, currentPlayerId, onOpen,
}: { match: ClassifiedMatch; currentPlayerId: string; onOpen: () => void }) {
  const opponentRating = match.opponentId
    ? Math.round(getPlayerRating(match.opponentId, match.opponentName).rating)
    : null

  const pendingProposals: MatchProposal[] = (match.match.schedule?.proposals ?? [])
    .filter(p => p.status === 'pending')
    .slice(0, 3)

  const view = getMatchCardView(match.tournament, match.match, currentPlayerId)
  const deadline =
    view.key === 'respond-now' ? 'Respond now' :
    view.key === 'needs-response' ? 'Needs response' :
    view.key === 'needs-scheduling' ? 'Needs a time' : null

  return (
    <div
      className="rally-tappable"
      onClick={onOpen}
      style={{
        ...S.cardBase,
        borderRadius: 22,
        boxShadow: 'var(--rally-shadow-hero)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '14px 18px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10,
            textTransform: 'uppercase', color: 'var(--urgent)',
            background: 'var(--urgent-tint)',
            padding: '3px 7px', borderRadius: 5,
          }}>
            <Pulse /> Needs you
          </div>
          {deadline && (
            <div style={{ fontSize: 11, color: 'var(--urgent)', fontWeight: 700 }}>{deadline}</div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Avatar name={match.opponentName} size={48} hue={hueFromId(match.opponentId ?? match.opponentName)} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', letterSpacing: -0.3 }}>
              {match.opponentName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {opponentRating !== null && <><span className="rally-num">{opponentRating}</span> · </>}
              Round {match.match.round} · {match.tournament.name}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.4 }}>
          {pendingProposals.length > 0 ? (
            <>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Pick a time that works for both of you</span>
              {' '}— tap a slot to lock it in.
            </>
          ) : (
            <>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Set a match time with {match.opponentName.split(' ')[0]}</span>
              {' '}— tap to open scheduling.
            </>
          )}
        </div>
      </div>

      {pendingProposals.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, pendingProposals.length)}, 1fr)`, gap: 6,
          padding: '0 14px 14px',
        }}>
          {pendingProposals.map((p, i) => {
            const date = nextDateFor(p.day)
            return (
              <HeroTimeChip
                key={p.id}
                day={DAY_SHORT_UPPER[p.day] ?? p.day.slice(0, 3).toUpperCase()}
                date={String(date.getDate())}
                time={formatHourCompact(p.startHour)}
                featured={i === 0}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function HeroTimeChip({ day, date, time, featured }: { day: string; date: string; time: string; featured?: boolean }) {
  return (
    <div style={{
      padding: '10px 8px 9px', borderRadius: 12, textAlign: 'center',
      background: featured ? 'var(--rally-green)' : 'var(--surface)',
      border: featured ? 'none' : '1px solid var(--hairline)',
      color: featured ? '#fff' : 'var(--ink)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.04,
        opacity: featured ? 0.85 : 0.55,
      }}>{day} · {date}</div>
      <div className="rally-num" style={{
        fontFamily: 'var(--rally-font-sans)', fontSize: 19, fontWeight: 800,
        letterSpacing: -0.4, lineHeight: 1.1, marginTop: 3,
      }}>{time}</div>
      <div style={{
        fontSize: 9, fontWeight: 600,
        opacity: featured ? 0.9 : 0.5, marginTop: 3,
        letterSpacing: 0.04,
      }}>BOTH FREE</div>
    </div>
  )
}

// ═══ Queue card ═══

function HomeQueueCard({
  item, currentPlayerId, onOpen,
}: { item: ClassifiedMatch; currentPlayerId: string; onOpen: () => void }) {
  const opponentRating = item.opponentId
    ? Math.round(getPlayerRating(item.opponentId, item.opponentName).rating)
    : null
  const view = getMatchCardView(item.tournament, item.match, currentPlayerId)

  const pendingProposals: MatchProposal[] = (item.match.schedule?.proposals ?? [])
    .filter(p => p.status === 'pending')
    .slice(0, 3)

  const confirmed = item.match.schedule?.confirmedSlot
  const waitingNote = view.supporting ?? 'Waiting on opponent'

  return (
    <div
      className="rally-tappable"
      onClick={onOpen}
      style={{ ...S.cardBase, padding: '14px 16px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar name={item.opponentName} size={40} hue={hueFromId(item.opponentId ?? item.opponentName)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', letterSpacing: -0.2 }}>
              {item.opponentName}
            </div>
            {opponentRating !== null && (
              <div className="rally-num" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{opponentRating}</div>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
            Round {item.match.round} · {item.tournament.name}
          </div>
        </div>
        <HomeStateChip state={item.state} />
      </div>

      {item.state === 'needs' && pendingProposals.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="rally-eyebrow" style={{ marginBottom: 8 }}>Pick a slot — both free</div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(3, pendingProposals.length)}, 1fr)`,
            gap: 6,
          }}>
            {pendingProposals.map((p, i) => (
              <QueueTimeChip
                key={p.id}
                day={DAY_SHORT_UPPER[p.day] ?? p.day.slice(0, 3).toUpperCase()}
                time={formatHourCompact(p.startHour)}
                featured={i === 0}
              />
            ))}
          </div>
        </div>
      )}

      {item.state === 'needs' && pendingProposals.length === 0 && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: 'var(--hairline-2)', borderRadius: 12,
          fontSize: 12, color: 'var(--ink-2)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>Set a time with {item.opponentName.split(' ')[0]}</span>
          <span style={{ color: 'var(--rally-green)', fontWeight: 700 }}>Pick time →</span>
        </div>
      )}

      {item.state === 'confirmed' && confirmed && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: 'var(--rally-green-tint)', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: 0.04 }}>
              {DAY_SHORT_UPPER[confirmed.day]?.slice(0, 3) ?? confirmed.day.slice(0, 3).toUpperCase()}
            </div>
            <div className="rally-num" style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', letterSpacing: -0.2, lineHeight: 1 }}>
              {nextDateFor(confirmed.day).getDate()}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="rally-num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--rally-green-deep)', letterSpacing: -0.3 }}>
              {formatHourCompact(confirmed.startHour)}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 1 }}>
              {formatDateCompact(nextDateFor(confirmed.day))}
            </div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--rally-green)', fontWeight: 700 }}>Details →</div>
        </div>
      )}

      {item.state === 'waiting' && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: 'var(--response-tint)', borderRadius: 12,
          fontSize: 12, color: 'var(--ink-2)',
        }}>
          {waitingNote}
        </div>
      )}
    </div>
  )
}

function HomeStateChip({ state }: { state: 'needs' | 'confirmed' | 'waiting' }) {
  const map = {
    needs:     { label: 'Needs you',  color: 'var(--urgent)',      bg: 'var(--urgent-tint)' },
    confirmed: { label: 'Confirmed',  color: 'var(--rally-green)', bg: 'var(--rally-green-tint)' },
    waiting:   { label: 'Waiting',    color: 'var(--response)',    bg: 'var(--response-tint)' },
  }[state]
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: 0.08 * 10, textTransform: 'uppercase',
      color: map.color, background: map.bg, padding: '3px 7px', borderRadius: 5,
      whiteSpace: 'nowrap',
    }}>{map.label}</div>
  )
}

function QueueTimeChip({ day, time, featured }: { day: string; time: string; featured?: boolean }) {
  return (
    <div style={{
      padding: '8px 4px', textAlign: 'center', borderRadius: 10,
      background: featured ? 'var(--rally-green)' : 'var(--surface)',
      border: featured ? 'none' : '1px solid var(--hairline)',
      color: featured ? '#fff' : 'var(--ink)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.04,
        opacity: featured ? 0.85 : 0.55,
      }}>{day}</div>
      <div className="rally-num" style={{
        fontFamily: 'var(--rally-font-sans)', fontSize: 15, fontWeight: 800,
        letterSpacing: -0.3, lineHeight: 1.1, marginTop: 2,
      }}>{time}</div>
      <div style={{
        fontSize: 9, fontWeight: 600, letterSpacing: 0.04,
        opacity: featured ? 0.9 : 0.5, marginTop: 2,
      }}>BOTH FREE</div>
    </div>
  )
}

// ═══ Tournament mini strip ═══

function TournamentMini({
  name, played, total, rank, onClick,
}: { name: string; played: number; total: number; rank: number; onClick: () => void }) {
  return (
    <div className="rally-tappable" onClick={onClick} style={{
      ...S.cardBase, borderRadius: 16, padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: 'var(--rally-green-tint)', color: 'var(--rally-green)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5h3v6h6m-6 0v6m0-6H3m0 6h3v6H3m6-6h4l3-6h5M15 14l3 6h3" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 700, color: 'var(--ink)', letterSpacing: -0.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </div>
        <div className="rally-num" style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
          {played} of {total} matches{rank > 0 ? ` · you're #${rank}` : ''}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--rally-green)', fontWeight: 700 }}>Bracket →</div>
    </div>
  )
}

// ═══ Atoms ═══

function Avatar({ name, size = 40, hue = 220 }: { name: string; size?: number; hue?: number | string }) {
  const initials = (name || '??').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const hueValue = typeof hue === 'number' ? hue : hueFromId(String(hue))
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `oklch(0.58 0.17 ${hueValue})`,
      color: `oklch(0.98 0.02 ${hueValue})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--rally-font-sans)',
      fontWeight: 700, fontSize: size * 0.38, letterSpacing: -0.5,
      flexShrink: 0,
      boxShadow: `inset 0 -${Math.max(2, size * 0.04)}px 0 oklch(0.42 0.15 ${hueValue})`,
    }}>
      {initials}
    </div>
  )
}

function InboxBell({ count, onClick }: { count: number; onClick?: () => void }) {
  return (
    <button
      aria-label="Notifications"
      onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: 12,
        background: 'var(--surface)', border: '1px solid var(--hairline-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', cursor: onClick ? 'pointer' : 'default',
        padding: 0,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 0 1 12 0v4l2 3H4l2-3V8Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
      {count > 0 && (
        <div className="rally-num" style={{
          position: 'absolute', top: 4, right: 4,
          minWidth: 16, height: 16, borderRadius: 999,
          background: 'var(--urgent)', color: '#fff',
          fontSize: 10, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px',
        }}>{count}</div>
      )}
    </button>
  )
}

function Pulse() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 6, height: 6 }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 999,
        background: 'var(--urgent)', opacity: 0.4,
        animation: 'rallyPulse 1.6s ease-out infinite',
      }} />
      <span style={{
        position: 'relative', width: 6, height: 6, borderRadius: 999,
        background: 'var(--urgent)',
      }} />
    </span>
  )
}

// ═══ Styles ═══

const S: Record<string, CSSProperties> = {
  root: {
    minHeight: '100%',
    background: 'var(--canvas)',
    paddingBottom: 32,
  },
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 20px 10px',
  },
  topBarEyebrow: {
    fontSize: 13, color: 'var(--ink-3)', fontWeight: 500,
  },
  topBarTitle: {
    fontFamily: 'var(--rally-font-sans)', fontSize: 28, fontWeight: 800,
    letterSpacing: -0.8, color: 'var(--ink)', lineHeight: 1.1, marginTop: 2,
  },
  cardBase: {
    background: 'var(--surface)',
    border: '1px solid var(--hairline-2)',
    borderRadius: 18,
    boxShadow: 'var(--rally-shadow-card)',
  },
}
