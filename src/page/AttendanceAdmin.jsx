import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import {
  collection, getDocs, query, where, getDoc, doc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, CartesianGrid,
} from "recharts";
import "../css/AttendanceAdmin.css";

// ── Helpers ───────────────────────────────────────────────────
function toDateKey(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDate(ms) {
  if (!ms) return "—";
  return new Date(Number(ms)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(ms) {
  if (!ms) return "—";
  return new Date(Number(ms)).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}
function formatMonthLabel(dateKey) {
  if (!dateKey) return "";
  const [y, m] = dateKey.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ── Resolve barangay: users → personalInfo → scholarship_applications ──
async function resolveBarangay(userId) {
  if (!userId) return "Unknown";
  try {
    const userSnap = await getDoc(doc(db, "users", userId));
    if (userSnap.exists()) {
      const ud = userSnap.data();
      const b =
        ud.barangay ||
        ud.personalInfo?.barangay ||
        (ud.address || "").split(",")[0]?.trim() || "";
      if (b) return b;
    }
  } catch (_) {}

  // Fallback: scholarship_applications
  try {
    const appSnap = await getDocs(
      query(collection(db, "scholarship_applications"), where("userId", "==", userId))
    );
    if (!appSnap.empty) {
      const d = appSnap.docs[0].data();
      const b = d.personalInfo?.barangay || d.barangay || "";
      if (b) return b;
    }
  } catch (_) {}

  return "Unknown";
}

// ── Custom Tooltip ─────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="att-tooltip">
      <div className="att-tooltip-label">{label}</div>
      <div className="att-tooltip-value">
        {payload[0].value} submission{payload[0].value !== 1 ? "s" : ""}
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────
function StatCard({ icon, value, label }) {
  return (
    <div className="att-stat-card">
      <div className="att-stat-icon">{icon}</div>
      <div>
        <div className="att-stat-value">{value}</div>
        <div className="att-stat-label">{label}</div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────
export default function AttendanceAdmin({ SidebarComponent = Sidebar, activePage = "attendance", role = "admin" }) {
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [proofs,       setProofs]       = useState([]);
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const uploadsSnap = await getDocs(collection(db, "user_announcements_upload"));
        const rawDocs = uploadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const enriched = await Promise.all(
          rawDocs.map(async (sub) => {
            const userId  = sub.userId || "";
            const barangay = await resolveBarangay(userId);

            let eventTitle = sub.fileName || "Attendance Proof";
            const annId = sub.announcementId || "";
            if (annId) {
              try {
                let evtSnap = await getDoc(doc(db, "announcements", annId));
                if (!evtSnap.exists()) evtSnap = await getDoc(doc(db, "calendar_notes", annId));
                if (evtSnap.exists()) {
                  const ed = evtSnap.data();
                  eventTitle = ed.title || ed.description || eventTitle;
                }
              } catch (_) {}
            }

            return {
              ...sub,
              barangay,
              eventTitle,
              userName:    sub.userName  || "Unknown",
              fileUrl:     sub.fileUrl   || sub.fileURL || "",
              submittedAt: sub.timestamp || sub.createdAt || Date.now(),
              date:        sub.timestamp || sub.createdAt || Date.now(),
            };
          })
        );

        enriched.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
        setProofs(enriched);
      } catch (err) {
        console.error("attendance load error", err);
        setError("Failed to load attendance data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Derived stats ──────────────────────────────────────────
  const totalSubmissions = proofs.length;
  const uniqueStudents   = new Set(proofs.map(p => p.userId || p.userName)).size;
  const uniqueEvents     = new Set(proofs.map(p => p.announcementId || p.eventTitle)).size;
  const latestSubmission = proofs[0]?.submittedAt || null;

  // Top barangays
  const barangayMap = useMemo(() => {
    const m = {};
    proofs.forEach(p => { m[p.barangay] = (m[p.barangay] || 0) + 1; });
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
  }, [proofs]);

  // Daily submissions (last 14 days)
  const dailyChart = useMemo(() => {
    const now = Date.now();
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d  = new Date(now - i * 86400000);
      const key = toDateKey(d.getTime());
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const count = proofs.filter(p => toDateKey(p.date) === key).length;
      if (count > 0) days.push({ label, count });
    }
    return days;
  }, [proofs]);

  // Monthly by event
  const monthlyByEvent = useMemo(() => {
    const m = {};
    proofs.forEach(p => {
      const mk = toDateKey(p.date).slice(0, 7);
      if (!m[mk]) m[mk] = { total: 0, events: {} };
      m[mk].total++;
      m[mk].events[p.eventTitle] = (m[mk].events[p.eventTitle] || 0) + 1;
    });
    return Object.entries(m)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([mk, v]) => {
        const topEvent = Object.entries(v.events).sort((a, b) => b[1] - a[1])[0];
        return {
          month:    formatMonthLabel(mk + "-01"),
          total:    v.total,
          topEvent: topEvent?.[0] || "—",
          topCount: topEvent?.[1] || 0,
        };
      });
  }, [proofs]);

  // Events ranking
  const eventRanking = useMemo(() => {
    const m = {};
    proofs.forEach(p => { m[p.eventTitle] = (m[p.eventTitle] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([event, count]) => ({ event, count }));
  }, [proofs]);

  // Filtered list
  const filteredList = useMemo(
    () => selectedDate ? proofs.filter(p => toDateKey(p.date) === selectedDate) : proofs,
    [proofs, selectedDate]
  );

  const COLORS = ["#1e3a8a","#1d4ed8","#2563eb","#3b82f6","#60a5fa","#93c5fd","#bfdbfe","#dbeafe"];

  return (
    <div className="att-root">
      <SidebarComponent activePage={activePage} role={role} />

      <main className="att-main">
        <div className="att-content">
          {error && <div className="att-error-banner">{error}</div>}

          <div className="att-page-intro">
            <h1>Attendance Monitoring</h1>
            <p>Track attendance submissions from uploaded proofs.</p>
          </div>

          {/* Stat Cards */}
          <div className="att-stat-row">
            <StatCard icon="👥" value={loading ? "…" : totalSubmissions}         label="Total Submissions" />
            <StatCard icon="🎓" value={loading ? "…" : uniqueStudents}           label="Unique Students"   />
            <StatCard icon="📣" value={loading ? "…" : uniqueEvents}             label="Events Covered"    />
            <StatCard icon="📅" value={loading ? "…" : formatDate(latestSubmission)} label="Latest Submission" />
          </div>

          {/* Charts */}
          <div className="att-chart-grid">

            {/* Top Barangays */}
            <div className="att-card">
              <div className="att-card-header">
                <div className="att-card-title">
                  <span style={{ color: "#1d4ed8" }}>📍</span> Top Barangays
                </div>
                <span className="att-card-subtitle">Last {barangayMap.length} shown</span>
              </div>
              {loading ? (
                <div className="att-chart-empty">Loading…</div>
              ) : barangayMap.length === 0 ? (
                <div className="att-chart-empty">No data yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={barangayMap} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {barangayMap.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Daily Chart */}
            <div className="att-card">
              <div className="att-card-header">
                <div className="att-card-title">
                  <span style={{ color: "#1d4ed8" }}>📊</span> Daily Submissions (last 14 days)
                </div>
              </div>
              {loading ? (
                <div className="att-chart-empty">Loading…</div>
              ) : dailyChart.length === 0 ? (
                <div className="att-chart-empty">No submissions in the last 14 days.</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyChart} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#1e3a8a" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Monthly by Event */}
          <div className="att-card">
            <div className="att-card-title att-card-title-blue" style={{ marginBottom: 16 }}>
              <span>📅</span> Monthly Attendance by Event
            </div>
            <div className="att-table-wrap">
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Total Submissions</th>
                    <th>Top Event</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="att-td-empty">Loading…</td></tr>
                  ) : monthlyByEvent.length === 0 ? (
                    <tr><td colSpan={4} className="att-td-empty">No data yet.</td></tr>
                  ) : monthlyByEvent.map((row, i) => (
                    <tr key={i}>
                      <td className="att-td-name">{row.month}</td>
                      <td style={{ color: "#1d4ed8", fontWeight: 700 }}>{row.total}</td>
                      <td>{row.topEvent}</td>
                      <td>{row.topCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Events ranking */}
          <div className="att-card">
            <div className="att-card-title att-card-title-blue" style={{ marginBottom: 16 }}>
              <span>📣</span> Events by Total Submissions
            </div>
            <div className="att-table-wrap">
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Submissions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={2} className="att-td-empty">Loading…</td></tr>
                  ) : eventRanking.length === 0 ? (
                    <tr><td colSpan={2} className="att-td-empty">No data yet.</td></tr>
                  ) : eventRanking.map((row, i) => (
                    <tr key={i}>
                      <td>{row.event}</td>
                      <td style={{ color: "#1d4ed8", fontWeight: 700 }}>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* All Submissions */}
          <div className="att-card">
            <div className="att-filter-bar">
              <div className="att-card-title">
                All Submissions
                <span className="att-count-badge">({filteredList.length} record{filteredList.length !== 1 ? "s" : ""})</span>
              </div>
              <div className="att-filter-row">
                <label className="att-filter-label">Filter by date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="att-date-input"
                />
                {selectedDate && (
                  <button className="att-clear-btn" onClick={() => setSelectedDate("")}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="att-table-wrap">
              <table className="att-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Barangay</th>
                    <th>Event</th>
                    <th>Date Submitted</th>
                    <th>Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="att-td-empty">Loading…</td></tr>
                  ) : filteredList.length === 0 ? (
                    <tr><td colSpan={6} className="att-td-empty">
                      {selectedDate ? "No submissions on this date." : "No submissions yet."}
                    </td></tr>
                  ) : filteredList.map((p, i) => (
                    <tr key={p.id}>
                      <td className="att-td-num">{i + 1}</td>
                      <td className="att-td-name">{p.userName}</td>
                      <td>
                        <span className="att-barangay-badge">{p.barangay}</span>
                      </td>
                      <td>{p.eventTitle}</td>
                      <td className="att-td-time">{formatDateTime(p.submittedAt)}</td>
                      <td>
                        {p.fileUrl ? (
                          <a href={p.fileUrl} target="_blank" rel="noreferrer" className="att-open-btn">
                            Open ↗
                          </a>
                        ) : (
                          <span className="att-no-file">— None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export { AttendanceAdmin as AttendancePage };
