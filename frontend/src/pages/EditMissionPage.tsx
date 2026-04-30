import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { ArrowLeft, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Mission {
  id: string;
  title: string;
  description: string;
  notes: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
}

export default function EditMissionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { data: mission, isLoading } = useQuery<Mission>({
    queryKey: ['mission', id],
    queryFn: () => apiClient.get(`/missions/${id}`).then(r => r.data.data),
  });

  const [formData, setFormData] = useState({
    title: mission?.title ?? '',
    description: mission?.description ?? '',
    notes: mission?.notes ?? '',
    scheduledStart: mission?.scheduled_start ? new Date(mission.scheduled_start).toISOString().slice(0, 16) : '',
    scheduledEnd: mission?.scheduled_end ? new Date(mission.scheduled_end).toISOString().slice(0, 16) : '',
  });

  React.useEffect(() => {
    if (mission) {
      setFormData({
        title: mission.title,
        description: mission.description,
        notes: mission.notes,
        scheduledStart: mission.scheduled_start ? new Date(mission.scheduled_start).toISOString().slice(0, 16) : '',
        scheduledEnd: mission.scheduled_end ? new Date(mission.scheduled_end).toISOString().slice(0, 16) : '',
      });
    }
  }, [mission]);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiClient.put(`/missions/${id}`, {
        title: formData.title,
        description: formData.description,
        notes: formData.notes || null,
        scheduledStart: formData.scheduledStart,
        scheduledEnd: formData.scheduledEnd,
      });
    },
    onSuccess: () => navigate(-1),
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors de la modification'),
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-guin-dark p-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-guin-cream mb-6 hover:text-guin-gold transition-colors">
          <ArrowLeft size={20} />
          Retour
        </button>

        <div className="bg-guin-card border border-guin-border rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-guin-cream mb-6">Modifier la mission</h1>

          {error && (
            <div className="mb-4 p-4 bg-guin-error/20 border border-guin-error/40 rounded-lg flex gap-2">
              <AlertCircle className="text-guin-error flex-shrink-0" />
              <p className="text-guin-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div>
              <label className="block text-sm text-guin-creamDim mb-2">Titre</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
              />
            </div>

            <div>
              <label className="block text-sm text-guin-creamDim mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
              />
            </div>

            <div>
              <label className="block text-sm text-guin-creamDim mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
              />
            </div>

            <div className="border-t border-guin-border pt-4 mt-6">
              <h3 className="text-sm font-semibold text-guin-creamDim mb-4 tracking-wider">PLANIFICATION</h3>
              
              <div>
                <label className="block text-sm text-guin-creamDim mb-2 flex items-center gap-2">
                  <Calendar size={14} />
                  Début planifié
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledStart}
                  onChange={(e) => setFormData({ ...formData, scheduledStart: e.target.value })}
                  className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
                />
              </div>

              <div>
                <label className="block text-sm text-guin-creamDim mb-2 flex items-center gap-2 mt-4">
                  <Calendar size={14} />
                  Fin planifiée
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduledEnd}
                  onChange={(e) => setFormData({ ...formData, scheduledEnd: e.target.value })}
                  className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-guin-gold text-guin-dark font-semibold py-2 rounded-lg hover:bg-guin-gold/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 className="animate-spin" size={16} />}
              Enregistrer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
