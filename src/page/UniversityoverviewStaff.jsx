// UniversityOverview.jsx (STAFF)
import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import SidebarStaff from "../components/SidebarStaff.jsx";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "../css/UniversityOverview.css";

const DAGUPAN_UNIVERSITIES = [
  {
    name:      "Lyceum-Northwestern University (LNU)",
    lat:       16.0432, lng: 120.3356,
    color:     "#8B0000", // Dark Red / Maroon — LNU's known red branding
    shortName: "LNU",
  },
  {
    name:      "Universidad de Dagupan",
    lat:       16.0435, lng: 120.3340,
    color:     "#1565C0", // Royal Blue — UDD's blue uniform/logo
    shortName: "UDD",
  },
  {
    name:      "PHINMA University of Pangasinan",
    lat:       16.0450, lng: 120.3370,
    color:     "#1B5E20", // Forest Green — UPang's known green branding
    shortName: "UPang",
  },
  {
    name:      "University of Luzon",
    lat:       16.0448, lng: 120.3348,
    color:     "#E65100", // Orange — UL's orange and blue colors
    shortName: "UL",
  },
  {
    name:      "Pangasinan Merchant Marine Academy",
    lat:       16.0398, lng: 120.3420,
    color:     "#0D47A1", // Navy Blue — maritime/academy navy
    shortName: "PMMA",
  },
  {
    name:      "Dagupan Colleges Foundation",
    lat:       16.0415, lng: 120.3330,
    color:     "#6A1B9A", // Purple — DCF's purple branding
    shortName: "DCF",
  },
  {
    name:      "STI College Dagupan",
    lat:       16.0460, lng: 120.3395,
    color:     "#B71C1C", // Red — STI's known red and white brand colors
    shortName: "STI",
  },
  {
    name:      "Mary Help of Christians College Seminary",
    lat:       16.0380, lng: 120.3310,
    color:     "#1A237E", // Deep Indigo — Catholic/religious institution blue
    shortName: "MHCCS",
  },
  {
    name:      "Kingfisher School of Business & Finance",
    lat:       16.0470, lng: 120.3360,
    color:     "#004D40", // Teal/Dark Green — Kingfisher's teal branding
    shortName: "KSBF",
  },
  {
    name:      "PIMSAT Colleges",
    lat:       16.0425, lng: 120.3380,
    color:     "#F57F17", // Amber/Gold — PIMSAT's gold branding
    shortName: "PIMSAT",
  },
  {
    name:      "Asiacareer College",
    lat:       16.0440, lng: 120.3315,
    color:     "#00695C", // Green Teal — Asiacareer's green identity
    shortName: "ACC",
  },
  {
    name:      "Graystone Academy",
    lat:       16.0405, lng: 120.3405,
    color:     "#37474F", // Blue Grey / Slate — Graystone's gray/professional tone
    shortName: "GRA",
  },
];
 
function getMarkerRadius(count) {
  if (count === 0) return 10;
  if (count <= 4)  return 16;
  if (count <= 9)  return 22;
  return 28;
}
 
// ── Bar Chart (pure SVG) ──────────────────────────────────────
function BarChart({ data }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
 
  return (
    <div className="uov-bar-chart">
      {data.map((d) => (
        <div key={d.name} className="uov-bar-column" title={`${d.name}: ${d.count}`}>
          <span className="uov-bar-count" style={{ color: d.color }}>
            {d.count}
          </span>
          <div
            className="uov-bar"
            style={{ height: `${Math.max(4, (d.count / max) * 100)}%`, background: d.color }}
          />
          <span className="uov-bar-label">{d.shortName}</span>
        </div>
      ))}
    </div>
  );
}
 
