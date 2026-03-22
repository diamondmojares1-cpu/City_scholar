import React from "react";
import SidebarStaff from "../components/SidebarStaff";
import ScholarshipApplications from "./ScholarshipApplications.jsx";

export default function StaffScholarshipApplications() {
  return (
    <ScholarshipApplications
      SidebarComponent={SidebarStaff}
      activePage="applications"
    />
  );
}
