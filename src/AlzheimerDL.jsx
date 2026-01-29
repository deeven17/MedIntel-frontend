import React, { useState, useMemo } from "react";
import axios from "axios";
import JarvisVoiceAssistant from "./JarvisVoiceAssistant";
import "./AlzheimerDL.css";

const API = "http://localhost:8000";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

const ALZ_TE = {
  "Age (years)": "వయస్సు (సంవత్సరాలు)",
  "Years of Education": "విద్యా సంవత్సరాలు",
  "Socioeconomic Status (1-5)": "సామాజిక-ఆర్థిక స్థితి (1-5)",
  "MMSE Score": "MMSE స్కోర్",
  "Estimated Total Intracranial Volume (eTIV)": "అంచనా మొత్తం అంతర్ కపాల వాల్యూమ్ (eTIV)",
  "Normalized Whole Brain Volume (nWBV)": "సాధారణీకృత మొత్తం మెదడు వాల్యూమ్ (nWBV)",
  "Atlas Scaling Factor (ASF)": "అట్లాస్ స్కేలింగ్ ఫ్యాక్టర్ (ASF)",
  "Medical & Cognitive Assessment": "వైద్య మరియు అభిజ్ఞా అంచనా",
  "Please provide the following medical data for accurate prediction": "ఖచ్చితమైన అంచనా కోసం క్రింది వైద్య డేటా అందించండి",
  "Get Prediction": "అంచనా పొందండి",
  "Processing...": "ప్రాసెస్ చేయడం...",
  "Alzheimer Risk Prediction": "అల్జైమర్ ప్రమాద అంచనా",
  "Advanced AI-powered prediction using comprehensive medical data analysis": "సమగ్ర వైద్య డేటా విశ్లేషణ ఉపయోగించి అధునాతన AI-ఆధారిత అంచనా",
  "Language": "భాష",
  "English": "ఇంగ్లీష్",
  "Telugu": "తెలుగు",
};

