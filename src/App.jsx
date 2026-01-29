import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import HomePage from "./HomePage";
import Login from "./Login";
import Register from "./Register";
import AdminLogin from "./AdminLogin";
import AdminRegister from "./AdminRegister";
import UserDashboard from "./UserDashboard";
import AdminDashboard from "./AdminDashboard";
import HeartDL from "./HeartDL";
import AlzheimerDL from "./AlzheimerDL";
import MedicalChat from "./MedicalChat";
import Navbar from "./Navbar";
import { clearTokens, isTokenExpired } from "./utils/auth.js";
import "./App.css";

const ADMIN_FLAG = "is_admin_session";

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [isAdmin, setIsAdmin] = useState(localStorage.getItem(ADMIN_FLAG) === "true");

  useEffect(() => {
    setIsAdmin(localStorage.getItem(ADMIN_FLAG) === "true");
  }, [token]);

  useEffect(() => {
    const checkExpiry = () => {
      const t = localStorage.getItem("token");
      if (t && isTokenExpired(t)) {
        clearTokens();
        setToken(null);
        setIsAdmin(false);
      }
    };
    checkExpiry();
    const interval = setInterval(checkExpiry, 60 * 1000);
    return () => clearInterval(interval);
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem(ADMIN_FLAG);
    setToken(null);
    setIsAdmin(false);
  };

  return (
    <Router>
      <div className="app">
        <Navbar token={token} onLogout={handleLogout} isAdmin={isAdmin} />
        <Routes>
          <Route path="/" element={<HomePage />} />

          {/* User Auth */}
          <Route path="/login" element={token ? <Navigate to="/user-dashboard" replace /> : <Login setToken={setToken} />} />
          <Route path="/register" element={token ? <Navigate to="/user-dashboard" replace /> : <Register />} />
          <Route path="/dashboard" element={<Navigate to="/user-dashboard" replace />} />

          {/* Admin Auth */}
          <Route path="/admin/login" element={token && isAdmin ? <Navigate to="/admin-dashboard" /> : <AdminLogin setToken={setToken} />} />
          <Route path="/admin/register" element={token && isAdmin ? <Navigate to="/admin-dashboard" /> : <AdminRegister setToken={setToken} />} />

          {/* User Dashboard */}
          <Route path="/user-dashboard" element={token ? <UserDashboard /> : <Navigate to="/login" />} />

          {/* Admin Dashboard */}
          <Route path="/admin-dashboard" element={token && isAdmin ? <AdminDashboard /> : <Navigate to="/admin/login" />} />

          {/* Prediction Pages */}
          <Route path="/heartdl" element={token ? <HeartDL token={token} /> : <Navigate to="/login" />} />
          <Route path="/alzheimerdl" element={token ? <AlzheimerDL token={token} /> : <Navigate to="/login" />} />
          <Route path="/medicalchat" element={token ? <MedicalChat token={token} /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
