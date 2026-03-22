import React from "react";
import SidebarStaff from "../components/SidebarStaff";
import Archives from "./Archives.jsx";

export default function StaffArchives() {
  return (
    <Archives
      SidebarComponent={SidebarStaff}
      activePage="archives"
    />
  );
}
