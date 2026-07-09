const express = require('express');
const mongoose = require('mongoose');
const { DriverLocation, User } = require('../models');
const { verifyToken, resolveStoreScope, authorize, authorizeGm } = require('../middleware/auth');
const { reverseGeocode, forwardGeocode } = require('../utils/geocode');

const router = express.Router();

// ============ DRIVER: PUSH LOCATION UPDATE ============
router.post('/ping', verifyToken, resolveStoreScope, authorize('driver'), async (req, res, next) => {
  try {
    const { latitude, longitude, distanceCoveredKm } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'latitude and longitude are required' });
    }

    // NEW: resolve the coordinates to a human-readable address once, at the
    // moment of the ping, and store it - so nothing downstream (dashboards,
    // the live table) ever needs to work with raw numbers again.
    const address = await reverseGeocode(latitude, longitude);

    const entry = await DriverLocation.create({
      driverId: req.user.userId,
      storeId: req.storeId,
      latitude,
      longitude,
      address,
      distanceCoveredKm: distanceCoveredKm || 0,
      recordedAt: new Date(),
    });

    res.status(201).json({ success: true, data: { address, recordedAt: entry.recordedAt } });
  } catch (error) {
    next(error);
  }
});

// ============ DRIVER: SET TARGETED LOCATIONS FOR THE DAY ============
// CHANGED: drivers now type an address (e.g. "Wuse Market, Abuja") instead
// of raw latitude/longitude. Each address is forward-geocoded server-side
// into coordinates for internal GPS matching, but the driver never has to
// see or enter a single number.
router.post('/targets', verifyToken, resolveStoreScope, authorize('driver'), async (req, res, next) => {
  try {
    const { targetLocations } = req.body; // [{ label, address }]
    if (!Array.isArray(targetLocations) || targetLocations.length === 0) {
      return res.status(400).json({ success: false, message: 'targetLocations array is required' });
    }

    const resolvedTargets = [];
    for (const t of targetLocations) {
      if (!t.address) continue;
      const geocoded = await forwardGeocode(t.address);

      if (!geocoded) {
        return res.status(400).json({
          success: false,
          message: `Could not find a location for "${t.address}". Try a more specific address.`,
        });
      }

      resolvedTargets.push({
        label: t.label || geocoded.formattedAddress,
        address: geocoded.formattedAddress,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
      });
    }

    if (resolvedTargets.length === 0) {
      return res.status(400).json({ success: false, message: 'Provide at least one address' });
    }

    const entry = await DriverLocation.create({
      driverId: req.user.userId,
      storeId: req.storeId,
      latitude: resolvedTargets[0].latitude,
      longitude: resolvedTargets[0].longitude,
      address: resolvedTargets[0].address,
      targetLocations: resolvedTargets,
      recordedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      message: 'Target locations saved',
      data: { targetLocations: entry.targetLocations },
    });
  } catch (error) {
    next(error);
  }
});

// ============ GM/MANAGER: LIST ALL DRIVERS + LATEST LOCATION ============
router.get('/live', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const drivers = await User.find({ storeId: req.storeId, role: 'driver', isActive: true });

    const liveData = await Promise.all(
      drivers.map(async (driver) => {
        const latest = await DriverLocation.findOne({ driverId: driver._id }).sort({ recordedAt: -1 });
        return {
          driverId: driver._id,
          driverName: driver.fullName,
          // CHANGED: only the resolved address goes to the client now - no
          // latitude/longitude fields at all, so there's nothing numeric
          // for the frontend to accidentally render.
          address: latest?.address ?? null,
          targetLocations: (latest?.targetLocations ?? []).map((t) => ({ label: t.label, address: t.address })),
          lastUpdated: latest?.recordedAt ?? null,
        };
      })
    );

    res.json({ success: true, data: liveData });
  } catch (error) {
    next(error);
  }
});

// ============ DRIVER STATS: distance covered week/month/year ============
router.get('/me/stats', verifyToken, resolveStoreScope, authorize('driver'), async (req, res, next) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const driverObjectId = new mongoose.Types.ObjectId(req.user.userId);
    const sumSince = async (since) => {
      // $match in an aggregation pipeline does not auto-cast strings to
      // ObjectId the way find()/findOne() do - passing the raw JWT string
      // here silently matched zero documents and always returned 0.
      const result = await DriverLocation.aggregate([
        { $match: { driverId: driverObjectId, recordedAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: '$distanceCoveredKm' } } },
      ]);
      return result[0]?.total || 0;
    };

    const [week, month, year] = await Promise.all([sumSince(weekAgo), sumSince(monthAgo), sumSince(yearAgo)]);

    res.json({ success: true, data: { distanceKm: { week, month, year } } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;