import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../firebase/firebaseConfig.js";
import {
  FaUsers, FaUserGraduate, FaSearch,
  FaClipboardList, FaPlus, FaTimes, FaTrash,
  FaBullhorn, FaCalendarAlt, FaImage,
  FaShieldAlt, FaUserShield, FaUserCircle, FaIdBadge,
  FaCheckCircle, FaClock, FaTimesCircle,
} from "react-icons/fa";
import SidebarSuper from "../components/SidebarSuper";
import "../css/S-adminDashboard.css";
import {
  ResponsiveContainer,
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";

// ── helpers (unchanged) ──────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function formatCount(n) { return n >= 1000 ? n.toLocaleString() : String(n); }
function formatAnnouncementDate(ts) { return ts ? new Date(ts).toLocaleDateString(undefined, { dateStyle: "medium" }) : ""; }
function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}
function toMillis(value) {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}
function getMonthKey(value) {
  const ms = toMillis(value);
  if (!ms) return "";
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function formatMonthKey(monthKey) {
  if (!monthKey) return "—";
  const [year, month] = monthKey.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
function normalizeStatusValue(...values) {
  const raw = values.find((v) => String(v || "").trim()) || "pending";
  const n = String(raw).toLowerCase().trim();
  if (n.includes("approve")) return "approved";
  if (n.includes("reject"))  return "rejected";
  if (n.includes("review") || n.includes("missing") || n.includes("pending")) return "pending";
  return n || "pending";
}
function parseNumericGwa(value) {
  if (value == null || value === "") return null;
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
function normalizeSemesterLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Unknown";
  const lower = raw.toLowerCase();
  if (lower.includes("1st") || lower.includes("first"))   return "1st Semester";
  if (lower.includes("2nd") || lower.includes("second"))  return "2nd Semester";
  if (lower.includes("summer"))                           return "Summer";
  return raw;
}
function getSemesterSortValue(s) {
  const l = normalizeSemesterLabel(s);
  if (l === "1st Semester") return 1;
  if (l === "2nd Semester") return 2;
  if (l === "Summer")       return 3;
  return 99;
}
function shortenLabel(value, max = 22) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ── Firebase helpers (unchanged) ─────────────────────────────
async function fetchDashboardData() {
  const [usersSnap, appSnap, renewalsSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "scholarship_applications")),
    getDocs(collection(db, "scholar_renewals")),
  ]);

  const submittedUserIds = new Set();
  const appsByUser = {};
  const monthlyApplicationsMap = {};
  const universityGwaMap = {};
  const renewalEligibleMap = {};
  const renewalSubmittedMap = {};

  function ensureMonthlyBucket(k) {
    if (!k) return null;
    if (!monthlyApplicationsMap[k]) monthlyApplicationsMap[k] = { submitted: 0, approved: 0 };
    return monthlyApplicationsMap[k];
  }
  function ensureSemesterSet(store, semester) {
    if (!semester) return null;
    if (!store[semester]) store[semester] = new Set();
    return store[semester];
  }
  function addUniversityGwaRecord(schoolName, gwa) {
    if (!schoolName || gwa == null) return;
    if (!universityGwaMap[schoolName]) universityGwaMap[schoolName] = { total: 0, count: 0 };
    universityGwaMap[schoolName].total += gwa;
    universityGwaMap[schoolName].count += 1;
  }
  function processApplicationAnalytics(data, fallbackId) {
    const status   = normalizeStatusValue(data.status, data.applicationStatus, data.scholarshipStatus);
    const userId   = data.userId || data.uid || data.studentId || fallbackId;
    const monthKey = getMonthKey(data.submittedAt || data.createdAt || data.dateSubmitted);
    const bucket   = ensureMonthlyBucket(monthKey);
    if (bucket) { bucket.submitted += 1; if (status === "approved") bucket.approved += 1; }
    const schoolName = data.educationInfo?.schoolName || data.schoolName || data.school || "";
    const gwa = parseNumericGwa(data.educationInfo?.gwa ?? data.gwa ?? data.educationInfo?.gpa ?? data.gpa);
    addUniversityGwaRecord(schoolName, gwa);
    const semester = normalizeSemesterLabel(data.educationInfo?.semester || data.semester);
    if (status === "approved" && userId && semester !== "Unknown") {
      ensureSemesterSet(renewalEligibleMap, semester)?.add(userId);
    }
  }
  function processRenewalAnalytics(data, fallbackId) {
    const userId   = data.userId || fallbackId;
    const status   = normalizeStatusValue(data.status, data.applicationStatus, data.renewalStatus);
    const schoolName = data.educationInfo?.schoolName || data.schoolName || data.school || "";
    const gwa = parseNumericGwa(data.educationInfo?.gwa ?? data.gwa ?? data.educationInfo?.gpa ?? data.gpa);
    addUniversityGwaRecord(schoolName, gwa);
    const semester = normalizeSemesterLabel(data.educationInfo?.semester || data.semester);
    if (userId && semester !== "Unknown") {
      ensureSemesterSet(renewalSubmittedMap, semester)?.add(userId);
      if (status === "approved") ensureSemesterSet(renewalEligibleMap, semester)?.add(userId);
    }
  }

  appSnap.docs.forEach((d) => {
    const data = d.data();
    const userId = data.userId || data.uid || data.studentId || d.id;
    appsByUser[userId] = data;
    submittedUserIds.add(userId);
    processApplicationAnalytics(data, d.id);
  });
  renewalsSnap.docs.forEach((d) => processRenewalAnalytics(d.data(), d.id));

  const barangayCounts = {};
  const applicants = [];
  let totalScholars = 0, activeScholars = 0, pendingApplicants = 0, approvedApplicants = 0;
  let approved = 0, reviewing = 0, rejected = 0;

  usersSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.role === "admin" || data.role === "superadmin") return;
    const app          = appsByUser[d.id] || {};
    const eduInfo      = app.educationInfo  || {};
    const personalInfo = app.personalInfo   || {};
    const barangay     = (data.barangay || personalInfo.barangay || "Unknown").trim() || "Unknown";
    const rawStatus    = (data.applicationStatus || data.scholarshipStatus || app.status || app.applicationStatus || "pending").toLowerCase();
    const fullName     = data.fullName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || `${personalInfo.firstName || ""} ${personalInfo.lastName || ""}`.trim() || "—";
    const course       = data.course    || eduInfo.course    || "—";
    const yearLevel    = data.yearLevel || eduInfo.yearLevel || "—";
    const gpa          = data.gpa != null ? data.gpa : (eduInfo.gwa || eduInfo.gpa || "—");
    totalScholars += 1;
    if (rawStatus === "approved")      { approved += 1; activeScholars += 1; approvedApplicants += 1; }
    else if (rawStatus === "rejected") { rejected += 1; }
    else                               { pendingApplicants += 1; reviewing += 1; }
    barangayCounts[barangay] = (barangayCounts[barangay] || 0) + 1;
    if (submittedUserIds.has(d.id)) {
      applicants.push({ id: d.id, fullName, course, yearLevel, gpa, status: rawStatus });
    }
  });

  const barangayData = Object.entries(barangayCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const applicationTrendData = Object.entries(monthlyApplicationsMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => ({ month: formatMonthKey(k), submitted: v.submitted, approved: v.approved }));

  const universityGwaData = Object.entries(universityGwaMap)
    .map(([university, v]) => ({ university, averageGwa: Number((v.total / v.count).toFixed(2)), sampleSize: v.count }))
    .sort((a, b) => a.averageGwa - b.averageGwa);

  const renewalRateData = Array.from(new Set([...Object.keys(renewalEligibleMap), ...Object.keys(renewalSubmittedMap)]))
    .sort((a, b) => { const d = getSemesterSortValue(a) - getSemesterSortValue(b); return d !== 0 ? d : a.localeCompare(b); })
    .map((semester) => {
      const eligible = Math.max(renewalEligibleMap[semester]?.size || 0, renewalSubmittedMap[semester]?.size || 0);
      const renewed  = renewalSubmittedMap[semester]?.size || 0;
      return { semester, renewed, notRenewed: Math.max(eligible - renewed, 0), renewalRate: eligible ? Number(((renewed / eligible) * 100).toFixed(1)) : 0 };
    });

  return {
    counts: { totalScholars, activeScholars, pendingApplicants, approvedApplicants },
    applicants,
    stats: { approved, reviewing, rejected },
    barangayData, applicationTrendData, universityGwaData, renewalRateData,
  };
}

