const jwt = require('jsonwebtoken');
const { User } = require('../models');

// ============ VERIFY JWT TOKEN ============

const verifyToken = (req, res, next) => {
  try {
    const token = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'No authentication token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token' });
  }
};

// ============ CHECK ROLE AUTHORIZATION ============

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
};

// ============ GM-EQUIVALENT CHECK (owner or general_manager) ============
// Owner and general_manager have identical permissions; only "owner" can
// additionally switch between stores.
const authorizeGm = () => authorize('owner', 'general_manager');

// ============ STORE SCOPING ============
// Resolves which storeId the current request should operate against and
// verifies the user is allowed to touch it. Attaches req.storeId.
//
// Rules:
// - owner: may pass ?storeId= (or body.storeId) to select any store they
//   have access to. Falls back to their default storeId if none given.
// - everyone else: locked to their own storeId; if they try to pass a
//   different storeId it is ignored/rejected.
const resolveStoreScope = async (req, res, next) => {
  try {
    const requestedStoreId = req.body.storeId || req.query.storeId;

    if (req.user.role === 'owner') {
      const user = await User.findById(req.user.userId);
      const targetStoreId = requestedStoreId || user.storeId;

      if (!targetStoreId) {
        return res.status(400).json({ success: false, message: 'No store selected. Please choose a store.' });
      }

      if (!user.canAccessStore(targetStoreId)) {
        return res.status(403).json({ success: false, message: 'You do not have access to this store.' });
      }

      req.storeId = targetStoreId.toString();
      return next();
    }

    // Non-owner: force their own storeId regardless of what was requested
    if (!req.user.storeId) {
      return res.status(403).json({ success: false, message: 'Your account is not assigned to a store.' });
    }

    if (requestedStoreId && requestedStoreId.toString() !== req.user.storeId.toString()) {
      return res.status(403).json({ success: false, message: 'You cannot access a different store.' });
    }

    req.storeId = req.user.storeId.toString();
    next();
  } catch (error) {
    next(error);
  }
};

// ============ OPTIONAL AUTH ============

const optionalAuth = (req, res, next) => {
  try {
    const token = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  verifyToken,
  authorize,
  authorizeGm,
  resolveStoreScope,
  optionalAuth,
};
