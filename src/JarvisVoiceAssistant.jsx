import React, { useEffect, useRef, useState } from "react";
import "./JarvisVoiceAssistant.css";

/**
 * JarvisVoiceAssistant - Enhanced Voice Input Component with Field Guidance
 * Provides clear, guided voice input for medical forms
 * Shows accepted values/ranges to prevent user confusion
 */
const PROMPTS = {
  start: { en: "Hello! I am JARVIS, your voice assistant. Let's fill out this form together. What is your {label}? {guidance} (Field 1 of {total})", te: "నమస్కారం! నేను జార్విస్, మీ వాయిస్ సహాయకుడు. ఈ ఫారమ్‌ను కలిసి పూరిద్దాం. మీ {label} ఏమిటి? {guidance} (ఫీల్డ్ 1/{total})" },
  next: { en: "Got it, your {label} is {value}. Now, what is your {nextLabel}? {guidance} (Field {n} of {total})", te: "సరే, మీ {label} {value}. ఇప్పుడు మీ {nextLabel} ఏమిటి? {guidance} (ఫీల్డ్ {n}/{total})" },
  done: { en: "Got it, your {label} is {value}. All information collected.", te: "సరే, మీ {label} {value}. అన్ని సమాచారం సేకరించబడింది." },
  retry: { en: "Sorry, I could not understand that. Please repeat your {label}. {guidance}", te: "క్షమించండి, నేను అర్థం చేసుకోలేకపోయాను. దయచేసి మీ {label} మళ్లీ చెప్పండి. {guidance}" },
  noSpeech: { en: "I didn't hear you clearly. Please repeat your {label}. {guidance}", te: "మీరు చెప్పినది వినలేదు. దయచేసి మీ {label} పునరావృతం చేయండి. {guidance}" },
  skip: { en: "Skipping that field. Now, what is your {nextLabel}? {guidance} (Field {n} of {total})", te: "ఆ ఫీల్డ్ దాటవేస్తున్నాను. ఇప్పుడు మీ {nextLabel} ఏమిటి? {guidance} (ఫీల్డ్ {n}/{total})" },
  skipDone: { en: "I have collected all available information.", te: "అందుబాటులో ఉన్న సమాచారాన్ని సేకరించాను." },
  title: { en: "🤖 JARVIS Voice Assistant", te: "🤖 జార్విస్ వాయిస్ సహాయకుడు" },
  subtitle: { en: "Speak to fill the form automatically", te: "ఫారమ్‌ను స్వయంచాలకంగా పూరించడానికి మాట్లాడండి" },
  startBtn: { en: "▶️ Start JARVIS", te: "▶️ జార్విస్ ప్రారంభించు" },
  stopBtn: { en: "⏹️ Stop", te: "⏹️ నిలుపు" },
  resetBtn: { en: "🔄 Reset", te: "🔄 రీసెట్" },
};

const getPrompt = (key, params, isTe) => {
  const p = PROMPTS[key];
  let s = (p && (isTe ? p.te : p.en)) || (p && p.en) || "";
  Object.keys(params || {}).forEach((k) => {
    s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(params[k]));
  });
  return s;
};

const TE_DIGITS = { "౦": "0", "౧": "1", "౨": "2", "౩": "3", "౪": "4", "౫": "5", "౬": "6", "౭": "7", "౮": "8", "౯": "9" };
const TE_NUMBERS = { "ఒకటి": 1, "రెండు": 2, "మూడు": 3, "నాలుగు": 4, "ఐదు": 5, "ఆరు": 6, "ఏడు": 7, "ఎనిమిది": 8, "తొమ్మిది": 9, "పది": 10, "ఇరవై": 20, "ముప్పై": 30, "నలభై": 40, "ఐంబై": 50, "అరవై": 60, "డెబ్బై": 70, "ఎనభై": 80, "తొంభై": 90, "నూరు": 100 };

