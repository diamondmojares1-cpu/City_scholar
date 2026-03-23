// ScholarshipApplications.jsx
import React, { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import {
  FaSearch, FaTimes, FaFileAlt, FaExternalLinkAlt,
  FaUser, FaGraduationCap, FaFolder,
  FaCheckCircle, FaTimesCircle,
  FaChevronLeft, FaChevronRight, FaEye,
} from "react-icons/fa";
import { fetchScholarshipApplications } from "../services/scholarshipApplicationService.js";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "../css/Scholarapp.css";

const PAGE_SIZE = 12;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function StatusBadge({ status = "pending" }) {
  const s = (status || "pending").toLowerCase();
  const map = {
    approved:  { label: "Approved",      cls: "sa-badge-approved"  },
    rejected:  { label: "Rejected",      cls: "sa-badge-rejected"  },
    pending:   { label: "Pending",       cls: "sa-badge-pending"   },
    reviewing: { label: "For Reviewing", cls: "sa-badge-reviewing" },
    missing:   { label: "Missing",       cls: "sa-badge-missing"   },
  };
  const { label, cls } = map[s] || map["pending"];
  return <span className={`sa-badge ${cls}`}>{label}</span>;
}

// ── DocRow — Open only ──────────────────────────────────────
function DocRow({ href, label }) {
  if (!href) return (
    <div className="sa-doc-row sa-doc-row--missing">
      <FaFileAlt className="sa-doc-row-icon" />
      <span className="sa-doc-row-label">{label}</span>
      <span className="sa-doc-missing-tag">Not submitted</span>
    </div>
  );

  return (
    <div className="sa-doc-row sa-doc-row--present">
      <FaFileAlt className="sa-doc-row-icon" />
      <span className="sa-doc-row-label">{label}</span>
      <a href={href} target="_blank" rel="noreferrer" className="sa-doc-open-btn">
        Open <FaExternalLinkAlt size={9} />
      </a>
    </div>
  );
}

// ── Info Field (card-style like screenshot) ──
function InfoField({ label, value }) {
  return (
    <div className="sa-info-field">
      <span className="sa-info-field-label">{label}</span>
      <span className="sa-info-field-value">{value || "—"}</span>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="sa-modal-section-header">
      <Icon className="sa-modal-section-icon" />
      <span className="sa-modal-section-title">{title}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

function ScholarshipApplications({ SidebarComponent = Sidebar, activePage = "applications" }) {
  const [apps, setApps]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [selected, setSelected]           = useState(null);
  const [showModal, setShowModal]         = useState(false);
  const [currentPage, setCurrentPage]     = useState(1);
  const [pickedStatus, setPickedStatus]   = useState(null);
  const [submitting, setSubmitting]       = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError]     = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchScholarshipApplications();
        setApps(data);
      } catch (err) {
        console.error("Failed to load scholarship applications:", err);
        setError("Failed to load applications. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const stats = useMemo(() => {
    const total    = apps.length;
    const approved = apps.filter(a => (a.status || "").toLowerCase() === "approved").length;
    const rejected = apps.filter(a => (a.status || "").toLowerCase() === "rejected").length;
    const missing  = apps.filter(a => (a.status || "").toLowerCase() === "missing").length;
    return { total, approved, rejected, missing };
  }, [apps]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return apps;
    return apps.filter(a =>
      `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
      (a.course || "").toLowerCase().includes(q) ||
      (a.schoolName || "").toLowerCase().includes(q) ||
      (a.status || "").toLowerCase().includes(q)
    );
  }, [apps, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function goToPage(p) {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
  }

  const pageNumbers = useMemo(() => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end   = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  function openModal(id) {
    const app = apps.find(a => a.id === id);
    setSelected(app || null);
    setPickedStatus(null);
    setSubmitSuccess(false);
    setSubmitError(null);
    setShowModal(true);
  }

  function closeModal() {
    setSelected(null);
    setShowModal(false);
    setPickedStatus(null);
    setSubmitSuccess(false);
    setSubmitError(null);
  }

  async function handleSubmit() {
    if (!selected || !pickedStatus) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await updateDoc(doc(db, "scholarship_applications", selected.id), {
        status: pickedStatus,
        applicationStatus: pickedStatus,
      });
      const userId = selected.userId || selected.id;
      if (userId) {
        try {
          await setDoc(
            doc(db, "users", userId),
            {
              applicationStatus: pickedStatus,
              scholarshipStatus: pickedStatus,
              renewalAccess: false,
              promoted: false,
            },
            { merge: true }
          );
        } catch (e) { console.warn("Could not update users collection:", e); }
      }
      setApps(prev => prev.map(a => a.id === selected.id ? { ...a, status: pickedStatus } : a));
      setSelected(prev => ({ ...prev, status: pickedStatus }));
      setSubmitSuccess(true);
      setPickedStatus(null);
    } catch (err) {
      console.error("Failed to update status:", err);
      setSubmitError("Failed to update status. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="sa-container">
      <SidebarComponent activePage={activePage} />

      <main className="sa-main">
        <h1 className="sa-page-title">Applicants</h1>

        {/* Stat Cards */}
        <div className="sa-cards">
          <div className="sa-card">
            <span className="sa-card-number">{loading ? "—" : stats.total.toLocaleString()}</span>
            <span className="sa-card-label">Total Applications</span>
          </div>
          <div className="sa-card">
            <span className="sa-card-number">{loading ? "—" : stats.approved.toLocaleString()}</span>
            <span className="sa-card-label">Approved</span>
          </div>
          <div className="sa-card">
            <span className="sa-card-number">{loading ? "—" : stats.rejected.toLocaleString()}</span>
            <span className="sa-card-label">Rejected</span>
          </div>
          <div className="sa-card">
            <span className="sa-card-number">{loading ? "—" : stats.missing.toLocaleString()}</span>
            <span className="sa-card-label">Missing Requirements</span>
          </div>
        </div>

        {error && <div className="sa-error-banner">{error}</div>}

        {/* Table Card */}
        <div className="sa-table-card">
          <div className="sa-search-row">
            <div className="sa-search-inner">
              <FaSearch className="sa-search-icon" />
              <input
                placeholder="Search name, school, course…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="sa-status-label">Status</span>
          </div>

          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Scholar Name</th>
                  <th>School</th>
                  <th>Semester</th>
                  <th>GPA</th>
                  <th>Date Submitted</th>
                  <th>Scholarship Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="sa-empty">Loading…</td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={7} className="sa-empty">{searchQuery ? "No results found." : "No applications yet."}</td></tr>
                ) : (
                  paginated.map(a => (
                    <tr key={a.id} className="sa-tr">
                      <td className="sa-td-name">{a.firstName} {a.lastName}</td>
                      <td>{a.schoolName || "—"}</td>
                      <td>{a.semester || a.educationInfo?.semester || "—"}</td>
                      <td>{a.gwa || a.gpa || "—"}</td>
                      <td>
                        {a.submittedAt
                          ? new Date(a.submittedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                          : a.createdAt
                          ? new Date(a.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                          : "—"}
                      </td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        <button className="sa-view-btn" onClick={() => openModal(a.id)}>
                          View Documents
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div className="sa-pagination">
              <span className="sa-pagination-info">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()} Application{filtered.length !== 1 ? "s" : ""}
              </span>
              <div className="sa-pagination-btns">
                <button className="sa-pg-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                  <FaChevronLeft size={10} /> Prev
                </button>
                {pageNumbers.map(p => (
                  <button key={p} className={`sa-pg-btn ${p === currentPage ? "active" : ""}`} onClick={() => goToPage(p)}>
                    {p}
                  </button>
                ))}
                <button className="sa-pg-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                  Next <FaChevronRight size={10} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══════════════════════════════════════════
          MODAL — matching the screenshot design
      ══════════════════════════════════════════ */}
      {showModal && selected && (
        <div className="sa-overlay" onClick={closeModal}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>

            {/* Header — dark navy with avatar */}
            <div className="sa-modal-head">
              <div className="sa-modal-avatar">
                {(selected.firstName?.[0] || "?").toUpperCase()}
                {(selected.lastName?.[0]  || "").toUpperCase()}
              </div>
              <div className="sa-modal-head-info">
                <h2>{selected.firstName} {selected.lastName}</h2>
                <p>{selected.course || "—"} · {selected.schoolName || "—"}</p>
              </div>
              <div className="sa-modal-head-right">
                <StatusBadge status={selected.status} />
                <button className="sa-close-btn" onClick={closeModal}><FaTimes /></button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="sa-modal-body">

              {/* ── Scholar Information ── */}
              <div className="sa-modal-section">
                <SectionHeader icon={FaUser} title="Scholar Information" />
                <div className="sa-info-grid-2col">
                  <InfoField label="Full Name"      value={`${selected.firstName || ""} ${selected.lastName || ""}`.trim()} />
                  <InfoField label="Email"          value={selected.email} />
                  <InfoField label="Contact"        value={selected.contactNumber} />
                  <InfoField label="Barangay"       value={selected.barangay} />
                  <InfoField label="Student ID"     value={selected.studentId} />
                  <InfoField label="Semester"       value={selected.semester || selected.educationInfo?.semester} />
                  <InfoField label="Date Submitted" value={
                    selected.submittedAt
                      ? new Date(selected.submittedAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                      : selected.createdAt
                      ? new Date(selected.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })
                      : "—"
                  } />
                </div>
              </div>

              {/* ── Education Information ── */}
              <div className="sa-modal-section">
                <SectionHeader icon={FaGraduationCap} title="Education Information" />
                <div className="sa-info-grid-2col">
                  <InfoField label="School"     value={selected.schoolName} />
                  <InfoField label="Course"     value={selected.course} />
                  <InfoField label="Year Level" value={selected.yearLevel} />
                  <InfoField label="GPA / GWA"  value={selected.gwa || selected.gpa} />
                </div>
              </div>

              {/* ── Submitted Documents ── */}
              <div className="sa-modal-section">
                <SectionHeader icon={FaFolder} title="Submitted Documents" />
                <div className="sa-docs-list">
                  <DocRow href={selected.coeUrl}       label="Certificate of Enrollment" />
                  <DocRow href={selected.gradesUrl}    label="Grades / TOR" />
                  <DocRow href={selected.indigencyUrl} label="Certificate of Indigency" />
                  <DocRow href={selected.itrUrl}       label="ITR" />
                  <DocRow href={selected.residencyUrl} label="Residency Certificate" />
                  <DocRow href={selected.validIdUrl}   label="Valid ID" />
                </div>
              </div>

              {/* ── Application Decision ── */}
              <div className="sa-modal-section sa-decision-section">
                <SectionHeader icon={FaCheckCircle} title="Application Decision" />
                <p className="sa-decision-hint">
                  Select a decision below. Click <strong>Submit</strong> to save,
                  or <strong>Cancel</strong> to keep the current status unchanged.
                </p>

                <div className="sa-radio-group">
                  <label className={`sa-radio-card sa-radio-approve ${pickedStatus === "approved" ? "sa-radio-active-approve" : ""}`}>
                    <input type="radio" name="status" value="approved"
                      checked={pickedStatus === "approved"}
                      onChange={() => setPickedStatus("approved")} />
                    <FaCheckCircle className="sa-radio-icon" />
                    <div>
                      <span className="sa-radio-label">Approve</span>
                      <span className="sa-radio-desc">Grant renewal to scholar</span>
                    </div>
                  </label>

                  <label className={`sa-radio-card sa-radio-reject ${pickedStatus === "rejected" ? "sa-radio-active-reject" : ""}`}>
                    <input type="radio" name="status" value="rejected"
                      checked={pickedStatus === "rejected"}
                      onChange={() => setPickedStatus("rejected")} />
                    <FaTimesCircle className="sa-radio-icon" />
                    <div>
                      <span className="sa-radio-label">Reject</span>
                      <span className="sa-radio-desc">Decline this renewal</span>
                    </div>
                  </label>
                </div>

                {submitSuccess && (
                  <div className="sa-alert sa-alert-success">
                    ✅ Status updated successfully! The student can now see the update.
                  </div>
                )}
                {submitError && (
                  <div className="sa-alert sa-alert-error">❌ {submitError}</div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="sa-modal-footer">
              <button className="sa-cancel-btn" onClick={() => { setPickedStatus(null); setSubmitError(null); setSubmitSuccess(false); }} disabled={submitting}>
                Cancel
              </button>
              <button className="sa-submit-btn" onClick={handleSubmit} disabled={!pickedStatus || submitting}>
                {submitting ? "Saving…" : "Submit Decision"}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default ScholarshipApplications;
