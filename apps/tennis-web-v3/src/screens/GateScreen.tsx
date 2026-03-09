import { useState } from "react";

const GATE_KEY = "rally-v3-gate";
const GATE_PWD_KEY = "rally-v3-gate-pwd";
const DEFAULT_PASSWORD = "qWf9HAPJYJsSv5kk";
const RESET_KEY = "rally-master-reset-2024";

function getGatePassword(): string {
  return localStorage.getItem(GATE_PWD_KEY) || DEFAULT_PASSWORD;
}

/** Check if user already passed the gate this session */
export function isGateUnlocked(): boolean {
  return sessionStorage.getItem(GATE_KEY) === "1";
}

interface Props {
  onUnlock: () => void;
}

export default function GateScreen({ onUnlock }: Props) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(false);

  // Reset password state
  const [showReset, setShowReset] = useState(false);
  const [resetKey, setResetKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(false);
    if (value === getGatePassword()) {
      sessionStorage.setItem(GATE_KEY, "1");
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
    setChecking(false);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetting(true);
    setResetError("");
    setResetSuccess(false);
    if (resetKey !== RESET_KEY) {
      setResetError("Invalid reset key. Please try again.");
    } else if (newPassword.length < 4) {
      setResetError("Password must be at least 4 characters.");
    } else {
      localStorage.setItem(GATE_PWD_KEY, newPassword);
      setResetSuccess(true);
      setResetKey("");
      setNewPassword("");
    }
    setResetting(false);
  };

  if (showReset) {
    return (
      <div className="login-screen">
        <div className="login-header">
          <h1>
            <img src="/favicon.svg" alt="Rally" className="login-logo" />
            Rally
          </h1>
          <p>Reset the gate password</p>
        </div>

        <form className="login-form" onSubmit={handleReset}>
          <input
            type="password"
            className="login-input"
            placeholder="Reset key"
            value={resetKey}
            onChange={(e) => { setResetKey(e.target.value); setResetError(""); setResetSuccess(false); }}
            autoFocus
            disabled={resetting}
          />
          <input
            type="password"
            className="login-input"
            style={{ marginTop: 12 }}
            placeholder="New password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setResetError(""); setResetSuccess(false); }}
            disabled={resetting}
          />

          {resetError && <p className="login-error">{resetError}</p>}
          {resetSuccess && <p className="login-success">Password changed! Go back and log in.</p>}

          <button
            type="submit"
            className="login-btn"
            disabled={!resetKey.trim() || !newPassword.trim() || resetting}
          >
            {resetting ? "Resetting..." : "Reset Password"}
          </button>

          <button
            type="button"
            className="login-link"
            onClick={() => { setShowReset(false); setResetError(""); setResetSuccess(false); }}
          >
            Back to login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div className="login-header">
        <h1>
          <img src="/favicon.svg" alt="Rally" className="login-logo" />
          Rally
        </h1>
        <p>Enter the password to continue</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="password"
          className={`login-input${shake ? " gate-shake" : ""}`}
          placeholder="Password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(false);
          }}
          autoFocus
          disabled={checking}
        />

        {error && <p className="login-error">Wrong password. Try again.</p>}

        <button
          type="submit"
          className="login-btn"
          disabled={!value.trim() || checking}
        >
          {checking ? "Checking..." : "Enter"}
        </button>

        <button
          type="button"
          className="login-link"
          onClick={() => setShowReset(true)}
        >
          Forgot password?
        </button>
      </form>
    </div>
  );
}
