/**
 * DashboardPage.tsx
 *
 * Main ticket list view. Displays a scrollable, server-side filtered and
 * paginated table of tickets alongside a global stats row, an activity ticker,
 * and filter / search controls.
 *
 * This component is kept permanently mounted by DashboardLayout (see App.tsx)
 * so that filter and pagination state survives navigating into and out of
 * individual ticket panels. When a ticket is selected the panel slot receives
 * the router outlet as `panelContent` and renders it as a side-panel overlay.
 *
 * Props:
 *   panelContent  — React node to render in the slide-in panel (ticket detail /
 *                   form). Null when no ticket route is active.
 *   onClosePanel  — Callback that navigates back to "/" to dismiss the panel.
 */

import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

// ── Display mappings ──────────────────────────────────────────────────────────
// These records map internal status/priority keys to CSS custom properties and
// human-readable labels used throughout the ticket table.

const STATUS_COLORS: Record<string, string> = {
  unassigned: "var(--status-unassigned)",
  wait_hold:  "var(--status-wait-hold)",
  assigned:   "var(--status-assigned)",
  review:     "var(--status-review)",
  done:       "var(--status-done)",
};

const STATUS_LABELS: Record<string, string> = {
  unassigned: "unassigned",
  wait_hold:  "wait/hold",
  assigned:   "assigned",
  review:     "review",
  done:       "done",
};

const STATUSES = ["unassigned", "wait_hold", "assigned", "review", "done"];

const PRIORITY_LABELS: Record<string, string> = {
  critical: "⬤ Critical",
  high:     "◉ High",
  medium:   "○ Medium",
  low:      "◌ Low",
};

// ── Utility functions ─────────────────────────────────────────────────────────

/** Formats an ISO date string as a locale date + time (HH:MM:SS). Returns "—" for null. */
function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** Returns a compact relative timestamp ("just now", "5m ago", "2h ago", "3d ago"). */
function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 60)  return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

/** Returns the most relevant "last activity" date for a ticket row's Dates column. */
function getLastStatusDate(ticket: any): string | null {
  return ticket.status_updated_at || ticket.created_at;
}

