import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import api from '../services/api';
import Icon from '../components/ui/Icons'; // adjust path to wherever your Icon.jsx lives
import { formatCurrency } from '../utils/formatCurrency';
import { useLanguage } from '../context/LanguageContext';

const PIE_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

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


function ExpenseLegend({ items }) {
  const { language } = useLanguage();
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
              <span className="font-medium text-gray-900">{formatCurrency(item.total, language)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}


function ProfitBreakdownPanel({ breakdown }) {
  const [open, setOpen] = useState(false);

  const { t } = useTranslation('dashboard');
  const { language } = useLanguage();

  if (!breakdown) return null;

  const {
    revenue,
    writeOffValue,
    writeOffLabel,
    costOfGoodsSold,
    approvedExpenses,
    grossProfit,
    netProfit,
  } = breakdown;

  const isProfit = netProfit >= 0;

  const rows = [
    { label: t('profitBreakdown.revenue'), value: revenue, sign: '' },
    // writeOffLabel comes from the API (backend/src/utils/analytics.js) and is
    // not translated here; the fallback below is our own UI copy.
    { label: writeOffLabel || t('profitBreakdown.returnsValue'), value: writeOffValue, sign: '−' },
    { label: t('profitBreakdown.costOfGoodsSold'), value: costOfGoodsSold, sign: '−' },
    { label: t('profitBreakdown.grossProfit'), value: grossProfit, sign: '=', emphasis: true },
    { label: t('profitBreakdown.approvedExpenses'), value: approvedExpenses, sign: '−' },
    { label: isProfit ? t('profitBreakdown.netProfit') : t('profitBreakdown.netLoss'), value: Math.abs(netProfit), sign: '=', emphasis: true },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700">{t('profitBreakdown.toggle')}</span>
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
              <span>{formatCurrency(row.value, language)}</span>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-2">
            {writeOffLabel === 'Damaged Stock (Write-Off)'
              ? t('profitBreakdown.damagedStockNote')
              : t('profitBreakdown.returnsValueNote')}
            {' '}{t('profitBreakdown.cogsNote')}
          </p>
        </div>
      )}
    </div>
  );
}

// Stock/production quantities are stored as exact decimals internally (a
// batch rarely consumes/produces a whole number of bags/bundles/rolls/packs),
// but the dashboard only ever needs to show an at-a-glance whole number -
// round for display only, never for the underlying stock math.
function roundDisplay(n) {
  return Math.round(n);
}

