/**
 * LoginPage.tsx
 *
 * Authentication entry point for the app. Handles both sign-in and registration
 * in a single page, toggled by local state. On successful sign-in the AuthProvider
 * updates the user session and the router redirects to the dashboard. On
 * registration the user is prompted to confirm their email before signing in.
 */

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import TicketIcon from "../components/TicketIcon";

export default function LoginPage() {
  const { signIn, signUp } = useAuth();

  // ── Form mode ────────────────────────────────────────────
  // isRegister toggles between the sign-in and registration form layouts.
  const [isRegister, setIsRegister] = useState(false);

  // ── Field state ──────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // ── Submission state ─────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  /**
   * Submits sign-in or registration depending on the current mode.
   * Errors returned from the auth hook are displayed inline; a successful
   * registration shows a confirmation message instead of redirecting.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    if (isRegister) {
      const err = await signUp(email, password, fullName);
      if (err) setError(err);
      else setSuccess("Account created! Check your email to confirm, then sign in.");
    } else {
      const err = await signIn(email, password);
      if (err) setError(err);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* ── Branding header ──────────────────────────── */}
        <div className="login-header">
          <div className="login-logo"><TicketIcon size={40} /></div>
          <h1>zTicket</h1>
          <p>{isRegister ? "Create your account" : "Sign in to continue"}</p>
        </div>

        {/* ── Inline feedback messages ─────────────────── */}
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* ── Credentials form ─────────────────────────── */}
        <form onSubmit={handleSubmit}>
          {/* Full name field — only visible in registration mode */}
          {isRegister && (
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? "Please wait…" : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>

        {/* ── Mode toggle ──────────────────────────────── */}
        {/* Clears any existing alerts when switching between sign-in and register */}
        <div className="login-footer">
          <button
            className="btn-link"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setSuccess(null);
            }}
          >
            {isRegister
              ? "Already have an account? Sign in"
              : "Need an account? Register"}
          </button>
        </div>
      </div>
    </div>
  );
}
