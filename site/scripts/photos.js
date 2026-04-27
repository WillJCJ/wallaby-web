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

  const getItems = () => Array.from(document.querySelectorAll('.photo-item[id]'));
  const getOpenItem = () => {
    const hash = location.hash;
    if (!hash || hash === '#photos-top') return null;
    const id = decodeURIComponent(hash.slice(1));
    return document.getElementById(id);
  };
  const getOpenIndex = () => {
    const openItem = getOpenItem();
    if (!openItem) return null;
    const items = getItems();
    const index = items.indexOf(openItem);
    return index >= 0 ? index + 1 : null;
  };
  const getItemByIndex = (n) => getItems()[n - 1] || null;

  const mediaSelector = '.photo-thumb-link img, .photo-thumb-link video';
  const lightboxMediaSelector = '.lightbox-media-wrap img, .lightbox-media-wrap video';

  const pauseOtherVideos = (exceptId = null) => {
    document.querySelectorAll('.lightbox-video').forEach((video) => {
      const parent = video.closest('.photo-item');
      if (!parent) return;
      if (parent.id === exceptId) return;
      video.pause();
    });
  };

  const total = () => getItems().length;
  const setHash = (hash, { replace = false } = {}) => {
    if (replace) {
      location.replace(hash);
      return;
    }
    location.hash = hash;
  };

  const goTo = (n) => {
    const current = getOpenItem();
    const next = getItemByIndex(n);
    if (!current || !next) return;

    if (!document.startViewTransition) {
      setHash(`#${next.id}`, { replace: true });
      return;
    }

    const currentIndex = getOpenIndex();
    const direction = currentIndex !== null && n > currentIndex ? 'forward' : 'back';
    const currentWrap = current.querySelector('.lightbox-media-wrap');
    const nextWrap = next.querySelector('.lightbox-media-wrap');

    // Set the named transition on the outgoing element only before the snapshot.
    if (currentWrap) currentWrap.style.viewTransitionName = 'lightbox-photo';
    document.documentElement.dataset.navDirection = direction;

    svt(() => {
      // Swap names: old is captured, transfer the name to the incoming element.
      if (currentWrap) currentWrap.style.viewTransitionName = '';
      if (nextWrap) nextWrap.style.viewTransitionName = 'lightbox-photo';
      pauseOtherVideos(next.id);
      setHash(`#${next.id}`, { replace: true });
    }).then(() => {
      if (nextWrap) nextWrap.style.viewTransitionName = '';
      delete document.documentElement.dataset.navDirection;
    });
  };
  const openPhoto = (id) => {
    const item = document.getElementById(id);
    if (!item) return;
    if (!document.startViewTransition) {
      location.hash = `#${id}`;
      return;
    }
    const thumbMedia = item.querySelector(mediaSelector);
    const lightboxMedia = item.querySelector(lightboxMediaSelector);
    if (thumbMedia) thumbMedia.style.viewTransitionName = 'photo-zoom';
    svt(() => {
      if (thumbMedia) thumbMedia.style.viewTransitionName = '';
      if (lightboxMedia) lightboxMedia.style.viewTransitionName = 'photo-zoom';
      pauseOtherVideos(id);
      location.hash = `#${id}`;
    }).then(() => {
      if (lightboxMedia) lightboxMedia.style.viewTransitionName = '';
      item.querySelector('.lightbox-close-btn')?.focus();
    });
  };

  const closePhoto = () => {
    const openItem = getOpenItem();
    if (!document.startViewTransition || !openItem) {
      location.hash = '#photos-top';
      return;
    }
    const thumbMedia = openItem.querySelector(mediaSelector);
    const lightboxMedia = openItem.querySelector(lightboxMediaSelector);
    pauseOtherVideos();
    if (lightboxMedia) lightboxMedia.style.viewTransitionName = 'photo-zoom';
    svt(() => {
      if (lightboxMedia) lightboxMedia.style.viewTransitionName = '';
      if (thumbMedia) thumbMedia.style.viewTransitionName = 'photo-zoom';
      location.hash = '#photos-top';
    }).then(() => {
      if (thumbMedia) thumbMedia.style.viewTransitionName = '';
      openItem.querySelector('.photo-thumb-link')?.focus();
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
    if (status) status.textContent = `Media ${i} of ${total()}`;

    const item = getOpenItem();
    if (!item) return;
    const img = item.querySelector('.photo-lightbox img[data-hires]');
    const wrap = item.querySelector('.lightbox-media-wrap');
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
    const href = thumb.getAttribute('href') || '';
    const id = href.startsWith('#') ? decodeURIComponent(href.slice(1)) : '';
    if (id) openPhoto(id);
  });

  // ── Nav arrow clicks → directional slide ──
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('.lightbox-nav');
    if (!nav || nav.classList.contains('lightbox-nav--disabled')) return;
    e.preventDefault();
    const i = getOpenIndex();
    if (i === null) return;
    const dir = nav.dataset.navDir;
    if (dir === 'prev' && i > 1) goTo(i - 1);
    else if (dir === 'next' && i < total()) goTo(i + 1);
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
          !target.closest('.lightbox-media-wrap') &&
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