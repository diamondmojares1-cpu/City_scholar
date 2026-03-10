import React, { useEffect, useState, useRef } from "react";
import Sidebar from "../components/Sidebar";
import {
  FaSearch, FaPlus, FaEdit,
  FaTrash, FaSpinner, FaImage, FaTimes, FaCalendarAlt,
  FaBullhorn, FaChevronDown, FaChevronUp, FaUpload,
  FaEye, FaUsers, FaFileAlt, FaToggleOn, FaToggleOff,
  FaCheckCircle, FaCamera,
} from "react-icons/fa";
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, updateDoc, orderBy, query, setDoc, getDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "../css/Announcements.css";

// ─────────────────────────────────────────────────────────────
// Delete Confirm Modal
// ─────────────────────────────────────────────────────────────
function DeleteConfirmModal({ title, onConfirm, onCancel }) {
  return (
    <div className="ann-del-overlay" onClick={onCancel}>
      <div className="ann-del-box" onClick={e => e.stopPropagation()}>
        <div className="ann-del-icon-wrap">
          <FaTrash className="ann-del-icon" />
        </div>
        <h3 className="ann-del-title">Delete Announcement?</h3>
        <p className="ann-del-msg">
          Are you sure you want to delete <strong>"{title}"</strong>?<br />
          This action cannot be undone.
        </p>
        <div className="ann-del-btns">
          <button className="ann-del-btn-no" onClick={onCancel}>No, Cancel</button>
          <button className="ann-del-btn-yes" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function buildCalendarWeeks(year, month) {
  const first = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function toDateKey(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function dateKeyToMs(key) {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}
function formatDisplay(ms) {
  if (!ms) return "";
  return new Date(Number(ms)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function formatShort(ms) {
  if (!ms) return "";
  return new Date(Number(ms)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(ms) {
  if (!ms) return "";
  return new Date(Number(ms)).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function getInitials(name = "") {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}
const BG_COLORS = ["#1e3a8a","#0369a1","#065f46","#7c3aed","#be123c","#c2410c","#b45309"];
function Avatar({ name = "", photoURL = null, size = 36 }) {
  const bg = BG_COLORS[(name.charCodeAt(0) || 0) % BG_COLORS.length];
  if (photoURL) return <img src={photoURL} alt={name} className="comp-avatar-img" style={{ width: size, height: size }} />;
  return (
    <div className="comp-avatar-placeholder" style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}>
      {getInitials(name)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Fetch announcements
// ─────────────────────────────────────────────────────────────
async function fetchAllAnnouncements() {
  const [calSnap, annSnap] = await Promise.all([
    getDocs(query(collection(db, "calendar_notes"), orderBy("date", "asc"))).catch(() => null),
    getDocs(collection(db, "announcements")).catch(() => null),
  ]);

  const results = [];

  if (calSnap) {
    calSnap.docs.forEach(d => {
      const data = d.data();
      results.push({
        id:                  d.id,
        title:               data.title       || "Untitled",
        description:         data.description || "",
        date:                data.date        || data.timestamp || Date.now(),
        imageURL:            data.imageURL    || null,
        imagePath:           data.imagePath   || null,
        source:              "calendar_notes",
        requiresAttendance:  data.requiresAttendance  || false,
        attendanceOpen:      data.attendanceOpen      ?? true,
      });
    });
  }

  if (annSnap) {
    annSnap.docs.forEach(d => {
      const data = d.data();
      results.push({
        id:                  d.id,
        title:               data.title     || "Announcement",
        description:         data.text      || data.description || "",
        date:                data.createdAt || data.date        || Date.now(),
        imageURL:            data.imageURL  || null,
        imagePath:           null,
        source:              "announcements",
        requiresAttendance:  data.requiresAttendance  || false,
        attendanceOpen:      data.attendanceOpen      ?? true,
      });
    });
  }

  results.sort((a, b) => b.date - a.date);
  return results;
}

// ─────────────────────────────────────────────────────────────
// Mini Calendar
// ─────────────────────────────────────────────────────────────
function MiniCalendar({ announcements, selectedDate, onSelectDate }) {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const weeks = buildCalendarWeeks(view.year, view.month);
  const markedDays = new Set(announcements.map(a => toDateKey(a.date)));

  const prev = () => setView(v => v.month === 0 ? { year: v.year-1, month: 11 } : { year: v.year, month: v.month-1 });
  const next = () => setView(v => v.month === 11 ? { year: v.year+1, month: 0 } : { year: v.year, month: v.month+1 });

  return (
    <div className="ann-calendar">
      <div className="ann-cal-header">
        <button className="ann-cal-nav-btn" onClick={prev}>‹</button>
        <span className="ann-cal-month-label">{MONTHS[view.month].slice(0,3)} · {view.year}</span>
        <button className="ann-cal-nav-btn" onClick={next}>›</button>
      </div>
      <div className="ann-cal-grid">
        {DAY_LABELS.map(d => <div key={d} className="ann-cal-day-label">{d}</div>)}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="ann-cal-grid">
          {week.map((day, di) => {
            if (!day) return <div key={di} className="ann-cal-day empty" />;
            const key = `${view.year}-${String(view.month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isToday = day === today.getDate() && view.month === today.getMonth() && view.year === today.getFullYear();
            const hasAnn  = markedDays.has(key);
            const isSel   = key === selectedDate;
            return (
              <div
                key={di}
                className={`ann-cal-day ${isToday?"today":""} ${hasAnn?"has-ann":""} ${isSel?"cal-selected":""}`}
                onClick={() => hasAnn && onSelectDate(isSel ? null : key)}
              >
                {day}
                {hasAnn && <span className="ann-dot" />}
              </div>
            );
          })}
        </div>
      ))}
      {selectedDate && (
        <button className="ann-cal-clear-btn" onClick={() => onSelectDate(null)}>
          <FaTimes /> Clear filter
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Add / Edit Modal — with Attendance Proof toggle
// ─────────────────────────────────────────────────────────────
function AnnouncementModal({ onClose, onSave, initial }) {
  const [title,              setTitle]   = useState(initial?.title              || "");
  const [description,        setDesc]    = useState(initial?.description        || "");
  const [dateKey,            setDateKey] = useState(initial?.date ? toDateKey(initial.date) : "");
  const [imageFile,          setFile]    = useState(null);
  const [imagePreview,       setPreview] = useState(initial?.imageURL           || null);
  const [requiresAttendance, setReqAtt]  = useState(initial?.requiresAttendance || false);
  const [saving,             setSaving]  = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim() || !dateKey) return;
    setSaving(true);
    const imageURL  = imageFile ? imagePreview : (initial?.imageURL || null);
    const imagePath = initial?.imagePath || null;
    await onSave({
      title: title.trim(),
      description: description.trim(),
      date: dateKeyToMs(dateKey),
      imageURL,
      imagePath,
      requiresAttendance,
      attendanceOpen: true,
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="ann-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ann-modal-box">
        <div className="ann-modal-header">
          <h3 className="ann-modal-title">
            <FaBullhorn className="ann-modal-title-icon" />
            {initial ? "Edit Announcement" : "New Announcement"}
          </h3>
          <button className="ann-modal-close" onClick={onClose}><FaTimes /></button>
        </div>

        <div className="ann-modal-fields">
          <div className="ann-modal-field">
            <label className="ann-modal-label">Title <span className="req">*</span></label>
            <input className="ann-modal-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter announcement title..." />
          </div>

          <div className="ann-modal-field">
            <label className="ann-modal-label">
              <FaCalendarAlt className="label-icon" /> Scheduled Date <span className="req">*</span>
            </label>
            <input className="ann-modal-input" type="date" value={dateKey} onChange={e => setDateKey(e.target.value)} />
          </div>

          <div className="ann-modal-field">
            <label className="ann-modal-label">Description <span className="req">*</span></label>
            <textarea className="ann-modal-textarea" value={description} onChange={e => setDesc(e.target.value)} placeholder="Write the announcement content..." rows={5} />
          </div>

          <div className="ann-modal-field">
            <label className="ann-modal-label">
              <FaImage className="label-icon" /> Attach Image <span className="optional">(optional)</span>
            </label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile} />
            {imagePreview ? (
              <div className="ann-img-preview-wrap">
                <img src={imagePreview} alt="preview" className="ann-img-preview" />
                <button className="ann-img-remove-btn" onClick={() => { setFile(null); setPreview(null); }}>
                  <FaTimes />
                </button>
              </div>
            ) : (
              <button className="ann-upload-btn" onClick={() => fileRef.current.click()}>
                <FaImage /> Choose Image
              </button>
            )}
          </div>

          {/* ── Attendance Proof Toggle ── */}
          <div className="ann-modal-field">
            <div className="ann-attendance-toggle-wrap">
              <div className="ann-attendance-toggle-info">
                <FaCamera className="ann-att-icon" />
                <div>
                  <span className="ann-attendance-toggle-label">Require Attendance Proof</span>
                  <span className="ann-attendance-toggle-desc">
                    Students must submit a photo as proof they attended this event
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`ann-toggle-btn ${requiresAttendance ? "on" : "off"}`}
                onClick={() => setReqAtt(p => !p)}
              >
                {requiresAttendance ? <FaToggleOn /> : <FaToggleOff />}
                <span>{requiresAttendance ? "ON" : "OFF"}</span>
              </button>
            </div>
            {requiresAttendance && (
              <div className="ann-attendance-notice">
                <FaCheckCircle className="ann-att-notice-icon" />
                Students will see a photo upload section for this event. You can open/close submissions anytime.
              </div>
            )}
          </div>
        </div>

        <div className="ann-modal-footer">
          <button className="ann-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="ann-modal-save-btn"
            onClick={handleSave}
            disabled={saving || !title.trim() || !description.trim() || !dateKey}
          >
            {saving ? <FaSpinner className="ann-spinner" /> : <FaBullhorn />}
            {initial ? "Save Changes" : "Post Announcement"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// View Submission Modal
// ─────────────────────────────────────────────────────────────
function ViewSubmissionModal({ completion, onClose }) {
  return (
    <div className="ann-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ann-modal-box">
        <div className="ann-modal-header">
          <h3 className="ann-modal-title">
            <FaFileAlt className="ann-modal-title-icon" />
            Attendance Proof — {completion.userName}
          </h3>
          <button className="ann-modal-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="ann-modal-fields">
          <div className="sub-info-row">
            <Avatar name={completion.userName} photoURL={completion.photoURL} size={48} />
            <div className="sub-info-text">
              <span className="sub-info-name">{completion.userName || "Unknown Scholar"}</span>
              <span className="sub-info-time">Submitted: {formatDateTime(completion.completedAt || completion.submittedAt)}</span>
            </div>
          </div>
          {completion.fileURL ? (
            <div className="sub-file-wrap">
              <p className="sub-file-label">Submitted Photo / Proof</p>
              <img src={completion.fileURL} alt="submission" className="sub-file-img" />
              <a href={completion.fileURL} target="_blank" rel="noreferrer" className="sub-open-btn">
                <FaEye /> Open Full Image
              </a>
            </div>
          ) : (
            <div className="sub-no-file">
              <FaImage className="sub-no-file-icon" />
              <p>No photo submitted yet.</p>
            </div>
          )}
        </div>
        <div className="ann-modal-footer">
          <button className="ann-modal-cancel-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Attendance Submissions Table
// ─────────────────────────────────────────────────────────────
function AttendanceTable({ annId, source, attendanceOpen, onToggleOpen }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [viewing,     setViewing]     = useState(null);
  const [toggling,    setToggling]    = useState(false);

  const colName = source === "announcements" ? "announcements" : "calendar_notes";

  useEffect(() => {
    if (!annId) return;
    setLoading(true);
    getDocs(collection(db, colName, annId, "attendance_proofs"))
      .then(snap => setSubmissions(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [annId, colName]);

  const filtered = submissions.filter(c =>
    (c.userName || "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleToggle() {
    setToggling(true);
    try {
      await updateDoc(doc(db, colName, annId), { attendanceOpen: !attendanceOpen });
      onToggleOpen(!attendanceOpen);
    } catch (err) {
      console.error("Toggle error:", err);
    } finally {
      setToggling(false);
    }
  }

  return (
    <>
      <div className="comp-section">

        {/* Header with open/close toggle */}
        <div className="comp-section-header">
          <div className="comp-section-title-row">
            <FaCamera className="comp-section-icon" />
            <span className="comp-section-title">Attendance Proofs</span>
            <span className="comp-count-badge">{submissions.length} submitted</span>
          </div>
          <div className="att-header-right">
            <div className="att-status-badge-wrap">
              <span className={`att-open-badge ${attendanceOpen ? "open" : "closed"}`}>
                {attendanceOpen ? "● Submissions Open" : "● Submissions Closed"}
              </span>
            </div>
            <button
              className={`att-toggle-btn ${attendanceOpen ? "close-btn" : "open-btn"}`}
              onClick={handleToggle}
              disabled={toggling}
            >
              {toggling
                ? <FaSpinner className="ann-spinner" />
                : attendanceOpen
                  ? <><FaToggleOn /> Close</>
                  : <><FaToggleOff /> Open</>
              }
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="comp-search-box" style={{ margin: "10px 0" }}>
          <FaSearch className="comp-search-icon" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search scholar..." />
        </div>

        {/* Status info */}
        <div className={`att-info-banner ${attendanceOpen ? "open" : "closed"}`}>
          {attendanceOpen
            ? "✅ Students can currently submit their attendance photo for this event."
            : "🔒 Submissions are closed. Students can no longer submit photos for this event."}
        </div>

        {/* Table */}
        {loading ? (
          <div className="comp-loading"><FaSpinner className="ann-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="comp-empty">
            <FaCamera className="comp-empty-icon" />
            <p>{search ? "No scholar matched." : "No attendance photos submitted yet."}</p>
          </div>
        ) : (
          <div className="comp-table-wrap">
            <table className="comp-table">
              <thead>
                <tr>
                  <th>#</th><th>Scholar</th><th>Submitted At</th><th>Photo</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id}>
                    <td className="comp-td-num">{i + 1}</td>
                    <td>
                      <div className="comp-td-user">
                        <Avatar name={c.userName || "?"} photoURL={c.photoURL} size={34} />
                        <span className="comp-td-name">{c.userName || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="comp-td-time">{formatDateTime(c.submittedAt || c.completedAt)}</td>
                    <td>
                      {c.fileURL
                        ? <span className="comp-file-yes">✓ Submitted</span>
                        : <span className="comp-file-no">— None</span>}
                    </td>
                    <td>
                      <button className="comp-view-btn" onClick={() => setViewing(c)}>
                        <FaEye /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && <ViewSubmissionModal completion={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Completions Table (original task completions)
// ─────────────────────────────────────────────────────────────
function CompletionsTable({ annId }) {
  const [completions, setCompletions] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [viewing,     setViewing]     = useState(null);

  useEffect(() => {
    if (!annId) return;
    setLoading(true);
    getDocs(query(collection(db, "calendar_notes", annId, "completions"), orderBy("completedAt", "desc")))
      .then(snap => setCompletions(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [annId]);

  const filtered = completions.filter(c =>
    (c.userName || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="comp-section">
        <div className="comp-section-header">
          <div className="comp-section-title-row">
            <FaUsers className="comp-section-icon" />
            <span className="comp-section-title">Task Completions</span>
            <span className="comp-count-badge">{completions.length} completed</span>
          </div>
          <div className="comp-search-box">
            <FaSearch className="comp-search-icon" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search scholar..." />
          </div>
        </div>
        {loading ? (
          <div className="comp-loading"><FaSpinner className="ann-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="comp-empty">
            <FaUsers className="comp-empty-icon" />
            <p>{search ? "No scholar matched." : "No completions yet."}</p>
          </div>
        ) : (
          <div className="comp-table-wrap">
            <table className="comp-table">
              <thead>
                <tr><th>#</th><th>Scholar</th><th>Completed At</th><th>File</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={c.id}>
                    <td className="comp-td-num">{i + 1}</td>
                    <td>
                      <div className="comp-td-user">
                        <Avatar name={c.userName || "?"} photoURL={c.photoURL} size={34} />
                        <span className="comp-td-name">{c.userName || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="comp-td-time">{formatDateTime(c.completedAt)}</td>
                    <td>{c.fileURL ? <span className="comp-file-yes">✓ Submitted</span> : <span className="comp-file-no">— None</span>}</td>
                    <td>
                      <button className="comp-view-btn" onClick={() => setViewing(c)}>
                        <FaEye /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {viewing && <ViewSubmissionModal completion={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function SourceBadge({ source }) {
  if (source === "announcements") return <span className="ann-source-badge ann-source-dashboard">Dashboard</span>;
  return <span className="ann-source-badge ann-source-calendar">Calendar</span>;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
export default function Announcements() {
  const [announcements,  setAnnouncements]  = useState([]);
  const [selected,       setSelected]       = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [showAddModal,   setShowAddModal]   = useState(false);
  const [editTarget,     setEditTarget]     = useState(null);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [search,         setSearch]         = useState("");
  const [calFilter,      setCalFilter]      = useState(null);
  const [activeTab,      setActiveTab]      = useState("details");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAllAnnouncements();
      setAnnouncements(data);
      setSelected(prev => {
        if (!prev) return data[0] ?? null;
        return data.find(a => a.id === prev.id) ?? data[0] ?? null;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSelect = (ann) => { setSelected(ann); setActiveTab("details"); };

  const handleAdd = async (fields) => {
    await addDoc(collection(db, "calendar_notes"), {
      ...fields,
      timestamp: Date.now(),
      userId: "",
    });
    await load();
  };

  const handleEdit = async (fields) => {
    const colName = editTarget.source === "announcements" ? "announcements" : "calendar_notes";
    const payload = colName === "announcements"
      ? { title: fields.title, text: fields.description, imageURL: fields.imageURL || null, requiresAttendance: fields.requiresAttendance, attendanceOpen: fields.attendanceOpen }
      : { ...fields };
    await updateDoc(doc(db, colName, editTarget.id), payload);
    setEditTarget(null);
    await load();
  };

  const handleDeleteRequest = (ann) => setDeleteTarget(ann);

  const handleDeleteConfirm = async () => {
    const ann = deleteTarget;
    setDeleteTarget(null);
    const colName = ann.source === "announcements" ? "announcements" : "calendar_notes";
    await deleteDoc(doc(db, colName, ann.id));
    setSelected(null);
    await load();
  };

  // ── Update local state when attendance toggle changes ──
  const handleAttendanceToggle = (annId, newValue) => {
    setAnnouncements(prev => prev.map(a => a.id === annId ? { ...a, attendanceOpen: newValue } : a));
    setSelected(prev => prev?.id === annId ? { ...prev, attendanceOpen: newValue } : prev);
  };

  const filtered = announcements.filter(a => {
    const matchSearch = a.title?.toLowerCase().includes(search.toLowerCase());
    const matchDate   = calFilter ? toDateKey(a.date) === calFilter : true;
    return matchSearch && matchDate;
  });

  return (
    <div className="ann-wrapper">
      <Sidebar activePage="announcements" />

      <div className="ann-main">
        <div className="ann-body">

          {/* LEFT PANEL */}
          <div className="ann-left-panel">
            <h2 className="ann-left-heading">Announcements</h2>

            {calFilter && (
              <div className="ann-filter-badge">
                <FaCalendarAlt /> {formatDisplay(dateKeyToMs(calFilter))}
              </div>
            )}

            <div className="ann-list">
              {loading ? (
                <div className="ann-loading-center"><FaSpinner className="ann-spinner" /></div>
              ) : filtered.length === 0 ? (
                <p className="ann-empty-text">No announcements.</p>
              ) : (
                filtered.map(ann => {
                  const isActive = selected?.id === ann.id;
                  return (
                    <button
                      key={ann.id}
                      className={`ann-item-btn ${isActive ? "active" : ""}`}
                      onClick={() => handleSelect(ann)}
                    >
                      <div className="ann-item-content">
                        <div className="ann-item-title-row">
                          <span className="ann-item-label">{ann.title}</span>
                          {ann.requiresAttendance && (
                            <span className="ann-item-att-badge" title="Requires attendance proof">
                              <FaCamera />
                            </span>
                          )}
                        </div>
                        <span className="ann-item-date">{formatShort(ann.date)}</span>
                      </div>
                      {isActive ? <FaChevronUp className="ann-chevron" /> : <FaChevronDown className="ann-chevron" />}
                    </button>
                  );
                })
              )}
            </div>

            <button className="ann-fab" onClick={() => setShowAddModal(true)} title="New Announcement">
              <FaPlus />
            </button>

            <MiniCalendar announcements={announcements} selectedDate={calFilter} onSelectDate={setCalFilter} />
          </div>

          {/* RIGHT PANEL */}
          <div className="ann-right-panel">
            {loading ? (
              <div className="ann-loading-center" style={{ paddingTop: 80 }}>
                <FaSpinner className="ann-spinner ann-spinner-lg" />
              </div>
            ) : selected ? (
              <div className="ann-detail-wrap">

                <div className="ann-detail-toprow">
                  <div className="ann-detail-meta">
                    <span className="ann-detail-date-label">
                      <FaCalendarAlt className="ann-detail-date-icon" />
                      {formatDisplay(selected.date)}
                    </span>
                    <SourceBadge source={selected.source} />
                    {selected.requiresAttendance && (
                      <span className="ann-att-required-badge">
                        <FaCamera /> Attendance Required
                      </span>
                    )}
                  </div>
                  <div className="ann-detail-action-btns">
                    <button className="ann-edit-icon-btn" onClick={() => setEditTarget(selected)} title="Edit">
                      <FaEdit />
                    </button>
                    <button className="ann-delete-icon-btn" onClick={() => handleDeleteRequest(selected)} title="Delete">
                      <FaTrash />
                    </button>
                  </div>
                </div>

                <h2 className="ann-detail-title">{selected.title}</h2>

                {/* Tabs */}
                <div className="ann-tabs">
                  <button className={`ann-tab ${activeTab === "details" ? "active" : ""}`} onClick={() => setActiveTab("details")}>
                    <FaFileAlt /> Details
                  </button>
                  {selected.source === "calendar_notes" && (
                    <button className={`ann-tab ${activeTab === "completions" ? "active" : ""}`} onClick={() => setActiveTab("completions")}>
                      <FaUsers /> Task Completions
                    </button>
                  )}
                  {selected.requiresAttendance && (
                    <button className={`ann-tab ${activeTab === "attendance" ? "active" : ""}`} onClick={() => setActiveTab("attendance")}>
                      <FaCamera /> Attendance Proofs
                      {selected.attendanceOpen && <span className="ann-tab-live-dot" />}
                    </button>
                  )}
                </div>

                {activeTab === "details" && (
                  <div className="ann-detail-body">
                    {selected.imageURL && (
                      <div className="ann-detail-img-wrap">
                        <img src={selected.imageURL} alt={selected.title} className="ann-detail-img" />
                      </div>
                    )}
                    <p className="ann-detail-text">{selected.description || "No description provided."}</p>
                  </div>
                )}

                {activeTab === "completions" && <CompletionsTable annId={selected.id} />}

                {activeTab === "attendance" && (
                  <AttendanceTable
                    annId={selected.id}
                    source={selected.source}
                    attendanceOpen={selected.attendanceOpen ?? true}
                    onToggleOpen={(val) => handleAttendanceToggle(selected.id, val)}
                  />
                )}

              </div>
            ) : (
              <div className="ann-detail-empty">
                <FaBullhorn className="ann-empty-icon" />
                <p>Select an announcement to view details</p>
                <button className="ann-add-first-btn" onClick={() => setShowAddModal(true)}>
                  <FaPlus /> New Announcement
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {showAddModal && <AnnouncementModal onClose={() => setShowAddModal(false)} onSave={handleAdd} />}
      {editTarget   && <AnnouncementModal initial={editTarget} onClose={() => setEditTarget(null)} onSave={handleEdit} />}
      {deleteTarget && <DeleteConfirmModal title={deleteTarget.title} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}