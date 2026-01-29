import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./Register.css";

const API = "http://localhost:8000";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Validate password length
    if (password.length > 72) {
      setError("⚠️ Password is too long. Please use a maximum of 72 characters.");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post(`${API}/auth/register`, { 
        name, 
        email, 
        password 
      });

      if (res.data.ok) {
        setSuccess("🎉 Registration successful! Redirecting to login...");
        setName(""); 
        setEmail(""); 
        setPassword("");
        setTimeout(() => {
          navigate("/login");
        }, 1500);
      } else {
        setError("⚠️ Registration failed.");
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
    <div className="register-page">
      <div className="register-container">
        <div className="register-header">
          <div className="register-logo">🩺 MedAI</div>
          <h2 className="register-title">Create Account</h2>
          <p className="register-subtitle">Join our medical AI platform</p>
        </div>

        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="name" className="form-label">Full Name</label>
            <input
              type="text"
              id="name"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              required
            />
          </div>

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
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              required
              minLength="6"
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
                Creating Account...
              </>
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="register-footer">
          <p>Already have an account? 
            <button 
              className="register-link"
              onClick={() => navigate("/login")}
            >
              Sign in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
