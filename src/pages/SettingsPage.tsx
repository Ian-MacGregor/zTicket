import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

declare const google: any;

const SESSION_TOKEN_KEY = "zticket_gmail_token";
const CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID as string;

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
  const navigate = useNavigate();

  const [me, setMe]               = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);

  const tokenClientRef = useRef<any>(null);

  useEffect(() => {
    api.getMe()
      .then(setMe)
      .catch(() => setError("Failed to load profile."))
      .finally(() => setLoading(false));
    // Pre-load GIS so it's ready when the user clicks Connect
    if (CLIENT_ID) loadGIS().then(() => initTokenClient(false));
  }, []);

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

  function handleConnect(forcePickAccount = false) {
    setError(null);
    setSuccess(null);
    setConnecting(true);
    loadGIS().then(() => {
      initTokenClient(forcePickAccount);
      tokenClientRef.current?.requestAccessToken();
    });
  }

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
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
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
