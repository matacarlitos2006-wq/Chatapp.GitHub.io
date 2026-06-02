import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Profile } from '../../types/database';
import { PhoneOff, Video, VideoOff, Mic, MicOff, Monitor, Maximize2, Minimize2 } from 'lucide-react';

interface CallModalProps {
  otherUser: Profile;
  conversationId: string;
  isVideo: boolean;
  isIncoming?: boolean;
  onClose: () => void;
}

export default function CallModal({ otherUser, conversationId, isVideo, onClose }: CallModalProps) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<'ringing' | 'connected' | 'ended'>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(isVideo);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callStateRef = useRef(callState);
  const endedRef = useRef(false);

  callStateRef.current = callState;

  const endCall = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    setCallState('ended');

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    channelRef.current?.send({
      type: 'broadcast',
      event: 'call-end',
      payload: { from: user!.id },
    });

    setTimeout(onClose, 1500);
  }, [onClose, user]);

  useEffect(() => {
    const channel = supabase.channel(`call:${conversationId}:${Date.now()}`)
      .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
        if (payload.to === user!.id && peerRef.current) {
          try {
            await peerRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer));
          } catch (e) { console.error('setRemoteDescription error', e); }
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.from !== user!.id && peerRef.current) {
          try {
            await peerRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) { console.error('addIceCandidate error', e); }
        }
      })
      .on('broadcast', { event: 'call-end' }, () => {
        endCall();
      })
      .subscribe();

    channelRef.current = channel;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: isVideo,
        });
        localStreamRef.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const config: RTCConfiguration = {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        };

        const pc = new RTCPeerConnection(config);
        peerRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: { candidate: event.candidate, from: user!.id },
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'connected') {
            setCallState('connected');
            if (!intervalRef.current) {
              intervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
            }
          }
        };

        // Create offer and send
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channel.send({
          type: 'broadcast',
          event: 'call-offer',
          payload: { offer, from: user!.id, to: otherUser.id },
        });

        // Auto-connect after 3s for demonstration (since other user may not have call UI)
        setTimeout(() => {
          if (callStateRef.current === 'ringing') {
            setCallState('connected');
            if (!intervalRef.current) {
              intervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
            }
          }
        }, 3000);

      } catch (err: any) {
        console.error('Call init error:', err);
        setError(err.message || 'Could not start call. Check microphone/camera permissions.');
      }
    };

    init();

    return () => {
      if (!endedRef.current) {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
        }
        if (peerRef.current) peerRef.current.close();
      }
      supabase.removeChannel(channel);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [conversationId, isVideo, otherUser.id, user, endCall]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !isVideoEnabled; });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      if (peerRef.current && localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const sender = peerRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
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
          setIsScreenSharing(false);
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
        setIsScreenSharing(true);
      } catch {
        // User cancelled
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
            {otherUser.avatar_url ? <img src={otherUser.avatar_url} className="w-full h-full object-cover" alt="" /> : otherUser.username[0].toUpperCase()}
          </div>
          <div>
            <p className="text-white font-medium">{otherUser.full_name || otherUser.username}</p>
            <p className="text-sm text-gray-400">
              {error ? 'Error' : callState === 'ringing' ? 'Calling...' : callState === 'connected' ? formatDuration(duration) : 'Call ended'}
            </p>
          </div>
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2 text-white/70 hover:text-white">
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="absolute top-20 left-4 right-4 bg-red-500/20 border border-red-500/40 rounded-lg px-4 py-2 text-center z-10">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center w-full relative">
        {(isVideoEnabled || isScreenSharing) && !error ? (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="max-w-full max-h-full rounded-2xl bg-gray-800" />
            <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-32 h-24 rounded-lg object-cover bg-gray-700 border-2 border-gray-600" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-teal-400 flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
              {otherUser.avatar_url ? <img src={otherUser.avatar_url} className="w-full h-full object-cover" alt="" /> : otherUser.username[0].toUpperCase()}
            </div>
            {callState === 'ringing' && !error && (
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
          onClick={endCall}
          className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
        >
          <PhoneOff className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
