import { useState, useEffect, useCallback } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { formatCurrency } from '../utils/formatCurrency';
import { useLanguage } from '../context/LanguageContext';

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-blue-600">{value}</p>
    </div>
  );
}

function ExpenseOverview() {
  const { t } = useTranslation('expenses');
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
      const response = await api.get('/expenses/analytics', { params: { period } });
      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(err.message || t('messages.failedToLoadAnalytics'));
    } finally {
      setLoading(false);
    }
  }, [period, t]);

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

  const donutData = [
    { label: t('overview.totalSales'), value: data.totalSalesVsExpense.sales },
    { label: t('overview.totalExpenses'), value: data.totalSalesVsExpense.expenses },
  ];

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard label={t('overview.totalExpenses')} value={formatCurrency(data.totalExpense, language)} />
        <StatCard label={t('overview.profitMargin')} value={`${data.profitMarginPct.toFixed(2)}%`} />
        <StatCard label={t('overview.expenseTransactionCount')} value={data.expenseTransactionCount} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('overview.sumByExpenseType')}</h2>
          {data.byExpenseType.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('overview.noExpensesPeriod')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.byExpenseType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} height={70} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => formatCurrency(v, language)} />
                <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('overview.totalSalesVsExpenses')}</h2>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ResponsiveContainer width="100%" height={220} className="sm:flex-1">
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {donutData.map((entry, index) => (
                    <Cell key={entry.label} fill={index === 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v, language)} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-2 w-full sm:w-48 sm:flex-shrink-0">
              {donutData.map((item, index) => (
                <li key={item.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: index === 0 ? '#10B981' : '#EF4444' }} />
                    <span className="text-gray-700 truncate">{item.label}</span>
                  </span>
                  <span className="font-medium text-gray-900">{formatCurrency(item.value, language)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('overview.expenseTypeBreakdown')}</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('overview.colExpenseType')}</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">{t('overview.colTotalExpense')}</th>
              <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">{t('overview.colPercentOfTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {data.byExpenseType.length === 0 ? (
              <tr><td colSpan="3" className="px-6 py-8 text-center text-gray-500">{t('overview.noExpensesPeriodTable')}</td></tr>
            ) : (
              data.byExpenseType.map((row) => (
                <tr key={row.category} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.category}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 text-right">{formatCurrency(row.total, language)}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 text-right">{row.percentOfTotal.toFixed(1)}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Expenses({ user }) {
  const { t } = useTranslation('expenses');
  const { language } = useLanguage();

  const isGm = user?.role === 'owner' || user?.role === 'general_manager';
  const canApprove = ['owner', 'general_manager', 'manager'].includes(user?.role);

  const [tab, setTab] = useState('record');
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    category: '',
    amount: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [filterStatus]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/expenses/categories');
      setCategories(response.data.data);
    } catch (err) {
      console.error('Failed to load expense categories', err);
    }
  };

  const fetchExpenses = async () => {
    try {
      let query = {};
      if (filterStatus !== 'all') {
        query.status = filterStatus;
      }
      const response = await api.get('/expenses', { params: query });
      setExpenses(response.data.data);
    } catch (err) {
      setError(t('messages.failedToLoadExpenses'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/expenses', {
        category: form.category,
        amount: Math.round(parseFloat(form.amount) * 100),
        description: form.description,
      });

      const status = response.data.data.approvalStatus;
      setSuccess(t('messages.expenseRecordedStatus', { status: t(`status.${status}`, status) }));
      setForm({ category: '', amount: '', description: '' });
      fetchExpenses();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (expenseId) => {
    try {
      await api.put(`/expenses/${expenseId}/approve`);
      setSuccess(t('messages.expenseApproved'));
      fetchExpenses();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {['record', 'overview'].map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === tb ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tb === 'record' ? t('tabs.record') : t('tabs.overview')}
          </button>
        ))}
      </div>

      {tab === 'overview' && <ExpenseOverview />}

      {tab === 'record' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('recordExpense')}</h2>

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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.category')}</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">{t('form.selectCategory')}</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.amount')}</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="input-field"
                  required
                  min="0"
                  step="0.01"
                  placeholder={t('form.amountPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('form.description')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder={t('form.descriptionPlaceholder')}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary disabled:opacity-50"
              >
                {loading ? t('form.recording') : t('form.submit')}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">{t('expensesListTitle')}</h2>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1"
                >
                  <option value="all">{t('filter.all')}</option>
                  <option value="pending">{t('filter.pending')}</option>
                  <option value="approved">{t('filter.approved')}</option>
                </select>
              </div>

              <div className="space-y-3">
                {expenses.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">{t('noExpensesFound')}</p>
                ) : (
                  expenses.map(expense => (
                    <div key={expense._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-medium text-gray-900">{expense.category}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            expense.approvalStatus === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {t(`status.${expense.approvalStatus}`, expense.approvalStatus)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{expense.description}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(expense.timestamp).toLocaleDateString()}
                          {expense.recordedBy?.fullName && ` · ${t('recordedBy', { name: expense.recordedBy.fullName })}`}
                        </p>
                        {isGm && expense.approvalStatus === 'approved' && (
                          <p className="text-xs text-gray-400">
                            {t('approvedBy', { name: expense.approvedBy?.fullName || t('unknown') })}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900">
                          {formatCurrency(expense.amount, language)}
                        </p>
                        {expense.approvalStatus === 'pending' && canApprove && (
                          <button
                            onClick={() => handleApprove(expense._id)}
                            className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {t('approve')}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
