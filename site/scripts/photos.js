// Keyboard and swipe navigation for the :target lightbox.
(() => {
  const getOpenIndex = () => {
    const m = location.hash.match(/^#photo-(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  };

  const total = () => document.querySelectorAll('.photo-item').length;

  const goTo = (n) => { location.hash = `#photo-${n}`; };
  const close = () => { location.hash = '#photos-top'; };

  // ── Keyboard ──
  document.addEventListener('keydown', (e) => {
    const i = getOpenIndex();
    if (i === null) return;
    if (e.key === 'Escape')           { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft'  && i > 1)        { e.preventDefault(); goTo(i - 1); }
    else if (e.key === 'ArrowRight' && i < total())  { e.preventDefault(); goTo(i + 1); }
  });

  // ── Touch swipe ──
  let touchStartX = null;
  document.addEventListener('touchstart', (e) => {
    if (getOpenIndex() === null) return;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) < 50) return;
    const i = getOpenIndex();
    if (i === null) return;
    if (dx > 0 && i > 1)       goTo(i - 1);
    else if (dx < 0 && i < total()) goTo(i + 1);
  }, { passive: true });
})();