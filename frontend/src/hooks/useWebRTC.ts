// src/hooks/useWebRTC.ts
import { AnswerSignal, CandidateSignal, OfferSignal } from '@/types/webrtc';
import { useEffect, useRef, useState } from 'react';

type Message = {
  text: string;
  isLocal: boolean;
};

interface SignalMessage {
  type: string;
  data: any;
  source: string;
}

export default function useWebRTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [clientId, setClientId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [isCalling, setIsCalling] = useState(false);
  
  const ws = useRef<WebSocket | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);

  useEffect(() => {
    ws.current = new WebSocket('ws://localhost:8080');

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data) as SignalMessage;
      
      switch(data.type) {
        case 'id':
          setClientId(data.data);
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

    return () => ws.current?.close();
  }, []);

  const startCall = async (targetId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: false 
      });
      setLocalStream(stream);
      setTargetId(targetId);
      setIsCalling(true);

      createPeerConnection(stream);
      
      const offer = await peerConnection.current!.createOffer();
      await peerConnection.current!.setLocalDescription(offer);
      
      sendSignal({
        type: 'offer',
        target: targetId,
        data: offer
      });
    } catch (error) {
      console.error('Error starting call:', error);
    }
  };

  const createPeerConnection = (stream: MediaStream) => {
    const config: RTCConfiguration = { 
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] 
    };
    peerConnection.current = new RTCPeerConnection(config);

    stream.getTracks().forEach(track => {
      peerConnection.current!.addTrack(track, stream);
    });

    peerConnection.current.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    peerConnection.current.onicecandidate = ({ candidate }) => {
      if (candidate) {
        sendSignal({
          type: 'candidate',
          target: targetId,
          data: candidate
        });
      }
    };

    dataChannel.current = peerConnection.current.createDataChannel('chat');
    setupDataChannel();
  };

  const setupDataChannel = () => {
    if (!dataChannel.current) return;

    dataChannel.current.onopen = () => console.log('Data channel open');
    dataChannel.current.onmessage = (event) => {
      setMessages(prev => [...prev, { text: event.data, isLocal: false }]);
    };
  };

  const handleOffer = async (offer: OfferSignal) => {
    setTargetId(offer.source);
    setIsCalling(true);
    
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: true, 
      video: false 
    });
    setLocalStream(stream);
    
    createPeerConnection(stream);
    await peerConnection.current!.setRemoteDescription(offer.data);
    
    const answer = await peerConnection.current!.createAnswer();
    await peerConnection.current!.setLocalDescription(answer);
    
    sendSignal({
      type: 'answer',
      target: offer.source,
      data: answer
    });
  };

  const handleAnswer = async (answer: AnswerSignal) => {
    await peerConnection.current!.setRemoteDescription(answer.data);
  };

  const handleCandidate = async (candidate: CandidateSignal) => {
    try {
      await peerConnection.current!.addIceCandidate(
        new RTCIceCandidate(candidate.data)
      );
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const sendMessage = (message: string) => {
    if (dataChannel.current?.readyState === 'open') {
      dataChannel.current.send(message);
      setMessages(prev => [...prev, { text: message, isLocal: true }]);
    }
  };

  const sendSignal = (signal: Omit<SignalMessage, 'source'> & { target?: string }) => {
    ws.current?.send(JSON.stringify({
      ...signal,
      source: clientId
    }));
  };

  return {
    localStream,
    remoteStream,
    messages,
    clientId,
    targetId,
    isCalling,
    startCall,
    sendMessage
  };
}