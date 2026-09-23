// Keyboard, swipe navigation and lightbox enhancements for the :target lightbox.
(() => {
  let lightboxTrigger = null;

  const revealPrivateMediaForSignedInUser = async () => {
    const auth = window.WallabyAuth || null;
    const isSignedIn = await auth?.fetchSignedIn?.();
    if (!isSignedIn) {
      return;
    }

    document.querySelectorAll('[data-private-media="true"]').forEach((item) => {
      item.hidden = false;
    });

    handleHashChange();
  };

  // ── Mark already-loaded thumbnails ──
  // Handles images already in cache when the script runs (complete before load fires).
  const markLoaded = (img) => img.classList.add('loaded');
  document.querySelectorAll('.photo-thumb-link img').forEach(img => {
    if (img.complete) { markLoaded(img); }
    else { img.addEventListener('load', () => markLoaded(img), { once: true }); }
  });
  const getItems = () => Array.from(document.querySelectorAll('.photo-item[id]')).filter((item) => !item.hidden);
  const getOpenItem = () => {
    const hash = location.hash;
    if (!hash || hash === '#photos-top') { return null; }
    const id = decodeURIComponent(hash.slice(1));
    return document.getElementById(id);
  };
  const getOpenIndex = () => {
    const openItem = getOpenItem();
    if (!openItem) { return null; }
    const items = getItems();
    const index = items.indexOf(openItem);
    return index >= 0 ? index + 1 : null;
  };
  const getItemByIndex = (n) => getItems()[n - 1] || null;
  const getDialogForItem = (item) => item?.querySelector('.photo-lightbox') || null;

  const restoreTriggerFocus = () => {
    if (!lightboxTrigger || !document.contains(lightboxTrigger)) {
      lightboxTrigger = null;
      return;
    }
    lightboxTrigger.focus();
    lightboxTrigger = null;
  };

  const syncDialogsToHash = (openItem) => {
    getItems().forEach((item) => {
      const dialog = getDialogForItem(item);
      if (!dialog) { return; }

      const shouldBeOpen = Boolean(openItem) && item === openItem;

      if (shouldBeOpen && !dialog.open) {
        dialog.showModal();
      } else if (!shouldBeOpen && dialog.open) {
        dialog.close();
      }
    });
  };

  const pauseOtherVideos = (exceptId = null) => {
    document.querySelectorAll('.lightbox-video').forEach((video) => {
      const parent = video.closest('.photo-item');
      if (!parent) { return; }
      if (parent.id === exceptId) { return; }
      video.pause();
    });
  };

  const total = () => getItems().length;

  const goTo = (n) => {
    const next = getItemByIndex(n);
    if (!next) { return; }
    pauseOtherVideos(next.id);
    location.hash = `#${next.id}`;
  };

  const closePhoto = () => {
    pauseOtherVideos();
    location.hash = '#photos-top';
    const status = document.getElementById('lightbox-status');
    if (status) { status.textContent = ''; }
    restoreTriggerFocus();
  };

  // ── Keyboard ──
  document.addEventListener('keydown', (e) => {
    const i = getOpenIndex();
    if (i === null) { return; }
    if (e.key === 'Escape') { e.preventDefault(); closePhoto(); }
    else if (e.key === 'ArrowLeft' && i > 1) { e.preventDefault(); goTo(i - 1); }
    else if (e.key === 'ArrowRight' && i < total()) { e.preventDefault(); goTo(i + 1); }
  });

  // ── Preview-first hi-res upgrade ──
  // Show the cached preview immediately, then reveal a separately loaded
  // hi-res image in place once it has finished loading and decoding.
  // eslint-disable-next-line complexity -- Hash change handler manages dialog sync, hi-res load, video pause, status, and preload in one cohesive event.
  const handleHashChange = () => {
    const openItem = getOpenItem();
    syncDialogsToHash(openItem);
    pauseOtherVideos(openItem?.id ?? null);

    const i = getOpenIndex();
    const status = document.getElementById('lightbox-status');

    if (i === null) {
      if (status) { status.textContent = ''; }
      return;
    }

    if (status) { status.textContent = `Media ${i} of ${total()}`; }

    if (!openItem) { return; }
    const hiresImg = openItem.querySelector('.lightbox-image--hires[data-hires]');
    const wrap = openItem.querySelector('.lightbox-media-wrap');
    if (!hiresImg || !wrap) { return; }

    const hires = hiresImg.dataset.hires;
    if (!hires) { return; }

    if (hiresImg.dataset.loaded === 'true' || (hiresImg.complete && hiresImg.currentSrc)) {
      wrap.classList.add('is-hires-ready');
      return;
    }

    wrap.classList.remove('is-hires-ready');
    if (hiresImg.dataset.loading === hires) { return; }

    hiresImg.dataset.loading = hires;
    const loader = new Image();
    loader.decoding = 'async';
    loader.fetchPriority = 'low';
    loader.onload = async () => {
      try {
        if (typeof loader.decode === 'function') {
          await loader.decode();
        }
      } catch {
        // Keep the preview visible if decode reports a transient failure.
      }

      if (hiresImg.dataset.loading !== hires) { return; }

      hiresImg.src = hires;
      hiresImg.dataset.loaded = 'true';
      delete hiresImg.dataset.loading;
      wrap.classList.add('is-hires-ready');
    };
    loader.onerror = () => {
      if (hiresImg.dataset.loading === hires) {
        delete hiresImg.dataset.loading;
      }
    };
    loader.src = hires;
  };

  window.addEventListener('hashchange', handleHashChange);

  document.addEventListener('click', (e) => {
    const thumb = e.target.closest('.photo-thumb-link');
    if (!thumb) { return; }
    lightboxTrigger = thumb;
  });

  getItems().forEach((item) => {
    const dialog = getDialogForItem(item);
    if (!dialog) { return; }

    dialog.addEventListener('close', () => {
      const openItem = getOpenItem();
      if (openItem?.id === item.id) {
        closePhoto();
      }
    });
  });

  // ── Nav arrow clicks → directional slide ──
  document.addEventListener('click', (e) => {
    const nav = e.target.closest('.lightbox-nav');
    if (!nav || nav.classList.contains('lightbox-nav--disabled')) { return; }
    e.preventDefault();
    const i = getOpenIndex();
    if (i === null) { return; }
    const dir = nav.dataset.navDir;
    if (dir === 'prev' && i > 1) { goTo(i - 1); }
    else if (dir === 'next' && i < total()) { goTo(i + 1); }
  });

  // ── Touch swipe ──
  let touchStartX = null;
  let isPinch = false;

  document.addEventListener('touchstart', (e) => {
    if (getOpenIndex() === null) { return; }
    isPinch = e.touches.length > 1;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  // Track additional fingers added mid-gesture (pinch starting after touchstart)
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) { isPinch = true; }
  }, { passive: true });

  // eslint-disable-next-line complexity -- Touch-end handler distinguishes pinch, swipe, and tap with directional branching.
  document.addEventListener('touchend', (e) => {
    if (touchStartX === null) { return; }
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (isPinch) { isPinch = false; return; }
    const i = getOpenIndex();
    if (i === null) { return; }
    if (Math.abs(dx) < 50) {
      // Tap — close if the touch landed outside the image and nav controls.
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
    if (dx > 0 && i > 1) { goTo(i - 1); }
    else if (dx < 0 && i < total()) { goTo(i + 1); }
  }, { passive: true });

  handleHashChange();

  revealPrivateMediaForSignedInUser().catch(() => {
    // Keep gallery usable even if auth-status check fails.
  });

})();