// ── Main Component ────────────────────────────────────────────
export default function UniversityOverview() {
  const [loading,       setLoading]       = useState(true);
  const [scholarCounts, setScholarCounts] = useState({});
  const [search,        setSearch]        = useState("");
  const [viewModal,     setViewModal]     = useState(null);
  const [error,         setError]         = useState(null);
 
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [appSnap, renewalSnap] = await Promise.all([
          getDocs(collection(db, "scholarship_applications")),
          getDocs(collection(db, "scholar_renewals")),
        ]);
 
        const counts  = {};
        const details = {};
 
        function processDoc(docSnap) {
          const data   = docSnap.data();
          const status = (
            data.status || data.applicationStatus ||
            data.scholarshipStatus || ""
          ).toLowerCase();
          if (status !== "approved") return;
          if (data.archived === true) return;
 
          const edu        = data.educationInfo || {};
          const personal   = data.personalInfo  || {};
          const schoolName = (edu.schoolName || data.schoolName || data.school || "").trim();
          if (!schoolName) return;
 
          const matched = DAGUPAN_UNIVERSITIES.find(u =>
            u.name.toLowerCase().includes(schoolName.toLowerCase()) ||
            schoolName.toLowerCase().includes(u.name.toLowerCase().split(" ")[0].toLowerCase())
          );
          const key = matched ? matched.name : schoolName;
 
          counts[key]  = (counts[key]  || 0) + 1;
          if (!details[key]) details[key] = [];
          details[key].push({
            id:        docSnap.id,
            name:      data.name || `${personal.firstName || ""} ${personal.lastName || ""}`.trim() || "—",
            course:    edu.course    || data.course    || "—",
            yearLevel: edu.yearLevel || data.yearLevel || "—",
            gwa:       edu.gwa       || data.gwa       || "—",
            status,
          });
        }
 
        appSnap.docs.forEach(processDoc);
        renewalSnap.docs.forEach(processDoc);
 
        setScholarCounts({ counts, details });
      } catch (err) {
        console.error("University load error:", err);
        setError("Failed to load data. Please refresh.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);
 
  const counts  = scholarCounts.counts  || {};
  const details = scholarCounts.details || {};
 
  const totalApproved = useMemo(
    () => Object.values(counts).reduce((s, n) => s + n, 0),
    [counts]
  );
 
  const universityList = useMemo(() =>
    DAGUPAN_UNIVERSITIES.map(u => ({
      ...u,
      count:    counts[u.name]  || 0,
      scholars: details[u.name] || [],
    })),
    [counts, details]
  );
 
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return universityList;
    return universityList.filter(u => u.name.toLowerCase().includes(q));
  }, [universityList, search]);
 
  const chartData = useMemo(
    () => universityList.filter(u => u.count > 0),
    [universityList]
  );
 
  const listToShow = useMemo(
    () => filtered.filter(u => u.count > 0),
    [filtered]
  );
 
  return (
    <div className="uov-root">
      <SidebarStaff activePage="university" />
 
      <main className="uov-main">
        <div className="uov-header">
          <div>
            <h1 className="uov-title">University Overview</h1>
            <p className="uov-subtitle">Dagupan City, Pangasinan — Approved scholars per university</p>
          </div>
          <div className="uov-total-badge">
            🎓 {loading ? "…" : totalApproved} Approved Scholar{totalApproved !== 1 ? "s" : ""}
          </div>
        </div>
 
        {error && <div className="uov-error">{error}</div>}
 
        <div className="uov-body">
 
          {/* ── LEFT: Map ── */}
          <div className="uov-map-card">
            <div className="uov-map-label">🏛 Map — Approved Scholars per University</div>
            <div className="uov-map-wrap">
              <MapContainer
                center={[16.0432, 120.3356]}
                zoom={14}
                className="uov-leaflet"
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {universityList.map(u => (
                  <CircleMarker
                    key={u.name}
                    center={[u.lat, u.lng]}
                    radius={getMarkerRadius(u.count)}
                    pathOptions={{
                      fillColor:   u.count === 0 ? "#94a3b8" : u.color,
                      fillOpacity: 0.9,
                      color:       "#fff",
                      weight:      2,
                    }}
                    eventHandlers={{
                      click: () => u.count > 0 && setViewModal(u),
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                      <div className="uov-tooltip">
                        <strong>{u.name}</strong><br />
                        {u.count} approved scholar{u.count !== 1 ? "s" : ""}
                      </div>
                    </Tooltip>
                    {u.count > 0 && (
                      <Tooltip permanent direction="center" className="uov-marker-label">
                        {u.count}
                      </Tooltip>
                    )}
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
 
            {/* Legend */}
            <div className="uov-legend">
              <span className="uov-legend-item"><span className="uov-dot" style={{ background: "#94a3b8" }} />0 scholars</span>
              <span className="uov-legend-item"><span className="uov-dot sm" style={{ background: "#555" }} />1–4</span>
              <span className="uov-legend-item"><span className="uov-dot md" style={{ background: "#555" }} />5–9</span>
              <span className="uov-legend-item"><span className="uov-dot lg" style={{ background: "#555" }} />10+</span>
            </div>
 
            {/* University color legend */}
            <div className="uov-color-legend">
              {DAGUPAN_UNIVERSITIES.map(u => (
                <span key={u.name} className="uov-color-legend-item">
                  <span className="uov-color-dot" style={{ background: u.color }} />
                  <span className="uov-color-label">{u.shortName}</span>
                </span>
              ))}
            </div>
          </div>
 
          {/* ── RIGHT: Chart + Table ── */}
          <div className="uov-right">
 
            {/* Bar Chart */}
            <div className="uov-chart-card">
              <h3 className="uov-card-title">Approved Scholars by University</h3>
              {loading ? (
                <p className="uov-loading-txt">Loading…</p>
              ) : chartData.length === 0 ? (
                <p className="uov-loading-txt">No approved scholars yet.</p>
              ) : (
                <BarChart data={chartData} />
              )}
            </div>
 
            {/* University List */}
            <div className="uov-list-card">
              <div className="uov-list-head">
                <div>
                  <h3 className="uov-card-title">University List</h3>
                  <p className="uov-list-sub">{totalApproved} Approved Scholar{totalApproved !== 1 ? "s" : ""}</p>
                </div>
                <div className="uov-search">
                  <span className="uov-search-ico">🔍</span>
                  <input
                    placeholder="Search university..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>
 
              <div className="uov-table-wrap">
                <table className="uov-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>University</th>
                      <th>Scholars</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={4} className="uov-td-center">Loading…</td></tr>
                    ) : listToShow.length === 0 ? (
                      <tr><td colSpan={4} className="uov-td-center">No universities with approved scholars yet.</td></tr>
                    ) : (
                      listToShow.map((u, i) => (
                        <tr key={u.name} className="uov-tr">
                          <td style={{ color: "#94a3b8", width: 32 }}>{i + 1}</td>
                          <td>
                            <div className="uov-uni-name">
                              <span className="uov-dot-inline" style={{ background: u.color }} />
                              {u.name}
                            </div>
                          </td>
                          <td>
                            <span
                              className="uov-count-badge"
                              style={{
                                background: u.color + "20",
                                color:      u.color,
                                border:     `1px solid ${u.color}50`,
                              }}
                            >
                              {u.count}
                            </span>
                          </td>
                          <td>
                            <button
                              className="uov-view-btn"
                              style={{ background: u.color }}
                              onClick={() => setViewModal(u)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>
 
      {/* ── Scholar Modal ── */}
      {viewModal && (
        <div className="uov-overlay" onClick={() => setViewModal(null)}>
          <div className="uov-modal" onClick={e => e.stopPropagation()}>
            <div className="uov-modal-head" style={{ background: viewModal.color }}>
              <div>
                <h2 className="uov-modal-title">{viewModal.name}</h2>
                <p className="uov-modal-sub">{viewModal.count} Approved Scholar{viewModal.count !== 1 ? "s" : ""}</p>
              </div>
              <button className="uov-modal-close" onClick={() => setViewModal(null)}>×</button>
            </div>
            <div className="uov-modal-body">
              {viewModal.scholars.length === 0 ? (
                <p className="uov-td-center">No scholars found.</p>
              ) : (
                <table className="uov-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Course</th>
                      <th>Year</th>
                      <th>GWA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewModal.scholars.map((s, i) => (
                      <tr key={s.id} className="uov-tr">
                        <td style={{ color: "#94a3b8" }}>{i + 1}</td>
                        <td style={{ fontWeight: 700, color: "#0f172a" }}>{s.name}</td>
                        <td>{s.course}</td>
                        <td>{s.yearLevel}</td>
                        <td>{s.gwa}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="uov-modal-footer">
              <button
                className="uov-close-btn"
                style={{ borderColor: viewModal.color, color: viewModal.color }}
                onClick={() => setViewModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
