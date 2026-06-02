import { useState, useRef } from 'react';
import { Mic, Square, Send, X } from 'lucide-react';

interface VoiceRecorderProps {
  onSend: (audioUrl: string, duration: number) => void;
}

export default function VoiceRecorder({ onSend }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      durationRef.current = 0;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          onSend(dataUrl, durationRef.current);
          setDuration(0);
          durationRef.current = 0;
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start(100);
      setRecording(true);
      setDuration(0);
      intervalRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      alert('Could not access microphone. Please allow microphone permissions.');
    }
  };

  const stopAndSend = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }
    cleanup();
    chunksRef.current = [];
  };

  const cleanup = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setRecording(false);
  };

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!recording) {
    return (
      <button
        type="button"
        onClick={startRecording}
        className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
        title="Record voice message"
      >
        <Mic className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">
      <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
      <span className="text-sm font-medium text-red-600 dark:text-red-400">{formatDuration(duration)}</span>
      <div className="flex-1" />
      <button type="button" onClick={cancelRecording} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg transition-colors text-gray-500" title="Cancel">
        <X className="w-4 h-4" />
      </button>
      <button type="button" onClick={stopAndSend} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors" title="Send">
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
