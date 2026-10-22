// ── Taster sessions — single source of truth for dates + countdown.
//    Keep these in sync with SESSIONS in api/create-payment-intent.js. ──
const TASTER_SESSIONS = [
  { id: '2026-11-14', label: 'Sat 14 November 2026', short: 'Sat 14 Nov', iso: '2026-11-14T13:00:00Z', soldOut: false },
  { id: '2026-12-19', label: 'Sat 19 December 2026', short: 'Sat 19 Dec', iso: '2026-12-19T13:00:00Z', soldOut: false },
]; // T13:00:00Z = 1:00pm UK (GMT)
function bookableSessions() {
  return TASTER_SESSIONS.filter(function (s) { return !s.soldOut; });
}
function selectedSession() {
  const c = document.querySelector('input[name="taster-session"]:checked:not(:disabled)');
  return bookableSessions().find(function (s) { return s.id === (c && c.value); }) || bookableSessions()[0];
}

// ── Scroll reveal ─────────────────────────────────────────────────────
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ── Reserve buttons scroll straight to the booking form (not the section
//    top, which has heading + padding above it). Recomputed on click, so
//    it's immune to late font reflow. ──────────────────────────────────
(function () {
  const target = document.querySelector('#reserve .book-card') || document.getElementById('reserve');
  if (!target) return;
  const OFFSET = 88; // fixed-nav clearance
  document.querySelectorAll('a[href="#reserve"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      const y = target.getBoundingClientRect().top + window.pageYOffset - OFFSET;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      if (history.replaceState) history.replaceState(null, '', '#reserve');
    });
  });
})();

// ── Sticky nav + mobile Reserve button (hide the sticky bar while the
//    payment block itself is on screen, so it isn't redundant) ─────────
const nav = document.getElementById('topnav');
const sticky = document.getElementById('stickyCta');
const payBlock = document.getElementById('reserve');
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

// ── Hero countdown — compact box clock to the session start ───────────
(function () {
  const box = document.getElementById('heroCountdown');
  const next = bookableSessions()[0];
  if (!box || !next) return;
  const target = new Date(next.iso);
  const units = ['days', 'hrs', 'mins', 'secs'];
  box.innerHTML = units.map(function (u) {
    return '<span class="hc-unit"><span class="hc-n" data-u="' + u + '">–</span><span class="hc-l">' + u + '</span></span>';
  }).join('');
  const cell = {};
  box.querySelectorAll('.hc-n').forEach(function (s) { cell[s.dataset.u] = s; });
  const pad = function (n) { return String(n).padStart(2, '0'); };
  let iv;
  function tick() {
    let diff = target - new Date();
    if (diff <= 0) {
      box.innerHTML = '<span class="hero-live">The session is live today</span>';
      if (iv) clearInterval(iv);
      return;
    }
    const d = Math.floor(diff / 86400000); diff -= d * 86400000;
    const h = Math.floor(diff / 3600000); diff -= h * 3600000;
    const m = Math.floor(diff / 60000); diff -= m * 60000;
    const s = Math.floor(diff / 1000);
    cell.days.textContent = d;
    cell.hrs.textContent = pad(h);
    cell.mins.textContent = pad(m);
    cell.secs.textContent = pad(s);
  }
  tick();
  iv = setInterval(tick, 1000);
})();

// ── Reserve countdown — tracks whichever session the visitor selects ───
(function () {
  const box = document.getElementById('reserveCountdown');
  if (!box) return;
  const labelEl = document.getElementById('countLabel');
  const dateFact = document.getElementById('sessionDateFact');
  const units = ['days', 'hrs', 'mins', 'secs'];
  box.innerHTML = units.map(function (u) {
    return '<div class="count-unit"><span class="n" data-u="' + u + '">–</span><span class="l">' + u + '</span></div>';
  }).join('');
  const cell = {};
  box.querySelectorAll('.n').forEach(function (s) { cell[s.dataset.u] = s; });
  const pad = function (n) { return String(n).padStart(2, '0'); };
  let target = new Date(selectedSession().iso);
  let iv;
  function tick() {
    let diff = target - new Date();
    if (diff <= 0) {
      box.innerHTML = '<div class="count-live">The session is underway. Thank you for joining.</div>';
      if (iv) clearInterval(iv);
      return;
    }
    const d = Math.floor(diff / 86400000); diff -= d * 86400000;
    const h = Math.floor(diff / 3600000); diff -= h * 3600000;
    const m = Math.floor(diff / 60000); diff -= m * 60000;
    const s = Math.floor(diff / 1000);
    if (cell.days) {
      cell.days.textContent = d;
      cell.hrs.textContent = pad(h);
      cell.mins.textContent = pad(m);
      cell.secs.textContent = pad(s);
    }
  }
  function refresh() {
    const s = selectedSession();
    target = new Date(s.iso);
    if (labelEl) labelEl.textContent = s.short;
    if (dateFact) dateFact.textContent = s.label;
    document.querySelectorAll('.session-opt').forEach(function (o) {
      const r = o.querySelector('input');
      o.classList.toggle('is-selected', !!(r && r.checked));
    });
    tick();
  }
  document.querySelectorAll('input[name="taster-session"]').forEach(function (r) {
    r.addEventListener('change', refresh);
  });
  refresh();
  iv = setInterval(tick, 1000);
})();

