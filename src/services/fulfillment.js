'use strict';

const Order = require('../models/Order');

/**
 * EXTENSION POINT: put your "deliver the product / issue the token / credit
 * the account" logic here. It receives the PAID order.
 *
 * run() guarantees onOrderPaid() is started at most once per order, even if
 * several requests (client polling + background poller) confirm the payment
 * at the same moment, because the guard is an atomic MongoDB update on
 * `fulfilledAt`. Make your own side effects idempotent too (e.g. key them by
 * order.orderId) in case you call external systems.
 */
async function onOrderPaid(order) {
  console.log(`[fulfil] order ${order.orderId} paid: ${order.amount} ${order.currency}`);
}

async function run(order) {
  const claimed = await Order.findOneAndUpdate(
    { orderId: order.orderId, status: 'PAID', fulfilledAt: null },
    { $set: { fulfilledAt: new Date() } },
    { new: true }
  );
  if (!claimed) return; // already fulfilled by someone else
  try {
    await onOrderPaid(claimed);
  } catch (err) {
    console.error(`[fulfil] order ${order.orderId} failed:`, err);
    await Order.updateOne(
      { orderId: order.orderId },
      { $set: { fulfillmentError: String(err && err.message).slice(0, 300) } }
    );
  }
}

module.exports = { run, onOrderPaid };
