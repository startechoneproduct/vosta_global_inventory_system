import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useStore } from '../context/StoreContext';

function isBottledPack(name = '') {
  return name.toLowerCase().includes('bottled water');
}
function isSachetBag(name = '') {
  return name.toLowerCase().includes('sachet water');
}

// Stock is stored as an exact decimal internally (a batch rarely consumes a
// whole number of bags/bundles/rolls), but displaying "37.78 bags" reads
// worse than it needs to for a manager glancing at the page - round only
// for display, never for the underlying stock math.
function roundDisplay(n) {
  return Math.round(n);
}

export default function Production({ user }) {
  const { t } = useTranslation('production');
  const { activeStore } = useStore();
  const canRecord = user?.role === 'manager' || user?.role === 'accountant';

  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [restockQty, setRestockQty] = useState({});
  const [bottledForm, setBottledForm] = useState({ finishedProductId: '', preformMaterialId: '', bottlesProduced: '', preformLeakageCount: '', notes: '' });
  const [sachetForm, setSachetForm] = useState({ finishedProductId: '', sachetsProduced: '', sachetLeakageCount: '', notes: '' });

  const isFountain = activeStore?.type === 'fountain';

  useEffect(() => {
    if (!isFountain) return;
    fetchMaterials();
    fetchProducts();
    fetchBatches();
  }, [isFountain]);

  const fetchMaterials = async () => {
    try {
      const response = await api.get('/raw-materials');
      setMaterials(response.data.data);
    } catch (err) {
      console.error('Failed to load raw materials', err);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await api.get('/stock/products');
      setProducts(response.data.data);
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const fetchBatches = async () => {
    try {
      const response = await api.get('/production');
      setBatches(response.data.data);
    } catch (err) {
      console.error('Failed to load production batches', err);
    }
  };

  const refreshAll = () => {
    fetchMaterials();
    fetchProducts();
    fetchBatches();
  };

  const handleRestock = async (materialId) => {
    const quantity = Number(restockQty[materialId]);
    if (!quantity || quantity <= 0) {
      setError(t('enterPositiveRestockQty'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/raw-materials/restock', { rawMaterialId: materialId, quantityPurchaseUnits: quantity });
      setSuccess(t('restockRecorded'));
      setRestockQty((prev) => ({ ...prev, [materialId]: '' }));
      refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBottledSubmit = async (e) => {
    e.preventDefault();
    if (!bottledForm.finishedProductId || !bottledForm.preformMaterialId || !bottledForm.bottlesProduced) {
      setError(t('selectBottledFields'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/production/bottled', {
        finishedProductId: bottledForm.finishedProductId,
        preformMaterialId: bottledForm.preformMaterialId,
        bottlesProduced: Number(bottledForm.bottlesProduced),
        preformLeakageCount: Number(bottledForm.preformLeakageCount) || 0,
        notes: bottledForm.notes,
      });
      setSuccess(t('bottledBatchRecorded'));
      setBottledForm({ finishedProductId: '', preformMaterialId: '', bottlesProduced: '', preformLeakageCount: '', notes: '' });
      refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSachetSubmit = async (e) => {
    e.preventDefault();
    if (!sachetForm.finishedProductId || !sachetForm.sachetsProduced) {
      setError(t('selectSachetFields'));
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/production/sachet', {
        finishedProductId: sachetForm.finishedProductId,
        sachetsProduced: Number(sachetForm.sachetsProduced),
        sachetLeakageCount: Number(sachetForm.sachetLeakageCount) || 0,
        notes: sachetForm.notes,
      });
      setSuccess(t('sachetBatchRecorded'));
      setSachetForm({ finishedProductId: '', sachetsProduced: '', sachetLeakageCount: '', notes: '' });
      refreshAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isFountain) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">{t('fountainOnly')}</p>
      </div>
    );
  }

  const bottledProducts = products.filter((p) => isBottledPack(p.name));
  const sachetProducts = products.filter((p) => isSachetBag(p.name));
  const preformMaterials = materials.filter((m) => m.materialKey.startsWith('preform'));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <p className="text-gray-500 mt-1">{t('subtitle')}</p>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('rawMaterials.heading')}</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('rawMaterials.colMaterial')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('rawMaterials.colStock')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('rawMaterials.colPieces')}</th>
              {canRecord && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('rawMaterials.colRestock')}</th>}
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => {
              const lowStock = m.currentStockPurchaseUnits <= m.minThresholdPurchaseUnits;
              return (
                <tr key={m._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {m.name}
                    {lowStock && <span className="ml-2 text-xs font-semibold text-red-600">{t('rawMaterials.lowStock')}</span>}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {roundDisplay(m.currentStockPurchaseUnits)} {m.purchaseUnitName}(s)
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{roundDisplay(m.currentStockPieces).toLocaleString()}</td>
                  {canRecord && (
                    <td className="px-6 py-3">
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="input-field w-28"
                          placeholder={t('rawMaterials.qtyPlaceholder')}
                          value={restockQty[m._id] || ''}
                          onChange={(e) => setRestockQty((prev) => ({ ...prev, [m._id]: e.target.value }))}
                        />
                        <button
                          type="button"
                          disabled={loading}
                          className="btn-primary text-sm px-3"
                          onClick={() => handleRestock(m._id)}
                        >
                          {t('rawMaterials.restockButton')}
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canRecord && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleBottledSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('bottledForm.heading')}</h2>
            <select
              className="input-field"
              value={bottledForm.finishedProductId}
              onChange={(e) => setBottledForm({ ...bottledForm, finishedProductId: e.target.value })}
            >
              <option value="">{t('bottledForm.selectBottleSize')}</option>
              {bottledProducts.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <select
              className="input-field"
              value={bottledForm.preformMaterialId}
              onChange={(e) => setBottledForm({ ...bottledForm, preformMaterialId: e.target.value })}
            >
              <option value="">{t('bottledForm.selectPreformVariant')}</option>
              {preformMaterials.map((m) => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              className="input-field"
              placeholder={t('bottledForm.bottlesProducedPlaceholder')}
              value={bottledForm.bottlesProduced}
              onChange={(e) => setBottledForm({ ...bottledForm, bottlesProduced: e.target.value })}
            />
            <input
              type="number"
              min="0"
              className="input-field"
              placeholder={t('bottledForm.preformsLeakedPlaceholder')}
              value={bottledForm.preformLeakageCount}
              onChange={(e) => setBottledForm({ ...bottledForm, preformLeakageCount: e.target.value })}
            />
            <input
              type="text"
              className="input-field"
              placeholder={t('bottledForm.notesPlaceholder')}
              value={bottledForm.notes}
              onChange={(e) => setBottledForm({ ...bottledForm, notes: e.target.value })}
            />
            <button type="submit" disabled={loading} className="btn-primary w-full">{t('bottledForm.submitButton')}</button>
          </form>

          <form onSubmit={handleSachetSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">{t('sachetForm.heading')}</h2>
            <select
              className="input-field"
              value={sachetForm.finishedProductId}
              onChange={(e) => setSachetForm({ ...sachetForm, finishedProductId: e.target.value })}
            >
              <option value="">{t('sachetForm.selectSachetProduct')}</option>
              {sachetProducts.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              className="input-field"
              placeholder={t('sachetForm.sachetsProducedPlaceholder')}
              value={sachetForm.sachetsProduced}
              onChange={(e) => setSachetForm({ ...sachetForm, sachetsProduced: e.target.value })}
            />
            <input
              type="number"
              min="0"
              className="input-field"
              placeholder={t('sachetForm.sachetsLeakedPlaceholder')}
              value={sachetForm.sachetLeakageCount}
              onChange={(e) => setSachetForm({ ...sachetForm, sachetLeakageCount: e.target.value })}
            />
            <input
              type="text"
              className="input-field"
              placeholder={t('sachetForm.notesPlaceholder')}
              value={sachetForm.notes}
              onChange={(e) => setSachetForm({ ...sachetForm, notes: e.target.value })}
            />
            <button type="submit" disabled={loading} className="btn-primary w-full">{t('sachetForm.submitButton')}</button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{t('batches.heading')}</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('batches.colDate')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('batches.colLine')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('batches.colProduct')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('batches.colQtyProduced')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('batches.colLeakage')}</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('batches.colRecordedBy')}</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr><td colSpan="6" className="px-6 py-8 text-center text-gray-500">{t('batches.noneRecorded')}</td></tr>
            ) : (
              batches.map((b) => (
                <tr key={b._id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-600">{new Date(b.timestamp).toLocaleString('en-NG')}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 capitalize">{b.productLine}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{b.finishedProductId?.name || b.finishedProductName}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {b.productLine === 'bottled'
                      ? t('batches.bottlesAndPacks', { bottles: b.bottlesProduced, packs: roundDisplay(b.packsProduced) })
                      : t('batches.sachetsAndBags', { sachets: b.sachetsProduced, bags: roundDisplay(b.bagsProduced) })}
                  </td>
                  <td className="px-6 py-3 text-sm text-red-600">
                    {b.productLine === 'bottled' ? b.preformLeakageCount : b.sachetLeakageCount}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">{b.recordedBy?.fullName || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
