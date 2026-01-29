import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { clearTokens, refreshAuthToken } from "./utils/auth.js";
import "./UserDashboard.css";

const API = ""; // Use proxy configuration

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

const makeAuthenticatedRequest = async (url, maxRetries = 1) => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    
    const response = await axios.get(url, { 
      headers: { Authorization: `Bearer ${token}` } 
    });
    return response;
  } catch (error) {
    if (error.response?.status === 401 && maxRetries > 0) {
      try {
        // Try to refresh the token
        await refreshAuthToken(API);
        // Retry the request with new token
        const retryResponse = await axios.get(url, { 
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } 
        });
        return retryResponse;
      } catch (refreshError) {
        // Token refresh failed, clear tokens and redirect to login
        clearTokens();
        window.location.href = "/login";
        throw new Error("Session expired. Please login again.");
      }
    }
    throw error;
  }
};

// WebSocket helper for real-time admin message notifications
const createUserWebSocket = (onMessage) => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const ws = new WebSocket(
    `ws://localhost:8000/ws/notifications?role=user&token=${encodeURIComponent(
      token
    )}`
  );
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      onMessage?.(msg);
    } catch {
      // ignore malformed messages
    }
  };
  ws.onopen = () => {
    // keep connection alive
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 30000);
  };
  return ws;
};

