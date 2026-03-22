import React from "react";
import SidebarStaff from "../components/SidebarStaff";
import MessagesInquiries from "./Messagesinquiries.jsx";

export default function StaffMessages() {
  return (
    <MessagesInquiries
      SidebarComponent={SidebarStaff}
      activePage="messages-inquiries"
    />
  );
}
