// src/hooks/useWebRTC.ts
import { AnswerSignal, CandidateSignal, OfferSignal } from '@/types/webrtc';
import { useEffect, useRef, useState } from 'react';
import { setupFrequencyAnalyzer } from '@/lib/audio-utils';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type MessageType = 'chat' | 'transcript';
type Message = {
  text: string;
  isLocal: boolean;
  type: MessageType;
};

interface SignalMessage {
  type: string;
  data: any;
  source: string;
}

// Generate a persistent client ID or use existing one from localStorage
const generateOrRetrieveClientId = (): string => {
  const storedId = localStorage.getItem('rtc_client_id');
  if (storedId) {
    return storedId;
  }
  
  // Generate new UUID
  const newId = 'user_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('rtc_client_id', newId);
  return newId;
};

export default function useWebRTC() {
  // Use persistent client ID
  const [clientId] = useState<string>(generateOrRetrieveClientId());
  const [targetId, setTargetId] = useState<string>('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCalling, setIsCalling] = useState(false);
  const [connectionState, setConnectionState] = useState<string>('new');
  const [dataChannelState, setDataChannelState] = useState<RTCDataChannelState | null>(null);
  const [localFrequencyData, setLocalFrequencyData] = useState<Uint8Array | null>(null);
  const [remoteFrequencyData, setRemoteFrequencyData] = useState<Uint8Array | null>(null);
  
  const ws = useRef<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const localAudioContextRef = useRef<AudioContext | null>(null);
  const localAnalyzerRef = useRef<AnalyserNode | null>(null);
  const remoteAudioContextRef = useRef<AudioContext | null>(null);
  const remoteAnalyzerRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null);
  
  // Flag to track if we've already registered with the server
  const isRegistered = useRef<boolean>(false);
  
  useEffect(() => {
    // Setup WebSocket connection with reconnection logic
    const setupWebSocket = () => {
      ws.current = new WebSocket('ws://localhost:8080');
      
      ws.current.onopen = () => {
        console.log('Connected to signaling server');
        
        // Register with the server using our persistent ID
        if (!isRegistered.current) {
          console.log('Registering with ID:', clientId);
          sendSignal({
            type: 'register',
            data: clientId
          });
          isRegistered.current = true;
        }
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.current.onclose = () => {
        console.log('Disconnected from signaling server');
        isRegistered.current = false;
        
        // Attempt to reconnect after a delay
        setTimeout(() => {
          console.log('Attempting to reconnect...');
          setupWebSocket();
        }, 3000);
      };
      
      ws.current.onmessage = (event) => {
        console.log('Received message from signaling server:', event.data);
        const data = JSON.parse(event.data) as SignalMessage;
        
        switch(data.type) {
          case 'registered':
            console.log('Successfully registered with ID:', data.data);
            isRegistered.current = true;
            break;
          case 'offer':
            handleOffer(data as OfferSignal);
            break;
          case 'answer':
            handleAnswer(data as AnswerSignal);
            break;
          case 'candidate':
            handleCandidate(data as CandidateSignal);
            break;
        }
      };
    };
    
    setupWebSocket();
    
    // Attempt to restore previous session if target ID exists
    const storedTargetId = localStorage.getItem('rtc_target_id');
    if (storedTargetId) {
      setTargetId(storedTargetId);
      // Don't automatically reconnect here to avoid unwanted calls
      // Just restoring the UI state
    }
    
    // Save session data before the page unloads
    const handleBeforeUnload = () => {
      if (targetId) {
        localStorage.setItem('rtc_target_id', targetId);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Clean up resources
      ws.current?.close();
      recognitionRef.current?.stop();
      localAudioContextRef.current?.close();
      remoteAudioContextRef.current?.close();
      
      // Close peer connection
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [clientId]);
  
  useEffect(() => {
    if (!localStream) return;
    
    // Setup local frequency analyzer
    const { audioContext, analyzer, cleanup } = setupFrequencyAnalyzer(localStream);
    localAudioContextRef.current = audioContext;
    localAnalyzerRef.current = analyzer;
    
    const updateFrequencyData = () => {
      if (!analyzer) return;
      
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteFrequencyData(dataArray);
      setLocalFrequencyData(dataArray);
      
      requestAnimationFrame(updateFrequencyData);
    };
    
    updateFrequencyData();
    
    // Setup speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event: any) => {
        const results: SpeechRecognitionResult[] = Array.from(event.results);
        const transcript = results.slice(-1)[0][0].transcript;
          
        if (event.results[0].isFinal) {
          sendMessage(transcript, 'transcript');
        }
      };
      
      recognitionRef.current.start();
    }
    
    return () => {
      cleanup();
      recognitionRef.current?.stop();
    };
  }, [localStream]);
  
  useEffect(() => {
    if (!remoteStream) return;
    
    // Setup remote frequency analyzer
    const { audioContext, analyzer, cleanup } = setupFrequencyAnalyzer(remoteStream);
    remoteAudioContextRef.current = audioContext;
    remoteAnalyzerRef.current = analyzer;
    
    const updateFrequencyData = () => {
      if (!analyzer) return;
      
      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteFrequencyData(dataArray);
      setRemoteFrequencyData(dataArray);
      
      requestAnimationFrame(updateFrequencyData);
    };
    
    updateFrequencyData();
    
    return () => {
      cleanup();
      remoteAudioContextRef.current?.close();
    };
  }, [remoteStream]);
  
  const startCall = async (targetId: string) => {
    try {
      console.log('Starting call to:', targetId);
      
      // Store target ID for reconnection purposes
      localStorage.setItem('rtc_target_id', targetId);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      setLocalStream(stream);
      setTargetId(targetId);
      setIsCalling(true);
      
      createPeerConnection(stream, true);
      
      const offer = await peerConnection.current!.createOffer();
      await peerConnection.current!.setLocalDescription(offer);
      
      sendSignal({
        type: 'offer',
        target: targetId,
        data: offer
      });
    } catch (error) {
      console.error('Error starting call:', error);
      setIsCalling(false);
    }
  };
  
  const createPeerConnection = (stream: MediaStream, isInitiator: boolean) => {
    // Close existing connection if any
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    
    const config: RTCConfiguration = { 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ] 
    };
    
    peerConnection.current = new RTCPeerConnection(config);
    
    // Add connection state change listener
    peerConnection.current.onconnectionstatechange = () => {
      console.log('Connection state changed:', peerConnection.current?.connectionState);
      setConnectionState(peerConnection.current?.connectionState || 'new');
      
      if (peerConnection.current?.connectionState === 'connected') {
        setIsCalling(false);
      }
    };
    
    // Add all tracks from local stream
    stream.getTracks().forEach(track => {
      peerConnection.current!.addTrack(track, stream);
    });
    
    // Handle incoming tracks
    peerConnection.current.ontrack = (event) => {
      console.log('Received remote track');
      setRemoteStream(event.streams[0]);
    };
    
    // Handle ICE candidates
    peerConnection.current.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.log('Sending ICE candidate');
        sendSignal({
          type: 'candidate',
          target: targetId,
          data: candidate
        });
      }
    };
    
    // Create or receive data channel
    if (isInitiator) {
      console.log('Creating data channel');
      dataChannel.current = peerConnection.current.createDataChannel('chat', {
        ordered: true // Ensure messages are delivered in order
      });
      setupDataChannel();
    } else {
      console.log('Listening for data channel');
      peerConnection.current.ondatachannel = (event) => {
        console.log('Data channel received');
        dataChannel.current = event.channel;
        setupDataChannel();
      };
    }
  };
  
  const setupDataChannel = () => {
    if (!dataChannel.current) return;
    
    dataChannel.current.onopen = () => {
      console.log('Data channel open');
      setDataChannelState(dataChannel.current?.readyState || null);
      
      // Send any queued messages that might have failed previously
      const queuedMessages = localStorage.getItem('rtc_queued_messages');
      if (queuedMessages) {
        try {
          const messages = JSON.parse(queuedMessages);
          messages.forEach((msg: { text: string; type: MessageType }) => {
            if (dataChannel.current?.readyState === 'open') {
              dataChannel.current.send(JSON.stringify(msg));
              console.log("Sent queued message:", msg.text);
            }
          });
          // Clear the queue after sending
          localStorage.removeItem('rtc_queued_messages');
        } catch (e) {
          console.error('Error processing queued messages:', e);
        }
      }
    };
    
    dataChannel.current.onclose = () => {
      console.log('Data channel closed');
      setDataChannelState(dataChannel.current?.readyState || null);
    };
    
    dataChannel.current.onerror = (error) => {
      console.error('Data channel error:', error);
      setDataChannelState(dataChannel.current?.readyState || null);
    };
    
    dataChannel.current.onmessage = (event) => {
      console.log('Received message through data channel:', event.data);
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, { 
          text: data.text, 
          isLocal: false, 
          type: data.type 
        }]);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    // Update state immediately to reflect current state
    setDataChannelState(dataChannel.current.readyState);
  };
  
  const handleOffer = async (offer: OfferSignal) => {
    console.log('Received offer from:', offer.source);
    setTargetId(offer.source);
    setIsCalling(true);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      setLocalStream(stream);
      
      createPeerConnection(stream, false);
      await peerConnection.current!.setRemoteDescription(offer.data);
      
      const answer = await peerConnection.current!.createAnswer();
      await peerConnection.current!.setLocalDescription(answer);
      
      sendSignal({
        type: 'answer',
        target: offer.source,
        data: answer
      });
      
      // Store target ID for reconnection
      localStorage.setItem('rtc_target_id', offer.source);
    } catch (error) {
      console.error('Error handling offer:', error);
      setIsCalling(false);
    }
  };
  
  const handleAnswer = async (answer: AnswerSignal) => {
    console.log('Received answer from:', answer.source);
    try {
      await peerConnection.current!.setRemoteDescription(answer.data);
    } catch (error) {
      console.error('Error setting remote description:', error);
    }
  };
  
  const handleCandidate = async (candidate: CandidateSignal) => {
    console.log('Received ICE candidate');
    try {
      await peerConnection.current!.addIceCandidate(
        new RTCIceCandidate(candidate.data)
      );
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };
  
  const sendMessage = (message: string, type: MessageType = 'chat') => {
    const messageData = { text: message, type };
    console.log("Sending message:", message);
    console.log("Data channel state:", dataChannel.current?.readyState);
    
    // Always add the message to local state for UI feedback
    setMessages(prev => [...prev, { text: message, isLocal: true, type }]);
    
    // Try to send through data channel if it's open
    if (dataChannel.current?.readyState === 'open') {
      dataChannel.current.send(JSON.stringify(messageData));
      console.log("Message sent through data channel");
    } else {
      console.warn("Message added to UI but not sent: data channel not open");
      
      // Queue the message for later sending
      const queuedMessages = localStorage.getItem('rtc_queued_messages');
      let messages = [];
      
      if (queuedMessages) {
        try {
          messages = JSON.parse(queuedMessages);
        } catch (e) {
          console.error('Error parsing queued messages:', e);
        }
      }
      
      messages.push(messageData);
      localStorage.setItem('rtc_queued_messages', JSON.stringify(messages));
      console.log("Message queued for later sending");
    }
  };
  
  const sendSignal = (signal: Omit<SignalMessage, 'source'> & { target?: string }) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      const fullSignal = {
        ...signal,
        source: clientId
      };
      console.log('Sending signal:', fullSignal);
      ws.current.send(JSON.stringify(fullSignal));
    } else {
      console.error('WebSocket not open, cannot send signal');
    }
  };
  
  const reconnect = () => {
    // Attempt to reconnect with the last known target
    const storedTargetId = localStorage.getItem('rtc_target_id');
    if (storedTargetId) {
      console.log('Attempting to reconnect to:', storedTargetId);
      startCall(storedTargetId);
    } else {
      console.warn('No stored target ID for reconnection');
    }
  };
  
  return {
    localStream,
    remoteStream,
    messages,
    clientId,
    targetId,
    isCalling,
    connectionState,
    dataChannelState,
    localFrequencyData,
    remoteFrequencyData,
    startCall,
    sendMessage,
    reconnect
  };
}