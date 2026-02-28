import { useCallback } from "react";
import type { Tab } from "../types";
import { TAB_CONFIG } from "../constants";

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  actionCount: number;
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
      {TAB_CONFIG.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-tab ${isActive ? "nav-tab--active" : ""}`}
            onClick={() => handleTabClick(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="nav-tab-icon">{tab.icon}</span>
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
