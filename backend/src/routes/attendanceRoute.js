const express = require('express');
const { verifyToken, resolveStoreScope } = require('../middleware/auth.js');
const { Attendance } = require('../models/index.js');

const router = express.Router();

// ============ CLOCK IN ============
router.post('/clock-in', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const storeId = req.storeId;

    // Check if already clocked in
    const existingLog = await Attendance.findOne({
      userId: req.user.userId,
      clockOut: null,
    });

    if (existingLog) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked in. Clock out first.',
      });
    }

    const log = await Attendance.create({
      userId: req.user.userId,
      storeId,
      clockIn: new Date(),
      status: 'present',
    });

    res.status(201).json({
      success: true,
      message: 'Clocked in successfully',
      data: log,
    });
  } catch (error) {
    next(error);
  }
});

// ============ CLOCK OUT ============
router.post('/clock-out', verifyToken, async (req, res, next) => {
  try {
    // Find open clock-in
    const log = await Attendance.findOne({
      userId: req.user.userId,
      clockOut: null,
    });

    if (!log) {
      return res.status(400).json({
        success: false,
        message: 'No active clock-in found',
      });
    }

    // Calculate hours worked
    const clockOut = new Date();
    const hoursWorked = (clockOut - log.clockIn) / (1000 * 60 * 60);

    log.clockOut = clockOut;
    log.hoursWorked = hoursWorked;
    await log.save();

    res.json({
      success: true,
      message: `Clocked out. Hours worked: ${hoursWorked.toFixed(2)}`,
      data: log,
    });
  } catch (error) {
    next(error);
  }
});

// ============ GET ATTENDANCE ============
router.get('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { userId, startDate, endDate } = req.query;

    let query = { storeId: req.storeId };
    if (userId) query.userId = userId;

    if (startDate || endDate) {
      query.clockIn = {};
      if (startDate) query.clockIn.$gte = new Date(startDate);
      if (endDate) query.clockIn.$lte = new Date(endDate);
    }

    const records = await Attendance.find(query)
      .populate('userId', 'fullName email')
      .sort({ clockIn: -1 })
      .limit(200);

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
});

// ============ GET MY CURRENT STATUS ============
router.get('/me/status', verifyToken, async (req, res, next) => {
  try {
    const activeLog = await Attendance.findOne({
      userId: req.user.userId,
      clockOut: null,
    });

    res.json({
      success: true,
      data: {
        clockedIn: !!activeLog,
        log: activeLog,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
