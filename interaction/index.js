const root = document.documentElement;
const toggle = document.querySelector('.theme-toggle');
const toggleLabel = toggle?.querySelector('.label');
const cursor = document.querySelector('.cursor');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Tema persistente com fallback seguro quando o armazenamento estiver indisponível.
let isDark = true;
try {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') isDark = savedTheme === 'dark';
} catch { /* O tema continua funcionando sem localStorage. */ }

function applyTheme(dark, persist = false) {
  isDark = dark;
  root.dataset.theme = dark ? 'dark' : 'light';
  toggle?.setAttribute('aria-pressed', String(dark));
  if (toggleLabel) toggleLabel.textContent = dark ? 'Escuro' : 'Claro';
  if (persist) {
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch { /* Ignora armazenamento bloqueado. */ }
  }
}

applyTheme(isDark);
toggle?.addEventListener('click', () => applyTheme(!isDark, true));

// Patinha acompanha o ponteiro com uma transição CSS leve.
if (finePointer && cursor) {
  root.classList.add('has-custom-cursor');
  let frame = 0;
  window.addEventListener('pointermove', (event) => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      cursor.classList.add('is-visible');
      frame = 0;
    });
  }, { passive: true });

  document.addEventListener('pointerover', (event) => {
    if (event.target.closest('a, button, [data-cursor="hover"]')) cursor.classList.add('is-hovering');
  });
  document.addEventListener('pointerout', (event) => {
    if (!event.target.closest('a, button, [data-cursor="hover"]')) return;
    const next = event.relatedTarget?.closest?.('a, button, [data-cursor="hover"]');
    if (!next) cursor.classList.remove('is-hovering');
  });
  window.addEventListener('pointerdown', () => cursor.classList.add('is-pressed'));
  window.addEventListener('pointerup', () => cursor.classList.remove('is-pressed'));
  document.addEventListener('mouseleave', () => cursor.classList.remove('is-visible'));
  document.addEventListener('mouseenter', () => cursor.classList.add('is-visible'));
}

// Revelações progressivas sem esconder conteúdo quando animações são reduzidas.
if (!reduceMotion && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-revealed');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('[data-scroll], [data-reveal]').forEach((element) => {
    element.classList.add('will-reveal');
    revealObserver.observe(element);
  });
} else {
  document.querySelectorAll('[data-scroll], [data-reveal]').forEach((element) => element.classList.add('is-revealed'));
}