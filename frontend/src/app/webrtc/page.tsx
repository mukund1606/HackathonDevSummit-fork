'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import useWebRTC from '@/hooks/useWebRTC';
import { ArrowLeft, Phone, MessageSquare } from 'lucide-react';

export default function WebRTCPage() {
  const router = useRouter();
  const {
    localStream,
    remoteStream,
    messages,
    clientId,
    startCall,
    sendMessage,
    isCalling
  } = useWebRTC();
  
  const [messageInput, setMessageInput] = useState('');
  const [targetInput, setTargetInput] = useState('');
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (localAudioRef.current) localAudioRef.current.srcObject = localStream;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [localStream, remoteStream]);

  return (
    <div className="min-h-screen p-8 bg-gray-50 dark:bg-black">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            AI-to-AI Protocol Session
          </h1>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Return Home
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Your Node ID: <span className="font-mono text-blue-500">{clientId}</span>
            </p>
          </div>

          <div className="flex gap-4 mb-6">
            <input
              type="text"
              placeholder="Enter Partner Node ID"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
            <button
              onClick={() => startCall(targetInput)}
              disabled={!targetInput || isCalling}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Phone className="w-4 h-4" />
              {isCalling ? 'Establishing Connection...' : 'Initiate Protocol'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-medium mb-2 text-blue-500">Local Node</h3>
              <audio ref={localAudioRef} autoPlay muted className="w-full" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg">
              <h3 className="text-sm font-medium mb-2 text-blue-500">Remote Node</h3>
              <audio ref={remoteAudioRef} autoPlay className="w-full" />
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="mb-4 h-64 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-3 mb-2 rounded-lg ${
                    msg.isLocal
                      ? 'bg-blue-100 dark:bg-blue-900 ml-auto max-w-[80%]'
                      : 'bg-gray-100 dark:bg-gray-600 mr-auto max-w-[80%]'
                  }`}
                >
                  <p className="text-sm">{msg.text}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage(messageInput)}
                placeholder="Enter neural message..."
                className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                onClick={() => sendMessage(messageInput)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Transmit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
