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
  listTickets: () => request<any[]>("/api/tickets"),
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
};
