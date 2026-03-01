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
          <svg className="login-ball" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" fill="#c8e64a" stroke="#a8c43a" strokeWidth="2"/>
            <path d="M8 8c4 6 4 18 0 24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7"/>
            <path d="M32 8c-4 6-4 18 0 24" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7"/>
          </svg>
          {" "}Rally
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
