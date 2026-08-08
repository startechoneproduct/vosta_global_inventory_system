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
  Damage,
  RawMaterial,
  RawMaterialMovement,
  ProductionBatch,
  VaccinationRecord,
} = require('../src/models');

const STORES = [
  {
    name: 'Stacey Fountain',
    type: 'fountain',
    config: {
      expenseApprovalThreshold: 50000,
      minStockThreshold: 20,
      rewardRules: { sachetBagsPerToken: 2, tokensPerFreePack: 5 },
    },
  },
  {
    name: 'Stacey Farm',
    type: 'farm',
    config: { expenseApprovalThreshold: 100000, minStockThreshold: 10 },
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('\n📦 Starting database seed (real users only)...\n');

    await Promise.all([
      User.deleteMany({}),
      Store.deleteMany({}),
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
      Damage.deleteMany({}),
      RawMaterial.deleteMany({}),
      RawMaterialMovement.deleteMany({}),
      ProductionBatch.deleteMany({}),
      VaccinationRecord.deleteMany({}),
    ]);
    console.log('   🗑️  All existing data cleared');

    const fountainStore = await Store.create(STORES[0]);
    const farmStore = await Store.create(STORES[1]);
    console.log(`   ✅ Stacey Fountain: ${fountainStore._id}`);
    console.log(`   ✅ Stacey Farm: ${farmStore._id}`);

    // Owner has global access (accessibleStoreIds spans both stores).
    const users = await User.create([
      {
        email: 'admin@vostaglobal.org',
        password_hash: 'SecuredLink',
        fullName: 'Super Admin',
        role: 'owner',
        storeId: fountainStore._id,
        accessibleStoreIds: [fountainStore._id, farmStore._id],
      },
      {
        email: 'manager@staceyfountains.com',
        password_hash: 'ManagerMail@1',
        fullName: 'Stacey Fountain Manager',
        role: 'manager',
        storeId: fountainStore._id,
      },
      {
        email: 'accountant@staceyfountains.com',
        password_hash: 'AccountantMail@1',
        fullName: 'Stacey Fountain Accountant',
        role: 'accountant',
        storeId: fountainStore._id,
      },
      {
        email: 'manager@staceyfarms.com.ng',
        password_hash: 'ManagerMail@1',
        fullName: 'Stacey Farm Manager',
        role: 'manager',
        storeId: farmStore._id,
      },
      {
        email: 'accountant@staceyfarms.com.ng',
        password_hash: 'AccountantMail@1',
        fullName: 'Stacey Farm Accountant',
        role: 'accountant',
        storeId: farmStore._id,
      },
    ]);

    console.log(`   ✅ Created ${users.length} real user accounts`);

    console.log(`
╔════════════════════════════════════════╗
║ ✅ DATABASE SEED SUCCESSFUL           ║
╚════════════════════════════════════════╝

🔐 Login Credentials:
   Super Admin:            admin@vostaglobal.org / SecuredLink
   Fountain Manager:       manager@staceyfountains.com / ManagerMail@1
   Fountain Accountant:    accountant@staceyfountains.com / AccountantMail@1
   Farm Manager:           manager@staceyfarms.com.ng / ManagerMail@1
   Farm Accountant:        accountant@staceyfarms.com.ng / AccountantMail@1

Both stores were created empty - no demo products, equipment, or raw
materials. Everything else in the database has been cleared.
    `);

    process.exit(0);
  } catch (error) {
    console.error('❌ SEED FAILED:', error.message);
    process.exit(1);
  }
}

seed();
