import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import api from '../services/api';
import Icon from '../components/ui/Icons'; // adjust path to wherever your Icon.jsx lives

const PERIODS = [
  { value: '2days', label: '2 Days' },
  { value: '7days', label: '7 Days' },
  { value: '1week', label: '1 Week' },
  { value: '1month', label: '1 Month' },
  { value: '1year', label: '1 Year' },
];

const PIE_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

function formatCurrency(amount = 0) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount / 100);
}

const ACCENT_CLASSES = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  red: 'text-red-600',
  yellow: 'text-yellow-600',
};

function StatCard({ label, value, icon, accent = 'blue' }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-gray-500">{label}</p>
        <Icon name={icon} className={`w-5 h-5 ${ACCENT_CLASSES[accent] || ACCENT_CLASSES.blue}`} />
      </div>
      <p className={`text-2xl font-bold ${ACCENT_CLASSES[accent] || ACCENT_CLASSES.blue}`}>{value}</p>
    </div>
  );
}

// Custom legend: a colored dot + category name + amount, matching each
// slice's color from PIE_COLORS by index (same order the chart renders them).
function ExpenseLegend({ items }) {
  const total = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <ul className="space-y-2">
      {items.map((item, index) => {
        const percent = total > 0 ? Math.round((item.total / total) * 100) : 0;
        return (
          <li key={item.category} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
              />
              <span className="text-gray-700 truncate">{item.category}</span>
            </span>
            <span className="flex items-center gap-2 flex-shrink-0">
              <span className="text-gray-400 text-xs">{percent}%</span>
              <span className="font-medium text-gray-900">{formatCurrency(item.total)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ProfitBreakdownPanel({ breakdown }) {
  const [open, setOpen] = useState(false);
 
  if (!breakdown) return null;
 
  const {
    revenue,
    returnsValue,
    costOfGoodsSold,
    approvedExpenses,
    grossProfit,
    netProfit,
  } = breakdown;
 
  const isProfit = netProfit >= 0;
 
  const rows = [
    { label: 'Revenue', value: revenue, sign: '' },
    { label: 'Returns Value', value: returnsValue, sign: '−' },
    { label: 'Cost of Goods Sold', value: costOfGoodsSold, sign: '−' },
    { label: 'Gross Profit', value: grossProfit, sign: '=', emphasis: true },
    { label: 'Approved Expenses', value: approvedExpenses, sign: '−' },
    { label: isProfit ? 'Net Profit' : 'Net Loss', value: Math.abs(netProfit), sign: '=', emphasis: true },
  ];
 
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">How is profit/loss calculated?</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-gray-400" />
      </button>
 
      {open && (
        <div className="px-6 pb-6 space-y-1 border-t border-gray-100 pt-4">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between py-2 text-sm ${
                row.emphasis ? 'border-t border-gray-200 mt-1 pt-3 font-semibold text-gray-900' : 'text-gray-600'
              }`}
            >
              <span className="flex items-center gap-2">
                {row.sign && <span className="text-gray-400 w-3">{row.sign}</span>}
                {row.label}
              </span>
              <span>{formatCurrency(row.value)}</span>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-2">
            Returns Value is estimated using each product's current price, since returns don't record what the
            item sold for at the time. Cost of Goods Sold only reflects products that have a cost price set.
          </p>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ user }) {
  const isGm = user?.role === 'owner' || user?.role === 'general_manager';
  const isDriver = user?.role === 'driver';

  const [period, setPeriod] = useState('7days');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/summary', { params: { period } });
      setData(response.data.data);
      setError('');
    } catch (err) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1 capitalize">{user?.role?.replace('_', ' ')} overview</p>
        </div>

        {!isDriver && (
          <div className="flex gap-2 flex-wrap">
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
        )}
      </div>

      {isDriver && data && <DriverDashboard data={data} />}
      {!isDriver && isGm && data && <GmDashboard data={data} />}
      {!isDriver && !isGm && data && <ManagerDashboard data={data} />}
    </div>
  );
}

function DriverDashboard({ data }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard label="My Customers" value={data.customersCount} icon="customers" />
      <StatCard label="Products Sold (Week)" value={data.productsSold.week} icon="inventory" />
      <StatCard label="Products Sold (Month)" value={data.productsSold.month} icon="inventory" />
      <StatCard label="Products Sold (Year)" value={data.productsSold.year} icon="inventory" />
      <StatCard label="Distance Covered (Week)" value={`${data.distanceKm.week.toFixed(1)} km`} icon="truck" />
      <StatCard label="Distance Covered (Month)" value={`${data.distanceKm.month.toFixed(1)} km`} icon="truck" />
      <StatCard label="Distance Covered (Year)" value={`${data.distanceKm.year.toFixed(1)} km`} icon="truck" />
      <StatCard label="Returns" value={data.returnsCount} icon="returns" accent="red" />
    </div>
  );
}

function ManagerDashboard({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Today's Sales" value={formatCurrency(data.totalSalesToday)} icon="sales" />
        <StatCard label="Total Stock" value={data.totalStock} icon="inventory" />
        <StatCard label="Returns" value={data.returnsCount} icon="returns" accent="red" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales / Stock Trend</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.stockTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GmDashboard({ data }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Today's Sales" value={formatCurrency(data.totalSalesToday)} icon="sales" />
        <StatCard label="Total Stock" value={data.totalStock} icon="inventory" />
        <StatCard label="Profit (period)" value={formatCurrency(data.profit)} icon="trendingUp" accent="green" />
        <StatCard label="Loss (period)" value={formatCurrency(data.loss)} icon="trendingDown" accent="red" />
        <StatCard label="Total Expense" value={formatCurrency(data.totalExpense)} icon="expenses" />
        <StatCard label="Returns" value={data.returnsCount} icon="returns" accent="red" />
      </div>

      <ProfitBreakdownPanel breakdown={data.profitBreakdown} />

      {data.lowStockProducts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <Icon name="alertTriangle" className="w-4 h-4" /> Low stock alert
          </p>
          <div className="flex flex-wrap gap-2">
            {data.lowStockProducts.map((p) => (
              <span key={p.productId} className="badge-yellow">
                {p.name}: {p.currentStock} left
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Best Selling Products</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.bestSellers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="productName" type="category" tick={{ fontSize: 12 }} width={140} />
              <Tooltip />
              <Bar dataKey="unitsSold" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Stock Health by Product</h2>
          <div className="space-y-3">
            {data.stockHealthByProduct.map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.currentStock} in stock · {p.unitsSoldInPeriod} sold this period</p>
                </div>
                <span
                  className={
                    p.status === 'healthy' ? 'badge-green' : p.status === 'low_stock' ? 'badge-yellow' : 'badge-red'
                  }
                >
                  {p.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Expenses by Category</h2>
          {data.expensePieChart.length === 0 ? (
            <p className="text-gray-500 text-sm">No expenses recorded in this period.</p>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220} className="sm:flex-1">
                <PieChart>
                  <Pie
                    data={data.expensePieChart}
                    dataKey="total"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.expensePieChart.map((entry, index) => (
                      <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>

              <div className="w-full sm:w-48 sm:flex-shrink-0">
                <ExpenseLegend items={data.expensePieChart} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}