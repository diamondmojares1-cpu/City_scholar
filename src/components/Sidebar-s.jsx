import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import "../css/Sidebar-s.css";

// ── Icons ─────────────────────────────────────────────────
const Icon = {
  home:     <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/></svg>,
  announce: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 11v2H6v-2h12zm3-4H3v2h18V7zm-6 8H9v2h6v-2z"/></svg>,
  messages: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>,
  scholar:  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/></svg>,
  apps:     <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>,
};

export const NAV_ITEMS = [
  { key: "home",      label: "Home",                icon: Icon.home      },
  { key: "calendar",  label: "Calendar",            icon: Icon.calendar  },
  { key: "announce",  label: "Announcement",        icon: Icon.announce  },
  { key: "messages",  label: "Messages/ Inquiries", icon: Icon.messages  },
  { key: "scholar",   label: "Scholarship",         icon: Icon.scholar   },
  { key: "apps",      label: "Applicants",          icon: Icon.apps      },
];

export default function Sidebar({ active, setActive }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <aside className="sd-sidebar">
      {/* Logo */}
      <div className="sd-logo">
        <div className="sd-logo-icon">
          <svg viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.1)"/>
            <path d="M20 8L8 15l12 6 12-6-12-7zM8 17v6l12 6 12-6v-6l-12 6L8 17z" fill="#fff"/>
          </svg>
        </div>
        <span className="sd-logo-text">CITY SCHOLAR</span>
      </div>

      {/* Nav */}
      <nav className="sd-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            className={`sd-nav-item ${active === item.key ? "active" : ""}`}
            onClick={() => setActive(item.key)}
          >
            <span className="sd-nav-icon">{item.icon}</span>
            <span className="sd-nav-label">{item.label}</span>
            {active === item.key && <span className="sd-nav-indicator" />}
          </button>
        ))}
      </nav>

      {/* Logout */}
      <button className="sd-logout" onClick={handleLogout}>
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
        </svg>
        Log Out
      </button>
    </aside>
  );
}