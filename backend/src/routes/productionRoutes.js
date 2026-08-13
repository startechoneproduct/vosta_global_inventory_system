const express = require('express');
const {
  RawMaterial,
  RawMaterialMovement,
  ProductionBatch,
  Product,
  StockMovement,
  ActivityLog,
  Store,
} = require('../models/index.js');
const { verifyToken, resolveStoreScope, authorize } = require('../middleware/auth.js');
const { notifyStoreLeadership } = require('../utils/notify.js');

const router = express.Router();

const canRecordProduction = authorize('owner', 'general_manager', 'manager', 'accountant');

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

// Consumes `piecesNeeded` pieces of `material`, converting to purchase units.
// Returns the purchase-unit amount (does not mutate anything itself).
function purchaseUnitsFor(material, piecesNeeded) {
  return piecesNeeded / material.piecesPerPurchaseUnit;
}

function insufficientStockMessage(material, purchaseUnitsNeeded) {
  return `Insufficient ${material.name} stock. Available: ${material.currentStockPurchaseUnits.toFixed(2)} ${material.purchaseUnitName}(s), Required: ${purchaseUnitsNeeded.toFixed(2)} ${material.purchaseUnitName}(s).`;
}

// ============ RECORD BOTTLED WATER PRODUCTION ============
router.post('/bottled', verifyToken, resolveStoreScope, requireFountainStore, canRecordProduction, async (req, res, next) => {
  try {
    const { finishedProductId, preformMaterialId, bottlesProduced, preformLeakageCount = 0, notes } = req.body;
    const storeId = req.storeId;

    if (!finishedProductId || !preformMaterialId || !bottlesProduced || bottlesProduced <= 0) {
      return res.status(400).json({
        success: false,
        message: 'finishedProductId, preformMaterialId, and a positive bottlesProduced are required',
      });
    }
    if (preformLeakageCount < 0) {
      return res.status(400).json({ success: false, message: 'preformLeakageCount cannot be negative' });
    }

    const finishedProduct = await Product.findOne({ _id: finishedProductId, storeId });
    if (!finishedProduct) return res.status(404).json({ success: false, message: 'Finished product not found' });

    const [preform, caps, labels] = await Promise.all([
      RawMaterial.findOne({ _id: preformMaterialId, storeId }),
      RawMaterial.findOne({ storeId, materialKey: 'caps' }),
      RawMaterial.findOne({ storeId, materialKey: 'labels' }),
    ]);

    if (!preform) return res.status(404).json({ success: false, message: 'Selected preform material not found' });
    if (!caps || !labels) {
      return res.status(404).json({
        success: false,
        message: 'Caps/labels raw materials are not set up for this store. Please seed or create them first.',
      });
    }

    // Leakage happens during preform blowing, before capping/labeling, so a
    // burst preform consumes only a preform - never a cap or label.
    const preformsConsumedPieces = bottlesProduced + preformLeakageCount;
    const capsConsumedPieces = bottlesProduced;
    const labelsConsumedPieces = bottlesProduced;

    const preformUnits = purchaseUnitsFor(preform, preformsConsumedPieces);
    const capsUnits = purchaseUnitsFor(caps, capsConsumedPieces);
    const labelsUnits = purchaseUnitsFor(labels, labelsConsumedPieces);

    if (preform.currentStockPurchaseUnits < preformUnits) {
      return res.status(400).json({ success: false, message: insufficientStockMessage(preform, preformUnits) });
    }
    if (caps.currentStockPurchaseUnits < capsUnits) {
      return res.status(400).json({ success: false, message: insufficientStockMessage(caps, capsUnits) });
    }
    if (labels.currentStockPurchaseUnits < labelsUnits) {
      return res.status(400).json({ success: false, message: insufficientStockMessage(labels, labelsUnits) });
    }

    const packsProduced = bottlesProduced / 12;

    preform.currentStockPurchaseUnits -= preformUnits;
    caps.currentStockPurchaseUnits -= capsUnits;
    labels.currentStockPurchaseUnits -= labelsUnits;
    await Promise.all([preform.save(), caps.save(), labels.save()]);

    const batch = await ProductionBatch.create({
      storeId,
      productLine: 'bottled',
      finishedProductId,
      finishedProductName: finishedProduct.name,
      preformMaterialId: preform._id,
      bottlesProduced,
      preformLeakageCount,
      packsProduced,
      materialsConsumed: [
        { rawMaterialId: preform._id, materialKey: preform.materialKey, piecesConsumed: preformsConsumedPieces, purchaseUnitsConsumed: preformUnits },
        { rawMaterialId: caps._id, materialKey: caps.materialKey, piecesConsumed: capsConsumedPieces, purchaseUnitsConsumed: capsUnits },
        { rawMaterialId: labels._id, materialKey: labels.materialKey, piecesConsumed: labelsConsumedPieces, purchaseUnitsConsumed: labelsUnits },
      ],
      recordedBy: req.user.userId,
      recordedByRole: req.user.role,
      notes,
    });

    await Promise.all([
      RawMaterialMovement.create({ storeId, rawMaterialId: preform._id, type: 'production_consume', quantityPurchaseUnits: -preformUnits, productionBatchId: batch._id, recordedBy: req.user.userId }),
      RawMaterialMovement.create({ storeId, rawMaterialId: caps._id, type: 'production_consume', quantityPurchaseUnits: -capsUnits, productionBatchId: batch._id, recordedBy: req.user.userId }),
      RawMaterialMovement.create({ storeId, rawMaterialId: labels._id, type: 'production_consume', quantityPurchaseUnits: -labelsUnits, productionBatchId: batch._id, recordedBy: req.user.userId }),
    ]);

    const updatedProduct = await Product.findByIdAndUpdate(finishedProductId, { $inc: { currentStock: packsProduced } }, { new: true });

    await StockMovement.create({
      storeId,
      productId: finishedProductId,
      type: 'production_in',
      quantity: packsProduced,
      balanceAfter: updatedProduct?.currentStock,
      recordedBy: req.user.userId,
      notes: `Production batch ${batch._id}`,
    });

    await ActivityLog.create({
      storeId,
      productId: finishedProductId,
      productName: finishedProduct.name,
      quantity: packsProduced,
      action: 'stock_in',
      performedBy: req.user.userId,
      performedByName: req.user.fullName || req.user.email,
    });

    notifyStoreLeadership({
      storeId,
      includeManagers: true,
      type: 'production_recorded',
      title: `Bottled water production recorded`,
      message: `${packsProduced.toFixed(2)} pack(s) of ${finishedProduct.name} produced from ${bottlesProduced} bottles (${preformLeakageCount} preform(s) lost to leakage).`,
      relatedId: batch._id,
    }).catch((e) => console.error('Production notification failed:', e.message));

    res.status(201).json({ success: true, message: 'Production batch recorded', data: batch });
  } catch (error) {
    next(error);
  }
});

