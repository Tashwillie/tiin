const Stripe = require('stripe');

const TASTER_SESSIONS = ['2026-10-24'];
const TASTER_SOLD_OUT = ['2026-09-23'];
const TASTER_AMOUNT = 14900;
const PROGRAMME_DEPOSIT_AMOUNT = 25000;
const PROGRAMME_FULL_AMOUNT = 0; // TODO: set full programme price in pence before go-live
const PROGRAMME_INSTALMENT_AMOUNT = 0; // TODO: set first instalment amount in pence before go-live

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function clip(value, max) {
  return String(value || '').trim().slice(0, max);
}

function buyerFromBody(body) {
  const firstName = clip(body.firstName, 80);
  const lastName = clip(body.lastName, 80);
  const email = clip(body.email, 120).toLowerCase();
  const phone = clip(body.phone, 40);
  if (!firstName || !validEmail(email) || !phone) {
    return { error: 'Please complete your name, email and phone number.' };
  }
  return {
    firstName,
    lastName,
    email,
    phone,
    consent: !!body.consent,
    session: clip(body.session, 32),
    utm_source: clip(body.utm_source, 120),
    utm_medium: clip(body.utm_medium, 120),
    utm_campaign: clip(body.utm_campaign, 120),
    utm_term: clip(body.utm_term, 120),
    utm_content: clip(body.utm_content, 120),
    referrer: clip(body.referrer, 300),
    landing_page: clip(body.landing_page, 200),
  };
}

async function createIntent({ amount, currency, description, product, buyer, extraMetadata }) {
  const stripe = stripeClient();
  if (!stripe) {
    return { error: 'Payment is temporarily unavailable. Please email hello@tiin.co.uk.', status: 503 };
  }

  const intent = await stripe.paymentIntents.create({
    amount,
    currency,
    description,
    receipt_email: buyer.email,
    automatic_payment_methods: { enabled: true },
    metadata: {
      product,
      firstName: buyer.firstName,
      lastName: buyer.lastName,
      email: buyer.email,
      phone: buyer.phone,
      consent: buyer.consent ? 'true' : 'false',
      session: buyer.session,
      utm_source: buyer.utm_source,
      utm_medium: buyer.utm_medium,
      utm_campaign: buyer.utm_campaign,
      utm_term: buyer.utm_term,
      utm_content: buyer.utm_content,
      referrer: buyer.referrer,
      landing_page: buyer.landing_page,
      ...extraMetadata,
    },
  });

  return { clientSecret: intent.client_secret };
}

module.exports = {
  TASTER_SESSIONS,
  TASTER_SOLD_OUT,
  TASTER_AMOUNT,
  PROGRAMME_DEPOSIT_AMOUNT,
  PROGRAMME_FULL_AMOUNT,
  PROGRAMME_INSTALMENT_AMOUNT,
  stripeClient,
  json,
  readJsonBody,
  buyerFromBody,
  createIntent,
};
