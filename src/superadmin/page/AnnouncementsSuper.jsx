import React, { useEffect, useState, useRef } from "react";
import SidebarSuper from "../../components/SidebarSuper";
import {
  FaSearch, FaBell, FaUserCircle, FaPlus, FaEdit,
  FaTrash, FaSpinner, FaImage, FaTimes, FaCalendarAlt,
  FaBullhorn, FaChevronDown, FaChevronUp, FaUpload,
  FaEye, FaUsers, FaFileAlt, FaExclamationTriangle,
} from "react-icons/fa";
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, updateDoc, orderBy, query,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import "../../css/Announcements.css";

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

const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

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

async function fetchAllAnnouncements() {
  const [calSnap, annSnap] = await Promise.all([
    getDocs(query(collection(db, "calendar_notes"), orderBy("date", "asc"))).catch(() => null),
    getDocs(collection(db, "announcements")).catch(() => null),
  ]);
  const results = [];
  if (calSnap) {
    calSnap.docs.forEach(d => {
      const data = d.data();
      results.push({ id: d.id, title: data.title || "Untitled", description: data.description || "", date: data.date || data.timestamp || Date.now(), imageURL: data.imageURL || null, imagePath: data.imagePath || null, source: "calendar_notes" });
    });
  }
  if (annSnap) {
    annSnap.docs.forEach(d => {
      const data = d.data();
      results.push({ id: d.id, title: data.title || "Announcement", description: data.text || data.description || "", date: data.createdAt || data.date || Date.now(), imageURL: data.imageURL || null, imagePath: null, source: "announcements" });
    });
  }
  results.sort((a, b) => b.date - a.date);
  return results;
}

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
            const hasAnn = markedDays.has(key);
            const isSel = key === selectedDate;
            return (
              <div key={di} className={`ann-cal-day ${isToday?"today":""} ${hasAnn?"has-ann":""} ${isSel?"cal-selected":""}`} onClick={() => hasAnn && onSelectDate(isSel ? null : key)}>
                {day}
                {hasAnn && <span className="ann-dot" />}
              </div>
            );
          })}
        </div>
      ))}
      {selectedDate && <button className="ann-cal-clear-btn" onClick={() => onSelectDate(null)}><FaTimes /> Clear filter</button>}
    </div>
  );
}

