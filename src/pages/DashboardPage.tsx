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
          <h1>Tickets</h1>
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
        {Object.entries(stats).map(([key, val]) => (
          <div
            key={key}
            className={`stat-card ${key !== "total" ? "clickable" : ""}`}
            onClick={() => key !== "total" && setFilterStatus(filterStatus === key ? "all" : key)}
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
        />
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="filter-select"
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
        <div className="loading-state">Loading tickets…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No tickets match your filters.</p>
        </div>
      ) : (
        <div className="ticket-list">
          {filtered.map((t) => (
            <Link to={`/tickets/${t.id}`} key={t.id} className="ticket-row">
              <div className="ticket-row-left">
                <span
                  className="status-badge"
                  style={{ background: STATUS_COLORS[t.status] }}
                >
                  {t.status}
                </span>
                <div className="ticket-info">
                  <span className="ticket-title">{t.title}</span>
                  <span className="ticket-meta">
                    {t.assignee?.full_name || "Unassigned"} &middot;{" "}
                    {new Date(t.date_assigned).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="ticket-row-right">
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
