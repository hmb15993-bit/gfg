// ===== GASNITE ARMORY: hand-built weapon models + rendered item icons =====
// Every gun is assembled from bevelled side profiles (the edges catch the light), round barrels, magazines, sights,
// scopes and stocks, then merged into one mesh per material (~6 draw calls a gun) and painted in its rarity colour.
// Icons are real renders of the same models (and of heals, ammo and your pickaxe), made in a small offscreen WebGL
// context and cached as blob URLs, so the hotbar, inventory and pickup prompt show exactly what you hold.
// Model space: +z = muzzle, +y = up, −x = the gun's right side (the side the over-the-shoulder camera sees);
// the origin is the middle of the trigger hand's fist. Recipes are written in centimetres.
window.GasGuns = (() => {
  const PI = Math.PI, CM = .01;
  const RAR = ['#aeb6c1', '#43c45e', '#3f8efc', '#b25cf6', '#f7b512'];
  const lin = h => new THREE.Color(h).convertSRGBToLinear();

  // ---------------------------------------------------------------- materials (shared by every gun)
  const MC = new Map();
  // surface texture per material (js/textures.js): wood grain on stocks, brushed steel, a fine stipple on polymer and paint
  const GTEX = { wood: ['grain', .35], woodD: ['grain', .35], gun: ['brushed', 1.2], steel: ['brushed', 1.2], brass: ['brushed', 1.5], body: ['noise', 1.6], dark: ['noise', 1.6], olive: ['noise', 1.6], tan: ['noise', 1.6], white: ['noise', 1.4], red: ['noise', 1.4], lime: ['noise', 1.4], p: ['noise', 1.6] };
  function mat(key, hex, rough, metal, glow, ei) {
    let m = MC.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: lin(hex), roughness: rough, metalness: metal }); if (glow) { m.emissive = lin(glow); m.emissiveIntensity = ei || 1; }
      const tx = GTEX[key] || GTEX[key.replace(/\d+$/, '')] || (/^a_/.test(key) ? ['noise', 1.4] : null); if (tx && window.GasTex) GasTex.apply(m, tx[0], tx[1]);
      MC.set(key, m);
    }
    return m;
  }
  const SLOT = {
    body: () => mat('body', '#3a414b', .5, .3),       // polymer / painted metal
    dark: () => mat('dark', '#1e2228', .62, .2),      // grips, rails, mags, sights
    black: () => mat('black', '#08090b', .9, 0),      // bores, ports, slots
    gun: () => mat('gun', '#5f6a77', .36, .55),       // gunmetal
    steel: () => mat('steel', '#aab3be', .28, .7),    // barrels, bolts, pins
    wood: () => mat('wood', '#a86a3a', .58, 0),
    woodD: () => mat('woodD', '#6c4024', .66, 0),
    brass: () => mat('brass', '#e3ab45', .3, .7),
    olive: () => mat('olive', '#59673b', .64, .08),
    red: () => mat('red', '#d93434', .45, .08),
    white: () => mat('white', '#f1f4f8', .42, 0),
    lime: () => mat('lime', '#a6e23a', .45, .05),
    string: () => mat('string', '#ece6d4', .8, 0),
    glass: () => mat('glass', '#86d8ff', .08, .1, '#28b8ff', .85),
    shieldG: () => mat('shieldG', '#4cc3ff', .14, .1, '#0b8fe0', .9),
    slurpG: () => mat('slurpG', '#38e0c5', .18, .05, '#0f9e8a', .8),
    a_light: () => mat('a_light', '#8aa0b7', .5, .25), a_medium: () => mat('a_medium', '#6f9334', .55, .15),
    a_shells: () => mat('a_shells', '#c8403a', .5, .1), a_heavy: () => mat('a_heavy', '#3164cc', .5, .2), a_rockets: () => mat('a_rockets', '#e8742a', .5, .1)
  };
  const paint = r => mat('p' + r, RAR[r], r === 4 ? .3 : .44, r === 4 ? .42 : .18);
  const glowM = r => mat('g' + r, RAR[r], .4, 0, RAR[r], 1.6);
  const matFor = (slot, r) => slot === 'paint' ? paint(r) : slot === 'glow' ? glowM(r) : (SLOT[slot] || SLOT.body)();

  // ---------------------------------------------------------------- part kit: shapes collected per material slot
  const _e = new THREE.Euler(), _q = new THREE.Quaternion();
  function Kit() {
    const parts = new Map();
    function put(slot, g, p, r, s) {
      _e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); _q.setFromEuler(_e);
      const sc = s == null ? 1 : s, m = new THREE.Matrix4().compose(new THREE.Vector3(p[0], p[1], p[2]), _q, typeof sc === 'number' ? new THREE.Vector3(sc, sc, sc) : new THREE.Vector3(sc[0], sc[1], sc[2]));
      let L = parts.get(slot); if (!L) parts.set(slot, L = []); L.push({ g, m });
    }
    return {
      parts, put,
      // side profile [[z, y], …] extruded to thickness t, centred on x (bevelled edges)
      slab(slot, pts, t, x = 0, o = {}) {
        const sh = new THREE.Shape(); pts.forEach((q, i) => i ? sh.lineTo(q[0], q[1]) : sh.moveTo(q[0], q[1]));
        if (o.holes) o.holes.forEach(h => { const hp = new THREE.Path(); h.forEach((q, i) => i ? hp.lineTo(q[0], q[1]) : hp.moveTo(q[0], q[1])); sh.holes.push(hp); });
        const b = Math.min(o.bev != null ? o.bev : .4, t * .3), d = Math.max(.02, t - 2 * b);
        const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: b > .01, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 4 });
        g.translate(0, 0, -d / 2); g.rotateY(-PI / 2);
        put(slot, g, o.p || [x, 0, 0], o.r);
      },
      box(slot, w, h, d, x, y, z, r) { put(slot, new THREE.BoxGeometry(w, h, d), [x, y, z], r); },
      // round part along z from z0 (radius r0) to z1 (radius r1); 8 sides or fewer = flat-sided (octagonal shrouds)
      cz(slot, r0, r1, z0, z1, y, x = 0, seg = 16) { const g = new THREE.CylinderGeometry(r1, r0, z1 - z0, seg, 1, false, seg <= 8 ? PI / seg : 0); g.rotateX(PI / 2); put(slot, g, [x, y, (z0 + z1) / 2]); },
      cx(slot, r, w, x, y, z, seg = 18) { const g = new THREE.CylinderGeometry(r, r, w, seg); g.rotateZ(PI / 2); put(slot, g, [x, y, z]); },   // along x (drums, knobs)
      cy(slot, r0, r1, h, x, y, z, seg = 12, r) { put(slot, new THREE.CylinderGeometry(r1, r0, h, seg), [x, y, z], r); },                    // along y
      ring(slot, R, tube, z, y, x = 0, seg = 20) { put(slot, new THREE.TorusGeometry(R, tube, 6, seg), [x, y, z]); },                            // band around z
      disc(slot, r, z, y, x = 0, dir = 1, seg = 18) { const g = new THREE.CircleGeometry(r, seg); if (dir < 0) g.rotateY(PI); put(slot, g, [x, y, z]); },
      ball(slot, r, x, y, z, s) { put(slot, new THREE.SphereGeometry(r, 12, 8), [x, y, z], null, s); },
      cone(slot, r, h, z0, y, x = 0, seg = 16) { const g = new THREE.ConeGeometry(r, h, seg); g.rotateX(PI / 2); put(slot, g, [x, y, z0 + h / 2]); },
      lathe(slot, prof, x, y, z, seg = 20, r) { put(slot, new THREE.LatheGeometry(prof.map(q => new THREE.Vector2(q[0], q[1])), seg), [x, y, z], r); }
    };
  }
  // merge transformed parts into one indexed geometry (scale k: centimetres → metres)
  function mergeList(L, k = CM) {
    let nv = 0, ni = 0;
    for (const p of L) { const n = p.g.attributes.position.count; nv += n; ni += p.g.index ? p.g.index.count : n; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const v = new THREE.Vector3(), w = new THREE.Vector3(), nm = new THREE.Matrix3(); let vo = 0, io = 0;
    for (const p of L) {
      const P = p.g.attributes.position, N = p.g.attributes.normal, n = P.count, flip = p.m.determinant() < 0; nm.getNormalMatrix(p.m);
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(p.m); pos[(vo + i) * 3] = v.x * k; pos[(vo + i) * 3 + 1] = v.y * k; pos[(vo + i) * 3 + 2] = v.z * k;
        w.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = w.x; nor[(vo + i) * 3 + 1] = w.y; nor[(vo + i) * 3 + 2] = w.z;
        // box-projected UVs (one texture tile ≈ 18 cm), so grain runs along the gun on its sides
        const ax = Math.abs(w.x), ay = Math.abs(w.y), az = Math.abs(w.z), U = ax >= ay && ax >= az ? v.z : v.x, V = ax >= ay && ax >= az ? v.y : ay >= az ? v.z : v.y; uvs[(vo + i) * 2] = U / 18; uvs[(vo + i) * 2 + 1] = V / 18;
      }
      if (p.g.index) { const I = p.g.index; for (let j = 0; j < I.count; j += 3) { idx[io++] = I.getX(j) + vo; idx[io++] = I.getX(j + (flip ? 2 : 1)) + vo; idx[io++] = I.getX(j + (flip ? 1 : 2)) + vo; } }
      else for (let j = 0; j < n; j += 3) { idx[io++] = vo + j; idx[io++] = vo + j + (flip ? 2 : 1); idx[io++] = vo + j + (flip ? 1 : 2); }
      vo += n; p.g.dispose();
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  }
  // rounded rectangle profile
  function rr(z0, y0, z1, y1, r) { const P = []; [[z1 - r, y1 - r, 0], [z0 + r, y1 - r, PI / 2], [z0 + r, y0 + r, PI], [z1 - r, y0 + r, PI * 1.5]].forEach(([c0, c1, a0]) => { for (let i = 0; i <= 3; i++) { const a = a0 + i / 3 * PI / 2; P.push([c0 + Math.cos(a) * r, c1 + Math.sin(a) * r]); } }); return P; }

  // ---------------------------------------------------------------- shared parts
  const GRIP = [[3.2, 5], [1.6, -2], [.6, -6.4], [-1, -7.8], [-4.4, -7.4], [-3.8, -2], [-2.8, 5]];   // raked back like a real grip
  const GUARD = [[2.4, 5.2], [2.4, -.2], [7.6, -.2], [9, 1.6], [9, 5.2]], GUARD_H = [[3.2, 4.4], [3.2, .7], [7.3, .7], [8.1, 1.8], [8.1, 4.4]];
  const trigger = K => K.slab('steel', [[4.9, 4.6], [4.5, 2.4], [5.3, 1.5], [5.8, 2.3], [5.6, 4.6]], .8, 0, { bev: .15 });
  function lower(K, o = {}) {                       // pistol grip with side panels, trigger guard, trigger
    const t = o.gt || 3.3;
    K.slab(o.grip || 'dark', GRIP, t, 0, { bev: .55 });
    K.slab(o.gp || 'body', [[1.2, 3.6], [.4, -1.8], [-.4, -5.6], [-3.3, -5.6], [-3, -1.8], [-2.2, 3.6]], t + .3, 0, { bev: .2 });
    if (o.guard !== false) K.slab(o.guard || 'dark', GUARD, 1.3, 0, { holes: [GUARD_H], bev: .25 });
    trigger(K);
  }
  function rail(K, z0, z1, y, w = 2.6, slot = 'dark') {   // picatinny-style rail with teeth, sitting on height y
    K.slab(slot, [[z0, y - .2], [z0, y + 1], [z1, y + 1], [z1, y - .2]], w, 0, { bev: .25 });
    for (let z = z0 + 1.1; z < z1 - .6; z += 2.2) K.box(slot, w + .4, .5, 1, 0, y + 1.15, z);
  }
  function reddot(K, z, y) {                          // compact reflex sight standing on height y
    K.slab('dark', [[z, y], [z, y + 3.6], [z + 1.2, y + 4.8], [z + 5.4, y + 4.8], [z + 6.4, y + 3.6], [z + 6.4, y]], 3.4, 0, { bev: .35 });
    K.disc('glass', 1.25, z - .06, y + 2.7, 0, -1); K.disc('glass', 1.25, z + 6.46, y + 2.7, 0, 1);
    K.box('glow', 3.5, .35, 3, 0, y + .7, z + 3.2);
  }
  function scope(K, z0, z1, y, r = 2.1, rb = 2.9, mountY = null) {
    K.cz('dark', r, r, z0 + 3.4, z1 - 7, y, 0, 18);
    K.cz('dark', r, rb, z1 - 7, z1 - 4.6, y, 0, 18); K.cz('dark', rb, rb, z1 - 4.6, z1, y, 0, 20);
    K.cz('dark', rb * .86, r, z0 + 2.2, z0 + 3.4, y, 0, 18); K.cz('dark', rb * .86, rb * .86, z0, z0 + 2.2, y, 0, 18);
    K.ring('paint', rb + .02, .36, z1 - 1.3, y, 0, 22); K.ring('paint', rb * .86 + .02, .3, z0 + 1, y, 0, 22);
    const m = (z0 + z1) / 2 - 1.5;
    K.cy('dark', 1.15, 1.15, 2.2, 0, y + r + .9, m); K.cx('dark', 1.15, 2.2, -(r + .9), y, m);
    K.disc('glass', rb - .45, z1 + .03, y, 0, 1); K.disc('glass', rb * .86 - .45, z0 - .03, y, 0, -1);
    if (mountY != null) [z0 + 5.4, z1 - 8.4].forEach(z => { K.box('dark', 2.2, y - mountY, 1.8, 0, (y + mountY) / 2, z); K.ring('dark', r + .12, .45, z, y); });
  }
  function brake(K, z, y, r = 1.5, len = 4.4) {        // muzzle brake with side ports; returns the muzzle z
    K.cz('dark', r, r, z, z + len, y, 0, 8);
    K.box('black', r * 2 + .1, r * .9, .8, 0, y, z + len * .38); K.box('black', r * 2 + .1, r * .9, .8, 0, y, z + len * .7);
    K.disc('black', r * .45, z + len + .03, y); return z + len;
  }
  const pad = (K, z, y0, y1, w) => K.slab('dark', [[z, y0], [z, y1], [z - 1.8, y1 + .2], [z - 1.8, y0 - .2]], w, 0, { bev: .4 });   // recoil pad
  const PISTOL_HOLD = { f: .07, y: -.06, x: .05 };

  // ---------------------------------------------------------------- recipes (return hold + muzzle info)
  const R = {};
  function pistolBase(K, o = {}) {
    const L = o.L || 20;
    lower(K, { guard: 'paint' });
    K.slab('paint', [[-3.4, 3.4], [-3.4, 5.4], [L - 1, 5.4], [L - 1, 3.6], [9.6, 3.4], [9, 2.4], [2.2, 2.4]], 3.1);       // frame + dust cover
    K.slab(o.slide || 'gun', [[-3.8, 5.2], [-3.8, 9.4], [-2.8, 10.4], [L - 1.4, 10.4], [L, 9.2], [L, 5.2]], 3.6);         // slide
    for (let i = 0; i < 4; i++) K.box('dark', 3.75, 3, .38, 0, 7.9, -2.4 + i * .85);                                      // serrations
    K.box('black', .3, 1.8, 4.2, -1.75, 8.6, 8.6);                                                                        // ejection port
    K.cz('steel', 1.15, 1.15, L - 1.2, L + .9, 7.4); K.disc('black', .66, L + .93, 7.4);
    K.box('dark', 2.6, 1.1, .9, 0, 10.9, -2.7); K.box('dark', .8, 1, .8, 0, 10.9, L - 1.8);                               // sights
    K.box('glow', 3.3, .45, L * .5, 0, 4.5, L * .55);
    K.box('dark', 3.6, 1, 4.2, 0, -7.8, -2.7, [.2, 0, 0]);                                                                // mag base
    return { ...PISTOL_HOLD, m: [L + .9, 7.4], fl: .7 };
  }
  R.pistol = K => pistolBase(K);
  R.sppistol = K => {
    const h = pistolBase(K, { slide: 'body', L: 19 });
    K.cz('dark', 2, 2, 19.4, 35, 7.4, 0, 18); K.ring('steel', 2, .38, 20.2, 7.4); K.ring('steel', 2, .38, 34.4, 7.4); K.ring('glow', 2.05, .26, 27.4, 7.4); K.disc('black', .7, 35.03, 7.4);
    return { ...h, m: [35, 7.4], fl: .3 };
  };
  R.revolver = K => {
    K.slab('wood', [[1.4, 5], [.6, -1], [-.4, -6], [-2.4, -7.9], [-5.2, -7.2], [-4.8, -1], [-3.8, 5.6]], 3.5, 0, { bev: .7 });
    K.slab('woodD', [[.2, 3.6], [-.4, -1], [-1.2, -5], [-3.6, -5.2], [-3.6, -1], [-3, 3.6]], 3.8, 0, { bev: .25 });
    K.slab('gun', [[-4.6, 4.4], [-4.6, 8.8], [-2.6, 11.2], [9.4, 11.2], [9.4, 4.2], [2.2, 4.2]], 2.6);                     // frame
    K.slab('gun', [[2.2, 5], [2.2, .2], [6.6, -.2], [8.6, 1.8], [8.6, 5]], 1.2, 0, { holes: [[[3, 4.4], [3, 1.1], [6.4, .8], [7.8, 2.1], [7.8, 4.4]]], bev: .25 });
    trigger(K);
    K.cz('steel', 3.3, 3.3, 1.6, 8.8, 7.6, 0, 18);                                                                         // cylinder
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + PI / 6; K.cz('black', .72, .72, 1.5, 8.9, 7.6 + Math.sin(a) * 2.05, Math.cos(a) * 2.05, 8); }
    K.slab('paint', [[9, 6.4], [9, 11.2], [24.6, 11.2], [25.6, 10.4], [25.6, 6.8], [24, 6.4]], 2.8);                       // full-lug barrel
    K.slab('gun', [[9.2, 11], [9.2, 11.8], [25, 11.8], [25, 11]], 1.4, 0, { bev: .2 });
    K.disc('black', .78, 25.63, 9.6);
    K.slab('dark', [[23.2, 11.6], [23.6, 13], [25, 13], [25, 11.6]], .9, 0, { bev: .15 });
    K.slab('dark', [[-4.2, 8.6], [-6.8, 11.6], [-5.8, 12.3], [-3, 10.6]], 1.3, 0, { bev: .25 });                          // hammer
    K.box('glow', 3, .4, 13, 0, 8, 17.4);
    return { ...PISTOL_HOLD, m: [25.6, 9.6], fl: .9 };
  };
  R.hcannon = K => {
    lower(K, { gt: 3.6 });
    K.slab('body', [[-3.6, 3.2], [-3.6, 5.6], [21.6, 5.6], [21.6, 3.4], [10, 3.2], [9.4, 2.2], [2.2, 2.2]], 3.4);
    K.slab('paint', [[-4.4, 5.2], [-4.4, 10.8], [-3, 12.2], [21.2, 12.2], [23.2, 10.6], [23.2, 5.2]], 4.3);
    K.slab('gun', [[-3, 12], [-3, 13], [21.6, 13], [21.6, 12]], 2.4, 0, { bev: .3 });
    for (let i = 0; i < 5; i++) K.box('dark', 4.45, 3.8, .4, 0, 8.6, -3 + i * .8);
    K.box('black', .3, 2, 5, -2.17, 9.8, 9);
    K.cz('steel', 1.45, 1.45, 22.6, 24, 8.2); K.disc('black', .88, 24.03, 8.2);
    K.box('glow', 4.5, .5, 13, 0, 6.3, 12.4);
    K.box('dark', 1, 1.2, 1, 0, 13.6, 20.6); K.box('dark', 2.8, 1.2, 1, 0, 13.6, -2.4);
    K.box('dark', 3.9, 1.1, 4.4, 0, -7.8, -2.7, [.2, 0, 0]);
    return { ...PISTOL_HOLD, m: [24, 8.2], fl: 1 };
  };
  R.mpistol = K => {
    lower(K, { guard: 'paint' });
    K.slab('paint', [[-3.4, 3.4], [-3.4, 5.4], [16.6, 5.4], [16.6, 3.6], [9.6, 3.4], [9, 2.4], [2.2, 2.4]], 3.1);
    K.slab('body', [[-4, 5.2], [-4, 9.6], [-3, 10.6], [16.2, 10.6], [17.4, 9.6], [17.4, 5.2]], 3.6);
    K.slab('gun', [[17, 5.6], [17, 9.6], [22.6, 9.6], [22.6, 5.6]], 3.3, 0, { bev: .35 });                                 // compensator
    for (let i = 0; i < 3; i++) K.box('black', 2.2, .8, .8, 0, 9.7, 18.6 + i * 1.4);
    K.disc('black', .7, 22.63, 7.6);
    K.box('dark', 2.9, 6.6, 3.3, 0, -10.6, -3.4, [.2, 0, 0]); K.box('paint', 3.2, 1.1, 3.8, 0, -14, -4.1, [.2, 0, 0]);      // extended mag
    K.box('glow', 3.75, .45, 9, 0, 7.6, 7);
    K.box('dark', 2.4, 1, .9, 0, 11.1, -2.8); K.box('dark', .9, 1, .8, 0, 11.1, 15.8);
    K.cx('steel', .55, 4, 0, 4.4, -1.6, 10);
    return { ...PISTOL_HOLD, m: [22.6, 7.6], fl: .8 };
  };
  // ---- SMGs
  R.smg = K => {
    lower(K);
    K.slab('paint', [[-7, 4.4], [-7, 11], [-6, 12], [24, 12], [25, 11], [25, 4.4]], 5);
    rail(K, -5.4, 22, 12);
    K.box('black', .3, 2.2, 6, -2.52, 9.4, 6); K.cx('steel', .6, 1.6, -2.9, 10.6, 13);
    K.cz('body', 2.4, 2.4, 24.6, 33.4, 8.4, 0, 8);
    for (let i = 0; i < 3; i++) K.box('black', 4.6, 1, 1.8, 0, 8.4, 26.4 + i * 2.4);
    K.cz('steel', 1.1, 1.1, 33, 35.6, 8.4); K.cz('dark', 1.55, 1.55, 34.6, 37, 8.4, 0, 8); K.disc('black', .7, 37.03, 8.4);
    K.slab('dark', [[10.4, 5], [14.6, 5], [15.8, -9.6], [11.6, -10.2]], 2.8);
    K.box('paint', 3.3, 1.1, 4.8, 0, -10.3, 13.8, [.08, 0, 0]);
    [1.6, -1.6].forEach(x => { K.box('steel', .7, .7, 16, x, 10.4, -15); K.box('steel', .7, .7, 15.4, x, 6, -14.6); });   // wire stock
    K.slab('dark', [[-22.4, 3.6], [-22.4, 12.2], [-24.2, 12.4], [-24.2, 3.4]], 4.6, 0, { bev: .4 });
    reddot(K, 1, 13.2);
    K.box('glow', 5.2, .5, 14, 0, 6.2, 10);
    return { f: .22, y: -.05, m: [37, 8.4], fl: .8 };
  };
  R.ssmg = K => {
    lower(K);
    K.cz('paint', 3.4, 3.4, -6, 22, 8.6, 0, 18); K.disc('dark', 3.4, -6.03, 8.6, 0, -1);                                  // tube receiver
    K.slab('body', [[-4, 4.2], [-4, 7.4], [21, 7.4], [21, 4.2]], 5.4);
    K.box('black', .4, 1.8, 5, -3.3, 9.2, 8);
    K.cz('dark', 2.7, 2.7, 22, 44, 8.6, 0, 18); K.ring('steel', 2.7, .38, 22.6, 8.6); K.ring('steel', 2.7, .38, 43.4, 8.6); K.ring('glow', 2.75, .28, 33, 8.6); K.disc('black', .8, 44.03, 8.6);
    K.slab('dark', [[10, 4.6], [13.8, 4.6], [14.8, -9], [11, -9.6]], 2.6);
    K.slab('body', [[-6, 11.4], [-24.4, 10.8], [-24.4, .6], [-21.6, .4], [-6, 6.4]], 2.6, 0, { holes: [[[-9, 9.6], [-22.6, 9.2], [-22.6, 2.6], [-21, 2.4], [-9, 7.4]]] });
    K.slab('dark', [[-24, -.4], [-24, 11.2], [-26.2, 11.4], [-26.2, -.6]], 4);
    K.box('dark', 1.4, 2.6, 1.4, 0, 12.6, -3); K.slab('dark', [[18.6, 11.6], [19.2, 14], [20.6, 14], [21, 11.6]], 1, 0, { bev: .15 });
    return { f: .23, y: -.05, m: [44, 8.6], fl: .25 };
  };
  R.tsmg = K => {
    lower(K);
    K.slab('paint', [[-6, 4.4], [-6, 10.4], [-3.4, 12.6], [21.4, 12.6], [23.4, 10.8], [23.4, 4.4]], 5.2);
    rail(K, -2.6, 20, 12.6);
    K.box('black', .3, 2, 5.6, -2.62, 9.4, 7);
    K.cz('body', 2.6, 2.6, 23, 33, 8.2, 0, 8); K.box('dark', 5.5, 1, 8, 0, 8.2, 28.4);
    K.slab('dark', [[25, 5.8], [25, -4], [26, -5.2], [29.4, -5.2], [30.2, -4], [29.6, 5.8]], 3.1);                          // vertical foregrip
    K.cz('steel', 1, 1, 32.6, 35, 8.2); K.cz('dark', 1.7, 1.4, 34.6, 37.6, 8.2, 0, 6); K.disc('black', .7, 37.63, 8.2);
    K.slab('dark', [[10.6, 4.6], [14.6, 4.6], [15.2, -2], [16.8, -8.6], [12.8, -9.4], [11.2, -2.4]], 2.8);
    [1.4, -1.4].forEach(x => K.cz('steel', .7, .7, -20, -6, 10.6, x, 10)); K.cz('steel', .7, .7, -20, -6, 4.6, 0, 10);
    K.slab('body', [[-19, 2.4], [-19, 12.2], [-23, 12.4], [-23.8, 10.2], [-23.8, 1.6], [-22, 1.2]], 3.9);
    reddot(K, 2, 13.7);
    K.box('glow', 5.4, .5, 12, 0, 6, 9);
    return { f: .275, y: -.07, m: [37.6, 8.2], fl: .85 };
  };
  R.drum = K => {
    lower(K, { grip: 'wood', gp: 'woodD' });
    K.cz('gun', 3, 3, -6, 26, 8.8, 0, 16); K.disc('dark', 3, -6.03, 8.8, 0, -1);
    K.slab('gun', [[-5, 4.4], [-5, 7], [22, 7], [22, 4.4]], 4.8);
    K.slab('wood', [[-6, 11.2], [-27, 8.6], [-27.6, 7.2], [-27.6, -.6], [-25, -1.2], [-6, 5.2]], 3.7);
    pad(K, -27.4, -1.4, 8.8, 3.9);
    K.cz('dark', 2.5, 2.5, 26, 40, 8.8, 0, 14);
    for (let i = 0; i < 6; i++) K.ring('steel', 2.55, .38, 27.6 + i * 2.2, 8.8);
    K.cz('steel', 1.2, 1.2, 40, 42.4, 8.8); K.cz('gun', 1.8, 1.8, 41.8, 44, 8.8, 0, 8); K.disc('black', .8, 44.03, 8.8);
    K.cx('paint', 7.4, 5.4, 0, -3, 16.8, 28); K.cx('steel', 3.2, 5.9, 0, -3, 16.8, 20); K.cx('dark', 1.2, 6.4, 0, -3, 16.8, 10);   // drum magazine
    K.slab('wood', [[26.4, 6.6], [26.4, -3.6], [27.4, -5.2], [31, -5.2], [31.8, -3.6], [31.2, 6.6]], 3.4);
    K.box('dark', 1, 2.6, 1, 0, 12.4, 38); K.box('dark', 2.4, 2.2, 1.2, 0, 12.2, -2);
    K.box('glow', 6.2, .5, 16, 0, 8.8, 9);
    return { f: .29, y: -.07, m: [44, 8.8], fl: .9 };
  };
  // ---- shotguns
  R.pump = K => {
    lower(K, { grip: 'wood', gp: 'woodD', guard: 'gun' });
    K.slab('gun', [[-5, 4.4], [-5, 11.4], [-3.6, 12.6], [19, 12.6], [20, 11.4], [20, 4.4]], 4.8);
    K.slab('paint', [[-4, 6.6], [-4, 10.8], [18.6, 10.8], [18.6, 6.6]], 5, 0, { bev: .3 });
    K.box('black', .3, 2.6, 7, -2.6, 9.4, 7);
    K.cz('steel', 1.75, 1.75, 19.6, 62, 9.8, 0, 16); K.disc('black', 1.15, 62.03, 9.8);
    K.cz('steel', 1.4, 1.4, 19.6, 55, 6, 0, 14); K.disc('gun', 1.4, 55.03, 6);
    K.slab('gun', [[53.6, 4.2], [53.6, 11.4], [56.4, 11.4], [56.4, 4.2]], 3.6, 0, { bev: .3 });
    K.slab('paint', [[30, 3.4], [30, 8.6], [31.4, 9.8], [45, 9.8], [46.4, 8.6], [46.4, 3.4]], 5.2);                        // pump
    for (let i = 0; i < 6; i++) K.box('dark', 5.4, 4.4, .6, 0, 6.3, 32.6 + i * 2.2);
    K.slab('wood', [[-4.6, 12], [-34, 9.6], [-35, 8], [-35, -2.6], [-33, -3.2], [-14, 2.2], [-4.6, 4.6]], 4.2);
    pad(K, -34.6, -3.4, 9.8, 4.4);
    K.box('dark', .8, 3.6, 8.4, -2.75, 8, 2.6);                                                                           // side saddle
    for (let i = 0; i < 3; i++) { K.cy('red', .85, .85, 3, -3.5, 8.6, -.2 + i * 2.2); K.cy('brass', .9, .9, 1.1, -3.5, 6.6, -.2 + i * 2.2); }
    K.ball('brass', .55, 0, 12.1, 60);
    K.box('glow', 5, .5, 10, 0, 5.4, 8);
    return { f: .38, y: -.035, m: [62, 9.8], fl: 1.3 };
  };
  R.tshot = K => {
    lower(K);
    K.slab('paint', [[-5, 4.2], [-5, 11.6], [-3.4, 13], [20, 13], [21.4, 11.6], [21.4, 4.2]], 5);
    rail(K, -3, 19.4, 13);
    K.box('black', .3, 2.6, 7, -2.6, 9.6, 7);
    K.cz('steel', 1.7, 1.7, 21, 57, 10, 0, 16); K.disc('black', 1.1, 57.03, 10);
    K.slab('dark', [[21, 10.4], [21, 13.4], [51, 12.8], [52, 11.8], [52, 10.4]], 4, 0, { holes: [0, 1, 2, 3, 4].map(i => rr(24.4 + i * 5.4, 11.1, 27.6 + i * 5.4, 12.4, .5)) });   // heat shield
    K.cz('steel', 1.35, 1.35, 21, 49, 6.4, 0, 14); K.disc('gun', 1.35, 49.03, 6.4);
    K.slab('dark', [[24, 3], [24, 8.6], [40.6, 8.6], [40.6, 3]], 5.2);
    for (let i = 0; i < 5; i++) K.box('body', 5.4, .7, 1.5, 0, 3.2, 25.8 + i * 3.2);
    K.slab('body', [[-5, 12], [-30, 11.6], [-31, 10], [-31, 0], [-29, -1], [-24, 0], [-5, 5]], 3.4, 0, { holes: [[[-8, 10.2], [-27, 9.8], [-27, 2], [-24.5, 1.6], [-8, 6.4]]] });
    pad(K, -30.6, -1.4, 12, 4.2);
    K.ring('dark', .9, .32, -1.4, 15.6); K.cy('dark', .3, .3, 1.6, 0, 14.6, 50);
    K.box('glow', 5.2, .5, 14, 0, 6.2, 8.5);
    return { f: .33, y: -.04, m: [57, 10], fl: 1.2 };
  };
  R.hshot = K => {
    lower(K);
    K.slab('paint', [[-6, 4], [-6, 12], [-4, 14], [24, 14], [26, 12], [26, 4]], 6);
    rail(K, -3.4, 22, 14, 2.8);
    K.box('black', .3, 3, 8, -3.1, 10, 8);
    K.slab('gun', [[25.6, 6], [25.6, 13], [54, 13], [55, 12], [55, 6]], 4.6);
    for (let i = 0; i < 4; i++) K.slab('black', rr(29 + i * 5.6, 8.2, 32.4 + i * 5.6, 11.2, .6), 4.7, 0, { bev: .1 });
    K.slab('dark', [[54.6, 6.4], [54.6, 12.8], [61, 12.8], [61, 6.4]], 5.4);
    for (let i = 0; i < 2; i++) K.box('black', 5.5, 4, .9, 0, 9.6, 56.6 + i * 2);
    K.disc('black', 1.3, 61.03, 9.6);
    K.slab('dark', [[12.6, 4.4], [18, 4.4], [18.4, -6.8], [13, -7.2]], 4);
    K.slab('dark', [[24, 4.4], [24, 1.6], [44, 1.6], [45, 6.2], [26, 6.2]], 5.2);
    K.slab('body', [[-6, 13], [-30, 12], [-31.4, 10], [-31.4, -1], [-29, -2], [-20, 1], [-6, 5]], 4.6);
    pad(K, -31, -2.2, 12.2, 4.8);
    K.box('glow', 6.2, .5, 16, 0, 6, 11); K.box('dark', 1, 2, 1, 0, 14, 52);
    return { f: .34, y: -.05, m: [61, 9.6], fl: 1.4 };
  };
  R.dbarrel = K => {
    lower(K, { grip: 'wood', gp: 'woodD', guard: 'gun' });
    K.slab('gun', [[-4, 4.4], [-4, 10.8], [-2, 12.6], [9, 12.6], [9, 4.4]], 5.2);
    K.slab('paint', [[-3, 5.2], [-3, 10.4], [8.4, 10.4], [8.4, 5.2]], 5.5, 0, { bev: .3 });                                // side plates
    K.box('glow', 5.7, .35, 9, 0, 7.8, 2.8);
    [1.75, -1.75].forEach(x => { K.cz('steel', 1.75, 1.7, 8.6, 56, 9.8, x, 16); K.disc('black', 1.12, 56.03, 9.8, x); K.ring('gun', 1.76, .35, 54.6, 9.8, x); });
    K.box('gun', 1.3, 1.2, 46, 0, 11.6, 32);
    K.slab('wood', [[9, 5.4], [9, 9.4], [32, 9.4], [33.4, 8], [33.4, 6.2], [31, 5.4]], 4.8);
    K.slab('wood', [[-3.8, 11.8], [-33, 9.2], [-34, 7.8], [-34, -3.2], [-32, -3.8], [-12, 2], [-3.8, 4.6]], 4.4);
    pad(K, -33.6, -4, 9.4, 4.6);
    [1.3, -1.3].forEach(x => K.slab('dark', [[-3, 11], [-5.4, 13.8], [-4.6, 14.4], [-1.6, 12.2]], 1, x, { bev: .2 }));      // hammers
    K.ball('brass', .5, 0, 12.6, 54.6);
    return { f: .22, y: -.035, m: [56, 9.8], fl: 1.4 };
  };
  R.ashot = K => {
    lower(K);
    K.slab('body', [[-6, 4.2], [-6, 12], [-4, 13.6], [24, 13.6], [25.6, 12], [25.6, 4.2]], 5.6);
    K.slab('paint', [[-4.6, 6.8], [-4.6, 11.4], [23, 11.4], [23, 6.8]], 5.9, 0, { bev: .3 });
    rail(K, -2, 22, 13.6);
    K.cz('dark', 2.5, 2.5, 25, 46, 9.8, 0, 8);
    for (let i = 0; i < 4; i++) K.cz('gun', 2.62, 2.62, 27.4 + i * 4.4, 28.6 + i * 4.4, 9.8, 0, 8);
    K.cz('steel', 1.6, 1.6, 46, 48.4, 9.8); K.slab('gun', [[48, 7.2], [48, 12.4], [52.6, 12.4], [52.6, 7.2]], 4.8); K.box('black', 4.9, 3.6, .9, 0, 9.8, 50); K.disc('black', 1.1, 52.63, 9.8);
    K.cx('paint', 6.6, 6, 0, -2.6, 16, 28); K.cx('gun', 3, 6.4, 0, -2.6, 16, 16); K.cx('dark', 1.2, 6.8, 0, -2.6, 16, 8);   // drum
    K.slab('body', [[-6, 13], [-30, 12.4], [-31, 10.6], [-31, -.6], [-29, -1.4], [-6, 5]], 4.4, 0, { holes: [[[-10, 10.6], [-27.4, 10.2], [-27.4, 1.8], [-10, 6.6]]] });
    pad(K, -30.6, -1.8, 12.6, 4.6);
    K.slab('dark', [[32, 7.4], [32, -1], [33, -2.4], [36.4, -2.4], [37.2, -1], [36.4, 7.4]], 3);
    reddot(K, 1, 14.7);
    K.box('glow', 6, .45, 14, 0, 6.6, 9);
    return { f: .33, y: -.06, m: [52.6, 9.8], fl: 1.2 };
  };
  // ---- rifles
  function arBase(K) {
    lower(K);
    K.slab('body', [[-6.4, 4.2], [-6.4, 7.4], [17.6, 7.4], [17.6, 4.2], [14.4, 3.6], [9.6, 3.6]], 5);                     // lower receiver
    K.slab('paint', [[-7, 7], [-7, 12.2], [18.6, 12.2], [18.6, 7]], 4.8);                                                  // upper receiver
    K.box('black', .3, 2.4, 6.4, -2.52, 9.4, 6); K.cx('steel', .8, 1.4, -2.8, 10.6, -2);
    K.slab('dark', [[10, 4.4], [14.2, 4.4], [15.6, -4], [18.2, -12.6], [14, -13.4], [11.4, -4.4]], 2.8);                   // curved mag
    K.slab('body', [[-6.4, 12], [-32, 10.6], [-32, -1.6], [-29.6, -1.6], [-6.4, 5]], 4.2);                                 // stock
    pad(K, -31.6, -2, 11, 4.4);
    K.box('glow', 5.1, .45, 18, 0, 8.2, 6);
    return { f: .31, y: -.03, fl: 1 };
  }
  R.m16 = K => {
    const h = arBase(K);
    K.slab('paint', [[-5, 12], [-5, 15.4], [-3.6, 16.6], [10.6, 16.6], [12, 15.4], [12, 12]], 2.6, 0, { holes: [rr(-3, 12.7, 10, 14.8, .5)], bev: .3 });   // carry handle
    K.cz('dark', 3.2, 3.2, 18.4, 42, 9.4, 0, 14); K.ring('body', 3.25, .5, 19, 9.4, 0, 16); K.ring('body', 3.25, .5, 41.4, 9.4, 0, 16);
    for (let i = 0; i < 6; i++) { K.box('black', 6.1, .9, 2.2, 0, 10.6, 21.4 + i * 3.4); K.box('black', 6.1, .9, 2.2, 0, 8.2, 23.1 + i * 3.4); }   // vent slots
    K.slab('body', [[41, 7.6], [41, 17.6], [42.6, 17.6], [44.4, 11], [44.4, 7.6]], 1.6);
    K.cz('steel', .95, .95, 42, 60, 9.4, 0, 10); K.cz('dark', 1.35, 1.35, 58.6, 63, 9.4, 0, 6); K.disc('black', .6, 63.03, 9.4);
    return { ...h, m: [63, 9.4] };
  };
  R.scoped = K => {
    const h = arBase(K);
    rail(K, -6, 17, 12.2);
    K.cz('dark', 3.2, 3.2, 18.4, 44, 9.4, 0, 8);
    for (let i = 0; i < 4; i++) K.box('black', 6, 1.6, 3.4, 0, 9.4, 22.4 + i * 5.6);
    K.cz('steel', 1, 1, 44, 59, 9.4, 0, 10);
    const mz = brake(K, 58.6, 9.4, 1.5, 4.4);
    scope(K, -5, 17, 17.8, 2.1, 2.9, 13.4);
    return { ...h, m: [mz, 9.4] };
  };
  R.burst = K => {
    lower(K);
    K.slab('paint', [[-7, 4.2], [-7, 11.6], [-4, 13.2], [20, 13.2], [20, 4.2], [14, 3.4], [9, 3.4]], 5);
    K.slab('body', [[19.6, 5.6], [19.6, 12.8], [44, 12.2], [46, 10.2], [46, 6.6], [44, 5.6]], 5.2);
    for (let i = 0; i < 4; i++) K.slab('black', rr(22.6 + i * 5.2, 7.6, 25.8 + i * 5.2, 10.6, .7), 5.3, 0, { bev: .1 });
    rail(K, -4, 19, 13.2);
    K.box('black', .3, 2.4, 6, -2.52, 9.6, 6);
    K.cz('steel', 1, 1, 45.6, 55, 9);
    const mz = brake(K, 54.6, 9, 1.4, 4);
    K.slab('dark', [[10, 4.4], [14, 4.4], [15.2, -4], [17.6, -12], [13.6, -12.8], [11.4, -4.4]], 2.8);
    K.slab('body', [[-7, 12.4], [-20, 12.2], [-31, 11.6], [-32, 9], [-32, -1], [-29.4, -1.4], [-20, 4], [-7, 5.4]], 4.6, 0, { holes: [[[-11, 10.6], [-27, 10], [-27, 2.4], [-11, 6.6]]] });
    K.slab('dark', [[-28, 11.4], [-28, 13.6], [-14, 13.4], [-14, 11.6]], 3.6);
    pad(K, -31.6, -1.4, 11.8, 4.8);
    reddot(K, 2, 14.4);
    K.box('glow', 5.1, .45, 22, 0, 6, 5); K.box('glow', 5.3, .4, 20, 0, 11.2, 33);
    return { f: .31, y: -.03, m: [mz, 9], fl: 1 };
  };
  R.scar = K => {
    lower(K);
    K.slab('body', [[-5, 4.2], [-5, 7.4], [16, 7.4], [16, 4.2], [13.6, 3.6], [9.6, 3.6]], 5);
    K.slab('paint', [[-7, 7], [-7, 13], [44, 13], [44, 7.8], [22, 7], [20, 6.4], [17, 7]], 5.2);                          // long upper + forend
    rail(K, -6, 43, 13, 2.8);
    K.box('dark', 5.6, 1.4, 14, 0, 9.6, 35);
    K.box('black', .3, 2.4, 6, -2.62, 10, 7); K.cx('dark', .7, 2.4, -3.2, 11, 12);
    K.cz('steel', 1, 1, 44, 54, 9.6);
    const mz = brake(K, 53.6, 9.6, 1.45, 4.2);
    K.slab('dark', [[10, 4.4], [14.4, 4.4], [15.4, -11], [11.2, -11.6]], 2.8);
    K.slab('body', [[-7, 12.6], [-30, 12.6], [-31.6, 11], [-31.6, -.8], [-29, -1.6], [-24, -.4], [-24, 5], [-7, 6.4]], 4.4);
    K.slab('dark', [[-29.6, 12.4], [-29.6, 14.6], [-14, 14.6], [-14, 12.4]], 3.4);
    pad(K, -31.2, -1, 12.4, 4.6);
    K.slab('dark', [[40, 14], [40.6, 17.4], [42.4, 17.4], [42.8, 14]], 1.2, 0, { bev: .2 });
    reddot(K, 0, 14.1);
    K.box('glow', 5.3, .45, 24, 0, 8, 28);
    return { f: .31, y: -.03, m: [mz, 9.6], fl: 1 };
  };
  R.battle = K => {
    lower(K, { grip: 'woodD', gp: 'wood' });
    K.slab('gun', [[-6, 4.4], [-6, 12.4], [-4.6, 13.4], [18, 13.4], [18, 4.4]], 5);
    K.slab('paint', [[-5, 9.6], [-5, 12.6], [17, 12.6], [17, 9.6]], 5.25, 0, { bev: .3 });
    K.box('black', .3, 2.2, 6, -2.52, 8.2, 6); K.cx('steel', .7, 2.6, -3.3, 10.8, 12);
    K.slab('wood', [[18, 4.6], [18, 11], [44, 10.4], [45.6, 8.8], [45.6, 5.8], [43, 4.6]], 5.2);
    for (let i = 0; i < 4; i++) K.slab('woodD', rr(22 + i * 5.6, 6.6, 25.2 + i * 5.6, 8.6, .5), 5.3, 0, { bev: .1 });
    K.cz('steel', 1.1, 1.1, 45, 59, 8.6);
    const mz = brake(K, 58.6, 8.6, 1.6, 4.6);
    K.slab('dark', [[9.6, 4.6], [14.6, 4.6], [15.8, -12.4], [10.8, -12.8]], 3);
    K.slab('wood', [[-6, 12], [-33, 10.4], [-33.6, 8.6], [-33.6, -2.6], [-31, -3], [-14, 2.4], [-6, 4.6]], 4.4);
    pad(K, -33.2, -3.2, 10.6, 4.6);
    K.slab('dark', [[-3, 13.2], [-3, 15.2], [1, 15.2], [1, 13.2]], 2, 0, { bev: .2 });
    K.slab('dark', [[43, 10.2], [43, 14], [45, 14], [45, 10.2]], 2.4, 0, { holes: [rr(43.4, 11.2, 44.6, 13.4, .3)], bev: .2 });
    K.box('glow', 5.2, .45, 18, 0, 6.2, 6);
    return { f: .31, y: -.035, m: [mz, 8.6], fl: 1.2 };
  };
  R.lmg = K => {
    lower(K);
    K.slab('body', [[-8, 3.8], [-8, 13], [-6, 14.4], [22, 14.4], [22, 3.8]], 6.4);
    K.slab('paint', [[-6.4, 14], [-6.4, 16.6], [19, 16.6], [21.4, 14]], 6.6, 0, { bev: .4 });                              // feed cover
    K.slab('paint', [[-7, 6], [-7, 11], [20, 11], [20, 6]], 6.6, 0, { bev: .3 });
    K.cz('dark', 3, 3, 22, 50, 9.6, 0, 10);
    for (let i = 0; i < 5; i++) K.box('black', 6.1, 1.4, 3, 0, 9.6, 25 + i * 5);
    K.cz('steel', 1.3, 1.3, 50, 62, 9.6);
    const mz = brake(K, 61.6, 9.6, 1.8, 4.6);
    K.slab('olive', [[10.4, 4.2], [10.4, -9], [11.4, -10.4], [23.6, -10.4], [24.6, -9], [24.6, 4.2]], 8);                  // ammo box
    K.slab('dark', [[11.4, -1.6], [11.4, 1.6], [23.6, 1.6], [23.6, -1.6]], 8.2, 0, { bev: .2 });
    [1.5, -1.5].forEach(x => K.box('dark', .9, .9, 20, x, 5.4, 40)); K.box('dark', 4, 2, 2, 0, 6.6, 50.4);                // folded bipod
    K.slab('dark', [[22, 13.4], [24, 19], [33, 19], [35, 13.4]], 1.4, 0, { holes: [[[24.8, 13.8], [25.8, 17.4], [31.4, 17.4], [32.4, 13.8]]] });   // carry handle
    K.slab('body', [[-8, 13.2], [-34, 12], [-35, 10], [-35, -1.4], [-32, -2], [-8, 4.2]], 5, 0, { holes: [[[-12, 11], [-30, 10.2], [-30, 1.4], [-12, 6.4]]] });
    pad(K, -34.6, -2.2, 12.2, 5.2);
    K.box('dark', 1, 2.4, 1, 0, 13.2, 48); K.slab('dark', [[-4, 16.4], [-4, 18.4], [-1, 18.4], [-1, 16.4]], 2, 0, { bev: .2 });
    K.box('glow', 6.7, .45, 20, 0, 5, 7);
    return { f: .3, y: -.03, m: [mz, 9.6], fl: 1.3 };
  };
  R.dmr = K => {
    lower(K);
    K.slab('body', [[-6.4, 4.2], [-6.4, 7.4], [17.6, 7.4], [17.6, 4.2], [14.4, 3.6], [9.6, 3.6]], 5);
    K.slab('paint', [[-7, 7], [-7, 12.2], [18.6, 12.2], [18.6, 7]], 4.8);
    rail(K, -6, 47, 12.2);
    K.slab('dark', [[18.4, 6], [18.4, 12.2], [48, 12.2], [48, 6]], 5.4, 0, { holes: [0, 1, 2, 3, 4].map(i => rr(21 + i * 5.4, 7.6, 24.4 + i * 5.4, 9.4, .5)) });
    K.cz('steel', 1.1, 1.1, 18, 68, 9.2);
    const mz = brake(K, 67.6, 9.2, 1.5, 4.4);
    K.box('black', .3, 2.4, 6.4, -2.52, 9.4, 6);
    K.slab('dark', [[10, 4.4], [14, 4.4], [14.8, -7], [10.8, -7.4]], 2.8);
    K.slab('body', [[-6.4, 12], [-31, 11.4], [-32, 9.6], [-32, -1], [-29.6, -1.6], [-22, 0], [-22, 4.4], [-6.4, 5.2]], 4.4);
    K.slab('paint', [[-29, 11.2], [-29, 13.8], [-15, 13.8], [-13, 12], [-13, 11.2]], 3.4);                                  // cheek riser
    pad(K, -31.6, -1.8, 11.6, 4.6);
    scope(K, -6, 20, 18.8, 2.3, 3.2, 13.4);
    K.box('glow', 5.1, .45, 18, 0, 8.2, 6);
    return { f: .33, y: -.03, m: [mz, 9.2], fl: 1 };
  };
  R.hunting = K => {
    K.slab('wood', [[-34, 9.6], [-14, 10.6], [-4, 8.6], [-4, 7.4], [18, 7.4], [44, 8.4], [46, 7.4], [46, 5.2], [20, 4.2], [9.5, 4.2], [4, 4.4], [3, 3], [1.6, -2], [.6, -6.4], [-1, -7.8], [-4.4, -7.4], [-4.8, -3], [-7.4, .6], [-12, 1.4], [-31.6, -3.4], [-34, -2.8]], 4.2, 0, { bev: .55 });
    K.slab('woodD', [[1.4, 2.6], [.4, -5.2], [-3, -5.4], [-3.4, -1.4], [-1.6, 2.6]], 4.5, 0, { bev: .2 });
    K.slab('steel', GUARD, 1.3, 0, { holes: [GUARD_H], bev: .25 }); trigger(K);
    K.cz('paint', 2.3, 2.3, -4, 18, 9.8, 0, 16);
    K.cx('steel', .55, 4.4, -3.9, 9, 3); K.ball('steel', 1.05, -6, 8.2, 3);                                                 // bolt handle (right)
    K.cz('steel', 1.35, .95, 18, 66, 9.8, 0, 14); K.disc('black', .55, 66.03, 9.8);
    K.ring('paint', 1.25, .45, 44, 9.8);
    K.slab('dark', [[22, 10.8], [22, 12.8], [25, 12.8], [25, 10.8]], 1.8, 0, { bev: .2 }); K.slab('dark', [[63.4, 10.6], [63.8, 12.4], [65, 12.4], [65, 10.6]], .9, 0, { bev: .15 });
    pad(K, -33.6, -3.2, 9.8, 4.4);
    K.box('glow', 4.5, .45, 22, 0, 6, 30);
    return { f: .36, y: -.035, m: [66, 9.8], fl: 1.1 };
  };
  R.lever = K => {
    K.slab('wood', [[-3, 10.6], [-30, 9.2], [-31, 7.8], [-31, -2], [-29, -2.6], [-7, 2.6], [-3, 5.4]], 4.2, 0, { bev: .55 });
    pad(K, -30.6, -2.8, 9.4, 4.4);
    K.slab('paint', [[-4, 4.4], [-4, 11.4], [-2.6, 12.4], [15, 12.4], [16.2, 11], [16.2, 4.4]], 4.4);
    K.cx('steel', .7, 4.6, 0, 8.6, 2); K.cx('steel', .7, 4.6, 0, 8.6, 10);
    K.slab('steel', rr(-5.4, -6.2, 8.4, 4.8, 2.4), 1.3, 0, { holes: [rr(-3.8, -4.8, 6.8, 3.4, 1.6)], bev: .25 });           // lever loop
    trigger(K);
    K.cz('steel', 1.4, 1.4, 16, 62, 10, 0, 8); K.disc('black', .6, 62.03, 10);
    K.cz('steel', 1.05, 1.05, 16, 56, 7.2, 0, 12); K.disc('gun', 1.05, 56.03, 7.2);
    K.slab('wood', [[16, 5.4], [16, 9.4], [36, 9.4], [37.4, 8.2], [37.4, 5.4]], 4.6);
    K.slab('gun', [[54, 5.6], [54, 11.6], [56, 11.6], [56, 5.6]], 3.2, 0, { bev: .3 });
    K.slab('dark', [[-4, 10.6], [-6.4, 13.4], [-5.6, 14], [-2.8, 12]], 1.2, 0, { bev: .2 });
    K.slab('dark', [[26, 11.2], [26, 12.6], [28.4, 12.6], [28.4, 11.2]], 1.6, 0, { bev: .2 }); K.slab('dark', [[59.6, 11.2], [60, 12.6], [61.2, 12.6], [61.2, 11.2]], .8, 0, { bev: .12 });
    K.box('glow', 4.5, .45, 10, 0, 6.6, 6);
    return { f: .3, y: -.035, m: [62, 10], fl: 1.1 };
  };
  // ---- snipers
  R.bolt = K => {
    K.slab('paint', [[-36, 11], [-14, 11.4], [-6, 9.4], [-4, 7.6], [20, 7.6], [38, 7.8], [40, 6.8], [40, 4.2], [20, 3.6], [9.5, 3.8], [4, 4.2], [3, 3], [1.6, -2], [.6, -6.4], [-1, -7.8], [-4.4, -7.4], [-4.8, -3], [-9, .8], [-14, 1], [-33.6, -3.6], [-36, -3]], 4.4, 0, { bev: .55, holes: [[[-6.6, 6.6], [-9, 2.8], [-13.2, 2.8], [-13.2, 6.6]]] });   // thumbhole stock
    K.slab('dark', GUARD, 1.3, 0, { holes: [GUARD_H], bev: .25 }); trigger(K);
    K.cz('gun', 2.5, 2.5, -6, 20, 10.4, 0, 16);
    K.cx('steel', .55, 4.6, -4, 9.6, 2); K.ball('steel', 1.2, -6.4, 8.8, 2);
    K.cz('steel', 1.6, 1.2, 20, 80, 10.4, 0, 16);
    const mz = brake(K, 79.6, 10.4, 1.9, 6);
    K.slab('dark', [[9.4, 4], [14.4, 4], [14.4, -1.6], [9.4, -1.6]], 3.4);
    scope(K, -4, 24, 17.6, 2.4, 3.3, 12.9);
    K.slab('dark', [[-32, 11], [-32, 13.4], [-16, 13.4], [-14, 11.4]], 3.4);
    pad(K, -35.6, -3.2, 11.2, 4.6);
    [1.4, -1.4].forEach(x => K.box('dark', .9, .9, 16, x, 3.4, 30));
    K.box('glow', 4.7, .45, 16, 0, 5.4, 22);
    return { f: .34, y: -.04, m: [mz, 10.4], fl: 1.2 };
  };
  R.semis = K => {
    lower(K);
    K.slab('body', [[-6.4, 4.2], [-6.4, 7.4], [18, 7.4], [18, 4.2], [14.4, 3.6], [9.6, 3.6]], 5);
    K.slab('body', [[-7, 7], [-7, 12.6], [19, 12.6], [19, 7]], 5);
    rail(K, -6, 19, 12.6);
    K.slab('paint', [[18.6, 6], [18.6, 12.4], [50, 11.6], [52, 9.4], [52, 6.8], [50, 6]], 5.6);
    for (let i = 0; i < 5; i++) K.slab('black', rr(22 + i * 5.4, 8, 25.2 + i * 5.4, 10.2, .5), 5.7, 0, { bev: .1 });
    K.box('black', .3, 2.4, 6.4, -2.52, 9.6, 6);
    K.cz('steel', 1.2, 1.2, 51, 72, 9.4); K.cz('dark', 2, 2, 71.6, 80, 9.4, 0, 8); [73.4, 77.4].forEach(z => K.cz('gun', 2.1, 2.1, z, z + .8, 9.4, 0, 8)); K.disc('black', .7, 80.03, 9.4);
    K.slab('dark', [[10, 4.4], [15, 4.4], [15.6, -8.6], [10.6, -9]], 3);
    K.slab('body', [[-7, 12.4], [-33, 11.6], [-34, 9.6], [-34, -1.6], [-31.4, -2.2], [-7, 5]], 4.4, 0, { holes: [[[-10.6, 10.2], [-29.6, 9.6], [-29.6, 1.6], [-10.6, 6.6]]] });
    K.slab('dark', [[-31, 11.4], [-31, 13.8], [-15, 13.8], [-13, 11.8]], 3.4);
    pad(K, -33.6, -2.4, 11.8, 4.6);
    scope(K, -4, 22, 19, 2.3, 3.2, 13.8);
    K.box('glow', 5.1, .45, 20, 0, 6.6, 6);
    return { f: .33, y: -.035, m: [80, 9.4], fl: 1.1 };
  };
  R.xbow = K => {
    lower(K);
    K.slab('wood', [[-6, 11.6], [-28, 10], [-29, 8.6], [-29, -1.6], [-26.6, -2.2], [-6, 4.6]], 4.2);
    pad(K, -28.6, -2.4, 10.2, 4.4);
    K.slab('body', [[-6, 4.4], [-6, 10.6], [36, 10.6], [38, 9], [38, 6.4], [36, 5.4], [10, 4.4]], 4);
    K.slab('dark', [[-2, 10.4], [-2, 11.4], [36, 11.4], [36, 10.4]], 1.6, 0, { bev: .2 });
    K.slab('paint', [[40.6, 0], [39.6, 12], [37, 22], [33, 27.4], [31.4, 26.6], [34.6, 21], [36.8, 12], [37.6, 0], [36.8, -12], [34.6, -21], [31.4, -26.6], [33, -27.4], [37, -22], [39.6, -12]], 2.6, 0, { r: [0, 0, PI / 2], p: [0, 11.6, 0] });   // limbs
    K.box('dark', 6, 3.6, 4.4, 0, 10.8, 38.4);
    [-1, 1].forEach(s => { const X = -s * 27, dz = 32.2 - 6, L = Math.hypot(X, dz); K.box('string', .3, .3, L, X / 2, 11.9, (32.2 + 6) / 2, [0, Math.atan2(X, dz), 0]); });
    K.cz('steel', .45, .45, 6, 42, 12.3); K.cone('steel', 1.1, 3.4, 42, 12.3, 0, 4);
    for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2 + PI / 2; K.box('red', .2, 1.4, 4, Math.cos(a) * .8, 12.3 + Math.sin(a) * .8, 9, [0, 0, a - PI / 2]); }
    scope(K, 2, 16, 17.4, 1.6, 2.2, 11.4);
    K.box('glow', 4.1, .45, 26, 0, 6.6, 20);
    return { f: .26, y: -.04, m: [46, 12.3], fl: 0 };
  };
  // ---- explosives + heavy
  R.rocket = K => {
    lower(K);
    K.slab('body', [[-4, 4.4], [-4, 8], [8, 8], [9, 4.4]], 3.4);
    K.cz('paint', 5.4, 5.4, -40, 48, 12.6, 0, 22);
    K.cz('dark', 5.9, 5.6, -46, -40, 12.6, 0, 22); K.disc('black', 4.6, -46.03, 12.6, 0, -1);
    K.cz('dark', 5.6, 6.4, 48, 54, 12.6, 0, 22); K.disc('black', 5.4, 54.03, 12.6);
    K.cone('red', 3.4, 5.6, 54, 12.6, 0, 16); K.ring('white', 3.4, .5, 54.4, 12.6);
    [-24, 30].forEach(z => K.ring('glow', 5.45, .4, z, 12.6, 0, 26));
    [-12, 10, 40].forEach(z => K.ring('dark', 5.5, .7, z, 12.6, 0, 26));
    K.slab('dark', [[24, 8], [24, -3.6], [25, -5], [28.4, -5], [29.2, -3.6], [28.6, 8]], 3.2);
    K.slab('dark', [[-6, 8.4], [-6, 13], [6, 13], [6, 8.4]], 3, 6.6, { bev: .4 }); K.disc('glass', 1.2, -6.03, 11, 6.6, -1);
    K.slab('dark', [[-36, 6.4], [-36, 8.4], [-20, 8.4], [-20, 6.4]], 3.6);
    return { f: .25, y: -.06, m: [54, 12.6], fl: 1.6 };
  };
  R.gl = K => {
    lower(K);
    K.slab('body', [[-6, 4.4], [-6, 13.6], [8, 13.6], [8, 4.4]], 4.6);
    K.cz('paint', 5.6, 5.6, 8, 24, 8.6, 0, 20);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2 + PI / 2; K.cz('dark', 1.5, 1.5, 7.8, 24.2, 8.6 + Math.sin(a) * 3.3, Math.cos(a) * 3.3, 10); }
    K.cz('gun', 1.4, 1.4, 24, 26, 8.6, 0, 10);
    K.slab('body', [[24, 4.6], [24, 14.4], [27, 14.4], [27, 4.6]], 4.6);
    K.slab('body', [[-6, 13.4], [-6, 15], [28, 15], [28, 13.4]], 2.4, 0, { bev: .3 });
    K.cz('steel', 2.4, 2.4, 26.6, 44, 11.9, 0, 16); K.disc('black', 1.9, 44.03, 11.9);
    K.slab('dark', [[30, 9], [30, -2], [31, -3.4], [34.4, -3.4], [35.2, -2], [34.6, 9]], 3);
    K.slab('dark', [[-6, 12], [-26, 11.4], [-26, 1], [-23.6, .4], [-6, 6]], 2.6, 0, { holes: [[[-9, 10.2], [-24, 9.8], [-24, 2.6], [-9, 7.6]]] });
    pad(K, -25.6, 0, 11.8, 4.2);
    K.slab('dark', [[2, 15], [2, 19], [4, 19], [4, 15]], 1.2, 0, { bev: .2 });
    K.box('glow', 4.7, .45, 10, 0, 6, 1);
    return { f: .33, y: -.05, m: [44, 11.9], fl: 1.2 };
  };
  R.mini = K => {
    lower(K);
    K.slab('paint', [[-12, 3.6], [-12, 15], [-10, 17], [12, 17], [14.4, 14.6], [14.4, 3.6]], 9);
    K.cz('gun', 4, 4, -18, -12, 10, 0, 18); K.disc('dark', 3, -18.03, 10, 0, -1);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; K.cz('steel', .8, .8, 14, 64, 10 + Math.sin(a) * 2.5, Math.cos(a) * 2.5, 8); K.disc('black', .45, 64.03, 10 + Math.sin(a) * 2.5, Math.cos(a) * 2.5); }
    K.cz('gun', 1.2, 1.2, 14, 63, 10);
    K.cz('dark', 3.9, 3.9, 14, 19, 10, 0, 20); K.cz('dark', 3.7, 3.7, 38, 40.4, 10, 0, 20); K.cz('dark', 3.7, 3.7, 59, 61.6, 10, 0, 20);
    K.slab('dark', [[-8, 17], [-6, 22.6], [8, 22.6], [10, 17]], 1.6, 0, { holes: [[[-5.4, 17.4], [-4.4, 21], [6.4, 21], [7.4, 17.4]]] });
    K.slab('olive', [[-8, 2], [-8, 12], [6, 12], [6, 2]], 6, 7.8);                                                         // ammo box (left)
    K.box('dark', 3.4, 2.4, 6, 5.6, 12.6, -1);
    for (let i = 0; i < 5; i++) K.cx('brass', .5, 2.6, 7.8, 12.6, -6 + i * 2.4, 10);
    K.box('glow', 9.2, .5, 18, 0, 6, 1);
    return { f: .2, y: -.02, x: .06, m: [64, 10], fl: 1.4 };
  };

  // ---------------------------------------------------------------- item recipes (heals, ammo) — centred, sitting on y = 0
  const IT = {};
  IT.med = K => {
    K.slab('white', rr(-11, 0, 11, 14, 2.4), 8, 0, { bev: .8 });
    [4.15, -4.15].forEach(x => { K.box('red', .4, 8, 2.6, x, 7, 0); K.box('red', .4, 2.6, 8, x, 7, 0); });
    K.slab('dark', [[-5, 13.4], [-4, 17], [4, 17], [5, 13.4]], 1.6, 0, { holes: [[[-3.4, 14], [-2.6, 15.6], [2.6, 15.6], [3.4, 14]]], bev: .3 });
    [-7.2, 7.2].forEach(z => K.box('steel', 8.4, 1.6, 1.2, 0, 12, z));
  };
  IT.shield = K => {
    K.lathe('shieldG', [[0, 0], [5.6, .4], [7.6, 2.4], [8.2, 5.6], [7.6, 8.8], [5.4, 11.2], [2.4, 12.4], [2.2, 15.6], [0, 15.6]], 0, 0, 0, 26);
    K.cy('steel', 2.7, 2.7, 2.4, 0, 16.4, 0, 18); K.cy('dark', 2.4, 2.2, 1.6, 0, 18.2, 0, 18);
    K.put('white', new THREE.TorusGeometry(8.05, .45, 6, 32), [0, 5.6, 0], [PI / 2, 0, 0]);
    K.slab('white', [[0, 10.4], [3, 9.6], [3, 5.8], [0, 3.2], [-3, 5.8], [-3, 9.6]], .8, -7.7, { bev: .2 });
  };
  IT.slurp = K => {
    K.lathe('slurpG', [[0, 0], [5.6, 0], [6.6, 1.6], [7, 6], [6.6, 11.4], [5, 13.4], [3.4, 14], [0, 14]], 0, 0, 0, 24);
    K.cy('lime', 3.8, 3.8, 2.6, 0, 15, 0, 18); K.cy('white', 1, 1, 6, 1.4, 18, 0, 8, [0, 0, -.35]);
    K.put('lime', new THREE.TorusGeometry(3.4, .8, 8, 16, PI), [0, 7.4, -6.6], [0, PI / 2, PI / 2]);
    K.put('white', new THREE.TorusGeometry(7.05, .4, 6, 30), [0, 4, 0], [PI / 2, 0, 0]); K.put('white', new THREE.TorusGeometry(7.05, .4, 6, 30), [0, 9, 0], [PI / 2, 0, 0]);
  };
  function round(K, x, z, base, h, r, tip) {          // one cartridge standing up
    K.cy('brass', r, r, h, x, base + h / 2, z, 12);
    if (tip === 'shell') { K.cy('red', r * 1.02, r * 1.02, h * .7, x, base + h * .65, z, 12); K.cy('brass', r * 1.06, r * 1.06, h * .22, x, base + h * .11, z, 12); }
    else K.put(tip, new THREE.ConeGeometry(r * .92, r * 2.6, 12), [x, base + h + r * 1.3, z]);
  }
  function ammoBox(K, t) {
    K.slab('a_' + t, rr(-6.4, 0, 6.4, 7.6, 1), 8.6, 0, { bev: .5 });
    K.box('dark', 8.9, 1.2, 13, 0, 6.4, 0);
    K.slab('white', [[-3, 2.4], [-3, 4.4], [3, 4.4], [3, 2.4]], .4, -4.5, { bev: .1 });
    const S = { light: [6, 3.4, .7, 'steel'], medium: [4, 4.4, .9, 'brass'], shells: [3, 4.6, 1.3, 'shell'], heavy: [3, 6.4, 1.05, 'dark'] }[t];
    if (S) for (let i = 0; i < S[0]; i++) { const cols = S[0] > 4 ? 3 : S[0], row = Math.floor(i / cols), col = i % cols, z = (col - (cols - 1) / 2) * (12 / cols); round(K, (row ? 1.8 : -1.8) * (S[0] > 4 ? 1 : 0), z, 6.8, S[1], S[2], S[3]); }
    if (t === 'rockets') { K.cz('a_rockets', 1.6, 1.6, -6, 6, 10, 0, 14); K.cone('red', 1.6, 3.4, 6, 10, 0, 14); [-1, 1].forEach(s => K.box('dark', .3, 2.6, 2.6, s * 1.6, 10, -5)); }
  }
  ['light', 'medium', 'shells', 'heavy', 'rockets'].forEach(t => IT['a_' + t] = K => ammoBox(K, t));
  IT.ammo = K => {
    K.slab('olive', rr(-9, 0, 9, 9, 1.2), 12, 0, { bev: .6 });
    K.box('dark', 12.3, 1.4, 18.4, 0, 7.6, 0); [-5.6, 5.6].forEach(z => K.box('gun', 12.4, 9.2, 1.2, 0, 4.6, z));
    for (let i = 0; i < 5; i++) round(K, -2.4 + (i % 2) * 2.4, -6 + i * 3, 8.4, 4.6, .85, i % 2 ? 'steel' : 'brass');
  };

  // ---------------------------------------------------------------- how each gun is held (plus_rig.js reads this)
  // k: long (shouldered) | pistol (both hands out front) | launcher (on the shoulder) | hip (heavy, from the hip)
  // f / y / x: where the support wrist goes, in metres of gun space (f along the barrel, y up from the grip fist)
  const HOLD = {
    pistol: { k: 'pistol', f: .01, y: -.075, x: .05, kick: 1 }, sppistol: { k: 'pistol', f: .01, y: -.075, x: .05, kick: .8 }, revolver: { k: 'pistol', f: .01, y: -.075, x: .05, kick: 1.5 },
    hcannon: { k: 'pistol', f: .01, y: -.075, x: .05, kick: 1.7 }, mpistol: { k: 'pistol', f: .01, y: -.075, x: .05, kick: .6 },
    smg: { f: .2, y: -.005, kick: .55 }, ssmg: { f: .2, y: -.005, kick: .5 }, tsmg: { f: .25, y: -.045, kick: .5 }, drum: { f: .27, y: -.045, kick: .6 },
    pump: { f: .36, y: 0, kick: 1.6 }, tshot: { f: .3, y: 0, kick: 1.2 }, hshot: { f: .31, y: -.01, kick: 1.5 }, dbarrel: { f: .22, y: .02, kick: 1.8 }, ashot: { f: .33, y: -.02, kick: 1 },
    m16: { f: .28, y: .03, kick: .75 }, scoped: { f: .28, y: .03, kick: .8 }, burst: { f: .29, y: .025, kick: .75 }, scar: { f: .29, y: .035, kick: .8 }, battle: { f: .29, y: .02, kick: 1 },
    lmg: { f: .3, y: .035, kick: .7 }, dmr: { f: .3, y: .03, kick: 1 }, hunting: { f: .32, y: .02, kick: 1.4 }, lever: { f: .27, y: .025, kick: 1.3 },
    bolt: { f: .3, y: .01, kick: 1.6 }, semis: { f: .3, y: .03, kick: 1.3 }, xbow: { f: .25, y: .02, kick: .6 },
    rocket: { k: 'launcher', f: .24, y: -.045, kick: 1.4 }, gl: { f: .31, y: -.03, kick: 1.2 }, mini: { k: 'hip', f: .0, y: .19, kick: .35 }
  };

  // ---------------------------------------------------------------- build / cache / assemble
  const CACHE = new Map();
  function build(kind, k) {
    const key = kind + ':' + k; if (CACHE.has(key)) return CACHE.get(key);
    const fn = kind === 'gun' ? R[k] : IT[k]; let c = null;
    if (fn) {
      try {
        const K = Kit(), info = Object.assign(fn(K) || {}, kind === 'gun' ? HOLD[k] : null), slots = []; K.parts.forEach((L, slot) => slots.push([slot, mergeList(L)]));
        const box = new THREE.Box3(); slots.forEach(([, g]) => box.union(g.boundingBox)); c = { slots, info, box };
      } catch (e) { console.warn('GasGuns: could not build', key, e); }
    }
    CACHE.set(key, c); return c;
  }
  function assemble(c, r, shadow) {
    const g = new THREE.Group();
    c.slots.forEach(([slot, geo]) => { const m = new THREE.Mesh(geo, matFor(slot, r)); m.castShadow = !!shadow && slot !== 'glow' && slot !== 'glass'; g.add(m); });
    return g;
  }
  // muzzle flash: a star facing back plus two flame tongues along the barrel, shown for a few frames per shot
  let FG = null, FMAT = null;
  function flash(s) {
    if (!FG) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.28, 'rgba(255,216,120,.95)'); gr.addColorStop(.62, 'rgba(255,140,40,.5)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
      x.fillStyle = gr; x.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2, q = i % 2 ? 12 : 32; x.lineTo(32 + Math.cos(a) * q, 32 + Math.sin(a) * q); } x.closePath(); x.fill();
      const tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding;
      FMAT = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
      const a = new THREE.PlaneGeometry(.17, .17), b = new THREE.PlaneGeometry(.28, .11), c = new THREE.PlaneGeometry(.28, .11), I = new THREE.Matrix4();
      b.rotateY(PI / 2); b.translate(0, 0, .13); c.rotateY(PI / 2); c.rotateZ(PI / 2); c.translate(0, 0, .13);
      FG = mergeList([{ g: a, m: I }, { g: b, m: I }, { g: c, m: I }], 1);
      const uv = new Float32Array(24); for (let i = 0; i < 3; i++) uv.set([0, 1, 1, 1, 0, 0, 1, 0], i * 8);   // mergeList drops uvs; each plane is 4 verts
      FG.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    const m = new THREE.Mesh(FG, FMAT); m.scale.setScalar(s); m.visible = false; m.renderOrder = 5; m.userData.flash = 1; m.frustumCulled = false; return m;
  }
  function model(k, r = 0, o = {}) {
    const c = build('gun', k); if (!c) return null;
    const g = assemble(c, r, o.shadow), I = c.info;
    Object.assign(g.userData, { gun: 1, v2: 1, hold: I, key: k + '|' + r, cz: (c.box.min.z + c.box.max.z) / 2, len: c.box.max.z - c.box.min.z });
    if (I.fl && !o.noFlash) { const f = flash(I.fl); f.position.set(0, I.m[1] * CM, I.m[0] * CM + .01); g.add(f); g.userData.flash = f; }
    return g;
  }
  function item(k, o = {}) {
    const c = build('item', k); if (!c) return null;
    const g = assemble(c, 0, o.shadow); g.userData.item = k; g.userData.h = c.box.max.y; return g;
  }

  // ---------------------------------------------------------------- icons: offscreen renders cached as blob URLs
  const ICONS = new Map(), Q = [], LIS = new Set();
  let IR = null, IS = null, ICam = null, busy = false, fail = false, idleT = 0;
  const ikey = (kind, k, r) => kind + ':' + k + ':' + (r || 0);
  function iEnsure() {
    if (IR || fail) return IR;
    try {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
      IR = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      IR.setPixelRatio(1); IR.setClearColor(0x000000, 0); IR.outputEncoding = THREE.sRGBEncoding; IR.toneMapping = THREE.ACESFilmicToneMapping; IR.toneMappingExposure = .95;
      IS = new THREE.Scene();
      IS.add(new THREE.HemisphereLight(0xeaf2ff, 0x3a4560, .75));
      const key = new THREE.DirectionalLight(0xffffff, 1.55); key.position.set(-3, 5, 2.5); IS.add(key);
      const fill = new THREE.DirectionalLight(0xbfe3ff, .45); fill.position.set(-4, -1, -3); IS.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, .9); rim.position.set(4, 3, -1); IS.add(rim);
      ICam = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 30);
    } catch (e) { fail = true; IR = null; }
    return IR;
  }
  function iRelease() { if (!IR || busy || Q.length) return; try { IR.dispose(); IR.forceContextLoss(); } catch (e) { } IR = null; IS = null; ICam = null; }
  function toURL(cv) { const d = cv.toDataURL('image/png'), b = atob(d.slice(d.indexOf(',') + 1)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return URL.createObjectURL(new Blob([u], { type: 'image/png' })); }
  function iRender(job) {
    const r = iEnsure(); if (!r) return null;
    const W = job.kind === 'gun' ? 256 : 128, H = 128; r.setSize(W, H, false);
    let obj = null, own = false, el = .32;
    if (job.kind === 'gun') { obj = model(job.k, job.r, { noFlash: true }); if (obj) obj.rotation.y = -.3; el = .2; }
    else if (job.kind === 'item') { obj = item(job.k); if (obj) obj.rotation.y = -.55; el = .42; }
    else if (job.kind === 'pick') {
      const pd = typeof getCosmeticById === 'function' ? getCosmeticById('pickaxe', job.k) : null;
      if (pd && typeof CharacterRigBuilder !== 'undefined') { const p = CharacterRigBuilder.buildPickaxeMesh(pd), t = new THREE.Group(); p.rotation.y = PI / 2; t.add(p); t.rotation.x = -.72; obj = new THREE.Group(); obj.add(t); own = true; el = .15; }
    }
    if (!obj) return null;
    IS.add(obj); obj.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(obj), c = bb.getCenter(new THREE.Vector3());
    ICam.position.set(c.x - Math.cos(el) * 8, c.y + Math.sin(el) * 8, c.z); ICam.up.set(0, 1, 0); ICam.lookAt(c); ICam.updateMatrixWorld(true);
    const inv = ICam.matrixWorldInverse, v = new THREE.Vector3(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    obj.traverse(m => { if (!m.isMesh || m.userData.flash) return; const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld).applyMatrix4(inv); if (v.x < x0) x0 = v.x; if (v.x > x1) x1 = v.x; if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; } });
    let w = (x1 - x0) * 1.1, h = (y1 - y0) * 1.1; if (w / h > W / H) h = w * H / W; else w = h * W / H;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; ICam.left = cx - w / 2; ICam.right = cx + w / 2; ICam.top = cy + h / 2; ICam.bottom = cy - h / 2; ICam.near = .01; ICam.far = 30; ICam.updateProjectionMatrix();
    r.clear(); r.render(IS, ICam); IS.remove(obj);
    if (own) obj.traverse(m => { if (m.isMesh && m.userData.unique) m.geometry.dispose(); });
    return toURL(r.domElement);
  }
  const imgTag = (url, cls) => `<img class="gi ${cls || ''}" src="${url}" draggable="false" alt="">`;
  function pump() {
    if (busy || !Q.length) return;
    busy = true; clearTimeout(idleT);
    setTimeout(() => {                                   // a timer, not rAF: renders even when the game drives its own loop
      const t0 = performance.now(); let done = 0;
      do {
        const job = Q.shift(); let url = null;
        try { url = iRender(job); } catch (e) { console.warn('GasGuns: icon render failed', job.key, e); }
        ICONS.set(job.key, url || ''); done++;
        if (url) document.querySelectorAll(`[data-gi="${job.key}"]`).forEach(el => { el.outerHTML = imgTag(url, el.dataset.gc); });
      } while (Q.length && performance.now() - t0 < 6);
      busy = false; if (done) LIS.forEach(f => { try { f(); } catch (e) { } });
      if (Q.length) pump(); else idleT = setTimeout(iRelease, 20000);
    }, 24);
  }
  function icon(kind, k, r) {
    const key = ikey(kind, k, r); if (ICONS.has(key)) return ICONS.get(key);
    if (fail || typeof THREE === 'undefined') return '';
    if (!Q.some(j => j.key === key)) Q.push({ key, kind, k, r: r || 0 });
    setTimeout(pump, 0); return null;
  }
  function iconHTML(kind, k, r, fallback, cls = '') {
    const u = icon(kind, k, r);
    return u ? imgTag(u, cls) : `<span class="gi-f ${cls}" data-gi="${ikey(kind, k, r)}" data-gc="${cls}">${fallback || ''}</span>`;
  }
  return {
    model, item, has: k => !!R[k], hasItem: k => !!IT[k], RAR, icon, iconHTML,
    warm: list => list.forEach(j => icon(j[0], j[1], j[2])),
    onIcon: f => LIS.add(f), keys: () => Object.keys(R)
  };
})();
