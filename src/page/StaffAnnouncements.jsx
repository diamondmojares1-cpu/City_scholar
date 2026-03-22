import React from "react";
import SidebarStaff from "../components/SidebarStaff";
import "../css/Sidebar.css";

export default function StaffAnnouncements() {
  return (
    <div className="sb-page-placeholder">
      <SidebarStaff activePage="announcements" />
      <main className="sb-placeholder-main">
        <h1>StaffAnnouncements</h1>
        <p>This staff page mirrors the admin view. Hook up data here.</p>
      </main>
    </div>
  );
}
