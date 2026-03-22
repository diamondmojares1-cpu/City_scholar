// Scholars.jsx
import React, { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import {
  FaArchive, FaFileAlt, FaExternalLinkAlt,
  FaUser, FaGraduationCap, FaMoneyBillWave, FaFolder,
  FaExclamationTriangle, FaArrowUp, FaCheckCircle,
} from "react-icons/fa";
import {
  collection, getDocs, doc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "../css/Scholars.css";

// ─────────────────────────────────────────────────────────────
// Archive Confirm Modal
// ─────────────────────────────────────────────────────────────
function ConfirmModal({ scholar, onConfirm, onCancel }) {
  if (!scholar) return null;
  return (
    <div className="sa-confirm-overlay" onClick={onCancel}>
      <div className="sa-confirm-box" onClick={e => e.stopPropagation()}>
        <div className="sa-confirm-icon"><FaExclamationTriangle /></div>
        <h3 className="sa-confirm-title">Archive Scholar?</h3>
        <p className="sa-confirm-msg">
          You are about to archive <strong>{scholar.fullName}</strong>.<br />
          They will be moved to the Archives page and removed from the Scholars list.
        </p>
        <div className="sa-confirm-btns">
          <button className="sa-confirm-no" onClick={onCancel}>No, Cancel</button>
          <button className="sa-confirm-yes" onClick={onConfirm}>Yes, Archive</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Promote Confirm Modal
// ─────────────────────────────────────────────────────────────
function PromoteModal({ scholar, onConfirm, onCancel }) {
  if (!scholar) return null;
  return (
    <div className="sa-confirm-overlay" onClick={onCancel}>
      <div className="sa-confirm-box" onClick={e => e.stopPropagation()}>
        <div className="sa-confirm-icon sa-promote-icon"><FaArrowUp /></div>
        <h3 className="sa-confirm-title">Promote Scholar?</h3>
        <p className="sa-confirm-msg">
          You are about to promote <strong>{scholar.fullName}</strong> to <strong>Old Scholar</strong>.<br /><br />
          After promotion, they will be moved to the <strong>Old Scholars</strong> tab and will be able to access the <strong>Renewal page</strong>.
        </p>
        <div className="sa-confirm-btns">
          <button className="sa-confirm-no" onClick={onCancel}>No, Cancel</button>
          <button className="sa-confirm-yes sa-confirm-promote" onClick={onConfirm}>
            <FaArrowUp /> Yes, Promote
          </button>
        </div>
      </div>
    </div>
  );
}

// Bulk promote modal
function BulkPromoteModal({ count, onConfirm, onCancel, loading }) {
  return (
    <div className="sa-confirm-overlay" onClick={onCancel}>
      <div className="sa-confirm-box" onClick={e => e.stopPropagation()}>
        <div className="sa-confirm-icon sa-promote-icon"><FaArrowUp /></div>
        <h3 className="sa-confirm-title">Promote Selected?</h3>
        <p className="sa-confirm-msg">
          You are about to promote <strong>{count}</strong> scholar{count !== 1 ? "s" : ""} to <strong>Old Scholar</strong>.<br /><br />
          They will move to <strong>Old Scholars</strong> and gain <strong>Renewal access</strong>.
        </p>
        <div className="sa-confirm-btns">
          <button className="sa-confirm-no" onClick={onCancel} disabled={loading}>No, Cancel</button>
          <button className="sa-confirm-yes sa-confirm-promote" onClick={onConfirm} disabled={loading}>
            <FaArrowUp /> {loading ? "Promoting…" : "Yes, Promote All"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = ((status || "pending") + "").toLowerCase();
  const map = {
    approved:  { label: "Approved",  cls: "sa-badge-approved"  },
    rejected:  { label: "Rejected",  cls: "sa-badge-rejected"  },
    pending:   { label: "Pending",   cls: "sa-badge-pending"   },
    reviewing: { label: "Reviewing", cls: "sa-badge-reviewing" },
  };
  const item = map[s] || map["pending"];
  return <span className={"sa-badge " + item.cls}>{item.label}</span>;
}

function DocLink({ href, label }) {
  if (!href) return (
    <div className="sa-doc-row sa-doc-missing-row">
      <FaFileAlt className="sa-doc-icon" />
      <span className="sa-doc-label">{label}</span>
      <span className="sa-doc-missing-tag">Not submitted</span>
    </div>
  );
  return (
    <a href={href} target="_blank" rel="noreferrer" className="sa-doc-row sa-doc-link-row">
      <FaFileAlt className="sa-doc-icon" />
      <span className="sa-doc-label">{label}</span>
      <FaExternalLinkAlt className="sa-doc-ext-icon" />
    </a>
  );
}

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
    <div className="sa-section-header">
      <Icon className="sa-section-icon" />
      <span className="sa-section-title">{title}</span>
    </div>
  );
}

function getRawStatus(raw) {
  return (
    raw.status ||
    raw.applicationStatus ||
    raw.scholarshipStatus ||
    raw.renewalStatus ||
    raw.approvalStatus ||
    ""
  ).toString().toLowerCase().trim();
}

function getApplicantType(raw, eduInfo) {
  return (
    raw.applicantType ||
    eduInfo?.applicantType ||
    raw.type ||
    ""
  ).toString().trim();
}

function parseApplication(docSnap) {
  const data      = docSnap.data();
  const personal  = data.personalInfo  || {};
  const edu       = data.educationInfo || {};
  const financial = data.financialInfo || {};
  const docs      = data.documents     || {};

  const firstName = personal.firstName || data.firstName || (data.name || "").split(" ")[0] || "";
  const lastName  = personal.lastName  || data.lastName  || (data.name || "").split(" ").slice(1).join(" ") || "";

  return {
    id:            docSnap.id,
    firstName,
    lastName,
    fullName:      data.name || (firstName + " " + lastName).trim() || "—",
    email:         personal.email         || data.email         || "—",
    contactNumber: personal.contactNumber || data.contactNumber || data.contact || "—",
    dateOfBirth:   personal.dateOfBirth   || data.dateOfBirth   || "—",
    barangay:      personal.barangay      || data.barangay      || "—",
    houseNo:       personal.houseNo       || data.houseNo       || "—",
    middleName:    personal.middleName    || data.middleName     || "—",
    applicantType: getApplicantType(data, edu),
    schoolName:    edu.schoolName    || data.schoolName    || data.school || "—",
    course:        edu.course        || data.course        || "—",
    semester:      edu.semester      || data.semester      || "—",
    yearLevel:     edu.yearLevel     || data.yearLevel     || "—",
    studentId:     edu.studentId     || data.studentId     || "—",
    gwa:           edu.gwa           || data.gwa           || data.gpa   || "—",
    fatherName:       financial.fatherName       || data.fatherName       || "—",
    fatherOccupation: financial.fatherOccupation || data.fatherOccupation || "—",
    fatherIncome:     financial.fatherIncome     || data.fatherIncome     || "—",
    motherName:       financial.motherName       || data.motherName       || "—",
    motherOccupation: financial.motherOccupation || data.motherOccupation || "—",
    motherIncome:     financial.motherIncome     || data.motherIncome     || "—",
    totalIncome:      financial.totalIncome      || financial.annualIncome || data.totalIncome || "—",
    coeUrl:       docs.coeUrl       || data.coeUrl       || "",
    gradesUrl:    docs.gradesUrl    || data.gradesUrl    || "",
    indigencyUrl: docs.indigencyUrl || data.indigencyUrl || "",
    itrUrl:       docs.itrUrl       || data.itrUrl       || "",
    residencyUrl: docs.residencyUrl || data.residencyUrl || "",
    photoUrl:     docs.photoUrl     || data.photoUrl     || "",
    birthCertUrl: docs.birthCertUrl || data.birthCertUrl || "",
    goodMoralUrl: docs.goodMoralUrl || data.goodMoralUrl || "",
    validIdUrl:   docs.validIdUrl   || data.validIdUrl   || "",
    status:        getRawStatus(data),
    submittedAt:   data.submittedAt || data.createdAt || data.dateSubmitted || 0,
    promoted:      data.promoted    || false,
    renewalAccess: data.renewalAccess || false,
    userId:        data.userId || data.uid || docSnap.id,
    _raw:          data,
  };
}

function isReturningApplicant(applicantType) {
  const t = (applicantType || "").toLowerCase().trim();
  return t.includes("returning") || t.includes("renewal") || t.includes("renewing") || t.includes("old");
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
function Scholars({ SidebarComponent = Sidebar }) {
  const [newScholars,    setNewScholars]    = useState([]);
  const [oldScholars,    setOldScholars]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [activeTab,      setActiveTab]      = useState("new");
  const [selected,       setSelected]       = useState(null);
  const [archiving,      setArchiving]      = useState(null);
  const [promoting,      setPromoting]      = useState(null);
  const [confirmTarget,  setConfirmTarget]  = useState(null);
  const [promoteTarget,  setPromoteTarget]  = useState(null);
  const [promoteSuccess, setPromoteSuccess] = useState(null);
  const [checkedIds,     setCheckedIds]     = useState(new Set());
  const [showBulkModal,  setShowBulkModal]  = useState(false);
  const [bulkPromoting,  setBulkPromoting]  = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [appSnap, renewalSnap] = await Promise.all([
          getDocs(collection(db, "scholarship_applications")),
          getDocs(collection(db, "scholar_renewals")),
        ]);

        const newList = [];
        const oldList = [];

        appSnap.docs.forEach(docSnap => {
          const raw = docSnap.data();
          if (raw.archived === true) return;
          const status = getRawStatus(raw);
          if (status !== "approved") return;

          const app = parseApplication(docSnap);
          app.sourceCollection = "scholarship_applications";

          if (isReturningApplicant(app.applicantType) || raw.promoted === true) {
            oldList.push(app);
          } else {
            newList.push(app);
          }
        });

        renewalSnap.docs.forEach(docSnap => {
          const raw = docSnap.data();
          if (raw.archived === true) return;
          const status = getRawStatus(raw);
          if (status !== "approved") return;

          const app = parseApplication(docSnap);
          app.sourceCollection = "scholar_renewals";
          if (!app.applicantType || app.applicantType === "—") {
            app.applicantType = "Returning Applicant";
          }
          oldList.push(app);
        });

        newList.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
        oldList.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

        setNewScholars(newList);
        setOldScholars(oldList);
      } catch (err) {
        console.error("Failed to load scholars:", err);
        setError("Failed to load scholars. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const currentList = activeTab === "new" ? newScholars : oldScholars;

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return currentList;
    return currentList.filter(a =>
      (a.fullName   || "").toLowerCase().includes(q) ||
      (a.course     || "").toLowerCase().includes(q) ||
      (a.semester   || "").toLowerCase().includes(q) ||
      (a.schoolName || "").toLowerCase().includes(q)
    );
  }, [currentList, searchQuery]);

  useEffect(() => { setCheckedIds(new Set()); }, [activeTab]);

  // selection helpers
  const allFilteredIds = filtered.map(a => a.id);
  const allChecked     = allFilteredIds.length > 0 && allFilteredIds.every(id => checkedIds.has(id));
  const someChecked    = allFilteredIds.some(id => checkedIds.has(id));
  const checkedCount   = allFilteredIds.filter(id => checkedIds.has(id)).length;

  function toggleAll() {
    const next = new Set(checkedIds);
    if (allChecked) {
      allFilteredIds.forEach(id => next.delete(id));
    } else {
      allFilteredIds.forEach(id => next.add(id));
    }
    setCheckedIds(next);
  }

  function toggleOne(id) {
    const next = new Set(checkedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setCheckedIds(next);
  }

  // ── Archive ───────────────────────────────────────────────
  function requestArchive(scholar) { setConfirmTarget(scholar); }

  async function doArchive() {
    const scholar = confirmTarget;
    setConfirmTarget(null);
    setArchiving(scholar.id);
    try {
      await setDoc(doc(db, "archives", scholar.id), {
        ...scholar._raw,
        archivedAt:       serverTimestamp(),
        sourceCollection: scholar.sourceCollection,
        originalId:       scholar.id,
        archived:         true,
      });
      await updateDoc(doc(db, scholar.sourceCollection, scholar.id), { archived: true });
      if (activeTab === "new") setNewScholars(prev => prev.filter(s => s.id !== scholar.id));
      else setOldScholars(prev => prev.filter(s => s.id !== scholar.id));
      if (selected?.id === scholar.id) setSelected(null);
    } catch (err) {
      console.error("Archive error:", err);
      alert("Failed to archive. Please try again.");
    } finally {
      setArchiving(null);
    }
  }

  // ── Promote ───────────────────────────────────────────────
  function requestPromote(scholar) { setPromoteTarget(scholar); }

  async function promoteSingle(scholar) {
    await updateDoc(doc(db, scholar.sourceCollection, scholar.id), {
      promoted:      true,
      renewalAccess: true,
      applicantType: "Returning Applicant",
      promotedAt:    serverTimestamp(),
    });

    const userId = scholar.userId;
    const targetId = userId || scholar.id;
    if (targetId) {
      try {
        await updateDoc(doc(db, "users", targetId), {
          renewalAccess: true,
          promoted:      true,
        });
      } catch (_) {}
    }

    const promoted = {
      ...scholar,
      promoted:      true,
      renewalAccess: true,
      applicantType: "Returning Applicant",
    };
    setNewScholars(prev => prev.filter(s => s.id !== scholar.id));
    setOldScholars(prev => [promoted, ...prev]);
  }

  async function doPromote() {
    const scholar = promoteTarget;
    setPromoteTarget(null);
    setPromoting(scholar.id);
    try {
      await promoteSingle(scholar);
      if (selected?.id === scholar.id) setSelected(null);
      setPromoteSuccess(scholar.fullName);
      setTimeout(() => setPromoteSuccess(null), 3500);
    } catch (err) {
      console.error("Promote error:", err);
      alert("Failed to promote. Please try again.");
    } finally {
      setPromoting(null);
    }
  }

  async function doBulkPromote() {
    const toPromote = newScholars.filter(s => checkedIds.has(s.id));
    if (toPromote.length === 0) return;
    setBulkPromoting(true);
    try {
      for (const s of toPromote) {
        await promoteSingle(s);
      }
      setCheckedIds(new Set());
      setShowBulkModal(false);
      setPromoteSuccess(`${toPromote.length} scholar${toPromote.length !== 1 ? "s" : ""} promoted`);
      setTimeout(() => setPromoteSuccess(null), 3500);
    } catch (err) {
      console.error("Bulk promote error:", err);
      alert("Some scholars could not be promoted. Please try again.");
    } finally {
      setBulkPromoting(false);
    }
  }

  return (
    <div className="sa-container">
      <SidebarComponent activePage="scholars" />

      <main className="sa-main">
        {error && <div className="sa-error-banner">{error}</div>}

        {promoteSuccess && (
          <div className="sa-promote-toast">
            <FaCheckCircle className="sa-toast-icon" />
            <span>
              <strong>{promoteSuccess}</strong> promoted to Old Scholar! Renewal access granted.
            </span>
          </div>
        )}

        <div className="sa-table-card">
          <div className="sa-table-header">
            <div>
              <h2 className="sa-table-title">Scholars</h2>
              <p className="sa-table-sub">View all approved and renewing scholars</p>
            </div>

            <div className="sa-header-right">
              {/* Floating action bar — only visible when something is checked */}
              {activeTab === "new" && checkedCount > 0 && (
                <div className="sa-float-actions">
                  <span className="sa-float-count">{checkedCount} selected</span>
                  <button
                    className="sa-btn sa-btn-promote"
                    onClick={() => setShowBulkModal(true)}
                    disabled={bulkPromoting}
                  >
                    <FaArrowUp size={10} />
                    {bulkPromoting ? "Promoting…" : "Promote Selected"}
                  </button>
                  <button
                    className="sa-btn sa-btn-cancel"
                    onClick={() => setCheckedIds(new Set())}
                  >
                    Clear
                  </button>
                </div>
              )}

              {!loading && (
                <span className="sa-count-badge">
                  {filtered.length} record{filtered.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          <div className="sa-tabs-wrap">
            <button
              className={"sa-tab-pill " + (activeTab === "new" ? "sa-tab-pill-active" : "")}
              onClick={() => { setActiveTab("new"); setSearchQuery(""); }}
            >
              <span className="sa-tab-icon">🎓</span>
              New Scholars
              <span className="sa-tab-pill-count">{newScholars.length}</span>
            </button>
            <button
              className={"sa-tab-pill " + (activeTab === "old" ? "sa-tab-pill-active" : "")}
              onClick={() => { setActiveTab("old"); setSearchQuery(""); }}
            >
              <span className="sa-tab-icon">🔄</span>
              Old Scholars
              <span className="sa-tab-pill-count">{oldScholars.length}</span>
            </button>
          </div>

          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  {activeTab === "new" && (
                    <th className="sa-th-check">
                      <input
                        type="checkbox"
                        className="sa-checkbox"
                        checked={allChecked}
                        ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                        onChange={toggleAll}
                        title="Select all"
                      />
                    </th>
                  )}
                  <th>Scholar Name</th>
                  <th>Type</th>
                  <th>School</th>
                  <th>Course</th>
                  <th>Semester</th>
                  <th>Year</th>
                  <th>GWA</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={activeTab === "new" ? 9 : 8} className="sa-empty">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === "new" ? 9 : 8} className="sa-empty">
                      {searchQuery
                        ? "No results found."
                        : activeTab === "new"
                          ? "No approved new scholars yet."
                          : "No approved returning scholars yet."}
                    </td>
                  </tr>
                ) : (
                  filtered.map(a => (
                    <tr key={a.id} className="sa-tr">
                      {activeTab === "new" && (
                        <td className="sa-td-check">
                          <input
                            type="checkbox"
                            className="sa-checkbox"
                            checked={checkedIds.has(a.id)}
                            onChange={() => toggleOne(a.id)}
                          />
                        </td>
                      )}
                      <td className="sa-td-name">{a.fullName}</td>
                      <td>
                        <span className={`sa-type-badge ${isReturningApplicant(a.applicantType) || a.promoted ? "returning" : "new"}`}>
                          {a.applicantType || "New"}
                        </span>
                      </td>
                      <td>{a.schoolName}</td>
                      <td>{a.course}</td>
                      <td>{a.semester || "—"}</td>
                      <td>{a.yearLevel}</td>
                      <td>{a.gwa}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        <div className="sa-action-btns">
                          <button className="sa-btn sa-btn-view" onClick={() => setSelected(a)}>
                            View
                          </button>
                          {activeTab === "new" && (
                            <button
                              className="sa-btn sa-btn-promote"
                              onClick={() => requestPromote(a)}
                              disabled={promoting === a.id}
                              title="Promote to Old Scholar & grant renewal access"
                            >
                              <FaArrowUp size={10} />
                              {promoting === a.id ? "…" : "Promote"}
                            </button>
                          )}
                          <button
                            className="sa-btn sa-btn-archive"
                            onClick={() => requestArchive(a)}
                            disabled={archiving === a.id}
                          >
                            <FaArchive size={11} />
                            {archiving === a.id ? "…" : "Archive"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <ConfirmModal
        scholar={confirmTarget}
        onConfirm={doArchive}
        onCancel={() => setConfirmTarget(null)}
      />

      <PromoteModal
        scholar={promoteTarget}
        onConfirm={doPromote}
        onCancel={() => setPromoteTarget(null)}
      />

      {showBulkModal && (
        <BulkPromoteModal
          count={checkedCount}
          onConfirm={doBulkPromote}
          onCancel={() => !bulkPromoting && setShowBulkModal(false)}
          loading={bulkPromoting}
        />
      )}

      {selected && (
        <div className="sa-overlay" onClick={() => setSelected(null)}>
          <div className="sa-modal" onClick={e => e.stopPropagation()}>

            <div className="sa-modal-header">
              <div className="sa-modal-avatar">
                {(selected.firstName?.[0] || "?").toUpperCase()}
                {(selected.lastName?.[0]  || "").toUpperCase()}
              </div>
              <div className="sa-modal-header-info">
                <h2 className="sa-modal-name">{selected.fullName}</h2>
                <p className="sa-modal-subtitle">{selected.course} · {selected.schoolName}</p>
              </div>
              <div className="sa-modal-header-right">
                <StatusBadge status={selected.status} />
                {selected.renewalAccess && (
                  <span className="sa-renewal-access-badge">
                    <FaCheckCircle /> Renewal Access
                  </span>
                )}
                <button className="sa-modal-close" onClick={() => setSelected(null)}>×</button>
              </div>
            </div>

            <div className="sa-modal-body">
              <div className="sa-modal-section">
                <SectionHeader icon={FaUser} title="Personal Information" />
                <div className="sa-info-grid">
                  <InfoField label="First Name"    value={selected.firstName} />
                  <InfoField label="Middle Name"   value={selected.middleName} />
                  <InfoField label="Last Name"     value={selected.lastName} />
                  <InfoField label="Email"         value={selected.email} />
                  <InfoField label="Contact No."   value={selected.contactNumber} />
                  <InfoField label="Date of Birth" value={selected.dateOfBirth} />
                  <InfoField label="Barangay"      value={selected.barangay} />
                  <InfoField label="House No."     value={selected.houseNo} />
                </div>
              </div>

              <div className="sa-modal-section">
                <SectionHeader icon={FaGraduationCap} title="Education Information" />
                <div className="sa-info-grid">
                  <InfoField label="Applicant Type" value={selected.applicantType} />
                  <InfoField label="Course"         value={selected.course} />
                  <InfoField label="GWA"            value={selected.gwa} />
                  <InfoField label="School Name"    value={selected.schoolName} />
                  <InfoField label="Semester"       value={selected.semester} />
                  <InfoField label="Student ID"     value={selected.studentId} />
                  <InfoField label="Year Level"     value={selected.yearLevel} />
                </div>
              </div>

              <div className="sa-modal-section">
                <SectionHeader icon={FaMoneyBillWave} title="Financial Information" />
                <div className="sa-info-grid">
                  <InfoField label="Father's Name"       value={selected.fatherName} />
                  <InfoField label="Father's Occupation" value={selected.fatherOccupation} />
                  <InfoField label="Father's Income"     value={selected.fatherIncome} />
                  <InfoField label="Mother's Name"       value={selected.motherName} />
                  <InfoField label="Mother's Occupation" value={selected.motherOccupation} />
                  <InfoField label="Mother's Income"     value={selected.motherIncome} />
                  <InfoField label="Total Family Income" value={selected.totalIncome} />
                </div>
              </div>

              <div className="sa-modal-section">
                <SectionHeader icon={FaFolder} title="Submitted Documents" />
                <div className="sa-docs-list">
                  <DocLink href={selected.coeUrl}       label="Certificate of Enrollment (COE)" />
                  <DocLink href={selected.gradesUrl}    label="Grades / Transcript" />
                  <DocLink href={selected.indigencyUrl} label="Certificate of Indigency" />
                  <DocLink href={selected.itrUrl}       label="Income Tax Return (ITR)" />
                  <DocLink href={selected.residencyUrl} label="Certificate of Residency" />
                  <DocLink href={selected.goodMoralUrl} label="Good Moral Certificate" />
                  <DocLink href={selected.validIdUrl}   label="Valid ID" />
                </div>
              </div>
            </div>

            <div className="sa-modal-footer">
              {!isReturningApplicant(selected.applicantType) && !selected.promoted && (
                <button
                  className="sa-btn sa-btn-promote"
                  onClick={() => { setSelected(null); requestPromote(selected); }}
                  disabled={promoting === selected.id}
                >
                  <FaArrowUp size={13} />
                  {promoting === selected.id ? "Promoting…" : "Promote to Old Scholar"}
                </button>
              )}
              <button
                className="sa-btn sa-btn-archive"
                onClick={() => { setSelected(null); requestArchive(selected); }}
                disabled={archiving === selected.id}
              >
                <FaArchive size={13} />
                {archiving === selected.id ? "Archiving…" : "Archive Scholar"}
              </button>
              <button className="sa-btn sa-btn-cancel" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Scholars;
