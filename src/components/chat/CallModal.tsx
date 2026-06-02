import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Profile } from '../../types/database';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Monitor, X, Maximize2, Minimize2 } from 'lucide-react';

interface CallModalProps {
  otherUser: Profile;
  conversationId: string;
  isVideo: boolean;
  isIncoming?: boolean;
  onClose: () => void;
}

export default function CallModal({ otherUser, conversationId, isVideo, isIncoming, onClose }: CallModalProps) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideo);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const setupLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideoEnabled,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Failed to get local stream:', err);
      return null;
    }
  }, [isVideoEnabled]);

  const setupPeerConnection = useCallback(async () => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };

    const pc = new RTCPeerConnection(config);
    peerRef.current = pc;

    const stream = await setupLocalStream();
    if (stream) {
      stream.getTracks().forEach(track => pc.addTrack(track, stream));
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        supabase.channel(`call:${conversationId}`).send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { candidate: event.candidate, from: user!.id },
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        setCallState('connected');
        intervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        handleEndCall();
      }
    };

    return pc;
  }, [conversationId, user, setupLocalStream]);

  useEffect(() => {
    const channel = supabase.channel(`call:${conversationId}`)
      .on('broadcast', { event: 'call-offer' }, async ({ payload }) => {
        if (payload.to === user!.id && peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.offer));
          const answer = await peerRef.current.createAnswer();
          await peerRef.current.setLocalDescription(answer);
          channel.send({
            type: 'broadcast',
            event: 'call-answer',
            payload: { answer, to: payload.from },
          });
        }
      })
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (payload.to === user!.id && peerRef.current) {
          await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from !== user!.id && peerRef.current) {
          await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
      })
      .on('broadcast', { event: 'call-end' }, () => {
        handleEndCall();
      })
      .subscribe();

    channelRef.current = channel;

    const initCall = async () => {
      const pc = await setupPeerConnection();
      if (!isIncoming && pc) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({
          type: 'broadcast',
          event: 'call-offer',
          payload: { offer, from: user!.id, to: otherUser.id },
        });
      }

      // Auto-connect after 3s for demo
      setTimeout(() => {
        if (callState === 'ringing') {
          setCallState('connected');
          intervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
        }
      }, 3000);
    };

    initCall();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleEndCall = () => {
    setCallState('ended');
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (peerRef.current) {
      peerRef.current.close();
    }
    channelRef.current?.send({
      type: 'broadcast',
      event: 'call-end',
      payload: { from: user!.id },
    });
    setTimeout(onClose, 1500);
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await setupLocalStream();
      if (stream && peerRef.current) {
        const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(stream.getVideoTracks()[0]);
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        if (peerRef.current) {
          const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenStream.getVideoTracks()[0]);
        }
        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
        setIsScreenSharing(true);
      } catch {
        // User cancelled screen share
      }
    }
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center ${isFullscreen ? '' : 'p-4'}`}>
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white font-medium overflow-hidden">
            {otherUser.avatar_url ? <img src={otherUser.avatar_url} className="w-full h-full object-cover" /> : otherUser.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white font-medium">{otherUser.full_name || otherUser.username}</p>
            <p className="text-sm text-gray-400">
              {callState === 'ringing' ? 'Calling...' : callState === 'connected' ? formatDuration(duration) : 'Call ended'}
            </p>
          </div>
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-white/70 hover:text-white">
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center w-full relative">
        {isVideoEnabled || isScreenSharing ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="max-w-full max-h-full rounded-2xl bg-gray-800" />
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-32 h-24 rounded-lg object-cover bg-gray-700 border-2 border-gray-600" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
              {otherUser.avatar_url ? <img src={otherUser.avatar_url} className="w-full h-full object-cover" /> : otherUser.username[0].toUpperCase()}
            </div>
            {callState === 'ringing' && (
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-8 flex items-center gap-4">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {isVideo && (
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full transition-colors ${!isVideoEnabled ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </button>
        )}

        <button
          onClick={toggleScreenShare}
          className={`p-4 rounded-full transition-colors ${isScreenSharing ? 'bg-blue-500/30 text-blue-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          <Monitor className="w-6 h-6" />
        </button>

        <button
          onClick={handleEndCall}
          className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
