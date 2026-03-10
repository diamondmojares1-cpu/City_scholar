import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  reload,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import logo from "../assets/cityscholar.png";
import "../css/AuthPage.css";

// ── Validation rules ──────────────────────────────────────
function validateName(value) {
  if (!value.trim())          return "Name is required.";
  if (value.trim().length < 2) return "Name must be at least 2 characters.";
  return "";
}

function validateEmail(value) {
  if (!value.trim())                        return "Email is required.";
  if (!value.trim().endsWith("@gmail.com")) return "Only Gmail accounts are allowed (must end with @gmail.com).";
  const parts = value.trim().split("@");
  if (!parts[0] || parts[0].length < 1)    return "Enter a valid Gmail address.";
  return "";
}

function validatePassword(value) {
  if (!value)           return "Password is required.";
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (!/[0-9]/.test(value))
    return "Password must contain at least one number (0–9).";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(value))
    return "Password must contain at least one special character (!@#$%^&* etc).";
  return "";
}

// ── Password strength meter ───────────────────────────────
function getPasswordStrength(value) {
  if (!value) return { score: 0, label: "", color: "" };
  let score = 0;
  if (value.length >= 8)  score++;
  if (value.length >= 12) score++;
  if (/[0-9]/.test(value))  score++;
  if (/[A-Z]/.test(value))  score++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(value)) score++;

  if (score <= 1) return { score: 1, label: "Weak",   color: "#ef4444" };
  if (score <= 2) return { score: 2, label: "Fair",   color: "#f97316" };
  if (score <= 3) return { score: 3, label: "Good",   color: "#eab308" };
  if (score <= 4) return { score: 4, label: "Strong", color: "#22c55e" };
  return             { score: 5, label: "Very Strong", color: "#16a34a" };
}

