import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const STATUS_COLORS: Record<string, string> = {
  unassigned: "var(--status-unassigned)",
  wait_hold: "var(--status-wait-hold)",
  assigned: "var(--status-assigned)",
  review: "var(--status-review)",
  done: "var(--status-done)",
};

const STATUS_LABELS: Record<string, string> = {
  unassigned: "unassigned",
  wait_hold: "wait/hold",
  assigned: "assigned",
  review: "review",
  done: "done",
};

const STATUSES = ["unassigned", "wait_hold", "assigned", "review", "done"];

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
  return ticket.status_updated_at || ticket.created_at;
}

export default function DashboardPage() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("ref-desc");
  const [filterView, setFilterView] = useState("all");
  const [assignModal, setAssignModal] = useState<{ ticketId: string; pendingStatus: string } | null>(null);
  const [assignModalUser, setAssignModalUser] = useState("");
  const [waitHoldModal, setWaitHoldModal] = useState<{ ticketId: string } | null>(null);
  const [waitHoldReason, setWaitHoldReason] = useState("");

  useEffect(() => {
    api
      .listTickets()
      .then(setTickets)
      .catch(console.error)
      .finally(() => setLoading(false));

    api.listUsers().then(setUsers).catch(console.error);

    const interval = setInterval(() => {
      api.listTickets().then(setTickets).catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
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
    unassigned: 0, wait_hold: 1, assigned: 2, review: 3, done: 4,
  };

  const filtered = tickets
    .filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterClient !== "all" && t.client?.id !== filterClient) return false;
      if (filterView === "my-tickets") {
        if (t.assignee?.id !== user?.id) return false;
        if (!["wait_hold", "assigned", "review"].includes(t.status)) return false;
      }
      if (filterView === "my-reviews") {
        if (t.reviewer?.id !== user?.id) return false;
        if (!["review"].includes(t.status)) return false;
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
    unassigned: tickets.filter((t) => t.status === "unassigned").length,
    wait_hold: tickets.filter((t) => t.status === "wait_hold").length,
    assigned: tickets.filter((t) => t.status === "assigned").length,
    review: tickets.filter((t) => t.status === "review").length,
    done: tickets.filter((t) => t.status === "done").length,
  };

  const handleStatusChange = async (ticketId: string, newStatus: string, extra: Record<string, unknown> = {}) => {
    try {
      const body: Record<string, unknown> = { status: newStatus, ...extra };
      if (newStatus === "unassigned") body.assigned_to = null;
      if (newStatus !== "wait_hold") body.wait_hold_reason = null;
      const updated = await api.updateTicket(ticketId, body);
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
          ? ["total", "unassigned", "wait_hold", "assigned", "review", "done"].map((key) => (
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
          <option value="unassigned">Unassigned</option>
          <option value="wait_hold">Wait/Hold</option>
          <option value="assigned">Assigned</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
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
            <option value="status-asc">Status (unassigned → done)</option>
            <option value="status-desc">Status (done → unassigned)</option>
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
              <div className="ticket-col-client"><span className="skeleton skeleton-meta" /></div>
              <div className="ticket-col-priority"><span className="skeleton skeleton-priority" /></div>
              <div className="ticket-col-owner"><span className="skeleton skeleton-meta" /></div>
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
                    const newStatus = e.target.value;
                    if (t.status === "unassigned" && newStatus === "assigned") {
                      setAssignModalUser("");
                      setAssignModal({ ticketId: t.id, pendingStatus: newStatus });
                    } else if (newStatus === "wait_hold") {
                      setWaitHoldReason("");
                      setWaitHoldModal({ ticketId: t.id });
                    } else {
                      handleStatusChange(t.id, newStatus);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title + meta — clickable to detail */}
              <div
                className="ticket-col-info"
                onClick={() => navigate(`/tickets/${t.id}`)}
              >
                <span className="ticket-title">{t.title}</span>
                <span className="ticket-meta">
                  {t.status === "wait_hold" && t.wait_hold_reason
                    ? <span className="ticket-hold-reason">⏸ {t.wait_hold_reason}</span>
                    : <>&nbsp;</>}
                </span>
              </div>

              {/* Client */}
              <div className="ticket-col-client">
                <span className="ticket-col-text">{t.client?.name || "—"}</span>
              </div>

              {/* Priority */}
              <div className="ticket-col-priority">
                <span className={`priority-tag priority-${t.priority}`}>
                  {PRIORITY_LABELS[t.priority]}
                </span>
              </div>

              {/* Owner */}
              <div className="ticket-col-owner">
                <span className="ticket-col-text">
                  {t.status === "review"
                    ? (t.reviewer?.full_name || "None")
                    : (t.assignee?.full_name || "None")}
                </span>
              </div>

              {/* Files */}
              <div className="ticket-col-files">
                {t.files?.length > 0 && (
                  <span className="file-count">
                    <svg className="icon-clip" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12.5 7.5l-5.5 5.5a3 3 0 01-4.24-4.24l6.36-6.36a2 2 0 012.83 2.83L5.58 11.6a1 1 0 01-1.41-1.41L10 4.35" />
                    </svg>
                    {t.files.length}
                  </span>
                )}
              </div>

              {/* Dates */}
              <div className="ticket-col-dates">
                <span className="ticket-date">Created: {formatDateTime(t.created_at)}</span>
                <span className="ticket-date">Updated: {formatDateTime(getLastStatusDate(t))}</span>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ── Wait / Hold Modal ───────────────────────── */}
      {waitHoldModal && (
        <div className="modal-overlay" onClick={() => setWaitHoldModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Wait / Hold Reason</h2>
            <p className="modal-body">Enter a reason for placing this ticket on hold.</p>
            <textarea
              className="modal-textarea"
              value={waitHoldReason}
              onChange={(e) => setWaitHoldReason(e.target.value)}
              placeholder="Describe why this ticket is on hold…"
              rows={4}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setWaitHoldModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!waitHoldReason.trim()}
                onClick={async () => {
                  await handleStatusChange(waitHoldModal.ticketId, "wait_hold", { wait_hold_reason: waitHoldReason });
                  setWaitHoldModal(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign User Modal ────────────────────────── */}
      {assignModal && (
        <div className="modal-overlay" onClick={() => setAssignModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Assign a user</h2>
            <p className="modal-body">Select a user to assign to this ticket.</p>
            <select
              className="filter-select modal-select"
              value={assignModalUser}
              onChange={(e) => setAssignModalUser(e.target.value)}
            >
              <option value="">— Select user —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setAssignModal(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                disabled={!assignModalUser}
                onClick={async () => {
                  await handleStatusChange(assignModal.ticketId, assignModal.pendingStatus, { assigned_to: assignModalUser });
                  setAssignModal(null);
                }}
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