// ============ RECORD SACHET WATER PRODUCTION ============
router.post('/sachet', verifyToken, resolveStoreScope, requireFountainStore, canRecordProduction, async (req, res, next) => {
  try {
    const { finishedProductId, sachetsProduced, sachetLeakageCount = 0, notes } = req.body;
    const storeId = req.storeId;

    if (!finishedProductId || !sachetsProduced || sachetsProduced <= 0) {
      return res.status(400).json({
        success: false,
        message: 'finishedProductId and a positive sachetsProduced are required',
      });
    }
    if (sachetLeakageCount < 0) {
      return res.status(400).json({ success: false, message: 'sachetLeakageCount cannot be negative' });
    }

    const finishedProduct = await Product.findOne({ _id: finishedProductId, storeId });
    if (!finishedProduct) return res.status(404).json({ success: false, message: 'Finished product not found' });

    const nylon = await RawMaterial.findOne({ storeId, materialKey: 'nylon_roll' });
    if (!nylon) {
      return res.status(404).json({
        success: false,
        message: 'Nylon roll raw material is not set up for this store. Please seed or create it first.',
      });
    }

    // A burst/torn sachet during sealing still consumes film, since the film
    // was already dispensed before it tore.
    const nylonConsumedPieces = sachetsProduced + sachetLeakageCount;
    const nylonUnits = purchaseUnitsFor(nylon, nylonConsumedPieces);

    if (nylon.currentStockPurchaseUnits < nylonUnits) {
      return res.status(400).json({ success: false, message: insufficientStockMessage(nylon, nylonUnits) });
    }

    const bagsProduced = sachetsProduced / 20;

    nylon.currentStockPurchaseUnits -= nylonUnits;
    await nylon.save();

    const batch = await ProductionBatch.create({
      storeId,
      productLine: 'sachet',
      finishedProductId,
      finishedProductName: finishedProduct.name,
      sachetsProduced,
      sachetLeakageCount,
      bagsProduced,
      materialsConsumed: [
        { rawMaterialId: nylon._id, materialKey: nylon.materialKey, piecesConsumed: nylonConsumedPieces, purchaseUnitsConsumed: nylonUnits },
      ],
      recordedBy: req.user.userId,
      recordedByRole: req.user.role,
      notes,
    });

    await RawMaterialMovement.create({
      storeId,
      rawMaterialId: nylon._id,
      type: 'production_consume',
      quantityPurchaseUnits: -nylonUnits,
      productionBatchId: batch._id,
      recordedBy: req.user.userId,
    });

    const updatedProduct = await Product.findByIdAndUpdate(finishedProductId, { $inc: { currentStock: bagsProduced } }, { new: true });

    await StockMovement.create({
      storeId,
      productId: finishedProductId,
      type: 'production_in',
      quantity: bagsProduced,
      balanceAfter: updatedProduct?.currentStock,
      recordedBy: req.user.userId,
      notes: `Production batch ${batch._id}`,
    });

    await ActivityLog.create({
      storeId,
      productId: finishedProductId,
      productName: finishedProduct.name,
      quantity: bagsProduced,
      action: 'stock_in',
      performedBy: req.user.userId,
      performedByName: req.user.fullName || req.user.email,
    });

    notifyStoreLeadership({
      storeId,
      includeManagers: true,
      type: 'production_recorded',
      title: `Sachet water production recorded`,
      message: `${bagsProduced.toFixed(2)} bag(s) of ${finishedProduct.name} produced from ${sachetsProduced} sachets (${sachetLeakageCount} sachet(s) lost to leakage).`,
      relatedId: batch._id,
    }).catch((e) => console.error('Production notification failed:', e.message));

    res.status(201).json({ success: true, message: 'Production batch recorded', data: batch });
  } catch (error) {
    next(error);
  }
});

