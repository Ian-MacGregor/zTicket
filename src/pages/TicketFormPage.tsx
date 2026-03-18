import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

export default function TicketFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "assigned",
    assigned_to: "",
    reviewer: "",
    gmail_links: [""],
  });

  useEffect(() => {
    api.listUsers().then(setUsers).catch(console.error);

    if (isEdit && id) {
      setLoading(true);
      api
        .getTicket(id)
        .then((t) =>
          setForm({
            title: t.title,
            description: t.description || "",
            priority: t.priority,
            status: t.status,
            assigned_to: t.assignee?.id || "",
            reviewer: t.reviewer?.id || "",
            gmail_links: t.gmail_links?.length ? t.gmail_links : [""],
          })
        )
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setGmailLink = (index: number, value: string) => {
    const links = [...form.gmail_links];
    links[index] = value;
    setForm((prev) => ({ ...prev, gmail_links: links }));
  };

  const addGmailLink = () =>
    setForm((prev) => ({ ...prev, gmail_links: [...prev.gmail_links, ""] }));

  const removeGmailLink = (index: number) => {
    const links = form.gmail_links.filter((_, i) => i !== index);
    setForm((prev) => ({ ...prev, gmail_links: links.length ? links : [""] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      assigned_to: form.assigned_to || null,
      reviewer: form.reviewer || null,
      gmail_links: form.gmail_links.filter((l) => l.trim() !== ""),
    };

    try {
      if (isEdit && id) {
        await api.updateTicket(id, payload);
        navigate(`/tickets/${id}`);
      } else {
        const created = await api.createTicket(payload);
        navigate(`/tickets/${created.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-state">Loading…</div>;

  return (
    <div className="form-page">
      <header className="form-header">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>{isEdit ? "Edit Ticket" : "New Ticket"}</h1>
      </header>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="ticket-form">
        {/* Title */}
        <div className="form-group">
          <label htmlFor="title">Title *</label>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Brief ticket summary"
            required
          />
        </div>

        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            rows={5}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Detailed description of the task…"
          />
        </div>

        {/* Two-column row */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="priority">Priority</label>
            <select
              id="priority"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {isEdit && (
            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
              >
                <option value="assigned">Assigned</option>
                <option value="review">Review</option>
                <option value="complete">Complete</option>
                <option value="sent">Sent</option>
              </select>
            </div>
          )}
        </div>

        {/* Assigned / Reviewer */}
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="assigned_to">Assigned Developer</label>
            <select
              id="assigned_to"
              value={form.assigned_to}
              onChange={(e) => set("assigned_to", e.target.value)}
            >
              <option value="">— Select —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="reviewer">Reviewer</label>
            <select
              id="reviewer"
              value={form.reviewer}
              onChange={(e) => set("reviewer", e.target.value)}
            >
              <option value="">— Select —</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Gmail Links */}
        <div className="form-group">
          <label>Gmail Links</label>
          {form.gmail_links.map((link, i) => (
            <div key={i} className="gmail-link-row">
              <input
                type="url"
                value={link}
                onChange={(e) => setGmailLink(i, e.target.value)}
                placeholder="https://mail.google.com/mail/u/0/#inbox/..."
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => removeGmailLink(i)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={addGmailLink}
          >
            + Add link
          </button>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? "Saving…" : isEdit ? "Update Ticket" : "Create Ticket"}
          </button>
        </div>
      </form>
    </div>
  );
}
