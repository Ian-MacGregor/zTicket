import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import TicketIcon from "./TicketIcon";

export default function Topbar() {
  const { signOut, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <header className="topbar">
      <div className="topbar-inner">
      <Link to="/" className="topbar-left topbar-home">
        <TicketIcon size={26} className="topbar-logo" />
        <h1>zTicket</h1>
      </Link>
      <div className="topbar-right">
        <span className="topbar-email">{user?.email}</span>
        <div className="menu-wrap" ref={menuRef}>
          <button className="btn btn-ghost" onClick={() => setMenuOpen(o => !o)}>
            Menu ▾
          </button>
          {menuOpen && (
            <div className="menu-dropdown">
              <Link to="/"         className="menu-item" onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <Link to="/activity" className="menu-item" onClick={() => setMenuOpen(false)}>Activity</Link>
              <Link to="/clients"  className="menu-item" onClick={() => setMenuOpen(false)}>Clients</Link>
              <Link to="/colors"   className="menu-item" onClick={() => setMenuOpen(false)}>
                {["C","o","l","o","r","s"].map((ch, i) => (
                  <span key={i} style={{ color: ["#ff4e4e","#ff9f2e","#ffe83d","#4ecb4e","#4ea8ff","#b24eff"][i] }}>{ch}</span>
                ))}
              </Link>
              <Link to="/settings" className="menu-item" onClick={() => setMenuOpen(false)}>Settings</Link>
              <button className="menu-item menu-item--danger" onClick={signOut}>Sign out</button>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
