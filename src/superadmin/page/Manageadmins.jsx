import React, { useState, useEffect } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig";
import SidebarSuper from "../../components/SidebarSuper";
import {
  FaUserPlus, FaTimes, FaEnvelope, FaLock,
  FaUserShield, FaTrash, FaSearch, FaEye, FaEyeSlash,
  FaUsers, FaUserTie,
} from "react-icons/fa";
import "../../css/Manageadmins.css";

function AddStaffModal({ onClose, onCreated }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState("admin");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!email.trim())       return setError("Email is required.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await setDoc(doc(db, "users", cred.user.uid), {
        email: email.trim(), role, isAdmin: role === "admin" ? "true" : "false", createdAt: Date.now(),
      });
      setSuccess("Account created successfully!");
      setEmail(""); setPassword("");
      onCreated({ uid: cred.user.uid, email: email.trim(), role, createdAt: Date.now() });
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setError("Email is already registered.");
      else if (err.code === "auth/invalid-email")   setError("Invalid email address.");
      else setError("Failed to create account. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <div className="ma-overlay" onClick={() => !loading && onClose()}>
      <div className="ma-modal" onClick={e => e.stopPropagation()}>
        <div className="ma-modal-header">
          <div className="ma-modal-header-left">
            <div className="ma-modal-icon-circle"><FaUserShield /></div>
            <h3>Add Admin / Staff</h3>
          </div>
          <button className="ma-modal-close" onClick={() => !loading && onClose()} disabled={loading}><FaTimes /></button>
        </div>
        <form onSubmit={handleSubmit} className="ma-modal-form">
          <div className="ma-field">
            <label><FaEnvelope className="ma-field-icon" /> Email</label>
            <input type="email" placeholder="username@gmail.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} />
          </div>
          <div className="ma-field">
            <label><FaLock className="ma-field-icon" /> Password</label>
            <div className="ma-pass-wrap">
              <input type={showPass ? "text" : "password"} placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} />
              <button type="button" className="ma-eye-btn" onClick={() => setShowPass(p => !p)} tabIndex={-1}>
                {showPass ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <div className="ma-field">
            <label><FaUserShield className="ma-field-icon" /> Role</label>
            <select value={role} onChange={e => setRole(e.target.value)} disabled={loading}>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          {error   && <p className="ma-error">{error}</p>}
          {success && <p className="ma-success">{success}</p>}
          <div className="ma-modal-actions">
            <button type="button" className="ma-btn-cancel" onClick={() => !loading && onClose()} disabled={loading}>Cancel</button>
            <button type="submit" className="ma-btn-submit" disabled={loading}>
              <FaUserPlus /> {loading ? "Creating…" : "Create Account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ email, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="ma-overlay" onClick={() => !isDeleting && onCancel()}>
      <div className="ma-modal ma-del-modal" onClick={e => e.stopPropagation()}>
        <div className="ma-del-icon-wrap"><FaTrash className="ma-del-icon" /></div>
        <h3 className="ma-del-title">Remove Account</h3>
        <p className="ma-del-msg">Are you sure you want to remove <strong>{email}</strong>?<br />This will delete their Firestore record.</p>
        <div className="ma-modal-actions">
          <button className="ma-btn-cancel" onClick={onCancel} disabled={isDeleting}>No, Cancel</button>
          <button className="ma-btn-delete" onClick={onConfirm} disabled={isDeleting}>{isDeleting ? "Removing…" : "Yes, Remove"}</button>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }) {
  const map = {
    superadmin: { label: "Superadmin", cls: "badge-super" },
    admin:      { label: "Admin",      cls: "badge-admin" },
    staff:      { label: "Staff",      cls: "badge-staff" },
  };
  const { label, cls } = map[role?.toLowerCase()] || { label: role || "—", cls: "badge-staff" };
  return <span className={`ma-badge ${cls}`}>{label}</span>;
}

