import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import api from '../services/api';
import { formatCurrency } from '../utils/formatCurrency';
import { useLanguage } from '../context/LanguageContext';

const PIE_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-blue-600">{value}</p>
    </div>
  );
}

function SalesOverview() {
  const { t } = useTranslation('sales');
  const { language } = useLanguage();

  const PERIODS = [
    { value: '2days', label: t('overview.periods.2days') },
    { value: '7days', label: t('overview.periods.7days') },
    { value: '1month', label: t('overview.periods.1month') },
    { value: '1year', label: t('overview.periods.1year') },
  ];

  const [period, setPeriod] = useState('7days');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/sales/analytics', { params: { period } });
      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(err.message || t('errors.loadAnalytics'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              period === p.value ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label={t('overview.stats.totalSales')} value={formatCurrency(data.totalSales, language)} />
        <StatCard label={t('overview.stats.totalProfit')} value={formatCurrency(data.totalProfit, language)} />
        <StatCard label={t('overview.stats.totalCost')} value={formatCurrency(data.totalCost, language)} />
        <StatCard label={t('overview.stats.avgSaleValue')} value={formatCurrency(data.avgSaleValue, language)} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('overview.charts.salesTrend')}</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data.salesTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => formatCurrency(v, language)} />
            <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('overview.charts.topSelling')}</h2>
          {data.topSellingProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('overview.noSalesInPeriod')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.topSellingProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="productName" type="category" tick={{ fontSize: 12 }} width={140} />
                <Tooltip />
                <Bar dataKey="unitsSold" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('overview.charts.bottomSelling')}</h2>
          {data.bottomSellingProducts.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('overview.noSalesInPeriod')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.bottomSellingProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="productName" type="category" tick={{ fontSize: 12 }} width={140} />
                <Tooltip />
                <Bar dataKey="unitsSold" fill="#EF4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('overview.charts.transactionCount')}</h2>
          {data.transactionCountByProduct.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('overview.noSalesInPeriod')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.transactionCountByProduct} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis dataKey="productName" type="category" tick={{ fontSize: 12 }} width={140} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('overview.charts.revenueByCategory')}</h2>
          {data.revenueByCategory.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('overview.noSalesInPeriod')}</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220} className="sm:flex-1">
                <PieChart>
                  <Pie
                    data={data.revenueByCategory}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.revenueByCategory.map((entry, index) => (
                      <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v, language)} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 w-full sm:w-48 sm:flex-shrink-0">
                {data.revenueByCategory.map((item, index) => (
                  <li key={item.category} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="text-gray-700 truncate">{item.category}</span>
                    </span>
                    <span className="font-medium text-gray-900">{formatCurrency(item.total, language)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Sales({ user }) {
  const { t } = useTranslation('sales');
  const { language } = useLanguage();
  const isGm = user?.role === 'owner' || user?.role === 'general_manager';
  const [tab, setTab] = useState('record');

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
      setError(t('errors.loadProducts'));
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
        setError(t('errors.addItem'));
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

      setSuccess(t('success.saleRecorded'));
      setItems([{ productId: '', quantity: 0, pricePerUnit: 0 }]);
      setPaymentMethod('cash');
      fetchProducts();
      fetchSales();
    } catch (err) {
      setError(err.message || t('errors.recordSale'));
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

      <div className="flex gap-2 border-b border-gray-200">
        {['record', 'overview'].map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === tabKey ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tabKey === 'record' ? t('tabs.record') : t('tabs.overview')}
          </button>
        ))}
      </div>

      {tab === 'overview' && <SalesOverview />}

      {tab === 'record' && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('newSale')}</h2>

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
                  <div key={index} className="flex flex-wrap sm:flex-nowrap gap-3 items-center">
                    <select
                      value={item.productId}
                      onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                      className="input-field w-full sm:flex-1"
                    >
                      <option value="">{t('form.selectProduct')}</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({t('form.stockLabel', { count: Math.round(p.currentStock) })})
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder={t('form.qtyPlaceholder')}
                      value={item.quantity || ''}
                      onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      className="input-field flex-1 sm:flex-none sm:w-20"
                      min="0"
                    />

                    <input
                      type="number"
                      placeholder={t('form.pricePlaceholder')}
                      value={item.pricePerUnit || ''}
                      onChange={(e) => handleItemChange(index, 'pricePerUnit', e.target.value)}
                      className="input-field flex-1 sm:flex-none sm:w-28"
                      min="0"
                      step="0.01"
                      disabled={!isGm}
                      title={!isGm ? t('form.priceLockedTitle') : t('form.priceOverrideTitle')}
                    />

                    <button type="button" onClick={() => removeItem(index)} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition flex-shrink-0">
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {!isGm && (
                <p className="text-xs text-gray-400">{t('form.priceLockedNote')}</p>
              )}

              <button type="button" onClick={addItem} className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition">
                {t('form.addItem')}
              </button>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.paymentMethod')}</label>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="input-field">
                  <option value="cash">{t('form.paymentOptions.cash')}</option>
                  <option value="transfer">{t('form.paymentOptions.transfer')}</option>
                  <option value="card">{t('form.paymentOptions.card')}</option>
                </select>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-lg font-semibold text-gray-900">{t('form.total')}</span>
                  <span className="text-2xl font-bold text-blue-600">{formatCurrency(Math.round(total * 100), language)}</span>
                </div>
                <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
                  {loading ? t('form.recording') : t('form.recordSale')}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{t('recentSales.heading')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('recentSales.colDate')}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('recentSales.colProducts')}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('recentSales.colPayment')}</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('recentSales.colRecordedBy')}</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">{t('recentSales.colTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-gray-500">{t('recentSales.empty')}</td>
                    </tr>
                  ) : (
                    sales.map((sale) => (
                      <tr key={sale._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-3 text-gray-600 text-sm">{new Date(sale.timestamp).toLocaleString('en-NG')}</td>
                        <td className="px-6 py-3 text-sm text-gray-900">
                          {sale.items.map((i) => `${i.productName} x${Math.round(i.quantity)}`).join(', ')}
                        </td>
                        <td className="px-6 py-3">
                          <span className="badge-blue capitalize">{sale.paymentMethod}</span>
                        </td>
                        <td className="px-6 py-3 text-sm text-gray-600">{sale.recordedBy?.fullName || '-'}</td>
                        <td className="px-6 py-3 text-right font-semibold text-gray-900">{formatCurrency(sale.totalAmount, language)}</td>
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
