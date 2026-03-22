import React from "react";
import SidebarStaff from "../components/SidebarStaff";
import CalendarPage from "./Calendar.jsx";

export default function StaffCalendar() {
  return (
    <CalendarPage
      SidebarComponent={SidebarStaff}
      activePage="calendar"
    />
  );
}
