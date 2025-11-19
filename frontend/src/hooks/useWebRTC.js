import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export function useWebRTC(socket, localVideoRef, remoteVideoRef, conversationId) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const peerConnection = useRef(null);

  const iceConfig = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  };

  useEffect(() => {
    if (!socket) return;

    const initializePeerConnection = async () => {
      try {
        // Get local stream
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Create peer connection
        peerConnection.current = new RTCPeerConnection(iceConfig);

        // Add local stream to peer connection
        stream.getTracks().forEach(track => {
          peerConnection.current.addTrack(track, stream);
        });

        // Handle incoming stream
        peerConnection.current.ontrack = (event) => {
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        // Handle ICE candidates
        peerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit("call:ice", { 
              to: conversationId, 
              candidate: event.candidate 
            });
          }
        };
      } catch (error) {
        console.error("Error initializing peer connection:", error);
      }
    };

    initializePeerConnection();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [socket]);

  const createOffer = async () => {
    if (!peerConnection.current) return;
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    return offer;
  };

  const createAnswer = async (offer) => {
    if (!peerConnection.current) return;
    await peerConnection.current.setRemoteDescription(offer);
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    return answer;
  };

  const addIceCandidate = async (candidate) => {
    if (!peerConnection.current) return;
    await peerConnection.current.addIceCandidate(candidate);
  };

  return { createOffer, createAnswer, addIceCandidate };
}