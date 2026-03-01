import { useCallback, useState } from "react";

interface Props {
  onLogin: (email: string) => void;
  onStep: (step: 1 | 2 | 3 | 4) => Promise<string>;
  isLoggedIn: boolean;
  onReset: () => void;
}

const TEST_ACCOUNTS = [
  { email: "test1@rally.test", name: "T1" },
  { email: "test2@rally.test", name: "T2" },
  { email: "test3@rally.test", name: "T3" },
  { email: "test4@rally.test", name: "T4" },
  { email: "test5@rally.test", name: "T5" },
  { email: "test6@rally.test", name: "T6" },
];

const STEPS = [
  { num: 1 as const, label: "Seed", needsLogin: false },
  { num: 2 as const, label: "Simulate", needsLogin: false },
  { num: 3 as const, label: "Schedule", needsLogin: true },
  { num: 4 as const, label: "Scores", needsLogin: true },
];

type StepState = "locked" | "ready" | "running" | "done" | "error";

export default function TestBar({ onLogin, onStep, isLoggedIn, onReset }: Props) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [runningStep, setRunningStep] = useState<number | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const getStepState = (stepNum: number, needsLogin: boolean): StepState => {
    if (runningStep === stepNum) return "running";
    if (completedSteps.has(stepNum)) return "done";

    // Only lock if login is required and user isn't logged in
    if (needsLogin && !isLoggedIn) return "locked";

    return "ready";
  };

  const handleStep = useCallback(
    async (stepNum: 1 | 2 | 3 | 4) => {
      setRunningStep(stepNum);
      setLastMessage(null);
      try {
        const msg = await onStep(stepNum);
        setCompletedSteps((prev) => new Set([...prev, stepNum]));
        setLastMessage(msg);
      } catch (e) {
        setLastMessage(e instanceof Error ? e.message : "Failed");
      } finally {
        setRunningStep(null);
      }
    },
    [onStep],
  );

  const handleReset = useCallback(() => {
    setCompletedSteps(new Set());
    setRunningStep(null);
    setLastMessage(null);
    onReset();
  }, [onReset]);

  const handleLogin = useCallback(
    (email: string) => {
      onLogin(email);
    },
    [onLogin],
  );

  return (
    <div className="test-bar">
      {/* Login buttons */}
      {TEST_ACCOUNTS.map((account) => (
        <button
          key={account.email}
          className="test-bar-btn"
          onClick={() => handleLogin(account.email)}
        >
          {account.name}
        </button>
      ))}

      <span className="test-bar-divider">|</span>

      {/* Step buttons */}
      {STEPS.map((step) => {
        const state = getStepState(step.num, step.needsLogin);
        const isDisabled = state === "locked" || state === "running";
        return (
          <button
            key={step.num}
            className={`test-step test-step--${state}`}
            disabled={isDisabled}
            onClick={() => handleStep(step.num)}
          >
            <span className="test-step-num">{step.num}</span>
            <span className="test-step-label">
              {state === "running"
                ? "..."
                : state === "done"
                  ? "\u2713"
                  : step.label}
            </span>
          </button>
        );
      })}

      {/* Reset */}
      <button className="test-bar-btn test-bar-reset" onClick={handleReset}>
        Reset
      </button>

      {/* Status message */}
      {lastMessage && (
        <span className="test-bar-msg">{lastMessage}</span>
      )}
    </div>
  );
}
