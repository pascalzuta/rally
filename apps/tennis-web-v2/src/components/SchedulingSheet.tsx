import { useCallback } from "react";
import type { TournamentMatch, TimeProposal } from "../types";
import { ordinal } from "../helpers";

interface Props {
  match: TournamentMatch;
  playerNames: Record<string, string>;
  playerId: string;
  options?: Array<{ datetime: string; label: string }>;
  proposals?: TimeProposal[];
  onSelectOption?: (datetime: string, label: string) => void;
  onAcceptProposal?: (proposalId: string) => void;
  onClose: () => void;
}

export default function SchedulingSheet({
  match,
  playerNames,
  playerId,
  options,
  proposals,
  onSelectOption,
  onAcceptProposal,
  onClose,
}: Props) {
  const opponentId =
    match.homePlayerId === playerId ? match.awayPlayerId : match.homePlayerId;
  const opponentName = playerNames[opponentId] || "Unknown";

  const handleSelectOption = useCallback(
    (datetime: string, label: string) => {
      onSelectOption?.(datetime, label);
    },
    [onSelectOption],
  );

  const handleAcceptProposal = useCallback(
    (proposalId: string) => {
      onAcceptProposal?.(proposalId);
    },
    [onAcceptProposal],
  );

  return (
    <div className="scheduling-sheet">
      <div className="scheduling-sheet-header">
        <h3>Pick a Time</h3>
        <p>
          vs {opponentName} &middot; {ordinal(match.round)} round
        </p>
      </div>

      <div className="scheduling-sheet-options">
        {options && options.length > 0 && (
          <div className="scheduling-option-list">
            {options.map((opt) => (
              <button
                key={opt.datetime}
                className="scheduling-option-btn"
                onClick={() => handleSelectOption(opt.datetime, opt.label)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {proposals && proposals.length > 0 && (
          <div className="scheduling-proposal-list">
            <p className="scheduling-proposal-heading">
              {opponentName}'s proposed times:
            </p>
            {proposals.map((proposal) => (
              <button
                key={proposal.id}
                className="scheduling-option-btn"
                onClick={() => handleAcceptProposal(proposal.id)}
              >
                {proposal.label}
              </button>
            ))}
          </div>
        )}

        {(!options || options.length === 0) &&
          (!proposals || proposals.length === 0) && (
            <p className="scheduling-empty">No available time slots.</p>
          )}
      </div>

      <div className="scheduling-sheet-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