function AnnouncementModal({ onClose, onSave, initial }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDesc] = useState(initial?.description || "");
  const [dateKey, setDateKey] = useState(initial?.date ? toDateKey(initial.date) : "");
  const [imageFile, setFile] = useState(null);
  const [imagePreview, setPreview] = useState(initial?.imageURL || null);
  const [saving, setSaving] = useState(false);
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
    const imageURL = imageFile ? imagePreview : (initial?.imageURL || null);
    await onSave({ title: title.trim(), description: description.trim(), date: dateKeyToMs(dateKey), imageURL, imagePath: initial?.imagePath || null });
    setSaving(false);
    onClose();
  };
  return (
    <div className="ann-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ann-modal-box">
        <div className="ann-modal-header">
          <h3 className="ann-modal-title"><FaBullhorn className="ann-modal-title-icon" />{initial ? "Edit Announcement" : "New Announcement"}</h3>
          <button className="ann-modal-close" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="ann-modal-fields">
          <div className="ann-modal-field">
            <label className="ann-modal-label">Title <span className="req">*</span></label>
            <input className="ann-modal-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter announcement title..." />
          </div>
          <div className="ann-modal-field">
            <label className="ann-modal-label"><FaCalendarAlt className="label-icon" /> Scheduled Date <span className="req">*</span></label>
            <input className="ann-modal-input" type="date" value={dateKey} onChange={e => setDateKey(e.target.value)} />
          </div>
          <div className="ann-modal-field">
            <label className="ann-modal-label">Description <span className="req">*</span></label>
            <textarea className="ann-modal-textarea" value={description} onChange={e => setDesc(e.target.value)} placeholder="Write the announcement content..." rows={5} />
          </div>
          <div className="ann-modal-field">
            <label className="ann-modal-label"><FaImage className="label-icon" /> Attach Image <span className="optional">(optional)</span></label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleFile} />
            {imagePreview ? (
              <div className="ann-img-preview-wrap">
                <img src={imagePreview} alt="preview" className="ann-img-preview" />
                <button className="ann-img-remove-btn" onClick={() => { setFile(null); setPreview(null); }}><FaTimes /></button>
              </div>
            ) : (
              <button className="ann-upload-btn" onClick={() => fileRef.current.click()}><FaImage /> Choose Image</button>
            )}
          </div>
        </div>
        <div className="ann-modal-footer">
          <button className="ann-modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="ann-modal-save-btn" onClick={handleSave} disabled={saving || !title.trim() || !description.trim() || !dateKey}>
            {saving ? <FaSpinner className="ann-spinner" /> : <FaBullhorn />}
            {initial ? "Save Changes" : "Post Announcement"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceBadge({ source }) {
  if (source === "announcements") return <span className="ann-source-badge ann-source-dashboard">Dashboard</span>;
  return <span className="ann-source-badge ann-source-calendar">Calendar</span>;
}

export default function AnnouncementsSuper() {
  const [announcements, setAnnouncements] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [calFilter, setCalFilter] = useState(null);
  const [activeTab, setActiveTab] = useState("details");

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchAllAnnouncements();
      setAnnouncements(data);
      setSelected(prev => {
        if (!prev) return data[0] ?? null;
        return data.find(a => a.id === prev.id) ?? data[0] ?? null;
      });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (fields) => {
    await addDoc(collection(db, "calendar_notes"), { ...fields, timestamp: Date.now(), userId: "" });
    await load();
  };
  const handleEdit = async (fields) => {
    const colName = editTarget.source === "announcements" ? "announcements" : "calendar_notes";
    const payload = colName === "announcements" ? { title: fields.title, text: fields.description, imageURL: fields.imageURL || null } : { ...fields };
    await updateDoc(doc(db, colName, editTarget.id), payload);
    setEditTarget(null);
    await load();
  };
  const handleDeleteConfirm = async () => {
    const ann = deleteTarget;
    setDeleteTarget(null);
    await deleteDoc(doc(db, ann.source === "announcements" ? "announcements" : "calendar_notes", ann.id));
    setSelected(null);
    await load();
  };

  const filtered = announcements.filter(a => {
    const matchSearch = a.title?.toLowerCase().includes(search.toLowerCase());
    const matchDate = calFilter ? toDateKey(a.date) === calFilter : true;
    return matchSearch && matchDate;
  });

  return (
    <div className="ann-wrapper">
      <SidebarSuper activePage="announcements" />
      <div className="ann-main">
        <div className="ann-body">
          <div className="ann-left-panel">
            <h2 className="ann-left-heading">Announcements</h2>
            {calFilter && <div className="ann-filter-badge"><FaCalendarAlt /> {formatDisplay(dateKeyToMs(calFilter))}</div>}
            <div className="ann-list">
              {loading ? <div className="ann-loading-center"><FaSpinner className="ann-spinner" /></div>
                : filtered.length === 0 ? <p className="ann-empty-text">No announcements.</p>
                : filtered.map(ann => {
                  const isActive = selected?.id === ann.id;
                  return (
                    <button key={ann.id} className={`ann-item-btn ${isActive ? "active" : ""}`} onClick={() => { setSelected(ann); setActiveTab("details"); }}>
                      <div className="ann-item-content">
                        <span className="ann-item-label">{ann.title}</span>
                        <span className="ann-item-date">{formatShort(ann.date)}</span>
                      </div>
                      {isActive ? <FaChevronUp className="ann-chevron" /> : <FaChevronDown className="ann-chevron" />}
                    </button>
                  );
                })}
            </div>
            <button className="ann-fab" onClick={() => setShowAddModal(true)} title="New Announcement"><FaPlus /></button>
            <MiniCalendar announcements={announcements} selectedDate={calFilter} onSelectDate={setCalFilter} />
          </div>

          <div className="ann-right-panel">
            {loading ? <div className="ann-loading-center" style={{ paddingTop: 80 }}><FaSpinner className="ann-spinner ann-spinner-lg" /></div>
              : selected ? (
                <div className="ann-detail-wrap">
                  <div className="ann-detail-toprow">
                    <div className="ann-detail-meta">
                      <span className="ann-detail-date-label"><FaCalendarAlt className="ann-detail-date-icon" />{formatDisplay(selected.date)}</span>
                      <SourceBadge source={selected.source} />
                    </div>
                    <div className="ann-detail-action-btns">
                      <button className="ann-edit-icon-btn" onClick={() => setEditTarget(selected)}><FaEdit /></button>
                      <button className="ann-delete-icon-btn" onClick={() => setDeleteTarget(selected)}><FaTrash /></button>
                    </div>
                  </div>
                  <h2 className="ann-detail-title">{selected.title}</h2>
                  <div className="ann-detail-body">
                    {selected.imageURL && <div className="ann-detail-img-wrap"><img src={selected.imageURL} alt={selected.title} className="ann-detail-img" /></div>}
                    <p className="ann-detail-text">{selected.description || "No description provided."}</p>
                  </div>
                </div>
              ) : (
                <div className="ann-detail-empty">
                  <FaBullhorn className="ann-empty-icon" />
                  <p>Select an announcement to view details</p>
                  <button className="ann-add-first-btn" onClick={() => setShowAddModal(true)}><FaPlus /> New Announcement</button>
                </div>
              )}
          </div>
        </div>
      </div>

      {showAddModal && <AnnouncementModal onClose={() => setShowAddModal(false)} onSave={handleAdd} />}
      {editTarget && <AnnouncementModal initial={editTarget} onClose={() => setEditTarget(null)} onSave={handleEdit} />}
      {deleteTarget && <DeleteConfirmModal title={deleteTarget.title} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />}
    </div>
  );
}