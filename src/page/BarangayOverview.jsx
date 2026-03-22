// BarangayOverview.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { FaSearch, FaTimes, FaUsers } from "react-icons/fa";
import Sidebar from "../components/Sidebar.jsx";
import { fetchStudentRecords, groupStudentsByBarangay } from "../utils/scholarDataFetch.js";
import "../css/BarangayOverview.css";

// ─────────────────────────────────────────────────────────────
// Dagupan City Barangay Coordinates (expanded + aliases)
// ─────────────────────────────────────────────────────────────
const BARANGAY_COORDS = {
  "Bacayao Norte":     [16.0431, 120.3328],
  "Bacayao Sur":       [16.0401, 120.3338],
  "Barangay I":        [16.0433, 120.3396],
  "Barangay II":       [16.0443, 120.3406],
  "Barangay IV":       [16.0463, 120.3416],
  "Bonuan Binloc":     [16.0521, 120.3281],
  "Bonuan Boquig":     [16.0481, 120.3251],
  "Bonuan Gueset":     [16.0561, 120.3371],
  "Calmay":            [16.0381, 120.3471],
  "Carael":            [16.0341, 120.3501],
  "Caranglaan":        [16.0311, 120.3461],
  "Herrero":           [16.0471, 120.3431],
  "Herrero-Perez":     [16.0471, 120.3431],
  "Lasip Chico":       [16.0501, 120.3501],
  "Lasip Grande":      [16.0521, 120.3521],
  "Lomboy":            [16.0361, 120.3421],
  "Lucao":             [16.0551, 120.3451],
  "Malued":            [16.0291, 120.3381],
  "Mamalingling":      [16.0261, 120.3431],
  "Mangin":            [16.0411, 120.3551],
  "Mayombo":           [16.0491, 120.3461],
  "Pantal":            [16.0541, 120.3401],
  "Poblacion Oeste":   [16.0433, 120.3386],
  "Pogo Chico":        [16.0321, 120.3341],
  "Pogo Grande":       [16.0301, 120.3311],
  "Pugaro Suit":       [16.0571, 120.3321],
  "Quezon":            [16.0421, 120.3446],
  "Salapingao":        [16.0271, 120.3501],
  "Salisay":           [16.0351, 120.3381],
  "Tambac":            [16.0591, 120.3341],
  "Tapuac":            [16.0451, 120.3341],
  "Tebeng":            [16.0331, 120.3441],
  // Extra barangays that may come from Firebase
  "Bolosan":           [16.0510, 120.3510],
  "Perez":             [16.0465, 120.3425],
  "Boquig":            [16.0481, 120.3251],
  "Binloc":            [16.0521, 120.3281],
  "Gueset":            [16.0561, 120.3371],
};

const BARANGAY_ALIAS_MAP = {
  perez: "Herrero-Perez",
  boquig: "Bonuan Boquig",
  binloc: "Bonuan Binloc",
  gueset: "Bonuan Gueset",
};

const HIDDEN_BARANGAY_ALIASES = new Set(["Perez", "Boquig", "Binloc", "Gueset"]);
const DISPLAY_BARANGAYS = Object.keys(BARANGAY_COORDS).filter(function(name) {
  return !HIDDEN_BARANGAY_ALIASES.has(name);
});

function createBarangayEntry(name) {
  return {
    name: name,
    totalScholars: 0,
    students: [],
  };
}

function normalizeBarangayName(name) {
  var trimmed = (name || "").trim();
  if (!trimmed) return "Unknown";

  var lower = trimmed.toLowerCase();
  if (BARANGAY_ALIAS_MAP[lower]) return BARANGAY_ALIAS_MAP[lower];

  var exactMatch = DISPLAY_BARANGAYS.find(function(item) {
    return item.toLowerCase() === lower;
  });
  if (exactMatch) return exactMatch;

  return trimmed;
}

