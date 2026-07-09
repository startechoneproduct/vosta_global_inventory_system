const express = require('express');
const { Product , Store} = require('../models');
const { verifyToken, resolveStoreScope, authorizeGm, authorize } = require('../middleware/auth');

const router = express.Router();

const BIRD_CATEGORIES = ['layer', 'broiler'];

// Farm sells by crate (eggs) or bird (layers/broilers) only - the wider
// unit list (pack/bag/bottle/unit) belongs to Fountain's product catalog.
function validateUnitAndCategory(storeType, unitName, category) {
  if (storeType === 'farm' && !['crate', 'bird'].includes(unitName)) {
    return `Farm products must use unit "crate" or "bird", got "${unitName}"`;
  }
  if (unitName === 'bird' && !BIRD_CATEGORIES.includes(category)) {
    return `Bird products require a category of ${BIRD_CATEGORIES.join(' or ')}`;
  }
  return null;
}

async function generateUniqueSku(storeType) {
  const prefix = storeType === 'fountain' ? 'FTN' : storeType === 'farm' ? 'FRM' : 'STR';
 
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const candidate = `${prefix}-${suffix}`;
    const exists = await Product.findOne({ sku: candidate });
    if (!exists) return candidate;
  }
 
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

// ============ LIST PRODUCTS ============
router.get('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const products = await Product.find({ storeId: req.storeId }).sort({ name: 1 });
    const isGm = req.user.role === 'owner' || req.user.role === 'general_manager';

    res.json({
      success: true,
      data: products,
      priceEditLocked: !isGm, // frontend audit-lock indicator
    });
  } catch (error) {
    next(error);
  }
});

// ============ GET SINGLE PRODUCT ============
router.get('/:productId', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const product = await Product.findOne({ _id: req.params.productId, storeId: req.storeId });
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// ============ CREATE PRODUCT (GM/Accountant - stock-in scope) ============
router.post('/', verifyToken, resolveStoreScope, authorize('owner', 'general_manager', 'accountant'), async (req, res, next) => {
  try {
    // NEW: category (e.g. "layer"/"broiler" for Farm) and costPerUnit
    // (what this unit actually costs you) added alongside the existing fields.
    const {  name, description, unitName, category, currentStock, minThreshold, pricePerUnit, costPerUnit } = req.body;

    if (!name || !unitName || pricePerUnit === undefined) {
      return res.status(400).json({
        success: false,
        message: 'name, unitName and pricePerUnit are required',
      });
    }

    // NEW: friendly duplicate-SKU message instead of letting Mongoose's raw
    // E11000 duplicate key error bubble up (sku is a unique index on Product).
     const store = await Store.findById(req.storeId);
    if (!store) return res.status(404).json({ success: false, message: 'Store not found' });

    const validationError = validateUnitAndCategory(store.type, unitName, category);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const sku = await generateUniqueSku(store.type);

    const product = await Product.create({
      storeId: req.storeId,
      sku,
      name,
      description,
      unitName,
      category,
      currentStock: currentStock || 0,
      minThreshold: minThreshold || 20,
      pricePerUnit,
      costPerUnit: costPerUnit || 0,
    });
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// ============ UPDATE PRODUCT DETAILS (non-price fields - Accountant/GM) ============
// Cost price lives here (not the audit-locked price endpoint below) because
// tracking real cost is an accounting task, not a customer-facing price
// change - the Accountant role should be able to keep this current.
router.put('/:productId', verifyToken, resolveStoreScope, authorize('owner', 'general_manager', 'accountant'), async (req, res, next) => {
  try {
    const { name, description, unitName, category, minThreshold, costPerUnit, isActive } = req.body;

    if (unitName !== undefined || category !== undefined) {
      const [store, existing] = await Promise.all([
        Store.findById(req.storeId),
        Product.findOne({ _id: req.params.productId, storeId: req.storeId }),
      ]);
      if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

      const validationError = validateUnitAndCategory(
        store?.type,
        unitName !== undefined ? unitName : existing.unitName,
        category !== undefined ? category : existing.category
      );
      if (validationError) return res.status(400).json({ success: false, message: validationError });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.productId, storeId: req.storeId },
      {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(unitName !== undefined && { unitName }),
        ...(category !== undefined && { category }),
        ...(minThreshold !== undefined && { minThreshold }),
        ...(costPerUnit !== undefined && { costPerUnit }),
        ...(isActive !== undefined && { isActive }),
      },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
});

// ============ AUDIT-LOCKED: UPDATE PRICE (GM/Owner ONLY) ============
router.put('/:productId/price', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const { pricePerUnit } = req.body;
    if (!pricePerUnit || pricePerUnit <= 0) {
      return res.status(400).json({ success: false, message: 'A valid pricePerUnit is required' });
    }

    const product = await Product.findOneAndUpdate(
      { _id: req.params.productId, storeId: req.storeId },
      { pricePerUnit },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Price updated', data: product });
  } catch (error) {
    next(error);
  }
});

// ============ DEACTIVATE PRODUCT (soft delete - GM/Owner ONLY) ============
// Soft delete rather than a hard delete so past sales/activity logs that
// reference this product don't end up pointing at nothing.
router.delete('/:productId', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.productId, storeId: req.storeId },
      { isActive: false },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, message: 'Product deactivated', data: product });
  } catch (error) {
    next(error);
  }
});

module.exports = router;