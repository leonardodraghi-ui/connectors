/* Shared interactions: hero video, paged sliders (bento + carousel), FAQ accordion */
(function () {
  'use strict';

  /* ---------- Hero video ---------- */
  const media = document.querySelector('.hero .media');
  if (media) {
    const video = media.querySelector('video');
    const placeholder = media.querySelector('.placeholder');
    const btn = media.querySelector('.video-control');
    let hasVideo = false;

    if (video) {
      video.addEventListener('loadeddata', () => { hasVideo = true; placeholder && (placeholder.style.display = 'none'); video.style.display = 'block'; });
      video.addEventListener('error', () => { hasVideo = false; video.style.display = 'none'; }, true);
      video.querySelectorAll('source').forEach(s => s.addEventListener('error', () => { video.style.display = 'none'; }));
      video.style.display = 'none';
      video.play && video.play().catch(() => {});
    }
    btn && btn.addEventListener('click', () => {
      const paused = media.classList.toggle('paused');
      if (hasVideo && video) { paused ? video.pause() : video.play().catch(() => {}); }
      if (placeholder) placeholder.style.animationPlayState = paused ? 'paused' : 'running';
      placeholder && placeholder.querySelectorAll('*').forEach(el => el.style.animationPlayState = paused ? 'paused' : 'running');
      btn.setAttribute('aria-label', paused ? 'Play video' : 'Pause video');
    });
  }

  /* ---------- Generic paged slider (used by bento + carousel) ----------
     viewport: element with overflow hidden
     track: flex container translated on X
     mode 'page'  -> each child of track is a full-width page
     mode 'items' -> children are cards; snap to card index, clamp to end  */
  function slider(opts) {
    const vp = document.querySelector(opts.viewport);
    if (!vp) return;
    const track = vp.querySelector(opts.track);
    const items = Array.from(track.children);
    const prev = document.querySelector(opts.prev);
    const next = document.querySelector(opts.next);
    const dotsWrap = document.querySelector(opts.dots);
    let index = 0, maxIndex = items.length - 1;
    let offsets = [];

    function measure() {
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || 0) || 0;
      const padL = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      if (opts.mode === 'page') {
        offsets = items.map((_, i) => i * vp.clientWidth);
        maxIndex = items.length - 1;
      } else {
        const trackW = track.scrollWidth;
        const maxOffset = Math.max(0, trackW - vp.clientWidth);
        offsets = items.map(el => Math.min(el.offsetLeft - padL, maxOffset));
        // last reachable index: first item whose offset hits the max
        maxIndex = offsets.findIndex(o => o >= maxOffset - 1);
        if (maxIndex < 0) maxIndex = items.length - 1;
      }
      index = Math.min(index, maxIndex);
      apply(false);
    }

    function apply(animate = true) {
      track.style.transition = animate ? '' : 'none';
      track.style.transform = `translateX(${-offsets[index]}px)`;
      if (!animate) { void track.offsetWidth; track.style.transition = ''; }
      prev && (prev.disabled = index === 0);
      next && (next.disabled = index >= maxIndex);
      if (dotsWrap) Array.from(dotsWrap.children).forEach((d, i) => d.classList.toggle('active', i === index));
      items.forEach((el, i) => el.setAttribute('aria-hidden', opts.mode === 'page' ? String(i !== index) : 'false'));
    }

    function go(i) { index = Math.max(0, Math.min(maxIndex, i)); apply(); }

    // dots
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      const count = opts.mode === 'page' ? items.length : items.length;
      for (let i = 0; i < count; i++) {
        const b = document.createElement('button');
        b.type = 'button'; b.setAttribute('aria-label', `Go to ${opts.mode === 'page' ? 'set' : 'card'} ${i + 1}`);
        b.addEventListener('click', () => go(Math.min(i, maxIndex)));
        dotsWrap.appendChild(b);
      }
    }
    prev && prev.addEventListener('click', () => go(index - 1));
    next && next.addEventListener('click', () => go(index + 1));

    // drag / swipe
    let startX = 0, startOffset = 0, dragging = false, moved = false;
    const onDown = e => {
      dragging = true; moved = false;
      startX = (e.touches ? e.touches[0].clientX : e.clientX);
      startOffset = offsets[index];
      vp.classList.add('dragging');
      track.style.transition = 'none';
    };
    const onMove = e => {
      if (!dragging) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      const dx = x - startX;
      if (Math.abs(dx) > 6) moved = true;
      const maxOff = offsets[maxIndex];
      let off = startOffset - dx;
      if (off < 0) off = off * 0.3;               // rubber-band
      if (off > maxOff) off = maxOff + (off - maxOff) * 0.3;
      track.style.transform = `translateX(${-off}px)`;
      if (moved && e.cancelable && !e.touches) e.preventDefault();
    };
    const onUp = e => {
      if (!dragging) return;
      dragging = false; vp.classList.remove('dragging'); track.style.transition = '';
      const x = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
      const dx = x - startX;
      const threshold = Math.min(80, vp.clientWidth * 0.12);
      if (dx < -threshold) go(index + 1);
      else if (dx > threshold) go(index - 1);
      else apply();
    };
    vp.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    vp.addEventListener('touchstart', onDown, { passive: true });
    vp.addEventListener('touchmove', onMove, { passive: true });
    vp.addEventListener('touchend', onUp);
    // prevent link clicks after a drag
    vp.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    vp.addEventListener('dragstart', e => e.preventDefault());

    // keyboard
    vp.setAttribute('tabindex', '0');
    vp.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { go(index + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { go(index - 1); e.preventDefault(); }
    });

    // horizontal wheel / trackpad swipe
    let wheelLock = false;
    vp.addEventListener('wheel', e => {
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY) || Math.abs(e.deltaX) < 20) return;
      e.preventDefault();
      if (wheelLock) return;
      wheelLock = true; setTimeout(() => wheelLock = false, 600);
      go(index + (e.deltaX > 0 ? 1 : -1));
    }, { passive: false });

    window.addEventListener('resize', measure);
    measure();
  }

  slider({ viewport: '.bento-viewport', track: '.bento-track', prev: '.bento-prev', next: '.bento-next', dots: '.bento-dots', mode: 'page' });
  slider({ viewport: '.carousel-viewport', track: '.carousel-track', prev: '.carousel-prev', next: '.carousel-next', dots: '.carousel-dots', mode: 'items' });

  /* ---------- FAQ ---------- */
  document.querySelectorAll('.faq .item').forEach(item => {
    const q = item.querySelector('.q');
    q.addEventListener('click', () => {
      const open = item.classList.toggle('open');
      q.setAttribute('aria-expanded', String(open));
    });
  });

  /* ---------- Connect now (prototype) ---------- */
  document.querySelectorAll('[data-connect]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const name = a.getAttribute('data-connect');
      a.textContent = 'Opening ' + name + '…';
      setTimeout(() => { a.textContent = 'Connect now'; }, 1400);
    });
  });
})();
