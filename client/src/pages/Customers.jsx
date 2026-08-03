import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useStore } from '../context/StoreContext';

// NEW: this is the screen that solves the "who's supposed to get eggs
// today?" mix-up - three clear buckets (overdue, due today, upcoming) so
// nobody has to remember it from memory or a notebook.
function SupplySchedule() {
  const { t } = useTranslation('customers');

  const FREQUENCIES = [
    { value: 'daily', label: t('schedule.frequencies.daily') },
    { value: 'weekly', label: t('schedule.frequencies.weekly') },
    { value: 'biweekly', label: t('schedule.frequencies.biweekly') },
    { value: 'monthly', label: t('schedule.frequencies.monthly') },
  ];

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
        setError(t('errors.selectCustomer'));
        return;
      }
      await api.put(`/customers/${scheduleForm.customerId}/schedule`, {
        frequency: scheduleForm.frequency,
        quantityPerSupply: Number(scheduleForm.quantityPerSupply || 0),
      });
      setSuccess(t('success.scheduleSet'));
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
      setSuccess(t('success.markedSupplied'));
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
          {customer.location || t('schedule.noLocationSet')} · {Math.round(customer.supplySchedule.quantityPerSupply)} {t('schedule.cratesPerSupply')}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={tone}>
          {new Date(customer.supplySchedule.nextSupplyDate).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
        </span>
        <button onClick={() => markSupplied(customer._id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
          {t('schedule.markSupplied')}
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
          <option value="">{t('schedule.addCustomerOption')}</option>
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
          placeholder={t('schedule.cratesPerSupplyPlaceholder')}
          value={scheduleForm.quantityPerSupply}
          onChange={(e) => setScheduleForm({ ...scheduleForm, quantityPerSupply: e.target.value })}
          min="0"
        />
        <button type="submit" className="btn-primary sm:col-span-4">{t('schedule.addToSchedule')}</button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-red-200 p-6">
          <h3 className="font-semibold text-red-700 mb-1">⚠️ {t('schedule.overdue.heading', { count: schedule.overdue.length })}</h3>
          <p className="text-xs text-gray-400 mb-3">{t('schedule.overdue.description')}</p>
          {schedule.overdue.length === 0 ? (
            <p className="text-sm text-gray-400">{t('schedule.overdue.empty')}</p>
          ) : (
            schedule.overdue.map((c) => <CustomerRow key={c._id} customer={c} tone="badge-red" />)
          )}
        </div>

        <div className="bg-white rounded-lg border border-yellow-200 p-6">
          <h3 className="font-semibold text-yellow-700 mb-1">📅 {t('schedule.dueToday.heading', { count: schedule.dueToday.length })}</h3>
          <p className="text-xs text-gray-400 mb-3">{t('schedule.dueToday.description')}</p>
          {schedule.dueToday.length === 0 ? (
            <p className="text-sm text-gray-400">{t('schedule.dueToday.empty')}</p>
          ) : (
            schedule.dueToday.map((c) => <CustomerRow key={c._id} customer={c} tone="badge-yellow" />)
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-700 mb-1">🔜 {t('schedule.upcoming.heading', { count: schedule.upcoming.length })}</h3>
          <p className="text-xs text-gray-400 mb-3">{t('schedule.upcoming.description')}</p>
          {schedule.upcoming.length === 0 ? (
            <p className="text-sm text-gray-400">{t('schedule.upcoming.empty')}</p>
          ) : (
            schedule.upcoming.map((c) => <CustomerRow key={c._id} customer={c} tone="badge-green" />)
          )}
        </div>
      </div>
    </div>
  );
}

export default function Customers({ user }) {
  const { t } = useTranslation('customers');
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
        setError(t('errors.nameRequired'));
        setLoading(false);
        return;
      }
      await api.post('/customers', form);
      setSuccess(t('success.customerAdded'));
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
        setError(t('errors.selectCustomerProductQuantity'));
        setLoading(false);
        return;
      }
      await api.post(`/customers/${purchaseForm.customerId}/purchases`, {
        productName: purchaseForm.productName,
        quantity: Number(purchaseForm.quantity),
      });
      setSuccess(t('success.purchaseRecorded'));
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
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">
          {isFarm
            ? t('subtitle.farm')
            : isDriver
            ? t('subtitle.driver')
            : t('subtitle.default')}
        </p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      {isFarm && (
        <div className="flex gap-2 border-b border-gray-200">
          {['schedule', 'directory'].map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setTab(tabKey)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === tabKey ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tabKey === 'schedule' ? t('tabs.schedule') : t('tabs.directory')}
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
                <h2 className="text-lg font-semibold text-gray-900">{t('form.addCustomer')}</h2>
                <input className="input-field" placeholder={t('form.namePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <input className="input-field" placeholder={t('form.phonePlaceholder')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <input className="input-field" placeholder={t('form.locationPlaceholder')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                <button type="submit" disabled={loading} className="btn-primary w-full">{t('form.addCustomer')}</button>
              </form>

              <form onSubmit={handleRecordPurchase} className="bg-white rounded-lg border border-gray-200 p-6 space-y-3">
                <h2 className="text-lg font-semibold text-gray-900">{t('form.recordDeliveryPurchase')}</h2>
                <select className="input-field" value={purchaseForm.customerId} onChange={(e) => setPurchaseForm({ ...purchaseForm, customerId: e.target.value })}>
                  <option value="">{t('form.selectCustomer')}</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
                <input
                  className="input-field"
                  placeholder={t('form.productPlaceholder')}
                  value={purchaseForm.productName}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, productName: e.target.value })}
                />
                <input
                  type="number"
                  className="input-field"
                  placeholder={t('form.quantityPlaceholder')}
                  value={purchaseForm.quantity}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })}
                  min="1"
                />
                <button type="submit" disabled={loading} className="btn-primary w-full">{t('form.recordPurchase')}</button>
              </form>
            </div>
          )}

          {isFarm && (
            <form onSubmit={handleAddCustomer} className="bg-white rounded-lg border border-gray-200 p-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input className="input-field" placeholder={t('form.namePlaceholder')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input-field" placeholder={t('form.phonePlaceholder')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input-field" placeholder={t('form.locationPlaceholder')} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              <button type="submit" disabled={loading} className="btn-primary">{t('form.addCustomer')}</button>
            </form>
          )}

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.name')}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.location')}</th>
                    {!isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.sachetBagsLifetime')}</th>}
                    {!isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.bottlesLifetime')}</th>}
                    {!isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.tokens')}</th>}
                    {!isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.freePacksEarned')}</th>}
                    {isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.onSchedule')}</th>}
                    {isDriver && !isFarm && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('table.redeem')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {customers.length === 0 ? (
                    <tr><td colSpan="7" className="px-6 py-8 text-center text-gray-500">{t('table.noCustomersYet')}</td></tr>
                  ) : (
                    customers.map((c) => (
                      <tr key={c._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-3 font-medium text-gray-900">{c.name}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{c.location || '-'}</td>
                        {!isFarm && <td className="px-6 py-3 text-sm text-gray-600">{Math.round(c.weeklySachetBags)}</td>}
                        {!isFarm && <td className="px-6 py-3 text-sm text-gray-600">{Math.round(c.weeklyBottles)}</td>}
                        {!isFarm && <td className="px-6 py-3 text-sm font-semibold text-blue-600">{Math.round(c.tokens - c.tokensRedeemed)}</td>}
                        {!isFarm && <td className="px-6 py-3 text-sm text-gray-600">{c.freePacksEarned}</td>}
                        {isFarm && (
                          <td className="px-6 py-3">
                            <span className={c.supplySchedule?.isOnSchedule ? 'badge-green' : 'badge-yellow'}>
                              {c.supplySchedule?.isOnSchedule ? t('table.scheduledYes') : t('table.notScheduled')}
                            </span>
                          </td>
                        )}
                        {isDriver && !isFarm && (
                          <td className="px-6 py-3">
                            <button onClick={() => handleRedeem(c._id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                              {t('table.redeem')}
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
        </>
      )}
    </div>
  );
}