import React from "react";
import SidebarSuper from "../../components/SidebarSuper";
import BarangayOverview from "../../page/BarangayOverview.jsx";

export default function BarangayOverviewSuper() {
  return (
    <BarangayOverview
      SidebarComponent={SidebarSuper}
      activePage="barangay"
    />
  );
}
