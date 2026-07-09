const express = require('express');
const crypto = require('crypto');
const { User } = require('../models');
const { verifyToken, resolveStoreScope, authorizeGm } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

const router = express.Router();

// Roles the GM is allowed to assign, per store narrowing for Stacey Fountain.
const ASSIGNABLE_ROLES = ['general_manager', 'manager', 'accountant', 'driver', 'supervisor'];

function generatePassword() {
  // e.g. "Stc-7f2a9c1b" - readable enough to communicate, strong enough to pass.
  return `Stc-${crypto.randomBytes(6).toString('hex')}`;
}

// ============ ADD STAFF + GENERATE PASSWORD ============
router.post('/', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const { email, fullName, phone, role } = req.body;

    if (!email || !fullName || !role) {
      return res.status(400).json({ success: false, message: 'email, fullName and role are required' });
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }

    const generatedPassword = generatePassword();

    const staff = await User.create({
      email: email.toLowerCase(),
      password_hash: generatedPassword, // hashed by pre-save hook
      fullName,
      phone,
      role,
      storeId: req.storeId,
      mustChangePassword: true,
      createdBy: req.user.userId,
    });

    await sendEmail({
      to: staff.email,
      subject: 'Your Stacey POS account has been created',
      html: `
        <p>Hello ${fullName},</p>
        <p>An account has been created for you on Stacey POS with the role of <b>${role.replace('_', ' ')}</b>.</p>
        <p><b>Email:</b> ${staff.email}<br/><b>Temporary password:</b> ${generatedPassword}</p>
        <p>Please log in and change your password immediately.</p>
      `,
    });

    res.status(201).json({
      success: true,
      message: 'Staff created. Login details have been emailed to them.',
      data: {
        id: staff._id,
        email: staff.email,
        fullName: staff.fullName,
        role: staff.role,
        generatedPassword, // returned once so GM can hand it over manually if email fails
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============ LIST STAFF FOR CURRENT STORE ============
router.get('/', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const staff = await User.find({ storeId: req.storeId }).select('-password_hash').sort({ fullName: 1 });
    res.json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
});

// ============ UPDATE ROLE / DEACTIVATE ============
router.put('/:userId', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const { role, isActive, phone, fullName } = req.body;
    if (role && !ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` });
    }

    const staff = await User.findOneAndUpdate(
      { _id: req.params.userId, storeId: req.storeId },
      { ...(role && { role }), ...(isActive !== undefined && { isActive }), phone, fullName },
      { new: true }
    ).select('-password_hash');

    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });
    res.json({ success: true, message: 'Staff updated', data: staff });
  } catch (error) {
    next(error);
  }
});

// ============ RESET PASSWORD (regenerate + email) ============
router.post('/:userId/reset-password', verifyToken, resolveStoreScope, authorizeGm(), async (req, res, next) => {
  try {
    const staff = await User.findOne({ _id: req.params.userId, storeId: req.storeId });
    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found' });

    const generatedPassword = generatePassword();
    staff.password_hash = generatedPassword;
    staff.mustChangePassword = true;
    await staff.save();

    await sendEmail({
      to: staff.email,
      subject: 'Your Stacey POS password has been reset',
      html: `<p>Your new temporary password is: <b>${generatedPassword}</b>. Please log in and change it immediately.</p>`,
    });

    res.json({ success: true, message: 'Password reset and emailed to staff member', data: { generatedPassword } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
