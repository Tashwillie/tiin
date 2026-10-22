const { json, readJsonBody, resolveTasterPromo } = require('../lib/stripe');

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

  const priced = resolveTasterPromo(body.promoCode, body.landing_page);
  if (priced.error) return json(res, 400, { error: priced.error });
  if (!priced.promoCode) return json(res, 400, { error: 'Enter a promo code.' });

  return json(res, 200, {
    valid: true,
    promoCode: priced.promoCode,
    amount: priced.amount,
  });
};