// ============ LIST PRODUCTION BATCHES ============
router.get('/', verifyToken, resolveStoreScope, requireFountainStore, async (req, res, next) => {
  try {
    const { productLine, startDate, endDate } = req.query;
    const query = { storeId: req.storeId };

    if (productLine) query.productLine = productLine;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const batches = await ProductionBatch.find(query)
      .populate('recordedBy', 'fullName role')
      .populate('finishedProductId', 'name sku')
      .sort({ timestamp: -1 })
      .limit(300);

    res.json({ success: true, data: batches });
  } catch (error) {
    next(error);
  }
});

// ============ PRODUCTION SUMMARY (raw materials + period totals) ============
router.get('/summary', verifyToken, resolveStoreScope, requireFountainStore, async (req, res, next) => {
  try {
    const storeId = req.storeId;
    const days = parseInt(req.query.days || '30', 10);
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [materials, batches] = await Promise.all([
      RawMaterial.find({ storeId, isActive: true }),
      ProductionBatch.find({ storeId, timestamp: { $gte: start } }),
    ]);

    const rawMaterials = materials.map((m) => ({
      _id: m._id,
      name: m.name,
      materialKey: m.materialKey,
      productLine: m.productLine,
      purchaseUnitName: m.purchaseUnitName,
      piecesPerPurchaseUnit: m.piecesPerPurchaseUnit,
      currentStockPurchaseUnits: m.currentStockPurchaseUnits,
      currentStockPieces: m.currentStockPurchaseUnits * m.piecesPerPurchaseUnit,
      lowStock: m.currentStockPurchaseUnits <= m.minThresholdPurchaseUnits,
    }));

    const bottledBatches = batches.filter((b) => b.productLine === 'bottled');
    const sachetBatches = batches.filter((b) => b.productLine === 'sachet');

    res.json({
      success: true,
      data: {
        rawMaterials,
        totals: {
          bottled: {
            bottlesProducedPeriod: bottledBatches.reduce((s, b) => s + b.bottlesProduced, 0),
            packsProducedPeriod: bottledBatches.reduce((s, b) => s + b.packsProduced, 0),
            preformLeakageCountPeriod: bottledBatches.reduce((s, b) => s + b.preformLeakageCount, 0),
          },
          sachet: {
            sachetsProducedPeriod: sachetBatches.reduce((s, b) => s + b.sachetsProduced, 0),
            bagsProducedPeriod: sachetBatches.reduce((s, b) => s + b.bagsProduced, 0),
            sachetLeakageCountPeriod: sachetBatches.reduce((s, b) => s + b.sachetLeakageCount, 0),
          },
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
