'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const { connectionState, messages, sendMessage } = useWebSocket();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPassiveMode, setIsPassiveMode] = useState(false);
  const [showAutoSleepMessage, setShowAutoSleepMessage] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const { playSound } = useSoundEffects();

  const { recordingState, startRecording, stopRecording, error: audioError, currentVolume } = useAudioRecorder(
    (audioBlob) => {
      // Send audio data to backend via WebSocket
      console.log('Sending audio chunk:', audioBlob.size, 'bytes');
      sendMessage(audioBlob);
    }
  );

  // Filter out repetitive "Processed audio" messages to reduce spam
  const filteredMessages = messages.filter((msg, idx, arr) => {
    // Keep system messages, errors, transcriptions, and status messages
    if (msg.type === 'system' || msg.type === 'error' || msg.type === 'transcription' || msg.type === 'ai_response') return true;

    // For status messages, only keep the latest one
    if (msg.type === 'status') {
      // Check if there's a newer status message
      for (let i = idx + 1; i < arr.length; i++) {
        if (arr[i].type === 'status') return false;
      }
      return true;
    }

    return false;
  });

  // Track processing state based on messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      if (lastMessage.type === 'status') {
        setIsProcessing(true);
      } else if (lastMessage.type === 'ai_response') {
        setIsProcessing(false);
        playSound('success');

        // Text-to-Speech for AI response
        if (!isMuted && lastMessage.text) {
          const utterance = new SpeechSynthesisUtterance(lastMessage.text);
          window.speechSynthesis.speak(utterance);
        }
      } else if (lastMessage.type === 'error') {
        setIsProcessing(false);
        playSound('error');
      }
    }
  }, [messages, isMuted, playSound]);

  // Passive Listening (Wake Word) Logic
  useEffect(() => {
    let recognition: any = null;

    if (isPassiveMode && !isRecording && !isProcessing) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const lastResult = event.results[event.results.length - 1];
          const transcript = lastResult[0].transcript.trim().toLowerCase();

          if (transcript.includes('jarvis')) {
            console.log('Wake word detected!');
            playSound('start');
            recognition.stop();
            startRecording();
            setIsRecording(true);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Wake word recognition error:', event.error);
        };

        recognition.start();
      }
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [isPassiveMode, isRecording, isProcessing, startRecording, playSound]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [filteredMessages]);



  // Passive Listening (Wake Word) Logic
  useEffect(() => {
    let recognition: any = null;

    if (isPassiveMode && !isRecording && !isProcessing) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          const lastResult = event.results[event.results.length - 1];
          const transcript = lastResult[0].transcript.trim().toLowerCase();

          if (transcript.includes('jarvis')) {
            console.log('Wake word detected!');
            playSound('start');
            recognition.stop();
            startRecording();
            setIsRecording(true);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Wake word recognition error:', event.error);
        };

        recognition.start();
      }
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [isPassiveMode, isRecording, isProcessing, startRecording, playSound]);

  // Battery Optimization: Auto-sleep Passive Mode after 5 minutes of inactivity
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      if (showAutoSleepMessage) setShowAutoSleepMessage(false);
    };

    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);

    const checkInactivity = setInterval(() => {
      if (isPassiveMode && Date.now() - lastActivityRef.current > 5 * 60 * 1000) {
        setIsPassiveMode(false);
        setShowAutoSleepMessage(true);
        playSound('stop'); // Play sound to indicate sleep
      }
    }, 60000); // Check every minute

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      clearInterval(checkInactivity);
    };
  }, [isPassiveMode, showAutoSleepMessage, playSound]);

  const handleMicClick = async () => {
    if (recordingState === 'recording') {
      playSound('stop');
      stopRecording();
      setIsRecording(false);

      // Send stop recording signal to trigger transcription
      console.log('Sending stop_recording signal');
      sendMessage(JSON.stringify({ type: 'stop_recording' }));
    } else {
      playSound('start');
      await startRecording();
      setIsRecording(true);
      console.log('Started recording');
    }
  };

  const handleInterrupt = () => {
    // Send interrupt signal to backend
    sendMessage(JSON.stringify({ type: 'interrupt' }));
    setIsProcessing(false);
  };

  // Spacebar to toggle recording
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger if spacebar is pressed and not typing in an input field
      if (event.code === 'Space' &&
        event.target instanceof HTMLElement &&
        event.target.tagName !== 'INPUT' &&
        event.target.tagName !== 'TEXTAREA') {
        event.preventDefault();
        handleMicClick();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [recordingState, connectionState, isProcessing]); // Dependencies for handleMicClick

  const getConnectionStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Error';
      default:
        return 'Disconnected';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col p-4">
      {/* Header - Fixed at top */}
      <div className="w-full max-w-4xl mx-auto mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              JARVIS
            </h1>
            <p className="text-gray-400 text-sm">Real-time Voice Assistant Powered by the AI-vengers™</p>
          </div>

          {/* Connection Status & Controls */}
          <div className="flex items-center gap-4">
            {/* Passive Mode Toggle */}
            <button
              onClick={() => setIsPassiveMode(!isPassiveMode)}
              className={`p-2 rounded-full transition-colors ${isPassiveMode ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
              title={isPassiveMode ? "Passive Mode On (Listening for 'Jarvis')" : "Enable Passive Mode"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>

            {/* Mute Toggle */}
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                if (!isMuted) {
                  window.speechSynthesis.cancel();
                }
              }}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              title={isMuted ? "Unmute TTS" : "Mute TTS"}
            >
              {isMuted ? (
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 border border-white/20">
              <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()} animate-pulse`} />
              <span className="text-white text-sm font-medium">{getConnectionStatusText()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Flexible height */}
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col min-h-0">
        {/* Auto-sleep Notification */}
        {showAutoSleepMessage && (
          <div className="mb-4 bg-yellow-500/20 border border-yellow-500/30 rounded-xl p-3 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔋</span>
              <p className="text-yellow-200 text-sm">
                Passive listening paused to save battery due to inactivity.
              </p>
            </div>
            <button
              onClick={() => setShowAutoSleepMessage(false)}
              className="text-yellow-200 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* Conversation Panel - Takes remaining space */}
        <div className="flex-1 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-6 overflow-hidden flex flex-col min-h-0">
          <h2 className="text-xl font-semibold text-white mb-4 flex-shrink-0">Conversation</h2>

          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-transparent min-h-0">
            {filteredMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-400 text-center">
                  Click the microphone to start speaking...
                </p>
              </div>
            ) : (
              <>
                {filteredMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl ${msg.type === 'system'
                      ? 'bg-blue-500/20 border border-blue-500/30'
                      : msg.type === 'error'
                        ? 'bg-red-500/20 border border-red-500/30'
                        : msg.type === 'transcription'
                          ? 'bg-green-500/20 border border-green-500/30'
                          : msg.type === 'status'
                            ? 'bg-yellow-500/20 border border-yellow-500/30'
                            : 'bg-purple-500/20 border border-purple-500/30'
                      }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white/70 uppercase tracking-wide flex items-center gap-2">
                          {msg.type === 'transcription' && '🎤'}
                          {msg.type === 'ai_response' && '🤖'}
                          {msg.type === 'status' && '⏳'}
                          {msg.type === 'system' && 'ℹ️'}
                          {msg.type === 'error' && '❌'}
                          {msg.type}
                        </span>
                        {msg.has_sources && (
                          <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-0.5 rounded-full border border-blue-500/30 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                            Sources Included
                          </span>
                        )}
                      </div>
                      {msg.timestamp && (
                        <span className="text-xs text-white/50">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <p className="text-white">{msg.message || msg.text}</p>
                  </div>
                ))}
                <div ref={conversationEndRef} />
              </>
            )}
          </div>
        </div>

        {/* Error Display */}
        {audioError && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-2xl p-4 mt-4 flex-shrink-0">
            <p className="text-red-300 text-sm">
              <strong>Error:</strong> {audioError}
            </p>
          </div>
        )}
      </div>

      {/* Microphone Control - Fixed at bottom */}
      <div className="w-full max-w-4xl mx-auto flex-shrink-0 pt-6 pb-4">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
            {/* Microphone Button */}
            <button
              onClick={handleMicClick}
              disabled={connectionState !== 'connected' || isProcessing}
              className={`relative w-24 h-24 rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isRecording
                ? 'bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-500/50 animate-pulse-slow'
                : 'bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg shadow-purple-500/50'
                }`}
            >
              {/* Pulsing Ring Animation */}
              {isRecording && (
                <>
                  <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse" />
                </>
              )}

              {/* Microphone Icon */}
              <div className="relative z-10 flex items-center justify-center h-full">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {isRecording ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  ) : (
                    <>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </>
                  )}
                </svg>
              </div>
            </button>

            {/* Volume Indicator (Debug) */}
            {isRecording && (
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-75"
                  style={{ width: `${Math.min(currentVolume * 500, 100)}%` }}
                />
                {/* Threshold Marker (0.05 * 500 = 25%) */}
                <div className="absolute top-0 bottom-0 left-[25%] w-0.5 bg-red-500/50" />
              </div>
            )}

            {/* Stop/Interrupt Button */}
            {isProcessing && (
              <button
                onClick={handleInterrupt}
                className="relative w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-500/50 transition-all duration-300 transform hover:scale-105 active:scale-95"
                title="Stop AI processing"
              >
                <div className="relative z-10 flex items-center justify-center h-full">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </button>
            )}
          </div>

          {/* Status Text */}
          <p className="text-white/70 text-sm">
            {isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                AI is processing... Click ✕ to stop
              </span>
            ) : isRecording ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Recording... Click to stop
              </span>
            ) : isPassiveMode ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Listening for "Jarvis"...
              </span>
            ) : connectionState === 'connected' ? (
              'Click the microphone to start'
            ) : (
              'Waiting for connection...'
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
