import { useCallback } from "react";
import type { ActionItem, ActionType } from "../types";

interface Props {
  action: ActionItem;
  onAction: (action: ActionItem) => void;
}

const ACTION_ICONS: Record<ActionType, string> = {
  "confirm-score": "\u2705",
  "flex-schedule": "\u{1F504}",
  "propose-times": "\u{1F4C5}",
  "pick-time": "\u23F0",
  "enter-score": "\u{1F4DD}",
};

const ACTION_LABELS: Record<ActionType, string> = {
  "confirm-score": "Score to confirm",
  "flex-schedule": "Flex scheduling",
  "propose-times": "Propose times",
  "pick-time": "Pick a time",
  "enter-score": "Enter score",
};

const ACTION_CTA: Record<ActionType, string> = {
  "confirm-score": "Confirm",
  "flex-schedule": "Flex 30 min?",
  "propose-times": "Pick Times",
  "pick-time": "Pick a Time",
  "enter-score": "Enter Score",
};

const ACTION_COLORS: Record<ActionType, string> = {
  "confirm-score": "red",
  "flex-schedule": "amber",
  "propose-times": "amber",
  "pick-time": "blue",
  "enter-score": "blue",
};

export default function ActionCard({ action, onAction }: Props) {
  const handleClick = useCallback(() => {
    onAction(action);
  }, [action, onAction]);

  const color = ACTION_COLORS[action.type];

  return (
    <button
      className={`action-card action-card--${color}`}
      onClick={handleClick}
    >
      <span className="action-icon">{ACTION_ICONS[action.type]}</span>
      <span className="action-label">{ACTION_LABELS[action.type]}</span>
      <span className="action-opponent">vs {action.opponentName}</span>
      <span className="action-tourney">{action.tournamentName}</span>
      <span className="action-cta">{ACTION_CTA[action.type]}</span>
    </button>
  );
}
