import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./MedicalChat.css";

const API = "http://localhost:8000";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

const toDateSafe = (value) => {
  if (!value) return new Date();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const refreshToken = async () => {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }
  
  try {
    const response = await axios.post(`${API}/auth/refresh`, {
      refresh_token: refreshToken
    });
    
    const newToken = response.data.access_token;
    localStorage.setItem("token", newToken);
    
    if (response.data.refresh_token) {
      localStorage.setItem("refresh_token", response.data.refresh_token);
    }
    
    return newToken;
  } catch (error) {
    console.error("Token refresh failed:", error);
    // Clear tokens and redirect to login
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
    throw error;
  }
};

function MedicalChat() {
  const [message, setMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // Load persisted chat history (user only) on refresh
  useEffect(() => {
    const loadHistory = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const res = await axios.get(`${API}/dashboard/user/chat-history`, {
          headers: getAuthHeader(),
        });

        const history = Array.isArray(res.data) ? res.data : [];
        const formatted = history.flatMap((item) => {
          const ts = toDateSafe(item.timestamp);
          const userMsg = item.user_message || item.message || item.user || "";
          const aiMsg = item.ai_response || item.reply || item.ai || "";

          const aiDetectedCondition =
            item.detected_condition || item.condition || item.detectedCondition;

          const medicines = item.medicines || {};

          const out = [];
          if (userMsg) {
            out.push({ type: "user", content: userMsg, timestamp: ts });
          }
          if (aiMsg) {
            out.push({
              type: "ai",
              content: aiMsg,
              timestamp: ts,
              detected_condition: aiDetectedCondition,
              medicines,
              medicine_summary: item.medicine_summary,
              interactions: item.interactions,
              category: item.category,
              keywords: item.keywords,
              urgency: item.urgency,
            });
          }
          return out;
        });

        if (formatted.length > 0) setChatHistory(formatted);
      } catch (e) {
        // Don't block the page if history fails; keep it silent
        console.warn("Failed to load chat history:", e);
      }
    };

    loadHistory();
  }, []);

  const handleChat = async () => {
    if (!message.trim()) {
      setError("Please enter a message");
      return;
    }

    const userMessage = message.trim();
    setMessage("");
    setLoading(true);
    setError("");

    setChatHistory(prev => [...prev, { type: 'user', content: userMessage, timestamp: new Date() }]);

    try {
      let res;
      
      // Check if user is logged in and use authenticated endpoint first
      const token = localStorage.getItem("token");
      
      if (token) {
        try {
          console.log("✅ Using authenticated chat endpoint (will save to dashboard)");
          res = await axios.post(
            `${API}/chat`,
            { message: userMessage },
            { headers: getAuthHeader() }
          );
        } catch (authErr) {
          // If token expired, try to refresh it
          if (authErr.response?.status === 401) {
            console.log("🔄 Token expired, attempting refresh...");
            try {
              const newToken = await refreshToken();
              res = await axios.post(
                `${API}/chat`,
                { message: userMessage },
                { headers: { Authorization: `Bearer ${newToken}` } }
              );
            } catch (refreshErr) {
              console.log("⚠️ Token refresh failed, using public endpoint:", refreshErr.message);
              res = await axios.post(
                `${API}/chat-public`,
                { message: userMessage }
              );
            }
          } else {
            console.log("⚠️ Authenticated endpoint failed, trying public endpoint:", authErr.message);
            res = await axios.post(
              `${API}/chat-public`,
              { message: userMessage }
            );
          }
        }
      } else {
        // No token, use public endpoint
        console.log("⚠️ No token found, using public chat endpoint (won't save to dashboard)");
        res = await axios.post(
          `${API}/chat-public`,
          { message: userMessage }
        );
      }

      console.log("✅ Chat response:", res.data);
      
      setChatHistory(prev => [...prev, { 
        type: 'ai', 
        content: res.data.reply,
        timestamp: new Date(),
        detected_condition: res.data.detected_condition,
        medicines: res.data.medicines
      }]);

    } catch (err) {
      console.error("Chat error:", err);
      setError(
        `⚠️ Error: ${
          err.response?.data?.detail || err.message
        }`
      );
      
      setChatHistory(prev => [...prev, { 
        type: 'ai', 
        content: "I apologize, but I encountered an error. Please try again.",
        timestamp: new Date()
      }]);
    }
    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) handleChat();
  };

  const clearChat = () => {
    setChatHistory([]);
    setError("");
  };

  return (
    <div className="chat-page">
      <div className="chat-container">
        <div className="chat-header">
          <h2 className="chat-title">🩺 AI Medical Chat</h2>
          <button className="chat-clear" onClick={clearChat}>Clear Chat</button>
        </div>

        {/* Chat History */}
        <div className="chat-history">
          {chatHistory.length === 0 && (
            <div className="chat-empty">
              <div className="welcome-icon">🩺</div>
              <h3>Welcome to Medical AI Assistant</h3>
              <p>I'm here to help you with health-related questions and concerns.</p>
              <div className="quick-actions">
                <button 
                  className="quick-action-btn"
                  onClick={() => setMessage("I have a fever and headache")}
                >
                  🌡️ Fever & Headache
                </button>
                <button 
                  className="quick-action-btn"
                  onClick={() => setMessage("I'm feeling chest pain")}
                >
                  ❤️ Chest Pain
                </button>
                <button 
                  className="quick-action-btn"
                  onClick={() => setMessage("I have trouble sleeping")}
                >
                  😴 Sleep Issues
                </button>
                <button 
                  className="quick-action-btn"
                  onClick={() => setMessage("I feel anxious and stressed")}
                >
                  😰 Anxiety & Stress
                </button>
              </div>
              <p className="disclaimer">
                <em>⚠️ This is for informational purposes only. Always consult a healthcare professional for medical advice.</em>
              </p>
            </div>
          )}

          {chatHistory.map((chat, index) => (
            <div key={index} className={`chat-bubble ${chat.type}`}>
              <div className="chat-sender">
                {chat.type === 'user' ? '👤 You' : chat.type === 'ai' ? '🤖 AI Doctor' : '⚠️ Error'}
                {chat.urgency && chat.urgency !== 'normal' && (
                  <span className={`urgency-badge ${chat.urgency}`}>
                    {chat.urgency === 'emergency' ? '🚨 Emergency' : '⚠️ Urgent'}
                  </span>
                )}
              </div>
              <div className="chat-content">
                {chat.content}
                
                {/* Additional AI Response Info */}
                {chat.type === 'ai' && (chat.category || chat.keywords?.length > 0) && (
                  <div className="ai-metadata">
                    {chat.category && (
                      <span className="category-tag">{chat.category.replace('_', ' ').toUpperCase()}</span>
                    )}
                    {chat.keywords && chat.keywords.length > 0 && (
                      <div className="keywords">
                        <strong>Keywords:</strong> {chat.keywords.join(', ')}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Medicine Recommendations */}
                {chat.type === 'ai' && chat.detected_condition && (
                  <div className="medicine-recommendations">
                    <h4>🩺 Detected Condition: {chat.detected_condition}</h4>
                    
                    {chat.medicines && chat.medicines.medications && chat.medicines.medications.length > 0 && (
                      <div className="medicines-section">
                        <h5>💊 Recommended Medicines:</h5>
                        {chat.medicines.medications.map((med, index) => (
                          <div key={index} className="medicine-item">
                            <strong>{med.name}</strong>
                            <p><strong>Dosage:</strong> {med.dosage}</p>
                            <p><strong>Type:</strong> {med.type}</p>
                            <p><strong>Description:</strong> {med.description}</p>
                            <p><strong>Side Effects:</strong> {med.side_effects?.join(', ')}</p>
                            <p><strong>Contraindications:</strong> {med.contraindications?.join(', ')}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {chat.medicines && chat.medicines.lifestyle && chat.medicines.lifestyle.length > 0 && (
                      <div className="lifestyle-recommendations">
                        <h5>🏃 Lifestyle Recommendations:</h5>
                        <ul>
                          {chat.medicines.lifestyle.map((item, index) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {chat.medicine_summary && (
                      <div className="medicine-summary">
                        <h5>📋 Summary:</h5>
                        <p>{chat.medicine_summary}</p>
                      </div>
                    )}
                    
                    {chat.interactions && chat.interactions.length > 0 && (
                      <div className="interactions-warning">
                        <h5>⚠️ Drug Interactions:</h5>
                        <ul>
                          {chat.interactions.map((interaction, idx) => (
                            <li key={idx}>{interaction}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="chat-timestamp">{chat.timestamp.toLocaleTimeString()}</div>
            </div>
          ))}

          {loading && (
            <div className="chat-bubble ai">
              <div className="chat-sender">🤖 AI Doctor</div>
              <div className="chat-content">
                <span className="thinking-dots">
                  <span></span><span></span><span></span>
                </span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Section */}
        <div className="chat-input-section">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your symptoms or health concerns..."
            disabled={loading}
            className="chat-input"
          />
          <button
            onClick={handleChat}
            disabled={loading || !message.trim()}
            className="chat-button"
          >
            {loading ? "..." : "Send"}
          </button>
        </div>

        {error && <div className="chat-error">{error}</div>}
      </div>
    </div>
  );
}

export default MedicalChat;
