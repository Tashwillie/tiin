const { json } = require('../lib/stripe');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';
  res.setHeader('Cache-Control', 'public, max-age=300');
  return json(res, 200, { publishableKey });
};