const AlzheimerDL = () => {
  const [language, setLanguage] = useState("en");
  const [formData, setFormData] = useState({
    age: "",
    educ: "",
    ses: "",
    mmse: "",
    etiv: "",
    nwbv: "",
    asf: "",
  });

  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(true);

  const alzheimerFields = [
    {
      name: "age",
      label: "Age (years)",
      type: "number",
      min: "60",
      max: "100",
      placeholder: "60-100",
    },
    {
      name: "educ",
      label: "Years of Education",
      type: "number",
      min: "0",
      max: "25",
      placeholder: "0-25",
    },
    {
      name: "ses",
      label: "Socioeconomic Status (1-5)",
      type: "number",
      min: "1",
      max: "5",
      placeholder: "1-5",
    },
    {
      name: "mmse",
      label: "MMSE Score",
      type: "number",
      min: "0",
      max: "30",
      placeholder: "0-30",
    },
    {
      name: "etiv",
      label: "Estimated Total Intracranial Volume (eTIV)",
      type: "number",
      min: "1000",
      max: "2000",
      placeholder: "e.g., 1500",
    },
    {
      name: "nwbv",
      label: "Normalized Whole Brain Volume (nWBV)",
      type: "number",
      min: "0.6",
      max: "1.0",
      step: "0.01",
      placeholder: "0.60-1.00",
    },
    {
      name: "asf",
      label: "Atlas Scaling Factor (ASF)",
      type: "number",
      min: "0.8",
      max: "1.5",
      step: "0.01",
      placeholder: "0.80-1.50",
    },
  ];

  const t = (x) => (language === "te" && ALZ_TE[x]) ? ALZ_TE[x] : x;
  const localizedAlzheimerFields = useMemo(
    () =>
      alzheimerFields.map((f) => ({
        ...f,
        label: t(f.label),
        options: f.options?.map((o) => ({ ...o, label: t(o.label) })),
      })),
    [language]
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleJarvisData = (data) => {
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate form data
      const requiredFields = ["age", "educ", "ses", "mmse", "etiv", "nwbv", "asf"];
      const missingFields = requiredFields.filter((field) => !formData[field]);

      if (missingFields.length > 0) {
        setError(`Please fill in all required fields: ${missingFields.join(", ")}`);
        setLoading(false);
        return;
      }

      // Convert to numbers
      const numericData = {
        age: parseFloat(formData.age),
        educ: parseFloat(formData.educ),
        ses: parseFloat(formData.ses),
        mmse: parseFloat(formData.mmse),
        etiv: parseFloat(formData.etiv),
        nwbv: parseFloat(formData.nwbv),
        asf: parseFloat(formData.asf),
      };

      // Validate numeric ranges
      if (numericData.age < 60 || numericData.age > 100) {
        setError("Age must be between 60 and 100 years");
        setLoading(false);
        return;
      }

      if (numericData.mmse < 0 || numericData.mmse > 30) {
        setError("MMSE score must be between 0 and 30");
        setLoading(false);
        return;
      }

      const response = await axios.post(`${API}/predict/alzheimer`, numericData, {
        headers: getAuthHeader(),
      });

      setPrediction(response.data);
      setShowForm(false);
    } catch (err) {
      console.error("Prediction error:", err);
      setError(
        err.response?.data?.detail || "Failed to make prediction. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      age: "",
      educ: "",
      ses: "",
      mmse: "",
      etiv: "",
      nwbv: "",
      asf: "",
    });
    setPrediction(null);
    setError("");
    setShowForm(true);
  };

  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case "mild":
        return "#10b981";
      case "moderate":
        return "#f59e0b";
      case "severe":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const getSeverityDescription = (severity) => {
    switch (severity?.toLowerCase()) {
      case "mild":
        return "Early stage with minor cognitive changes. Regular monitoring recommended.";
      case "moderate":
        return "Middle stage with noticeable cognitive decline. Medical intervention advised.";
      case "severe":
        return "Advanced stage with significant cognitive impairment. Immediate medical attention required.";
      default:
        return "Unable to determine severity level.";
    }
  };

  return (
    <div className="alzheimer-page">
      <div className="container">
        {showForm ? (
          <>
            <div className="page-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h1 className="page-title">🧠 {t("Alzheimer Risk Prediction")}</h1>
                  <p className="page-description">{t("Advanced AI-powered prediction using comprehensive medical data analysis")}</p>
                </div>
                <div className="language-selector" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label htmlFor="alz-lang" style={{ fontWeight: 600 }}>{t("Language")}:</label>
                  <select id="alz-lang" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "1rem" }}>
                    <option value="en">English</option>
                    <option value="te">తెలుగు (Telugu)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="prediction-form-container">
              {/* JARVIS Voice Assistant */}
              <JarvisVoiceAssistant
                fields={localizedAlzheimerFields}
                onFieldsFilled={handleJarvisData}
                language={language}
              />

              {/* Manual Form */}
              <div className="form-card">
                <div className="form-header">
                  <h2>📋 {t("Medical & Cognitive Assessment")}</h2>
                  <p>{t("Please provide the following medical data for accurate prediction")}</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="prediction-form">
                  <div className="form-grid">
                    {localizedAlzheimerFields.map((field) => (
                      <div key={field.name} className="form-group">
                        <label htmlFor={field.name} className="form-label">
                          {field.label}
                        </label>
                        <input
                          id={field.name}
                          type="number"
                          name={field.name}
                          value={formData[field.name]}
                          onChange={handleInputChange}
                          min={field.min}
                          max={field.max}
                          step={field.step || "1"}
                          placeholder={field.placeholder}
                          className="form-input"
                          required
                        />
                      </div>
                    ))}
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="loading-spinner"></span>
                          {t("Processing...")}
                        </>
                      ) : (
                        `🔍 ${t("Get Prediction")}`
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        ) : (
          <div className="prediction-results">
            <div className="results-card">
              <div className="results-header">
                <h2>Prediction Results</h2>
                <button onClick={resetForm} className="btn btn-secondary">
                  ← Back to Form
                </button>
              </div>

              <div className="prediction-main">
                {/* Severity Indicator */}
                <div className="severity-indicator">
                  <div
                    className="severity-badge"
                    style={{
                      backgroundColor: getSeverityColor(prediction?.prediction),
                    }}
                  >
                    {prediction?.prediction}
                  </div>
                  <h3 className="severity-title">Alzheimer Severity Level</h3>
                </div>

                {/* Severity Description */}
                <div className="severity-description">
                  <p>{getSeverityDescription(prediction?.prediction)}</p>
                </div>

                {/* Risk Percentage Display */}
                {prediction?.risk_percentage && (
                  <div className="risk-percentage-display">
                    <div className="risk-percentage-main">
                      <span className="risk-percentage-number">
                        {Math.round(parseFloat(prediction.risk_percentage))}%
                      </span>
                      <span className="risk-percentage-label">Overall Risk</span>
                    </div>
                  </div>
                )}

                {/* Confidence Meter */}
                {prediction?.confidence && (
                  <div className="confidence-meter">
                    <div className="confidence-label">Model Confidence</div>
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${
                            Math.round(
                              parseFloat(prediction.confidence) * 100
                            ) || 0
                          }%`,
                          backgroundColor: getSeverityColor(
                            prediction?.prediction
                          ),
                        }}
                      ></div>
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        fontSize: "0.9rem",
                        marginTop: "8px",
                      }}
                    >
                      {Math.round(parseFloat(prediction.confidence) * 100) || 0}%
                    </div>
                  </div>
                )}

                {/* Probability Breakdown */}
                {prediction?.probabilities && (
                  <div className="risk-breakdown">
                    <h4>Probability Breakdown</h4>
                    <div className="risk-stats">
                      {Object.entries(prediction.probabilities).map(
                        ([key, value]) => (
                          <div key={key} className="risk-stat">
                            <span className="risk-stat-label">{key}:</span>
                            <span className="risk-stat-value">
                              {typeof value === "number"
                                ? `${value.toFixed(2)}%`
                                : value}
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Personalized Recommendations */}
                <div className="recommendations">
                  <h4>💡 Personalized Recommendations</h4>
                  <ul>
                    <li>
                      Consult a neurologist or memory clinic for further evaluation
                    </li>
                    <li>
                      Maintain cognitive stimulation through reading and brain
                      exercises
                    </li>
                    <li>
                      Engage in regular physical activity and social interaction
                    </li>
                    <li>
                      Follow a Mediterranean-style diet rich in fruits and healthy
                      fats
                    </li>
                    <li>
                      Ensure regular sleep and manage cardiovascular risk factors
                    </li>
                    <li>Discuss support options with family and caregivers</li>
                  </ul>
                </div>

                {/* Input Data Summary */}
                <div className="input-summary">
                  <h4>📊 Your Input Data</h4>
                  <div className="data-grid">
                    {Object.entries(formData).map(([key, value]) => (
                      <div key={key} className="data-item">
                        <span className="data-label">{key}</span>
                        <span className="data-value">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Button */}
                <div className="form-actions" style={{ marginTop: "30px" }}>
                  <button onClick={resetForm} className="btn btn-primary">
                    📝 Make Another Prediction
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlzheimerDL;