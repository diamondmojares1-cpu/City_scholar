// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase/firebaseConfig";
import Login from "./page/Login.jsx";
import Register from "./page/Register.jsx";
import AdminDashboard from "./admin/AdminDashboard.jsx";
import SuperAdminDashboard from "./superadmin/SuperadDashboard.jsx";
import Scholars from "./page/Scholars.jsx";
import ScholarshipApplications from "./page/ScholarshipApplications.jsx";
import Renewals from "./page/Renewals.jsx";
import CalendarPage from "./page/Calendar.jsx";
import BarangayOverview from "./page/BarangayOverview.jsx";
import UniversityOverviewAdmin from "./page/Universityoverviewadmin.jsx";
import Announcements from "./page/Announcements.jsx";
import MessagesInquiries from "./page/Messagesinquiries.jsx";
import Archives from "./page/Archives.jsx";
import ForgotPassword from "./ForgotPassword.jsx";
import EmailActionHandler from "./page/Emailactionhandler.jsx";
import ManageStaff from "./page/ManageStaff.jsx";
import StudentDashboard from "./student/StudentDashboard.jsx";
import ScholarsSuper          from "./superadmin/page/ScholarsSuper.jsx";
import BarangayOverviewSuper  from "./superadmin/page/BarangayOverviewSuper.jsx";
import CalendarSuper          from "./superadmin/page/CalendarSuper.jsx";
import AnnouncementsSuper     from "./superadmin/page/AnnouncementsSuper.jsx";
import MessagesinquiriesSuper from "./superadmin/page/MessagesinquiriesSuper.jsx";
import ManageAdmins           from "./superadmin/page/Manageadmins.jsx";
import ArchivesSuper          from "./superadmin/page/Archivessuper.jsx";
import AttendanceAdmin        from "./page/AttendanceAdmin.jsx";
import AttendanceSuper        from "./superadmin/page/AttendanceSuper.jsx";
import UniversityoverviewSuper from "./superadmin/page/UniversityoverviewSuper.jsx";
import StaffDashboard         from "./page/StaffDashboard.jsx";
import StaffScholarshipApplications from "./page/StaffScholarshipApplications.jsx";
import StaffScholars          from "./page/StaffScholars.jsx";
import StaffRenewals          from "./page/StaffRenewals.jsx";
import StaffBarangayOverview  from "./page/StaffBarangayOverview.jsx";
import StaffCalendar          from "./page/StaffCalendar.jsx";
import StaffAnnouncements     from "./page/StaffAnnouncements.jsx";
import StaffMessages          from "./page/StaffMessages.jsx";
import StaffArchives          from "./page/StaffArchives.jsx";
import UniversityoverviewStaff from "./page/UniversityoverviewStaff.jsx";

