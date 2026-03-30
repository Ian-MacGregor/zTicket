/**
 * SettingsPage.tsx
 *
 * User-level settings page. Currently contains a single section for linking
 * (or unlinking) a Google Gmail account so the user can import emails into
 * tickets via the GmailPickerModal.
 *
 * OAuth flow:
 *   1. The Google Identity Services (GIS) script is lazy-loaded on mount and
 *      pre-initialised so the token client is ready before the user clicks.
 *   2. handleConnect() triggers the OAuth popup. On success, the access token
 *      is stored in sessionStorage and the linked email address is persisted
 *      to the user's profile via the API.
 *   3. handleDisconnect() removes the token from sessionStorage and clears
 *      the gmail_account field on the profile.
 *
 * VITE_GOOGLE_CLIENT_ID must be set in the environment for the Gmail section
 * to be functional; a warning is displayed when it is absent.
 */

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

// google is injected at runtime by the GIS script — declared here to satisfy TS.
declare const google: any;

/** sessionStorage key used to cache the short-lived Gmail access token. */
const SESSION_TOKEN_KEY = "zticket_gmail_token";

/** Google OAuth client ID, injected at build time via Vite env variables. */
const CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID as string;

/**
 * Lazily loads the Google Identity Services script and resolves when it is
 * ready. Idempotent — safe to call multiple times without adding duplicate
 * script tags.
 */
function loadGIS(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof google !== "undefined" && google?.accounts?.oauth2) { resolve(); return; }
    const existing = document.getElementById("gis-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export default function SettingsPage() {

  // ── Profile & async state ────────────────────────────────
  const [me, setMe]               = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  // Holds the GIS token client instance between renders so we don't recreate it on every click.
  const tokenClientRef = useRef<any>(null);

  // ── Initialisation ───────────────────────────────────────
  // Load the user profile and pre-warm the GIS token client on mount so the
  // OAuth popup opens immediately when the user clicks "Connect".
  useEffect(() => {
    api.getMe()
      .then(setMe)
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
    // Pre-load GIS so it's ready when the user clicks Connect
    if (CLIENT_ID) loadGIS().then(() => initTokenClient(false));
  }, []);

  /**
   * Creates (or re-creates) the GIS token client with the required Gmail
   * read-only scope. The callback handles the access token response:
   * it fetches the user's Google profile to obtain their email address,
   * stores the token in sessionStorage, and persists the email to the profile.
   *
   * @param forcePickAccount — when true, forces the Google account picker to
   *   appear even if a session already exists (used for "Change Account").
   */
  function initTokenClient(forcePickAccount: boolean) {
    tokenClientRef.current = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: "https://www.googleapis.com/auth/gmail.readonly email",
      ...(forcePickAccount ? { prompt: "select_account" } : {}),
      callback: async (resp: any) => {
        setConnecting(false);
        if (resp.error) { setError(`Google sign-in failed: ${resp.error}`); return; }
        setSaving(true);
        setError(null);
        try {
          // Exchange the access token for the user's Google profile info.
          const info = await fetch("https://www.googleapis.com/oauth2/v1/userinfo", {
            headers: { Authorization: `Bearer ${resp.access_token}` },
          }).then(r => r.json());
          sessionStorage.setItem(SESSION_TOKEN_KEY, resp.access_token);
          const updated = await api.updateMe({ gmail_account: info.email });
          setMe(updated);
          setSuccess(`Gmail account linked: ${info.email}`);
        } catch (err: any) {
          setError(err?.message ?? "Failed to save Gmail account.");
        } finally {
          setSaving(false);
        }
      },
    });
  }

  /**
   * Starts the Google OAuth flow. Re-initialises the token client so the
   * forcePickAccount flag is applied, then immediately requests a token.
   */
  function handleConnect(forcePickAccount = false) {
    setError(null);
    setSuccess(null);
    setConnecting(true);
    loadGIS().then(() => {
      initTokenClient(forcePickAccount);
      tokenClientRef.current?.requestAccessToken();
    });
  }

  /**
   * Removes the cached access token from sessionStorage and clears the linked
   * Gmail address from the user's profile.
   */
  async function handleDisconnect() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      const updated = await api.updateMe({ gmail_account: null });
      setMe(updated);
      setSuccess("Gmail account disconnected.");
    } catch {
      setError("Failed to disconnect Gmail account.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading-state">Loading…</div>;

  const linkedAccount = me?.gmail_account ?? null;

  return (
    <div className="form-page">
      <header className="form-header">
        <h1>Settings</h1>
      </header>

      {error   && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Gmail Account ──────────────────────────── */}
      <div className="settings-section">
        <h2 className="settings-section-title">Gmail Account</h2>
        <p className="settings-section-desc">
          Link your Google account so zTicket can import Gmail messages into tickets.
          Only read access is requested — no emails will be sent or modified.
        </p>

        {!CLIENT_ID && (
          <p className="settings-hint settings-hint--warn">
            <code>VITE_GOOGLE_CLIENT_ID</code> is not configured in this deployment.
          </p>
        )}

        {CLIENT_ID && (
          <div className="settings-gmail-row">
            {linkedAccount ? (
              <>
                <div className="settings-gmail-info">
                  <span className="settings-gmail-label">Linked account</span>
                  <span className="settings-gmail-email">{linkedAccount}</span>
                </div>
                <div className="settings-gmail-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={connecting || saving}
                    onClick={() => handleConnect(true)}
                  >
                    {connecting ? "Opening Google…" : "Change Account"}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={saving}
                    onClick={handleDisconnect}
                  >
                    {saving ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="settings-hint">No Gmail account linked yet.</p>
                <button
                  className="btn btn-primary"
                  disabled={connecting || saving}
                  onClick={() => handleConnect(false)}
                >
                  {connecting ? "Waiting for Google sign-in…" : "Connect Gmail Account"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
