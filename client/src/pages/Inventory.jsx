import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Inventory({ user }) {
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
      setError('Failed to load products');
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
        setError('Select a product and enter a quantity');
        setLoading(false);
        return;
      }
      await api.post(`/stock/${direction}`, { productId: form.productId, quantity: Number(form.quantity), notes: form.notes });
      setSuccess(`Stock ${direction === 'in' ? 'added' : 'removed'} successfully`);
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
        setError('Select a product, quantity and date');
        setLoading(false);
        return;
      }
      await api.post('/stock/manual-past-sale', {
        productId: manualForm.productId,
        quantity: Number(manualForm.quantity),
        manualEntryDate: manualForm.manualEntryDate,
        notes: manualForm.notes,
      });
      setSuccess('Historical sale recorded');
      setManualForm({ productId: '', quantity: '', manualEntryDate: '', notes: '' });
      fetchManualEntries();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-500 mt-1">Manage stock levels and products{!canEdit && ' (view only)'}</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      <div className="flex gap-2 border-b border-gray-200">
        {['overview', 'movements', ...(canEdit ? ['manual-entry'] : [])].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'overview' ? 'Overview & Analytics' : t === 'movements' ? 'Stock In / Out' : 'Manual Past-Sale Entry'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          {analytics && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Total Units in Stock</p>
                <p className="text-2xl font-bold text-blue-600">{analytics.totalUnits}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Healthy Products</p>
                <p className="text-2xl font-bold text-green-600">{analytics.byStatus.healthy}</p>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <p className="text-sm text-gray-500">Low / Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{analytics.byStatus.low_stock + analytics.byStatus.out_of_stock}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Stock</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Threshold</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const status = p.currentStock <= 0 ? 'out_of_stock' : p.currentStock <= p.minThreshold ? 'low_stock' : 'healthy';
                  return (
                    <tr key={p._id} className="border-b border-gray-100">
                      <td className="px-6 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-3 text-gray-600">{p.currentStock} {p.unitName}(s)</td>
                      <td className="px-6 py-3 text-gray-600">{p.minThreshold}</td>
                      <td className="px-6 py-3">
                        <span className={status === 'healthy' ? 'badge-green' : status === 'low_stock' ? 'badge-yellow' : 'badge-red'}>
                          {status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'movements' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg">
          {!canEdit ? (
            <p className="text-gray-500 text-sm">Your role has view-only access to inventory. Contact the General Manager or Accountant for stock changes.</p>
          ) : (
            <div className="space-y-4">
              <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="input-field">
                <option value="">Select Product</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Quantity"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="input-field"
                min="1"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field"
              />
              <div className="flex gap-3">
                <button onClick={() => submitMovement('in')} disabled={loading} className="flex-1 btn-primary">Stock In</button>
                <button onClick={() => submitMovement('out')} disabled={loading} className="flex-1 btn-secondary">Stock Out</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'manual-entry' && canEdit && (
        <div className="space-y-6">
          <form onSubmit={submitManualPastSale} className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg space-y-4">
            <p className="text-sm text-gray-500">Back-fill a historical sale that happened before this system was in use.</p>
            <select value={manualForm.productId} onChange={(e) => setManualForm({ ...manualForm, productId: e.target.value })} className="input-field">
              <option value="">Select Product</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Quantity sold"
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
              placeholder="Notes (optional)"
              value={manualForm.notes}
              onChange={(e) => setManualForm({ ...manualForm, notes: e.target.value })}
              className="input-field"
            />
            <button type="submit" disabled={loading} className="btn-primary w-full">Save Historical Entry</button>
          </form>

          {/* NEW: table listing every manual past-sale entry recorded so far */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Recorded Historical Entries</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sale Date</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Quantity</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Notes</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Logged On</th>
                  </tr>
                </thead>
                <tbody>
                  {manualEntries.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No historical entries recorded yet</td>
                    </tr>
                  ) : (
                    manualEntries.map((entry) => (
                      <tr key={entry._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm text-gray-900 font-medium">
                          {formatDate(entry.manualEntryDate || entry.timestamp)}
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">{entry.productId?.name || 'Unknown product'}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{entry.quantity}</td>
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