// ── Attribution: first-touch UTM + referrer, persisted so the source is
//    known even if the visitor registers later. ─────────────────────────
const ATTR_KEY = 'tiin_attr';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
(function () {
  const params = new URLSearchParams(location.search);
  const fromUrl = {};
  UTM_KEYS.forEach(function (k) { const v = params.get(k); if (v) fromUrl[k] = v; });
  const attr = Object.assign({
    utm_source: 'pin',
    utm_medium: 'paid',
    utm_campaign: 'tasterpin',
    referrer: document.referrer || '',
    landing_page: '/tasterpin',
  }, fromUrl);
  try { localStorage.setItem(ATTR_KEY, JSON.stringify(attr)); } catch (e) {}
})();
function getAttribution() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(ATTR_KEY)) || {}; } catch (e) {}
  const params = new URLSearchParams(location.search);
  const live = {};
  UTM_KEYS.forEach(function (k) { const v = params.get(k); if (v) live[k] = v; });
  return Object.assign(
    { referrer: document.referrer || '', utm_medium: 'paid', utm_campaign: 'tasterpin' },
    stored,
    live,
    { landing_page: '/tasterpin', utm_source: live.utm_source || stored.utm_source || 'pin' }
  );
}

// ── Analytics — set GA4_ID to 'G-XXXXXXX' to enable (safe to expose) ───
const GA4_ID = '';
if (GA4_ID) {
  const s = document.createElement('script'); s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  gtag('js', new Date()); gtag('config', GA4_ID);
}

