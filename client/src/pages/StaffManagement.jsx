import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useStore } from '../context/StoreContext';

const ASSIGNABLE_ROLES = ['general_manager', 'manager', 'accountant', 'driver', 'supervisor'];

export default function StaffManagement() {
  const { t } = useTranslation('staffManagement');
  const { activeStore } = useStore();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ email: '', fullName: '', phone: '', role: 'manager' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastGeneratedPassword, setLastGeneratedPassword] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const response = await api.get('/staff');
      setStaff(response.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    setLastGeneratedPassword('');
    try {
      if (!form.email || !form.fullName) {
        setError(t('errors.emailAndNameRequired'));
        setLoading(false);
        return;
      }
      const response = await api.post('/staff', form);
      setSuccess(t('success.staffAdded'));
      setLastGeneratedPassword(response.data.data.generatedPassword);
      setForm({ email: '', fullName: '', phone: '', role: 'manager' });
      fetchStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      await api.put(`/staff/${userId}`, { role });
      fetchStaff();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (userId, isActive) => {
    try {
      await api.put(`/staff/${userId}`, { isActive: !isActive });
      fetchStaff();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      const response = await api.post(`/staff/${userId}/reset-password`);
      setSuccess(t('success.passwordReset', { password: response.data.data.generatedPassword }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm font-medium">
        {t('managingForStore', { store: activeStore?.name || '...' })}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {success}
          {lastGeneratedPassword && (
            <p className="mt-1 font-mono text-xs bg-white inline-block px-2 py-1 rounded border border-green-300">
              {t('tempPasswordLabel', { password: lastGeneratedPassword })}
            </p>
          )}
        </div>
      )}

      <form onSubmit={handleAddStaff} className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className="input-field" placeholder={t('form.fullNamePlaceholder')} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        <input className="input-field" placeholder={t('form.emailPlaceholder')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="input-field" placeholder={t('form.phonePlaceholder')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <select className="input-field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r} value={r}>{t(`roles.${r}`)}</option>
          ))}
        </select>
        <button type="submit" disabled={loading} className="btn-primary sm:col-span-2">{t('form.addStaffButton')}</button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.colName')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.colEmail')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.colRole')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.colStatus')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {staff.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">{t('table.noStaff')}</td></tr>
              ) : (
                staff.filter((s) => s.role !== 'owner').map((s) => (
                  <tr key={s._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{s.fullName}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{s.email}</td>
                    <td className="px-6 py-3">
                      <select
                        value={s.role}
                        onChange={(e) => handleRoleChange(s._id, e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>{t(`roles.${r}`)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <span className={s.isActive ? 'badge-green' : 'badge-red'}>{s.isActive ? t('status.active') : t('status.inactive')}</span>
                    </td>
                    <td className="px-6 py-3 text-sm space-x-3 whitespace-nowrap">
                      <button onClick={() => handleToggleActive(s._id, s.isActive)} className="text-blue-600 hover:text-blue-800 font-medium">
                        {s.isActive ? t('actions.deactivate') : t('actions.activate')}
                      </button>
                      <button onClick={() => handleResetPassword(s._id)} className="text-gray-600 hover:text-gray-800 font-medium">
                        {t('actions.resetPassword')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
