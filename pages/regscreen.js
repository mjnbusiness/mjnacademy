/* MJN ACADEMY — Waitlist registration (fixed: no auth refresh, CSP handled, button disable) */
(function() {
  'use strict';

  const SUPABASE_URL = "https://qfuiotahocgknxhcjylh.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmdWlvdGFob2Nna254aGNqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDM1MDEsImV4cCI6MjA5MDIxOTUwMX0.XGauYwbIhlixu32i-BUvmVqCWb--dxNqVKJjzoC-jCc"; 

  // Ensure Supabase library is loaded
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded!');
    showErrorToast('Китобхонаи Supabase бор нашуд. Саҳифаро нав кунед.');
    return;
  }

  // CRITICAL: disable session persistence to prevent token refresh attempts
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  console.log('Supabase client created (auth disabled)');

  const form = document.getElementById('waitlistForm');
  const fullName = document.getElementById('fullName');
  const phone = document.getElementById('phone');
  const regEmail = document.getElementById('regEmail');
  const regUsername = document.getElementById('regUsername');
  const usernameStatus = document.getElementById('usernameStatus');
  const terms = document.getElementById('termsCheckbox');
  const submitBtn = form.querySelector('button[type="submit"]');

  const successModal = document.getElementById('successModal');
  const modalOkBtn = document.getElementById('modalOkBtn');
  let redirectTimer = null;

  let checkTimeout = null;
  let isUsernameAvailable = false;
  let lastCheck = 0;

  // ------------------------- UI Helpers -------------------------
  function showErrorToast(text) {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();
    const msg = document.createElement('div');
    msg.className = 'toast-message toast-error';
    msg.textContent = text;
    msg.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #dc2626;
      color: white;
      padding: 14px 24px;
      border-radius: 100px;
      font-family: var(--font-body);
      font-size: 0.9rem;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: slideUp 0.3s ease;
      pointer-events: none;
      white-space: normal;
      max-width: 90%;
      text-align: center;
      line-height: 1.4;
    `;
    document.body.appendChild(msg);
    setTimeout(() => {
      msg.style.opacity = '0';
      setTimeout(() => msg.remove(), 300);
    }, 5000);
  }

  function showSuccessModal(userName) {
  const modal = successModal;
  const modalText = modal.querySelector('p');
  // ✅ SAFE: use textContent instead of innerHTML
  modalText.textContent = `Маълумоти шумо қабул шуд, ${userName}. Админ пардохтро тасдиқ мекунад ва ба шумо занг мезанад.`;
  // Add line break using CSS or separate element if needed
  modal.classList.add('active');
  if (redirectTimer) clearTimeout(redirectTimer);
  redirectTimer = setTimeout(() => {
    modal.classList.remove('active');
    window.location.href = '../index.html';
  }, 4000);
}

  // ------------------------- Username availability -------------------------
  async function checkUsername(username) {
    const now = Date.now();
    if (now - lastCheck < 2000) {
      usernameStatus.textContent = 'Лутфан каме интизор шавед...';
      usernameStatus.style.color = '#FF6B00';
      return;
    }
    lastCheck = now;
    if (username.length < 3) {
      usernameStatus.textContent = 'Ҳадди ақал 3 рамз';
      usernameStatus.style.color = '#dc2626';
      isUsernameAvailable = false;
      return;
    }
    const regex = /^[a-zA-Z0-9_]{3,30}$/;
    if (!regex.test(username)) {
      usernameStatus.textContent = 'Фақат ҳарф, рақам ва _';
      usernameStatus.style.color = '#dc2626';
      isUsernameAvailable = false;
      return;
    }
    try {
      const [profiles, waitlist] = await Promise.all([
        supabaseClient.from('profiles').select('username').eq('username', username).maybeSingle(),
        supabaseClient.from('waitlist').select('username').eq('username', username).maybeSingle()
      ]);
      const exists = profiles.data !== null || waitlist.data !== null;
      if (exists) {
        usernameStatus.textContent = '❌ Ин номи корбарӣ аллакай истифода шудааст';
        usernameStatus.style.color = '#dc2626';
        isUsernameAvailable = false;
      } else {
        usernameStatus.textContent = '✅ Номи корбарӣ дастрас аст';
        usernameStatus.style.color = '#10b981';
        isUsernameAvailable = true;
      }
    } catch (err) {
      console.error('Username check error:', err);
      usernameStatus.textContent = 'Хатогии пайвастшавӣ';
      usernameStatus.style.color = '#dc2626';
      isUsernameAvailable = false;
    }
  }

  regUsername.addEventListener('input', (e) => {
    clearTimeout(checkTimeout);
    const val = e.target.value.trim();
    if (val.length < 3) {
      usernameStatus.textContent = 'Ҳадди ақал 3 рамз';
      usernameStatus.style.color = '#dc2626';
      isUsernameAvailable = false;
      return;
    }
    checkTimeout = setTimeout(() => checkUsername(val), 600);
  });

  // ------------------------- Form submission (button disable on submit) -------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Disable button immediately
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Дар ҳоли номнависӣ...';
    submitBtn.disabled = true;

    const name = fullName.value.trim();
    const phoneVal = phone.value.trim();
    const email = regEmail.value.trim();
    const username = regUsername.value.trim();
    const termsOk = terms.checked;

    // Validation
    if (name.length < 2) {
      showErrorToast('Номи пурраро дуруст ворид кунед');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }
    if (!/^\+992[0-9]{9}$/.test(phoneVal)) {
      showErrorToast('Телефон бо +992 ва 9 рақам ворид кунед');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }
    if (!email.includes('@')) {
      showErrorToast('Email дуруст нест');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }
    if (!username) {
      showErrorToast('Номи корбариро ворид кунед');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }
    if (!isUsernameAvailable) {
      showErrorToast('Номи корбарӣ дастрас нест');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }
    if (!termsOk) {
      showErrorToast('Шартҳоро қабул кунед');
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }

    try {
      const { data, error } = await supabaseClient
        .from('waitlist')
        .insert([{
          full_name: name,
          phone: phoneVal,
          email: email,
          username: username,
          registered_at: new Date(),
          status: 'pending'
        }])
        .select();

      console.log('Supabase response:', { data, error });

      if (error) {
        let errorMsg = 'Хатогӣ: ' + error.message;
        if (error.code === '23505') errorMsg = 'Ин номи корбарӣ ё email аллакай сабт шудааст';
        if (error.code === '42501') {
          errorMsg = 'Хатогии иҷозат (RLS). Ба админ муроҷиат кунед ё сиёсати INSERT-ро барои ҷадвали waitlist илова кунед.';
          console.error('RLS error: Please enable INSERT policy for anon users on waitlist table');
        }
        showErrorToast(errorMsg);
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        return;
      }

      // Success
      showSuccessModal(name);
      form.reset();
      usernameStatus.textContent = '';
      isUsernameAvailable = false;
      // Button stays disabled until redirect (prevents double submit)
      // No need to re-enable because page will redirect.

    } catch (err) {
      console.error('Catch error:', err);
      let userMsg = 'Хатогии сервер. Санҷед, ки Supabase дастрас аст.';
      if (err.message === 'Failed to fetch') {
        userMsg = 'Пайваст шудан ба сервер имконнопазир аст. Санҷед: 1) Supabase фаъол аст? 2) Интернети шумо кор мекунад? 3) Адрес дуруст аст?';
      } else {
        userMsg = 'Хатогии сервер: ' + err.message;
      }
      showErrorToast(userMsg);
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });

  modalOkBtn.addEventListener('click', () => {
    if (redirectTimer) clearTimeout(redirectTimer);
    successModal.classList.remove('active');
    window.location.href = '../index.html';
  });

  // Add animation style
  if (!document.querySelector('#toastStyle')) {
    const style = document.createElement('style');
    style.id = 'toastStyle';
    style.textContent = `
      @keyframes slideUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
})();