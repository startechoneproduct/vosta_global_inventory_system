require("dotenv").config();
const mongoose = require("mongoose");
const { User, Store, Product, Equipment } = require("../src/models");

const STORES = [
  {
    name: "Stacey Fountain",
    type: "fountain",
    config: {
      expenseApprovalThreshold: 50000,
      minStockThreshold: 20,
      rewardRules: { sachetBagsPerToken: 2, tokensPerFreePack: 5 },
    },
  },
  {
    name: "Stacey Farm",
    type: "farm",
    config: { expenseApprovalThreshold: 100000, minStockThreshold: 10 },
  },
];

const PRODUCTS_FOUNTAIN = [
  {
    sku: "SKU-SF-001",
    name: "Bottled Water 50cl Pack",
    description: "Premium bottled water in 50cl packs",
    unitName: "pack",
    currentStock: 150,
    minThreshold: 30,
    pricePerUnit: 50000,
  },
  {
    sku: "SKU-SF-002",
    name: "Bottled Water 75cl Pack",
    description: "Premium bottled water in 75cl packs",
    unitName: "pack",
    currentStock: 120,
    minThreshold: 20,
    pricePerUnit: 75000,
  },
  {
    sku: "SKU-SF-003",
    name: "Sachet Water Bag",
    description: "Sachet water bags (bulk)",
    unitName: "bag",
    currentStock: 250,
    minThreshold: 50,
    pricePerUnit: 30000,
  },
];

const PRODUCTS_FARM = [
  {
    sku: "SKU-SFM-001",
    name: "Eggs (Per Crate)",
    description: "Fresh farm eggs, sold per crate",
    unitName: "crate",
    currentStock: 60,
    minThreshold: 10,
    pricePerUnit: 500000,
  },
  {
    sku: "SKU-SFM-002",
    name: "Layer Feed Bag",
    description: "Bulk layer feed, 50kg per bag",
    unitName: "bag",
    currentStock: 45,
    minThreshold: 5,
    pricePerUnit: 800000,
  },
  {
    sku: "SKU-SFM-003",
    name: "Grower Feed Bag",
    description: "Bulk grower feed, 50kg per bag",
    unitName: "bag",
    currentStock: 35,
    minThreshold: 5,
    pricePerUnit: 750000,
  },
  {
    sku: "SKU-SFM-004",
    name: "Chicken Droppings (100kg)",
    description: "Aged chicken manure, 100kg per bag",
    unitName: "bag",
    currentStock: 25,
    minThreshold: 5,
    pricePerUnit: 300000,
  },
];

const FOUNTAIN_EQUIPMENT = [
  {
    name: "Filling Machine A",
    type: "Filling Machine",
    serviceIntervalDays: 60,
    lastServiceDate: new Date(),
  },
  {
    name: "Sealing Machine",
    type: "Sealing Machine",
    serviceIntervalDays: 45,
    lastServiceDate: new Date(),
  },
  {
    name: "Generator Set",
    type: "Generator",
    serviceIntervalDays: 30,
    lastServiceDate: new Date(),
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("\n📦 Starting database seed...\n");

    await User.deleteMany({});
    await Store.deleteMany({});
    await Product.deleteMany({});
    await Equipment.deleteMany({});

    const fountainStore = await Store.create(STORES[0]);
    const farmStore = await Store.create(STORES[1]);
    console.log(`   ✅ Stacey Fountain: ${fountainStore._id}`);
    console.log(`   ✅ Stacey Farm: ${farmStore._id}`);

    // Owner has global access (empty accessibleStoreIds = unrestricted)
    const users = await User.create([
      {
        email: "owner@stacey.com",
        password_hash: "Password@123",
        fullName: "Owner User",
        phone: "+234 801 123 4567",
        role: "owner",
        storeId: fountainStore._id,
        accessibleStoreIds: [fountainStore._id, farmStore._id],
      },
      {
        email: "manager@fountain.com",
        password_hash: "Password@123",
        fullName: "Fountain Manager",
        phone: "+234 802 234 5678",
        role: "manager",
        storeId: fountainStore._id,
      },
      {
        email: "accountant@fountain.com",
        password_hash: "Password@123",
        fullName: "Fountain Accountant",
        phone: "+234 803 345 6789",
        role: "accountant",
        storeId: fountainStore._id,
      },
      {
        email: "driver@fountain.com",
        password_hash: "Password@123",
        fullName: "Fountain Driver",
        phone: "+234 804 456 7890",
        role: "driver",
        storeId: fountainStore._id,
      },
    ]);

    console.log(
      `   ✅ Created ${users.length} Stacey Fountain users (owner, manager, accountant, driver)`,
    );

    await Product.create(
      PRODUCTS_FOUNTAIN.map((p) => ({ ...p, storeId: fountainStore._id })),
    );
    await Product.create(
      PRODUCTS_FARM.map((p) => ({ ...p, storeId: farmStore._id })),
    );
    await Equipment.create(
      FOUNTAIN_EQUIPMENT.map((e) => ({ ...e, storeId: fountainStore._id })),
    );

    console.log(`
╔════════════════════════════════════════╗
║ ✅ DATABASE SEED SUCCESSFUL           ║
╚════════════════════════════════════════╝

🔐 Demo Login Credentials (all use Password@123):
   Owner (switches stores):  owner@stacey.com
   Fountain Manager:         manager@fountain.com
   Fountain Accountant:      accountant@fountain.com
   Fountain Driver:          driver@fountain.com
    `);

    process.exit(0);
  } catch (error) {
    console.error("❌ SEED FAILED:", error.message);
    process.exit(1);
  }
}

seed();
