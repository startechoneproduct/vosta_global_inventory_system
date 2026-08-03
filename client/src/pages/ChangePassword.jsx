import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

export default function ChangePassword({ onSuccess }) {
  const { t } = useTranslation('changePassword');
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.currentPassword || !form.newPassword) {
      setError(t('errors.requiredFields'));
      return;
    }
    if (form.newPassword.length < 8) {
      setError(t('errors.passwordTooShort'));
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError(t('errors.passwordsDoNotMatch'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{t('heading')}</h2>
        <p className="text-gray-500 text-sm mb-6">
          {t('subtitle')}
        </p>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('currentPasswordLabel')}</label>
            <input
              type="password"
              className="input-field"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('newPasswordLabel')}</label>
            <input
              type="password"
              className="input-field"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('confirmPasswordLabel')}</label>
            <input
              type="password"
              className="input-field"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              disabled={loading}
            />
          </div>
          <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
            {loading ? t('updating') : t('updatePassword')}
          </button>
        </form>
      </div>
    </div>
  );
}
