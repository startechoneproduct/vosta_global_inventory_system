const express = require('express');
const { RawMaterial, RawMaterialMovement, Store } = require('../models/index.js');
const { verifyToken, resolveStoreScope, authorize } = require('../middleware/auth.js');
const { notifyStoreLeadership } = require('../utils/notify.js');

const router = express.Router();

const canRecordProduction = authorize('manager', 'accountant');
const canEditMaterialConfig = authorize('owner', 'general_manager', 'manager', 'accountant');

async function requireFountainStore(req, res, next) {
  try {
    const store = await Store.findById(req.storeId);
    if (!store || store.type !== 'fountain') {
      return res.status(403).json({
        success: false,
        message: 'Production tracking is only available for Stacey Fountain.',
      });
    }
    req.store = store;
    next();
  } catch (error) {
    next(error);
  }
}

function withPieces(material) {
  const obj = material.toObject ? material.toObject() : material;
  return { ...obj, currentStockPieces: obj.currentStockPurchaseUnits * obj.piecesPerPurchaseUnit };
}

// ============ LIST RAW MATERIALS ============
router.get('/', verifyToken, resolveStoreScope, requireFountainStore, async (req, res, next) => {
  try {
    const materials = await RawMaterial.find({ storeId: req.storeId, isActive: true }).sort({ productLine: 1, name: 1 });
    res.json({ success: true, data: materials.map(withPieces) });
  } catch (error) {
    next(error);
  }
});

// ============ EDIT MATERIAL CONFIG ============
router.patch('/:id', verifyToken, resolveStoreScope, requireFountainStore, canEditMaterialConfig, async (req, res, next) => {
  try {
    const { purchaseUnitName, piecesPerPurchaseUnit, minThresholdPurchaseUnits, costPerPurchaseUnit, notes } = req.body;

    const material = await RawMaterial.findOne({ _id: req.params.id, storeId: req.storeId });
    if (!material) return res.status(404).json({ success: false, message: 'Raw material not found' });

    if (purchaseUnitName !== undefined) material.purchaseUnitName = purchaseUnitName;
    if (piecesPerPurchaseUnit !== undefined) {
      if (piecesPerPurchaseUnit <= 0) {
        return res.status(400).json({ success: false, message: 'piecesPerPurchaseUnit must be greater than 0' });
      }
      material.piecesPerPurchaseUnit = piecesPerPurchaseUnit;
    }
    if (minThresholdPurchaseUnits !== undefined) material.minThresholdPurchaseUnits = minThresholdPurchaseUnits;
    if (costPerPurchaseUnit !== undefined) material.costPerPurchaseUnit = costPerPurchaseUnit;
    if (notes !== undefined) material.notes = notes;

    await material.save();
    res.json({ success: true, message: 'Raw material updated', data: withPieces(material) });
  } catch (error) {
    next(error);
  }
});

// ============ RESTOCK ============
router.post('/restock', verifyToken, resolveStoreScope, requireFountainStore, canRecordProduction, async (req, res, next) => {
  try {
    const { rawMaterialId, quantityPurchaseUnits, notes } = req.body;

    if (!rawMaterialId || !quantityPurchaseUnits || quantityPurchaseUnits <= 0) {
      return res.status(400).json({
        success: false,
        message: 'rawMaterialId and a positive quantityPurchaseUnits are required',
      });
    }

    const material = await RawMaterial.findOne({ _id: rawMaterialId, storeId: req.storeId });
    if (!material) return res.status(404).json({ success: false, message: 'Raw material not found' });

    material.currentStockPurchaseUnits += quantityPurchaseUnits;
    await material.save();

    const movement = await RawMaterialMovement.create({
      storeId: req.storeId,
      rawMaterialId: material._id,
      type: 'restock_in',
      quantityPurchaseUnits,
      recordedBy: req.user.userId,
      notes,
    });

    notifyStoreLeadership({
      storeId: req.storeId,
      includeManagers: false,
      type: 'production_recorded',
      title: `Raw material restocked: ${material.name}`,
      message: `${quantityPurchaseUnits} ${material.purchaseUnitName}(s) of ${material.name} added to stock. New total: ${material.currentStockPurchaseUnits} ${material.purchaseUnitName}(s).`,
      relatedId: movement._id,
    }).catch((e) => console.error('Restock notification failed:', e.message));

    res.status(201).json({ success: true, message: 'Restock recorded', data: withPieces(material) });
  } catch (error) {
    next(error);
  }
});

// ============ LIST MOVEMENTS ============
router.get('/movements', verifyToken, resolveStoreScope, requireFountainStore, async (req, res, next) => {
  try {
    const { rawMaterialId, startDate, endDate } = req.query;
    const query = { storeId: req.storeId };

    if (rawMaterialId) query.rawMaterialId = rawMaterialId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const movements = await RawMaterialMovement.find(query)
      .populate('recordedBy', 'fullName role')
      .populate('rawMaterialId', 'name purchaseUnitName')
      .sort({ timestamp: -1 })
      .limit(300);

    res.json({ success: true, data: movements });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
