import React, { useEffect, useMemo, useState } from "react";
import {
  FaArchive,
  FaArrowDown,
  FaArrowUp,
  FaCheckCircle,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaFileAlt,
  FaFolder,
  FaGraduationCap,
  FaMoneyBillWave,
  FaUser,
} from "react-icons/fa";
import Sidebar from "../components/Sidebar";
import "../css/Scholars.css";
import {
  archiveScholarRecord,
  fetchApprovedScholars,
  promoteScholarRecord,
  unpromoteScholarRecord,
} from "../services/scholarService";
import { filterScholars, isReturningApplicant } from "../utils/scholarHelpers";

function ConfirmModal({ scholar, onConfirm, onCancel }) {
  if (!scholar) return null;

  return (
    <div className="sa-confirm-overlay" onClick={onCancel}>
      <div className="sa-confirm-box" onClick={(event) => event.stopPropagation()}>
        <div className="sa-confirm-icon">
          <FaExclamationTriangle />
        </div>
        <h3 className="sa-confirm-title">Archive Scholar?</h3>
        <p className="sa-confirm-msg">
          You are about to archive <strong>{scholar.fullName}</strong>.
          <br />
          They will be moved to the Archives page and removed from the Scholars list.
        </p>
        <div className="sa-confirm-btns">
          <button className="sa-confirm-no" onClick={onCancel}>
            No, Cancel
          </button>
          <button className="sa-confirm-yes" onClick={onConfirm}>
            Yes, Archive
          </button>
        </div>
      </div>
    </div>
  );
}

function PromoteModal({ scholar, onConfirm, onCancel }) {
  if (!scholar) return null;

  return (
    <div className="sa-confirm-overlay" onClick={onCancel}>
      <div className="sa-confirm-box" onClick={(event) => event.stopPropagation()}>
        <div className="sa-confirm-icon sa-promote-icon">
          <FaArrowUp />
        </div>
        <h3 className="sa-confirm-title">Promote Scholar?</h3>
        <p className="sa-confirm-msg">
          You are about to promote <strong>{scholar.fullName}</strong> to{" "}
          <strong>Old Scholar</strong>.
          <br />
          <br />
          After promotion, they will be moved to the <strong>Old Scholars</strong> tab
          and will be able to access the <strong>Renewal page</strong>.
        </p>
        <div className="sa-confirm-btns">
          <button className="sa-confirm-no" onClick={onCancel}>
            No, Cancel
          </button>
          <button className="sa-confirm-yes sa-confirm-promote" onClick={onConfirm}>
            <FaArrowUp /> Yes, Promote
          </button>
        </div>
      </div>
    </div>
  );
}

