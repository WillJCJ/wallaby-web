// Keyboard, swipe navigation and lightbox enhancements for the :target lightbox.
(() => {
  // ── Mark already-loaded thumbnails ──
  // Handles images already in cache when the script runs (complete before load fires).
  const markLoaded = (img) => img.classList.add('loaded');
  document.querySelectorAll('.photo-thumb-link img').forEach(img => {
    if (img.complete) markLoaded(img);
    else img.addEventListener('load', () => markLoaded(img), { once: true });
  });
  // Tracks whether a view transition is currently animating.
  // Uses a symbol token so that if a second transition interrupts the first,
  // the first transition's rejected .finished doesn't clear the guard prematurely.
  let transitionToken = null;
  const svt = (fn) => {
    const token = Symbol();
    transitionToken = token;
    return document.startViewTransition(fn).finished
      .then(() => { if (transitionToken === token) transitionToken = null; })
      .catch(() => { if (transitionToken === token) transitionToken = null; });
  };
  const transitionActive = () => transitionToken !== null;

  const getOpenIndex = () => {
    const m = location.hash.match(/^#photo-(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
  };

  const total = () => document.querySelectorAll('.photo-item').length;

  const goTo = (n) => {
    const current = getOpenIndex();
    if (!document.startViewTransition || current === null) {
      location.hash = `#photo-${n}`;
      return;
    }

    const direction = n > current ? 'forward' : 'back';
    const currentWrap = document.getElementById(`photo-${current}`)?.querySelector('.lightbox-img-wrap');
    const nextWrap = document.getElementById(`photo-${n}`)?.querySelector('.lightbox-img-wrap');

    // Set the named transition on the outgoing element only before the snapshot.
    if (currentWrap) currentWrap.style.viewTransitionName = 'lightbox-photo';
    document.documentElement.dataset.navDirection = direction;

    svt(() => {
      // Swap names: old is captured, transfer the name to the incoming element.
      if (currentWrap) currentWrap.style.viewTransitionName = '';
      if (nextWrap) nextWrap.style.viewTransitionName = 'lightbox-photo';
      location.hash = `#photo-${n}`;
    }).then(() => {
      if (nextWrap) nextWrap.style.viewTransitionName = '';
      delete document.documentElement.dataset.navDirection;
    });
  };
  const openPhoto = (n) => {
    if (!document.startViewTransition) {
      location.hash = `#photo-${n}`;
      return;
    }
    const thumbImg = document.getElementById(`photo-${n}`)?.querySelector('.photo-thumb-link img');
    const lightboxImg = document.getElementById(`photo-${n}`)?.querySelector('.lightbox-img-wrap img');
    if (thumbImg) thumbImg.style.viewTransitionName = 'photo-zoom';
    svt(() => {
      if (thumbImg) thumbImg.style.viewTransitionName = '';
      if (lightboxImg) lightboxImg.style.viewTransitionName = 'photo-zoom';
      location.hash = `#photo-${n}`;
    }).then(() => {
      if (lightboxImg) lightboxImg.style.viewTransitionName = '';
      document.getElementById(`photo-${n}`)?.querySelector('.lightbox-close-btn')?.focus();
    });
  };

  const closePhoto = () => {
    const i = getOpenIndex();
    if (!document.startViewTransition || i === null) {
      location.hash = '#photos-top';
      return;
    }
    const thumbImg = document.getElementById(`photo-${i}`)?.querySelector('.photo-thumb-link img');
    const lightboxImg = document.getElementById(`photo-${i}`)?.querySelector('.lightbox-img-wrap img');
    if (lightboxImg) lightboxImg.style.viewTransitionName = 'photo-zoom';
    svt(() => {
      if (lightboxImg) lightboxImg.style.viewTransitionName = '';
      if (thumbImg) thumbImg.style.viewTransitionName = 'photo-zoom';
      location.hash = '#photos-top';
    }).then(() => {
      if (thumbImg) thumbImg.style.viewTransitionName = '';
      document.getElementById(`photo-${i}`)?.querySelector('.photo-thumb-link')?.focus();
      const status = document.getElementById('lightbox-status');
      if (status) status.textContent = '';
    });
  };

  // ── Keyboard ──
  document.addEventListener('keydown', (e) => {
    const i = getOpenIndex();
    if (i === null) return;
    if (e.key === 'Escape')           { e.preventDefault(); closePhoto(); }
    else if (e.key === 'ArrowLeft'  && i > 1)        { e.preventDefault(); goTo(i - 1); }
    else if (e.key === 'ArrowRight' && i < total())  { e.preventDefault(); goTo(i + 1); }
  });

  // ── Loading placeholder + hi-res upgrade ──
  // Shows the thumbnail blurred with a loading logo while hi-res fetches,
  // then swaps in the full image atomically once it's completely loaded.
  window.addEventListener('hashchange', () => {
    const i = getOpenIndex();
    if (i === null) return;

    const status = document.getElementById('lightbox-status');
    if (status) status.textContent = `Photo ${i} of ${total()}`;

    const item = document.getElementById(`photo-${i}`);
    if (!item) return;
    const img = item.querySelector('.photo-lightbox img');
    const wrap = item.querySelector('.lightbox-img-wrap');
    if (!img || !wrap) return;

    const setLoading = (loading) => wrap.classList.toggle('is-loading', loading);

    const hires = img.dataset.hires;
    if (!hires || img.src === new URL(hires, location.href).href) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const loader = new Image();
    loader.onload = () => {
      // By the time hi-res loads, the user may have navigated away. If so,
      // update src silently so it's cached but skip the view transition — a
      // stale svt() call would interrupt the current slide animation.
      if (getOpenIndex() !== i) {
        img.src = hires;
        return;
      }
      if (document.startViewTransition) {
        wrap.style.viewTransitionName = 'hires-load';
        svt(() => {
          img.src = hires;
          setLoading(false);
        }).then(() => {
          wrap.style.viewTransitionName = '';
        });
      } else {
        img.src = hires;
        setLoading(false);
      }
    };
    loader.src = hires;
  });

  // ── Thumbnail clicks → zoom open ──
  document.addEventListener('click', (e) => {
    const thumb = e.target.closest('.photo-thumb-link');
    if (!thumb) return;
    e.preventDefault();
    const m = thumb.getAttribute('href')?.match(/#photo-(\d+)/);
    if (m) openPhoto(parseInt(m[1], 10));
  });

  // ── Nav arrow clicks → directional slide ──
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('.lightbox-nav');
    if (!nav || nav.classList.contains('lightbox-nav--disabled')) return;
    e.preventDefault();
    const m = nav.getAttribute('href')?.match(/#photo-(\d+)/);
    if (m) goTo(parseInt(m[1], 10));
  });

  // ── Close → zoom back to thumbnail ──
  document.addEventListener('click', (e) => {
    if (getOpenIndex() === null || transitionActive()) return;
    if (e.target.closest('.lightbox-close') || e.target.closest('.lightbox-close-btn')) {
      e.preventDefault();
      closePhoto();
      return;
    }
    if (!e.target.closest('.lightbox-figure') && !e.target.closest('.lightbox-nav')) {
      closePhoto();
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
    const i = getOpenIndex();
    if (i === null) return;
    if (Math.abs(dx) < 50) {
      // Tap — close if the touch landed outside the image and nav controls.
      if (transitionActive()) return;
      const touch = e.changedTouches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (target &&
          !target.closest('.lightbox-img-wrap') &&
          !target.closest('.lightbox-nav') &&
          !target.closest('.lightbox-close-btn')) {
        closePhoto();
      }
      return;
    }
    if (dx > 0 && i > 1)       goTo(i - 1);
    else if (dx < 0 && i < total()) goTo(i + 1);
  }, { passive: true });
})();