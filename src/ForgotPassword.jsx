import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    sendPasswordResetEmail,
    confirmPasswordReset,
    verifyPasswordResetCode,
    signInWithEmailAndPassword,
    updatePassword,
} from "firebase/auth";
import { auth } from "./firebase/firebaseConfig";
import logo from "./assets/cityscholar.png";
import "./css/Forgotpasswords.css";

// ── Password strength checker ──────────────────────────────
function getStrength(pw) {
    let score = 0;
    if (pw.length >= 8)              score++;
    if (/[0-9]/.test(pw))            score++;
    if (/[^A-Za-z0-9]/.test(pw))     score++;
    if (pw.length >= 12)             score++;
    return score; // 0-4
}
const STRENGTH_LABELS = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLORS = ["", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e"];

export default function ForgotPassword() {
    const navigate = useNavigate();

    // steps: "form" | "verify"
    const [step,            setStep]            = useState("form");
    const [email,           setEmail]           = useState("");
    const [newPassword,     setNewPassword]     = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNew,         setShowNew]         = useState(false);
    const [showConfirm,     setShowConfirm]     = useState(false);
    const [loading,         setLoading]         = useState(false);
    const [resending,       setResending]       = useState(false);
    const [err,             setErr]             = useState("");
    const [successMsg,      setSuccessMsg]      = useState("");

    const strength      = getStrength(newPassword);
    const strengthLabel = newPassword ? STRENGTH_LABELS[strength] : "";
    const strengthColor = newPassword ? STRENGTH_COLORS[strength] : "";

    const checks = [
        { label: "At least 8 characters",    ok: newPassword.length >= 8  },
        { label: "Contains a number",         ok: /[0-9]/.test(newPassword) },
        { label: "Contains a special character", ok: /[^A-Za-z0-9]/.test(newPassword) },
    ];

    // ── Poll for email verification every 3s ──────────────
    useEffect(() => {
        if (step !== "verify") return;
        const interval = setInterval(async () => {
            try {
                await auth.currentUser?.reload();
                if (auth.currentUser?.emailVerified) {
                    clearInterval(interval);
                    // update password then redirect
                    await updatePassword(auth.currentUser, newPassword);
                    navigate("/");
                }
            } catch {}
        }, 3000);
        return () => clearInterval(interval);
    }, [step, newPassword, navigate]);

    // ── Submit form ────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr(""); setSuccessMsg("");

        if (!email.trim())                   { setErr("Please enter your email address."); return; }
        if (!newPassword)                    { setErr("Please enter a new password."); return; }
        if (newPassword.length < 8)          { setErr("Password must be at least 8 characters."); return; }
        if (newPassword !== confirmPassword) { setErr("Passwords do not match."); return; }

        setLoading(true);
        try {
            await sendPasswordResetEmail(auth, email.trim());
            setStep("verify");
        } catch (error) {
            if (error.code === "auth/user-not-found")    setErr("No account found with this email.");
            else if (error.code === "auth/invalid-email") setErr("Please enter a valid email address.");
            else setErr("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Already verified button ────────────────────────────
    const handleAlreadyVerified = async () => {
        setLoading(true); setErr("");
        try {
            await auth.currentUser?.reload();
            if (auth.currentUser?.emailVerified) {
                await updatePassword(auth.currentUser, newPassword);
                navigate("/");
            } else {
                setErr("Email not yet verified. Please click the link in your email first.");
            }
        } catch {
            setErr("Could not verify. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // ── Resend email ───────────────────────────────────────
    const handleResend = async () => {
        setResending(true); setErr(""); setSuccessMsg("");
        try {
            await sendPasswordResetEmail(auth, email.trim());
            setSuccessMsg("Reset email resent!");
        } catch {
            setErr("Failed to resend. Please try again.");
        } finally {
            setResending(false);
        }
    };

    // ── Eye icon SVG ───────────────────────────────────────
    const EyeOff = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
    );
    const EyeOn = () => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>
    );

    return (
        <div className="fp-bg">
            <div className="fp-card-wrapper">

                {/* ══ LEFT: Logo panel ══ */}
                <div className="fp-left">
                    <img src={logo} alt="City Scholar" className="fp-logo" />
                    <p className="fp-brand">CITY SCHOLAR</p>
                </div>

                {/* ══ RIGHT: Form or Verify panel ══ */}
                <div className="fp-right">

                    {step === "form" ? (
                        <>
                            <h2 className="fp-title">Forgot Password</h2>

                            <form onSubmit={handleSubmit} className="fp-form">
                                <div className="fp-field">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        placeholder="username@gmail.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="fp-field">
                                    <label>New Password</label>
                                    <div className="fp-input-wrap">
                                        <input
                                            type={showNew ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                        <button type="button" className="fp-eye" onClick={() => setShowNew(!showNew)}>
                                            {showNew ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>

                                    {/* Strength bar */}
                                    {newPassword && (
                                        <>
                                            <div className="fp-strength-bar">
                                                {[1,2,3,4].map(i => (
                                                    <div key={i} className="fp-strength-seg" style={{ background: i <= strength ? strengthColor : "rgba(255,255,255,0.1)" }} />
                                                ))}
                                                <span className="fp-strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
                                            </div>
                                            <div className="fp-checks">
                                                {checks.map(c => (
                                                    <span key={c.label} className={c.ok ? "fp-check ok" : "fp-check"}>
                                                        {c.ok ? "✓" : "✗"} {c.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="fp-field">
                                    <label>Confirm Password</label>
                                    <div className="fp-input-wrap">
                                        <input
                                            type={showConfirm ? "text" : "password"}
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                        <button type="button" className="fp-eye" onClick={() => setShowConfirm(!showConfirm)}>
                                            {showConfirm ? <EyeOff /> : <EyeOn />}
                                        </button>
                                    </div>
                                </div>

                                {err && <p className="fp-err">{err}</p>}

                                <button type="submit" className="fp-submit" disabled={loading}>
                                    {loading ? "Sending…" : "Confirm"}
                                </button>
                            </form>

                            <span className="fp-back-login" onClick={() => navigate("/")}>
                                Already have an account? <strong>Login Now</strong>
                            </span>
                        </>
                    ) : (
                        /* ══ Verify Email step ══ */
                        <div className="fp-verify">
                            <div className="fp-verify-icon">
                                <svg viewBox="0 0 24 24" fill="none" className="fp-mail-svg">
                                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="#1e3a8a" stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
                                    <path d="M22 6l-10 7L2 6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none"/>
                                </svg>
                                <div className="fp-verify-check">
                                    <svg viewBox="0 0 24 24" fill="white" width="14" height="14"><path d="M20 6L9 17l-5-5"/></svg>
                                </div>
                            </div>

                            <h2 className="fp-title">Verify Your Email</h2>

                            <p className="fp-verify-text">We sent a verification link to</p>
                            <p className="fp-verify-email">{email}</p>

                            <p className="fp-verify-sub">
                                Open your Gmail and click the link.<br/>
                                You will be redirected automatically.
                            </p>

                            <div className="fp-waiting">
                                <span className="fp-dot" /><span className="fp-dot" /><span className="fp-dot" />
                                Waiting for verification...
                            </div>

                            {err        && <p className="fp-err">{err}</p>}
                            {successMsg && <p className="fp-msg">{successMsg}</p>}

                            <button className="fp-submit" onClick={handleAlreadyVerified} disabled={loading}>
                                {loading ? "Checking…" : "✓ I already verified my email"}
                            </button>

                            <div className="fp-verify-footer">
                                <span>Didn't receive it? <strong className="fp-resend" onClick={handleResend}>{resending ? "Resending…" : "Resend Email"}</strong></span>
                                <span className="fp-spam">💡 Also check your <strong>Spam / Junk</strong> folder.</span>
                                <span className="fp-back-link" onClick={() => setStep("form")}>← Back</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}