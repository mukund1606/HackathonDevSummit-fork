// src/types/webrtc.d.ts
export interface OfferSignal {
    type: 'offer';
    data: RTCSessionDescriptionInit;
    source: string;
    target: string;
  }
  
  export interface AnswerSignal {
    type: 'answer';
    data: RTCSessionDescriptionInit;
    source: string;
    target: string;
  }
  
  export interface CandidateSignal {
    type: 'candidate';
    data: RTCIceCandidateInit;
    source: string;
    target: string;
  }
  
  export type WebRTCSignal = OfferSignal | AnswerSignal | CandidateSignal;