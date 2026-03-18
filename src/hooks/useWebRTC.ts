import { useEffect, useRef } from 'react';

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const useWebRTC = () => {
  const pc = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    pc.current = new RTCPeerConnection(rtcConfig);
    return () => {
      pc.current?.close();
    };
  }, []);

  return pc;
};
