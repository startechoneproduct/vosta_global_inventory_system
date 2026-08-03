import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Real, human-readable, 12-hour time (not 24-hour).
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function InventoryMovement() {
  const { t } = useTranslation('inventoryMovement');

  const TYPE_LABELS = {
    in: t('types.in'),
    out: t('types.out'),
    return_in: t('types.return_in'),
    production_in: t('types.production_in'),
    sale: t('types.sale'),
    damage_out: t('types.damage_out'),
    manual_past_sale: t('types.manual_past_sale'),
  };

  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchMovements();
  }, []);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const response = await api.get('/stock/movements');
      setMovements(response.data.data);
      setError('');
    } catch (err) {
      setError(err.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('columns.product')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('columns.type')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('columns.quantity')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('columns.balanceAfter')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('columns.performedBy')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('columns.date')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('columns.time')}</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('columns.store')}</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-8 text-center text-gray-500">{t('noMovements')}</td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-3 text-sm font-medium text-gray-900">{m.productId?.name || t('unknownProduct')}</td>
                      <td className="px-6 py-3">
                        <span className={m.direction === 'in' ? 'badge-green' : 'badge-red'}>
                          {TYPE_LABELS[m.type] || m.type}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">{Math.round(m.quantity)}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{m.balanceAfter != null ? Math.round(m.balanceAfter) : '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{m.recordedBy?.fullName || '-'}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{formatDate(m.timestamp)}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{formatTime(m.timestamp)}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{m.storeName || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
