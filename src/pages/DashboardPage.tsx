import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const STATUS_COLORS: Record<string, string> = {
  assigned: "var(--status-assigned)",
  review: "var(--status-review)",
  complete: "var(--status-complete)",
  sent: "var(--status-sent)",
};

const STATUSES = ["assigned", "review", "complete", "sent"];

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
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("ref-desc");
  const [filterView, setFilterView] = useState("all");

  useEffect(() => {
    api
      .listTickets()
      .then(setTickets)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const resetFilters = () => {
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterClient("all");
    setSearch("");
    setSortBy("ref-desc");
    setFilterView("all");
  };

  // Derive unique client list from tickets
  const clientList = tickets.reduce((acc: { id: string; name: string }[], t) => {
    if (t.client && !acc.find((c) => c.id === t.client.id)) {
      acc.push({ id: t.client.id, name: t.client.name });
    }
    return acc;
  }, []).sort((a, b) => a.name.localeCompare(b.name));

  const PRIORITY_ORDER: Record<string, number> = {
    low: 0, medium: 1, high: 2, critical: 3,
  };

  const STATUS_ORDER: Record<string, number> = {
    assigned: 0, review: 1, complete: 2, sent: 3,
  };

  const filtered = tickets
    .filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterClient !== "all" && t.client?.id !== filterClient) return false;
      if (filterView === "my-tickets") {
        if (t.assignee?.id !== user?.id) return false;
        if (!["assigned", "review", "complete"].includes(t.status)) return false;
      }
      if (filterView === "my-reviews") {
        if (t.reviewer?.id !== user?.id) return false;
        if (!["review", "complete"].includes(t.status)) return false;
      }
      if (
        search &&
        !t.title.toLowerCase().includes(search.toLowerCase()) &&
        !t.description?.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "priority-asc":
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        case "priority-desc":
          return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
        case "ref-asc":
          return (a.ref_number || 0) - (b.ref_number || 0);
        case "ref-desc":
          return (b.ref_number || 0) - (a.ref_number || 0);
        case "updated-desc":
          return new Date(getLastStatusDate(b) || 0).getTime() - new Date(getLastStatusDate(a) || 0).getTime();
        case "updated-asc":
          return new Date(getLastStatusDate(a) || 0).getTime() - new Date(getLastStatusDate(b) || 0).getTime();
        case "status-asc":
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        case "status-desc":
          return STATUS_ORDER[b.status] - STATUS_ORDER[a.status];
        case "client-asc":
          return (a.client?.name || "zzz").localeCompare(b.client?.name || "zzz");
        case "client-desc":
          return (b.client?.name || "").localeCompare(a.client?.name || "");
        default:
          return 0;
      }
    });

  const stats = {
    total: tickets.length,
    assigned: tickets.filter((t) => t.status === "assigned").length,
    review: tickets.filter((t) => t.status === "review").length,
    complete: tickets.filter((t) => t.status === "complete").length,
    sent: tickets.filter((t) => t.status === "sent").length,
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const updated = await api.updateTicket(ticketId, { status: newStatus });
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, ...updated } : t))
      );
    } catch (err) {
      console.error(err);
    }
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
          <Link to="/colors" className="btn btn-ghost">
            Colors
          </Link>
          <Link to="/clients" className="btn btn-ghost">
            Clients
          </Link>
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
                className="stat-card clickable"
                onClick={() => {
                  if (key === "total") {
                    resetFilters();
                  } else {
                    setFilterStatus(filterStatus === key ? "all" : key);
                  }
                }}
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
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="filter-select"
          disabled={loading}
        >
          <option value="all">All clients</option>
          {clientList.map((cl) => (
            <option key={cl.id} value={cl.id}>
              {cl.name}
            </option>
          ))}
        </select>
        <Link to="/tickets/new" className="btn btn-primary">
          + New Ticket
        </Link>
      </div>

      {/* ── Sort Bar ────────────────────────────────── */}
      <div className="sort-bar">
        <span className="sort-label">Sort by</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="filter-select"
          disabled={loading}
        >
          <optgroup label="Ticket #">
            <option value="ref-desc">Ticket # (newest first)</option>
            <option value="ref-asc">Ticket # (oldest first)</option>
          </optgroup>
          <optgroup label="Priority">
            <option value="priority-desc">Priority (high → low)</option>
            <option value="priority-asc">Priority (low → high)</option>
          </optgroup>
          <optgroup label="Updated Date">
            <option value="updated-desc">Updated (newest first)</option>
            <option value="updated-asc">Updated (oldest first)</option>
          </optgroup>
          <optgroup label="Status">
            <option value="status-asc">Status (assigned → sent)</option>
            <option value="status-desc">Status (sent → assigned)</option>
          </optgroup>
          <optgroup label="Client">
            <option value="client-asc">Client (A → Z)</option>
            <option value="client-desc">Client (Z → A)</option>
          </optgroup>
        </select>
        <button
          className={`btn ${filterView === "my-tickets" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilterView(filterView === "my-tickets" ? "all" : "my-tickets")}
          disabled={loading}
        >
          My Tickets
        </button>
        <button
          className={`btn ${filterView === "my-reviews" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setFilterView(filterView === "my-reviews" ? "all" : "my-reviews")}
          disabled={loading}
        >
          My Reviews
        </button>
        <span className="sort-count">{filtered.length} ticket{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* ── Ticket List ─────────────────────────────── */}
      {loading ? (
        <div className="ticket-table">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="ticket-row ticket-row-skeleton">
              <div className="ticket-col-ref"><span className="skeleton skeleton-badge" /></div>
              <div className="ticket-col-status"><span className="skeleton skeleton-badge" /></div>
              <div className="ticket-col-info">
                <span className="skeleton skeleton-title" />
                <span className="skeleton skeleton-meta" />
              </div>
              <div className="ticket-col-priority"><span className="skeleton skeleton-priority" /></div>
              <div className="ticket-col-files" />
              <div className="ticket-col-dates"><span className="skeleton skeleton-meta" /></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No tickets match your filters.</p>
        </div>
      ) : (
        <div className="ticket-table">
          {filtered.map((t) => {
            const isMyAssignment = t.status === "assigned" && t.assignee?.id === user?.id;
            const isMyReview = t.status === "review" && t.reviewer?.id === user?.id;
            const rowClass = [
              "ticket-row",
              isMyAssignment ? "ticket-row-my-assigned" : "",
              isMyReview ? "ticket-row-my-review" : "",
            ].filter(Boolean).join(" ");

            return (
            <div key={t.id} className={rowClass}>
              {/* Ref */}
              <div className="ticket-col-ref">
                <span className="ticket-ref">#{t.ref_number}</span>
              </div>

              {/* Status dropdown */}
              <div className="ticket-col-status">
                <select
                  className="status-select"
                  value={t.status}
                  style={{
                    background: STATUS_COLORS[t.status],
                    color: "#0e0f11",
                  }}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleStatusChange(t.id, e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title + meta — clickable to detail */}
              <div
                className="ticket-col-info"
                onClick={() => navigate(`/tickets/${t.id}`)}
              >
                <span className="ticket-title">
                  {t.title}
                  {t.client && (
                    <span className="ticket-client-tag">{t.client.name}</span>
                  )}
                </span>
                <span className="ticket-meta">
                  {t.assignee?.full_name || "Unassigned"}
                  {t.reviewer ? <> &middot; Review: {t.reviewer.full_name}</> : null}
                </span>
              </div>

              {/* Priority */}
              <div className="ticket-col-priority">
                <span className={`priority-tag priority-${t.priority}`}>
                  {PRIORITY_LABELS[t.priority]}
                </span>
              </div>

              {/* Files */}
              <div className="ticket-col-files">
                {t.files?.length > 0 && (
                  <span className="file-count">📎 {t.files.length}</span>
                )}
              </div>

              {/* Dates */}
              <div className="ticket-col-dates">
                <span className="ticket-date">Assigned: {formatDateTime(t.date_assigned)}</span>
                <span className="ticket-date">Updated: {formatDateTime(getLastStatusDate(t))}</span>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
