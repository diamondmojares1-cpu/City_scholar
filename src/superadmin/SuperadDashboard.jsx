import React, { useState, useEffect, useMemo, useRef } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase/firebaseConfig.js";
import {
  FaUsers, FaUserGraduate, FaSearch,
  FaClipboardList, FaPlus, FaTimes, FaTrash,
  FaChevronLeft, FaChevronRight, FaBullhorn, FaCalendarAlt, FaImage,
  FaShieldAlt, FaUserShield, FaUserCircle, FaIdBadge,
} from "react-icons/fa";
import SidebarSuper from "../components/SidebarSuper";
import "../css/AdminDashboard.css";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function getCalendarDays(year, month) {
  const first       = new Date(year, month, 1);
  const last        = new Date(year, month + 1, 0);
  const startPad    = first.getDay();
  const daysInMonth = last.getDate();
  const total       = Math.ceil((startPad + daysInMonth) / 7) * 7;
  const result      = [];
  for (let i = 0; i < startPad; i++)     result.push({ day: "", empty: true });
  for (let d = 1; d <= daysInMonth; d++) result.push({ day: d,  empty: false });
  while (result.length < total)          result.push({ day: "", empty: true });
  return result;
}

function formatCount(n) {
  return n >= 1000 ? n.toLocaleString() : String(n);
}

function formatAnnouncementDate(ts) {
  return ts ? new Date(ts).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";
}

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

// ─────────────────────────────────────────────────────────────
// Firebase helpers
// ─────────────────────────────────────────────────────────────
async function fetchDashboardData() {
  const [usersSnap, appSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "scholarship_applications")),
  ]);

  // Only show users who actually submitted an application
  const submittedUserIds = new Set();
  const appsByUser = {};
  appSnap.docs.forEach((docSnap) => {
    const data   = docSnap.data();
    const userId = data.userId || data.uid || data.studentId || docSnap.id;
    appsByUser[userId] = data;
    submittedUserIds.add(userId);
  });

  const applicants       = [];
  const barangayCounts   = {};
  let totalScholars      = 0;
  let activeScholars     = 0;
  let pendingApplicants  = 0;
  let approvedApplicants = 0;
  let approved           = 0;
  let reviewing          = 0;
  let rejected           = 0;

  usersSnap.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.role === "admin" || data.role === "superadmin") return;

    const app          = appsByUser[docSnap.id] || {};
    const eduInfo      = app.educationInfo  || {};
    const personalInfo = app.personalInfo   || {};

    const fullName =
      data.fullName ||
      `${data.firstName || ""} ${data.lastName || ""}`.trim() ||
      `${personalInfo.firstName || ""} ${personalInfo.lastName || ""}`.trim() ||
      "—";

    const course    = data.course    || eduInfo.course    || "—";
    const yearLevel = data.yearLevel || eduInfo.yearLevel || "—";
    const gpa       = data.gpa != null ? data.gpa : (eduInfo.gwa || eduInfo.gpa || "—");
    const barangay  = data.barangay  || personalInfo.barangay || "Unknown";

    const rawStatus = (
      data.applicationStatus ||
      data.scholarshipStatus ||
      app.status             ||
      app.applicationStatus  ||
      "pending"
    ).toLowerCase();

    totalScholars += 1;

    if (rawStatus === "approved") {
      approved += 1; activeScholars += 1; approvedApplicants += 1;
    } else if (rawStatus === "rejected") {
      rejected += 1;
    } else {
      pendingApplicants += 1; reviewing += 1;
    }

    const brgy = barangay.trim() || "Unknown";
    barangayCounts[brgy] = (barangayCounts[brgy] || 0) + 1;

    // ✅ Only add to table if they have a submitted application
    if (submittedUserIds.has(docSnap.id)) {
      applicants.push({ id: docSnap.id, fullName, course, yearLevel, gpa, status: rawStatus });
    }
  });

  const barangayData = Object.entries(barangayCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  return {
    counts: { totalScholars, activeScholars, pendingApplicants, approvedApplicants },
    applicants,
    stats: { approved, reviewing, rejected },
    barangayData,
  };
}

