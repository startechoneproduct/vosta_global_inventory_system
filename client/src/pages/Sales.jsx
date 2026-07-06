import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Sales({ user }) {
  const isGm = user?.role === 'owner' || user?.role === 'general_manager';

  const [products, setProducts] = useState([]);
  const [items, setItems] = useState([{ productId: '', quantity: 0, pricePerUnit: 0 }]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sales, setSales] = useState([]);

  useEffect(() => {
    fetchProducts();
    fetchSales();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/stock/products');
      setProducts(response.data.data);
    } catch (err) {
      setError('Failed to load products');
    }
  };

  const fetchSales = async () => {
    try {
      const response = await api.get('/sales');
      setSales(response.data.data);
    } catch (err) {
      console.error('Failed to fetch sales:', err);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = field === 'productId' ? value : parseFloat(value) || 0;

    if (field === 'productId' && value) {
      const product = products.find((p) => p._id === value);
      if (product) newItems[index].pricePerUnit = product.pricePerUnit / 100;
    }

    setItems(newItems);
  };

  const addItem = () => setItems([...items, { productId: '', quantity: 0, pricePerUnit: 0 }]);
  const removeItem = (index) => setItems(items.filter((_, i) => i !== index));

  const total = items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const validItems = items.filter((item) => item.productId && item.quantity > 0);
      if (validItems.length === 0) {
        setError('Add at least one item to the sale');
        setLoading(false);
        return;
      }

      await api.post('/sales', {
        items: validItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          // Only GM/Owner price overrides are honoured server-side; the
          // catalog price is used for everyone else regardless of this value.
          pricePerUnit: Math.round(item.pricePerUnit * 100),
        })),
        paymentMethod,
      });

      setSuccess('Sale recorded successfully!');
      setItems([{ productId: '', quantity: 0, pricePerUnit: 0 }]);
      setPaymentMethod('cash');
      fetchProducts();
      fetchSales();
    } catch (err) {
      setError(err.message || 'Failed to record sale');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  const formatCurrencyFromKobo = (amount) => formatCurrency((amount || 0) / 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sales</h1>
        <p className="text-gray-500 mt-1">Record sales transactions</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">New Sale</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={index} className="flex gap-3 items-center">
                <select
                  value={item.productId}
                  onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                  className="input-field flex-1"
                >
                  <option value="">Select Product</option>
                  {products.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} (Stock: {p.currentStock})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="Qty"
                  value={item.quantity || ''}
                  onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                  className="input-field w-20"
                  min="0"
                />

                <input
                  type="number"
                  placeholder="Price"
                  value={item.pricePerUnit || ''}
                  onChange={(e) => handleItemChange(index, 'pricePerUnit', e.target.value)}
                  className="input-field w-28"
                  min="0"
                  step="0.01"
                  disabled={!isGm}
                  title={!isGm ? 'Only the General Manager can change price (audit locked)' : 'Override price'}
                />

                <button type="button" onClick={() => removeItem(index)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition">
                  ✕
                </button>
              </div>
            ))}
          </div>

          {!isGm && (
            <p className="text-xs text-gray-400">🔒 Price fields are locked. Only the General Manager can override product prices.</p>
          )}

          <button type="button" onClick={addItem} className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition">
            + Add Item
          </button>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-field">
              <option value="cash">Cash</option>
              <option value="transfer">Bank Transfer</option>
              <option value="card">Card</option>
            </select>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-900">Total:</span>
              <span className="text-2xl font-bold text-blue-600">{formatCurrency(total)}</span>
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
              {loading ? 'Recording...' : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Sales</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Product(s)</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Payment</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Recorded By</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-gray-500">No sales recorded yet</td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-6 py-3 text-gray-600 text-sm">{new Date(sale.timestamp).toLocaleString('en-NG')}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">
                      {sale.items.map((i) => `${i.productName} x${i.quantity}`).join(', ')}
                    </td>
                    <td className="px-6 py-3">
                      <span className="badge-blue capitalize">{sale.paymentMethod}</span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">{sale.recordedBy?.fullName || '-'}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCurrencyFromKobo(sale.totalAmount)}</td>
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
