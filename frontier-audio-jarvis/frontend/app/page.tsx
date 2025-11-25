'use client';

import { useState, useEffect, useRef } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { Mic, Square, Activity } from 'lucide-react';

export default function Home() {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      setConnectionStatus('connected');
      console.log('Connected to backend');
    };

    ws.onclose = () => {
      setConnectionStatus('disconnected');
      console.log('Disconnected from backend');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages((prev) => [...prev, `Received: ${data.type}`]);
      console.log('Message from server:', data);
    };

    setSocket(ws);

    return () => {
      ws.close();
    };
  }, []);

  const handleStartRecording = async () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    
    await startRecording((blob) => {
      // Send blob as array buffer
      blob.arrayBuffer().then((buffer) => {
         socket.send(buffer);
      });
    });
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-2 text-blue-400">Jarvis</h1>
        <p className="text-gray-400">Frontier Audio Assistant</p>
      </header>

      <main className="flex flex-col items-center gap-8 w-full max-w-md">
        
        <div className="relative group">
          <div className={`absolute inset-0 bg-blue-500 rounded-full blur-xl opacity-20 transition-opacity duration-300 ${isRecording ? 'opacity-50 animate-pulse' : ''}`}></div>
          <button
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            className={`relative z-10 p-8 rounded-full transition-all duration-300 ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_30px_rgba(239,68,68,0.5)]' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-[0_0_30px_rgba(37,99,235,0.5)]'
            }`}
          >
            {isRecording ? (
              <Square className="w-12 h-12 text-white" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm font-medium">
           <div className={`w-2 h-2 rounded-full ${
             connectionStatus === 'connected' ? 'bg-green-500' : 
             connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
           }`} />
           <span className="uppercase tracking-wider text-gray-400">{connectionStatus}</span>
        </div>

        <div className="w-full bg-gray-800 rounded-lg p-4 h-48 overflow-y-auto border border-gray-700">
          <div className="flex items-center gap-2 mb-2 text-gray-500 text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>System Logs</span>
          </div>
          <div className="space-y-1 font-mono text-sm">
            {messages.map((msg, i) => (
              <div key={i} className="text-green-400 border-l-2 border-green-900 pl-2">
                {msg}
              </div>
            ))}
            {messages.length === 0 && (
              <div className="text-gray-600 italic">Waiting for activity...</div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}