function UserDashboard() {
  const [userData, setUserData] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [adminMessages, setAdminMessages] = useState([]);
  const [directMessages, setDirectMessages] = useState([]);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [downloadingReport, setDownloadingReport] = useState(false);

  const fetchUserData = async () => {
    setLoading(true);
    setError("");
    
    try {
      const [dashboardRes, chatRes, predictionsRes] = await Promise.all([
        makeAuthenticatedRequest(`${API}/dashboard/user`),
        makeAuthenticatedRequest(`${API}/dashboard/user/chat-history`),
        makeAuthenticatedRequest(`${API}/dashboard/user/predictions`)
      ]);

      setUserData(dashboardRes.data);
      setChatHistory(chatRes.data);
      setPredictions(predictionsRes.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      if (err.message.includes("Session expired") || err.message.includes("No authentication token found")) {
        setError("Authentication Required: " + err.message);
      } else if (err.response?.status === 401) {
        setError("Authentication Required: Please login again.");
      } else if (err.response?.status === 403) {
        setError("Access Denied: You don't have permission to access this resource.");
      } else {
        setError("Failed to fetch user data. Please try refreshing the page.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminMessages = async (silent = false) => {
    try {
      const res = await makeAuthenticatedRequest(
        `${API}/dashboard/user/admin-messages`
      );
      const messages = res.data || [];

      if (!silent && messages.length > adminMessages.length) {
        const latest = messages[0];
        setToastMessage(
          latest?.subject || "You have a new message from Admin"
        );
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
      }

      setAdminMessages(messages);
    } catch (err) {
      console.error("Failed to fetch admin messages:", err);
    }
  };

  const fetchDirectMessages = async () => {
    try {
      const res = await makeAuthenticatedRequest(
        `${API}/dashboard/user/direct-messages`
      );
      setDirectMessages(res.data || []);
    } catch (err) {
      console.error("Failed to fetch direct messages:", err);
    }
  };

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    fetchUserData();
    // Initial load of admin messages without triggering toast
    fetchAdminMessages(true);
    fetchDirectMessages();

    // WebSocket for real-time admin messages
    const ws = createUserWebSocket((msg) => {
      if (msg?.type === "admin_message") {
        setToastMessage(
          msg.data?.subject || "You have a new message from Admin"
        );
        setShowToast(true);
        setTimeout(() => setShowToast(false), 5000);
        // Refresh lists in the background so UI updates in place
        fetchAdminMessages(true);
        fetchDirectMessages();
      }
    });

    // Fallback polling (also helps if WS drops)
    const interval = setInterval(() => {
      fetchAdminMessages(false);
      fetchDirectMessages();
    }, 15000);

    return () => {
      if (ws) ws.close();
      clearInterval(interval);
    };
  }, []);

  const downloadUserReport = async () => {
    if (downloadingReport) return;
    setDownloadingReport(true);
    try {
      const response = await axios.get(`${API}/dashboard/user/download-report`, {
        headers: getAuthHeader(),
        responseType: 'blob'
      });

      if (response.status !== 200) {
        let msg = "Failed to download report. Please try again.";
        try {
          const text = await response.data.text();
          const json = JSON.parse(text);
          msg = json.detail || json.message || msg;
        } catch (_) { /* use default msg */ }
        alert(msg);
        return;
      }

      const contentType = response.headers['content-type'] || '';
      const isPDF = contentType.includes('application/pdf');
      const fileExtension = isPDF ? 'pdf' : 'html';
      const filename = `my_medical_report_${new Date().toISOString().split('T')[0]}.${fileExtension}`;

      const url = window.URL.createObjectURL(new Blob([response.data], { type: contentType || (isPDF ? 'application/pdf' : 'text/html') }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setToastMessage("Report downloaded successfully");
      setShowToast(true);
    } catch (err) {
      console.error("Error downloading report:", err);
      let msg = "Failed to download report. Please try again.";
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json.detail || json.message || msg;
        } catch (_) { /* use default */ }
      } else if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      }
      alert(msg);
    } finally {
      setDownloadingReport(false);
    }
  };

  const sendContactAdminMessage = async () => {
    const trimmed = contactMessage.trim();
    if (!trimmed) return;

    try {
      const payload = {
        subject: contactSubject || "Message from user",
        message: trimmed,
      };

      const token = localStorage.getItem("token");
      if (!token) {
        window.location.href = "/login";
        return;
      }

      await axios.post(
        `${API}/dashboard/user/contact-admin`,
        payload,
        { headers: getAuthHeader() }
      );

      // Optimistically append to direct message thread
      const now = new Date().toISOString();
      setDirectMessages((prev) => [
        ...prev,
        {
          sender: "user",
          subject: payload.subject,
          message: payload.message,
          timestamp: now,
          admin_email: null,
        },
      ]);

      setContactMessage("");
      // keep subject so they can send follow-ups in same thread
    } catch (err) {
      console.error("Failed to send contact-admin message:", err);
      alert("Failed to send message to admin. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="user-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-dashboard">
        <div className="error-container">
          <h2>🔐 Authentication Required</h2>
          <p>{error}</p>
          {error.includes("Session expired") && (
            <div style={{ marginTop: '20px' }}>
              <p>Your session has expired. Please log in again to continue.</p>
              <button 
                onClick={() => window.location.href = "/login"} 
                className="btn btn-primary"
                style={{ marginRight: '10px' }}
              >
                Go to Login
              </button>
              <button onClick={fetchUserData} className="btn btn-secondary">
                Retry
              </button>
            </div>
          )}
          {!error.includes("Session expired") && (
            <button onClick={fetchUserData} className="btn btn-primary">Retry</button>
          )}
        </div>
      </div>
    );
  }

  const stats = userData?.stats || {};
  const dailyActivity = userData?.daily_activity || [];
  const recentActivity = userData?.recent_activity || [];
  const riskData = userData?.risk_data || [];
  const predictionTypeData = userData?.prediction_type_data || [];
  const engagementMetrics = userData?.engagement_metrics || {};

  // Custom colors for charts
  const COLORS = {
    primary: '#8884d8',
    secondary: '#82ca9d',
    tertiary: '#ffc658',
    quaternary: '#ff7c7c',
    low: '#27ae60',
    medium: '#f39c12',
    high: '#e74c3c',
    heart: '#3498db',
    alzheimer: '#9b59b6',
    other: '#95a5a6'
  };

  return (
    <div className="user-dashboard">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome back, {userData?.user?.name || 'User'}!</h1>
          <p>Here's your medical AI usage summary</p>
        </div>
        <div className="header-actions">
          <button
            onClick={downloadUserReport}
            className="btn btn-outline"
            disabled={downloadingReport}
          >
            {downloadingReport ? "⏳ Downloading…" : "📊 Download My Report"}
          </button>
          <button onClick={fetchUserData} className="btn btn-secondary">
            🔄 Refresh
          </button>
        </div>
      </div>

      {showToast && (
        <div className="toast-notification">
          <div className="toast-content">
            <strong>New message from Admin</strong>
            <p>{toastMessage}</p>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <h3>{stats.total_chats || 0}</h3>
            <p>AI Chats</p>
            <span className="stat-subtitle">Medical consultations</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🫀</div>
          <div className="stat-content">
            <h3>{stats.heart_predictions || 0}</h3>
            <p>Heart Predictions</p>
            <span className="stat-subtitle">Risk assessments</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">🧠</div>
          <div className="stat-content">
            <h3>{stats.alzheimer_predictions || 0}</h3>
            <p>Alzheimer Predictions</p>
            <span className="stat-subtitle">Cognitive assessments</span>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{engagementMetrics.total_days_active || 0}</h3>
            <p>Active Days</p>
            <span className="stat-subtitle">Last 30 days</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${selectedTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          📊 Overview
        </button>
        <button 
          className={`tab-button ${selectedTab === 'chats' ? 'active' : ''}`}
          onClick={() => setSelectedTab('chats')}
        >
          💬 Chat History
        </button>
        <button 
          className={`tab-button ${selectedTab === 'predictions' ? 'active' : ''}`}
          onClick={() => setSelectedTab('predictions')}
        >
          🔮 Predictions
        </button>
        <button 
          className={`tab-button ${selectedTab === 'medicines' ? 'active' : ''}`}
          onClick={() => setSelectedTab('medicines')}
        >
          💊 Medicines
        </button>
        <button 
          className={`tab-button ${selectedTab === 'mail' ? 'active' : ''}`}
          onClick={() => setSelectedTab('mail')}
        >
          📧 Contact Admin
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {selectedTab === 'overview' && (
          <div className="overview-tab">
            <div className="charts-section">
              <div className="chart-container">
                <h3>Your Activity Over Time (30 Days)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="chats" stroke={COLORS.primary} name="AI Chats" strokeWidth={2} />
                    <Line type="monotone" dataKey="predictions" stroke={COLORS.secondary} name="Predictions" strokeWidth={2} />
                    <Line type="monotone" dataKey="total" stroke={COLORS.tertiary} name="Total Activity" strokeWidth={2} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-container">
                <h3>Prediction Types Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={predictionTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {predictionTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-container">
                <h3>Risk Level Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-container">
                <h3>Recent Activity (7 Days)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={recentActivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="chats" fill={COLORS.primary} name="AI Chats" />
                    <Bar dataKey="predictions" fill={COLORS.secondary} name="Predictions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="actions-grid">
                <a href="/medicalchat" className="action-card">
                  <div className="action-icon">💬</div>
                  <h4>Start AI Chat</h4>
                  <p>Consult with AI about your health</p>
                </a>
                <a href="/heartdl" className="action-card">
                  <div className="action-icon">🫀</div>
                  <h4>Heart Assessment</h4>
                  <p>Check your heart disease risk</p>
                </a>
                <a href="/alzheimerdl" className="action-card">
                  <div className="action-icon">🧠</div>
                  <h4>Cognitive Test</h4>
                  <p>Assess Alzheimer's risk factors</p>
                </a>
                <div
                  className="action-card"
                  onClick={downloadUserReport}
                  style={{ pointerEvents: downloadingReport ? "none" : "auto", opacity: downloadingReport ? 0.7 : 1 }}
                  role="button"
                  aria-disabled={downloadingReport}
                >
                  <div className="action-icon">📊</div>
                  <h4>{downloadingReport ? "Downloading…" : "Download Report"}</h4>
                  <p>Get your complete health report</p>
                </div>
              </div>
            </div>

            <div className="engagement-metrics">
              <h3>Your Engagement Metrics</h3>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-label">Most Active Day</div>
                  <div className="metric-value">{engagementMetrics.most_active_day || 'N/A'}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Current Streak</div>
                  <div className="metric-value">{engagementMetrics.streak_days || 0} days</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Peak Activity</div>
                  <div className="metric-value">{engagementMetrics.peak_activity || 0} activities</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Daily Average</div>
                  <div className="metric-value">{stats.avg_daily_activity || 0} activities</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'chats' && (
          <div className="chats-tab">
            <div className="section-header">
              <h3>Your Chat History</h3>
              <span className="count-badge">{chatHistory.length} conversations</span>
            </div>
            <div className="chat-list">
              {chatHistory.length > 0 ? (
                chatHistory.map((chat, index) => (
                  <div key={index} className="chat-item">
                    <div className="chat-header">
                      <span className="chat-time">
                        {chat.timestamp
                          ? new Date(chat.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })
                          : "N/A"}
                      </span>
                      {chat.condition && (
                        <span className="condition-tag">{chat.condition}</span>
                      )}
                    </div>
                    <div className="chat-content">
                      <div className="user-message">
                        <strong>You:</strong> {chat.user_message}
                      </div>
                      <div className="ai-response">
                        <strong>AI:</strong> {chat.ai_response}
                      </div>
                      {chat.medicines && Object.keys(chat.medicines).length > 0 && (
                        <div className="medicines-preview">
                          <strong>💊 Medicines:</strong> {Object.keys(chat.medicines).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">💬</div>
                  <h3>No chat history yet</h3>
                  <p>Start a conversation with our AI medical assistant</p>
                  <a href="/medicalchat" className="btn btn-primary">Start Chatting</a>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'predictions' && (
          <div className="predictions-tab">
            <div className="section-header">
              <h3>Your Predictions</h3>
              <span className="count-badge">{predictions.length} predictions</span>
            </div>
            <div className="predictions-list">
              {predictions.length > 0 ? (
                predictions.map((prediction, index) => (
                  <div key={index} className="prediction-item">
                    <div className="prediction-header">
                      <span className="prediction-type">{prediction.type}</span>
                      <span className="prediction-time">
                        {prediction.timestamp
                          ? new Date(prediction.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })
                          : "N/A"}
                      </span>
                    </div>
                    <div className="prediction-content">
                      <div className="prediction-result">
                        <strong>Result:</strong> {prediction.result}
                      </div>
                      {prediction.confidence && (
                        <div className="confidence-bar">
                          <span>Confidence: {Math.round(prediction.confidence * 100)}%</span>
                          <div className="confidence-fill" style={{ width: `${prediction.confidence * 100}%` }}></div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🔮</div>
                  <h3>No predictions yet</h3>
                  <p>Try our AI prediction tools</p>
                  <div className="empty-actions">
                    <a href="/heartdl" className="btn btn-primary">Heart Prediction</a>
                    <a href="/alzheimerdl" className="btn btn-secondary">Alzheimer Prediction</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'medicines' && (
          <div className="medicines-tab">
            <div className="section-header">
              <h3>Medicine Recommendations</h3>
              <span className="count-badge">{stats.medicine_recommendations || 0} recommendations</span>
            </div>
            <div className="medicines-list">
              {chatHistory.filter(chat => chat.medicines && Object.keys(chat.medicines).length > 0).length > 0 ? (
                chatHistory
                  .filter(chat => chat.medicines && Object.keys(chat.medicines).length > 0)
                  .map((chat, index) => (
                    <div key={index} className="medicine-item">
                      <div className="medicine-header">
                        <span className="condition-name">{chat.condition || chat.detected_condition}</span>
                        <span className="medicine-date">
                          {new Date(chat.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {/* Medications Section */}
                      {chat.medicines.medications && chat.medicines.medications.length > 0 && (
                        <div className="medicines-section">
                          <h5>💊 Recommended Medications:</h5>
                          <div className="medicines-grid">
                            {chat.medicines.medications.map((med, medIndex) => (
                              <div key={medIndex} className="medicine-card">
                                <h4>{med.name}</h4>
                                <p><strong>Dosage:</strong> {med.dosage}</p>
                                <p><strong>Type:</strong> {med.type}</p>
                                <p><strong>Instructions:</strong> {med.description}</p>
                                <div className="side-effects">
                                  <strong>Side Effects:</strong> {med.side_effects?.join(', ') || 'None listed'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Lifestyle Section */}
                      {chat.medicines.lifestyle && chat.medicines.lifestyle.length > 0 && (
                        <div className="lifestyle-section">
                          <h5>🏃 Lifestyle Recommendations:</h5>
                          <ul>
                            {chat.medicines.lifestyle.map((item, itemIndex) => (
                              <li key={itemIndex}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">💊</div>
                  <h3>No medicine recommendations yet</h3>
                  <p>Chat with our AI to get personalized medicine suggestions</p>
                  <a href="/medicalchat" className="btn btn-primary">Get Recommendations</a>
                </div>
              )}
            </div>
          </div>
        )}

        {selectedTab === 'mail' && (
          <div className="mail-tab">
            <div className="section-header">
              <h3>Direct Messages with Admin</h3>
              <span className="count-badge">
                {directMessages.length + adminMessages.length} messages
              </span>
            </div>

            {/* Real-time Contact Admin composer */}
            <div className="contact-admin-box">
              <h4>Contact Admin</h4>
              <div className="contact-admin-fields">
                <input
                  type="text"
                  placeholder="Subject (optional)"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                />
                <textarea
                  rows="3"
                  placeholder="Type your message to the admin..."
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                />
              </div>
              <div className="contact-admin-actions">
                <button
                  className="btn btn-primary"
                  disabled={!contactMessage.trim()}
                  onClick={sendContactAdminMessage}
                >
                  Send Message
                </button>
              </div>
            </div>

            <div className="mail-list">
              {(() => {
                const combined = [
                  ...directMessages.map((m) => ({ ...m, _sortTs: m.timestamp ? new Date(m.timestamp).getTime() : 0 })),
                  ...adminMessages
                    .filter((m) => !directMessages.some((d) => d.timestamp === m.timestamp && (d.message || d.admin_message) === (m.message || m.admin_message)))
                    .map((m) => ({ ...m, sender: "admin", _sortTs: m.timestamp ? new Date(m.timestamp).getTime() : 0 })),
                ];
                combined.sort((a, b) => (b._sortTs || 0) - (a._sortTs || 0));
                const formatTs = (ts) =>
                  ts ? new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" }) : "N/A";
                return combined.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📧</div>
                    <h3>No messages yet</h3>
                    <p>
                      Use the Contact Admin form in the app to start a direct
                      conversation with an administrator.
                    </p>
                  </div>
                ) : (
                  combined.map((msg, index) => (
                    <div key={`msg-${index}`} className="mail-item">
                      <div className="mail-header">
                        <h4>{msg.subject || "Message"}</h4>
                        <span className="mail-time">{formatTs(msg.timestamp)}</span>
                      </div>
                      <div className="mail-body">
                        <p>{msg.message || msg.admin_message}</p>
                        <small>
                          {(msg.sender || (msg.admin_email ? "admin" : "user")) === "admin" ? "From Admin" : "You"}
                          {msg.admin_email ? ` (${msg.admin_email})` : ""}
                        </small>
                      </div>
                    </div>
                  ))
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UserDashboard;
