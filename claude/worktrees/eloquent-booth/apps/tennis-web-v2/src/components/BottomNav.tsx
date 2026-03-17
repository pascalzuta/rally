import { useCallback } from "react";
import type { Tab } from "../types";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  actionCount: number;
}

const TAB_ITEMS: Array<{ id: Tab; label: string }> = [
  { id: "home", label: "Home" },
  { id: "tourney", label: "Tourney" },
  { id: "activity", label: "Activity" },
  { id: "profile", label: "Profile" },
];

function NavIcon({ id }: { id: Tab }) {
  const props = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "home":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
          <path d="M9 21V13h6v8" />
        </svg>
      );
    case "tourney":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <path d="M6 9H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3" />
          <path d="M18 9h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-3" />
          <path d="M6 4h12v6a6 6 0 0 1-12 0V4z" />
          <path d="M12 16v3" />
          <path d="M8 22h8" />
          <path d="M8 19h8" />
        </svg>
      );
    case "activity":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4" />
          <path d="M8 2v4" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
        </svg>
      );
    case "profile":
      return (
        <svg {...props} viewBox="0 0 24 24">
          <circle cx="12" cy="8" r="4" />
          <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
        </svg>
      );
  }
}

export default function BottomNav({ activeTab, onTabChange, actionCount }: Props) {
  const handleTabClick = useCallback(
    (tab: Tab) => {
      onTabChange(tab);
    },
    [onTabChange],
  );

  return (
    <nav className="bottom-nav">
      {TAB_ITEMS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-tab ${isActive ? "nav-tab--active" : ""}`}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="nav-tab-icon"><NavIcon id={tab.id} /></span>
            <span className="nav-tab-label">{tab.label}</span>
            {tab.id === "home" && actionCount > 0 && (
              <span className="nav-badge">{actionCount}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
