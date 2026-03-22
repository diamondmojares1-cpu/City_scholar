import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  reload,
  signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebaseConfig";
import { isGmail, isValidPassword } from "../utils/validation";
import logo from "../assets/cityscholar.png";
import "../css/AuthPage.css";

function Login() {
  const navigate  = useNavigate();
  const [error,    setError]    = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const email    = e.target.email.value;
    const password = e.target.password.value;

    if (!isGmail(email))            return setError("Gmail accounts only.");
    if (!isValidPassword(password)) return setError("Invalid password format.");

    setLoading(true);
    try {
      // 1. Sign in
      const res = await signInWithEmailAndPassword(auth, email, password);

      // 2. Force reload to get latest data from Firebase server
      await reload(res.user);
      const freshUser = auth.currentUser;

      // 3. Get role from Firestore FIRST
      const snap = await getDoc(doc(db, "users", freshUser.uid));
      if (!snap.exists()) {
        await signOut(auth);
        return setError("Account not found. Please register first.");
      }

      const { role } = snap.data();

      // 4. Email verification check — SKIP for admin, superadmin, and staff accounts
      //    These accounts are created manually by admin and don't need email verification
      if (role !== "admin" && role !== "superadmin" && role !== "staff" && !freshUser.emailVerified) {
        await signOut(auth);
        return setError(
          "Your email is not verified yet. Please check your Gmail and click the verification link."
        );
      }

      // 5. Redirect based on role
      if (role === "superadmin") {
        navigate("/superadmin-dashboard");
      } else if (role === "admin") {
        navigate("/admin-dashboard");
      } else if (role === "staff") {
        navigate("/staff-dashboard");
      } else {
        navigate("/student-dashboard");
      }

    } catch (err) {
      console.error("Login error:", err);
      if (
        err.code === "auth/user-not-found"     ||
        err.code === "auth/wrong-password"     ||
        err.code === "auth/invalid-credential" ||
        err.code === "auth/invalid-email"
      ) {
        setError("Invalid email or password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else if (err.code === "auth/user-disabled") {
        setError("This account has been disabled. Please contact support.");
      } else {
        setError("Login failed. Please try again.");
      }
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

      {/* ── Right: Form ── */}
      <div className="right">
        <h2>Log In</h2>

        <form onSubmit={handleLogin}>

          <div className="field-group">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="username@gmail.com"
              required
              disabled={loading}
            />
          </div>

          <div className="field-group">
            <label htmlFor="login-password">Password</label>
            <div className="password-wrap">
              <input
                id="login-password"
                name="password"
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                required
                disabled={loading}
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
          </div>

          <div className="forgot-row">
            <span
              role="button"
              tabIndex={0}
              className="forgot-link"
              onClick={() => navigate("/forgot-password")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/forgot-password")}
            >
              Forgot Password?
            </span>
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : "Log In"}
          </button>

          <p className="switch">
            Don't have an account?{" "}
            <span
              role="button"
              tabIndex={0}
              onClick={() => navigate("/register")}
              onKeyDown={(e) => e.key === "Enter" && navigate("/register")}
            >
              Sign up
            </span>
          </p>

        </form>
      </div>
    </div>
  );
}

export default Login;
