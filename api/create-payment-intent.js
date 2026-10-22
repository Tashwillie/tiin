const {
  TASTER_SESSIONS,
  TASTER_SOLD_OUT,
  json,
  readJsonBody,
  buyerFromBody,
  createIntent,
  resolveTasterPromo,
} = require('../lib/stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return json(res, 400, { error: 'Invalid request.' });
  }

  const buyer = buyerFromBody(body);
  if (buyer.error) return json(res, 400, { error: buyer.error });
  if (TASTER_SOLD_OUT.includes(buyer.session)) {
    return json(res, 400, { error: 'That session is sold out. Please choose the next available date.' });
  }
  if (!TASTER_SESSIONS.includes(buyer.session)) {
    return json(res, 400, { error: 'Please choose a valid session date.' });
  }

  const priced = resolveTasterPromo(body.promoCode, buyer.landing_page);
  if (priced.error) return json(res, 400, { error: priced.error });

  try {
    const result = await createIntent({
      amount: priced.amount,
      currency: 'gbp',
      description: priced.promoCode
        ? `Children's Homes Investor Taster — ${buyer.session} (${priced.promoCode})`
        : `Children's Homes Investor Taster — ${buyer.session}`,
      product: 'taster',
      buyer,
      extraMetadata: priced.promoCode ? { promoCode: priced.promoCode } : {},
    });
    if (result.error) return json(res, result.status || 503, { error: result.error });
    return json(res, 200, { clientSecret: result.clientSecret, amount: priced.amount });
  } catch (err) {
    console.error('[create-payment-intent]', err);
    return json(res, 500, { error: 'Could not start the payment. Please try again.' });
  }
};
