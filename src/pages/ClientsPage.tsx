import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Contact {
  id?: string;
  name: string;
  email: string;
  phone: string;
  phone2: string;
  role: string;
  distribute_code: boolean;
}

interface Client {
  id: string;
  name: string;
  contacts: Contact[];
}

export default function ClientsPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<string | null>(null);

  // New client form
  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);

  // Edit client name
  const [editClientName, setEditClientName] = useState("");

  // New contact form (per client)
  const [addingContactTo, setAddingContactTo] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<Contact>({
    name: "",
    email: "",
    phone: "",
    phone2: "",
    role: "",
    distribute_code: false,
  });

  // Edit contact form
  const [editContactForm, setEditContactForm] = useState<Contact>({
    name: "",
    email: "",
    phone: "",
    phone2: "",
    role: "",
    distribute_code: false,
  });

  const load = () => {
    setLoading(true);
    api
      .listClients()
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setCreatingClient(true);
    try {
      await api.createClient({ name: newClientName.trim() });
      setNewClientName("");
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingClient(false);
    }
  };

  const handleUpdateClient = async (id: string) => {
    if (!editClientName.trim()) return;
    try {
      await api.updateClient(id, { name: editClientName.trim() });
      setEditingClient(null);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("Delete this client and all its contacts?")) return;
    await api.deleteClient(id);
    load();
  };

  const handleAddContact = async (clientId: string) => {
    if (!contactForm.name.trim()) return;
    try {
      await api.addContact(clientId, contactForm);
      setAddingContactTo(null);
      setContactForm({ name: "", email: "", phone: "", phone2: "", role: "", distribute_code: false });
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateContact = async (clientId: string, contactId: string) => {
    try {
      await api.updateContact(clientId, contactId, editContactForm);
      setEditingContact(null);
      load();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteContact = async (clientId: string, contactId: string) => {
    if (!confirm("Delete this contact?")) return;
    await api.deleteContact(clientId, contactId);
    load();
  };

  return (
    <div className="clients-page">
      <header className="form-header">
        <button className="btn btn-ghost" onClick={() => navigate("/")}>
          ← Dashboard
        </button>
        <h1>Clients</h1>
      </header>

      {/* ── New Client Form ─────────────────────────── */}
      <form onSubmit={handleCreateClient} className="new-client-form">
        <input
          type="text"
          placeholder="New client name…"
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
          className="search-input"
          required
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={creatingClient}
        >
          {creatingClient ? "Adding…" : "+ Add Client"}
        </button>
      </form>

      {/* ── Client List ─────────────────────────────── */}
      {loading ? (
        <div className="loading-state">Loading clients…</div>
      ) : clients.length === 0 ? (
        <div className="empty-state">
          <p>No clients yet. Add one above.</p>
        </div>
      ) : (
        <div className="client-list">
          {clients.map((client) => (
            <div key={client.id} className="client-card">
              {/* Client Header */}
              <div className="client-header">
                {editingClient === client.id ? (
                  <div className="client-edit-row">
                    <input
                      type="text"
                      value={editClientName}
                      onChange={(e) => setEditClientName(e.target.value)}
                      className="search-input"
                      autoFocus
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleUpdateClient(client.id)}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditingClient(null)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="client-name">{client.name}</h2>
                    <div className="client-actions">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setEditingClient(client.id);
                          setEditClientName(client.name);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteClient(client.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Contacts */}
              <div className="contacts-section">
                <div className="contacts-header">
                  <span className="contacts-label">
                    Contacts ({client.contacts?.length || 0})
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() =>
                      setAddingContactTo(
                        addingContactTo === client.id ? null : client.id
                      )
                    }
                  >
                    {addingContactTo === client.id ? "Cancel" : "+ Add Contact"}
                  </button>
                </div>

                {/* Add Contact Form */}
                {addingContactTo === client.id && (
                  <div className="contact-form">
                    <div className="contact-form-grid">
                      <input
                        type="text"
                        placeholder="Name *"
                        value={contactForm.name}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, name: e.target.value })
                        }
                        required
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={contactForm.email}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, email: e.target.value })
                        }
                      />
                      <input
                        type="text"
                        placeholder="Phone"
                        value={contactForm.phone}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, phone: e.target.value })
                        }
                      />
                      <input
                        type="text"
                        placeholder="Phone 2"
                        value={contactForm.phone2}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, phone2: e.target.value })
                        }
                      />
                      <input
                        type="text"
                        placeholder="Role / Title"
                        value={contactForm.role}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, role: e.target.value })
                        }
                      />
                    </div>
                    <label className="contact-distribute-label">
                      <input
                        type="checkbox"
                        checked={contactForm.distribute_code}
                        onChange={(e) =>
                          setContactForm({ ...contactForm, distribute_code: e.target.checked })
                        }
                      />
                      Distribute Code to This Contact?
                    </label>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAddContact(client.id)}
                    >
                      Save Contact
                    </button>
                  </div>
                )}

                {/* Contact List */}
                {client.contacts?.length > 0 && (
                  <div className="contact-list">
                    {client.contacts.map((contact: any) => (
                      <div key={contact.id} className="contact-row">
                        {editingContact === contact.id ? (
                          <div className="contact-form">
                            <div className="contact-form-grid">
                              <input
                                type="text"
                                placeholder="Name *"
                                value={editContactForm.name}
                                onChange={(e) =>
                                  setEditContactForm({
                                    ...editContactForm,
                                    name: e.target.value,
                                  })
                                }
                              />
                              <input
                                type="email"
                                placeholder="Email"
                                value={editContactForm.email}
                                onChange={(e) =>
                                  setEditContactForm({
                                    ...editContactForm,
                                    email: e.target.value,
                                  })
                                }
                              />
                              <input
                                type="text"
                                placeholder="Phone"
                                value={editContactForm.phone}
                                onChange={(e) =>
                                  setEditContactForm({
                                    ...editContactForm,
                                    phone: e.target.value,
                                  })
                                }
                              />
                              <input
                                type="text"
                                placeholder="Phone 2"
                                value={editContactForm.phone2}
                                onChange={(e) =>
                                  setEditContactForm({
                                    ...editContactForm,
                                    phone2: e.target.value,
                                  })
                                }
                              />
                              <input
                                type="text"
                                placeholder="Role / Title"
                                value={editContactForm.role}
                                onChange={(e) =>
                                  setEditContactForm({
                                    ...editContactForm,
                                    role: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <label className="contact-distribute-label">
                              <input
                                type="checkbox"
                                checked={editContactForm.distribute_code}
                                onChange={(e) =>
                                  setEditContactForm({
                                    ...editContactForm,
                                    distribute_code: e.target.checked,
                                  })
                                }
                              />
                              Distribute Code to This Contact?
                            </label>
                            <div className="contact-form-actions">
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() =>
                                  handleUpdateContact(client.id, contact.id)
                                }
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setEditingContact(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="contact-info">
                              <span className="contact-name">
                                {contact.name}
                              </span>
                              <span className="contact-meta">
                                {[contact.role, contact.email, contact.phone, contact.phone2]
                                  .filter(Boolean)
                                  .join(" · ")}
                                {contact.distribute_code && (
                                  <span className="contact-distribute-badge">Distribute Code</span>
                                )}
                              </span>
                            </div>
                            <div className="contact-actions">
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => {
                                  setEditingContact(contact.id);
                                  setEditContactForm({
                                    name: contact.name,
                                    email: contact.email || "",
                                    phone: contact.phone || "",
                                    phone2: contact.phone2 || "",
                                    role: contact.role || "",
                                    distribute_code: contact.distribute_code ?? false,
                                  });
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() =>
                                  handleDeleteContact(client.id, contact.id)
                                }
                              >
                                ✕
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
