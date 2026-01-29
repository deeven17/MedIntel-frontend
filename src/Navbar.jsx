import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";

const Navbar = ({ token, onLogout, isAdmin = false }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          🩺 MedAI
        </Link>

        <div className={`navbar-menu ${isMenuOpen ? 'active' : ''}`}>
          <div className="navbar-links">
            {!token ? (
              <>
                <Link 
                  to="/login" 
                  className={`navbar-link ${isActive('/login') ? 'active' : ''}`}
                >
                  User Login
                </Link>
                <Link 
                  to="/register" 
                  className={`navbar-link ${isActive('/register') ? 'active' : ''}`}
                >
                  User Register
                </Link>
                <Link 
                  to="/admin/login" 
                  className={`navbar-link admin-link ${isActive('/admin/login') ? 'active' : ''}`}
                >
                  Admin Login
                </Link>
                <Link 
                  to="/admin/register" 
                  className={`navbar-link admin-link ${isActive('/admin/register') ? 'active' : ''}`}
                >
                  Admin Register
                </Link>
              </>
            ) : (
              <>
                {isAdmin ? (
                  <>
                    <Link 
                      to="/admin-dashboard" 
                      className={`navbar-link ${isActive('/admin-dashboard') ? 'active' : ''}`}
                    >
                      Admin Dashboard
                    </Link>
                    <Link 
                      to="/user-dashboard" 
                      className={`navbar-link ${isActive('/user-dashboard') ? 'active' : ''}`}
                    >
                      User Dashboard
                    </Link>
                  </>
                ) : (
                  <>
                    <Link 
                      to="/user-dashboard" 
                      className={`navbar-link ${isActive('/user-dashboard') ? 'active' : ''}`}
                    >
                      My Dashboard
                    </Link>
                    <Link 
                      to="/heartdl" 
                      className={`navbar-link ${isActive('/heartdl') ? 'active' : ''}`}
                    >
                      Heart Prediction
                    </Link>
                    <Link 
                      to="/alzheimerdl" 
                      className={`navbar-link ${isActive('/alzheimerdl') ? 'active' : ''}`}
                    >
                      Alzheimer Prediction
                    </Link>
                    <Link 
                      to="/medicalchat" 
                      className={`navbar-link ${isActive('/medicalchat') ? 'active' : ''}`}
                    >
                      Medical Chat
                    </Link>
                  </>
                )}
                <button onClick={onLogout} className="navbar-logout">
                  Logout
                </button>
              </>
            )}
          </div>
        </div>

        <div 
          className="navbar-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <span className="bar"></span>
          <span className="bar"></span>
          <span className="bar"></span>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
