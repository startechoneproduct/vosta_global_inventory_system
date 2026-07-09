const { Notification, User } = require('../models');
const { sendEmail } = require('./email');

/**
 * Create an in-app notification for a user AND email them.
 * Pass `userIds` as an array to notify multiple people (e.g. GM + Manager).
 */
async function notifyUsers({ userIds, storeId, type, title, message, relatedId }) {
  const results = [];

  for (const userId of userIds) {
    try {
      const notification = await Notification.create({
        storeId,
        userId,
        type,
        title,
        message,
        relatedId,
      });

      const user = await User.findById(userId);
      if (user && user.email) {
        await sendEmail({
          to: user.email,
          subject: title,
          html: `<p>${message}</p>`,
        });
        notification.emailSent = true;
        await notification.save();
      }

      results.push(notification);
    } catch (error) {
      console.error(`Failed to notify user ${userId}:`, error.message);
    }
  }

  return results;
}

/**
 * Notify all GM-equivalent users (owner + general_manager) for a store,
 * plus optionally the manager(s) of that store.
 */
async function notifyStoreLeadership({ storeId, includeManagers = false, type, title, message, relatedId }) {
  const roles = includeManagers ? ['owner', 'general_manager', 'manager'] : ['owner', 'general_manager'];

  const [storeUsers, owners] = await Promise.all([
    User.find({ isActive: true, storeId, role: { $in: roles } }),
    User.find({ isActive: true, role: 'owner' }),
  ]);

  // An owner restricted to specific stores via accessibleStoreIds should
  // only be notified about stores they actually have access to - otherwise
  // a Farm-only owner would get emailed about every Fountain event too.
  const accessibleOwners = owners.filter((o) => o.canAccessStore(storeId));

  const userIds = [...new Set([...storeUsers, ...accessibleOwners].map((u) => u._id.toString()))];

  return notifyUsers({ userIds, storeId, type, title, message, relatedId });
}

module.exports = { notifyUsers, notifyStoreLeadership };
