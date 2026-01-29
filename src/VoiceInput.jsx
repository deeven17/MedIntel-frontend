import React, { useState, useRef } from 'react';

const API = "http://localhost:8000";

const VoiceInput = ({ onVoiceData, language = 'en', disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      setError('');
      setStatus('Requesting microphone access...');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone not supported in this browser');
      }

      if (
        location.protocol !== 'https:' &&
        location.hostname !== 'localhost' &&
        location.hostname !== '127.0.0.1'
      ) {
        throw new Error('HTTPS or localhost required for microphone access');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const options = {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000,
      };

      const fallbackOptions = [
        'audio/wav',
        'audio/webm;codecs=opus',
        'audio/webm;codecs=vp8',
        'audio/webm;codecs=vp9',
        'audio/mp4',
        'audio/ogg',
      ];

      let supportedFormat = null;
      for (const format of fallbackOptions) {
        if (MediaRecorder.isTypeSupported(format)) {
          options.mimeType = format;
          supportedFormat = format;
          break;
        }
      }

      if (!supportedFormat) {
        throw new Error('No supported audio format found');
      }

      console.log(`Using audio format: ${supportedFormat}`);

      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        processAudio();
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.onerror = (event) => {
        console.error('MediaRecorder error:', event.error);
        setError(`Recording error: ${event.error.message}`);
        setIsRecording(false);
      };

      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setRecordingStartTime(Date.now());
      setStatus('🎤 Recording... Speak now! (Minimum 2 seconds)');
    } catch (error) {
      console.error('Error starting recording:', error);
      handleMicrophoneError(error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      const recordingDuration = recordingStartTime
        ? (Date.now() - recordingStartTime) / 1000
        : 0;
      if (recordingDuration < 2) {
        setError(
          'Please record for at least 2 seconds for better speech recognition.'
        );
        setIsRecording(false);
        setRecordingStartTime(null);
        return;
      }

      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordingStartTime(null);
      setStatus('Processing audio...');
    }
  };

  const processAudio = async () => {
    try {
      setIsProcessing(true);
      setStatus('Sending audio to server...');

      let audioBlob;
      const audioMimeType = mediaRecorderRef.current.mimeType || 'audio/webm';

      if (audioChunksRef.current.length > 0) {
        const firstChunk = audioChunksRef.current[0];
        if (firstChunk.type) {
          audioBlob = new Blob(audioChunksRef.current, { type: firstChunk.type });
        } else {
          audioBlob = new Blob(audioChunksRef.current, { type: audioMimeType });
        }
      } else {
        throw new Error('No audio data recorded');
      }

      console.log(
        `Audio blob created: ${audioBlob.size} bytes, type: ${audioBlob.type}`
      );

      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('language_hint', language);

      let response;

      try {
        response = await fetch(`${API}/voice-assistant/process-public`, {
          method: 'POST',
          body: formData,
        });
        console.log('✅ Using public voice endpoint');
      } catch (publicErr) {
        console.log(
          '⚠️ Public endpoint failed, trying authenticated endpoint:',
          publicErr.message
        );
        const token = localStorage.getItem('token');
        if (!token) {
          throw new Error('Authentication token required for voice processing');
        }

        response = await fetch(`${API}/voice-assistant/process`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });
      }

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('audio')) {
        const transcriptionText = response.headers.get('X-Transcription');
        const detectedLanguage = response.headers.get('X-Detected-Language');
        const detectedIntent = response.headers.get('X-Intent');
        const responseText = response.headers.get('X-Response-Text');

        const entities = extractEntitiesFromTranscription(transcriptionText);

        setStatus('✅ Voice input processed successfully!');

        if (onVoiceData) {
          onVoiceData({
            transcription: transcriptionText,
            language: detectedLanguage,
            intent: detectedIntent,
            entities: entities,
            response: responseText,
          });
        }
      } else {
        const data = await response.json();

        if (data.success) {
          setStatus('✅ Voice input processed successfully!');

          if (onVoiceData) {
            onVoiceData({
              transcription: data.transcription?.text || data.transcription,
              language: data.transcription?.language || data.language,
              intent: data.intent,
              entities:
                data.entities ||
                extractEntitiesFromTranscription(
                  data.transcription?.text || data.transcription
                ),
              response: data.response_text,
            });
          }
        } else {
          throw new Error(data.error || 'Processing failed');
        }
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      setError(`Error: ${error.message}`);
      setStatus('');
    } finally {
      setIsProcessing(false);
    }
  };

  const extractEntitiesFromTranscription = (text) => {
    if (!text) return {};

    const entities = {};
    const textLower = text.toLowerCase();

    const ageMatch = textLower.match(
      /(\d{1,3})\s*(?:years?|year old|years old|साल|సంవత్సరాలు)/
    );
    if (ageMatch) {
      entities.age = parseInt(ageMatch[1]);
    }

    const namePatterns = [
      /(?:my name is|i am|this is|name is)\s+([a-z\u0900-\u097F\u0C00-\u0C7F]{2,30}(?:\s[a-z\u0900-\u097F\u0C00-\u0C7F]{2,30})?)/i,
      /(?:मेरा नाम|नाम है|मैं)\s+([a-z\u0900-\u097F\u0C00-\u0C7F]{2,30}(?:\s[a-z\u0900-\u097F\u0C00-\u0C7F]{2,30})?)/i,
      /(?:నా పేరు|పేరు|నేను)\s+([a-z\u0900-\u097F\u0C00-\u0C7F]{2,30}(?:\s[a-z\u0900-\u097F\u0C00-\u0C7F]{2,30})?)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match) {
        entities.name = match[1].trim();
        break;
      }
    }

    const malePatterns = ['male', 'man', 'boy', 'he', 'his', 'मर्द', 'आदमी'];
    const femalePatterns = [
      'female',
      'woman',
      'girl',
      'she',
      'her',
      'महिला',
      'औरत',
    ];

    if (malePatterns.some((p) => textLower.includes(p))) {
      entities.gender = 'male';
      entities.sex = 1;
    } else if (femalePatterns.some((p) => textLower.includes(p))) {
      entities.gender = 'female';
      entities.sex = 0;
    }

    const symptoms = [];
    const symptomKeywords = {
      en: [
        'chest',
        'pain',
        'heart',
        'breath',
        'memory',
        'forget',
        'headache',
        'dizziness',
        'fatigue',
        'pressure',
        'shortness',
      ],
      hi: [
        'सीने',
        'दर्द',
        'दिल',
        'सांस',
        'याददाश्त',
        'भूल',
        'सिरदर्द',
        'चक्कर',
      ],
      te: [
        'ఛాతీ',
        'నొప్పి',
        'గుండె',
        'శ్వాస',
        'గుర్తుంచుకోవడం',
        'మరచిపోవడం',
        'తలనొప్పి',
      ],
    };

    const keywords = symptomKeywords[language] || symptomKeywords.en;
    keywords.forEach((keyword) => {
      if (textLower.includes(keyword)) {
        symptoms.push(keyword);
      }
    });

    if (symptoms.length > 0) {
      entities.symptoms = symptoms;
    }

    const bpMatch = textLower.match(
      /(\d{2,3})\s*(?:\/|by|by)\s*(\d{2,3})/
    );
    if (bpMatch) {
      entities.trestbps = parseInt(bpMatch[1]);
      entities.bp_diastolic = parseInt(bpMatch[2]);
    }

    const cholMatch = textLower.match(/cholesterol\s*:?\s*(\d{2,3})/);
    if (cholMatch) {
      entities.chol = parseInt(cholMatch[1]);
    }

    const hrMatch = textLower.match(
      /(?:heart rate|heart beat|pulse)\s*:?\s*(\d{2,3})/
    );
    if (hrMatch) {
      entities.thalach = parseInt(hrMatch[1]);
    }

    return entities;
  };

  const handleMicrophoneError = (error) => {
    let errorMessage = '';
    let troubleshooting = '';

    switch (error.name) {
      case 'NotAllowedError':
        errorMessage =
          'Microphone access denied. Please allow microphone access and try again.';
        troubleshooting =
          'Click the microphone icon in your browser address bar and select "Allow"';
        break;
      case 'NotFoundError':
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
        troubleshooting =
          'Connect a microphone to your device or check system microphone settings';
        break;
      case 'NotReadableError':
        errorMessage = 'Microphone is being used by another application.';
        troubleshooting =
          'Close other applications using the microphone (Skype, Zoom, Teams)';
        break;
      case 'SecurityError':
        errorMessage = 'HTTPS or localhost required for microphone access.';
        troubleshooting = 'Use HTTPS or localhost for microphone access';
        break;
      default:
        errorMessage = `Microphone error: ${error.message}`;
        troubleshooting = 'Try refreshing the page or using a different browser';
    }

    setError(`${errorMessage}\n\n💡 ${troubleshooting}`);
    setStatus('');
    setIsRecording(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.controls}>
        <button
          onClick={startRecording}
          disabled={isRecording || isProcessing || disabled}
          style={{
            ...styles.button,
            ...styles.startButton,
            opacity: isRecording || isProcessing || disabled ? 0.6 : 1,
          }}
        >
          🎤 Start Recording
        </button>
        <button
          onClick={stopRecording}
          disabled={!isRecording || disabled}
          style={{
            ...styles.button,
            ...styles.stopButton,
            opacity: !isRecording || disabled ? 0.6 : 1,
          }}
        >
          ⏹️ Stop Recording
        </button>
      </div>

      {isRecording && (
        <div style={styles.recordingIndicator}>
          <div style={styles.recordingDot}></div>
          Recording in progress...
        </div>
      )}

      {isProcessing && (
        <div style={styles.processingIndicator}>Processing audio...</div>
      )}

      {status && <div style={styles.statusMessage}>{status}</div>}

      {error && <div style={styles.errorMessage}>{error}</div>}
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  controls: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
  },
  button: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  startButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
  },
  stopButton: {
    backgroundColor: '#f44336',
    color: 'white',
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    backgroundColor: '#ffe0e0',
    borderLeft: '4px solid #f44336',
    borderRadius: '4px',
    marginBottom: '10px',
  },
  recordingDot: {
    width: '12px',
    height: '12px',
    backgroundColor: '#f44336',
    borderRadius: '50%',
    animation: 'pulse 1s infinite',
  },
  processingIndicator: {
    padding: '10px',
    backgroundColor: '#e3f2fd',
    borderLeft: '4px solid #2196F3',
    borderRadius: '4px',
    marginBottom: '10px',
  },
  statusMessage: {
    padding: '10px',
    backgroundColor: '#e8f5e9',
    borderLeft: '4px solid #4CAF50',
    borderRadius: '4px',
    marginBottom: '10px',
  },
  errorMessage: {
    padding: '10px',
    backgroundColor: '#ffebee',
    borderLeft: '4px solid #f44336',
    borderRadius: '4px',
    color: '#c62828',
  },
};

export default VoiceInput;