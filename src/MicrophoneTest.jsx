import React, { useState, useRef } from 'react';

const MicrophoneTest = () => {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [devices, setDevices] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const testMicrophone = async () => {
    try {
      setIsTesting(true);
      setError('');
      setStatus('Testing microphone access...');

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia API not supported in this browser');
      }

      // Check HTTPS requirement
      if (location.protocol !== 'https:' && 
          location.hostname !== 'localhost' && 
          location.hostname !== '127.0.0.1') {
        throw new Error('HTTPS or localhost required for microphone access');
      }

      // Get available devices first
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = deviceList.filter(device => device.kind === 'audioinput');
        setDevices(audioInputs);
        
        if (audioInputs.length === 0) {
          throw new Error('No audio input devices found');
        }
        
        setStatus(`Found ${audioInputs.length} microphone(s): ${audioInputs.map(d => d.label || 'Unknown Device').join(', ')}`);
      } catch (deviceError) {
        console.log('Could not enumerate devices:', deviceError);
      }

      // Test microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get audio track info
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks found');
      }

      const track = audioTracks[0];
      const settings = track.getSettings();
      
      // Test recording for 2 seconds
      setStatus('Testing recording...');
      
      if (window.MediaRecorder) {
        const options = {
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 128000
        };
        
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'audio/wav';
        }
        
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          const audioUrl = URL.createObjectURL(audioBlob);
          
          setStatus(`✅ Microphone test successful! Recorded ${audioBlob.size} bytes of audio.`);
          
          // Play the recorded audio
          const audio = new Audio(audioUrl);
          audio.play().catch(e => console.log('Could not play audio:', e));
          
          // Clean up
          URL.revokeObjectURL(audioUrl);
        };
        
        mediaRecorderRef.current.start();
        
        // Stop recording after 2 seconds
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }, 2000);
      } else {
        setStatus('✅ Microphone access successful! (MediaRecorder not supported for testing)');
      }
      
      // Stop the stream
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        setIsTesting(false);
      }, 3000);
      
    } catch (error) {
      console.error('Microphone test failed:', error);
      handleMicrophoneError(error);
      setIsTesting(false);
    }
  };

  const handleMicrophoneError = (error) => {
    let errorMessage = '';
    let troubleshooting = '';
    
    switch (error.name) {
      case 'NotAllowedError':
        errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
        troubleshooting = `
          <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
            <h4>🔧 Troubleshooting Steps:</h4>
            <ol>
              <li><strong>Check browser permissions:</strong> Look for a microphone icon in your browser's address bar</li>
              <li><strong>Click "Allow"</strong> when prompted for microphone access</li>
              <li><strong>Refresh the page</strong> and try again</li>
              <li><strong>Check system settings:</strong> Ensure your microphone is not blocked by system privacy settings</li>
            </ol>
          </div>
        `;
        break;
        
      case 'NotFoundError':
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
        troubleshooting = `
          <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
            <h4>🔧 Troubleshooting Steps:</h4>
            <ol>
              <li><strong>Connect a microphone</strong> to your device</li>
              <li><strong>Check device manager</strong> to ensure microphone is recognized</li>
              <li><strong>Test microphone</strong> in other applications (Skype, Zoom, etc.)</li>
              <li><strong>Try a different browser</strong> (Chrome recommended)</li>
              <li><strong>Check Windows privacy settings</strong> for microphone access</li>
            </ol>
          </div>
        `;
        break;
        
      case 'NotReadableError':
        errorMessage = 'Microphone is being used by another application. Please close other applications and try again.';
        troubleshooting = `
          <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
            <h4>🔧 Troubleshooting Steps:</h4>
            <ol>
              <li><strong>Close other applications</strong> that might be using the microphone</li>
              <li><strong>Check Skype, Zoom, Teams</strong> or other video calling apps</li>
              <li><strong>Restart your browser</strong> and try again</li>
              <li><strong>Check Windows privacy settings</strong> for microphone access</li>
            </ol>
          </div>
        `;
        break;
        
      case 'SecurityError':
        errorMessage = 'Security error accessing microphone. Please use HTTPS or localhost.';
        troubleshooting = `
          <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
            <h4>🔧 Troubleshooting Steps:</h4>
            <ol>
              <li><strong>Use HTTPS</strong> instead of HTTP</li>
              <li><strong>Try localhost</strong> for local development</li>
              <li><strong>Check browser security settings</strong></li>
            </ol>
          </div>
        `;
        break;
        
      default:
        errorMessage = `Microphone error: ${error.message}`;
        troubleshooting = `
          <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px;">
            <h4>🔧 General Troubleshooting:</h4>
            <ol>
              <li><strong>Refresh the page</strong> and try again</li>
              <li><strong>Use Chrome browser</strong> for best compatibility</li>
              <li><strong>Check microphone permissions</strong> in browser settings</li>
              <li><strong>Try incognito/private mode</strong></li>
              <li><strong>Disable browser extensions</strong> temporarily</li>
            </ol>
          </div>
        `;
    }
    
    setError(errorMessage);
    setStatus('');
    
    // Add troubleshooting info
    const errorDiv = document.getElementById('microphone-error');
    if (errorDiv) {
      errorDiv.innerHTML = `
        <div style="margin-bottom: 10px;">${errorMessage}</div>
        ${troubleshooting}
      `;
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>🎤 Microphone Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={testMicrophone}
          disabled={isTesting}
          style={{
            background: isTesting ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '5px',
            cursor: isTesting ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          {isTesting ? 'Testing...' : '🔍 Test Microphone'}
        </button>
      </div>
      
      {status && (
        <div style={{
          padding: '15px',
          background: '#d4edda',
          color: '#155724',
          border: '1px solid #c3e6cb',
          borderRadius: '5px',
          marginBottom: '15px'
        }}>
          {status}
        </div>
      )}
      
      {error && (
        <div id="microphone-error" style={{
          padding: '15px',
          background: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '5px',
          marginBottom: '15px'
        }}>
          {error}
        </div>
      )}
      
      {devices.length > 0 && (
        <div style={{
          padding: '15px',
          background: '#d1ecf1',
          color: '#0c5460',
          border: '1px solid #bee5eb',
          borderRadius: '5px',
          marginBottom: '15px'
        }}>
          <h4>📱 Detected Microphones:</h4>
          <ul>
            {devices.map((device, index) => (
              <li key={index}>
                <strong>{device.label || `Microphone ${index + 1}`}</strong>
                {device.deviceId && <span> (ID: {device.deviceId.substring(0, 8)}...)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div style={{
        padding: '15px',
        background: '#f8f9fa',
        border: '1px solid #e9ecef',
        borderRadius: '5px',
        fontSize: '14px'
      }}>
        <h4>ℹ️ System Information:</h4>
        <p><strong>Browser:</strong> {navigator.userAgent.split(' ')[0]}</p>
        <p><strong>Protocol:</strong> {location.protocol}</p>
        <p><strong>Hostname:</strong> {location.hostname}</p>
        <p><strong>getUserMedia Support:</strong> {navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? '✅ Yes' : '❌ No'}</p>
        <p><strong>MediaRecorder Support:</strong> {window.MediaRecorder ? '✅ Yes' : '❌ No'}</p>
      </div>
    </div>
  );
};

export default MicrophoneTest;
