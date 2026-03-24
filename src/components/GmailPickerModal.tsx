import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

declare const google: any;

// ── Types ───────────────────────────────────────────────────

interface GmailHeader { name: string; value: string; }

interface GmailMessageListItem {
  id: string;
  threadId: string;
}

interface GmailMessageFull {
  id: string;
  threadId: string;
  snippet: string;
  payload: {
    headers: GmailHeader[];
    mimeType: string;
    body: { data?: string };
    parts?: any[];
  };
  internalDate: string; // ms since epoch as string
}

interface ParsedMessage {
  id: string;
  threadId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  toEmail: string;
  snippet: string;
  bodyHtml: string | null;
  bodyText: string | null;
  receivedAt: string;
}

interface Props {
  ticketId: string;
  importedGmailIds: string[];
  onClose: () => void;
  onImported: () => void;
}

// ── Helpers ─────────────────────────────────────────────────

function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function parseFrom(fromHeader: string): { name: string; email: string } {
  const match = fromHeader.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: "", email: fromHeader.trim() };
}

function base64UrlDecode(encoded: string): string {
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(b64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
    );
  } catch {
    return atob(b64);
  }
}

function extractBody(payload: any): { html: string | null; text: string | null } {
  let html: string | null = null;
  let text: string | null = null;
  function walk(part: any) {
    if (!part) return;
    const mime = (part.mimeType ?? "").toLowerCase();
    if (mime === "text/html" && part.body?.data && !html) {
      html = base64UrlDecode(part.body.data);
    } else if (mime === "text/plain" && part.body?.data && !text) {
      text = base64UrlDecode(part.body.data);
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return { html, text };
}

function parseMessage(msg: GmailMessageFull): ParsedMessage {
  const headers = msg.payload.headers;
  const subject = getHeader(headers, "Subject");
  const { name: fromName, email: fromEmail } = parseFrom(getHeader(headers, "From"));
  const toEmail = getHeader(headers, "To");
  const { html, text } = extractBody(msg.payload);
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject,
    fromEmail,
    fromName,
    toEmail,
    snippet: msg.snippet,
    bodyHtml: html,
    bodyText: text,
    receivedAt: new Date(parseInt(msg.internalDate)).toISOString(),
  };
}

async function gmailFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error?.message ?? `Gmail API error ${res.status}`);
  }
  return res.json();
}

