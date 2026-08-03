const express = require('express');
const { VaccinationRecord, Store } = require('../models');
const { verifyToken, resolveStoreScope, authorize } = require('../middleware/auth');

const router = express.Router();

// Drivers (and any role outside this list) don't get vaccination access -
// only leadership/oversight roles record and view these records.
const canManageVaccination = authorize('owner', 'general_manager', 'manager', 'supervisor', 'accountant');

async function requireFarmStore(req, res, next) {
  try {
    const store = await Store.findById(req.storeId);
    if (!store || store.type !== 'farm') {
      return res.status(403).json({
        success: false,
        message: 'Vaccination/medication tracking is only available for Stacey Farm.',
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

// ============ RECORD VACCINATION / MEDICATION ============
router.post('/', verifyToken, resolveStoreScope, canManageVaccination, requireFarmStore, async (req, res, next) => {
  try {
    const { type, name, batchOrFlockLabel, dosage, administeredDate, nextDueDate, notes } = req.body;

    if (!type || !['vaccination', 'medication'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be "vaccination" or "medication"' });
    }
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const record = await VaccinationRecord.create({
      storeId: req.storeId,
      type,
      name,
      batchOrFlockLabel,
      dosage,
      administeredDate: administeredDate || new Date(),
      nextDueDate,
      administeredBy: req.user.userId,
      notes,
    });

    res.status(201).json({ success: true, message: 'Record saved', data: record });
  } catch (error) {
    next(error);
  }
});

// ============ LIST RECORDS ============
router.get('/', verifyToken, resolveStoreScope, canManageVaccination, requireFarmStore, async (req, res, next) => {
  try {
    const records = await VaccinationRecord.find({ storeId: req.storeId })
      .populate('administeredBy', 'fullName role')
      .sort({ administeredDate: -1 })
      .limit(300);

    res.json({ success: true, data: records });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
