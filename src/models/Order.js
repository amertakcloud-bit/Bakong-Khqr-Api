'use strict';

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    hash: { type: String },
    fromAccountId: String,
    toAccountId: String,
    currency: String,
    amount: Number,
    description: String,
    createdDateMs: Number,
    acknowledgedDateMs: Number,
    instructionRef: String,
    externalRef: String,
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, enum: ['USD', 'KHR'], required: true },
    status: { type: String, enum: ['PENDING', 'PAID', 'EXPIRED', 'FAILED'], default: 'PENDING', index: true },

    // KHQR metadata
    qr: { type: String, required: true },
    md5: { type: String, required: true, index: true },
    bakongAccountId: { type: String, required: true },
    expiresAt: { type: Date, required: true },

    // Payment result (set once, atomically, by the PENDING -> PAID transition)
    paidAt: Date,
    transaction: { type: transactionSchema, default: undefined },
    failureReason: String,
    failedTransaction: mongoose.Schema.Types.Mixed, // kept for manual review

    // Fulfilment guard: set exactly once by the winner of an atomic update
    fulfilledAt: { type: Date, default: null },
    fulfillmentError: String,

    // Check bookkeeping (also used to throttle calls to Bakong)
    lastCheckedAt: { type: Date, default: null },
    checkCount: { type: Number, default: 0 },
    lastError: { type: mongoose.Schema.Types.Mixed, default: null },

    ipHash: { type: String, index: true },
  },
  { timestamps: true }
);

// One Bakong transaction can only ever pay one order.
orderSchema.index(
  { 'transaction.hash': 1 },
  { unique: true, partialFilterExpression: { 'transaction.hash': { $type: 'string' } } }
);
orderSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
