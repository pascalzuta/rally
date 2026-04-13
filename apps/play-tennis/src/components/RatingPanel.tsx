import { useState } from 'react'
import { titleCase } from '../dateUtils'
import { getPlayerRating, getRatingHistory, getRatingTrend, getPlayerTournaments, getPlayerRank, getPlayerTrophies, getPlayerBadges, getMatchHistory, getHeadToHead } from '../store'
import type { RatingSnapshot } from '../types'
import { PlayerProfile, Trophy, TrophyTier, Badge } from '../types'

interface Props {
  profile: PlayerProfile
  onClose: () => void
  onViewLeaderboard?: () => void
}

// --- Rating Chart ---

function RatingChart({ history, currentRating }: { history: RatingSnapshot[]; currentRating: number }) {
  const points: { rating: number; timestamp: string }[] = [...history]
  if (points.length === 0) {
    points.push({ rating: currentRating, timestamp: new Date().toISOString() })
  }
  if (points.length === 1) {
    points.unshift({ rating: 1000, timestamp: points[0].timestamp })
  }

  const W = 300
  const H = 150
  const PAD_X = 40
  const PAD_Y = 20
  const PAD_BOTTOM = 28
  const chartW = W - PAD_X - 10
  const chartH = H - PAD_Y - PAD_BOTTOM

  const ratings = points.map(p => p.rating)
  const minR = Math.floor((Math.min(...ratings) - 20) / 50) * 50
  const maxR = Math.ceil((Math.max(...ratings) + 20) / 50) * 50
  const range = maxR - minR || 100

  const pathPoints = points.map((p, i) => {
    const x = PAD_X + (i / (points.length - 1)) * chartW
    const y = PAD_Y + chartH - ((p.rating - minR) / range) * chartH
    return { x, y, rating: p.rating }
  })

  const d = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const yLabels = [minR, Math.round((minR + maxR) / 2), maxR]

  const totalPoints = points.length
  const xLabelIndices: number[] = []
  if (totalPoints <= 6) {
    for (let i = 0; i < totalPoints; i++) xLabelIndices.push(i)
  } else {
    xLabelIndices.push(0)
    const step = Math.floor((totalPoints - 1) / 4)
    for (let i = step; i < totalPoints - 1; i += step) xLabelIndices.push(i)
    xLabelIndices.push(totalPoints - 1)
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: 400 }}>
      {yLabels.map(v => {
        const y = PAD_Y + chartH - ((v - minR) / range) * chartH
        return (
          <g key={v}>
            <line x1={PAD_X} y1={y} x2={W - 10} y2={y} stroke="var(--color-divider)" strokeWidth="0.5" />
            <text x={PAD_X - 4} y={y + 3} textAnchor="end" fontSize="8" fill="var(--color-text-secondary)">{v}</text>
          </g>
        )
      })}
      {xLabelIndices.map(i => (
        <text key={i} x={pathPoints[i].x} y={H - 6} textAnchor="middle" fontSize="7" fill="var(--color-text-secondary)">
          {i === 0 ? 'Start' : `Match ${i}`}
        </text>
      ))}
      <path d={d} fill="none" stroke="var(--color-accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pathPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pathPoints.length - 1 ? 3.5 : 2} fill="var(--color-accent-primary)" opacity={i === pathPoints.length - 1 ? 1 : 0.5} />
      ))}
    </svg>
  )
}

// --- Trophy helpers ---

const TROPHY_COLORS: Record<TrophyTier, { primary: string; highlight: string; shadow: string }> = {
  champion: { primary: '#D4AF37', highlight: '#F6E27A', shadow: '#8C7520' },
  finalist: { primary: '#A0A5AD', highlight: '#C8CCD2', shadow: '#6B7280' },
  semifinalist: { primary: '#B87333', highlight: '#D4956B', shadow: '#7A4E22' },
}

const TROPHY_LABEL: Record<TrophyTier, string> = {
  champion: 'Champion',
  finalist: 'Finalist',
  semifinalist: 'Semifinalist',
}