export default function DashboardPage({
  panelContent,
  onClosePanel,
}: {
  panelContent?: React.ReactNode;
  onClosePanel?: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // compact = true when a ticket panel is open; drives the split-layout CSS class
  const compact = !!panelContent;
  // Highlight the currently selected ticket row in the sidebar
  const selectedId = location.pathname.match(/^\/tickets\/([^/]+?)(?:\/edit)?$/)?.[1] ?? null;
  // New-ticket form has no matching row — panel floats to top on mobile
  const isNewTicket = location.pathname.startsWith("/tickets/new");

  // ── Ticket data ──────────────────────────────────────────
  const [tickets, setTickets]   = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [stats, setStats]       = useState({ total: 0, unassigned: 0, wait_hold: 0, assigned: 0, review: 0, done: 0 });
  const [activity, setActivity] = useState<any[]>([]);
  const [clients, setClients]   = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  // ── Pagination ───────────────────────────────────────────
  const [page, setPage]   = useState(1);
  const [limit, setLimit] = useState(10);

  // ── Filters & sort ───────────────────────────────────────
  const [filterStatus,   setFilterStatus]   = useState("active");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterClient,   setFilterClient]   = useState("all");
  const [filterView,     setFilterView]     = useState("all");
  const [search,         setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchType,     setSearchType]     = useState("description");
  const [sortBy,         setSortBy]         = useState("ref-desc");

  // ── Modals ───────────────────────────────────────────────
  // assignModal holds the ticketId + pending status while the user picks an assignee.
  // waitHoldModal holds the ticketId while the user types a hold reason.
  const [assignModal,     setAssignModal]     = useState<{ ticketId: string; pendingStatus: string } | null>(null);
  const [assignModalUser, setAssignModalUser] = useState("");
  const [waitHoldModal,   setWaitHoldModal]   = useState<{ ticketId: string } | null>(null);
  const [waitHoldReason,  setWaitHoldReason]  = useState("");

  // ── Activity ticker ──────────────────────────────────────
  // Used to measure whether the ticker content overflows its container so the
  // CSS marquee animation can be conditionally enabled.
  const activityItemsWrapRef = useRef<HTMLDivElement>(null);
  const activityItemsRef = useRef<HTMLDivElement>(null);
  const [activityOverflows, setActivityOverflows] = useState(false);
  const [activityScrollDist, setActivityScrollDist] = useState(0);

  // ── Lock body scroll on mobile when the panel overlay is open ─
  // Prevents the page behind the overlay from scrolling when a ticket is open.
  useEffect(() => {
    if (!compact) return;
    document.body.classList.add("panel-open");
    document.documentElement.classList.add("panel-open");
    return () => {
      document.body.classList.remove("panel-open");
      document.documentElement.classList.remove("panel-open");
    };
  }, [compact]);

  // ── Header height sync ───────────────────────────────────
  // Keeps the panel-pane-header the same pixel height as ticket-table-header
  // so they appear visually aligned in the split layout. Uses ResizeObserver
  // so the sync holds when the browser is resized or the filters wrap.
  const tableHeaderRef = useRef<HTMLDivElement>(null);
  const panelHeaderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!compact) {
      if (panelHeaderRef.current) panelHeaderRef.current.style.height = "";
      return;
    }
    const sync = () => {
      if (tableHeaderRef.current && panelHeaderRef.current) {
        panelHeaderRef.current.style.height = `${tableHeaderRef.current.offsetHeight}px`;
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    if (tableHeaderRef.current) ro.observe(tableHeaderRef.current);
    return () => ro.disconnect();
  }, [compact]);

  // ── Refresh key ──────────────────────────────────────────
  // Incrementing fetchKey re-runs the main ticket fetch without requiring any
  // filter state to change. Used by the 30-second polling interval and by
  // inline status changes so the list updates immediately after edits.
  const [fetchKey, setFetchKey] = useState(0);
  // When true, the next fetch triggered by fetchKey is a silent background
  // refresh — skip the skeleton loader so the UI doesn't flash.
  const isBackgroundRef = useRef(false);

  // ── Search debounce (400 ms) ─────────────────────────────
  // Delays the API call until the user has stopped typing, and resets to
  // page 1 so results always start from the beginning of the new query.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── Main ticket fetch ────────────────────────────────────
  // Fires whenever any filter, sort, pagination, or fetchKey value changes.
  // The "active" status shorthand is expanded to "assigned,review" for the API.
  // Background refreshes skip the loading skeleton to avoid UI flicker.
  useEffect(() => {
    const background = isBackgroundRef.current;
    isBackgroundRef.current = false;
    if (!background) setLoading(true);
    api
      .listTickets({
        page, limit, sort: sortBy,
        status: filterStatus === "active" ? "assigned,review" : filterStatus,
        priority: filterPriority, client: filterClient,
        view: filterView, search: debouncedSearch, searchType,
        userId: user?.id || "",
      })
      .then((result) => {
        setTickets(result.data);
        setTotal(result.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, limit, sortBy, filterStatus, filterPriority, filterClient, filterView, debouncedSearch, searchType, fetchKey]);

  // ── One-time setup ───────────────────────────────────────
  // Loads supporting data (stats, activity feed, client list, user list) on
  // mount and sets up a 30-second polling interval for the live activity strip
  // and stats row. The interval is cleared on unmount.
  useEffect(() => {
    api.getTicketStats().then(setStats).catch(console.error);
    api.listActivity().then(setActivity).catch(console.error);
    api.listClients().then(setClients).catch(console.error);
    api.listUsers().then(setUsers).catch(console.error);

    const interval = setInterval(() => {
      isBackgroundRef.current = true;
      setFetchKey((k) => k + 1);
      api.getTicketStats().then(setStats).catch(console.error);
      api.listActivity().then(setActivity).catch(console.error);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Activity overflow detection ──────────────────────────
  // Measures whether the activity ticker items are wider than their container.
  // When they overflow, the CSS animation scrolls them horizontally.
  useEffect(() => {
    const check = () => {
      const wrap = activityItemsWrapRef.current;
      const items = activityItemsRef.current;
      if (!wrap || !items) return;
      const overflow = items.scrollWidth - wrap.clientWidth;
      setActivityOverflows(overflow > 0);
      setActivityScrollDist(Math.max(0, overflow));
    };
    check();
    const ro = new ResizeObserver(check);
    if (activityItemsWrapRef.current) ro.observe(activityItemsWrapRef.current);
    return () => ro.disconnect();
  }, [activity]);

  // ── Filter helpers ───────────────────────────────────────
  // Each setter also resets the page to 1 so the user always sees results
  // from the start when a filter changes. Search reset is handled separately
  // in the debounce effect above.
  const setStatusFilter = (v: string) => { setFilterStatus(v);   setPage(1); };
  const setPriorityFilter = (v: string) => { setFilterPriority(v); setPage(1); };
  const setClientFilter = (v: string) => { setFilterClient(v);   setPage(1); };
  const setViewFilter = (v: string) => { setFilterView(v);     setPage(1); };

  /** Resets all filters and sort back to their default values. */
  const resetFilters = () => {
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterClient("all");
    setSearch("");
    setSearchType("description");
    setSortBy("ref-desc");
    setFilterView("all");
    setPage(1);
  };

  // ── Sort helpers ─────────────────────────────────────────
  // Clicking the same column header toggles direction; clicking a new column
  // applies that column's default direction.
  const [sortCol, sortDir] = sortBy.split("-") as [string, "asc" | "desc"];
  const handleColSort = (col: string, defaultDir: "asc" | "desc" = "desc") => {
    setSortBy(sortCol === col ? `${col}-${sortDir === "asc" ? "desc" : "asc"}` : `${col}-${defaultDir}`);
    setPage(1);
  };
  const sortArrow = (col: string) =>
    sortCol === col ? (sortDir === "asc" ? " ↑" : " ↓") : null;

  // ── Inline status change ─────────────────────────────────
  // Called by the status <select> in each ticket row. Sends the update to the
  // API then silently refreshes the list and stats so the UI stays in sync.
  // The "assigned" transition from "unassigned" opens the assign modal first;
  // "wait_hold" opens the hold-reason modal first.
  const handleStatusChange = async (ticketId: string, newStatus: string, extra: Record<string, unknown> = {}) => {
    try {
      const body: Record<string, unknown> = { status: newStatus, ...extra };
      if (newStatus === "unassigned") body.assigned_to = null;
      if (newStatus !== "wait_hold")  body.wait_hold_reason = null;
      await api.updateTicket(ticketId, body);
      // Refetch current page and global stats (silently — no skeleton flash)
      isBackgroundRef.current = true;
      setFetchKey((k) => k + 1);
      api.getTicketStats().then(setStats).catch(console.error);
      api.listActivity().then(setActivity).catch(console.error);
    } catch (err) {
      console.error(err);
    }
  };

  // ── Pagination helpers ────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const rangeStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rangeEnd   = Math.min(page * limit, total);

  // Ticket table + pagination — used in both full and sidebar modes
  const ticketSection = (
    <>
      <div className={compact ? "ticket-table ticket-table-compact" : "ticket-table"}>
        <div className="ticket-table-header ticket-row" ref={tableHeaderRef}>
          <div className="ticket-col-ref sort-col" onClick={() => handleColSort("ref", "desc")}>
            #{sortArrow("ref")}
          </div>
          <div className="ticket-col-status sort-col" onClick={() => handleColSort("status", "asc")}>
            Status{sortArrow("status")}
          </div>
          <div className="ticket-col-info sort-col" onClick={() => handleColSort("title", "asc")}>
            Subject{sortArrow("title")}
          </div>
          <div className="ticket-col-client sort-col" onClick={() => handleColSort("client", "asc")}>
            Client{sortArrow("client")}
          </div>
          <div className="ticket-col-priority sort-col" onClick={() => handleColSort("priority", "desc")}>
            Priority{sortArrow("priority")}
          </div>
          <div className="ticket-col-owner sort-col" onClick={() => handleColSort("owner", "asc")}>
            Owner{sortArrow("owner")}
          </div>
          <div className="ticket-col-files" />
          <div className="ticket-col-dates sort-col" onClick={() => handleColSort("updated", "desc")}>
            Dates{sortArrow("updated")}
          </div>
          <div className="ticket-col-arrow" />
        </div>

        {loading ? (
          <>
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
              <div className="ticket-col-arrow" />
            </div>
          ))}
          </>
        ) : tickets.length === 0 ? null : (
          <>
          {tickets.map((t) => {
            const isMyAssignment = t.status === "assigned" && t.assignee?.id === user?.id;
            const isMyReview     = t.status === "review"   && t.reviewer?.id === user?.id;
            const isSelected     = selectedId === t.id;
            const rowClass = [
              "ticket-row",
              isMyAssignment ? "ticket-row-my-assigned" : "",
              isMyReview     ? "ticket-row-my-review"   : "",
              !compact && isSelected ? "ticket-row-selected" : "",
            ].filter(Boolean).join(" ");

            return (
              <div
                key={t.id}
                className={rowClass}
                onClick={compact ? () => isSelected ? onClosePanel?.() : navigate(`/tickets/${t.id}`) : undefined}
              >
                <div className="ticket-col-ref">
                  <span className="ticket-ref">#{t.ref_number}</span>
                </div>
                <div className="ticket-col-status">
                  <select
                    className="status-select"
                    value={t.status}
                    style={{ background: STATUS_COLORS[t.status], color: "#0e0f11" }}
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
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="ticket-col-info" onClick={() => navigate(`/tickets/${t.id}`)}>
                  <span className="ticket-title">{t.title}</span>
                  <span className="ticket-meta">
                    {compact ? (
                      <span className="ticket-compact-meta">
                        <span
                          className="ticket-status-dot"
                          style={{ background: STATUS_COLORS[t.status] }}
                        />
                        <span className="ticket-status-label">{STATUS_LABELS[t.status]}</span>
                        {t.client?.name && (
                          <><span className="ticket-compact-sep">·</span><span className="ticket-client-tag">{t.client.name}</span></>
                        )}
                      </span>
                    ) : (
                      t.status === "wait_hold" && t.wait_hold_reason
                        ? <span className="ticket-hold-reason">⏸ {t.wait_hold_reason}</span>
                        : <>&nbsp;</>
                    )}
                  </span>
                </div>
                <div className="ticket-col-client">
                  <span className="ticket-col-text">{t.client?.name || "—"}</span>
                </div>
                <div className="ticket-col-priority">
                  <span className={`priority-tag priority-${t.priority}`}>
                    {PRIORITY_LABELS[t.priority]}
                  </span>
                </div>
                <div className="ticket-col-owner">
                  <span className="ticket-col-text">
                    {t.status === "review"
                      ? (t.reviewer?.full_name  || "None")
                      : (t.assignee?.full_name  || "None")}
                  </span>
                </div>
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
                <div className="ticket-col-dates">
                  <span className="ticket-date">Created: {formatDateTime(t.created_at)}</span>
                  <span className="ticket-date">Updated: {formatDateTime(getLastStatusDate(t))}</span>
                </div>
                <div className="ticket-col-arrow">
                  {isSelected ? "›" : null}
                </div>
              </div>
            );
          })}
          </>
        )}
      </div>

      {!loading && tickets.length === 0 && (
        <div className="empty-state">
          <p>No tickets match your filters.</p>
        </div>
      )}

      <div className="pagination-row">
        <button
          className="btn btn-ghost btn-sm"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          ← Prev
        </button>
        <div className="pagination-center">
          <span className="pagination-info">Page {page} of {totalPages}</span>
          <select
            className="filter-select"
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          >
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          <span className="sort-count">
            {total === 0 ? "0 tickets" : `${rangeStart}–${rangeEnd} of ${total} ticket${total !== 1 ? "s" : ""}`}
          </span>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next →
        </button>
      </div>
    </>
  );

  return (
    <div className="dashboard">
      {/* ── Activity Strip ──────────────────────────── */}
      {activity.length > 0 && (
        <div
          className="activity-strip"
          data-overflow={activityOverflows ? "true" : undefined}
        >
          <span className="activity-label">Recent</span>
          <div className="activity-items-wrap" ref={activityItemsWrapRef}>
            <div
              className="activity-items"
              ref={activityItemsRef}
              style={{
                "--scroll-dist": `-${activityScrollDist}px`,
                "--ticker-dur": `${Math.max(3, activityScrollDist / 80)}s`,
              } as CSSProperties}
            >
              {activity.map((a, i) => (
                <span key={a.id} className="activity-item">
                  {i > 0 && <span className="activity-sep">·</span>}
                  <span
                    className="activity-ref"
                    style={{
                      color: a.ticket?.status === "review" && a.ticket?.reviewer === user?.id
                        ? "var(--status-review)"
                        : a.ticket?.status === "assigned" && a.ticket?.assigned_to === user?.id
                          ? "var(--status-assigned)"
                          : undefined,
                    }}
                  >#{a.ticket?.ref_number}</span>
                  {" "}{a.actor?.full_name || a.actor?.email || "Someone"} {a.action}
                  <span className="activity-time">{timeAgo(a.created_at)}</span>
                </span>
              ))}
            </div>
            {activityOverflows && <span className="activity-ellipsis">…</span>}
          </div>
        </div>
      )}

      {/* ── Stats Row (global counts — unaffected by filters) ─ */}
      <div className="stats-row">
        {(() => {
          const activeCount = stats.assigned + stats.review;
          const cards = [
            { key: "active",     label: "Active",     val: activeCount,      color: null },
            { key: "unassigned", label: "Unassigned", val: stats.unassigned, color: STATUS_COLORS["unassigned"] },
            { key: "assigned",   label: "Assigned",   val: stats.assigned,   color: STATUS_COLORS["assigned"] },
            { key: "review",     label: "Review",     val: stats.review,     color: STATUS_COLORS["review"] },
            { key: "wait_hold",  label: "Wait/Hold",  val: stats.wait_hold,  color: STATUS_COLORS["wait_hold"] },
            { key: "done",       label: "Done",       val: stats.done,       color: STATUS_COLORS["done"] },
            { key: "total",      label: "Total",      val: stats.total,      color: null },
          ];
          return cards.map(({ key, label, val, color }) =>
            loading && tickets.length === 0 ? (
              <div key={key} className="stat-card">
                <span className="skeleton skeleton-value" />
                <span className="stat-label">{label}</span>
                {color && <span className="stat-dot" style={{ background: color }} />}
              </div>
            ) : (
              <div
                key={key}
                className={`stat-card clickable${filterStatus === key ? " stat-card-active" : ""}`}
                onClick={() => {
                  if (key === "total") resetFilters();
                  else setStatusFilter(filterStatus === key ? "active" : key);
                }}
              >
                <span className="stat-value">{val}</span>
                <span className="stat-label">{label}</span>
                {color && <span className="stat-dot" style={{ background: color }} />}
              </div>
            )
          );
        })()}
      </div>

      {/* ── Action Bar ──────────────────────────────── */}
      <div className="action-bar">
        <div className="action-bar-left">
          <button
            className={`btn ${filterView === "my-tickets" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setViewFilter(filterView === "my-tickets" ? "all" : "my-tickets")}
            disabled={loading}
          >
            My Tickets
          </button>
          <button
            className={`btn ${filterView === "my-reviews" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setViewFilter(filterView === "my-reviews" ? "all" : "my-reviews")}
            disabled={loading}
          >
            My Reviews
          </button>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/tickets/new")}>+ New Ticket</button>
      </div>

      {/* ── Filter Bar ──────────────────────────────── */}
      <div className="toolbar">
        <div className="search-group">
          <select
            className="search-type-select"
            value={searchType}
            onChange={(e) => { setSearchType(e.target.value); setSearch(""); }}
            disabled={loading}
          >
            <option value="description">Description</option>
            <option value="ref">Ticket #</option>
            <option value="client">Client</option>
            <option value="assignee">Assignee</option>
            <option value="reviewer">Reviewer</option>
            <option value="created">Date Created</option>
            <option value="updated">Date Updated</option>
          </select>
          <input
            className="search-input"
            type={searchType === "ref" ? "number" : "text"}
            placeholder={
              searchType === "ref"      ? "Ticket #…"        :
              searchType === "client"   ? "Client name…"     :
              searchType === "assignee" ? "Assignee name…"   :
              searchType === "reviewer" ? "Reviewer name…"   :
              searchType === "created"  ? "e.g. 3/20/2026…" :
              searchType === "updated"  ? "e.g. 3/20/2026…" :
              "Search description…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading}
          />
        </div>
        <select
          value={filterPriority}
          onChange={(e) => setPriorityFilter(e.target.value)}
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
          value={filterClient}
          onChange={(e) => setClientFilter(e.target.value)}
          className="filter-select"
          disabled={loading}
        >
          <option value="all">All clients</option>
          {clients.map((cl) => (
            <option key={cl.id} value={cl.id}>{cl.name}</option>
          ))}
        </select>
      </div>

      {/* ── Ticket Area ──────────────────────────────── */}
      <div className={`ticket-area-wrap${compact ? " is-compact" : ""}`}>
        <div className="ticket-area-sidebar">
          {ticketSection}
        </div>
        {compact && panelContent && (
          <>
            <div className="panel-mobile-backdrop" onClick={onClosePanel} />
            <div className={`ticket-split-panel${isNewTicket ? " ticket-split-panel--top" : ""}`}>
              <div className="panel-pane-header" ref={panelHeaderRef}>
                <button className="panel-close-btn" onClick={onClosePanel}>✕ Close</button>
              </div>
              {panelContent}
            </div>
          </>
        )}
      </div>

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
              <button className="btn btn-ghost" onClick={() => setWaitHoldModal(null)}>Cancel</button>
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
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setAssignModal(null)}>Cancel</button>
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
