const { stripeClient, json } = require('../lib/stripe');

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
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object;
    console.error('[failed]', intent.id, intent.last_payment_error && intent.last_payment_error.message);
  }

  return json(res, 200, { received: true });
};
