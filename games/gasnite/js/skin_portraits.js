// ===== Locker & Item Shop portraits: real 3D renders of every outfit, cached as images =====
// Cards show the old SVG icon for a split second, then swap to a rendered portrait of the actual 3D skin.
// Renders run one per frame in a small offscreen WebGL context that is released when idle.
const SkinPortraits = (() => {
  const SIZE = 320, cache = new Map(), queue = [];
  let R = null, scene = null, cam = null, busy = false, idleTimer = 0, failed = false;

  function ensure() {
    if (R || failed) return R;
    try {
      if (typeof THREE === 'undefined' || typeof CharacterRigBuilder === 'undefined') { failed = true; return null; }
      const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
      R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      R.setPixelRatio(1); R.setSize(SIZE, SIZE, false); R.setClearColor(0x000000, 0);
      R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
      scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xe6f0ff, 0x2a3a6a, 0.95));
      const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(2.5, 4, 5); scene.add(key);
      const rim = new THREE.DirectionalLight(0x9bd8ff, 0.95); rim.position.set(-4, 3, -3); scene.add(rim);
      cam = new THREE.PerspectiveCamera(24, 1, 0.1, 30); cam.position.set(0.45, 1.8, 3.4); cam.lookAt(0, 1.6, 0);
    } catch (e) { failed = true; R = null; }
    return R;
  }
  function release() { // free the offscreen GPU context once the queue has been idle for a while
    if (!R || busy || queue.length) return;
    try { R.dispose(); R.forceContextLoss(); } catch (e) { }
    R = null; scene = null; cam = null;
  }
  const keyOf = (o, s) => o.id + ':' + (s || 0);

  function renderOne(job) {
    const r = ensure(); if (!r) return null;
    const hero = CharacterRigBuilder.buildHero(job.o, job.s, null, null, { portrait: true });
    hero.rotation.y = .4; CharacterRigBuilder.applyHeroStance(hero, .6, 'idle');
    scene.add(hero); r.render(scene, cam); scene.remove(hero);
    hero.traverse(m => { if (m.isMesh && m.userData.unique && !m.userData.outline) m.geometry.dispose(); });
    return r.domElement.toDataURL('image/webp', .92); // falls back to PNG where WebP encoding isn't supported
  }
  function pump() {
    if (busy || !queue.length) return;
    busy = true; clearTimeout(idleTimer);
    requestAnimationFrame(() => {
      const t0 = performance.now();
      do { // as many portraits as fit in ~10 ms of this frame (always at least one)
        const job = queue.shift();
        let url = null;
        try { url = renderOne(job); } catch (e) { console.warn('Portrait render failed for', job.o && job.o.name, e); }
        if (url) {
          cache.set(job.k, url);
          document.querySelectorAll(`[data-portrait="${job.k}"]`).forEach(el => { el.outerHTML = imgTag(url, job.o); });
        }
      } while (queue.length && performance.now() - t0 < 10);
      busy = false;
      if (queue.length) pump(); else idleTimer = setTimeout(release, 5000);
    });
  }
  const imgTag = (url, o) => `<img class="skin-portrait" src="${url}" alt="${String(o.name).replace(/"/g, '&quot;')}" draggable="false">`;

  // HTML for a card thumbnail: the portrait if ready, otherwise the fallback (SVG) plus a queued render.
  function html(o, fallback, styleIdx = 0) {
    const k = keyOf(o, styleIdx), url = cache.get(k);
    if (url) return imgTag(url, o);
    if (failed || typeof THREE === 'undefined') return fallback;
    if (!queue.some(j => j.k === k)) queue.push({ k, o, s: styleIdx });
    setTimeout(pump, 0);
    return `<span class="skin-portrait-wait" data-portrait="${k}">${fallback}</span>`;
  }
  return { html, get: (o, s) => cache.get(keyOf(o, s)) };
})();
