require('dotenv').config();
const mongoose = require('mongoose');
const {
  User,
  Store,
  Product,
  Sale,
  StockMovement,
  Expense,
  Attendance,
  Customer,
  ActivityLog,
  Equipment,
  DriverLocation,
  Return,
  Notification,
} = require('../src/models/index.js');

/**
 * Wipes all seeded/demo/test data and leaves you with:
 *   - Both stores (Stacey Fountain, Stacey Farm) - empty shells, no products
 *   - Exactly ONE user: the owner, with a FIXED default login
 *
 * Everything else (products, sales, expenses, customers, activity logs,
 * equipment, driver locations, returns, notifications, attendance, stock
 * movements, and every non-owner staff account) is deleted.
 *
 * Usage:
 *   node scripts/resetData.js
 *
 * If you want to wipe the stores too (start with literally nothing, not
 * even Fountain/Farm defined), pass --wipe-stores:
 *   node scripts/resetData.js --wipe-stores
 * In that case the script recreates both stores fresh and empty afterward,
 * since the owner account needs at least one store to belong to.
 */

const WIPE_STORES = process.argv.includes('--wipe-stores');

// ============ FIXED OWNER CREDENTIALS ============
// Change these to whatever you actually want as your permanent default login.
const OWNER_EMAIL = 'admin@vostaglobal.org';
const OWNER_PASSWORD = 'SecuredLink';
const OWNER_FULL_NAME = 'Owner';

async function resetData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('\n🧹 Starting data reset...\n');

    // ============ WIPE EVERYTHING TRANSACTIONAL ============
    const wipeResults = await Promise.all([
      Product.deleteMany({}),
      Sale.deleteMany({}),
      StockMovement.deleteMany({}),
      Expense.deleteMany({}),
      Attendance.deleteMany({}),
      Customer.deleteMany({}),
      ActivityLog.deleteMany({}),
      Equipment.deleteMany({}),
      DriverLocation.deleteMany({}),
      Return.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    const labels = [
      'Products',
      'Sales',
      'Stock Movements',
      'Expenses',
      'Attendance',
      'Customers',
      'Activity Logs',
      'Equipment',
      'Driver Locations',
      'Returns',
      'Notifications',
    ];
    wipeResults.forEach((result, i) => {
      console.log(`   🗑️  ${labels[i]}: ${result.deletedCount} removed`);
    });

    // ============ WIPE ALL NON-OWNER USERS ============
    const staffWipe = await User.deleteMany({
      email: { $ne: OWNER_EMAIL.toLowerCase() },
    });
    console.log(
      `   🗑️  Staff accounts: ${staffWipe.deletedCount} removed (owner preserved)`,
    );

    // ============ STORES ============
    let fountainStore, farmStore;

    if (WIPE_STORES) {
      await Store.deleteMany({});
      console.log('   🗑️  Stores wiped (--wipe-stores flag was set)');

      fountainStore = await Store.create({
        name: 'Stacey Fountain',
        type: 'fountain',
        config: {
          expenseApprovalThreshold: 50000,
          minStockThreshold: 20,
          rewardRules: { sachetBagsPerToken: 2, tokensPerFreePack: 5 },
        },
      });
      farmStore = await Store.create({
        name: 'Stacey Farm',
        type: 'farm',
        config: { expenseApprovalThreshold: 100000, minStockThreshold: 10 },
      });
      console.log(
        '   ✅ Recreated empty Stacey Fountain and Stacey Farm stores',
      );
    } else {
      fountainStore = await Store.findOne({ type: 'fountain' });
      farmStore = await Store.findOne({ type: 'farm' });

      if (!fountainStore) {
        fountainStore = await Store.create({
          name: 'Stacey Fountain',
          type: 'fountain',
          config: {
            expenseApprovalThreshold: 50000,
            minStockThreshold: 20,
            rewardRules: { sachetBagsPerToken: 2, tokensPerFreePack: 5 },
          },
        });
        console.log('   ✅ Stacey Fountain store did not exist - created it');
      } else {
        console.log('   ↺  Stacey Fountain store kept as-is');
      }

      if (!farmStore) {
        farmStore = await Store.create({
          name: 'Stacey Farm',
          type: 'farm',
          config: { expenseApprovalThreshold: 100000, minStockThreshold: 10 },
        });
        console.log('   ✅ Stacey Farm store did not exist - created it');
      } else {
        console.log('   ↺  Stacey Farm store kept as-is');
      }
    }

    // ============ OWNER ACCOUNT (create fresh, or reset if it survived) ============
    let owner = await User.findOne({ email: OWNER_EMAIL.toLowerCase() });

    if (owner) {
      // Force the password back to the known default and make sure it's
      // active and has full store access, in case anything drifted.
      owner.password_hash = OWNER_PASSWORD; // re-hashed by the pre-save hook
      owner.role = 'owner';
      owner.isActive = true;
      owner.mustChangePassword = false;
      owner.accessibleStoreIds = [fountainStore._id, farmStore._id];
      owner.storeId = fountainStore._id;
      await owner.save();
      console.log(
        `   ↺  Owner account reset to default password: ${OWNER_EMAIL}`,
      );
    } else {
      owner = await User.create({
        email: OWNER_EMAIL.toLowerCase(),
        password_hash: OWNER_PASSWORD,
        fullName: OWNER_FULL_NAME,
        role: 'owner',
        storeId: fountainStore._id,
        accessibleStoreIds: [fountainStore._id, farmStore._id],
      });
      console.log(`   ✅ Owner account created: ${OWNER_EMAIL}`);
    }

    console.log(`
╔════════════════════════════════════════════════════╗
║ ✅ RESET COMPLETE                                   ║
╚════════════════════════════════════════════════════╝

🔐 Default login (unchanged, always available):
   Email:    ${OWNER_EMAIL}
   Password: ${OWNER_PASSWORD}

Everything else - products, sales, staff, expenses, customers, equipment,
driver locations, returns, notifications, attendance - has been cleared.
${WIPE_STORES ? 'Stores were wiped and recreated empty.' : 'Stores were left intact (or created fresh if missing).'}
    `);

    process.exit(0);
  } catch (error) {
    console.error('❌ RESET FAILED:', error.message);
    console.error(error);
    process.exit(1);
  }
}

resetData();
