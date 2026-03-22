import React from "react";
import AdminDashboard from "../admin/AdminDashboard.jsx";
import SidebarStaff from "../components/SidebarStaff.jsx";

export default function StaffDashboard() {
  return (
    <AdminDashboard
      SidebarComponent={SidebarStaff}
      activePage="dashboard"
    />
  );
}
