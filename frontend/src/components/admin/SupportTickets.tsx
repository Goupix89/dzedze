import React from 'react';
import { AlertCircle } from 'lucide-react';

export function SupportTickets() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-guin-card border border-guin-border rounded-lg p-12 text-center">
        <AlertCircle size={48} className="mx-auto text-guin-muted mb-4" />
        <h3 className="text-lg font-bold text-guin-cream mb-2">
          Module Support Tickets
        </h3>
        <p className="text-guin-cream-dim">
          À développer: Système de tickets d'aide pour les tenants
        </p>
      </div>
    </div>
  );
}