function InventorySummaryPanel({ data }) {
  const { t } = useTranslation('dashboard');
  if (!data) return null;
  const { stockInUnits, stockOutUnits, stockOutRatePct, lowStockCount, turnover } = data;

  const tiles = [
    { label: t('inventorySummary.stockIn'), value: roundDisplay(stockInUnits).toLocaleString() },
    { label: t('inventorySummary.stockOut'), value: roundDisplay(stockOutUnits).toLocaleString() },
    { label: t('inventorySummary.stockOutRate'), value: `${stockOutRatePct.toFixed(2)}%` },
    { label: t('inventorySummary.lowStockItems'), value: lowStockCount },
    { label: t('inventorySummary.inventoryTurnover'), value: turnover.toFixed(2) },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('inventorySummary.title')}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="border border-gray-100 rounded-lg p-3">
            <p className="text-xs text-gray-500">{tile.label}</p>
            <p className="text-xl font-bold text-gray-900">{tile.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductionPanel({ data }) {
  const { t } = useTranslation('dashboard');
  if (!data) return null;
  const { rawMaterials, bottled, sachet } = data;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">{t('production.title')}</h2>

      {rawMaterials.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {rawMaterials.map((m) => (
            <div key={m.materialKey} className="border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500 truncate">{m.name}</p>
              <p className="text-lg font-bold text-gray-900">
                {roundDisplay(m.currentStockPurchaseUnits)} <span className="text-xs font-normal text-gray-500">{m.purchaseUnitName}(s)</span>
              </p>
              <p className="text-xs text-gray-400">{roundDisplay(m.currentStockPieces).toLocaleString()} {t('production.pcs')}</p>
              {m.lowStock && <span className="text-xs font-semibold text-red-600">{t('production.lowStock')}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <p className="text-sm font-medium text-gray-700">{t('production.bottledWaterPeriod')}</p>
          <p className="text-sm text-gray-600">
            {roundDisplay(bottled.packsProducedPeriod)} {t('production.packs')} · {bottled.bottlesProducedPeriod} {t('production.bottles')}
            {bottled.preformLeakageCountPeriod > 0 && (
              <span className="text-red-600"> · {bottled.preformLeakageCountPeriod} {t('production.preformsLeaked')}</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">{t('production.sachetWaterPeriod')}</p>
          <p className="text-sm text-gray-600">
            {roundDisplay(sachet.bagsProducedPeriod)} {t('production.bags')} · {sachet.sachetsProducedPeriod} {t('production.sachets')}
            {sachet.sachetLeakageCountPeriod > 0 && (
              <span className="text-red-600"> · {sachet.sachetLeakageCountPeriod} {t('production.sachetsLeaked')}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ user }) {
  const { t } = useTranslation('dashboard');

  const PERIODS = [
    { value: '2days', label: t('periods.twoDays') },
    { value: '7days', label: t('periods.sevenDays') },
    { value: '1week', label: t('periods.oneWeek') },
    { value: '1month', label: t('periods.oneMonth') },
    { value: '1year', label: t('periods.oneYear') },
  ];

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
      setError(err.message || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [period, t]);

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
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 mt-1 capitalize">{user?.role?.replace('_', ' ')} {t('roleOverviewSuffix')}</p>
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
  const { t } = useTranslation('dashboard');
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard label={t('driver.myCustomers')} value={data.customersCount} icon="customers" />
      <StatCard label={t('driver.productsSoldWeek')} value={data.productsSold.week} icon="inventory" />
      <StatCard label={t('driver.productsSoldMonth')} value={data.productsSold.month} icon="inventory" />
      <StatCard label={t('driver.productsSoldYear')} value={data.productsSold.year} icon="inventory" />
      <StatCard label={t('driver.distanceCoveredWeek')} value={`${data.distanceKm.week.toFixed(1)} km`} icon="truck" />
      <StatCard label={t('driver.distanceCoveredMonth')} value={`${data.distanceKm.month.toFixed(1)} km`} icon="truck" />
      <StatCard label={t('driver.distanceCoveredYear')} value={`${data.distanceKm.year.toFixed(1)} km`} icon="truck" />
      <StatCard label={t('driver.returns')} value={data.returnsCount} icon="returns" accent="red" />
    </div>
  );
}

function ManagerDashboard({ data }) {
  const { t } = useTranslation('dashboard');
  const { language } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label={t('stats.todaysSales')} value={formatCurrency(data.totalSalesToday, language)} icon="sales" />
        <StatCard label={t('stats.totalStock')} value={roundDisplay(data.totalStock).toLocaleString()} icon="inventory" />
        <StatCard
          label={data.storeType === 'farm' ? t('stats.damagedEggs') : t('stats.returns')}
          value={data.returnsCount}
          icon="returns"
          accent="red"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('charts.salesStockTrend')}</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.stockTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => formatCurrency(v, language)} />
            <Line type="monotone" dataKey="total" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <InventorySummaryPanel data={data.inventoryOverview} />

      {data.storeType === 'fountain' && data.productionSummary && <ProductionPanel data={data.productionSummary} />}
    </div>
  );
}

function GmDashboard({ data }) {
  const { t } = useTranslation('dashboard');
  const { language } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label={t('stats.todaysSales')} value={formatCurrency(data.totalSalesToday, language)} icon="sales" />
        <StatCard label={t('stats.totalStock')} value={roundDisplay(data.totalStock).toLocaleString()} icon="inventory" />
        <StatCard label={t('stats.profitPeriod')} value={formatCurrency(data.profit, language)} icon="trendingUp" accent="green" />
        <StatCard label={t('stats.lossPeriod')} value={formatCurrency(data.loss, language)} icon="trendingDown" accent="red" />
        <StatCard label={t('stats.totalExpense')} value={formatCurrency(data.totalExpense, language)} icon="expenses" />
        <StatCard
          label={data.storeType === 'farm' ? t('stats.damagedEggs') : t('stats.returns')}
          value={data.returnsCount}
          icon="returns"
          accent="red"
        />
      </div>

      {/* NEW: profit breakdown panel */}
      <ProfitBreakdownPanel breakdown={data.profitBreakdown} />

      <InventorySummaryPanel data={data.inventoryOverview} />

      {data.storeType === 'fountain' && data.productionSummary && <ProductionPanel data={data.productionSummary} />}

      {data.lowStockProducts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="font-semibold text-yellow-800 mb-2 flex items-center gap-2">
            <Icon name="alertTriangle" className="w-4 h-4" /> {t('lowStockAlert')}
          </p>
          <div className="flex flex-wrap gap-2">
            {data.lowStockProducts.map((p) => (
              <span key={p.productId} className="badge-yellow">
                {p.name}: {roundDisplay(p.currentStock)} {t('left')}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('charts.salesTrend')}</h2>
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

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('charts.bestSellingProducts')}</h2>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('charts.stockHealthByProduct')}</h2>
          <div className="space-y-3">
            {data.stockHealthByProduct.map((p) => (
              <div key={p.name} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{roundDisplay(p.currentStock)} {t('stockHealth.inStock')} · {p.unitsSoldInPeriod} {t('stockHealth.soldThisPeriod')}</p>
                </div>
                <span
                  className={
                    p.status === 'healthy' ? 'badge-green' : p.status === 'low_stock' ? 'badge-yellow' : 'badge-red'
                  }
                >
                  {t(`status.${p.status}`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('charts.expensesByCategory')}</h2>
          {data.expensePieChart.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('charts.noExpenses')}</p>
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
                  <Tooltip formatter={(v) => formatCurrency(v, language)} />
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