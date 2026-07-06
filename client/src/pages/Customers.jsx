import { useState, useEffect } from 'react';
import api from '../services/api';

export default function Customers({ user }) {
  const isDriver = user?.role === 'driver';
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ name: '', phone: '', location: '' });
  const [purchaseForm, setPurchaseForm] = useState({ customerId: '', productName: '', quantity: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers');
      setCustomers(response.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddCustomer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!form.name) {
        setError('Customer name is required');
        setLoading(false);
        return;
      }
      await api.post('/customers', form);
      setSuccess('Customer added');
      setForm({ name: '', phone: '', location: '' });
      fetchCustomers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordPurchase = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      if (!purchaseForm.customerId || !purchaseForm.productName || !purchaseForm.quantity) {
        setError('Select a customer, product name and quantity');
        setLoading(false);
        return;
      }
      await api.post(`/customers/${purchaseForm.customerId}/purchases`, {
        productName: purchaseForm.productName,
        quantity: Number(purchaseForm.quantity),
      });
      setSuccess('Purchase recorded, tokens updated');
      setPurchaseForm({ customerId: '', productName: '', quantity: '' });
      fetchCustomers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (customerId) => {
    try {
      await api.post(`/customers/${customerId}/redeem`);
      fetchCustomers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-500 mt-1">
          {isDriver ? 'Customers you have added' : 'All customers, purchases and token rewards'}
        </p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      {isDriver && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleAddCustomer} className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Add Customer</h2>
            <input className="input-field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input-field" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input-field" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <button type="submit" disabled={loading} className="btn-primary w-full">Add Customer</button>
          </form>

          <form onSubmit={handleRecordPurchase} className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Record a Delivery / Purchase</h2>
            <select className="input-field" value={purchaseForm.customerId} onChange={(e) => setPurchaseForm({ ...purchaseForm, customerId: e.target.value })}>
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            <input
              className="input-field"
              placeholder="Product (e.g. Sachet Water Bag)"
              value={purchaseForm.productName}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, productName: e.target.value })}
            />
            <input
              type="number"
              className="input-field"
              placeholder="Quantity"
              value={purchaseForm.quantity}
              onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
              min="1"
            />
            <button type="submit" disabled={loading} className="btn-primary w-full">Record Purchase</button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Location</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sachet Bags (lifetime)</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Bottles (lifetime)</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tokens</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Free Packs Earned</th>
              {isDriver && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Redeem</th>}
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">No customers yet</td></tr>
            ) : (
              customers.map((c) => (
                <tr key={c._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.location || '-'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.weeklySachetBags}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.weeklyBottles}</td>
                  <td className="px-6 py-3 text-sm font-semibold text-blue-600">{c.tokens - c.tokensRedeemed}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{c.freePacksEarned}</td>
                  {isDriver && (
                    <td className="px-6 py-3">
                      <button onClick={() => handleRedeem(c._id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        Redeem
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
