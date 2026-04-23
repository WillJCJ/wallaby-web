// Keyboard, swipe navigation and lightbox enhancements for the :target lightbox.
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

  // ── Thumbnail placeholder while hi-res loads ──
  // When a photo lightbox opens, immediately show the already-loaded thumbnail
  // while the full-resolution image fetches in the background.
  window.addEventListener('hashchange', () => {
    const i = getOpenIndex();
    if (i === null) return;
    const item = document.getElementById(`photo-${i}`);
    if (!item) return;
    const thumbImg = item.querySelector('.photo-thumb-link img');
    const lightboxImg = item.querySelector('.photo-lightbox img');
    if (!thumbImg || !lightboxImg || lightboxImg.complete) return;
    const hiresSrc = lightboxImg.src;
    lightboxImg.src = thumbImg.src;
    const loader = new Image();
    loader.onload = () => { lightboxImg.src = hiresSrc; };
    loader.src = hiresSrc;
  });

  // ── Close on click outside the image ──
  // Handles tapping outside the figure on mobile (including iOS Safari, which
  // sometimes doesn't fire click on transparent backdrop anchors).
  document.addEventListener('click', (e) => {
    if (getOpenIndex() === null) return;
    if (!e.target.closest('.lightbox-figure') &&
        !e.target.closest('.lightbox-nav') &&
        !e.target.closest('.lightbox-close-btn')) {
      close();
    }
  });

  // ── Touch swipe ──
  let touchStartX = null;
  let isPinch = false;

  document.addEventListener('touchstart', (e) => {
    if (getOpenIndex() === null) return;
    isPinch = e.touches.length > 1;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  // Track additional fingers added mid-gesture (pinch starting after touchstart)
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) isPinch = true;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (isPinch) { isPinch = false; return; }
    if (Math.abs(dx) < 50) return;
    const i = getOpenIndex();
    if (i === null) return;
    if (dx > 0 && i > 1)       goTo(i - 1);
    else if (dx < 0 && i < total()) goTo(i + 1);
  }, { passive: true });
})();