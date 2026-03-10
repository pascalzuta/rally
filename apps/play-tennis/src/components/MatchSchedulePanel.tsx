import { useState } from 'react'
import { acceptProposal, proposeNewSlots } from '../store'
import { Match, Tournament, DayOfWeek, MatchProposal } from '../types'

interface Props {
  tournament: Tournament
  match: Match
  currentPlayerId: string
  onUpdated: () => void
}

const DAYS: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
]

function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

function dayLabel(day: DayOfWeek): string {
  return DAYS.find(d => d.key === day)?.label ?? day
}

function proposalLabel(p: MatchProposal): string {
  return `${dayLabel(p.day)} ${formatHour(p.startHour)}–${formatHour(p.endHour)}`
}

export default function MatchSchedulePanel({ tournament, match, currentPlayerId, onUpdated }: Props) {
  const [showPropose, setShowPropose] = useState(false)
  const [propDay, setPropDay] = useState<DayOfWeek | ''>('')
  const [propStart, setPropStart] = useState(18)
  const [propEnd, setPropEnd] = useState(20)

  const schedule = match.schedule
  if (!schedule) return null

  const pendingProposals = schedule.proposals.filter(p => p.status === 'pending')
  const acceptableProposals = pendingProposals.filter(p => p.proposedBy !== currentPlayerId)
  const myPendingProposals = pendingProposals.filter(p => p.proposedBy === currentPlayerId)

  function handleAccept(proposalId: string) {
    acceptProposal(tournament.id, match.id, proposalId, currentPlayerId)
    onUpdated()
  }

  function handlePropose() {
    if (!propDay || propStart >= propEnd) return
    proposeNewSlots(tournament.id, match.id, currentPlayerId, [
      { day: propDay as DayOfWeek, startHour: propStart, endHour: propEnd }
    ])
    setShowPropose(false)
    setPropDay('')
    onUpdated()
  }

  // Confirmed state
  if (schedule.status === 'confirmed' && schedule.confirmedSlot) {
    const s = schedule.confirmedSlot
    return (
      <div className="schedule-panel schedule-confirmed">
        <div className="schedule-status-badge badge-confirmed">Confirmed</div>
        <div className="confirmed-slot">
          <span className="confirmed-day">{dayLabel(s.day)}</span>
          <span className="confirmed-time">{formatHour(s.startHour)}–{formatHour(s.endHour)}</span>
        </div>
      </div>
    )
  }

  // Resolved state
  if (schedule.status === 'resolved' && schedule.resolution) {
    const r = schedule.resolution
    if (r.type === 'walkover') {
      const winnerName = tournament.players.find(p => p.id === r.winnerId)?.name ?? 'Unknown'
      const isWinner = r.winnerId === currentPlayerId
      return (
        <div className="schedule-panel">
          <div className="schedule-status-badge badge-walkover">Match Awarded</div>
          <div className="resolution-detail">
            {isWinner
              ? 'Your opponent did not participate in scheduling. You have been awarded the match.'
              : `${winnerName} was awarded the match. Opponent did not participate in scheduling.`}
          </div>
        </div>
      )
    }
    if (r.type === 'forced-match' && r.forcedSlot) {
      return (
        <div className="schedule-panel">
          <div className="schedule-status-badge badge-forced">Final Match Assigned</div>
          <div className="resolution-detail">Both players participated but could not agree on a time.</div>
          <div className="confirmed-slot">
            <span className="confirmed-day">{dayLabel(r.forcedSlot.day)}</span>
            <span className="confirmed-time">{formatHour(r.forcedSlot.startHour)}–{formatHour(r.forcedSlot.endHour)}</span>
          </div>
        </div>
      )
    }
    if (r.type === 'double-loss') {
      return (
        <div className="schedule-panel">
          <div className="schedule-status-badge badge-double-loss">Match Canceled</div>
          <div className="resolution-detail">Neither player participated in scheduling. Both receive a loss.</div>
        </div>
      )
    }
  }

  // Escalated state
  if (schedule.status === 'escalated') {
    return (
      <div className="schedule-panel schedule-escalated">
        <div className="schedule-status-badge badge-escalated">Needs Resolution</div>
        <p className="subtle">Unable to find a time. Contact your opponent directly.</p>
      </div>
    )
  }

  // Proposed / Unscheduled state
  return (
    <div className="schedule-panel">
      <div className={`schedule-status-badge ${pendingProposals.length > 0 ? 'badge-proposed' : 'badge-unscheduled'}`}>
        {acceptableProposals.length > 0 ? 'Choose a Time'
          : myPendingProposals.length > 0 ? 'Waiting for Opponent'
          : 'No Times Available'}
      </div>

      {acceptableProposals.length > 0 && (
        <div className="proposal-list">
          {acceptableProposals.map(p => (
            <div key={p.id} className="proposal-card">
              <div className="proposal-info">
                <span className="proposal-time">{proposalLabel(p)}</span>
                {p.proposedBy !== 'system' && (
                  <span className="proposal-from">
                    proposed by {tournament.players.find(pl => pl.id === p.proposedBy)?.name.split(' ')[0] ?? 'opponent'}
                  </span>
                )}
                {p.proposedBy === 'system' && (
                  <span className="proposal-from">best overlap</span>
                )}
              </div>
              <button
                className="btn btn-primary btn-small"
                onClick={(e) => { e.stopPropagation(); handleAccept(p.id) }}
              >
                Accept
              </button>
            </div>
          ))}
        </div>
      )}

      {myPendingProposals.length > 0 && (
        <div className="proposal-list">
          {myPendingProposals.map(p => (
            <div key={p.id} className="proposal-card proposal-mine">
              <div className="proposal-info">
                <span className="proposal-time">{proposalLabel(p)}</span>
                <span className="proposal-from">your proposal — waiting</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!showPropose ? (
        <button
          className="btn-link propose-link"
          onClick={(e) => { e.stopPropagation(); setShowPropose(true) }}
        >
          Propose a different time
        </button>
      ) : (
        <div className="propose-form" onClick={e => e.stopPropagation()}>
          <div className="propose-row">
            <select value={propDay} onChange={e => setPropDay(e.target.value as DayOfWeek | '')}>
              <option value="">Day...</option>
              {DAYS.map(d => <option key={d.key} value={d.key}>{d.short}</option>)}
            </select>
            <select value={propStart} onChange={e => setPropStart(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => i + 6).map(h => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
            <span>–</span>
            <select value={propEnd} onChange={e => setPropEnd(Number(e.target.value))}>
              {Array.from({ length: 16 }, (_, i) => i + 7).map(h => (
                <option key={h} value={h}>{formatHour(h)}</option>
              ))}
            </select>
          </div>
          <div className="propose-actions">
            <button
              className="btn btn-primary btn-small"
              onClick={handlePropose}
              disabled={!propDay || propStart >= propEnd}
            >
              Send Proposal
            </button>
            <button className="btn btn-small" onClick={(e) => { e.stopPropagation(); setShowPropose(false) }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
