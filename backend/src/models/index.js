const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// ============ USER SCHEMA ============

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    password_hash: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: {
        values: ['owner', 'general_manager', 'accountant', 'clerical', 'driver', 'security', 'manager', 'supervisor', 'staff', 'secretary'],
        message: 'Invalid role',
      },
      default: 'staff',
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
    },
    // FIX: added - needed by stores.js so an `owner` can be granted access to
    // more than one store (e.g. both Fountain and Farm) for the store
    // switcher dropdown. Leave empty for a normal single-store staff member.
    accessibleStoreIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
      },
    ],
    // FIX: added - needed by staff.js. When the GM creates a new staff
    // account with an auto-generated password, this flag forces them to
    // change it on first login.
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    // FIX: added - so you can see who created a staff account.
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ storeId: 1 });
userSchema.index({ isActive: 1 });

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next();

  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS || 12));
    this.password_hash = await bcrypt.hash(this.password_hash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Update updatedAt timestamp
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.password_hash);
};

// Check if account is locked
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function () {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 15 * 60 * 1000;

  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

// Check if user can access a specific store
// FIX: updated to respect accessibleStoreIds for an owner who is restricted
// to specific stores. An owner with an empty accessibleStoreIds list is
// treated as unrestricted (can access every store) - that's the default.
userSchema.methods.canAccessStore = function (storeId) {
  if (this.role === 'owner') {
    if (!this.accessibleStoreIds || this.accessibleStoreIds.length === 0) return true;
    return this.accessibleStoreIds.some((id) => id.toString() === storeId?.toString());
  }
  return this.storeId?.toString() === storeId?.toString();
};

// FIX: added - small helper so route files can treat 'owner' and
// 'general_manager' as equivalent without repeating the role check everywhere.
userSchema.methods.isGmEquivalent = function () {
  return this.role === 'owner' || this.role === 'general_manager';
};

// ============ STORE SCHEMA ============

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: ['fountain', 'farm'],
        message: 'Store type must be either fountain or farm',
      },
      required: true,
    },
    config: {
      expenseApprovalThreshold: {
        type: Number,
        default: 50000,
      },
      minStockThreshold: {
        type: Number,
        default: 20,
      },
      currency: {
        type: String,
        default: 'NGN',
      },
      // FIX: added - needed by customers.js for the token-rewards math.
      rewardRules: {
        sachetBagsPerToken: { type: Number, default: 2 },
        tokensPerFreePack: { type: Number, default: 5 },
      },
      // Store-specific expense categories added on top of the predefined
      // fountain/farm lists (see expensesRoute.js categoriesForStoreType).
      customExpenseCategories: { type: [String], default: [] },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'stores',
  }
);

// ============ PRODUCT SCHEMA ============

const productSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
    },
    description: String,
    unitName: {
      type: String,
      required: true,
      enum: {
        // FIX: added 'bird' - Stacey Farm sells layers/broilers by the bird,
        // and the original enum would reject creating those products.
        values: ['pack', 'bag', 'crate', 'bottle', 'bird', 'unit'],
        message: 'Invalid unit',
      },
    },
    // FIX: added - lightweight classification, e.g. "layer" / "broiler".
    category: { type: String, trim: true },
    currentStock: {
      type: Number,
      default: 0,
      min: 0,
    },
    minThreshold: {
      type: Number,
      default: 20,
      min: 0,
    },
    pricePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },

    costPerUnit: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'products',
  }
);

// Indexes
productSchema.index({ storeId: 1 });
productSchema.index({ sku: 1 });


// ============ SALE SCHEMA ============
const saleSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productName: String,
        quantity: Number,
        pricePerUnit: Number,
        total: Number,
      },
    ],
    totalAmount: { type: Number, required: true },
    costOfGoods: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['cash', 'transfer', 'card'], default: 'cash' },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priceOverridden: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'sales' }
);

saleSchema.index({ storeId: 1, timestamp: -1 });

// ============ STOCK MOVEMENT SCHEMA ============
const stockMovementSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      // FIX: this is the actual bug you hit. 'manual_past_sale' was missing
      // from this list, so Mongoose rejected it before it ever reached the DB.
      // 'sale' and 'damage_out' added so every stock-affecting event lands in
      // this one ledger (used by the Inventory Movement module).
      enum: ['in', 'out', 'return_in', 'manual_past_sale', 'production_in', 'sale', 'damage_out'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    // Snapshot of Product.currentStock immediately after this movement was
    // applied, so the Inventory Movement ledger can show a running balance
    // without re-deriving it from history at read time. Null for entries
    // that don't touch live stock (e.g. manual_past_sale backfills).
    balanceAfter: {
      type: Number,
      default: null,
    },
    recordedBy: mongoose.Schema.Types.ObjectId,
    notes: String,
    // FIX: added - stockRoute.js's manual-past-sale endpoint sets this, but
    // it was silently dropped before because it wasn't declared in the schema
    // (Mongoose strips unknown fields by default rather than erroring).
    manualEntryDate: Date,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, collection: 'stock_movements' }
);

