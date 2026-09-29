const GHL_API = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

const PAID_PRODUCT_TAGS = [
  'Stripe Paid',
  'Taster Paid',
  'Programme Deposit',
  'Programme Enrolled',
  'Payment Full',
  'payment-plan',
];

function configured() {
  return !!(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: GHL_VERSION,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

function toE164(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return `+44${digits.slice(1)}`;
  if (digits.startsWith('44')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

function tagsFor(intent, livemode) {
  const meta = intent.metadata || {};
  const tags = ['TIIN Website', 'Stripe Paid'];
  if (meta.product === 'programme-deposit' || meta.product === 'mastermind-deposit') {
    tags.push('Programme Deposit');
  } else if (meta.product === 'taster') {
    tags.push('Taster Paid');
  }
  if (meta.product === 'programme-full') {
    tags.push('Programme Enrolled', 'Payment Full');
  }
  if (meta.product === 'programme-instalments') {
    tags.push('Programme Enrolled', 'payment-plan');
  }

  const src = (meta.utm_source || '').toLowerCase();
  if (src === 'webinar') tags.push('SOURCE | WEBINAR');
  else if (src === 'linkedin') tags.push('SOURCE | LINKEDIN');
  else if (src === 'pin') tags.push('SOURCE | PIN');
  else if (src === 'referral') tags.push('SOURCE | REFERRAL');
  else if (src === 'event') tags.push('SOURCE | EVENT');
  else tags.push('SOURCE | WEBSITE');

  if (meta.landing_page === '/tasterpin' || src === 'pin') tags.push('Pin');
  if (meta.session) tags.push(`Session ${meta.session}`);
  if (meta.consent === 'true') tags.push('marketing-opt-in');
  if (!livemode) tags.push('Stripe Test');
  return tags;
}

function noteFor(intent) {
  const meta = intent.metadata || {};
  const pounds = ((intent.amount_received || intent.amount || 0) / 100).toFixed(2);
  const lines = [
    `Paid £${pounds} ${(intent.currency || 'gbp').toUpperCase()} via the TIIN website.`,
    `Product: ${meta.product || 'unknown'}`,
    meta.session ? `Session: ${meta.session}` : null,
    `Stripe: ${intent.id}`,
    meta.utm_source ? `UTM source: ${meta.utm_source}` : null,
    meta.landing_page ? `Landing page: ${meta.landing_page}` : null,
    meta.referrer ? `Referrer: ${meta.referrer}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}

async function parseJsonResponse(res) {
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return data;
}

async function ghlFetch(path, body) {
  const res = await fetch(`${GHL_API}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const err = new Error(`GHL ${res.status} ${path}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function ghlGet(path) {
  const res = await fetch(`${GHL_API}${path}`, {
    method: 'GET',
    headers: headers(),
  });
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const err = new Error(`GHL ${res.status} ${path}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function upsertContact(intent, livemode, extraTags = []) {
  const meta = intent.metadata || {};
  const email = String(meta.email || '').trim().toLowerCase();
  const phone = toE164(meta.phone);
  if (!email && !phone) {
    throw new Error('Payment has no email or phone to send to GHL.');
  }

  const customFields = [
    { key: 'contact.tiin_lead_source', field_value: meta.utm_source || '' },
  ];
  if (meta.session) {
    customFields.push({ key: 'contact.taster_date', field_value: meta.session });
  }

  const upserted = await ghlFetch('/contacts/upsert', {
    locationId: process.env.GHL_LOCATION_ID,
    firstName: meta.firstName || '',
    lastName: meta.lastName || '',
    name: [meta.firstName, meta.lastName].filter(Boolean).join(' ').trim(),
    email: email || undefined,
    phone: phone || undefined,
    source: 'TIIN Website',
    country: 'GB',
    customFields,
  });

  const contact = upserted.contact || upserted;
  const contactId = contact.id;
  if (!contactId) {
    throw new Error('GHL upsert returned no contact id.');
  }

  let tags = [...tagsFor(intent, livemode), ...extraTags];
  if (extraTags.includes('Payment Failed')) {
    tags = tags.filter((tag) => !PAID_PRODUCT_TAGS.includes(tag));
    if (!tags.includes('Payment Failed')) tags.push('Payment Failed');
  }

  await ghlFetch(`/contacts/${contactId}/tags`, { tags });

  if (!extraTags.includes('Payment Failed')) {
    try {
      await ghlFetch(`/contacts/${contactId}/notes`, { body: noteFor(intent) });
    } catch (err) {
      console.error('[ghl] note', err.status, err.payload || err.message);
    }
  }

  return { contactId, isNew: !!upserted.new };
}

async function syncPaidContact(intent, livemode, extraTags = []) {
  if (!configured()) {
    console.warn('[ghl] skipped — GHL_API_KEY or GHL_LOCATION_ID is missing');
    return null;
  }
  return upsertContact(intent, livemode, extraTags);
}

async function applyRefundTag({ email, phone }, livemode) {
  if (!configured()) return null;
  const locationId = process.env.GHL_LOCATION_ID;
  const query = email
    ? `email=${encodeURIComponent(email)}`
    : `phone=${encodeURIComponent(phone)}`;
  const data = await ghlGet(`/contacts/?locationId=${locationId}&${query}`);
  const contact = data.contacts && data.contacts[0];
  if (!contact) return null;
  const refundTags = ['Taster Refunded'];
  if (!livemode) refundTags.push('Stripe Test');
  await ghlFetch(`/contacts/${contact.id}/tags`, { tags: refundTags });
  return contact.id;
}

module.exports = { configured, syncPaidContact, applyRefundTag };
