import { useState, useEffect } from 'react';
import api from '../services/api';
import { useStore } from '../context/StoreContext';

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
];

// NEW: this is the screen that solves the "who's supposed to get eggs
// today?" mix-up - three clear buckets (overdue, due today, upcoming) so
// nobody has to remember it from memory or a notebook.
function SupplySchedule() {
  const [schedule, setSchedule] = useState({ overdue: [], dueToday: [], upcoming: [] });
  const [customers, setCustomers] = useState([]);
  const [scheduleForm, setScheduleForm] = useState({ customerId: '', frequency: 'weekly', quantityPerSupply: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSchedule();
    fetchCustomers();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await api.get('/customers/supply-schedule');
      setSchedule(response.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get('/customers');
      setCustomers(response.data.data);
    } catch (err) {
      console.error('Failed to load customers', err);
    }
  };

  const handleSetSchedule = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      if (!scheduleForm.customerId) {
        setError('Select a customer');
        return;
      }
      await api.put(`/customers/${scheduleForm.customerId}/schedule`, {
        frequency: scheduleForm.frequency,
        quantityPerSupply: Number(scheduleForm.quantityPerSupply || 0),
      });
      setSuccess('Supply schedule set');
      setScheduleForm({ customerId: '', frequency: 'weekly', quantityPerSupply: '' });
      fetchSchedule();
    } catch (err) {
      setError(err.message);
    }
  };

  const markSupplied = async (customerId) => {
    setError('');
    setSuccess('');
    try {
      await api.post(`/customers/${customerId}/schedule/mark-supplied`);
      setSuccess('Marked as supplied - next date updated');
      fetchSchedule();
    } catch (err) {
      setError(err.message);
    }
  };

  const CustomerRow = ({ customer, tone }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{customer.name}</p>
        <p className="text-xs text-gray-500">
          {customer.location || 'No location set'} · {customer.supplySchedule.quantityPerSupply} crate(s) per supply
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={tone}>
          {new Date(customer.supplySchedule.nextSupplyDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
        </span>
        <button onClick={() => markSupplied(customer._id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          Mark Supplied
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      <form onSubmit={handleSetSchedule} className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <select className="input-field sm:col-span-2" value={scheduleForm.customerId} onChange={(e) => setScheduleForm({ ...scheduleForm, customerId: e.target.value })}>
          <option value="">Add customer to schedule...</option>
          {customers.map((c) => (
            <option key={c._id} value={c._id}>{c.name}</option>
          ))}
        </select>
        <select className="input-field" value={scheduleForm.frequency} onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}>
          {FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <input
          type="number"
          className="input-field"
          placeholder="Crates per supply"
          value={scheduleForm.quantityPerSupply}
          onChange={(e) => setScheduleForm({ ...scheduleForm, quantityPerSupply: e.target.value })}
          min="0"
        />
        <button type="submit" className="btn-primary sm:col-span-4">Add to Schedule</button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-red-200 p-6">
          <h3 className="font-semibold text-red-700 mb-1">⚠️ Overdue ({schedule.overdue.length})</h3>
          <p className="text-xs text-gray-400 mb-3">These were due before today and haven't been marked supplied</p>
          {schedule.overdue.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing overdue</p>
          ) : (
            schedule.overdue.map((c) => <CustomerRow key={c._id} customer={c} tone="badge-red" />)
          )}
        </div>

        <div className="bg-white rounded-lg border border-yellow-200 p-6">
          <h3 className="font-semibold text-yellow-700 mb-1">📅 Due Today ({schedule.dueToday.length})</h3>
          <p className="text-xs text-gray-400 mb-3">Supply these today</p>
          {schedule.dueToday.length === 0 ? (
            <p className="text-sm text-gray-400">Nobody due today</p>
          ) : (
            schedule.dueToday.map((c) => <CustomerRow key={c._id} customer={c} tone="badge-yellow" />)
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-700 mb-1">🔜 Upcoming ({schedule.upcoming.length})</h3>
          <p className="text-xs text-gray-400 mb-3">Scheduled for later</p>
          {schedule.upcoming.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing coming up</p>
          ) : (
            schedule.upcoming.map((c) => <CustomerRow key={c._id} customer={c} tone="badge-green" />)
          )}
        </div>
      </div>
    </div>
  );
}

export default function Customers({ user }) {
  const { activeStore } = useStore();
  const isFarm = activeStore?.type === 'farm';
  const isDriver = user?.role === 'driver';

  const [tab, setTab] = useState(isFarm ? 'schedule' : 'directory');
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
      setSuccess('Purchase recorded');
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
          {isFarm
            ? 'Manage customer supply schedules and delivery history'
            : isDriver
            ? 'Customers you have added'
            : 'All customers, purchases and token rewards'}
        </p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      {isFarm && (
        <div className="flex gap-2 border-b border-gray-200">
          {['schedule', 'directory'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'schedule' ? 'Supply Schedule' : 'Customer Directory'}
            </button>
          ))}
        </div>
      )}

      {isFarm && tab === 'schedule' ? (
        <SupplySchedule />
      ) : (
        <>
          {isDriver && !isFarm && (
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

          {isFarm && (
            <form onSubmit={handleAddCustomer} className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input className="input-field" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input-field" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input-field" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <button type="submit" disabled={loading} className="btn-primary">Add Customer</button>
            </form>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Location</th>
                  {!isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Sachet Bags (lifetime)</th>}
                  {!isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Bottles (lifetime)</th>}
                  {!isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tokens</th>}
                  {!isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Free Packs Earned</th>}
                  {isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">On Schedule?</th>}
                  {isDriver && !isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Redeem</th>}
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
                      {!isFarm && <td className="px-6 py-3 text-sm text-gray-600">{c.weeklySachetBags}</td>}
                      {!isFarm && <td className="px-6 py-3 text-sm text-gray-600">{c.weeklyBottles}</td>}
                      {!isFarm && <td className="px-6 py-3 text-sm font-semibold text-blue-600">{c.tokens - c.tokensRedeemed}</td>}
                      {!isFarm && <td className="px-6 py-3 text-sm text-gray-600">{c.freePacksEarned}</td>}
                      {isFarm && (
                        <td className="px-6 py-3">
                          <span className={c.supplySchedule?.isOnSchedule ? 'badge-green' : 'badge-yellow'}>
                            {c.supplySchedule?.isOnSchedule ? 'Yes' : 'Not scheduled'}
                          </span>
                        </td>
                      )}
                      {isDriver && !isFarm && (
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
        </>
      )}
    </div>
  );
}