stockMovementSchema.index({ storeId: 1, productId: 1, timestamp: -1 });

// ============ EXPENSE SCHEMA ============
const expenseSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    // Not an enum: owner/GM/manager/accountant can add custom categories per
    // store (see expensesRoute.js categoriesForStoreType +
    // Store.config.customExpenseCategories), so validation happens at the
    // route layer against the predefined + custom list, not here.
    category: {
      type: String,
      required: true,
      trim: true,
    },
    amount: { type: Number, required: true },
    description: String,
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'expenses' }
);

expenseSchema.index({ storeId: 1, timestamp: -1 });

// ============ CUSTOMER SCHEMA (with token rewards) ============

const customerSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    purchaseHistory: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        productName: String,
        category: { type: String, enum: ['sachet', 'bottle', 'other'], default: 'other' },
        quantity: Number,
        date: { type: Date, default: Date.now },
        recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],

    supplySchedule: {
      frequency: { type: String, enum: ['daily', 'weekly', 'biweekly', 'monthly'], default: 'weekly' },
      quantityPerSupply: { type: Number, default: 0 },
      nextSupplyDate: Date,
      lastSupplyDate: Date,
      isOnSchedule: { type: Boolean, default: false },
    },
    weeklySachetBags: { type: Number, default: 0 },
    weeklyBottles: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
    tokensRedeemed: { type: Number, default: 0 },
    freePacksEarned: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastPurchaseAt: Date,
  },
  { timestamps: true, collection: 'customers' }
);

customerSchema.index({ storeId: 1, name: 1 });

// ============ ACTIVITY LOG SCHEMA (every product sold) ============

const activityLogSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    quantity: Number,
    action: { type: String, enum: ['sold', 'returned', 'stock_in', 'stock_out'], default: 'sold' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByName: String,
    date: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'activity_logs' }
);

activityLogSchema.index({ storeId: 1, date: -1 });
activityLogSchema.index({ performedBy: 1, date: -1 });

// ============ EQUIPMENT SCHEMA (factory machines / maintenance) ============

const equipmentSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, trim: true },
    serialNumber: String,
    lastServiceDate: Date,
    serviceIntervalDays: { type: Number, default: 90 },
    nextServiceDue: Date,
    status: { type: String, enum: ['operational', 'due_for_service', 'under_maintenance', 'out_of_service'], default: 'operational' },
    notificationSentForCurrentCycle: { type: Boolean, default: false },
    notes: String,
  },
  { timestamps: true, collection: 'equipment' }
);

equipmentSchema.pre('save', function (next) {
  if (this.lastServiceDate && this.serviceIntervalDays) {
    this.nextServiceDue = new Date(this.lastServiceDate.getTime() + this.serviceIntervalDays * 24 * 60 * 60 * 1000);
  }
  next();
});

equipmentSchema.index({ storeId: 1, nextServiceDue: 1 });

// ============ DRIVER LOCATION SCHEMA (real-time GPS tracking) ============

const driverLocationSchema = new mongoose.Schema(
  {
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    latitude: Number,
    longitude: Number,
    // NEW: human-readable address, resolved server-side at the moment of
    // the ping so we never have to re-geocode the same point twice.
    address: String,
    targetLocations: [
      {
        label: String,
        address: String, // NEW
        latitude: Number,
        longitude: Number,
        visited: { type: Boolean, default: false },
      },
    ],
    distanceCoveredKm: { type: Number, default: 0 },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'driver_locations' }
);
// ============ RETURNS SCHEMA ============

const returnSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: String,
    quantity: { type: Number, required: true },
    reason: String,
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    // FIX: snapshot of the product's price at the moment the return was
    // recorded, so its write-off value in past dashboard periods doesn't
    // silently drift every time the product's current price changes later.
    // Legacy records created before this field existed will have it as 0.
    pricePerUnit: { type: Number, default: 0 },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedByRole: String,
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    restocked: { type: Boolean, default: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'returns' }
);

returnSchema.index({ storeId: 1, timestamp: -1 });

// ============ NOTIFICATION SCHEMA (in-app, mirrors emails) ============

const notificationSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['low_stock', 'equipment_service_due', 'expense_pending', 'return_recorded', 'production_recorded', 'general'], default: 'general' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedId: mongoose.Schema.Types.ObjectId,
    isRead: { type: Boolean, default: false },
    emailSent: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'notifications' }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

// ============ DAMAGE SCHEMA ============

const damageSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true},
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true},
    productName: String,
    quantity: { type: Number, required: true},
    reason: {
      type: String,
      enum: ['cracked', 'broken', 'contaminated', 'rotten', 'other'],
      default: 'other',
    },
    costValue: { type: Number, required: true},
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedByRole: String,
    notes: String,
    timestamp: { type: Date, default: Date.now },
    
  },
  { timestamps: true, collection: 'damages' }
)

damageSchema.index({ storeId: 1, timestamp: -1 });

// ============ RAW MATERIAL SCHEMA (Stacey Fountain production inputs) ============

const rawMaterialSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    name: { type: String, required: true, trim: true },
    // Not an enum: owner/GM/manager/accountant can add raw material types
    // beyond the original bottled-water lineup (preform/caps/labels/nylon),
    // so this is a slug derived from `name` rather than a fixed list.
    materialKey: {
      type: String,
      required: true,
      trim: true,
    },
    productLine: { type: String, enum: ['bottled', 'sachet'], required: true },
    purchaseUnitName: { type: String, required: true, trim: true },
    // Editable rather than hardcoded - factory-specific yields (e.g. pieces
    // per bag/roll) vary by supplier and aren't all known yet.
    piecesPerPurchaseUnit: { type: Number, required: true, min: 0.0001 },
    currentStockPurchaseUnits: { type: Number, default: 0, min: 0 },
    minThresholdPurchaseUnits: { type: Number, default: 0, min: 0 },
    costPerPurchaseUnit: { type: Number, default: 0, min: 0 },
    notes: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'raw_materials' }
);

rawMaterialSchema.index({ storeId: 1, materialKey: 1 }, { unique: true });
rawMaterialSchema.index({ storeId: 1, productLine: 1 });

// ============ RAW MATERIAL MOVEMENT SCHEMA (ledger, mirrors StockMovement) ============

const rawMaterialMovementSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    rawMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    type: { type: String, enum: ['restock_in', 'production_consume', 'adjustment'], required: true },
    quantityPurchaseUnits: { type: Number, required: true },
    productionBatchId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionBatch' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'raw_material_movements' }
);

rawMaterialMovementSchema.index({ storeId: 1, rawMaterialId: 1, timestamp: -1 });

// ============ PRODUCTION BATCH SCHEMA ============

const productionBatchSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    productLine: { type: String, enum: ['bottled', 'sachet'], required: true },
    finishedProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    finishedProductName: String,

    // Bottled-water-only
    preformMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
    bottlesProduced: { type: Number, default: 0, min: 0 },
    preformLeakageCount: { type: Number, default: 0, min: 0 },
    packsProduced: { type: Number, default: 0, min: 0 },

    // Sachet-water-only
    sachetsProduced: { type: Number, default: 0, min: 0 },
    sachetLeakageCount: { type: Number, default: 0, min: 0 },
    bagsProduced: { type: Number, default: 0, min: 0 },

    // Snapshot of what was actually consumed, immune to later edits of a
    // RawMaterial's piecesPerPurchaseUnit.
    materialsConsumed: [
      {
        rawMaterialId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
        materialKey: String,
        piecesConsumed: Number,
        purchaseUnitsConsumed: Number,
      },
    ],

    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recordedByRole: String,
    notes: String,
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'production_batches' }
);

productionBatchSchema.index({ storeId: 1, productLine: 1, timestamp: -1 });

// ============ EXPORT MODELS ============

// ============ VACCINATION / MEDICATION RECORD SCHEMA (Stacey Farm) ============

const vaccinationRecordSchema = new mongoose.Schema(
  {
    storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
    type: { type: String, enum: ['vaccination', 'medication'], required: true },
    name: { type: String, required: true, trim: true },
    batchOrFlockLabel: { type: String, trim: true },
    dosage: { type: String, trim: true },
    administeredDate: { type: Date, default: Date.now },
    nextDueDate: Date,
    administeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,
  },
  { timestamps: true, collection: 'vaccination_records' }
);

vaccinationRecordSchema.index({ storeId: 1, administeredDate: -1 });

const User = mongoose.model('User', userSchema);
const Store = mongoose.model('Store', storeSchema);
const Product = mongoose.model('Product', productSchema);
const Sale = mongoose.model('Sale', saleSchema);
const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
const Expense = mongoose.model('Expense', expenseSchema);
const Customer = mongoose.model('Customer', customerSchema);
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
const Equipment = mongoose.model('Equipment', equipmentSchema);
const DriverLocation = mongoose.model('DriverLocation', driverLocationSchema);
const Return = mongoose.model('Return', returnSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Damage = mongoose.model('Damage', damageSchema);
const RawMaterial = mongoose.model('RawMaterial', rawMaterialSchema);
const RawMaterialMovement = mongoose.model('RawMaterialMovement', rawMaterialMovementSchema);
const ProductionBatch = mongoose.model('ProductionBatch', productionBatchSchema);
const VaccinationRecord = mongoose.model('VaccinationRecord', vaccinationRecordSchema);

module.exports = {
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
};