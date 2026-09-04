// ── Scroll reveal ─────────────────────────────────────────────────────
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ── Apply buttons scroll straight to the form ─────────────────────────
(function () {
  const target = document.querySelector('#apply .book-card') || document.getElementById('apply');
  if (!target) return;
  const OFFSET = 88;
  document.querySelectorAll('a[href="#apply"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.pageYOffset - OFFSET;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      if (history.replaceState) history.replaceState(null, '', '#apply');
    });
  });
})();

// ── Sticky nav + mobile Apply button ──────────────────────────────────
const nav = document.getElementById('topnav');
const sticky = document.getElementById('stickyCta');
const payBlock = document.getElementById('apply');
let payInView = false;
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) nav.classList.add('scrolled'); else nav.classList.remove('scrolled');
  const past = window.scrollY > window.innerHeight * 0.6;
  sticky.classList.toggle('show', past && !payInView);
});
new IntersectionObserver((entries) => {
  payInView = entries[0].isIntersecting;
  if (payInView) sticky.classList.remove('show');
}, { threshold: 0.2 }).observe(payBlock);

// ── Countdown to Cohort 1 start: 23 Sep 2026, 9am UK ──────────────────
function runCountdown(boxId, targetIso, liveMsg) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const target = new Date(targetIso);
  const units = ['days', 'hrs', 'mins', 'secs'];
  const wrap = box.classList.contains('hero-count');
  box.innerHTML = units.map(function (u) {
    return wrap
      ? '<span class="hc-unit"><span class="hc-n" data-u="' + u + '">–</span><span class="hc-l">' + u + '</span></span>'
      : '<div class="count-unit"><span class="n" data-u="' + u + '">–</span><span class="l">' + u + '</span></div>';
  }).join('');
  const cell = {};
  box.querySelectorAll(wrap ? '.hc-n' : '.n').forEach(function (s) { cell[s.dataset.u] = s; });
  const pad = function (n) { return String(n).padStart(2, '0'); };
  let iv;
  function tick() {
    let diff = target - new Date();
    if (diff <= 0) {
      box.innerHTML = wrap ? '<span class="hero-live">' + liveMsg + '</span>' : '<div class="count-live">' + liveMsg + '</div>';
      if (iv) clearInterval(iv); return;
    }
    const d = Math.floor(diff / 86400000); diff -= d * 86400000;
    const h = Math.floor(diff / 3600000); diff -= h * 3600000;
    const m = Math.floor(diff / 60000); diff -= m * 60000;
    const s = Math.floor(diff / 1000);
    cell.days.textContent = d; cell.hrs.textContent = pad(h); cell.mins.textContent = pad(m); cell.secs.textContent = pad(s);
  }
  tick(); iv = setInterval(tick, 1000);
}
runCountdown('heroCountdown', '2026-09-23T08:00:00Z', 'Cohort 1 is underway');
runCountdown('cohortCountdown', '2026-09-23T08:00:00Z', 'Cohort 1 is underway');

// ── Attribution: first-touch UTM + referrer ───────────────────────────
const ATTR_KEY = 'tiin_attr';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
(function () {
  const params = new URLSearchParams(location.search);
  const fromUrl = {}; let hasUtm = false;
  UTM_KEYS.forEach(function (k) { const v = params.get(k); if (v) { fromUrl[k] = v; hasUtm = true; } });
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(ATTR_KEY)) || {}; } catch (e) {}
  if (!(stored.utm_source || stored.referrer) && (hasUtm || document.referrer)) {
    const attr = Object.assign({}, fromUrl, { referrer: document.referrer || '', landing_page: location.pathname });
    try { localStorage.setItem(ATTR_KEY, JSON.stringify(attr)); } catch (e) {}
  }
})();
function getAttribution() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(ATTR_KEY)) || {}; } catch (e) {}
  const params = new URLSearchParams(location.search);
  const live = {};
  UTM_KEYS.forEach(function (k) { const v = params.get(k); if (v) live[k] = v; });
  return Object.assign({ referrer: document.referrer || '', landing_page: location.pathname }, stored, live);
}

const GA4_ID = '';

