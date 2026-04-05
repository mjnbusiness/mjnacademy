/* MJN ACADEMY — Login page (secure, admin redirection) */
(function() {
  'use strict';

  const SUPABASE_URL = "https://qfuiotahocgknxhcjylh.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmdWlvdGFob2Nna254aGNqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NDM1MDEsImV4cCI6MjA5MDIxOTUwMX0.XGauYwbIhlixu32i-BUvmVqCWb--dxNqVKJjzoC-jCc";

  // Ensure Supabase library is loaded
  if (typeof supabase === 'undefined') {
    console.error('Supabase library not loaded');
    showMessage('Китобхонаи Supabase бор нашуд. Саҳифаро нав кунед.', 'error');
    return;
  }

  // Create client with minimal auth persistence (optional)
  const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true }
  });

  const loginForm = document.getElementById('loginForm');
  const forgotLink = document.getElementById('forgotLink');

  // ---------- Helper: Safe toast message (no innerHTML) ----------
  function showMessage(text, type = 'info') {
    const existing = document.querySelector('.toast-message');
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = `toast-message toast-${type}`;
    // ✅ SAFE: use textContent, not innerHTML
    msg.textContent = text;
    msg.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#dc2626' : (type === 'success' ? '#10b981' : '#FF6B00')};
      color: white;
      padding: 12px 20px;
      border-radius: 100px;
      font-family: var(--font-body);
      font-size: 0.85rem;
      font-weight: 500;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      animation: slideUp 0.3s ease;
      pointer-events: none;
    `;
    document.body.appendChild(msg);
    setTimeout(() => {
      msg.style.opacity = '0';
      setTimeout(() => msg.remove(), 300);
    }, 4000);
  }

  // ---------- LOGIN HANDLER with admin redirection ----------
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    const remember = document.getElementById('rememberMe').checked;

    if (!identifier || !password) {
      showMessage('Ҳамаи майдонҳоро пур кунед', 'error');
      return;
    }

    showMessage('Дар ҳоли санҷиш...', 'info');

    let email = identifier;
    const isEmail = identifier.includes('@');

    try {
      // Query the 'profiles' table (or 'user_profiles' – adjust to your actual table name)
      // IMPORTANT: your existing code uses 'profiles'. Change to 'user_profiles' if needed.
      let query = supabaseClient.from('profiles').select('email, status, is_admin');
      if (isEmail) {
        query = query.eq('email', identifier);
      } else {
        query = query.eq('username', identifier);
      }
      const { data: profile, error: profileError } = await query.maybeSingle();

      if (profileError || !profile) {
        showMessage('Корбар ёфт нашуд. Аввал номнавис шавед.', 'error');
        return;
      }

      // Check if profile is approved (or active)
      if (profile.status !== 'approved' && profile.status !== 'active') {
        showMessage('Ҳисоби шумо ҳанӯз тасдиқ нашудааст. Мунтазири занги админ шавед.', 'error');
        return;
      }

      email = profile.email;

      // Attempt sign in with Supabase Auth
      const { error: signError } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (signError) {
        showMessage('Рамз нодуруст аст', 'error');
        return;
      }

      // Save "remember me" preference
      if (remember) {
        localStorage.setItem('rememberedIdentifier', identifier);
      } else {
        localStorage.removeItem('rememberedIdentifier');
      }

      // Redirect based on admin flag
      if (profile.is_admin === true) {
        showMessage('Вуруд ба панели админ муваффақ!', 'success');
        setTimeout(() => {
          window.location.href = '../admins/dashboard.html';
        }, 1500);
      } else {
        showMessage('Вуруд муваффақ! Ба саҳифаи асосӣ равона мешавем...', 'success');
        setTimeout(() => {
          window.location.href = '../index.html';
        }, 1500);
      }
    } catch (err) {
      console.error('Login error:', err);
      showMessage('Хатогӣ дар санҷиш. Дубора кӯшиш кунед.', 'error');
    }
  });

  // ---------- FORGOT PASSWORD (safe) ----------
  forgotLink.addEventListener('click', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('loginIdentifier').value.trim();
    if (!identifier) {
      showMessage('Email ё номи корбариро ворид кунед', 'error');
      return;
    }

    let email = identifier;
    const isEmail = identifier.includes('@');

    try {
      if (!isEmail) {
        const { data, error } = await supabaseClient
          .from('profiles')
          .select('email')
          .eq('username', identifier)
          .maybeSingle();
        if (error || !data) {
          showMessage('Номи корбарӣ пайдо нашуд', 'error');
          return;
        }
        email = data.email;
      }

      const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password.html'
      });
      if (error) {
        showMessage('Хатогӣ: ' + error.message, 'error');
      } else {
        showMessage('Пайванди барқарорсозӣ ба email-и шумо фиристода шуд', 'success');
      }
    } catch (err) {
      console.error(err);
      showMessage('Хатогӣ дар ёфтани email', 'error');
    }
  });

  // ---------- "Remember me" auto‑fill ----------
  const remembered = localStorage.getItem('rememberedIdentifier');
  if (remembered) {
    const identifierField = document.getElementById('loginIdentifier');
    if (identifierField) {
      identifierField.value = remembered;
    }
    const rememberCheck = document.getElementById('rememberMe');
    if (rememberCheck) rememberCheck.checked = true;
  }

  // Add missing animation style if needed
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