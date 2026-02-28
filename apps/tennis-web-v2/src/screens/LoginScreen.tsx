import React, { useState } from "react";

interface Props {
  onLogin: (email: string) => Promise<void>;
  loading: boolean;
}

function LoginScreen({ onLogin, loading }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    try {
      await onLogin(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
    }
  };

  return (
    <div className="login-screen">
      <div className="login-header">
        <h1 className="login-title">
          <span role="img" aria-label="tennis">🎾</span> Rally
        </h1>
        <p className="login-subtitle">Effortless tournament scheduling</p>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          className="login-input"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          disabled={loading}
        />

        {error && <p className="login-error">{error}</p>}

        <button
          type="submit"
          className="login-btn"
          disabled={loading || !email.trim()}
        >
          {loading ? "Signing in..." : "Sign In / Sign Up"}
        </button>
      </form>
    </div>
  );
}

export default LoginScreen;
