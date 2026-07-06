import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Returns() {
  const [products, setProducts] = useState([]);
  const [returns, setReturns] = useState([]);
  const [form, setForm] = useState({ productId: '', quantity: '', reason: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchReturns();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/stock/products');
      setProducts(response.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchReturns = async () => {
    try {
      const response = await api.get('/returns');
      setReturns(response.data.data);
    } catch (err) {
      console.error('Failed to load returns', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!form.productId || !form.quantity) {
        setError('Select a product and enter a quantity');
        setLoading(false);
        return;
      }
      await api.post('/returns', { productId: form.productId, quantity: Number(form.quantity), reason: form.reason });
      setSuccess('Return recorded and stock updated');
      setForm({ productId: '', quantity: '', reason: '' });
      fetchProducts();
      fetchReturns();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Returns</h1>
        <p className="text-gray-500 mt-1">Record product returns</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 max-w-lg space-y-4">
        <select className="input-field" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
          <option value="">Select Product</option>
          {products.map((p) => (
            <option key={p._id} value={p._id}>{p.name}</option>
          ))}
        </select>
        <input
          type="number"
          className="input-field"
          placeholder="Quantity"
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          min="1"
        />
        <input
          type="text"
          className="input-field"
          placeholder="Reason (optional)"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
        <button type="submit" disabled={loading} className="btn-primary w-full">Record Return</button>
      </form>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Returns</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Qty</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reason</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Recorded By</th>
            </tr>
          </thead>
          <tbody>
            {returns.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No returns recorded yet</td></tr>
            ) : (
              returns.map((r) => (
                <tr key={r._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">{new Date(r.timestamp).toLocaleString('en-NG')}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{r.productName}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{r.quantity}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{r.reason || '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{r.recordedBy?.fullName || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