export default function ManageAdmins() {
  const [accounts,     setAccounts]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [showModal,    setShowModal]    = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting,   setIsDeleting]   = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "users"));
        const list = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.role === "admin" || u.role === "staff" || u.role === "superadmin")
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setAccounts(list);
      } catch (err) { console.error("Load error:", err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  function handleCreated(newAccount) { setAccounts(prev => [newAccount, ...prev]); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "users", deleteTarget.uid));
      setAccounts(prev => prev.filter(a => a.uid !== deleteTarget.uid));
      setDeleteTarget(null);
    } catch (err) { console.error("Delete error:", err); alert("Failed to remove. Please try again."); }
    finally { setIsDeleting(false); }
  }

  const filtered = accounts.filter(a =>
    (a.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.role  || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalAdmins = accounts.filter(a => a.role === "admin").length;
  const totalStaff  = accounts.filter(a => a.role === "staff").length;
  const totalSuper  = accounts.filter(a => a.role === "superadmin").length;

  return (
    <div className="ma-container">
      <SidebarSuper activePage="manage-admins" />

      <main className="ma-main">

        {/* Topbar */}
        <div className="ma-topbar">
          <div className="ma-topbar-left">
            <h2 className="ma-page-title">Manage Admins & Staff</h2>
            <p className="ma-page-sub">Manage all admin and staff accounts</p>
          </div>
          <button className="ma-add-btn" onClick={() => setShowModal(true)}>
            <FaUserPlus /> Add Admin / Staff
          </button>
        </div>

        {/* Stat Cards */}
        <div className="ma-stat-cards">
          <div className="ma-stat-card ma-stat-admin">
            <div className="ma-stat-icon-wrap"><FaUsers /></div>
            <div className="ma-stat-info">
              <span className="ma-stat-num">{loading ? "—" : totalAdmins}</span>
              <span className="ma-stat-label">Total Admins</span>
            </div>
          </div>
          <div className="ma-stat-card ma-stat-staff">
            <div className="ma-stat-icon-wrap"><FaUserTie /></div>
            <div className="ma-stat-info">
              <span className="ma-stat-num">{loading ? "—" : totalStaff}</span>
              <span className="ma-stat-label">Total Staff</span>
            </div>
          </div>
          <div className="ma-stat-card ma-stat-super">
            <div className="ma-stat-icon-wrap"><FaUserShield /></div>
            <div className="ma-stat-info">
              <span className="ma-stat-num">{loading ? "—" : totalSuper}</span>
              <span className="ma-stat-label">Superadmins</span>
            </div>
          </div>
        </div>

        {/* Search + Table */}
        <div className="ma-table-section">
          <div className="ma-table-header">
            <div className="ma-search-box">
              <FaSearch className="ma-search-icon" />
              <input type="text" placeholder="Search by email or role…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <span className="ma-count-label">{filtered.length} account{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="ma-table-box">
            <table className="ma-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Date Added</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="ma-table-empty">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="ma-table-empty">{search ? "No results found." : "No accounts yet."}</td></tr>
                ) : (
                  filtered.map((a, i) => (
                    <tr key={a.uid} className={a.role === "superadmin" ? "ma-row-super" : ""}>
                      <td className="ma-td-num">{i + 1}</td>
                      <td className="ma-td-email">
                        <div className="ma-email-avatar">{(a.email || "?")[0].toUpperCase()}</div>
                        {a.email || "—"}
                      </td>
                      <td><RoleBadge role={a.role} /></td>
                      <td className="ma-td-date">
                        {a.createdAt ? new Date(a.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}
                      </td>
                      <td>
                        {a.role !== "superadmin" && (
                          <button className="ma-delete-btn" onClick={() => setDeleteTarget(a)} title="Remove">
                            <FaTrash />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showModal    && <AddStaffModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}
      {deleteTarget && <DeleteConfirmModal email={deleteTarget.email} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} isDeleting={isDeleting} />}
    </div>
  );
}