import React, { useEffect, useState } from "react";
import axios from "axios";
import "./AdminDashboard.css";

const API = "http://localhost:8000";

const getAdminHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const createAdminWebSocket = (onMessage) => {
  const token = localStorage.getItem("token");
  if (!token) return null;
  const ws = new WebSocket(
    `ws://localhost:8000/ws/notifications?role=admin&token=${encodeURIComponent(
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

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [users, setUsers] = useState([]);
  const [patients, setPatients] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [inboxItems, setInboxItems] = useState([]);
  const [mailItems, setMailItems] = useState([]);
  const [wsToast, setWsToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  
  // New state variables for enhanced features
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showUserDetailsModal, setShowUserDetailsModal] = useState(false);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [patientRiskFilter, setPatientRiskFilter] = useState("all");

  // Modal states
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPatientDetailsModal, setShowPatientDetailsModal] = useState(false);
  const [patientDetails, setPatientDetails] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [expandedSymptoms, setExpandedSymptoms] = useState({});
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedChatPatient, setSelectedChatPatient] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    const isAdmin = localStorage.getItem("is_admin_session");
    
    if (!token || !isAdmin) {
      window.location = "/admin/login";
      return;
    }

    fetchDashboardData();
    fetchUsers();
    fetchPatients();
    fetchAnalytics();
    fetchMail();
    fetchInbox();

    const ws = createAdminWebSocket((msg) => {
      if (msg?.type === "user_chat") {
        setWsToast({
          title: "New user query",
          text: `${msg.data.user_email}: ${msg.data.preview}`,
        });
        // Refresh patients so high‑risk users bubble to the top
        fetchPatients();
        // Keep overview counts fresh too
        fetchDashboardData();
      }

      if (msg?.type === "admin_inbox") {
        setWsToast({
          title: "New message from user",
          text: `${msg.data.user_email}: ${msg.data.preview}`,
        });
        // Refresh inbox so new messages appear without reload
        fetchInbox();
      }
    });

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Keep key panels fresh (prevents stale Total Patients / Symptoms)
  useEffect(() => {
    // Refresh immediately when switching tabs
    if (activeTab === "overview") fetchDashboardData();
    if (activeTab === "users") fetchUsers();
    if (activeTab === "patients") fetchPatients();
    if (activeTab === "mail") {
      fetchMail();
      fetchInbox();
    }
    if (activeTab === "analytics") fetchAnalytics();

    // And poll while the tab is active
    const interval = setInterval(() => {
      fetchDashboardData();
      if (activeTab === "users") fetchUsers();
      if (activeTab === "patients") fetchPatients();
      if (activeTab === "mail") fetchMail();
      if (activeTab === "analytics") fetchAnalytics();
    }, 15000);

    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchDashboardData = async () => {
    try {
      const res = await axios.get(`${API}/admin/overview`, {
        headers: getAdminHeaders(),
      });
      setDashboardData(res.data);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/admin/users`, {
        headers: getAdminHeaders(),
      });
      setUsers(res.data.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const fetchPatients = async () => {
    try {
      const res = await axios.get(`${API}/admin/patients`, {
        headers: getAdminHeaders(),
      });

      const rawPatients = res.data.patients || [];

      // Normalize backend shape (risk_*_percentage, last_prediction_at, max_risk_percentage)
      const mapped = rawPatients.map((p) => {
        const heartRisk =
          p.heart_risk_percentage ?? p.heart_risk ?? 0;
        const alzRisk =
          p.alzheimer_risk_percentage ?? p.alzheimer_risk ?? 0;
        const maxRisk =
          p.max_risk_percentage ??
          Math.max(heartRisk, alzRisk);

        let overallRisk = "Low";
        if (maxRisk > 70) overallRisk = "High";
        else if (maxRisk > 40) overallRisk = "Medium";

        return {
          ...p,
          heart_risk: heartRisk,
          alzheimer_risk: alzRisk,
          overall_risk: p.overall_risk || overallRisk,
          last_assessment: p.last_assessment || p.last_prediction_at,
        };
      });

      setPatients(mapped);
    } catch (err) {
      console.error("Failed to load patients:", err);
    }
  };

  const getPatientByEmail = (email) => {
    if (!email) return null;
    return patients.find((p) => p.email === email) || null;
  };

  const formatPct = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num)) return "0%";
    return `${Math.round(num)}%`;
  };

  const formatTs = (ts) => {
    if (!ts) return "N/A";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return String(ts);
    return d.toISOString();
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API}/admin/analytics`, {
        headers: getAdminHeaders(),
      });
      setAnalytics(res.data);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMail = async () => {
    try {
      const res = await axios.get(`${API}/admin/mail`, {
        headers: getAdminHeaders(),
      });
      setMailItems(res.data.items || []);
    } catch (err) {
      console.error("Failed to load admin mail:", err);
    }
  };

  const fetchInbox = async () => {
    try {
      const res = await axios.get(`${API}/admin/inbox`, {
        headers: getAdminHeaders(),
      });
      setInboxItems(res.data.items || []);
    } catch (err) {
      console.error("Failed to load admin inbox messages:", err);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!selectedUser?.email) {
        setError("No user selected for editing");
        return;
      }

      const payload = {
        name: editFormData?.name,
        is_admin: !!editFormData?.is_admin,
      };

      // Avoid sending undefined values to the backend
      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      await axios.put(
        `${API}/admin/users/${encodeURIComponent(selectedUser.email)}`,
        payload,
        {
          headers: {
            ...getAdminHeaders(),
            "Content-Type": "application/json",
          },
        }
      );
      setShowEditModal(false);
      fetchUsers();
      fetchPatients();
    } catch (err) {
      setError("Failed to update user");
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      if (!selectedUser?.email) {
        setError("No user selected for deletion");
        return;
      }

      await axios.delete(
        `${API}/admin/users/${encodeURIComponent(selectedUser.email)}`,
        { headers: getAdminHeaders() }
      );
      setShowDeleteModal(false);
      fetchUsers();
      fetchPatients();
    } catch (err) {
      setError("Failed to delete user");
    }
  };

  const handleViewPatientDetails = async (user) => {
    try {
      // If you add a dedicated details endpoint later, update this.
      // For now, reuse the summarized patient data from `patients` state.
      const summary = patients.find((p) => p.email === user.email) || user;
      const res = { data: summary };
      setPatientDetails(res.data);
      setShowPatientDetailsModal(true);
    } catch (err) {
      setError("Failed to load patient details");
    }
  };

  const toggleSymptoms = (patientEmail) => {
    setExpandedSymptoms(prev => ({
      ...prev,
      [patientEmail]: !prev[patientEmail]
    }));
  };

  const handleChatWithPatient = async (patient) => {
    setSelectedChatPatient(patient);
    setShowChatModal(true);
    setChatMessages([]); // Clear existing messages first
    
    try {
      // Load existing conversation history from backend (admin + user + AI)
      const response = await axios.get(
        `${API}/admin/user/chat-history`,
        {
          params: { user_email: patient.email },
          headers: getAdminHeaders(),
        }
      );

      const history = response.data || [];

      const formattedMessages = history.map((msg, idx) => {
        const isAdminMessage =
          msg.type === "admin_message" || msg.is_admin;
        const sender = isAdminMessage ? "admin" : "patient";
        const messageText =
          msg.admin_message ||
          msg.message ||
          msg.user_message ||
          msg.ai_response ||
          "";

        return {
          id: msg.id || idx,
          sender,
          message: messageText,
          timestamp: msg.timestamp || new Date().toISOString(),
        };
      });

      if (formattedMessages.length > 0) {
        setChatMessages(formattedMessages);
      } else {
        setChatMessages([
          {
            id: 1,
            sender: "admin",
            message: `Hello ${patient.name}, I'm reviewing your health assessment. How are you feeling today?`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to load conversation history:", error);
      setChatMessages([
        {
          id: 1,
          sender: "admin",
          message: `Hello ${patient.name}, I'm reviewing your health assessment. How are you feeling today?`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleSendMessage = async () => {
    if (newMessage.trim() && selectedChatPatient) {
      const adminMessage = {
        id: Date.now(),
        sender: 'admin',
        message: newMessage.trim(),
        timestamp: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, adminMessage]);
      setNewMessage("");

      try {
        // Send message to backend using admin messaging endpoint
        const response = await axios.post(
          `${API}/admin/send-message`,
          {
            user_email: selectedChatPatient.email,
            subject: `Message from Admin for ${selectedChatPatient.name || selectedChatPatient.email}`,
            message: newMessage.trim(),
          },
          {
            headers: {
              ...getAdminHeaders(),
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.status === 'success') {
          console.log('Message sent successfully and saved to database');
          setNewMessage("");
          
          // Force immediate refresh of chat history
          await handleChatWithPatient(selectedChatPatient);
          
          // Additional refresh to ensure database consistency
          setTimeout(async () => {
            await handleChatWithPatient(selectedChatPatient);
          }, 1000);
        } else {
          console.error('Message send failed:', response.data);
          setError('Failed to send message');
        }
      } catch (error) {
        console.error("Failed to send message:", error);
        // Still show the message in UI even if backend fails
      }
    }
  };

  const generatePatientResponse = (adminMessage) => {
    const responses = [
      "Thank you for checking on me. I'm doing okay today.",
      "I've been following my treatment plan and feeling better.",
      "I have some questions about my medication.",
      "My symptoms have been improving lately.",
      "I appreciate your concern. I'm managing well.",
      "I'd like to discuss my recent test results.",
      "I'm feeling much better than last week.",
      "Thank you for the follow-up. I'm doing fine.",
      "I have a few concerns I'd like to discuss."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const getRiskLevel = (risk) => {
    if (risk < 30) return { class: "risk-low", text: "Low" };
    if (risk < 70) return { class: "risk-medium", text: "Medium" };
    return { class: "risk-high", text: "High" };
  };

  const getOverallRiskLevel = (patient) => {
    const heartRisk = patient.heart_risk || 0;
    const alzRisk = patient.alzheimer_risk || 0;
    const overallRisk = patient.overall_risk;
    
    // If overall risk is explicitly set, use it
    if (overallRisk === 'High') return { class: "risk-high", text: "High" };
    if (overallRisk === 'Medium') return { class: "risk-medium", text: "Medium" };
    if (overallRisk === 'Low') return { class: "risk-low", text: "Low" };
    
    // Otherwise calculate based on individual risks
    if (heartRisk > 70 || alzRisk > 70) return { class: "risk-high", text: "High" };
    if (heartRisk > 40 || alzRisk > 40) return { class: "risk-medium", text: "Medium" };
    return { class: "risk-low", text: "Low" };
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("is_admin_session");
    window.location = "/admin/login";
  };

  // New handler functions for enhanced features
  const toggleUserSelection = (user, isSelected) => {
    if (isSelected) {
      setSelectedUsers([...selectedUsers, user]);
    } else {
      setSelectedUsers(selectedUsers.filter(u => u.email !== user.email));
    }
  };

  const setSelectAll = (checked) => {
    if (checked) {
      setSelectedUsers([...filteredUsers]);
    } else {
      setSelectedUsers([]);
    }
  };

  const handleViewUserDetails = (user) => {
    setSelectedUserDetails(user);
    setShowUserDetailsModal(true);
  };

  const handleEmergencyContact = (patient) => {
    const emergencyMessage = `
EMERGENCY ALERT - HIGH RISK PATIENT

Patient Details:
Name: ${patient.name || 'N/A'}
Email: ${patient.email}
Heart Risk: ${patient.heart_risk || 0}%
Alzheimer Risk: ${patient.alzheimer_risk || 0}%
Overall Risk: ${getOverallRiskLevel(patient).text}
Last Assessment: ${patient.last_assessment ? new Date(patient.last_assessment).toLocaleDateString() : 'No assessment'}

This patient requires immediate medical attention due to high risk levels.
Please contact the patient immediately for emergency consultation.

Contact Information:
Email: ${patient.email}
Last Login: ${patient.last_login ? new Date(patient.last_login).toLocaleDateString() : 'Never'}

Action Required:
1. Contact patient immediately
2. Schedule emergency consultation
3. Provide medical guidance
4. Update patient records
    `.trim();

    // Create emergency alert modal
    alert(emergencyMessage);
    
    // You could also send this to a notification system
    console.log('Emergency Alert:', emergencyMessage);
  };

  const exportUsers = () => {
    const csvContent = [
      ["Name", "Email", "Registration Date", "Last Login", "Status"],
      ...filteredUsers.map(user => [
        user.name || 'N/A',
        user.email,
        new Date(user.created_at).toLocaleDateString(),
        user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never',
        user.is_active ? 'Active' : 'Inactive'
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleBulkEmail = () => {
    // Send bulk email logic here
    console.log('Sending bulk email');
    setShowBulkEmailModal(false);
  };

  const handleBulkEdit = () => {
    // Bulk edit logic here
    console.log('Saving bulk changes');
    setShowBulkEditModal(false);
  };

  const handleBulkDelete = () => {
    // Bulk delete logic here
    console.log('Deleting users:', selectedUsers);
    setSelectedUsers([]);
    setShowBulkDeleteModal(false);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setStatusFilter('');
    setSortBy('name');
    setSelectedUsers([]);
  };

  // Apply advanced filtering and sorting
  const filteredUsers = users
    .filter(user => !user.is_admin)
    .filter(user => {
      // Search term filter
      const matchesSearch = 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      if (!matchesSearch) return false;
      
      // Date filter
      if (dateFilter) {
        const userDate = new Date(user.created_at);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        switch (dateFilter) {
          case 'today':
            if (userDate < today) return false;
            break;
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            if (userDate < weekAgo) return false;
            break;
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            if (userDate < monthAgo) return false;
            break;
          case 'year':
            const yearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
            if (userDate < yearAgo) return false;
            break;
        }
      }
      
      // Status filter
      if (statusFilter) {
        switch (statusFilter) {
          case 'active':
            if (!user.is_active) return false;
            break;
          case 'inactive':
            if (user.is_active) return false;
            break;
          case 'new':
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            if (new Date(user.created_at) < weekAgo) return false;
            break;
        }
      }
      
      return true;
    })
    .sort((a, b) => {
      // Sort by selected criteria
      switch (sortBy) {
        case 'name':
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        case 'email':
          return a.email.toLowerCase().localeCompare(b.email.toLowerCase());
        case 'date':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'recent':
          return new Date(b.created_at) - new Date(a.created_at);
        default:
          return 0;
      }
    });

  const filteredPatients = patients.filter(patient =>
    !patient.is_admin && 
    (patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
     (patient.name && patient.name.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  if (loading) return <div className="loading">Loading dashboard...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="admin-dashboard">
      {wsToast && (
        <div className="toast-notification admin-toast">
          <div className="toast-content">
            <strong>{wsToast.title}</strong>
            <p>{wsToast.text}</p>
          </div>
        </div>
      )}
      <div className="admin-header">
        <div className="header-content">
          <div className="header-left">
            <div className="logo-section">
              <span className="logo-icon">🩺</span>
              <div className="logo-text">
                <h1>MedAI</h1>
                <span className="logo-subtitle">Admin Dashboard</span>
              </div>
            </div>
          </div>
          <div className="header-right">
            <div className="admin-info">
              <span className="admin-badge">👤 Administrator</span>
              <button className="logout-btn" onClick={handleLogout}>
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
        <p className="header-description">Manage users, patients, and view comprehensive analytics</p>
      </div>

      <div className="tabs-container">
        <div className="tabs-wrapper">
          <div className="tabs">
            <button
              className={`tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <span className="tab-icon">📊</span>
              <span className="tab-label">Overview</span>
            </button>
            <button
              className={`tab ${activeTab === "users" ? "active" : ""}`}
              onClick={() => setActiveTab("users")}
            >
              <span className="tab-icon">👥</span>
              <span className="tab-label">Users</span>
            </button>
            <button
              className={`tab ${activeTab === "patients" ? "active" : ""}`}
              onClick={() => setActiveTab("patients")}
            >
              <span className="tab-icon">🏥</span>
              <span className="tab-label">Patients</span>
            </button>
            <button
              className={`tab ${activeTab === "mail" ? "active" : ""}`}
              onClick={() => setActiveTab("mail")}
            >
              <span className="tab-icon">📧</span>
              <span className="tab-label">Messages</span>
            </button>
            <button
              className={`tab ${activeTab === "analytics" ? "active" : ""}`}
              onClick={() => setActiveTab("analytics")}
            >
              <span className="tab-icon">📈</span>
              <span className="tab-label">Analytics</span>
            </button>
          </div>
        </div>
      </div>

      <div className="tab-content">
        {activeTab === "overview" && (
          <div>
            <h2>Dashboard Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>{dashboardData?.total_users || 0}</h3>
                <p>Total Users</p>
              </div>
              <div className="stat-card">
                <h3>{dashboardData?.total_patients || 0}</h3>
                <p>Total Patients</p>
              </div>
              <div className="stat-card">
                <h3>{dashboardData?.total_predictions || 0}</h3>
                <p>Total Predictions</p>
              </div>
              <div className="stat-card">
                <h3>{dashboardData?.active_today || 0}</h3>
                <p>Active Today</p>
              </div>
            </div>
            
            <div className="analytics-grid">
              <div className="chart-container">
                <h3>Recent Activity</h3>
                <p>Users active in the last 24 hours: {dashboardData?.active_today || 0}</p>
                <p>New registrations this week: {dashboardData?.new_this_week || 0}</p>
              </div>
              <div className="chart-container">
                <h3>System Health</h3>
                <p>🟢 All systems operational</p>
                <p>Database: Connected</p>
                <p>API Response: Normal</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div>
            <h2>User Management</h2>
            
            {/* User Statistics */}
            <div className="user-stats">
              <div className="stat-card">
                <h3>{filteredUsers.length}</h3>
                <p>Total Users</p>
              </div>
              <div className="stat-card">
                <h3>{users.filter(u => !u.is_admin).length}</h3>
                <p>Regular Users</p>
              </div>
              <div className="stat-card">
                <h3>{users.filter(u => u.is_admin).length}</h3>
                <p>Admin Users</p>
              </div>
              <div className="stat-card">
                <h3>{users.filter(u => new Date(u.created_at) > new Date(Date.now() - 7*24*60*60*1000)).length}</h3>
                <p>New This Week</p>
              </div>
            </div>
            
            {/* Bulk Actions */}
            <div className="bulk-actions">
              <h3>Bulk Actions</h3>
              <div className="bulk-buttons">
                <button className="btn btn-secondary" onClick={() => setShowBulkEmailModal(true)}>
                  📧 Send Email to All
                </button>
                <button className="btn btn-outline" onClick={() => exportUsers()}>
                  📊 Export Users
                </button>
              </div>
            </div>
            
            {/* Advanced Filters */}
            <div className="advanced-filters">
              <div className="filters-header">
                <h3>Advanced Filters</h3>
                <button className="btn btn-outline btn-sm" onClick={clearAllFilters}>
                  🔄 Clear Filters
                </button>
              </div>
              <div className="filter-grid">
                <div className="filter-group">
                  <label>Registration Date Range</label>
                  <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>User Status</label>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All Users</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="new">New Users</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Sort By</label>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="name">Name (A-Z)</option>
                    <option value="email">Email (A-Z)</option>
                    <option value="date">Registration Date</option>
                    <option value="recent">Most Recent</option>
                  </select>
                </div>
              </div>
              {/* Active Filters Display */}
              {(dateFilter || statusFilter || searchTerm) && (
                <div className="active-filters">
                  <span className="active-filters-label">Active Filters:</span>
                  {dateFilter && <span className="filter-tag">Date: {dateFilter}</span>}
                  {statusFilter && <span className="filter-tag">Status: {statusFilter}</span>}
                  {searchTerm && <span className="filter-tag">Search: {searchTerm}</span>}
                  <span className="filter-count">Showing {filteredUsers.length} of {users.filter(u => !u.is_admin).length} users</span>
                </div>
              )}
            </div>
            
            <div className="search-box">
              <input
                type="text"
                placeholder="Search regular users by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        onChange={(e) => setSelectAll(e.target.checked)}
                      />
                    </th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Registration Date</th>
                    <th>Last Login</th>
                    <th>Status</th>
                    <th>Heart Risk</th>
                    <th>Alzheimer Risk</th>
                    <th>Overall Risk</th>
                    <th>Last Assessment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, index) => {
                    const patient = getPatientByEmail(user.email);
                    const heartRisk = patient?.heart_risk ?? 0;
                    const alzRisk = patient?.alzheimer_risk ?? 0;
                    const overallRisk =
                      patient?.overall_risk ||
                      (Math.max(heartRisk, alzRisk) > 70
                        ? "High"
                        : Math.max(heartRisk, alzRisk) > 40
                          ? "Medium"
                          : "Low");
                    const lastAssessment = patient?.last_assessment;

                    return (
                    <tr key={index}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user)}
                          onChange={(e) =>
                            toggleUserSelection(user, e.target.checked)
                          }
                        />
                      </td>
                      <td>{user.name || "N/A"}</td>
                      <td>{user.email}</td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                      <td>
                        {user.last_login
                          ? new Date(user.last_login).toLocaleDateString()
                          : "Never"}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            user.is_active ? "status-active" : "status-inactive"
                          }`}
                        >
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`risk-badge ${
                            heartRisk > 70
                              ? "risk-high"
                              : heartRisk > 40
                                ? "risk-medium"
                                : "risk-low"
                          }`}
                        >
                          {formatPct(heartRisk)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`risk-badge ${
                            alzRisk > 70
                              ? "risk-high"
                              : alzRisk > 40
                                ? "risk-medium"
                                : "risk-low"
                          }`}
                        >
                          {formatPct(alzRisk)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`overall-risk-badge ${
                            overallRisk === "High"
                              ? "risk-high"
                              : overallRisk === "Medium"
                                ? "risk-medium"
                                : "risk-low"
                          }`}
                        >
                          {overallRisk}
                        </span>
                      </td>
                      <td>{formatTs(lastAssessment)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-edit"
                            onClick={() => {
                              setSelectedUser(user);
                              setEditFormData(user);
                              setShowEditModal(true);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-view"
                            onClick={() => handleViewUserDetails(user)}
                          >
                            👁️ View
                          </button>
                          <button
                            className="btn btn-delete"
                            onClick={() => {
                              setSelectedUser(user);
                              setShowDeleteModal(true);
                            }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Selected Users Actions */}
            {selectedUsers.length > 0 && (
              <div className="selected-actions">
                <h3>Selected Users ({selectedUsers.length})</h3>
                <div className="bulk-actions">
                  <button className="btn btn-secondary" onClick={() => setSelectedUsers([])}>
                    ✖ Clear Selection
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowBulkEditModal(true)}>
                    ✏️ Edit Selected
                  </button>
                  <button className="btn btn-delete" onClick={() => setShowBulkDeleteModal(true)}>
                    🗑️ Delete Selected
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "patients" && (
          <div>
            <h2>Patient Management</h2>
            
            {/* Patient Statistics */}
            <div className="patient-stats">
              <div className="stat-card">
                <h3>{filteredPatients.length}</h3>
                <p>Total Patients</p>
              </div>
              <div className="stat-card risk-high">
                <h3>{filteredPatients.filter(p => (p.heart_risk > 70 || p.alzheimer_risk > 70 || p.overall_risk === 'High')).length}</h3>
                <p>High Risk Patients</p>
              </div>
              <div className="stat-card risk-medium">
                <h3>{filteredPatients.filter(p => ((p.heart_risk > 40 && p.heart_risk <= 70) || (p.alzheimer_risk > 40 && p.alzheimer_risk <= 70) || p.overall_risk === 'Medium')).length}</h3>
                <p>Moderate Risk Patients</p>
              </div>
              <div className="stat-card risk-low">
                <h3>{filteredPatients.filter(p => (p.heart_risk <= 40 && p.alzheimer_risk <= 40 && p.overall_risk !== 'High' && p.overall_risk !== 'Medium')).length}</h3>
                <p>Low Risk Patients</p>
              </div>
            </div>

            {/* High Risk Patients Alert */}
            {filteredPatients.filter(p => (p.heart_risk > 70 || p.alzheimer_risk > 70 || p.overall_risk === 'High')).length > 0 && (
              <div className="risk-alert high-risk-alert">
                <div className="alert-icon">⚠️</div>
                <div className="alert-content">
                  <h3>High Risk Patients Require Attention</h3>
                  <p>{filteredPatients.filter(p => (p.heart_risk > 70 || p.alzheimer_risk > 70 || p.overall_risk === 'High')).length} patients require immediate medical attention</p>
                </div>
              </div>
            )}

            {/* Moderate Risk Patients Alert */}
            {filteredPatients.filter(p => ((p.heart_risk > 40 && p.heart_risk <= 70) || (p.alzheimer_risk > 40 && p.alzheimer_risk <= 70) || p.overall_risk === 'Medium')).length > 0 && (
              <div className="risk-alert moderate-risk-alert">
                <div className="alert-icon">⚡</div>
                <div className="alert-content">
                  <h3>Moderate Risk Patients Need Monitoring</h3>
                  <p>{filteredPatients.filter(p => ((p.heart_risk > 40 && p.heart_risk <= 70) || (p.alzheimer_risk > 40 && p.alzheimer_risk <= 70) || p.overall_risk === 'Medium')).length} patients need regular monitoring</p>
                </div>
              </div>
            )}
            
            {/* Patient Risk Filter */}
            <div className="patient-risk-filter">
              <h3>Filter by Risk Level</h3>
              <div className="risk-filter-buttons">
                <button 
                  className={`btn ${patientRiskFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPatientRiskFilter('all')}
                >
                  All Patients ({filteredPatients.length})
                </button>
                <button 
                  className={`btn ${patientRiskFilter === 'high' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPatientRiskFilter('high')}
                >
                  High Risk ({filteredPatients.filter(p => (p.heart_risk > 70 || p.alzheimer_risk > 70 || p.overall_risk === 'High')).length})
                </button>
                <button 
                  className={`btn ${patientRiskFilter === 'moderate' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPatientRiskFilter('moderate')}
                >
                  Moderate Risk ({filteredPatients.filter(p => ((p.heart_risk > 40 && p.heart_risk <= 70) || (p.alzheimer_risk > 40 && p.alzheimer_risk <= 70) || p.overall_risk === 'Medium')).length})
                </button>
                <button 
                  className={`btn ${patientRiskFilter === 'low' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setPatientRiskFilter('low')}
                >
                  Low Risk ({filteredPatients.filter(p => (p.heart_risk <= 40 && p.alzheimer_risk <= 40 && p.overall_risk !== 'High' && p.overall_risk !== 'Medium')).length})
                </button>
              </div>
            </div>

            <div className="search-box">
              <input
                type="text"
                placeholder="Search patients by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Email</th>
                    <th>Heart Risk</th>
                    <th>Alzheimer Risk</th>
                    <th>Overall Risk</th>
                    <th>Symptoms</th>
                    <th>Last Assessment</th>
                    <th>Risk Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients
                    .filter((patient) => {
                      if (patientRiskFilter === "all") return true;
                      if (patientRiskFilter === "high") {
                        return (
                          patient.heart_risk > 70 ||
                          patient.alzheimer_risk > 70 ||
                          patient.overall_risk === "High"
                        );
                      }
                      if (patientRiskFilter === "moderate") {
                        return (
                          (patient.heart_risk > 40 && patient.heart_risk <= 70) ||
                          (patient.alzheimer_risk > 40 &&
                            patient.alzheimer_risk <= 70) ||
                          patient.overall_risk === "Medium"
                        );
                      }
                      if (patientRiskFilter === "low") {
                        return (
                          patient.heart_risk <= 40 &&
                          patient.alzheimer_risk <= 40 &&
                          patient.overall_risk !== "High" &&
                          patient.overall_risk !== "Medium"
                        );
                      }
                      return true;
                    })
                    .map((patient, index) => {
                      const heartRisk = getRiskLevel(patient.heart_risk || 0);
                      const alzRisk = getRiskLevel(patient.alzheimer_risk || 0);
                      const overallRiskLevel = getOverallRiskLevel(patient);

                      return (
                        <tr
                          key={index}
                          className={`patient-row ${overallRiskLevel.class}`}
                        >
                          <td>
                            <div className="patient-info">
                              <strong>{patient.name || "N/A"}</strong>
                              {patient.last_login && (
                                <small>
                                  Last login:{" "}
                                  {new Date(patient.last_login).toLocaleDateString()}
                                </small>
                              )}
                            </div>
                          </td>
                          <td>{patient.email}</td>
                          <td>
                            <div className="risk-detail">
                              <span className={`risk-badge ${heartRisk.class}`}>
                                {patient.heart_risk || 0}%
                              </span>
                              <small>{heartRisk.text}</small>
                            </div>
                          </td>
                          <td>
                            <div className="risk-detail">
                              <span className={`risk-badge ${alzRisk.class}`}>
                                {patient.alzheimer_risk || 0}%
                              </span>
                              <small>{alzRisk.text}</small>
                            </div>
                          </td>
                          <td>
                            <div className="risk-detail">
                              <span
                                className={`overall-risk-badge ${overallRiskLevel.class}`}
                              >
                                {overallRiskLevel.text}
                              </span>
                            </div>
                          </td>
                          <td>
                            <div className="symptoms-cell">
                              {patient.symptoms &&
                              patient.symptoms.all_symptoms &&
                              patient.symptoms.all_symptoms.length > 0 ? (
                                <div className="symptoms-list">
                                  <div className="symptoms-summary">
                                    <span className="symptom-count">
                                      {patient.symptoms.symptom_count} symptoms
                                    </span>
                                    <span className="primary-disease">
                                      Primary:{" "}
                                      {patient.symptoms.primary_disease === "heart"
                                        ? "❤️ Heart"
                                        : "🧠 Alzheimer"}
                                    </span>
                                  </div>
                                  <div className="symptoms-details">
                                    {expandedSymptoms[patient.email]
                                      ? patient.symptoms.all_symptoms.map(
                                          (symptom, idx) => (
                                            <div
                                              key={idx}
                                              className="symptom-item"
                                            >
                                              • {symptom}
                                            </div>
                                          )
                                        )
                                      : patient.symptoms.all_symptoms
                                          .slice(0, 2)
                                          .map((symptom, idx) => (
                                            <div
                                              key={idx}
                                              className="symptom-item"
                                            >
                                              • {symptom}
                                            </div>
                                          ))}
                                    {patient.symptoms.all_symptoms.length > 2 && (
                                      <div
                                        className="symptom-more clickable"
                                        onClick={() => toggleSymptoms(patient.email)}
                                      >
                                        {expandedSymptoms[patient.email]
                                          ? `Show less (-${
                                              patient.symptoms.all_symptoms.length -
                                              2
                                            })`
                                          : `+${
                                              patient.symptoms.all_symptoms.length -
                                              2
                                            } more...`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="no-symptoms">
                                  No symptoms recorded
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {patient.last_assessment
                              ? new Date(patient.last_assessment).toLocaleDateString()
                              : "No assessment"}
                          </td>
                          <td>
                            <div className="risk-status">
                              {overallRiskLevel.class === "risk-high" && (
                                <span className="status-indicator high-risk">
                                  🔴 Critical
                                </span>
                              )}
                              {overallRiskLevel.class === "risk-medium" && (
                                <span className="status-indicator moderate-risk">
                                  🟡 Monitor
                                </span>
                              )}
                              {overallRiskLevel.class === "risk-low" && (
                                <span className="status-indicator low-risk">
                                  🟢 Stable
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button
                                className="btn btn-chat"
                                onClick={() => handleChatWithPatient(patient)}
                              >
                                💬 Chat
                              </button>
                              <button
                                className="btn btn-view"
                                onClick={() => handleViewPatientDetails(patient)}
                              >
                                👁️ Details
                              </button>
                              {overallRiskLevel.class === "risk-high" && (
                                <button
                                  className="btn btn-emergency"
                                  onClick={() => handleEmergencyContact(patient)}
                                >
                                  🚨 Emergency
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* No Patients Found */}
            {filteredPatients.filter(patient => {
              if (patientRiskFilter === 'all') return true;
              if (patientRiskFilter === 'high') {
                return patient.heart_risk > 70 || patient.alzheimer_risk > 70 || patient.overall_risk === 'High';
              }
              if (patientRiskFilter === 'moderate') {
                return (patient.heart_risk > 40 && patient.heart_risk <= 70) || 
                       (patient.alzheimer_risk > 40 && patient.alzheimer_risk <= 70) || 
                       patient.overall_risk === 'Medium';
              }
              if (patientRiskFilter === 'low') {
                return patient.heart_risk <= 40 && patient.alzheimer_risk <= 40 && 
                       patient.overall_risk !== 'High' && patient.overall_risk !== 'Medium';
              }
              return true;
            }).length === 0 && (
              <div className="no-patients-found">
                <div className="no-data-icon">📋</div>
                <h3>No Patients Found</h3>
                <p>No patients match the current filter criteria.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div>
            <h2>Analytics & Reports</h2>
            <div className="analytics-grid">
              <div className="chart-container">
                <h3>Risk Distribution</h3>
                <p>High Risk Patients: {analytics?.high_risk_count || 0}</p>
                <p>Medium Risk Patients: {analytics?.medium_risk_count || 0}</p>
                <p>Low Risk Patients: {analytics?.low_risk_count || 0}</p>
              </div>
              
              <div className="chart-container">
                <h3>Prediction Statistics</h3>
                <p>Heart Disease Predictions: {analytics?.heart_predictions || 0}</p>
                <p>Alzheimer Predictions: {analytics?.alzheimer_predictions || 0}</p>
                <p>Total Assessments: {analytics?.total_assessments || 0}</p>
              </div>
              
              <div className="chart-container">
                <h3>User Engagement</h3>
                <p>Daily Active Users: {analytics?.daily_active || 0}</p>
                <p>Weekly Active Users: {analytics?.weekly_active || 0}</p>
                <p>Monthly Active Users: {analytics?.monthly_active || 0}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "mail" && (
          <div>
            <h2>Messaging Center</h2>
            <p className="mail-subtitle">
              Direct human-to-human communication is kept separate from AI medical chat. Use this inbox to review and respond to user messages.
            </p>

            <h3>User Inbox (Contact Admin)</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User Email</th>
                    <th>Subject</th>
                    <th>Message</th>
                    <th>Received At</th>
                  </tr>
                </thead>
                <tbody>
                  {inboxItems.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center" }}>
                        No user messages yet.
                      </td>
                    </tr>
                  )}
                  {inboxItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.user_email}</td>
                      <td>{item.subject}</td>
                      <td>{item.message}</td>
                      <td>
                        {item.timestamp
                          ? new Date(item.timestamp).toLocaleString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Sent Mail (Admin → User)</h3>
            <div className="table-scroll" style={{ marginTop: "24px" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User Email</th>
                    <th>Admin Email</th>
                    <th>Subject</th>
                    <th>Message</th>
                    <th>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {mailItems.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center" }}>
                        No admin messages have been sent yet.
                      </td>
                    </tr>
                  )}
                  {mailItems.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.user_email}</td>
                      <td>{item.admin_email}</td>
                      <td>{item.subject}</td>
                      <td>{item.message}</td>
                      <td>
                        {item.timestamp
                          ? new Date(item.timestamp).toLocaleString()
                          : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit User</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({
                    ...editFormData,
                    name: e.target.value
                  })}
                  placeholder="Enter user name"
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  disabled
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={editFormData.is_admin ? 'admin' : 'user'}
                  onChange={(e) => setEditFormData({
                    ...editFormData,
                    is_admin: e.target.value === 'admin'
                  })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Confirm Delete</h2>
              <button className="close-btn" onClick={() => setShowDeleteModal(false)}>×</button>
            </div>
            <p>Are you sure you want to delete user "{selectedUser?.email}"?</p>
            <p>This action cannot be undone.</p>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-delete" onClick={handleDeleteConfirm}>
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Details Modal */}
      {showPatientDetailsModal && patientDetails && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Patient Details</h2>
              <button className="close-btn" onClick={() => setShowPatientDetailsModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={patientDetails.name || 'N/A'} disabled />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={patientDetails.email} disabled />
            </div>
            <div className="form-group">
              <label>Heart Disease Risk</label>
              <input type="text" value={`${patientDetails.heart_risk || 0}%`} disabled />
            </div>
            <div className="form-group">
              <label>Alzheimer Risk</label>
              <input type="text" value={`${patientDetails.alzheimer_risk || 0}%`} disabled />
            </div>
            <div className="form-group">
              <label>Last Assessment</label>
              <input 
                type="text" 
                value={patientDetails.last_assessment 
                  ? new Date(patientDetails.last_assessment).toLocaleString()
                  : 'No assessment'
                } 
                disabled 
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowPatientDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    {/* User Details Modal */}
      {showUserDetailsModal && selectedUserDetails && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>User Details</h2>
              <button className="close-btn" onClick={() => setShowUserDetailsModal(false)}>×</button>
            </div>
            <div className="user-details">
              <div className="detail-row">
                <label>Name:</label>
                <span>{selectedUserDetails.name || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <label>Email:</label>
                <span>{selectedUserDetails.email}</span>
              </div>
              <div className="detail-row">
                <label>Registration Date:</label>
                <span>{new Date(selectedUserDetails.created_at).toLocaleDateString()}</span>
              </div>
              <div className="detail-row">
                <label>Last Login:</label>
                <span>{selectedUserDetails.last_login ? new Date(selectedUserDetails.last_login).toLocaleDateString() : 'Never'}</span>
              </div>
              <div className="detail-row">
                <label>Status:</label>
                <span className={`status-badge ${selectedUserDetails.is_active ? 'status-active' : 'status-inactive'}`}>
                  {selectedUserDetails.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUserDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Email Modal */}
      {showBulkEmailModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Send Email to All Users</h2>
              <button className="close-btn" onClick={() => setShowBulkEmailModal(false)}>×</button>
            </div>
            <div className="email-form">
              <div className="form-group">
                <label>Subject:</label>
                <input type="text" placeholder="Enter email subject..." />
              </div>
              <div className="form-group">
                <label>Message:</label>
                <textarea placeholder="Enter your message to all users..." rows="6"></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkEmailModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleBulkEmail}>
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Edit Selected Users ({selectedUsers.length})</h2>
              <button className="close-btn" onClick={() => setShowBulkEditModal(false)}>×</button>
            </div>
            <div className="bulk-edit-list">
              {selectedUsers.map((user, index) => (
                <div key={index} className="bulk-edit-item">
                  <h4>{user.name || user.email}</h4>
                  <div className="form-group">
                    <label>Name:</label>
                    <input type="text" defaultValue={user.name || ''} />
                  </div>
                  <div className="form-group">
                    <label>Email:</label>
                    <input type="email" defaultValue={user.email} disabled />
                  </div>
                  <div className="form-group">
                    <label>Role:</label>
                    <select defaultValue={user.is_admin ? 'admin' : 'user'}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkEditModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleBulkEdit}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Delete Selected Users ({selectedUsers.length})</h2>
              <button className="close-btn" onClick={() => setShowBulkDeleteModal(false)}>×</button>
            </div>
            <div className="delete-confirmation">
              <div className="warning-icon">⚠️</div>
              <h3>Are you sure you want to delete these users?</h3>
              <p>This action cannot be undone. The following users will be permanently deleted:</p>
              <ul>
                {selectedUsers.map((user, index) => (
                  <li key={index}>{user.name || user.email}</li>
                ))}
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowBulkDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn btn-delete" onClick={handleBulkDelete}>
                Delete Users
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {showChatModal && selectedChatPatient && (
        <div className="modal chat-modal">
          <div className="modal-content chat-modal-content">
            <div className="modal-header">
              <div className="header-content">
                <div className="header-left">
                  <h2>Chat with {selectedChatPatient.name}</h2>
                  <div className="patient-info">
                    <span className="patient-email">{selectedChatPatient.email}</span>
                    <span className={`risk-badge ${getOverallRiskLevel(selectedChatPatient).class}`}>
                      {getOverallRiskLevel(selectedChatPatient).text} Risk
                    </span>
                  </div>
                </div>
                <div className="header-right">
                  <button 
                    className="btn btn-secondary btn-sm refresh-chat-btn"
                    onClick={() => {
                      console.log("Refreshing chat history...");
                      handleChatWithPatient(selectedChatPatient);
                    }}
                    title="Refresh chat history"
                  >
                    🔄 Refresh
                  </button>
                  <button className="close-btn" onClick={() => setShowChatModal(false)}>×</button>
                </div>
              </div>
            </div>
            <div className="chat-container">
              <div className="chat-messages">
                {chatMessages.map((message) => (
                  <div key={message.id} className={`message ${message.sender === 'admin' ? 'admin-message' : 'patient-message'}`}>
                    <div className="message-header">
                      <span className="sender">{message.sender === 'admin' ? 'Admin' : selectedChatPatient.name}</span>
                      <span className="timestamp">{new Date(message.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="message-content">{message.message}</div>
                  </div>
                ))}
              </div>
              <div className="chat-input">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  className="message-input"
                />
                <button 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="btn btn-primary send-btn"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;