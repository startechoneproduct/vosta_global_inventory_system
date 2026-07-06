const express = require('express');
const { Product } = require('../models');
const { verifyToken, resolveStoreScope, authorizeGm, authorize } = require('../middleware/auth');

const router = express.Router();

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
    const { sku, name, description, unitName, category, currentStock, minThreshold, pricePerUnit, costPerUnit } = req.body;

    if (!sku || !name || !unitName || pricePerUnit === undefined) {
      return res.status(400).json({
        success: false,
        message: 'sku, name, unitName and pricePerUnit are required',
      });
    }

    // NEW: friendly duplicate-SKU message instead of letting Mongoose's raw
    // E11000 duplicate key error bubble up (sku is a unique index on Product).
    const existing = await Product.findOne({ sku });
    if (existing) {
      return res.status(400).json({ success: false, message: `SKU "${sku}" is already in use` });
    }

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