import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "./AdminRegister.css";

const API = "http://localhost:8000";

export default function AdminRegister() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const register = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axios.post(`${API}/auth/register`, {
        email,
        password,
        is_admin: true,
      });
      nav("/admin/login");
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-register-page">
      <div className="admin-register-container">
        <div className="admin-register-header">
          <div className="admin-register-icon">👤</div>
          <h2 className="admin-register-title">Admin Registration</h2>
          <p className="admin-register-subtitle">Create a new administrator account</p>
        </div>

        <form onSubmit={register} className="admin-register-form">
          <div className="form-group">
            <label htmlFor="admin-reg-email" className="form-label">Email</label>
            <input
              id="admin-reg-email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="admin-reg-password" className="form-label">Password</label>
            <input
              id="admin-reg-password"
              type="password"
              placeholder="Create a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
              minLength={6}
            />
          </div>

          {error && <div className="admin-register-error">{error}</div>}

          <button type="submit" className="btn-admin-register" disabled={loading}>
            {loading ? (
              <>
                <span className="admin-register-spinner"></span>
                Creating Admin…
              </>
            ) : (
              "Create Admin"
            )}
          </button>
        </form>

        <div className="admin-register-footer">
          <Link to="/admin/login">Already have an admin account? Sign in</Link>
          <br />
          <Link to="/" className="back-home">← Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
