// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./page/Login.jsx";
import Register from "./page/Register.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import SuperAdminDashboard from "./superadmin/SuperadDashboard.jsx";
import Scholars from "./page/Scholars.jsx";
import ScholarshipApplications from "./page/ScholarshipApplications.jsx";
import Renewals from "./page/Renewals.jsx";
import CalendarPage from "./page/Calendar.jsx";
import BarangayOverview from "./page/BarangayOverview.jsx";
import Announcements from "./page/Announcements.jsx";
import MessagesInquiries from "./page/Messagesinquiries.jsx";
import Archives from "./page/Archives.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import EmailActionHandler from "./page/Emailactionhandler.jsx";
import StudentDashboard from "./student/StudentDashboard.jsx";
import ScholarsSuper          from "./superadmin/page/ScholarsSuper.jsx";
import BarangayOverviewSuper  from "./superadmin/page/BarangayOverviewSuper.jsx";
import CalendarSuper          from "./superadmin/page/CalendarSuper.jsx";
import AnnouncementsSuper     from "./superadmin/page/AnnouncementsSuper.jsx";
import MessagesinquiriesSuper from "./superadmin/page/MessagesinquiriesSuper.jsx";
import ManageAdmins           from "./superadmin/page/Manageadmins.jsx";
import ArchivesSuper from "./superadmin/page/Archivessuper.jsx";

function App() {
  return (
    <Routes>
      <Route path="/" element={<EmailActionHandler />} />

      <Route path="/login"            element={<Login />} />
      <Route path="/register"         element={<Register />} />
      <Route path="/forgot-password"  element={<ForgotPassword />} />
      <Route path="/logout"           element={<Navigate to="/login" />} />

      {/* Student */}
      <Route path="/student-dashboard" element={<StudentDashboard />} />

      {/* Admin */}
      <Route path="/admin-dashboard"          element={<AdminDashboard />} />
      <Route path="/scholarship-applications" element={<ScholarshipApplications />} />
      <Route path="/scholars"                 element={<Scholars />} />
      <Route path="/renewals"                 element={<Renewals />} />
      <Route path="/barangay-overview"        element={<BarangayOverview />} />
      <Route path="/calendar"                 element={<CalendarPage />} />
      <Route path="/Announcements"            element={<Announcements />} />
      <Route path="/messages-inquiries"       element={<MessagesInquiries />} />
      <Route path="/archives"                 element={<Archives />} />

      {/* Superadmin */}
      <Route path="/superadmin-dashboard"     element={<SuperAdminDashboard />} />
      <Route path="/scholars-super"           element={<ScholarsSuper />} />
      <Route path="/barangay-overview-super"  element={<BarangayOverviewSuper />} />
      <Route path="/calendar-super"           element={<CalendarSuper />} />
      <Route path="/announcements-super"      element={<AnnouncementsSuper />} />
      <Route path="/messages-inquiries-super" element={<MessagesinquiriesSuper />} />
      <Route path="/manage-admins"            element={<ManageAdmins />} />
      <Route path="/archives-super"           element={<ArchivesSuper />} />
    </Routes>
  );
}

export default App;