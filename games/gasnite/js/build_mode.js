// ===== GASNITE BUILDING: walls, floors, ramps and roofs on a 4 m grid · wood / brick / metal · harvesting · bots build cover =====
// Build mode (F): 1 wall · 2 floor · 3 ramp · 4 roof · T material · R flip · click to place (10 materials each). Off in Zero Build.
window.GasBuild = (() => {
  const G = 4, LH = 3.5, COST = 10, MAX_PIECES = 450, MATS = ['wood', 'brick', 'metal'], HP = { wood: 150, brick: 230, metal: 330 }, CAP = 999;
  const PIECES = [{ k: 'wall', ic: '▮', n: 'Wall' }, { k: 'floor', ic: '▬', n: 'Floor' }, { k: 'ramp', ic: '◢', n: 'Ramp' }, { k: 'roof', ic: '▀', n: 'Roof' }];
  let enabled = false, on = false, piece = 0, matI = 0, flip = false, mats = { wood: 0, brick: 0, metal: 0 }, list = [], ghost = null, gTarget = null, hud = null, keyMap = new Map();
  const W = () => window.GasWorld, now = () => performance.now() / 1000;
  // ---- materials (canvas textures)
  const MT = {};
  function matFor(m) {
    if (MT[m]) return MT[m];
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    if (m === 'wood') { x.fillStyle = '#b07a43'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#a06c38' : '#bb8550'; x.fillRect(0, i * 16, 128, 15); x.fillStyle = '#6b4423'; x.fillRect(0, i * 16 + 15, 128, 1.5); x.fillRect((i * 37) % 128, i * 16, 2, 15); } }
    else if (m === 'brick') { x.fillStyle = '#c7c0b5'; x.fillRect(0, 0, 128, 128); for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) { x.fillStyle = ['#a8432f', '#b54d35', '#9a3b2a'][(r + k + 3) % 3]; x.fillRect(k * 32 + (r % 2) * 16 + 1.5, r * 16 + 1.5, 29, 13); } }
    else { x.fillStyle = '#8b97a6'; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#5b6574'; x.lineWidth = 3; x.strokeRect(4, 4, 120, 120); x.beginPath(); x.moveTo(64, 4); x.lineTo(64, 124); x.stroke(); x.fillStyle = '#d1d9e2'; [[12, 12], [116, 12], [12, 116], [116, 116], [56, 12], [72, 116]].forEach(p => { x.beginPath(); x.arc(p[0], p[1], 3, 0, 7); x.fill(); }); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(8, 8, 52, 112); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
    return (MT[m] = new THREE.MeshStandardMaterial({ map: t, roughness: m === 'metal' ? .45 : .85, metalness: m === 'metal' ? .35 : 0 }));
  }
  const GEO = {};
  const geo = k => GEO[k] || (GEO[k] = k === 'wallX' ? new THREE.BoxGeometry(G, LH, .3) : k === 'wallZ' ? new THREE.BoxGeometry(.3, LH, G) : k === 'floor' ? new THREE.BoxGeometry(G, .24, G) : new THREE.BoxGeometry(G, .24, Math.hypot(G, LH)));
  // ---- where would a piece go? (absolute 4 m grid, 3.5 m levels)
  function spec(k, px, py, pz, yaw, pitch, fl) {
    const dx = Math.sin(yaw), dz = Math.cos(yaw), alongX = Math.abs(dx) > Math.abs(dz), ang = Math.atan2(LH, G);
    let L = Math.floor((py + .5) / LH);
    if (k === 'wall') {
      if (L * LH + LH < py + 2.1) L++;
      const vert = fl ? !alongX : alongX;     // wall plane perpendicular to where you look (R flips it)
      if (vert) { const ex = Math.round((px + Math.sign(dx || 1) * 2.2) / G) * G, j = Math.floor((pz + dz * 1.2) / G); return { k, key: `w|x|${ex}|${j}|${L}`, cx: ex, cz: (j + .5) * G, y: L * LH + LH / 2, g: 'wallZ', col: { x0: ex - .15, x1: ex + .15, z0: j * G, z1: (j + 1) * G, y0: L * LH, y1: L * LH + LH } }; }
      const ez = Math.round((pz + Math.sign(dz || 1) * 2.2) / G) * G, i = Math.floor((px + dx * 1.2) / G); return { k, key: `w|z|${i}|${ez}|${L}`, cx: (i + .5) * G, cz: ez, y: L * LH + LH / 2, g: 'wallX', col: { x0: i * G, x1: (i + 1) * G, z0: ez - .15, z1: ez + .15, y0: L * LH, y1: L * LH + LH } };
    }
    const reach = k === 'roof' ? 0 : pitch > .55 ? .5 : 2.6, i = Math.floor((px + dx * reach) / G), j = Math.floor((pz + dz * reach) / G), cx = (i + .5) * G, cz = (j + .5) * G;
    if (k === 'floor' || k === 'roof') { const Lf = k === 'roof' ? Math.floor((py + .3) / LH) + 1 : Math.round(py / LH); return { k, key: `f|${i}|${j}|${Lf}`, cx, cz, y: Lf * LH - .12, g: 'floor', col: { x0: i * G, x1: (i + 1) * G, z0: j * G, z1: (j + 1) * G, y0: Lf * LH - .24, y1: Lf * LH } }; }
    // ramp rises away from you along the dominant look axis (R flips it)
    const s = (alongX ? Math.sign(dx || 1) : Math.sign(dz || 1)) * (fl ? -1 : 1);
    return { k, key: `r|${i}|${j}|${L}`, cx, cz, y: L * LH + LH / 2, g: 'ramp', rot: alongX ? [0, 0, s * ang] : [-s * ang, 0, 0], ry: alongX ? Math.PI / 2 : 0, col: { x0: i * G, x1: (i + 1) * G, z0: j * G, z1: (j + 1) * G, y0: L * LH, y1: L * LH + LH, ramp: { ax: alongX ? 'x' : 'z', s } } };
  }
  function meshFor(sp, mat) {
    const m = new THREE.Mesh(geo(sp.g), mat); m.position.set(sp.cx, sp.y, sp.cz);
    if (sp.g === 'ramp') { if (sp.ry) { m.rotation.order = 'YXZ'; m.rotation.set(sp.rot[2] ? -sp.rot[2] : 0, sp.ry, 0); } else m.rotation.set(sp.rot[0], 0, 0); }
    m.castShadow = true; m.receiveShadow = true; return m;
  }
  // ---- place / damage / destroy
  function placeSpec(sp, matName, owner) {
    if (keyMap.has(sp.key)) return null;
    const max = HP[matName], p = { k: sp.k, mat: matName, hp: max, max, owner, key: sp.key, mesh: meshFor(sp, matFor(matName)) };
    p.col = Object.assign({ t: 'build', piece: p }, sp.col); p.mesh.userData.piece = p;
    matchGroup.add(p.mesh); W().addCol(p.col); list.push(p); keyMap.set(sp.key, p);
    if (list.length > MAX_PIECES) destroy(list[0], true);
    return p;
  }
  function destroy(p, quiet) {
    const i = list.indexOf(p); if (i < 0) return; list.splice(i, 1); keyMap.delete(p.key);
    if (p.mesh.parent) p.mesh.parent.remove(p.mesh); W().remCol(p.col);
  }
  function hit(p, dmg, by) {
    p.hp -= dmg; if (p.hp <= 0) { destroy(p); return; }
    const k = .45 + .55 * p.hp / p.max; if (!p.dmgMat) { p.dmgMat = p.mesh.material.clone(); p.mesh.material = p.dmgMat; } p.dmgMat.color.setRGB(k, k, k);
  }
  // ---- pickaxe harvesting (player): trees → wood, houses & furniture → brick / wood, towers & metal → metal
  function harvest(c) {
    if (!enabled || !c) return;
    const t = c.t, m = t === 'tree' || t === 'furn' || t === 'stairs' ? 'wood' : t === 'tower' ? 'metal' : t === 'house' || t === 'roof' ? (c.house && c.house.kind === 'hall' ? 'metal' : 'brick') : null;
    if (!m) return; const amt = m === 'wood' ? 12 : 9; addMats(amt, m);
    if (typeof GasPlus !== 'undefined') GasPlus.feed(`+${amt} <b class="y">${m}</b>`);
  }
  function addMats(n, m) { if (m) mats[m] = Math.min(CAP, mats[m] + n); else MATS.forEach(k => { mats[k] = Math.min(CAP, mats[k] + Math.round(n * (k === 'wood' ? 1 : k === 'brick' ? .6 : .35))); }); drawHud(); }
  // ---- player controls
  function canBuild() { return enabled && W() && W().active && W().canAct() && W().phase !== 'lobby'; }
  function toggle(force) {
    const want = force === undefined ? !on : !!force;
    if (want && !canBuild()) { if (force === undefined && !enabled && typeof showToast === 'function') showToast('🚫 Building is off in Zero Build'); return; }
    on = want; if (ghost) ghost.visible = false; drawHud();
  }
  function current() { const p = brState.player; return spec(PIECES[piece].k, p.position.x, p.position.y, p.position.z, W().yaw, W().pitch, flip); }
  function place() {
    if (!on || !canBuild()) return;
    const m = MATS[matI]; if (mats[m] < COST) { if (typeof showToast === 'function') showToast(`Not enough ${m} — hit trees and houses with your pickaxe!`); return; }
    if (placeSpec(current(), m, 'player')) { mats[m] -= COST; drawHud(); }
  }
  // ---- bots: when shot, throw up a wall toward the shooter (and sometimes a ramp for high ground)
  function botReact(b, by) {
    if (!enabled || b.knocked || b.mats < COST || b.inside || now() - (b.bT || 0) < 2.4 || Math.random() > .35 + b.lvl * .5) return;
    const tp = by === 'player' ? brState.player.position : by && by.p; if (!tp) return; b.bT = now();
    const yaw = Math.atan2(tp.x - b.p.x, tp.z - b.p.z), m = b.mats > 200 ? 'brick' : 'wood';
    if (placeSpec(spec('wall', b.p.x, b.p.y, b.p.z, yaw, 0, false), m, b)) b.mats -= COST;
    if (b.mats >= COST && Math.random() < .3 * b.lvl && placeSpec(spec('ramp', b.p.x, b.p.y, b.p.z, yaw, 0, false), m, b)) b.mats -= COST;
  }
  // ---- HUD + ghost preview
  function drawHud() {
    if (!hud) { const h = document.getElementById('br-hud'); if (!h) return; hud = document.createElement('div'); hud.id = 'gb-hud'; h.appendChild(hud); const st = document.createElement('style'); st.textContent = '#gb-hud{position:absolute;right:18px;bottom:104px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none}#gb-hud .mats{display:flex;gap:6px}#gb-hud .mt{background:rgba(6,15,36,.82);border:2px solid #fff3;border-radius:5px;padding:3px 8px;font-weight:900;font-size:13px;min-width:62px;text-align:center}#gb-hud .mt.sel{border-color:#facc15;box-shadow:0 0 8px #facc15aa}#gb-hud .pcs{display:flex;gap:6px}#gb-hud .pc{width:54px;height:46px;background:rgba(6,15,36,.85);border:2px solid #fff4;border-radius:5px;display:grid;place-items:center;font-size:22px;position:relative}#gb-hud .pc.sel{border-color:#38bdf8;box-shadow:0 0 10px #38bdf8aa;transform:translateY(-4px)}#gb-hud .pc i{position:absolute;left:3px;top:1px;font-style:normal;font-size:10px;font-weight:900}#gb-hud .bm{background:#0ea5e9;color:#001;font-weight:900;font-size:12px;padding:2px 10px;border-radius:4px}#br-hud.building #hud-hot{opacity:.35}'; document.head.appendChild(st); }
    hud.style.display = enabled ? 'flex' : 'none';
    const ic = { wood: '🪵', brick: '🧱', metal: '⚙️' };
    hud.innerHTML = (on ? `<div class="bm">BUILD MODE · ${MATS[matI].toUpperCase()} · click to place${flip ? ' · flipped' : ''}</div><div class="pcs">${PIECES.map((p, i) => `<div class="pc ${i === piece ? 'sel' : ''}"><i>${i + 1}</i>${p.ic}</div>`).join('')}</div>` : '') + `<div class="mats">${MATS.map((m, i) => `<div class="mt ${on && i === matI ? 'sel' : ''}">${ic[m]} ${mats[m]}</div>`).join('')}</div>`;
    const h = document.getElementById('br-hud'); if (h) h.classList.toggle('building', on);
  }
  function frame() {
    if (on && !canBuild()) toggle(false);
    if (!on) { if (ghost) ghost.visible = false; return; }
    const sp = current(), key = sp.key + '|' + piece;
    if (!ghost) { ghost = new THREE.Mesh(geo('floor'), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: .38, depthWrite: false })); }
    if (ghost.parent !== matchGroup) matchGroup.add(ghost);
    if (gTarget !== key) { gTarget = key; const m = meshFor(sp, ghost.material); ghost.geometry = m.geometry; ghost.position.copy(m.position); ghost.rotation.copy(m.rotation); }
    ghost.visible = true; ghost.material.color.set(keyMap.has(sp.key) ? 0x94a3b8 : mats[MATS[matI]] >= COST ? 0x38bdf8 : 0xef4444);
  }
  function clear() { list.slice().forEach(p => destroy(p, true)); list = []; keyMap.clear(); if (ghost && ghost.parent) ghost.parent.remove(ghost); gTarget = null; on = false; }
  function reset() {
    clear(); enabled = !state.zeroBuild && state.gameMode !== 'PLAY TOWN'; on = false; piece = 0; matI = 0; flip = false; mats = { wood: 0, brick: 0, metal: 0 }; drawHud();
  }
  return {
    get enabled() { return enabled; }, get on() { return on; }, get mats() { return mats; }, get pieces() { return list; },
    toggle, place, piece: i => { piece = Math.max(0, Math.min(3, i)); gTarget = null; drawHud(); }, cycleMat: () => { matI = (matI + 1) % 3; drawHud(); }, rotate: () => { flip = !flip; gTarget = null; drawHud(); },
    addMats, harvest, hit, botReact, frame, reset, clear, _spec: spec, _place: placeSpec
  };
})();
