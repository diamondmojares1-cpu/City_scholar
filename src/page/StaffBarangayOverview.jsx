import React from "react";
import SidebarStaff from "../components/SidebarStaff";
import BarangayOverview from "./BarangayOverview.jsx";

export default function StaffBarangayOverview() {
  return (
    <BarangayOverview
      SidebarComponent={SidebarStaff}
      activePage="barangay"
    />
  );
}
