const {
  PROGRAMME_FULL_AMOUNT,
  PROGRAMME_INSTALMENT_AMOUNT,
  json,
  readJsonBody,
  buyerFromBody,
  createIntent,
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

  const paymentType = body.paymentType === 'instalments' ? 'programme-instalments' : 'programme-full';
  const amount = paymentType === 'programme-instalments'
    ? PROGRAMME_INSTALMENT_AMOUNT
    : PROGRAMME_FULL_AMOUNT;

  if (!amount) {
    return json(res, 503, {
      error: 'Programme enrolment payment is not configured yet. Please use the £250 deposit for now.',
    });
  }

  try {
    const result = await createIntent({
      amount,
      currency: 'gbp',
      description: `12 Month Children's Homes Investment Programme — ${paymentType}`,
      product: paymentType,
      buyer,
    });
    if (result.error) return json(res, result.status || 503, { error: result.error });
    return json(res, 200, { clientSecret: result.clientSecret });
  } catch (err) {
    console.error('[create-enrolment-intent]', err);
    return json(res, 500, { error: 'Could not start the payment. Please try again.' });
  }
};
