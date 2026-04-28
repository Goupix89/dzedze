import React from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, MapPin } from 'lucide-react';
import { clsx } from 'clsx';

interface Mission {
  id: string;
  status: string;
  site_name?: string;
  agent_name?: string;
  started_at?: string;
  scheduled_at?: string;
}

const STATUS: Record<string, { dot: string; label: string }> = {
  in_progress: { dot: '#2D6A4F', label: 'En cours' },
  pending:     { dot: '#D4A017', label: 'En attente' },
  completed:   { dot: '#C1440E', label: 'Terminée' },
  cancelled:   { dot: '#8B1A0A', label: 'Annulée' },
};

export function MissionTimeline({ missions }: { missions: Mission[] }) {
  if (!missions.length) {
    return (
      <p className="text-guin-cream-dim text-sm text-center py-8">
        Aucune mission en cours
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {missions.map((m) => {
        const s = STATUS[m.status] ?? { dot: '#A08060', label: m.status };
        return (
          <div key={m.id} className="flex items-center gap-4 p-3 bg-guin-dark/60 rounded-xl border border-guin-border/50 hover:border-guin-gold/30 transition-colors">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.dot, boxShadow: `0 0 6px ${s.dot}` }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-medium text-guin-cream truncate">
                <MapPin size={11} className="text-guin-cream-dim shrink-0" />
                {m.site_name ?? '—'}
              </div>
              <div className="text-xs text-guin-cream-dim mt-0.5">{m.agent_name ?? '—'}</div>
            </div>
            <div className="flex items-center gap-1 text-xs text-guin-cream-dim shrink-0">
              <Clock size={10} />
              {m.started_at
                ? format(new Date(m.started_at), 'HH:mm', { locale: fr })
                : m.scheduled_at
                ? format(new Date(m.scheduled_at), 'HH:mm', { locale: fr })
                : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}
