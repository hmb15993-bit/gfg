// ==================== GASNITE HERO RIG v2 — sculpted, hand-painted, look-driven ====================
// Every outfit is built from its look recipe (js/skin_looks.js):
//  • sculpted lathe torsos per body type (standard / slim / muscle / bulky), smooth capsule limbs, fists and real shoes
//  • canvas-painted textures: faces (eyes, brows, lips, freckles, beards, masks, face paint), clothing (necklines,
//    prints, plaid / camo / knit / denim, pockets, zips, armour plates, abs) and limb details (socks, rips, stripes)
//  • 20 hairstyles, 18 hats, creature heads (bulldog, bear, fox, lizard, fish, robot), tails, capes, skirts, coats…
//  • parts are merged per joint + material, so a whole hero is ~30 draw calls (bots skip the toon outline)
// Public API is unchanged: buildHero, buildPickaxeMesh, buildBackBlingMesh, applyHeroStance, drawCanvas2DFallback, lowQ.

const CharacterRigBuilder = (() => {
  const TAU = Math.PI * 2, PI = Math.PI;
  const LU = SkinLooks.util, SH = LU.shade, MX = LU.mix, LUM = LU.lum;
  const lin = h => new THREE.Color(h).convertSRGBToLinear();
  const WHITE = new THREE.Color(1, 1, 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  function rng(seed) { let a = LU.hash(seed) >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------------------------------------------------------------- caches
  const MATS = new Map(), GEOS = new Map(), TEX = new Map(), TEX_MAX = 240;
  function M(hex, rough = .7, metal = 0, o = {}) {
    const k = (o.vc ? 'vc' : hex) + '|' + rough + '|' + metal + '|' + (o.ds ? 1 : 0) + '|' + (o.glow || '') + '|' + (o.ei || '') + '|' + (o.flat ? 1 : 0);
    let m = MATS.get(k);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: o.vc ? 0xffffff : lin(hex), roughness: rough, metalness: metal, side: o.ds ? THREE.DoubleSide : THREE.FrontSide, vertexColors: !!o.vc, flatShading: !!o.flat });
      if (o.glow) { m.emissive = lin(o.glow); m.emissiveIntensity = o.ei || .55; }
      MATS.set(k, m);
    }
    return m;
  }
  function TM(tex, rough = .75, metal = 0, o = {}) {
    const k = rough + '|' + metal + '|' + (o.ds ? 1 : 0) + '|' + (o.em ? o.em.uuid : '') + '|' + (o.ei || 1), ms = tex.userData.mats;
    if (!ms[k]) { const m = new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal, side: o.ds ? THREE.DoubleSide : THREE.FrontSide }); if (o.em) { m.emissive = new THREE.Color(1, 1, 1); m.emissiveMap = o.em; m.emissiveIntensity = o.ei || 1; } ms[k] = m; }
    return ms[k];
  }
  const G = (k, fn) => { let g = GEOS.get(k); if (!g) { g = fn(); GEOS.set(k, g); } return g; };
  function canvasTex(key, w, h, paint) {
    let t = TEX.get(key);
    if (t) { TEX.delete(key); TEX.set(key, t); return t; }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    paint(cv.getContext('2d'), w, h);
    t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.userData = t.userData || {}; t.userData.mats = {};
    TEX.set(key, t);
    if (TEX.size > TEX_MAX) { const old = TEX.keys().next().value, ot = TEX.get(old); TEX.delete(old); ot.dispose(); }
    return t;
  }

  // ---------------------------------------------------------------- geometry helpers
  function seamFix(g) {
    const P = g.attributes.position, N = g.attributes.normal, map = new Map();
    for (let i = 0; i < P.count; i++) { const k = Math.round(P.getX(i) * 1e4) + ',' + Math.round(P.getY(i) * 1e4) + ',' + Math.round(P.getZ(i) * 1e4); let a = map.get(k); if (!a) map.set(k, a = []); a.push(i); }
    map.forEach(a => { if (a.length < 2) return; let x = 0, y = 0, z = 0; a.forEach(i => { x += N.getX(i); y += N.getY(i); z += N.getZ(i); }); const l = Math.hypot(x, y, z) || 1; a.forEach(i => N.setXYZ(i, x / l, y / l, z / l)); });
    return g;
  }
  // Lathe (profile bottom→top as [r, y]); front centre at u = .5, v = height, optional z squash per height
  function lathe(profile, zr, seg, o = {}) {
    const g = new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(Math.max(1e-4, p[0]), p[1])), seg || 28, o.phiStart != null ? o.phiStart : PI, o.phiLen || TAU);
    const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const b0 = o.v0 != null ? o.v0 : y0, span = ((o.v1 != null ? o.v1 : y1) - b0) || 1;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), t = (y - b0) / span, k = typeof zr === 'function' ? zr(t, x, z) : (zr || 1);
      P.setZ(i, z * k);
      const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i) / k, l = Math.hypot(nx, ny, nz) || 1;
      N.setXYZ(i, nx / l, ny / l, nz / l); UV.setY(i, t);
    }
    return g;
  }
  // Limb capsule hanging from y=0 to y=-len (optional muscle bulge)
  function capsule(r0, r1, len, o = {}) {
    const prof = [], n = 5, mid = 6;
    for (let i = 0; i <= n; i++) { const a = -PI / 2 + i / n * PI / 2; prof.push([r1 * Math.cos(a), -len + r1 * Math.sin(a)]); }
    for (let i = 1; i < mid; i++) { const t = i / mid; let r = r1 + (r0 - r1) * t; if (o.bulge) r += o.bulge * Math.exp(-Math.pow((t - (o.at || .6)) / .22, 2)); prof.push([r, -len + t * len]); }
    for (let i = 0; i <= n; i++) { const a = i / n * PI / 2; prof.push([r0 * Math.cos(a), r0 * Math.sin(a)]); }
    return lathe(prof, o.zr || 1, o.seg || 16, { v0: -len - r1, v1: r0 });
  }
  // Tapered tube along a Catmull-Rom curve (radius = [r0, r1] or fn(t)); uv.y = t along the tube
  function tube(pts, rad, o = {}) {
    const seg = o.seg || 20, rs = o.rs || 8, fl = o.flat || 1;
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    const fr = curve.computeFrenetFrames(seg, false), rf = typeof rad === 'function' ? rad : t => rad[0] + (rad[1] - rad[0]) * t;
    const pos = [], nor = [], uv = [], idx = [], P = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const t = i / seg; curve.getPointAt(t, P); const N = fr.normals[i], B = fr.binormals[i], r = rf(t);
      for (let j = 0; j <= rs; j++) {
        const a = j / rs * TAU, ca = Math.cos(a), sa = Math.sin(a);
        pos.push(P.x + r * (fl * ca * N.x + sa * B.x), P.y + r * (fl * ca * N.y + sa * B.y), P.z + r * (fl * ca * N.z + sa * B.z));
        const nx = ca / fl * N.x + sa * B.x, ny = ca / fl * N.y + sa * B.y, nz = ca / fl * N.z + sa * B.z, l = Math.hypot(nx, ny, nz) || 1;
        nor.push(nx / l, ny / l, nz / l); uv.push(j / rs, t);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rs; j++) { const a = i * (rs + 1) + j, b = a + rs + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const cap = (i, dir) => {
      const t = i / seg, r = rf(t); if (r < 1e-3) return;
      curve.getPointAt(t, P); const T = fr.tangents[i], c0 = pos.length / 3, base = i * (rs + 1);
      pos.push(P.x, P.y, P.z); nor.push(T.x * dir, T.y * dir, T.z * dir); uv.push(.5, t);
      for (let j = 0; j <= rs; j++) { const k = (base + j) * 3; pos.push(pos[k], pos[k + 1], pos[k + 2]); nor.push(T.x * dir, T.y * dir, T.z * dir); uv.push(j / rs, t); }
      for (let j = 0; j < rs; j++) { if (dir > 0) idx.push(c0, c0 + 1 + j, c0 + 2 + j); else idx.push(c0, c0 + 2 + j, c0 + 1 + j); }
    };
    if (o.caps !== false) { cap(0, -1); cap(seg, 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    return g;
  }
  // Sphere segment by azimuth (0 = front, + toward +x) and polar angle (0 = top)
  const shell = (r, a0, a1, t0, t1, ws, hs) => new THREE.SphereGeometry(r, ws || 24, hs || 12, PI / 2 + a0, a1 - a0, t0, t1 - t0);
  // Rounded box (superellipsoid)
  function rbox(w, h, d, p = 3.2, ws = 14, hs = 10) {
    const g = new THREE.SphereGeometry(1, ws, hs), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), n = Math.pow(Math.pow(Math.abs(x), p) + Math.pow(Math.abs(y), p) + Math.pow(Math.abs(z), p), 1 / p) || 1; P.setXYZ(i, x / n * w / 2, y / n * h / 2, z / n * d / 2); }
    g.computeVertexNormals(); return seamFix(g);
  }
  function bumpy(r, amp, f, seed = 1, ws = 22, hs = 16) {
    const g = new THREE.SphereGeometry(r, ws, hs), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) / r, y = P.getY(i) / r, z = P.getZ(i) / r, n = Math.sin(x * f + seed) * Math.sin(y * f * 1.3 + seed * 2.1) * Math.sin(z * f * .9 + seed * 3.7), k = 1 + amp * n; P.setXYZ(i, x * r * k, y * r * k, z * r * k); }
    g.computeVertexNormals(); return seamFix(g);
  }
  const cyl = (rt, rb, h, n = 18, open = true, ts, tl) => new THREE.CylinderGeometry(rt, rb, h, n, 1, open, ts, tl);
  const sph = (r = 1, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs);
  function starGeo(r1, r2, depth, pts = 5) {
    const s = new THREE.Shape(); for (let i = 0; i <= pts * 2; i++) { const a = i / (pts * 2) * TAU - PI / 2, r = i % 2 ? r2 : r1; i ? s.lineTo(Math.cos(a) * r, -Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, -Math.sin(a) * r); }
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
  }
  // head deformation (unit sphere -> skull with a jaw); shared by head, hair caps & hats so everything hugs
  function skull(x, y, z) {
    if (y < 0) { const k = Math.pow(-y, 1.5); x *= 1 - .2 * k; z *= z > 0 ? 1 - .04 * k : 1 - .14 * k; }
    else if (z < 0) z *= 1.04;
    return [x, y, z];
  }

  // ---------------------------------------------------------------- merge accumulator
  const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3(), _e = new THREE.Euler(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  function mtx(o) {
    const m = new THREE.Matrix4(); if (!o) return m;
    const p = o.p || [0, 0, 0], r = o.r || [0, 0, 0], s = o.s == null ? [1, 1, 1] : typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s;
    if (o.q) _q.copy(o.q); else { _e.set(r[0], r[1], r[2], o.order || 'XYZ'); _q.setFromEuler(_e); }
    return m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(s[0], s[1], s[2]));
  }
  function mergeParts(L, needCol) {
    let nv = 0, ni = 0, useCol = !!needCol;
    for (const p of L) { nv += p.g.attributes.position.count; ni += p.g.index ? p.g.index.count : p.g.attributes.position.count; if (p.col || p.g.attributes.color) useCol = true; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = useCol ? new Float32Array(nv * 3) : null, idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (const p of L) {
      const g = p.g, P = g.attributes.position, N = g.attributes.normal, T = g.attributes.uv, C = g.attributes.color, n = P.count, flip = p.m.determinant() < 0;
      _nm.getNormalMatrix(p.m);
      const fixed = !C && typeof p.col !== 'function' ? (p.col ? (p.col.isColor ? p.col : lin(p.col)) : WHITE) : null;
      for (let i = 0; i < n; i++) {
        const o3 = (vo + i) * 3, o2 = (vo + i) * 2;
        _v.fromBufferAttribute(P, i).applyMatrix4(p.m); pos[o3] = _v.x; pos[o3 + 1] = _v.y; pos[o3 + 2] = _v.z;
        if (N) { _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize(); nor[o3] = _n.x; nor[o3 + 1] = _n.y; nor[o3 + 2] = _n.z; }
        const u = T ? T.getX(i) : 0, w = T ? T.getY(i) : 0; uv[o2] = u; uv[o2 + 1] = w;
        if (col) { const cc = C ? _n.set(C.getX(i), C.getY(i), C.getZ(i)) : fixed || p.col(_v.x, _v.y, _v.z, u, w); col[o3] = cc.r != null ? cc.r : cc.x; col[o3 + 1] = cc.g != null ? cc.g : cc.y; col[o3 + 2] = cc.b != null ? cc.b : cc.z; }
      }
      if (g.index) { const I = g.index; for (let k = 0; k < I.count; k += 3) { const a = I.getX(k) + vo, b = I.getX(k + 1) + vo, c = I.getX(k + 2) + vo; idx[io++] = a; idx[io++] = flip ? c : b; idx[io++] = flip ? b : c; } }
      else for (let k = 0; k < n; k += 3) { idx[io++] = vo + k; idx[io++] = vo + (flip ? k + 2 : k + 1); idx[io++] = vo + (flip ? k + 1 : k + 2); }
      vo += n;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
    return g;
  }
  class Acc {
    constructor() { this.t = new Map(); }
    put(target, mat, geo, o) { let byM = this.t.get(target); if (!byM) this.t.set(target, byM = new Map()); let L = byM.get(mat); if (!L) byM.set(mat, L = []); L.push({ g: geo, m: mtx(o), col: o && o.col }); }
    flush(shadow) {
      const out = [];
      this.t.forEach((byM, target) => byM.forEach((L, mat) => { const mesh = new THREE.Mesh(mergeParts(L, mat.vertexColors), mat); mesh.castShadow = shadow; mesh.userData.unique = true; target.add(mesh); out.push(mesh); }));
      return out;
    }
  }
  // toon outline: back-face hull pushed out along normals in view space (constant width at any scale)
  const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x070a12, side: THREE.BackSide });
  OUTLINE.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  mvPosition.xyz += normalize(normalMatrix * normal) * (0.0052 * max(1.0, -mvPosition.z * 0.28));\n  gl_Position = projectionMatrix * mvPosition;'); };

  // ---------------------------------------------------------------- 2D painting helpers
  function star(x, cx, cy, r1, r2, n = 5, rot = -PI / 2) { x.beginPath(); for (let i = 0; i <= n * 2; i++) { const a = rot + i / (n * 2) * TAU, r = i % 2 ? r2 : r1; i ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } x.closePath(); }
  function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
  function heart(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy + s * .35); x.bezierCurveTo(cx - s * .65, cy - s * .1, cx - s * .35, cy - s * .62, cx, cy - s * .28); x.bezierCurveTo(cx + s * .35, cy - s * .62, cx + s * .65, cy - s * .1, cx, cy + s * .35); x.closePath(); }
  const rgba = (h, a) => { const [r, g, b] = LU.rgb(h); return `rgba(${r},${g},${b},${a})`; };
  function pattern(x, kind, W, H, c1, c2, R) {
    x.save();
    switch (kind) {
      case 'stripes': x.fillStyle = c2; for (let y = 10; y < H; y += 30) x.fillRect(0, y, W, 11); break;
      case 'plaid': x.globalAlpha = .42; x.fillStyle = c2; for (let i = 0; i < W; i += 34) x.fillRect(i, 0, 13, H); for (let j = 0; j < H; j += 34) x.fillRect(0, j, W, 13); x.globalAlpha = .3; x.fillStyle = '#fff'; for (let i = 21; i < W; i += 34) x.fillRect(i, 0, 2, H); for (let j = 21; j < H; j += 34) x.fillRect(0, j, W, 2); break;
      case 'buffalo': { const s = W / 10; for (let i = 0; i < 11; i++) for (let j = 0; j < H / s + 1; j++) { const a = (i % 2) + (j % 2); if (!a) continue; x.globalAlpha = a === 2 ? .92 : .5; x.fillStyle = c2; x.fillRect(i * s, j * s, s, s); } break; }
      case 'checker': { const s = W / 12; x.fillStyle = c2; for (let i = 0; i < 12; i++) for (let j = 0; j < H / s; j++) if ((i + j) % 2) x.fillRect(i * s, j * s, s, s); break; }
      case 'camo': { const cs = [SH(c1, -.32), SH(c1, .22), c2, SH(c2, -.3)]; for (let i = 0; i < W * H / 900; i++) { x.fillStyle = cs[i % 4]; x.beginPath(); x.ellipse(R() * W, R() * H, 6 + R() * W * .07, 4 + R() * W * .04, R() * 3, 0, TAU); x.fill(); } break; }
      case 'dots': x.fillStyle = c2; for (let i = 0; i < W; i += 22) for (let j = 0; j < H; j += 22) { x.beginPath(); x.arc(i + (j / 22 % 2) * 11, j, 4, 0, TAU); x.fill(); } break;
      case 'knit': x.strokeStyle = rgba(SH(c1, -.3), .35); x.lineWidth = 1.5; for (let j = 4; j < H; j += 7) { x.beginPath(); for (let i = 0; i <= W; i += 6) x.lineTo(i, j + (i / 6 % 2 ? 3 : 0)); x.stroke(); }
        x.fillStyle = c2; x.fillRect(0, H * .26, W, 7); x.fillRect(0, H * .26 + 34, W, 7); x.fillStyle = '#fff';
        for (let i = 10; i < W; i += 26) { star(x, i, H * .26 + 20, 8, 3, 6, 0); x.fill(); } break;
      case 'zigzag': for (let k = 0; k < 4; k++) { const y = H * (.18 + k * .22); x.fillStyle = k % 2 ? c2 : '#f5e6c8'; x.beginPath(); x.moveTo(0, y); for (let i = 0; i <= W; i += 16) { x.lineTo(i + 8, y - 9); x.lineTo(i + 16, y); } for (let i = W; i >= 0; i -= 16) { x.lineTo(i - 8, y + 9 + 8); x.lineTo(i - 16, y + 8); } x.closePath(); x.fill(); } break;
      case 'scales': x.strokeStyle = rgba(SH(c1, -.35), .5); x.lineWidth = 1.5; for (let j = 0; j < H; j += 10) for (let i = (j / 10 % 2) * 7; i < W; i += 14) { x.beginPath(); x.arc(i, j, 7, 0, PI); x.stroke(); } break;
      case 'panels': x.strokeStyle = rgba('#000', .35); x.lineWidth = 2; for (let j = 0; j < H; j += H / 4) { x.beginPath(); x.moveTo(0, j); x.lineTo(W, j); x.stroke(); } for (let i = W / 16; i < W; i += W / 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); }
        x.fillStyle = rgba('#fff', .5); for (let j = 6; j < H; j += H / 4) for (let i = W / 16 + 6; i < W; i += W / 4) { x.beginPath(); x.arc(i, j, 2.2, 0, TAU); x.fill(); } break;
      case 'racing': x.fillStyle = c2; x.fillRect(W / 2 - 16, 0, 9, H); x.fillRect(W / 2 + 7, 0, 9, H); x.fillRect(0, 0, 6, H); x.fillRect(W - 6, 0, 6, H); break;
    }
    x.restore();
  }
  function graphic(x, kind, cx, cy, s, col, col2, num) {
    x.save(); x.translate(cx, cy); x.fillStyle = col; x.strokeStyle = col; x.lineJoin = 'round'; x.lineCap = 'round';
    switch (kind) {
      case 'star': star(x, 0, 0, s * .5, s * .21); x.fill(); break;
      case 'bolt': x.beginPath(); x.moveTo(-s * .08, -s * .5); x.lineTo(s * .28, -s * .5); x.lineTo(s * .06, -s * .08); x.lineTo(s * .3, -s * .08); x.lineTo(-s * .22, s * .52); x.lineTo(-s * .03, s * .06); x.lineTo(-s * .28, s * .06); x.closePath(); x.fill(); break;
      case 'heart': heart(x, 0, 0, s); x.fill(); break;
      case 'smile': x.lineWidth = s * .09; x.beginPath(); x.arc(0, 0, s * .42, 0, TAU); x.stroke(); x.beginPath(); x.arc(-s * .14, -s * .1, s * .06, 0, TAU); x.arc(s * .14, -s * .1, s * .06, 0, TAU); x.fill(); x.beginPath(); x.arc(0, s * .02, s * .24, .15 * PI, .85 * PI); x.stroke(); break;
      case 'diamond': x.beginPath(); x.moveTo(0, -s * .5); x.lineTo(s * .38, 0); x.lineTo(0, s * .5); x.lineTo(-s * .38, 0); x.closePath(); x.fill(); x.fillStyle = col2; x.beginPath(); x.moveTo(0, -s * .26); x.lineTo(s * .18, 0); x.lineTo(0, s * .26); x.lineTo(-s * .18, 0); x.closePath(); x.fill(); break;
      case 'flame': x.beginPath(); x.moveTo(0, s * .5); x.bezierCurveTo(-s * .45, s * .4, -s * .4, -s * .1, -s * .05, -s * .5); x.bezierCurveTo(0, -s * .2, s * .15, -s * .15, s * .12, -s * .35); x.bezierCurveTo(s * .45, -s * .05, s * .45, s * .4, 0, s * .5); x.fill(); x.fillStyle = col2; x.beginPath(); x.ellipse(0, s * .22, s * .14, s * .2, 0, 0, TAU); x.fill(); break;
      case 'note': x.lineWidth = s * .08; x.beginPath(); x.ellipse(-s * .2, s * .3, s * .14, s * .1, -.4, 0, TAU); x.ellipse(s * .26, s * .2, s * .14, s * .1, -.4, 0, TAU); x.fill(); x.beginPath(); x.moveTo(-s * .08, s * .28); x.lineTo(-s * .08, -s * .38); x.lineTo(s * .38, -s * .48); x.lineTo(s * .38, s * .18); x.stroke(); break;
      case 'number': x.font = `900 ${Math.round(s)}px Arial Black, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = s * .1; x.strokeStyle = col2; x.strokeText(num, 0, 2); x.fillText(num, 0, 2); break;
      case 'wave': x.lineWidth = s * .09; for (let k = -1; k <= 1; k++) { x.beginPath(); for (let i = -4; i <= 4; i++) x.lineTo(i * s * .11, k * s * .22 + Math.sin(i * 1.4) * s * .07); x.stroke(); } break;
      case 'eye': x.beginPath(); x.moveTo(-s * .48, 0); x.quadraticCurveTo(0, -s * .45, s * .48, 0); x.quadraticCurveTo(0, s * .45, -s * .48, 0); x.fill(); x.fillStyle = col2; x.beginPath(); x.arc(0, 0, s * .16, 0, TAU); x.fill(); break;
      case 'skullz': x.beginPath(); x.arc(0, -s * .08, s * .34, 0, TAU); x.fill(); x.fillRect(-s * .2, s * .1, s * .4, s * .26); x.fillStyle = col2; x.beginPath(); x.arc(-s * .13, -s * .08, s * .09, 0, TAU); x.arc(s * .13, -s * .08, s * .09, 0, TAU); x.fill(); x.fillRect(-s * .12, s * .24, s * .05, s * .12); x.fillRect(s * .07, s * .24, s * .05, s * .12); break;
      case 'circle': x.lineWidth = s * .1; x.beginPath(); x.arc(0, 0, s * .4, 0, TAU); x.stroke(); x.beginPath(); x.arc(0, 0, s * .18, 0, TAU); x.fill(); break;
      case 'paw': x.beginPath(); x.ellipse(0, s * .14, s * .22, s * .18, 0, 0, TAU); x.fill(); [[-.26, -.12], [-.09, -.3], [.09, -.3], [.26, -.12]].forEach(p => { x.beginPath(); x.arc(p[0] * s, p[1] * s, s * .09, 0, TAU); x.fill(); }); break;
      case 'emblem': x.beginPath(); x.moveTo(0, -s * .5); x.lineTo(s * .42, -s * .28); x.lineTo(s * .34, s * .22); x.lineTo(0, s * .5); x.lineTo(-s * .34, s * .22); x.lineTo(-s * .42, -s * .28); x.closePath(); x.fill(); x.fillStyle = col2; star(x, 0, 0, s * .24, s * .1); x.fill(); break;
      case 'letter': x.font = `900 ${Math.round(s)}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = s * .12; x.strokeStyle = col2; x.strokeText(num, 0, 2); x.fillText(num, 0, 2); break;
    }
    x.restore();
  }
  const contrast = (bg, a, b) => Math.abs(LUM(a) - LUM(bg)) > .3 ? a : b;

  // ---------------------------------------------------------------- body types
  const BODIES = {
    std: { tor: [[.196, -.04], [.205, .03], [.211, .1], [.222, .18], [.245, .26], [.268, .34], [.283, .41], [.288, .46], [.279, .505], [.232, .547], [.14, .58], [.06, .6], [0, .606]], zr: [.76, .72, .66, .7], sh: .322, shY: .458, del: .081, arm: [.071, .06, .059, .048], bic: .005, hand: 1.14, leg: [.114, .09, .085, .062], calf: .009, hipX: .118, pel: .226, pelZ: .74, neck: .064, R: .17, headY: .62 },
    slim: { tor: [[.2, -.04], [.198, .03], [.186, .1], [.181, .16], [.192, .23], [.222, .31], [.24, .38], [.248, .44], [.243, .49], [.206, .537], [.13, .57], [.055, .59], [0, .596]], zr: [.78, .74, .7, .72], sh: .288, shY: .448, del: .068, arm: [.06, .052, .052, .043], bic: 0, hand: 1.02, leg: [.112, .086, .077, .056], calf: .008, hipX: .115, pel: .226, pelZ: .76, neck: .056, R: .166, headY: .61, bust: .035 },
    muscle: { tor: [[.235, -.04], [.244, .03], [.25, .1], [.266, .18], [.3, .26], [.337, .34], [.36, .41], [.366, .465], [.352, .515], [.296, .557], [.19, .587], [.08, .605], [0, .612]], zr: [.76, .7, .64, .7], sh: .398, shY: .468, del: .114, arm: [.102, .086, .088, .068], bic: .02, hand: 1.36, leg: [.136, .104, .102, .074], calf: .016, hipX: .137, pel: .249, pelZ: .74, neck: .095, R: .168, headY: .635 },
    bulky: { tor: [[.25, -.04], [.275, .03], [.3, .1], [.315, .18], [.318, .26], [.31, .34], [.31, .41], [.312, .46], [.302, .51], [.256, .552], [.16, .582], [.07, .6], [0, .606]], zr: [.86, .82, .72, .72], sh: .368, shY: .458, del: .104, arm: [.094, .08, .08, .064], bic: .006, hand: 1.3, leg: [.134, .112, .102, .076], calf: .01, hipX: .137, pel: .266, pelZ: .8, neck: .09, R: .19, headY: .63 }
  };
  const zrAt = (zr, t) => { t = clamp(t, 0, 1) * 3; const i = Math.min(2, Math.floor(t)), f = t - i; return zr[i] + (zr[i + 1] - zr[i]) * f; };
  const torsoR = (B, y) => { const T = B.tor; for (let i = 1; i < T.length; i++) if (y <= T[i][1]) { const a = T[i - 1], b = T[i], f = (y - a[1]) / (b[1] - a[1] || 1); return a[0] + (b[0] - a[0]) * f; } return 0; };
  const torsoZ = (B, y) => torsoR(B, y) * zrAt(B.zr, (y + .04) / .65);
  const HEADS = { human: null, dog: { R: .205, s: [1.12, .95, 1] }, bear: { R: .2, s: [1.05, 1, 1] }, fox: { R: .18, s: [1, .98, 1] }, lizard: { R: .175, s: [1, .9, 1.22] }, fish: { R: .2, s: [.95, 1.02, 1.15] }, robot: { R: .185, s: [1, 1, 1] } };

  // ---------------------------------------------------------------- face painting (512 x 256 equirect, front centre x = 256)
  const HAIRLINES = { def: [.5, .12, -.55], long: [.52, -.02, -.62], bob: [.5, .02, -.6], buzz: [.46, .16, -.48], mohawk: [.46, .18, -.45], slick: [.58, .16, -.5], undercut: [.52, .22, -.45], none: [.5, .12, -.55] };
  const hairline = L => HAIRLINES[{ long: 'long', twintails: 'long', braids: 'long', locs: 'long', ponytail: 'long', highpony: 'long', bob: 'bob', buzz: 'buzz', mohawk: 'mohawk', slick: 'slick', undercut: 'undercut' }[L.hair] || 'def'];
  function hairElev(a, hl) { const c = Math.cos(a); return c >= 0 ? hl[1] + (hl[0] - hl[1]) * Math.pow(c, 1.4) : hl[1] - (hl[1] - hl[2]) * Math.pow(-c, 1.1); }

  function drawEye(x, cx, cy, w, h, side, o) {
    const ox = cx + side * w / 2, ix = cx - side * w / 2;
    const lid = () => { x.moveTo(ix, cy + h * .12); x.bezierCurveTo(ix + side * w * .12, cy - h * .9, ox - side * w * .32, cy - h * 1.05, ox, cy - h * .18); };
    x.save(); x.beginPath(); lid(); x.bezierCurveTo(ox - side * w * .22, cy + h * .78, ix + side * w * .22, cy + h * .72, ix, cy + h * .12); x.closePath();
    x.fillStyle = o.sclera || '#fbf8f3'; x.fill(); x.clip();
    const ir = o.ir || h * .62, icx = cx + side * w * .04, icy = cy - h * .04;
    const g = x.createRadialGradient(icx, icy - ir * .35, ir * .1, icx, icy, ir);
    g.addColorStop(0, SH(o.iris, .5)); g.addColorStop(.55, o.iris); g.addColorStop(1, SH(o.iris, -.6));
    x.fillStyle = g; x.beginPath(); x.arc(icx, icy, ir, 0, TAU); x.fill();
    x.fillStyle = '#06070b'; x.beginPath(); if (o.slit) x.ellipse(icx, icy, ir * .2, ir * .82, 0, 0, TAU); else x.arc(icx, icy, ir * .44, 0, TAU); x.fill();
    const sg = x.createLinearGradient(0, cy - h, 0, cy + h * .1); sg.addColorStop(0, 'rgba(40,20,10,.5)'); sg.addColorStop(1, 'rgba(40,20,10,0)'); x.fillStyle = sg; x.fillRect(cx - w, cy - h * 1.3, w * 2, h * 1.4);
    x.fillStyle = '#fff'; x.beginPath(); x.arc(icx - ir * .36, icy - ir * .36, ir * .27, 0, TAU); x.fill();
    x.globalAlpha = .85; x.beginPath(); x.arc(icx + ir * .34, icy + ir * .3, ir * .12, 0, TAU); x.fill(); x.globalAlpha = 1;
    x.restore();
    x.strokeStyle = o.liner || '#1a120f'; x.lineWidth = o.lid || 3.2; x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath(); lid(); if (o.wing) x.lineTo(ox + side * w * .22, cy - h * .62); x.stroke();
    if (o.lashes) { x.lineWidth = 2; for (let k = 0; k < 3; k++) { const t = .55 + k * .18, px = ix + (ox - ix) * t, py = cy - h * (.95 - k * .3 + (k === 2 ? .2 : 0)); x.beginPath(); x.moveTo(px, py); x.lineTo(px + side * (4 + k * 2), py - 5 + k); x.stroke(); } }
    x.strokeStyle = 'rgba(70,35,25,.35)'; x.lineWidth = 1.3; x.beginPath(); x.moveTo(ox - side * w * .12, cy + h * .2); x.quadraticCurveTo(cx, cy + h * .9, ix + side * w * .18, cy + h * .35); x.stroke();
  }
  function drawBrow(x, cx, cy, len, th, side, kind, col) {
    const ix = cx - side * len * .45, ox = cx + side * len * .55;
    let iy = cy + 1, oy = cy + 1, my = cy - len * .16;
    if (kind === 'fierce') { iy = cy + 6; oy = cy - 5; my = cy - 2; }
    else if (kind === 'arched') { iy = cy + 2; my = cy - len * .3; oy = cy + 3; }
    else if (kind === 'thick') { th *= 1.4; }
    x.fillStyle = col; x.beginPath(); x.moveTo(ix, iy + th * .55); x.quadraticCurveTo(cx, my + th * .55, ox, oy + th * .15); x.quadraticCurveTo(cx, my - th * .55, ix, iy - th * .55); x.closePath(); x.fill();
  }
  function drawMouth(x, cx, cy, kind, lip, w, skin) {
    const dk = '#5a1f1f';
    x.lineCap = 'round'; x.lineJoin = 'round';
    if (kind === 'grin' || kind === 'fangs' || kind === 'open') {
      const hh = kind === 'open' ? 16 : 11;
      x.fillStyle = '#3a0d12'; x.beginPath(); x.moveTo(cx - w / 2, cy - 2); x.quadraticCurveTo(cx, cy + 2, cx + w / 2, cy - 2); x.quadraticCurveTo(cx, cy + hh * 1.6, cx - w / 2, cy - 2); x.fill();
      x.save(); x.clip(); x.fillStyle = '#fbfaf5'; x.fillRect(cx - w / 2, cy - 4, w, 7); if (kind === 'open') { x.fillStyle = '#d0485a'; x.beginPath(); x.ellipse(cx, cy + hh, w * .28, 7, 0, 0, TAU); x.fill(); } x.restore();
      if (kind === 'fangs') { x.fillStyle = '#fbfaf5'; [-1, 1].forEach(s => { x.beginPath(); x.moveTo(cx + s * w * .3, cy); x.lineTo(cx + s * w * .22, cy); x.lineTo(cx + s * w * .26, cy + 8); x.closePath(); x.fill(); }); }
      if (lip) { x.strokeStyle = lip; x.lineWidth = 2.5; x.beginPath(); x.moveTo(cx - w / 2, cy - 2); x.quadraticCurveTo(cx, cy + hh * 1.6, cx + w / 2, cy - 2); x.stroke(); }
      return;
    }
    const up = kind === 'smile' ? 5 : kind === 'smirk' ? 3 : 0;
    if (lip) { x.fillStyle = lip; x.beginPath(); x.moveTo(cx - w * .42, cy); x.quadraticCurveTo(cx, cy + 10, cx + w * .42, cy); x.quadraticCurveTo(cx, cy + 3, cx - w * .42, cy); x.fill(); x.beginPath(); x.moveTo(cx - w * .42, cy); x.quadraticCurveTo(cx - w * .2, cy - 5, cx, cy - 2); x.quadraticCurveTo(cx + w * .2, cy - 5, cx + w * .42, cy); x.quadraticCurveTo(cx, cy + 1, cx - w * .42, cy); x.fill(); }
    else { x.fillStyle = rgba(SH(skin, -.25), .55); x.beginPath(); x.ellipse(cx, cy + 6, w * .26, 3.2, 0, 0, TAU); x.fill(); }
    x.strokeStyle = dk; x.lineWidth = 2.6; x.beginPath();
    if (kind === 'smirk') { x.moveTo(cx - w / 2, cy + 1); x.quadraticCurveTo(cx, cy + 3, cx + w / 2, cy - up - 2); }
    else if (kind === 'neutral') { x.moveTo(cx - w / 2 + 2, cy + 1); x.quadraticCurveTo(cx, cy + 2, cx + w / 2 - 2, cy + 1); }
    else { x.moveTo(cx - w / 2, cy - up); x.quadraticCurveTo(cx, cy + up + 2, cx + w / 2, cy - up); }
    x.stroke();
  }
  function paintFace(x, L, glowOnly) {
    const c = L.c, f = L.face, head = L.head, R = rng(L.key + 'f'), X = 256;
    const skin = c.skin, dk = SH(skin, -.3);
    if (glowOnly) { x.fillStyle = '#000'; x.fillRect(0, 0, 512, 256); }
    else {
      x.fillStyle = skin; x.fillRect(0, 0, 512, 256);
      let g = x.createLinearGradient(0, 130, 0, 256); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(70,30,20,.26)'); x.fillStyle = g; x.fillRect(0, 130, 512, 126);
      g = x.createRadialGradient(X, 120, 10, X, 120, 120); g.addColorStop(0, 'rgba(255,240,225,.14)'); g.addColorStop(1, 'rgba(255,240,225,0)'); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
    }
    const eyeCol = f.glow || c.eyes;
    const eyes = (ey, ex, w, h, o) => [-1, 1].forEach(s => { if (glowOnly) { x.fillStyle = f.glow; x.beginPath(); x.ellipse(X + s * ex, ey, w * .42, h * .62, 0, 0, TAU); x.fill(); } else drawEye(x, X + s * ex, ey, w, h, s, Object.assign({ iris: eyeCol }, o)); });
    if (head === 'human') {
      if (glowOnly) { if (f.glow) eyes(135, 30, 27, 13); return; }
      // hair painted on the scalp (stubble for shaved sides)
      if (L.hair !== 'none') {
        const hl = hairline(L), buzzish = L.hair === 'buzz' || L.hair === 'mohawk' || L.hair === 'undercut';
        x.save(); x.globalAlpha = buzzish ? .62 : 1; x.fillStyle = c.hair; x.beginPath(); x.moveTo(0, 0);
        for (let px = 0; px <= 512; px += 4) { const e = hairElev((px / 512 - .5) * TAU, hl), th = Math.acos(clamp(e, -1, 1)); x.lineTo(px, th / PI * 256); }
        x.lineTo(512, 0); x.closePath(); x.fill(); x.restore();
      }
      // cheeks & freckles
      if (f.blush || f.style === 'anime') [-1, 1].forEach(s => { const g = x.createRadialGradient(X + s * 50, 160, 2, X + s * 50, 160, 22); g.addColorStop(0, 'rgba(240,110,120,.45)'); g.addColorStop(1, 'rgba(240,110,120,0)'); x.fillStyle = g; x.fillRect(X + s * 50 - 24, 136, 48, 48); });
      if (f.freckles) { x.fillStyle = rgba(SH(skin, -.35), .7); for (let i = 0; i < 26; i++) { const s = R() < .5 ? -1 : 1, px = X + s * (14 + R() * 44), py = 150 + R() * 14; x.beginPath(); x.arc(px, py, 1.3 + R(), 0, TAU); x.fill(); } }
      // nose shadow + nostrils
      x.fillStyle = rgba(SH(skin, -.4), .28); x.beginPath(); x.ellipse(X, 162, 13, 5, 0, 0, TAU); x.fill();
      x.fillStyle = rgba(SH(skin, -.55), .55); [-1, 1].forEach(s => { x.beginPath(); x.ellipse(X + s * 6, 161, 2.6, 1.6, s * .3, 0, TAU); x.fill(); });
      // eyes + brows
      const anime = f.style === 'anime', fem = L.fem || f.lashes;
      const browCol = SH(L.hair !== 'none' ? c.hair : SH(skin, -.5), -.15);
      if (anime) { eyes(134, 32, 34, 25, { lashes: true, lid: 4, ir: 11, wing: true }); [-1, 1].forEach(s => drawBrow(x, X + s * 33, 111, 26, 3, s, 'arched', browCol)); }
      else { eyes(135, 30, fem ? 28 : 27, fem ? 14 : 13, { lashes: f.lashes, wing: f.liner || (fem && f.lips), lid: f.liner ? 4 : 3.2 }); [-1, 1].forEach(s => drawBrow(x, X + s * 31, 116, 32, fem ? 4 : 5.5, s, f.brow, browCol)); }
      // beard
      if (f.beard) {
        x.save(); x.fillStyle = c.hair;
        if (f.beard === 'stubble') { x.globalAlpha = .22; x.beginPath(); x.ellipse(X, 196, 64, 36, 0, 0, TAU); x.fill(); x.globalAlpha = .3; for (let i = 0; i < 260; i++) { const a = R() * TAU, r = Math.sqrt(R()), px = X + Math.cos(a) * r * 62, py = 194 + Math.sin(a) * r * 34; if (py > 168) x.fillRect(px, py, 1.4, 1.4); } }
        else { x.globalAlpha = 1; if (f.beard === 'full') { x.beginPath(); x.moveTo(X - 78, 150); x.quadraticCurveTo(X - 70, 228, X, 236); x.quadraticCurveTo(X + 70, 228, X + 78, 150); x.lineTo(X + 60, 168); x.quadraticCurveTo(X, 214, X - 60, 168); x.closePath(); x.fill(); }
          x.beginPath(); x.ellipse(X, 202, 18, 14, 0, 0, TAU); x.fill(); x.beginPath(); x.moveTo(X - 24, 172); x.quadraticCurveTo(X, 162, X + 24, 172); x.quadraticCurveTo(X, 168, X - 24, 172); x.lineWidth = 5; x.strokeStyle = c.hair; x.stroke(); }
        x.restore();
      }
      drawMouth(x, X, 178, f.mouth, f.lips, anime ? 16 : 30, skin);
      if (f.piercing) { x.fillStyle = '#e5e7eb'; x.beginPath(); x.arc(X + 44, 108, 2.4, 0, TAU); x.arc(X + 50, 106, 2.4, 0, TAU); x.arc(X - 13, 184, 2.2, 0, TAU); x.fill(); }
      if (f.paint === 'oni') { x.fillStyle = '#b91c1c'; [-1, 1].forEach(s => { for (let k = 0; k < 2; k++) { x.beginPath(); x.moveTo(X + s * (20 + k * 12), 148); x.lineTo(X + s * (30 + k * 12), 148); x.lineTo(X + s * (40 + k * 14), 170); x.closePath(); x.fill(); } }); x.beginPath(); x.moveTo(X, 92); x.lineTo(X + 7, 104); x.lineTo(X, 112); x.lineTo(X - 7, 104); x.closePath(); x.fill(); }
      // masks
      const mk = f.mask, mc = c.hat || c.top;
      if (mk === 'cowl') { x.fillStyle = mc; x.beginPath(); x.rect(0, 0, 512, 146); x.moveTo(X + 66, 146); x.quadraticCurveTo(X, 160, X - 66, 146); [-1, 1].forEach(s => { x.moveTo(X + s * 30 + 19, 135); x.ellipse(X + s * 30, 135, 19, 11, 0, 0, TAU); }); x.fill('evenodd'); }
      else if (mk === 'domino') { x.fillStyle = mc; x.beginPath(); x.moveTo(X - 70, 124); x.quadraticCurveTo(X, 112, X + 70, 124); x.lineTo(X + 58, 150); x.quadraticCurveTo(X, 142, X - 58, 150); x.closePath(); [-1, 1].forEach(s => { x.moveTo(X + s * 30 + 17, 135); x.ellipse(X + s * 30, 135, 17, 9.5, 0, 0, TAU); }); x.fill('evenodd'); }
      else if (mk === 'ninja' || mk === 'balaclava') { x.fillStyle = mc; x.beginPath(); x.rect(0, 0, 512, 256); rr(x, X - 74, 117, 148, 32, 15); x.fill('evenodd'); x.strokeStyle = SH(mc, -.3); x.lineWidth = 2; rr(x, X - 74, 117, 148, 32, 15); x.stroke(); }
      else if (mk === 'lucha') {
        const lb = c.top, la = c.trim; x.fillStyle = lb; x.beginPath(); x.rect(0, 0, 512, 256); x.ellipse(X, 182, 30, 16, 0, 0, TAU); x.fill('evenodd');
        x.fillStyle = la; [-1, 1].forEach(s => { x.beginPath(); x.moveTo(X + s * 6, 150); x.quadraticCurveTo(X + s * 70, 150, X + s * 64, 104); x.quadraticCurveTo(X + s * 40, 120, X + s * 10, 100); x.closePath(); x.fill(); });
        x.beginPath(); x.moveTo(X, 70); x.lineTo(X + 14, 110); x.lineTo(X, 128); x.lineTo(X - 14, 110); x.closePath(); x.fill();
        [-1, 1].forEach(s => drawEye(x, X + s * 31, 135, 25, 12, s, { iris: eyeCol })); x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.ellipse(X, 182, 30, 16, 0, 0, TAU); x.stroke();
      }
      return;
    }
    // ----- creature faces
    if (glowOnly) return;
    const fur2 = c.fur2 || SH(skin, .45);
    const furStroke = () => { x.strokeStyle = rgba(SH(skin, -.25), .35); x.lineWidth = 1.4; for (let i = 0; i < 380; i++) { const px = R() * 512, py = R() * 256, a = .9 + R() * .5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5); x.stroke(); } };
    if (head === 'dog' || head === 'bear') {
      furStroke();
      x.fillStyle = fur2; x.beginPath(); x.ellipse(X, 182, 66, 58, 0, 0, TAU); x.fill();
      if (head === 'dog') { x.strokeStyle = rgba(SH(skin, -.4), .7); x.lineWidth = 3; [86, 95].forEach(y => { x.beginPath(); x.moveTo(X - 26, y); x.quadraticCurveTo(X, y - 7, X + 26, y); x.stroke(); }); }
      const ey = head === 'dog' ? 122 : 124, ex = head === 'dog' ? 36 : 31;
      if (head === 'bear') [-1, 1].forEach(s => { x.fillStyle = '#120c08'; x.beginPath(); x.ellipse(X + s * ex, ey, 8, 9, 0, 0, TAU); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(X + s * ex - 2.5, ey - 3, 2.6, 0, TAU); x.fill(); });
      else eyes(ey, ex, 28, 18, { ir: 8 });
      [-1, 1].forEach(s => drawBrow(x, X + s * (ex + 1), ey - 18, 30, head === 'dog' ? 7 : 4.5, s, f.brow, SH(skin, -.55)));
    } else if (head === 'fox') {
      furStroke();
      x.fillStyle = fur2; x.beginPath(); x.moveTo(X - 120, 256); x.lineTo(X - 92, 150); x.quadraticCurveTo(X - 52, 128, X - 30, 152); x.quadraticCurveTo(X, 160, X + 30, 152); x.quadraticCurveTo(X + 52, 128, X + 92, 150); x.lineTo(X + 120, 256); x.closePath(); x.fill();
      [-1, 1].forEach(s => drawEye(x, X + s * 32, 128, 30, 13, s, { iris: eyeCol, lashes: f.lashes, wing: true, lid: 3.6 }));
      [-1, 1].forEach(s => drawBrow(x, X + s * 33, 109, 24, 3.5, s, 'arched', SH(skin, -.5)));
      x.fillStyle = SH(skin, -.45); [-1, 1].forEach(s => { x.beginPath(); x.moveTo(X + s * 46, 132); x.lineTo(X + s * 64, 126); x.lineTo(X + s * 60, 138); x.closePath(); x.fill(); });
    } else if (head === 'lizard' || head === 'fish') {
      x.fillStyle = fur2; x.beginPath(); x.ellipse(X, 230, 150, 76, 0, 0, TAU); x.fill();
      pattern(x, 'scales', 512, 170, skin, null, R);
      if (head === 'lizard') {
        x.fillStyle = rgba(SH(skin, -.25), .9); for (let i = 0; i < 40; i++) { x.beginPath(); x.arc(R() * 512, R() * 140, 2 + R() * 4, 0, TAU); x.fill(); }
        x.strokeStyle = '#3a1210'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(X - 96, 146); x.quadraticCurveTo(X - 40, 176, X, 170); x.quadraticCurveTo(X + 40, 176, X + 96, 146); x.stroke();
        x.fillStyle = '#3a1210'; [-1, 1].forEach(s => { x.beginPath(); x.ellipse(X + s * 9, 128, 3, 2, 0, 0, TAU); x.fill(); });
        if (f.mouth === 'grin') { x.fillStyle = '#fff'; for (let i = -3; i <= 3; i++) { if (!i) continue; const px = X + i * 16; x.beginPath(); x.moveTo(px - 4, 167 - Math.abs(i) * 3); x.lineTo(px + 4, 167 - Math.abs(i) * 3); x.lineTo(px, 175 - Math.abs(i) * 3); x.closePath(); x.fill(); } }
      }
    }
  }
  function paintEyeball(x, iris, slit) {
    x.fillStyle = '#fbf8f0'; x.fillRect(0, 0, 128, 64);
    const g = x.createRadialGradient(64, 30, 2, 64, 32, 15); g.addColorStop(0, SH(iris, .45)); g.addColorStop(.6, iris); g.addColorStop(1, SH(iris, -.55));
    x.fillStyle = g; x.beginPath(); x.ellipse(64, 32, 13, 15, 0, 0, TAU); x.fill();
    x.fillStyle = '#06070b'; x.beginPath(); if (slit) x.ellipse(64, 32, 3, 12, 0, 0, TAU); else x.arc(64, 32, 7, 0, TAU); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(60, 27, 3.2, 0, TAU); x.fill();
  }
  function paintScreen(x, L, glowOnly) {
    const gc = L.face.glow || L.c.eyes || '#22d3ee';
    x.fillStyle = glowOnly ? '#000' : '#08101c'; x.fillRect(0, 0, 128, 96);
    if (!glowOnly) { x.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 0; y < 96; y += 4) x.fillRect(0, y, 128, 2); }
    x.fillStyle = gc; x.shadowColor = gc; x.shadowBlur = glowOnly ? 0 : 10;
    [-1, 1].forEach(s => { rr(x, 64 + s * 26 - 11, 30, 22, 26, 8); x.fill(); });
    x.lineWidth = 5; x.strokeStyle = gc; x.lineCap = 'round'; x.beginPath(); x.arc(64, 60, 14, .2 * PI, .8 * PI); x.stroke();
  }

  // ---------------------------------------------------------------- torso painting (256 x 256; x = around with front centre 128, y = top→waist)
  function paintSkinTorso(x, L) {
    const c = L.c, sk = c.skin, dk = SH(sk, -.32), lt = SH(sk, .2), beast = L.head !== 'human', mus = L.body === 'muscle' ? 1 : L.body === 'bulky' ? .45 : .7;
    x.fillStyle = sk; x.fillRect(0, 0, 256, 256);
    if (beast && c.fur2) { x.save(); x.fillStyle = c.fur2; x.beginPath(); x.ellipse(128, 150, 60, 104, 0, 0, TAU); x.fill(); x.restore(); }
    const base = beast && c.fur2 ? c.fur2 : sk, d2 = SH(base, -.3);
    x.lineCap = 'round'; x.strokeStyle = rgba(d2, .6 * mus + .2);
    x.lineWidth = 5; [-1, 1].forEach(s => { x.beginPath(); x.moveTo(128 + s * 68, 66); x.quadraticCurveTo(128 + s * 54, 114, 128 + s * 5, 104); x.stroke(); });
    x.lineWidth = 3; x.beginPath(); x.moveTo(128, 60); x.lineTo(128, 108); x.stroke();
    [-1, 1].forEach(s => { const g = x.createRadialGradient(128 + s * 34, 80, 4, 128 + s * 34, 84, 40); g.addColorStop(0, rgba(SH(base, .25), .5)); g.addColorStop(1, rgba(SH(base, .25), 0)); x.fillStyle = g; x.fillRect(128 + s * 34 - 42, 40, 84, 84); });
    if (L.body !== 'bulky') {
      x.lineWidth = 3.2; x.beginPath(); x.moveTo(128, 118); x.lineTo(128, 212); x.stroke();
      [138, 164, 190].forEach((y, i) => { x.beginPath(); x.moveTo(128 - 30 + i * 2, y + 2); x.quadraticCurveTo(128, y - 3, 128 + 30 - i * 2, y + 2); x.stroke(); });
      [-1, 1].forEach(s => { x.beginPath(); x.moveTo(128 + s * 58, 118); x.quadraticCurveTo(128 + s * 44, 180, 128 + s * 36, 232); x.stroke(); for (let r = 0; r < 3; r++) { const g = x.createRadialGradient(128 + s * 15, 126 + r * 26, 2, 128 + s * 15, 126 + r * 26, 16); g.addColorStop(0, rgba(SH(base, .2), .45 * mus)); g.addColorStop(1, rgba(SH(base, .2), 0)); x.fillStyle = g; x.fillRect(128 + s * 15 - 16, 110 + r * 26, 32, 32); } });
    } else { const g = x.createRadialGradient(128, 170, 10, 128, 170, 70); g.addColorStop(0, rgba(SH(base, .18), .5)); g.addColorStop(1, rgba(SH(base, .18), 0)); x.fillStyle = g; x.fillRect(58, 100, 140, 140); }
    x.fillStyle = rgba(SH(base, -.5), .8); x.beginPath(); x.ellipse(128, 214, 3.5, 5, 0, 0, TAU); x.fill();
    x.strokeStyle = rgba(dk, .45); x.lineWidth = 3; [2, 254].forEach(px => { x.beginPath(); x.moveTo(px, 50); x.lineTo(px, 230); x.stroke(); });
    [-1, 1].forEach(s => { x.beginPath(); x.arc((s < 0 ? 0 : 256) - s * 34, 76, 22, s < 0 ? -.4 : PI - 1.2, s < 0 ? 1.2 : PI + .4); x.stroke(); });
  }
  function paintTorso(x, L, num) {
    const c = L.c, T = L.top, R = rng(L.key + 't'), F = 128;
    const top = c.top, t2 = c.top2, tr = c.trim, sk = c.skin;
    const under = L.under || ({ jacket: 'tee', leather: 'tee', stagejacket: 'tee', varsity: 'tee', poncho: 'tee', vest: L.sleeves === 'long' ? 'long' : 'tee' })[T] || null;
    const patCol = (base) => L.tPat === 'buffalo' ? (c.trim && LUM(c.trim) < .3 ? c.trim : '#151515') : L.tPat === 'camo' ? SH(base, -.45) : contrast(base, tr, SH(base, -.35));
    const fabric = (col, pat) => { x.fillStyle = col; x.fillRect(0, 0, 256, 256); if (pat) pattern(x, pat, 256, 256, col, patCol(col), R); };
    const gfx = (cx, cy, s, bg) => { if (L.graphic) graphic(x, L.graphic, cx, cy, s, contrast(bg, tr, LUM(bg) > .5 ? '#111827' : '#f8fafc'), contrast(bg, LUM(bg) > .5 ? '#f8fafc' : '#111827', '#111827'), String((num * 7) % 89 + 10)); };
    const crew = col => { x.fillStyle = SH(col, -.25); x.fillRect(0, 7, 256, 7); };
    const hem = (col, ribs) => { x.fillStyle = SH(col, -.16); x.fillRect(0, 240, 256, 16); if (ribs) { x.fillStyle = rgba('#000', .15); for (let i = 0; i < 256; i += 5) x.fillRect(i, 240, 2, 16); } };
    const clip = (path, fn) => { x.save(); x.beginPath(); path(); x.clip(); fn(); x.restore(); };
    const notStrip = (w0, w1, yMax = 256) => () => { x.rect(0, 0, 256, yMax); x.moveTo(F - w0, 0); x.lineTo(F - w1, yMax); x.lineTo(F + w1, yMax); x.lineTo(F + w0, 0); x.closePath(); };
    const underLayer = () => { if (under === 'bare') paintSkinTorso(x, L); else { fabric(t2, null); crew(t2); gfx(F, 104, 56, t2); } };
    const edge = (w0, w1, col, yMax = 256) => { x.strokeStyle = col; x.lineWidth = 3; [-1, 1].forEach(s => { x.beginPath(); x.moveTo(F + s * w0, 0); x.lineTo(F + s * w1, yMax); x.stroke(); }); };
    switch (T) {
      case 'bare': paintSkinTorso(x, L); break;
      case 'tee': case 'crop': {
        fabric(top, L.tPat); crew(top); gfx(F, T === 'crop' ? 86 : 100, T === 'crop' ? 48 : 62, top); hem(top);
        if (T === 'crop') { x.save(); x.beginPath(); x.rect(0, 132, 256, 124); x.clip(); paintSkinTorso(x, L); x.restore(); x.fillStyle = SH(top, -.2); x.fillRect(0, 126, 256, 7); }
        break;
      }
      case 'tank': {
        fabric(top, L.tPat); gfx(F, 112, 56, top);
        x.fillStyle = sk; [[F, 0, 40, 50], [0, 0, 32, 30], [256, 0, 32, 30], [64, 0, 30, 44], [192, 0, 30, 44]].forEach(e => { x.beginPath(); x.ellipse(e[0], e[1], e[2], e[3], 0, 0, TAU); x.fill(); });
        x.strokeStyle = SH(top, -.25); x.lineWidth = 3; [[F, 0, 40, 50], [64, 0, 30, 44], [192, 0, 30, 44]].forEach(e => { x.beginPath(); x.ellipse(e[0], e[1], e[2], e[3], 0, 0, PI); x.stroke(); });
        hem(top); break;
      }
      case 'jersey': {
        fabric(top, null); x.fillStyle = tr; x.fillRect(0, 0, 256, 24); x.fillRect(58, 24, 10, 232); x.fillRect(188, 24, 10, 232);
        x.fillStyle = sk; x.beginPath(); x.moveTo(F - 18, 0); x.lineTo(F, 34); x.lineTo(F + 18, 0); x.fill();
        const n = String((num * 7) % 89 + 10), nc = contrast(top, '#f8fafc', '#111827');
        graphic(x, 'number', F, 112, 74, nc, tr, n); graphic(x, 'number', 0, 104, 80, nc, tr, n); graphic(x, 'number', 256, 104, 80, nc, tr, n); hem(top); break;
      }
      case 'hoodie': {
        fabric(top, L.tPat); crew(top); gfx(F, 92, 50, top);
        rr(x, F - 50, 166, 100, 64, 16); x.fillStyle = SH(top, -.07); x.fill(); x.strokeStyle = SH(top, -.28); x.lineWidth = 3; x.stroke();
        x.beginPath(); x.moveTo(F - 50, 182); x.quadraticCurveTo(F - 36, 188, F - 34, 228); x.moveTo(F + 50, 182); x.quadraticCurveTo(F + 36, 188, F + 34, 228); x.stroke();
        x.strokeStyle = contrast(top, '#f8fafc', '#1f2937'); x.lineWidth = 3.5; [-1, 1].forEach(s => { x.beginPath(); x.moveTo(F + s * 10, 6); x.quadraticCurveTo(F + s * 13, 40, F + s * 11, 72); x.stroke(); x.fillStyle = tr; x.fillRect(F + s * 11 - 3, 70, 6, 9); });
        hem(top, true); break;
      }
      case 'jacket': case 'varsity': {
        underLayer();
        if (L.extras.includes('suspenders')) { x.fillStyle = tr; [-1, 1].forEach(s => x.fillRect(F + s * 15 - 5, 20, 10, 236)); }
        clip(notStrip(24, 30), () => { fabric(top, L.tPat); });
        edge(24, 30, SH(top, -.35));
        if (T === 'varsity') {
          x.fillStyle = '#e5e7eb'; [-1, 1].forEach(s => { for (let y = 40; y < 240; y += 36) { x.beginPath(); x.arc(F + s * 31, y, 3.4, 0, TAU); x.fill(); } });
          x.fillStyle = tr; x.fillRect(0, 236, 256, 20); x.fillStyle = top; x.fillRect(0, 242, 256, 5);
          graphic(x, 'letter', F - 60, 96, 44, tr, '#f8fafc', 'G'); graphic(x, 'letter', 0, 100, 90, tr, '#f8fafc', 'G'); graphic(x, 'letter', 256, 100, 90, tr, '#f8fafc', 'G');
        } else {
          x.strokeStyle = SH(top, -.3); x.lineWidth = 3; [-1, 1].forEach(s => { x.beginPath(); x.moveTo(F + s * 44, 186); x.lineTo(F + s * 60, 214); x.stroke(); });
          hem(top);
        }
        break;
      }
      case 'stagejacket': {
        underLayer();
        clip(() => { x.rect(0, 0, 256, 168); x.moveTo(F - 28, 0); x.lineTo(F - 40, 168); x.lineTo(F + 40, 168); x.lineTo(F + 28, 0); x.closePath(); }, () => {
          fabric(top, null); x.fillStyle = tr; for (let i = 0; i < 26; i++) { star(x, R() * 256, R() * 160, 6, 2.6); x.fill(); }
          x.fillStyle = t2; for (let i = 0; i < 14; i++) { star(x, R() * 256, R() * 160, 4, 1.8); x.fill(); }
        });
        x.strokeStyle = tr; x.lineWidth = 5; [-1, 1].forEach(s => { x.beginPath(); x.moveTo(F + s * 28, 0); x.lineTo(F + s * 40, 168); x.stroke(); });
        x.beginPath(); x.moveTo(0, 166); x.lineTo(F - 40, 166); x.moveTo(F + 40, 166); x.lineTo(256, 166); x.stroke(); break;
      }
      case 'leather': {
        underLayer();
        const vestPath = () => { notStrip(17, 22)(); [64, 192].forEach(px => { x.moveTo(px + 22, 0); x.ellipse(px, 0, 22, 44, 0, 0, TAU); }); };
        x.save(); x.beginPath(); vestPath(); x.clip('evenodd'); fabric(top, null);
        const g = x.createLinearGradient(0, 0, 256, 0); for (let i = 0; i <= 8; i++) g.addColorStop(i / 8, i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
        x.fillStyle = tr; [-1, 1].forEach(s => { for (let y = 12; y < 250; y += 13) { x.beginPath(); x.arc(F + s * (24 + y * .02), y, 2.6, 0, TAU); x.fill(); } });
        for (let i = 6; i < 256; i += 13) { x.beginPath(); x.arc(i, 248, 2.4, 0, TAU); x.fill(); }
        x.fillStyle = c.trim; graphic(x, 'circle', 0, 112, 70, '#e11d48', '#111', ''); graphic(x, 'circle', 256, 112, 70, '#e11d48', '#111', '');
        x.fillStyle = '#facc15'; x.fillRect(F + 48, 70, 26, 18); x.fillStyle = '#38bdf8'; x.fillRect(F - 78, 150, 22, 22);
        x.restore(); break;
      }
      case 'vest': {
        underLayer();
        const open = under === 'bare';
        x.save(); x.beginPath(); x.rect(0, 0, 256, 236); [64, 192].forEach(px => { x.moveTo(px + 18, 0); x.ellipse(px, 26, 18, 80, 0, 0, TAU); });
        if (open) { x.moveTo(F - 26, 0); x.lineTo(F - 32, 236); x.lineTo(F + 32, 236); x.lineTo(F + 26, 0); x.closePath(); } else { x.moveTo(F - 22, 0); x.lineTo(F, 40); x.lineTo(F + 22, 0); x.closePath(); }
        x.clip('evenodd'); fabric(top, L.tPat === 'camo' ? 'camo' : null);
        x.fillStyle = rgba('#000', .16); for (let y = 60; y < 230; y += 18) { x.fillRect(0, y, 54, 5); x.fillRect(202, y, 54, 5); }
        [[F - 58, 70], [F + 22, 70], [F - 60, 150], [F + 24, 150]].forEach(p => { rr(x, p[0], p[1], 36, 40, 6); x.fillStyle = SH(top, -.12); x.fill(); x.strokeStyle = SH(top, -.4); x.lineWidth = 2; x.stroke(); x.fillStyle = SH(top, -.22); x.fillRect(p[0], p[1], 36, 11); });
        x.restore(); if (open) edge(26, 32, SH(top, -.4), 236); break;
      }
      case 'armor': {
        fabric(t2, null);
        const plate = (X, Y, w, h, r) => { rr(x, X, Y, w, h, r); const g = x.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, SH(top, .18)); g.addColorStop(1, SH(top, -.2)); x.fillStyle = g; x.fill(); x.strokeStyle = tr; x.lineWidth = 3.5; x.stroke(); };
        plate(F - 74, 22, 148, 104, 26); x.strokeStyle = rgba(SH(top, .4), .7); x.lineWidth = 3; x.beginPath(); x.moveTo(F, 30); x.lineTo(F, 118); x.stroke();
        [132, 162, 192].forEach((y, i) => { plate(F - 60 + i * 2, y, 120 - i * 4, 26, 6); x.fillStyle = tr; for (let k = -2; k <= 2; k++) x.fillRect(F + k * 22 - 1.5, y + 6, 3, 14); });
        plate(-20, 22, 80, 180, 20); plate(196, 22, 80, 180, 20);
        x.fillStyle = tr; [[F - 60, 34], [F + 60, 34], [F - 60, 112], [F + 60, 112]].forEach(p => { x.beginPath(); x.arc(p[0], p[1], 4, 0, TAU); x.fill(); });
        break;
      }
      case 'suit': {
        fabric(top, null);
        x.fillStyle = SH(top, -.22); x.fillRect(38, 0, 52, 256); x.fillRect(166, 0, 52, 256);
        if (L.tPat === 'racing' || L.tPat === 'panels') pattern(x, L.tPat, 256, 256, top, tr, R);
        else { x.strokeStyle = tr; x.lineWidth = 4; x.beginPath(); x.moveTo(36, 12); x.lineTo(F, 122); x.lineTo(220, 12); x.stroke(); }
        if (L.tPat === 'panels') { x.fillStyle = t2; rr(x, F - 46, 40, 92, 70, 12); x.fill(); x.fillStyle = tr; x.shadowColor = tr; x.shadowBlur = 8; x.beginPath(); x.arc(F, 75, 16, 0, TAU); x.fill(); x.shadowBlur = 0; x.fillStyle = rgba('#000', .3); for (let i = 0; i < 4; i++) x.fillRect(F - 30, 150 + i * 12, 60, 5); }
        else if (L.graphic) { x.fillStyle = tr; gfx(F, 74, 58, top); }
        crew(top); break;
      }
      case 'coat': {
        fabric(top, L.tPat);
        [-1, 1].forEach(s => { x.beginPath(); x.moveTo(F + s * 8, 0); x.lineTo(F + s * 52, 70); x.lineTo(F + s * 16, 104); x.closePath(); x.fillStyle = SH(top, -.14); x.fill(); x.strokeStyle = SH(top, -.35); x.lineWidth = 2.5; x.stroke(); });
        x.fillStyle = SH(top, -.42); x.beginPath(); x.moveTo(F - 8, 0); x.lineTo(F, 60); x.lineTo(F + 8, 0); x.fill();
        x.fillStyle = c.metal || tr; [-1, 1].forEach(s => [118, 146, 174].forEach(y => { x.beginPath(); x.arc(F + s * 22, y, 4.5, 0, TAU); x.fill(); }));
        x.fillStyle = SH(top, -.28); x.fillRect(0, 196, 256, 18); x.fillStyle = c.metal || tr; x.fillRect(F - 11, 194, 22, 22); x.fillStyle = SH(top, -.28); x.fillRect(F - 6, 199, 12, 12);
        break;
      }
      case 'gi': {
        fabric(top, null);
        x.fillStyle = SH(top, -.25); x.beginPath(); x.moveTo(F + 30, 0); x.lineTo(F + 46, 0); x.lineTo(F - 4, 130); x.lineTo(F - 18, 120); x.closePath(); x.fill();
        x.fillStyle = c.top2 && L.head === 'fox' ? c.fur2 || tr : tr; x.beginPath(); x.moveTo(F - 46, 0); x.lineTo(F - 26, 0); x.lineTo(F + 40, 180); x.lineTo(F + 18, 186); x.closePath(); x.fill();
        x.strokeStyle = rgba('#000', .25); x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(20 + i * 40, 150); x.lineTo(30 + i * 40, 240); x.stroke(); }
        break;
      }
      case 'sweater': fabric(top, 'knit'); x.fillStyle = SH(top, -.15); x.fillRect(0, 0, 256, 16); hem(top, true); break;
      case 'puffer': {
        fabric(top, null); x.fillStyle = t2; x.fillRect(0, 0, 256, 34);
        for (let y = 34; y < 256; y += 32) { const g = x.createLinearGradient(0, y, 0, y + 32); g.addColorStop(0, rgba('#000', .16)); g.addColorStop(.35, rgba('#fff', .14)); g.addColorStop(1, rgba('#000', .18)); x.fillStyle = g; x.fillRect(0, y, 256, 32); }
        x.fillStyle = SH(t2, -.2); x.fillRect(F - 3, 0, 6, 256); x.fillStyle = tr; x.fillRect(F - 5, 30, 10, 18); rr(x, F + 34, 62, 30, 14, 4); x.fill();
        break;
      }
      case 'dress': {
        fabric(top, L.tPat); x.fillStyle = sk; x.beginPath(); x.moveTo(0, 0); x.lineTo(256, 0); x.lineTo(256, 30); x.lineTo(F + 64, 30); x.quadraticCurveTo(F + 50, 58, F + 22, 50); x.quadraticCurveTo(F + 4, 46, F, 56); x.quadraticCurveTo(F - 4, 46, F - 22, 50); x.quadraticCurveTo(F - 50, 58, F - 64, 30); x.lineTo(0, 30); x.closePath(); x.fill();
        x.fillStyle = tr; x.fillRect(0, 98, 256, 6); x.fillRect(0, 176, 256, 14); x.fillStyle = rgba('#fff', .7); for (let i = 0; i < 30; i++) { x.beginPath(); x.arc(R() * 256, 60 + R() * 110, 1.4, 0, TAU); x.fill(); }
        break;
      }
      case 'poncho': fabric(t2, null); x.fillStyle = SH(t2, -.3); [60, 100, 140].forEach(y => { x.beginPath(); x.arc(F, y, 3, 0, TAU); x.fill(); }); break;
      default: fabric(top, L.tPat);
    }
    if (L.extras.includes('suspenders') && T !== 'jacket' && T !== 'varsity') { x.fillStyle = tr; [-1, 1].forEach(s => { x.fillRect(F + s * 30 - 6, 10, 12, 246); x.fillRect((s < 0 ? 30 : 226) - 6, 10, 12, 246); }); }
    if (T !== 'bare') { const g = x.createLinearGradient(0, 210, 0, 256); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.14)'); x.fillStyle = g; x.fillRect(0, 210, 256, 46); }
  }
  function paintLimb(x, s, R) {
    const W = 128, H = 128;
    x.fillStyle = s.base; x.fillRect(0, 0, W, H);
    if (s.pat) pattern(x, s.pat, W, H, s.base, s.pc, R);
    if (s.denim) {
      x.globalAlpha = .1; x.strokeStyle = '#fff'; x.lineWidth = 1; for (let i = -H; i < W; i += 4) { x.beginPath(); x.moveTo(i, H); x.lineTo(i + H, 0); x.stroke(); } x.globalAlpha = 1;
      const g = x.createRadialGradient(64, s.fade || 60, 4, 64, s.fade || 60, 44); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = rgba('#f5c46b', .6); x.lineWidth = 1.5; x.setLineDash([3, 3]); [30, 98].forEach(px => { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke(); }); x.setLineDash([]);
    }
    if (s.stripe) { x.fillStyle = s.stripe; x.fillRect(26, 0, 7, H); x.fillRect(95, 0, 7, H); }
    if (s.bands) s.bands.forEach(([v0, v1, col]) => { x.fillStyle = col; x.fillRect(0, (1 - v1) * H, W, (v1 - v0) * H); });
    if (s.rips) s.rips.forEach(([v, rw, rh]) => { const y = (1 - v) * H; x.fillStyle = s.skin; x.beginPath(); x.ellipse(64, y, rw, rh, 0, 0, TAU); x.fill(); x.strokeStyle = '#f1f5f9'; x.lineWidth = 1.6; for (let k = -rh + 2; k < rh; k += 3) { x.beginPath(); x.moveTo(64 - rw * .9, y + k); x.lineTo(64 + rw * .9, y + k + (R() - .5) * 2); x.stroke(); } });
  }
  function paintHatTex(x, kind, col, tr) {
    x.fillStyle = col; x.fillRect(0, 0, 128, 64);
    if (kind === 'knit') { x.fillStyle = rgba(SH(col, -.35), .55); for (let i = 0; i < 128; i += 5) x.fillRect(i, 0, 2, 64); x.fillStyle = rgba('#fff', .08); for (let j = 0; j < 64; j += 4) x.fillRect(0, j, 128, 1); }
    else if (kind === 'cap') { x.strokeStyle = rgba(SH(col, -.4), .7); x.lineWidth = 1.5; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(i * 128 / 6 + 10, 0); x.lineTo(i * 128 / 6 + 10, 64); x.stroke(); } x.fillStyle = tr; x.beginPath(); x.arc(64, 42, 9, 0, TAU); x.fill(); x.fillStyle = col; star(x, 64, 42, 5.5, 2.4); x.fill(); }
    else if (kind === 'helmet') { x.fillStyle = tr; x.fillRect(57, 0, 14, 64); x.fillRect(0, 0, 7, 64); x.fillRect(121, 0, 7, 64); x.fillStyle = rgba('#fff', .5); x.fillRect(73, 0, 3, 64); x.fillRect(52, 0, 3, 64); }
    else if (kind === 'poncho') { x.fillStyle = col; x.fillRect(0, 0, 128, 64); pattern(x, 'zigzag', 128, 64, col, tr, null); x.fillStyle = rgba('#000', .2); for (let i = 0; i < 128; i += 3) x.fillRect(i, 58, 1.5, 6); }
  }

  // ---------------------------------------------------------------- build
  function buildHero(o, si = 0, bl = null, pk = null, opts = {}) {
    const L = SkinLooks.resolve(o, si), B = BODIES[L.body] || BODIES.std, c = L.c, low = !!R.lowQ, small = low || !!opts.portrait;
    const root = new THREE.Group(), A = new Acc(), put = (t, m, g, tr) => A.put(t, m, g, tr), Rn = rng(L.key + 'b');
    const human = L.head === 'human', HD = HEADS[L.head], robot = L.head === 'robot', furry = /dog|bear|fox/.test(L.head);
    const glow = L.glowTrim ? c.trim : null, T = L.top, Bt = L.bottom, X = L.extras || [];
    // ---- materials
    const mSkin = robot ? M(c.skin, .36, .55) : M(c.skin, furry ? .9 : .6, 0);
    const mTrim = glow ? M(c.trim, .4, .25, { glow: c.trim, ei: .5 }) : M(c.trim, .5, .15);
    const mMetal = M(c.metal || c.trim, .32, .6), mDark = M('#1d1f27', .62, .08), mBelt = M(SH(c.bottom, -.45), .55, .1);
    const mTop = M(c.top, .8, 0), mTop2 = M(c.top2, .8, 0), mBot = M(c.bottom, .82, 0), mShoe = M(c.shoe, .55, .05), mSole = M(c.sole || '#e5e7eb', .7, 0), mGlove = M(c.glove, .6, .05), mHat = M(c.hat, .72, .05);
    const mHair = M(null, .55, .05, { vc: true, ds: true });
    const torsoTex = canvasTex(`torso|${L.key}|${small ? 1 : 0}`, small ? 128 : 256, small ? 128 : 256, (x, w) => { x.scale(w / 256, w / 256); paintTorso(x, L, o.num); });
    const mTorso = TM(torsoTex, T === 'armor' ? .45 : T === 'leather' || T === 'puffer' ? .5 : .8, T === 'armor' ? .3 : 0);
    // ---- skeleton
    const hips = new THREE.Group(); hips.position.y = 1.02; root.add(hips);
    const torso = new THREE.Group(); torso.position.y = .11; hips.add(torso);
    const head = new THREE.Group(); head.position.y = B.headY; torso.add(head);
    const HR = HD ? HD.R : B.R, hsS = HD ? HD.s : [.93, 1.08, 1];
    const hs = new THREE.Group(); hs.position.set(0, HR * .98, .004); hs.scale.set(HR * hsS[0], HR * hsS[1], HR * hsS[2]); head.add(hs);
    const mkArm = side => { const shoulder = new THREE.Group(); shoulder.position.set(side * B.sh, B.shY, 0); torso.add(shoulder); const upper = new THREE.Group(); shoulder.add(upper); const elbow = new THREE.Group(); elbow.position.y = -.3; upper.add(elbow); const fore = new THREE.Group(); elbow.add(fore); const glove = new THREE.Group(); glove.position.y = -.3; fore.add(glove); return { shoulder, upper, elbow, fore, glove, side }; };
    const mkLeg = side => { const hipJoint = new THREE.Group(); hipJoint.position.set(side * B.hipX, -.06, 0); hips.add(hipJoint); const thigh = new THREE.Group(); hipJoint.add(thigh); const knee = new THREE.Group(); knee.position.y = -.44; thigh.add(knee); const shin = new THREE.Group(); knee.add(shin); const foot = new THREE.Group(); foot.position.y = -.42; shin.add(foot); return { hipJoint, thigh, knee, shin, foot, side }; };
    const arms = [mkArm(-1), mkArm(1)], legs = [mkLeg(-1), mkLeg(1)];
    const sway = []; root.userData.sway = sway;

    // ---- torso, pelvis, neck
    const zr = (t, x, z) => { let k = zrAt(B.zr, t); if (B.bust && z > 0) k *= 1 + B.bust * 4 * Math.exp(-Math.pow((t - .63) / .1, 2)) * Math.pow(z / (Math.hypot(x, z) || 1), 2); return k; };
    put(torso, mTorso, G('torso|' + L.body, () => lathe(B.tor, zr, 32, { v0: -.04, v1: .61 })));
    const pelProf = [[.02, -.155], [.09, -.15], [.15, -.134], [.192, -.104], [B.pel - .006, -.052], [B.pel, 0], [B.pel * 1.004, .05], [B.pel * .985, .085]];
    const skinLegs = /shorts|skirt|trunks/.test(Bt) || Bt === 'cargoshorts';
    put(hips, mBot, G('pel|' + L.body, () => lathe(pelProf, B.pelZ, 28)));
    put(torso, robot ? mMetal : mSkin, G('neck|' + L.body, () => cyl(B.neck * .94, B.neck, .17, 16, true)), { p: [0, .6, -.004] });
    if (robot) put(torso, mDark, G('nring', () => new THREE.TorusGeometry(1, .18, 8, 20)), { p: [0, .62, 0], r: [PI / 2, 0, 0], s: B.neck * 1.05 });
    const chestZ = torsoZ(B, .3);

    // ---- head
    const faceKey = `face|${L.key}|${small ? 1 : 0}`;
    if (human || furry || L.head === 'lizard' || L.head === 'fish') {
      const ftex = canvasTex(faceKey, small ? 256 : 512, small ? 128 : 256, (x, w) => { x.scale(w / 512, w / 512); paintFace(x, L, false); });
      const gtex = L.face.glow ? canvasTex(faceKey + 'g', 256, 128, (x, w) => { x.scale(w / 512, w / 512); paintFace(x, L, true); }) : null;
      const headGeo = G('head|' + (human ? 'h' : L.head), () => { const g = new THREE.SphereGeometry(1, 36, 26, -PI / 2), P = g.attributes.position; if (human) { for (let i = 0; i < P.count; i++) { const v = skull(P.getX(i), P.getY(i), P.getZ(i)); P.setXYZ(i, v[0], v[1], v[2]); } g.computeVertexNormals(); seamFix(g); } return g; });
      put(hs, TM(ftex, furry ? .85 : .55, 0, gtex ? { em: gtex } : {}), headGeo);
    }
    const masked = /ninja|balaclava|lucha/.test(L.face.mask || ''), mFaceCloth = M(L.face.mask === 'lucha' ? c.top : (c.hat || c.top), .8, 0);
    if (human) {
      [-1, 1].forEach(s => put(hs, masked ? mFaceCloth : mSkin, G('ear', () => sph(1, 12, 10)), { p: [s * .95, -.1, -.04], r: [0, s * .35, 0], s: [.15, .27, .19] }));
      if (L.hat !== 'helmet') { put(hs, masked ? mFaceCloth : mSkin, G('nose', () => sph(1, 12, 10)), { p: [0, -.3, .955], s: [.1, .115, .11] }); put(hs, masked ? mFaceCloth : mSkin, G('nose', () => sph(1, 12, 10)), { p: [0, -.16, .965], s: [.06, .17, .07] }); }
    } else buildCreatureHead(L, hs, put, Rn);

    // ---- hair & hats
    if (human) buildHair(L, hs, head, put, mHair, sway);
    buildHat(L, hs, put, { mHat, mTrim, mMetal, mDark, mHair, small });

    // ---- arms
    const sl = sleeveInfo(L), limbPat = /plaid|buffalo|camo|checker|stripes|dots/.test(L.tPat || '') && !(T === 'vest' && L.tPat === 'camo');
    let mSleeve = sl.col ? M(sl.col, .8, 0) : mSkin;
    if (limbPat && sl.col === c.top) mSleeve = TM(canvasTex(`slv|${L.key}`, 128, 128, x => paintLimb(x, { base: c.top, pat: L.tPat, pc: L.tPat === 'buffalo' ? (LUM(c.trim) < .3 ? c.trim : '#151515') : contrast(c.top, c.trim, SH(c.top, -.35)) }, Rn)), .8);
    if (T === 'puffer') mSleeve = M(sl.col, .55, 0);
    const [u0, u1, f0, f1] = B.arm, hand = B.hand;
    arms.forEach(a => {
      const longS = sl.len === 'long', shortS = sl.len === 'short';
      const puff = T === 'puffer' ? .02 : 0, wide = sl.wide ? .015 : 0;
      put(a.shoulder, sl.len === 'none' ? mSkin : mSleeve, G('del|' + L.body + puff, () => sph(B.del + puff, 16, 12)));
      put(a.upper, longS ? mSleeve : mSkin, G(`ua|${L.body}|${puff}`, () => capsule(u0 + puff, u1 + puff, .3, { bulge: B.bic, at: .62 })));
      if (shortS) put(a.upper, mSleeve, G(`ss|${L.body}`, () => cyl(u0 + .016, u0 + .01, .15, 18, true)), { p: [0, -.06, 0] });
      put(a.fore, longS ? mSleeve : mSkin, G(`fa|${L.body}|${puff}|${wide}`, () => capsule(f0 + puff + wide, f1 + puff + wide * 1.6, .27, { bulge: B.bic * .6, at: .75 })));
      if (longS) put(a.fore, T === 'varsity' || T === 'hoodie' || T === 'sweater' || T === 'puffer' ? M(SH(sl.col, -.18), .8, 0) : mSleeve, G(`cuff|${L.body}`, () => cyl(f1 + .013, f1 + .016, .045, 16, true)), { p: [0, -.25, 0] });
      // gloves / hands
      const gk = L.gloves; let mh = mSkin, mf = null;
      if (gk === 'gloves' || gk === 'gauntlets' || gk === 'mitts') mh = mGlove;
      else if (gk === 'fingerless') { mh = mGlove; mf = mSkin; }
      else if (furry || L.head === 'lizard') mh = mSkin;
      buildHand(a, mh, mf || mh, hand * (gk === 'mitts' ? 1.25 : 1), put, L);
      if (gk === 'wraps') { put(a.fore, M('#f1f5f9', .85, 0), G(`wrap|${L.body}`, () => cyl(f1 + .01, f1 + .012, .07, 14, true)), { p: [0, -.24, 0] }); put(a.glove, M('#f1f5f9', .85, 0), G('wrapP', () => cyl(1, 1, 1, 14, true)), { p: [0, -.04 * hand, 0], s: [.036 * hand, .03 * hand, .044 * hand] }); }
      if (gk === 'gauntlets') { put(a.fore, mMetal, G(`gaunt|${L.body}`, () => cyl(f0 + .018, f1 + .022, .2, 16, true)), { p: [0, -.16, 0] }); put(a.fore, mTrim, G(`gaunt2|${L.body}`, () => cyl(f1 + .026, f1 + .026, .03, 16, true)), { p: [0, -.255, 0] }); }
      if (gk === 'mitts') put(a.fore, mGlove, G(`mittc|${L.body}`, () => cyl(f1 + .026, f1 + .03, .07, 16, true)), { p: [0, -.25, 0] });
      if (X.includes('wristbands')) { put(a.fore, mTrim, G(`wb|${L.body}`, () => cyl(f1 + .014, f1 + .016, .05, 14, true)), { p: [0, -.2, 0] }); if (X.includes('spikes')) for (let k = 0; k < 5; k++) { const an = k / 5 * TAU; put(a.fore, mMetal, G('spk', () => new THREE.ConeGeometry(.012, .035, 6)), { p: [Math.sin(an) * (f1 + .03), -.2, Math.cos(an) * (f1 + .03)], r: [PI / 2 * Math.cos(an), 0, -PI / 2 * Math.sin(an)] }); } }
      if (X.includes('spikes')) for (let k = 0; k < 3; k++) put(a.shoulder, mMetal, G('spk2', () => new THREE.ConeGeometry(.02, .07, 8)), { p: [a.side * (B.del * .7), B.del * .55 + .005, (k - 1) * .045], r: [0, 0, -a.side * .7] });
      if (X.includes('pauldrons') || (T === 'armor' && !X.includes('nopauldron'))) {
        put(a.shoulder, mTop, G(`paul|${L.body}`, () => shell(1, -PI, PI, 0, PI * .55, 18, 8)), { p: [a.side * .015, .01, 0], s: [B.del * 1.6, B.del * 1.25, B.del * 1.5] });
        for (let k = 0; k < 3; k++) put(a.shoulder, k % 2 ? mTrim : mTop, G('sode', () => rbox(1, 1, 1, 4)), { p: [a.side * (B.del + .012), -.03 - k * .055, 0], r: [0, 0, a.side * .2], s: [.022, .06, .15 - k * .01] });
      }
    });

    // ---- legs, pants, socks, shoes
    const [t0, t1, s0, s1] = B.leg, baggy = /baggy|hakama/.test(Bt) ? (Bt === 'hakama' ? .045 : .03) : 0;
    const legTex = (part, side) => {
      const sp = { base: c.bottom, skin: c.skin }; let need = false;
      if (skinLegs) {
        sp.base = c.skin; const lw = L.legwear;
        if (lw === 'thighhighs') { sp.bands = part === 'thigh' ? [[0, .62, c.sock], [.6, .66, c.trim]] : [[0, 1, c.sock]]; need = true; }
        else if (lw === 'socks') { if (part === 'shin') { sp.bands = [[0, .5, c.sock], [.42, .47, c.trim]]; need = true; } }
        else if (lw === 'stockings') { sp.base = MX(c.skin, '#111111', .62); need = part !== 'none'; }
        if (!need) return null;
      } else {
        if (Bt === 'jeans') { sp.denim = true; sp.fade = part === 'thigh' ? 50 : 30; need = true; }
        if (L.bPat && L.bPat !== 'rips') { sp.pat = L.bPat; sp.pc = L.bPat === 'camo' ? SH(c.bottom, -.45) : contrast(c.bottom, c.trim, SH(c.bottom, -.35)); need = true; }
        if (L.bPat === 'rips' || (Bt === 'jeans' && L.bPat === 'rips')) { sp.rips = part === 'thigh' ? [[.16, 13, 7], [.62, 9, 5]] : [[.88, 12, 6]]; need = true; }
        if (Bt === 'joggers' || Bt === 'tights' && L.top === 'suit') { if (Bt === 'joggers') { sp.stripe = c.trim; need = true; } }
        if (!need) return null;
      }
      return TM(canvasTex(`leg|${L.key}|${part}`, 128, 128, x => paintLimb(x, sp, rng(L.key + part))), .85);
    };
    const thighMat = legTex('thigh') || (skinLegs ? mSkin : mBot), shinMat = legTex('shin') || (skinLegs ? mSkin : mBot);
    legs.forEach(l => {
      put(l.thigh, thighMat, G(`th|${L.body}|${baggy}`, () => capsule(t0 + baggy, t1 + baggy, .44, { bulge: baggy ? 0 : .006, at: .7 })));
      put(l.shin, shinMat, G(`sh|${L.body}|${baggy}`, () => capsule(s0 + baggy * .9, s1 + baggy * (Bt === 'hakama' ? 2.2 : 1.1), .42, { bulge: baggy ? 0 : B.calf, at: .72 })));
      if (Bt === 'shorts' || Bt === 'cargoshorts' || Bt === 'trunks') {
        const len = Bt === 'trunks' ? .1 : .27; put(l.thigh, mBot, G(`shorts|${L.body}|${len}`, () => cyl(t0 + .014, t0 + .012 - len * .04, len, 18, true)), { p: [0, .02 - len / 2, 0] });
        if (Bt === 'trunks') put(l.thigh, mTrim, G(`trk|${L.body}`, () => cyl(t0 + .024, t0 + .02, .025, 18, true)), { p: [0, -.075, 0] });
        if (Bt === 'cargoshorts') put(l.thigh, M(SH(c.bottom, -.12), .85, 0), G('cpock', () => rbox(.05, .09, .1, 4)), { p: [l.side * (t0 + .02), -.12, 0] });
      }
      if (Bt === 'cargo') put(l.thigh, M(SH(c.bottom, -.12), .85, 0), G('cpock2', () => rbox(.05, .11, .12, 4)), { p: [l.side * (t0 - .004), -.2, 0] });
      if (Bt === 'joggers' || Bt === 'baggy') put(l.shin, M(SH(c.bottom, -.2), .85, 0), G(`jcuff|${L.body}|${baggy}`, () => cyl(s1 + baggy + .008, s1 + baggy + .004, .06, 16, true)), { p: [0, -.385, 0] });
      if (Bt === 'jeans' && !skinLegs) put(l.shin, M(SH(c.bottom, .18), .85, 0), G(`jroll|${L.body}`, () => cyl(s1 + .014, s1 + .016, .05, 16, true)), { p: [0, -.37, 0] });
      if (X.includes('kneepads')) put(l.knee, mDark, G('kp', () => rbox(.12, .12, .07, 3)), { p: [0, -.01, (s0 + t1) / 2 + .02], s: B.leg[2] / .082 });
      if (X.includes('holster') && l.side > 0) { put(l.thigh, mDark, G('hol', () => rbox(.05, .15, .08, 4)), { p: [l.side * (t0 + .015), -.14, .01] }); put(l.thigh, mDark, G('holr', () => new THREE.TorusGeometry(1, .12, 6, 18)), { p: [0, -.12, 0], r: [PI / 2, 0, 0], s: [t0 + .01, (t0 + .01) * .9, t0 + .01] }); }
      buildShoe(L, l, put, { mShoe, mSole, mSkin, mTrim, mDark, B });
    });
    // belt / skirts / coat tails / sash
    const pelW = B.pel + .008;
    if (!/longskirt/.test(Bt) && T !== 'dress' && !X.includes('champbelt') && T !== 'gi') put(hips, X.includes('belt') ? mTrim : mBelt, G('belt|' + L.body, () => cyl(1, 1, .055, 32, true)), { p: [0, .05, 0], s: [pelW, 1, pelW * B.pelZ] });
    if (!/longskirt/.test(Bt) && T !== 'dress' && !X.includes('champbelt') && T !== 'gi' && T !== 'bare') put(hips, mMetal, G('buckle', () => rbox(.07, .05, .02, 4)), { p: [0, .05, pelW * B.pelZ + .006] });
    if (X.includes('champbelt')) { put(hips, M(SH(c.metal, -.55), .5, .2), G('cb|' + L.body, () => cyl(1, 1, .12, 32, true)), { p: [0, .04, 0], s: [pelW + .006, 1, (pelW + .006) * B.pelZ] }); put(hips, M(c.metal, .25, .75), G('cbp', () => rbox(.24, .17, .04, 3)), { p: [0, .045, (pelW + .006) * B.pelZ + .012] }); put(hips, mTrim, G('cbg', () => starGeo(.045, .02, .02)), { p: [0, .045, (pelW + .006) * B.pelZ + .035] }); [-1, 1].forEach(s => put(hips, M(c.metal, .25, .75), G('cbs', () => rbox(.07, .09, .03, 3)), { p: [s * (pelW - .01), .045, (pelW * B.pelZ) * .55], r: [0, s * .9, 0] })); }
    if (X.includes('sash') || T === 'gi') { put(hips, mTrim, G('sash|' + L.body, () => cyl(1, 1.02, .09, 32, true)), { p: [0, .06, 0], s: [pelW + .01, 1, (pelW + .01) * B.pelZ] }); put(hips, mTrim, G('sashk', () => rbox(.07, .07, .05, 3)), { p: [.08, .06, pelW * B.pelZ + .01] }); [0, 1].forEach(k => put(hips, mTrim, G('sasht' + k, () => tube([[0, 0, 0], [.015 * k, -.1, .02], [.03 * k - .01, -.22, .01]], [.025, .02], { flat: .35, seg: 8, rs: 6 })), { p: [.08 + k * .03, .04, pelW * B.pelZ + .01] })); }
    if (Bt === 'skirt' || Bt === 'longskirt' || T === 'dress') {
      const long = Bt === 'longskirt' || T === 'dress', len = long ? .98 : .34, rb = long ? .48 : .34;
      const sTex = L.bPat && !long ? TM(canvasTex(`skirt|${L.key}`, 128, 128, x => paintLimb(x, { base: c.bottom, pat: L.bPat, pc: contrast(c.bottom, c.trim, SH(c.bottom, -.35)) }, Rn)), .85, 0, { ds: true }) : M(T === 'dress' ? c.top : c.bottom, .8, 0, { ds: true });
      put(hips, sTex, G(`skirt|${L.body}|${long}`, () => { const prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([B.pel + .012 + (rb - B.pel) * Math.pow(t, .8), .085 - t * len]); } prof.reverse(); return lathe(prof, (t, x, z) => B.pelZ + (1 - B.pelZ) * (1 - t) * .7 * 0 + (.86 - B.pelZ) * (1 - t), 40, {}); }), {});
      if (!long) put(hips, mTrim, G(`skirtb|${L.body}`, () => cyl(1, 1, .03, 32, true)), { p: [0, .07, 0], s: [B.pel + .016, 1, (B.pel + .016) * B.pelZ] });
    }
    if (T === 'coat') put(hips, M(c.top, .8, 0, { ds: true }), G(`coat|${L.body}`, () => { const g = cyl(B.pel + .02, .38, .62, 28, true, .5, TAU - 1); g.translate(0, -.31, 0); return g; }), { p: [0, .07, 0], s: [1, 1, .82] });

    // ---- torso extras
    const neckY = .585;
    if (T === 'jacket' || T === 'varsity' || T === 'coat' || T === 'stagejacket' || T === 'leather') {
      const col = T === 'varsity' ? M(c.trim, .7, 0) : T === 'stagejacket' ? mTrim : mTop;
      put(torso, col, G(`collar|${L.body}|${T === 'coat' ? 1 : 0}`, () => cyl(B.neck + .045, B.neck + (T === 'coat' ? .1 : .075), T === 'coat' ? .12 : .07, 20, true, .55, TAU - 1.1)), { p: [0, neckY + .02, -.01], r: [-.12, 0, 0] });
    }
    if (T === 'hoodie' && L.hat !== 'hood') put(torso, mTop, G(`hood|${L.body}`, () => sph(1, 16, 10)), { p: [0, neckY + .015, -chestZ * .62], s: [B.neck * 2.4, B.neck * 1.25, B.neck * 1.6] });
    if (T === 'sweater' || T === 'puffer') put(torso, T === 'puffer' ? mTop2 : M(SH(c.top, -.12), .9, 0), G(`turtle|${L.body}`, () => cyl(B.neck + .014, B.neck + .028, .11, 18, true)), { p: [0, neckY + .04, -.004] });
    if (T === 'poncho') { const pt = canvasTex(`poncho|${L.key}`, 128, 64, x => paintHatTex(x, 'poncho', c.top, c.trim)); put(torso, TM(pt, .85, 0, { ds: true }), G(`poncho|${L.body}`, () => lathe([[B.sh + B.del + .1, .14], [B.sh + .04, .3], [B.sh - .04, .44], [B.neck + .09, .56], [B.neck + .03, .6]], .8, 32)), {}); }
    if (X.includes('scarf') || X.includes('longscarf')) {
      put(torso, mTrim, G(`scarf|${L.body}`, () => new THREE.TorusGeometry(1, .26, 10, 22)), { p: [0, neckY + .01, 0], r: [PI / 2 + .12, 0, 0], s: [B.neck + .042, B.neck + .042, B.neck + .042] });
      if (X.includes('longscarf')) { const sc = new THREE.Group(); sc.position.set(.05, neckY, -B.neck - .03); torso.add(sc); put(sc, M(c.trim, .8, 0, { ds: true }), G('lscarf', () => tube([[0, 0, 0], [.06, -.06, -.12], [.14, -.16, -.32], [.24, -.3, -.55], [.32, -.38, -.78]], t => .04 - .012 * t, { flat: .3, seg: 16, rs: 8 }))); sway.push({ o: sc, ax: 'y', base: 0, amp: .25, f: 3.1, run: 2.2 }); sway.push({ o: sc, ax: 'x', base: .1, amp: .12, f: 2.3, run: 2 }); }
      else put(torso, mTrim, G(`scarft|${L.body}`, () => tube([[0, 0, 0], [.02, -.08, .03], [.01, -.2, .04]], [.035, .03], { flat: .3, seg: 8, rs: 6 })), { p: [.06, neckY - .01, chestZ * .55 + .05] });
    }
    if (X.includes('neckerchief')) { put(torso, mTrim, G(`nk|${L.body}`, () => new THREE.TorusGeometry(1, .22, 8, 22)), { p: [0, neckY + .005, 0], r: [PI / 2 + .3, 0, 0], s: [B.neck + .03, B.neck + .03, B.neck + .03] }); put(torso, mTrim, G('nkt', () => new THREE.ConeGeometry(.08, .13, 3)), { p: [0, neckY - .055, torsoZ(B, .55) + .045], r: [PI - .25, 0, 0], s: [1, 1, .35] }); }
    if (X.includes('collar')) { put(torso, mDark, G(`col|${L.body}`, () => new THREE.TorusGeometry(1, .22, 8, 24)), { p: [0, neckY + .03, 0], r: [PI / 2, 0, 0], s: B.neck + .02 }); for (let k = 0; k < 9; k++) { const an = (k / 9 - .5) * PI * 1.3; put(torso, mMetal, G('cspk', () => new THREE.ConeGeometry(.012, .04, 6)), { q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.sin(an), 0, Math.cos(an))), p: [Math.sin(an) * (B.neck + .035), neckY + .03, Math.cos(an) * (B.neck + .035)] }); } }
    if (X.includes('chain')) { put(torso, mMetal, G(`chain|${L.body}`, () => new THREE.TorusGeometry(1, .09, 8, 30)), { p: [0, neckY - .045, .055], r: [PI / 2 + .55, 0, 0], s: [B.neck + .06, B.neck + .07, B.neck + .06] }); put(torso, mMetal, G('pend', () => rbox(.05, .06, .015, 3)), { p: [0, neckY - .13, torsoZ(B, .46) + .02], r: [-.2, 0, 0] }); }
    if (X.includes('necklace')) put(torso, mMetal, G(`neckl|${L.body}`, () => new THREE.TorusGeometry(1, .05, 6, 30)), { p: [0, neckY - .03, .04], r: [PI / 2 + .45, 0, 0], s: [B.neck + .04, B.neck + .05, B.neck + .04] });
    if (X.includes('neckphones')) { put(torso, mDark, G(`nph|${L.body}`, () => new THREE.TorusGeometry(1, .14, 8, 20, PI)), { p: [0, neckY + .04, 0], r: [PI / 2, 0, 0], s: B.neck + .05 }); [-1, 1].forEach(s => { put(torso, mDark, G('cup', () => cyl(.055, .055, .045, 18, false)), { p: [s * (B.neck + .05), neckY + .02, .03], r: [0, 0, PI / 2], s: 1 }); put(torso, mTrim, G('cup2', () => cyl(.04, .04, .05, 18, false)), { p: [s * (B.neck + .07), neckY + .02, .03], r: [0, 0, PI / 2] }); }); }
    if (X.includes('pouches')) [[-1, 0], [1, 0], [-1, 1]].forEach(([s, k]) => put(hips, M(SH(c.top2 || c.top, -.2), .8, 0), G('pouch', () => rbox(.085, .09, .06, 4)), { p: [s * (pelW - .04 - k * .04), .02, pelW * B.pelZ * (k ? .9 : .7)], r: [0, s * (k ? .3 : .7), 0] }));
    if (X.includes('walletchain')) { const lk = G('link', () => new THREE.TorusGeometry(.014, .004, 5, 10)); for (let k = 0; k < 9; k++) { const t = k / 8; put(hips, mMetal, lk, { p: [.12 + t * .1, .02 - Math.sin(t * PI) * .12, pelW * B.pelZ * .7 - t * .05], r: [0, k % 2 ? PI / 2 : 0, .5] }); } }
    if (T === 'vest' && L.under !== 'bare') [-1, 1].forEach(s => put(torso, M(SH(c.top, -.12), .8, 0), G('vpouch', () => rbox(.075, .085, .05, 4)), { p: [s * .085, .2, torsoZ(B, .2) + .012] }));
    if (X.includes('cape') || L.cape) { const cp = new THREE.Group(); cp.position.set(0, .54, 0); torso.add(cp); put(cp, M(glow ? SH(c.trim, -.15) : c.trim, .7, 0, { ds: true }), G(`cape|${L.body}`, () => { const g = cyl(B.sh * .7, B.sh + .14, 1.0, 22, true, PI - 1.05, 2.1); g.translate(0, -.5, 0); return g; }), { s: [1, 1, .8] }); sway.push({ o: cp, ax: 'x', base: .06, amp: .035, f: 1.7, run: 4 }); }
    if (X.includes('bandolier')) put(torso, mBelt, G(`band|${L.body}`, () => new THREE.TorusGeometry(1, .07, 6, 40)), { p: [0, .3, 0], r: [0, 0, .75], s: [torsoR(B, .3) + .015, .4, torsoZ(B, .3) + .015] });

    // ---- tails
    if (L.tail) buildTail(L, hips, put, B, sway);

    // ---- flush merged meshes (+ outline)
    const meshes = A.flush(!low);
    if (!low) meshes.forEach(m => { if (m.material.side === THREE.DoubleSide || m.material.transparent) return; const h = new THREE.Mesh(m.geometry, OUTLINE); h.userData.outline = true; h.raycast = () => { }; m.parent.add(h); h.position.copy(m.position); });

    // ---- back bling & pickaxe
    if (bl) { const b = buildBackBlingMesh(bl); b.position.set(0, .3, -(chestZ + .1)); torso.add(b); }
    if (pk) { const p = buildPickaxeMesh(pk); p.scale.setScalar(.92); torso.add(p); root.userData.pk = p; root.userData.pkSwing = 0; }
    root.userData.joints = { hips, torso, head, leftArm: { shoulder: arms[0].shoulder, elbow: arms[0].elbow, glove: arms[0].glove }, rightArm: { shoulder: arms[1].shoulder, elbow: arms[1].elbow, glove: arms[1].glove }, leftLeg: { hipJoint: legs[0].hipJoint, knee: legs[0].knee }, rightLeg: { hipJoint: legs[1].hipJoint, knee: legs[1].knee } };
    root.userData.look = L;
    root.userData.rig = { arms, legs, sh: B.sh, hipX: B.hipX };   // full limb chains for the animation system (plus_rig.js)
    applyHeroStance(root, 0, 'idle');
    return root;
  }

  function sleeveInfo(L) {
    const c = L.c;
    switch (L.top) {
      case 'jacket': case 'hoodie': case 'coat': case 'sweater': case 'puffer': case 'suit': case 'stagejacket': case 'varsity': return { len: 'long', col: c.sleeve || c.top };
      case 'gi': return { len: 'long', col: c.top, wide: true };
      case 'armor': return { len: 'long', col: c.top2 };
      case 'vest': return L.under === 'bare' ? { len: 'none' } : { len: L.sleeves === 'long' ? 'long' : 'short', col: c.top2 };
      case 'leather': return { len: 'short', col: c.top2 };
      case 'poncho': return { len: 'long', col: c.top2 };
      case 'tank': case 'bare': case 'dress': return { len: 'none' };
      default: return { len: 'short', col: c.top };
    }
  }
  function buildHand(a, mPalm, mFing, s, put, L) {
    const sd = a.side, claws = L.head === 'lizard' || L.head === 'bear';
    put(a.glove, mPalm, G('fist', () => rbox(.058, .085, .074, 3.2)), { p: [0, -.035 * s, .004 * s], s });
    put(a.glove, mFing, G('fing', () => rbox(.06, .046, .07, 3)), { p: [-sd * .006 * s, -.083 * s, .014 * s], r: [.3, 0, 0], s });
    put(a.glove, mFing, G('thumb', () => capsule(.017, .015, .035)), { p: [-sd * .028 * s, -.022 * s, .03 * s], r: [-.9, 0, -sd * .35], s });
    if (claws) for (let k = -1; k <= 1; k++) put(a.glove, M('#f3ead8', .5, 0), G('claw', () => new THREE.ConeGeometry(.008, .03, 6)), { p: [-sd * .02 * s, -.1 * s, (.02 + k * .02) * s], r: [PI, 0, 0], s });
  }
  function buildShoe(L, l, put, m) {
    const B = m.B, f = l.foot, k = L.shoes, s1 = B.leg[3], s0 = B.leg[2], wide = B.leg[3] / .06;
    const S = (g, mat, tr) => put(f, mat, g, tr);
    if (k === 'paws' || k === 'claws') {
      S(G('paw', () => rbox(.14, .09, .21, 2.6)), m.mSkin, { p: [0, -.058, .03], s: [wide, 1, 1] });
      for (let i = -1; i <= 1; i++) { S(G('toe', () => sph(.032, 10, 8)), m.mSkin, { p: [i * .042 * wide, -.07, .13] }); if (k === 'claws') S(G('tclaw', () => new THREE.ConeGeometry(.012, .045, 6)), M('#f3ead8', .5, 0), { p: [i * .042 * wide, -.075, .165], r: [PI / 2, 0, 0] }); }
      return;
    }
    const tall = k === 'tallboots', boot = k === 'boots' || tall || k === 'cowboyboots';
    if (k === 'sneakers') {
      S(G('snk', () => rbox(.13, .09, .255, 2.8)), m.mShoe, { p: [0, -.058, .04], s: [wide, 1, 1] });
      S(G('snks', () => rbox(.136, .036, .268, 3)), m.mSole, { p: [0, -.098, .042], s: [wide, 1, 1] });
      S(G('snkt', () => rbox(.118, .05, .07, 3)), m.mSole, { p: [0, -.083, .15], s: [wide, 1, 1] });
      S(G('snkc', () => cyl(.068, .074, .045, 16, true)), m.mTrim, { p: [0, .0, -.005], s: [wide, 1, 1] });
      return;
    }
    if (boot) {
      const sh = tall ? .42 : k === 'cowboyboots' ? .27 : .16;
      S(G(`bsh|${sh}|${L.body}`, () => cyl(tall ? s0 + .014 : s1 + .02 + sh * .05, s1 + .016, sh, 18, true)), m.mShoe, { p: [0, sh / 2 - .02, 0] });
      S(G(`btop|${sh}|${L.body}`, () => cyl(1, 1, 1, 18, true)), k === 'cowboyboots' ? m.mTrim : M(SH(L.c.shoe, -.3), .6, 0), { p: [0, sh - .03, 0], s: [(tall ? s0 + .02 : s1 + .026 + sh * .05), .035, (tall ? s0 + .02 : s1 + .026 + sh * .05)] });
      S(G('bft', () => rbox(.135, .1, .26, 2.6)), m.mShoe, { p: [0, -.056, .04], s: [wide, 1, 1] });
      S(G('bso', () => rbox(.142, .036, .272, 3)), k === 'cowboyboots' ? M('#3b2414', .7, 0) : M(L.c.sole && L.c.sole !== '#e5e7eb' ? L.c.sole : '#26211d', .8, 0), { p: [0, -.1, .042], s: [wide, 1, 1] });
      if (k === 'cowboyboots') { S(G('cbtoe', () => new THREE.ConeGeometry(.055, .09, 12)), m.mShoe, { p: [0, -.07, .19], r: [PI / 2, 0, 0], s: [1, 1, .6] }); S(G('cbheel', () => rbox(.08, .07, .06, 4)), M('#3b2414', .7, 0), { p: [0, -.12, -.06] }); }
    }
  }
  function buildCreatureHead(L, hs, put, Rn) {
    const c = L.c, k = L.head, fur = M(c.skin, .9, 0), fur2 = M(c.fur2 || SH(c.skin, .45), .9, 0), nose = M('#141112', .3, .2), teeth = M('#f8f4ea', .4, 0), eyeMat = col => TM(canvasTex('eye|' + col + (k === 'lizard'), 128, 64, x => paintEyeball(x, col, k === 'lizard')), .25, 0);
    if (k === 'dog') { // bulldog: heavy brow, droopy flews, underbite with fangs, folded rose ears
      const dkf = M(SH(c.skin, -.38), .9, 0);
      put(hs, fur, G('dbrow', () => sph(1, 16, 12)), { p: [0, .26, .7], s: [.72, .2, .3] });
      put(hs, fur2, G('dbridge', () => sph(1, 16, 12)), { p: [0, -.24, .86], s: [.34, .26, .28] });
      [-1, 1].forEach(s => {
        put(hs, fur2, G('djowl', () => sph(1, 16, 12)), { p: [s * .25, -.44, .84], s: [.3, .3, .28] });
        put(hs, dkf, G('dear', () => new THREE.ConeGeometry(.3, .5, 3)), { p: [s * .78, .62, .05], r: [.5, 0, s * 2.1], s: [1, 1, .35] });
        put(hs, teeth, G('dtooth', () => new THREE.ConeGeometry(.065, .22, 8)), { p: [s * .2, -.56, 1.08], r: [-.15, 0, 0] });
      });
      put(hs, nose, G('dnose', () => sph(1, 14, 10)), { p: [0, -.12, 1.1], s: [.24, .14, .13] });
      put(hs, fur2, G('djaw', () => sph(1, 14, 10)), { p: [0, -.7, .8], s: [.46, .2, .32] });
      put(hs, M('#6b1d24', .6, 0), G('dmouth', () => sph(1, 12, 8)), { p: [0, -.6, .9], s: [.3, .06, .2] });
    } else if (k === 'bear') {
      put(hs, fur2, G('bmuz', () => sph(1, 18, 14)), { p: [0, -.36, .8], s: [.46, .34, .36] });
      put(hs, nose, G('bnose', () => sph(1, 14, 10)), { p: [0, -.22, 1.13], s: [.2, .13, .12] });
      [-1, 1].forEach(s => { put(hs, fur, G('bear', () => sph(1, 14, 10)), { p: [s * .66, .72, -.05], s: [.3, .3, .16] }); put(hs, fur2, G('beari', () => sph(1, 12, 8)), { p: [s * .66, .71, .06], s: [.17, .17, .06] }); });
    } else if (k === 'fox') {
      put(hs, fur, G('fsn', () => sph(1, 18, 14)), { p: [0, -.28, .86], s: [.34, .28, .62], r: [.12, 0, 0] });
      put(hs, fur2, G('fsnb', () => sph(1, 16, 12)), { p: [0, -.42, .8], s: [.3, .18, .52], r: [.12, 0, 0] });
      put(hs, nose, G('fnose', () => sph(1, 12, 10)), { p: [0, -.2, 1.44], s: [.12, .09, .09] });
      [-1, 1].forEach(s => {
        const ear = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.15, 0, s * -.42));
        put(hs, fur, G('fear', () => new THREE.ConeGeometry(.42, 1.05, 3)), { q: ear, p: [s * .58, 1.08, -.1], s: [1, 1, .45] });
        put(hs, M(SH(c.fur2 || '#fff', -.05), .9, 0), G('feari', () => new THREE.ConeGeometry(.26, .7, 3)), { q: ear, p: [s * .6, 1.0, .02], s: [1, 1, .3] });
        put(hs, M('#2a1a12', .9, 0), G('feart', () => new THREE.ConeGeometry(.2, .36, 3)), { q: ear, p: [s * .58 + s * .2, 1.08 + .5 * .93, -.1], s: [1, 1, .5] });
        put(hs, fur2, G('fcheek', () => new THREE.ConeGeometry(.2, .42, 6)), { p: [s * .8, -.4, .25], r: [0, 0, s * 2.1], s: [1, 1, .55] });
      });
    } else if (k === 'lizard') {
      [-1, 1].forEach(s => { put(hs, M(SH(c.skin, -.08), .7, 0), G('lbrow', () => sph(1, 14, 10)), { p: [s * .58, .48, .42], s: [.36, .34, .36] }); put(hs, eyeMat(c.eyes), G('leye', () => new THREE.SphereGeometry(1, 18, 14, -PI / 2)), { p: [s * .66, .44, .5], r: [0, s * .55, 0], s: .28 }); });
      for (let i = 0; i < 7; i++) { const t = i / 6, an = .35 + t * 2.1; put(hs, M(c.trim, .6, 0), G('crest', () => new THREE.ConeGeometry(.12, .5, 4)), { p: [0, Math.cos(an) * 1.05, Math.sin(an) * 1.05 * -1 + .3], r: [-(an - .2), 0, 0], s: [.5, 1 - Math.abs(t - .4) * .7, 1] }); }
    } else if (k === 'fish') {
      [-1, 1].forEach(s => put(hs, eyeMat(c.eyes || '#111'), G('fseye', () => new THREE.SphereGeometry(1, 18, 14, -PI / 2)), { p: [s * .62, .3, .66], r: [0, s * .5, 0], s: .34 }));
      put(hs, M(SH(c.skin, .25), .5, 0), G('flip', () => new THREE.TorusGeometry(.26, .12, 10, 20)), { p: [0, -.34, 1.03], s: [1, .75, 1] });
      put(hs, M(c.trim, .6, 0, { ds: true }), G('fdors', () => new THREE.ConeGeometry(.5, .8, 3)), { p: [0, 1.05, -.25], r: [-.5, 0, 0], s: [.15, 1, 1] });
      [-1, 1].forEach(s => put(hs, M(c.trim, .6, 0, { ds: true }), G('fside', () => new THREE.ConeGeometry(.28, .55, 3)), { p: [s * 1.0, -.2, -.1], r: [0, 0, s * -1.9], s: [1, 1, .2] }));
    } else if (k === 'robot') {
      const gtex = canvasTex('screen|' + L.key, 128, 96, x => paintScreen(x, L, false)), gem = canvasTex('screeng|' + L.key, 128, 96, x => paintScreen(x, L, true));
      put(hs, M(c.skin, .35, .55), G('rhead', () => rbox(2.05, 1.85, 1.9, 3.6, 22, 16)), { p: [0, .02, 0] });
      put(hs, TM(gtex, .2, .2, { em: gem, ei: 1.2 }), G('rscreen', () => new THREE.PlaneGeometry(1.46, 1.06)), { p: [0, 0, 1.0] });
      put(hs, M('#111827', .3, .3), G('rbezel', () => rbox(1.68, 1.28, .14, 4)), { p: [0, 0, .93] });
      [-1, 1].forEach(s => { put(hs, M(c.trim, .4, .3), G('rbolt', () => cyl(.3, .3, .2, 16, false)), { p: [s * 1.06, 0, 0], r: [0, 0, PI / 2] }); });
      put(hs, M('#475569', .4, .5), G('rant', () => cyl(.05, .05, .7, 8, false)), { p: [.45, 1.2, 0] });
      put(hs, M(c.trim, .3, 0, { glow: c.trim, ei: 1.2 }), G('rantb', () => sph(.15, 12, 10)), { p: [.45, 1.58, 0] });
    }
  }
  function buildHair(L, hs, head, put, mHair, sway) {
    const c = L.c, st = L.hair, hl = hairline(L), hc = lin(c.hair), hc2 = c.hair2 ? lin(c.hair2) : null, tmp = new THREE.Color();
    const tip = hc2 && !L.hairSplit ? (x, y, z, u, v) => tmp.copy(hc).lerp(hc2, smooth(.55, .97, v)) : null;
    const split = L.hairSplit && hc2 ? x => (x < 0 ? hc : hc2) : null;
    const col = kind => split || (kind === 'tube' && tip) || hc;
    if (st === 'none') return;
    const thick = { buzz: .018, mohawk: .018, undercut: .02, slick: .05, short: .065, quiff: .065, spiky: .07, curly: .06, afro: .04, locs: .06 }[st] || .075;
    const capGeo = G(`cap|${thick}|${hl.join()}`, () => {
      const g = new THREE.SphereGeometry(1, 36, 24, -PI / 2, TAU, 0, PI * .84), P = g.attributes.position;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), d = y - hairElev(Math.atan2(x, z), hl), k = d > .07 ? 1 + thick : d > 0 ? 1 + thick * d / .07 : .975, v = skull(x, y, z); P.setXYZ(i, v[0] * k, v[1] * k, v[2] * k); }
      g.computeVertexNormals(); return seamFix(g);
    });
    put(hs, mHair, capGeo, { col: col('cap') });
    const T = (pts, rad, o, salt) => G('ht|' + salt, () => tube(pts, rad, o));
    const ties = M(c.trim, .45, .2);
    const bangs = L.bangs;
    if (bangs && bangs !== 'none') {
      put(hs, mHair, G('bang|' + bangs, () => {
        const aw = 1.05, g = new THREE.SphereGeometry(1, 30, 8, PI / 2 - aw, aw * 2, .32, 1.1), P = g.attributes.position;
        for (let i = 0; i < P.count; i++) {
          const x = P.getX(i), y = P.getY(i), z = P.getZ(i), a = Math.atan2(x, z), th = Math.acos(clamp(y, -1, 1)), f = (th - .32) / 1.1;
          let tb;
          if (bangs === 'straight') tb = 1.36 + .26 * smooth(.45, .95, Math.abs(a));
          else if (bangs === 'side') tb = 1.18 + .32 * (a + aw) / (2 * aw) + .05 * Math.abs(Math.sin(a * 7));
          else if (bangs === 'parted') tb = Math.abs(a) < .07 ? .5 : 1.2 + .3 * smooth(0, 1, Math.abs(a));
          else tb = 1.3 + .14 * Math.abs(Math.sin(a * 4.5)) - .06;
          const nth = .32 + f * (tb - .32), r = 1.085 - .04 * f * f, v = skull(Math.sin(a) * Math.sin(nth), Math.cos(nth), Math.cos(a) * Math.sin(nth));
          P.setXYZ(i, v[0] * r, v[1] * r, v[2] * r);
        }
        g.computeVertexNormals(); return g;
      }), { col: col('cap') });
    }
    const sideLocks = () => [-1, 1].forEach(s => put(hs, mHair, T([[s * .82, .1, .42], [s * .98, -.5, .5], [s * 1.1, -1.25, .78], [s * 1.12, -2.1, 1.0]], t => .24 - .15 * t, { flat: .45, seg: 14, rs: 8 }, 'lock' + s), { col: col('tube') }));
    switch (st) {
      case 'long': case 'bob': {
        const len = st === 'bob' ? .0 : 3.0;
        put(hs, mHair, G('curt|' + st, () => {
          const cols = 26, rows = 16, pos = [], uv = [], idx = [];
          for (let r = 0; r <= rows; r++) for (let q = 0; q <= cols; q++) {
            const u = q / cols * 2 - 1, s = r / rows; let x, y, z;
            if (st === 'bob') { const a = PI - u * 2.3, th = .6 + s * 1.55, rr2 = 1.1 + .1 * s; const v = skull(Math.sin(a) * Math.sin(th), Math.cos(th), Math.cos(a) * Math.sin(th)); x = v[0] * rr2; y = Math.max(v[1] * rr2, -.62 - .04 * Math.abs(Math.sin(u * 9))); z = v[2] * rr2; z = Math.min(z, Math.cos(a) * 2); x *= 1 + .08 * s; }
            else { const jag = .1 * Math.abs(Math.sin(u * 8)) * s, yy = .25 - s * (len + .35 - Math.abs(u) * .6) + jag, w = 1.05 + .32 * smooth(0, .5, s); x = u * w; y = yy; const zc = -(1.1 + .25 * smooth(0, .4, s)), bend = .75 - .4 * smooth(0, .45, s); z = zc + bend * u * u * (1.15); if (s < .25) { const a = PI - u * 1.95, sh = skull(Math.sin(a), Math.max(yy, -.3), Math.cos(a)); const k2 = 1.1; const bl = smooth(0, .25, s); x = sh[0] * k2 * (1 - bl) + x * bl; z = sh[2] * k2 * (1 - bl) + z * bl; } }
            pos.push(x, y, z); uv.push(q / cols, 1 - s);
          }
          for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) { const a = r * (cols + 1) + q, b = a + cols + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
        }), { col: split || (tip ? (x, y, z, u, v) => tmp.copy(hc).lerp(hc2, smooth(.45, .0, v)) : hc) });
        if (st === 'long') sideLocks();
        break;
      }
      case 'ponytail': case 'highpony': {
        const hi = st === 'highpony', pg = new THREE.Group(); pg.position.set(0, hi ? .95 : .45, hi ? -.5 : -.95); hs.add(pg);
        put(pg, mHair, T(hi ? [[0, 0, 0], [0, .22, -.38], [0, -.2, -.82], [0, -1.1, -.95], [0, -2.0, -.85]] : [[0, 0, 0], [0, -.15, -.32], [0, -.75, -.5], [0, -1.6, -.45], [0, -2.25, -.32]], t => (.3 + .1 * Math.sin(t * PI * 1.2)) * (1 - .78 * t), { seg: 18, rs: 10 }, st), { col: col('tube') });
        put(pg, ties, G('ptie', () => new THREE.TorusGeometry(.28, .09, 8, 16)), { r: [hi ? .5 : 1.2, 0, 0] });
        sway.push({ o: pg, ax: 'x', base: 0, amp: .08, f: 2.2, run: 2.6 }); sway.push({ o: pg, ax: 'z', base: 0, amp: .06, f: 1.6, run: 2 });
        break;
      }
      case 'twintails': {
        [-1, 1].forEach(s => {
          const tg = new THREE.Group(); tg.position.set(s * .82, .62, -.3); hs.add(tg);
          put(tg, mHair, T([[0, 0, 0], [s * .45, -.1, -.15], [s * .78, -.85, -.28], [s * .85, -2.1, -.22], [s * .78, -3.6, -.1], [s * .66, -4.9, 0]], t => (.3 + .12 * Math.sin(Math.min(1, t * 3) * PI * .5)) * (1 - .8 * t), { seg: 26, rs: 10 }, 'tt' + s), { col: col('tube') });
          put(tg, ties, G('ttie', () => sph(.2, 14, 10)), { p: [s * .05, .02, 0] });
          sway.push({ o: tg, ax: 'z', base: 0, amp: .05, f: 1.9 + s * .2, run: 2.4 }); sway.push({ o: tg, ax: 'x', base: 0, amp: .07, f: 2.4, run: 2.2 });
        });
        break;
      }
      case 'braids': {
        const br = t => (.19 - .07 * t) * (.74 + .26 * Math.abs(Math.sin(t * PI * 11)));
        [-1, 1].forEach(s => { put(hs, mHair, T([[s * .8, -.15, -.2], [s * 1.02, -.75, .12], [s * 1.14, -1.55, .66], [s * 1.13, -2.5, .98]], br, { seg: 44, rs: 8 }, 'br' + s), { col: col('tube') }); put(hs, ties, G('brt', () => cyl(.09, .1, .16, 10, false)), { p: [s * 1.13, -2.45, .97], r: [-.2, 0, 0] }); });
        break;
      }
      case 'bun': case 'spacebuns': {
        const pts = st === 'bun' ? [[0, .98, -.42]] : [[-.62, .8, -.12], [.62, .8, -.12]];
        pts.forEach(p => { put(hs, mHair, G('bun', () => bumpy(.42, .05, 9, 2)), { p, col: col('cap') }); put(hs, ties, G('btie', () => new THREE.TorusGeometry(.34, .06, 8, 16)), { p: [p[0] * .85, p[1] * .9, p[2] * .9], r: [PI / 2 - .5, 0, p[0] * -.6] }); });
        if (st === 'bun') sideLocks();
        break;
      }
      case 'puffs': [-1, 1].forEach(s => put(hs, mHair, G('puff', () => bumpy(.58, .07, 11, 3)), { p: [s * .78, .72, -.1], col: col('cap') })); break;
      case 'afro': put(hs, mHair, G('afro', () => bumpy(1.4, .045, 10, 5, 30, 22)), { p: [0, .3, -.12], s: [1, .94, 1], col: col('cap') }); break;
      case 'curly': for (let i = 0; i < 30; i++) { const a = (i * 2.399) % TAU, e = .25 + (i / 30) * .7, d = new THREE.Vector3(Math.sin(a) * Math.sqrt(1 - e * e), e, Math.cos(a) * Math.sqrt(1 - e * e)); if (d.y < hairElev(a, hl) + .08) continue; const v = skull(d.x, d.y, d.z); put(hs, mHair, G('curl', () => bumpy(.22, .1, 14, 4, 10, 8)), { p: [v[0] * 1.06, v[1] * 1.06, v[2] * 1.06], col: col('cap') }); } break;
      case 'spiky': {
        const dirs = [[0, 1, .1], [.45, .85, -.2], [-.45, .85, -.2], [0, .7, -.7], [.8, .45, -.35], [-.8, .45, -.35], [.35, .4, -.85], [-.35, .4, -.85], [0, .1, -1], [.65, .05, -.75], [-.65, .05, -.75], [.85, .6, .25], [-.85, .6, .25], [.3, .95, .35], [-.3, .95, .35]];
        dirs.forEach((d, i) => { const v = new THREE.Vector3(d[0], d[1], d[2]).normalize(), tipd = v.clone().add(new THREE.Vector3(0, -.25, -.35)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipd), h = .62 + (i % 3) * .12, sk = skull(v.x, v.y, v.z); put(hs, mHair, G('spk', () => new THREE.ConeGeometry(.3, 1, 8)), { q, p: [sk[0] * .95 + tipd.x * h * .45, sk[1] * .95 + tipd.y * h * .45, sk[2] * .95 + tipd.z * h * .45], s: [1, h, .8], col: col('tube') }); });
        if (!L.bangs || L.bangs === 'none') for (let i = -1; i <= 1; i++) { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(i * .3, -.85, .5).normalize()); put(hs, mHair, G('spk', () => new THREE.ConeGeometry(.3, 1, 8)), { q, p: [i * .32, .62, .98], s: [.8, .55, .6], col: col('tube') }); }
        break;
      }
      case 'mohawk': for (let i = 0; i < 8; i++) { const ph = .55 + i / 7 * 2.35, d = new THREE.Vector3(0, Math.sin(ph), Math.cos(ph)), tipd = d.clone().add(new THREE.Vector3(0, .25, -.2)).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipd), h = .6 + Math.sin(i / 7 * PI) * .45, sk = skull(d.x, d.y, d.z); put(hs, mHair, G('mhk', () => new THREE.ConeGeometry(.3, 1, 8)), { q, p: [sk[0] + tipd.x * h * .42, sk[1] + tipd.y * h * .42, sk[2] + tipd.z * h * .42], s: [.42, h, 1], col: col('tube') }); } break;
      case 'locs': for (let i = 0; i < 14; i++) { const a = PI * .28 + (i / 13) * PI * 1.44, sx = Math.sin(a), cz = Math.cos(a), root = skull(sx * .8, .55, cz * .8), sp = .2 + (i % 3) * .06; put(hs, mHair, T([[root[0], root[1], root[2]], [sx * 1.2, .2, cz * 1.15], [sx * 1.3, -.6, cz * 1.2 - .1], [sx * (1.3 + sp), -1.5 - (i % 2) * .25, cz * 1.15 - .15]], t => .12 - .035 * t, { seg: 12, rs: 6 }, 'loc' + i), { col: col('tube') }); } break;
      case 'quiff': put(hs, mHair, G('quiff', () => bumpy(1, .04, 8, 1, 18, 12)), { p: [0, .76, .3], r: [-.55, 0, 0], s: [.72, .45, .6], col: col('cap') }); break;
      case 'undercut': put(hs, mHair, G('uctop', () => bumpy(1, .03, 7, 2, 20, 14)), { p: [.05, .72, .05], r: [-.35, 0, -.15], s: [.92, .48, 1.0], col: col('cap') }); break;
      case 'slick': put(hs, mHair, G('slick', () => sph(1, 20, 14)), { p: [0, .62, .05], r: [-.25, 0, 0], s: [.95, .42, 1.0], col: col('cap') }); break;
      case 'short': [[-.3, .82, .38, .3], [.15, .9, .3, -.2], [.42, .7, .45, -.5]].forEach((p, i) => put(hs, mHair, G('chunk', () => sph(1, 12, 10)), { p: [p[0], p[1], p[2]], r: [-.6, 0, p[3]], s: [.42, .22, .4], col: col('cap') })); break;
    }
  }
  function buildHat(L, hs, put, m) {
    const c = L.c, h = L.hat, mHat = m.mHat;
    if (!h || h === 'none') { if (L.extras.includes('shades') || L.extras.includes('glasses')) glasses(); if (L.extras.includes('goggles') && h !== 'beanie') goggles(.6, 1.06); return; }
    const hatTex = kind => TM(canvasTex(`hat|${kind}|${c.hat}|${c.trim}`, 128, 64, x => paintHatTex(x, kind, c.hat, c.trim)), kind === 'helmet' ? .3 : .8, kind === 'helmet' ? .25 : 0);
    // baseball-cap brim: a half ellipse sticking out over the brow, curved down at the sides
    const capBrim = () => G('capbrim', () => { const g = cyl(1, 1, .07, 26, false, -PI / 2, PI, 1), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i) * .82, z = P.getZ(i) * .78; P.setX(i, x); P.setZ(i, z); P.setY(i, P.getY(i) - .2 * x * x); } g.computeVertexNormals(); return g; });
    switch (h) {
      case 'cap': case 'backcap': {
        const g = new THREE.Group(); g.rotation.y = h === 'backcap' ? PI : 0; hs.add(g);
        put(g, hatTex('cap'), G('capdome', () => { const s = shell(1.08, -PI, PI, 0, PI * .48, 28, 10), P = s.attributes.position; for (let i = 0; i < P.count; i++) { const v = skull(P.getX(i) / 1.08, P.getY(i) / 1.08, P.getZ(i) / 1.08); P.setXYZ(i, v[0] * 1.08, v[1] * 1.03, v[2] * 1.08); } s.computeVertexNormals(); return s; }), { p: [0, .12, -.02], r: [-.22, 0, 0] });
        put(g, mHat, G('capbtn', () => sph(.1, 10, 8)), { p: [0, 1.16, -.22] });
        put(g, mHat, capBrim(), { p: [0, .34, .7], r: [.1, 0, 0] });
        break;
      }
      case 'visor': put(hs, mHat, G('visband', () => cyl(1.07, 1.07, .25, 28, true)), { p: [0, .4, 0], r: [-.15, 0, 0] }); put(hs, mHat, capBrim(), { p: [0, .34, .72], r: [.14, 0, 0] }); break;
      case 'beanie': {
        const g = new THREE.Group(); g.rotation.x = -.3; g.position.y = .05; hs.add(g); const kt = hatTex('knit');
        put(g, kt, G('bdome', () => shell(1.13, -PI, PI, 0, PI * .5, 28, 12)), { s: [1, 1.1, 1.05] });
        put(g, kt, G('bcuff', () => cyl(1.16, 1.17, .32, 28, true)), { p: [0, -.02, 0], s: [1, 1, 1.05] });
        put(g, M(c.trim, .9, 0), G('pom', () => bumpy(.3, .12, 12, 6)), { p: [0, 1.32, 0] });
        if (L.extras.includes('goggles')) goggles(.62, 1.22, g);
        break;
      }
      case 'cowboy': {
        const g = new THREE.Group(); g.position.y = .42; g.rotation.x = -.14; hs.add(g);
        put(g, mHat, G('cbcrown', () => lathe([[1.0, 0], [.99, .4], [.95, .78], [.78, 1.02], [.4, 1.06], [.02, .92]], .9, 28)), {});
        put(g, M(c.trim, .6, .1), G('cbband', () => cyl(1.01, 1.0, .2, 28, true)), { p: [0, .12, 0], s: [1, 1, .9] });
        put(g, M(c.hat, .75, .05, { ds: true }), G('cbbrim', () => { const r = new THREE.RingGeometry(.7, 2.35, 40, 6); r.rotateX(-PI / 2); const P = r.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i), ax = Math.max(0, (Math.abs(x) - 1.05) / 1.3), az = Math.max(0, (Math.abs(z) - 1.0) / 1.35); P.setY(i, .62 * ax * ax - .16 * az * az * (z > 0 ? 1.2 : .7)); } r.computeVertexNormals(); return r; }), { s: [1, 1, .92] });
        break;
      }
      case 'helmet': {
        put(hs, hatTex('helmet'), G('helm', () => new THREE.SphereGeometry(1.24, 30, 22, -PI / 2)), { p: [0, .05, 0], s: [1, 1, 1.04] });
        put(hs, TM(canvasTex('visor', 128, 64, x => { const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, '#3a4d74'); g.addColorStop(.5, '#121a2c'); g.addColorStop(1, '#070a12'); x.fillStyle = g; x.fillRect(0, 0, 128, 64); x.fillStyle = 'rgba(190,225,255,.55)'; x.beginPath(); x.moveTo(22, 0); x.lineTo(44, 0); x.lineTo(24, 64); x.lineTo(10, 64); x.fill(); x.fillStyle = 'rgba(190,225,255,.25)'; x.beginPath(); x.moveTo(52, 0); x.lineTo(58, 0); x.lineTo(40, 64); x.lineTo(35, 64); x.fill(); }), .1, .35), G('helmv', () => shell(1.27, -1.05, 1.05, 1.25, 2.0, 22, 8)), { p: [0, .05, .01], s: [1, 1, 1.04] });
        put(hs, M(SH(c.hat, -.3), .5, .2), G('helmr', () => new THREE.TorusGeometry(1.0, .08, 8, 24)), { p: [0, -.92, -.05], r: [PI / 2 + .25, 0, 0], s: [.95, 1, 1] });
        break;
      }
      case 'hood': {
        put(hs, M(c.hat, .85, 0, { ds: true }), G('hoodup', () => { const g = shell(1.24, .95, TAU - .95, 0, PI * .82, 30, 16), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const v = skull(P.getX(i) / 1.24, P.getY(i) / 1.24, P.getZ(i) / 1.24); P.setXYZ(i, v[0] * 1.24, v[1] * 1.24 + (v[2] < 0 ? -v[2] * .1 : 0), v[2] * 1.24 * 1.06); } g.computeVertexNormals(); return g; }), { p: [0, .06, -.02] });
        put(hs, M(c.hat, .85, 0), G('hoodbk', () => sph(1, 16, 12)), { p: [0, -1.05, -.78], s: [1.1, .55, .7] });
        break;
      }
      case 'santa': {
        put(hs, M('#f8fafc', .95, 0), G('strim', () => new THREE.TorusGeometry(1.05, .17, 10, 30)), { p: [0, .42, -.02], r: [PI / 2 - .2, 0, 0] });
        put(hs, M('#dc2626', .8, 0), G('scone', () => tube([[0, .4, 0], [0, 1.05, -.12], [.25, 1.55, -.48], [.72, 1.55, -.9], [1.0, 1.15, -1.15]], t => 1.02 * (1 - t) + .08, { seg: 18, rs: 16 })), {});
        put(hs, M('#f8fafc', .95, 0), G('spom', () => bumpy(.3, .12, 12, 4)), { p: [1.02, 1.08, -1.18] });
        break;
      }
      case 'crown': case 'tiara': {
        const gold = M('#f6c445', .25, .8), tiara = h === 'tiara';
        if (tiara) { put(hs, gold, G('tband', () => new THREE.TorusGeometry(1.06, .05, 6, 30, PI * 1.1)), { p: [0, .55, .02], r: [PI / 2 - .45, 0, -PI * .05 - PI * .5 + PI], s: 1 }); put(hs, M('#ec4899', .15, .3), G('tgem', () => new THREE.OctahedronGeometry(.14)), { p: [0, .92, .78] }); for (let k = -2; k <= 2; k++) put(hs, gold, G('tspk', () => new THREE.ConeGeometry(.05, .26, 6)), { p: [Math.sin(k * .32) * .9, .86 + (2 - Math.abs(k)) * .03, Math.cos(k * .32) * .84], r: [.4, 0, -k * .2] }); }
        else { put(hs, gold, G('crownb', () => cyl(.95, .9, .42, 24, true)), { p: [0, .88, 0] }); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; put(hs, gold, G('crsp', () => new THREE.ConeGeometry(.13, .42, 8)), { p: [Math.sin(a) * .9, 1.28, Math.cos(a) * .9] }); put(hs, M(k % 2 ? '#dc2626' : '#2563eb', .15, .3), G('crgem', () => sph(.09, 10, 8)), { p: [Math.sin(a) * .96, .88, Math.cos(a) * .96] }); } }
        break;
      }
      case 'cowl': {
        put(hs, mHat, G('cowl', () => { const g = new THREE.SphereGeometry(1.045, 32, 22, -PI / 2, TAU, 0, PI * .6), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const v = skull(P.getX(i) / 1.045, P.getY(i) / 1.045, P.getZ(i) / 1.045); P.setXYZ(i, v[0] * 1.045, v[1] * 1.045, v[2] * 1.045); } g.computeVertexNormals(); return seamFix(g); }), { r: [-.12, 0, 0] });
        [-1, 1].forEach(s => put(hs, mHat, G('cear', () => new THREE.ConeGeometry(.3, .7, 4)), { p: [s * .55, .98, -.05], r: [0, PI / 4, s * -.38], s: [1, 1, .55] }));
        break;
      }
      case 'horns': {
        const h1 = lin(c.hat || '#efe6d2'), h2 = lin(c.hat2 || '#7f1d1d'), tc = new THREE.Color();
        [-1, 1].forEach(s => put(hs, M(null, .4, .1, { vc: true }), G('horn' + s, () => tube([[s * .5, .62, .42], [s * .95, 1.05, .3], [s * 1.28, 1.62, -.05], [s * 1.2, 2.22, -.55]], t => .26 * (1 - t) + .015, { seg: 20, rs: 12 })), { col: (x, y, z, u, v) => tc.copy(h1).lerp(h2, smooth(.35, 1, v)) }));
        break;
      }
      case 'ninja': {
        put(hs, mHat, G('ninjah', () => { const g = new THREE.SphereGeometry(1.06, 30, 20, -PI / 2, TAU, 0, PI * .6), P = g.attributes.position; for (let i = 0; i < P.count; i++) { const v = skull(P.getX(i) / 1.06, P.getY(i) / 1.06, P.getZ(i) / 1.06); P.setXYZ(i, v[0] * 1.06, v[1] * 1.06, v[2] * 1.06); } g.computeVertexNormals(); return seamFix(g); }), { r: [-.3, 0, 0] });
        put(hs, m.mTrim, G('nband', () => new THREE.TorusGeometry(1.08, .11, 8, 30)), { p: [0, .45, -.05], r: [PI / 2 - .35, 0, 0] });
        [-1, 1].forEach(s => put(hs, M(c.trim, .8, 0, { ds: true }), G('nbt' + s, () => tube([[s * .1, .2, -1.08], [s * .3, -.1, -1.4], [s * .55, -.6, -1.6]], [.12, .09], { flat: .3, seg: 8, rs: 6 })), {}));
        break;
      }
      case 'headband': put(hs, m.mTrim, G('hband', () => new THREE.TorusGeometry(1.06, .1, 8, 30)), { p: [0, .38, -.05], r: [PI / 2 - .3, 0, 0] }); [-1, 1].forEach(s => put(hs, M(c.trim, .8, 0, { ds: true }), G('hbt' + s, () => tube([[s * .08, .05, -1.05], [s * .25, -.25, -1.35], [s * .4, -.75, -1.45]], [.1, .08], { flat: .3, seg: 8, rs: 6 })), {})); break;
      case 'beret': put(hs, mHat, G('beret', () => sph(1, 22, 14)), { p: [.12, .78, -.05], r: [0, 0, -.22], s: [1.22, .38, 1.16] }); put(hs, mHat, G('beretn', () => cyl(.06, .08, .14, 8, false)), { p: [.08, 1.15, -.05] }); break;
      case 'goggles': goggles(.58, 1.08); break;
      case 'starclips': [[-.78, .7, .35, -.4], [.8, .72, .32, .4], [.62, .98, .25, .3]].forEach(p => put(hs, M(c.trim, .35, .3, { glow: L.glowTrim ? c.trim : null, ei: .4 }), G('starclip', () => starGeo(.22, .1, .1)), { p: [p[0], p[1], p[2]], r: [0, p[3], p[3] * .5] })); break;
    }
    if (L.extras.includes('shades') || L.extras.includes('glasses')) glasses();
    if (L.extras.includes('goggles') && h !== 'beanie' && h !== 'goggles') goggles(.66, 1.12);
    function glasses() {
      const shades = L.extras.includes('shades'), lm = shades ? M('#111318', .12, .7) : M('#cfe6ff', .1, .5), fm = shades ? M(c.metal || '#facc15', .3, .7) : M('#1f2937', .5, .2);
      [-1, 1].forEach(s => { put(hs, lm, G('lens', () => cyl(.25, .25, .05, 20, false)), { p: [s * .36, -.08, 1.0], r: [PI / 2, 0, 0], s: [1.15, 1, .85] }); put(hs, fm, G('larm', () => rbox(.05, .05, .95, 4)), { p: [s * .76, -.04, .5], r: [0, s * .25, 0] }); });
      put(hs, fm, G('lbr', () => rbox(.18, .05, .05, 4)), { p: [0, -.04, 1.01] });
    }
    function goggles(y, r, grp) {
      const tg = grp || hs;
      put(tg, M('#1f2937', .7, .1), G('gstrap' + r, () => new THREE.TorusGeometry(r, .07, 6, 30)), { p: [0, y - .1, -.02], r: [PI / 2 - .25, 0, 0] });
      [-1, 1].forEach(s => { put(tg, M(c.trim, .5, .3), G('gcup', () => cyl(.26, .28, .22, 18, false)), { p: [s * .34, y + .06, r * .9], r: [PI / 2 - .55, 0, 0] }); put(tg, M('#7dd3fc', .05, .6), G('glens', () => cyl(.21, .21, .05, 18, false)), { p: [s * .34, y + .13, r * .9 + .1], r: [PI / 2 - .55, 0, 0] }); });
    }
  }
  function buildTail(L, hips, put, B, sway) {
    const c = L.c, k = L.tail, tg = new THREE.Group(); tg.position.set(0, -.06, -(B.pel * B.pelZ) + .02); hips.add(tg);
    if (k === 'lizard') { const t1 = lin(c.skin), t2 = lin(c.trim), tc = new THREE.Color(); put(tg, M(null, .7, 0, { vc: true }), G('ltail', () => tube([[0, 0, 0], [0, -.16, -.16], [.02, -.5, -.42], [.1, -.8, -.78], [.22, -.92, -1.12]], t => .1 * (1 - t) + .012, { seg: 26, rs: 12 })), { col: (x, y, z, u, v) => tc.copy(t1).lerp(t2, (Math.sin(v * 26) > .55 && v > .3) ? .6 : 0) }); }
    else if (k === 'fox') { const t1 = lin(c.skin), t2 = lin(c.fur2 || '#fff'), tc = new THREE.Color(); put(tg, M(null, .9, 0, { vc: true }), G('ftail', () => tube([[0, 0, 0], [0, -.12, -.16], [0, -.3, -.42], [0, -.28, -.7], [0, -.1, -.9]], t => .045 + .13 * Math.pow(Math.sin(Math.min(1, t * 1.15) * PI), .7), { seg: 22, rs: 12 })), { col: (x, y, z, u, v) => tc.copy(t1).lerp(t2, smooth(.72, .86, v)) }); }
    else if (k === 'stub') put(tg, M(c.skin, .9, 0), G('stub', () => sph(.06, 12, 10)), { p: [0, .02, -.02] });
    sway.push({ o: tg, ax: 'y', base: 0, amp: k === 'stub' ? .3 : .22, f: 2.4, run: 2 }); sway.push({ o: tg, ax: 'x', base: 0, amp: .06, f: 1.7, run: 2.5 });
  }

  // ---------------------------------------------------------------- pickaxe (unchanged look)
  function buildPickaxeMesh(pickData) {
    // stylised pickaxe (about 1.1 m): tapered handle with a wrapped grip + pommel, a metal collar with a gem, and two
    // swept-back spikes in the pickaxe's colour with accent-coloured tips
    // parts are merged into one mesh per material (5 draw calls), so 50 bots carrying one stays cheap
    const group = new THREE.Group(), A = new Acc(), add = (geo, mat, x, y, z, rz, rx) => { A.put(group, mat, geo, { p: [x || 0, y || 0, z || 0], r: [rx || 0, 0, rz || 0] }); return { rotation: {} }; };
    const shaftMat = M('#5b4636', 0.55, 0.12), gripMat = M('#1f2937', 0.85, 0.05), headMat = M(pickData.color || '#38bdf8', 0.3, 0.7), edgeMat = M(pickData.accent || '#fbbf24', 0.25, 0.85), gemMat = M(pickData.accent || '#fbbf24', 0.12, 0.95);
    add(new THREE.CylinderGeometry(0.028, 0.036, 1.12, 12), shaftMat);                       // handle (y -0.56 … 0.56)
    add(new THREE.CylinderGeometry(0.041, 0.041, 0.32, 12), gripMat, 0, -0.38);                // grip wrap
    for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(0.042, 0.007, 6, 16), edgeMat, 0, -0.51 + i * 0.085, 0, 0, Math.PI / 2);   // grip rings
    add(new THREE.SphereGeometry(0.05, 12, 10), edgeMat, 0, -0.58);                           // pommel
    add(new THREE.BoxGeometry(0.15, 0.17, 0.1), edgeMat, 0, 0.5);                              // collar
    add(new THREE.CylinderGeometry(0.055, 0.045, 0.06, 12), edgeMat, 0, 0.6);                  // cap
    add(new THREE.OctahedronGeometry(0.045), gemMat, 0, 0.5, 0.06);                            // gem (front)
    add(new THREE.OctahedronGeometry(0.045), gemMat, 0, 0.5, -0.06);                           // gem (back)
    [-1, 1].forEach(s => {
      add(new THREE.BoxGeometry(0.2, 0.095, 0.075), headMat, s * 0.165, 0.51, 0, -s * 0.12);     // spike root
      add(new THREE.ConeGeometry(0.052, 0.3, 10), headMat, s * 0.385, 0.455, 0, -s * (Math.PI / 2 + 0.38));   // spike, swept down
      add(new THREE.ConeGeometry(0.028, 0.1, 8), edgeMat, s * 0.53, 0.398, 0, -s * (Math.PI / 2 + 0.38));     // bright tip
    });
    A.flush(true);
    return group;
  }

  // ---------------------------------------------------------------- back bling: shape picked from its name
  function buildBackBlingMesh(b) {
    const g = new THREE.Group(), A = new Acc(), n = (b.name || '').toLowerCase(), main = M(b.color || '#1e293b', .6, .1), acc = M(b.accent || '#fbbf24', .35, .5), dark = M('#1f2937', .6, .1), put = (m, geo, tr) => A.put(g, m, geo, tr);
    if (/cape|cloak|veil/.test(n)) { put(main, G('blcape', () => { const c = cyl(.24, .4, .8, 18, true, PI - 1, 2); c.translate(0, -.3, .2); return c; }), {}); put(acc, G('blclasp', () => sph(.05, 10, 8)), { p: [0, .12, .02] }); }
    else if (/wing/.test(n)) [-1, 1].forEach(s => put(main, G('blwing', () => sph(1, 16, 12)), { p: [s * .26, .02, 0], r: [0, 0, s * .5], s: [.3, .14, .03] }));
    else if (/guitar|amp|boombox|speaker|stack|mic/.test(n)) { put(main, G('blbox', () => rbox(.5, .34, .18, 4)), {}); [-1, 1].forEach(s => { put(dark, G('blspk', () => cyl(.09, .09, .03, 20, false)), { p: [s * .14, 0, .09], r: [PI / 2, 0, 0] }); put(acc, G('blspk2', () => cyl(.04, .04, .035, 16, false)), { p: [s * .14, 0, .1], r: [PI / 2, 0, 0] }); }); put(acc, G('blhnd', () => new THREE.TorusGeometry(.12, .02, 6, 16, PI)), { p: [0, .17, 0] }); }
    else if (/board|deck/.test(n)) { put(main, G('blbrd', () => rbox(.26, .9, .04, 2.5)), { r: [0, 0, .25] }); put(acc, G('blbrd2', () => rbox(.2, .5, .045, 3)), { r: [0, 0, .25] }); }
    else if (/jar|chamber|tank|o2|battery|core|capacitor/.test(n)) { put(main, G('bltank', () => capsule(.12, .12, .34)), { p: [0, .17, 0] }); put(M(b.accent || '#22d3ee', .2, 0, { glow: b.accent || '#22d3ee', ei: .7 }), G('blwin', () => cyl(.124, .124, .14, 18, true)), { p: [0, 0, 0] }); put(dark, G('blcap', () => cyl(.08, .1, .05, 14, false)), { p: [0, .32, 0] }); }
    else if (/quiver/.test(n)) { put(main, G('blq', () => cyl(.09, .07, .6, 14, false)), { r: [0, 0, .3] }); for (let k = 0; k < 4; k++) put(acc, G('blarr', () => new THREE.ConeGeometry(.03, .1, 4)), { p: [-.1 + k * .03 - .05, .33 + k * .01, (k % 2) * .03], r: [0, 0, .3] }); }
    else if (/banner|flag/.test(n)) {   // pole up from one shoulder, leaning out, so the flag flies beside the head (never behind it)
      const lean = -.2, top = [.16 + Math.sin(-lean) * .62, .26 + Math.cos(lean) * .62], fc = b.color && LUM(b.color) > .12 ? b.color : '#9b1c1c';
      put(dark, G('blpole2', () => cyl(.017, .017, 1.24, 8, false)), { p: [.16, .26, -.02], r: [0, 0, lean] });
      put(acc, G('blpoletip', () => new THREE.ConeGeometry(.035, .1, 8)), { p: [top[0] + .01, top[1] + .06, -.02], r: [0, 0, lean] });
      put(M(fc, .7, 0, { ds: true }), G('blflag2', () => new THREE.PlaneGeometry(.32, .46)), { p: [top[0] + .17, top[1] - .25, -.02], r: [0, 0, lean * .5] });
      put(acc, G('blflagtrim', () => new THREE.BoxGeometry(.34, .03, .012)), { p: [top[0] + .17, top[1] - .02, -.02], r: [0, 0, lean * .5] });
      put(acc, G('blflagm2', () => starGeo(.07, .03, .02)), { p: [top[0] + .18, top[1] - .25, -.03], r: [0, 0, lean * .5] });
      put(dark, G('blstrap1', () => rbox(.05, .5, .03, 4)), { p: [.02, .0, -.02], r: [0, 0, .55] });   // sling across the back that holds the pole
    }
    else if (/shield|crest|trophy|emblem|title/.test(n)) { put(main, G('blsh', () => cyl(.26, .26, .06, 6, false)), { r: [PI / 2, 0, 0], s: [1, 1.15, 1] }); put(acc, G('blsh2', () => starGeo(.12, .05, .07)), { p: [0, 0, .04] }); }
    else if (/plush|toy|monkey|kev|octo|munchkin|ham|llama|bone/.test(n)) { put(main, G('blpl', () => bumpy(.17, .04, 9, 1)), {}); put(main, G('blplh', () => sph(.13, 14, 10)), { p: [0, .24, .02] }); [-1, 1].forEach(s => { put(acc, G('blple', () => sph(.05, 10, 8)), { p: [s * .1, .34, 0] }); put(dark, G('blpleye', () => sph(.022, 8, 6)), { p: [s * .05, .26, .13] }); }); }
    else if (/lantern|lamp|charm/.test(n)) { put(dark, G('bllt', () => cyl(.11, .13, .05, 12, false)), { p: [0, .2, 0] }); put(M(b.accent || '#fbbf24', .3, 0, { glow: b.accent || '#fbbf24', ei: .9 }), G('bllg', () => cyl(.1, .1, .3, 12, false)), { p: [0, .02, 0] }); put(dark, G('bllb', () => cyl(.13, .11, .05, 12, false)), { p: [0, -.15, 0] }); }
    else if (/dagger|blade|kama|sai|cleaver/.test(n)) [-1, 1].forEach(s => { put(M('#e5e7eb', .2, .8), G('bldag', () => new THREE.ConeGeometry(.05, .55, 4)), { p: [s * .08, .05, 0], r: [0, 0, s * .45], s: [1, 1, .3] }); put(acc, G('bldagh', () => cyl(.025, .025, .18, 8, false)), { p: [-s * .07, -.28, 0], r: [0, 0, s * .45] }); });
    else { // backpack / satchel / bag (default): the outside (−z, what you see in third person) gets the flap, badge, pocket and zips
      const lite = M(SH(b.color || '#1e293b', .15), .6, .1), deep = M(SH(b.color || '#1e293b', -.22), .6, .1);
      put(main, G('blpack', () => rbox(.42, .5, .2, 3.4)), {});
      put(lite, G('blflap2', () => rbox(.4, .19, .06, 3.4)), { p: [0, .165, -.09] });                          // top flap
      put(acc, G('blbuck', () => rbox(.05, .07, .02, 2)), { p: [0, .08, -.125] });                              // flap buckle
      put(acc, G('blcrest2', () => cyl(.075, .075, .025, 18, false)), { p: [0, -.02, -.112], r: [PI / 2, 0, 0] });   // badge
      put(main, G('blcrest3', () => starGeo(.045, .02, .016)), { p: [0, -.02, -.127] });
      put(deep, G('blpock2', () => rbox(.28, .14, .06, 3.4)), { p: [0, -.165, -.1] });                          // front pocket
      put(acc, G('blzip', () => new THREE.BoxGeometry(.24, .012, .012)), { p: [0, -.112, -.132] });              // pocket zip
      [-1, 1].forEach(s => {
        put(deep, G('blside', () => rbox(.065, .22, .13, 3)), { p: [s * .235, -.07, 0] });                        // side pockets
        put(dark, G('blstrap2', () => rbox(.055, .17, .03, 4)), { p: [s * .125, .27, .06], r: [-.55, 0, 0] });   // shoulder straps rising over the shoulders
      });
      put(acc, G('blhandle', () => new THREE.TorusGeometry(.065, .014, 6, 14, PI)), { p: [0, .255, -.01] });     // carry handle
    }
    A.flush(true);
    return g;
  }

  // ---------------------------------------------------------------- animation
  function applyHeroStance(heroGroup, time, mode = 'idle') {
    const j = heroGroup && heroGroup.userData && heroGroup.userData.joints; if (!j) return;
    const ud = heroGroup.userData;
    j.hips.rotation.set(0, 0, 0); j.torso.rotation.set(0, 0, 0); j.head.rotation.set(0, 0, 0);
    [j.leftArm, j.rightArm].forEach(a => { a.shoulder.rotation.set(0, 0, 0); a.elbow.rotation.set(0, 0, 0); });
    [j.leftLeg, j.rightLeg].forEach(l => { l.hipJoint.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); });
    const breath = Math.sin(time * 2.4);
    if (mode === 'run') {
      const stride = Math.sin(time * 9.5);
      j.hips.position.y = 1.02 + Math.abs(Math.cos(time * 9.5)) * 0.06; j.hips.rotation.y = -stride * .08;
      j.torso.rotation.x = 0.14; j.torso.rotation.y = stride * 0.16;
      j.leftLeg.hipJoint.rotation.x = stride * 0.72; j.rightLeg.hipJoint.rotation.x = -stride * 0.72;
      j.leftLeg.knee.rotation.x = Math.max(0, -stride * 0.95) + .1; j.rightLeg.knee.rotation.x = Math.max(0, stride * 0.95) + .1;
      j.leftArm.shoulder.rotation.x = -stride * 0.65; j.rightArm.shoulder.rotation.x = stride * 0.65;
      j.leftArm.shoulder.rotation.z = -.12; j.rightArm.shoulder.rotation.z = .12;
      j.leftArm.elbow.rotation.x = -0.7; j.rightArm.elbow.rotation.x = -0.7;
      j.head.rotation.x = -.1;
    } else if (mode === 'emote') {
      const beat = Math.sin(time * 6.0), b2 = Math.sin(time * 3.0);
      j.hips.position.y = 1.02 + Math.abs(beat) * 0.08 - .03; j.hips.rotation.y = beat * 0.25;
      j.torso.rotation.z = beat * 0.14; j.head.rotation.z = -beat * .12; j.head.rotation.y = b2 * .2;
      j.leftArm.shoulder.rotation.z = -1.2 + beat * 0.4; j.rightArm.shoulder.rotation.z = 1.2 - beat * 0.4;
      j.leftArm.shoulder.rotation.x = -.3 * b2; j.rightArm.shoulder.rotation.x = .3 * b2;
      j.leftArm.elbow.rotation.x = -0.9; j.rightArm.elbow.rotation.x = -0.9;
      j.leftLeg.hipJoint.rotation.z = -0.14; j.rightLeg.hipJoint.rotation.z = 0.14;
      j.leftLeg.knee.rotation.x = .15 + Math.max(0, beat) * .3; j.rightLeg.knee.rotation.x = .15 + Math.max(0, -beat) * .3;
      j.leftLeg.hipJoint.rotation.x = -Math.max(0, beat) * .25; j.rightLeg.hipJoint.rotation.x = -Math.max(0, -beat) * .25;
    } else {
      j.hips.position.y = 1.02 + breath * 0.01; j.hips.rotation.y = 0.08; j.hips.rotation.z = .025;
      j.torso.rotation.x = 0.03 - breath * .01; j.torso.rotation.y = -0.07; j.torso.rotation.z = -.02;
      j.head.rotation.y = 0.05 + Math.sin(time * 1.1) * 0.06; j.head.rotation.x = Math.sin(time * .7) * .02; j.head.rotation.z = .02;
      j.leftArm.shoulder.rotation.z = -0.2 - breath * 0.02; j.leftArm.shoulder.rotation.x = 0.1; j.leftArm.elbow.rotation.x = -0.32;
      j.rightArm.shoulder.rotation.z = 0.22 + breath * 0.02; j.rightArm.shoulder.rotation.x = -0.14; j.rightArm.elbow.rotation.x = -0.42;
      j.leftLeg.hipJoint.rotation.z = -0.075; j.leftLeg.hipJoint.rotation.x = -0.05; j.leftLeg.knee.rotation.x = 0.07;
      j.rightLeg.hipJoint.rotation.z = 0.085; j.rightLeg.hipJoint.rotation.x = 0.07; j.rightLeg.knee.rotation.x = 0.1;
    }
    // hide the carried pickaxe while emoting (restored afterwards unless a gun is in hand)
    const pk = ud.pk;
    if (pk) {
      if (mode === 'emote') { if (pk.visible) { pk.visible = false; ud.pkEmoteHid = true; } }
      else if (ud.pkEmoteHid) { ud.pkEmoteHid = false; if (!j.rightArm.glove.children.some(ch => ch.userData && ch.userData.gun && ch.visible)) pk.visible = true; }
    }
    // secondary motion: hair, tails, capes, scarves
    const sw = ud.sway;
    if (sw) { const k = mode === 'run' ? 1 : mode === 'emote' ? 1.5 : .45; for (let i = 0; i < sw.length; i++) { const s = sw[i]; s.o.rotation[s.ax] = s.base + Math.sin(time * s.f * (mode === 'run' ? s.run : 1) + i) * s.amp * k + (mode === 'run' && s.ax === 'x' ? -s.amp * 1.5 : 0); } }
  }

  // ---------------------------------------------------------------- Canvas2D fallback (no WebGL)
  function drawCanvas2DFallback(ctx, w, h, outfit, time) {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5, cy = h * 0.54, [skin, hair, top, pants, accent] = outfit.palette, bob = Math.sin(time * 2.5) * 4;
    const padGrad = ctx.createRadialGradient(cx, cy + 165, 10, cx, cy + 165, 130);
    padGrad.addColorStop(0, 'rgba(56, 189, 248, 0.95)'); padGrad.addColorStop(0.6, 'rgba(37, 99, 235, 0.45)'); padGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');
    ctx.fillStyle = padGrad; ctx.beginPath(); ctx.ellipse(cx, cy + 165, 130, 36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pants; ctx.fillRect(cx - 32, cy + 45 + bob, 24, 110); ctx.fillRect(cx + 8, cy + 45 + bob, 24, 110);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(cx - 34, cy + 135 + bob, 28, 25); ctx.fillRect(cx + 6, cy + 135 + bob, 28, 25);
    ctx.fillStyle = top; ctx.beginPath(); ctx.roundRect(cx - 42, cy - 55 + bob, 84, 104, 14); ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(cx - 26, cy - 45 + bob, 52, 65);
    ctx.fillStyle = skin; ctx.beginPath(); ctx.roundRect(cx - 62, cy - 48 + bob, 18, 88, 9); ctx.roundRect(cx + 44, cy - 48 + bob, 18, 88, 9); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(cx, cy - 92 + bob, 32, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(cx, cy - 98 + bob, 33, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx - 11, cy - 90 + bob, 5, 0, Math.PI * 2); ctx.arc(cx + 11, cy - 90 + bob, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(cx - 11, cy - 90 + bob, 2.5, 0, Math.PI * 2); ctx.arc(cx + 11, cy - 90 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  const R = { buildHero, buildPickaxeMesh, buildBackBlingMesh, applyHeroStance, drawCanvas2DFallback, lowQ: false };
  return R;
})();
