  const params = new URLSearchParams(location.search);
  const paymentIntent = params.get('payment_intent');
  if (paymentIntent) {
    const ref = document.getElementById('ref');
    ref.textContent = 'Reference: ' + paymentIntent.slice(-12);
    ref.hidden = false;
  }

