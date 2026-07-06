const express = require('express');
const { Equipment } = require('../models');
const { verifyToken, resolveStoreScope, authorizeGm } = require('../middleware/auth');
const { notifyStoreLeadership } = require('../utils/notify');

const router = express.Router();

// ============ CREATE EQUIPMENT ============
router.post('/', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const { name, type, serialNumber, lastServiceDate, serviceIntervalDays, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Equipment name is required' });

    const equipment = await Equipment.create({
      storeId: req.storeId,
      name,
      type,
      serialNumber,
      lastServiceDate: lastServiceDate ? new Date(lastServiceDate) : new Date(),
      serviceIntervalDays: serviceIntervalDays || 90,
      notes,
    });

    res.status(201).json({ success: true, message: 'Equipment added', data: equipment });
  } catch (error) {
    next(error);
  }
});

// ============ LIST EQUIPMENT ============
router.get('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const equipment = await Equipment.find({ storeId: req.storeId }).sort({ nextServiceDue: 1 });
    res.json({ success: true, data: equipment });
  } catch (error) {
    next(error);
  }
});

// ============ MARK AS SERVICED (resets the cycle) ============
router.put('/:equipmentId/service', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const equipment = await Equipment.findOne({ _id: req.params.equipmentId, storeId: req.storeId });
    if (!equipment) return res.status(404).json({ success: false, message: 'Equipment not found' });

    equipment.lastServiceDate = new Date();
    equipment.status = 'operational';
    equipment.notificationSentForCurrentCycle = false;
    await equipment.save(); // pre-save hook recalculates nextServiceDue

    res.json({ success: true, message: 'Equipment marked as serviced', data: equipment });
  } catch (error) {
    next(error);
  }
});

// ============ UPDATE EQUIPMENT ============
router.put('/:equipmentId', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const { name, type, serialNumber, serviceIntervalDays, status, notes } = req.body;
    const equipment = await Equipment.findOneAndUpdate(
      { _id: req.params.equipmentId, storeId: req.storeId },
      { name, type, serialNumber, serviceIntervalDays, status, notes },
      { new: true }
    );
    if (!equipment) return res.status(404).json({ success: false, message: 'Equipment not found' });
    res.json({ success: true, data: equipment });
  } catch (error) {
    next(error);
  }
});

// ============ DELETE EQUIPMENT ============
router.delete('/:equipmentId', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    await Equipment.findOneAndDelete({ _id: req.params.equipmentId, storeId: req.storeId });
    res.json({ success: true, message: 'Equipment removed' });
  } catch (error) {
    next(error);
  }
});

// ============ HELPER: CHECK ALL EQUIPMENT ACROSS ALL STORES ============
// Called by the cron job in src/jobs/equipmentServiceCheck.js
async function checkEquipmentServiceDue() {
  const now = new Date();
  const dueSoonWindow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3-day warning window

  const dueEquipment = await Equipment.find({
    nextServiceDue: { $lte: dueSoonWindow },
    status: { $ne: 'out_of_service' },
    notificationSentForCurrentCycle: false,
  });

  for (const eq of dueEquipment) {
    eq.status = 'due_for_service';
    eq.notificationSentForCurrentCycle = true;
    await eq.save();

    await notifyStoreLeadership({
      storeId: eq.storeId,
      includeManagers: true,
      type: 'equipment_service_due',
      title: `Service due: ${eq.name}`,
      message: `${eq.name} (${eq.type || 'equipment'}) is due for service on ${eq.nextServiceDue.toDateString()}. Please schedule maintenance.`,
      relatedId: eq._id,
    });
  }

  return dueEquipment.length;
}

router.helpers = { checkEquipmentServiceDue };

module.exports = router;
