// Archives.jsx
import React, { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import { FaSearch, FaSignOutAlt } from "react-icons/fa";
import {
  collection, getDocs, doc,
  deleteDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "../css/Archives.css";

const PAGE_SIZE = 12;

// ─────────────────────────────────────────────────────────────
// Unarchive Confirm Modal — dark navy (matches sidebar)
// ─────────────────────────────────────────────────────────────
function UnarchiveModal({ scholar, onConfirm, onCancel }) {
  if (!scholar) return null;
  return (
    <div className="arc-confirm-overlay" onClick={onCancel}>
      <div className="arc-confirm-box" onClick={e => e.stopPropagation()}>

        <div className="arc-confirm-icon-wrap">
          <FaSignOutAlt className="arc-confirm-icon" />
        </div>

        <h3 className="arc-confirm-title">Unarchive Scholar?</h3>
        <p className="arc-confirm-msg">
          Are you sure you want to restore{" "}
          <strong>{scholar.fullName}</strong>?<br />
          They will be moved back to the Scholars page.
        </p>

        <div className="arc-confirm-btns">
          <button className="arc-confirm-no" onClick={onCancel}>
            No, Cancel
          </button>
          <button className="arc-confirm-yes" onClick={onConfirm}>
            Yes, Unarchive
          </button>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch { return "—"; }
}

function parseArchive(docSnap) {
  const data     = docSnap.data();
  const personal = data.personalInfo  || {};
  const edu      = data.educationInfo || {};

  const firstName = personal.firstName || data.firstName || (data.name || "").split(" ")[0] || "";
  const lastName  = personal.lastName  || data.lastName  || (data.name || "").split(" ").slice(1).join(" ") || "";

  return {
    id:               docSnap.id,
    fullName:         data.name || (firstName + " " + lastName).trim() || "—",
    schoolName:       edu.schoolName || data.schoolName || data.school || "—",
    archivedAt:       data.archivedAt || null,
    sourceCollection: data.sourceCollection || "scholarship_applications",
  };
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
function Archives({ SidebarComponent = Sidebar, activePage = "archives" }) {
  const [archives,       setArchives]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [searchQuery,    setSearchQuery]    = useState("");
  const [currentPage,    setCurrentPage]    = useState(1);
  const [restoring,      setRestoring]      = useState(null);
  const [confirmTarget,  setConfirmTarget]  = useState(null);

  // ── Load ─────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, "archives"));
        const list = snap.docs.map(parseArchive);
        list.sort((a, b) => {
          const ta = a.archivedAt?.toMillis?.() || 0;
          const tb = b.archivedAt?.toMillis?.() || 0;
          return tb - ta;
        });
        setArchives(list);
      } catch (err) {
        console.error("Failed to load archives:", err);
        setError("Failed to load archives. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // ── Filter + paginate ─────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return archives;
    return archives.filter(a =>
      (a.fullName   || "").toLowerCase().includes(q) ||
      (a.schoolName || "").toLowerCase().includes(q)
    );
  }, [archives, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function goToPage(p) {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
  }

  // Show up to 3 page numbers around current
  const pageNumbers = useMemo(() => {
    const pages = [];
    const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
    const end   = Math.min(totalPages, start + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  // ── Unarchive ─────────────────────────────────────────────
  async function doUnarchive() {
    const scholar = confirmTarget;
    setConfirmTarget(null);
    setRestoring(scholar.id);
    try {
      await updateDoc(doc(db, scholar.sourceCollection, scholar.id), {
        archived:     false,
        unarchivedAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, "archives", scholar.id));
      setArchives(prev => prev.filter(a => a.id !== scholar.id));
    } catch (err) {
      console.error("Unarchive error:", err);
      alert("Failed to restore. Please try again.");
    } finally {
      setRestoring(null);
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="arc-container">
      <SidebarComponent activePage={activePage} />

      <main className="arc-main">

        {/* ── Top bar ── */}
        <div className="arc-topbar">
          <h1 className="arc-title">Archives</h1>
          <div className="arc-search-wrap">
            <FaSearch className="arc-search-icon" />
            <input
              type="text"
              className="arc-search-input"
              placeholder="Search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="arc-error">{error}</div>}

        {/* ── Table card ── */}
        <div className="arc-card">

          <div className="arc-table-wrap">
            <table className="arc-table">
              <thead>
                <tr>
                  <th>Archives Name</th>
                  <th>School</th>
                  <th>Date Archive</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="arc-empty">Loading…</td></tr>
                ) : paginated.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="arc-empty">
                      {searchQuery ? "No results found." : "No archived scholars yet."}
                    </td>
                  </tr>
                ) : (
                  paginated.map((a, idx) => (
                    <tr key={a.id} className={idx % 2 === 1 ? "arc-tr-alt" : ""}>
                      <td className="arc-td-name">{a.fullName}</td>
                      <td className="arc-td-school">
                        {a.schoolName.length > 20
                          ? a.schoolName.slice(0, 20) + "…"
                          : a.schoolName}
                      </td>
                      <td>{formatDate(a.archivedAt)}</td>
                      <td>
                        <button
                          className="arc-unarchive-btn"
                          onClick={() => setConfirmTarget(a)}
                          disabled={restoring === a.id}
                        >
                          {restoring === a.id ? "Restoring…" : "Unarchive"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Footer pagination (dark navy bar) ── */}
          {!loading && filtered.length > 0 && (
            <div className="arc-footer">
              <span className="arc-footer-info">
                Showing {Math.min(paginated.length + (currentPage - 1) * PAGE_SIZE, filtered.length)} of{" "}
                {filtered.length.toLocaleString()} Archives
              </span>
              <div className="arc-pagination">
                <button
                  className="arc-pg-prev"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  &lt; Previous
                </button>
                {pageNumbers.map(p => (
                  <button
                    key={p}
                    className={"arc-pg-num" + (p === currentPage ? " arc-pg-active" : "")}
                    onClick={() => goToPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="arc-pg-next"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next &gt;
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Unarchive Confirm Modal ── */}
      <UnarchiveModal
        scholar={confirmTarget}
        onConfirm={doUnarchive}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}

export default Archives;