function buildBarangayOverviewData(groupedData) {
  var mergedMap = {};

  groupedData.forEach(function(item) {
    var normalizedName = normalizeBarangayName(item.name);

    if (!mergedMap[normalizedName]) {
      mergedMap[normalizedName] = createBarangayEntry(normalizedName);
    }

    mergedMap[normalizedName].totalScholars += item.totalScholars || 0;
    mergedMap[normalizedName].students = mergedMap[normalizedName].students.concat(item.students || []);
  });

  var knownBarangays = DISPLAY_BARANGAYS.map(function(name) {
    return mergedMap[name] || createBarangayEntry(name);
  });

  var extraBarangays = Object.values(mergedMap)
    .filter(function(item) { return !DISPLAY_BARANGAYS.includes(item.name); })
    .sort(function(a, b) { return a.name.localeCompare(b.name); });

  return knownBarangays.concat(extraBarangays);
}

// ─────────────────────────────────────────────────────────────
// Fuzzy barangay name matcher
// ─────────────────────────────────────────────────────────────
function findCoords(brgyName) {
  if (!brgyName) return null;

  if (BARANGAY_COORDS[brgyName]) return BARANGAY_COORDS[brgyName];

  const lower = brgyName.toLowerCase().trim();

  for (var key in BARANGAY_COORDS) {
    if (key.toLowerCase() === lower) return BARANGAY_COORDS[key];
  }

  for (var key2 in BARANGAY_COORDS) {
    var keyLower = key2.toLowerCase();
    if (lower.includes(keyLower) || keyLower.includes(lower)) {
      return BARANGAY_COORDS[key2];
    }
  }

  var words = lower.split(/[\s\-]+/);
  for (var key3 in BARANGAY_COORDS) {
    var keyWords = key3.toLowerCase().split(/[\s\-]+/);
    for (var i = 0; i < words.length; i++) {
      if (words[i].length > 3 && keyWords.indexOf(words[i]) !== -1) {
        return BARANGAY_COORDS[key3];
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  var s = ((status || "pending") + "").toLowerCase();
  var map = {
    approved: { label: "Approved", cls: "brgy-badge-approved" },
    rejected: { label: "Rejected", cls: "brgy-badge-rejected" },
    pending:  { label: "Pending",  cls: "brgy-badge-pending"  },
  };
  var item = map[s] || map["pending"];
  return React.createElement("span", { className: "brgy-badge " + item.cls }, item.label);
}

// ─────────────────────────────────────────────────────────────
// Leaflet Map Component
// ─────────────────────────────────────────────────────────────
function LeafletMap({ barangayData, onMarkerClick }) {
  const mapRef    = useRef(null);
  const mapObjRef = useRef(null);

  useEffect(() => {
    if (!document.getElementById("leaflet-css")) {
      var link = document.createElement("link");
      link.id   = "leaflet-css";
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (!window.L) {
      var script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = function() { initMap(); };
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return function() {
      if (mapObjRef.current) {
        mapObjRef.current.remove();
        mapObjRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mapObjRef.current && barangayData.length > 0) {
      addMarkers();
    }
  }, [barangayData]);

  function initMap() {
    if (mapObjRef.current || !mapRef.current) return;
    var L   = window.L;
    var map = L.map(mapRef.current).setView([16.0475, 120.3408], 13);
    mapObjRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);

    if (barangayData.length > 0) addMarkers();
  }

  function addMarkers() {
    var L   = window.L;
    var map = mapObjRef.current;
    if (!L || !map) return;

    map.eachLayer(function(layer) {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    var rendered = {};

    barangayData.forEach(function(brgyData) {
      var coords = findCoords(brgyData.name);
      if (!coords) return;

      var coordKey = coords[0] + "," + coords[1];
      if (rendered[coordKey]) {
        rendered[coordKey].count += brgyData.totalScholars;
        rendered[coordKey].names.push(brgyData.name);
        rendered[coordKey].brgyData = brgyData;
      } else {
        rendered[coordKey] = {
          coords: coords,
          count: brgyData.totalScholars,
          names: [brgyData.name],
          brgyData: brgyData,
        };
      }
    });

    Object.keys(BARANGAY_COORDS).forEach(function(brgyName) {
      var coords = BARANGAY_COORDS[brgyName];
      var coordKey = coords[0] + "," + coords[1];
      if (!rendered[coordKey]) {
        rendered[coordKey] = {
          coords: coords,
          count: 0,
          names: [brgyName],
          brgyData: null,
        };
      }
    });

    Object.keys(rendered).forEach(function(coordKey) {
      var item   = rendered[coordKey];
      var count  = item.count;
      var coords = item.coords;

      var color = count === 0 ? "#9ca3af"
        : count >= 10 ? "#1f2b6c"
        : count >= 5  ? "#3949ab"
        : "#6366f1";

      var size = count === 0 ? 28 : Math.min(28 + count * 3, 52);

      var icon = L.divIcon({
        className: "",
        html: '<div style="width:' + size + 'px;height:' + size + 'px;background:' + color + ';border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:' + (count >= 10 ? 11 : 13) + 'px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;">' + count + '</div>',
        iconSize:   [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      var marker = L.marker(coords, { icon }).addTo(map);

      var tooltipLabel = item.names.join(" / ");
      marker.bindTooltip(
        "<strong>" + tooltipLabel + "</strong><br/>" + count + " scholar" + (count !== 1 ? "s" : ""),
        { direction: "top", offset: [0, -size / 2] }
      );

      if (item.brgyData) {
        marker.on("click", function() { onMarkerClick(item.brgyData); });
      }
    });
  }

  return React.createElement("div", {
    ref: mapRef,
    style: { width: "100%", height: "100%", borderRadius: "12px", zIndex: 0 }
  });
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────
function BarangayOverview({ SidebarComponent = Sidebar, activePage = "barangay" }) {
  const [barangayData, setBarangayData] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [searchQuery, setSearchQuery]   = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [selectedBarangay, setSelectedBarangay] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        var students = await fetchStudentRecords();
        var grouped  = groupStudentsByBarangay(students);
        setBarangayData(buildBarangayOverviewData(grouped));
      } catch (error) {
        console.error("Error fetching barangay data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const maxCount = useMemo(function() {
    return Math.max(1, ...barangayData.map(function(b) { return b.totalScholars; }));
  }, [barangayData]);

  const filtered = useMemo(function() {
    var q = searchQuery.toLowerCase().trim();
    if (!q) return barangayData;
    return barangayData.filter(function(b) { return b.name.toLowerCase().includes(q); });
  }, [barangayData, searchQuery]);

  function openModal(barangay) {
    setSelectedBarangay(barangay);
    setShowModal(true);
  }

  function closeModal() {
    setSelectedBarangay(null);
    setShowModal(false);
  }

  return (
    <div className="barangay-container">
      <SidebarComponent activePage={activePage} />
      <main className="barangay-main">

        <div className="overview-container">
          <h2>Barangay Overview</h2>
          <p>Dagupan City, Pangasinan</p>

          <div className="content-wrapper">

            {/* Leaflet Map — sticky left column */}
            <div className="map-card">
              <h3>Map — Scholar Count per Barangay</h3>
              <div className="map-wrapper">
                {loading ? (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#6b7280" }}>
                    Loading map…
                  </div>
                ) : (
                  <LeafletMap barangayData={barangayData} onMarkerClick={openModal} />
                )}
              </div>
              <div className="map-legend">
                <span className="map-legend-item">
                  <span className="map-legend-dot" style={{ background: "#9ca3af" }} /> 0 scholars
                </span>
                <span className="map-legend-item">
                  <span className="map-legend-dot" style={{ background: "#6366f1" }} /> 1–4
                </span>
                <span className="map-legend-item">
                  <span className="map-legend-dot" style={{ background: "#3949ab" }} /> 5–9
                </span>
                <span className="map-legend-item">
                  <span className="map-legend-dot" style={{ background: "#1f2b6c" }} /> 10+
                </span>
              </div>
            </div>

            {/* Right panel — scrollable column */}
            <div className="right-panel">

              {/* Bar Chart */}
              <div className="chart-card">
                <h3>Scholars by Barangay</h3>
                {loading ? (
                  <p style={{ textAlign:"center", padding:"20px", color:"#777" }}>Loading…</p>
                ) : (
                  <div className="barangay-bar-chart">
                    {barangayData.filter(function(b) { return b.totalScholars > 0; }).length === 0 ? (
                      <p style={{ color: "#9ca3af", fontSize: "13px", padding: "20px 0" }}>No scholar data yet.</p>
                    ) : (
                      barangayData
                        .filter(function(b) { return b.totalScholars > 0; })
                        .sort(function(a, b) { return b.totalScholars - a.totalScholars; })
                        .map(function(b) {
                          var barHeight = ((b.totalScholars / maxCount) * 160) + "px";
                          return (
                            <div key={b.name} className="barangay-bar-column">
                              <span className="barangay-bar-count">{b.totalScholars}</span>
                              <div
                                className="barangay-bar"
                                style={{ height: barHeight }}
                                title={b.name + ": " + b.totalScholars}
                              />
                              <span className="barangay-bar-label" title={b.name}>{b.name}</span>
                            </div>
                          );
                        })
                    )}
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="table-card">
                <div className="brgy-table-header">
                  <h3>Barangay List</h3>
                  {!loading && (
                    <span className="brgy-total-badge">
                      {barangayData.reduce(function(s, b) { return s + b.totalScholars; }, 0)} Total Scholars
                    </span>
                  )}
                </div>

                <div className="brgy-list-search">
                  <div className="brgy-search-box">
                    <FaSearch />
                    <input
                      type="text"
                      placeholder="Search barangay..."
                      value={searchQuery}
                      onChange={function(e) { setSearchQuery(e.target.value); }}
                    />
                  </div>
                </div>

                {loading ? (
                  <p style={{ textAlign:"center", padding:"20px" }}>Loading…</p>
                ) : filtered.length === 0 ? (
                  <p style={{ textAlign:"center", padding:"20px", color:"#777" }}>
                    {searchQuery ? "No barangay matched your search." : "No data available"}
                  </p>
                ) : (
                  // ↓ Scroll wrapper — THIS is the key fix
                  <div className="table-scroll-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Barangay</th>
                          <th>Total Scholars</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(function(b) {
                          return (
                            <tr key={b.name}>
                              <td>{b.name}</td>
                              <td><span className="brgy-count-pill">{b.totalScholars}</span></td>
                              <td>
                                <button className="view-btn" onClick={() => openModal(b)}>View</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </main>

      {/* Modal */}
      {showModal && selectedBarangay && (
        <div className="brgy-overlay" onClick={closeModal}>
          <div className="brgy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="brgy-modal-head">
              <div className="brgy-modal-head-left">
                <FaUsers className="brgy-modal-icon" />
                <div>
                  <h2>{selectedBarangay.name}</h2>
                  <p>{selectedBarangay.totalScholars} scholar{selectedBarangay.totalScholars !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button className="brgy-close-btn" onClick={closeModal}><FaTimes /></button>
            </div>

            <div className="brgy-modal-body">
              {selectedBarangay.students.length === 0 ? (
                <p className="brgy-empty">No students found.</p>
              ) : (
                <table className="brgy-student-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Course</th>
                      <th>Year Level</th>
                      <th>GWA</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBarangay.students.map(function(s) {
                      return (
                        <tr key={s.id}>
                          <td className="brgy-student-name">{s.fullName}</td>
                          <td>{s.course}</td>
                          <td>{s.yearLevel}</td>
                          <td>{s.gwa}</td>
                          <td><StatusBadge status={s.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="brgy-modal-footer">
              <button className="brgy-close-action-btn" onClick={closeModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BarangayOverview;