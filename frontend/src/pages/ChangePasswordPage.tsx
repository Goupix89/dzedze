import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export default function ChangePasswordPage() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const isChangingOther = !!userId;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const data: any = { new_password: newPassword };
      if (!isChangingOther) {
        data.current_password = currentPassword;
      }
      await apiClient.put(`/users/${userId || 'me'}/password`, data);
    },
    onSuccess: () => {
      setSuccess('Mot de passe modifié avec succès');
      setTimeout(() => navigate(-1), 1500);
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors de la modification'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 8) {
      setError('8 caractères minimum');
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-guin-dark p-4">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-guin-cream mb-6 hover:text-guin-gold transition-colors">
          <ArrowLeft size={20} />
          Retour
        </button>

        <div className="bg-guin-card border border-guin-border rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-guin-cream mb-2">
            {isChangingOther ? 'Changer le mot de passe' : 'Changer mon mot de passe'}
          </h1>
          <p className="text-guin-creamDim text-sm mb-6">Sécurisez votre compte</p>

          {error && (
            <div className="mb-4 p-4 bg-guin-error/20 border border-guin-error/40 rounded-lg flex gap-2">
              <AlertCircle className="text-guin-error flex-shrink-0" />
              <p className="text-guin-error text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-guin-green/20 border border-guin-green/40 rounded-lg">
              <p className="text-guin-green text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isChangingOther && (
              <div>
                <label className="block text-sm text-guin-creamDim mb-2">Mot de passe actuel</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-guin-creamDim mb-2">Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
              />
            </div>

            <div>
              <label className="block text-sm text-guin-creamDim mb-2">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-guin-dark border border-guin-border rounded-lg px-3 py-2 text-guin-cream focus:outline-none focus:border-guin-gold"
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-guin-gold text-guin-dark font-semibold py-2 rounded-lg hover:bg-guin-gold/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 className="animate-spin" size={16} />}
              Changer le mot de passe
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