function loadGIS(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof google !== "undefined" && google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.getElementById("gis-script");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

// ── Component ───────────────────────────────────────────────

export default function GmailPickerModal({ ticketId, importedGmailIds, onClose, onImported }: Props) {
  const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID as string;

  const [token, setToken]               = useState<string | null>(null);
  const [connecting, setConnecting]     = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");
  const [messages, setMessages]         = useState<ParsedMessage[]>([]);
  const [searching, setSearching]       = useState(false);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [importing, setImporting]       = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Pagination: prevTokens holds the page tokens for pages we've already visited,
  // so we can go backwards. currentToken is what was used to fetch the current page.
  // nextPageToken is what the API returned for the page after this one.
  const [prevTokens, setPrevTokens]       = useState<(string | null)[]>([]);
  const [currentToken, setCurrentToken]   = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const pageNumber = prevTokens.length + 1;

  const tokenClientRef  = useRef<any>(null);
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeQueryRef  = useRef(""); // tracks the query in effect for the current page set

  // Initialise the GIS token client once the script has loaded
  useEffect(() => {
    if (!clientId) {
      setError("VITE_GOOGLE_CLIENT_ID is not configured.");
      return;
    }
    loadGIS().then(() => {
      tokenClientRef.current = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
        callback: (resp: any) => {
          setConnecting(false);
          if (resp.error) {
            setError(`Google sign-in failed: ${resp.error}`);
          } else {
            setToken(resp.access_token);
          }
        },
      });
    });
  }, [clientId]);

  // Auto-load first page of recent messages once we have a token
  useEffect(() => {
    if (token) fetchMessages(token, "", null);
  }, [token]);

  // Debounce search input — resets to page 1 for the new query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (token) resetAndFetch(token, pendingQuery);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [pendingQuery, token]);

  function resetAndFetch(accessToken: string, q: string) {
    activeQueryRef.current = q;
    setPrevTokens([]);
    setCurrentToken(null);
    setNextPageToken(null);
    fetchMessages(accessToken, q, null);
  }

  async function fetchMessages(accessToken: string, q: string, pageToken: string | null) {
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ maxResults: "10" });
      if (q.trim()) params.set("q", q.trim());
      if (pageToken) params.set("pageToken", pageToken);
      const list = await gmailFetch<{ messages?: GmailMessageListItem[]; nextPageToken?: string }>(
        accessToken, `/messages?${params}`
      );
      const items = list.messages ?? [];
      setNextPageToken(list.nextPageToken ?? null);
      const full = await Promise.all(
        items.map(m => gmailFetch<GmailMessageFull>(accessToken, `/messages/${m.id}?format=full`))
      );
      setMessages(full.map(parseMessage));
    } catch (err: any) {
      if (err.message?.includes("401")) {
        setToken(null);
        setError("Google session expired. Please reconnect.");
      } else {
        setError(err.message ?? "Failed to fetch messages.");
      }
    } finally {
      setSearching(false);
    }
  }

  function handleNextPage() {
    if (!token || !nextPageToken) return;
    setPrevTokens(prev => [...prev, currentToken]);
    setCurrentToken(nextPageToken);
    fetchMessages(token, activeQueryRef.current, nextPageToken);
  }

  function handlePrevPage() {
    if (!token || prevTokens.length === 0) return;
    const prev = prevTokens[prevTokens.length - 1];
    setPrevTokens(p => p.slice(0, -1));
    setCurrentToken(prev);
    fetchMessages(token, activeQueryRef.current, prev);
  }

  function handleConnect() {
    setConnecting(true);
    setError(null);
    tokenClientRef.current?.requestAccessToken();
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (!selected.size) return;
    setImporting(true);
    setError(null);
    const toImport = messages.filter(m => selected.has(m.id));
    try {
      await Promise.all(
        toImport.map(m =>
          api.importEmail(ticketId, {
            gmail_message_id: m.id,
            gmail_thread_id:  m.threadId,
            subject:          m.subject,
            from_email:       m.fromEmail,
            from_name:        m.fromName,
            to_email:         m.toEmail,
            snippet:          m.snippet,
            body_html:        m.bodyHtml,
            body_text:        m.bodyText,
            received_at:      m.receivedAt,
          })
        )
      );
      onImported();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const importedSet = new Set(importedGmailIds);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal gmail-picker-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="gmail-picker-header">
          <h2 className="modal-title">Import Gmail Messages</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!clientId && (
          <p className="gmail-picker-hint">
            Set <code>VITE_GOOGLE_CLIENT_ID</code> in your frontend <code>.env</code> to enable Gmail import.
          </p>
        )}

        {/* Connect state */}
        {!token && clientId && (
          <div className="gmail-picker-connect">
            <p className="gmail-picker-hint">
              Sign in with Google to browse and import messages directly into this ticket.
              Only read access is requested — no emails will be sent or modified.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? "Waiting for Google sign-in…" : "Connect Google Account"}
            </button>
          </div>
        )}

        {/* Search + list */}
        {token && (
          <>
            <div className="gmail-picker-search">
              <input
                type="text"
                className="gmail-search-input"
                placeholder="Search messages (e.g. from:jane subject:invoice)…"
                value={pendingQuery}
                onChange={e => setPendingQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div className="gmail-msg-list">
              {searching && (
                <p className="gmail-picker-hint gmail-picker-loading">Searching…</p>
              )}
              {!searching && messages.length === 0 && (
                <p className="gmail-picker-hint">No messages found.</p>
              )}
              {!searching && messages.map(m => {
                const alreadyImported = importedSet.has(m.id);
                const isSelected      = selected.has(m.id);
                return (
                  <label
                    key={m.id}
                    className={`gmail-msg-item${isSelected ? " gmail-msg-item--selected" : ""}${alreadyImported ? " gmail-msg-item--imported" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected || alreadyImported}
                      disabled={alreadyImported}
                      onChange={() => toggleSelect(m.id)}
                    />
                    <div className="gmail-msg-info">
                      <div className="gmail-msg-top">
                        <span className="gmail-msg-from">
                          {m.fromName || m.fromEmail}
                        </span>
                        <span className="gmail-msg-date">
                          {new Date(m.receivedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="gmail-msg-subject">{m.subject || "(no subject)"}</div>
                      <div className="gmail-msg-snippet">{m.snippet}</div>
                      {alreadyImported && (
                        <span className="gmail-msg-badge">Already imported</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="gmail-picker-pagination">
              <button
                className="btn btn-ghost btn-sm"
                onClick={handlePrevPage}
                disabled={prevTokens.length === 0 || searching}
              >
                ← Prev
              </button>
              <span className="gmail-picker-page">Page {pageNumber}</span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleNextPage}
                disabled={!nextPageToken || searching}
              >
                Next →
              </button>
            </div>

            <div className="modal-actions">
              <span className="gmail-picker-count">
                {selected.size > 0 ? `${selected.size} selected` : ""}
              </span>
              <button className="btn btn-ghost" onClick={onClose} disabled={importing}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
              >
                {importing ? "Importing…" : `Import ${selected.size || ""} Message${selected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
