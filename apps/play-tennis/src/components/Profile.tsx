import { getPlayerRating, getRatingLabel, getPlayerTournaments, logout } from '../store'
import { PlayerProfile } from '../types'

interface Props {
  profile: PlayerProfile
  onLogout: () => void
}

export default function Profile({ profile, onLogout }: Props) {
  const rating = getPlayerRating(profile.name)
  const label = getRatingLabel(rating.rating)
  const tournaments = getPlayerTournaments(profile.id)

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

  function handleLogout() {
    if (confirm('Sign out? You can sign back in with the same name.')) {
      logout()
      onLogout()
    }
  }

  return (
    <div className="profile-content">
      <div className="profile-card">
        <div className="profile-avatar">{profile.name[0].toUpperCase()}</div>
        <h2 className="profile-name">{profile.name}</h2>
        <p className="profile-county">{profile.county}</p>
      </div>

      <div className="rating-card">
        <div className="rating-big">{Math.round(rating.rating)}</div>
        <div className="rating-label-text">{label}</div>
      </div>

      <div className="stats-row">
        <div className="stat-box">
          <div className="stat-value">{rating.matchesPlayed}</div>
          <div className="stat-label">Matches</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{wins}</div>
          <div className="stat-label">Wins</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{losses}</div>
          <div className="stat-label">Losses</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{tournaments.length}</div>
          <div className="stat-label">Events</div>
        </div>
      </div>

      <button className="btn btn-large logout-btn" onClick={handleLogout}>
        Sign Out
      </button>
    </div>
  )
}
