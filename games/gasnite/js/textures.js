// ===== GASNITE TEXTURES: tileable surface detail, drawn in code (no image files to load) =====
// Each texture is a light grey pattern that MULTIPLIES a surface's own colour, so every house / tree / road keeps its
// colour and just gains surface detail: grass blades and soil on the ground, plaster, wood siding, bricks, shingles,
// floor planks, wood grain, stone, corrugated metal, brushed metal, asphalt, leaves and bark.
// Textures are linear (multiplied exactly) and seamless; apply() brightens the material by 1 / the texture's mean so
// nothing gets darker overall. Generated lazily (and seeded, so they look the same every time).
window.GasTex = (() => {
  const C = new Map(), MEAN = new Map(), GEN = {};
  let aniso = 0;
  const maxAniso = () => aniso || (aniso = typeof renderer !== 'undefined' && renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 4);
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // periodic value noise: cx × cy lattice cells across the tile, so it wraps seamlessly
  function vnoise(N, cx, cy, R) {
    const g = new Float32Array(cx * cy); for (let i = 0; i < g.length; i++) g[i] = R();
    const o = new Float32Array(N * N), sx = cx / N, sy = cy / N;
    for (let y = 0; y < N; y++) {
      const fy = y * sy, y0 = fy | 0, ty = fy - y0, wy = ty * ty * (3 - 2 * ty), r0 = (y0 % cy) * cx, r1 = ((y0 + 1) % cy) * cx;
      for (let x = 0; x < N; x++) { const fx = x * sx, x0 = fx | 0, tx = fx - x0, wx = tx * tx * (3 - 2 * tx), a0 = x0 % cx, a1 = (x0 + 1) % cx, top = g[r0 + a0] + (g[r0 + a1] - g[r0 + a0]) * wx, bot = g[r1 + a0] + (g[r1 + a1] - g[r1 + a0]) * wx; o[y * N + x] = top + (bot - top) * wy; }
    }
    return o;
  }
  function fbm(N, cx, cy, oct, R, gain = .5) { const o = new Float32Array(N * N); let a = 1, t = 0; for (let k = 0; k < oct; k++) { const n = vnoise(N, Math.min(N, cx << k), Math.min(N, cy << k), R); for (let i = 0; i < o.length; i++) o[i] += n[i] * a; t += a; a *= gain; } for (let i = 0; i < o.length; i++) o[i] /= t; return o; }
  function canvas(N) { const c = document.createElement('canvas'); c.width = c.height = N; return c; }
  function putL(cv, L) { const x = cv.getContext('2d'), N = cv.width, im = x.createImageData(N, N), d = im.data; for (let i = 0; i < N * N; i++) { const v = L[i] <= 0 ? 0 : L[i] >= 1 ? 255 : L[i] * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } x.putImageData(im, 0, 0); return x; }
  function mulL(cv, L, k0, amp) { const x = cv.getContext('2d'), N = cv.width, im = x.getImageData(0, 0, N, N), d = im.data; for (let i = 0; i < N * N; i++) { const k = k0 + (L[i] - .5) * amp; d[i * 4] = Math.min(255, d[i * 4] * k); d[i * 4 + 1] = Math.min(255, d[i * 4 + 1] * k); d[i * 4 + 2] = Math.min(255, d[i * 4 + 2] * k); } x.putImageData(im, 0, 0); }
  const wrap = (N, x, y, r, fn) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) if (x + dx > -r && x + dx < N + r && y + dy > -r && y + dy < N + r) fn(x + dx, y + dy); };
  const grey = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
  // widths that add up to exactly N (so a row of tabs / stones tiles seamlessly)
  const row = (N, R, lo, hi) => { const w = []; let s = 0; while (s < N) { const v = lo + R() * (hi - lo); w.push(v); s += v; } return w.map(v => v * N / s); };

  // ---- ground: mottled soil + grass blades + speckles (terrain, spawn island)
  GEN.grass = () => {
    const N = 256, R = rng(11), cv = canvas(N), L = fbm(N, 4, 4, 5, R), M = fbm(N, 2, 2, 2, R);
    for (let i = 0; i < L.length; i++) L[i] = .72 + (L[i] - .5) * .62 + (M[i] - .5) * .2;
    const x = putL(cv, L); x.lineCap = 'round';
    // tufts: clusters of blades leaning the same way, dark at the base, light at the tip
    for (let t = 0; t < 420; t++) { const cx = R() * N, cy = R() * N, a0 = R() * Math.PI * 2, n = 4 + (R() * 7 | 0); for (let i = 0; i < n; i++) { const px = cx + (R() - .5) * 7, py = cy + (R() - .5) * 7, a = a0 + (R() - .5) * .9, l = 4 + R() * 7, dark = R() < .6; x.strokeStyle = grey(dark ? 30 + R() * 50 : 225 + R() * 30, .22 + R() * .3); x.lineWidth = .9 + R() * 1.2; wrap(N, px, py, 14, (X, Y) => { x.beginPath(); x.moveTo(X, Y); x.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); x.stroke(); }); } }
    for (let i = 0; i < 1100; i++) { x.fillStyle = grey(R() < .5 ? 25 : 250, .22); x.fillRect(R() * N, R() * N, 1.4, 1.4); }
    return cv;
  };
  // ---- plaster / render: soft cloudy variation, grains and pits
  GEN.plaster = () => {
    const N = 256, R = rng(23), cv = canvas(N), L = fbm(N, 8, 8, 5, R, .55), F = vnoise(N, 64, 64, R);
    for (let i = 0; i < L.length; i++) L[i] = .86 + (L[i] - .5) * .17 + (F[i] - .5) * .07;
    const x = putL(cv, L);
    for (let i = 0; i < 800; i++) { x.fillStyle = grey(R() < .7 ? 70 : 255, .1 + R() * .1); x.beginPath(); x.arc(R() * N, R() * N, .5 + R() * 1.1, 0, 7); x.fill(); }
    return cv;
  };
  // ---- wood siding: 8 overlapping boards, a shadow under each lap, grain along the boards (rows run along u)
  GEN.siding = () => {
    const N = 256, R = rng(37), cv = canvas(N), G = fbm(N, 2, 32, 4, R), L = new Float32Array(N * N), bh = N / 8, sh = [];
    for (let b = 0; b < 8; b++) sh.push(.84 + R() * .1);
    for (let y = 0; y < N; y++) { const b = Math.floor(y / bh), t = (y % bh) / bh; for (let x = 0; x < N; x++) { let v = (sh[b] + (G[y * N + x] - .5) * .16) * (.9 + .1 * t); if (t < .07) v *= .55; else if (t < .12) v *= .8; L[y * N + x] = v; } }
    putL(cv, L); return cv;
  };
  // ---- bricks: 8 courses of 4 in running bond, light mortar, every brick a slightly different shade
  GEN.brick = () => {
    const N = 256, R = rng(41), cv = canvas(N), x = cv.getContext('2d'), bw = N / 4, bh = N / 8, F = fbm(N, 8, 8, 4, R);
    x.fillStyle = grey(238); x.fillRect(0, 0, N, N);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) { const X = c * bw + (r % 2 ? bw / 2 : 0), v = 150 + R() * 75; x.fillStyle = grey(v); wrap(N, X, r * bh, bw, (XX, YY) => x.fillRect(XX + 2, YY + 2, bw - 4, bh - 4)); x.fillStyle = grey(255, .12); wrap(N, X, r * bh, bw, (XX, YY) => x.fillRect(XX + 2, YY + 2, bw - 4, 2)); }
    mulL(cv, F, .9, .34); return cv;
  };
  // ---- roof shingles: 8 rows of staggered tabs (rows run along u), shadow under each row, gaps between tabs
  GEN.shingle = () => {
    const N = 256, R = rng(53), cv = canvas(N), x = cv.getContext('2d'), rh = N / 8, F = fbm(N, 6, 6, 4, R);
    for (let r = 0; r < 8; r++) {
      let X = R() * 30; for (const w of row(N, R, 24, 46)) { const v = 160 + R() * 70, y0 = r * rh;
        wrap(N, X, y0, 60, (XX, YY) => { const g = x.createLinearGradient(0, YY, 0, YY + rh); g.addColorStop(0, grey(v * .55)); g.addColorStop(.14, grey(v * .8)); g.addColorStop(.2, grey(v)); g.addColorStop(1, grey(Math.min(255, v * 1.08))); x.fillStyle = g; x.fillRect(XX, YY, w, rh); x.fillStyle = grey(45, .85); x.fillRect(XX, YY, 2, rh); });
        X += w; }
    }
    mulL(cv, F, .92, .3); return cv;
  };
  // ---- floor planks: 8 boards along u with butt joints, seams and grain
  GEN.planks = () => {
    const N = 256, R = rng(61), cv = canvas(N), G = fbm(N, 2, 40, 4, R), L = new Float32Array(N * N), bh = N / 8, sh = [];
    for (let b = 0; b < 8; b++) sh.push(.8 + R() * .14);
    for (let y = 0; y < N; y++) { const b = Math.floor(y / bh), t = (y % bh) / bh; for (let x = 0; x < N; x++) { let v = sh[b] + (G[y * N + x] - .5) * .22 + .05 * Math.sin((x + b * 37) * .05 + G[y * N + x] * 9); if (t < .05 || t > .96) v *= .58; L[y * N + x] = v; } }
    const x = putL(cv, L);
    for (let b = 0; b < 8; b++) { const j = R() * N; x.fillStyle = grey(50, .8); wrap(N, j, b * bh, 4, (XX, YY) => x.fillRect(XX, YY, 1.6, bh)); }
    return cv;
  };
  // ---- fine wood grain (gun stocks, doors): wavy rings along u
  GEN.grain = () => {
    const N = 256, R = rng(67), cv = canvas(N), G = fbm(N, 2, 16, 5, R), H = fbm(N, 1, 4, 3, R), L = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x, w = Math.sin((y / N * 18 + H[i] * 6) * Math.PI * 2); L[i] = .8 + .07 * w + (G[i] - .5) * .18 - (w > .92 ? .12 : 0); }
    putL(cv, L); return cv;
  };
  // ---- stone blocks (foundations, plinths): irregular courses with dark recessed joints and a lit top edge
  GEN.stone = () => {
    const N = 256, R = rng(71), cv = canvas(N), x = cv.getContext('2d'), rh = N / 4, F = fbm(N, 8, 8, 5, R);
    x.fillStyle = grey(95); x.fillRect(0, 0, N, N);
    for (let r = 0; r < 4; r++) { let X = R() * 40; for (const w of row(N, R, 44, 92)) { const v = 150 + R() * 70; wrap(N, X, r * rh, 100, (XX, YY) => { x.fillStyle = grey(v); x.fillRect(XX + 2.5, YY + 2.5, w - 5, rh - 5); x.fillStyle = grey(255, .16); x.fillRect(XX + 2.5, YY + 2.5, w - 5, 3); x.fillStyle = grey(0, .16); x.fillRect(XX + 2.5, YY + rh - 6, w - 5, 3.5); }); X += w; } }
    mulL(cv, F, .9, .4); return cv;
  };
  // ---- corrugated metal (warehouses): vertical ribs, run-off streaks, a little grime
  GEN.metal = () => {
    const N = 256, R = rng(79), cv = canvas(N), S = fbm(N, 32, 2, 3, R), F = fbm(N, 6, 6, 4, R), L = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; L[i] = .8 + .11 * Math.sin(x / N * Math.PI * 2 * 16) + (S[i] - .5) * .16 + (F[i] - .5) * .12; }
    putL(cv, L); return cv;
  };
  // ---- brushed metal (gun steel): fine streaks along u
  GEN.brushed = () => {
    const N = 128, R = rng(83), cv = canvas(N), S = fbm(N, 1, 64, 2, R), F = fbm(N, 4, 4, 3, R), L = new Float32Array(N * N);
    for (let i = 0; i < L.length; i++) L[i] = .86 + (S[i] - .5) * .2 + (F[i] - .5) * .08;
    putL(cv, L); return cv;
  };
  // ---- plain fine noise (trims, furniture, polymer)
  GEN.noise = () => {
    const N = 128, R = rng(89), cv = canvas(N), F = fbm(N, 8, 8, 4, R), G = vnoise(N, 64, 64, R), L = new Float32Array(N * N);
    for (let i = 0; i < L.length; i++) L[i] = .88 + (F[i] - .5) * .12 + (G[i] - .5) * .08;
    putL(cv, L); return cv;
  };
  // ---- asphalt / gravel (roads, plazas): salt-and-pepper aggregate, patches, a few cracks
  GEN.asphalt = () => {
    const N = 256, R = rng(97), cv = canvas(N), F = fbm(N, 4, 4, 4, R), L = new Float32Array(N * N);
    for (let i = 0; i < L.length; i++) L[i] = .8 + (F[i] - .5) * .22 + (R() - .5) * .16;
    const x = putL(cv, L); x.lineCap = 'round';
    for (let i = 0; i < 500; i++) { x.fillStyle = grey(R() < .5 ? 20 : 255, .3); x.fillRect(R() * N, R() * N, 1.5, 1.5); }
    for (let c = 0; c < 2; c++) { let px = R() * N, py = R() * N, a = R() * 6.3; x.strokeStyle = grey(40, .22); x.lineWidth = .8; for (let s = 0; s < 14; s++) { const nx = px + Math.cos(a) * 4, ny = py + Math.sin(a) * 4; wrap(N, px, py, 8, (X, Y) => { x.beginPath(); x.moveTo(X, Y); x.lineTo(X + nx - px, Y + ny - py); x.stroke(); }); px = (nx + N) % N; py = (ny + N) % N; a += (R() - .5) * 1.2; } }
    return cv;
  };
  // ---- leaves (tree crowns): overlapping leaves of different shades over dark gaps
  GEN.leaves = () => {
    const N = 256, R = rng(101), cv = canvas(N), x = cv.getContext('2d');
    x.fillStyle = grey(120); x.fillRect(0, 0, N, N);
    for (let i = 0; i < 2600; i++) { const px = R() * N, py = R() * N, a = R() * Math.PI, w = 3.5 + R() * 5, h = 1.8 + R() * 2.6, v = 150 + R() * 105; x.fillStyle = grey(v, .9); wrap(N, px, py, 10, (X, Y) => { x.beginPath(); x.ellipse(X, Y, w, h, a, 0, Math.PI * 2); x.fill(); }); }
    return cv;
  };
  // ---- bark (tree trunks): vertical fissures (along v)
  GEN.bark = () => {
    const N = 256, R = rng(107), cv = canvas(N), S = fbm(N, 20, 3, 4, R), F = fbm(N, 6, 6, 3, R), L = new Float32Array(N * N);
    for (let i = 0; i < L.length; i++) { const s = S[i]; L[i] = .8 + (s - .5) * .3 + (F[i] - .5) * .1 - (s < .4 ? .16 * Math.min(1, (.4 - s) * 12) : 0); }   // narrow fissures
    putL(cv, L); return cv;
  };

  function get(name) {
    let t = C.get(name); if (t) return t;
    const f = GEN[name]; if (!f || typeof THREE === 'undefined') return null;
    const cv = f(), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i];
    MEAN.set(name, Math.max(.2, s / (d.length / 4) / 255));
    t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso(); C.set(name, t); return t;
  }
  // put texture `name` on material m, tiled rx × ry times per UV unit, keeping the material's overall brightness
  function apply(m, name, rx = 1, ry = rx) {
    const base = get(name); if (!base || !m) return m;
    const t = base.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); m.map = t; if (m.color) m.color.multiplyScalar(1 / MEAN.get(name)); m.needsUpdate = true; return m;
  }
  // build every texture in the background (one per tick) so the first match doesn't pay for it
  function warm() { const names = Object.keys(GEN).filter(n => !C.has(n)); let i = 0; const step = () => { if (i < names.length) { try { get(names[i++]); } catch (e) { } setTimeout(step, 40); } }; setTimeout(step, 400); }
  return { get, apply, warm, mean: n => (get(n), MEAN.get(n) || 1), names: () => Object.keys(GEN) };
})();
