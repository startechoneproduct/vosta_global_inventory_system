import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { formatCurrency } from '../utils/formatCurrency';
import { useLanguage } from '../context/LanguageContext';

export default function Damages() {
  const { t } = useTranslation('damage');
  const { language } = useLanguage();

  const REASONS = [
    { value: 'broken', label: t('reasons.broken') },
    { value: 'cracked', label: t('reasons.cracked') },
    { value: 'rotten', label: t('reasons.rotten') },
    { value: 'contaminated', label: t('reasons.contaminated') },
    { value: 'transport_damage', label: t('reasons.transport_damage') },
    { value: 'other', label: t('reasons.other') },
  ];

  const [products, setProducts] = useState([]);
  const [damages, setDamages] = useState([]);
  const [form, setForm] = useState({ productId: '', quantity: '', reason: 'broken', notes: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchDamages();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/stock/products');
      setProducts(response.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchDamages = async () => {
    try {
      const response = await api.get('/damages');
      setDamages(response.data.data);
    } catch (err) {
      console.error('Failed to load damages', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!form.productId || !form.quantity) {
        setError(t('selectProductAndQuantity'));
        setLoading(false);
        return;
      }
      await api.post('/damages', {
        productId: form.productId,
        quantity: Number(form.quantity),
        reason: form.reason,
        notes: form.notes,
      });
      setSuccess(t('recordDamage'));
      setForm({ productId: '', quantity: '', reason: 'broken', notes: '' });
      fetchProducts();
      fetchDamages();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalLoss = damages.reduce((sum, d) => sum + (d.costValue || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">{t('totalRecorded')}</p>
          <p className="text-2xl font-bold text-red-600">{damages.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">{t('estimatedLoss')}</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalLoss, language)}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg space-y-4">
        <select className="input-field" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
          <option value="">{t('selectProduct')}</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        <input
          type="number"
          className="input-field"
          placeholder={t('quantity')}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          min="1"
        />
        <select className="input-field" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <input
          type="text"
          className="input-field"
          placeholder={t('notesOptional')}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">{t('recordDamage')}</button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('recentlyRecorded')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colDate')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colProduct')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colQty')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colReason')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colLoss')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colRecordedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {damages.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">{t('noneRecorded')}</td></tr>
              ) : (
                damages.map((d) => (
                  <tr key={d._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-600">{new Date(d.timestamp).toLocaleString('en-NG')}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{d.productName}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{Math.round(d.quantity)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600 capitalize">{d.reason.replace('_', ' ')}</td>
                    <td className="px-6 py-3 text-sm text-red-600">{formatCurrency(d.costValue, language)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{d.recordedBy?.fullName || '-'}</td>
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
