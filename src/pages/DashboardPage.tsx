import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const STATUS_COLORS: Record<string, string> = {
  assigned: "var(--status-assigned)",
  review: "var(--status-review)",
  complete: "var(--status-complete)",
  sent: "var(--status-sent)",
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: "⬤ Critical",
  high: "◉ High",
  medium: "○ Medium",
  low: "◌ Low",
};

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getLastStatusDate(ticket: any): string | null {
  if (ticket.date_sent) return ticket.date_sent;
  if (ticket.date_completed) return ticket.date_completed;
  return ticket.date_assigned;
}

export default function DashboardPage() {
  const { signOut, user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .listTickets()
      .then(setTickets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = tickets.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (
      search &&
      !t.title.toLowerCase().includes(search.toLowerCase()) &&
      !t.description?.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const stats = {
    total: tickets.length,
    assigned: tickets.filter((t) => t.status === "assigned").length,
    review: tickets.filter((t) => t.status === "review").length,
    complete: tickets.filter((t) => t.status === "complete").length,
    sent: tickets.filter((t) => t.status === "sent").length,
  };

  return (
    <div className="dashboard">
      {/* ── Top Bar ─────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">⬡</span>
          <h1>zTicket</h1>
        </div>
        <div className="topbar-right">
          <span className="topbar-email">{user?.email}</span>
          <button className="btn btn-ghost" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {/* ── Stats Row ───────────────────────────────── */}
      <div className="stats-row">
        {loading
          ? ["total", "assigned", "review", "complete", "sent"].map((key) => (
              <div key={key} className="stat-card">
                <span className="skeleton skeleton-value" />
                <span className="stat-label">{key}</span>
                {key !== "total" && (
                  <span
                    className="stat-dot"
                    style={{ background: STATUS_COLORS[key] }}
                  />
                )}
              </div>
            ))
          : Object.entries(stats).map(([key, val]) => (
              <div
                key={key}
                className={`stat-card ${key !== "total" ? "clickable" : ""}`}
                onClick={() =>
                  key !== "total" &&
                  setFilterStatus(filterStatus === key ? "all" : key)
                }
              >
                <span className="stat-value">{val}</span>
                <span className="stat-label">{key}</span>
                {key !== "total" && (
                  <span
                    className="stat-dot"
                    style={{ background: STATUS_COLORS[key] }}
                  />
                )}
              </div>
            ))}
      </div>

      {/* ── Toolbar ─────────────────────────────────── */}
      <div className="toolbar">
        <input
          className="search-input"
          type="text"
          placeholder="Search tickets…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={loading}
        />
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="filter-select"
          disabled={loading}
        >
          <option value="all">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
          disabled={loading}
        >
          <option value="all">All statuses</option>
          <option value="assigned">Assigned</option>
          <option value="review">Review</option>
          <option value="complete">Complete</option>
          <option value="sent">Sent</option>
        </select>
        <Link to="/tickets/new" className="btn btn-primary">
          + New Ticket
        </Link>
      </div>

      {/* ── Ticket List ─────────────────────────────── */}
      {loading ? (
        <div className="ticket-list">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ticket-row ticket-row-skeleton">
              <div className="ticket-row-left">
                <span className="skeleton skeleton-badge" />
                <div className="ticket-info">
                  <span className="skeleton skeleton-title" />
                  <span className="skeleton skeleton-meta" />
                </div>
              </div>
              <div className="ticket-row-right">
                <span className="skeleton skeleton-priority" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No tickets match your filters.</p>
        </div>
      ) : (
        <div className="ticket-list">
          {filtered.map((t) => (
            <Link to={`/tickets/${t.id}`} key={t.id} className="ticket-row">
              <div className="ticket-row-left">
                <span className="ticket-ref">#{t.ref_number}</span>
                <span
                  className="status-badge"
                  style={{ background: STATUS_COLORS[t.status] }}
                >
                  {t.status}
                </span>
                <div className="ticket-info">
                  <span className="ticket-title">{t.title}</span>
                  <span className="ticket-meta">
                    {t.assignee?.full_name || "Unassigned"}
                    {t.reviewer ? <> &middot; Review: {t.reviewer.full_name}</> : null}
                  </span>
                </div>
              </div>
              <div className="ticket-row-right">
                <div className="ticket-dates">
                  <span className="ticket-date">Assigned: {formatDateTime(t.date_assigned)}</span>
                  <span className="ticket-date">Updated: {formatDateTime(getLastStatusDate(t))}</span>
                </div>
                <span className={`priority-tag priority-${t.priority}`}>
                  {PRIORITY_LABELS[t.priority]}
                </span>
                {t.files?.length > 0 && (
                  <span className="file-count">
                    📎 {t.files.length}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
