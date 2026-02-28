import { useCallback } from "react";
import type { ActionItem, ActionType } from "../types";
import { ordinal } from "../helpers";

interface Props {
  action: ActionItem;
  onAction: (action: ActionItem) => void;
}

function getColorClass(type: ActionType): string {
  switch (type) {
    case "confirm-score":
      return "action-card--red";
    case "flex-schedule":
    case "propose-times":
      return "action-card--amber";
    case "pick-time":
    case "enter-score":
      return "action-card--blue";
  }
}

function getCtaText(type: ActionType): string {
  switch (type) {
    case "confirm-score":
      return "Confirm";
    case "flex-schedule":
      return "Flex 30 min?";
    case "propose-times":
      return "Pick Times";
    case "pick-time":
      return "Pick a Time";
    case "enter-score":
      return "Enter Score";
  }
}

function getActionLabel(type: ActionType): string {
  switch (type) {
    case "confirm-score":
      return "Score to confirm";
    case "flex-schedule":
      return "Flex scheduling needed";
    case "propose-times":
      return "Propose times";
    case "pick-time":
      return "Pick a time";
    case "enter-score":
      return "Enter match score";
  }
}

export default function ActionCard({ action, onAction }: Props) {
  const handleClick = useCallback(() => {
    onAction(action);
  }, [action, onAction]);

  const colorClass = getColorClass(action.type);

  return (
    <div className={`action-card ${colorClass}`}>
      <div className="action-card-body">
        <div className="action-card-label">{getActionLabel(action.type)}</div>
        <div className="action-card-opponent">vs {action.opponentName}</div>
        <div className="action-card-meta">
          {action.tournamentName} &middot; {ordinal(action.round)} round
        </div>
      </div>
      <button className="action-card-cta" onClick={handleClick}>
        {getCtaText(action.type)}
      </button>
    </div>
  );
}
