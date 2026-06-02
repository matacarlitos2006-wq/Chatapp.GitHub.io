import { useState, useEffect } from 'react';
import { Image as ImageIcon, X, Search } from 'lucide-react';

const TENOR_CATEGORIES = [
  { name: 'Trending', query: 'trending' },
  { name: 'Happy', query: 'happy' },
  { name: 'Sad', query: 'sad' },
  { name: 'Love', query: 'love' },
  { name: 'Wow', query: 'wow' },
  { name: 'LOL', query: 'lol' },
  { name: 'Thumbs Up', query: 'thumbs up' },
  { name: 'High Five', query: 'high five' },
];

// Using sample GIF URLs since we can't use a live API key
const SAMPLE_GIFS: Record<string, string[]> = {
  trending: [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDRqNm5yNTd4OWx2b2t5bnBwN2ZjMGx6cmV0N2RyeXluZ3o4eSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7abKhOpu0NwenH3O/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNmFiOHE4OWRnN3o3dXJhcjdmMGN1MnJ3N3B6cGpjOWx3bHVoMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0MYt5jPR6QX5pnqM/giphy.gif',
  ],
  happy: [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcTZ4d2Z6ZHRnaG5ub3RyNjdnbWlvZm1iOGR3MnJ5MXFxczA0dyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5GoVLqeAOo6PK/giphy.gif',
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaWk5M2d5ZWIyNmxlcWt5Z2l3YnRrcGQzZm9mNnMxZXlranVhamUmZXA9djFfaW50ZXJuYWxfZ2lmX2J5X2lkJmN0PWc/7OW9uiyfeTRX2/giphy.gif',
  ],
  sad: [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcnZubHByaDV0bHBlbXRkb3M2aDEyYmV5MzM1dXNmOGdsMW42cW1jZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/OPU6wzx8JrHna/giphy.gif',
  ],
  love: [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZmNlczRtcTFqNjRlczZ3Mm1mZWVtNnZrMGgyNWM1dHdyZHU0MCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oEjHV0z8S7WM4MwnK/giphy.gif',
  ],
  wow: [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExN3QyOXQzbmtndHduZmJuMHQ4Yml1M2h1c2lwd3p4dnNobnY5eCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5VKbvrjxpVJCM/giphy.gif',
  ],
  lol: [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNjkyNWRsNHBnNmE1NW95NjhxeXVobGo2YTFhemx3bXQ1NXdmdSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/Q7ozWVYCR0nyW2rvPW/giphy.gif',
  ],
  'thumbs up': [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaHUzc2tsMmRqaHBtNWdnMDcwNmg0c3VuY3JkYnptcGxlMGR1MSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7abB06u9bNzA8lu8/giphy.gif',
  ],
  'high five': [
    'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExd2RxeXl2MDhhbGhxdWVqZjZ2MW1wdmh2MjFwY2V4N3RhcDQ5aCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oEjHV0z8S7WM4MwnK/giphy.gif',
  ],
};

interface GifPickerProps {
  onSelect: (gifUrl: string) => void;
  onClose: () => void;
}

export default function GifPicker({ onSelect, onClose }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('trending');
  const [gifs, setGifs] = useState<string[]>(SAMPLE_GIFS.trending);

  useEffect(() => {
    const category = query.trim().toLowerCase() || activeCategory;
    const matched = SAMPLE_GIFS[category] || SAMPLE_GIFS.trending;
    setGifs(matched);
  }, [query, activeCategory]);

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden z-20">
      <div className="p-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); }}
            placeholder="Search GIFs..."
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none"
            autoFocus
          />
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-gray-100 dark:border-gray-700">
        {TENOR_CATEGORIES.map(cat => (
          <button
            key={cat.query}
            onClick={() => { setActiveCategory(cat.query); setQuery(''); }}
            className={`px-2 py-1 text-xs rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === cat.query
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1 p-2 max-h-60 overflow-y-auto">
        {gifs.map((gif, i) => (
          <button
            key={i}
            onClick={() => onSelect(gif)}
            className="rounded-lg overflow-hidden hover:opacity-80 transition-opacity h-24"
          >
            <img src={gif} alt="GIF" className="w-full h-full object-cover" loading="lazy" />
          </button>
        ))}
        {gifs.length === 0 && (
          <div className="col-span-2 py-8 text-center text-sm text-gray-400">
            <ImageIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No GIFs found
          </div>
        )}
      </div>
    </div>
  );
}
