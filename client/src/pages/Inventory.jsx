import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

export default function Inventory({ user }) {
  const { t } = useTranslation('inventory');
  const canEdit = ['owner', 'general_manager', 'accountant'].includes(user?.role); // manager = view only

  const [products, setProducts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [manualEntries, setManualEntries] = useState([]);
  const [tab, setTab] = useState('overview');
  const [form, setForm] = useState({ productId: '', quantity: '', notes: '' });
  const [manualForm, setManualForm] = useState({ productId: '', quantity: '', manualEntryDate: '', notes: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchAnalytics();
    fetchManualEntries();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/stock/products');
      setProducts(response.data.data);
    } catch (err) {
      setError(t('errorLoadProducts'));
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/stock/analytics');
      setAnalytics(response.data.data);
    } catch (err) {
      console.error('Failed to load analytics', err);
    }
  };

  // Reuses the existing /stock/movements endpoint, filtered to just the
  // manual_past_sale type, so every historical entry that's been backfilled
  // is visible and auditable instead of disappearing into the DB.
  const fetchManualEntries = async () => {
    try {
      const response = await api.get('/stock/movements', { params: { type: 'manual_past_sale' } });
      setManualEntries(response.data.data);
    } catch (err) {
      console.error('Failed to load manual entries', err);
    }
  };

  const submitMovement = async (direction) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!form.productId || !form.quantity) {
        setError(t('errorSelectProductQuantity'));
        setLoading(false);
        return;
      }
      await api.post(`/stock/${direction}`, { productId: form.productId, quantity: Number(form.quantity), notes: form.notes });
      setSuccess(direction === 'in' ? t('stockAddedSuccess') : t('stockRemovedSuccess'));
      setForm({ productId: '', quantity: '', notes: '' });
      fetchProducts();
      fetchAnalytics();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitManualPastSale = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!manualForm.productId || !manualForm.quantity || !manualForm.manualEntryDate) {
        setError(t('errorSelectProductQuantityDate'));
        setLoading(false);
        return;
      }
      await api.post('/stock/manual-past-sale', {
        productId: manualForm.productId,
        quantity: Number(manualForm.quantity),
        manualEntryDate: manualForm.manualEntryDate,
        notes: manualForm.notes,
      });
      setSuccess(t('historicalSaleRecorded'));
      setManualForm({ productId: '', quantity: '', manualEntryDate: '', notes: '' });
      fetchManualEntries();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  const statusLabel = (status) =>
    status === 'healthy' ? t('statusHealthy') : status === 'low_stock' ? t('statusLowStock') : t('statusOutOfStock');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}{!canEdit && ` ${t('viewOnlySuffix')}`}</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      <div className="flex gap-2 border-b border-gray-200">
        {['overview', 'movements', ...(canEdit ? ['manual-entry'] : [])].map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === tabKey ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tabKey === 'overview' ? t('tabOverview') : tabKey === 'movements' ? t('tabMovements') : t('tabManualEntry')}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {analytics?.overview && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">{t('statTotalStockIn')}</p>
                <p className="text-xl font-bold text-gray-900">{Math.round(analytics.overview.stockInUnits).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">{t('statTotalStockOut')}</p>
                <p className="text-xl font-bold text-gray-900">{Math.round(analytics.overview.stockOutUnits).toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">{t('statStockOutRate')}</p>
                <p className="text-xl font-bold text-gray-900">{analytics.overview.stockOutRatePct.toFixed(2)}%</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">{t('statLowStockCount')}</p>
                <p className="text-xl font-bold text-red-600">{analytics.overview.lowStockCount}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500">{t('statInventoryTurnover')}</p>
                <p className="text-xl font-bold text-gray-900">{analytics.overview.turnover.toFixed(2)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">{t('productsHeading')}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">{t('colProductName')}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">{t('colStock')}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">{t('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.overview?.products || []).map((p) => (
                      <tr key={p.productId} className="border-b border-gray-100">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{Math.round(p.stock)}</td>
                        <td className="px-4 py-2">
                          <span className={p.status === 'healthy' ? 'badge-green' : p.status === 'low_stock' ? 'badge-yellow' : 'badge-red'}>
                            {statusLabel(p.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">{t('allInventoryItemsHeading')}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">{t('colProductName')}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">{t('colStock')}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">{t('colUnitType')}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">{t('colStatus')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.overview?.allItems || []).map((item) => (
                      <tr key={item.productId} className="border-b border-gray-100">
                        <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.name}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{Math.round(item.stock)}</td>
                        <td className="px-4 py-2 text-sm text-gray-600 uppercase">{item.unitType}</td>
                        <td className="px-4 py-2">
                          <span className={item.status === 'healthy' ? 'badge-green' : item.status === 'low_stock' ? 'badge-yellow' : 'badge-red'}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'movements' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg">
          {!canEdit ? (
            <p className="text-gray-500 text-sm">{t('viewOnlyNotice')}</p>
          ) : (
            <div className="space-y-4">
              <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="input-field">
                <option value="">{t('selectProductOption')}</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder={t('quantityPlaceholder')}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="input-field"
                min="1"
              />
              <input
                type="text"
                placeholder={t('notesOptionalPlaceholder')}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field"
              />
              <div className="flex gap-3">
                <button onClick={() => submitMovement('in')} disabled={loading} className="flex-1 btn-primary">{t('stockInButton')}</button>
                <button onClick={() => submitMovement('out')} disabled={loading} className="flex-1 btn-secondary">{t('stockOutButton')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'manual-entry' && canEdit && (
        <div className="space-y-6">
          <form onSubmit={submitManualPastSale} className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg space-y-4">
            <p className="text-sm text-gray-500">{t('manualEntryDescription')}</p>
            <select value={manualForm.productId} onChange={(e) => setManualForm({ ...manualForm, productId: e.target.value })} className="input-field">
              <option value="">{t('selectProductOption')}</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder={t('quantitySoldPlaceholder')}
              value={manualForm.quantity}
              onChange={(e) => setManualForm({ ...manualForm, quantity: e.target.value })}
              className="input-field"
              min="1"
            />
            <input
              type="date"
              value={manualForm.manualEntryDate}
              onChange={(e) => setManualForm({ ...manualForm, manualEntryDate: e.target.value })}
              className="input-field"
            />
            <input
              type="text"
              placeholder={t('notesOptionalPlaceholder')}
              value={manualForm.notes}
              onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
              className="input-field"
            />
            <button type="submit" disabled={loading} className="btn-primary w-full">{t('saveHistoricalEntryButton')}</button>
          </form>

          {/* NEW: table listing every manual past-sale entry recorded so far */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('recordedHistoricalEntriesHeading')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colSaleDate')}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colProduct')}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colQuantity')}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colNotes')}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colLoggedOn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {manualEntries.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">{t('noHistoricalEntries')}</td>
                    </tr>
                  ) : (
                    manualEntries.map((entry) => (
                      <tr key={entry._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm text-gray-900 font-medium">
                          {formatDate(entry.manualEntryDate || entry.timestamp)}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">{entry.productId?.name || t('unknownProduct')}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{Math.round(entry.quantity)}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{entry.notes || '-'}</td>
                        <td className="px-6 py-3 text-sm text-gray-400">{formatDate(entry.createdAt || entry.timestamp)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}