function parseTeNumber(text) {
  if (!text || typeof text !== "string") return null;
  let s = text.trim();
  for (const [te, d] of Object.entries(TE_DIGITS)) s = s.replace(new RegExp(te, "g"), d);
  const num = s.match(/[\d.]+/);
  if (num) return num[0];
  for (const [word, n] of Object.entries(TE_NUMBERS)) {
    if (s.includes(word)) return String(n);
  }
  return null;
}

const JarvisVoiceAssistant = ({ fields, onFieldsFilled, language = "en" }) => {
  const isTe = language === "te";
  // ============ STATE MANAGEMENT ============
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [collectedData, setCollectedData] = useState({});
  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [interimText, setInterimText] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [progress, setProgress] = useState("0/0");
  const [currentFieldGuidance, setCurrentFieldGuidance] = useState("");

  // ============ REFS ============
  const recognitionRef = useRef(null);
  const retryCountRef = useRef(0);
  const sessionRef = useRef({ active: false, fieldIndex: 0, data: {} });
  const listeningTimeoutRef = useRef(null);
  const accumulatedTranscriptRef = useRef("");
  const silenceTimerRef = useRef(null);
  const recreateRecognitionRef = useRef(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  // ============ CONSTANTS ============
  const MAX_RETRIES = 2;
  const LISTENING_TIMEOUT = 18000;
  const SILENCE_AFTER_FINAL_MS = 1800;
  const SPEECH_DELAY = 300;
  const POST_TTS_LISTEN_DELAY_MS = 800;
  const RECREATE_RECOGNITION_EVERY_N_FIELDS = 3;

  // ============ SPEECH RECOGNITION SETUP ============
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("🔴 Speech Recognition not supported. Please use Chrome or Edge.");
      return;
    }

    const createAndSetupRecognition = () => {
      const prev = recognitionRef.current;
      if (prev) {
        try {
          prev.abort();
        } catch (e) {
          console.error("Error aborting previous recognition:", e);
        }
      }

      const recognition = new SpeechRecognition();
      recognition.lang = isTe ? "te-IN" : "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        accumulatedTranscriptRef.current = "";
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
        setIsListening(true);
        setInterimText("");
        setStatus("🎤 Listening... Speak now!");

        if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        listeningTimeoutRef.current = setTimeout(() => {
          try {
            recognition.abort();
          } catch (e) {
            console.error("Error aborting recognition (timeout):", e);
          }
        }, LISTENING_TIMEOUT);
      };

      recognition.onresult = (event) => {
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            accumulatedTranscriptRef.current = (accumulatedTranscriptRef.current + " " + transcript).trim();

            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (silenceTimerRef.current) silenceTimerRef.current = null;
              const text = accumulatedTranscriptRef.current;
              if (!text) return;
              if (listeningTimeoutRef.current) {
                clearTimeout(listeningTimeoutRef.current);
                listeningTimeoutRef.current = null;
              }
              try {
                recognition.abort();
              } catch (e) {
                console.error("Error aborting recognition (silence):", e);
              }
              setIsListening(false);
              setTimeout(() => {
                handleVoiceAnswer(text);
              }, SPEECH_DELAY);
            }, SILENCE_AFTER_FINAL_MS);
          } else {
            interim += transcript;
          }
        }

        const displayText = (accumulatedTranscriptRef.current + " " + interim.trim()).trim();
        if (displayText) setInterimText(displayText);
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        if (!sessionRef.current.active) return;

        console.error("Speech recognition error:", event.error);

        if (event.error === "no-speech" || event.error === "audio-capture") {
          retryCountRef.current += 1;
          if (retryCountRef.current <= MAX_RETRIES) {
            const field = (fieldsRef.current || [])[sessionRef.current.fieldIndex];
            const fieldLabel = field?.label || "answer";
            const guidance = getFieldGuidance(field);
            setStatus(`⚠️ No speech detected. Retry ${retryCountRef.current}/${MAX_RETRIES}`);
            speakAndListen(
              getPrompt("noSpeech", { label: fieldLabel, guidance }, isTe)
            );
          } else {
            skipCurrentField();
          }
        } else if (event.error !== "aborted") {
          setStatus(`⚠️ Error: ${event.error}`);
          skipCurrentField();
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      };

      recognitionRef.current = recognition;
      return recognition;
    };

    createAndSetupRecognition();
    recreateRecognitionRef.current = createAndSetupRecognition;

    return () => {
      recreateRecognitionRef.current = null;
      if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.abort();
      } catch (e) {
        console.error("Error aborting recognition:", e);
      }
    };
  }, [language, isTe]);

  // ============ FIELD GUIDANCE GENERATION ============
  const getFieldGuidance = (field) => {
    if (!field) return "";

    if (field.type === "number") {
      return `(${field.min} to ${field.max})`;
    } else if (field.type === "select" && field.options) {
      const labels = field.options.map((opt) => opt.label).join(", ");
      return `(${labels})`;
    }

    return "";
  };

  // ============ NUMBER EXTRACTION ============
  const extractNumber = (text) => {
    if (!text) return null;

    const decimalMatch = text.match(/\d+\.?\d*/);
    if (decimalMatch) return decimalMatch[0];

    const wordMap = {
      zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
      six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
      eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
      sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
      twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
      seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
    };

    const tokens = text.toLowerCase().split(/\s+/);
    let result = 0;

    for (const token of tokens) {
      const clean = token.replace(/[^\w]/g, "");
      if (wordMap[clean] !== undefined) {
        result += wordMap[clean];
      }
    }

    return result > 0 ? String(result) : null;
  };

  // ============ OPTION MATCHING ============
  const matchOption = (text, options) => {
    if (!text || !options || options.length === 0) return null;

    const lower = text.toLowerCase().trim();

    for (const opt of options) {
      if (lower === opt.label.toLowerCase()) return opt.value;
    }

    for (const opt of options) {
      if (lower.includes(opt.label.toLowerCase())) return opt.value;
    }

    for (const opt of options) {
      const words = opt.label
        .toLowerCase()
        .split(/[\s\-,]+/)
        .filter((w) => w.length > 2);

      for (const word of words) {
        if (lower.includes(word)) return opt.value;
      }
    }

    return null;
  };

  // ============ VOICE ANSWER PROCESSING ============
  const handleVoiceAnswer = (voiceText) => {
    if (!sessionRef.current.active) return;

    const flds = fieldsRef.current || [];
    const idx = sessionRef.current.fieldIndex;
    if (idx >= flds.length) {
      finishSession();
      return;
    }

    const field = flds[idx];
    let value = null;

    if (!voiceText || voiceText.length < 2) {
      retryCountRef.current += 1;
    } else if (field.type === "number") {
      value = isTe ? (parseTeNumber(voiceText) || extractNumber(voiceText)) : extractNumber(voiceText);
    } else if (field.type === "select") {
      value = matchOption(voiceText, field.options);
    } else {
      value = voiceText;
    }

    if (value !== null && value !== "") {
      retryCountRef.current = 0;
      const newData = {
        ...sessionRef.current.data,
        [field.name]: value,
      };
      sessionRef.current.data = newData;
      setCollectedData(newData);

      const nextIndex = idx + 1;
      sessionRef.current.fieldIndex = nextIndex;
      setCurrentFieldIndex(nextIndex);
      setProgress(`${nextIndex}/${flds.length}`);

      if (nextIndex < flds.length) {
        if (nextIndex > 0 && nextIndex % RECREATE_RECOGNITION_EVERY_N_FIELDS === 0) {
          recreateRecognitionRef.current?.();
        }
        const nextField = flds[nextIndex];
        const nextGuidance = getFieldGuidance(nextField);
        speakAndListen(
          getPrompt("next", { label: field.label, value, nextLabel: nextField.label, guidance: nextGuidance, n: nextIndex + 1, total: flds.length }, isTe)
        );
        setCurrentFieldGuidance(nextGuidance);
      } else {
        speakAndListen(getPrompt("done", { label: field.label, value }, isTe));
        setTimeout(() => finishSession(), 1500);
      }
    } else {
      retryCountRef.current += 1;

      if (retryCountRef.current > MAX_RETRIES) {
        skipCurrentField();
      } else {
        const guidance = getFieldGuidance(field);
        setStatus(`⚠️ Didn't understand. Retry ${retryCountRef.current}/${MAX_RETRIES}`);
        speakAndListen(
          getPrompt("retry", { label: field.label, guidance }, isTe)
        );
      }
    }
  };

  // ============ SKIP FIELD ============
  const skipCurrentField = () => {
    if (!sessionRef.current.active) return;

    const flds = fieldsRef.current || [];
    const idx = sessionRef.current.fieldIndex;
    const nextIndex = idx + 1;
    sessionRef.current.fieldIndex = nextIndex;
    setCurrentFieldIndex(nextIndex);
    setProgress(`${nextIndex}/${flds.length}`);
    retryCountRef.current = 0;
    if (nextIndex < flds.length) {
      if (nextIndex > 0 && nextIndex % RECREATE_RECOGNITION_EVERY_N_FIELDS === 0) {
        recreateRecognitionRef.current?.();
      }
      const nextField = flds[nextIndex];
      const guidance = getFieldGuidance(nextField);
      speakAndListen(
        getPrompt("skip", { nextLabel: nextField.label, guidance, n: nextIndex + 1, total: flds.length }, isTe)
      );
      setCurrentFieldGuidance(guidance);
    } else {
      speakAndListen(getPrompt("skipDone", {}, isTe));
      setTimeout(() => finishSession(), 1500);
    }
  };

  // ============ TEXT-TO-SPEECH & LISTENING ============
  const speakAndListen = (text) => {
    if (!sessionRef.current.active) return;

    if (!("speechSynthesis" in window)) {
      setTimeout(() => startListening(), 300);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = isTe ? "te-IN" : "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    setIsSpeaking(true);
    setStatus("🔊 Speaking...");

    utterance.onend = () => {
      setIsSpeaking(false);
      setStatus("🎤 Listening...");
      setTimeout(() => startListening(), POST_TTS_LISTEN_DELAY_MS);
    };

    utterance.onerror = (event) => {
      console.error("Speech synthesis error:", event.error);
      setIsSpeaking(false);
      setTimeout(() => startListening(), POST_TTS_LISTEN_DELAY_MS);
    };

    window.speechSynthesis.speak(utterance);
  };

  // ============ LISTENING CONTROL ============
  const startListening = () => {
    if (!sessionRef.current.active || !recognitionRef.current) return;

    const rec = recognitionRef.current;
    rec.lang = isTe ? "te-IN" : "en-US";

    const doStart = () => {
      try {
        rec.start();
      } catch (e) {
        console.error("Error starting recognition:", e);
        if (isTe && rec.lang === "te-IN") {
          rec.lang = "en-US";
          setTimeout(() => { try { rec.start(); } catch (err) { console.error("Retry with en-US failed:", err); } }, 400);
        } else {
          setTimeout(() => { try { rec.start(); } catch (err) { console.error("Retry start failed:", err); } }, 600);
        }
      }
    };
    doStart();
  };

  // ============ SESSION MANAGEMENT ============
  const finishSession = () => {
    sessionRef.current.active = false;
    setSessionActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setStatus("✅ Complete! All fields filled.");

    window.speechSynthesis.cancel();

    if (onFieldsFilled) {
      onFieldsFilled(sessionRef.current.data);
    }
  };

  const startSession = async () => {
    const flds = fieldsRef.current || [];
    if (!flds.length) {
      setError("⚠️ No fields configured for voice input.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (err) {
      setError("🔴 Microphone permission denied. Please enable it in your browser settings.");
      return;
    }

    sessionRef.current.active = true;
    sessionRef.current.fieldIndex = 0;
    sessionRef.current.data = {};
    setSessionActive(true);
    setCurrentFieldIndex(0);
    setCollectedData({});
    setError("");
    retryCountRef.current = 0;
    setProgress(`1/${flds.length}`);

    const firstField = flds[0];
    const guidance = getFieldGuidance(firstField);
    speakAndListen(
      getPrompt("start", { label: firstField.label, guidance, total: flds.length }, isTe)
    );
    setCurrentFieldGuidance(guidance);
  };

  const stopSession = () => {
    window.speechSynthesis.cancel();
    try {
      recognitionRef.current?.abort();
    } catch (e) {
      console.error("Error aborting recognition:", e);
    }

    if (listeningTimeoutRef.current) clearTimeout(listeningTimeoutRef.current);
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = null;

    sessionRef.current.active = false;
    setSessionActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    setStatus("⏹️ Voice session stopped");
  };

  const resetSession = () => {
    stopSession();
    setCurrentFieldIndex(0);
    setCollectedData({});
    setInterimText("");
    setError("");
    setStatus("Ready");
    retryCountRef.current = 0;
    setProgress("0/0");
    setCurrentFieldGuidance("");
  };

  // ============ COMPUTED VALUES ============
  const completedCount = Object.keys(collectedData).length;
  const progressPercent = fields.length > 0
    ? Math.round((completedCount / fields.length) * 100)
    : 0;

  // ============ RENDER ============
  return (
    <div className="jarvis-container">
      <div className="jarvis-card">
        <div className="jarvis-header">
          <h3 className="jarvis-title">{getPrompt("title", {}, isTe)}</h3>
          <p className="jarvis-subtitle">{getPrompt("subtitle", {}, isTe)}</p>
        </div>

        {error && (
          <div className="jarvis-error">
            {error}
            <button
              onClick={() => setError("")}
              className="jarvis-error-close"
              aria-label="Close error message"
            >
              ×
            </button>
          </div>
        )}

        <div className="jarvis-status">
          <div className="jarvis-status-main">
            <span className="jarvis-status-text">{status}</span>
            {sessionActive && <span className="jarvis-live-indicator">●</span>}
          </div>

          <div className="jarvis-progress">
            <div className="jarvis-progress-bar">
              <div
                className="jarvis-progress-fill"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <span className="jarvis-progress-text">{progress}</span>
          </div>
        </div>

        {sessionActive && currentFieldGuidance && (
          <div className="jarvis-guidance">
            <span className="jarvis-guidance-label">📝 Accepted Values:</span>
            <span className="jarvis-guidance-text">{currentFieldGuidance}</span>
          </div>
        )}

        {interimText && (
          <div className="jarvis-interim">
            <span className="jarvis-interim-label">Hearing:</span>
            <span className="jarvis-interim-text">"{interimText}"</span>
          </div>
        )}

        {sessionActive && Object.keys(collectedData).length > 0 && (
          <div className="jarvis-collected">
            <p className="jarvis-collected-title">✓ Collected ({completedCount}):</p>
            <div className="jarvis-collected-items">
              {Object.entries(collectedData).map(([key, value]) => (
                <div key={key} className="jarvis-collected-item">
                  <span className="jarvis-collected-key">{key}:</span>
                  <span className="jarvis-collected-value">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="jarvis-controls">
          {!sessionActive ? (
            <button
              onClick={startSession}
              className="jarvis-btn jarvis-btn-start"
              disabled={isSpeaking || isListening}
            >
              {getPrompt("startBtn", {}, isTe)}
            </button>
          ) : (
            <>
              <button
                onClick={stopSession}
                className="jarvis-btn jarvis-btn-stop"
                disabled={isSpeaking}
              >
                {getPrompt("stopBtn", {}, isTe)}
              </button>
              <button
                onClick={resetSession}
                className="jarvis-btn jarvis-btn-reset"
                disabled={isSpeaking}
              >
                {getPrompt("resetBtn", {}, isTe)}
              </button>
            </>
          )}
        </div>

        {!sessionActive && (
          <div className="jarvis-instructions">
            <p><strong>💡 How to use:</strong></p>
            <ul>
              <li>Click "Start JARVIS" and allow microphone access</li>
              <li>JARVIS will ask questions one by one with acceptable values</li>
              <li>Speak your answer clearly after each question</li>
              <li>Form will auto-fill as you speak</li>
              <li>Click "Submit" when all fields are filled</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default JarvisVoiceAssistant;