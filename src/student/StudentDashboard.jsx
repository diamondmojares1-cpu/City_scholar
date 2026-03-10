import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import Sidebar, { NAV_ITEMS } from "../components/Sidebar-s.jsx";
import "./css/StudentDashboard.css";
import "../css/Sidebar-s.css";

const Icon = {
  bell:   <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4a2 2 0 002 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>,
  user:   <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>,
  search: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>,
  arrow:  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>,
};

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [active, setActive] = useState("home");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { navigate("/login"); return; }
    getDoc(doc(db, "users", user.uid)).then(snap => {});
  }, [navigate]);

  return (
    <div className="sd-root">
      <Sidebar active={active} setActive={setActive} />

      <main className="sd-main">
        {/* Top bar */}
        <header className="sd-topbar">
          <div className="sd-search-wrap">
            <span className="sd-search-icon">{Icon.search}</span>
            <input
              className="sd-search"
              placeholder="Search"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="sd-topbar-actions">
            <button className="sd-icon-btn">
              {Icon.bell}
              <span className="sd-notif-dot" />
            </button>
            <button className="sd-icon-btn sd-avatar">{Icon.user}</button>
          </div>
        </header>

        {/* Page content */}
        <div className="sd-content">
          {active === "home" && (
            <section className="sd-hero">
              <div className="sd-hero-bg">
                <div className="sd-beam sd-beam-1" />
                <div className="sd-beam sd-beam-2" />
                <div className="sd-beam sd-beam-3" />
              </div>
              <div className="sd-hero-content">
                <h1>Mapping Your Future</h1>
                <p>A seamless scholarship journey with our all-in-one city portal.</p>
                <button className="sd-hero-btn" onClick={() => setActive("scholar")}>
                  Get Started
                  <span className="sd-hero-arrow">{Icon.arrow}</span>
                </button>
              </div>
            </section>
          )}

          {active !== "home" && (
            <div className="sd-placeholder">
              <div className="sd-placeholder-icon">
                {NAV_ITEMS.find(n => n.key === active)?.icon}
              </div>
              <h2>{NAV_ITEMS.find(n => n.key === active)?.label}</h2>
              <p>This section is under construction.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}