import { useState } from 'react';
import { X, Upload, Plus, Smile } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Sticker {
  id: string;
  name: string;
  image_url: string;
  uploaded_by: string;
}

const DEFAULT_STICKERS: Sticker[] = [
  { id: 's1', name: 'wave', image_url: 'https://images.pexels.com/photos/2832034/pexels-photo-2832034.jpeg?auto=compress&cs=tinysrgb&w=60', uploaded_by: '' },
  { id: 's2', name: 'heart', image_url: 'https://images.pexels.com/photos/887349/pexels-photo-887349.jpeg?auto=compress&cs=tinysrgb&w=60', uploaded_by: '' },
  { id: 's3', name: 'star', image_url: 'https://images.pexels.com/photos/1169754/pexels-photo-1169754.jpeg?auto=compress&cs=tinysrgb&w=60', uploaded_by: '' },
  { id: 's4', name: 'fire', image_url: 'https://images.pexels.com/photos/672636/pexels-photo-672636.jpeg?auto=compress&cs=tinysrgb&w=60', uploaded_by: '' },
];

interface StickerPickerProps {
  onSelect: (stickerUrl: string) => void;
  onClose: () => void;
}

export default function StickerPicker({ onSelect, onClose }: StickerPickerProps) {
  const { user } = useAuth();
  const [stickers, setStickers] = useState<Sticker[]>(DEFAULT_STICKERS);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploadName, setUploadName] = useState('');

  const handleUpload = async () => {
    if (!uploadUrl.trim() || !uploadName.trim()) return;
    const { data } = await supabase.from('custom_emojis').insert({
      uploaded_by: user!.id,
      name: uploadName.trim(),
      image_url: uploadUrl.trim(),
    }).select().maybeSingle();

    if (data) {
      setStickers(prev => [...prev, { id: data.id, name: data.name, image_url: data.image_url, uploaded_by: data.uploaded_by }]);
    }
    setUploadUrl('');
    setUploadName('');
    setShowUpload(false);
  };

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-20">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
          <Smile className="w-4 h-4 text-blue-500" /> Stickers
        </h4>
        <div className="flex gap-1">
          <button onClick={() => setShowUpload(!showUpload)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-blue-500">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {showUpload && (
        <div className="p-3 border-b border-gray-100 dark:border-gray-700 space-y-2">
          <input
            type="text"
            value={uploadName}
            onChange={e => setUploadName(e.target.value)}
            placeholder="Sticker name"
            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-xs focus:ring-1 focus:ring-blue-500"
          />
          <input
            type="text"
            value={uploadUrl}
            onChange={e => setUploadUrl(e.target.value)}
            placeholder="Image URL"
            className="w-full px-2 py-1.5 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded text-xs focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={handleUpload} disabled={!uploadUrl.trim() || !uploadName.trim()} className="w-full py-1.5 bg-blue-500 text-white rounded text-xs font-medium disabled:opacity-50">
            Add Sticker
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 p-3 max-h-48 overflow-y-auto">
        {stickers.map(sticker => (
          <button
            key={sticker.id}
            onClick={() => onSelect(sticker.image_url)}
            className="w-full aspect-square rounded-lg overflow-hidden hover:scale-105 transition-transform bg-gray-50 dark:bg-gray-700"
            title={sticker.name}
          >
            <img src={sticker.image_url} alt={sticker.name} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
