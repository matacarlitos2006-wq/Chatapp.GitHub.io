import { useState, useRef } from 'react';
import { Mic, Square, Send } from 'lucide-react';

interface VoiceRecorderProps {
  onSend: (audioUrl: string, duration: number) => void;
}

export default function VoiceRecorder({ onSend }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          onSend(reader.result as string, duration);
          setDuration(0);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);
      intervalRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    setRecording(false);
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    chunksRef.current = [];
    setRecording(false);
    setDuration(0);
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
      <button onClick={cancelRecording} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-800/30 rounded-lg transition-colors text-gray-500">
        <Square className="w-4 h-4" />
      </button>
      <button onClick={stopRecording} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors">
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
