import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./AdminLogin.css";

const API = "http://localhost:8000";
const ADMIN_FLAG = "is_admin_session";

export default function AdminLogin({ setToken }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const login = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      const token = res.data.access_token || res.data.token;
      if (!token) throw new Error("Token missing");

      const isAdmin = res.data.user?.is_admin === true;
      localStorage.setItem("token", token);
      localStorage.setItem(ADMIN_FLAG, isAdmin ? "true" : "false");
      setToken(token);

      if (isAdmin) {
        nav("/admin-dashboard");
      } else {
        setError("This account is not an administrator. Redirecting to User Dashboard.");
        setTimeout(() => nav("/user-dashboard"), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-container">
        <div className="admin-login-header">
          <div className="admin-login-icon">🛡️</div>
          <h2 className="admin-login-title">Admin Portal</h2>
          <p className="admin-login-subtitle">Sign in with your administrator account</p>
        </div>

        <form onSubmit={login} className="admin-login-form">
          <div className="form-group">
            <label htmlFor="admin-email" className="form-label">Email</label>
            <input
              id="admin-email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-password" className="form-label">Password</label>
            <input
              id="admin-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
            />
          </div>

          {error && <div className="admin-login-error">{error}</div>}

          <button type="submit" className="btn-admin" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="admin-login-footer">
          <Link to="/admin/register">Register as Admin</Link>
          <br />
          <Link to="/" className="back-home">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
