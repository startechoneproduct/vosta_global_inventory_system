const { Sale, Product, Expense, Return, Damage, StockMovement, RawMaterial } = require('../models');

const PERIOD_TO_DAYS = { '2days': 2, '7days': 7, '1week': 7, '1month': 30, '1year': 365 };

// ============ PERIOD RANGE ============
// Shared by dashboard/sales/expenses/inventory analytics so every module
// bucketing "the selected period" agrees on the same window.
function rangeFor(period) {
  const days = PERIOD_TO_DAYS[period] || 1; // default: today
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start, end };
}

// ============ REVENUE / COST / PROFIT ============
//
//   Gross Profit = Revenue - Write-Off Value - Cost of Goods Sold
//   Net Profit   = Gross Profit - Approved Expenses
//
// Fountain's write-off value comes from Returns (money given back on a sale
// that didn't stick, approximated at current/snapshotted price). Farm's
// write-off value comes from Damages (cost of stock that never sold at all,
// valued at cost price since there was never a sale to reverse).
async function computeProfitMetrics(storeId, isFarm, start, end) {
  const [rangeSales, expenses, returnsInPeriod, damagesInPeriod, products] = await Promise.all([
    Sale.find({ storeId, timestamp: { $gte: start, $lte: end } }),
    Expense.find({ storeId, timestamp: { $gte: start, $lte: end } }),
    isFarm ? Promise.resolve([]) : Return.find({ storeId, timestamp: { $gte: start, $lte: end } }),
    isFarm ? Damage.find({ storeId, timestamp: { $gte: start, $lte: end } }) : Promise.resolve([]),
    Product.find({ storeId }),
  ]);

  const revenue = rangeSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const cogs = rangeSales.reduce((sum, s) => sum + (s.costOfGoods || 0), 0);

  const priceByProductId = {};
  for (const p of products) priceByProductId[p._id.toString()] = p.pricePerUnit;

  const returnsValue = returnsInPeriod.reduce((sum, r) => {
    const price = r.pricePerUnit || priceByProductId[r.productId?.toString()] || 0;
    return sum + price * r.quantity;
  }, 0);

  const damageValue = damagesInPeriod.reduce((sum, d) => sum + (d.costValue || 0), 0);
  const writeOffValue = isFarm ? damageValue : returnsValue;

  const approvedExpenseTotal = expenses
    .filter((e) => e.approvalStatus === 'approved')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const grossProfit = revenue - writeOffValue - cogs;
  const netProfit = grossProfit - approvedExpenseTotal;
  const profitMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    revenue,
    cogs,
    writeOffValue,
    writeOffLabel: isFarm ? 'Damaged Stock (Write-Off)' : 'Returns Value',
    approvedExpenseTotal,
    totalExpense,
    grossProfit,
    netProfit,
    profitMarginPct,
    rangeSales,
    expenses,
  };
}

// ============ INVENTORY OVERVIEW (stock in/out, turnover, low stock) ============
// Powers both the Dashboard's "Inventory Summary" panel and the Inventory
// page's Overview tab, so the two never disagree on the numbers.
const IN_TYPES = ['in', 'return_in', 'production_in'];
const OUT_TYPES = ['out', 'sale', 'damage_out'];

async function computeInventoryOverview(storeId, start, end) {
  const [movementsInPeriod, products, store] = await Promise.all([
    StockMovement.find({ storeId, timestamp: { $gte: start, $lte: end } }),
    Product.find({ storeId }),
    RawMaterial.find({ storeId, isActive: true }).catch(() => []),
  ]);

  const stockInUnits = movementsInPeriod
    .filter((m) => IN_TYPES.includes(m.type))
    .reduce((sum, m) => sum + m.quantity, 0);
  const stockOutUnits = movementsInPeriod
    .filter((m) => OUT_TYPES.includes(m.type))
    .reduce((sum, m) => sum + m.quantity, 0);

  const stockOutRatePct = stockInUnits > 0 ? (stockOutUnits / stockInUnits) * 100 : 0;

  const totalCurrentStock = products.reduce((sum, p) => sum + p.currentStock, 0);
  // Simple turnover proxy: units moved out over the period vs. current stock
  // on hand. A precise turnover needs full COGS/average-inventory-value
  // accounting, which isn't tracked per-period yet - this gives a
  // directionally correct, easy-to-explain number instead.
  const turnover = totalCurrentStock > 0 ? stockOutUnits / totalCurrentStock : 0;

  const productRows = products.map((p) => ({
    productId: p._id,
    name: p.name,
    stock: p.currentStock,
    unitType: p.unitName,
    status: p.currentStock <= 0 ? 'out_of_stock' : p.currentStock <= p.minThreshold ? 'low_stock' : 'healthy',
  }));

  const rawMaterialRows = (store || []).map((m) => ({
    productId: m._id,
    name: m.name,
    stock: m.currentStockPurchaseUnits,
    unitType: m.purchaseUnitName,
    status: m.currentStockPurchaseUnits <= 0 ? 'out_of_stock' : m.currentStockPurchaseUnits <= m.minThresholdPurchaseUnits ? 'low_stock' : 'healthy',
  }));

  const allItems = [...productRows, ...rawMaterialRows];
  const lowStockCount = allItems.filter((i) => i.status !== 'healthy').length;

  return {
    stockInUnits,
    stockOutUnits,
    stockOutRatePct,
    lowStockCount,
    turnover,
    products: productRows,
    allItems,
  };
}

module.exports = {
  rangeFor,
  computeProfitMetrics,
  computeInventoryOverview,
};
