import React, { useState, useMemo } from "react";
import axios from "axios";
import JarvisVoiceAssistant from "./JarvisVoiceAssistant";
import "./HeartDL.css";

const API = "http://localhost:8000";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { Authorization: `Bearer ${token}` };
};

const HEART_TE = {
  "Age (years)": "వయస్సు (సంవత్సరాలు)",
  "Sex": "లింగం",
  "Female": "స్త్రీ",
  "Male": "పురుష",
  "Chest Pain Type": "ఛాతి నొప్పి రకం",
  "Typical Angina": "సాధారణ యాంజైనా",
  "Atypical Angina": "అసాధారణ యాంజైనా",
  "Non-anginal Pain": "నాన్-యాంజైనల్ నొప్పి",
  "Asymptomatic": "రోగలక్షణాలేని",
  "Resting Blood Pressure (mm Hg)": "విశ్రాంతి రక్తపోటు (మిమీ Hg)",
  "Serum Cholesterol (mg/dl)": "సీరం కొలెస్ట్రాల్ (మిగ్/డెసిలీ)",
  "Fasting Blood Sugar": "ఉపవాస రక్తశర్కర",
  "≤ 120 mg/dl": "≤ 120 mg/dl",
  "> 120 mg/dl": "> 120 mg/dl",
  "Resting ECG": "విశ్రాంతి ఈసీజీ",
  "Normal": "సాధారణం",
  "ST-T wave abnormality": "ST-T వేవ్ అసాధారణత",
  "Left ventricular hypertrophy": "ఎడమ వెంట్రికల హైపర్‌ట్రోఫీ",
  "Maximum Heart Rate (bpm)": "గరిష్ట హృదయ రేట్ (bpm)",
  "Exercise Induced Angina": "వ్యాయామంతో యాంజైనా",
  "No": "లేదు",
  "Yes": "అవును",
  "ST Depression (mm)": "ST డిప్రెషన్ (మిమీ)",
  "Slope of Peak Exercise ST": "పీక్ ఎక్సర్సైజ్ ST వాలుకోణం",
  "Upsloping": "అప్ స్లోపింగ్",
  "Flat": "ఫ్లాట్",
  "Downsloping": "డౌన్ స్లోపింగ్",
  "Number of Major Vessels": "ప్రధాన రక్త నాళాల సంఖ్య",
  "0 vessels": "0 నాళాలు",
  "1 vessel": "1 నాళం",
  "2 vessels": "2 నాళాలు",
  "3 vessels": "3 నాళాలు",
  "Thalassemia": "థలసీమియా",
  "Fixed Defect": "ఫిక్స్డ్ డిఫెక్ట్",
  "Reversible Defect": "రివర్సిబుల్ డిఫెక్ట్",
  "Medical Data Form": "వైద్య డేటా ఫారమ్",
  "Please provide the following medical data for accurate prediction": "ఖచ్చితమైన అంచనా కోసం క్రింది వైద్య డేటా అందించండి",
  "Get Prediction": "అంచనా పొందండి",
  "Processing...": "ప్రాసెస్ చేయడం...",
  "Select": "ఎంచుకోండి",
  "Heart Disease Risk Assessment": "హృదయ రోగ ప్రమాద అంచనా",
  "Advanced AI-powered heart disease risk assessment using comprehensive medical data": "సమగ్ర వైద్య డేటా ఉపయోగించి అధునాతన AI-ఆధారిత హృదయ రోగ ప్రమాద అంచనా",
  "Language": "భాష",
  "English": "ఇంగ్లీష్",
  "Telugu": "తెలుగు",
};

