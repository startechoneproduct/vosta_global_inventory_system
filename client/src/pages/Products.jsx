import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/formatCurrency';
import { useLanguage } from '../context/LanguageContext';

const FARM_UNIT_OPTIONS = ['crate', 'unit', 'bag', 'bird'];
const FOUNTAIN_UNIT_OPTIONS = ['pack', 'bag', 'bottle', 'unit'];
const BIRD_CATEGORY_OPTIONS = ['layer', 'broiler'];

function emptyForm(defaultUnit) {
  return {
    name: '',
    description: '',
    unitName: defaultUnit,
    category: '',
    currentStock: '',
    minThreshold: '20',
    pricePerUnit: '',
    costPerUnit: '',
  };
}

export default function Products({ user }) {
  const { t } = useTranslation('products');
  const { language } = useLanguage();
  const canManage = ['owner', 'general_manager', 'accountant'].includes(user?.role);
  const canEditPrice = ['owner', 'general_manager'].includes(user?.role);
  const { activeStore } = useStore();
  const isFarm = activeStore?.type === 'farm';
  const unitOptions = isFarm ? FARM_UNIT_OPTIONS : FOUNTAIN_UNIT_OPTIONS;

  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => emptyForm(unitOptions[0]));
  const [editingId, setEditingId] = useState(null);
  const [priceEditId, setPriceEditId] = useState(null);
  const [priceDraft, setPriceDraft] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const resetForm = () => {
    setForm(emptyForm(unitOptions[0]));
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (product) => {
    setForm({
      name: product.name,
      description: product.description || '',
      unitName: product.unitName,
      category: product.category || '',
      currentStock: String(product.currentStock),
      minThreshold: String(product.minThreshold),
      pricePerUnit: String(product.pricePerUnit / 100),
      costPerUnit: String((product.costPerUnit || 0) / 100),
    });
    setEditingId(product._id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!form.name || !form.pricePerUnit) {
        setError(t('nameAndPriceRequired'));
        setLoading(false);
        return;
      }

      if (editingId) {
        
        await api.put(`/products/${editingId}`, {
          name: form.name,
          description: form.description,
          unitName: form.unitName,
          category: form.category,
          minThreshold: Number(form.minThreshold),
          costPerUnit: Math.round(Number(form.costPerUnit || 0) * 100),
        });
        setSuccess(t('productUpdated'));
      } else {
        // CHANGED: sku is never sent - the backend generates it automatically.
        await api.post('/products', {
          name: form.name,
          description: form.description,
          unitName: form.unitName,
          category: form.category,
          currentStock: Number(form.currentStock || 0),
          minThreshold: Number(form.minThreshold || 20),
          pricePerUnit: Math.round(Number(form.pricePerUnit) * 100),
          costPerUnit: Math.round(Number(form.costPerUnit || 0) * 100),
        });
        setSuccess(t('productCreated'));
      }

      resetForm();
      fetchProducts();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const startPriceEdit = (product) => {
    setPriceEditId(product._id);
    setPriceDraft(String(product.pricePerUnit / 100));
  };

  const savePriceEdit = async (productId) => {
    setError('');
    setSuccess('');
    try {
      if (!priceDraft || Number(priceDraft) <= 0) {
        setError(t('enterValidPrice'));
        return;
      }
      await api.put(`/products/${productId}/price`, { pricePerUnit: Math.round(Number(priceDraft) * 100) });
      setSuccess(t('priceUpdated'));
      setPriceEditId(null);
      fetchProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeactivate = async (productId) => {
    setError('');
    setSuccess('');
    try {
      await api.delete(`/products/${productId}`);
      setSuccess(t('productDeactivated'));
      fetchProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 mt-1">{t('subtitle')}</p>
        </div>
        {canManage && !showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            {t('addProduct')}
          </button>
        )}
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {success && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">{success}</div>}

      {!canManage && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm">
          {t('viewOnlyNotice')}
        </div>
      )}

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">{editingId ? t('editProductTitle') : t('newProductTitle')}</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('productNameLabel')}</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isFarm ? t('productNamePlaceholderFarm') : t('productNamePlaceholderFountain')} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('unitLabel')}</label>
              <select
                className="input-field"
                value={form.unitName}
                onChange={(e) => {
                  const unitName = e.target.value;
                  const category = unitName === 'bird' ? (form.category || BIRD_CATEGORY_OPTIONS[0]) : '';
                  setForm({ ...form, unitName, category });
                }}
              >
                {unitOptions.map((u) => (
                  <option key={u} value={u}>{t('units.' + u)}</option>
                ))}
              </select>
            </div>

            {form.unitName === 'bird' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('birdCategoryLabel')}</label>
                <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {BIRD_CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{t('categories.' + c)}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('categoryOptionalLabel')}</label>
                <input className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={isFarm ? t('categoryPlaceholderFarm') : t('categoryPlaceholderFountain')} />
              </div>
            )}

            {!editingId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('startingStockLabel')}</label>
                <input
                  type="number"
                  className="input-field"
                  value={form.currentStock}
                  onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
                  min="0"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('lowStockThresholdLabel')}</label>
              <input
                type="number"
                className="input-field"
                value={form.minThreshold}
                onChange={(e) => setForm({ ...form, minThreshold: e.target.value })}
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('sellingPriceLabel')} {editingId && <span className="text-xs text-gray-400">{t('priceLockedNote')}</span>}
              </label>
              <input
                type="number"
                className="input-field"
                value={form.pricePerUnit}
                onChange={(e) => setForm({ ...form, pricePerUnit: e.target.value })}
                min="0"
                step="0.01"
                disabled={!!editingId}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('costPriceLabel')}</label>
              <input
                type="number"
                className="input-field"
                value={form.costPerUnit}
                onChange={(e) => setForm({ ...form, costPerUnit: e.target.value })}
                min="0"
                step="0.01"
                placeholder={t('costPricePlaceholder')}
              />
              <p className="text-xs text-gray-400 mt-1">{t('costPriceHelp')}</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('descriptionLabel')}</label>
              <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? t('saving') : editingId ? t('saveChanges') : t('createProduct')}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary">
              {t('cancel')}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colProduct')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colSku')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colStock')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colSellingPrice')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colCostPrice')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colMargin')}</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colStatus')}</th>
                {canManage && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">{t('colActions')}</th>}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-8 text-center text-gray-500">{t('noProductsYet')}</td>
                </tr>
              ) : (
                products.map((p) => {
                  const margin = p.pricePerUnit > 0 ? Math.round(((p.pricePerUnit - (p.costPerUnit || 0)) / p.pricePerUnit) * 100) : 0;
                  return (
                    <tr key={p._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{p.name}</td>
                      {/* SKU is read-only - it's generated by the server, never entered by anyone */}
                      <td className="px-6 py-3 text-sm text-gray-400 font-mono">{p.sku}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{Math.round(p.currentStock)} {p.unitName}{t('unitSuffix')}</td>
                      <td className="px-6 py-3 text-sm">
                        {priceEditId === p._id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="input-field w-24 py-1"
                              value={priceDraft}
                              onChange={(e) => setPriceDraft(e.target.value)}
                              min="0"
                              step="0.01"
                              autoFocus
                            />
                            <button onClick={() => savePriceEdit(p._id)} className="text-xs text-blue-600 font-medium hover:text-blue-800">{t('save')}</button>
                            <button onClick={() => setPriceEditId(null)} className="text-xs text-gray-400 hover:text-gray-600">{t('cancel')}</button>
                          </div>
                        ) : (
                          <span className="flex items-center gap-2">
                            {formatCurrency(p.pricePerUnit, language)}
                            {canEditPrice && (
                              <button onClick={() => startPriceEdit(p)} className="text-xs text-blue-600 hover:text-blue-800">
                                {t('edit')}
                              </button>
                            )}
                            {!canEditPrice && <span className="text-xs text-gray-400" title={t('priceLockTooltip')}>🔒</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {p.costPerUnit ? formatCurrency(p.costPerUnit, language) : <span className="text-yellow-600">{t('notSet')}</span>}
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <span className={margin >= 30 ? 'badge-green' : margin >= 10 ? 'badge-yellow' : 'badge-red'}>{margin}%</span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={p.isActive ? 'badge-green' : 'badge-red'}>{p.isActive ? t('statusActive') : t('statusInactive')}</span>
                      </td>
                      {canManage && (
                        <td className="px-6 py-3 text-sm space-x-3">
                          <button onClick={() => startEdit(p)} className="text-blue-600 hover:text-blue-800 font-medium">{t('edit')}</button>
                          {canEditPrice && p.isActive && (
                            <button onClick={() => handleDeactivate(p._id)} className="text-red-600 hover:text-red-800 font-medium">
                              {t('deactivate')}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}