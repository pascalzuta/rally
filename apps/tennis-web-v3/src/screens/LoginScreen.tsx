import { useState } from "react";

interface Props {
  onLogin: (email: string) => void | Promise<void>;
}

function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    setSubmitting(true);
    try {
      await onLogin(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-header">
        <h1>
          <img src="/favicon.svg" alt="Rally" className="login-logo" />
          Rally
        </h1>
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
          disabled={submitting}
        />

        {error && <p className="login-error">{error}</p>}

        <button
          type="submit"
          className="login-btn"
          disabled={submitting || !email.trim()}
        >
          {submitting ? "Signing in..." : "Sign In / Sign Up"}
        </button>
      </form>
    </div>
  );
}

export default LoginScreen;