async function fetchAnnouncements() {
  try {
    const snap = await getDocs(collection(db, "announcements"));
    if (!snap?.docs) return [];
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (err) {
    console.error("fetchAnnouncements error:", err);
    return [];
  }
}

async function postAnnouncement({ title, text, date, imageURL }) {
  const createdAt = Date.now();
  const payload   = { title: title || "Announcement", text: text || "", date: date || null, imageURL: imageURL || "", createdAt };
  const docRef    = await addDoc(collection(db, "announcements"), payload);
  if (date) {
    await addDoc(collection(db, "calendar_notes"), { title: payload.title, description: payload.text, date, imageURL: payload.imageURL, createdAt });
  }
  return { id: docRef.id, ...payload };
}

async function deleteAnnouncement(id) {
  await deleteDoc(doc(db, "announcements", id));
}

// ─────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const normalized = (status || "").toLowerCase();
  const map = {
    approved: { label: "Approved", cls: "badge-approved" },
    rejected: { label: "Rejected", cls: "badge-rejected" },
    pending:  { label: "Pending",  cls: "badge-pending"  },
  };
  const { label, cls } = map[normalized] || { label: "For Review", cls: "badge-review" };
  return <span className={`badge ${cls}`}>{label}</span>;
}

const COLOR_APPROVED  = "#22c55e";
const COLOR_REVIEWING = "#eab308";
const COLOR_REJECTED  = "#ef4444";

