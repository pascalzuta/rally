import { useState, useEffect } from 'react'
import { getTournament, getPlayerName, getPlayerRating } from '../store'
import { Tournament } from '../types'
import MatchScoreModal from './MatchScoreModal'
import Standings from './Standings'

interface Props {
  tournamentId: string
  currentPlayerId: string
  onBack: () => void
}

export default function TournamentView({ tournamentId, currentPlayerId, onBack }: Props) {
  const [tournament, setTournament] = useState<Tournament | undefined>()
  const [scoringMatchId, setScoringMatchId] = useState<string | null>(null)
  const [tab, setTab] = useState<'matches' | 'standings'>('matches')

  useEffect(() => {
    setTournament(getTournament(tournamentId))
  }, [tournamentId])

  if (!tournament) return <div className="screen"><p>Tournament not found</p></div>

  function handleScoreSaved() {
    setScoringMatchId(null)
    setTournament(getTournament(tournamentId))
  }

  const winner = tournament.status === 'completed' && tournament.format === 'single-elimination'
    ? tournament.matches[tournament.matches.length - 1]?.winnerId
    : null

  const rounds = tournament.format === 'single-elimination'
    ? [...new Set(tournament.matches.map(m => m.round))].sort((a, b) => a - b)
    : [0]

  const roundLabel = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semifinal'
    if (round === totalRounds - 2) return 'Quarterfinal'
    return `Round ${round}`
  }

  return (
    <div className="screen">
      <header className="header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h1>{tournament.name}</h1>
      </header>

      <main className="content">
        {winner && (
          <div className="winner-banner">
            🏆 {getPlayerName(tournament, winner)} wins!
          </div>
        )}

        {tournament.format === 'round-robin' && (
          <div className="tab-bar">
            <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Matches</button>
            <button className={`tab ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Standings</button>
          </div>
        )}

        {tab === 'matches' && (
          <div className="bracket">
            {tournament.format === 'single-elimination' ? (
              rounds.map(round => (
                <div key={round} className="round">
                  <h3 className="round-label">{roundLabel(round, rounds.length)}</h3>
                  {tournament.matches
                    .filter(m => m.round === round)
                    .map(match => {
                      const p1 = getPlayerName(tournament, match.player1Id)
                      const p2 = getPlayerName(tournament, match.player2Id)
                      const r1 = match.player1Id ? getPlayerRating(p1) : null
                      const r2 = match.player2Id ? getPlayerRating(p2) : null
                      const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
                      const canScore = match.player1Id && match.player2Id && !match.completed && isMyMatch
                      const isBye = (!match.player1Id || !match.player2Id) && match.completed

                      return (
                        <div
                          key={match.id}
                          className={`match-card ${match.completed ? 'completed' : ''} ${canScore ? 'scoreable' : ''} ${isMyMatch && !match.completed ? 'my-match' : ''}`}
                          onClick={() => canScore && setScoringMatchId(match.id)}
                        >
                          {isBye ? (
                            <div className="bye-label">BYE</div>
                          ) : (
                            <>
                              <div className={`match-player ${match.winnerId === match.player1Id ? 'winner' : ''}`}>
                                <span>{p1} {r1 && <span className="inline-rating">{Math.round(r1.rating)}</span>}</span>
                                {match.completed && <span className="match-score">{match.score1.join(' ')}</span>}
                              </div>
                              <div className="match-vs">vs</div>
                              <div className={`match-player ${match.winnerId === match.player2Id ? 'winner' : ''}`}>
                                <span>{p2} {r2 && <span className="inline-rating">{Math.round(r2.rating)}</span>}</span>
                                {match.completed && <span className="match-score">{match.score2.join(' ')}</span>}
                              </div>
                              {canScore && <div className="tap-hint">Tap to score</div>}
                            </>
                          )}
                        </div>
                      )
                    })}
                </div>
              ))
            ) : (
              <div className="round">
                <h3 className="round-label">All Matches</h3>
                {tournament.matches.map(match => {
                  const p1 = getPlayerName(tournament, match.player1Id)
                  const p2 = getPlayerName(tournament, match.player2Id)
                  const r1 = match.player1Id ? getPlayerRating(p1) : null
                  const r2 = match.player2Id ? getPlayerRating(p2) : null
                  const isMyMatch = match.player1Id === currentPlayerId || match.player2Id === currentPlayerId
                  const canScore = !match.completed && isMyMatch

                  return (
                    <div
                      key={match.id}
                      className={`match-card ${match.completed ? 'completed' : ''} ${canScore ? 'scoreable' : ''} ${isMyMatch && !match.completed ? 'my-match' : ''}`}
                      onClick={() => canScore && setScoringMatchId(match.id)}
                    >
                      <div className={`match-player ${match.winnerId === match.player1Id ? 'winner' : ''}`}>
                        <span>{p1} {r1 && <span className="inline-rating">{Math.round(r1.rating)}</span>}</span>
                        {match.completed && <span className="match-score">{match.score1.join(' ')}</span>}
                      </div>
                      <div className="match-vs">vs</div>
                      <div className={`match-player ${match.winnerId === match.player2Id ? 'winner' : ''}`}>
                        <span>{p2} {r2 && <span className="inline-rating">{Math.round(r2.rating)}</span>}</span>
                        {match.completed && <span className="match-score">{match.score2.join(' ')}</span>}
                      </div>
                      {canScore && <div className="tap-hint">Tap to score</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'standings' && tournament.format === 'round-robin' && (
          <Standings tournament={tournament} />
        )}
      </main>

      {scoringMatchId && (
        <MatchScoreModal
          tournament={tournament}
          matchId={scoringMatchId}
          onClose={() => setScoringMatchId(null)}
          onSaved={handleScoreSaved}
        />
      )}
    </div>
  )
}
