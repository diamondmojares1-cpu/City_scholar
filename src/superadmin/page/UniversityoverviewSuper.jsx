import React from "react";
import SidebarSuper from "../../components/SidebarSuper";
import UniversityOverview from "../../page/Universityoverview.jsx";

export default function UniversityoverviewSuper() {
  return (
    <UniversityOverview
      SidebarComponent={SidebarSuper}
      activePage="university"
    />
  );
}
