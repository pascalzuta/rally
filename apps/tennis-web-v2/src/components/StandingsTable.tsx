import type { StandingEntry } from "../types";

interface Props {
  standings: StandingEntry[];
  playerNames: Record<string, string>;
  playerId: string;
}

function getMedalIndicator(rank: number): string {
  switch (rank) {
    case 1:
      return "\uD83E\uDD47";
    case 2:
      return "\uD83E\uDD48";
    case 3:
      return "\uD83E\uDD49";
    default:
      return "";
  }
}

export default function StandingsTable({ standings, playerNames, playerId }: Props) {
  return (
    <div className="standings-table">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>W</th>
            <th>L</th>
            <th>Pts</th>
            <th>Set +/-</th>
            <th>Game +/-</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry, index) => {
            const rank = index + 1;
            const isMe = entry.playerId === playerId;
            const name = playerNames[entry.playerId] || "Unknown";
            const points = entry.wins * 3;
            const medal = getMedalIndicator(rank);

            return (
              <tr
                key={entry.playerId}
                className={`standings-row ${isMe ? "standings-row--me" : ""}`}
              >
                <td>
                  {medal || rank}
                </td>
                <td>{name}</td>
                <td>{entry.wins}</td>
                <td>{entry.losses}</td>
                <td>{points}</td>
                <td>{entry.setDiff > 0 ? `+${entry.setDiff}` : entry.setDiff}</td>
                <td>{entry.gameDiff > 0 ? `+${entry.gameDiff}` : entry.gameDiff}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
