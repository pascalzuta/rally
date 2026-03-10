import { useState, useEffect } from 'react'
import { getTournament, addPlayer, removePlayer, generateBracket, getPlayerName } from '../store'
import { Tournament } from '../types'
import MatchScoreModal from './MatchScoreModal'
import Standings from './Standings'

interface Props {
  tournamentId: string
  onBack: () => void
}

export default function TournamentView({ tournamentId, onBack }: Props) {
  const [tournament, setTournament] = useState<Tournament | undefined>()
  const [newPlayer, setNewPlayer] = useState('')
  const [scoringMatchId, setScoringMatchId] = useState<string | null>(null)
  const [tab, setTab] = useState<'matches' | 'standings'>('matches')

  useEffect(() => {
    setTournament(getTournament(tournamentId))
  }, [tournamentId])

  if (!tournament) return <div className="screen"><p>Tournament not found</p></div>

  function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayer.trim()) return
    const updated = addPlayer(tournamentId, newPlayer)
    setTournament(updated)
    setNewPlayer('')
  }

  function handleRemovePlayer(playerId: string) {
    const updated = removePlayer(tournamentId, playerId)
    setTournament(updated)
  }

  function handleStartTournament() {
    if (tournament!.players.length < 2) return
    const updated = generateBracket(tournamentId)
    setTournament(updated)
  }

  function handleScoreSaved() {
    setScoringMatchId(null)
    setTournament(getTournament(tournamentId))
  }

  const isSetup = tournament.status === 'setup'
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
        {/* Winner banner */}
        {winner && (
          <div className="winner-banner">
            🏆 {getPlayerName(tournament, winner)} wins!
          </div>
        )}

        {/* Setup phase: add players */}
        {isSetup && (
          <>
            <div className="section">
              <h2>Players ({tournament.players.length})</h2>
              <form onSubmit={handleAddPlayer} className="add-player-form">
                <input
                  type="text"
                  value={newPlayer}
                  onChange={e => setNewPlayer(e.target.value)}
                  placeholder="Player name"
                />
                <button type="submit" className="btn btn-primary" disabled={!newPlayer.trim()}>Add</button>
              </form>
              {tournament.players.length === 0 ? (
                <p className="subtle">Add at least 2 players to start</p>
              ) : (
                <ul className="player-list">
                  {tournament.players.map((p, i) => (
                    <li key={p.id}>
                      <span className="player-num">{i + 1}</span>
                      <span className="player-name">{p.name}</span>
                      <button className="btn-icon" onClick={() => handleRemovePlayer(p.id)}>✕</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bottom-action">
              <button
                className="btn btn-primary btn-large"
                onClick={handleStartTournament}
                disabled={tournament.players.length < 2}
              >
                Start Tournament ({tournament.players.length} players)
              </button>
            </div>
          </>
        )}

        {/* Matches phase */}
        {!isSetup && (
          <>
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
                          const canScore = match.player1Id && match.player2Id && !match.completed
                          const isBye = (!match.player1Id || !match.player2Id) && match.completed

                          return (
                            <div
                              key={match.id}
                              className={`match-card ${match.completed ? 'completed' : ''} ${canScore ? 'scoreable' : ''}`}
                              onClick={() => canScore && setScoringMatchId(match.id)}
                            >
                              {isBye ? (
                                <div className="bye-label">BYE</div>
                              ) : (
                                <>
                                  <div className={`match-player ${match.winnerId === match.player1Id ? 'winner' : ''}`}>
                                    <span>{p1}</span>
                                    {match.completed && <span className="match-score">{match.score1.join(' ')}</span>}
                                  </div>
                                  <div className="match-vs">vs</div>
                                  <div className={`match-player ${match.winnerId === match.player2Id ? 'winner' : ''}`}>
                                    <span>{p2}</span>
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
                      const canScore = !match.completed

                      return (
                        <div
                          key={match.id}
                          className={`match-card ${match.completed ? 'completed' : ''} ${canScore ? 'scoreable' : ''}`}
                          onClick={() => canScore && setScoringMatchId(match.id)}
                        >
                          <div className={`match-player ${match.winnerId === match.player1Id ? 'winner' : ''}`}>
                            <span>{p1}</span>
                            {match.completed && <span className="match-score">{match.score1.join(' ')}</span>}
                          </div>
                          <div className="match-vs">vs</div>
                          <div className={`match-player ${match.winnerId === match.player2Id ? 'winner' : ''}`}>
                            <span>{p2}</span>
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
          </>
        )}
      </main>

      {/* Score entry modal */}
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
