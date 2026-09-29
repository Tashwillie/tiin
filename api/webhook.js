const { stripeClient, json } = require('../lib/stripe');
const { syncPaidContact, applyRefundTag } = require('../lib/ghl');

module.exports.config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function refundContactFromCharge(stripe, charge) {
  let email = (charge.billing_details && charge.billing_details.email)
    || charge.receipt_email
    || '';
  let phone = (charge.billing_details && charge.billing_details.phone) || '';
  if ((!email || !phone) && charge.payment_intent) {
    try {
      const intent = await stripe.paymentIntents.retrieve(charge.payment_intent);
      const meta = intent.metadata || {};
      email = email || meta.email || intent.receipt_email || '';
      phone = phone || meta.phone || '';
    } catch (err) {
      console.error('[webhook] refund lookup', err.message);
    }
  }
  return { email, phone };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return json(res, 503, { error: 'Webhook is not configured.' });
  }

  const raw = await readRawBody(req);
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    console.error('[webhook] signature', err.message);
    return json(res, 400, { error: 'Invalid signature.' });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    console.log('[paid]', intent.id, intent.metadata);
    try {
      const ghl = await syncPaidContact(intent, event.livemode);
      if (ghl) console.log('[ghl] contact', ghl.contactId, ghl.isNew ? 'created' : 'updated');
    } catch (err) {
      console.error('[ghl]', err.message, err.payload || '');
      return json(res, 500, { error: 'Paid, but the CRM sync failed. Stripe will retry.' });
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    console.error('[failed]', intent.id, intent.last_payment_error && intent.last_payment_error.message);
    try {
      const ghl = await syncPaidContact(intent, event.livemode, ['Payment Failed']);
      if (ghl) console.log('[ghl] payment failed tag applied', ghl.contactId);
    } catch (err) {
      console.error('[ghl] failed payment tag', err.message, err.payload || '');
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const { email, phone } = await refundContactFromCharge(stripe, charge);
    if (email || phone) {
      try {
        const contactId = await applyRefundTag({ email, phone }, event.livemode);
        if (contactId) console.log('[ghl] refund tag applied', contactId);
      } catch (err) {
        console.error('[ghl] refund tag', err.message, err.payload || '');
      }
    }
  }

  return json(res, 200, { received: true });
};
