import React from "react";
import SidebarStaff from "../components/SidebarStaff";
import Renewals from "./Renewals.jsx";

export default function StaffRenewals() {
  return (
    <Renewals
      SidebarComponent={SidebarStaff}
      activePage="renewals"
    />
  );
}
