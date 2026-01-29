import React from "react";
import { useNavigate } from "react-router-dom";
import "./HomePage.css";

const HomePage = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: "🧠",
      title: "Alzheimer Detection",
      description: "Advanced AI-powered Alzheimer's disease prediction using comprehensive medical data analysis.",
      color: "#4F46E5"
    },
    {
      icon: "❤️",
      title: "Heart Disease Prediction",
      description: "Machine learning models to predict cardiovascular diseases with high accuracy.",
      color: "#DC2626"
    },
    {
      icon: "💬",
      title: "Medical Chat Assistant",
      description: "Intelligent medical chatbot with medicine recommendations and health guidance.",
      color: "#059669"
    },
    {
      icon: "📊",
      title: "Health Analytics",
      description: "Comprehensive health tracking and analytics dashboard for better insights.",
      color: "#7C3AED"
    }
  ];

  const stats = [
    { number: "10K+", label: "Predictions Made" },
    { number: "95%", label: "Accuracy Rate" },
    { number: "50+", label: "Medical Conditions" },
    { number: "24/7", label: "Available Support" }
  ];

  return (
    <div className="homepage">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-background">
          <div className="hero-pattern"></div>
        </div>
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              Advanced Medical AI
              <span className="gradient-text"> Platform</span>
            </h1>
            <p className="hero-description">
              Harness the power of artificial intelligence for accurate medical predictions, 
              intelligent health monitoring, and personalized medical assistance.
            </p>
            <div className="hero-buttons">
              <button 
                className="btn-primary"
                onClick={() => navigate("/login")}
              >
                Get Started
              </button>
              <button 
                className="btn-secondary"
                onClick={() => navigate("/register")}
              >
                Learn More
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="floating-cards">
              <div className="floating-card card-1">
                <div className="card-icon">🧠</div>
                <div className="card-text">AI Diagnosis</div>
              </div>
              <div className="floating-card card-2">
                <div className="card-icon">❤️</div>
                <div className="card-text">Heart Health</div>
              </div>
              <div className="floating-card card-3">
                <div className="card-icon">💊</div>
                <div className="card-text">Medicine Guide</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div key={index} className="stat-item">
                <div className="stat-number">{stat.number}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Powerful Features</h2>
            <p className="section-description">
              Comprehensive medical AI solutions designed for healthcare professionals and patients
            </p>
          </div>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div 
                  className="feature-icon"
                  style={{ backgroundColor: feature.color }}
                >
                  {feature.icon}
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
                <div className="feature-arrow">→</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">How It Works</h2>
            <p className="section-description">
              Simple steps to get accurate medical predictions
            </p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3>Upload Data</h3>
                <p>Provide your medical data through our secure forms</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3>AI Analysis</h3>
                <p>Our advanced AI models analyze your data</p>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3>Get Results</h3>
                <p>Receive detailed predictions and recommendations</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Get Started?</h2>
            <p className="cta-description">
              Join thousands of users who trust our medical AI platform
            </p>
            <div className="cta-buttons">
              <button 
                className="btn-primary"
                onClick={() => navigate("/register")}
              >
                Create Account
              </button>
              <button 
                className="btn-outline"
                onClick={() => navigate("/login")}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="footer-logo">🩺 MedAI</div>
              <p className="footer-description">
                Advanced Medical AI Platform for accurate predictions and health monitoring
              </p>
            </div>
            <div className="footer-links">
              <div className="footer-column">
                <h4>Features</h4>
                <ul>
                  <li>Alzheimer Detection</li>
                  <li>Heart Disease Prediction</li>
                  <li>Medical Chat</li>
                  <li>Health Analytics</li>
                </ul>
              </div>
              <div className="footer-column">
                <h4>Support</h4>
                <ul>
                  <li>Documentation</li>
                  <li>Help Center</li>
                  <li>Contact Us</li>
                  <li>Privacy Policy</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 MedAI Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
