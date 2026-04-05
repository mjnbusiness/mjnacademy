/* MJN ACADEMY — main.js
   Dark only · Tajik only · TJS currency · Monthly pricing
   Video screen protection included
*/

(function () {
  'use strict';

  // ----- 1. FORCE DARK THEME (no toggle) -----
  const html = document.documentElement;
  html.setAttribute('data-theme', 'dark');

  // ----- 2. SCROLL REVEAL, NAVBAR EFFECT, SMOOTH SCROLL -----
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  const revealItems = document.querySelectorAll('.offer-card');
  if ('IntersectionObserver' in window && revealItems.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = parseInt(el.getAttribute('data-delay') || '0', 10);
          setTimeout(() => el.classList.add('visible'), delay);
          revealObserver.unobserve(el);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach(el => revealObserver.observe(el));
  } else {
    revealItems.forEach(el => el.classList.add('visible'));
  }

  // ----- 3. PRICE COUNT-UP (TJS: 432 monthly) -----
  const amountEls = document.querySelectorAll('.amount');
  const targetSomoni = 432;
  let animated = false;
  
  if (amountEls.length && 'IntersectionObserver' in window) {
    const priceObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !animated) {
          animated = true;
          amountEls.forEach(amountEl => {
            let startVal = 0;
            const duration = 950;
            const startTime = performance.now();
            const updateCounter = (now) => {
              const elapsed = now - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const currentValue = Math.floor(eased * targetSomoni);
              amountEl.textContent = currentValue;
              if (progress < 1) requestAnimationFrame(updateCounter);
              else amountEl.textContent = targetSomoni;
            };
            requestAnimationFrame(updateCounter);
          });
          priceObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.35 });
    priceObserver.observe(amountEls[0]);
  }

  // ----- 4. ALL BUTTONS LEAD TO LOGIN PAGE -----
  const allButtons = document.querySelectorAll('.btn-nav, .btn-cta');
  allButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'pages/login.html';
    });
  });

  // ----- 5. SMOOTH SCROLL FOR ANCHOR LINKS -----
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const targetElement = document.querySelector(targetId);
      if (!targetElement) return;
      e.preventDefault();
      const navHeight = navbar ? navbar.offsetHeight : 70;
      const offsetPosition = targetElement.getBoundingClientRect().top + window.scrollY - navHeight - 12;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    });
  });

  // ----- 6. PARALLAX BACKGROUND EFFECT -----
  const heroBgGrid = document.querySelector('.hero-bg-grid');
  if (heroBgGrid && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('scroll', () => {
      heroBgGrid.style.transform = `translateY(${window.scrollY * 0.2}px)`;
    }, { passive: true });
  }

  // ----- 7. ADD VISIBLE CLASS STYLES -----
  const style = document.createElement('style');
  style.textContent = `
    .offer-card.visible { opacity: 1; transform: translateY(0); }
    .offer-card { opacity: 0; transform: translateY(28px); transition: opacity 0.6s cubic-bezier(0.2,0.9,0.4,1.1), transform 0.6s ease; }
  `;
  document.head.appendChild(style);

  // ----- 8. VIDEO SCREEN PROTECTION -----
  const videoFrame = document.getElementById('videoFrame');
  const videoIframe = document.getElementById('courseVideo');
  
  if (videoFrame) {
    videoFrame.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
  }
  
  if (videoIframe) {
    videoIframe.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
    
    videoIframe.addEventListener('dragstart', (e) => {
      e.preventDefault();
      return false;
    });
    
    videoIframe.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });
  }
  
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U' || e.key === 'c' || e.key === 'C')) {
      if (document.activeElement && videoFrame && videoFrame.contains(document.activeElement)) {
        e.preventDefault();
      }
      if (e.target === videoIframe || (videoFrame && videoFrame.contains(e.target))) {
        e.preventDefault();
      }
    }
  });
})();