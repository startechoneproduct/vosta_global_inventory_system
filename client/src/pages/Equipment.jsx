import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

export default function Equipment() {
  const { t } = useTranslation('equipment');
  const [equipment, setEquipment] = useState([]);
  const [form, setForm] = useState({ name: '', type: '', serialNumber: '', serviceIntervalDays: 90, notes: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchEquipment();
  }, []);

  const fetchEquipment = async () => {
    try {
      const response = await api.get('/equipment');
      setEquipment(response.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!form.name) {
        setError(t('nameRequired'));
        setLoading(false);
        return;
      }
      await api.post('/equipment', { ...form, serviceIntervalDays: Number(form.serviceIntervalDays) });
      setSuccess(t('equipmentAdded'));
      setForm({ name: '', type: '', serialNumber: '', serviceIntervalDays: 90, notes: '' });
      fetchEquipment();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markServiced = async (id) => {
    try {
      await api.put(`/equipment/${id}/service`);
      fetchEquipment();
    } catch (err) {
      setError(err.message);
    }
  };

  const statusBadge = (status) => {
    if (status === 'operational') return 'badge-green';
    if (status === 'due_for_service') return 'badge-yellow';
    return 'badge-red';
  };

  const statusLabel = (status) => t(`status.${status}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      <form onSubmit={handleAdd} className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input className="input-field" placeholder={t('namePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="input-field" placeholder={t('typePlaceholder')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
        <input className="input-field" placeholder={t('serialNumberPlaceholder')} value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
        <input
          type="number"
          className="input-field"
          placeholder={t('serviceIntervalPlaceholder')}
          value={form.serviceIntervalDays}
          onChange={(e) => setForm({ ...form, serviceIntervalDays: e.target.value })}
        />
        <input className="input-field sm:col-span-2" placeholder={t('notesPlaceholder')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button type="submit" disabled={loading} className="btn-primary sm:col-span-2">{t('addEquipment')}</button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colEquipment')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colType')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colLastServiced')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colNextDue')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colStatus')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900"></th>
            </tr>
          </thead>
          <tbody>
            {equipment.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">{t('noneRecorded')}</td></tr>
            ) : (
              equipment.map((eq) => (
                <tr key={eq._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{eq.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{eq.type || '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{eq.lastServiceDate ? new Date(eq.lastServiceDate).toLocaleDateString('en-NG') : '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{eq.nextServiceDue ? new Date(eq.nextServiceDue).toLocaleDateString('en-NG') : '-'}</td>
                  <td className="px-6 py-3"><span className={statusBadge(eq.status)}>{statusLabel(eq.status)}</span></td>
                  <td className="px-6 py-3">
                    <button onClick={() => markServiced(eq._id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      {t('markServiced')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