async function fetchAnnouncements() {
  try {
    const snap = await getDocs(collection(db, "announcements"));
    if (!snap?.docs) return [];
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch { return []; }
}
async function postAnnouncement({ title, text, date, imageURL }) {
  const createdAt = Date.now();
  const payload   = { title: title || "Announcement", text: text || "", date: date || null, imageURL: imageURL || "", createdAt };
  const docRef    = await addDoc(collection(db, "announcements"), payload);
  if (date) await addDoc(collection(db, "calendar_notes"), { title: payload.title, description: payload.text, date, imageURL: payload.imageURL, createdAt });
  return { id: docRef.id, ...payload };
}
async function deleteAnnouncement(id) { await deleteDoc(doc(db, "announcements", id)); }

// ── Status badge ─────────────────────────────────────────────
function StatusBadge({ status }) {
  const n = (status || "").toLowerCase();
  const map = { approved: { label: "Approved", cls: "badge-approved" }, rejected: { label: "Rejected", cls: "badge-rejected" }, pending: { label: "Pending", cls: "badge-pending" } };
  const { label, cls } = map[n] || { label: "For Review", cls: "badge-review" };
  return <span className={`badge ${cls}`}>{label}</span>;
}

const COLOR_APPROVED  = "#22c55e";
const COLOR_REVIEWING = "#f59e0b";
const COLOR_REJECTED  = "#ef4444";

// ── Donut Chart (custom SVG — prominent & clean) ──────────────
function DonutChart({ approved, reviewing, rejected }) {
  const total = approved + reviewing + rejected;
  if (total === 0) {
    return (
      <div className="sd-donut-empty">
        <svg viewBox="0 0 120 120" width="120" height="120">
          <circle cx="60" cy="60" r="46" fill="none" stroke="#e2e8f0" strokeWidth="16" />
        </svg>
        <span>No data yet</span>
      </div>
    );
  }

  const pA = (approved  / total) * 360;
  const pR = (reviewing / total) * 360;
  const pJ = (rejected  / total) * 360;

  function describeArc(startDeg, endDeg, color, key) {
    const r   = 46;
    const cx  = 60; const cy = 60;
    const start = (startDeg - 90) * (Math.PI / 180);
    const end   = (endDeg   - 90) * (Math.PI / 180);
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    const d = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    return <path key={key} d={d} fill="none" stroke={color} strokeWidth="18" strokeLinecap="butt" />;
  }

  const arcs = [];
  let cursor = 0;
  if (approved  > 0) { arcs.push(describeArc(cursor, cursor + pA, COLOR_APPROVED,  "a")); cursor += pA; }
  if (reviewing > 0) { arcs.push(describeArc(cursor, cursor + pR, COLOR_REVIEWING, "r")); cursor += pR; }
  if (rejected  > 0) { arcs.push(describeArc(cursor, cursor + pJ, COLOR_REJECTED,  "j")); }

  return (
    <div className="sd-donut-wrap">
      <svg viewBox="0 0 120 120" width="130" height="130">
        <circle cx="60" cy="60" r="46" fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {arcs}
        <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="800" fill="#0f172a">{total}</text>
        <text x="60" y="70" textAnchor="middle" fontSize="9"  fontWeight="600" fill="#94a3b8">Total</text>
      </svg>
      <div className="sd-donut-legend">
        <div className="sd-legend-item">
          <span className="sd-legend-dot" style={{ background: COLOR_APPROVED }} />
          <span className="sd-legend-label">Approved</span>
          <span className="sd-legend-val">{approved}</span>
        </div>
        <div className="sd-legend-item">
          <span className="sd-legend-dot" style={{ background: COLOR_REVIEWING }} />
          <span className="sd-legend-label">Pending</span>
          <span className="sd-legend-val">{reviewing}</span>
        </div>
        <div className="sd-legend-item">
          <span className="sd-legend-dot" style={{ background: COLOR_REJECTED }} />
          <span className="sd-legend-label">Rejected</span>
          <span className="sd-legend-val">{rejected}</span>
        </div>
      </div>
    </div>
  );
}

// ── Profile Popup ─────────────────────────────────────────────
function ProfilePopup({ user, onClose }) {
  const initials   = getInitials(user?.fullName || user?.email || "?");
  const name       = user?.fullName || "—";
  const email      = user?.email || "—";
  const role       = user?.role || "superadmin";
  const roleLabel  = role === "superadmin" ? "Super Admin" : role === "admin" ? "Admin" : role;
  const roleColor  = "#7c3aed";

  return (
    <div className="profile-popup-overlay" onClick={onClose}>
      <div className="profile-popup-box" onClick={e => e.stopPropagation()}>
        <button className="profile-popup-close" onClick={onClose}><FaTimes /></button>
        <div className="profile-popup-avatar" style={{ background: roleColor }}>{initials}</div>
        <h3 className="profile-popup-name">{name}</h3>
        <span className="profile-popup-role-badge" style={{ background: `${roleColor}18`, color: roleColor, border: `1px solid ${roleColor}40` }}>
          <FaShieldAlt style={{ fontSize: "0.7rem" }} /> {roleLabel}
        </span>
        <div className="profile-popup-divider" />
        <div className="profile-popup-info">
          {[
            { icon: <FaIdBadge />, label: "Full Name", value: name },
            { icon: <FaUserCircle />, label: "Email",  value: email },
            { icon: <FaShieldAlt />, label: "Role",   value: roleLabel },
          ].map(({ icon, label, value }) => (
            <div key={label} className="profile-popup-row">
              <span className="profile-popup-row-icon" style={{ color: roleColor }}>{icon}</span>
              <div>
                <span className="profile-popup-row-label">{label}</span>
                <span className="profile-popup-row-value">{value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteConfirmModal({ announcementTitle, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="del-confirm-overlay" onClick={() => !isDeleting && onCancel()}>
      <div className="del-confirm-box" onClick={e => e.stopPropagation()}>
        <div className="del-confirm-icon-wrap"><FaTrash className="del-confirm-icon" /></div>
        <h3 className="del-confirm-title">Delete Announcement</h3>
        <p className="del-confirm-msg">Are you sure you want to delete <strong>"{announcementTitle || "this announcement"}"</strong>?<br />This action <strong>cannot be undone</strong>.</p>
        <div className="del-confirm-btns">
          <button type="button" className="del-confirm-no"  onClick={onCancel}  disabled={isDeleting}>No, Cancel</button>
          <button type="button" className="del-confirm-yes" onClick={onConfirm} disabled={isDeleting}>{isDeleting ? "Deleting…" : "Yes, Delete"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Announcement Modal ────────────────────────────────────────
function AnnouncementModal({ onClose, onPost }) {
  const [title, setTitle]     = useState("");
  const [date, setDate]       = useState("");
  const [text, setText]       = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [posting, setPosting] = useState(false);
  const [error, setError]     = useState(null);
  const fileRef = React.useRef();

  function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }
  function removeImage() { setImageFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!date)         { setError("Scheduled Date is required."); return; }
    if (!text.trim())  { setError("Description is required."); return; }
    setPosting(true); setError(null);
    try {
      let imageURL = "";
      if (imageFile) {
        imageURL = await new Promise((res, rej) => {
          const reader = new FileReader();
          reader.onload  = () => res(reader.result);
          reader.onerror = () => rej(new Error("Image read failed"));
          reader.readAsDataURL(imageFile);
        });
      }
      await onPost({ title: title.trim(), text: text.trim(), date: new Date(date).getTime(), imageURL });
      onClose();
    } catch (err) {
      setError("Failed to post. Please try again.");
    } finally { setPosting(false); }
  }

  return (
    <div className="modal-overlay" onClick={() => !posting && onClose()}>
      <div className="modal-content announcement-modal ann-new-modal" onClick={e => e.stopPropagation()}>
        <div className="ann-modal-header">
          <div className="ann-modal-header-left"><FaBullhorn className="ann-modal-header-icon" /><h3>Post Announcement</h3></div>
          <button type="button" className="ann-modal-close-btn" onClick={() => !posting && onClose()}><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="ann-modal-form">
          <div className="ann-form-group">
            <label htmlFor="ann-title">Title <span className="ann-required">*</span></label>
            <input id="ann-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Scholarship Orientation" maxLength={120} disabled={posting} className="ann-input" />
          </div>
          <div className="ann-form-group">
            <label htmlFor="ann-date"><FaCalendarAlt className="ann-label-icon" /> Scheduled Date <span className="ann-required">*</span></label>
            <input id="ann-date" type="date" value={date} onChange={e => setDate(e.target.value)} disabled={posting} className="ann-input ann-date-input" />
          </div>
          <div className="ann-form-group">
            <label htmlFor="ann-text">Description <span className="ann-required">*</span></label>
            <textarea id="ann-text" value={text} onChange={e => setText(e.target.value)} placeholder="Write your announcement for students…" rows={4} disabled={posting} className="ann-textarea" />
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

// ── Main Component ────────────────────────────────────────────
export default function SuperadminDashboard() {
  const [loading, setLoading]                         = useState(true);
  const [error, setError]                             = useState(null);
  const [counts, setCounts]                           = useState({ totalScholars: 0, activeScholars: 0, pendingApplicants: 0, approvedApplicants: 0 });
  const [stats, setStats]                             = useState({ approved: 0, reviewing: 0, rejected: 0 });
  const [barangayData, setBarangayData]               = useState([]);
  const [applicationTrendData, setApplicationTrendData] = useState([]);
  const [universityGwaData, setUniversityGwaData]     = useState([]);
  const [renewalRateData, setRenewalRateData]         = useState([]);
  const [applicants, setApplicants]                   = useState([]);
  const [announcements, setAnnouncements]             = useState([]);
  const [deletingId, setDeletingId]                   = useState(null);
  const [showModal, setShowModal]                     = useState(false);
  const [deleteConfirm, setDeleteConfirm]             = useState(null);
  const [showProfile, setShowProfile]                 = useState(false);
  const [currentUser, setCurrentUser]                 = useState(null);
  const [searchQuery, setSearchQuery]                 = useState("");

  const universityChartHeight = Math.max(240, universityGwaData.length * 44);

  const filteredApplicants = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return applicants;
    return applicants.filter(a =>
      a.fullName.toLowerCase().includes(q) ||
      a.course.toLowerCase().includes(q)   ||
      a.status.toLowerCase().includes(q)
    );
  }, [applicants, searchQuery]);

  const applicantCountLabel = useMemo(() => {
    if (loading) return "Loading...";
    if (!searchQuery.trim()) return `${formatCount(applicants.length)} Applicants`;
    return `${formatCount(filteredApplicants.length)} of ${formatCount(applicants.length)} Applicants`;
  }, [applicants.length, filteredApplicants.length, loading, searchQuery]);

  const maxBar = Math.max(1, ...barangayData.map(b => b.count));

  useEffect(() => {
    const auth = getAuth();
    async function loadAll(user) {
      setLoading(true); setError(null);
      try {
        const userDocSnap = await getDoc(doc(db, "users", user.uid));
        setCurrentUser(userDocSnap.exists()
          ? { uid: user.uid, email: user.email, ...userDocSnap.data() }
          : { uid: user.uid, email: user.email, role: "superadmin" }
        );
        const dashData = await fetchDashboardData();
        setCounts(dashData.counts);
        setStats(dashData.stats);
        setBarangayData(dashData.barangayData);
        setApplicationTrendData(dashData.applicationTrendData || []);
        setUniversityGwaData(dashData.universityGwaData || []);
        setRenewalRateData(dashData.renewalRateData || []);
        setApplicants(dashData.applicants || []);
        const ann = await fetchAnnouncements();
        setAnnouncements(ann);
      } catch (err) {
        console.error("Dashboard load error:", err);
        setError("Failed to load dashboard data. Please refresh.");
      } finally { setLoading(false); }
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) loadAll(user);
      else { setLoading(false); setError("You must be signed in."); }
    });
    return () => unsub();
  }, []);

  async function handlePostAnnouncement({ title, text, date, imageURL }) {
    const optimistic = { id: `temp-${Date.now()}`, title, text, date, imageURL, createdAt: Date.now() };
    setAnnouncements(prev => [optimistic, ...prev]);
    try {
      const saved = await postAnnouncement({ title, text, date, imageURL });
      setAnnouncements(prev => prev.map(a => a.id === optimistic.id ? saved : a));
      const fresh = await fetchAnnouncements();
      setAnnouncements(fresh);
    } catch (err) {
      setAnnouncements(prev => prev.filter(a => !a.id.startsWith("temp-")));
      throw err;
    }
  }

  async function handleConfirmDelete() {
    if (!deleteConfirm) return;
    setDeletingId(deleteConfirm.id);
    try {
      await deleteAnnouncement(deleteConfirm.id);
      setAnnouncements(prev => prev.filter(a => a.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch { alert("Failed to delete. Please try again."); }
    finally { setDeletingId(null); }
  }

  // KPI card config
  const kpiCards = [
    { icon: <FaUsers />,        label: "Total City Scholars",  value: counts.totalScholars,     color: "#2563eb" },
    { icon: <FaUserGraduate />, label: "Active Scholars",      value: counts.activeScholars,    color: "#059669" },
    { icon: <FaClipboardList />,label: "Pending Applicants",   value: counts.pendingApplicants, color: "#d97706" },
    { icon: <FaUsers />,        label: "Approved Applicants",  value: counts.approvedApplicants,color: "#7c3aed" },
  ];

  return (
    <div className="admin-container">
      <SidebarSuper activePage="dashboard" />

      <main className="main">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="search-box">
            <FaSearch className="search-icon" />
            <input type="text" placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="top-icons">
            <div className="circle profile-circle" onClick={() => setShowProfile(true)} title="View profile" style={{ cursor: "pointer" }}>
              <FaUserShield />
            </div>
          </div>
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="main-scroll">
          {error && <div className="error-banner">{error}</div>}

          <div className="sd-badge-row">
            <FaShieldAlt className="sd-badge-icon" />
            <span className="sd-badge-label">Superadmin Access</span>
          </div>

          <h2 className="page-title">Dashboard</h2>

          {/* ── ROW 1: KPI Cards ── */}
          <div className="sd-kpi-row">
            {kpiCards.map((c, i) => (
              <div key={i} className="sd-kpi-card" style={{ "--kpi-color": c.color }}>
                <div className="sd-kpi-icon-wrap">{c.icon}</div>
                <div className="sd-kpi-body">
                  <span className="sd-kpi-value">{loading ? "—" : formatCount(c.value)}</span>
                  <span className="sd-kpi-label">{c.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── ROW 2: Monthly Trend (left, 2fr) + Donut Stats (right, 1fr) ── */}
          <div className="sd-row-2">
            <div className="sd-card sd-card-trend">
              <div className="sd-card-head">
                <h3>Monthly Applications Submitted vs Approved</h3>
                <p>Submission flow and approval movement month by month.</p>
              </div>
              {loading ? (
                <div className="sd-chart-empty">Loading analytics…</div>
              ) : applicationTrendData.length === 0 ? (
                <div className="sd-chart-empty">No monthly data yet.</div>
              ) : (
                <div className="sd-chart-wrap">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={applicationTrendData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="submitted" name="Submitted" stroke="#2563eb" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="approved"  name="Approved"  stroke="#22c55e" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Donut — always visible, never hidden */}
            <div className="sd-card sd-card-donut">
              <div className="sd-card-head">
                <h3>Application Status</h3>
                <p>Breakdown of all scholar applications.</p>
              </div>
              {loading ? (
                <div className="sd-chart-empty">Loading…</div>
              ) : (
                <DonutChart approved={stats.approved} reviewing={stats.reviewing} rejected={stats.rejected} />
              )}

              {/* Mini status tiles */}
              <div className="sd-status-tiles">
                <div className="sd-status-tile" style={{ "--tile-color": COLOR_APPROVED }}>
                  <FaCheckCircle />
                  <span>{loading ? "—" : stats.approved}</span>
                  <small>Approved</small>
                </div>
                <div className="sd-status-tile" style={{ "--tile-color": COLOR_REVIEWING }}>
                  <FaClock />
                  <span>{loading ? "—" : stats.reviewing}</span>
                  <small>Pending</small>
                </div>
                <div className="sd-status-tile" style={{ "--tile-color": COLOR_REJECTED }}>
                  <FaTimesCircle />
                  <span>{loading ? "—" : stats.rejected}</span>
                  <small>Rejected</small>
                </div>
              </div>
            </div>
          </div>

          {/* ── ROW 3: GWA per University (left) + Barangay Bar Chart (right) ── */}
          <div className="sd-row-3">
            <div className="sd-card">
              <div className="sd-card-head">
                <h3>Average GWA per University</h3>
                <p>Benchmark academic performance across schools.</p>
              </div>
              {loading ? (
                <div className="sd-chart-empty">Loading analytics…</div>
              ) : universityGwaData.length === 0 ? (
                <div className="sd-chart-empty">No GWA data yet.</div>
              ) : (
                <div className="sd-chart-wrap" style={{ height: universityChartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={universityGwaData} layout="vertical" margin={{ top: 8, right: 18, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="university" width={140} tick={{ fontSize: 11, fill: "#475569" }} tickLine={false} axisLine={false} tickFormatter={v => shortenLabel(v, 22)} />
                      <Tooltip formatter={v => [`${v}`, "Avg GWA"]} />
                      <Bar dataKey="averageGwa" fill="#7c3aed" radius={[0, 8, 8, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="sd-card">
              <div className="sd-card-head">
                <h3>Barangay Overview</h3>
                <p>Highest scholar counts per barangay.</p>
              </div>
              <div className="sd-brgy-bars">
                {loading ? (
                  <div className="sd-chart-empty">Loading…</div>
                ) : barangayData.length === 0 ? (
                  <div className="sd-chart-empty">No barangay data.</div>
                ) : (
                  barangayData.map(b => (
                    <div key={b.name} className="sd-brgy-col" title={`${b.name}: ${b.count}`}>
                      <span className="sd-brgy-count">{b.count}</span>
                      <div className="sd-brgy-bar" style={{ height: `${(b.count / maxBar) * 140}px` }} />
                      <span className="sd-brgy-label">{b.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── ROW 4: Renewal Rate (full width) ── */}
          <div className="sd-card sd-card-full">
            <div className="sd-card-head">
              <h3>Renewal Rate per Semester</h3>
              <p>Compare how many scholars renewed versus those who did not.</p>
            </div>
            {loading ? (
              <div className="sd-chart-empty">Loading analytics…</div>
            ) : renewalRateData.length === 0 ? (
              <div className="sd-chart-empty">No renewal data yet.</div>
            ) : (
              <div className="sd-chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={renewalRateData} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="semester" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="renewed"    name="Renewed"        stroke="#2563eb" fill="#93c5fd" fillOpacity={0.7} />
                    <Area type="monotone" dataKey="notRenewed" name="Did Not Renew"  stroke="#f59e0b" fill="#fde68a" fillOpacity={0.65} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── ROW 5: Scholar Applicants ── */}
          <div className="sd-card sd-card-full">
            <div className="sd-card-head sd-card-head-split">
              <div className="sd-card-head-copy">
                <h3>Scholar Applicants</h3>
                <p>All scholars who have submitted an application.</p>
              </div>
              <div className="sd-head-count" aria-label="Scholar applicant count">
                {applicantCountLabel}
              </div>
            </div>
            <div className="sd-table-wrap">
              <table className="sd-table">
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
                    <tr><td colSpan={5} className="sd-td-center">Loading…</td></tr>
                  ) : filteredApplicants.length === 0 ? (
                    <tr><td colSpan={5} className="sd-td-center">{searchQuery ? "No results found." : "No applicants yet."}</td></tr>
                  ) : (
                    filteredApplicants.map(a => (
                      <tr key={a.id}>
                        <td className="sd-td-name">{a.fullName}</td>
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

        </div>{/* end main-scroll */}
      </main>

      {showModal     && <AnnouncementModal onClose={() => setShowModal(false)} onPost={handlePostAnnouncement} />}
      {deleteConfirm && <DeleteConfirmModal announcementTitle={deleteConfirm.title} onConfirm={handleConfirmDelete} onCancel={() => setDeleteConfirm(null)} isDeleting={deletingId === deleteConfirm.id} />}
      {showProfile   && <ProfilePopup user={currentUser} onClose={() => setShowProfile(false)} />}
    </div>
  );
}
