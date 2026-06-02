import { useState, useRef, useEffect } from 'react';
import { X, Eraser, Palette, Download, Send } from 'lucide-react';

interface DrawingToolProps {
  onSend: (imageDataUrl: string) => void;
  onClose: () => void;
}

const COLORS = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ffffff'];
const SIZES = [2, 4, 8, 12, 20];

export default function DrawingTool({ onSend, onClose }: DrawingToolProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(4);
  const [isEraser, setIsEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = isEraser ? '#ffffff' : color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const handleSend = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (dataUrl) onSend(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-lg">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-white font-medium">Drawing</h3>
        <button onClick={handleSend} className="p-2 text-blue-400 hover:text-blue-300 rounded-lg">
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          width={600}
          height={400}
          className="bg-white rounded-xl shadow-lg max-w-full max-h-full cursor-crosshair touch-none"
          style={{ width: '100%', maxWidth: '600px' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      {/* Tools */}
      <div className="px-4 py-3 bg-gray-800 flex items-center justify-center gap-4">
        {/* Colors */}
        <div className="flex gap-1.5">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setIsEraser(false); }}
              className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${color === c && !isEraser ? 'border-white scale-110' : 'border-gray-600'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="w-px h-8 bg-gray-600" />

        {/* Sizes */}
        <div className="flex gap-1.5 items-center">
          {SIZES.map(s => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`rounded-full transition-all ${size === s ? 'bg-white' : 'bg-gray-500'}`}
              style={{ width: Math.max(s, 8) + 8, height: Math.max(s, 8) + 8 }}
            />
          ))}
        </div>

        <div className="w-px h-8 bg-gray-600" />

        {/* Eraser & Clear */}
        <button
          onClick={() => setIsEraser(!isEraser)}
          className={`p-2 rounded-lg transition-colors ${isEraser ? 'bg-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          <Eraser className="w-5 h-5" />
        </button>
        <button onClick={clearCanvas} className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg">
          Clear
        </button>
      </div>
    </div>
  );
}
