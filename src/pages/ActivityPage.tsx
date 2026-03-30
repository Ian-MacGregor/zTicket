/**
 * ActivityPage.tsx
 *
 * Full-page audit log showing every action recorded in the system (ticket
 * created, status changed, comment added, etc.). Results are paginated
 * server-side at PAGE_SIZE rows per page. Clicking a row navigates to the
 * related ticket when one is available.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

/** Number of activity rows fetched per page. */
const PAGE_SIZE = 50;

/** Formats an ISO date string as locale date + time (HH:MM:SS). */
function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function ActivityPage() {
  const navigate = useNavigate();

  // ── Pagination & data state ──────────────────────────────
  const [rows, setRows]       = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Fetch a single page of activity records whenever the page number changes.
  useEffect(() => {
    setLoading(true);
    setError(null);
    api.listActivityPaged(page, PAGE_SIZE)
      .then(r => { setRows(r.data); setTotal(r.total); })
      .catch(e => setError(e.message ?? "Failed to load activity."))
      .finally(() => setLoading(false));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd   = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="form-page">
      <header className="form-header">
        <h1>Activity</h1>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="activity-page-table">
        <div className="activity-page-header">
          <span className="activity-page-col activity-page-col--time">Time</span>
          <span className="activity-page-col activity-page-col--ticket">Ticket</span>
          <span className="activity-page-col activity-page-col--actor">User</span>
          <span className="activity-page-col activity-page-col--action">Action</span>
        </div>

        {loading ? (
          [1,2,3,4,5].map(i => (
            <div key={i} className="activity-page-row">
              <span className="activity-page-col activity-page-col--time"><span className="skeleton skeleton-meta" /></span>
              <span className="activity-page-col activity-page-col--ticket"><span className="skeleton skeleton-badge" /></span>
              <span className="activity-page-col activity-page-col--actor"><span className="skeleton skeleton-meta" /></span>
              <span className="activity-page-col activity-page-col--action"><span className="skeleton skeleton-meta" /></span>
            </div>
          ))
        ) : rows.length === 0 ? (
          <p className="empty-state">No activity recorded yet.</p>
        ) : rows.map(a => (
          <div key={a.id} className="activity-page-row" onClick={() => a.ticket_id && navigate(`/tickets/${a.ticket_id}`)} style={{ cursor: a.ticket_id ? "pointer" : undefined }}>
            <span className="activity-page-col activity-page-col--time">{formatDateTime(a.created_at)}</span>
            <span className="activity-page-col activity-page-col--ticket">
              {a.ticket?.ref_number ? <span className="activity-ref">#{a.ticket.ref_number}</span> : "—"}
            </span>
            <span className="activity-page-col activity-page-col--actor">
              {a.actor?.full_name || a.actor?.email || "—"}
            </span>
            <span className="activity-page-col activity-page-col--action">{a.action}</span>
          </div>
        ))}
      </div>

      <div className="pagination-row">
        <button
          className="btn btn-ghost btn-sm"
          disabled={page <= 1 || loading}
          onClick={() => setPage(p => p - 1)}
        >
          ← Prev
        </button>
        <div className="pagination-center">
          <span className="pagination-info">Page {page} of {totalPages}</span>
          <span className="sort-count">
            {total === 0 ? "0 records" : `${rangeStart}–${rangeEnd} of ${total} record${total !== 1 ? "s" : ""}`}
          </span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page >= totalPages || loading}
          onClick={() => setPage(p => p + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
