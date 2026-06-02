import { useState, useRef } from 'react';
import { Camera, X } from 'lucide-react';

interface ImageUploadProps {
  currentImage: string | null;
  onImageSelect: (imageUrl: string) => void;
  type: 'avatar' | 'background';
  className?: string;
}

export default function ImageUpload({
  currentImage,
  onImageSelect,
  type,
  className = '',
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      // Read the file as data URL (in production, you'd upload to storage)
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setPreview(dataUrl);
        onImageSelect(dataUrl);
        setUploading(false);
      };
      reader.onerror = () => {
        alert('Failed to read image file');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageSelect('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {type === 'avatar' ? (
        <div className="relative group">
          <div
            className={`w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-gray-700 shadow-lg ${
              preview ? 'bg-cover bg-center' : 'bg-gradient-to-br from-blue-400 to-teal-400'
            }`}
            style={preview ? { backgroundImage: `url(${preview})` } : undefined}
          >
            {!preview && (
              <div className="w-full h-full flex items-center justify-center text-white text-3xl font-bold">
                ?
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Camera className="w-6 h-6 text-white" />
          </button>
          {preview && (
            <button
              onClick={handleRemove}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative group">
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`h-32 rounded-t-lg overflow-hidden cursor-pointer ${
              preview ? 'bg-cover bg-center' : 'bg-gradient-to-r from-blue-500 to-teal-500'
            }`}
            style={preview ? { backgroundImage: `url(${preview})` } : undefined}
          >
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="text-center text-white">
                <Camera className="w-6 h-6 mx-auto mb-1" />
                <span className="text-sm">
                  {uploading ? 'Uploading...' : 'Change Background'}
                </span>
              </div>
            </div>
          </div>
          {preview && (
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-red-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
}