function TrophyIcon({ tier, size = 40 }: { tier: TrophyTier; size?: number }) {
  const c = TROPHY_COLORS[tier]
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <defs>
        <linearGradient id={`trophy-${tier}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.highlight} />
          <stop offset="50%" stopColor={c.primary} />
          <stop offset="100%" stopColor={c.shadow} />
        </linearGradient>
      </defs>
      <path d="M10 8h20v4c0 7-4 12-10 14-6-2-10-7-10-14V8z" fill={`url(#trophy-${tier})`} />
      <path d="M10 10H7c0 4 1.5 7 3 8" stroke={c.primary} strokeWidth="1.5" fill="none" />
      <path d="M30 10h3c0 4-1.5 7-3 8" stroke={c.primary} strokeWidth="1.5" fill="none" />
      <rect x="18" y="26" width="4" height="5" rx="1" fill={c.shadow} />
      <rect x="13" y="31" width="14" height="3" rx="1.5" fill={c.primary} />
      <ellipse cx="17" cy="14" rx="3" ry="5" fill="white" opacity="0.15" />
    </svg>
  )
}

function TrophyDetailModal({ trophy, onClose }: { trophy: Trophy; onClose: () => void }) {
  return (
    <div className="trophy-modal-backdrop" onClick={onClose}>
      <div className="trophy-modal" onClick={e => e.stopPropagation()}>
        <div className="trophy-modal-icon">
          <TrophyIcon tier={trophy.tier} size={64} />
        </div>
        <h3 className="trophy-modal-title">{trophy.tournamentName}</h3>
        <div className="trophy-modal-tier">{TROPHY_LABEL[trophy.tier]}</div>
        <div className="trophy-modal-date">{trophy.date}</div>
        {trophy.finalMatch && (
          <div className="trophy-modal-match">
            <div className="trophy-modal-match-label">
              {trophy.tier === 'champion' ? 'Final Match' : 'Final'}
            </div>
            <div className="trophy-modal-match-result">
              {trophy.finalMatch.won
                ? `${trophy.playerName} def. ${trophy.finalMatch.opponentName}`
                : `${trophy.finalMatch.opponentName} def. ${trophy.playerName}`
              }
            </div>
            <div className="trophy-modal-match-score">{trophy.finalMatch.score}</div>
          </div>
        )}
        <button className="btn trophy-modal-close" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function BadgeIcon({ type }: { type: Badge['type'] }) {
  const icons: Record<string, string> = {
    'first-tournament': '1',
    'undefeated-champion': '★',
    'comeback-win': '↺',
    'five-tournaments': '5',
    'ten-matches': '10',
    'reliable-player': '✓',
    'good-sport': '♥',
    'community-regular': '♦',
  }
  return (
    <div className="badge-icon">{icons[type] ?? '●'}</div>
  )
}

// --- Main Rating Panel ---

export default function RatingPanel({ profile, onClose, onViewLeaderboard }: Props) {
  const rating = getPlayerRating(profile.id, profile.name)
  const tournaments = getPlayerTournaments(profile.id)
  const rankInfo = getPlayerRank(profile.name, profile.county)
  const ratingHistory = getRatingHistory(profile.id)
  const weeklyTrend = getRatingTrend(profile.id)
  const trophies = getPlayerTrophies(profile.id)
  const badges = getPlayerBadges(profile.id)

  const [selectedTrophy, setSelectedTrophy] = useState<Trophy | null>(null)
  const [showAllMatches, setShowAllMatches] = useState(false)
  const [h2hOpponent, setH2hOpponent] = useState<string | null>(null)
  const [showRatingInfo, setShowRatingInfo] = useState(false)

  const wins = tournaments.reduce((sum, t) => {
    return sum + t.matches.filter(m =>
      m.completed && m.winnerId &&
      (m.player1Id === profile.id || m.player2Id === profile.id) &&
      m.winnerId === profile.id
    ).length
  }, 0)

  const losses = tournaments.reduce((sum, t) => {
    return sum + t.matches.filter(m =>
      m.completed && m.winnerId &&
      (m.player1Id === profile.id || m.player2Id === profile.id) &&
      m.winnerId !== profile.id
    ).length
  }, 0)

  const totalMatches = wins + losses
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0

  const lastRatingChange = ratingHistory.length >= 2
    ? Math.round(ratingHistory[ratingHistory.length - 1].rating - ratingHistory[ratingHistory.length - 2].rating)
    : 0

  const completedTournaments = tournaments.filter(t => t.status === 'completed')
  const matchHistory = getMatchHistory(profile.id)
  const visibleMatches = showAllMatches ? matchHistory : matchHistory.slice(0, 5)

  const nextRankUp = rankInfo.rank > 1 ? rankInfo.rank - 1 : null
  const engagementPrompt = lastRatingChange > 0 && nextRankUp
    ? `One more win could move you to #${nextRankUp}.`
    : lastRatingChange > 0
      ? 'Keep the momentum — play another match.'
      : totalMatches > 0
        ? 'Play another match to climb the leaderboard.'
        : null

  function getTournamentResult(tournament: typeof tournaments[0]): string {
    const playerMatches = tournament.matches.filter(m =>
      m.completed && m.winnerId &&
      (m.player1Id === profile.id || m.player2Id === profile.id)
    )
    const playerWins = playerMatches.filter(m => m.winnerId === profile.id).length
    const playerLosses = playerMatches.length - playerWins
    if (playerWins > playerLosses) return 'Won'
    if (playerLosses > playerWins) return 'Lost'
    return 'Draw'
  }

  return (
    <div className="rating-panel-overlay">
      <div className="rating-panel">
        <div className="rating-panel-header">
          <h2 className="rating-panel-title">Rating & Trophies</h2>
          <button className="btn-icon rating-panel-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="rating-panel-body">
          {/* Rally Rating Hero Card */}
          <div className="card rating-hero">
            <div className="card-status-row">
              <div className="card-status-label card-status-label--slate">Rally Rating</div>
              {rankInfo.total > 1 && (
                <div className="card-meta-chip card-meta-chip--blue">Rank #{rankInfo.rank}</div>
              )}
            </div>
            <div className="card-summary-main rating-hero-summary">
              <div className="card-title">Your current rating</div>
              <div className="card-supporting">Ratings adjust after each match and help keep matchups fair.</div>
            </div>
            <div className="rating-hero-top">
              <div className="rating-hero-number">
                {Math.round(rating.rating)}
                {weeklyTrend !== 0 && (
                  <span className={`rating-trend ${weeklyTrend > 0 ? 'positive' : 'negative'}`}>
                    {weeklyTrend > 0 ? ' ▲' : ' ▼'}
                  </span>
                )}
              </div>
            </div>
            <div className="rating-hero-label">Your Rally Rating</div>
            <div className="rating-level-bar">
              <div className="rating-level-fill" style={{ width: `${Math.min(100, Math.max(5, ((rating.rating - 800) / 1600) * 100))}%` }} />
            </div>
            <div className="rating-hero-details">
              {rankInfo.total > 1 && (
                <span className="rating-hero-rank">Rank #{rankInfo.rank} in {titleCase(profile.county)}</span>
              )}
              {lastRatingChange !== 0 && (
                <span className={`rating-hero-change ${lastRatingChange > 0 ? 'positive' : 'negative'}`}>
                  {lastRatingChange > 0 ? '+' : ''}{lastRatingChange} last match
                </span>
              )}
              {weeklyTrend !== 0 && (
                <span className={`rating-hero-trend ${weeklyTrend > 0 ? 'positive' : 'negative'}`}>
                  {weeklyTrend > 0 ? '+' : ''}{weeklyTrend} this week
                </span>
              )}
            </div>
            <div className="rating-hero-explanation" style={{ fontSize: 'var(--font-caption)', color: 'var(--color-text-secondary)', marginTop: 8 }}>
              Ratings adjust after each match — win against stronger players for a bigger boost
            </div>
            {engagementPrompt && (
              <div className="engagement-prompt">{engagementPrompt}</div>
            )}
            <div className="rating-hero-actions">
              {onViewLeaderboard && rankInfo.total > 1 && (
                <button className="btn-link rating-hero-link" onClick={onViewLeaderboard}>View full leaderboard</button>
              )}
            </div>
          </div>

          {/* Your Record */}
          <div className="card profile-section">
            <h3 className="profile-section-title"><span>Your Record</span></h3>
            <div className="performance-grid">
              <div className="performance-item">
                <div className="performance-value">{totalMatches}</div>
                <div className="performance-label">Matches</div>
              </div>
              <div className="performance-item">
                <div className="performance-value">{wins}</div>
                <div className="performance-label">Wins</div>
              </div>
              <div className="performance-item">
                <div className="performance-value">{losses}</div>
                <div className="performance-label">Losses</div>
              </div>
              <div className="performance-item">
                <div className="performance-value">{winRate}%</div>
                <div className="performance-label">Win Rate</div>
              </div>
            </div>
          </div>

          {/* Trophy Cabinet */}
          <div className="card profile-section">
            <h3 className="profile-section-title"><span>Trophies</span></h3>
            {trophies.length > 0 ? (
              <div className="trophy-grid">
                {trophies.map(trophy => (
                  <button key={trophy.id} className="trophy-cell" onClick={() => setSelectedTrophy(trophy)}>
                    <TrophyIcon tier={trophy.tier} size={40} />
                    <div className="trophy-cell-label">{TROPHY_LABEL[trophy.tier]}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="trophy-empty">
                <div className="trophy-empty-icon">🏆</div>
                <p className="trophy-empty-title">Your trophy case is empty — for now</p>
                <p className="trophy-empty-desc">Win matches to earn tournament trophies and badges</p>
              </div>
            )}
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="card profile-section">
              <h3 className="profile-section-title"><span>Badges</span></h3>
              <div className="badge-grid">
                {badges.map(badge => (
                  <div key={badge.id} className="badge-cell" title={badge.description}>
                    <BadgeIcon type={badge.type} />
                    <div className="badge-cell-label">{badge.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rating Over Time */}
          <div className="card profile-section">
            <h3 className="profile-section-title"><span>Your Rating Over Time</span></h3>
            <RatingChart history={ratingHistory} currentRating={rating.rating} />
            <p style={{ fontSize: 'var(--font-body-sm)', color: 'var(--color-text-secondary)', marginTop: 8 }}>Each match result adjusts your rating. Decisive wins earn bigger jumps.</p>
            {completedTournaments.length > 0 && (
              <div className="tournament-history">
                {completedTournaments.map(t => {
                  const result = getTournamentResult(t)
                  return (
                    <div key={t.id} className="history-card">
                      <div className="history-card-info">
                        <div className="history-card-name">{t.name}</div>
                        <div className="history-card-meta">{t.date} · {t.format === 'single-elimination' ? 'Elimination' : t.format === 'group-knockout' ? 'Group stage + Playoffs' : 'Round robin'}</div>
                      </div>
                      <span className={`history-card-result ${result === 'Won' ? 'won' : result === 'Lost' ? 'lost' : ''}`}>{result}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Match History */}
          {matchHistory.length > 0 && (
            <div className="card profile-section">
              <h3 className="profile-section-title"><span>Match History</span></h3>

              {h2hOpponent && (() => {
                const h2h = getHeadToHead(profile.id, h2hOpponent)
                const oppName = h2h.matches[0]?.opponentName ?? 'Opponent'
                return (
                  <div className="h2h-card">
                    <div className="h2h-header">
                      <span className="h2h-title">vs {oppName}</span>
                      <button className="btn-icon" onClick={() => setH2hOpponent(null)}>✕</button>
                    </div>
                    <div className="h2h-record">
                      <span className="h2h-wins">{h2h.wins}W</span>
                      <span className="h2h-divider">–</span>
                      <span className="h2h-losses">{h2h.losses}L</span>
                    </div>
                    <div className="h2h-matches">
                      {h2h.matches.map(m => (
                        <div key={m.matchId} className={`h2h-match-row ${m.won ? 'won' : 'lost'}`}>
                          <span className="h2h-result">{m.won ? 'W' : 'L'}</span>
                          <span className="h2h-score">{m.score}</span>
                          <span className="h2h-tournament">{m.tournamentName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div className="match-history-list">
                {visibleMatches.map(match => (
                  <div
                    key={match.matchId}
                    className={`match-history-item ${match.won ? 'won' : 'lost'}`}
                    onClick={() => setH2hOpponent(match.opponentId === h2hOpponent ? null : match.opponentId)}
                  >
                    <div className="match-history-result">
                      <span className={`match-result-badge ${match.won ? 'win' : 'loss'}`}>
                        {match.won ? 'W' : 'L'}
                      </span>
                    </div>
                    <div className="match-history-info">
                      <div className="match-history-opponent">vs {match.opponentName}</div>
                      <div className="match-history-meta">{match.tournamentName} · R{match.round}</div>
                    </div>
                    <div className="match-history-score">{match.score}</div>
                  </div>
                ))}
              </div>
              {matchHistory.length > 5 && (
                <button className="btn-link match-history-toggle" onClick={() => setShowAllMatches(!showAllMatches)}>
                  {showAllMatches ? 'Show less' : `Show all ${matchHistory.length} matches`}
                </button>
              )}
            </div>
          )}

          {/* Rating Explanation */}
          <div className="card profile-section">
            <button className="rating-explainer-toggle" aria-expanded={showRatingInfo} onClick={() => setShowRatingInfo(!showRatingInfo)}>
              <span className="rating-explainer-toggle-text">How ratings work</span>
              <span className="rating-explainer-toggle-chevron">›</span>
            </button>
            {showRatingInfo && (
              <div className="rating-explainer">
                <p>Rally uses an <strong>Elo rating system</strong>, similar to chess. Every player starts at <strong>1000</strong>.</p>
                <p>Beat a stronger opponent for a bigger boost. Lose to a weaker one and you drop more. The system finds your true level over time.</p>
                <div className="rating-tiers">
                  <div className="rating-tier"><span className="tier-range">2200+</span><span className="tier-label">Pro</span></div>
                  <div className="rating-tier"><span className="tier-range">2000–2199</span><span className="tier-label">Semi-pro</span></div>
                  <div className="rating-tier"><span className="tier-range">1800–1999</span><span className="tier-label">Elite</span></div>
                  <div className="rating-tier"><span className="tier-range">1600–1799</span><span className="tier-label">Strong</span></div>
                  <div className="rating-tier"><span className="tier-range">1400–1599</span><span className="tier-label">Club</span></div>
                  <div className="rating-tier"><span className="tier-range">1200–1399</span><span className="tier-label">Beginner</span></div>
                  <div className="rating-tier"><span className="tier-range">&lt;1200</span><span className="tier-label">Newcomer</span></div>
                </div>
                <p className="rating-explainer-footnote">Ratings shift more in your first few matches, then stabilise.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedTrophy && (
        <TrophyDetailModal trophy={selectedTrophy} onClose={() => setSelectedTrophy(null)} />
      )}
    </div>
  )
}