// ─────────────────────────────────────────────────────────
export default function Register() {
  const navigate = useNavigate();

  const [step,     setStep]     = useState(1);
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [info,     setInfo]     = useState("");

  // Per-field errors
  const [nameErr,  setNameErr]  = useState("");
  const [emailErr, setEmailErr] = useState("");
  const [passErr,  setPassErr]  = useState("");
  const [formErr,  setFormErr]  = useState(""); // firebase errors

  const pollRef    = useRef(null);
  const strength   = getPasswordStrength(password);

  // ── Real-time field validation on change ──────────────
  const handleNameChange = (v) => {
    setName(v);
    if (nameErr) setNameErr(validateName(v));
  };

  const handleEmailChange = (v) => {
    setEmail(v);
    if (emailErr) setEmailErr(validateEmail(v));
  };

  const handlePassChange = (v) => {
    setPassword(v);
    if (passErr) setPassErr(validatePassword(v));
  };

  // ── AUTO-POLL every 3s on step 2 ─────────────────────
  useEffect(() => {
    if (step !== 2) return;

    pollRef.current = setInterval(async () => {
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await reload(cred.user);
        const freshUser = auth.currentUser;
        if (freshUser?.emailVerified) {
          clearInterval(pollRef.current);
          navigate("/student-dashboard");
        } else {
          await signOut(auth);
        }
      } catch { /* ignore */ }
    }, 3000);

    return () => clearInterval(pollRef.current);
  }, [step]); // eslint-disable-line

  // ── Step 1: Validate all & register ──────────────────
  const handleRegister = async (e) => {
    e.preventDefault();
    setFormErr("");

    // Run all validations
    const nErr = validateName(name);
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);

    setNameErr(nErr);
    setEmailErr(eErr);
    setPassErr(pErr);

    // Stop if any field has an error
    if (nErr || eErr || pErr) return;

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await setDoc(doc(db, "users", cred.user.uid), {
        fullName:  name.trim(),
        email:     email.trim().toLowerCase(),
        role:      "student",
        createdAt: serverTimestamp(),
      });
      await sendEmailVerification(cred.user);
      await signOut(auth);
      setStep(2);
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use")
        setFormErr("This email is already registered. Please log in.");
      else
        setFormErr("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Manual check button ───────────────────────────────
  const handleManualCheck = async () => {
    setFormErr(""); setInfo("");
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await reload(cred.user);
      const freshUser = auth.currentUser;
      if (freshUser?.emailVerified) {
        clearInterval(pollRef.current);
        navigate("/student-dashboard");
      } else {
        await signOut(auth);
        setFormErr("Email not verified yet. Please click the link in your inbox first.");
      }
    } catch {
      setFormErr("Something went wrong. Please try again.");
    }
  };

  // ── Resend ────────────────────────────────────────────
  const handleResend = async () => {
    setFormErr(""); setInfo("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(cred.user);
      await signOut(auth);
      setInfo("Verification email resent! Check your inbox.");
    } catch (err) {
      if (err.code === "auth/too-many-requests")
        setFormErr("Too many attempts. Please wait a few minutes before resending.");
      else
        setFormErr("Failed to resend. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">

      {/* ── Left: Branding ── */}
      <div className="left">
        <img src={logo} alt="City Scholar" />
        <h2>CITY SCHOLAR</h2>
      </div>

      {/* ── Right ── */}
      <div className="right">

        {/* ══ STEP 1: Sign up form ══ */}
        {step === 1 && (
          <>
            <h2>Sign up</h2>
            <form onSubmit={handleRegister} noValidate>

              {/* Name */}
              <div className="field-group">
                <label htmlFor="reg-name">Full Name</label>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="e.g. Juan Dela Cruz"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={() => setNameErr(validateName(name))}
                  disabled={loading}
                  className={nameErr ? "input-error" : ""}
                />
                {nameErr && (
                  <span className="field-error">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 4a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0V5zm-.75 6a1 1 0 110-2 1 1 0 010 2z"/></svg>
                    {nameErr}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="field-group">
                <label htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
                  type="email"
                  placeholder="username@gmail.com"
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onBlur={() => setEmailErr(validateEmail(email))}
                  disabled={loading}
                  className={emailErr ? "input-error" : ""}
                />
                {emailErr && (
                  <span className="field-error">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 4a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0V5zm-.75 6a1 1 0 110-2 1 1 0 010 2z"/></svg>
                    {emailErr}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="field-group">
                <label htmlFor="reg-password">Password</label>
                <div className="password-wrap">
                  <input
                    id="reg-password"
                    type={showPass ? "text" : "password"}
                    placeholder="Min. 8 chars with number & symbol"
                    value={password}
                    onChange={(e) => handlePassChange(e.target.value)}
                    onBlur={() => setPassErr(validatePassword(password))}
                    disabled={loading}
                    className={passErr ? "input-error" : ""}
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPass((p) => !p)}
                    tabIndex={-1}
                  >
                    {showPass ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password strength bar */}
                {password && (
                  <div className="strength-wrap">
                    <div className="strength-bar">
                      {[1,2,3,4,5].map((i) => (
                        <div
                          key={i}
                          className="strength-segment"
                          style={{
                            background: i <= strength.score
                              ? strength.color
                              : "rgba(255,255,255,0.1)",
                          }}
                        />
                      ))}
                    </div>
                    <span className="strength-label" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                )}

                {/* Password rules hint */}
                {password && (
                  <div className="pass-rules">
                    <span className={password.length >= 8 ? "rule-ok" : "rule-fail"}>
                      {password.length >= 8 ? "✓" : "✗"} At least 8 characters
                    </span>
                    <span className={/[0-9]/.test(password) ? "rule-ok" : "rule-fail"}>
                      {/[0-9]/.test(password) ? "✓" : "✗"} Contains a number
                    </span>
                    <span className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) ? "rule-ok" : "rule-fail"}>
                      {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password) ? "✓" : "✗"} Contains a special character
                    </span>
                  </div>
                )}

                {passErr && (
                  <span className="field-error">
                    <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.75 4a.75.75 0 00-1.5 0v3.5a.75.75 0 001.5 0V5zm-.75 6a1 1 0 110-2 1 1 0 010 2z"/></svg>
                    {passErr}
                  </span>
                )}
              </div>

              {/* Firebase errors */}
              {formErr && <p className="error">{formErr}</p>}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading
                  ? <><span className="spinner" /> Creating Account…</>
                  : "Create Account"
                }
              </button>

              <p className="switch">
                Already have an account?{" "}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate("/login")}
                  onKeyDown={(e) => e.key === "Enter" && navigate("/login")}
                >
                  Login Now
                </span>
              </p>
            </form>
          </>
        )}

        {/* ══ STEP 2: Waiting for email verification ══ */}
        {step === 2 && (
          <div className="verify-screen">

            <div className="verify-icon-wrap">
              <svg viewBox="0 0 80 80" fill="none" className="verify-icon-svg">
                <rect x="6" y="18" width="68" height="48" rx="8"
                  fill="#1e3a8a" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
                <path d="M6 26 L40 48 L74 26"
                  stroke="#93c5fd" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="60" cy="56" r="16" fill="#22c55e"/>
                <path d="M53 56 L58 61 L67 50"
                  stroke="#fff" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h2>Verify Your Email</h2>

            <p className="verify-msg">
              We sent a verification link to<br />
              <strong>{email}</strong><br /><br />
              Open your Gmail and click the link.<br />
              You will be redirected automatically.
            </p>

            <div className="verify-waiting">
              <span className="verify-dot" />
              <span className="verify-dot" />
              <span className="verify-dot" />
              <span className="verify-waiting-text">Waiting for verification…</span>
            </div>

            {formErr && <p className="error">{formErr}</p>}
            {info    && <p className="info">{info}</p>}

            <button
              type="button"
              className="btn-primary"
              onClick={handleManualCheck}
              style={{ marginTop: "4px" }}
            >
              ✓ I already verified my email
            </button>

            <div className="resend-row">
              <span className="resend-timer">Didn't receive it? </span>
              <span
                role="button"
                tabIndex={0}
                className="resend-link"
                onClick={handleResend}
                onKeyDown={(e) => e.key === "Enter" && handleResend()}
              >
                {loading ? "Sending…" : "Resend Email"}
              </span>
            </div>

            <p className="spam-note">
              💡 Also check your <strong>Spam / Junk</strong> folder.
            </p>

            <span
              role="button"
              tabIndex={0}
              className="back-link"
              onClick={() => {
                clearInterval(pollRef.current);
                setStep(1); setFormErr(""); setInfo("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  clearInterval(pollRef.current);
                  setStep(1); setFormErr(""); setInfo("");
                }
              }}
            >
              ← Back
            </span>
          </div>
        )}

      </div>
    </div>
  );
}