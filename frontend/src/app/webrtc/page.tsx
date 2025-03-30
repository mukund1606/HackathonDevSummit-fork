'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useCallback } from 'react';
import useWebRTC from '@/hooks/useWebRTC';
import { ArrowLeft, Phone, MessageSquare, Mic, MicOff, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const generateOrRetrieveClientId = (): string => {
  if (typeof window !== 'undefined') {
    const storedId = localStorage.getItem('rtc_client_id');
    if (storedId) {
      return storedId;
    } else {
      const newId = uuidv4();
      localStorage.setItem('rtc_client_id', newId);
      return newId;
    }
  }
  return 'default-client-id';
};

export default function WebRTCPage() {
  const router = useRouter();
  const [clientId, setClientId] = useState<string>('');

  // Initialize clientId in a useEffect to ensure it only runs on the client
  useEffect(() => {
    setClientId(generateOrRetrieveClientId());
  }, []);

  const {
    localStream,
    remoteStream,
    messages,
    targetId,
    startCall,
    sendMessage,
    isCalling,
    connectionState,
    dataChannelState,
    localFrequencyData,
    remoteFrequencyData,
    reconnect
  } = useWebRTC();

  const [messageInput, setMessageInput] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const localCanvasRef = useRef<HTMLCanvasElement>(null);
  const remoteCanvasRef = useRef<HTMLCanvasElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Canvas visualization setup
  const drawFrequency = useCallback((
    canvas: HTMLCanvasElement | null,
    frequencyData: Uint8Array | null,
    color: string
  ) => {
    if (!canvas || !frequencyData) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    
    const bufferLength = frequencyData.length;
    const barWidth = (width / bufferLength) * 2.5;
    let x = 0;
    
    frequencyData.forEach((value) => {
      const barHeight = (value / 255) * height;
      ctx.fillStyle = color;
      ctx.fillRect(x, height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    });
  }, []);

  // Animation frame for visualizations
  useEffect(() => {
    const animate = () => {
      drawFrequency(localCanvasRef.current, localFrequencyData, '#3b82f6');
      drawFrequency(remoteCanvasRef.current, remoteFrequencyData, '#10b981');
      requestAnimationFrame(animate);
    };
    animate();
  }, [drawFrequency, localFrequencyData, remoteFrequencyData]);

  // Audio element setup
  useEffect(() => {
    if (localAudioRef.current) localAudioRef.current.srcObject = localStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [localStream, remoteStream]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Microphone control
  const toggleMicrophone = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setAudioEnabled(!audioEnabled);
    }
  };

  // Message sending with validation
  const handleSendMessage = () => {
    if (!messageInput.trim() || dataChannelState !== 'open') return;
    sendMessage(messageInput);
    setMessageInput('');
  };

  // Enter key handling
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            AI To AI Communication
          </h1>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} />
            Back
          </button>
        </div>

        {/* Connection Status Bar */}
        <div className="p-4 bg-white dark:bg-black rounded-lg shadow">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Your ID:</span>
                <code className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded">
                  {clientId}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(clientId)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${
                  connectionState === 'connected'
                    ? 'bg-green-500'
                    : connectionState === 'connecting'
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`} />
                <span className="text-sm capitalize">
                  {connectionState}
                  {dataChannelState && ` (${dataChannelState} data)`}
                </span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={toggleMicrophone}
                className={`p-2 rounded-full ${
                  audioEnabled 
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
                }`}
              >
                {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button
                onClick={reconnect}
                className="p-2 rounded-full bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Call Controls */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              startCall(targetInput);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="Enter peer ID"
              className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <button
              type="submit"
              disabled={isCalling}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                isCalling
                  ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500'
              }`}
            >
              <Phone size={18} />
              {isCalling ? 'Connecting...' : 'Start Call'}
            </button>
          </form>
        </div>

        {/* Audio Visualizations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium mb-2">Local Audio</h3>
            <canvas 
              ref={localCanvasRef} 
              className="w-full h-24 bg-gray-100 dark:bg-gray-700 rounded"
              width={400}
              height={96}
            />
            <audio ref={localAudioRef} autoPlay playsInline muted />
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium mb-2">Remote Audio</h3>
            <canvas 
              ref={remoteCanvasRef} 
              className="w-full h-24 bg-gray-100 dark:bg-gray-700 rounded"
              width={400}
              height={96}
            />
            <audio ref={remoteAudioRef} autoPlay playsInline />
          </div>
        </div>

        {/* Chat Interface */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b dark:border-gray-700">
            <h2 className="flex items-center gap-2 font-semibold">
              <MessageSquare size={18} />
              Chat ({messages.length})
            </h2>
          </div>
          
          {/* Messages Container */}
          <div className="h-64 overflow-y-auto p-4 space-y-3">
            {messages.map((message, index) => (
              <div 
                key={index}
                className={`flex ${message.isLocal ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[75%] px-3 py-2 rounded-lg ${
                  message.isLocal
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}>
                  <p className="text-sm">{message.text}</p>
                  {message.type === 'transcript' && (
                    <div className="mt-1 text-xs opacity-70 flex items-center gap-1">
                      <Mic size={12} />
                      <span>Transcribed</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="border-t dark:border-gray-700 p-4">
            <div className="flex gap-2">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  dataChannelState === 'open' 
                    ? "Type a message..." 
                    : "Connect to start messaging"
                }
                disabled={dataChannelState !== 'open'}
                rows={1}
                className="flex-1 px-4 py-2 border rounded-lg resize-none dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                onClick={handleSendMessage}
                disabled={dataChannelState !== 'open' || !messageInput.trim()}
                className={`px-4 py-2 rounded-lg ${
                  dataChannelState === 'open' && messageInput.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500'
                    : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
