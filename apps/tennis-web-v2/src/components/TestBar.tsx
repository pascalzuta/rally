import { useCallback } from "react";

interface Props {
  onLogin: (email: string) => void;
  onSeedRich: () => void;
  onSimulate: () => void;
  onAcceptProposals?: () => void;
  onSubmitScores?: () => void;
}

const TEST_ACCOUNTS = [
  { email: "test1@rally.test", name: "Test1" },
  { email: "test2@rally.test", name: "Test2" },
  { email: "test3@rally.test", name: "Test3" },
  { email: "test4@rally.test", name: "Test4" },
  { email: "test5@rally.test", name: "Test5" },
  { email: "test6@rally.test", name: "Test6" },
];

export default function TestBar({ onLogin, onSeedRich, onSimulate, onAcceptProposals, onSubmitScores }: Props) {
  const handleLogin = useCallback(
    (email: string) => {
      onLogin(email);
    },
    [onLogin],
  );

  return (
    <div className="test-bar">
      <div className="test-bar-scroll">
        {TEST_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            className="test-bar-btn"
            onClick={() => handleLogin(account.email)}
          >
            {account.name}
          </button>
        ))}
        <button className="test-bar-btn test-bar-btn--seed" onClick={onSeedRich}>
          Seed Rich
        </button>
        <button className="test-bar-btn test-bar-btn--sim" onClick={onSimulate}>
          Simulate
        </button>
        {onAcceptProposals && (
          <button className="test-bar-btn test-bar-btn--seed" onClick={onAcceptProposals}>
            Accept All
          </button>
        )}
        {onSubmitScores && (
          <button className="test-bar-btn test-bar-btn--sim" onClick={onSubmitScores}>
            Submit Scores
          </button>
        )}
      </div>
    </div>
  );
}
