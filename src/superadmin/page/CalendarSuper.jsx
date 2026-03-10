import React, { useState, useEffect } from "react";
import SidebarSuper from "../../components/SidebarSuper";
import { FaChevronDown, FaTimes, FaCalendarAlt } from "react-icons/fa";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { getCalendarCells, isToday, navigateMonth, formatMonthLabel, WEEKDAYS } from "../../utils/Calendarutils.js";
import "../../css/Calendarpage.css";

function toDateKey(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function buildEventMap(announcements = []) {
  const map = {};
  for (const ann of announcements) {
    const key = toDateKey(ann.date); if (!key) continue;
    if (!map[key]) map[key] = [];
    map[key].push(ann);
  }
  return map;
}
function formatLongDate(ms) {
  if (!ms) return "";
  return new Date(Number(ms)).toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric", year:"numeric" });
}

function EventModal({ events, onClose }) {
  return (
    <div className="cal-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cal-modal-box">
        <div className="cal-modal-header">
          <div className="cal-modal-header-left">
            <FaCalendarAlt className="cal-modal-icon" />
            <div>
              <p className="cal-modal-date">{formatLongDate(events[0]?.date)}</p>
              <h3 className="cal-modal-title">{events.length} Announcement{events.length > 1 ? "s" : ""}</h3>
            </div>
          </div>
          <button className="cal-modal-close-btn" onClick={onClose}><FaTimes /></button>
        </div>
        <div className="cal-modal-events">
          {events.map((ev, i) => (
            <div key={ev.id || i} className="cal-modal-event-card">
              {ev.imageURL && !ev.imageURL.startsWith("blob:") && <div className="cal-modal-img-wrap"><img src={ev.imageURL} alt={ev.title} className="cal-modal-img" /></div>}
              <div className="cal-modal-event-body">
                <h4 className="cal-modal-event-title">{ev.title}</h4>
                {ev.description && <p className="cal-modal-event-desc">{ev.description}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="cal-modal-footer"><button className="cal-modal-dismiss-btn" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

export default function CalendarSuper() {
  const today = new Date();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [viewMode, setViewMode] = useState("Month");
  const [dropdownOpen, setDropdown] = useState(false);
  const [eventMap, setEventMap] = useState({});
  const [modalEvents, setModal] = useState(null);

  useEffect(() => {
    getDocs(query(collection(db, "calendar_notes"), orderBy("date", "asc")))
      .then(snap => { const data = snap.docs.map(d => ({ ...d.data(), id: d.id })); setEventMap(buildEventMap(data)); })
      .catch(console.error);
  }, []);

  const cells = getCalendarCells(view.year, view.month);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function prev() { setView(v => navigateMonth(v, -1)); }
  function next() { setView(v => navigateMonth(v, +1)); }
  function handleDayClick(cell) {
    if (!cell.day) return;
    const key = `${view.year}-${String(view.month+1).padStart(2,"0")}-${String(cell.day).padStart(2,"0")}`;
    const evs = eventMap[key];
    if (evs && evs.length > 0) setModal(evs);
  }

  return (
    <div className="cal-container">
      <SidebarSuper activePage="calendar" />
      <main className="cal-main">
        <h1 className="cal-page-title">Calendar</h1>
        <div className="cal-controls">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={prev}>&lt;</button>
            <button className="cal-nav-btn" onClick={next}>&gt;</button>
            <span className="cal-month-label">{formatMonthLabel(view.year, view.month)}</span>
          </div>
          <div className="cal-dropdown-wrap">
            <button className="cal-view-btn" onClick={() => setDropdown(o => !o)}>
              {viewMode}<FaChevronDown className={`cal-chevron ${dropdownOpen?"cal-chevron-open":""}`} />
            </button>
            {dropdownOpen && (
              <div className="cal-dropdown">
                {["Month","Week","Day"].map(opt => (
                  <button key={opt} className={`cal-dropdown-item ${viewMode===opt?"cal-dropdown-active":""}`} onClick={() => { setViewMode(opt); setDropdown(false); }}>{opt}</button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="cal-grid-wrap">
          <table className="cal-grid">
            <thead><tr>{WEEKDAYS.map(d => <th key={d} className="cal-weekday">{d}</th>)}</tr></thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((cell, di) => {
                    const todayCell = cell.day && isToday(cell.day, view.month, view.year);
                    const key = cell.day ? `${view.year}-${String(view.month+1).padStart(2,"0")}-${String(cell.day).padStart(2,"0")}` : null;
                    const dayEvents = key ? (eventMap[key] || []) : [];
                    return (
                      <td key={di} className={["cal-cell", !cell.day?"cal-cell-empty":"", todayCell?"cal-cell-today":"", dayEvents.length>0?"cal-cell-has-events":""].filter(Boolean).join(" ")} onClick={() => handleDayClick(cell)}>
                        {cell.day && (
                          <>
                            <span className={`cal-day-num ${todayCell?"cal-today-num":""}`}>{cell.day}</span>
                            <div className="cal-event-chips">
                              {dayEvents.slice(0,2).map((ev,ei) => <div key={ei} className="cal-event-chip">{ev.title}</div>)}
                              {dayEvents.length > 2 && <div className="cal-event-more">+{dayEvents.length-2} more</div>}
                            </div>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      {modalEvents && <EventModal events={modalEvents} onClose={() => setModal(null)} />}
    </div>
  );
}