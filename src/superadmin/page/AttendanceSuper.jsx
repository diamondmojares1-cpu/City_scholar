import React from "react";
import SidebarSuper from "../../components/SidebarSuper";
import { AttendancePage } from "../../page/AttendanceAdmin.jsx";

export default function AttendanceSuper() {
  return (
    <AttendancePage
      SidebarComponent={SidebarSuper}
      activePage="attendance"
      role="superadmin"
    />
  );
}
