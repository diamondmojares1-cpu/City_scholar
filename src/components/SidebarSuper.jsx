import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaThLarge, FaUserGraduate, FaMapMarkerAlt, FaCalendarAlt,
  FaBullhorn, FaCommentDots, FaArchive, FaSignOutAlt,
  FaUserPlus, FaRedo,
} from "react-icons/fa";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import cityScholarLogo from "../assets/cityscholar.png";
import "../css/Sidebar.css";

function LogoutModal({ onConfirm, onCancel }) {
  return (
    <div className="sb-overlay" onClick={onCancel}>
      <div className="sb-modal" onClick={e => e.stopPropagation()}>
        <div className="sb-modal-icon-wrap">
          <FaSignOutAlt className="sb-modal-icon" />
        </div>
        <h3 className="sb-modal-title">Log Out</h3>
        <p className="sb-modal-msg">Are you sure you want to log out of your account?</p>
        <div className="sb-modal-btns">
          <button className="sb-btn-cancel" onClick={onCancel}>No, Stay</button>
          <button className="sb-btn-confirm" onClick={onConfirm}>Yes, Log Out</button>
        </div>
      </div>
    </div>
  );
}

function SidebarSuper({ activePage }) {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) setRole(snap.data().role || "admin");
      } catch (err) {
        console.error("SidebarSuper role fetch error:", err);
      }
    });
    return () => unsub();
  }, []);

  // ── Menu items ordered highest to lowest importance ──────
  const menuItems = [
    { key: "dashboard",          label: "Dashboard",         icon: FaThLarge,      to: "/superadmin-dashboard"     },
    { key: "scholars",           label: "Scholars",          icon: FaUserGraduate, to: "/scholars-super"           },
    { key: "announcements",      label: "Announcements",     icon: FaBullhorn,     to: "/announcements-super"      },
    { key: "calendar",           label: "Calendar",          icon: FaCalendarAlt,  to: "/calendar-super"           },
    { key: "barangay",           label: "Barangay Overview", icon: FaMapMarkerAlt, to: "/barangay-overview-super"  },
    { key: "messages-inquiries", label: "Messages",          icon: FaCommentDots,  to: "/messages-inquiries-super" },
    { key: "archives",           label: "Archives",          icon: FaArchive,      to: "/archives-super"           },
  ];

  return (
    <>
      <aside className="sb-sidebar">

        {/* ── Logo ── */}
        <div className="sb-logo">
          <img src={cityScholarLogo} alt="City Scholar" className="sb-logo-icon-img" />
          <span className="sb-logo-text">CITY SCHOLAR</span>
        </div>

        <nav className="sb-nav">
          {menuItems.map(({ key, label, icon: Icon, to }) => (
            <Link
              key={key}
              to={to}
              className={"sb-link" + (activePage === key ? " sb-link-active" : "")}
            >
              <Icon className="sb-link-icon" />
              <span>{label}</span>
            </Link>
          ))}

          {/* Add Admin / Staff — plain nav link, no dashed border */}
          <Link
            to="/manage-admins"
            className={"sb-link sb-add-staff-btn" + (activePage === "manage-admins" ? " sb-link-active" : "")}
          >
            <FaUserPlus className="sb-link-icon" />
            <span>Add Admin / Staff</span>
          </Link>
        </nav>

        <div className="sb-bottom">
          <div className="sb-admin">
            <div className="sb-admin-avatar">🛡️</div>
            <span className="sb-admin-label">Super Admin</span>
          </div>
          <button className="sb-logout-btn" onClick={() => setShowLogout(true)} title="Log out">
            <FaSignOutAlt />
          </button>
        </div>

      </aside>

      {showLogout && (
        <LogoutModal
          onConfirm={() => { setShowLogout(false); navigate("/logout"); }}
          onCancel={() => setShowLogout(false)}
        />
      )}
    </>
  );
}

export default SidebarSuper;