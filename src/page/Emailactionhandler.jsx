import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { applyActionCode, onAuthStateChanged, reload } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import "../css/AuthPage.css";

// ─────────────────────────────────────────────────────────
// Firebase redirects HERE after user clicks the link in Gmail.
// URL will look like: /?mode=verifyEmail&oobCode=XXXXXX
//
// REQUIRED SETUP (one-time):
// Firebase Console → Authentication → Templates
//   → Email address verification → Edit → Action URL
//   → Set to: http://localhost:5173/  (or your domain)
// ─────────────────────────────────────────────────────────

export default function EmailActionHandler() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const mode    = params.get("mode");
    const oobCode = params.get("oobCode");

    // Not a Firebase action link → go to login
    if (!mode || !oobCode) {
      navigate("/login");
      return;
    }

    if (mode === "verifyEmail") {
      handleVerify(oobCode);
    } else if (mode === "resetPassword") {
      navigate(`/reset-password?oobCode=${oobCode}`);
    } else {
      navigate("/login");
    }
  }, []); // eslint-disable-line

  const handleVerify = async (oobCode) => {
    try {
      // 1. Apply the verification code → sets emailVerified = true on Firebase
      await applyActionCode(auth, oobCode);

      setStatus("success");

      // 2. If already signed in, reload and go straight to dashboard
      const user = auth.currentUser;
      if (user) {
        await reload(user);
        setTimeout(() => navigate("/student-dashboard", { replace: true }), 1500);
        return;
      }

      // 3. Not signed in → listen for auth state
      //    Register page polling will sign the user in within 3s
      //    and this listener will catch it
      const unsub = onAuthStateChanged(auth, async (u) => {
        if (u) {
          await reload(u);
          if (u.emailVerified) {
            unsub();
            setTimeout(() => navigate("/student-dashboard", { replace: true }), 1000);
          }
        }
      });

      // Fallback: if still not redirected after 5s, go to login
      setTimeout(() => {
        unsub();
        navigate("/login", { replace: true });
      }, 5000);

    } catch (err) {
      console.error("applyActionCode error:", err);

      if (
        err.code === "auth/invalid-action-code" ||
        err.code === "auth/expired-action-code"
      ) {
        setStatus("used");
      } else {
        setStatus("error");
        setErrMsg(err.message || "Verification failed.");
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #2b2f4a, #1c1f33)",
        fontFamily: "'Nunito', sans-serif",
        padding: 20,
      }}
    >
      <div className="container" style={{ maxWidth: 620, minHeight: 340 }}>

        {/* Left branding */}
        <div className="left" style={{ width: 200 }}>
          <svg viewBox="0 0 40 40" fill="none" style={{ width: 70, height: 70 }}>
            <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.1)"/>
            <path d="M20 8L8 15l12 6 12-6-12-7zM8 17v6l12 6 12-6v-6l-12 6L8 17z" fill="#fff"/>
          </svg>
          <h2 style={{ fontSize: "0.9rem", letterSpacing: 2 }}>CITY SCHOLAR</h2>
        </div>

        {/* Right: status */}
        <div className="right" style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 12 }}>

          {/* ── LOADING ── */}
          {status === "loading" && (
            <>
              <span className="spinner" style={{ width: 44, height: 44, borderWidth: 4, marginBottom: 8 }} />
              <h2 style={{ fontSize: "1.4rem", fontWeight: 900 }}>Verifying your email…</h2>
              <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Please wait a moment.</p>
            </>
          )}

          {/* ── SUCCESS ── */}
          {status === "success" && (
            <>
              <svg viewBox="0 0 80 80" fill="none" style={{ width: 90, height: 90, marginBottom: 4 }}>
                <circle cx="40" cy="40" r="40" fill="rgba(34,197,94,0.15)"/>
                <circle cx="40" cy="40" r="30" fill="#22c55e"/>
                <path d="M25 40 L35 50 L55 30"
                  stroke="#fff" strokeWidth="4"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 style={{ fontSize: "1.6rem", fontWeight: 900 }}>Email Verified!</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 4 }}>
                Redirecting you to your Student Dashboard…
              </p>
              <div className="verify-waiting" style={{ marginTop: 12 }}>
                <span className="verify-dot" />
                <span className="verify-dot" />
                <span className="verify-dot" />
                <span className="verify-waiting-text">Taking you to your dashboard</span>
              </div>
            </>
          )}

          {/* ── LINK ALREADY USED ── */}
          {status === "used" && (
            <>
              <svg viewBox="0 0 80 80" fill="none" style={{ width: 90, height: 90, marginBottom: 4 }}>
                <circle cx="40" cy="40" r="40" fill="rgba(251,191,36,0.15)"/>
                <circle cx="40" cy="40" r="30" fill="#f59e0b"/>
                <text x="40" y="52" textAnchor="middle" fill="#fff" fontSize="28" fontWeight="900">!</text>
              </svg>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 900 }}>Link Already Used</h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: "8px 0 16px" }}>
                This verification link has already been used or expired.<br />
                If your email is verified, just log in.
              </p>
              <button className="btn-primary" onClick={() => navigate("/login")}>
                Go to Login
              </button>
            </>
          )}

          {/* ── ERROR ── */}
          {status === "error" && (
            <>
              <svg viewBox="0 0 80 80" fill="none" style={{ width: 90, height: 90, marginBottom: 4 }}>
                <circle cx="40" cy="40" r="40" fill="rgba(239,68,68,0.15)"/>
                <circle cx="40" cy="40" r="30" fill="#ef4444"/>
                <path d="M28 28 L52 52 M52 28 L28 52"
                  stroke="#fff" strokeWidth="4" strokeLinecap="round"/>
              </svg>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 900 }}>Verification Failed</h2>
              <p className="error" style={{ marginTop: 8, textAlign: "left" }}>{errMsg}</p>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/register")}>
                Back to Sign Up
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  );
}