import { useEffect, useMemo, useState } from "react";
import {
  FaSearch,
  FaChevronLeft, FaChevronRight,
  FaTimes, FaCheckCircle, FaTimesCircle,
  FaFileAlt, FaExternalLinkAlt, FaSpinner,
  FaUser, FaGraduationCap, FaFolder,
  FaLock, FaLockOpen,
} from "react-icons/fa";
import Sidebar from "../components/Sidebar.jsx";
import {
  fetchAllRenewals,
  updateRenewalStatus,
  getRenewalStatusLabel,
  getRenewalStatusClass,
} from "../utils/renewalDataFetch.js";
import { db } from "../firebase/firebaseConfig.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import "../css/Renewal.css";

const PAGE_SIZE = 12;

function formatCount(n) {
  return n >= 1000 ? n.toLocaleString() : String(n);
}

function getInitials(name = "") {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function resolveDocuments(scholar) {
  if (!scholar) return [];
  const urlFields = [
    { label: "Certificate of Enrollment", key: "coeUrl"       },
    { label: "Grades / TOR",              key: "gradesUrl"    },
    { label: "Certificate of Indigency",  key: "indigencyUrl" },
    { label: "ITR",                       key: "itrUrl"       },
    { label: "Residency Certificate",     key: "residencyUrl" },
    { label: "ID Photo",                  key: "photoUrl"     },
    { label: "Birth Certificate",         key: "birthCertUrl" },
    { label: "Good Moral Certificate",    key: "goodMoralUrl" },
    { label: "Valid ID",                  key: "validIdUrl"   },
  ];
  return urlFields
    .filter(item => scholar[item.key] && typeof scholar[item.key] === "string" && scholar[item.key].startsWith("http"))
    .map(item => ({ label: item.label, url: scholar[item.key] }));
}

// ── Toggle Confirm Modal ──────────────────────────────────────
function ToggleConfirmModal({ renewalOpen, onConfirm, onCancel, loading }) {
  return (
    <div className="rnw-overlay" onClick={onCancel}>
      <div className="rnw-toggle-modal" onClick={e => e.stopPropagation()}>
        <div className={`rnw-toggle-icon-wrap ${renewalOpen ? "closing" : "opening"}`}>
          {renewalOpen ? <FaLock /> : <FaLockOpen />}
        </div>
        <h3 className="rnw-toggle-title">
          {renewalOpen ? "Close Renewal Submissions?" : "Open Renewal Submissions?"}
        </h3>
        <p className="rnw-toggle-msg">
          {renewalOpen
            ? "Students will no longer be able to submit renewal applications until you re-enable it."
            : "Students will be able to submit their renewal applications once enabled."}
        </p>
        <div className="rnw-toggle-btns">
          <button className="rnw-footer-cancel" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={`rnw-footer-submit ${renewalOpen ? "danger" : ""}`} onClick={onConfirm} disabled={loading}>
            {loading
              ? <><FaSpinner className="rnw-spin" /> Saving…</>
              : renewalOpen ? "Yes, Close It" : "Yes, Open It"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reusable sub-components ───────────────────────────────────
function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="rnw-modal-section-header">
      <Icon className="rnw-modal-section-icon" />
      <span className="rnw-modal-section-title">{title}</span>
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div className="rnw-info-field">
      <span className="rnw-info-label">{label}</span>
      <span className="rnw-info-value">{value || "—"}</span>
    </div>
  );
}

// ── Doc Row — Open only ─────────────────────────────────────
function DocRow({ label, url }) {
  if (!url) return (
    <div className="rnw-doc-row rnw-doc-row--missing">
      <FaFileAlt className="rnw-doc-row-icon" />
      <span className="rnw-doc-row-label">{label}</span>
      <span className="rnw-doc-missing-tag">Not submitted</span>
    </div>
  );

  return (
    <div className="rnw-doc-row rnw-doc-row--present">
      <FaFileAlt className="rnw-doc-row-icon" />
      <span className="rnw-doc-row-label">{label}</span>
      <a href={url} target="_blank" rel="noreferrer" className="rnw-doc-open-btn">
        Open <FaExternalLinkAlt size={9} />
      </a>
    </div>
  );
}

// ── View Documents Modal ──────────────────────────────────────
function ViewDocumentsModal({ scholar, onClose, onApprove, onReject }) {
  const [selectedAction, setSelectedAction] = useState("");
  const [actionLoading,  setActionLoading]  = useState(false);
  const [success,        setSuccess]        = useState(false);
  const [actionError,    setActionError]    = useState(null);
  const [currentStatus,  setCurrentStatus]  = useState(scholar.status);

  const documents = resolveDocuments(scholar);

  async function handleSubmit() {
    if (!selectedAction) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (selectedAction === "approve") await onApprove(scholar);
      else await onReject(scholar);
      setCurrentStatus(selectedAction === "approve" ? "approved" : "rejected");
      setSuccess(true);
      setSelectedAction("");
    } catch (err) {
      setActionError("Failed to update. Please try again.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="rnw-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rnw-modal">

        {/* Header — dark navy */}
        <div className="rnw-modal-head">
          <div className="rnw-modal-avatar">{getInitials(scholar.name)}</div>
          <div className="rnw-modal-head-info">
            <h2>{scholar.name || "—"}</h2>
            <p>{scholar.course || "—"} · {scholar.school || "—"}</p>
          </div>
          <div className="rnw-modal-head-right">
            <span className={`renewals-badge ${getRenewalStatusClass(currentStatus)}`}>
              {getRenewalStatusLabel(currentStatus)}
            </span>
            <button className="rnw-modal-close-btn" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="rnw-modal-body">

          {/* Scholar Information */}
          <div className="rnw-modal-section">
            <SectionHeader icon={FaUser} title="Scholar Information" />
            <div className="rnw-info-grid-2col">
              <InfoField label="Full Name"      value={scholar.name} />
              <InfoField label="Email"          value={scholar.email} />
              <InfoField label="Contact"        value={scholar.contactNumber} />
              <InfoField label="Barangay"       value={scholar.barangay} />
              <InfoField label="Student ID"     value={scholar.studentId} />
              <InfoField label="Date Submitted" value={scholar.dateSubmitted} />
            </div>
          </div>

          {/* Education Information */}
          <div className="rnw-modal-section">
            <SectionHeader icon={FaGraduationCap} title="Education Information" />
            <div className="rnw-info-grid-2col">
              <InfoField label="School"     value={scholar.school} />
              <InfoField label="Semester"   value={scholar.semester || "—"} />
              <InfoField label="Course"     value={scholar.course} />
              <InfoField label="Year Level" value={scholar.yearLevel} />
              <InfoField label="GPA / GWA"  value={scholar.gpa} />
            </div>
          </div>

          {/* Submitted Documents */}
          <div className="rnw-modal-section">
            <SectionHeader icon={FaFolder} title="Submitted Documents" />
            {documents.length === 0 ? (
              <p className="rnw-no-docs">No documents uploaded yet.</p>
            ) : (
              <div className="rnw-docs-list">
                {documents.map((d, i) => (
                  <DocRow key={i} label={d.label} url={d.url} />
                ))}
              </div>
            )}
          </div>

          {/* Application Decision */}
          <div className="rnw-modal-section rnw-decision-section">
            <SectionHeader icon={FaCheckCircle} title="Application Decision" />
            <p className="rnw-decision-hint">
              Select a decision below. Click <strong>Submit</strong> to save,
              or <strong>Cancel</strong> to keep the current status unchanged.
            </p>
            <div className="rnw-radio-group">
              <label className={`rnw-radio-card rnw-radio-approve ${selectedAction === "approve" ? "rnw-active-approve" : ""}`}>
                <input type="radio" name="rnw-decision" value="approve"
                  checked={selectedAction === "approve"}
                  onChange={() => { setSelectedAction("approve"); setSuccess(false); }} />
                <FaCheckCircle className="rnw-radio-icon rnw-icon-approve" />
                <div className="rnw-radio-text">
                  <span className="rnw-radio-label">Approve</span>
                  <span className="rnw-radio-desc">Grant renewal to scholar</span>
                </div>
              </label>
              <label className={`rnw-radio-card rnw-radio-reject ${selectedAction === "reject" ? "rnw-active-reject" : ""}`}>
                <input type="radio" name="rnw-decision" value="reject"
                  checked={selectedAction === "reject"}
                  onChange={() => { setSelectedAction("reject"); setSuccess(false); }} />
                <FaTimesCircle className="rnw-radio-icon rnw-icon-reject" />
                <div className="rnw-radio-text">
                  <span className="rnw-radio-label">Reject</span>
                  <span className="rnw-radio-desc">Decline this renewal</span>
                </div>
              </label>
            </div>
            {success && (
              <div className="rnw-alert rnw-alert-success">
                ✅ Status updated successfully! The student can now see the update.
              </div>
            )}
            {actionError && (
              <div className="rnw-alert rnw-alert-error">❌ {actionError}</div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="rnw-modal-footer-bar">
          <button className="rnw-footer-cancel" onClick={onClose} disabled={actionLoading}>
            Cancel
          </button>
          <button className="rnw-footer-submit" onClick={handleSubmit} disabled={!selectedAction || actionLoading}>
            {actionLoading ? <><FaSpinner className="rnw-spin" /> Submitting…</> : "Submit Decision"}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
function Renewals({ SidebarComponent = Sidebar, activePage = "renewals" }) {
  const [loading,         setLoading]         = useState(true);
  const [rows,            setRows]            = useState([]);
  const [searchQuery,     setSearchQuery]     = useState("");
  const [currentPage,     setCurrentPage]     = useState(1);
  const [error,           setError]           = useState(null);
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [counts,          setCounts]          = useState({ total: 0, approved: 0, rejected: 0, missing: 0 });
  const [renewalOpen,     setRenewalOpen]     = useState(false);
  const [toggleLoading,   setToggleLoading]   = useState(true);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [activeTab,       setActiveTab]       = useState("new"); // new=pending/reviewing/missing, old=approved

  useEffect(() => {
    async function loadToggle() {
      try {
        const snap = await getDoc(doc(db, "settings", "renewal"));
        setRenewalOpen(snap.exists() ? snap.data().isOpen === true : false);
      } catch (err) {
        console.error("Failed to load renewal toggle:", err);
      } finally {
        setToggleLoading(false);
      }
    }
    loadToggle();
  }, []);

  async function handleToggleConfirm() {
    setToggleLoading(true);
    try {
      const newValue = !renewalOpen;
      await setDoc(doc(db, "settings", "renewal"), { isOpen: newValue }, { merge: true });
      setRenewalOpen(newValue);
      setShowConfirm(false);
    } catch (err) {
      console.error("Failed to update renewal toggle:", err);
    } finally {
      setToggleLoading(false);
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const renewals = await fetchAllRenewals();
        setRows(renewals);
        setCounts({
          total:    renewals.length,
          approved: renewals.filter(r => (r.status || "").toLowerCase() === "approved").length,
          rejected: renewals.filter(r => (r.status || "").toLowerCase() === "rejected").length,
          missing:  renewals.filter(r => (r.status || "").toLowerCase() === "missing").length,
        });
      } catch (err) {
        console.error("Failed to load renewals:", err);
        setError("Failed to load renewals. Please refresh.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);
  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const base = rows.filter(r => {
      const s = (r.status || "").toLowerCase();
      return activeTab === "new"
        ? !(s === "approved")
        : s === "approved";
    });
    if (!q) return base;
    return base.filter(r =>
      (r.name   || "").toLowerCase().includes(q) ||
      (r.school || "").toLowerCase().includes(q) ||
      (r.semester || "").toLowerCase().includes(q) ||
      (r.course || "").toLowerCase().includes(q) ||
      (r.status || "").toLowerCase().includes(q)
    );
  }, [rows, searchQuery, activeTab]);

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

  async function handleApprove(scholar) {
    await updateRenewalStatus(scholar.id, "approved");
    setRows(prev => prev.map(r => r.id === scholar.id ? { ...r, status: "approved" } : r));
    setCounts(prev => ({ ...prev, approved: prev.approved + 1 }));
  }

  async function handleReject(scholar) {
    await updateRenewalStatus(scholar.id, "rejected");
    setRows(prev => prev.map(r => r.id === scholar.id ? { ...r, status: "rejected" } : r));
    setCounts(prev => ({ ...prev, rejected: prev.rejected + 1 }));
  }

  return (
    <div className="scholars-container_renewals">
      <SidebarComponent activePage={activePage} />
      <main className="scholars-main_renewals">
        <div className="renewals-content-wrap">

          {/* Title + Toggle */}
          <div className="renewals-title-row">
            <h1 className="renewals-page-title">Renewals</h1>
            <button
              className={`rnw-toggle-btn ${renewalOpen ? "open" : "closed"}`}
              onClick={() => setShowConfirm(true)}
              disabled={toggleLoading}
            >
              {toggleLoading ? <FaSpinner className="rnw-spin" />
                : renewalOpen ? <><FaLockOpen /> Renewal Open</> : <><FaLock /> Renewal Closed</>}
            </button>
          </div>

          {!toggleLoading && (
            <div className={`rnw-status-banner ${renewalOpen ? "open" : "closed"}`}>
              {renewalOpen
                ? "✅ Renewal submissions are currently OPEN. Students can submit their renewal applications."
                : "🔒 Renewal submissions are currently CLOSED. Students cannot submit applications right now."}
            </div>
          )}

          {/* Stat Cards */}
          <div className="renewals-cards">
            <div className="renewals-card">
              <span className="renewals-card-number">{loading ? "—" : formatCount(counts.total)}</span>
              <span className="renewals-card-label">Total Renewal Form</span>
            </div>
            <div className="renewals-card">
              <span className="renewals-card-number">{loading ? "—" : formatCount(counts.total - counts.approved)}</span>
              <span className="renewals-card-label">Pending</span>
            </div>
            <div className="renewals-card">
              <span className="renewals-card-number">{loading ? "—" : formatCount(counts.approved)}</span>
              <span className="renewals-card-label">Approved</span>
            </div>
          </div>

          {error && <div className="renewals-error-banner">{error}</div>}

          <div className="renewals-tabs">
            <button
              className={`renewals-tab ${activeTab === "new" ? "active" : ""}`}
              onClick={() => setActiveTab("new")}
            >
              New (Pending) – {filtered.length}
            </button>
            <button
              className={`renewals-tab ${activeTab === "old" ? "active" : ""}`}
              onClick={() => setActiveTab("old")}
            >
              Old (Approved) – {activeTab === "old" ? filtered.length : counts.approved}
            </button>
          </div>

          {/* Table */}
          <div className="renewals-table-card">
            <div className="renewals-search-row">
              <div className="renewals-search-inner">
                <FaSearch size={13} />
                <input
                  type="text"
                  placeholder="Search by name, school, course or status…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <span className="renewals-status-label">Status</span>
            </div>

            <div className="renewals-table-wrap">
              <table className="renewals-table">
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
                    <tr><td colSpan={7} className="renewals-empty">Loading…</td></tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="renewals-empty">
                        {searchQuery ? "No results found." : "No renewal applicants yet."}
                      </td>
                    </tr>
                  ) : (
                    paginated.map(r => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.school}</td>
                        <td>{r.semester || "—"}</td>
                        <td>{r.gpa}</td>
                        <td>{r.dateSubmitted}</td>
                        <td>
                          <span className={`renewals-badge ${getRenewalStatusClass(r.status)}`}>
                            {getRenewalStatusLabel(r.status)}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="renewals-see-more"
                            onClick={() => setSelectedScholar(r)}
                          >
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
              <div className="renewals-pagination">
                <span className="renewals-pagination-info">
                  Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()} Application{filtered.length !== 1 ? "s" : ""}
                </span>
                <div className="renewals-pagination-btns">
                  <button className="renewals-pg-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                    <FaChevronLeft size={10} /> Previous
                  </button>
                  {pageNumbers.map(p => (
                    <button key={p} className={`renewals-pg-btn ${p === currentPage ? "active" : ""}`} onClick={() => goToPage(p)}>
                      {p}
                    </button>
                  ))}
                  <button className="renewals-pg-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next <FaChevronRight size={10} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {selectedScholar && (
        <ViewDocumentsModal
          scholar={selectedScholar}
          onClose={() => setSelectedScholar(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {showConfirm && (
        <ToggleConfirmModal
          renewalOpen={renewalOpen}
          onConfirm={handleToggleConfirm}
          onCancel={() => setShowConfirm(false)}
          loading={toggleLoading}
        />
      )}
    </div>
  );
}

export default Renewals;
