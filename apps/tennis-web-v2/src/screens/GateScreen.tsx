import { useState } from "react";

const GATE_KEY = "rally-v2-gate";
const API = import.meta.env.VITE_API_URL || "/v1";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError(false);
    try {
      const res = await fetch(`${API}/auth/gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: value }),
      });
      const data = (await res.json()) as { ok: boolean };
      if (data.ok) {
        sessionStorage.setItem(GATE_KEY, "1");
        onUnlock();
      } else {
        setError(true);
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setChecking(false);
    }
  };

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
      </form>
    </div>
  );
}
