import React from 'react';
import { Video } from 'lucide-react';

interface Props {
  sessionId?: string | null;
  streamKey?: string | null;
}

export function LiveStreamPanel({ sessionId, streamKey }: Props) {
  if (!sessionId || !streamKey) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
        <Video size={36} className="mb-3 opacity-40" />
        <p className="text-sm">Aucun live actif</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
      <div className="aspect-video bg-black rounded-xl flex items-center justify-center">
        <p className="text-slate-500 text-sm">Live stream: {sessionId}</p>
      </div>
    </div>
  );
}