// ── Payment: branded details (step 1) then Stripe Payment Element
//    (step 2) — inline, £250 GBP Programme deposit. ─────────────────
(function initPayment() {
  const detailsStep = document.getElementById('stepDetails');
  const paymentStep = document.getElementById('stepPayment');
  const toPaymentBtn = document.getElementById('toPayment');
  const payBtn = document.getElementById('payBtn');
  const editLink = document.getElementById('editDetails');
  const errorBox = document.getElementById('payError');
  if (!detailsStep || typeof Stripe === 'undefined') return;

  const f = {
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    consent: document.getElementById('consent'),
  };

  let stripe, elements, paymentElement, mounted = false, busy = false;
  function showError(msg) { errorBox.textContent = msg || ''; errorBox.hidden = !msg; }
  function setInvalid(el, bad) { el.closest('.field').classList.toggle('invalid', bad); }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function validateDetails() {
    let ok = true;
    const first = !f.firstName.value.trim(); setInvalid(f.firstName, first); if (first) ok = false;
    const mail = !validEmail(f.email.value.trim()); setInvalid(f.email, mail); if (mail) ok = false;
    const tel = !f.phone.value.trim(); setInvalid(f.phone, tel); if (tel) ok = false;
    return ok;
  }

  async function ensureStripe() {
    if (stripe) return true;
    const cfg = await fetch('/api/config').then(r => r.json()).catch(() => null);
    if (!cfg || !cfg.publishableKey) { showError('Payment is temporarily unavailable. Please email hello@tiin.co.uk.'); return false; }
    stripe = Stripe(cfg.publishableKey);
    elements = stripe.elements({
      mode: 'payment', amount: 25000, currency: 'gbp',
      appearance: {
        theme: 'flat',
        variables: {
          colorPrimary: '#0F0F5A', colorText: '#1A1B26', colorBackground: '#ffffff',
          colorDanger: '#b3261e', fontFamily: 'DM Sans, system-ui, sans-serif',
          borderRadius: '4px', fontSizeBase: '16px', spacingUnit: '4px',
        },
      },
    });
    paymentElement = elements.create('payment', {
      fields: { billingDetails: { name: 'never', email: 'never', phone: 'never' } },
    });
    return true;
  }

  toPaymentBtn.addEventListener('click', async function () {
    showError('');
    if (!validateDetails()) return;
    toPaymentBtn.disabled = true;
    const ready = await ensureStripe();
    if (!ready) { toPaymentBtn.disabled = false; return; }
    if (!mounted) { paymentElement.mount('#payment-element'); mounted = true; }
    document.getElementById('whoName').textContent = (f.firstName.value + ' ' + f.lastName.value).trim();
    document.getElementById('whoEmail').textContent = f.email.value.trim();
    detailsStep.hidden = true;
    paymentStep.hidden = false;
    toPaymentBtn.disabled = false;
    paymentStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  editLink.addEventListener('click', function (e) {
    e.preventDefault(); paymentStep.hidden = true; detailsStep.hidden = false; showError('');
  });

  payBtn.addEventListener('click', async function () {
    if (busy) return;
    busy = true; payBtn.disabled = true; showError('');
    try {
      const submit = await elements.submit();
      if (submit.error) { showError(submit.error.message || 'Please check your card details.'); throw submit.error; }
      const body = Object.assign({
        firstName: f.firstName.value.trim(),
        lastName: f.lastName.value.trim(),
        email: f.email.value.trim(),
        phone: f.phone.value.trim(),
        consent: f.consent ? f.consent.checked : false,
      }, getAttribution());
      const res = await fetch('/api/create-programme-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) { showError(data.error || 'Could not start the payment. Please try again.'); throw new Error('intent'); }
      const result = await stripe.confirmPayment({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: {
          return_url: location.origin + '/investment-programme-success',
          payment_method_data: {
            billing_details: { name: (body.firstName + ' ' + body.lastName).trim(), email: body.email, phone: body.phone },
          },
        },
        redirect: 'if_required',
      });
      if (result.error) { showError(result.error.message || 'Your payment could not be completed.'); throw result.error; }
      window.location.assign('/investment-programme-success');
    } catch (e) {
      console.error('[pay]', e); busy = false; payBtn.disabled = false;
    }
  });
})();