function HeartDL() {
  const [language, setLanguage] = useState("en");
  const [formData, setFormData] = useState({
    age: "",
    sex: "",
    cp: "",
    trestbps: "",
    chol: "",
    fbs: "",
    restecg: "",
    thalach: "",
    exang: "",
    oldpeak: "",
    slope: "",
    ca: "",
    thal: "",
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(true);

  // Heart disease form fields for JARVIS + manual form
  const heartFields = [
    {
      name: "age",
      label: "Age (years)",
      type: "number",
      min: "29",
      max: "77",
      placeholder: "29-77",
    },
    {
      name: "sex",
      label: "Sex",
      type: "select",
      options: [
        { value: "0", label: "Female" },
        { value: "1", label: "Male" },
      ],
    },
    {
      name: "cp",
      label: "Chest Pain Type",
      type: "select",
      options: [
        { value: "0", label: "Typical Angina" },
        { value: "1", label: "Atypical Angina" },
        { value: "2", label: "Non-anginal Pain" },
        { value: "3", label: "Asymptomatic" },
      ],
    },
    {
      name: "trestbps",
      label: "Resting Blood Pressure (mm Hg)",
      type: "number",
      min: "94",
      max: "200",
      placeholder: "94-200",
    },
    {
      name: "chol",
      label: "Serum Cholesterol (mg/dl)",
      type: "number",
      min: "126",
      max: "564",
      placeholder: "126-564",
    },
    {
      name: "fbs",
      label: "Fasting Blood Sugar",
      type: "select",
      options: [
        { value: "0", label: "≤ 120 mg/dl" },
        { value: "1", label: "> 120 mg/dl" },
      ],
    },
    {
      name: "restecg",
      label: "Resting ECG",
      type: "select",
      options: [
        { value: "0", label: "Normal" },
        { value: "1", label: "ST-T wave abnormality" },
        { value: "2", label: "Left ventricular hypertrophy" },
      ],
    },
    {
      name: "thalach",
      label: "Maximum Heart Rate (bpm)",
      type: "number",
      min: "71",
      max: "202",
      placeholder: "71-202",
    },
    {
      name: "exang",
      label: "Exercise Induced Angina",
      type: "select",
      options: [
        { value: "0", label: "No" },
        { value: "1", label: "Yes" },
      ],
    },
    {
      name: "oldpeak",
      label: "ST Depression (mm)",
      type: "number",
      min: "0",
      max: "6.2",
      step: "0.1",
      placeholder: "0.0-6.2",
    },
    {
      name: "slope",
      label: "Slope of Peak Exercise ST",
      type: "select",
      options: [
        { value: "0", label: "Upsloping" },
        { value: "1", label: "Flat" },
        { value: "2", label: "Downsloping" },
      ],
    },
    {
      name: "ca",
      label: "Number of Major Vessels",
      type: "select",
      options: [
        { value: "0", label: "0 vessels" },
        { value: "1", label: "1 vessel" },
        { value: "2", label: "2 vessels" },
        { value: "3", label: "3 vessels" },
      ],
    },
    {
      name: "thal",
      label: "Thalassemia",
      type: "select",
      options: [
        { value: "0", label: "Normal" },
        { value: "1", label: "Fixed Defect" },
        { value: "2", label: "Reversible Defect" },
      ],
    },
  ];

  const t = (x) => (language === "te" && HEART_TE[x]) ? HEART_TE[x] : x;
  const localizedHeartFields = useMemo(
    () =>
      heartFields.map((f) => ({
        ...f,
        label: t(f.label),
        options: f.options?.map((o) => ({ ...o, label: t(o.label) })),
      })),
    [language]
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Apply JARVIS output into form
  const handleJarvisData = (data) => {
    setFormData((prevData) => ({
      ...prevData,
      ...data,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      // Validate form data
      const requiredFields = heartFields.map((field) => field.name);
      const missingFields = requiredFields.filter((field) => !formData[field]);

      if (missingFields.length > 0) {
        setError(
          `Please fill in all required fields: ${missingFields.join(", ")}`
        );
        setLoading(false);
        return;
      }

      // Convert to numbers for numeric fields
      const numericFields = ["age", "trestbps", "chol", "thalach", "oldpeak"];
      const processedData = { ...formData };
      numericFields.forEach((field) => {
        processedData[field] = parseFloat(processedData[field]);
      });

      console.log("🫀 Sending heart prediction request:", processedData);

      const res = await axios.post(`${API}/predict/heart`, processedData, {
        headers: getAuthHeader(),
      });

      console.log("✅ Heart prediction response:", res.data);
      setResult(res.data);
      setShowForm(false);
    } catch (err) {
      console.error("Heart prediction error:", err);
      setError(
        `⚠️ Error predicting heart disease: ${
          err.response?.data?.detail || err.message
        }`
      );
    }

    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      age: "",
      sex: "",
      cp: "",
      trestbps: "",
      chol: "",
      fbs: "",
      restecg: "",
      thalach: "",
      exang: "",
      oldpeak: "",
      slope: "",
      ca: "",
      thal: "",
    });
    setResult(null);
    setError("");
    setShowForm(true);
  };

  const getRiskColor = (risk) => {
    if (risk?.toLowerCase().includes("no") || risk?.toLowerCase().includes("low"))
      return "#10b981";
    if (risk?.toLowerCase().includes("moderate")) return "#f59e0b";
    if (risk?.toLowerCase().includes("high") || risk?.toLowerCase().includes("yes"))
      return "#ef4444";
    return "#6b7280";
  };

  return (
    <div className="heartdl-page">
      <div className="container">
        {showForm ? (
          <>
            <div className="page-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div>
                  <h1 className="page-title">❤️ {t("Heart Disease Risk Assessment")}</h1>
                  <p className="page-description">{t("Advanced AI-powered heart disease risk assessment using comprehensive medical data")}</p>
                </div>
                <div className="language-selector" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label htmlFor="heart-lang" style={{ fontWeight: 600 }}>{t("Language")}:</label>
                  <select id="heart-lang" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "1rem" }}>
                    <option value="en">English</option>
                    <option value="te">తెలుగు (Telugu)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="prediction-form-container">
              {/* JARVIS Voice Assistant */}
              <JarvisVoiceAssistant
                fields={localizedHeartFields}
                onFieldsFilled={handleJarvisData}
                language={language}
              />

              {/* Manual Form */}
              <div className="form-card">
                <div className="form-header">
                  <h2>📋 {t("Medical Data Form")}</h2>
                  <p>{t("Please provide the following medical data for accurate prediction")}</p>
                </div>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit} className="prediction-form">
                  <div className="form-grid">
                    {localizedHeartFields.map((field) => (
                      <div key={field.name} className="form-group">
                        <label htmlFor={field.name} className="form-label">
                          {field.label}
                        </label>

                        {field.type === "select" ? (
                          <select
                            id={field.name}
                            name={field.name}
                            value={formData[field.name]}
                            onChange={handleChange}
                            className="form-select"
                            required
                          >
                            <option value="">{t("Select")} {field.label}</option>
                            {field.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id={field.name}
                            type="number"
                            name={field.name}
                            value={formData[field.name]}
                            onChange={handleChange}
                            min={field.min}
                            max={field.max}
                            step={field.step || "1"}
                            placeholder={field.placeholder}
                            className="form-input"
                            required
                          />
                        )}
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
                {/* Risk Indicator */}
                <div className="severity-indicator">
                  <div
                    className="severity-badge"
                    style={{ backgroundColor: getRiskColor(result?.prediction) }}
                  >
                    {result?.prediction}
                  </div>
                  <h3 className="severity-title">Heart Disease Risk</h3>
                </div>

                {/* Risk Percentage Display */}
                {result?.risk_percentage && (
                  <div className="risk-percentage-display">
                    <div className="risk-percentage-main">
                      <span className="risk-percentage-number">
                        {Math.round(parseFloat(result.risk_percentage))}%
                      </span>
                      <span className="risk-percentage-label">Risk Level</span>
                    </div>
                  </div>
                )}

                {/* Risk Description */}
                <div className="severity-description">
                  <p>
                    Based on the medical data provided, the AI model has analyzed
                    your health parameters and generated this risk assessment.
                    Please consult a medical professional for proper diagnosis
                    and treatment.
                  </p>
                </div>

                {/* Confidence Meter */}
                {result?.confidence && (
                  <div className="confidence-meter">
                    <div className="confidence-label">Model Confidence</div>
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill"
                        style={{
                          width: `${
                            Math.round(parseFloat(result.confidence) * 100) || 0
                          }%`,
                          backgroundColor: getRiskColor(result?.prediction),
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
                      {Math.round(parseFloat(result.confidence) * 100) || 0}%
                    </div>
                  </div>
                )}

                {/* Risk Breakdown */}
                {result?.risk_breakdown && (
                  <div className="risk-breakdown">
                    <h4>Risk Analysis</h4>
                    <div className="risk-stats">
                      {Object.entries(result.risk_breakdown).map(
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

                {/* Recommendations */}
                <div className="recommendations">
                  <h4>💊 Clinical Recommendations</h4>
                  <ul>
                    <li>Consult with a cardiologist for comprehensive evaluation</li>
                    <li>Regular heart health monitoring and screening</li>
                    <li>Maintain healthy diet rich in fruits and vegetables</li>
                    <li>Engage in regular physical exercise (30 mins daily)</li>
                    <li>Monitor blood pressure and cholesterol levels</li>
                    <li>Reduce salt and saturated fat intake</li>
                    <li>Avoid smoking and limit alcohol consumption</li>
                    <li>Manage stress through meditation or yoga</li>
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

                {/* Action Buttons */}
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
}

export default HeartDL;