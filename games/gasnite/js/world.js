// ===== GASNITE WORLD: 20x island, mountains, rivers, swimming, storm, smarter bots, usernames, world map =====
window.GasWorld = (() => {
  const WR = 1000, ISL = 640, SX = 4000, SZ = 0, V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), rnd = (a, b) => a + Math.random() * (b - a), ri = n => Math.floor(Math.random() * n);
  const sm = (a, b, x) => { x = Math.max(0, Math.min(1, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  /* ---------- terrain definition (pure maths: height, rivers, lakes, towns) ---------- */
  /* ---------- island definition: irregular coast, bay, islets, winding rivers, lakes, mountain ranges, biomes ---------- */
  // Designed in "design units" and scaled by K. Rivers / lakes / ranges / farms / swamp are rasterised once into fields so that
  // the 3D terrain, collision, swimming and the in-game map all read exactly the same data.
  const K = 1.22, GR = 512, GC = WR * 2 / GR, G1 = GR + 1;
  const mkF = () => new Float32Array(G1 * G1), RVF = mkF(), LKF = mkF(), MHF = mkF(), FMF = mkF(), SWF = mkF(), RDF = mkF();   // RDF: near a road (trees keep off it)
  const hsh = (i, j) => { let h = (i * 374761393 + j * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  const vn = (x, z) => { const i = Math.floor(x), j = Math.floor(z), fu = x - i, fv = z - j, u = fu * fu * (3 - 2 * fu), v = fv * fv * (3 - 2 * fv); return (hsh(i, j) * (1 - u) + hsh(i + 1, j) * u) * (1 - v) + (hsh(i, j + 1) * (1 - u) + hsh(i + 1, j + 1) * u) * v; };
  const fbm = (x, z, o = 4) => { let a = .5, f = 1, s = 0, n = 0; for (let k = 0; k < o; k++) { s += a * vn(x * f + k * 17.3, z * f + k * 5.1); n += a; a *= .5; f *= 2.03; } return s / n * 2 - 1; };
  const nz = (x, z) => Math.sin(x * .011 + 1.3) * Math.cos(z * .013) * .55 + Math.sin(x * .031 + z * .027) * .3 + Math.sin(x * .07 - z * .05 + 2) * .15;
  const angd = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const fs = (A, x, z) => { const u = (x + WR) / GC, v = (z + WR) / GC; if (u < 0 || v < 0 || u >= GR || v >= GR) return 0; const i = u | 0, j = v | 0, fu = u - i, fv = v - j, k = j * G1 + i; return (A[k] * (1 - fu) + A[k + 1] * fu) * (1 - fv) + (A[k + G1] * (1 - fu) + A[k + G1 + 1] * fu) * fv; };
  function splat(A, x, z, rad, fn) { const i0 = Math.max(0, Math.floor((x - rad + WR) / GC)), i1 = Math.min(GR, Math.ceil((x + rad + WR) / GC)), j0 = Math.max(0, Math.floor((z - rad + WR) / GC)), j1 = Math.min(GR, Math.ceil((z + rad + WR) / GC)); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const wx = i * GC - WR, wz = j * GC - WR, d = Math.hypot(wx - x, wz - z); if (d < rad) { const v = fn(d, wx, wz), k = j * G1 + i; if (v > A[k]) A[k] = v; } } }
  const dseg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const P2 = a => [a[0] * K, a[1] * K];
  // rivers (design coords) -> meandering polylines -> river field
  const RIVERS = [[[-380, -330], [-300, -200], [-180, -110], [-100, -45], [-108, -20]], [[70, -25], [190, -10], [300, 30], [420, 40], [520, 60]], [[80, -470], [60, -360], [-10, -250], [-30, -105]], [[-20, 70], [10, 200], [60, 300], [80, 340]], [[330, -330], [260, -230], [200, -130], [205, -8]], [[-110, 400], [-230, 420], [-340, 470], [-410, 530]], [[-420, 170], [-300, 140], [-200, 90], [-112, -8]]];
  const RPTS = RIVERS.map((r, ri) => { const pts = r.map(P2), out = []; let L = 0; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.ceil(len / 8)); for (let s = 0; s < n; s++) { const t = s / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, nx = -(b[1] - a[1]) / len, nzz = (b[0] - a[0]) / len, L2 = L + s * len / n, m = Math.sin(L2 * .018 + ri * 2.1) * 26 + Math.sin(L2 * .047 + ri) * 9, fade = Math.min(1, Math.min(L2 / 60, 1) + 0); out.push([x + nx * m * (i === 0 && s < 4 ? .2 : 1), z + nzz * m * (i === 0 && s < 4 ? .2 : 1), L2]); } L += len; } out.push([pts[pts.length - 1][0], pts[pts.length - 1][1], L]); return { pts: out, L }; });
  RPTS.forEach(r => r.pts.forEach(p => { const w = 9 + 7 * (p[2] / r.L); splat(RVF, p[0], p[1], w * 2.2, d => 1 - sm(w * .5, w * 1.7, d)); }));
  // lakes (ellipses with a noisy shoreline): cx, cz, rx, rz, rot
  [[-30, -20, 112, 94, .3], [100, 385, 250, 88, .12], [-430, 20, 60, 44, .6], [390, 300, 54, 40, 0]].forEach((l, li) => { const cx = l[0] * K, cz = l[1] * K, rx = l[2] * K, rz = l[3] * K, rad = Math.max(rx, rz) * 1.4, c = Math.cos(l[4]), s = Math.sin(l[4]); splat(LKF, cx, cz, rad, (d, wx, wz) => { const dx = wx - cx, dz = wz - cz, lx = dx * c + dz * s, lz = -dx * s + dz * c, r = Math.hypot(lx / rx, lz / rz) * (1 + .2 * nz(wx * .03 + li * 9, wz * .03)); return 1 - sm(.72, 1, r); }); });
  // mountain ranges (spines): points, height, sigma
  [[[[-460, -380], [-380, -300], [-300, -330], [-240, -400]], 125, 52], [[[-20, -500], [100, -520], [220, -470]], 72, 46], [[[380, 230], [460, 300], [420, 380]], 108, 48], [[[-560, 330], [-520, 420]], 55, 40]].forEach(m => { const sp = m[0].map(P2), S = m[2] * K; for (let i = 0; i < sp.length - 1; i++) { const a = sp[i], b = sp[i + 1], bx0 = Math.min(a[0], b[0]), bx1 = Math.max(a[0], b[0]), bz0 = Math.min(a[1], b[1]), bz1 = Math.max(a[1], b[1]); splat(MHF, (bx0 + bx1) / 2, (bz0 + bz1) / 2, Math.hypot(bx1 - bx0, bz1 - bz0) / 2 + S * 3, (d, wx, wz) => { const dd = dseg(wx, wz, a, b); return m[1] * Math.exp(-dd * dd / (2 * S * S)) * (.78 + .5 * Math.abs(Math.sin(wx * .035 + nz(wx, wz) * 3) * Math.cos(wz * .03))); }); } });
  // farmland + swamp regions (ellipses)
  [[-320, 230, 170, 120, FMF], [250, 165, 105, 85, FMF], [360, -310, 175, 150, SWF]].forEach((f, fi) => { const cx = f[0] * K, cz = f[1] * K, rx = f[2] * K, rz = f[3] * K; splat(f[4], cx, cz, Math.max(rx, rz) * 1.3, (d, wx, wz) => 1 - sm(.55, 1, Math.hypot((wx - cx) / rx, (wz - cz) / rz) * (1 + .22 * nz(wx * .02 + fi * 7, wz * .02)))); });
  const r0f = a => 520 + 60 * Math.sin(3 * a + .6) + 45 * Math.sin(5 * a + 2) + 30 * Math.cos(8 * a + 1) + 115 * Math.exp(-(angd(a, -.8) ** 2) / .1) + 130 * Math.exp(-(angd(a, 2.5) ** 2) / .08) + 70 * Math.exp(-(angd(a, -2.3) ** 2) / .12);
  const BAYS = [[.12, 200], [-2.75, 175], [2.05, 150], [.85, 130], [-1.45, 115], [2.6, 120]].map(b => { const rr = r0f(b[0]) * K * .97; return [Math.cos(b[0]) * rr, Math.sin(b[0]) * rr, b[1] * K]; }), ISLET = [[560, -40, 30], [650, 110, 26], [520, 120, 22], [-540, -430, 40], [-470, -500, 26], [-380, -520, 34], [-600, -340, 22], [-300, -580, 20], [-640, 560, 34], [760, -560, 36], [300, 700, 40], [420, 690, 26], [-800, 100, 22], [-720, -520, 24]].map(l => [l[0] * K, l[1] * K, l[2] * K]);
  const FZ = [[-470, 20, 170], [300, 330, 140], [-130, -400, 150], [140, -60, 90]].map(f => [f[0] * K, f[1] * K, f[2] * K]);
  const forestW = (x, z) => { let b = 0; for (const f of FZ) { const d = Math.hypot(x - f[0], z - f[1]); b += Math.exp(-d * d / (2 * (f[2] * .6) ** 2)) * .9; } return sm(.0, .4, fbm(x * .0075 + 50, z * .0075, 4) + b); };
  const TOWNS = [['Crownport', 407, -161, 'city', 68.2], ['Skyspire', -105, 258, 'city', 66], ['Willow Creek', -285, -109, 'village', 44], ['Birch Hollow', -428, -14, 'village', 41.8], ['Stone Mill', 150, -457, 'village', 39.6], ['Ironbay Docks', 601, -194, 'docks', 48.4], ['Smokestack Yard', 342, 160, 'factory', 55], ['Aether Labs', -37, -24, 'research', 28.6], ['Cryo Station', -277, -453, 'research', 26.4], ['Harvest Hill', -391, 275, 'farm', 52.8], ['Golden Acres', 254, 245, 'farm', 44], ['Murk Bog', 311, -404, 'swamp', 46.2], ['Elder Grove', -561, 97, 'grove', 33], ['Summit Lodge', 27, -553, 'lodge', 22], ['Sunset Cove', -631, 289, 'beach', 39.6], ['Pearl Bay', 527, 64, 'beach', 37.4], ['Misty Pier', 287, 394, 'docks', 41.8], ['Old Quarry', -165, -334, 'ruins', 44], ['Ghost Mill', 176, 332, 'ruins', 46.2], ['Shadow Bunker', -521, 239, 'bunker', 17.6], ['Sunken Vault', -659, -525, 'vault', 17.6], ['Deepwater Rig', 927, -683, 'rig', 19.8], ['Lighthouse Rock', -781, 683, 'lighthouse', 15.4], ['Frost Keep', 409, 8, 'bunker', 19.8]];
  const base = (x, z) => {
    const d = Math.hypot(x, z) / K, a = Math.atan2(z, x), r0 = r0f(a);
    let e = (r0 + fbm(x * .006 + 40, z * .006, 5) * 95 + fbm(x * .017 + 3, z * .017, 3) * 22 - d) * K / 95, h; for (const b of BAYS) e -= 6.5 * (1 - sm(0, b[2], Math.hypot(x - b[0], z - b[1]) * (1 + .25 * fbm(x * .01, z * .01, 3))));
    const n = fbm(x * .006, z * .006, 4), land = sm(-.1, .25, e);
    if (e > 0) { const v = 4.5 + n * 8 + fbm(x * .02 + 9, z * .02, 3) * 2.2; h = Math.min(e, 1) * 3 + sm(0, .4, e) * (1.5 + Math.max(0, v - 1.5)); } else h = e * 16;
    h += fs(MHF, x, z) * land;
    const fw = fs(FMF, x, z) * land, sw = fs(SWF, x, z) * land; h = h * (1 - fw) + (8.5 + n * 1.5) * fw; h = h * (1 - sw) + (1.9 + n * .6) * sw;
    const pond = sw * sm(.12, .3, fbm(x * .03 + 11, z * .03 + 5, 3)); h = h * (1 - pond) - 1.3 * pond;
    const rv = fs(RVF, x, z) * sm(0, .12, e); h = h * (1 - rv) - 2.8 * rv; const lk = fs(LKF, x, z); h = h * (1 - lk) - 3.6 * lk;
    h += 13 * Math.exp(-(((x + 30 * K) ** 2) + ((z + 20 * K) ** 2)) / (2 * 21 * 21 * K * K));
    for (const s of ISLET) { const dd = Math.hypot(x - s[0], z - s[1]) * (1 + .85 * fbm(x * .05 + s[0], z * .05 + s[1], 3)); if (dd < s[2] * 3) { const m = Math.exp(-(dd * dd) / (2 * (s[2] * .6) ** 2)); h = h * (1 - m) + (3.6 + s[2] * .09 + n * 1.2) * m; } }
    return h;
  };
  const FP = TOWNS.map(t => ({ x: t[1], z: t[2], r: t[4], h: t[3] === 'lodge' ? base(t[1], t[2]) : Math.max(base(t[1], t[2]), 2.2) }));
  const HFM = (x, z) => { let h = base(x, z); for (const p of FP) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r + 16) { const f = 1 - sm(p.r, p.r + 16, d); h += (p.h - h) * f; } } return h; };
  const HS = (x, z) => { const lx = x - SX, lz = z - SZ, r = Math.hypot(lx, lz), mx = lx + 95, mz = lz + 55; let h = 4 * (1 - sm(90, 150, r)) - 6 * sm(150, 190, r); h += Math.sin(lx * .04) * Math.cos(lz * .05) * 1.2 * (1 - sm(60, 120, r)); h += 42 * Math.exp(-(mx * mx + mz * mz) / (2 * 26 * 26)) * (1 - sm(130, 170, r)); return h; };
  const HF = (x, z) => x > 2500 ? HS(x, z) : HFM(x, z);
  /* ---------- colliders (buildings + trees) in a spatial grid ---------- */
  const CS = 16, grid = new Map(), EMPTY = [], gk = (i, j) => (i + 120) * 400 + (j + 120);
  const near = (x, z) => grid.get(gk(Math.floor(x / CS), Math.floor(z / CS))) || EMPTY;
  function reg(b) { for (let i = Math.floor((b.x0 - 2) / CS); i <= Math.floor((b.x1 + 2) / CS); i++) for (let j = Math.floor((b.z0 - 2) / CS); j <= Math.floor((b.z1 + 2) / CS); j++) { const k = gk(i, j); (grid.get(k) || grid.set(k, []).get(k)).push(b); } }
  function unreg(b) { for (let i = Math.floor((b.x0 - 2) / CS); i <= Math.floor((b.x1 + 2) / CS); i++) for (let j = Math.floor((b.z0 - 2) / CS); j <= Math.floor((b.z1 + 2) / CS); j++) { const a = grid.get(gk(i, j)); if (a) { const k = a.indexOf(b); if (k >= 0) a.splice(k, 1); } } }
  // colliders are boxes {x0,x1,z0,z1,y0,y1}; a box with .ramp = {ax:'x'|'z', s:±1} is a solid wedge whose top slopes from y0 to y1 (stairs, roofs, build ramps)
  const rampH = (b, x, z) => { const t = Math.max(0, Math.min(1, b.ramp.ax === 'x' ? (x - b.x0) / (b.x1 - b.x0) : (z - b.z0) / (b.z1 - b.z0))); return b.y0 + (b.ramp.s > 0 ? t : 1 - t) * (b.y1 - b.y0); };
  const topAt = (b, x, z) => b.ramp ? rampH(b, x, z) : b.y1;
  const surface = (x, z, y) => { let g = HF(x, z); for (const b of near(x, z)) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) { const t = topAt(b, x, z); if (y >= t - .7 && t > g) g = t; } return g; };
  function step(a, dx, dz) {
    const p = a.p; let nx = p.x + dx, nz = p.z + dz;
    for (const b of near(nx, nz)) if (nx > b.x0 - .45 && nx < b.x1 + .45 && nz > b.z0 - .45 && nz < b.z1 + .45 && p.y + 1.75 > b.y0 && p.y < topAt(b, Math.max(b.x0, Math.min(b.x1, nx)), Math.max(b.z0, Math.min(b.z1, nz))) - .6) { const ox = Math.min(nx - (b.x0 - .45), b.x1 + .45 - nx), oz = Math.min(nz - (b.z0 - .45), b.z1 + .45 - nz); if (ox < oz) nx += nx < (b.x0 + b.x1) / 2 ? -ox : ox; else nz += nz < (b.z0 + b.z1) / 2 ? -oz : oz; }
    const run = Math.hypot(nx - p.x, nz - p.z) || 1e-6, hc = HF(p.x, p.z);
    if (!a.swim && HF(nx, nz) - hc > run * .8 + .04 && p.y < HF(nx, nz) - .5) { if (HF(nx, p.z) - hc <= Math.abs(nx - p.x) * .8 + .04) { nz = p.z; } else if (HF(p.x, nz) - hc <= Math.abs(nz - p.z) * .8 + .04) { nx = p.x; } else { nx = p.x; nz = p.z; } }
    p.x = nx; p.z = nz;
  }
  function vert(a, dt, jump) {
    const g = surface(a.p.x, a.p.z, a.p.y); a.swim = HF(a.p.x, a.p.z) < -.45 && g < -.45;
    if (a.swim) { a.vy = 0; a.air = false; a.p.y += (-.4 - a.p.y) * Math.min(1, dt * 8); return; }
    if (jump && !a.air) a.vy = 9.5; a.vy -= 32 * dt; a.p.y += a.vy * dt;
    if (a.vy > 0) for (const b of near(a.p.x, a.p.z)) if (!b.ramp && a.p.x > b.x0 && a.p.x < b.x1 && a.p.z > b.z0 && a.p.z < b.z1 && b.y0 > a.p.y + .6 && b.y0 < a.p.y + 1.9) { a.vy = 0; a.p.y = b.y0 - 1.9; }
    if (a.p.y < g) { const need = g - a.p.y; a.p.y += a.vy < -1 ? need : Math.min(need, .35); a.vy = Math.max(a.vy, 0); } a.air = a.p.y > g + .12;
  }
  // first collider hit by the segment a→b (slab test per box; thin walls can't be skipped). skip(c) can ignore colliders.
  let segStamp = 0;
  function segHit(ax, ay, az, bx, by, bz, skip) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 4)), D = [dx, dy, dz], A = [ax, ay, az];
    let best = null, bt = 1; segStamp++;
    for (let s = 0; s <= n; s++) {
      for (const c of near(ax + dx * s / n, az + dz * s / n)) {
        if (c._st === segStamp) continue; c._st = segStamp; if (skip && skip(c)) continue;
        const lo = [c.x0, c.y0, c.z0], hi = [c.x1, c.ramp ? (c.y0 + c.y1) / 2 : c.y1, c.z1]; let t0 = 0, t1 = bt, ok = true;
        for (let k = 0; k < 3 && ok; k++) { if (Math.abs(D[k]) < 1e-9) { if (A[k] < lo[k] || A[k] > hi[k]) ok = false; } else { let ta = (lo[k] - A[k]) / D[k], tb = (hi[k] - A[k]) / D[k]; if (ta > tb) { const q = ta; ta = tb; tb = q; } if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) ok = false; } }
        if (ok) { bt = t0; best = c; }
      }
    }
    return best ? { c: best, t: bt } : null;
  }
  /* ---------- destructible world: trees, house wall bays, furniture and small solid buildings ----------
     A collider with .D belongs to a breakable object D = { kind, mat, hp, max, cols, (tree | bd | batch + vr), x, y, z, name }.
     Pickaxe hits do 50, bullets their damage, rockets splash. Everything is restored when a new match starts. */
  let INST = {};
  const SMASHED = [], HURT = new Set(), DEB = [], debGeo = new THREE.BoxGeometry(.2, .2, .2), debMat = new Map(), _M0 = new THREE.Matrix4().makeScale(0, 0, 0), _cc = new THREE.Color();
  function rangeUp(a, off, n) { const u = a.updateRange; if (u.count === -1) { u.offset = off; u.count = n; } else { const e = Math.max(u.offset + u.count, off + n); u.offset = Math.min(u.offset, off); u.count = e - u.offset; } a.needsUpdate = true; }
  function colOf(D) {
    if (D.col) return D.col;
    if (D.batch && D.batch.geo && D.vr.length) { const c = D.batch.geo.attributes.color, s = D.vr[0][0]; D.col = '#' + _cc.setRGB(c.getX(s), c.getY(s), c.getZ(s)).getHexString(); }
    else if (D.bd != null && INST.bm && INST.bm.instanceColor) { const a = INST.bm.instanceColor.array; D.col = '#' + _cc.setRGB(a[D.bd * 3], a[D.bd * 3 + 1], a[D.bd * 3 + 2]).getHexString(); }
    else D.col = D.kind === 'tree' ? '#6b4a2a' : '#b9b2a6';
    return D.col;
  }
  function debris(x, y, z, col, n, s) {
    if (PL && PL.p && Math.hypot(x - PL.p.x, z - PL.p.z) > 140) return;   // nobody would see it
    let mt = debMat.get(col); if (!mt) { mt = new THREE.MeshLambertMaterial({ color: col }); debMat.set(col, mt); }
    for (let i = 0; i < n; i++) { const p = new THREE.Mesh(debGeo, mt); p.position.set(x + rnd(-.3, .3), y + rnd(-.3, .3), z + rnd(-.3, .3)); p.scale.setScalar(s * rnd(.6, 1.5)); matchGroup.add(p); DEB.push({ m: p, v: V(rnd(-3.5, 3.5), rnd(2, 7), rnd(-3.5, 3.5)), t: rnd(.5, 1.1) }); }
    while (DEB.length > 180) matchGroup.remove(DEB.shift().m);
  }
  function debrisTick(dt) { for (let i = DEB.length - 1; i >= 0; i--) { const d = DEB[i]; d.t -= dt; d.v.y -= 20 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += dt * 7; d.m.rotation.z += dt * 5; if (d.t <= 0) { matchGroup.remove(d.m); DEB.splice(i, 1); } } }
  function hideInst(mesh, i, D) { const a = mesh.instanceMatrix; D.save.push([a, i * 16, a.array.slice(i * 16, i * 16 + 16)]); mesh.setMatrixAt(i, _M0); rangeUp(a, i * 16, 16); }
  function smash(D) {
    if (D.dead) return; D.dead = true; D.save = []; D.cols.forEach(unreg); SMASHED.push(D);
    const col = colOf(D);
    if (D.tree) { hideInst(INST.km, D.tree.k, D); hideInst(D.tree.oak ? INST.om : INST.pm, D.tree.c, D); debris(D.x, D.y + 2.5, D.z, '#3f7d2c', 10, 1.6); }
    else if (D.bd != null) { hideInst(INST.bm, D.bd, D); hideInst(INST.rm, D.bd, D); }
    else if (D.door) { if (DOORS) { hideInst(DOORS.pm, D.door.i, D); hideInst(DOORS.hm, D.door.i, D); } D.door.broken = true; D.door.colOn = false; }
    else if (D.batch && D.batch.geo) { const a = D.batch.geo.attributes.position; for (const [s, n] of D.vr) { D.save.push([a, s * 3, a.array.slice(s * 3, (s + n) * 3)]); const x = a.getX(s), y = a.getY(s), z = a.getZ(s); for (let v = s; v < s + n; v++) a.setXYZ(v, x, y, z); rangeUp(a, s * 3, n * 3); } }
    debris(D.x, D.y, D.z, col, D.kind === 'furn' || D.kind === 'door' ? 7 : 14, D.kind === 'furn' || D.kind === 'door' ? 1 : 1.6);
    if (D.link) D.link.forEach(smash);   // a wall takes its door down with it
  }
  function restoreWorld() {
    for (const D of SMASHED) { for (const [a, off, arr] of D.save) { a.array.set(arr, off); rangeUp(a, off, arr.length); } D.save = null; D.dead = false; D.hp = D.max; D.cols.forEach(reg); if (D.door) { D.door.broken = false; D.door.colOn = true; } }
    SMASHED.length = 0; HURT.forEach(D => { D.hp = D.max; }); HURT.clear(); DEB.forEach(d => matchGroup.remove(d.m)); DEB.length = 0;
  }
  /* ---------- working doors: one instanced mesh for every door leaf on the island (+ one for the brass hardware).
     A closed door is a collider (blocks movement, bullets and sight); E opens / closes the nearest one, bots open doors
     they walk up to, doors can be shot or smashed, a broken wall takes its door with it, and every match starts closed. */
  let DOORS = null; const _DM = new THREE.Matrix4(), _dq = new THREE.Quaternion(), _dy = new THREE.Vector3(0, 1, 0), _dp = new THREE.Vector3(), _ds = new THREE.Vector3(1, 1, 1);
  function doorMat(d, m) { const e = d.a * d.a * (3 - 2 * d.a); _dq.setFromAxisAngle(_dy, d.yaw0 + d.s * 1.72 * e); return m.compose(_dp.set(d.hx, d.by, d.hz), _dq, _ds); }
  function doorWrite(d) { doorMat(d, _DM); DOORS.pm.setMatrixAt(d.i, _DM); DOORS.hm.setMatrixAt(d.i, _DM); rangeUp(DOORS.pm.instanceMatrix, d.i * 16, 16); rangeUp(DOORS.hm.instanceMatrix, d.i * 16, 16); }
  function makeDoors() {
    const L = []; HOUSES.forEach(h => (h.doors || []).forEach(d => L.push(d))); if (!L.length || !window.GasHouses || !GasHouses.doorGeo) return;
    const g = GasHouses.doorGeo(), dmat = new THREE.MeshLambertMaterial({ vertexColors: true }), pm = new THREE.InstancedMesh(g.panel, window.GasTex ? GasTex.apply(dmat, 'grain', 1.1) : dmat, L.length), hm = new THREE.InstancedMesh(g.hw, new THREE.MeshLambertMaterial({ vertexColors: true }), L.length), cc = new THREE.Color();
    DOORS = { list: L, pm, hm, bt: 0 };
    L.forEach((d, i) => {
      d.i = i; d.a = 0; d.t = 0; d.open = false; d.broken = false;
      const ax = d.alongX ? 1 : 0, az = d.alongX ? 0 : 1, nx = d.alongX ? 0 : -d.out, nz = d.alongX ? -d.out : 0;   // along the wall / into the house
      d.yaw0 = Math.atan2(-az, ax); const t = d.yaw0 + Math.PI / 2; d.s = Math.cos(t) * nx - Math.sin(t) * nz > 0 ? 1 : -1;   // doors swing inwards
      d.hx = d.alongX ? d.u - d.w / 2 : d.wc; d.hz = d.alongX ? d.wc : d.u - d.w / 2; d.cx = d.alongX ? d.u : d.wc; d.cz = d.alongX ? d.wc : d.u;
      const c = d.alongX ? { x0: d.u - d.w / 2, x1: d.u + d.w / 2, z0: d.wc - .07, z1: d.wc + .07 } : { x0: d.wc - .07, x1: d.wc + .07, z0: d.u - d.w / 2, z1: d.u + d.w / 2 };
      Object.assign(c, { y0: d.by, y1: d.by + d.h, t: 'door', house: d.house, door: d }); d.col = c;
      c.D = { kind: 'door', mat: 'wood', hp: 120, max: 120, cols: [c], door: d, x: d.cx, y: d.by + 1.2, z: d.cz, name: 'Door', col: d.paint };
      reg(c); d.colOn = true; if (d.bay) (d.bay.link || (d.bay.link = [])).push(c.D);
      pm.setColorAt(i, cc.set(d.paint).convertSRGBToLinear()); doorWrite(d);
    });
    pm.frustumCulled = hm.frustumCulled = false; pm.castShadow = hm.castShadow = true; pm.receiveShadow = true; WG.add(pm, hm);
  }
  function setDoor(d, open, by) {
    if (!d || d.broken || d.open === open) return false; d.open = open; d.t = open ? 1 : 0;
    if (open && d.colOn) { unreg(d.col); d.colOn = false; } else if (!open && !d.colOn) { reg(d.col); d.colOn = true; }
    if (by === 'player') noise(d.cx, d.cz, 0);   // bots inside hear you come in
    return true;
  }
  function resetDoors() { if (!DOORS) return; for (const d of DOORS.list) { if (!d.colOn && !d.broken) { reg(d.col); d.colOn = true; } d.open = false; d.a = d.t = 0; doorWrite(d); } }
  function doorTick(dt) {
    if (!DOORS) return;
    for (const d of DOORS.list) if (!d.broken && d.a !== d.t) { d.a = d.t > d.a ? Math.min(d.t, d.a + dt * 4.5) : Math.max(d.t, d.a - dt * 4.5); doorWrite(d); }
    if ((DOORS.bt -= dt) > 0) return; DOORS.bt = .15;
    for (const b of brState.bots) { if (b.st !== 'ground' || b.dead || b.knocked) continue; near(b.p.x, b.p.z).filter(c => c.t === 'door' && Math.abs(b.p.y - c.door.by) < 1.6 && Math.hypot(b.p.x - c.door.cx, b.p.z - c.door.cz) < 2.1).forEach(c => setDoor(c.door, true)); }   // bots open doors they walk up to
  }
  function doorNear(x, z, y, max = 2.4) { if (!DOORS) return null; let best = null, bd = max; for (const d of DOORS.list) { if (d.broken || Math.abs(y - d.by) > 1.7) continue; const dd = Math.hypot(x - d.cx, z - d.cz); if (dd < bd) { bd = dd; best = d; } } return best; }
  // structure health bar under the crosshair while you hit something
  let shpEl = null, shpT = 0;
  function showHP(name, hp, max) {
    if (!shpEl) { shpEl = document.createElement('div'); shpEl.id = 'gw-shp'; document.body.appendChild(shpEl); const st = document.createElement('style'); st.textContent = '#gw-shp{position:fixed;left:50%;top:calc(50% + 34px);transform:translateX(-50%);z-index:30;pointer-events:none;display:flex;align-items:center;gap:6px;font:900 12px sans-serif;color:#fff;text-shadow:0 1px 2px #000;transition:opacity .25s;opacity:0}#gw-shp i{display:block;width:86px;height:7px;background:#0009;border:1px solid #fff8;border-radius:4px;overflow:hidden}#gw-shp u{display:block;height:100%;background:linear-gradient(90deg,#38bdf8,#7dd3fc)}'; document.head.appendChild(st); }
    shpEl.innerHTML = `<b>${name}</b><i><u style="width:${Math.max(0, hp) / max * 100}%"></u></i><span>${Math.max(0, Math.ceil(hp))}</span>`; shpEl.style.opacity = 1; shpT = 1.3;
  }
  function damageWorld(D, dmg, by, pt) {
    if (!D || D.dead || dmg <= 0) return false;
    D.hp -= dmg; HURT.add(D); if (pt) debris(pt.x, pt.y, pt.z, colOf(D), 2, .7);
    if (by === 'player') showHP(D.name, D.hp, D.max);
    if (D.hp <= 0) smash(D); return true;
  }
  // a pickaxe / bullet / rocket hitting collider c (world object or build piece)
  function hitThing(c, dmg, by, pt, pick) {
    if (c.piece) { if (window.GasBuild) { GasBuild.hit(c.piece, dmg, by); if (by === 'player') showHP(c.piece.mat[0].toUpperCase() + c.piece.mat.slice(1) + ' ' + c.piece.k, c.piece.hp, c.piece.max); } return true; }
    if (pick && by === 'player' && window.GasBuild) GasBuild.harvest(c, pt);
    return c.D ? damageWorld(c.D, dmg, by, pt) : false;
  }
  // rockets and grenades: splash damage to everything breakable nearby
  function blast(x, y, z, R, dmg, by) {
    const seen = new Set();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const c of near(x + i * R, z + j * R)) {
      if (seen.has(c) || !(c.D || c.piece)) continue; seen.add(c);
      const cx = Math.max(c.x0, Math.min(c.x1, x)), cy = Math.max(c.y0, Math.min(c.y1, y)), cz = Math.max(c.z0, Math.min(c.z1, z)), d = Math.hypot(cx - x, cy - y, cz - z);
      if (d < R) hitThing(c, dmg * (1 - d / R * .6), by, null, false);
    }
  }
  const okSpot =(x, z, rad = 2.2) => { const h = HF(x, z); if (h < 1 || h > 40 || Math.abs(x) > WR - 60 || Math.abs(z) > WR - 60 || slope(x, z) > .5) return false; for (const b of near(x, z)) if (x > b.x0 - rad && x < b.x1 + rad && z > b.z0 - rad && z < b.z1 + rad) return false; for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (HF(x + dx, z + dz) < .4) return false; return true; };
  function spot(townBias) { for (let n = 0; n < 200; n++) { let x, z; if (townBias && Math.random() < townBias) { const t = TOWNS[ri(TOWNS.length)]; if (['vault', 'rig', 'lighthouse'].includes(t[3])) continue; const a = rnd(0, 6.28), r = rnd(4, t[4] * 1.1); x = t[1] + Math.cos(a) * r; z = t[2] + Math.sin(a) * r; } else { x = rnd(-WR + 80, WR - 80); z = rnd(-WR + 80, WR - 80); } if (okSpot(x, z)) return { x, z }; } return { x: -90, z: 60 }; }
  /* ---------- world meshes (built once) ---------- */
  let WG = null, mapCv = null, built = false;
  /* ---------- world meshes: built in small slices (generator) so the menu never freezes; start() finishes it if needed ---------- */
  let iter = null;
  function build() { if (built) return; if (!iter) iter = buildGen(); while (!iter.next().done); built = true; }
  function preload() { if (window.GasTex) GasTex.warm(); if (built || iter || typeof setTimeout !== 'function') return; iter = buildGen(); const tick = () => { if (built) return; const t = performance.now(); while (performance.now() - t < 12) { if (iter.next().done) { built = true; return; } } setTimeout(tick, 0); }; setTimeout(tick, 1500); }
  // ground: a grass / soil detail texture tiled every few metres, multiplied by its own 23× enlargement (big soft patches)
  // so the tiling never shows; the terrain's own colours stay underneath
  function groundMat(rep) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true }); if (!window.GasTex) return m;
    GasTex.apply(m, 'grass', rep);
    m.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#ifdef USE_MAP\n  vec4 texelColor = texture2D( map, vUv );\n  float macro = texture2D( map, vUv * 0.043 + vec2( 0.31, 0.77 ) ).g;\n  diffuseColor.rgb *= texelColor.rgb * ( 0.78 + 0.44 * smoothstep( 0.5, 0.95, macro ) );\n#endif'); };
    return m;
  }
  function* buildGen() {
    WG = new THREE.Group();
    const LC = new THREE.Color(), L3 = a => a.map(v => Math.pow(v, 2.2));   // colours are authored in sRGB; the renderer works in linear
    const N = 460, W1 = N + 1, g = new THREE.PlaneGeometry(WR * 2, WR * 2, N, N); g.rotateX(-Math.PI / 2); const P = g.attributes.position, cnt = P.count, col = new Float32Array(cnt * 3), hv = new Float32Array(cnt), st = WR * 2 / N, o = [0, 0, 0];
    for (let i = 0; i < cnt; i++) { const h = HF(P.getX(i), P.getZ(i)); hv[i] = h; P.setY(i, h); if ((i & 8191) === 0) yield; }
    for (let i = 0; i < cnt; i++) { const ix = i % W1, iz = (i / W1) | 0, a = hv[iz * W1 + Math.min(N, ix + 1)] - hv[iz * W1 + Math.max(0, ix - 1)], b = hv[Math.min(N, iz + 1) * W1 + ix] - hv[Math.max(0, iz - 1) * W1 + ix]; rgbFrom(P.getX(i), P.getZ(i), hv[i], Math.max(Math.abs(a), Math.abs(b)) / (2 * st), o); LC.setRGB(o[0], o[1], o[2]).convertSRGBToLinear(); col[i * 3] = LC.r; col[i * 3 + 1] = LC.g; col[i * 3 + 2] = LC.b; if ((i & 8191) === 0) yield; }   // linear, so the 3D island is as vivid as the map
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); const terr = new THREE.Mesh(g, groundMat(WR * 2 / 3.2)); terr.receiveShadow = true; WG.add(terr); yield;
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#1f8fe8', transparent: true, opacity: .86, roughness: .12, metalness: .25 })); wm.material.color.convertSRGBToLinear(); wm.position.y = -.05; WG.add(wm); WG.userData.water = wm;
    { const sg = new THREE.PlaneGeometry(420, 420, 110, 110); sg.rotateX(-Math.PI / 2); const sp = sg.attributes.position, sc = new Float32Array(sp.count * 3), q = new THREE.Color();
      for (let i = 0; i < sp.count; i++) { const h = HS(SX + sp.getX(i), SZ + sp.getZ(i)); sp.setY(i, h); q.set(h < .5 ? '#ecdca4' : h > 30 ? '#f4f8ff' : h > 14 ? '#85806f' : '#66b83a').convertSRGBToLinear(); sc[i * 3] = q.r; sc[i * 3 + 1] = q.g; sc[i * 3 + 2] = q.b; }
      sg.setAttribute('color', new THREE.BufferAttribute(sc, 3)); sg.computeVertexNormals(); const sm2 = new THREE.Mesh(sg, groundMat(420 / 3.2)); sm2.position.set(SX, 0, SZ); WG.add(sm2);
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000).rotateX(-Math.PI / 2), wm.material); sw.position.set(SX, -.05, SZ); WG.add(sw); } yield;
    // ---- roads are routed first (they only need the terrain) so trees can keep off them; they're trimmed at buildings later ----
    { const RWD = { highway: 3.3, street: 2.3, dirt: 1.7 }; ROADS = makeRoads(); ROADS.forEach(rd => { const w = RWD[rd.t]; rd.pts.forEach(p => splat(RDF, p[0], p[1], w + 5, d => 1 - sm(w + 1.5, w + 5, d))); }); } yield;
    // ---- buildings (instanced) + colliders, one generator per POI type ----
    const BD = [], add = (x, z, w, d, h, col, roof) => { const y0 = HF(x, z) - 1, b = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0, y1: y0 + 1 + h, t: 'house' };
      // solid blocks you could fit in a room (ruins, chimneys, silos, towers) can be broken; big platforms can't
      if (w * d <= 130) { const mat = col === '#6b4a2a' ? 'wood' : /^#(c9ced6|c0c6d0|c9d3e0|6b7686|8d96a3)$/.test(col) ? 'metal' : 'brick', hp = Math.round(Math.min(900, 160 + w * d * h * 1.1)); b.D = { kind: 'block', mat, hp, max: hp, cols: [b], bd: BD.length, x, y: y0 + 1 + h / 2, z, name: mat === 'wood' ? 'Trunk' : mat === 'metal' ? 'Metal tower' : 'Stone' }; }
      reg(b); BD.push([x, y0, z, w, h + 1, d, col, roof]); };
    // every house / shop / warehouse is enterable (world_houses.js); towers, chimneys, silos and ruins stay solid
    HOUSES = []; const henv = { HF, reg, rnd, ri, add, houses: HOUSES };
    // one material per surface kind (each with its texture, tiled in metres); a little self-light so rooms aren't pitch black
    const HTEX = { plain: ['noise', 1], plaster: ['plaster', .55], siding: ['siding', .5], brick: ['brick', 1.25], stone: ['stone', .85], metal: ['metal', .9], roof: ['shingle', .62], wood: ['planks', .8] }, HMS = {};
    const hmat = k => HMS[k] || (HMS[k] = (() => { const m = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#2e2a24').convertSRGBToLinear() }); const t = HTEX[k]; if (t && window.GasTex) GasTex.apply(m, t[0], t[1]); return m; })());
    if (window.GasHouses) {
      for (const t of TOWNS) { const B = new GasHouses.Batch(); GasHouses.town(henv, B, t); const m = B.mesh(hmat); if (m) WG.add(m); yield; }
      const B = new GasHouses.Batch();
      [[0, -2, 30, 22, 2, 'hall', '#8b6f4e', '#5b3a29', 'industrial'], [-62, 30, 11, 9, 2, 'pitched', '#c8955a', '#9c3b2e', 'home'], [62, 34, 11, 9, 1, 'pitched', '#d6a56b', '#9c3b2e', 'home'], [-50, -36, 10, 9, 1, 'pitched', '#b98350', '#9c3b2e', 'home'], [56, -40, 13, 10, 2, 'flat', '#6f8296', '#3b4a5a', 'shop'], [0, -62, 16, 11, 1, 'flat', '#a3aab8', '#434a58', 'lab']].forEach(b => { const h = GasHouses.house(henv, B, { x: SX + b[0], z: SZ + b[1], w: b[2], d: b[3], floors: b[5] === 'hall' ? 1 : b[4], kind: b[5], wall: b[6], roof: b[7], door: Math.abs(b[0]) > Math.abs(b[1]) ? (b[0] > 0 ? 'w' : 'e') : (b[1] > 0 ? 'n' : 's') }); h.spawn = true; GasHouses.furnish(henv, B, h, b[8]); HOUSES.push(h); });
      const m = B.mesh(hmat); if (m) WG.add(m); yield;
      makeDoors(); yield;
    }
    for (const t of (window.GasHouses ? [] : TOWNS)) { const [, tx, tz, ty, r] = t;
      if (ty === 'city') for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { if (!i && !j) continue; add(tx + i * 24, tz + j * 24, rnd(11, 16), rnd(11, 16), rnd(10, 38), ['#8b93a1', '#a3aab8', '#6f7787'][ri(3)], '#434a58'); }
      else if (ty === 'village') for (let i = 0; i < 11; i++) { const a = i / 11 * 6.28, rr = rnd(10, r * .85); add(tx + Math.cos(a) * rr, tz + Math.sin(a) * rr, rnd(7, 10), rnd(7, 9), rnd(4, 6), ['#c8955a', '#d6a56b', '#b98350'][ri(3)], '#9c3b2e'); }
      else if (ty === 'factory') { add(tx, tz, 34, 22, 13, '#9a5b4a', '#4a4a4a'); add(tx + 30, tz + 8, 18, 14, 9, '#8a6f5a', '#4a4a4a'); add(tx - 28, tz - 6, 14, 14, 8, '#7a6050', '#4a4a4a'); add(tx + 14, tz - 24, 5, 5, 30, '#6b6b6b', '#333'); add(tx - 12, tz - 24, 5, 5, 26, '#6b6b6b', '#333'); }
      else if (ty === 'docks') { for (let i = 0; i < 5; i++) add(tx - 30 + i * 15, tz + (i % 2) * 12, 12, 9, 5, '#6f8296', '#3b4a5a'); add(tx + 30, tz - 14, 4, 4, 22, '#c0392b', '#7a241b'); }
      else if (ty === 'beach') for (let i = 0; i < 6; i++) add(tx - 30 + i * 12, tz + rnd(-8, 8), 6, 6, 3.5, ['#f0c987', '#e8a87c', '#9fd3c7'][ri(3)], '#c0392b');
      else if (ty === 'ruins') for (let i = 0; i < 9; i++) { const a = rnd(0, 6.28), rr = rnd(5, r); add(tx + Math.cos(a) * rr, tz + Math.sin(a) * rr, rnd(5, 11), rnd(4, 9), rnd(2, 7), '#6e6a63', '#4b4843'); }
      else if (ty === 'farm') { add(tx, tz, 16, 11, 7, '#b8402f', '#6b6b6b'); add(tx + 18, tz + 4, 4.5, 4.5, 15, '#c9ced6', '#8d96a3'); add(tx - 16, tz + 6, 9, 8, 5, '#e8d9b0', '#9c3b2e'); add(tx + 4, tz - 18, 12, 8, 4, '#a0532f', '#6b6b6b'); add(tx - 22, tz - 14, 8, 6, 3.5, '#a0532f', '#6b6b6b'); }
      else if (ty === 'swamp') for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28 + rnd(0, .5), rr = rnd(6, r * .8); add(tx + Math.cos(a) * rr, tz + Math.sin(a) * rr, rnd(5, 7), rnd(5, 7), rnd(3, 4.5), '#6b5a43', '#3f5a35'); }
      else if (ty === 'research') { add(tx, tz, 18, 12, 8, '#e8eef5', '#5b7aa6'); add(tx + 14, tz + 2, 8, 8, 5, '#dfe7f0', '#5b7aa6'); add(tx - 12, tz - 8, 5, 5, 16, '#c9d3e0', '#8d9bb0'); }
      else if (ty === 'grove') { for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28; add(tx + Math.cos(a) * 12, tz + Math.sin(a) * 12, 5, 5, 16, '#6b4a2a', '#2f7a2c'); } add(tx, tz, 9, 9, 6, '#a0763f', '#6b4a2a'); }
      else if (ty === 'lodge') { add(tx, tz, 16, 12, 6, '#8a5a2b', '#4a2f17'); add(tx + 13, tz + 3, 8, 8, 4, '#a0763f', '#4a2f17'); }
      else if (ty === 'bunker') { add(tx, tz, 10, 8, 2.5, '#4c5a4a', '#2d352c'); add(tx + 12, tz, 4, 4, 7, '#4c5a4a', '#2d352c'); }
      else if (ty === 'vault') { add(tx, tz, 14, 14, 5, '#8d96a3', '#4a5b73'); add(tx - 9, tz - 9, 3, 3, 9, '#6b7686', '#333'); add(tx + 9, tz - 9, 3, 3, 9, '#6b7686', '#333'); }
      else if (ty === 'rig') { add(tx, tz, 20, 20, 3, '#b8402f', '#7a241b'); add(tx - 4, tz + 2, 5, 5, 28, '#c0c6d0', '#6b7686'); add(tx + 7, tz - 5, 7, 7, 6, '#e8eef5', '#5b7aa6'); }
      else if (ty === 'lighthouse') { add(tx, tz, 6, 6, 30, '#f4f4f4', '#c0392b'); add(tx + 8, tz, 8, 6, 4, '#9c6b3a', '#6b3a2a'); }
      yield; }
    if (!window.GasHouses) [[0, 0, 32, 24, 10, '#8b6f4e', '#5b3a29'], [-62, 30, 12, 10, 6, '#c8955a', '#9c3b2e'], [62, 34, 12, 10, 6, '#d6a56b', '#9c3b2e'], [-50, -36, 10, 9, 5, '#b98350', '#9c3b2e'], [56, -40, 14, 10, 7, '#6f8296', '#3b4a5a'], [0, -62, 18, 12, 7, '#a3aab8', '#434a58'], [-20, 70, 8, 8, 4, '#9fd3c7', '#c0392b']].forEach(b => add(SX + b[0], SZ + b[1], b[2], b[3], b[4], b[5], b[6]));
    const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), BD.length), rm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial(), BD.length), M4 = new THREE.Matrix4(), cc = new THREE.Color(), q0 = new THREE.Quaternion();
    BD.forEach((b, i) => { const [x, y0, z, w, h, d, c1, c2] = b; M4.compose(V(x, y0 + h / 2, z), q0, V(w, h, d)); bm.setMatrixAt(i, M4); bm.setColorAt(i, cc.set(c1).convertSRGBToLinear()); M4.compose(V(x, y0 + h + .25, z), q0, V(w + .8, .5, d + .8)); rm.setMatrixAt(i, M4); rm.setColorAt(i, cc.set(c2).convertSRGBToLinear()); });
    bm.frustumCulled = rm.frustumCulled = false; bm.castShadow = true; WG.add(bm, rm); INST.bm = bm; INST.rm = rm; yield;
    // ---- trees: dense forests, sparse in grassland, none on farmland / snow ----
    const TR = []; for (let n = 0; n < 90000 && TR.length < 6200; n++) { const x = rnd(-WR + 60, WR - 60), z = rnd(-WR + 60, WR - 60), h = HF(x, z); if ((n & 1023) === 0) yield; if (h < 1.8 || h > 62 || FP.some(p => Math.hypot(x - p.x, z - p.z) < p.r + 4)) continue; const fw = forestW(x, z), fm = fs(FMF, x, z), sw = fs(SWF, x, z); if (fm > .25 || fs(RDF, x, z) > .02 || Math.random() > (fw * .85 + .03) * (sw > .3 ? .35 : 1) || slope(x, z) > .5) continue; if (near(x, z).some(b => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) continue; TR.push([x, h, z, rnd(.8, 1.5), h < 14 && fw < .6 && Math.random() < .5]); }   // never inside / against a building
    for (let n = 0; n < 600 && TR.length < 6500; n++) { const x = SX + rnd(-135, 135), z = SZ + rnd(-135, 135), h = HF(x, z); if (Math.hypot(x - SX, z - SZ) > 135 || h < 1.5 || slope(x, z) > .45 || Math.hypot(x - SX, z - SZ) < 36 || near(x, z).some(b => x > b.x0 - 3 && x < b.x1 + 3 && z > b.z0 - 3 && z < b.z1 + 3)) continue; TR.push([x, h, z, rnd(.8, 1.4), Math.random() < .4]); }
    const pines = TR.filter(t => !t[4]), oaks = TR.filter(t => t[4]), pm = new THREE.InstancedMesh(new THREE.ConeGeometry(1.9, 6, 7), new THREE.MeshLambertMaterial(), pines.length), om = new THREE.InstancedMesh(new THREE.SphereGeometry(2.1, 8, 7), new THREE.MeshLambertMaterial(), oaks.length), km = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .4, 3, 6), new THREE.MeshLambertMaterial({ color: '#6b4a2a' }), TR.length);
    pines.forEach((t, i) => { M4.compose(V(t[0], t[1] + 4.2 * t[3], t[2]), q0, V(t[3], t[3], t[3])); pm.setMatrixAt(i, M4); pm.setColorAt(i, cc.setHSL(.35 + Math.random() * .05, .58, .24 + Math.random() * .09).convertSRGBToLinear()); });
    oaks.forEach((t, i) => { M4.compose(V(t[0], t[1] + 4 * t[3], t[2]), q0, V(t[3], t[3] * .9, t[3])); om.setMatrixAt(i, M4); om.setColorAt(i, cc.setHSL(.24 + Math.random() * .07, .62, .36 + Math.random() * .09).convertSRGBToLinear()); });
    km.material.color.convertSRGBToLinear(); pm.castShadow = om.castShadow = km.castShadow = true;   // trees cast shadows near you (the sun follows the player)
    if (window.GasTex) { GasTex.apply(pm.material, 'leaves', 3, 2); GasTex.apply(om.material, 'leaves', 4, 2); GasTex.apply(km.material, 'bark', 2, 1); }   // leafy crowns, bark trunks
    let pi = 0, oi = 0;
    TR.forEach((t, i) => { M4.compose(V(t[0], t[1] + 1.4, t[2]), q0, V(t[3], t[3], t[3])); km.setMatrixAt(i, M4); const c = { x0: t[0] - .5, x1: t[0] + .5, z0: t[2] - .5, z1: t[2] + .5, y0: t[1] - 1, y1: t[1] + 7, t: 'tree' }, hp = Math.round(110 + 70 * t[3]);
      c.D = { kind: 'tree', mat: 'wood', hp, max: hp, cols: [c], tree: { k: i, c: t[4] ? oi++ : pi++, oak: !!t[4] }, x: t[0], y: t[1] + 1.5, z: t[2], name: 'Tree', col: '#6b4a2a' }; reg(c); });
    pm.frustumCulled = om.frustumCulled = km.frustumCulled = false; WG.add(pm, om, km); INST.pm = pm; INST.om = om; INST.km = km; yield;
    // ---- roads: routed around mountains / lakes (Dijkstra), smoothed; highways, streets, dirt tracks; bridges over rivers ----
    ROADS = trimRoads(ROADS).concat(trimRoads(townStreets())); const pos = [], cl = [], idx = [], RC = { highway: L3([.56, .57, .6]), street: L3([.4, .41, .44]), dirt: L3([.66, .53, .33]) }, RW = { highway: 3.3, street: 2.3, dirt: 1.7 }, WETC = L3([.55, .4, .25]);
    const BB = window.GasHouses ? new GasHouses.Batch() : null;   // bridges: deck, pillars, posts and railings where a road crosses water
    for (const rd of ROADS) { const pts = rd.pts, w = RW[rd.t], c = RC[rd.t]; let prevWet = null; for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * w, nzz = dx / l * w, h = HF(pts[i][0], pts[i][1]), wet = h < -.45, y = (h < .2 ? .35 : h) + .14, bi = pos.length / 3;
        pos.push(pts[i][0] - nx, y, pts[i][1] - nzz, pts[i][0] + nx, y, pts[i][1] + nzz); const cc2 = wet ? WETC : c; cl.push(...cc2, ...cc2); if (i < pts.length - 1) idx.push(bi, bi + 2, bi + 1, bi + 1, bi + 2, bi + 3);
        if (wet) {
          reg({ x0: pts[i][0] - w - .4, x1: pts[i][0] + w + .4, z0: pts[i][1] - w - .4, z1: pts[i][1] + w + .4, y0: -1, y1: .49 });
          if (BB) { const ex = nx / w * (w + .25), ez = nzz / w * (w + .25);
            if (prevWet) { const p = prevWet, mx = (p.x + pts[i][0]) / 2, mz = (p.z + pts[i][1]) / 2, sl = Math.hypot(pts[i][0] - p.x, pts[i][1] - p.z) + .05, ry = Math.atan2(pts[i][0] - p.x, pts[i][1] - p.z);
              BB.box(mx, y - .28, mz, (w + .45) * 2, .42, sl, '#a39e93', 0, ry, 0);                                   // deck under the road
              for (const s of [-1, 1]) { BB.box(mx + s * ex, y + .82, mz + s * ez, .12, .1, sl, '#ece7dc', 0, ry, 0); BB.box(mx + s * ex, y + .42, mz + s * ez, .07, .07, sl, '#ece7dc', 0, ry, 0); }   // rails
            }
            if (i % 2 === 0) for (const s of [-1, 1]) BB.box(pts[i][0] + s * ex, y + .45, pts[i][1] + s * ez, .16, .9, .16, '#d6d0c2');   // posts
            if (i % 4 === 0) BB.box(pts[i][0], (y - .5 + h - 1.5) / 2, pts[i][1], 1.1, y - .5 - (h - 1.5), 1.1, '#8f887c');          // pillar into the water
          }
          prevWet = { x: pts[i][0], z: pts[i][1] };
        } else prevWet = null; } yield; }
    if (BB) { const bmat = new THREE.MeshLambertMaterial({ vertexColors: true }); if (window.GasTex) GasTex.apply(bmat, 'plaster', .6); const bm2 = BB.mesh(bmat); if (bm2) WG.add(bm2); }
    // town plazas: a paved square in the middle of each city, a round one in each village
    for (const t of TOWNS) { if (t[3] !== 'city' && t[3] !== 'village') continue; const [, tx, tz, ty] = t, R = ty === 'city' ? 11.5 : 8.5, n = ty === 'city' ? 4 : 28, y = HF(tx, tz) + .13, c0 = pos.length / 3, pc = L3([.58, .53, .46]);
      pos.push(tx, y, tz); cl.push(...pc); for (let k = 0; k <= n; k++) { const an = k / n * Math.PI * 2 + (ty === 'city' ? Math.PI / 4 : 0), rr = ty === 'city' ? R * Math.SQRT2 : R; pos.push(tx + Math.cos(an) * rr, y, tz + Math.sin(an) * rr); cl.push(...pc); if (k) idx.push(c0, c0 + k + 1, c0 + k); } }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); rg.setIndex(idx); rg.computeVertexNormals();
    { const ruv = new Float32Array(pos.length / 3 * 2); for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) { ruv[j] = pos[i] / 3.2; ruv[j + 1] = pos[i + 2] / 3.2; } rg.setAttribute('uv', new THREE.BufferAttribute(ruv, 2)); }   // asphalt / gravel tiles every 3.2 m
    { const rmat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }); if (window.GasTex) GasTex.apply(rmat, 'asphalt', 1); const rmesh = new THREE.Mesh(rg, rmat); rmesh.receiveShadow = true; WG.add(rmesh); } yield;
    storm = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 320, 56, 1, true), new THREE.MeshBasicMaterial({ color: '#9b30ff', transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false })); storm.position.y = 120; WG.add(storm);
    // ---- full-island map, painted from the same height grid + the same colour model + the real roads ----
    const S = 768, c = document.createElement('canvas'); c.width = c.height = S; const cx = c.getContext('2d'), im = cx.createImageData(S, S), hAt = (wx, wz) => { const u = Math.max(0, Math.min(N - 1.001, (wx + WR) / st)), v = Math.max(0, Math.min(N - 1.001, (wz + WR) / st)), i = u | 0, j = v | 0, fu = u - i, fv = v - j, k = j * W1 + i; return (hv[k] * (1 - fu) + hv[k + 1] * fu) * (1 - fv) + (hv[k + W1] * (1 - fu) + hv[k + W1 + 1] * fu) * fv; };
    for (let j = 0; j < S; j++) { for (let i = 0; i < S; i++) { const wx = (i + .5) / S * 2 * WR - WR, wz = (j + .5) / S * 2 * WR - WR, h = hAt(wx, wz), sl = Math.max(Math.abs(hAt(wx + st, wz) - hAt(wx - st, wz)), Math.abs(hAt(wx, wz + st) - hAt(wx, wz - st))) / (2 * st), sh = h > 0 ? 1 + Math.max(-.3, Math.min(.3, (hAt(wx - 5, wz - 5) - h) * .05)) : 1, p = (j * S + i) * 4; rgbFrom(wx, wz, h, sl, o); im.data[p] = Math.min(255, o[0] * 255 * sh); im.data[p + 1] = Math.min(255, o[1] * 255 * sh); im.data[p + 2] = Math.min(255, o[2] * 255 * sh); im.data[p + 3] = 255; } if ((j & 15) === 0) yield; }
    cx.putImageData(im, 0, 0); const k = S / (WR * 2); cx.lineCap = 'round'; cx.lineJoin = 'round';
    TOWNS.forEach(t => { if (t[3] !== 'city' && t[3] !== 'village') return; const X = (t[1] + WR) * k, Y = (t[2] + WR) * k; cx.fillStyle = '#e9e4d8'; cx.strokeStyle = 'rgba(40,40,40,.6)'; cx.lineWidth = 1; cx.beginPath(); if (t[3] === 'city') cx.rect(X - 11.5 * k, Y - 11.5 * k, 23 * k, 23 * k); else cx.arc(X, Y, 8.5 * k, 0, 7); cx.fill(); cx.stroke(); });
    for (const pass of [0, 1]) for (const rd of ROADS) { cx.beginPath(); rd.pts.forEach((p, i) => { const X = (p[0] + WR) * k, Y = (p[1] + WR) * k; if (i) cx.lineTo(X, Y); else cx.moveTo(X, Y); }); const wd = rd.t === 'highway' ? 3.4 : rd.t === 'street' ? 2.4 : 1.6; cx.lineWidth = pass ? wd : wd + 1.6; cx.strokeStyle = pass ? (rd.t === 'dirt' ? '#d9bd86' : rd.t === 'highway' ? '#fffdf0' : '#f2efe6') : 'rgba(40,40,40,.7)'; cx.stroke(); }
    mapCv = cx.canvas;
  }
  let ROADS = [], HOUSES = [];
  function makeRoads() {
    const CELL = 20, NG = Math.ceil(WR * 2 / CELL), H = new Float32Array(NG * NG); for (let j = 0; j < NG; j++) for (let i = 0; i < NG; i++) H[j * NG + i] = HF(-WR + (i + .5) * CELL, -WR + (j + .5) * CELL);
    const cidx = (x, z) => Math.max(0, Math.min(NG - 1, ((z + WR) / CELL) | 0)) * NG + Math.max(0, Math.min(NG - 1, ((x + WR) / CELL) | 0));
    function route(a, b) {
      const s = cidx(a[0], a[1]), t = cidx(b[0], b[1]), dist = new Float32Array(NG * NG).fill(1e9), prev = new Int32Array(NG * NG).fill(-1), heap = [[0, s]]; dist[s] = 0;
      const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      while (heap.length) { const [d, u] = pop(); if (d > dist[u]) continue; if (u === t) break; const ui = u % NG, uj = (u / NG) | 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const vi = ui + di, vj = uj + dj; if (vi < 0 || vj < 0 || vi >= NG || vj >= NG) continue; const v = vj * NG + vi, hv = H[v]; if (hv < -9 || hv > 75) continue; const len = CELL * (di && dj ? 1.414 : 1), sl = Math.abs(hv - H[u]) / len, nd = d + len * (1 + sl * 10) + (hv < -.45 ? 90 : 0) + (hv > 40 ? len : 0); if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd, v]); } } }
      if (prev[t] < 0 && s !== t) return null; let p = []; for (let u = t; u !== -1; u = prev[u]) p.push([-WR + ((u % NG) + .5) * CELL, -WR + (((u / NG) | 0) + .5) * CELL]); p.reverse(); p[0] = [a[0], a[1]]; p[p.length - 1] = [b[0], b[1]];
      for (let k = 0; k < 3; k++) { const q = [p[0]]; for (let i = 0; i < p.length - 1; i++) { const A = p[i], B = p[i + 1]; q.push([A[0] * .75 + B[0] * .25, A[1] * .75 + B[1] * .25], [A[0] * .25 + B[0] * .75, A[1] * .25 + B[1] * .75]); } q.push(p[p.length - 1]); p = q; }
      const out = [p[0]]; let acc = 0; for (let i = 1; i < p.length; i++) { acc += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (acc >= 5 || i === p.length - 1) { out.push(p[i]); acc = 0; } } return out;
    }
    const el = TOWNS.map((t, i) => i).filter(i => !['vault', 'rig', 'lighthouse', 'research'].includes(TOWNS[i][3])), D = (a, b) => Math.hypot(TOWNS[a][1] - TOWNS[b][1], TOWNS[a][2] - TOWNS[b][2]), pairs = []; el.forEach(a => el.forEach(b => { if (a < b) pairs.push([a, b, D(a, b)]); })); pairs.sort((x, y) => x[2] - y[2]);
    const par = {}; el.forEach(i => par[i] = i); const find = i => par[i] === i ? i : (par[i] = find(par[i])), edges = new Map(), addE = (a, b) => edges.set(Math.min(a, b) + '-' + Math.max(a, b), [Math.min(a, b), Math.max(a, b)]);
    pairs.forEach(([a, b]) => { if (find(a) !== find(b)) { par[find(a)] = find(b); addE(a, b); } }); el.forEach(a => { el.filter(b => b !== a).sort((x, y) => D(a, x) - D(a, y)).slice(0, 2).forEach(b => { if (D(a, b) < 480) addE(a, b); }); });
    const big = t => ['city', 'factory', 'docks'].includes(t[3]), out = []; el.filter(a => big(TOWNS[a])).forEach(a => el.filter(b => b > a && big(TOWNS[b]) && D(a, b) < 700).slice(0, 1).forEach(b => addE(a, b)));
    edges.forEach(([a, b]) => { const A = TOWNS[a], B = TOWNS[b], d = D(a, b), dirt = ['farm', 'swamp', 'grove', 'lodge', 'bunker'].includes(A[3]) || ['farm', 'swamp', 'grove', 'lodge', 'bunker'].includes(B[3]), t = (big(A) && big(B) && d > 300) || (A[3] === 'city' && B[3] === 'city') ? 'highway' : dirt ? 'dirt' : 'street', p = route([A[1], A[2]], [B[1], B[2]]); if (p) out.push({ t, pts: p }); });
    return out;
  }
  // city streets: a grid between the blocks (buildings sit on a 26 m grid, so the lines 13 m off each row are always clear)
  function townStreets() {
    const out = [], line = (x0, z0, x1, z1) => { const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 5)), pts = []; for (let i = 0; i <= n; i++) pts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]); return { t: 'street', pts }; };
    for (const t of TOWNS) if (t[3] === 'city') { const [, tx, tz] = t; for (const o of [-39, -13, 13, 39]) out.push(line(tx + o, tz - 68, tx + o, tz + 68), line(tx - 68, tz + o, tx + 68, tz + o)); }
    return out;
  }
  // roads are routed town-centre to town-centre, so they'd run straight through houses: end them at the edge of each town's
  // buildings, and cut them wherever they'd still pass through a building on the way (another town, a ruin)
  function trimRoads(list) {
    const RW = { highway: 3.3, street: 2.3, dirt: 1.7 }, out = [];
    const blocked = (p, w) => near(p[0], p[1]).some(c => (c.t === 'house' || c.t === 'furn' || c.t === 'roof' || c.t === 'stairs' || c.t === 'tower') && c.y1 > HF(p[0], p[1]) + .6 && p[0] > c.x0 - w - 1.2 && p[0] < c.x1 + w + 1.2 && p[1] > c.z0 - w - 1.2 && p[1] < c.z1 + w + 1.2);
    for (const rd of list) {
      const w = RW[rd.t], P = rd.pts, n = P.length, B = P.map(p => blocked(p, w)), half = n >> 1; let s = 0, e = n - 1;
      for (let i = 0; i < half; i++) if (B[i]) s = i + 1;
      for (let i = n - 1; i >= half; i--) if (B[i]) e = i - 1;
      let cur = []; for (let i = s; i <= e; i++) { if (B[i]) { if (cur.length > 2) out.push({ t: rd.t, pts: cur }); cur = []; } else cur.push(P[i]); }
      if (cur.length > 2) out.push({ t: rd.t, pts: cur });
    }
    return out;
  }
  /* ---------- colour model (vibrant, biome-blended): shared by the 3D terrain and the map ---------- */
  const C_G = [.40, .74, .22], C_F = [.13, .42, .15], C_Y1 = [.90, .76, .26], C_Y2 = [.80, .66, .20], C_SW = [.22, .36, .26], C_SA = [.93, .86, .64], C_RK = [.52, .49, .44], C_SN = [.97, .98, 1];
  const mixc = (o, c, t) => { o[0] += (c[0] - o[0]) * t; o[1] += (c[1] - o[1]) * t; o[2] += (c[2] - o[2]) * t; };
  function rgbFrom(x, z, h, s, o) {
    if (h < -.2) { const c = h < -9 ? [.04, .29, .60] : h < -3.6 ? [.09, .43, .77] : [.24, .64, .90]; if (h < -9) { o[0] = .04; o[1] = .29; o[2] = .60; } else { const t = sm(-9, -.2, h); o[0] = .06 + .18 * t; o[1] = .33 + .31 * t; o[2] = .68 + .22 * t; } return; }
    o[0] = C_G[0]; o[1] = C_G[1]; o[2] = C_G[2]; const v = fbm(x * .05, z * .05, 2) * .06; o[0] += v; o[1] += v; o[2] += v * .5;
    mixc(o, C_F, forestW(x, z) * .9); const fw = fs(FMF, x, z); if (fw > .02) mixc(o, Math.sin((x * .8 + z * .45) * .1) > 0 ? C_Y1 : C_Y2, sm(0, .5, fw)); const sw = fs(SWF, x, z); if (sw > .02) mixc(o, C_SW, sm(0, .5, sw));
    const rock = Math.max(sm(.5, .9, s), sm(30, 48, h + fbm(x * .03, z * .03, 2) * 7) * .8); if (rock > 0) mixc(o, C_RK, rock);
    const sn = sm(52, 68, h + fbm(x * .025, z * .025, 2) * 9) * (1 - sm(.7, 1.1, s) * .6); if (sn > 0) mixc(o, C_SN, sn);
    if (h < 1.8) mixc(o, C_SA, 1 - sm(.4, 1.8, h));
  }
  const slope = (x, z) => Math.max(Math.abs(HF(x + 2, z) - HF(x - 2, z)), Math.abs(HF(x, z + 2) - HF(x, z - 2))) / 4;
  /* ---------- match state ---------- */
  let active = false, over = false, tm = 0, lt = 0, ST = null, storm = null, ph = -1, PL = { p: null, vy: 0, air: false, swim: false, st: 'lobby', hx: 0, hz: 0 }, ptag = null, swing = 0, hit = 0, dmgT = 0, uiBuilt = false, vigEl = null, endEl = null, lockEl = null, pauseEl = null, banEl = null, swimRing = null, lastTxt = '', lastBan = '';
  let lastUnlock = 0, phase = 'lobby', paused = true, locked = false, noLock = false, lockTry = false, lockErr = 0, fpv = false, aiming = false, yaw = 0, pitch = .35, lobbyClock = 0, lobbyLen = 20, bus = null, busMesh = null, glider = null, jumped = 0, baseFov = 42, fallMsgT = 0;
  let TEAMSZ = 1, spec = null, lastKiller = null, DYING = [];
  // eliminated players topple backwards, then shrink away
  function dyingTick(dt) { for (let i = DYING.length - 1; i >= 0; i--) { const d = DYING[i]; d.t += dt; const k = Math.min(1, d.t / .45); d.m.rotation.x = d.x0 + (-1.45 - d.x0) * k * k; if (d.t > .9) d.m.scale.setScalar(Math.max(.01, 1 - (d.t - .9) / .35)); if (d.t > 1.25) { if (d.m.parent) d.m.parent.remove(d.m); DYING.splice(i, 1); } } }
  // storm: starts around the whole island (R0), then every 2 minutes shrinks by 10% of that size (closing over 90 s);
  // the last two phases squeeze the end game so a match finishes in about 24 minutes
  const R0 = 1250, PH = [.9, .8, .7, .6, .5, .4, .3, .2, .1].map((f, i) => ({ r: R0 * f, d: [1, 1, 1, 2, 2, 3, 4, 5, 7][i] })).concat([{ r: 50, d: 9 }, { r: 10, d: 12 }]), T0 = 120, GAP = 120, SHR = 90;
  const user = () => state.username;
  if (!state.username) { state.username = 'Player' + (1000 + ri(9000)); saveState(); }
  const NA = ['Shadow', 'Night', 'Pixel', 'Storm', 'Neon', 'Turbo', 'Frost', 'Rogue', 'Cyber', 'Blaze', 'Lunar', 'Viper'], NB = ['Fox', 'Owl', 'Wolf', 'Ace', 'Hawk', 'Knight', 'Ninja', 'Tiger', 'Ghost', 'Rider', 'Bear', 'Spark'];
  function tag(text, col = '#fff') { const c = document.createElement('canvas'); c.width = 256; c.height = 48; const x = c.getContext('2d'); x.font = 'bold 26px sans-serif'; x.textAlign = 'center'; x.lineWidth = 5; x.strokeStyle = '#000'; x.strokeText(text, 128, 34); x.fillStyle = col; x.fillText(text, 128, 34); const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true })); s.scale.set(2.8, .52, 1); return s; }
  const msg = t => { if (typeof showToast === 'function') showToast(t); };
  const cvs = () => document.getElementById('three-canvas');
  /* ---------- UI: pointer-lock overlay, pause menu, banner ---------- */
  function ui() {
    if (uiBuilt) return; uiBuilt = true;
    const css = document.createElement('style'); css.textContent = '#gw-vig{position:fixed;inset:0;pointer-events:none;box-shadow:inset 0 0 160px 60px rgba(155,48,255,.75);opacity:0;transition:opacity .4s;z-index:5}#gw-end{position:fixed;inset:0;display:none;place-items:center;background:rgba(2,8,23,.85);z-index:50}#gw-end.on{display:grid}#gw-end>div{background:#0f1a36;border:2px solid #38bdf8;border-radius:10px;padding:28px 44px;text-align:center}#gw-end h1{margin:.1em 0}.gw-ov{position:fixed;inset:0;display:none;place-items:center;background:rgba(2,8,23,.84);z-index:60;text-align:center;cursor:pointer}.gw-ov.on{display:grid}.gw-ov>div{background:#0f1a36;border:2px solid #38bdf8;border-radius:12px;padding:26px 40px;max-width:600px;cursor:default}.gw-ov h1{margin:.1em 0 .3em}.gw-keys{background:#0b1530;border-radius:8px;padding:10px 14px;margin:12px 0;line-height:1.8;font-size:14px}.gw-ov button{padding:12px 26px;font-weight:900;font-size:16px;cursor:pointer;border:0;border-radius:6px;background:#fbbf24;color:#000;margin:4px}#gw-banner{position:fixed;top:78px;left:50%;transform:translateX(-50%);z-index:20;text-align:center;font-weight:900;text-shadow:0 2px 8px #000;pointer-events:none;font-size:20px;line-height:1.25}#gw-banner b{font-size:46px}#br-hud.pre #hud-hot,#br-hud.pre #hud-feed,#br-hud.pre #gp-mm,#br-hud.pre .br-crosshair{display:none}';
    document.head.appendChild(css);
    const mk = (id, cls, html) => { const e = document.createElement('div'); e.id = id; e.className = cls; e.innerHTML = html || ''; document.body.appendChild(e); return e; };
    vigEl = mk('gw-vig', ''); endEl = mk('gw-end', ''); banEl = mk('gw-banner', '');
    lockEl = mk('gw-lock', 'gw-ov', '<div><h1>🎮 CLICK TO PLAY</h1><p>Your mouse will be <b>locked</b> to the game so you can look around.<br>Press <b>ESC</b> at any time to unlock it and open the pause menu.</p><div class="gw-keys">Mouse – look &nbsp;·&nbsp; WASD – move &nbsp;·&nbsp; SPACE – jump &nbsp;·&nbsp; LEFT CLICK – attack / shoot<br>RIGHT CLICK – aim &nbsp;·&nbsp; V – first / third person &nbsp;·&nbsp; M – map &nbsp;·&nbsp; E – interact</div><button id="gw-go">CLICK TO LOCK MOUSE &amp; START</button><p id="gw-lockmsg" style="color:#fbbf24"></p></div>');
    pauseEl = mk('gw-pause', 'gw-ov', '<div><h1>⏸ PAUSED</h1><p>Mouse unlocked. Click <b>Resume</b> to lock it again.</p><button id="gw-resume">RESUME</button><button id="gw-leave" style="background:#ef4444;color:#fff">LEAVE MATCH</button><p id="gw-pmsg" style="color:#fbbf24"></p></div>');
    lockEl.onclick = e => { if (e.target.closest('div') === lockEl.firstChild || e.target === lockEl) go(); };
    document.getElementById('gw-resume').onclick = resume; document.getElementById('gw-leave').onclick = () => { exitBattleRoyaleMatch(); };
    pauseEl.onclick = e => { if (e.target === pauseEl) resume(); };   // click anywhere around the menu to jump back in
    document.addEventListener('pointerlockchange', onLockChange); document.addEventListener('pointerlockerror', onLockErr);
    document.addEventListener('mousemove', onMove); window.addEventListener('mousedown', onMouseDown, true); window.addEventListener('mouseup', e => { if (e.button === 2) aiming = false; }, true); window.addEventListener('contextmenu', e => { if (active) e.preventDefault(); });
    window.addEventListener('keydown', e => { if (active && !over && e.code === 'Escape' && (noLock || !locked)) pause(); }, true);
  }
  const note = t => { const a = document.getElementById('gw-lockmsg'), b = document.getElementById('gw-pmsg'); if (a) a.textContent = t; if (b) b.textContent = t; };
  // raw (unaccelerated) mouse input when the browser supports it; falls back to a normal lock
  function lockReq() {
    const c = cvs(); if (!c || !c.requestPointerLock || noLock || document.pointerLockElement === c) return; lockTry = true;
    const plain = () => { try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { onLockErr(); } };
    try { const r = c.requestPointerLock({ unadjustedMovement: true }); if (r && r.catch) r.catch(e => { if (e && e.name === 'NotSupportedError') plain(); }); else if (r === undefined && !document.pointerLockElement) { /* old API: no promise */ } } catch (e) { plain(); }
  }
  let relockT = 0;
  function onLockErr() {
    // browsers refuse to re-lock for ~1 s after you press Esc: quietly retry once the cooldown is over (the click still counts)
    const since = performance.now() - lastUnlock;
    if (since < 1600 && lockErr < 2) { lockErr++; clearTimeout(relockT); note('Locking mouse…'); relockT = setTimeout(() => { if (active && !over && !locked) lockReq(); }, 1650 - since); return; }
    lockErr++; if (since > 2500) lockErr = 3; if (lockErr >= 3) { noLock = true; lockTry = false; paused = false; lockEl.classList.remove('on'); pauseEl.classList.remove('on'); document.body.style.cursor = 'none'; msg('Mouse lock is not available in this window — mouse look still works. Press ESC to pause.'); return; }
    if (lockTry && active && !over) { lockTry = false; paused = true; pauseEl.classList.add('on'); lockEl.classList.remove('on'); note('The browser needs a second before it will lock the mouse again — click again.'); }
  }
  function onLockChange() {
    locked = document.pointerLockElement === cvs();
    if (locked) { lockTry = false; lockErr = 0; paused = false; lockEl.classList.remove('on'); pauseEl.classList.remove('on'); document.body.style.cursor = 'none'; }
    else { lastUnlock = performance.now(); if (active && !over && !noLock && !lockEl.classList.contains('on') && !menuOn) pause(); }
  }
  // in-match menus (inventory screen): free the mouse without pausing; the match keeps running
  let menuOn = false;
  function menu(open) { menuOn = !!open; if (menuOn) { document.body.style.cursor = ''; if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); } else { document.body.style.cursor = 'none'; if (!noLock && !over) lockReq(); } }
  function pause() { if (!active || over || (paused && pauseEl.classList.contains('on'))) return; paused = true; aiming = false; pauseEl.classList.add('on'); note(''); document.body.style.cursor = ''; if (document.exitPointerLock) document.exitPointerLock(); }
  function resume() { pauseEl.classList.remove('on'); paused = false; note(''); lockReq(); document.body.style.cursor = 'none'; }
  function go() { lockEl.classList.remove('on'); paused = false; note(''); lockReq(); document.body.style.cursor = 'none'; }
  function onMove(e) { if (!active || paused || over || menuOn || (!locked && !noLock)) return; if (Math.abs(e.movementX) > 260 || Math.abs(e.movementY) > 260) return; /* ignore the browser's occasional pointer-lock jump glitch */ const s = .0022 * (state.sens || 1) * (aiming ? .6 : 1); yaw -= e.movementX * s; pitch = Math.max(fpv ? -1.3 : -.5, Math.min(1.3, pitch + e.movementY * s)); }
  function onMouseDown(e) { if (!active || over || paused) return; if (e.button === 2) { aiming = true; e.stopImmediatePropagation(); e.preventDefault(); } }
  const hudPre = on => { const h = document.getElementById('br-hud'); if (h) h.classList.toggle('pre', on); };
  function banner(h) { if (h !== lastBan) { lastBan = h; banEl.innerHTML = h; } }
  /* ---------- spawn island helpers ---------- */
  const okSI = (x, z, r = 2) => Math.hypot(x - SX, z - SZ) < 120 && HF(x, z) > 1.5 && !near(x, z).some(b => x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r);
  function plazaPoint(rad = 55) { for (let n = 0; n < 40; n++) { const a = rnd(0, 6.28), r = rnd(8, rad), x = SX + 10 + Math.cos(a) * r, z = SZ + 14 + Math.sin(a) * r; if (okSI(x, z, 1.5)) return { x, z }; } return { x: SX + 20, z: SZ + 45 }; }
  /* ---------- props: glider + battle bus ---------- */
  function makeGlider() {
    let col = '#38bdf8'; try { const g = typeof getCosmeticById === 'function' && state.equipped && state.equipped.glider ? getCosmeticById('glider', state.equipped.glider) : null; if (g && g.color) col = g.color; } catch (e) { }
    const g = new THREE.Group(), m = (w, h, d, c, x, y, z, rz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); o.position.set(x, y, z); if (rz) o.rotation.z = rz; g.add(o); return o; };
    m(4.6, .14, 2.6, col, 0, 3, 0); m(1.2, .14, 2.4, '#fff', 0, 3.02, 0); m(.07, 1.2, .07, '#333', -.5, 2.4, 0, .5); m(.07, 1.2, .07, '#333', .5, 2.4, 0, -.5); g.visible = false; return g;
  }
  function makeBus() {
    const g = new THREE.Group(), m = (w, h, d, c, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); o.position.set(x, y, z); g.add(o); return o; };
    m(5, 3.4, 13, '#3b82f6', 0, 0, 0); m(5.1, .7, 13.1, '#facc15', 0, -.9, 0); m(4.4, 1.2, 3, '#1e3a8a', 0, .6, 5.8); for (let i = 0; i < 4; i++) [-1, 1].forEach(s => m(.1, 1.1, 1.8, '#bfe3ff', s * 2.55, .7, -4.5 + i * 2.8));
    [[-2.5, -5], [2.5, -5], [-2.5, 5], [2.5, 5]].forEach(q => { const w = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, .7, 14), new THREE.MeshLambertMaterial({ color: '#222' })); w.rotation.z = Math.PI / 2; w.position.set(q[0], -1.8, q[1]); g.add(w); });
    const bl = new THREE.Mesh(new THREE.SphereGeometry(8.5, 18, 14), new THREE.MeshLambertMaterial({ color: '#ef4444' })); bl.position.y = 15; bl.scale.y = 1.15; g.add(bl); const st = new THREE.Mesh(new THREE.TorusGeometry(8.4, .6, 8, 24), new THREE.MeshLambertMaterial({ color: '#fde047' })); st.rotation.x = Math.PI / 2; st.position.y = 15; g.add(st);
    [[-2, -5], [2, -5], [-2, 5], [2, 5]].forEach(q => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 11, 5), new THREE.MeshLambertMaterial({ color: '#444' })); r.position.set(q[0] * .8, 6.5, q[1] * .6); g.add(r); });
    return g;
  }
  /* ---------- outdoor look for matches: a warm sun whose shadows follow you, sky light with a grass bounce, a gradient sky.
     The lobby's studio lights are put back when you leave. ---------- */
  let LGT = null, sun = null, skyM = null;
  function makeSky() {
    const g = new THREE.SphereGeometry(1, 32, 20), P = g.attributes.position, c = new Float32Array(P.count * 3), t = new THREE.Color();
    const top = new THREE.Color('#2f7fd8').convertSRGBToLinear(), mid = new THREE.Color('#8cc8f2').convertSRGBToLinear(), hor = new THREE.Color('#dcecf6').convertSRGBToLinear();
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < .04) t.copy(hor); else if (y < .32) t.copy(hor).lerp(mid, (y - .04) / .28); else t.copy(mid).lerp(top, Math.min(1, (y - .32) / .6)); c[i * 3] = t.r; c[i * 3 + 1] = t.g; c[i * 3 + 2] = t.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    m.scale.setScalar(860); m.renderOrder = -10; m.frustumCulled = false; return m;
  }
  function envMatch(on) {
    const L = scene.children.filter(o => o.isLight);
    if (on) {
      if (!LGT) LGT = { exp: renderer.toneMappingExposure, l: L.map(l => ({ l, i: l.intensity, c: l.color.clone(), g: l.groundColor ? l.groundColor.clone() : null, p: l.position.clone(), sc: l.castShadow ? { l: l.shadow.camera.left, r: l.shadow.camera.right, t: l.shadow.camera.top, b: l.shadow.camera.bottom, n: l.shadow.camera.near, f: l.shadow.camera.far, bias: l.shadow.bias } : null })) };
      sun = null;
      L.forEach(l => {
        if (l.isHemisphereLight) { l.color.set('#d4ebff'); l.groundColor.set('#6f7f4c'); l.intensity = .6; }
        else if (l.isDirectionalLight && l.castShadow && !sun) { sun = l; l.color.set('#fff0d4'); l.intensity = 1.75; const sc = l.shadow.camera; sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 1; sc.far = 280; sc.updateProjectionMatrix(); l.shadow.bias = -.0005; }
        else if (l.isDirectionalLight) l.intensity = .12;                // the lobby's blue rim: just a touch of sky fill outdoors
      });
      renderer.toneMappingExposure = .92;
      if (!skyM) skyM = makeSky(); if (skyM.parent !== scene) scene.add(skyM);
    } else {
      if (LGT) { LGT.l.forEach(s => { s.l.intensity = s.i; s.l.color.copy(s.c); if (s.g) s.l.groundColor.copy(s.g); s.l.position.copy(s.p); if (s.sc) { const sc = s.l.shadow.camera; sc.left = s.sc.l; sc.right = s.sc.r; sc.top = s.sc.t; sc.bottom = s.sc.b; sc.near = s.sc.n; sc.far = s.sc.f; sc.updateProjectionMatrix(); s.l.shadow.bias = s.sc.bias; } if (s.l.target) { s.l.target.position.set(0, 0, 0); s.l.target.updateMatrixWorld(); } }); renderer.toneMappingExposure = LGT.exp; LGT = null; }
      sun = null; if (skyM && skyM.parent) skyM.parent.remove(skyM);
    }
  }
  function envTick() {
    if (skyM && skyM.parent) skyM.position.copy(camera.position);
    if (sun && PL && PL.p) { const p = PL.p; sun.position.set(p.x + 70, p.y + 120, p.z + 45); sun.target.position.set(p.x, p.y, p.z); sun.target.updateMatrixWorld(); }   // same sun angle, shadow box centred on you
  }
  /* ---------- match start / stop ---------- */
  function start() {
    if (brState.isPlayTown) { active = false; return; }
    build(); restoreWorld(); resetDoors(); ui(); const old = matchGroup.children.slice(), keep = new Set([brState.player, ...brState.bots.map(b => b.mesh)]); old.forEach(o => { if (!keep.has(o)) matchGroup.remove(o); }); matchGroup.add(WG);
    over = false; tm = 0; ph = -1; lt = 0; swing = 0; hit = 0; jumped = 0; fpv = false; aiming = false; lastBan = ''; bus = null; busMesh = null; baseFov = camera.fov > 20 && camera.fov < 90 && !active ? camera.fov : baseFov;
    ST = { x: 0, z: 0, r: R0, ox: 0, oz: 0, or: R0, tx: 0, tz: 0, tr: R0, t0: 0 }; storm.visible = false;
    phase = 'lobby'; lobbyClock = 0; lobbyLen = 10 + ri(21);
    const p = brState.player; p.rotation.order = 'YXZ'; p.rotation.set(0, 0, 0); p.visible = true; PL = { p: p.position, vy: 0, air: false, swim: false, st: 'lobby', hx: 0, hz: 0, knocked: false, khp: 0, dead: false, revT: 0, vx: 0, vz: 0, svx: 0, svz: 0, crouch: false, slideT: 0, mant: null, landK: 0, visY: null, camH: 1.55, sprinting: false }; spec = null;
    const q = plazaPoint(30); p.position.set(q.x, HF(q.x, q.z), q.z); yaw = Math.PI; pitch = .3;
    ptag = tag(user(), '#7dd3fc'); matchGroup.add(ptag); glider = makeGlider(); p.add(glider);
    // teams: Solo 1 · Duos 2 · Trios 3 · Squads 4. Your team is team 0 (you + bot teammates); the rest are grouped the same way.
    TEAMSZ = { SOLO: 1, DUOS: 2, TRIOS: 3, SQUADS: 4 }[state.gameMode] || 1; DYING = []; NOISE.length = 0;
    if (window.GasBuild) GasBuild.reset();
    const builds = !!(window.GasBuild && GasBuild.enabled);
    brState.bots.forEach((b, i) => {
      b.team = i < TEAMSZ - 1 ? 0 : 1 + Math.floor((i - (TEAMSZ - 1)) / TEAMSZ);
      b.name = (b.team === 0 && b.mesh.userData.friendName) || NA[ri(12)] + NB[ri(12)] + (ri(90) + 10); b.mesh.rotation.order = 'YXZ'; b.mesh.rotation.set(0, rnd(0, 6.28), 0); b.mesh.visible = false; [b.mesh.userData.joints.leftArm, b.mesh.userData.joints.rightArm].forEach(a => a.glove.children.forEach(c => { if (c.userData.gun) c.visible = false; }));
      Object.assign(b, { p: b.mesh.position, vy: 0, air: false, swim: false, hp: 100, sh: 0, lvl: rnd(.3, 1), wp: null, wps: [], wpi: null, mag: 0, ammo: 0, rel: 0, cd: 0, med: 0, shd: 0, mode: 'loot', goal: null, mx: 0, mz: 0, spd: 0, tNext: rnd(0, 1), en: null, aimT: 0, hd: rnd(0, 6.28), lx: 0, lz: 0, stk: 0, sd: 1, sdT: 0, hand: null, st: 'lobby', hx: 0, hz: 0, joined: false, joinAt: rnd(.4, Math.max(.8, lobbyLen - 1.8)), lgoal: null, lw: 0, knocked: false, khp: 0, dead: false, revT: 0, attacker: null, hitT: -99, vx: 0, vz: 0, jump: false, swT: 0, mats: builds ? 120 + ri(260) : 0, bT: 0, heal: null, brk: null, farm: null, farmCD: 0, last: null, ngoal: null, nzT: 0, unstick: 0, track: 0, tref: null, crouch: false, boxT: -99, rampT: 0, inside: false, ban: null, lootRef: null, lootT: 0, tg: tag(b.name, b.team === 0 ? '#86efac' : '#fca5a5') }); b.tg.visible = false; matchGroup.add(b.tg);
    });
    brState.hp = 100; brState.shield = 0; totalP = brState.bots.length + 1; if (typeof updateBRHud === 'function') updateBRHud(); hudPre(true);
    scene.background = new THREE.Color('#9ccaf2'); scene.fog = new THREE.Fog('#d6e8f4', 230, 780); camera.far = 900; camera.updateProjectionMatrix(); envMatch(true);
    paused = true; locked = !!document.pointerLockElement; lockErr = 0; pauseEl.classList.remove('on'); endEl.classList.remove('on'); vigEl.style.opacity = 0; if (!noLock) { lockEl.classList.add('on'); note(''); } else { paused = false; lockEl.classList.remove('on'); }
    active = true;
  }
  function stop() { if (shpEl) shpEl.style.opacity = 0; envMatch(false); if (active) { scene.background = null; scene.fog = null; camera.far = 300; camera.fov = baseFov; camera.updateProjectionMatrix(); } active = false; paused = true; aiming = false; document.body.style.cursor = ''; if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); ['gw-lock', 'gw-pause', 'gw-end'].forEach(i => { const e = document.getElementById(i); if (e) e.classList.remove('on'); }); if (banEl) banEl.innerHTML = ''; lastBan = ''; if (vigEl) vigEl.style.opacity = 0; const p = brState.player; if (p) { p.rotation.x = 0; p.visible = true; if (glider) p.remove(glider); } }
  function startBus() {
    phase = 'play'; tm = 0; hudPre(false); storm.visible = true;
    const dirs = [0, 45, 90, 135, 180, 225, 270, 315], a = (dirs[ri(8)] + rnd(-12, 12)) * Math.PI / 180, d = { x: Math.cos(a), z: Math.sin(a) }, n = { x: -d.z, z: d.x }, off = rnd(-.35, .35) * ISL, half = ISL + 300;
    bus = { s: { x: n.x * off - d.x * half, z: n.z * off - d.z * half }, d, speed: 70, len: half * 2, t: 0, alt: 320, a, done: false, pos: null }; busMesh = makeBus(); matchGroup.add(busMesh); lastBan = '';
    PL.st = 'bus'; brState.hp = 100; const drops = {};
    brState.bots.forEach(b => {   // squads drop together: one landing spot per team; your teammates jump when you do
      b.st = 'bus'; b.mesh.visible = false; b.tg.visible = false; b.fo = { x: rnd(-7, 7), z: rnd(-7, 7) };
      if (b.team === 0) { b.followPlayer = true; b.tgt = { x: 0, z: 0 }; b.jumpS = Infinity; return; }
      let D = drops[b.team];
      if (!D) { let s = null, lat = 0; for (let k = 0; k < 60; k++) { s = spot(.6); lat = Math.abs((s.x - bus.s.x) * n.x + (s.z - bus.s.z) * n.z); if (lat < 220) break; } const along = (s.x - bus.s.x) * d.x + (s.z - bus.s.z) * d.z; D = drops[b.team] = { s, jumpS: Math.max(300, Math.min(bus.len - 320, along - rnd(40, 170))) }; }
      b.tgt = { x: D.s.x + b.fo.x * 1.6, z: D.s.z + b.fo.z * 1.6 }; b.jumpS = D.jumpS + rnd(0, 12);
    });
  }
  /* ---------- skydiving ---------- */
  function airTick(a, dt, vx, vz) {
    const g = Math.max(surface(a.p.x, a.p.z, a.p.y), -.4), h = a.p.y - g;
    if (a.st === 'fall' && h < 110) a.st = 'glide';
    const gl = a.st === 'glide'; a.vy += ((gl ? -11 : -48) - a.vy) * Math.min(1, dt * (gl ? 2.5 : 1.2)); a.hx += (vx - a.hx) * Math.min(1, dt * 3); a.hz += (vz - a.hz) * Math.min(1, dt * 3);
    step(a, a.hx * dt, a.hz * dt); a.p.y += a.vy * dt; const g2 = Math.max(surface(a.p.x, a.p.z, a.p.y), -.4);
    if (a.p.y <= g2 + .02) { a.p.y = g2; a.vy = 0; a.hx = a.hz = 0; a.air = false; return true; } return false;
  }
  function jumpPlayer() {
    if (PL.st !== 'bus') return; PL.st = 'fall'; PL.vy = -6; PL.hx = bus.d.x * 22; PL.hz = bus.d.z * 22; jumped++; fallMsgT = 5; pitch = .8; PL.air = true; msg('🪂 Skydive! Steer with WASD — your glider opens automatically.');
  }
  /* ---------- bots in lobby ---------- */
  function botLobby(b, dt, time, nearP) {
    if (!b.joined) { if (lobbyClock >= b.joinAt) { b.joined = true; const q = plazaPoint(60); b.p.set(q.x, HF(q.x, q.z), q.z); b.mesh.visible = true; b.tg.visible = true; } return; }
    b.lw -= dt; if (!b.lgoal || b.lw <= 0 || Math.hypot(b.lgoal.x - b.p.x, b.lgoal.z - b.p.z) < 2) { b.lw = rnd(3, 8); b.lgoal = Math.random() < .35 ? null : plazaPoint(65); b.idle = !b.lgoal; }
    let mv = 0; if (b.lgoal) { const dx = b.lgoal.x - b.p.x, dz = b.lgoal.z - b.p.z, a = Math.atan2(dx, dz); b.mesh.rotation.y += Math.atan2(Math.sin(a - b.mesh.rotation.y), Math.cos(a - b.mesh.rotation.y)) * Math.min(1, dt * 6); step(b, Math.sin(a) * 4.5 * dt, Math.cos(a) * 4.5 * dt); mv = 1; }
    vert(b, dt, false); if (Math.hypot(b.p.x - SX, b.p.z - SZ) > 130 || HF(b.p.x, b.p.z) < 0) { const q = plazaPoint(40); b.p.set(q.x, HF(q.x, q.z), q.z); }
    if (nearP) { b.mesh.userData.motion = { speed: mv ? 4.5 : 0, fwd: mv ? 4.5 : 0, air: b.air, vy: b.vy }; CharacterRigBuilder.applyHeroStance(b.mesh, time, 'run'); } b.tg.position.set(b.p.x, b.p.y + 2.5, b.p.z);
  }
  /* ---------- combat ---------- */
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  // a team is "standing" while someone on it is alive and not knocked
  const teamStanding = (team, except) => (team === 0 && except !== 'player' && !PL.dead && !PL.knocked) || brState.bots.some(o => o !== except && o.team === team && !o.dead && !o.knocked);
  const nameOf = by => by === 'player' ? user() : by && by.name ? by.name : 'The storm';
  function hurt(t, dmg, by) {
    if (over || phase === 'lobby') return;
    const byTeam = by === 'player' ? 0 : by && by.team != null ? by.team : -1;
    if (t === 'player') {
      if (PL.dead || PL.st === 'bus' || PL.st === 'lobby' || byTeam === 0) return;
      if (by && by.p) PL.lastHitBy = by;
      if (PL.knocked) { PL.khp -= dmg; if (PL.khp <= 0) die(by); return; }
      let a = Math.min(brState.shield, dmg); brState.shield -= a; brState.hp -= dmg - a; if (typeof updateBRHud === 'function') updateBRHud();
      if (brState.hp <= 0) { brState.hp = 0; if (TEAMSZ > 1 && teamStanding(0, 'player')) { PL.knocked = true; PL.khp = 100; PL.knockedBy = by; GasPlus.feed(`<b class="r">${nameOf(by)}</b> knocked <b class="y">${user()}</b>`); msg('▼ You were knocked! Crawl to safety — a teammate can revive you.'); if (window.GasBuild) GasBuild.toggle(false); } else die(by); }
      return;
    }
    if (t.dead || byTeam === t.team) return;
    if (by === 'player') hit = .2;
    if (by && by !== 'storm') { t.attacker = by; t.hitT = tm; t.heal = null; t.farm = null; t.brk = null; if (t.tNext > .15) t.tNext = .1 + Math.random() * .15; }   // react quickly to being shot
    if (t.knocked) { t.khp -= dmg; if (t.khp <= 0) killBot(t, by); return; }
    let a = Math.min(t.sh, dmg); t.sh -= a; t.hp -= dmg - a;
    if (t.hp <= 0) { if (TEAMSZ > 1 && teamStanding(t.team, t)) { t.knocked = true; t.khp = 100; t.hp = 0; t.knockedBy = by; t.revT = 0; GasPlus.feed(`<b class="${by === 'player' ? 'y' : 'r'}">${nameOf(by)}</b> knocked <b class="r">${t.name}</b>`); } else killBot(t, by); }
    else if (window.GasBuild && GasBuild.enabled && by && by !== 'storm') GasBuild.botReact(t, by);
  }
  function aliveTeams() { const s = new Set(); if (!PL.dead) s.add(0); brState.bots.forEach(b => { if (!b.dead) s.add(b.team); }); return s; }
  function checkEnd() { if (over) return; const s = aliveTeams(); if (!s.has(0)) finish(false, lastKiller); else if (s.size === 1) finish(true); }
  function killBot(b, by) {
    if (b.dead) return;
    matchGroup.remove(b.tg); DYING.push({ m: b.mesh, t: 0, x0: b.mesh.rotation.x }); const i = brState.bots.indexOf(b); if (i >= 0) brState.bots.splice(i, 1); b.dead = true; b.knocked = false; lastKiller = by;
    // drop their guns (with what is left in the magazine) and half of their spare ammo
    const loot = b.wps && b.wps.length ? b.wps.map((x, k) => k === b.wpi ? { w: x.w, r: x.r, mag: b.mag, ammo: b.ammo } : x) : b.wp ? [{ w: b.wp.w, r: b.wp.r, mag: b.mag, ammo: b.ammo }] : [];
    loot.forEach((x, k) => { const ox = b.p.x + (k ? 1 : -1) * .8; GasPlus.dropWeapon(ox, b.p.z, x.w, x.r, b.p.y, Math.max(0, x.mag || 0)); if (GasPlus.dropAmmo && x.ammo > 0) GasPlus.dropAmmo(ox, b.p.z + .9, GasPlus.WD[x.w].t, x.ammo, b.p.y); });
    const killer = nameOf(by), wn = by === 'player' ? GasPlus.weaponName() : by && by.wp ? GasPlus.WD[by.wp.w].n : 'storm damage';
    GasPlus.feed(`<b class="${by === 'player' ? 'y' : 'r'}">${killer}</b> eliminated <b class="${b.team === 0 ? 'y' : 'r'}">${b.name}</b> with ${wn}`);
    if (by === 'player') { brState.elims++; state.kills++; awardGBucks(50, `Eliminated ${b.name}`); awardXpFromMatch(25, 'Kill XP'); }
    // team wiped: nobody left standing, so knocked teammates are out too
    if (!teamStanding(b.team)) { brState.bots.filter(o => o.team === b.team && o.knocked).forEach(o => killBot(o, by)); if (b.team === 0 && PL.knocked) die(by); }
    if (typeof updateBRHud === 'function') updateBRHud(); checkEnd();
  }
  function finish(win, by) {
    if (over) return; over = true; document.body.style.cursor = ''; if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); lastFin = { win, by: by && by.name ? by.name : by, hp: brState.hp, sh: brState.shield }; const place = win ? 1 : aliveTeams().size + 1;
    if (win) { state.wins++; awardGBucks(250, '#1 Victory Royale'); awardXpFromMatch(100, 'Victory Royale XP'); } else { awardXpFromMatch(Math.max(5, 40 - place), 'Match XP'); } saveState();
    endEl.innerHTML = `<div><h1 style="color:${win ? '#fbbf24' : '#f87171'}">${win ? '🏆 VICTORY ROYALE' : 'ELIMINATED'}</h1><h2>${user()}</h2><p>Placement <b>#${place}</b> · Eliminations <b>${brState.elims}</b>${!win && by ? `<br>Eliminated by ${by === 'storm' ? 'the storm' : by.name}` : ''}</p><button class="btn-primary" style="padding:10px 28px;font-weight:800" onclick="exitBattleRoyaleMatch()">RETURN TO LOBBY</button></div>`; endEl.classList.add('on');
  }
  function die(by) {
    if (PL.dead) return;
    GasPlus.feed(`<b class="r">${nameOf(by)}</b> eliminated <b class="y">${user()}</b>`);
    PL.dead = true; PL.knocked = false; brState.hp = 0; lastKiller = by || 'storm'; brState.player.visible = false; if (ptag) ptag.visible = false; if (window.GasBuild) GasBuild.toggle(false);
    if (!teamStanding(0)) brState.bots.filter(o => o.team === 0 && o.knocked).forEach(o => killBot(o, by));
    if (aliveTeams().has(0)) msg('💀 You were eliminated — spectating your team. Your squad can still win!');
    checkEnd();
  }
  const los = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), n = Math.ceil(L / 4); for (let i = 1; i < n; i++) { const x = a.x + dx * i / n, z = a.z + dz * i / n, y = a.y + 1.4 + (b.y - a.y) * i / n; if (HF(x, z) > y - .6) return false; } return !segHit(a.x, a.y + 1.4, a.z, b.x, b.y + 1.4, b.z, c => c.t === 'tree' && L < 30); };
  function botShoot(b, e) {
    const tp = e.p === 'player' ? PL.p : e.o ? e.o.p : e, tv = e.p === 'player' ? PL : e.o || {}, kn = e.p === 'player' ? PL.knocked : !!(e.o && e.o.knocked);
    const d = GasPlus.WD[b.wp.w], dmg = GasPlus.CHART[b.wp.r][b.wp.w] * .42, o = V(b.p.x, b.p.y + 1.4, b.p.z), lead = Math.hypot(tp.x - b.p.x, tp.z - b.p.z) / ((d.spd || .95) * 60) * (.35 + b.lvl * .65);
    // aim settles the longer a bot tracks the same target (first shots spray, then they get on you)
    const tgt = V(tp.x + (tv.vx || 0) * lead, tp.y + (kn ? .35 : 1.1), tp.z + (tv.vz || 0) * lead), L = o.distanceTo(tgt), err = ((1.15 - b.lvl) * .085 + L * .0007) * Math.max(.42, 1 - (b.track || 0) * (.1 + b.lvl * .14)), n = d.pel || 1;
    noise(b.p.x, b.p.z, b.team);
    for (let i = 0; i < n; i++) { const dir = tgt.clone().sub(o).normalize().add(V(rnd(-1, 1) * err, rnd(-1, 1) * err * .5, rnd(-1, 1) * err)).normalize(), m = new THREE.Mesh(new THREE.SphereGeometry(.12, 6, 6), new THREE.MeshBasicMaterial({ color: '#ff5a3c' })); m.position.copy(o).addScaledVector(dir, .3); matchGroup.add(m); brState.bullets.push({ mesh: m, vel: dir.multiplyScalar(d.spd || .95), life: d.life || 70, dmg: dmg / n, owner: b }); }
    b.mag--; b.cd = Math.max(.2, 1 / (d.rt * .6)) + rnd(0, .25 * (1.2 - b.lvl)); b.mesh.userData.recoil = 1;
    if (b.mag <= 0 && b.ammo > 0) b.rel = d.rl;
  }
  function bullets() {
    for (let i = brState.bullets.length - 1; i >= 0; i--) {
      const b = brState.bullets[i], m = b.mesh.position, ox = m.x, oy = m.y, oz = m.z; m.add(b.vel); b.life--; let kill = b.life <= 0;
      const own = b.owner || 'player', team = own === 'player' ? 0 : own.team;
      if (!kill && b.vel.lengthSq() > 0) {
        if (m.y < HF(m.x, m.z)) kill = true;
        else { const h = segHit(ox, oy, oz, m.x, m.y, m.z); if (h) { kill = true; m.set(ox + (m.x - ox) * h.t, oy + (m.y - oy) * h.t, oz + (m.z - oz) * h.t); hitThing(h.c, b.pick ? 50 : b.dmg || 20, own, m, b.pick); } }
      }
      if (!kill) {
        if (team !== 0 && !PL.dead) { const p = brState.player.position; if (m.distanceTo(V(p.x, p.y + (PL.knocked ? .4 : 1.1), p.z)) < .9) { hurt('player', b.dmg, own); kill = true; } }
        if (!kill) for (const t of brState.bots) { if (t === b.owner || t.st !== 'ground' || t.team === team) continue; if (m.distanceTo(V(t.p.x, t.p.y + (t.knocked ? .4 : 1.1), t.p.z)) < 1.05) { hurt(t, b.dmg || 50, own); kill = true; break; } }
      }
      if (kill) { matchGroup.remove(b.mesh); brState.bullets.splice(i, 1); }
    }
  }
  /* ---------- bot brain ---------- */
  const wrange = w => { const d = GasPlus.WD[w.w]; return Math.min(d.t === 'shells' ? 22 : d.t === 'light' ? 38 : d.t === 'heavy' ? 90 : d.ex ? 60 : 55, d.ex ? 99 : (d.spd || .95) * (d.life || 65) * .8); };   // never farther than the gun's bullets reach
  const blocks = (c, x, z, y) => x > c.x0 - .6 && x < c.x1 + .6 && z > c.z0 - .6 && z < c.z1 + .6 && y + 1.75 > c.y0 && y < topAt(c, Math.max(c.x0, Math.min(c.x1, x)), Math.max(c.z0, Math.min(c.z1, z))) - (c.ramp ? 1.6 : .6);   // ramps/stairs are climbable
  function steer(b, ang) { const look = b.inside ? 1.4 : 3; for (const o of [0, .5, -.5, 1, -1, 1.7, -1.7, 2.6]) { const a = ang + o, x = b.p.x + Math.sin(a) * look, z = b.p.z + Math.cos(a) * look, h = Math.max(HF(x, z), surface(x, z, b.p.y)); if (h > -.1 && h - b.p.y < 2 && !near(x, z).some(c => blocks(c, x, z, b.p.y))) return a; } return ang + 3; }
  // ---- navigation helpers: which house a point is in, and the next waypoint (door, stairs) toward a goal
  function houseAt(x, z, y) { for (const c of near(x, z)) { const H = c.house; if (H && x > H.x0 && x < H.x1 && z > H.z0 && z < H.z1 && y > H.fy - 1.2 && y < H.top + .3) return H; } return null; }
  const floorOf = (H, y) => Math.max(0, Math.min(H.floors - 1, Math.floor((y - H.fy + .6) / H.fh)));   // halfway up the stairs still counts as the floor below
  const goalAt = (x, y, z) => { const H = houseAt(x, z, y); return { x, z, house: H, floor: H ? floorOf(H, y) : 0 }; };
  // stairs: walk beside the first step → onto it → straight up to the landing (and the reverse going down)
  function stairsTo(b, H, f, tf) {
    const D = (x, z) => Math.hypot(b.p.x - x, b.p.z - z);
    if (tf > f) { const s = H.stairs[f]; if (!s) return null; if (b.p.y >= s.y0 + .3 || D(s.ex, s.ez) < .6) return { x: s.tx, z: s.tz }; return D(s.bx, s.bz) < .9 || D(s.ex, s.ez) < 1.6 ? { x: s.ex, z: s.ez } : { x: s.bx, z: s.bz }; }
    const s = H.stairs[f - 1]; if (!s) return null; return b.p.y > s.y1 - .3 && D(s.tx, s.tz) > .8 ? { x: s.tx, z: s.tz } : { x: s.ex, z: s.ez };
  }
  function navPoint(b, g) {
    const H = g.house || null, myH = houseAt(b.p.x, b.p.z, b.p.y); b.inside = !!myH;
    // doors: once past the inner waypoint keep going out (or in) — no turning back in the doorway
    if (myH && myH !== H && myH.door) { const f = floorOf(myH, b.p.y); if (f > 0) return stairsTo(b, myH, f, 0) || g; const d = myH.door, span = Math.hypot(d.ix - d.ox, d.iz - d.oz); return Math.hypot(b.p.x - d.ox, b.p.z - d.oz) < span - .2 || Math.hypot(b.p.x - d.ix, b.p.z - d.iz) < 1.1 ? { x: d.ox, z: d.oz } : { x: d.ix, z: d.iz }; }
    if (H && myH !== H && H.door) { const d = H.door, span = Math.hypot(d.ix - d.ox, d.iz - d.oz); return Math.hypot(b.p.x - d.ox, b.p.z - d.oz) < 1.3 || Math.hypot(b.p.x - d.ix, b.p.z - d.iz) < span - .2 ? { x: d.ix, z: d.iz } : { x: d.ox, z: d.oz }; }
    if (H && myH === H) { const f = floorOf(H, b.p.y), tf = g.floor || 0; if (tf !== f) return stairsTo(b, H, f, tf) || g; }
    return g;
  }
  function knockedMate(b) {
    let best = null, bd = 70;
    if (b.team === 0 && PL.knocked && !PL.dead) { const d = Math.hypot(PL.p.x - b.p.x, PL.p.z - b.p.z); if (d < bd) { bd = d; best = { ref: 'player', d }; } }
    for (const o of brState.bots) if (o !== b && o.team === b.team && o.knocked && !o.dead) { const d = Math.hypot(o.p.x - b.p.x, o.p.z - b.p.z); if (d < bd) { bd = d; best = { ref: o, d }; } }
    return best;
  }
  function teamLead(b) { if (b.team === 0) return PL.dead ? null : PL.p; const m = brState.bots.find(o => o.team === b.team && !o.dead && !o.knocked); return m && m !== b ? m.p : null; }
  function pickGun(b, d) {
    if (!b.wps || b.wps.length < 2 || tm - b.swT < .9) return;
    const want = b.wps.findIndex((x, i) => (GasPlus.WD[x.w].t === 'shells') === (d < 15) && (i === b.wpi ? b.mag + b.ammo > 0 : x.mag + x.ammo > 0));
    if (want >= 0 && want !== b.wpi) { GasPlus.botEquip(b, want); b.swT = tm; }
  }
  function revive(t) {
    if (t === 'player') { if (!PL.knocked || PL.dead) return; PL.knocked = false; brState.hp = 30; brState.shield = 0; msg('💚 You were revived!'); GasPlus.feed(`<b class="y">${user()}</b> was revived`); if (typeof updateBRHud === 'function') updateBRHud(); return; }
    if (!t.knocked || t.dead) return; t.knocked = false; t.hp = 30; t.sh = 0; t.mesh.rotation.x = 0; GasPlus.feed(`<b class="${t.team === 0 ? 'y' : 'r'}">${t.name}</b> was revived`);
  }
  // ---- smarter-bot helpers
  const NOISE = [];                                             // recent gunshots { x, z, t, team }: bots hear fights and come to look
  function noise(x, z, team) { NOISE.push({ x, z, t: tm, team }); if (NOISE.length > 48) NOISE.shift(); }
  function coverSpot(b, from) {                                 // the far side of the nearest tall thing (tree, wall, rock) from a threat
    let cv = null, cd = 26; const px = b.p.x, pz = b.p.z;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const c of near(px + i * CS, pz + j * CS)) if (c.y1 - c.y0 > 3 && !c.ramp && c.y0 < b.p.y + 1) { const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2, dd = Math.hypot(cx - px, cz - pz); if (dd < cd) { cd = dd; cv = c; } }
    if (!cv) return null; const cx = (cv.x0 + cv.x1) / 2, cz = (cv.z0 + cv.z1) / 2, ex = cx - from.x, ez = cz - from.z, el = Math.hypot(ex, ez) || 1;
    return { x: cx + ex / el * ((cv.x1 - cv.x0) / 2 + 2.2), z: cz + ez / el * ((cv.z1 - cv.z0) / 2 + 2.2) };
  }
  function treeNear(x, z, R) { let best = null, bd = R; const n = Math.ceil(R / CS); for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const c of near(x + i * CS, z + j * CS)) if (c.D && c.D.kind === 'tree' && !c.D.dead) { const d = Math.hypot(c.D.x - x, c.D.z - z); if (d < bd) { bd = d; best = c.D; } } return best; }
  // something breakable straight ahead (tree, wall, furniture, a build): what a stuck bot pickaxes through
  function obstacleAhead(b) {
    const g = b.goal ? navPoint(b, b.goal) : null, a = g ? Math.atan2(g.x - b.p.x, g.z - b.p.z) : b.hd, y = b.p.y + 1.1;
    for (const o of [0, .45, -.45]) { const h = segHit(b.p.x, y, b.p.z, b.p.x + Math.sin(a + o) * 1.9, y, b.p.z + Math.cos(a + o) * 1.9); if (h && (h.c.piece || (h.c.D && !h.c.D.dead))) return h.c; }
    return null;
  }
  // build mode: four walls and a roof around me (then heal inside)
  function boxUp(b) {
    if (!window.GasBuild || !GasBuild.enabled || b.mats < 50 || b.inside || b.swim || tm - (b.boxT || -99) < 9) return false;
    const G = 4, i = Math.floor(b.p.x / G), j = Math.floor(b.p.z / G); b.p.x = Math.max(i * G + .7, Math.min(i * G + 3.3, b.p.x)); b.p.z = Math.max(j * G + .7, Math.min(j * G + 3.3, b.p.z));
    const m = b.mats > 220 ? 'brick' : 'wood'; let n = 0;
    for (const yw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) if (GasBuild._place(GasBuild._spec('wall', b.p.x, b.p.y, b.p.z, yw, 0, false), m, b)) n++;
    if (GasBuild._place(GasBuild._spec('roof', b.p.x, b.p.y, b.p.z, 0, 0, false), m, b)) n++;
    b.mats -= n * 10; b.boxT = tm; b.svx = b.svz = 0; return true;
  }
  // nearest loot worth having; a target not reached within 14 s (stairs it can't find, a chest across the water) is skipped from then on
  function lootPick(b, R) {
    const L = GasPlus.lootNear(b.p.x, b.p.z, R, b); if (!L) return null;
    if (b.lootRef !== L.ref) { b.lootRef = L.ref; b.lootT = tm; return L; }
    if (tm - b.lootT > 14) { (b.ban = b.ban || new Set()).add(L.ref); b.lootRef = null; return GasPlus.lootNear(b.p.x, b.p.z, R, b); }
    return L;
  }
  function startHeal(b) {   // meds 4 s, shields 3 s, standing still; getting hit cancels it
    const med = b.med > 0 && b.hp < 75, shd = !med && b.shd > 0 && b.sh < 90; if (!med && !shd) return false;
    const T = med ? 4 : 3; b.heal = { k: med ? 'med' : 'shd', t: T, T }; b.mode = 'heal'; b.goal = null; b.mx = b.mz = 0; return true;
  }
  function think(b, pl) {
    const px = b.p.x, pz = b.p.z, me = { x: px, y: b.p.y, z: pz }, tdc = Math.hypot(px - ST.tx, pz - ST.tz), dc = Math.hypot(px - ST.x, pz - ST.z), urgent = dc > ST.r - 14 || (ph >= 0 && tdc > ST.tr * .9 - 6);
    if (b.knocked) { const m = teamLead(b); b.mode = 'crawl'; b.en = null; b.heal = null; b.brk = null; b.goal = m ? goalAt(m.x, m.y, m.z) : b.attacker && b.attacker.p ? { x: px - (b.attacker.p.x - px), z: pz - (b.attacker.p.z - pz) } : null; b.spd = 2.4; return; }
    if (b.heal) return;                                         // busy healing (botFrame finishes it, a hit cancels it)
    // targets in view (closest few get a line-of-sight test; whoever just shot me is noticed from further away); teammates share what they see
    const att = b.attacker && b.attacker !== 'storm' && tm - b.hitT < 5 && (b.attacker === 'player' ? !PL.dead : !b.attacker.dead) ? b.attacker : null;
    const range = (b.lvl * 35 + 52) * (b.wp ? 1 : .6), cand = [];
    if (b.team !== 0 && !PL.dead && PL.st === 'ground') cand.push({ x: pl.x, y: pl.y, z: pl.z, p: 'player', kn: PL.knocked, att: att === 'player' });
    for (const o of brState.bots) if (o !== b && o.team !== b.team && o.st === 'ground' && !o.dead) cand.push({ x: o.p.x, y: o.p.y, z: o.p.z, o, kn: o.knocked, att: att === o });
    cand.forEach(c => { c.d = Math.hypot(c.x - px, c.z - pz); c.s = c.d + (c.kn ? 6 : 0) - (c.att ? 14 : 0); }); cand.sort((a, c) => a.s - c.s);
    let e = null; for (const c of cand.slice(0, 5)) { if (c.d > range * (c.att ? 1.8 : 1)) continue; if (los(me, c)) { e = c; break; } }
    if (e) { brState.bots.forEach(m => { if (m !== b && m.team === b.team && !m.dead) m.tt = { c: e, t: tm }; }); b.seenT = tm; b.last = { x: e.x, y: e.y, z: e.z, t: tm }; const r = e.o || e.p; if (b.tref !== r) { b.tref = r; b.track = 0; } b.brk = null; b.farm = null; }
    b.en = e;
    const hp = b.hp + b.sh, BLD = !!(window.GasBuild && GasBuild.enabled), bmat = b.mats > 220 ? 'brick' : 'wood';
    if (urgent && !(e && e.d < 22)) { b.mode = 'storm'; b.brk = null; b.goal = { x: ST.tx + rnd(-8, 8), z: ST.tz + rnd(-8, 8) }; b.spd = 7.6; return; }
    const down = knockedMate(b); if (down && (!e || e.d > 40)) { b.mode = 'revive'; b.goal = { ref: down.ref, x: 0, z: 0 }; b.spd = 7.4; return; }
    // hurt in a fight: box up (build mode) and heal inside it
    if (e && (hp < 40 || (hp < 60 && (b.med > 0 || b.shd > 0))) && boxUp(b)) { if (!startHeal(b)) { b.mode = 'hold'; b.goal = null; b.mx = b.mz = 0; b.face = Math.atan2(e.x - px, e.z - pz); b.last = { x: e.x, y: e.y, z: e.z, t: tm }; } return; }
    if (e && b.wp) pickGun(b, e.d);
    // reloading with someone close: back off sideways (and wall up in build mode) instead of standing still
    if (e && b.wp && b.rel > 0 && e.d < 35) { const a = Math.atan2(px - e.x, pz - e.z) + b.sd * 1.1; b.mode = 'evade'; b.goal = null; b.mx = Math.sin(a); b.mz = Math.cos(a); b.spd = 7; b.face = Math.atan2(e.x - px, e.z - pz); if (BLD && b.mats >= 10 && e.d < 22 && Math.random() < b.lvl * .6) GasBuild.botReact(b, e.p === 'player' ? 'player' : e.o); return; }
    if (e && b.wp && !b.rel) { b.mode = 'fight'; const rg = wrange(b.wp) * .55, dx = e.x - px, dz = e.z - pz, d = e.d || 1, ang = Math.atan2(dx, dz);
      if (hp < 55 && b.lvl > .45) { const cv = coverSpot(b, e); if (cv) { b.goal = cv; b.mode = 'cover'; b.spd = 7.2; return; } }
      // they have the high ground: ramp up toward them (build mode)
      if (BLD && e.y - b.p.y > 2.4 && d < 28 && b.mats >= 10 && tm - (b.rampT || -9) > 1.1 && Math.random() < .35 + b.lvl * .55 && GasBuild._place(GasBuild._spec('ramp', px, b.p.y, pz, ang, 0, false), bmat, b)) { b.mats -= 10; b.rampT = tm; }
      const climb = b.rampT && tm - b.rampT < 2.2;
      b.sdT -= .3; if (b.sdT <= 0) { b.sd = -b.sd; b.sdT = rnd(.5, 1.7) * (1.3 - b.lvl * .5); } const push = climb || e.kn ? 1 : d > rg * 1.3 ? 1 : d < rg * .6 ? -.7 : 0, sx = climb ? 0 : Math.cos(ang) * b.sd * .85, sz = climb ? 0 : -Math.sin(ang) * b.sd * .85;
      b.mx = Math.sin(ang) * push + sx; b.mz = Math.cos(ang) * push + sz; b.spd = 5.4 + b.lvl * 1.8; b.face = ang; b.goal = null; b.jump = !b.inside && !climb && Math.random() < .28 * b.lvl; b.crouch = !b.inside && d > 26 && b.lvl > .6 && Math.random() < .45; return; }
    b.crouch = false;
    // no gun: cornered → swing the pickaxe at them; otherwise only run from someone close, and keep looting
    if (e && !b.wp && e.d < 4.5) { b.mode = 'melee'; b.goal = null; b.mx = Math.sin(Math.atan2(e.x - px, e.z - pz)); b.mz = Math.cos(Math.atan2(e.x - px, e.z - pz)); b.face = Math.atan2(e.x - px, e.z - pz); b.spd = 6.5; return; }
    if (e && !b.wp && e.d < 14) { b.mode = 'flee'; b.goal = { x: px - (e.x - px), z: pz - (e.z - pz) }; b.spd = 7.4; return; }
    // no gun yet: race for the nearest loot before anything else
    if (!b.wp) { const L0 = lootPick(b, 240); if (L0) { b.mode = 'loot'; b.goal = L0; b.spd = 7; if (Math.hypot(L0.x - px, L0.z - pz) < 2.6 && Math.abs((L0.y != null ? L0.y : b.p.y) - b.p.y) < 1.8) GasPlus.botTake(b, L0); return; } }
    // heal up when it's quiet (takes a few seconds, like yours)
    if (!e && tm - b.hitT > 2.5 && ((b.med > 0 && b.hp < 75) || (b.shd > 0 && b.sh < 70)) && startHeal(b)) return;
    // lost sight of the enemy: check where they were last seen, or hold the angle when hurt
    if (b.wp && b.last && tm - b.last.t < 5.5) { const L = b.last; if (hp > 45 && Math.hypot(L.x - px, L.z - pz) > 3 && Math.hypot(L.x - px, L.z - pz) < 70) { b.mode = 'hunt'; b.goal = goalAt(L.x, L.y, L.z); b.spd = 6.9; return; } if (hp <= 45 && tm - b.last.t < 4) { b.mode = 'hold'; b.goal = null; b.mx = b.mz = 0; b.face = Math.atan2(L.x - px, L.z - pz); return; } }
    // shot by someone I can't see: go and find them when healthy, otherwise get behind something
    if (att && b.wp) { const ap = att === 'player' ? PL.p : att.p; if (hp > 55) { b.mode = 'push'; b.goal = goalAt(ap.x, ap.y, ap.z); b.spd = 7.2; return; } const cv = coverSpot(b, ap); if (cv) { b.mode = 'cover'; b.goal = cv; b.spd = 7.2; return; } }
    // a teammate spotted someone: go help (focus fire)
    if (b.wp && b.tt && tm - b.tt.t < 5 && !b.rel) { const c = b.tt.c, cp = c.p === 'player' ? PL.p : c.o && !c.o.dead ? c.o.p : null; if (cp && Math.hypot(cp.x - px, cp.z - pz) < 90) { b.mode = 'push'; b.goal = goalAt(cp.x, cp.y, cp.z); b.spd = 7.2; return; } }
    // under-equipped (one gun, or no heals): looting comes before going looking for fights
    if (b.wp && ((b.wps || []).length < 2 || b.med + b.shd === 0)) { const L1 = lootPick(b, 75); if (L1 && Math.random() < .85) { b.mode = 'loot'; b.goal = L1; b.spd = 6.8; if (Math.hypot(L1.x - px, L1.z - pz) < 2.6 && Math.abs((L1.y != null ? L1.y : b.p.y) - b.p.y) < 1.8) GasPlus.botTake(b, L1); return; } }
    // gunfire nearby: armed, healthy bots go and take a look (third-partying)
    if (b.wp && hp > 60) {
      if ((b.nzT || 0) < tm) { let nb = null, nd = 95; for (const n of NOISE) if (n.team !== b.team && tm - n.t < 6) { const d = Math.hypot(n.x - px, n.z - pz); if (d < nd && d > 8) { nd = d; nb = n; } } if (nb) { b.nzT = tm + 8; if (Math.random() < .45 + b.lvl * .45) b.ngoal = { x: nb.x + rnd(-8, 8), z: nb.z + rnd(-8, 8), until: tm + 14 }; } }
      if (b.ngoal && tm < b.ngoal.until && Math.hypot(b.ngoal.x - px, b.ngoal.z - pz) > 6) { b.mode = 'investigate'; b.goal = goalAt(b.ngoal.x, b.p.y, b.ngoal.z); b.spd = 6.9; return; }
    }
    // stay with the squad
    const lead = teamLead(b); if (lead && TEAMSZ > 1 && Math.hypot(lead.x - px, lead.z - pz) > 42) { b.mode = 'regroup'; b.goal = goalAt(lead.x + rnd(-4, 4), lead.y, lead.z + rnd(-4, 4)); b.spd = 7.4; return; }
    // low on materials (build mode): chop the nearest tree with the pickaxe
    if (BLD && b.mats < 90 && b.wp && tm > (b.farmCD || 0)) {
      if (b.farm && (b.farm.dead || tm > b.farmUntil)) { if (!b.farm.dead) b.farmCD = tm + 15; b.farm = null; }
      if (!b.farm && tm > (b.farmCD || 0)) { b.farm = treeNear(px, pz, 40); b.farmUntil = tm + 20; if (!b.farm) b.farmCD = tm + 6; }
      if (b.farm) { b.mode = 'farm'; b.goal = { x: b.farm.x, z: b.farm.z }; b.spd = 6.4; return; }
    }
    // loot: chests and drops (inside houses too — navPoint walks through doors and up stairs)
    const L = lootPick(b, b.wp ? 60 : 220); if (L && (!b.wp || Math.random() < .6)) { b.mode = 'loot'; b.goal = L; b.spd = 6.6; if (Math.hypot(L.x - px, L.z - pz) < 2.6 && Math.abs((L.y != null ? L.y : b.p.y) - b.p.y) < 1.8) GasPlus.botTake(b, L); return; }
    b.mode = 'roam'; if (!b.goal || b.mode !== 'roam' || Math.hypot(b.goal.x - px, b.goal.z - pz) < 6 || Math.random() < .08) { const t = TOWNS[ri(TOWNS.length)], q = spot(0); b.goal = Math.random() < .6 ? { x: t[1] + rnd(-20, 20), z: t[2] + rnd(-20, 20) } : q; if (Math.hypot(b.goal.x - ST.tx, b.goal.z - ST.tz) > ST.tr - 10) b.goal = { x: ST.tx, z: ST.tz }; } b.spd = 6.2;
  }
  function botFrame(b, dt, pl, now, nearP) {
    b.cd -= dt; if (b.rel > 0) { b.rel -= dt; if (b.rel <= 0 && b.wp) { const d = GasPlus.WD[b.wp.w], t = Math.min(d.mg - b.mag, b.ammo); b.mag += t; b.ammo -= t; } }
    if (b.knocked) { b.khp -= 3.2 * dt; if (b.khp <= 0) { killBot(b, b.knockedBy); return; } }
    b.tNext -= dt; if (b.tNext <= 0) {
      think(b, pl); b.tNext = nearP ? rnd(.22, .4) : rnd(.7, 1.1);
      // stuck? pickaxe through whatever breakable thing is in the way, otherwise jump and walk off in a new direction
      const still = b.heal || b.brk || b.mode === 'revive' || b.mode === 'hold' || b.mode === 'farm' || (b.unstick && tm < b.unstick);
      if (!still && Math.hypot(b.p.x - b.lx, b.p.z - b.lz) < .6) b.stk++; else b.stk = 0; b.lx = b.p.x; b.lz = b.p.z;
      if (b.stk > 1 && !b.brk && !b.en) { const ob = obstacleAhead(b); if (ob) { b.brk = { c: ob, until: tm + 7 }; b.stk = 0; } }
      if (b.stk > 2) { b.hd = rnd(0, 6.28); b.stk = 0; b.goal = null; b.mx = Math.sin(b.hd); b.mz = Math.cos(b.hd); b.unstick = tm + 1.1; b.jump = true; b.tNext = 1.1; }
    }
    if (b.mesh.userData.pkSwing > 0) b.mesh.userData.pkSwing = Math.max(0, b.mesh.userData.pkSwing - dt);
    // empty gun: swap to the other one, or throw it away
    if (b.wp && b.mag <= 0 && b.ammo <= 0 && b.rel <= 0) { const o = (b.wps || []).findIndex((x, i) => i !== b.wpi && x.mag + x.ammo > 0); if (o >= 0) GasPlus.botEquip(b, o); else { if (b.wps && b.wpi != null) b.wps.splice(b.wpi, 1); b.wpi = null; b.wp = null; if (b.hand) b.hand.visible = false; } }
    let mx = 0, mz = 0; const ox = b.p.x, oz = b.p.z;
    b.arr = 1;
    const toward = g => { const dx = g.x - b.p.x, dz = g.z - b.p.z, d = Math.hypot(dx, dz); if (b.inside) b.arr = Math.min(1, Math.max(.35, d / 1.6)); if (d > (b.inside ? .45 : 1.2)) { b.hd = steer(b, Math.atan2(dx, dz)); mx = Math.sin(b.hd); mz = Math.cos(b.hd); b.mesh.rotation.y += Math.atan2(Math.sin(b.hd - b.mesh.rotation.y), Math.cos(b.hd - b.mesh.rotation.y)) * Math.min(1, dt * 7); } };
    const faceA = fa => { b.mesh.rotation.y += Math.atan2(Math.sin(fa - b.mesh.rotation.y), Math.cos(fa - b.mesh.rotation.y)) * Math.min(1, dt * 8); };
    const face = (x, z) => faceA(Math.atan2(x - b.p.x, z - b.p.z));
    const swingAt = (D, c, x, z) => { face(x, z); b.swT2 = (b.swT2 || 0) - dt; if (b.swT2 <= 0) { b.swT2 = .5; b.mesh.userData.pkSwing = .4; const pt = { x, y: b.p.y + 1.2, z }; if (c) hitThing(c, 50, b, pt, false); else { damageWorld(D, 50, b, pt); b.mats = Math.min(999, b.mats + 12); } } };
    if (b.heal && !b.knocked) {                                  // healing: stand still until it's done
      b.heal.t -= dt; if (b.heal.t <= 0) { if (b.heal.k === 'med') { b.med--; b.hp = Math.min(100, b.hp + 50); } else { b.shd--; b.sh = Math.min(100, b.sh + 50); } b.heal = null; b.tNext = 0; }
    } else if (b.brk && !b.knocked) {                            // pickaxe through a wall / tree / build that blocks the way
      const c = b.brk.c, alive = c.piece ? !!(window.GasBuild && GasBuild.pieces.includes(c.piece)) : !c.D.dead, cx = Math.max(c.x0, Math.min(c.x1, b.p.x)), cz = Math.max(c.z0, Math.min(c.z1, b.p.z));
      if (!alive || tm > b.brk.until) { b.brk = null; b.tNext = 0; } else if (Math.hypot(cx - b.p.x, cz - b.p.z) > 1.7) toward({ x: cx, z: cz }); else swingAt(null, c, cx, cz);
    } else if (b.mode === 'farm' && b.farm && !b.knocked) {      // chopping a tree for wood
      const T = b.farm; if (T.dead) { b.farm = null; b.tNext = 0; } else if (Math.hypot(T.x - b.p.x, T.z - b.p.z) > 1.75) toward({ x: T.x, z: T.z }); else swingAt(T, null, T.x, T.z);
    } else if (b.mode === 'fight' && b.en && !b.knocked) {
      mx = b.mx; mz = b.mz; const tp = b.en.p === 'player' ? PL.p : b.en.o ? b.en.o.p : b.en; face(tp.x, tp.z); b.track = (b.track || 0) + dt;
      b.aimT += dt; if (b.wp && b.cd <= 0 && b.rel <= 0 && b.mag > 0 && b.aimT > (1.1 - b.lvl) * .9 && Math.hypot(tp.x - b.p.x, tp.z - b.p.z) < wrange(b.wp) * 1.4) botShoot(b, b.en); if (b.mag <= 0 && b.ammo > 0 && b.rel <= 0 && b.wp) b.rel = GasPlus.WD[b.wp.w].rl;
    } else if ((b.mode === 'evade' || b.mode === 'hold') && !b.knocked) {
      mx = b.mx; mz = b.mz; if (b.face != null) faceA(b.face);
    } else if (b.mode === 'melee' && b.en && !b.knocked) {      // unarmed and cornered: pickaxe swings
      const tp = b.en.p === 'player' ? PL.p : b.en.o ? b.en.o.p : b.en, d = Math.hypot(tp.x - b.p.x, tp.z - b.p.z); face(tp.x, tp.z); if (d > 1.6) { mx = b.mx; mz = b.mz; }
      b.swT2 = (b.swT2 || 0) - dt; if (b.swT2 <= 0 && d < 2.3 && Math.abs(tp.y - b.p.y) < 1.6) { b.swT2 = .55; b.mesh.userData.pkSwing = .4; hurt(b.en.p === 'player' ? 'player' : b.en.o, 20, b); }
    } else if (b.unstick && tm < b.unstick && !b.knocked) {     // walking off in a new direction after getting stuck
      mx = b.mx; mz = b.mz; faceA(Math.atan2(mx, mz));
    } else if (b.mode === 'revive' && b.goal && b.goal.ref) {
      const t = b.goal.ref, tp = t === 'player' ? PL.p : t.p;
      if (t === 'player' ? !PL.knocked || PL.dead : !t.knocked || t.dead) { b.mode = 'roam'; b.revT = 0; }
      else if (Math.hypot(tp.x - b.p.x, tp.z - b.p.z) < 1.9 && Math.abs(tp.y - b.p.y) < 1.5) { face(tp.x, tp.z); b.revT += dt; if (b.revT >= 3) { revive(t); b.revT = 0; b.mode = 'roam'; } }
      else { b.revT = 0; toward(navPoint(b, goalAt(tp.x, tp.y, tp.z))); }
    } else { b.aimT = 0; b.track = 0; if (b.goal) toward(navPoint(b, b.goal)); }
    // smooth acceleration (no instant direction flips while strafing)
    const l = Math.hypot(mx, mz), spd = b.knocked ? 2.4 : b.spd, tk = l > 0 && spd ? spd * b.arr / l : 0, kk = 1 - Math.exp(-dt * (b.air ? 2.5 : b.inside ? 22 : 9));   // snappy indoors + slow down at waypoints
    b.svx = (b.svx || 0) + (mx * tk - (b.svx || 0)) * kk; b.svz = (b.svz || 0) + (mz * tk - (b.svz || 0)) * kk;
    if (Math.abs(b.svx) + Math.abs(b.svz) > .02) { const px = b.p.x, pz = b.p.z; step(b, b.svx * dt, b.svz * dt); if (HF(b.p.x, b.p.z) < -.1 && !b.inside) { b.p.x = px; b.p.z = pz; b.goal = null; b.svx = b.svz = 0; } }
    const vyB = b.vy, wasAir = b.air; vert(b, dt, b.jump && !b.knocked); b.jump = false; if (b.swim) { b.p.y = HF(b.p.x, b.p.z); }
    b.vx = (b.p.x - ox) / dt; b.vz = (b.p.z - oz) / dt;
    if (nearP) {
      const r = b.mesh.rotation.y, tp = b.en ? (b.en.p === 'player' ? PL.p : b.en.o ? b.en.o.p : b.en) : null;
      b.mesh.userData.motion = { speed: Math.hypot(b.vx, b.vz), fwd: b.vx * Math.sin(r) + b.vz * Math.cos(r), side: b.vx * Math.cos(r) - b.vz * Math.sin(r), air: b.air && !b.swim, vy: b.vy, land: wasAir && !b.air && vyB < -9 ? .7 : 0, swim: b.swim, knocked: b.knocked, sprint: b.spd > 7.2 && b.mode !== 'fight', crouch: !!b.crouch && b.mode === 'fight' && !b.air, using: b.heal ? 1 - b.heal.t / b.heal.T : 0, aim: tp && b.mode === 'fight' ? Math.atan2(b.p.y + 1.4 - (tp.y + 1.1), Math.hypot(tp.x - b.p.x, tp.z - b.p.z)) : 0, reload: b.rel > 0 && b.wp ? 1 - b.rel / GasPlus.WD[b.wp.w].rl : 0 };
      const chop = !!b.brk || (b.mode === 'farm' && !!b.farm), pk = b.mesh.userData.pk;
      if (b.hand) b.hand.visible = !b.knocked && !!b.wp && !chop && !b.heal; if (pk) pk.visible = !(b.hand && b.hand.visible);   // gun away while chopping / healing
      CharacterRigBuilder.applyHeroStance(b.mesh, now, 'run'); b.mesh.rotation.x = b.knocked ? 1.3 : 0;
    }
  }
  /* ---------- storm ---------- */
  function stormTick(dt) {
    const cur = tm < T0 ? -1 : Math.min(PH.length - 1, Math.floor((tm - T0) / GAP));
    if (cur !== ph && cur >= 0) { ph = cur; ST.ox = ST.x; ST.oz = ST.z; ST.or = ST.r; ST.tr = PH[ph].r; ST.t0 = T0 + GAP * ph;
      // next centre: somewhere inside the current circle, on land (so the last circles never end up out at sea)
      const maxD = Math.max(0, ST.r - ST.tr) * .7; ST.tx = ST.x; ST.tz = ST.z; for (let k = 0; k < 40; k++) { const a = rnd(0, 6.28), dd = rnd(0, maxD), cx = ST.x + Math.cos(a) * dd, cz = ST.z + Math.sin(a) * dd; if (HF(cx, cz) > 1.5 && Math.abs(cx) < WR - 60 && Math.abs(cz) < WR - 60) { ST.tx = cx; ST.tz = cz; break; } }
      if (HF(ST.tx, ST.tz) <= 1.5) for (let k = 0; k < 25; k++) { const lc = spot(0); if (Math.hypot(lc.x - ST.x, lc.z - ST.z) < maxD) { ST.tx = lc.x; ST.tz = lc.z; break; } }
      msg(`⚠️ THE STORM IS CLOSING (${ph + 1}/${PH.length})! Move to the safe zone!`);
      if (ph >= 1 && ph <= 7 && ph % 2 === 1 && GasPlus.supplyDrop) for (let k = 0; k < 30; k++) { const a2 = rnd(0, 6.28), r2 = rnd(0, ST.tr * .6), sx = ST.tx + Math.cos(a2) * r2, sz = ST.tz + Math.sin(a2) * r2; if (HF(sx, sz) > 1) { ST.drop = { at: tm + 4, x: sx, z: sz }; break; } } }
    if (ST.drop && tm >= ST.drop.at) { GasPlus.supplyDrop(ST.drop.x, ST.drop.z); ST.drop = null; }   // game time, so pausing can't skip it
    if (ph >= 0) { const f = Math.min(1, (tm - ST.t0) / SHR); ST.x = ST.ox + (ST.tx - ST.ox) * f; ST.z = ST.oz + (ST.tz - ST.oz) * f; ST.r = ST.or + (ST.tr - ST.or) * f; }
    storm.position.set(ST.x, 120, ST.z); storm.scale.set(ST.r, 1, ST.r); storm.material.opacity = .26 + Math.sin(tm * 3) * .06;
    let txt; const f = ph >= 0 ? Math.min(1, (tm - ST.t0) / SHR) : 0, mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s) % 60)).padStart(2, '0')}`;
    if (ph < 0) txt = `STORM IN <b id="br-storm">${mmss(T0 - tm)}</b>`; else if (f < 1) txt = `⚠ CLOSING <b id="br-storm">${mmss(SHR - (tm - ST.t0))}</b>`; else if (ph >= PH.length - 1) txt = `<b id="br-storm">FINAL ZONE</b>`; else txt = `NEXT STORM <b id="br-storm">${mmss(T0 + GAP * (ph + 1) - tm)}</b>`;
    if (txt !== lastTxt) { lastTxt = txt; const el = document.getElementById('br-mode-stat'); if (el) el.innerHTML = txt; }
    dmgT += dt; if (dmgT >= 1) { dmgT = 0; const d = PH[Math.max(0, ph)].d; if (PL.st === 'ground' && !PL.dead && Math.hypot(PL.p.x - ST.x, PL.p.z - ST.z) > ST.r) hurt('player', d, null); for (const b of brState.bots.slice()) if (b.st === 'ground' && Math.hypot(b.p.x - ST.x, b.p.z - ST.z) > ST.r) hurt(b, d, null); }
    vigEl.style.opacity = (PL.st === 'ground' || PL.st === 'fall' || PL.st === 'glide') && Math.hypot(PL.p.x - ST.x, PL.p.z - ST.z) > ST.r ? .9 : 0;
  }
  /* ---------- bus flight ---------- */
  let totalP = 0, lastFin = null;
  function busTick(dt) {
    bus.t += dt; const s = bus.speed * bus.t, bx = bus.s.x + bus.d.x * s, bz = bus.s.z + bus.d.z * s, by = bus.alt + Math.sin(bus.t * 1.4) * 1.5; bus.pos = { x: bx, y: by, z: bz };
    busMesh.position.set(bx, by, bz); busMesh.rotation.y = Math.atan2(bus.d.x, bus.d.z); busMesh.rotation.z = Math.sin(bus.t * 1.1) * .03;
    brState.bots.forEach(b => { if (b.st === 'bus' && (b.followPlayer ? PL.st !== 'bus' || s >= bus.len - 300 : s >= b.jumpS)) { b.st = 'fall'; b.p.set(bx + rnd(-3, 3), by - 3, bz + rnd(-3, 3)); b.vy = -8; b.hx = bus.d.x * 20; b.hz = bus.d.z * 20; b.mesh.visible = true; b.tg.visible = true; jumped++; } });
    if (PL.st === 'bus') { PL.p.set(bx - bus.d.x * 1.5, by + 2.1, bz - bus.d.z * 1.5); if (bus.t > 4 && (GasPlus.held.jump || s >= bus.len - 300)) jumpPlayer(); }
    if (s >= bus.len + 50) { bus.done = true; matchGroup.remove(busMesh); }
  }
  /* ---------- player ---------- */
  // mantle: holding jump while running into a ledge 0.9–2.5 m above your feet pulls you up onto it
  function tryMantle() {
    if (PL.mant || PL.swim || PL.knocked) return;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), x = PL.p.x + fx * .85, z = PL.p.z + fz * .85; let top = -1e9;
    for (const c of near(x, z)) if (!c.ramp && x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && c.y1 > PL.p.y + .9 && c.y1 < PL.p.y + 2.5 && c.y0 < PL.p.y + 1.6) top = Math.max(top, c.y1);
    if (top < -1e8) return;
    for (const c of near(x, z)) if (x > c.x0 - .3 && x < c.x1 + .3 && z > c.z0 - .3 && z < c.z1 + .3 && c.y0 < top + 1.8 && c.y1 > top + .05) return;   // no head room
    PL.mant = { t: 0, x0: PL.p.x, y0: PL.p.y, z0: PL.p.z, x1: x, y1: top + .02, z1: z };
  }
  // crouch toggle; crouching while sprinting starts a slide that keeps your momentum
  function crouch() {
    if ((PL.st !== 'ground' && PL.st !== 'lobby') || PL.knocked || PL.swim || PL.mant || PL.dead) return;
    if (PL.slideT) { PL.slideT = 0; PL.crouch = false; return; }
    if (!PL.crouch && !PL.air && Math.hypot(PL.svx, PL.svz) > 13) { PL.slideT = 1.05; PL.svx *= 1.12; PL.svz *= 1.12; return; }
    PL.crouch = !PL.crouch;
  }
  function playerTick(dt, time) {
    const p = brState.player, k = brState.keys, held = GasPlus.held, st = PL.st;
    if (PL.dead) { p.visible = false; return; }
    p.rotation.y = yaw;
    const f = ((k.KeyW || k.ArrowUp) ? 1 : 0) - ((k.KeyS || k.ArrowDown) ? 1 : 0), sx = ((k.KeyA || k.ArrowLeft) ? 1 : 0) - ((k.KeyD || k.ArrowRight) ? 1 : 0), fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    let mx = fx * f + lx * sx, mz = fz * f + lz * sx; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const ox = PL.p.x, oz = PL.p.z;
    if (PL.knocked) { PL.khp -= 2.6 * dt; if (PL.khp <= 0) { die(PL.knockedBy); return; } }
    // hold the interact key next to a knocked teammate to revive them (3 s)
    PL.revMate = null;
    if (held.interact && !PL.knocked && st === 'ground') { const m = brState.bots.find(o => o.team === 0 && o.knocked && !o.dead && Math.hypot(o.p.x - PL.p.x, o.p.z - PL.p.z) < 2.3 && Math.abs(o.p.y - PL.p.y) < 1.5); if (m) { PL.revMate = m; PL.revT += dt; mx = mz = 0; if (PL.revT >= 3) { revive(m); PL.revT = 0; } } else PL.revT = 0; } else PL.revT = 0;
    const sprinting = st !== 'bus' && held.sprint && f > 0 && !PL.crouch && !PL.knocked && !PL.swim; PL.sprinting = sprinting;
    if (st === 'lobby' || st === 'ground') {
      // ---- smooth ground movement: accelerate / brake instead of snapping; less control in the air (momentum)
      if (PL.slideT > 0) { PL.slideT -= dt; const fr = Math.exp(-dt * 1.25); PL.svx *= fr; PL.svz *= fr; if (PL.slideT <= 0 || Math.hypot(PL.svx, PL.svz) < 5) { PL.slideT = 0; PL.crouch = true; } }
      else {
        const sp = PL.knocked ? 3.2 : PL.swim ? 4.4 : PL.crouch ? 5.6 : sprinting ? 16.5 : 12.6, rate = PL.air ? 2.4 : ml > 0 ? 11 : 14, kk = 1 - Math.exp(-dt * rate);
        PL.svx += (mx * sp - PL.svx) * kk; PL.svz += (mz * sp - PL.svz) * kk;
      }
      if (PL.mant) { // mantle: pull up, then over the ledge
        const m = PL.mant; m.t += dt / .4; const t2 = Math.min(1, m.t), up = Math.min(1, t2 / .6), ov = Math.max(0, (t2 - .45) / .55);
        PL.p.set(m.x0 + (m.x1 - m.x0) * ov, m.y0 + (m.y1 - m.y0) * (1 - (1 - up) * (1 - up)), m.z0 + (m.z1 - m.z0) * ov); PL.vy = 0; PL.svx = PL.svz = 0; PL.air = false;
        if (t2 >= 1) PL.mant = null;
      } else {
        step(PL, PL.svx * dt, PL.svz * dt);
        const vyB = PL.vy, wasAir = PL.air, jump = held.jump && !uiState.isEmoting && !PL.knocked && !PL.slideT;
        if (jump && PL.crouch) PL.crouch = false;
        vert(PL, dt, jump);
        if (wasAir && !PL.air && vyB < -9) PL.landK = Math.min(1, (-vyB - 7) / 14);
        if (held.jump && f > 0 && !PL.knocked) tryMantle();
      }
      if (st === 'lobby' && (Math.hypot(PL.p.x - SX, PL.p.z - SZ) > 148 || HF(PL.p.x, PL.p.z) < -.3)) { const q = plazaPoint(30); PL.p.set(q.x, HF(q.x, q.z), q.z); PL.vy = 0; msg('Welcome back to the waiting area!'); }
    } else if (st === 'fall' || st === 'glide') {
      const base = st === 'fall' ? 18 + 14 * f : 15 + 3 * f; if (airTick(PL, dt, fx * base + lx * sx * 14, fz * base + lz * sx * 14)) { PL.st = 'ground'; PL.svx = PL.hx * .5; PL.svz = PL.hz * .5; PL.landK = .8; msg('✅ Landed! Find a chest to loot up — 100 HP, 0 shield, empty inventory.'); }
    }
    glider.visible = PL.st === 'glide'; PL.vx = (PL.p.x - ox) / dt; PL.vz = (PL.p.z - oz) / dt;
    const tilt = PL.knocked ? 1.3 : PL.swim ? 1.2 : PL.st === 'fall' ? 1.35 : PL.st === 'glide' ? .12 : 0; p.rotation.x += (tilt - p.rotation.x) * Math.min(1, dt * 6);
    p.rotation.y += angd(yaw, p.rotation.y) * (1 - Math.exp(-dt * 24));   // turn smoothly toward where you look
    const air = PL.st === 'fall' || PL.st === 'glide', spd = Math.hypot(PL.svx, PL.svz), moving = spd > .8 && !air && PL.st !== 'bus';
    if (moving && uiState.isEmoting) uiState.isEmoting = false;            // moving cancels an emote
    // ---- hand the animation system a description of how we're moving
    PL.visY = PL.visY == null || Math.abs(PL.visY - PL.p.y) > 1.2 || air ? PL.p.y : PL.visY + (PL.p.y - PL.visY) * (1 - Math.exp(-dt * 16));
    const r = p.rotation.y, pud = p.userData;
    pud.motion = { speed: air || PL.st === 'bus' ? 0 : spd, fwd: PL.svx * Math.sin(r) + PL.svz * Math.cos(r), side: PL.svx * Math.cos(r) - PL.svz * Math.sin(r), air: PL.air && !air && !PL.swim, vy: PL.vy, sprint: sprinting, crouch: PL.crouch && !PL.slideT, slide: PL.slideT > 0, land: PL.landK || 0, mantle: PL.mant ? Math.min(1, PL.mant.t) : 0, swim: PL.swim, fall: PL.st === 'fall', glide: PL.st === 'glide', knocked: PL.knocked, aim: pitch, ads: aiming && PL.st === 'ground', stepOff: PL.visY - PL.p.y, reload: pud.reloadP || 0, using: !!pud.usingP, emote: uiState.isEmoting };
    PL.landK = 0;
    CharacterRigBuilder.applyHeroStance(p, time, uiState.isEmoting ? 'emote' : 'run');
    if (swing > 0) { swing -= dt; p.userData.pkSwing = Math.max(0, swing); }
    if (PL.swim) { if (!swimRing) { swimRing = new THREE.Mesh(new THREE.RingGeometry(.9, 1.1, 28), new THREE.MeshBasicMaterial({ color: '#cfeeff', transparent: true, side: THREE.DoubleSide })); swimRing.rotation.x = -Math.PI / 2; } if (!swimRing.parent) matchGroup.add(swimRing); const s = 1 + (time * 1.5 % 1) * 1.2; swimRing.scale.set(s, s, s); swimRing.material.opacity = 1 - (time * 1.5 % 1); swimRing.position.set(PL.p.x, .05, PL.p.z); } else if (swimRing && swimRing.parent) matchGroup.remove(swimRing);
    if (WG.userData.water) WG.userData.water.material.opacity = .78 + Math.sin(time * 1.3) * .03;
  }
  /* ---------- bots ---------- */
  function botsTick(dt, time) {
    const pp = PL.p, pl = { x: pp.x, y: pp.y, z: pp.z };
    brState.bots.slice().forEach(b => {
      const d = Math.hypot(b.p.x - pl.x, b.p.z - pl.z), nearP = d < 90;
      if (b.st === 'lobby') { botLobby(b, dt, time, d < 120); return; } if (b.st === 'bus') return;
      if (b.st === 'fall' || b.st === 'glide') {
        if (b.followPlayer && !PL.dead && PL.st !== 'bus') b.tgt = { x: PL.p.x + b.fo.x, z: PL.p.z + b.fo.z };
        const dx = b.tgt.x - b.p.x, dz = b.tgt.z - b.p.z, dd = Math.hypot(dx, dz) || 1, sp = Math.min(b.st === 'fall' ? 28 : 16, dd * .8 + 5), landed = airTick(b, dt, dx / dd * sp, dz / dd * sp);
        b.mesh.rotation.x += ((b.st === 'fall' ? 1.3 : .1) - b.mesh.rotation.x) * Math.min(1, dt * 5); b.mesh.visible = d < 450; b.tg.position.set(b.p.x, b.p.y + 2.5, b.p.z); b.tg.visible = d < 120;
        if (d < 160) { b.mesh.userData.motion = { speed: 0, fall: b.st === 'fall', glide: b.st === 'glide' }; CharacterRigBuilder.applyHeroStance(b.mesh, time, 'idle'); }
        if (landed) { b.st = 'ground'; b.mesh.rotation.x = 0; b.lx = b.p.x; b.lz = b.p.z; b.tNext = rnd(0, .5); } return;
      }
      b.mesh.visible = d < 230; b.tg.visible = d < (b.team === 0 ? 400 : 65); botFrame(b, dt, pl, time, nearP); b.tg.position.set(b.p.x, b.p.y + 2.5, b.p.z);
    });
  }
  /* ---------- camera: mouse-look orbit / first person / skydive / bus cinematic ---------- */
  function camClip(T, C) {
    const cx = C.x, cy = C.y, cz = C.z;
    for (let i = 1; i <= 12; i++) { const q = i / 12, x = T.x + (cx - T.x) * q, y = T.y + (cy - T.y) * q, z = T.z + (cz - T.z) * q; let h = y < Math.max(HF(x, z), 0) + .35; if (!h) for (const b of near(x, z)) if (x > b.x0 - .2 && x < b.x1 + .2 && z > b.z0 - .2 && z < b.z1 + .2 && y > b.y0 && y < b.y1 + .2) { h = true; break; }
      if (h) { const qq = Math.max(.08, (i - 1.5) / 12); C.set(T.x + (cx - T.x) * qq, T.y + (cy - T.y) * qq, T.z + (cz - T.z) * qq); break; } }
    C.y = Math.max(C.y, Math.max(HF(C.x, C.z), 0) + .5);
  }
  function camUpdate(dt) {
    const p = brState.player, st = PL.st;
    if (phase !== 'lobby' && st === 'bus' && bus && bus.t < 4) { const a = .5 + bus.t * .7, b = bus.pos || { x: PL.p.x, y: PL.p.y, z: PL.p.z }; camera.position.set(b.x + Math.cos(a) * 30, b.y + 9, b.z + Math.sin(a) * 30); camera.lookAt(b.x, b.y + 4, b.z); p.visible = true; ptag.visible = false; return; }
    if (PL.dead) { // spectate a teammate (or whoever is left)
      if (!spec || spec.dead) spec = brState.bots.find(o => o.team === 0 && !o.dead) || brState.bots.find(o => !o.dead) || null;
      const sp = spec ? spec.p : PL.p, c2 = Math.cos(pitch), lk = V(Math.sin(yaw) * c2, -Math.sin(pitch), Math.cos(yaw) * c2), T2 = V(sp.x, sp.y + 1.55, sp.z), C2 = T2.clone().addScaledVector(lk, -6); camClip(T2, C2);
      camera.position.lerp(C2, Math.min(1, dt * 10)); camera.lookAt(T2.x + lk.x * 20, T2.y + lk.y * 20, T2.z + lk.z * 20); p.visible = false; ptag.visible = false; return;
    }
    const air = st === 'fall' || st === 'glide', D = air ? (st === 'fall' ? 9.5 : 8) : aiming ? 3.2 : st === 'bus' ? 11 : 5.2, cp = Math.cos(pitch), look = V(Math.sin(yaw) * cp, -Math.sin(pitch), Math.cos(yaw) * cp);
    const zf = GasPlus.weaponZoom ? GasPlus.weaponZoom() : /Sniper|Scoped/.test(GasPlus.weaponName()) ? .4 : .72, tf = aiming && st === 'ground' ? baseFov * zf : baseFov * (PL.slideT ? 1.1 : PL.sprinting && Math.hypot(PL.svx, PL.svz) > 14 ? 1.07 : 1); if (Math.abs(camera.fov - tf) > .05) { camera.fov += (tf - camera.fov) * Math.min(1, dt * 10); camera.updateProjectionMatrix(); }
    if (fpv && (st === 'ground' || st === 'lobby')) { camera.position.set(PL.p.x + Math.sin(yaw) * .25, PL.p.y + 1.7, PL.p.z + Math.cos(yaw) * .25); camera.lookAt(camera.position.x + look.x * 10, camera.position.y + look.y * 10, camera.position.z + look.z * 10); p.visible = false; ptag.visible = false; return; }
    p.visible = true; ptag.visible = true;
    PL.camH += ((PL.swim ? .8 : PL.knocked ? .8 : PL.slideT ? .95 : PL.crouch ? 1.12 : 1.55) - PL.camH) * Math.min(1, dt * 10);
    const T = V(PL.p.x, (PL.visY != null ? PL.visY : PL.p.y) + PL.camH, PL.p.z), C = T.clone().addScaledVector(look, -D); C.x += -Math.cos(yaw) * .7; C.z += Math.sin(yaw) * .7; camClip(T, C);
    camera.position.lerp(C, Math.min(1, dt * 22)); camera.lookAt(camera.position.x + look.x * 30, camera.position.y + look.y * 30, camera.position.z + look.z * 30);
  }
  function updateBanner(dt) {
    if (phase === 'lobby') { const n = 1 + brState.bots.filter(b => b.joined).length; banner(`<small>SPAWN ISLAND · you cannot be hurt here</small><br>BATTLE BUS LAUNCHES IN<br><b>${Math.max(0, Math.ceil(lobbyLen - lobbyClock))}</b><br>👥 ${n} / ${totalP} players waiting`); }
    else if (PL.st === 'bus') banner(bus && bus.t < 4 ? '<b>THE BATTLE BUS</b><br>Get ready to drop…' : `<b style="color:#fbbf24">PRESS [SPACE] TO JUMP!</b><br>👥 ${jumped} / ${totalP} players have jumped`);
    else if (fallMsgT > 0) { fallMsgT -= dt; banner('Steer with WASD · glider opens automatically'); }
    else if (PL.dead) banner(spec ? `<small>SPECTATING</small><br><b style="font-size:30px">${spec.name}</b>` : '');
    else if (PL.knocked) banner(`<b style="color:#f87171;font-size:34px">▼ KNOCKED</b><br>Crawl to cover — a teammate can revive you · ${Math.max(0, Math.ceil(PL.khp))}`);
    else if (PL.revMate) banner(`REVIVING ${PL.revMate.name}<br><b>${Math.round(PL.revT / 3 * 100)}%</b>`);
    else { const m = TEAMSZ > 1 && PL.st === 'ground' ? brState.bots.find(o => o.team === 0 && o.knocked && !o.dead && Math.hypot(o.p.x - PL.p.x, o.p.z - PL.p.z) < 3) : null; banner(m ? `Hold <b style="font-size:22px">[${GasPlus.keyName ? GasPlus.keyName('interact') : 'E'}]</b> to revive ${m.name}` : ''); }
  }
  /* ---------- main update (replaces the old arena loop) ---------- */
  function update(time) {
    const dt = Math.min(.05, Math.max(.001, time - (lt || time - .016))); lt = time;
    if (!paused && !over) {
      if (phase === 'lobby') { lobbyClock += dt; if (lobbyLen - lobbyClock <= 0) startBus(); }
      if (phase !== 'lobby') { tm += dt; stormTick(dt); if (bus && !bus.done) busTick(dt); }
      playerTick(dt, time); botsTick(dt, time); bullets(); dyingTick(dt); updateBanner(dt); if (window.GasBuild) GasBuild.frame(dt);
      debrisTick(dt); doorTick(dt); if (shpT > 0) { shpT -= dt; if (shpT <= 0 && shpEl) shpEl.style.opacity = 0; }
    }
    camUpdate(dt); envTick(); ptag.position.set(PL.p.x, PL.p.y + (PL.swim ? 1.2 : 2.5), PL.p.z);
  }
  /* ---------- world map (minimap + full map) ---------- */
  function drawMap(cv, range, cx, cz, full, o) {
    if (phase === 'lobby') return;
    const x = cv.getContext('2d'), w = cv.width, k = w / (2 * range), S = mapCv.width, sx = v => (v - cx) * k + w / 2, sz = v => (v - cz) * k + w / 2, pp = brState.player.position;
    x.save(); x.beginPath(); x.rect(0, 0, w, w); x.clip(); x.fillStyle = '#1769b5'; x.fillRect(0, 0, w, w);
    const u = S / (WR * 2); x.imageSmoothingEnabled = true; x.drawImage(mapCv, (cx - range + WR) * u, (cz - range + WR) * u, range * 2 * u, range * 2 * u, 0, 0, w, w);
    if (full) { x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1; x.fillStyle = 'rgba(255,255,255,.85)'; x.font = 'bold 13px sans-serif'; for (let i = 0; i < 10; i++) { const g = -WR + i * WR / 5; x.beginPath(); x.moveTo(sx(g), 0); x.lineTo(sx(g), w); x.moveTo(0, sz(g)); x.lineTo(w, sz(g)); x.stroke(); x.fillText('ABCDEFGHIJ'[i], sx(g) + WR / 10 * k - 4, 14); x.fillText(String(i + 1), 4, sz(g) + WR / 10 * k + 4); }
      // town names: markers first, then labels (big places first); each label tries a few spots around its marker,
      // never overlaps another label or marker, and stays inside the map
      const big = t => ['city', 'factory', 'docks', 'village'].includes(t[3]), vis = TOWNS.filter(t => sx(t[1]) > -10 && sx(t[1]) < w + 10 && sz(t[2]) > -10 && sz(t[2]) < w + 10), placed = [];
      vis.forEach(t => { const X = sx(t[1]), Y = sz(t[2]); x.fillStyle = '#facc15'; x.strokeStyle = '#000'; x.lineWidth = 1.5; x.fillRect(X - 3.5, Y - 3.5, 7, 7); x.strokeRect(X - 3.5, Y - 3.5, 7, 7); placed.push([X - 5, Y - 5, X + 5, Y + 5]); });
      x.textAlign = 'center'; x.lineJoin = 'round';
      vis.slice().sort((a, b) => (big(b) - big(a)) || b[4] - a[4]).forEach(t => {
        const X = sx(t[1]), Y = sz(t[2]), th = big(t) ? 14 : 12; x.font = `bold ${th}px sans-serif`; const tw = x.measureText(t[0]).width;
        for (const [ox, oy] of [[0, -9], [0, th + 8], [tw / 2 + 9, th / 2 - 1], [-tw / 2 - 9, th / 2 - 1], [0, -23], [0, th + 22], [tw / 2 + 9, -10], [-tw / 2 - 9, -10]]) {
          const lx = Math.max(tw / 2 + 4, Math.min(w - tw / 2 - 4, X + ox)), ly = Math.max(th + 3, Math.min(w - 5, Y + oy)), r = [lx - tw / 2 - 2, ly - th, lx + tw / 2 + 2, ly + 3];
          if (placed.some(q => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) continue;
          placed.push(r); x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText(t[0], lx, ly); x.fillStyle = big(t) ? '#fff' : '#e2e8f0'; x.fillText(t[0], lx, ly); break;
        }
      }); x.textAlign = 'left'; }
    x.lineWidth = full ? 3 : 2; x.strokeStyle = '#a855f7'; x.beginPath(); x.arc(sx(ST.x), sz(ST.z), ST.r * k, 0, 7); x.stroke(); if (ph >= 0 && ST.tr < ST.or - 1) { x.strokeStyle = '#fff'; x.beginPath(); x.arc(sx(ST.tx), sz(ST.tz), ST.tr * k, 0, 7); x.stroke(); }
    // outside the next safe zone: dashed line from you to the nearest edge of it
    if (ph >= 0 && PL.st === 'ground') { const dx = pp.x - ST.tx, dz = pp.z - ST.tz, dd = Math.hypot(dx, dz); if (dd > ST.tr) { x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = full ? 2 : 1.5; x.setLineDash([5, 5]); x.beginPath(); x.moveTo(sx(pp.x), sz(pp.z)); x.lineTo(sx(ST.tx + dx / dd * ST.tr), sz(ST.tz + dz / dd * ST.tr)); x.stroke(); x.setLineDash([]); } }
    // like the real thing, the map never shows chests, loot, ammo or enemies: only you and your teammates
    o.tm.forEach(t => { x.fillStyle = '#22c55e'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.arc(sx(t.x), sz(t.z), full ? 5 : 4, 0, 7); x.fill(); x.stroke(); });
    if (bus && !bus.done) { x.strokeStyle = '#facc15'; x.lineWidth = full ? 3 : 2; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(sx(bus.s.x), sz(bus.s.z)); x.lineTo(sx(bus.s.x + bus.d.x * bus.len), sz(bus.s.z + bus.d.z * bus.len)); x.stroke(); x.setLineDash([]); if (bus.pos) { x.fillStyle = '#facc15'; x.strokeStyle = '#000'; x.lineWidth = 2; x.fillRect(sx(bus.pos.x) - 6, sz(bus.pos.z) - 6, 12, 12); x.strokeRect(sx(bus.pos.x) - 6, sz(bus.pos.z) - 6, 12, 12); } }
    x.translate(sx(pp.x), sz(pp.z)); x.rotate(Math.PI - brState.player.rotation.y); x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -10); x.lineTo(7, 8); x.lineTo(0, 3); x.lineTo(-7, 8); x.closePath(); x.fill(); x.stroke(); x.restore();
  }
  /* ---------- settings: username ---------- */
  function bindName() { const i = document.getElementById('gp-name'), b = document.getElementById('gp-name-save'); if (!i) return; i.value = state.username; const save = () => { const v = i.value.replace(/[^\w \-]/g, '').trim().slice(0, 16); state.username = v.length >= 3 ? v : 'Player' + (1000 + ri(9000)); i.value = state.username; saveState(); if (typeof showToast === 'function') showToast('Username saved: ' + state.username); }; b.onclick = save; i.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') save(); }; }
  bindName();
  const sensEl = document.getElementById('gp-sens'); if (sensEl) { sensEl.value = state.sens || 1; sensEl.oninput = () => { state.sens = +sensEl.value; saveState(); }; }
  if (typeof requestAnimationFrame === 'function') preload();
  return { doorNear: (x, z, y) => doorNear(x, z, y), toggleDoor: d => setDoor(d, !d.open, 'player'), get doorStats() { return DOORS ? { n: DOORS.list.length, open: DOORS.list.filter(d => d.open).length, broken: DOORS.list.filter(d => d.broken).length } : null; }, get fin() { return lastFin; }, get tm() { return tm; }, get over() { return over; }, get yaw() { return yaw; }, get pitch() { return pitch; }, get paused() { return paused; }, get noLock() { return noLock; }, _ui: { go, pause, resume, lockChange: onLockChange, lockErr: onLockErr, move: onMove }, _hurt: (t, d, b) => hurt(t, d, b), toggleView: () => { fpv = !fpv; if (!fpv) { brState.player.visible = true; } }, aimPitch: () => pitch, canAct: () => PL.st === 'ground' && !PL.knocked && !PL.dead, get teamSize() { return TEAMSZ; }, pst: () => PL.st, get phase() { return phase; }, get PL() { return PL; }, get bus() { return bus; }, get lobbyLen() { return lobbyLen; }, startBus, jumpPlayer, setYaw: v => { yaw = v; }, setPitch: v => { pitch = v; }, crouch, setPaused: v => { paused = v; }, start, stop, update, drawMap, H: HF, WR, spot, okSpot, swing: () => { swing = .4; }, get active() { return active; }, get ST() { return ST; }, TOWNS, menu, addCol: reg, remCol: unreg, near, surface, segHit, topAt, blast, noise, smashed: () => SMASHED.length, get ROADS() { return ROADS; }, get HOUSES() { return HOUSES; }, _build: () => { build(); return WG; }, _test: { makeRoads, HF, slope, step, vert, surface, base, rgbFrom, nz, fs, RVF, LKF, FMF, SWF, forestW } };
})();
