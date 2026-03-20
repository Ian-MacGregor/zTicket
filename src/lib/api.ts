import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_URL as string; // e.g. https://your-app.railway.app

async function getToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.access_token;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || res.statusText);
  }

  // For blob responses (zip downloads)
  if (res.headers.get("Content-Type")?.includes("application/zip")) {
    return res.blob() as unknown as T;
  }

  return res.json();
}

export const api = {
  // Tickets
  listTickets: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== "") qs.set(k, String(v));
    });
    const q = qs.toString();
    return request<{ data: any[]; total: number }>(`/api/tickets${q ? "?" + q : ""}`);
  },
  getTicketStats: () =>
    request<{ total: number; unassigned: number; wait_hold: number; assigned: number; review: number; done: number }>(
      "/api/tickets/stats"
    ),
  getTicket: (id: string) => request<any>(`/api/tickets/${id}`),
  createTicket: (body: any) =>
    request<any>("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateTicket: (id: string, body: any) =>
    request<any>(`/api/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteTicket: (id: string) =>
    request<any>(`/api/tickets/${id}`, { method: "DELETE" }),

  // Files
  uploadFiles: async (ticketId: string, files: FileList) => {
    const token = await getToken();
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    const res = await fetch(`${API_BASE}/api/tickets/${ticketId}/files`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  downloadAllFiles: async (ticketId: string) => {
    const blob = await request<Blob>(
      `/api/tickets/${ticketId}/files/download-all`
    );
    // Trigger browser download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ticket-${ticketId}-files.zip`;
    a.click();
    URL.revokeObjectURL(url);
  },
  deleteFile: (ticketId: string, fileId: string) =>
    request<any>(`/api/tickets/${ticketId}/files/${fileId}`, {
      method: "DELETE",
    }),

  // Users
  listUsers: () => request<any[]>("/api/users"),
  getMe: () => request<any>("/api/users/me"),

  // Clients
  listClients: () => request<any[]>("/api/clients"),
  getClient: (id: string) => request<any>(`/api/clients/${id}`),
  createClient: (body: any) =>
    request<any>("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateClient: (id: string, body: any) =>
    request<any>(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteClient: (id: string) =>
    request<any>(`/api/clients/${id}`, { method: "DELETE" }),
  addContact: (clientId: string, body: any) =>
    request<any>(`/api/clients/${clientId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateContact: (clientId: string, contactId: string, body: any) =>
    request<any>(`/api/clients/${clientId}/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteContact: (clientId: string, contactId: string) =>
    request<any>(`/api/clients/${clientId}/contacts/${contactId}`, {
      method: "DELETE",
    }),

  // Comments
  listComments: (ticketId: string) =>
    request<any[]>(`/api/tickets/${ticketId}/comments`),
  createComment: (ticketId: string, body: string) =>
    request<any>(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }),
  updateComment: (ticketId: string, commentId: string, body: string) =>
    request<any>(`/api/tickets/${ticketId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }),

  // Activity
  listActivity: () => request<any[]>("/api/activity"),

  // Colors
  getColors: () => request<any>("/api/colors"),
  updateColors: (settings: any) =>
    request<any>("/api/colors", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings }),
    }),
};
