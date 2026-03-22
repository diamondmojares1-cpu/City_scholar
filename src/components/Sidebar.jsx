// src/components/Sidebar.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaThLarge, FaUserGraduate, FaMapMarkerAlt, FaCalendarAlt,
  FaBullhorn, FaCommentDots, FaArchive, FaSignOutAlt,
  FaUserShield, FaUserPlus, FaRedo, FaUsers, FaUniversity,
} from "react-icons/fa";
import cityScholarLogo from "../assets/cityscholar.png";
import "../css/Sidebar.css";

// ── Logout Modal ──────────────────────────────────────────────
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

// ── Menu definitions ──────────────────────────────────────────
const ADMIN_MENU = [
  { key: "dashboard",          label: "Dashboard",           icon: FaThLarge,      to: "/admin-dashboard"          },
  { key: "applications",       label: "Applicants",          icon: FaUserGraduate, to: "/scholarship-applications" },
  { key: "scholars",           label: "Scholars",            icon: FaUserGraduate, to: "/scholars"                 },
  { key: "renewals",           label: "Renewals",            icon: FaRedo,         to: "/renewals"                 },
  { key: "attendance",         label: "Attendance",          icon: FaUsers,        to: "/attendance-admin"         },
  { key: "barangay",           label: "Barangay Overview",   icon: FaMapMarkerAlt, to: "/barangay-overview"        },
  { key: "university",         label: "University Overview", icon: FaUniversity,   to: "/universityoverview"       },
  { key: "calendar",           label: "Calendar",            icon: FaCalendarAlt,  to: "/calendar"                 },
  { key: "announcements",      label: "Announcements",       icon: FaBullhorn,     to: "/Announcements"            },
  { key: "messages-inquiries", label: "Messages",            icon: FaCommentDots,  to: "/messages-inquiries"       },
  { key: "archives",           label: "Archives",            icon: FaArchive,      to: "/archives"                 },
  { key: "manage-staff",       label: "Manage Staff",        icon: FaUserShield,   to: "/manage-staff"             },
];

const SUPERADMIN_MENU = [
  { key: "dashboard",          label: "Dashboard",           icon: FaThLarge,      to: "/superadmin-dashboard"     },
  { key: "scholars",           label: "Scholars",            icon: FaUserGraduate, to: "/scholars-super"           },
  { key: "barangay",           label: "Barangay Overview",   icon: FaMapMarkerAlt, to: "/barangay-overview-super"  },
  { key: "university",         label: "University Overview", icon: FaUniversity,   to: "/universityoverview-super" },
  { key: "calendar",           label: "Calendar",            icon: FaCalendarAlt,  to: "/calendar-super"           },
  { key: "attendance",         label: "Attendance",          icon: FaUsers,        to: "/attendance-super"         },
  { key: "announcements",      label: "Announcements",       icon: FaBullhorn,     to: "/announcements-super"      },
  { key: "messages-inquiries", label: "Messages",            icon: FaCommentDots,  to: "/messages-inquiries-super" },
  { key: "archives",           label: "Archives",            icon: FaArchive,      to: "/archives-super"           },
];

// ── Main Sidebar Component ────────────────────────────────────
function Sidebar({ activePage, role }) {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  // ✅ Explicit role check — "superadmin" shows superadmin menu,
  //    everything else (including "admin") shows admin menu
  const isSuperAdmin = role === "superadmin";
  const menuItems    = isSuperAdmin ? SUPERADMIN_MENU : ADMIN_MENU;

  return (
    <>
      <aside className="sb-sidebar">

        {/* Logo */}
        <div className="sb-logo">
          <img src={cityScholarLogo} alt="City Scholar" className="sb-logo-icon-img" />
          <span className="sb-logo-text">CITY SCHOLAR</span>
        </div>

        {/* Nav links */}
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

          {/* Superadmin-only: Add Admin / Staff button */}
          {isSuperAdmin && (
            <Link
              to="/manage-admins"
              className={"sb-link sb-add-staff-btn" + (activePage === "manage-admins" ? " sb-link-active" : "")}
            >
              <FaUserPlus className="sb-link-icon" />
              <span>Add Admin / Staff</span>
            </Link>
          )}
        </nav>

        {/* Bottom: user info + logout */}
        <div className="sb-bottom">
          <div className="sb-admin">
            <div className="sb-admin-avatar">{isSuperAdmin ? "🛡️" : "⭐"}</div>
            <span className="sb-admin-label">{isSuperAdmin ? "Super Admin" : "Admin"}</span>
          </div>
          <button
            className="sb-logout-btn"
            onClick={() => setShowLogout(true)}
            title="Log out"
          >
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

export default Sidebar;