function BulkPromoteModal({ count, onConfirm, onCancel, loading }) {
  return (
    <div className="sa-confirm-overlay" onClick={onCancel}>
      <div className="sa-confirm-box" onClick={(event) => event.stopPropagation()}>
        <div className="sa-confirm-icon sa-promote-icon">
          <FaArrowUp />
        </div>
        <h3 className="sa-confirm-title">Promote Selected?</h3>
        <p className="sa-confirm-msg">
          You are about to promote <strong>{count}</strong> scholar{count !== 1 ? "s" : ""} to{" "}
          <strong>Old Scholar</strong>.
          <br />
          <br />
          They will move to <strong>Old Scholars</strong> and gain{" "}
          <strong>Renewal access</strong>.
        </p>
        <div className="sa-confirm-btns">
          <button className="sa-confirm-no" onClick={onCancel} disabled={loading}>
            No, Cancel
          </button>
          <button
            className="sa-confirm-yes sa-confirm-promote"
            onClick={onConfirm}
            disabled={loading}
          >
            <FaArrowUp /> {loading ? "Promoting..." : "Yes, Promote All"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnpromoteModal({ scholar, onConfirm, onCancel }) {
  if (!scholar) return null;

  return (
    <div className="sa-confirm-overlay" onClick={onCancel}>
      <div className="sa-confirm-box" onClick={(event) => event.stopPropagation()}>
        <div className="sa-confirm-icon sa-unpromote-icon">
          <FaArrowDown />
        </div>
        <h3 className="sa-confirm-title">Unpromote Scholar?</h3>
        <p className="sa-confirm-msg">
          You are about to move <strong>{scholar.fullName}</strong> back to{" "}
          <strong>New Scholars</strong>.
          <br />
          <br />
          Their <strong>renewal access</strong> will be removed until they are promoted again.
        </p>
        <div className="sa-confirm-btns">
          <button className="sa-confirm-no" onClick={onCancel}>
            No, Cancel
          </button>
          <button className="sa-confirm-yes sa-confirm-unpromote" onClick={onConfirm}>
            <FaArrowDown /> Yes, Unpromote
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const normalized = ((status || "pending") + "").toLowerCase();
  const map = {
    approved: { label: "Approved", cls: "sa-badge-approved" },
    rejected: { label: "Rejected", cls: "sa-badge-rejected" },
    pending: { label: "Pending", cls: "sa-badge-pending" },
    reviewing: { label: "Reviewing", cls: "sa-badge-reviewing" },
  };
  const item = map[normalized] || map.pending;

  return <span className={"sa-badge " + item.cls}>{item.label}</span>;
}

function DocLink({ href, label }) {
  if (!href) {
    return (
      <div className="sa-doc-row sa-doc-missing-row">
        <FaFileAlt className="sa-doc-icon" />
        <span className="sa-doc-label">{label}</span>
        <span className="sa-doc-missing-tag">Not submitted</span>
      </div>
    );
  }

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
      <span className="sa-info-field-value">{value || "-"}</span>
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

function Scholars({ SidebarComponent = Sidebar }) {
  const [newScholars, setNewScholars] = useState([]);
  const [oldScholars, setOldScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("new");
  const [selected, setSelected] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const [promoting, setPromoting] = useState(null);
  const [unpromoting, setUnpromoting] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [promoteTarget, setPromoteTarget] = useState(null);
  const [unpromoteTarget, setUnpromoteTarget] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);
  const [checkedIds, setCheckedIds] = useState(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkPromoting, setBulkPromoting] = useState(false);

  useEffect(() => {
    async function loadScholars() {
      setLoading(true);
      setError(null);

      try {
        const { newList, oldList } = await fetchApprovedScholars();
        setNewScholars(newList);
        setOldScholars(oldList);
      } catch (err) {
        console.error("Failed to load scholars:", err);
        setError("Failed to load scholars. Please refresh.");
      } finally {
        setLoading(false);
      }
    }

    loadScholars();
  }, []);

  const currentList = activeTab === "new" ? newScholars : oldScholars;

  const filtered = useMemo(() => {
    return filterScholars(currentList, searchQuery);
  }, [currentList, searchQuery]);

  useEffect(() => {
    setCheckedIds(new Set());
  }, [activeTab]);

  const allFilteredIds = filtered.map((scholar) => scholar.id);
  const allChecked =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => checkedIds.has(id));
  const someChecked = allFilteredIds.some((id) => checkedIds.has(id));
  const checkedCount = allFilteredIds.filter((id) => checkedIds.has(id)).length;
  const tableColSpan = activeTab === "new" ? 10 : 9;

  function toggleAll() {
    const next = new Set(checkedIds);

    if (allChecked) {
      allFilteredIds.forEach((id) => next.delete(id));
    } else {
      allFilteredIds.forEach((id) => next.add(id));
    }

    setCheckedIds(next);
  }

  function toggleOne(id) {
    const next = new Set(checkedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCheckedIds(next);
  }

  function requestArchive(scholar) {
    setConfirmTarget(scholar);
  }

  async function doArchive() {
    const scholar = confirmTarget;
    if (!scholar) return;

    setConfirmTarget(null);
    setArchiving(scholar.id);

    try {
      await archiveScholarRecord(scholar);

      if (activeTab === "new") {
        setNewScholars((prev) => prev.filter((item) => item.id !== scholar.id));
      } else {
        setOldScholars((prev) => prev.filter((item) => item.id !== scholar.id));
      }

      if (selected?.id === scholar.id) {
        setSelected(null);
      }
    } catch (err) {
      console.error("Archive error:", err);
      alert("Failed to archive. Please try again.");
    } finally {
      setArchiving(null);
    }
  }

  function requestPromote(scholar) {
    setPromoteTarget(scholar);
  }

  function requestUnpromote(scholar) {
    setUnpromoteTarget(scholar);
  }

  function showNotice(message, detail) {
    setActionNotice({ message, detail });
    setTimeout(() => setActionNotice(null), 3500);
  }

  async function promoteSingle(scholar) {
    const promoted = await promoteScholarRecord(scholar);
    setNewScholars((prev) => prev.filter((item) => item.id !== scholar.id));
    setOldScholars((prev) => [promoted, ...prev]);
  }

  async function unpromoteSingle(scholar) {
    const unpromoted = await unpromoteScholarRecord(scholar);
    setOldScholars((prev) => prev.filter((item) => item.id !== scholar.id));
    setNewScholars((prev) => [unpromoted, ...prev]);
  }

  async function doPromote() {
    const scholar = promoteTarget;
    if (!scholar) return;

    setPromoteTarget(null);
    setPromoting(scholar.id);

    try {
      await promoteSingle(scholar);

      if (selected?.id === scholar.id) {
        setSelected(null);
      }

      showNotice(scholar.fullName, "promoted to Old Scholar! Renewal access granted.");
    } catch (err) {
      console.error("Promote error:", err);
      alert("Failed to promote. Please try again.");
    } finally {
      setPromoting(null);
    }
  }

  async function doUnpromote() {
    const scholar = unpromoteTarget;
    if (!scholar) return;

    setUnpromoteTarget(null);
    setUnpromoting(scholar.id);

    try {
      await unpromoteSingle(scholar);

      if (selected?.id === scholar.id) {
        setSelected(null);
      }

      showNotice(scholar.fullName, "moved back to New Scholars. Renewal access removed.");
    } catch (err) {
      console.error("Unpromote error:", err);
      alert("Failed to unpromote. Please try again.");
    } finally {
      setUnpromoting(null);
    }
  }

  async function doBulkPromote() {
    const toPromote = newScholars.filter((scholar) => checkedIds.has(scholar.id));
    if (toPromote.length === 0) return;

    setBulkPromoting(true);

    try {
      for (const scholar of toPromote) {
        await promoteSingle(scholar);
      }

      setCheckedIds(new Set());
      setShowBulkModal(false);
      showNotice(
        `${toPromote.length} scholar${toPromote.length !== 1 ? "s" : ""}`,
        "promoted to Old Scholar! Renewal access granted."
      );
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

        {actionNotice && (
          <div className="sa-promote-toast">
            <FaCheckCircle className="sa-toast-icon" />
            <span>
              <strong>{actionNotice.message}</strong> {actionNotice.detail}
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
              {activeTab === "new" && checkedCount > 0 && (
                <div className="sa-float-actions">
                  <span className="sa-float-count">{checkedCount} selected</span>
                  <button
                    className="sa-btn sa-btn-promote"
                    onClick={() => setShowBulkModal(true)}
                    disabled={bulkPromoting}
                  >
                    <FaArrowUp size={10} />
                    {bulkPromoting ? "Promoting..." : "Promote Selected"}
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
              onClick={() => {
                setActiveTab("new");
                setSearchQuery("");
              }}
            >
              <span className="sa-tab-icon">N</span>
              New Scholars
              <span className="sa-tab-pill-count">{newScholars.length}</span>
            </button>

            <button
              className={"sa-tab-pill " + (activeTab === "old" ? "sa-tab-pill-active" : "")}
              onClick={() => {
                setActiveTab("old");
                setSearchQuery("");
              }}
            >
              <span className="sa-tab-icon">O</span>
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
                        ref={(element) => {
                          if (element) element.indeterminate = someChecked && !allChecked;
                        }}
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
                  <tr>
                    <td colSpan={tableColSpan} className="sa-empty">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={tableColSpan} className="sa-empty">
                      {searchQuery
                        ? "No results found."
                        : activeTab === "new"
                          ? "No approved new scholars yet."
                          : "No approved returning scholars yet."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((scholar) => (
                    <tr key={scholar.id} className="sa-tr">
                      {activeTab === "new" && (
                        <td className="sa-td-check">
                          <input
                            type="checkbox"
                            className="sa-checkbox"
                            checked={checkedIds.has(scholar.id)}
                            onChange={() => toggleOne(scholar.id)}
                          />
                        </td>
                      )}

                      <td className="sa-td-name">{scholar.fullName}</td>
                      <td>
                        <span
                          className={`sa-type-badge ${
                            isReturningApplicant(scholar.applicantType) || scholar.promoted
                              ? "returning"
                              : "new"
                          }`}
                        >
                          {scholar.applicantType || "New"}
                        </span>
                      </td>
                      <td>{scholar.schoolName}</td>
                      <td>{scholar.course}</td>
                      <td>{scholar.semester || "-"}</td>
                      <td>{scholar.yearLevel}</td>
                      <td>{scholar.gwa}</td>
                      <td>
                        <StatusBadge status={scholar.status} />
                      </td>
                      <td>
                        <div className="sa-action-btns">
                          <button className="sa-btn sa-btn-view" onClick={() => setSelected(scholar)}>
                            View
                          </button>

                          {activeTab === "new" && (
                            <button
                              className="sa-btn sa-btn-promote"
                              onClick={() => requestPromote(scholar)}
                              disabled={promoting === scholar.id}
                              title="Promote to Old Scholar and grant renewal access"
                            >
                              <FaArrowUp size={10} />
                              {promoting === scholar.id ? "..." : "Promote"}
                            </button>
                          )}

                          {activeTab === "old" &&
                            scholar.sourceCollection === "scholarship_applications" &&
                            scholar.promoted && (
                              <button
                                className="sa-btn sa-btn-unpromote"
                                onClick={() => requestUnpromote(scholar)}
                                disabled={unpromoting === scholar.id}
                                title="Move back to New Scholars and remove renewal access"
                              >
                                <FaArrowDown size={10} />
                                {unpromoting === scholar.id ? "..." : "Unpromote"}
                              </button>
                            )}

                          <button
                            className="sa-btn sa-btn-archive"
                            onClick={() => requestArchive(scholar)}
                            disabled={archiving === scholar.id}
                          >
                            <FaArchive size={11} />
                            {archiving === scholar.id ? "..." : "Archive"}
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

      <UnpromoteModal
        scholar={unpromoteTarget}
        onConfirm={doUnpromote}
        onCancel={() => setUnpromoteTarget(null)}
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
          <div className="sa-modal" onClick={(event) => event.stopPropagation()}>
            <div className="sa-modal-header">
              <div className="sa-modal-avatar">
                {(selected.firstName?.[0] || "?").toUpperCase()}
                {(selected.lastName?.[0] || "").toUpperCase()}
              </div>

              <div className="sa-modal-header-info">
                <h2 className="sa-modal-name">{selected.fullName}</h2>
                <p className="sa-modal-subtitle">
                  {selected.course} - {selected.schoolName}
                </p>
              </div>

              <div className="sa-modal-header-right">
                <StatusBadge status={selected.status} />
                {selected.renewalAccess && (
                  <span className="sa-renewal-access-badge">
                    <FaCheckCircle /> Renewal Access
                  </span>
                )}
                <button className="sa-modal-close" onClick={() => setSelected(null)}>
                  &times;
                </button>
              </div>
            </div>

            <div className="sa-modal-body">
              <div className="sa-modal-section">
                <SectionHeader icon={FaUser} title="Personal Information" />
                <div className="sa-info-grid">
                  <InfoField label="First Name" value={selected.firstName} />
                  <InfoField label="Middle Name" value={selected.middleName} />
                  <InfoField label="Last Name" value={selected.lastName} />
                  <InfoField label="Email" value={selected.email} />
                  <InfoField label="Contact No." value={selected.contactNumber} />
                  <InfoField label="Date of Birth" value={selected.dateOfBirth} />
                  <InfoField label="Barangay" value={selected.barangay} />
                  <InfoField label="House No." value={selected.houseNo} />
                </div>
              </div>

              <div className="sa-modal-section">
                <SectionHeader icon={FaGraduationCap} title="Education Information" />
                <div className="sa-info-grid">
                  <InfoField label="Applicant Type" value={selected.applicantType} />
                  <InfoField label="Course" value={selected.course} />
                  <InfoField label="GWA" value={selected.gwa} />
                  <InfoField label="School Name" value={selected.schoolName} />
                  <InfoField label="Semester" value={selected.semester} />
                  <InfoField label="Student ID" value={selected.studentId} />
                  <InfoField label="Year Level" value={selected.yearLevel} />
                </div>
              </div>

              <div className="sa-modal-section">
                <SectionHeader icon={FaMoneyBillWave} title="Financial Information" />
                <div className="sa-info-grid">
                  <InfoField label="Father's Name" value={selected.fatherName} />
                  <InfoField label="Father's Occupation" value={selected.fatherOccupation} />
                  <InfoField label="Father's Income" value={selected.fatherIncome} />
                  <InfoField label="Mother's Name" value={selected.motherName} />
                  <InfoField label="Mother's Occupation" value={selected.motherOccupation} />
                  <InfoField label="Mother's Income" value={selected.motherIncome} />
                  <InfoField label="Total Family Income" value={selected.totalIncome} />
                </div>
              </div>

              <div className="sa-modal-section">
                <SectionHeader icon={FaFolder} title="Submitted Documents" />
                <div className="sa-docs-list">
                  <DocLink href={selected.coeUrl} label="Certificate of Enrollment (COE)" />
                  <DocLink href={selected.gradesUrl} label="Grades / Transcript" />
                  <DocLink
                    href={selected.indigencyUrl}
                    label="Certificate of Indigency"
                  />
                  <DocLink href={selected.itrUrl} label="Income Tax Return (ITR)" />
                  <DocLink href={selected.residencyUrl} label="Certificate of Residency" />
                  <DocLink href={selected.goodMoralUrl} label="Good Moral Certificate" />
                  <DocLink href={selected.validIdUrl} label="Valid ID" />
                </div>
              </div>
            </div>

            <div className="sa-modal-footer">
              {!isReturningApplicant(selected.applicantType) && !selected.promoted && (
                <button
                  className="sa-btn sa-btn-promote"
                  onClick={() => {
                    setSelected(null);
                    requestPromote(selected);
                  }}
                  disabled={promoting === selected.id}
                >
                  <FaArrowUp size={13} />
                  {promoting === selected.id ? "Promoting..." : "Promote to Old Scholar"}
                </button>
              )}

              {selected.sourceCollection === "scholarship_applications" && selected.promoted && (
                <button
                  className="sa-btn sa-btn-unpromote"
                  onClick={() => {
                    setSelected(null);
                    requestUnpromote(selected);
                  }}
                  disabled={unpromoting === selected.id}
                >
                  <FaArrowDown size={13} />
                  {unpromoting === selected.id ? "Unpromoting..." : "Unpromote Scholar"}
                </button>
              )}

              <button
                className="sa-btn sa-btn-archive"
                onClick={() => {
                  setSelected(null);
                  requestArchive(selected);
                }}
                disabled={archiving === selected.id}
              >
                <FaArchive size={13} />
                {archiving === selected.id ? "Archiving..." : "Archive Scholar"}
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
