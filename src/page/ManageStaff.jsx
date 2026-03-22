import React, { useEffect, useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import Sidebar from "../components/Sidebar";
import {
  FaUserPlus, FaTimes, FaEnvelope, FaLock,
  FaTrash, FaSearch, FaEye, FaEyeSlash, FaUserShield,
  FaCalendarAlt, FaUsers, FaUserTag, FaCheckCircle,
} from "react-icons/fa";
import "../css/MannageStaff.css";

// ── Password strength ─────────────────────────────────────────
function strengthInfo(pw) {
  if (!pw) return { label: "", cls: "", pct: 0 };
  const checks = [
    /[a-z]/.test(pw),
    /[A-Z]/.test(pw),
    /\d/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
    pw.length >= 8,
  ];
  const score = checks.filter(Boolean).length;
  if (score <= 2) return { label: "Weak",   cls: "weak",   pct: 25  };
  if (score <= 3) return { label: "Fair",   cls: "fair",   pct: 50  };
  if (score === 4) return { label: "Good",   cls: "good",   pct: 75  };
  return               { label: "Strong", cls: "strong", pct: 100 };
}

// ── Add Staff Modal ───────────────────────────────────────────
function AddStaffModal({ onClose, onCreated }) {
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const strength = strengthInfo(password);
  const validPassword = () =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!fullName.trim()) return setError("Full name is required.");
    if (!email.trim())    return setError("Email address is required.");
    if (!validPassword()) return setError("Password must be 8+ characters with uppercase, lowercase, number and symbol.");
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid  = cred.user.uid;

      const payload = {
        fullName:   fullName.trim(),
        email:      email.trim().toLowerCase(),
        role:       "staff",
        isAdmin:    false,
        isVerified: true,
        createdAt:  Date.now(),
        updatedAt:  Date.now(),
      };
      await setDoc(doc(db, "users", uid), payload);

      setSuccess("Staff account created successfully!");
      onCreated({ uid, ...payload });

      setTimeout(() => {
        setFullName(""); setEmail(""); setPassword("");
        setSuccess("");
      }, 1800);
    } catch (err) {
      console.error("Create staff error:", err);
      if (err.code === "auth/email-already-in-use") setError("This email is already registered.");
      else if (err.code === "auth/invalid-email")   setError("Please enter a valid email address.");
      else setError("Failed to create account. Please try again.");
    } finally { setLoading(false); }
  }

  return (
    <div className="ma-overlay" onClick={() => !loading && onClose()}>
      <div className="ma-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ma-modal-head">
          <div className="ma-modal-head-icon">
            <FaUserShield />
          </div>
          <div className="ma-modal-head-text">
            <h3>Add New Staff</h3>
            <p>Create a staff account</p>
          </div>
          <button className="ma-modal-x" onClick={() => !loading && onClose()} disabled={loading}>
            <FaTimes />
          </button>
        </div>

        {/* Divider */}
        <div className="ma-modal-divider" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="ma-form">

          {/* Full Name */}
          <div className="ma-field">
            <label className="ma-lbl">Full Name <span className="ma-req">*</span></label>
            <input
              className="ma-inp"
              placeholder="e.g. Juan Dela Cruz"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          {/* Email */}
          <div className="ma-field">
            <label className="ma-lbl">
              <FaEnvelope className="ma-lbl-icon" /> Email Address <span className="ma-req">*</span>
            </label>
            <input
              className="ma-inp"
              type="email"
              placeholder="username@gmail.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
          </div>

          {/* Password */}
          <div className="ma-field">
            <label className="ma-lbl">
              <FaLock className="ma-lbl-icon" /> Password <span className="ma-req">*</span>
            </label>
            <div className="ma-inp-wrap">
              <input
                className="ma-inp ma-inp-pw"
                type={showPass ? "text" : "password"}
                placeholder="Min. 8 chars — upper, lower, number, symbol"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="ma-eye"
                onClick={() => setShowPass(p => !p)}
                tabIndex={-1}
              >
                {showPass ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
            {/* Strength bar */}
            {password.length > 0 && (
              <div className="ma-strength-row">
                <div className="ma-strength-track">
                  <div className={`ma-strength-fill ${strength.cls}`} style={{ width: `${strength.pct}%` }} />
                </div>
                <span className={`ma-strength-txt ${strength.cls}`}>{strength.label}</span>
              </div>
            )}
          </div>

          {/* Role — Staff only, shown as read-only dropdown */}
          <div className="ma-field">
            <label className="ma-lbl">
              <FaUserTag className="ma-lbl-icon" /> Role <span className="ma-req">*</span>
            </label>
            <select
              className="ma-inp ma-select"
              value="staff"
              disabled
            >
              <option value="staff">Staff</option>
            </select>
            <span className="ma-role-hint">Only staff accounts can be created here.</span>
          </div>

          {/* Alerts */}
          {error   && <div className="ma-alert err"><span>⚠</span> {error}</div>}
          {success && <div className="ma-alert ok"><FaCheckCircle /> {success}</div>}

          {/* Footer buttons */}
          <div className="ma-form-btns">
            <button
              type="button"
              className="ma-btn-ghost"
              onClick={() => !loading && onClose()}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="ma-btn-primary" disabled={loading}>
              {loading ? <span className="ma-spinner" /> : <FaUserPlus />}
              {loading ? "Creating…" : "Create Staff"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────
function DeleteConfirmModal({ name, email, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="ma-overlay" onClick={() => !isDeleting && onCancel()}>
      <div className="ma-modal ma-del-modal" onClick={e => e.stopPropagation()}>
        <div className="ma-del-circle"><FaTrash /></div>
        <h3 className="ma-del-title">Remove Member?</h3>
        <p className="ma-del-msg">
          You are about to remove <strong>{name || email}</strong>.<br />
          Their Firestore record will be deleted.
        </p>
        <div className="ma-form-btns" style={{ justifyContent: "center" }}>
          <button className="ma-btn-ghost" onClick={onCancel} disabled={isDeleting}>
            No, Cancel
          </button>
          <button className="ma-btn-danger" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? <span className="ma-spinner" /> : <FaTrash />}
            {isDeleting ? "Removing…" : "Yes, Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ name }) {
  const initials = (name || "?").trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const colors   = ["#1e3a8a","#0369a1","#065f46","#7c3aed","#be123c","#c2410c","#b45309"];
  const bg       = colors[(name?.charCodeAt(0) || 0) % colors.length];
  return <div className="ma-avatar" style={{ background: bg }}>{initials}</div>;
}

function RoleBadge({ role }) {
  const isAdmin = role === "admin" || role === "superadmin";
  return (
    <span className={`ma-badge ${isAdmin ? "badge-admin" : "badge-staff"}`}>
      {role || "staff"}
    </span>
  );
}

function formatDate(ts) {
  if (!ts || isNaN(Number(ts))) return "—";
  return new Date(Number(ts)).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── Main Page ─────────────────────────────────────────────────
export default function ManageStaff() {
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
          .filter(u => ["staff", "admin"].includes((u.role || "").toLowerCase()))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setAccounts(list);
      } catch (err) { console.error("Load staff error:", err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  function handleCreated(acc) { setAccounts(prev => [acc, ...prev]); }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "users", deleteTarget.uid));
      setAccounts(prev => prev.filter(a => a.uid !== deleteTarget.uid));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete error:", err);
      alert("Failed to remove. Please try again.");
    } finally { setIsDeleting(false); }
  }

  const filtered = accounts.filter(a =>
    (a.email    || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.fullName || "").toLowerCase().includes(search.toLowerCase())
  );

  const staffCount = accounts.filter(a => a.role === "staff").length;
  const adminCount = accounts.filter(a => a.role === "admin").length;

  return (
    <div className="ma-root">
      <Sidebar activePage="manage-staff" />

      <main className="ma-main">

        <div className="ma-body">
          <div className="ma-page-head">
            <div className="ma-page-copy">
              <h1 className="ma-title">Manage Staff</h1>
              <p className="ma-subtitle">Add, view, and remove staff accounts</p>
            </div>
            <button className="ma-btn-primary" onClick={() => setShowModal(true)}>
              <FaUserPlus /> Add Staff
            </button>
          </div>

          {/* Stats */}
          <div className="ma-stats">
            <div className="ma-stat">
              <div className="ma-stat-icon"><FaUsers /></div>
              <div>
                <div className="ma-stat-val">{loading ? "…" : accounts.length}</div>
                <div className="ma-stat-lbl">Total Accounts</div>
              </div>
            </div>
            <div className="ma-stat">
              <div className="ma-stat-icon blue"><FaUserShield /></div>
              <div>
                <div className="ma-stat-val">{loading ? "…" : adminCount}</div>
                <div className="ma-stat-lbl">Admins</div>
              </div>
            </div>
            <div className="ma-stat">
              <div className="ma-stat-icon teal"><FaUserTag /></div>
              <div>
                <div className="ma-stat-val">{loading ? "…" : staffCount}</div>
                <div className="ma-stat-lbl">Staff</div>
              </div>
            </div>
            <div className="ma-stat">
              <div className="ma-stat-icon amber"><FaCalendarAlt /></div>
              <div>
                <div className="ma-stat-val" style={{ fontSize: 16 }}>
                  {loading ? "…" : accounts[0] ? formatDate(accounts[0].createdAt) : "—"}
                </div>
                <div className="ma-stat-lbl">Latest Added</div>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="ma-toolbar">
            <div className="ma-search">
              <FaSearch className="ma-search-ico" />
              <input
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span className="ma-count">{filtered.length} account{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Table */}
          <div className="ma-table-wrap">
            <table className="ma-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Staff Member</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Date Added</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="ma-td-center">Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="ma-td-center">
                      <FaUsers style={{ fontSize: 32, color: "#cbd5e1", marginBottom: 8, display: "block", margin: "0 auto 8px" }} />
                      {search ? "No accounts matched your search." : "No accounts yet. Click \"Add Staff\" to get started."}
                    </td>
                  </tr>
                ) : filtered.map((a, i) => (
                  <tr key={a.uid} className="ma-tr">
                    <td className="ma-td-n">{i + 1}</td>
                    <td>
                      <div className="ma-user">
                        <Avatar name={a.fullName} />
                        <span className="ma-name">{a.fullName || "—"}</span>
                      </div>
                    </td>
                    <td className="ma-td-email">{a.email}</td>
                    <td><RoleBadge role={a.role} /></td>
                    <td className="ma-td-date">
                      <FaCalendarAlt style={{ color: "#94a3b8", marginRight: 5, fontSize: 11 }} />
                      {formatDate(a.createdAt)}
                    </td>
                    <td>
                      <button className="ma-btn-remove" onClick={() => setDeleteTarget(a)}>
                        <FaTrash /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </main>

      {showModal && <AddStaffModal onClose={() => setShowModal(false)} onCreated={handleCreated} />}

      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.fullName}
          email={deleteTarget.email}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