// ── Payment: our branded details form (step 1) then Stripe Payment
//    Element (step 2). £149 unless the Pin promo is applied, then £99. ──
(function initPayment() {
  const LIST_AMOUNT = 14900;
  const detailsStep = document.getElementById('stepDetails');
  const paymentStep = document.getElementById('stepPayment');
  const toPaymentBtn = document.getElementById('toPayment');
  const payBtn = document.getElementById('payBtn');
  const editLink = document.getElementById('editDetails');
  const errorBox = document.getElementById('payError');
  const promoInput = document.getElementById('promoCode');
  const applyPromoBtn = document.getElementById('applyPromo');
  const promoMsg = document.getElementById('promoMsg');
  const bookTotal = document.getElementById('bookTotal');
  const whoPrice = document.getElementById('whoPrice');
  if (!detailsStep || typeof Stripe === 'undefined') return;

  const f = {
    firstName: document.getElementById('firstName'),
    lastName: document.getElementById('lastName'),
    email: document.getElementById('email'),
    phone: document.getElementById('phone'),
    consent: document.getElementById('consent'),
  };

  let stripe, elements, paymentElement, mounted = false, busy = false;
  let checkoutAmount = LIST_AMOUNT;
  let appliedPromo = '';

  function showError(msg) { errorBox.textContent = msg || ''; errorBox.hidden = !msg; }
  function setInvalid(el, bad) { el.closest('.field').classList.toggle('invalid', bad); }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function pounds(amount) { return '£' + (amount / 100); }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderPrice() {
    if (payBtn) {
      payBtn.innerHTML = 'Pay ' + pounds(checkoutAmount) + ' <span class="arrow">→</span>';
    }
    if (whoPrice) whoPrice.textContent = pounds(checkoutAmount);
    if (!bookTotal) return;
    if (appliedPromo) {
      bookTotal.innerHTML = 'Promo <strong>' + escapeHtml(appliedPromo) + '</strong> applied. You\'ll pay ' + pounds(checkoutAmount) + ' securely on the next step, no charge until you confirm. <span class="price-was">£149</span>';
    } else {
      bookTotal.textContent = 'You\'ll pay £149 securely on the next step, no charge until you confirm.';
    }
  }

  function setPromoMsg(text, kind) {
    if (!promoMsg) return;
    promoMsg.textContent = text || '';
    promoMsg.hidden = !text;
    promoMsg.classList.toggle('ok', kind === 'ok');
    promoMsg.classList.toggle('bad', kind === 'bad');
  }

  async function syncElementsAmount() {
    if (elements) await elements.update({ amount: checkoutAmount });
  }

  function validateDetails() {
    let ok = true;
    const first = !f.firstName.value.trim(); setInvalid(f.firstName, first); if (first) ok = false;
    const mail = !validEmail(f.email.value.trim()); setInvalid(f.email, mail); if (mail) ok = false;
    const tel = !f.phone.value.trim(); setInvalid(f.phone, tel); if (tel) ok = false;
    return ok;
  }

  async function ensureStripe() {
    if (stripe) { await syncElementsAmount(); return true; }
    const cfg = await fetch('/api/config').then(r => r.json()).catch(() => null);
    if (!cfg || !cfg.publishableKey) { showError('Payment is temporarily unavailable. Please email hello@tiin.co.uk.'); return false; }
    stripe = Stripe(cfg.publishableKey);
    elements = stripe.elements({
      mode: 'payment', amount: checkoutAmount, currency: 'gbp',
      appearance: {
        theme: 'flat',
        variables: {
          colorPrimary: '#0F0F5A', colorText: '#1A1B26', colorBackground: '#ffffff',
          colorDanger: '#b3261e', fontFamily: 'DM Sans, system-ui, sans-serif',
          borderRadius: '4px', fontSizeBase: '16px', spacingUnit: '4px',
        },
      },
    });
    // We collect name/email/phone ourselves, so hide them in the Element.
    paymentElement = elements.create('payment', {
      fields: { billingDetails: { name: 'never', email: 'never', phone: 'never' } },
    });
    await syncElementsAmount();
    return true;
  }

  if (promoInput && applyPromoBtn) {
    promoInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); applyPromoBtn.click(); }
    });
    promoInput.addEventListener('input', function () {
      const typed = promoInput.value.trim().toUpperCase().replace(/\s+/g, '');
      if (appliedPromo && typed !== appliedPromo) {
        appliedPromo = '';
        checkoutAmount = LIST_AMOUNT;
        renderPrice();
        syncElementsAmount();
        setPromoMsg('Apply the code again to use the £99 price.', '');
      }
    });
    applyPromoBtn.addEventListener('click', async function () {
      const code = promoInput.value.trim();
      showError('');
      if (!code) {
        appliedPromo = '';
        checkoutAmount = LIST_AMOUNT;
        renderPrice();
        await syncElementsAmount();
        setPromoMsg('', '');
        return;
      }
      applyPromoBtn.disabled = true;
      try {
        const res = await fetch('/api/apply-taster-promo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promoCode: code, landing_page: '/tasterpin' }),
        });
        const data = await res.json().catch(function () { return {}; });
        if (!res.ok || !data.valid || !Number.isInteger(data.amount) || data.amount < 100 || data.amount >= LIST_AMOUNT) {
          appliedPromo = '';
          checkoutAmount = LIST_AMOUNT;
          renderPrice();
          await syncElementsAmount();
          setPromoMsg(data.error || 'That promo code is not valid.', 'bad');
          return;
        }
        appliedPromo = data.promoCode;
        checkoutAmount = data.amount;
        promoInput.value = data.promoCode;
        renderPrice();
        await syncElementsAmount();
        setPromoMsg(data.promoCode + ' applied. Your seat is ' + pounds(data.amount) + '.', 'ok');
      } catch (err) {
        setPromoMsg('Could not check that code. Please try again.', 'bad');
      } finally {
        applyPromoBtn.disabled = false;
      }
    });
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
    if (GA4_ID) gtag('event', 'begin_checkout', { value: checkoutAmount / 100, currency: 'GBP' });
  });

  editLink.addEventListener('click', function (e) {
    e.preventDefault();
    paymentStep.hidden = true;
    detailsStep.hidden = false;
    showError('');
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
        session: selectedSession().id,
        promoCode: appliedPromo,
      }, getAttribution());

      const res = await fetch('/api/create-payment-intent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) { showError(data.error || 'Could not start the payment. Please try again.'); throw new Error('intent'); }
      if (data.amount !== checkoutAmount) {
        showError('The price did not match your promo. Please apply the code again.');
        throw new Error('amount');
      }

      const result = await stripe.confirmPayment({
        elements,
        clientSecret: data.clientSecret,
        confirmParams: {
          return_url: location.origin + '/success?s=' + encodeURIComponent(body.session),
          payment_method_data: {
            billing_details: { name: (body.firstName + ' ' + body.lastName).trim(), email: body.email, phone: body.phone },
          },
        },
        redirect: 'if_required',
      });
      if (result.error) { showError(result.error.message || 'Your payment could not be completed.'); throw result.error; }
      // Card succeeded with no redirect needed — go to the thank-you page.
      window.location.assign('/success?s=' + encodeURIComponent(body.session));
    } catch (e) {
      console.error('[pay]', e);
      busy = false; payBtn.disabled = false;
    }
  });
})();
