import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useStore } from '../context/StoreContext';

function emptyForm() {
  return {
    type: 'vaccination',
    name: '',
    batchOrFlockLabel: '',
    dosage: '',
    administeredDate: new Date().toISOString().slice(0, 10),
    nextDueDate: '',
    notes: '',
  };
}

export default function Vaccination() {
  const { t } = useTranslation('vaccination');
  const { activeStore } = useStore();
  const isFarm = activeStore?.type === 'farm';

  const TYPES = [
    { value: 'vaccination', label: t('types.vaccination') },
    { value: 'medication', label: t('types.medication') },
  ];

  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isFarm) fetchRecords();
  }, [isFarm]);

  const fetchRecords = async () => {
    try {
      const response = await api.get('/vaccination');
      setRecords(response.data.data);
    } catch (err) {
      console.error('Failed to load vaccination records', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!form.name) {
        setError(t('enterName'));
        setLoading(false);
        return;
      }
      await api.post('/vaccination', form);
      setSuccess(t('recordSaved'));
      setForm(emptyForm());
      fetchRecords();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isFarm) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6 text-gray-500">
        {t('notAvailable')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg space-y-4">
        <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
          {TYPES.map((tOpt) => (
            <option key={tOpt.value} value={tOpt.value}>{tOpt.label}</option>
          ))}
        </select>
        <input
          type="text"
          className="input-field"
          placeholder={t('namePlaceholder')}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          type="text"
          className="input-field"
          placeholder={t('batchOrFlockPlaceholder')}
          value={form.batchOrFlockLabel}
          onChange={(e) => setForm({ ...form, batchOrFlockLabel: e.target.value })}
        />
        <input
          type="text"
          className="input-field"
          placeholder={t('dosagePlaceholder')}
          value={form.dosage}
          onChange={(e) => setForm({ ...form, dosage: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500">{t('administeredDate')}</label>
            <input
              type="date"
              className="input-field"
              value={form.administeredDate}
              onChange={(e) => setForm({ ...form, administeredDate: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('nextDueDate')}</label>
            <input
              type="date"
              className="input-field"
              value={form.nextDueDate}
              onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })}
            />
          </div>
        </div>
        <input
          type="text"
          className="input-field"
          placeholder={t('notesOptional')}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">{t('saveRecord')}</button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('recentRecords')}</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colDate')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colType')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colName')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colBatchFlock')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colDosage')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colNextDue')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colRecordedBy')}</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">{t('noRecords')}</td></tr>
            ) : (
              records.map((r) => (
                <tr key={r._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">{new Date(r.administeredDate).toLocaleDateString('en-NG')}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 capitalize">{r.type}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{r.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{r.batchOrFlockLabel || '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{r.dosage || '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{r.nextDueDate ? new Date(r.nextDueDate).toLocaleDateString('en-NG') : '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{r.administeredBy?.fullName || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
