import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";

const STATUS_COLORS: Record<string, string> = {
  unassigned: "var(--status-unassigned)",
  reserved: "var(--status-reserved)",
  assigned: "var(--status-assigned)",
  review: "var(--status-review)",
  complete: "var(--status-complete)",
  sent: "var(--status-sent)",
};

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    api
      .getTicket(id)
      .then(setTicket)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !id) return;
    setUploading(true);
    try {
      await api.uploadFiles(id, e.target.files);
      load(); // refresh
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadAll = async () => {
    if (!id) return;
    setDownloading(true);
    try {
      await api.downloadAllFiles(id);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!id || !confirm("Delete this file?")) return;
    await api.deleteFile(id, fileId);
    load();
  };

  const handleDelete = async () => {
    if (!id || !confirm("Permanently delete this ticket?")) return;
    await api.deleteTicket(id);
    navigate("/");
  };

  if (loading) return <div className="loading-state">Loading…</div>;
  if (!ticket) return <div className="empty-state">Ticket not found.</div>;

  return (
    <div className="detail-page">
      {/* ── Header ──────────────────────────────────── */}
      <header className="detail-header">
        <button className="btn btn-ghost" onClick={() => navigate("/")}>
          ← All Tickets
        </button>
        <div className="detail-actions">
          <Link to={`/tickets/${id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
          <button className="btn btn-danger" onClick={handleDelete}>
            Delete
          </button>
        </div>
      </header>

      {/* ── Title + Status ──────────────────────────── */}
      <div className="detail-title-row">
        <span className="detail-ref">#{ticket.ref_number}</span>
        <h1>{ticket.title}</h1>
        <span
          className="status-badge status-badge-lg"
          style={{ background: STATUS_COLORS[ticket.status] }}
        >
          {ticket.status}
        </span>
      </div>

      {ticket.description && (
        <p className="detail-description">{ticket.description}</p>
      )}

      {/* ── Metadata Grid ───────────────────────────── */}
      <div className="detail-grid">
        <div className="detail-field">
          <span className="field-label">Priority</span>
          <span className={`priority-tag priority-${ticket.priority}`}>
            {ticket.priority}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Assigned To</span>
          <span className="field-value">
            {ticket.assignee?.full_name || "Unassigned"}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Reviewer</span>
          <span className="field-value">
            {ticket.reviewer?.full_name || "None"}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Created By</span>
          <span className="field-value">
            {ticket.creator?.full_name || "Unknown"}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Client</span>
          <span className="field-value">
            {ticket.client?.name || "None"}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Date Assigned</span>
          <span className="field-value">
            {formatDateTime(ticket.date_assigned)}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Date Completed</span>
          <span className="field-value">
            {formatDateTime(ticket.date_completed)}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Date Sent</span>
          <span className="field-value">
            {formatDateTime(ticket.date_sent)}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Quoted Time</span>
          <span className="field-value">
            {ticket.quoted_time || "—"}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Quoted Price</span>
          <span className="field-value">
            {ticket.quoted_price != null ? `$${Number(ticket.quoted_price).toFixed(2)}` : "—"}
          </span>
        </div>
        <div className="detail-field">
          <span className="field-label">Quoted AMF Increase</span>
          <span className="field-value">
            {ticket.quoted_amf != null ? `$${Number(ticket.quoted_amf).toFixed(2)}` : "—"}
          </span>
        </div>
      </div>

      {/* ── Comments ────────────────────────────────── */}
      {ticket.comments && (
        <div className="detail-section">
          <h2>Comments</h2>
          <p className="detail-description">{ticket.comments}</p>
        </div>
      )}

      {/* ── Gmail Links ─────────────────────────────── */}
      {ticket.gmail_links?.length > 0 && (
        <div className="detail-section">
          <h2>Email Links</h2>
          <ul className="gmail-links-list">
            {ticket.gmail_links.map((link: string, i: number) => (
              <li key={i}>
                <a href={link} target="_blank" rel="noopener noreferrer">
                  {link.length > 80 ? link.slice(0, 80) + "…" : link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Files ───────────────────────────────────── */}
      <div className="detail-section">
        <div className="section-header">
          <h2>Files</h2>
          <div className="section-actions">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleUpload}
              style={{ display: "none" }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "Upload Files"}
            </button>
            {ticket.files?.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleDownloadAll}
                disabled={downloading}
              >
                {downloading ? "Zipping…" : "⬇ Download All (.zip)"}
              </button>
            )}
          </div>
        </div>

        {ticket.files?.length > 0 ? (
          <div className="file-list">
            {ticket.files.map((f: any) => (
              <div key={f.id} className="file-row">
                <div className="file-info">
                  <span className="file-name">{f.file_name}</span>
                  <span className="file-meta">
                    {(f.file_size / 1024).toFixed(1)} KB &middot;{" "}
                    {new Date(f.created_at).toLocaleDateString()}
                  </span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDeleteFile(f.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-files">No files attached yet.</p>
        )}
      </div>
    </div>
  );
}
