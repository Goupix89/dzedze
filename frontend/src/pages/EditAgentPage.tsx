import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

interface Agent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: string;
}

export default function EditAgentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: agent, isLoading: agentLoading } = useQuery<Agent>({
    queryKey: ['agent', id],
    queryFn: () => apiClient.get(`/users/${id}`).then(r => r.data.data),
  });

  const [formData, setFormData] = useState({
    first_name: agent?.first_name ?? '',
    last_name: agent?.last_name ?? '',
    phone: agent?.phone ?? '',
  });

  React.useEffect(() => {
    if (agent) {
      setFormData({
        first_name: agent.first_name,
        last_name: agent.last_name,
        phone: agent.phone ?? '',
      });
    }
  }, [agent]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = { ...formData };
      if (newPassword) payload.new_password = newPassword;
      
      await apiClient.put(`/users/${id}`, {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone || null,
      });

      if (newPassword) {
        await apiClient.put(`/users/${id}/password`, { new_password: newPassword });
      }
    },
    onSuccess: () => navigate('/users'),
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors de la modification'),
  });

  if (agentLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-guin-dark p-4">
      <div className="max-w-2xl mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-guin-cream mb-6 hover:text-guin-gold transition-colors">
          <ArrowLeft size={20} />
          Retour
        </button>

        <div className="bg-guin-card border border-guin-border rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-guin-cream mb-6">Modifier l'agent</h1>

          {error && (
            <div className="mb-4 p-4 bg-guin-error/20 border border-guin-error/40 rounded-lg flex gap-2">
              <AlertCircle className="text-guin-error flex-shrink-0" />
              <p className="text-guin-error text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            <div>
              <label className="block text-sm text-guin-creamDim mb-2">Prénom</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
              />
            </div>

            <div>
              <label className="block text-sm text-guin-creamDim mb-2">Nom</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
              />
            </div>

            <div>
              <label className="block text-sm text-guin-creamDim mb-2">Téléphone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
              />
            </div>

            <div className="border-t border-guin-border pt-4 mt-6">
              <h3 className="text-sm font-semibold text-guin-creamDim mb-4 tracking-wider">MOT DE PASSE</h3>
              <div>
                <label className="block text-sm text-guin-creamDim mb-2">Nouveau mot de passe</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Laissez vide pour ne pas modifier"
                  className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
                />
                {newPassword && newPassword.length < 8 && (
                  <p className="text-xs text-guin-error mt-1">8 caractères minimum</p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending || (newPassword && newPassword.length < 8)}
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
