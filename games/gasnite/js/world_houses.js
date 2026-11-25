// ===== GASNITE HOUSES: every building is enterable — doorways, windows, stairs, upper floors, roofs you can stand on,
// furniture, and loot spots (chests) on every floor. Geometry is merged per town (one draw call per town).
window.GasHouses = (() => {
  const FH = 3.5, WT = .26;                         // floor-to-floor height, wall thickness
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _n = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const FACES = [[[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]], [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]], [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]]];
  // ---- merged vertex-coloured geometry, with UVs in metres (box-projected) and a surface "kind" per box
  //      (B.k = 'plain' | 'plaster' | 'siding' | 'brick' | 'stone' | 'metal' | 'roof' | 'wood'): mesh(fn) makes one draw
  //      group per kind so each kind gets its own texture; vertex ranges (used to break walls) are unaffected.
  class Batch {
    constructor() { this.p = []; this.n = []; this.c = []; this.u = []; this.ix = new Map(); this.k = 'plain'; this.uvSwap = false; }
    get nv() { return this.p.length / 3; }            // vertex count so far (a wall / furniture remembers its range so it can be broken later)
    _I() { let L = this.ix.get(this.k); if (!L) this.ix.set(this.k, L = []); return L; }
    _uv(x, y, z, nx, ny, nz) { const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz); let u, v; if (ax >= ay && ax >= az) { u = z; v = y; } else if (ay >= az) { u = x; v = z; } else { u = x; v = y; } if (this.uvSwap) this.u.push(v, u); else this.u.push(u, v); }
    // skip = index of a face that can never be seen (0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z), e.g. the back of a trim against a wall
    box(cx, cy, cz, sx, sy, sz, col, rx = 0, ry = 0, rz = 0, skip = -1) {
      if (sx <= 0 || sy <= 0 || sz <= 0) return;
      _e.set(rx, ry, rz); _q.setFromEuler(_e); _m.compose(_v.set(cx, cy, cz), _q, _s.set(sx / 2, sy / 2, sz / 2)); _c.set(col).convertSRGBToLinear();   // authored in sRGB, rendered in linear
      const I = this._I();
      for (let fi = 0; fi < 6; fi++) {
        if (fi === skip) continue; const [nr, cs] = FACES[fi];
        _n.set(nr[0], nr[1], nr[2]).applyQuaternion(_q); const k = nr[1] < 0 ? .78 : 1, b = this.p.length / 3;
        for (const s of cs) { _v.set(s[0], s[1], s[2]).applyMatrix4(_m); this.p.push(_v.x, _v.y, _v.z); this.n.push(_n.x, _n.y, _n.z); this.c.push(_c.r * k, _c.g * k, _c.b * k); this._uv(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z); }
        I.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
    tri(a, b, c, col) { // double-sided triangle (gables)
      _c.set(col).convertSRGBToLinear(); const ab = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), ac = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), n = ab.cross(ac).normalize(), I = this._I();
      [[a, b, c, 1], [a, c, b, -1]].forEach(([p, q, r, s]) => { const i0 = this.p.length / 3; [p, q, r].forEach(v => { this.p.push(v[0], v[1], v[2]); this.n.push(n.x * s, n.y * s, n.z * s); this.c.push(_c.r, _c.g, _c.b); this._uv(v[0], v[1], v[2], n.x, n.y, n.z); }); I.push(i0, i0 + 1, i0 + 2); });
    }
    geom() {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
      const kinds = [...this.ix.keys()]; let tot = 0; kinds.forEach(k => { tot += this.ix.get(k).length; });
      const idx = this.nv > 65535 ? new Uint32Array(tot) : new Uint16Array(tot); let o = 0;
      kinds.forEach((k, gi) => { const L = this.ix.get(k); idx.set(L, o); if (kinds.length > 1) g.addGroup(o, L.length, gi); o += L.length; });
      g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere(); g.userData.kinds = kinds; return g;
    }
    // mat: one material, or a function kind → material (one draw group per surface kind)
    mesh(mat) {
      if (!this.ix.size) return null;
      const g = this.geom(), ks = g.userData.kinds, mm = typeof mat === 'function' ? (ks.length > 1 ? ks.map(mat) : mat(ks[0])) : mat;
      const m = new THREE.Mesh(g, mm); m.castShadow = true; m.receiveShadow = true; this.geo = g; return m;
    }
  }
  const shade = (hex, k) => { const c = new THREE.Color(hex); return '#' + c.setRGB(Math.min(1, c.r * (1 + k)), Math.min(1, c.g * (1 + k)), Math.min(1, c.b * (1 + k))).getHexString(); };
  const DW = 1.36, DH = 2.4;   // doorway width / height
  // ---- a door leaf for the instanced doors (world.js): hinge at the origin, the leaf runs along +x.
  //      panel = white so each door's own paint colour tints it; hardware is a separate untinted mesh
  function doorGeo() {
    const W = DW - .04, Hh = DH - .03, T = .07, P = new Batch(), M = new Batch(); P.uvSwap = true;   // grain runs up the door
    P.box(W / 2, Hh / 2, 0, W, Hh, T, '#ffffff');
    for (const s of [-1, 1]) {
      for (const [a, b, c, d] of [[.1, .62, .16, 1.02], [.7, W - .1, .16, 1.02], [.1, .62, 1.16, Hh - .14], [.7, W - .1, 1.16, Hh - .14]]) P.box((a + b) / 2, (c + d) / 2, s * (T / 2 + .012), b - a, d - c, .024, '#dcdcdc');   // raised panels
      P.box(W / 2, 1.09, s * (T / 2 + .006), W - .1, .06, .012, '#c8c8c8');                                                                       // lock rail
      M.box(W - .13, 1.02, s * (T / 2 + .03), .05, .22, .03, '#b8862f'); M.box(W - .13, 1.02, s * (T / 2 + .075), .08, .05, .08, '#e2b04a');      // plate + handle
    }
    [.32, 1.2, 2.05].forEach(y => M.box(.012, y, 0, .04, .14, T + .025, '#3a3a3a'));                                                                // hinges
    return { panel: P.geom(), hw: M.geom() };
  }
  // ---- one enterable building
  // o: { x, z, w, d, floors, wall, inner, trim, roof, kind:'pitched'|'flat'|'hall', door:'n'|'s'|'e'|'w', furnish, top }
  function house(env, B, o) {
    const { HF, reg, rnd } = env, x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, z0 = o.z - o.d / 2, z1 = o.z + o.d / 2, hall = o.kind === 'hall', fh = hall ? FH * 1.75 : FH;
    let fy = -1e9; for (const p of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [o.x, o.z]]) fy = Math.max(fy, HF(p[0], p[1])); fy += .15;
    const H = { x0, x1, z0, z1, fy, fh, floors: o.floors, cx: o.x, cz: o.z, spots: [], stairs: [], kind: o.kind, door: null, name: o.name || '' };
    const col = (b, t) => { b.t = t || 'house'; b.house = H; reg(b); return b; };
    const solid = (cx, cy, cz, sx, sy, sz, c, t) => { B.box(cx, cy, cz, sx, sy, sz, c); return col({ x0: cx - sx / 2, x1: cx + sx / 2, y0: cy - sy / 2, y1: cy + sy / 2, z0: cz - sz / 2, z1: cz + sz / 2 }, t); };
    const inner = o.inner || '#efe6d6', floorC = o.floorC || '#a8774a', ceilC = '#f4efe6', trim = o.trim || '#5b4636';
    // ---- per-building style: cottages get white trim and coloured shutters, shops striped awnings, warehouses metal ribs
    const ri = env.ri || (n => Math.floor(Math.random() * n)), home = o.kind === 'pitched', shop = o.furnish === 'shop';
    const frameC = home ? '#f3efe6' : trim, cornerC = home ? '#ece5d8' : shade(o.wall, -.16), plinthC = shade(o.found || '#8f877c', -.1), bandC = home ? '#ece5d8' : shade(trim, -.05), skirtC = '#6b5240', ribC = shade(o.wall, -.15);
    const shutC = home && rnd(0, 1) < .7 ? ['#2f5d50', '#2c4a6e', '#7a2e2e', '#f1ede4', '#3a3f47', '#56632f'][ri(6)] : null;
    const doorC = ['#6b4423', '#8b2f2f', '#2f5d50', '#2c4a6e', '#e9e4d8', '#3a3f47', '#a0702f'][ri(7)], awnC = ['#d94b3d', '#2f7bd9', '#2f9e5a', '#e0a526', '#8e44ad'][ri(5)];
    H.doors = [];
    // surface textures: cottages are wood siding or plaster, city blocks brick or render, warehouses corrugated metal
    const wallK = o.tex || (hall ? 'metal' : home ? (rnd(0, 1) < .55 ? 'siding' : 'plaster') : 'plaster');
    // foundation + floor (deep enough to reach the lowest ground under the house, so nothing floats on a slope)
    let fmin = fy; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) fmin = Math.min(fmin, HF(x0 + (x1 - x0) * i / 4, z0 + (z1 - z0) * j / 4));
    const fd = Math.max(3.2, fy - fmin + .8); B.k = 'stone'; solid(o.x, fy - fd / 2, o.z, o.w, fd, o.d, o.found || '#8f877c');
    B.k = hall ? 'plaster' : 'wood'; B.box(o.x, fy + .015, o.z, o.w - WT * 2, .03, o.d - WT * 2, floorC); B.k = 'plain';
    // ---- walls: each side split in bays (solid / window / door); two-tone (outside colour, inside paint)
    const sides = [['n', x0, z0, x1, z0], ['s', x0, z1, x1, z1], ['w', x0, z0 + WT, x0, z1 - WT], ['e', x1, z0 + WT, x1, z1 - WT]];
    for (let f = 0; f < o.floors; f++) {
      const by = fy + f * fh;
      for (const [sd, ax, az, bx, bz] of sides) {
        const alongX = az === bz, L = alongX ? bx - ax : bz - az, nb = Math.max(2, Math.round(L / (hall ? 4 : 3))), bw = L / nb, out = sd === 'n' ? -1 : sd === 's' ? 1 : sd === 'w' ? -1 : 1;
        for (let k = 0; k < nb; k++) {
          const mid = k === Math.floor(nb / 2), isDoor = (f === 0 && sd === o.door && (mid || (hall && k === Math.floor(nb / 2) - 1))) || (hall && f === 0 && sd === ({ n: 's', s: 'n', e: 'w', w: 'e' })[o.door] && mid);
          const isWin = !isDoor && ((k + f + (sd === 'e' || sd === 'w' ? 1 : 0)) % 2 === 0) && bw > 1.6 && !(hall && f === 0 && k % 2);
          const u0 = (alongX ? ax : az) + k * bw, uc = u0 + bw / 2, wc = (alongX ? az : ax) - out * WT / 2;   // wc = the wall's centre line
          // one breakable "bay" per wall section: its pieces and all their trim are destroyed together
          const bay = { kind: 'wall', mat: hall ? 'metal' : 'brick', hp: hall ? 330 : 240, max: hall ? 330 : 240, cols: [], vr: [], batch: B, x: alongX ? uc : ax, z: alongX ? az : uc, y: by + fh / 2, name: hall ? 'Metal wall' : 'Wall' };
          // trim on this bay's outer (or inner) face, t thick, from ua..ub along the wall and ya..yb up
          const fIdx = s => alongX ? (s > 0 ? 4 : 5) : (s > 0 ? 0 : 1);   // box face pointing along the wall normal (s = ±1)
          const faceBox = (ua, ub, ya, yb, c, t, inside, kind = 'plain') => {
            if (ub - ua < .01 || yb - ya < .01) return; const s = inside ? -out : out, fc = wc + s * (WT / 2 + t / 2 - .02), um = (ua + ub) / 2, v0 = B.nv; B.k = kind;
            if (alongX) B.box(um, (ya + yb) / 2, fc, ub - ua, yb - ya, t + .04, c, 0, 0, 0, fIdx(-s)); else B.box(fc, (ya + yb) / 2, um, t + .04, yb - ya, ub - ua, c, 0, 0, 0, fIdx(-s));   // no back face
            bay.vr.push([v0, B.nv - v0]); B.k = 'plain';
          };
          const inBox = (ua, ub, ya, yb, c, t) => { bay.vr.push([B.nv, 24]); const um = (ua + ub) / 2; if (alongX) B.box(um, (ya + yb) / 2, wc, ub - ua, yb - ya, t, c); else B.box(wc, (ya + yb) / 2, um, t, yb - ya, ub - ua, c); };   // in the wall plane
          // a solid wall piece (collider + outer/inner skins), from ua..ub along the wall (default: the whole bay)
          const piece = (y0, y1, c, ci, ua = u0, ub = u0 + bw) => {
            if (y1 - y0 < .02 || ub - ua < .02) return;
            const cy = (y0 + y1) / 2, h = y1 - y0, sw = ub - ua, um = (ua + ub) / 2, wx = alongX ? um : wc, wz = alongX ? wc : um;
            const cb = col(alongX ? { x0: ua, x1: ub, z0: wz - WT / 2, z1: wz + WT / 2, y0, y1 } : { x0: wx - WT / 2, x1: wx + WT / 2, z0: ua, z1: ub, y0, y1 });
            cb.D = bay; bay.cols.push(cb); const v0 = B.nv;
            const oxs = alongX ? 0 : out * WT / 4, ozs = alongX ? out * WT / 4 : 0;
            B.k = wallK; B.box(wx + oxs, cy, wz + ozs, alongX ? sw : WT / 2, h, alongX ? WT / 2 : sw, c, 0, 0, 0, fIdx(-out));    // outer skin (its inner face is hidden)
            B.k = 'plaster'; B.box(wx - oxs, cy, wz - ozs, alongX ? sw : WT / 2, h, alongX ? WT / 2 : sw, ci, 0, 0, 0, fIdx(out));    // inner skin
            B.k = 'plain'; bay.vr.push([v0, B.nv - v0]);
            if (y0 === by) {   // stone plinth outside (ground floor) or a band between storeys; skirting board inside
              if (f === 0) faceBox(ua, ub, by - .25, by + .55, plinthC, .07, false, 'stone'); else faceBox(ua, ub, by - .1, by + .1, bandC, .08);
              faceBox(ua, ub, by, by + .13, skirtC, .03, true, 'wood');
            }
            if (hall && h > 1.2) for (let r = ua + .55; r < ub - .3; r += 1.1) faceBox(r - .05, r + .05, y0 + (y0 === by ? .55 : 0), y1, ribC, .05, false, 'metal');   // corrugated metal
          };
          // shop awning over a ground-floor opening on the street side: striped canvas on two brackets
          const awning = (a, b, y) => {
            const n = Math.max(3, Math.round((b - a) / .4)), sw = (b - a) / n, fo = wc + out * (WT / 2 + .5), tilt = .38;
            for (let i = 0; i < n; i++) { const um = a + (i + .5) * sw; bay.vr.push([B.nv, 24]); if (alongX) B.box(um, y, fo, sw + .005, .06, 1.05, i % 2 ? '#f5f1e8' : awnC, out * tilt); else B.box(fo, y, um, 1.05, .06, sw + .005, i % 2 ? '#f5f1e8' : awnC, 0, 0, -out * tilt); }
            faceBox(a, b, y + .14, y + .26, awnC, .09);
          };
          if (isDoor && !hall) {
            // a real doorway: wall either side, a lintel, a painted frame inside and out — and a working door (world.js)
            const da = uc - DW / 2, db = uc + DW / 2;
            piece(by, by + fh, o.wall, inner, u0, da); piece(by, by + fh, o.wall, inner, db, u0 + bw); piece(by + DH, by + fh, o.wall, inner, da, db);
            for (const ins of [false, true]) { const t = ins ? .04 : .09; faceBox(da - .15, da, by, by + DH + .15, frameC, t, ins); faceBox(db, db + .15, by, by + DH + .15, frameC, t, ins); faceBox(da - .15, db + .15, by + DH, by + DH + .17, frameC, t + .01, ins); }
            if (home) {   // little canopy over the door on two brackets
              const fo = wc + out * (WT / 2 + .46), cy2 = by + DH + .44; bay.vr.push([B.nv, 24]); B.k = 'roof'; B.uvSwap = !alongX;
              if (alongX) B.box(uc, cy2, fo, DW + .8, .09, .95, o.roof, out * .26); else B.box(fo, cy2, uc, .95, .09, DW + .8, o.roof, 0, 0, -out * .26);
              B.k = 'plain'; B.uvSwap = false;
              for (const e of [-1, 1]) { const bu = uc + e * (DW / 2 + .26), fb = wc + out * (WT / 2 + .2); bay.vr.push([B.nv, 24]); if (alongX) B.box(bu, by + DH + .22, fb, .08, .42, .42, frameC); else B.box(fb, by + DH + .22, bu, .42, .42, .08, frameC); }
            }
            if (shop) awning(da - .4, db + .4, by + DH + .62);
            H.doors.push({ alongX, u: uc, w: DW - .04, h: DH - .03, by, wc, out, house: H, bay, paint: doorC });
          }
          else if (isDoor) { piece(by + 4.2, by + fh, o.wall, inner); faceBox(u0, u0 + bw, by + 4.2, by + 4.45, frameC, .12); faceBox(u0 + .05, u0 + bw - .05, by + 4.28, by + 4.8, '#4b5563', .32); }   // warehouse loading bay with a roller-door housing
          if (isDoor && !H.door) { const dx = alongX ? uc : ax + out * 1.6, dz = alongX ? az + out * 1.6 : uc, ix = alongX ? uc : ax - out * 1.4, iz = alongX ? az - out * 1.4 : uc; H.door = { ox: dx, oz: dz, ix, iz, side: sd }; const g = HF(dx, dz); B.k = 'stone'; if (fy - g > .45) solid(dx - (alongX ? 0 : out * .6), (g + fy - .35) / 2 - .4, dz - (alongX ? out * .6 : 0), alongX ? (hall ? bw : DW + .8) : 1.2, fy - .35 - g + .8, alongX ? 1.2 : (hall ? bw : DW + .8), o.found || '#8f877c'); B.k = 'plain'; }
          if (!isDoor && isWin) {
            // a framed window (not a wall-wide gap): jambs either side, sill inside and out, header, glazing bars, shutters on cottages
            const s0 = hall ? 3.2 : 1.0, s1 = hall ? 5.2 : 2.3, ww = Math.min(bw - .6, hall ? 2.6 : 1.45), wa = uc - ww / 2, wb = uc + ww / 2, y0 = by + s0, y1 = by + s1;
            piece(by, y0, o.wall, inner); piece(y1, by + fh, o.wall, inner); piece(y0, y1, o.wall, inner, u0, wa); piece(y0, y1, o.wall, inner, wb, u0 + bw);
            faceBox(wa - .14, wb + .14, y0 - .1, y0 + .04, frameC, .17); faceBox(wa - .06, wb + .06, y0 - .05, y0 + .03, frameC, .1, true);
            faceBox(wa - .14, wb + .14, y1, y1 + .14, frameC, .09); faceBox(wa - .12, wa, y0, y1, frameC, .09); faceBox(wb, wb + .12, y0, y1, frameC, .09);
            if (home) { inBox(uc - .035, uc + .035, y0, y1, frameC, .07); inBox(wa, wb, (y0 + y1) / 2 - .035, (y0 + y1) / 2 + .035, frameC, .07); }   // glazing bars on cottages
            if (shutC && bw >= 2.6) { faceBox(wa - .72, wa - .16, y0 + .02, y1 - .02, shutC, .05, false, 'siding'); faceBox(wb + .16, wb + .72, y0 + .02, y1 - .02, shutC, .05, false, 'siding'); }   // louvred shutters
            if (shop && f === 0 && sd === o.door) awning(wa - .3, wb + .3, y1 + .5);
          }
          else if (!isDoor) piece(by, by + fh, o.wall, inner);
          // corner boards (tied to the corner bays of the front and back walls)
          if (alongX && !hall && (k === 0 || k === nb - 1)) { bay.vr.push([B.nv, 24]); B.box(k === 0 ? x0 : x1, by + fh / 2 - (f === 0 ? .15 : 0), az, .32, fh + (f === 0 ? .3 : 0), .32, cornerC); }
        }
      }
      // a ceiling lamp in every room
      for (const lx of hall ? [-o.w / 4, o.w / 4] : [0]) { B.box(o.x + lx, by + fh - .17, o.z, .52, .07, .52, '#fff4cf'); B.box(o.x + lx, by + fh - .1, o.z, .1, .1, .1, '#4b5563'); }
      // ---- upper floor slab (with a stair hole) + stairs between floors
      if (f + 1 < o.floors) {
        const west = f % 2 === 0, sx0 = west ? x0 + WT : x1 - WT - 1.5, sx1 = sx0 + 1.5, run = Math.min(4.4, o.d - WT * 2 - 1.2), zs = west ? z0 + WT + .5 : z1 - WT - .5 - run, ze = zs + run, up = by + fh;
        // stairs: ramp collider + visible steps
        col({ x0: sx0, x1: sx1, z0: zs, z1: ze, y0: by, y1: up, ramp: { ax: 'z', s: west ? 1 : -1 } }, 'stairs');
        const n = 12; B.k = 'wood'; for (let k = 0; k < n; k++) { const t = (k + .5) / n, sz = west ? zs + t * run : ze - t * run, top = by + (k + 1) / n * fh; B.box((sx0 + sx1) / 2, (by + top) / 2 - .02, sz, 1.5, top - by, run / n + .02, k % 2 ? '#8a5f3a' : '#94683f'); } B.k = 'plain';
        H.stairs.push({ bx: west ? sx1 + .7 : sx0 - .7, bz: west ? zs + .35 : ze - .35, ex: (sx0 + sx1) / 2, ez: west ? zs + .25 : ze - .25, tx: (sx0 + sx1) / 2, tz: west ? ze + .9 : zs - .9, y0: by, y1: up });   // b = beside the first step, e = on the first step, t = landing upstairs
        const hz0 = west ? zs + .9 : zs - .1, hz1 = west ? ze + .1 : ze - .9;   // hole above the upper part of the stairs
        const ix0 = x0 + WT, ix1 = x1 - WT, iz0 = z0 + WT, iz1 = z1 - WT, sy = up - .13;
        const slab = (a0, a1, b0, b1) => { if (a1 - a0 < .05 || b1 - b0 < .05) return; col({ x0: a0, x1: a1, z0: b0, z1: b1, y0: up - .26, y1: up }); B.k = 'wood'; B.box((a0 + a1) / 2, sy + .07, (b0 + b1) / 2, a1 - a0, .12, b1 - b0, floorC); B.k = 'plaster'; B.box((a0 + a1) / 2, sy - .07, (b0 + b1) / 2, a1 - a0, .14, b1 - b0, ceilC); B.k = 'plain'; };
        slab(ix0, ix1, iz0, hz0); slab(ix0, ix1, hz1, iz1);
        if (west) slab(sx1 + .05, ix1, hz0, hz1); else slab(ix0, sx0 - .05, hz0, hz1);
        B.box(west ? sx1 + .05 : sx0 - .05, up + .5, (hz0 + hz1) / 2, .08, 1, hz1 - hz0, trim);   // railing
      }
    }
    // ---- roof
    const top = fy + o.floors * fh;
    if (o.kind === 'pitched') {
      const alongZ = o.d >= o.w, span = alongZ ? o.w : o.d, rh = Math.min(3.2, span * .38), half = span / 2 + .5, len = (alongZ ? o.d : o.w) + 1, ang = Math.atan2(rh, span / 2), tn = Math.tan(ang), slant = Math.hypot(half, rh * half / (span / 2));
      // roof-local frame: b across the ridge, a along it
      const P = (b, y, a) => alongZ ? [o.x + b, y, o.z + a] : [o.x + a, y, o.z + b];
      const RB = (b, y, a, sb, sy, sa, c, s) => { const p = P(b, y, a); B.box(p[0], p[1], p[2], alongZ ? sb : sa, sy, alongZ ? sa : sb, c, alongZ ? 0 : s * ang, 0, alongZ ? -s * ang : 0); };   // tilted with side s
      const FB = (b, y, a, sb, sy, sa, c) => { const p = P(b, y, a); B.box(p[0], p[1], p[2], alongZ ? sb : sa, sy, alongZ ? sa : sb, c); };                                                       // level
      const dark = shade(o.roof, -.16);
      [-1, 1].forEach(s => {
        // four shingle courses, each standing a little proud of the one above it
        B.k = 'roof'; B.uvSwap = alongZ;   // shingle rows run along the ridge
        for (let r = 0; r < 4; r++) { const d = half * (1 - (r + .5) / 4), lift = (3 - r) * .028; RB(s * (d + Math.sin(ang) * lift), top + rh - d * tn + Math.cos(ang) * lift, 0, slant / 4 + .1, .22, len, r % 2 ? shade(o.roof, -.09) : o.roof, s); }
        B.k = 'plain'; B.uvSwap = false;
        col(alongZ ? { x0: s < 0 ? x0 : o.x, x1: s < 0 ? o.x : x1, z0, z1, y0: top - .3, y1: top + rh, ramp: { ax: 'x', s: -s } } : { x0, x1, z0: s < 0 ? z0 : o.z, z1: s < 0 ? o.z : z1, y0: top - .3, y1: top + rh, ramp: { ax: 'z', s: -s } }, 'roof');
        FB(s * (half + .05), top + rh - half * tn - .02, 0, .1, .3, len + .02, frameC);                                                       // fascia board along the eave
        for (const e of [-1, 1]) RB(s * half / 2, top + rh - half / 2 * tn + .1, e * (len / 2 + .03), slant + .12, .3, .08, frameC, s);       // barge boards on the gable ends
      });
      FB(0, top + rh + .1, 0, .46, .16, len + .06, dark);                                                                                        // ridge cap
      // gables + a vent in each, attic floor
      const g = alongZ ? [[z0, -1], [z1, 1]] : [[x0, -1], [x1, 1]];
      g.forEach(([e, sg]) => { B.k = wallK; alongZ ? B.tri([x0, top, e], [x1, top, e], [o.x, top + rh, e], o.wall) : B.tri([e, top, z0], [e, top, z1], [e, top + rh, o.z], o.wall); B.k = 'plain'; const ga = (alongZ ? o.d : o.w) / 2 * sg; FB(0, top + rh * .36, ga + sg * .04, .72, .72, .08, frameC); FB(0, top + rh * .36, ga + sg * .08, .5, .5, .05, '#2b2f36'); });
      col({ x0, x1, z0, z1, y0: top - .26, y1: top }); B.k = 'plaster'; B.box(o.x, top - .1, o.z, o.w, .2, o.d, ceilC); B.k = 'plain';
      // a brick chimney on most cottages
      if (rnd(0, 1) < .6) { const s = rnd(0, 1) < .5 ? -1 : 1, b = s * span * .24, a = (len / 2 - 1.8) * (rnd(0, 1) < .5 ? -1 : 1), yr = top + rh - Math.abs(b) * tn, y1 = top + rh + .9, p = P(b, 0, a);
        B.k = 'brick'; solid(p[0], (yr - .5 + y1) / 2, p[2], .72, y1 - yr + .5, .72, '#8a4b3a'); B.k = 'stone'; FB(b, y1 + .07, a, .9, .14, .9, '#5b5149'); B.k = 'plain'; FB(b, y1 + .2, a, .3, .14, .3, '#2b2f36'); }
    } else {
      B.k = 'plaster'; solid(o.x, top + .15, o.z, o.w, .3, o.d, o.roof);
      B.k = wallK; [['n', o.x, z0 + .15, o.w, .3], ['s', o.x, z1 - .15, o.w, .3], ['w', x0 + .15, o.z, .3, o.d], ['e', x1 - .15, o.z, .3, o.d]].forEach(([, cx, cz, sx, sz]) => solid(cx, top + .6, cz, sx, .6, sz, o.trim || o.wall)); B.k = 'plain';
      // cornice ledge under the parapet + parapet coping
      const ccol = shade(o.trim || o.wall, -.12);
      B.box(o.x, top - .06, z0 - .06, o.w + .24, .2, .14, ccol); B.box(o.x, top - .06, z1 + .06, o.w + .24, .2, .14, ccol); B.box(x0 - .06, top - .06, o.z, .14, .2, o.d, ccol); B.box(x1 + .06, top - .06, o.z, .14, .2, o.d, ccol);
      if (o.top) { B.k = wallK; solid(o.x, top + .3 + o.top / 2, o.z, o.w - 1.2, o.top, o.d - 1.2, o.wall, 'tower'); B.k = 'plain'; }
      else if (o.kind !== 'hall' || o.w * o.d < 900) {   // rooftop AC units and vents
        const n = 1 + ri(3); B.k = 'metal';
        for (let i = 0; i < n; i++) { const ux = o.x + rnd(-o.w / 2 + 1.6, o.w / 2 - 1.6), uz = o.z + rnd(-o.d / 2 + 1.6, o.d / 2 - 1.6); solid(ux, top + .75, uz, 1.3, .9, 1, '#c3c9d1'); B.box(ux, top + .78, uz - .51, 1.05, .62, .04, '#5b6470'); B.box(ux, top + 1.24, uz, .7, .06, .7, '#8f98a3'); }
        B.box(o.x + rnd(-1, 1), top + .65, o.z + rnd(-1, 1), .3, .7, .3, '#8f98a3'); B.k = 'plain';
      }
    }
    B.k = 'plain'; B.uvSwap = false;
    H.top = top;
    return H;
  }
  // ---- furniture + loot spots (every floor gets at least one chest spot)
  const FAB = ['#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f59e0b', '#14b8a6', '#e11d48', '#64748b'];
  function furnish(env, B, H, kind) {
    const { reg, rnd, ri } = env, pick = a => a[ri(a.length)], wood = '#8b5a2b', dark = '#3b2a1e';
    let mark = 0;   // first vertex of the furniture being built: its collider remembers the range so a pickaxe can smash it
    const col = (x0, x1, z0, z1, y0, y1) => { const b = { x0, x1, z0, z1, y0, y1, t: 'furn', house: H }; b.D = { kind: 'furn', mat: 'wood', hp: 90, max: 90, cols: [b], vr: [[mark, B.nv - mark]], batch: B, x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2, name: 'Furniture' }; mark = B.nv; reg(b); };
    for (let f = 0; f < H.floors; f++) {
      const y = H.fy + f * H.fh, ix0 = H.x0 + WT + .1, ix1 = H.x1 - WT - .1, iz0 = H.z0 + WT + .1, iz1 = H.z1 - WT - .1;
      // keep clear: stair columns touching this floor, the doorway
      const keep = [];
      H.stairs.forEach(s => { if (Math.abs(s.y0 - y) < .1 || Math.abs(s.y1 - y) < .1) keep.push([Math.min(s.bx, s.tx) - 1.1, Math.max(s.bx, s.tx) + 1.1, Math.min(s.bz, s.tz) - .6, Math.max(s.bz, s.tz) + .6]); });
      if (f === 0 && H.door) keep.push([H.door.ix - 1.7, H.door.ix + 1.7, H.door.iz - 1.7, H.door.iz + 1.7]);
      const free = (a0, a1, b0, b1) => a0 >= ix0 - .01 && a1 <= ix1 + .01 && b0 >= iz0 - .01 && b1 <= iz1 + .01 && !keep.some(k => a0 < k[1] && a1 > k[0] && b0 < k[3] && b1 > k[2]);
      // candidate slots: corners and wall middles (w x d footprint against a wall)
      const slots = [];
      const slot = (w, d, fx, fz) => { const sx = fx < 0 ? ix0 + w / 2 : fx > 0 ? ix1 - w / 2 : (ix0 + ix1) / 2, sz = fz < 0 ? iz0 + d / 2 : fz > 0 ? iz1 - d / 2 : (iz0 + iz1) / 2; return [sx, sz]; };
      const take = (w, d) => { const opts = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].sort(() => Math.random() - .5); for (const [fx, fz] of opts) { const [sx, sz] = slot(w, d, fx, fz); if (free(sx - w / 2, sx + w / 2, sz - d / 2, sz + d / 2)) { keep.push([sx - w / 2 - .4, sx + w / 2 + .4, sz - d / 2 - .4, sz + d / 2 + .4]); return [sx, sz, fx, fz]; } } return null; };
      // a chest spot first, so every floor has loot
      const c = take(1.4, 1.1); if (c) H.spots.push({ x: c[0], y, z: c[1], floor: f, house: H, rot: Math.atan2(-c[2], -c[3]) });
      const items = kind === 'industrial' ? ['crates', 'crates', 'crates', 'shelf', 'crates'] : kind === 'lab' ? ['desk', 'desk', 'rack', 'shelf'] : kind === 'shop' ? ['counter', 'shelf', 'shelf', 'table'] : kind === 'bunker' ? ['bunk', 'crates', 'shelf'] : f === 0 ? ['sofa', 'table', 'kitchen', 'shelf', 'tv'] : ['bed', 'bed', 'shelf', 'table', 'rug'];
      for (const it of items) {
        mark = B.nv;
        if (it === 'bed') { const s = take(1.5, 2.2); if (!s) continue; const [x, z] = s, bc = pick(FAB); B.box(x, y + .25, z, 1.5, .5, 2.2, wood); B.box(x, y + .58, z, 1.4, .18, 2.1, '#f8fafc'); B.box(x, y + .7, z + .25, 1.42, .1, 1.5, bc); B.box(x, y + .72, z - .78, 1.0, .16, .4, '#ffffff'); B.box(x, y + .7, z - 1.08, 1.5, 1.0, .1, dark); col(x - .75, x + .75, z - 1.1, z + 1.1, y, y + .75); }
        else if (it === 'sofa') { const s = take(2.2, .95); if (!s) continue; const [x, z, , fz] = s, sc = pick(FAB), bz = fz > 0 ? .35 : -.35; B.box(x, y + .25, z, 2.2, .45, .95, sc); B.box(x, y + .75, z + bz, 2.2, .6, .25, sc); [-1, 1].forEach(k => B.box(x + k * 1.0, y + .55, z, .22, .35, .95, sc)); col(x - 1.1, x + 1.1, z - .48, z + .48, y, y + .8); }
        else if (it === 'table') { const s = take(1.7, 1.1); if (!s) continue; const [x, z] = s; B.box(x, y + .78, z, 1.6, .08, 1.0, wood); [[-.7, -.42], [.7, -.42], [-.7, .42], [.7, .42]].forEach(q => B.box(x + q[0], y + .38, z + q[1], .08, .76, .08, dark)); [-1, 1].forEach(k => { B.box(x + k * .45, y + .45, z + .75, .45, .08, .45, wood); B.box(x + k * .45, y + .8, z + .95, .45, .7, .06, wood); }); col(x - .8, x + .8, z - .5, z + .5, y, y + .82); }
        else if (it === 'kitchen') { const s = take(2.6, .7); if (!s) continue; const [x, z] = s; B.box(x - .4, y + .46, z, 1.8, .92, .65, '#e5e7eb'); B.box(x - .4, y + .95, z, 1.84, .06, .68, '#57534e'); B.box(x + .9, y + .95, z, .75, 1.9, .65, '#f1f5f9'); B.box(x + .9, y + 1.2, z + (z > H.cz ? -.34 : .34), .05, .5, .02, '#94a3b8'); col(x - 1.3, x + 1.3, z - .35, z + .35, y, y + 1.9); }
        else if (it === 'shelf') { const s = take(1.6, .45); if (!s) continue; const [x, z] = s; B.box(x, y + 1.0, z, 1.6, 2.0, .45, wood); for (let k = 0; k < 4; k++) for (let b = 0; b < 5; b++) if (Math.random() < .7) B.box(x - .6 + b * .3, y + .3 + k * .48, z, .2, .3, .3, pick(FAB)); col(x - .8, x + .8, z - .23, z + .23, y, y + 2); }
        else if (it === 'tv') { const s = take(1.6, .5); if (!s) continue; const [x, z] = s; B.box(x, y + .3, z, 1.6, .6, .5, dark); B.box(x, y + 1.05, z, 1.4, .8, .06, '#0f172a'); col(x - .8, x + .8, z - .25, z + .25, y, y + .6); }
        else if (it === 'rug') { const s = take(2.4, 1.6); if (!s) continue; B.box(s[0], y + .02, s[1], 2.4, .03, 1.6, pick(FAB)); }
        else if (it === 'counter') { const s = take(2.8, .8); if (!s) continue; const [x, z] = s; B.box(x, y + .55, z, 2.8, 1.1, .8, '#64748b'); B.box(x, y + 1.12, z, 2.9, .06, .9, '#e2e8f0'); col(x - 1.4, x + 1.4, z - .4, z + .4, y, y + 1.15); }
        else if (it === 'desk') { const s = take(1.8, .9); if (!s) continue; const [x, z] = s; B.box(x, y + .75, z, 1.8, .07, .9, '#e2e8f0'); B.box(x - .8, y + .37, z, .07, .74, .85, '#94a3b8'); B.box(x + .8, y + .37, z, .07, .74, .85, '#94a3b8'); B.box(x, y + 1.1, z, .8, .5, .05, '#0f172a'); B.box(x, y + 1.1, z + .03, .7, .4, .02, '#38bdf8'); col(x - .9, x + .9, z - .45, z + .45, y, y + .8); }
        else if (it === 'rack') { const s = take(1.0, .9); if (!s) continue; const [x, z] = s; B.box(x, y + 1.1, z, 1.0, 2.2, .9, '#1f2937'); for (let k = 0; k < 6; k++) B.box(x, y + .35 + k * .3, z + (z > H.cz ? -.46 : .46), .8, .06, .02, k % 2 ? '#22c55e' : '#38bdf8'); col(x - .5, x + .5, z - .45, z + .45, y, y + 2.2); }
        else if (it === 'bunk') { const s = take(1.2, 2.1); if (!s) continue; const [x, z] = s; [0, 1].forEach(k => { B.box(x, y + .45 + k * 1.1, z, 1.1, .18, 2.0, '#4b5563'); B.box(x, y + .58 + k * 1.1, z, 1.0, .1, 1.9, '#6b7d5a'); }); [[-.5, -.95], [.5, -.95], [-.5, .95], [.5, .95]].forEach(q => B.box(x + q[0], y + .9, z + q[1], .06, 1.8, .06, '#374151')); col(x - .55, x + .55, z - 1, z + 1, y, y + 1.8); }
        else if (it === 'crates') { const s = take(2.6, 2.6); if (!s) continue; const [x, z] = s; B.k = 'wood'; [[-.6, -.6, 0], [.6, -.6, 0], [-.6, .6, 0], [0, 0, 1]].forEach(q => { if (q[2] && Math.random() < .4) return; const cy = y + .6 + q[2] * 1.2; B.box(x + q[0], cy, z + q[1], 1.15, 1.15, 1.15, '#a16207'); B.box(x + q[0], cy, z + q[1], 1.2, .12, 1.2, '#78350f'); col(x + q[0] - .58, x + q[0] + .58, z + q[1] - .58, z + q[1] + .58, cy - .58, cy + .58); }); B.k = 'plain'; }
      }
      if (kind === 'industrial' || H.kind === 'hall') { const c2 = take(1.4, 1.1); if (c2) H.spots.push({ x: c2[0], y, z: c2[1], floor: f, house: H, rot: Math.atan2(-c2[2], -c2[3]), gold: Math.random() < .3 }); }
    }
  }
  // ---- town layouts: original POIs, every building enterable (towers, chimneys, silos and ruins stay solid)
  function town(env, B, t) {
    const [, tx, tz, ty, r] = t, { rnd, ri, add } = env, placed = [], pick = a => a[ri(a.length)];
    const WALLS = ['#d8c3a0', '#c9a27a', '#e3d5b8', '#b9c7d6', '#d9b4a0', '#c2cfb2', '#e8d9b0'], ROOFS = ['#9c3b2e', '#7a4a2a', '#4a5a6a', '#8a3a3a', '#5b6b4a'];
    const fits = (x, z, w, d) => !placed.some(p => Math.abs(p.x - x) < (p.w + w) / 2 + 3.5 && Math.abs(p.z - z) < (p.d + d) / 2 + 3.5);
    const doorTo = (x, z) => { const dx = tx - x, dz = tz - z; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'e' : 'w') : (dz > 0 ? 's' : 'n'); };
    const H = (x, z, w, d, o) => { if (!fits(x, z, w, d)) return null; placed.push({ x, z, w, d }); const h = house(env, B, Object.assign({ x, z, w, d, door: doorTo(x, z), floors: 1, wall: pick(WALLS), roof: pick(ROOFS), kind: 'pitched' }, o)); env.houses.push(h); furnish(env, B, h, o.furnish || 'home'); return h; };
    const ring = (n, a0, a1, mk) => { for (let i = 0; i < n; i++) for (let k = 0; k < 10; k++) { const a = i / n * 6.283 + rnd(-.3, .3), rr = rnd(a0, a1); if (mk(tx + Math.cos(a) * rr, tz + Math.sin(a) * rr)) break; } };
    const solidAdd = (dx, dz, w, d, h, c1, c2) => { placed.push({ x: tx + dx, z: tz + dz, w, d }); add(tx + dx, tz + dz, w, d, h, c1, c2); };
    switch (ty) {
      case 'city': for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { if (!i && !j) continue; const w = rnd(11, 14), d = rnd(11, 14), fl = 2 + ri(2), brick = Math.random() < .45; H(tx + i * 26, tz + j * 26, w, d, { floors: fl, kind: 'flat', wall: brick ? pick(['#a0563f', '#8f4c3a', '#b0664c', '#7e5446', '#9a6a52']) : pick(['#8b93a1', '#a3aab8', '#6f7787', '#b8a48c', '#9aa5b1']), tex: brick ? 'brick' : 'plaster', roof: '#434a58', trim: '#cbd5e1', furnish: Math.random() < .35 ? 'shop' : 'home', top: Math.random() < .55 ? rnd(4, 22) : 0, inner: '#e7e5e4' }); } break;
      case 'village': ring(11, 10, r * .85, (x, z) => H(x, z, rnd(8.5, 11), rnd(7.5, 9.5), { floors: Math.random() < .5 ? 2 : 1 })); break;
      case 'factory': H(tx, tz, 30, 20, { kind: 'hall', wall: '#9a5b4a', roof: '#4a4a4a', furnish: 'industrial', floorC: '#6b7280' }); H(tx + 30, tz + 10, 16, 12, { kind: 'hall', wall: '#8a6f5a', roof: '#4a4a4a', furnish: 'industrial', floorC: '#6b7280' }); H(tx - 28, tz - 8, 12, 10, { kind: 'flat', floors: 2, wall: '#7a6050', roof: '#4a4a4a', furnish: 'lab' }); solidAdd(14, -24, 5, 5, 30, '#6b6b6b', '#333'); solidAdd(-12, -24, 5, 5, 26, '#6b6b6b', '#333'); break;
      case 'docks': for (let i = 0; i < 4; i++) H(tx - 30 + i * 18, tz + (i % 2) * 14, 14, 10, { kind: 'hall', wall: '#6f8296', roof: '#3b4a5a', furnish: 'industrial', floorC: '#6b7280' }); solidAdd(32, -16, 4, 4, 22, '#c0392b', '#7a241b'); break;
      case 'beach': for (let i = 0; i < 5; i++) H(tx - 30 + i * 14, tz + rnd(-8, 8), 7.5, 7, { wall: pick(['#f0c987', '#e8a87c', '#9fd3c7', '#f5f5f4']), roof: '#c0392b', furnish: 'shop' }); break;
      case 'ruins': for (let i = 0; i < 9; i++) { const a = rnd(0, 6.28), rr = rnd(5, r); add(tx + Math.cos(a) * rr, tz + Math.sin(a) * rr, rnd(5, 11), rnd(4, 9), rnd(2, 7), '#6e6a63', '#4b4843'); } break;
      case 'farm': H(tx, tz, 16, 12, { kind: 'hall', wall: '#b8402f', roof: '#6b6b6b', furnish: 'industrial', floorC: '#a16207' }); H(tx - 19, tz + 8, 10, 9, { floors: 2, wall: '#e8d9b0', roof: '#9c3b2e' }); H(tx + 4, tz - 20, 11, 8, { wall: '#a0532f', roof: '#6b6b6b', furnish: 'industrial' }); solidAdd(19, 5, 4.5, 4.5, 15, '#c9ced6', '#8d96a3'); break;
      case 'swamp': ring(7, 6, r * .8, (x, z) => H(x, z, rnd(6.5, 8), rnd(6.5, 8), { wall: '#6b5a43', roof: '#3f5a35', inner: '#c8b89a', tex: 'siding' })); break;
      case 'research': H(tx, tz, 18, 12, { kind: 'flat', floors: 2, wall: '#e8eef5', roof: '#5b7aa6', trim: '#94a3b8', furnish: 'lab', inner: '#f8fafc', floorC: '#cbd5e1' }); H(tx + 16, tz + 4, 9, 9, { kind: 'flat', wall: '#dfe7f0', roof: '#5b7aa6', furnish: 'lab', inner: '#f8fafc', floorC: '#cbd5e1' }); solidAdd(-13, -10, 5, 5, 16, '#c9d3e0', '#8d9bb0'); break;
      case 'grove': for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28; solidAdd(Math.cos(a) * 14, Math.sin(a) * 14, 5, 5, 16, '#6b4a2a', '#2f7a2c'); } H(tx, tz, 9, 9, { wall: '#a0763f', roof: '#6b4a2a' }); break;
      case 'lodge': H(tx, tz, 16, 12, { floors: 2, wall: '#8a5a2b', roof: '#4a2f17', inner: '#d6b58a', tex: 'siding' }); H(tx + 15, tz + 4, 8, 8, { wall: '#a0763f', roof: '#4a2f17', tex: 'siding' }); break;
      case 'bunker': H(tx, tz, 12, 9, { kind: 'flat', wall: '#4c5a4a', roof: '#2d352c', furnish: 'bunker', inner: '#9ca3af', floorC: '#6b7280' }); solidAdd(13, 0, 4, 4, 7, '#4c5a4a', '#2d352c'); break;
      case 'vault': H(tx, tz, 15, 15, { kind: 'flat', wall: '#8d96a3', roof: '#4a5b73', furnish: 'bunker', inner: '#cbd5e1', floorC: '#64748b' }); solidAdd(-11, -11, 3, 3, 9, '#6b7686', '#333'); solidAdd(11, -11, 3, 3, 9, '#6b7686', '#333'); break;
      case 'rig': add(tx, tz, 22, 22, 3, '#b8402f', '#7a241b'); add(tx - 6, tz + 4, 5, 5, 28, '#c0c6d0', '#6b7686'); break;
      case 'lighthouse': add(tx, tz, 6, 6, 30, '#f4f4f4', '#c0392b'); H(tx + 10, tz, 9, 7, { wall: '#9c6b3a', roof: '#6b3a2a' }); break;
    }
  }
  return { Batch, house, furnish, town, FH, WT, DW, DH, doorGeo };
})();
