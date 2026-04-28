import React from 'react';
import { Camera } from 'lucide-react';

interface MediaItem {
  id: string;
  type: string;
  phase: string;
  thumbnailUrl?: string | null;
  quality_score?: number;
}

export function MediaGallery({ items }: { items: MediaItem[] }) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <Camera size={32} className="mb-2 opacity-40" />
        <p className="text-sm">Aucun média</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.id} className="relative aspect-video bg-slate-800 rounded-xl overflow-hidden">
          {item.thumbnailUrl ? (
            <img src={item.thumbnailUrl} alt={item.type} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Camera size={24} className="text-slate-600" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
