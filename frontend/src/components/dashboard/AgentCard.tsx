import React from 'react';
import { clsx } from 'clsx';
import { Star } from 'lucide-react';

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  quality_score?: number;
  status?: string;
}

interface Props {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
}

export function AgentCard({ agent, isSelected, onSelect }: Props) {
  const initials = `${agent.first_name[0]}${agent.last_name[0]}`;
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left border',
        isSelected
          ? 'bg-guin-terracotta/10 border-guin-terracotta/40'
          : 'bg-guin-dark/50 border-guin-border/50 hover:border-guin-gold/30'
      )}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{ background: 'linear-gradient(135deg,#C1440E,#D4A017)', color: '#F5ECD7' }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-guin-cream truncate">
          {agent.first_name} {agent.last_name}
        </div>
        <div className="text-xs text-guin-cream-dim capitalize">{agent.status ?? 'disponible'}</div>
      </div>
      {agent.quality_score !== undefined && (
        <div className="flex items-center gap-1 text-xs text-guin-gold shrink-0">
          <Star size={10} fill="#D4A017" />
          {parseFloat(String(agent.quality_score)).toFixed(1)}
        </div>
      )}
    </button>
  );
}
