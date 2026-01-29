import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Login.css";

const API = ""; // Use proxy configuration

function Login({ setToken }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Validate password length
    if (password.length > 72) {
      setError("⚠️ Password is too long. Please use a maximum of 72 characters.");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });

      if (res.data.access_token) {
        localStorage.setItem("token", res.data.access_token);
        localStorage.setItem("is_admin_session", "false");
        // Store refresh token if available
        if (res.data.refresh_token) {
          localStorage.setItem("refresh_token", res.data.refresh_token);
        }
        setToken(res.data.access_token);
        navigate("/user-dashboard");
      } else {
        setError("⚠️ Login failed: token missing");
      }
    } catch (err) {
      if (err.response && err.response.data.detail) {
        setError("⚠️ " + err.response.data.detail);
      } else if (err.request) {
        setError("⚠️ No response from server");
      } else {
        setError("⚠️ " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">🩺 MedAI</div>
          <h2 className="login-title">Welcome Back</h2>
          <p className="login-subtitle">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email Address</label>
            <input
              type="email"
              id="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary ${loading ? "loading" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="login-footer">
          <p>Don't have an account? 
            <button 
              className="login-link"
              onClick={() => navigate("/register")}
            >
              Sign up here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
