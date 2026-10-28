(() => {
  'use strict';

  // No secrets here: the Bakong token lives only on the server.
  const API = '/api/payment';
  const STORAGE_KEY = 'khqr_order_id';
  const POLL_VISIBLE_MS = 4000;
  const POLL_HIDDEN_MS = 15000;
  const POLL_MAX_MS = 30000;

  const $ = (id) => document.getElementById(id);
  const el = {
    formView: $('formView'), orderView: $('orderView'), form: $('orderForm'),
    amount: $('amount'), currency: $('currency'), amountHint: $('amountHint'),
    createBtn: $('createBtn'), formError: $('formError'), formErrorText: $('formErrorText'),
    pill: $('statusPill'), qrBox: $('qrBox'), qrImg: $('qrImg'),
    overlay: $('stateOverlay'), icon: $('stateIcon'), stateText: $('stateText'),
    countdownBox: $('countdownBox'), countdown: $('countdown'), barFill: $('barFill'),
    orderIdText: $('orderIdText'), amountText: $('amountText'), currencyText: $('currencyText'),
    warn: $('orderWarn'), warnText: $('orderWarnText'), retry: $('retryBtn'), newBtn: $('newBtn'),
  };

  const LABELS = {
    PENDING: ['កំពុងរង់ចាំ', 'pending'],
    PAID: ['បានទូទាត់', 'paid'],
    EXPIRED: ['ផុតកំណត់', 'expired'],
    FAILED: ['មានបញ្ហា', 'failed'],
  };

  let order = null;        // last known public order data
  let skew = 0;            // serverTime - clientTime (ms)
  let totalMs = 1;
  let pollTimer = null;
  let tickTimer = null;
  let errCount = 0;
  let polling = false;

  // ---------- helpers ----------
  function fmtMoney(amount, currency) {
    if (currency === 'USD') return '$' + Number(amount).toFixed(2);
    return '៛' + Number(amount).toLocaleString('en-US');
  }
  function fmtTime(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  const safeStore = {
    get() { try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; } },
    set(v) { try { localStorage.setItem(STORAGE_KEY, v); } catch (_) { /* ignore */ } },
    clear() { try { localStorage.removeItem(STORAGE_KEY); } catch (_) { /* ignore */ } },
  };

  async function api(path, opts) {
    let res;
    try {
      res = await fetch(API + path, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        ...opts,
      });
    } catch (_) {
      const e = new Error('មិនអាចភ្ជាប់ Server បាន សូមពិនិត្យអ៊ីនធឺណិត');
      e.code = 'NETWORK';
      throw e;
    }
    let body = null;
    try { body = await res.json(); } catch (_) { /* non-JSON */ }
    if (!res.ok || !body || body.ok !== true) {
      const e = new Error((body && body.error && body.error.message) || 'មានបញ្ហា សូមព្យាយាមម្ដងទៀត');
      e.code = (body && body.error && body.error.code) || 'HTTP_' + res.status;
      e.status = res.status;
      throw e;
    }
    return body.data;
  }

  // ---------- form ----------
  function updateHint() {
    if (el.currency.value === 'USD') {
      el.amountHint.textContent = 'ដុល្លារអាចមានទសភាគច្រើនបំផុត ២ ខ្ទង់';
      el.amount.placeholder = 'ឧ. 1.50';
    } else {
      el.amountHint.textContent = 'លុយរៀលត្រូវជាចំនួនគត់';
      el.amount.placeholder = 'ឧ. 10000';
    }
  }
  function showFormError(msg) {
    el.formErrorText.textContent = msg;
    el.formError.classList.remove('hidden');
  }

  el.currency.addEventListener('change', updateHint);
  updateHint();

  el.form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    el.formError.classList.add('hidden');
    const raw = el.amount.value.trim().replace(/,/g, '');
    if (!/^\d+(\.\d+)?$/.test(raw) || Number(raw) <= 0) {
      showFormError('សូមបញ្ចូលចំនួនទឹកប្រាក់ជាលេខ ធំជាង 0');
      return;
    }
    el.createBtn.disabled = true;
    el.createBtn.textContent = 'កំពុងបង្កើត...';
    try {
      const data = await api('/create', {
        method: 'POST',
        body: JSON.stringify({ amount: raw, currency: el.currency.value }),
      });
      safeStore.set(data.orderId);
      startOrder(data);
    } catch (err) {
      showFormError(err.message + ' — សូមសាកល្បងម្ដងទៀត');
    } finally {
      el.createBtn.disabled = false;
      el.createBtn.textContent = 'បង្កើត KHQR';
    }
  });

  // ---------- order view ----------
  function startOrder(data) {
    stopTimers();
    errCount = 0;
    el.formView.classList.add('hidden');
    el.orderView.classList.remove('hidden');
    el.warn.classList.add('hidden');
    if (data.qrImage) el.qrImg.src = data.qrImage;
    el.orderIdText.textContent = data.orderId;
    el.amountText.textContent = fmtMoney(data.amount, data.currency);
    el.currencyText.textContent = data.currency;
    applyOrder(data);
    totalMs = Math.max(1, new Date(data.expiresAt) - new Date(data.createdAt));
    if (data.status === 'PENDING') {
      tickTimer = setInterval(tick, 1000);
      tick();
      schedulePoll(1500);
    }
  }

  function applyOrder(data) {
    order = data;
    skew = new Date(data.serverTime).getTime() - Date.now();
    const [label, cls] = LABELS[data.status] || LABELS.PENDING;
    el.pill.textContent = label;
    el.pill.className = 'pill ' + cls;

    const done = data.status !== 'PENDING';
    el.qrBox.classList.toggle('dim', done);
    el.overlay.classList.toggle('hidden', !done);
    el.countdownBox.classList.toggle('hidden', done);
    el.overlay.className = 'overlay' + (done ? ' ' + cls : '') + (done ? '' : ' hidden');
    el.stateText.className = 'state-text' + (done ? ' ' + cls : '');

    if (data.status === 'PAID') {
      el.icon.textContent = '✓';
      el.stateText.textContent = 'ការទូទាត់ជោគជ័យ! អរគុណ។';
      finish();
    } else if (data.status === 'EXPIRED') {
      el.icon.textContent = '⏱';
      el.stateText.textContent = 'Order នេះផុតកំណត់ហើយ។ សូមបង្កើតថ្មី។ កុំបង់ប្រាក់ទៅ QR នេះទៀត។';
      finish();
    } else if (data.status === 'FAILED') {
      el.icon.textContent = '!';
      el.stateText.textContent = 'ប្រតិបត្តិការមិនត្រូវនឹង Order នេះ។ សូមទាក់ទងអ្នកគ្រប់គ្រង ហើយផ្ដល់លេខ Order។';
      finish();
    } else {
      el.stateText.textContent = 'សូមស្កេន QR ដោយកម្មវិធីធនាគារដែលគាំទ្រ KHQR';
    }
  }

  function finish() {
    stopTimers();
    safeStore.clear();
    el.warn.classList.add('hidden');
  }

  function stopTimers() {
    if (pollTimer) clearTimeout(pollTimer);
    if (tickTimer) clearInterval(tickTimer);
    pollTimer = tickTimer = null;
  }

  function tick() {
    if (!order || order.status !== 'PENDING') return;
    const remain = new Date(order.expiresAt).getTime() - (Date.now() + skew);
    if (remain <= 0) {
      el.countdown.textContent = '00:00';
      el.barFill.style.width = '0%';
      el.stateText.textContent = 'ផុតពេលហើយ កំពុងផ្ទៀងផ្ទាត់ចុងក្រោយ...';
      return;
    }
    el.countdown.textContent = fmtTime(remain);
    el.barFill.style.width = Math.max(0, Math.min(100, (remain / totalMs) * 100)) + '%';
  }

  // ---------- polling (server throttles per order as well) ----------
  function schedulePoll(delay) {
    if (pollTimer) clearTimeout(pollTimer);
    if (!order || order.status !== 'PENDING') return;
    pollTimer = setTimeout(poll, delay);
  }

  async function poll() {
    if (polling || !order || order.status !== 'PENDING') return;
    polling = true;
    try {
      const data = await api('/check/' + encodeURIComponent(order.orderId), { method: 'POST' });
      errCount = 0;
      el.warn.classList.add('hidden');
      applyOrder(data);
    } catch (err) {
      errCount += 1;
      if (err.code === 'ORDER_NOT_FOUND') {
        finish();
        showStartOver('រកមិនឃើញ Order នេះទេ សូមបង្កើតថ្មី');
        polling = false;
        return;
      }
      el.warnText.textContent = err.message + ' (កំពុងព្យាយាមម្ដងទៀតដោយស្វ័យប្រវត្តិ)';
      el.warn.classList.add('soft');
      el.warn.classList.remove('hidden');
    } finally {
      polling = false;
    }
    if (order && order.status === 'PENDING') {
      const base = document.hidden ? POLL_HIDDEN_MS : POLL_VISIBLE_MS;
      const delay = errCount ? Math.min(POLL_MAX_MS, base * Math.pow(2, Math.min(errCount, 4))) : base;
      schedulePoll(delay);
    }
  }

  el.retry.addEventListener('click', () => { errCount = 0; el.warn.classList.add('hidden'); poll(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && order && order.status === 'PENDING') schedulePoll(500); });

  function showStartOver(msg) {
    el.warnText.textContent = msg;
    el.warn.classList.remove('soft', 'hidden');
  }

  // ---------- copy ----------
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
  }
  document.querySelectorAll('.copy').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!order) return;
      const text = btn.dataset.copy === 'orderId' ? order.orderId : String(order.amount);
      const ok = await copyText(text);
      const old = btn.textContent;
      btn.textContent = ok ? 'បានចម្លង ✓' : 'ចម្លងមិនបាន';
      btn.classList.toggle('done', ok);
      setTimeout(() => { btn.textContent = old; btn.classList.remove('done'); }, 1500);
    });
  });

  // ---------- new order / resume ----------
  el.newBtn.addEventListener('click', () => {
    stopTimers();
    order = null;
    safeStore.clear();
    el.orderView.classList.add('hidden');
    el.formView.classList.remove('hidden');
    el.formError.classList.add('hidden');
    el.amount.focus();
  });

  (async function resume() {
    const id = safeStore.get();
    if (!id) return;
    try {
      const data = await api('/order/' + encodeURIComponent(id));
      if (data.status === 'PENDING' && new Date(data.expiresAt) > new Date(data.serverTime)) {
        startOrder(data);
      } else {
        safeStore.clear();
      }
    } catch (_) {
      safeStore.clear();
    }
  })();
})();
