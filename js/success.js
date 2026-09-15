  // ── Analytics: set GA4_ID to 'G-XXXXXXX' to enable (safe to expose). ──
  const GA4_ID = '';
  const params = new URLSearchParams(location.search);
  // Payment Element returns the buyer here with ?payment_intent=pi_… (only on
  // the 3-D Secure redirect path; direct card success arrives with no params).
  const paymentIntent = params.get('payment_intent');

  if (paymentIntent) {
    const ref = document.getElementById('ref');
    ref.textContent = 'Reference: ' + paymentIntent.slice(-12);
    ref.hidden = false;
  }

  // Confirm the exact session the buyer selected (passed as ?s=... on redirect).
  const SESSION_DATES = {
    '2026-09-02': 'Wednesday 2 September 2026',
    '2026-10-24': 'Saturday 24 October 2026',
  };
  const sDate = SESSION_DATES[params.get('s')];
  if (sDate) {
    ['sessDate1', 'sessDate2'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = sDate;
    });
  }

  if (GA4_ID) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', GA4_ID);
    // Fire once per payment so the purchase isn't double-counted on refresh.
    const txn = paymentIntent || 'taster';
    if (sessionStorage.getItem('purchase_logged') !== txn) {
      gtag('event', 'purchase', { transaction_id: txn, value: 149, currency: 'GBP' });
      sessionStorage.setItem('purchase_logged', txn);
    }
  }

