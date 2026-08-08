require('dotenv').config();
const mongoose = require('mongoose');
const {
  User,
  Store,
  Product,
  Sale,
  StockMovement,
  Expense,
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
 *   - Exactly the 5 real accounts below, each reset to its FIXED default login
 *
 * Everything else (products, sales, expenses, customers, activity logs,
 * equipment, driver locations, returns, notifications, stock
 * movements, and every staff account not listed below) is deleted.
 *
 * Usage:
 *   node scripts/resetData.js
 *
 * If you want to wipe the stores too (start with literally nothing, not
 * even Fountain/Farm defined), pass --wipe-stores:
 *   node scripts/resetData.js --wipe-stores
 * In that case the script recreates both stores fresh and empty afterward,
 * since these accounts need a store to belong to.
 */

const WIPE_STORES = process.argv.includes('--wipe-stores');

// ============ FIXED ACCOUNTS (real staff - preserved across every reset) ============
// Change these to whatever you actually want as your permanent default logins.
const FIXED_ACCOUNTS = [
  { email: 'admin@vostaglobal.org', password: 'SecuredLink', fullName: 'Super Admin', role: 'owner', store: 'both' },
  { email: 'manager@staceyfountains.com', password: 'ManagerMail@1', fullName: 'Stacey Fountain Manager', role: 'manager', store: 'fountain' },
  { email: 'accountant@staceyfountains.com', password: 'AccountantMail@1', fullName: 'Stacey Fountain Accountant', role: 'accountant', store: 'fountain' },
  { email: 'manager@staceyfarms.com.ng', password: 'ManagerMail@1', fullName: 'Stacey Farm Manager', role: 'manager', store: 'farm' },
  { email: 'accountant@staceyfarms.com.ng', password: 'AccountantMail@1', fullName: 'Stacey Farm Accountant', role: 'accountant', store: 'farm' },
];

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

    // ============ WIPE ALL STAFF EXCEPT THE FIXED ACCOUNTS ============
    const fixedEmails = FIXED_ACCOUNTS.map((a) => a.email.toLowerCase());
    const staffWipe = await User.deleteMany({
      email: { $nin: fixedEmails },
    });
    console.log(
      `   🗑️  Staff accounts: ${staffWipe.deletedCount} removed (${fixedEmails.length} fixed accounts preserved)`,
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

    // ============ FIXED ACCOUNTS (create fresh, or reset if they survived) ============
    for (const acct of FIXED_ACCOUNTS) {
      const storeId = acct.store === 'farm' ? farmStore._id : fountainStore._id;
      const accessibleStoreIds = acct.store === 'both' ? [fountainStore._id, farmStore._id] : undefined;

      let user = await User.findOne({ email: acct.email.toLowerCase() });

      if (user) {
        // Force the password back to the known default and make sure it's
        // active and correctly scoped, in case anything drifted.
        user.password_hash = acct.password; // re-hashed by the pre-save hook
        user.fullName = acct.fullName;
        user.role = acct.role;
        user.isActive = true;
        user.mustChangePassword = false;
        user.storeId = storeId;
        if (accessibleStoreIds) user.accessibleStoreIds = accessibleStoreIds;
        await user.save();
        console.log(`   ↺  ${acct.role} account reset to default password: ${acct.email}`);
      } else {
        await User.create({
          email: acct.email.toLowerCase(),
          password_hash: acct.password,
          fullName: acct.fullName,
          role: acct.role,
          storeId,
          ...(accessibleStoreIds && { accessibleStoreIds }),
        });
        console.log(`   ✅ ${acct.role} account created: ${acct.email}`);
      }
    }

    console.log(`
╔════════════════════════════════════════════════════╗
║ ✅ RESET COMPLETE                                   ║
╚════════════════════════════════════════════════════╝

🔐 Default logins (unchanged, always available):
${FIXED_ACCOUNTS.map((a) => `   ${a.role.padEnd(11)} ${a.email} / ${a.password}`).join('\n')}

Everything else - products, sales, other staff, expenses, customers,
equipment, driver locations, returns, notifications - has been cleared.
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
