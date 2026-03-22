import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaThLarge, FaUserGraduate, FaMapMarkerAlt, FaCalendarAlt,
  FaBullhorn, FaCommentDots, FaArchive, FaSignOutAlt,
  FaRedo, FaUniversity,
} from "react-icons/fa";
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

export default function SidebarStaff({ activePage }) {
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  const menuItems = [
    { key: "dashboard",          label: "Dashboard",         icon: FaThLarge,      to: "/staff-dashboard"          },
    { key: "applications",       label: "Applicants",        icon: FaUserGraduate, to: "/staff-scholarship-applications" },
    { key: "scholars",           label: "Scholars",          icon: FaUserGraduate, to: "/staff-scholars"                 },
    { key: "renewals",           label: "Renewals",          icon: FaRedo,         to: "/staff-renewals"                 },
    { key: "barangay",           label: "Barangay Overview", icon: FaMapMarkerAlt, to: "/staff-barangay-overview"        },
    { key: "university",         label: "University Overview", icon: FaUniversity, to: "/staff-universityoverview"      },
    { key: "calendar",           label: "Calendar",          icon: FaCalendarAlt,  to: "/staff-calendar"                 },
    { key: "messages-inquiries", label: "Messages",          icon: FaCommentDots,  to: "/staff-messages"                 },
    { key: "archives",           label: "Archives",          icon: FaArchive,      to: "/staff-archives"                 },
  ];

  return (
    <>
      <aside className="sb-sidebar">
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
        </nav>

        <div className="sb-bottom">
          <div className="sb-admin">
            <div className="sb-admin-avatar">👥</div>
            <span className="sb-admin-label">Staff</span>
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