// ── Role-protected wrapper ────────────────────────────────────
function RoleRoute({ allowedRoles, children }) {
  const [status, setStatus] = useState({ loading: true, allowed: false });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus({ loading: false, allowed: false });
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const role = (snap.data()?.role || "").toLowerCase();
        setStatus({ loading: false, allowed: allowedRoles.includes(role) });
      } catch (err) {
        console.error("Role check error:", err);
        setStatus({ loading: false, allowed: false });
      }
    });
    return () => unsub();
  }, [allowedRoles]);

  if (status.loading) return <div style={{ padding: 32 }}>Loading…</div>;
  if (!status.allowed) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/"               element={<EmailActionHandler />} />
      <Route path="/login"          element={<Login />} />
      <Route path="/register"       element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/logout"         element={<Navigate to="/login" />} />

      {/* ════════════════════════════════════════
          STUDENT
      ════════════════════════════════════════ */}
      <Route path="/student-dashboard" element={
        <RoleRoute allowedRoles={["student"]}>
          <StudentDashboard />
        </RoleRoute>
      } />

      {/* ════════════════════════════════════════
          ADMIN  (role="admin" only)
      ════════════════════════════════════════ */}
      <Route path="/admin-dashboard" element={
        <RoleRoute allowedRoles={["admin"]}>
          <AdminDashboard />
        </RoleRoute>
      } />
      <Route path="/scholarship-applications" element={
        <RoleRoute allowedRoles={["admin"]}>
          <ScholarshipApplications />
        </RoleRoute>
      } />
      <Route path="/scholars" element={
        <RoleRoute allowedRoles={["admin"]}>
          <Scholars />
        </RoleRoute>
      } />
      <Route path="/renewals" element={
        <RoleRoute allowedRoles={["admin"]}>
          <Renewals />
        </RoleRoute>
      } />
      <Route path="/attendance-admin" element={
        <RoleRoute allowedRoles={["admin"]}>
          <AttendanceAdmin />
        </RoleRoute>
      } />
      <Route path="/barangay-overview" element={
        <RoleRoute allowedRoles={["admin"]}>
          <BarangayOverview />
        </RoleRoute>
      } />
      {/* ✅ Admin University Overview — admin only, uses admin sidebar */}
      <Route path="/universityoverview" element={
        <RoleRoute allowedRoles={["admin"]}>
          <UniversityOverviewAdmin />
        </RoleRoute>
      } />
      <Route path="/calendar" element={
        <RoleRoute allowedRoles={["admin"]}>
          <CalendarPage />
        </RoleRoute>
      } />
      <Route path="/Announcements" element={
        <RoleRoute allowedRoles={["admin"]}>
          <Announcements />
        </RoleRoute>
      } />
      <Route path="/messages-inquiries" element={
        <RoleRoute allowedRoles={["admin"]}>
          <MessagesInquiries />
        </RoleRoute>
      } />
      <Route path="/archives" element={
        <RoleRoute allowedRoles={["admin"]}>
          <Archives />
        </RoleRoute>
      } />
      <Route path="/manage-staff" element={
        <RoleRoute allowedRoles={["admin"]}>
          <ManageStaff />
        </RoleRoute>
      } />

      {/* ════════════════════════════════════════
          STAFF  (role="staff" only)
      ════════════════════════════════════════ */}
      <Route path="/staff-dashboard" element={
        <RoleRoute allowedRoles={["staff"]}>
          <StaffDashboard />
        </RoleRoute>
      } />
      <Route path="/staff-scholarship-applications" element={
        <RoleRoute allowedRoles={["staff"]}>
          <StaffScholarshipApplications />
        </RoleRoute>
      } />
      <Route path="/staff-scholars" element={
        <RoleRoute allowedRoles={["staff"]}>
          <StaffScholars />
        </RoleRoute>
      } />
      <Route path="/staff-renewals" element={
        <RoleRoute allowedRoles={["staff"]}>
          <StaffRenewals />
        </RoleRoute>
      } />
      <Route path="/staff-barangay-overview" element={
        <RoleRoute allowedRoles={["staff"]}>
          <StaffBarangayOverview />
        </RoleRoute>
      } />
      {/* ✅ Staff University Overview — staff only, uses staff sidebar */}
      <Route path="/staff-universityoverview" element={
        <RoleRoute allowedRoles={["staff"]}>
          <UniversityoverviewStaff />
        </RoleRoute>
      } />
      <Route path="/staff-calendar" element={
        <RoleRoute allowedRoles={["staff"]}>
          <StaffCalendar />
        </RoleRoute>
      } />
      <Route path="/staff-announcements" element={
        <RoleRoute allowedRoles={["staff"]}>
          <StaffAnnouncements />
        </RoleRoute>
      } />
      <Route path="/staff-messages" element={
        <RoleRoute allowedRoles={["staff"]}>
          <StaffMessages />
        </RoleRoute>
      } />
      <Route path="/staff-archives" element={
        <RoleRoute allowedRoles={["staff"]}>
          <StaffArchives />
        </RoleRoute>
      } />

      {/* ════════════════════════════════════════
          SUPERADMIN  (role="superadmin" only)
      ════════════════════════════════════════ */}
      <Route path="/superadmin-dashboard" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <SuperAdminDashboard />
        </RoleRoute>
      } />
      <Route path="/scholars-super" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <ScholarsSuper />
        </RoleRoute>
      } />
      <Route path="/barangay-overview-super" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <BarangayOverviewSuper />
        </RoleRoute>
      } />
      <Route path="/calendar-super" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <CalendarSuper />
        </RoleRoute>
      } />
      <Route path="/announcements-super" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <AnnouncementsSuper />
        </RoleRoute>
      } />
      {/* ✅ Superadmin University Overview — superadmin only */}
      <Route path="/universityoverview-super" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <UniversityoverviewSuper />
        </RoleRoute>
      } />
      <Route path="/messages-inquiries-super" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <MessagesinquiriesSuper />
        </RoleRoute>
      } />
      <Route path="/manage-admins" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <ManageAdmins />
        </RoleRoute>
      } />
      <Route path="/archives-super" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <ArchivesSuper />
        </RoleRoute>
      } />
      <Route path="/attendance-super" element={
        <RoleRoute allowedRoles={["superadmin"]}>
          <AttendanceSuper />
        </RoleRoute>
      } />
    </Routes>
  );
}

export default App;