// ─────────────────────────────────────────────────────────────
// Profile Popup — Superadmin version (purple theme)
// ─────────────────────────────────────────────────────────────
function ProfilePopup({ user, onClose }) {
  const initials = getInitials(user?.fullName || user?.FullName || user?.email || "?");
  const name     = user?.fullName || user?.FullName || "—";
  const email    = user?.email    || "—";
  const role     = user?.role     || "superadmin";
  const roleLabel = role === "superadmin" ? "Super Admin" : role === "admin" ? "Admin" : role;
  const roleColor = "#7c3aed"; // purple for superadmin

  return (
    <div className="profile-popup-overlay" onClick={onClose}>
      <div className="profile-popup-box" onClick={e => e.stopPropagation()}>
        <button className="profile-popup-close" onClick={onClose}><FaTimes /></button>

        <div className="profile-popup-avatar" style={{ background: roleColor }}>
          {initials}
        </div>

        <h3 className="profile-popup-name">{name}</h3>

        <span className="profile-popup-role-badge" style={{ background: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}40` }}>
          <FaShieldAlt style={{ fontSize: "0.7rem" }} /> {roleLabel}
        </span>

        <div className="profile-popup-divider" />

        <div className="profile-popup-info">
          <div className="profile-popup-row">
            <FaIdBadge className="profile-popup-row-icon" style={{ color: roleColor }} />
            <div>
              <span className="profile-popup-row-label">Full Name</span>
              <span className="profile-popup-row-value">{name}</span>
            </div>
          </div>
          <div className="profile-popup-row">
            <FaUserCircle className="profile-popup-row-icon" style={{ color: roleColor }} />
            <div>
              <span className="profile-popup-row-label">Email</span>
              <span className="profile-popup-row-value">{email}</span>
            </div>
          </div>
          <div className="profile-popup-row">
            <FaShieldAlt className="profile-popup-row-icon" style={{ color: roleColor }} />
            <div>
              <span className="profile-popup-row-label">Role</span>
              <span className="profile-popup-row-value">{roleLabel}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Delete Confirm Modal
// ─────────────────────────────────────────────────────────────
function DeleteConfirmModal({ announcementTitle, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="del-confirm-overlay" onClick={() => !isDeleting && onCancel()}>
      <div className="del-confirm-box" onClick={(e) => e.stopPropagation()}>
        <div className="del-confirm-icon-wrap">
          <FaTrash className="del-confirm-icon" />
        </div>
        <h3 className="del-confirm-title">Delete Announcement</h3>
        <p className="del-confirm-msg">
          Are you sure you want to delete <strong>"{announcementTitle || "this announcement"}"</strong>?
          <br />This action <strong>cannot be undone</strong>.
        </p>
        <div className="del-confirm-btns">
          <button type="button" className="del-confirm-no"  onClick={onCancel}  disabled={isDeleting}>No, Cancel</button>
          <button type="button" className="del-confirm-yes" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Yes, Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Announcement Modal
// ─────────────────────────────────────────────────────────────
function AnnouncementModal({ onClose, onPost }) {
  const [title, setTitle]         = useState("");
  const [date, setDate]           = useState("");
  const [text, setText]           = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview]     = useState(null);
  const [posting, setPosting]     = useState(false);
  const [error, setError]         = useState(null);
  const fileRef = useRef();

  function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!date)         { setError("Scheduled Date is required."); return; }
    if (!text.trim())  { setError("Description is required."); return; }
    setPosting(true);
    setError(null);
    try {
      const dateMs = new Date(date).getTime();
      let imageURL = "";
      if (imageFile) {
        imageURL = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload  = () => res(reader.result);
          reader.onerror = () => rej(new Error("Image read failed"));
          reader.readAsDataURL(imageFile);
        });
      }
      await onPost({ title: title.trim(), text: text.trim(), date: dateMs, imageURL });
      onClose();
    } catch (err) {
      console.error("Post error:", err);
      setError("Failed to post. Please try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={() => !posting && onClose()}>
      <div className="modal-content announcement-modal ann-new-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ann-modal-header">
          <div className="ann-modal-header-left">
            <FaBullhorn className="ann-modal-header-icon" />
            <h3>Post Announcement</h3>
          </div>
          <button type="button" className="ann-modal-close-btn" onClick={() => !posting && onClose()}>
            <FaTimes />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="ann-modal-form">
          <div className="ann-form-group">
            <label htmlFor="ann-title">Title <span className="ann-required">*</span></label>
            <input id="ann-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scholarship Orientation" maxLength={120} disabled={posting} className="ann-input" />
          </div>
          <div className="ann-form-group">
            <label htmlFor="ann-date"><FaCalendarAlt className="ann-label-icon" /> Scheduled Date <span className="ann-required">*</span></label>
            <input id="ann-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={posting} className="ann-input ann-date-input" />
          </div>
          <div className="ann-form-group">
            <label htmlFor="ann-text">Description <span className="ann-required">*</span></label>
            <textarea id="ann-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write your announcement for students…" rows={4} disabled={posting} className="ann-textarea" />
          </div>
          <div className="ann-form-group">
            <label><FaImage className="ann-label-icon" /> Attach Image <span className="ann-optional">(optional)</span></label>
            {preview ? (
              <div className="ann-img-preview-wrap">
                <img src={preview} alt="Preview" className="ann-img-preview" />
                <button type="button" className="ann-img-remove" onClick={removeImage} disabled={posting}><FaTimes /> Remove</button>
              </div>
            ) : (
              <button type="button" className="ann-choose-img-btn" onClick={() => fileRef.current?.click()} disabled={posting}><FaImage /> Choose Image</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} disabled={posting} />
          </div>
          {error && <p className="ann-error">{error}</p>}
          <div className="ann-modal-actions">
            <button type="button" className="ann-cancel-btn" onClick={() => !posting && onClose()} disabled={posting}>Cancel</button>
            <button type="submit" className="ann-submit-btn" disabled={posting}><FaBullhorn /> {posting ? "Posting…" : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function SuperadminDashboard() {
  const today = new Date();

  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [counts,        setCounts]        = useState({ totalScholars: 0, activeScholars: 0, pendingApplicants: 0, approvedApplicants: 0 });
  const [applicants,    setApplicants]    = useState([]);
  const [stats,         setStats]         = useState({ approved: 0, reviewing: 0, rejected: 0 });
  const [barangayData,  setBarangayData]  = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [deletingId,    setDeletingId]    = useState(null);
  const [showModal,     setShowModal]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [calendar,      setCalendar]      = useState({ year: today.getFullYear(), month: today.getMonth() });

  // ── Profile popup ──
  const [showProfile, setShowProfile] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const calendarDays = useMemo(() => getCalendarDays(calendar.year, calendar.month), [calendar.year, calendar.month]);

  const filteredApplicants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return applicants;
    return applicants.filter((a) =>
      a.fullName.toLowerCase().includes(q) ||
      a.course.toLowerCase().includes(q)   ||
      a.status.toLowerCase().includes(q)
    );
  }, [applicants, searchQuery]);

  const maxBar      = Math.max(1, ...barangayData.map((b) => b.count));
  const totalForPie = stats.approved + stats.reviewing + stats.rejected;
  const pApproved   = totalForPie ? (stats.approved  / totalForPie) * 100 : 0;
  const pReviewing  = totalForPie ? (stats.reviewing / totalForPie) * 100 : 0;
  const pieGradient = totalForPie
    ? `conic-gradient(${COLOR_APPROVED} 0% ${pApproved}%, ${COLOR_REVIEWING} ${pApproved}% ${pApproved + pReviewing}%, ${COLOR_REJECTED} ${pApproved + pReviewing}% 100%)`
    : "conic-gradient(#e0e0e0 0% 100%)";

  function prevMonth() {
    setCalendar((c) => c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 });
  }
  function nextMonth() {
    setCalendar((c) => c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 });
  }

  useEffect(() => {
    const auth = getAuth();
    async function loadAll(user) {
      setLoading(true);
      setError(null);
      try {
        // ✅ Fetch current superadmin's Firestore data
        const userDocSnap = await getDoc(doc(db, "users", user.uid));
        if (userDocSnap.exists()) {
          setCurrentUser({ uid: user.uid, email: user.email, ...userDocSnap.data() });
        } else {
          setCurrentUser({ uid: user.uid, email: user.email, role: "superadmin" });
        }

        const [dashData, announcementList] = await Promise.all([
          fetchDashboardData(),
          fetchAnnouncements(),
        ]);
        setCounts(dashData.counts);
        setApplicants(dashData.applicants);
        setStats(dashData.stats);
        setBarangayData(dashData.barangayData);
        setAnnouncements(announcementList);
      } catch (err) {
        console.error("Dashboard load error:", err);
        setError("Failed to load dashboard data. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) loadAll(user);
      else { setLoading(false); setError("You must be signed in to view the dashboard."); }
    });
    return () => unsubscribe();
  }, []);

  async function handlePostAnnouncement({ title, text, date, imageURL }) {
    const optimistic = { id: `temp-${Date.now()}`, title, text, date, imageURL, createdAt: Date.now() };
    setAnnouncements((prev) => [optimistic, ...prev]);
    try {
      const saved = await postAnnouncement({ title, text, date, imageURL });
      setAnnouncements((prev) => prev.map((a) => (a.id === optimistic.id ? saved : a)));
      const fresh = await fetchAnnouncements();
      setAnnouncements(fresh);
    } catch (err) {
      console.error("Post announcement error:", err);
      setAnnouncements((prev) => prev.filter((a) => !a.id.startsWith("temp-")));
      throw err;
    }
  }

  function handleAskDelete(id, title) { setDeleteConfirm({ id, title }); }

  async function handleConfirmDelete() {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeletingId(id);
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to delete. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="admin-container">
      <SidebarSuper activePage="dashboard" />

      <main className="main">

        {/* TOPBAR */}
        <div className="topbar">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search scholars by name, course or status…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="top-icons">
            {/* ✅ No notif icon — profile icon only */}
            <div
              className="circle profile-circle"
              onClick={() => setShowProfile(true)}
              title="View profile"
              style={{ cursor: "pointer" }}
            >
              <FaUserShield />
            </div>
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="main-scroll">

          {error && <div className="error-banner">{error}</div>}

          <div className="superadmin-badge-row">
            <FaShieldAlt className="superadmin-badge-icon" />
            <span className="superadmin-badge-label">Superadmin Access</span>
          </div>

          <h2 className="page-title">Dashboard</h2>

          {/* STAT CARDS */}
          <div className="cards">
            <div className="card">
              <FaUsers className="card-icon" />
              <h2>{loading ? "—" : formatCount(counts.totalScholars)}</h2>
              <p>Total City Scholars</p>
            </div>
            <div className="card">
              <FaUserGraduate className="card-icon" />
              <h2>{loading ? "—" : formatCount(counts.activeScholars)}</h2>
              <p>Active Scholars</p>
            </div>
            <div className="card">
              <FaClipboardList className="card-icon" />
              <h2>{loading ? "—" : formatCount(counts.pendingApplicants)}</h2>
              <p>Pending Applicants</p>
            </div>
            <div className="card">
              <FaUsers className="card-icon" />
              <h2>{loading ? "—" : formatCount(counts.approvedApplicants)}</h2>
              <p>Approved Applicants</p>
            </div>
          </div>

          {/* GRID: table + right panel */}
          <div className="grid-section">
            <div className="table-box">
              <h3>Scholar Applicants</h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Scholar Name</th>
                      <th>Course</th>
                      <th>Year Level</th>
                      <th>GPA</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="table-loading">Loading…</td></tr>
                    ) : filteredApplicants.length === 0 ? (
                      <tr><td colSpan={5} className="table-loading">{searchQuery ? "No results found." : "No applicants yet."}</td></tr>
                    ) : (
                      filteredApplicants.map((a) => (
                        <tr key={a.id}>
                          <td>{a.fullName}</td>
                          <td>{a.course}</td>
                          <td>{a.yearLevel}</td>
                          <td>{a.gpa}</td>
                          <td><StatusBadge status={a.status} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="right-side">
              <div className="stats-box">
                <h3>Statistics</h3>
                <div className="pie" style={{ background: pieGradient }} />
                <ul className="legend">
                  <li><span className="dot" style={{ backgroundColor: COLOR_APPROVED }} />Approved<strong>{loading ? "—" : stats.approved}</strong></li>
                  <li><span className="dot" style={{ backgroundColor: COLOR_REVIEWING }} />Reviewing / Pending<strong>{loading ? "—" : stats.reviewing}</strong></li>
                  <li><span className="dot" style={{ backgroundColor: COLOR_REJECTED }} />Rejected<strong>{loading ? "—" : stats.rejected}</strong></li>
                </ul>
              </div>

              <div className="calendar-box">
                <h3>Calendar</h3>
                <div className="calendar-nav">
                  <button onClick={prevMonth}><FaChevronLeft /></button>
                  <span className="calendar-label">{MONTHS[calendar.month]} {calendar.year}</span>
                  <button onClick={nextMonth}><FaChevronRight /></button>
                </div>
                <div className="calendar-grid">
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                    <span key={d} className="calendar-weekday">{d}</span>
                  ))}
                  {calendarDays.map((cell, i) => {
                    const isToday = !cell.empty && cell.day === today.getDate() && calendar.month === today.getMonth() && calendar.year === today.getFullYear();
                    return (
                      <span key={i} className={[cell.empty ? "calendar-empty" : "calendar-day", isToday ? "calendar-today" : ""].join(" ").trim()}>
                        {cell.day || ""}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM: bar chart + announcements */}
          <div className="bottom-section">
            <div className="bar-box">
              <h3>Barangay Overview</h3>
              <div className="bars">
                {loading ? (
                  <div className="bars-placeholder">Loading…</div>
                ) : barangayData.length === 0 ? (
                  <div className="bars-placeholder">No barangay data available.</div>
                ) : (
                  barangayData.map((b) => (
                    <div key={b.name} className="bar-wrap" title={`${b.name}: ${b.count}`}>
                      <span className="bar-count">{b.count}</span>
                      <div className="bar" style={{ height: `${(b.count / maxBar) * 100}%` }} />
                      <span className="bar-label">{b.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="announcement-box">
              <div className="announcement-box-header">
                <h3>Announcement Board</h3>
                <button type="button" className="announcement-add-btn" onClick={() => setShowModal(true)} title="Post announcement">
                  <FaPlus />
                </button>
              </div>
              {loading ? (
                <div className="announcement-item">Loading…</div>
              ) : announcements.length === 0 ? (
                <div className="announcement-item">No announcements yet. Click <strong>+</strong> to post.</div>
              ) : (
                <div className="announcement-board-list">
                  {announcements.map((a) => (
                    <div key={a.id} className="announcement-item announcement-board-item">
                      <div className="announcement-item-header">
                        <strong>{a.title || "Announcement"}</strong>
                        <button type="button" className="announcement-delete-btn" onClick={() => handleAskDelete(a.id, a.title)} disabled={deletingId === a.id} title="Delete">
                          {deletingId === a.id ? "…" : <FaTrash />}
                        </button>
                      </div>
                      {a.text && <p className="announcement-board-text">{a.text}</p>}
                      {a.date && (
                        <span className="announcement-scheduled-date">
                          <FaCalendarAlt style={{ marginRight: 4, fontSize: "0.7rem" }} />
                          {new Date(a.date).toLocaleDateString(undefined, { dateStyle: "medium" })}
                        </span>
                      )}
                      <span className="announcement-date">Posted: {formatAnnouncementDate(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showModal      && <AnnouncementModal onClose={() => setShowModal(false)} onPost={handlePostAnnouncement} />}
      {deleteConfirm  && <DeleteConfirmModal announcementTitle={deleteConfirm.title} onConfirm={handleConfirmDelete} onCancel={() => setDeleteConfirm(null)} isDeleting={deletingId === deleteConfirm.id} />}

      {/* ✅ Profile Popup */}
      {showProfile && <ProfilePopup user={currentUser} onClose={() => setShowProfile(false)} />}
    </div>
  );
}