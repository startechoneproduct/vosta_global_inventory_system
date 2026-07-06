const express = require('express');
const { Customer, Store } = require('../models');
const { verifyToken, resolveStoreScope } = require('../middleware/auth');

const router = express.Router();

function categorize(productName = '') {
  const n = productName.toLowerCase();
  if (n.includes('sachet') || n.includes('bag')) return 'sachet';
  if (n.includes('bottle')) return 'bottle';
  return 'other';
}

// ============ CREATE CUSTOMER (driver populates -> visible to GM) ============
router.post('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { name, phone, location } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Customer name is required' });

    const customer = await Customer.create({
      storeId: req.storeId,
      name,
      phone,
      location,
      createdBy: req.user.userId,
    });

    res.status(201).json({ success: true, message: 'Customer added', data: customer });
  } catch (error) {
    next(error);
  }
});

// ============ LIST CUSTOMERS ============
// GM/Manager/Accountant see all customers for the store; a driver only
// sees the customers they personally added.
router.get('/', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const query = { storeId: req.storeId };
    if (req.user.role === 'driver') query.createdBy = req.user.userId;

    const customers = await Customer.find(query).sort({ name: 1 });
    res.json({ success: true, data: customers });
  } catch (error) {
    next(error);
  }
});

// ============ GET SINGLE CUSTOMER ============
router.get('/:customerId', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.customerId, storeId: req.storeId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });
    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

// ============ DRIVER: RECORD A PURCHASE FOR A CUSTOMER ============
// This is how a driver's own dashboard input feeds token calculation,
// per the spec ("all calculated based on what the driver inputted").
router.post('/:customerId/purchases', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const { productId, productName, quantity } = req.body;
    if (!productName || !quantity || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'productName and positive quantity are required' });
    }

    const customer = await Customer.findOne({ _id: req.params.customerId, storeId: req.storeId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    await applyPurchaseToCustomerTokens(customer._id, [
      { productId, productName, quantity },
    ], req.user.userId);

    const updated = await Customer.findById(customer._id);
    res.json({ success: true, message: 'Purchase recorded and tokens updated', data: updated });
  } catch (error) {
    next(error);
  }
});

// ============ REDEEM TOKENS ============
router.post('/:customerId/redeem', verifyToken, resolveStoreScope, async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.customerId, storeId: req.storeId });
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const store = await Store.findById(req.storeId);
    const tokensPerFreePack = store?.config?.rewardRules?.tokensPerFreePack || 5;

    const availableTokens = customer.tokens - customer.tokensRedeemed;
    const packsToRedeem = Math.floor(availableTokens / tokensPerFreePack);

    if (packsToRedeem <= 0) {
      return res.status(400).json({ success: false, message: 'Not enough tokens to redeem a free pack yet' });
    }

    customer.tokensRedeemed += packsToRedeem * tokensPerFreePack;
    customer.freePacksEarned += packsToRedeem;
    await customer.save();

    res.json({ success: true, message: `${packsToRedeem} free pack(s) redeemed`, data: customer });
  } catch (error) {
    next(error);
  }
});

// ============ HELPER: TOKEN CALCULATION ============
// Exported for sales.js to call when a sale is tied to a customer.
async function applyPurchaseToCustomerTokens(customerId, items, recordedBy) {
  const customer = await Customer.findById(customerId);
  if (!customer) return null;

  const store = await Store.findById(customer.storeId);
  const rules = store?.config?.rewardRules || { sachetBagsPerToken: 2, tokensPerFreePack: 5 };

  for (const item of items) {
    const category = categorize(item.productName);
    customer.purchaseHistory.push({
      productId: item.productId,
      productName: item.productName,
      category,
      quantity: item.quantity,
      recordedBy,
    });

    if (category === 'sachet') customer.weeklySachetBags += item.quantity;
    if (category === 'bottle') customer.weeklyBottles += item.quantity;
  }

  // Tokens accrue from lifetime sachet bag count vs the store's rule
  // (e.g. 2 bags per token => 20 bags gives 10 tokens).
  customer.tokens = Math.floor(customer.weeklySachetBags / rules.sachetBagsPerToken);
  customer.lastPurchaseAt = new Date();

  await customer.save();
  return customer;
}

router.helpers = { applyPurchaseToCustomerTokens };

module.exports = router;
