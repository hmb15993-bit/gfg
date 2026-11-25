// ===== GASNITE+ : in-game minimap + full map, rebindable keybinds (SETTINGS tab), loot chests, jump/sprint =====
window.GasPlus = (() => {
  const $ = id => document.getElementById(id);
  const DEF = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', camera: 'KeyV', jump: 'Space', sprint: 'ShiftLeft', emote: 'KeyB', pickaxe: 'KeyQ', slot1: 'Digit1', slot2: 'Digit2', slot3: 'Digit3', slot4: 'Digit4', slot5: 'Digit5', reload: 'KeyR', interact: 'KeyE', inventory: 'Tab', map: 'KeyM', minimap: 'KeyZ', build: 'KeyF', mat: 'KeyT', crouch: 'KeyC' };
  const LBL = { crouch: 'Crouch (while sprinting: slide)', build: 'Build mode on / off (1 wall · 2 floor · 3 ramp · 4 roof)', mat: 'Switch building material', forward: 'Move forward', back: 'Move back', left: 'Strafe left', right: 'Strafe right', camera: '1st / 3rd person', jump: 'Jump', sprint: 'Sprint', emote: 'Emote', pickaxe: 'Pickaxe', slot1: 'Hotbar slot 1', slot2: 'Hotbar slot 2', slot3: 'Hotbar slot 3', slot4: 'Hotbar slot 4', slot5: 'Hotbar slot 5', reload: 'Reload', interact: 'Open chest / pick up / hold to revive', inventory: 'Inventory screen', map: 'Full map', minimap: 'Minimap zoom' };
  const ENG = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD' };            // codes the base engine understands
  const ALT = { ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right' };
  let KB = { ...DEF }; try { Object.assign(KB, JSON.parse(localStorage.gasnite_keys || '{}')); } catch (e) {}
  delete KB.slot6; if (Object.keys(KB).some(a => a !== 'inventory' && KB[a] === 'Tab')) KB.inventory = 'KeyI';   // old saves: 5-slot hotbar, keep Tab conflicts away
  const saveKB = () => { try { localStorage.gasnite_keys = JSON.stringify(KB); } catch (e) {} };
  const nice = c => c.replace(/^Key|^Digit/, '').replace('ShiftLeft', 'L-SHIFT').replace('ShiftRight', 'R-SHIFT').replace('ControlLeft', 'L-CTRL').replace('Space', 'SPACE').replace('Arrow', '↑↓←→'.charAt(['Up', 'Down', 'Left', 'Right'].indexOf(c.replace('Arrow', '')))).toUpperCase();
  const act = c => Object.keys(KB).find(a => KB[a] === c) || ALT[c];
  const GY = (x, z) => window.GasWorld && GasWorld.active ? GasWorld.H(x, z) : 0;
  const held = {}; let cap = null, S = [], CH = [], zoom = 0, mapOpen = false, ready = false;

  /* ---------- keybind settings ---------- */
  function renderKB() {
    const L = $('gp-kb'); if (!L) return;
    L.innerHTML = Object.keys(DEF).map(a => `<div class="gp-row"><span>${LBL[a]}</span><button data-a="${a}" class="${cap === a ? 'cap' : ''}">${cap === a ? 'Press a key… (Esc cancels)' : nice(KB[a])}</button></div>`).join('') + '<div class="gp-row"><span>Fire / swing</span><b>LEFT CLICK</b></div><button id="gp-reset">Reset to defaults</button>';
    L.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => { cap = b.dataset.a; renderKB(); });
    $('gp-reset').onclick = () => { KB = { ...DEF }; saveKB(); renderKB(); hint(); };
  }
  function hint() {
    const h = document.querySelector('.br-controls-hint'); if (!h) return; const k = a => nice(KB[a]);
    h.textContent = `${k('forward')}/${k('left')}/${k('back')}/${k('right')} Move • ${k('jump')} Jump • ${k('sprint')} Sprint • CLICK Fire/Use • ${k('pickaxe')}/${k('slot1')}-${k('slot5')} Hotbar • ${k('inventory')} Inventory • ${k('reload')} Reload • ${k('interact')} Chest / hold to revive • ${k('map')} Map • ${k('emote')} Emote${window.GasBuild && GasBuild.enabled ? ` • ${k('build')} Build (1-4 piece, ${k('mat')} material)` : ''}`;
  }
  /* ---------- weapons (damage numbers from the rarity chart) ---------- */
  const RN = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
  const WD = {
    pistol: { n: 'Pistol', t: 'light', rt: 6.5, mg: 16, rl: 1.5, sp: .02, mode: 'semi', col: '#9ca3af', len: .35 },
    sppistol: { n: 'Suppressed Pistol', t: 'light', rt: 6.5, mg: 12, rl: 1.5, sp: .015, mode: 'semi', col: '#475569', len: .45 },
    revolver: { n: 'Revolver', t: 'light', rt: 2, mg: 6, rl: 2.3, sp: .01, mode: 'semi', col: '#a16207', len: .4 },
    hcannon: { n: 'Hand Cannon', t: 'light', rt: 1.6, mg: 7, rl: 2.5, sp: .01, mode: 'semi', col: '#b45309', len: .45 },
    smg: { n: 'SMG', t: 'light', rt: 12, mg: 30, rl: 2, sp: .06, mode: 'auto', col: '#334155', len: .55 },
    ssmg: { n: 'Silenced SMG', t: 'light', rt: 11, mg: 30, rl: 2.1, sp: .055, mode: 'auto', col: '#1e293b', len: .65 },
    tsmg: { n: 'Tactical SMG', t: 'light', rt: 13, mg: 30, rl: 2, sp: .05, mode: 'auto', col: '#0f172a', len: .6 },
    pump: { n: 'Pump Shotgun', t: 'shells', rt: .75, mg: 5, rl: 4.4, sp: .12, pel: 10, life: 26, mode: 'semi', col: '#7c2d12', len: .85 },
    tshot: { n: 'Tactical Shotgun', t: 'shells', rt: 2.2, mg: 8, rl: 5, sp: .1, pel: 8, life: 26, mode: 'semi', col: '#3f3f46', len: .8 },
    hshot: { n: 'Heavy Shotgun', t: 'shells', rt: .9, mg: 8, rl: 5, sp: .11, pel: 8, life: 28, mode: 'semi', col: '#27272a', len: .9 },
    m16: { n: 'M16 Rifle', t: 'medium', rt: 5.5, mg: 30, rl: 2.3, sp: .025, mode: 'auto', col: '#365314', len: .9 },
    burst: { n: 'Burst Rifle', t: 'medium', rt: 2.4, mg: 30, rl: 2.4, sp: .02, mode: 'burst', col: '#3f6212', len: .9 },
    scar: { n: 'SCAR', t: 'medium', rt: 5.5, mg: 30, rl: 2.5, sp: .02, mode: 'auto', col: '#92400e', len: .95 },
    scoped: { n: 'Scoped Rifle', t: 'medium', rt: 3, mg: 10, rl: 2.8, sp: .008, mode: 'semi', spd: 1.3, life: 110, zm: .45, col: '#1d4ed8', len: 1 },
    hunting: { n: 'Hunting Rifle', t: 'heavy', rt: 1, mg: 1, rl: 2.5, sp: .004, mode: 'semi', spd: 1.5, life: 140, zm: .62, col: '#78350f', len: 1.1 },
    bolt: { n: 'Bolt Action Sniper', t: 'heavy', rt: .35, mg: 1, rl: 3.2, sp: .002, mode: 'semi', spd: 1.6, life: 160, zm: .4, col: '#166534', len: 1.25 },
    semis: { n: 'Semi Auto Sniper', t: 'heavy', rt: 1.7, mg: 10, rl: 3, sp: .004, mode: 'semi', spd: 1.55, life: 150, zm: .4, col: '#6d28d9', len: 1.2 },
    xbow: { n: 'Crossbow', t: 'heavy', rt: .7, mg: 1, rl: 2.8, sp: .004, mode: 'semi', spd: 1.1, life: 120, zm: .6, col: '#44403c', len: .7 },
    rocket: { n: 'Rocket Launcher', t: 'rockets', rt: .75, mg: 1, rl: 3.3, mode: 'semi', ex: 1, col: '#7f1d1d', len: 1.1 },
    gl: { n: 'Grenade Launcher', t: 'rockets', rt: 1.2, mg: 6, rl: 3.1, mode: 'semi', ex: 2, col: '#14532d', len: .8 },
    mini: { n: 'Minigun', t: 'light', rt: 8, mg: 100, rl: 5.5, sp: .09, mode: 'auto', col: '#374151', len: 1 },
    // ---- new guns
    mpistol: { n: 'Machine Pistol', t: 'light', rt: 14, mg: 21, rl: 1.6, sp: .07, mode: 'auto', col: '#334155', len: .35 },
    drum: { n: 'Drum Gun', t: 'light', rt: 9.5, mg: 50, rl: 3.4, sp: .07, mode: 'auto', col: '#57534e', len: .75 },
    dbarrel: { n: 'Double Barrel', t: 'shells', rt: 3, mg: 2, rl: 3.2, sp: .15, pel: 10, life: 21, mode: 'semi', col: '#7c2d12', len: .8 },
    ashot: { n: 'Auto Shotgun', t: 'shells', rt: 3.2, mg: 10, rl: 4.6, sp: .11, pel: 7, life: 24, mode: 'auto', col: '#27272a', len: .85 },
    battle: { n: 'Battle Rifle', t: 'medium', rt: 4, mg: 20, rl: 2.6, sp: .03, mode: 'auto', spd: 1.15, life: 80, col: '#78350f', len: .95 },
    lmg: { n: 'Light Machine Gun', t: 'medium', rt: 7, mg: 60, rl: 4.8, sp: .05, mode: 'auto', col: '#3f3f46', len: 1 },
    dmr: { n: 'Marksman Rifle', t: 'medium', rt: 3.6, mg: 12, rl: 2.7, sp: .006, mode: 'semi', spd: 1.35, life: 120, zm: .5, col: '#1e293b', len: 1.05 },
    lever: { n: 'Lever Action Rifle', t: 'heavy', rt: 1.25, mg: 6, rl: 3.6, sp: .004, mode: 'semi', spd: 1.5, life: 140, zm: .62, col: '#92400e', len: 1 }
  };
  // damage per rarity (Common → Legendary). Pump Shotgun: 112 at Common up to 200 at Legendary, as requested.
  const CHART = [
    { pistol: 23, revolver: 54, smg: 14, ssmg: 17, pump: 112, m16: 30, burst: 27, mpistol: 12 },
    { pistol: 24, revolver: 57, smg: 15, ssmg: 18, tsmg: 16, pump: 134, tshot: 67, m16: 31, burst: 29, hunting: 86, mpistol: 13, drum: 19, dmr: 40, lever: 82 },
    { pistol: 25, revolver: 60, smg: 16, ssmg: 19, tsmg: 17, pump: 156, tshot: 70, m16: 33, burst: 30, hunting: 90, bolt: 105, rocket: 110, gl: 100, mpistol: 14, drum: 20, dbarrel: 122, ashot: 50, battle: 40, lmg: 24, dmr: 42, lever: 86 },
    { sppistol: 26, hcannon: 75, tsmg: 18, pump: 178, tshot: 74, hshot: 74, scar: 35, scoped: 24, bolt: 110, semis: 63, rocket: 116, gl: 110, xbow: 79, mini: 16, drum: 21, dbarrel: 130, ashot: 53, battle: 42, lmg: 25, dmr: 45, lever: 91 },
    { sppistol: 28, hcannon: 78, pump: 200, hshot: 77, scar: 36, bolt: 116, semis: 66, rocket: 121, gl: 105, mini: 17, dbarrel: 138, ashot: 56, battle: 44, lmg: 26 }
  ];
  // ---- loot scarcity: rarity odds (%) Common → Legendary per source. Floor loot is mostly grey/green, chests rarely give
  //      purple/gold, golden chests are the reliable way to Rare+, supply drops to Epic+.
  const ODDS = { floor: [56, 30, 12, 2, 0], chest: [40, 32, 21.5, 5.3, 1.2], gold: [0, 0, 75, 21, 4], supply: [0, 0, 0, 84, 16] };
  const pick = w => { let x = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return i; } return 0; };
  const rollRar = (src = 'chest') => pick(ODDS[src] || ODDS.chest);
  // the strongest guns are also rarer than others of the same rarity
  const WW = { rocket: .3, gl: .45, mini: .45, bolt: .6, semis: .7, hcannon: .75, dbarrel: .8, lmg: .8, xbow: .8, scar: .85, hshot: .85 };
  const rollWeapon = r => { const k = Object.keys(CHART[r]); return k[pick(k.map(x => WW[x] || 1))]; };
  // ammo: a found gun is loaded but carries no spares; small packs come with chest guns, some floor guns and eliminations
  const AMMO_PACK = { light: 16, medium: 12, shells: 4, heavy: 3, rockets: 1 }, AMMO_CAP = { light: 30, medium: 24, shells: 8, heavy: 5, rockets: 2 };
  const ammoPack = (t, k = 1) => Math.max(1, Math.round(AMMO_PACK[t] * k));
  // ---- Inventory: pickaxe + 5 hotbar slots. Any slot holds a gun or a stack of heals; the inventory screen rearranges / drops.
  const ITEMS = { med: { n: 'Med Kit', ic: '🩹', max: 3, c: '#94a3b8', t: 3.5, d: '+50 health' }, shield: { n: 'Shield Potion', ic: '🧪', max: 3, c: '#0ea5e9', t: 2.5, d: '+50 shield' }, slurp: { n: 'Slurp Juice', ic: '🥤', max: 2, c: '#16a34a', t: 2, d: '+25 health & shield' } };
  const WIC = { light: '🔫', medium: '🔫', shells: '💥', heavy: '🎯', rockets: '🚀' }, NSLOT = 5;
  let sel = 0, HB = [null, null, null, null, null], AM = { light: 40, medium: 30, shells: 8, heavy: 4, rockets: 1 }, T = [], t0 = 0, rel = null, nextFire = 0, burst = 0, burstT = 0, mdown = false, RK = [], EX = [], hand = null, invOpen = false, useT = null;
  const nowS = () => performance.now() / 1000;
  addEventListener('mousedown', e => { if (e.button === 0 && uiState.inMatch && !invOpen) mdown = true; }); addEventListener('mouseup', () => mdown = false); addEventListener('blur', () => mdown = false);
  const selWeapon = () => { const it = sel >= 1 ? HB[sel - 1] : null; return it && it.k === 'weapon' ? it : null; };
  // 3D gun: the hand-built model from weapons.js (falls back to simple boxes if that script is missing)
  function gunModel(k, r, o) {
    if (window.GasGuns && GasGuns.has(k)) { const m = GasGuns.model(k, r, o); if (m) return m; }
    const d = WD[k], g = new THREE.Group(), L = d.len, mt = c => new THREE.MeshStandardMaterial({ color: c, roughness: .4, metalness: .5 }), add = (w, h, dd, c, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), mt(c)); o.position.set(x, y, z); g.add(o); return o; };
    if (d.ex) add(.2, .2, L, d.col, 0, 0, L / 2); else add(.09, .11, L, d.col, 0, 0, L / 2);
    add(.07, .2, .1, '#1f2937', 0, -.13, .12);
    if (d.t === 'medium' || d.t === 'heavy' || d.t === 'shells') add(.07, .14, .3, '#1f2937', 0, -.02, -.12);
    if (d.mode === 'auto') add(.06, .2, .09, '#111827', 0, -.15, L * .45);
    add(.04, .04, .08, RAR[r], 0, .09, L * .7); g.userData.gun = 1; return g;
  }
  // put a gun in a hand: the model's grip sits in the fist (the hold pose in plus_rig.js does the rest)
  function holdIn(glove, k, r) {
    const g = gunModel(k, r, { shadow: true });
    if (g.userData.v2) g.position.set(0, -.04, .005); else { g.scale.setScalar(.8); g.position.set(0, -.03, .12); }
    g.userData.key = k + '|' + r; glove.add(g); return g;
  }
  function syncHand() {
    const p = brState.player; if (!p || !p.userData.joints) return; const gl = p.userData.joints.leftArm.glove;   // leftArm = the character's right hand (camera side)
    const pk = p.userData.pk, w = selWeapon(), key = w ? w.w + '|' + w.r : ''; if (pk) pk.visible = !w;
    if (hand && hand.userData.key === key && hand.parent === gl) return;   // same gun already in hand
    if (hand) { if (hand.parent) hand.parent.remove(hand); hand = null; }
    if (w) hand = holdIn(gl, w.w, w.r);
  }
  // icons: renders of the real models (weapons.js); emoji until a render is ready
  const GG = () => window.GasGuns;
  const gunIcon = (w, r, cls) => GG() ? GasGuns.iconHTML('gun', w, r, WIC[WD[w].t], cls) : WIC[WD[w].t];
  const itemIcon = (k, fb, cls) => GG() && GasGuns.hasItem(k) ? GasGuns.iconHTML('item', k, 0, fb, 'sq ' + (cls || '')) : fb;
  const pickIcon = () => GG() && typeof state !== 'undefined' && state.equipped && state.equipped.pickaxe ? GasGuns.iconHTML('pick', state.equipped.pickaxe, 0, '⛏️', 'sq') : '⛏️';
  function slotView(it, i) {
    if (!it) return { ic: '', c: '#334155', n: '', m: '', cls: 'empty', name: 'Empty' };
    if (it.k === 'weapon') { const d = WD[it.w]; return { ic: gunIcon(it.w, it.r), c: RAR[it.r], n: AM[d.t], m: rel && rel.slot === i ? '…' : it.mag, cls: '', name: `${RN[it.r]} ${d.n}`, sub: `${CHART[it.r][it.w]} dmg · ${it.mag}/${d.mg} · ${d.t} ammo` }; }
    const D = ITEMS[it.k]; return { ic: itemIcon(it.k, D.ic), c: D.c, n: it.n, m: '', cls: '', name: D.n, sub: `${D.d} · ${it.n}/${D.max} · ${D.t}s to use` };
  }
  function buildHot() {
    const cells = [`<div class="hs pk ${sel === 0 ? 'sel' : ''}" style="--c:#64748b"><span class="l">PICKAXE</span><span class="k">${nice(KB.pickaxe)}</span>${pickIcon()}</div>`];
    for (let i = 0; i < NSLOT; i++) { const v = slotView(HB[i], i), using = useT && useT.slot === i, dry = HB[i] && HB[i].k === 'weapon' && v.n <= 0; cells.push(`<div class="hs ${i + 1 === sel ? 'sel' : ''} ${v.cls}" style="--c:${v.c}"><span class="k">${nice(KB['slot' + (i + 1)])}</span><span class="n${dry ? ' lo' : ''}">${v.n}</span><span class="m">${using ? '⏳' : v.m}</span>${v.ic}</div>`); }
    $('hud-hot').innerHTML = cells.join(''); syncHand(); if (invOpen) renderInv();
  }
  function select(i) { if (i > NSLOT) return; sel = i; rel = null; burst = 0; useT = null; if (i <= 2) brState.weapon = i; buildHot(); }
  // heals take a moment to use; switching slots cancels
  function useItem(i) {
    const it = HB[i]; if (!it || it.k === 'weapon' || useT) return;
    if (it.k === 'med' && brState.hp >= 100) return showToast('Health is already full');
    if (it.k === 'shield' && brState.shield >= 100) return showToast('Shield is already full');
    if (it.k === 'slurp' && brState.hp >= 100 && brState.shield >= 100) return showToast('Health and shield are already full');
    useT = { slot: i, it, until: nowS() + ITEMS[it.k].t }; showToast(`Using ${ITEMS[it.k].n}…`); buildHot();
  }
  function finishUse() {
    const { slot, it } = useT; useT = null; if (HB[slot] !== it) return buildHot();
    if (it.k === 'med') brState.hp = Math.min(100, brState.hp + 50); else if (it.k === 'shield') brState.shield = Math.min(100, brState.shield + 50); else { brState.hp = Math.min(100, brState.hp + 25); brState.shield = Math.min(100, brState.shield + 25); }
    if (--it.n <= 0) HB[slot] = null; updateBRHud(); buildHot();
  }
  function addItem(k, n) { // stack onto existing stacks, then empty slots; returns what didn't fit
    for (const it of HB) if (it && it.k === k && it.n < ITEMS[k].max) { const a = Math.min(n, ITEMS[k].max - it.n); it.n += a; n -= a; if (!n) return 0; }
    while (n > 0) { const e = HB.findIndex(x => !x); if (e < 0) break; const a = Math.min(n, ITEMS[k].max); HB[e] = { k, n: a }; n -= a; }
    return n;
  }
  function dropSlot(i) {
    const it = HB[i]; if (!it) return; const p = brState.player, a = p.rotation.y, x = p.position.x + Math.sin(a) * 1.4, z = p.position.z + Math.cos(a) * 1.4;
    if (it.k === 'weapon') spawnLoose(x, z, { w: it.w, r: it.r, mag: it.mag }, p.position.y); else spawnLoose(x, z, { k: it.k, amt: it.n }, p.position.y);   // a dropped gun keeps what is left in its magazine
    HB[i] = null; if (rel && rel.slot === i) rel = null; if (useT && useT.slot === i) useT = null;
  }
  // ---- inventory screen: drag cards to rearrange the hotbar, DROP to throw items away, ammo / materials / health at a glance
  function renderInv() {
    let el = $('gp-inv'); if (!el) { el = document.createElement('div'); el.id = 'gp-inv'; el.className = invOpen ? '' : 'hidden'; document.body.appendChild(el); }
    const mats = window.GasBuild && GasBuild.enabled ? GasBuild.mats : null, chip = (ic, k, v) => `<span class="inv-am">${ic} ${k} <b>${v}</b></span>`;
    el.innerHTML = `<div class="inv"><div class="inv-h"><b>INVENTORY</b><span>Drag cards to rearrange · click a card to equip · DROP throws it on the ground · [${nice(KB.inventory)}] or [ESC] closes</span></div>
      <div class="inv-slots">${HB.map((it, i) => { const v = slotView(it, i); return `<div class="inv-s ${v.cls} ${i + 1 === sel ? 'sel' : ''}" draggable="true" data-i="${i}" style="--c:${v.c}"><div class="inv-k">${nice(KB['slot' + (i + 1)])}</div><div class="inv-ic">${v.ic || '＋'}</div><div class="inv-n">${v.name}</div><div class="inv-sub">${v.sub || 'Pick up a weapon or heal'}</div>${it ? `<button data-drop="${i}">DROP</button>` : ''}</div>`; }).join('')}</div>
      <div class="inv-b"><div><h4>AMMO <small style="color:#cbd5e1;font-weight:400">· DROP = half · Shift+click = all</small></h4>${Object.keys(AM).map(k => `<span class="inv-am">${itemIcon('a_' + k, WIC[k], 'mini')} ${k} <b>${AM[k]}</b>${AM[k] > 0 ? ` <button class="inv-da" data-ammo="${k}">DROP</button>` : ''}</span>`).join('')}</div>${mats ? `<div><h4>MATERIALS</h4>${chip('🪵', 'wood', mats.wood)}${chip('🧱', 'brick', mats.brick)}${chip('⚙️', 'metal', mats.metal)}</div>` : ''}<div><h4>STATUS</h4>${chip('✚', 'health', Math.round(brState.hp))}${chip('🛡', 'shield', Math.round(brState.shield))}</div></div></div>`;
    el.querySelectorAll('[data-drop]').forEach(b => b.onclick = e => { e.stopPropagation(); dropSlot(+b.dataset.drop); buildHot(); });
    el.querySelectorAll('[data-ammo]').forEach(b => b.onclick = e => {
      const k = b.dataset.ammo, n = e.shiftKey ? AM[k] : Math.ceil(AM[k] / 2); if (!n) return; AM[k] -= n;
      const p = brState.player, a = p.rotation.y; spawnLoose(p.position.x + Math.sin(a) * 1.3, p.position.z + Math.cos(a) * 1.3, { k: 'ammo1', t: k, amt: n, ownDrop: true }, p.position.y);
      feed(`Dropped <b class="y">${n} ${k} ammo</b>`); buildHot();
    });
    el.querySelectorAll('.inv-s').forEach(s => {
      s.ondragstart = e => e.dataTransfer.setData('text/plain', s.dataset.i);
      s.ondragover = e => e.preventDefault();
      s.ondrop = e => { e.preventDefault(); const a = +e.dataTransfer.getData('text/plain'), b = +s.dataset.i; if (a === b || isNaN(a)) return; [HB[a], HB[b]] = [HB[b], HB[a]]; rel = null; useT = null; buildHot(); };
      s.onclick = () => select(+s.dataset.i + 1);
    });
  }
  function toggleInv(force) {
    const open = force === undefined ? !invOpen : !!force; if (open === invOpen) return;
    if (open && (!uiState.inMatch || (window.GasWorld && GasWorld.active && !GasWorld.canAct()))) return;
    invOpen = open; renderInv(); $('gp-inv').classList.toggle('hidden', !open); mdown = false;
    for (const k in brState.keys) brState.keys[k] = false; held.jump = held.sprint = held.interact = false;
    if (window.GasWorld && GasWorld.active && GasWorld.menu) GasWorld.menu(open);
  }
  let dryT = 0;
  function startReload() {
    const w = selWeapon(); if (!w || rel) return; const d = WD[w.w]; if (w.mag >= d.mg) return;
    if (AM[d.t] <= 0) { if (nowS() > dryT) { dryT = nowS() + 2.5; showToast(`Out of ${d.t} ammo — open chests and ammo boxes, or take it from eliminations`); } return; }
    rel = { slot: sel - 1, w, until: nowS() + d.rl, dur: d.rl }; showToast('Reloading…'); buildHot();
  }
  function spawnB(yaw, dmg, spd, life, size, col, pick) {
    const ap = window.GasWorld && GasWorld.active ? GasWorld.aimPitch() : 0, p = brState.player, m = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 6), new THREE.MeshBasicMaterial({ color: col || 0xfacc15 }));
    m.position.copy(p.position).add(new THREE.Vector3(Math.sin(yaw) * .25, 1.25, Math.cos(yaw) * .25)); matchGroup.add(m);
    brState.bullets.push({ mesh: m, vel: new THREE.Vector3(Math.sin(yaw) * spd * Math.cos(ap), -Math.sin(ap) * spd * .85, Math.cos(yaw) * spd * Math.cos(ap)), life, dmg, pick });
  }
  function hitBot(bot, dmg) { const m = new THREE.Mesh(new THREE.SphereGeometry(.05), new THREE.MeshBasicMaterial({ visible: false })); m.position.copy(bot.mesh.position).add(new THREE.Vector3(0, 1.1, 0)); matchGroup.add(m); brState.bullets.push({ mesh: m, vel: new THREE.Vector3(), life: 3, dmg }); }
  function launch(d, dmg, yaw) {
    const p = brState.player, g = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .5, 8), new THREE.MeshStandardMaterial({ color: d.ex === 1 ? '#dc2626' : '#16a34a' })); body.rotation.x = Math.PI / 2; g.add(body);
    g.position.copy(p.position).add(new THREE.Vector3(Math.sin(yaw) * .8, 1.3, Math.cos(yaw) * .8)); g.rotation.y = yaw; matchGroup.add(g);
    const s = d.ex === 1 ? .75 : .55; RK.push({ g, dmg, v: new THREE.Vector3(Math.sin(yaw) * s, d.ex === 2 ? .2 : 0, Math.cos(yaw) * s), life: 140, gl: d.ex === 2 });
  }
  function explode(r) {
    const pos = r.g.position.clone(), R = 5.5; matchGroup.remove(r.g); RK.splice(RK.indexOf(r), 1);
    if (window.GasWorld && GasWorld.active && GasWorld.blast) GasWorld.blast(pos.x, pos.y, pos.z, R, r.dmg * 1.6, 'player');   // rockets wreck builds, walls and trees
    brState.bots.slice().forEach(b => { const dd = b.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0)).distanceTo(pos); if (dd < R) hitBot(b, r.dmg * (dd <= 1.8 ? 1 : Math.max(.25, 1 - (dd - 1.8) / (R - 1.8) * .75))); });
    const pd = brState.player.position.distanceTo(pos); if (pd < R) { let sd = r.dmg * .3 * (1 - pd / R); const a = Math.min(brState.shield, sd); brState.shield -= a; sd -= a; brState.hp = Math.max(1, brState.hp - sd); updateBRHud(); }
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xff8a1f, transparent: true, opacity: .85 })); m.position.copy(pos); matchGroup.add(m); EX.push({ m, life: 22 });
  }
  function updateRK() {
    RK.slice().forEach(r => {
      const o = r.g.position.clone(); r.g.position.add(r.v); if (r.gl) r.v.y -= .012; r.life--; const q = r.g.position;
      let hit = r.life <= 0 || q.y <= .2 || brState.bots.some(b => b.mesh.position.clone().add(new THREE.Vector3(0, 1.1, 0)).distanceTo(q) < 1.5);
      if (!hit && window.GasWorld && GasWorld.active) { if (q.y < GasWorld.H(q.x, q.z)) hit = true; else { const h = GasWorld.segHit(o.x, o.y, o.z, q.x, q.y, q.z); if (h) { q.set(o.x + (q.x - o.x) * h.t, o.y + (q.y - o.y) * h.t, o.z + (q.z - o.z) * h.t); hit = true; } } }   // walls, trees and builds stop rockets
      if (hit) explode(r);
    });
    EX.slice().forEach(e => { e.life--; e.m.scale.addScalar(.28); e.m.material.opacity = e.life / 26; if (e.life <= 0) { matchGroup.remove(e.m); EX.splice(EX.indexOf(e), 1); } });
  }
  function shootOnce(w) {
    if (w.mag <= 0) { burst = 0; startReload(); return; }
    const d = WD[w.w], dmg = CHART[w.r][w.w], yaw = window.GasWorld && GasWorld.active ? GasWorld.yaw : brState.player.rotation.y; w.mag--; brState.player.userData.recoil = 1;
    if (window.GasWorld && GasWorld.active && GasWorld.noise) GasWorld.noise(brState.player.position.x, brState.player.position.z, 0);   // bots hear your shots
    if (d.ex) launch(d, dmg, yaw); else { const n = d.pel || 1; for (let i = 0; i < n; i++) spawnB(yaw + (Math.random() - .5) * 2 * d.sp, dmg / n, d.spd || .95, d.life || 65, n > 1 ? .07 : .13); }
    buildHot(); if (w.mag <= 0) setTimeout(startReload, 150);
  }
  function fireInput(click) {
    const w = selWeapon(); if (!w) { if (click) showToast('No weapon — grab one from a chest or the ground!'); return; }
    const d = WD[w.w], now = nowS(); if (rel || now < nextFire || burst > 0) return; if (d.mode !== 'auto' && !click) return;
    if (w.mag <= 0) { startReload(); return; } nextFire = now + 1 / d.rt;
    if (d.mode === 'burst') { burst = 3; burstT = now; } else shootOnce(w);
  }
  function onFire() {
    if (!uiState.inMatch || !brState.player) return false;
    if (window.GasWorld && GasWorld.active && !GasWorld.canAct()) return true;
    if (invOpen) return true;
    if (window.GasBuild && GasBuild.on) { GasBuild.place(); return true; }
    const cur = sel >= 1 ? HB[sel - 1] : null; if (cur && cur.k !== 'weapon') { useItem(sel - 1); return true; }
    if (brState.isPlayTown) return false;
    if (sel === 0) { const n = nowS(); if (n >= nextFire) { nextFire = n + .45; spawnB(window.GasWorld && GasWorld.active ? GasWorld.yaw : brState.player.rotation.y, 20, .9, 6, .1, 0xffffff, true); if (window.GasWorld) GasWorld.swing(); } return true; }
    fireInput(true); return true;
  }
  const weaponName = () => { const w = selWeapon(); return w ? WD[w.w].n : 'Pickaxe'; };
  function feed(html) { const f = $('hud-feed'); if (!f) return; const d = document.createElement('div'); d.innerHTML = html; f.appendChild(d); while (f.children.length > 5) f.firstChild.remove(); setTimeout(() => d.remove(), 7000); }
  function compass() {
    const c = $('hud-compass'), x = c.getContext('2d'), w = c.width, p = brState.player; let b = Math.atan2(Math.sin(p.rotation.y), -Math.cos(p.rotation.y)) * 180 / Math.PI; b = (b + 360) % 360;
    const N = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    x.clearRect(0, 0, w, c.height); x.textAlign = 'center'; x.shadowColor = '#000'; x.shadowBlur = 4;
    for (let d = Math.ceil((b - 55) / 15) * 15; d <= b + 55; d += 15) { const dd = ((d % 360) + 360) % 360, off = d - b; if (Math.abs(off) < 12) continue; x.globalAlpha = 1 - Math.abs(off) / 62; x.fillStyle = '#fff'; x.font = N[dd] ? 'bold 17px sans-serif' : '12px sans-serif'; x.fillText(N[dd] || dd, w / 2 + off * 4.2, 20); }
    x.globalAlpha = 1; x.font = 'bold 24px sans-serif'; x.fillStyle = '#fff'; x.fillText(Math.round(b) % 360, w / 2, 24); x.beginPath(); x.moveTo(w / 2 - 6, 33); x.lineTo(w / 2 + 6, 33); x.lineTo(w / 2, 42); x.fill();
  }
  let MATES = [];
  function teamPanel() {
    const o = getCosmeticById('outfit', state.equipped.outfit), row = (n, col, hp, sh, id) => `<div class="trow" id="${id}r"><div class="av" style="background:${col}">${n[0]}</div><div><div class="nm" id="${id}n">${n}</div><div class="tb"><i id="${id}s" style="width:${sh}%;background:#38bdf8"></i></div><div class="tb"><i id="${id}h" style="width:${hp}%;background:#22c55e"></i></div></div></div>`;
    MATES = brState.bots.filter(b => b.team === 0);
    $('hud-team').innerHTML = row(state.username || o.name, o.palette[4], brState.hp, brState.shield, 'tm0') + MATES.map((b, i) => row(b.name, b.col || '#22c55e', b.hp, b.sh || 0, 'tm' + (i + 1))).join('');
  }
  function teamBars() {
    MATES.forEach((b, i) => {
      const id = 'tm' + (i + 1), s = $(id + 's'), h = $(id + 'h'), n = $(id + 'n'), r = $(id + 'r'); if (!s) return;
      s.style.width = Math.max(0, b.sh || 0) + '%'; h.style.width = (b.knocked ? Math.max(0, b.khp || 0) : Math.max(0, b.hp)) + '%'; h.style.background = b.knocked ? '#ef4444' : '#22c55e';
      const tagTxt = b.dead ? `✖ ${b.name}` : b.knocked ? `▼ ${b.name} — KNOCKED` : b.name; if (n.textContent !== tagTxt) n.textContent = tagTxt; r.style.opacity = b.dead ? .4 : 1;
    });
  }
  // a supply crate on a blue balloon drifts down into the safe zone; it holds epic+ loot
  function supplyDrop(x, z) {
    if (!(window.GasWorld && GasWorld.active)) return;
    const gy = GasWorld.surface(x, z, 999), c = makeChest(x, z, true, { y: gy + 75, supply: true }), bal = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: .35, emissive: '#0c4a6e' }));
    bal.position.y = 4.6; bal.scale.y = 1.2; c.g.add(bal); c.balloon = bal; c.g.scale.setScalar(1.25); c.falling = true; c.landY = gy; CH.push(c);
    feed('<b class="y">🪂 Supply drop</b> incoming!'); showToast('🪂 A supply drop is falling — look for the blue balloon!');
  }
  function press(a) {
    if (a === 'inventory') { toggleInv(); return; }
    if (a === 'crouch') { if (window.GasWorld && GasWorld.active) GasWorld.crouch(); return; }
    const GB = window.GasBuild, bOn = !!(GB && GB.on);
    if (a === 'build') { if (GB) GB.toggle(); return; }
    if (a === 'mat') { if (GB) GB.cycleMat(); return; }
    if (bOn && a.startsWith('slot') && +a.slice(4) <= 4) { GB.piece(+a.slice(4) - 1); return; }
    if (bOn && (a === 'pickaxe' || a.startsWith('slot'))) GB.toggle(false);
    if (a === 'pickaxe') select(0); else if (a.startsWith('slot')) select(+a.slice(4)); else if (a === 'reload') { if (bOn) GB.rotate(); else startReload(); }
    else if (a === 'emote') uiState.isEmoting = !uiState.isEmoting;
    else if (a === 'interact') interact();
    else if (a === 'map') { mapOpen = !mapOpen; $('gp-map').classList.toggle('hidden', !mapOpen); }
    else if (a === 'minimap') zoom = (zoom + 1) % 3;
    else if (a === 'camera' && window.GasWorld) GasWorld.toggleView();
  }
  addEventListener('keydown', e => {
    if (cap) { e.preventDefault(); e.stopImmediatePropagation(); if (e.code !== 'Escape') { for (const a in KB) if (KB[a] === e.code) KB[a] = KB[cap]; KB[cap] = e.code; saveKB(); } cap = null; renderKB(); return; }
    if (!uiState.inMatch) return;
    e.stopImmediatePropagation(); const a = act(e.code);
    if (invOpen) { if (e.code === 'Escape' || a === 'inventory') { e.preventDefault(); toggleInv(false); } else if (a && a.startsWith('slot')) { e.preventDefault(); select(+a.slice(4)); } return; }
    if (!a) return; e.preventDefault();
    if (ENG[a]) brState.keys[ENG[a]] = true; else if (a === 'jump' || a === 'sprint') held[a] = true; else if (!e.repeat) { if (a === 'interact') held.interact = true; press(a); }
  }, true);
  addEventListener('keyup', e => {
    if (!uiState.inMatch) return; e.stopImmediatePropagation(); const a = act(e.code); if (!a) return;
    if (ENG[a]) brState.keys[ENG[a]] = false; held[a] = false;
  }, true);

  /* ---------- chests ---------- */
  function makeChest(x, z, gold, o = {}) {
    const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: o.ammo ? '#3f5f2a' : gold ? '#b45309' : '#8a5a2b', roughness: .7 }), metal = new THREE.MeshStandardMaterial({ color: o.ammo ? '#d4d4d8' : '#fbbf24', roughness: .3, metalness: .8, emissive: gold ? '#a16207' : '#000' });
    if (window.GasTex) { wood.map = GasTex.get('planks'); wood.color.multiplyScalar(1 / GasTex.mean('planks')); }   // wooden slats
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, .6, .7), wood); body.position.y = .3; body.castShadow = true; g.add(body);
    const lid = new THREE.Group(); lid.position.set(0, .6, -.35); g.add(lid);
    const lm = new THREE.Mesh(new THREE.BoxGeometry(1.12, .18, .74), wood); lm.position.set(0, .09, .35); lid.add(lm);
    [-.3, .3].forEach(bx => { const b = new THREE.Mesh(new THREE.BoxGeometry(.1, .64, .74), metal); b.position.set(bx, .3, 0); g.add(b); const b2 = new THREE.Mesh(new THREE.BoxGeometry(.1, .2, .76), metal); b2.position.set(bx, .09, .35); lid.add(b2); });
    const lock = new THREE.Mesh(new THREE.BoxGeometry(.14, .16, .06), metal); lock.position.set(0, .55, .37); g.add(lock);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(.5, .8, o.house ? 2.2 : 5, 12, 1, true), new THREE.MeshBasicMaterial({ color: o.ammo ? 0x86efac : gold ? 0xfbbf24 : 0x60a5fa, transparent: true, opacity: .22, side: THREE.DoubleSide, depthWrite: false })); glow.position.y = o.house ? 1.2 : 2.6; g.add(glow);
    if (o.ammo) g.scale.setScalar(.72);
    g.position.set(x, o.y != null ? o.y : GY(x, z), z); g.rotation.y = o.rot != null ? o.rot : Math.random() * 6.28; matchGroup.add(g);
    return { x, y: g.position.y, z, gold, ammo: !!o.ammo, supply: !!o.supply, house: o.house || null, floor: o.floor || 0, g, lid, glow, open: false, t: 0 };
  }
/* ---------- dropped loot: items pop out of the chest and land on the ground ---------- */
  let DR = [], lastT = 0, forceTok = false; const RAR = ['#9ca3af', '#4ade80', '#60a5fa', '#c084fc', '#fbbf24'];
  const IT = { med: { n: 'Med Kit', r: 0 }, shield: { n: 'Shield Potion', r: 2 }, slurp: { n: 'Slurp Juice', r: 3 }, ammo: { n: 'Ammo Box', r: 1 }, bucks: { n: 'G-Bucks', r: 4 }, xp: { n: 'XP Orb', r: 1 }, token: { n: 'PRITE TOKEN', r: 4 }, mats: { n: 'Materials', r: 1 }, ammo1: { n: 'Ammo', r: 1 } };
  const rarOf = d => d.k === 'weapon' ? d.r : IT[d.k].r;
  const dname = d => d.k === 'weapon' ? `${RN[d.r]} ${WD[d.w].n} (${CHART[d.r][d.w]})` : d.k === 'ammo1' ? `${d.amt} ${d.t} ammo` : d.k === 'bucks' || d.k === 'xp' ? `${IT[d.k].n} +${d.amt}` : d.amt > 1 ? `${IT[d.k].n} x${d.amt}` : IT[d.k].n;
  function label(txt, col) {
    const c = document.createElement('canvas'); c.width = 400; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = 'rgba(6,15,36,.85)'; x.fillRect(0, 8, 400, 40); x.fillStyle = col; x.fillRect(0, 44, 400, 4); x.fillStyle = '#fff'; x.font = 'bold 23px sans-serif'; x.textAlign = 'center'; x.fillText(txt, 200, 37);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, sizeAttenuation: false })); s.scale.set(.19, .03, 1); return s;   // fixed on-screen size, like a UI tag
  }
  function itemMesh(d) {
    const g = new THREE.Group(), col = RAR[rarOf(d)], mat = (c, e) => new THREE.MeshStandardMaterial({ color: c, roughness: .4, metalness: .2, emissive: e || '#000' }), add = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    const im = d.k !== 'weapon' && GG() && GasGuns.item ? GasGuns.item(d.k === 'ammo1' ? 'a_' + d.t : d.k) : null;
    if (d.k === 'weapon') { const gm = gunModel(d.w, d.r, { noFlash: true }); if (gm.userData.v2) { gm.scale.setScalar(1.25); gm.position.set(0, -.06, -gm.userData.cz * 1.25); } else { gm.scale.setScalar(1.3); gm.position.z = -.6; } g.add(gm); }
    else if (im) { im.scale.setScalar(d.k === 'ammo' ? 1.9 : 2.1); im.position.y = -.2; g.add(im); }
    else if (d.k === 'med') { add(new THREE.BoxGeometry(.5, .34, .36), mat('#f1f5f9')); add(new THREE.BoxGeometry(.28, .02, .08), mat('#dc2626'), 0, .18, 0); add(new THREE.BoxGeometry(.08, .02, .28), mat('#dc2626'), 0, .18, 0); }
    else if (d.k === 'shield') { add(new THREE.SphereGeometry(.22, 16, 12), mat('#38bdf8', '#0369a1'), 0, -.04, 0); add(new THREE.CylinderGeometry(.06, .08, .16, 10), mat('#e2e8f0'), 0, .22, 0); }
    else if (d.k === 'slurp') { add(new THREE.CylinderGeometry(.14, .14, .46, 14), mat('#22d3ee', '#0e7490')); add(new THREE.CylinderGeometry(.15, .15, .08, 14), mat('#a3e635'), 0, .27, 0); }
    else if (d.k === 'ammo') { add(new THREE.BoxGeometry(.42, .26, .3), mat('#a16207')); add(new THREE.BoxGeometry(.3, .04, .22), mat('#facc15'), 0, .15, 0); }
    else if (d.k === 'bucks') add(new THREE.CylinderGeometry(.24, .24, .06, 20), mat('#fbbf24', '#a16207')).rotation.x = Math.PI / 2;
    else if (d.k === 'mats') [0, 1, 2].forEach(k => add(new THREE.BoxGeometry(.55, .08, .17), mat(['#b45309', '#a8a29e', '#94a3b8'][k]), 0, (k - 1) * .09, (k - 1) * .06));
    else if (d.k === 'ammo1') { const ac = { light: '#94a3b8', medium: '#65a30d', shells: '#dc2626', heavy: '#2563eb', rockets: '#f97316' }[d.t] || '#a16207'; add(new THREE.BoxGeometry(.36, .22, .26), mat(ac)); add(new THREE.BoxGeometry(.38, .05, .28), mat('#facc15'), 0, .12, 0); }
    else if (d.k === 'token') { const a = add(new THREE.TorusGeometry(.32, .07, 12, 28), mat('#fbbf24', '#b45309')); a.userData.tk = 1; add(new THREE.OctahedronGeometry(.24), mat('#e879f9', '#a21caf')); add(new THREE.SphereGeometry(.12, 12, 10), mat('#67e8f9', '#0891b2')); g.scale.setScalar(1.5); }
    else add(new THREE.OctahedronGeometry(.22), mat('#4ade80', '#15803d'));
    add(new THREE.CylinderGeometry(.1, .1, 3, 8, 1, true), new THREE.MeshBasicMaterial({ color: d.k === 'token' ? '#f0abfc' : col, transparent: true, opacity: .35, depthWrite: false }), 0, 1.4, 0);
    const lb = label(dname(d), col); lb.position.y = .95; g.add(lb); g.userData.lb = lb; return g;
  }
  const GS = (x, z, y) => window.GasWorld && GasWorld.active ? GasWorld.surface(x, z, y) : GY(x, z);   // ground or floor under a point (house floors count)
  function spawnDrop(c, k, amt, i, n, ex) {
    const cy = c.y != null ? c.y : GY(c.x, c.z), d = Object.assign({ k, amt, x: c.x, y: cy + .8, z: c.z, landed: false, ph: Math.random() * 6 }, ex), a = c.g.rotation.y + (i - (n - 1) / 2) * .75 + (Math.random() - .5) * .3, sp = (c.house ? 1.6 : 3) + Math.random() * 1.5;
    d.house = c.house || null; d.floor = c.floor || 0; d.vx = Math.sin(a) * sp; d.vz = Math.cos(a) * sp; d.vy = (c.house ? 5 : 7) + Math.random() * 2; d.g = itemMesh(d); d.g.position.set(d.x, d.y, d.z); matchGroup.add(d.g); DR.push(d);
  }
  function spawnLoose(x, z, ex, y) { const gy = y != null ? GS(x, z, y + .5) : GY(x, z), d = Object.assign({ k: 'weapon', amt: 1, x, y: gy + .45, gy, z, landed: true, ph: Math.random() * 6, vx: 0, vy: 0, vz: 0 }, ex); d.g = itemMesh(d); d.g.position.set(x, gy + .45, z); matchGroup.add(d.g); DR.push(d); }
  // floor guns: mostly low rarity; about half have a small pack of their ammo lying next to them
  function spawnFloorWeapon(x, z, ex, y) {
    const r = rollRar('floor'), w = rollWeapon(r), t = WD[w].t; spawnLoose(x, z, Object.assign({ w, r }, ex), y);
    if (Math.random() < .5) spawnLoose(x + .75, z + .35, Object.assign({}, ex, { k: 'ammo1', t, amt: ammoPack(t, .6) }), y);
  }
  function openChest(c, q) {
    c.open = true; c.glow.visible = false; const builds = !!(window.GasBuild && GasBuild.enabled);
    if (c.ammo) { spawnDrop(c, 'ammo', 1, 0, builds ? 2 : 1); if (builds) spawnDrop(c, 'mats', 30, 1, 2); if (!q) showToast('🟩 Ammo box opened'); return; }
    if (c.supply) {
      const ws = [rollRar('supply'), rollRar('supply')].map(r => ({ w: rollWeapon(r), r })), t = WD[ws[0].w].t;
      ws.forEach((x, i) => spawnDrop(c, 'weapon', 1, i, 6, x)); spawnDrop(c, 'ammo1', ammoPack(t, 2), 2, 6, { t });
      spawnDrop(c, 'slurp', 2, 3, 6); spawnDrop(c, 'shield', 2, 4, 6); spawnDrop(c, builds ? 'mats' : 'ammo', builds ? 100 : 1, 5, 6); if (!q) showToast('🪂 Supply drop opened — epic loot!'); return;
    }
    const n = c.gold ? 4 : 3, m = c.gold ? 2 : 1, pool = ['med', 'shield', 'slurp', 'bucks', 'xp', 'med', 'ammo'], r = rollRar(c.gold ? 'gold' : 'chest'), w = rollWeapon(r), t = WD[w].t, tot = n + 1 + (builds ? 1 : 0);
    spawnDrop(c, 'weapon', 1, 0, tot, { w, r });
    spawnDrop(c, 'ammo1', ammoPack(t, c.gold ? 1.5 : 1), 1, tot, { t });                                   // a few rounds for the gun it dropped
    for (let i = 1; i < n; i++) { const k = pool[Math.floor(Math.random() * pool.length)]; spawnDrop(c, k, k === 'bucks' ? (20 + Math.floor(Math.random() * 40)) * m : k === 'xp' ? 10 * m : k === 'ammo' ? 1 : m, i + 1, tot); }
    if (builds) spawnDrop(c, 'mats', 30 * m, n + 1, tot);
    if ((forceTok && !q) || Math.random() < 1 / 500000) { forceTok = false; spawnDrop(c, 'token', 1, n, n + 1); if (!q) showToast('✨ A PRITE TOKEN dropped — 1 in 500,000! Grab it!'); }
    else if (!q) showToast(`${c.gold ? '🏆 Golden ' : '📦 '}Chest opened — grab the loot!`);
  }
  function pickup(d) {
    if (d.k === 'token') {
      const ids = k => COSMETIC_DB[k].map(x => x.id); state.ownedOutfits = ids('outfit'); state.ownedPickaxes = ids('pickaxe'); state.ownedBling = ids('bling'); state.ownedGliders = ids('glider'); state.ownedEmotes = ids('emote'); state.ownedWraps = ids('wrap');
      saveState(); if (typeof updateLobbyUI === 'function') updateLobbyUI(); matchGroup.remove(d.g); DR.splice(DR.indexOf(d), 1);
      feed('<b class="y">✨ PRITE TOKEN</b> — every cosmetic unlocked!'); showToast('✨ PRITE TOKEN! Every cosmetic is now unlocked — check your Locker!'); return;
    }
    if (d.k === 'weapon') {
      let s = HB.findIndex(x => !x); if (s < 0) { s = sel >= 1 ? sel - 1 : 0; dropSlot(s); }   // full: swap with the selected slot
      HB[s] = { k: 'weapon', w: d.w, r: d.r, mag: d.mag != null ? Math.min(d.mag, WD[d.w].mg) : WD[d.w].mg }; matchGroup.remove(d.g);   // loaded, but no spare ammo comes with it DR.splice(DR.indexOf(d), 1); feed(`Picked up <b class="y">${dname(d)}</b>`); select(s + 1); updateBRHud(); return;
    }
    if (d.k === 'ammo') { AM.light += 18 * d.amt; AM.medium += 14 * d.amt; AM.shells += 4 * d.amt; AM.heavy += 2 * d.amt; AM.rockets += Math.random() < .3 ? d.amt : 0; }   // ammo boxes are smaller now else if (d.k === 'ammo1') AM[d.t] = (AM[d.t] || 0) + d.amt; else if (d.k === 'mats') { if (window.GasBuild) GasBuild.addMats(d.amt); } else if (d.k === 'bucks') awardGBucks(d.amt, 'Chest Loot'); else if (d.k === 'xp') awardXpFromMatch(d.amt, 'Chest XP');
    else if (ITEMS[d.k]) { let left = addItem(d.k, d.amt); if (left === d.amt) { const s = sel >= 1 ? sel - 1 : 0; dropSlot(s); left = addItem(d.k, d.amt); } if (left > 0) { d.amt = left; d.g.remove(d.g.children.find(c => c.isSprite)); const lb = label(dname(d), RAR[rarOf(d)]); lb.position.y = .95; d.g.add(lb); d.g.userData.lb = lb; feed(`Inventory full — ${left} left on the ground`); buildHot(); return; } }
    matchGroup.remove(d.g); DR.splice(DR.indexOf(d), 1); feed(`Picked up <b class="y">${dname(d)}</b>`); buildHot(); updateBRHud();
  }
  function nearest(list, p, max) { let b = null, bd = max; list.forEach(o => { const oy = o.gy != null ? o.gy : o.y; if (oy != null && Math.abs(oy - p.position.y) > 1.8) return; const d = Math.hypot(o.x - p.position.x, o.z - p.position.z); if (d < bd) { bd = d; b = o; } }); return b; }
  function lootNear(x, z, r, b) {
    let best = null, bd = r;
    CH.forEach(c => { if (c.open || c.falling || (b && b.ban && b.ban.has(c))) return; const d = Math.hypot(c.x - x, c.z - z) + (c.floor ? 6 + (b ? 14 * c.floor : 0) : 0); if (d < bd) { bd = d; best = { x: c.x, y: c.y, z: c.z, ref: c, t: 'chest', house: c.house, floor: c.floor }; } });
    DR.forEach(d => { if (!d.landed || (b && b.ban && b.ban.has(d))) return; const w = d.k === 'weapon' ? wantSlot(b, d.w, d.r) >= 0 : (d.k === 'med' && (b.hp < 90 || b.med < 2)) || (d.k === 'shield' && (b.sh < 90 || b.shd < 2)) || (d.k === 'ammo' && b.wp && b.ammo < 60) || (d.k === 'ammo1' && b.wp && b.ammo < 60 && (b.wps || []).some(x => WD[x.w].t === d.t)); /* bots stock up on heals and the ammo their guns use */ if (!w) return; const dd = Math.hypot(d.x - x, d.z - z); if (dd < bd) { bd = dd; best = { x: d.x, y: d.gy, z: d.z, ref: d, t: 'drop', house: d.house, floor: d.floor }; } });
    return best;
  }
  const BOT_RES = { light: 60, medium: 45, shells: 12, heavy: 6, rockets: 2 };   // spare rounds a bot finds with a gun (it used to be five magazines)
  // bots carry up to two guns: one shotgun + one other (or two non-shotguns); this picks the slot a new gun would fill (-1 = not an upgrade)
  function wantSlot(b, w, r) {
    const wps = b.wps || [], sh = WD[w].t === 'shells', same = wps.findIndex(x => (WD[x.w].t === 'shells') === sh);
    if (same < 0) { if (wps.length < 2) return wps.length; const lo = wps.reduce((a, x, i) => x.r < wps[a].r ? i : a, 0); return r > wps[lo].r ? lo : -1; }
    return r > wps[same].r ? same : -1;
  }
  function botEquip(b, i) {
    if (!b.wps || !b.wps[i]) return;
    if (b.wp && b.wpi != null && b.wps[b.wpi]) { b.wps[b.wpi].mag = b.mag; b.wps[b.wpi].ammo = b.ammo; }
    const x = b.wps[i], gl = b.mesh.userData.joints.leftArm.glove; b.wpi = i; b.wp = { w: x.w, r: x.r }; b.mag = x.mag; b.ammo = x.ammo; b.rel = 0;
    if (b.hand && b.hand.parent) b.hand.parent.remove(b.hand); b.hand = holdIn(gl, x.w, x.r);
  }
  function botTake(b, L) {
    if (L.t === 'chest') { if (!L.ref.open) openChest(L.ref, true); return; }
    const d = L.ref; if (!DR.includes(d)) return;
    if (d.k === 'weapon') { b.wps = b.wps || []; const s = wantSlot(b, d.w, d.r); if (s < 0) return; if (b.wps[s]) spawnLoose(b.p.x + 1.2, b.p.z, { w: b.wps[s].w, r: b.wps[s].r, mag: b.wpi === s ? b.mag : b.wps[s].mag }, b.p.y); if (b.wpi === s) b.wp = null; b.wps[s] = { w: d.w, r: d.r, mag: d.mag != null ? d.mag : WD[d.w].mg, ammo: BOT_RES[WD[d.w].t] }; botEquip(b, s); }
    else if (d.k === 'med') b.med++; else if (d.k === 'shield') b.shd++; else if (d.k === 'ammo') b.ammo += 24;
    else if (d.k === 'ammo1') { if (b.wp && WD[b.wp.w].t === d.t) b.ammo += d.amt; else { const o = (b.wps || []).find(x => WD[x.w].t === d.t); if (o) o.ammo += d.amt; } }
    matchGroup.remove(d.g); DR.splice(DR.indexOf(d), 1);
  }
  function interact() {
    const p = brState.player; if (!p) return; const d = nearest(DR.filter(x => x.landed), p, 3.2); if (d) return pickup(d);
    const c = nearest(CH.filter(h => !h.open && !h.falling), p, 3.4); if (c) return openChest(c);
    const W = window.GasWorld; if (W && W.active && W.doorNear) { const dr = W.doorNear(p.position.x, p.position.z, p.position.y); if (dr) W.toggleDoor(dr); }   // doors open / close
  }
  /* ---------- maps ---------- */
  function draw(cv, range, cx, cz, full) {
    const x = cv.getContext('2d'), w = cv.width, k = w / (2 * range), p = brState.player; if (!p) return;
    if (window.GasWorld && GasWorld.active) return GasWorld.drawMap(cv, range, cx, cz, full, { tm: MATES.filter(b => !b.dead).map(b => b.p) });
    const sx = v => (v - cx) * k + w / 2, sz = v => (v - cz) * k + w / 2;
    x.clearRect(0, 0, w, w); x.save(); x.beginPath(); x.rect(0, 0, w, w); x.clip();
    x.fillStyle = '#0369a1'; x.fillRect(0, 0, w, w);
    x.fillStyle = brState.isPlayTown ? '#3b82f6' : '#3f9a47'; x.beginPath(); x.arc(sx(0), sz(0), 95 * k, 0, 7); x.fill(); x.strokeStyle = '#e8d9a0'; x.lineWidth = 3; x.stroke();
    S.forEach(s => { x.save(); x.translate(sx(s.x), sz(s.z)); x.rotate(-s.r); x.fillStyle = '#b45309'; x.fillRect(-s.w * k / 2, -s.d * k / 2, s.w * k, s.d * k); x.restore(); });
    T.forEach(t => { x.fillStyle = '#22c55e'; x.beginPath(); x.arc(sx(t.mesh.position.x), sz(t.mesh.position.z), full ? 5 : 3.5, 0, 7); x.fill(); });
    const px = sx(p.position.x), pz = sz(p.position.z), yaw = p.rotation.y; x.translate(px, pz); x.rotate(Math.PI - yaw);
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -9); x.lineTo(6, 7); x.lineTo(0, 3); x.lineTo(-6, 7); x.closePath(); x.fill(); x.stroke(); x.restore();
    if (full) { x.fillStyle = '#fff'; x.font = 'bold 13px sans-serif'; x.fillText('N ↑', w - 44, 20); }
  }

  /* ---------- hooks called by the engine ---------- */
  function onStart() {
    if (window.GasWorld) GasWorld.start();
    const hud = $('br-hud');
    if (!ready) {
      ready = true;
      const st = document.createElement('style');
      st.textContent = `
      #gp-prompt{position:absolute;bottom:34%;left:50%;transform:translateX(-50%);background:rgba(6,15,36,.9);border:2px solid #fbbf24;padding:8px 18px;border-radius:6px;font-weight:900;display:none}
      #gp-map{position:absolute;inset:0;display:grid;place-items:center;background:rgba(2,8,23,.78)}#gp-map.hidden{display:none}#gp-map canvas{width:min(86vh,90vw);height:min(86vh,90vw);border:3px solid #fff;border-radius:8px}#gp-map div{position:absolute;bottom:18px;font-weight:700}
      .gp-row{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:6px 0;border-bottom:1px solid #fff2}.gp-row button,#gp-reset{background:#1e3a8a;color:#fff;border:1px solid #60a5fa;padding:7px 14px;border-radius:4px;font-weight:800;cursor:pointer;min-width:150px}.gp-row button.cap{background:#ca8a04;color:#000}#gp-reset{margin-top:14px}.gp-panel{max-width:560px;margin:90px auto 0;padding:20px;background:rgba(6,15,36,.88);border-radius:8px}
      #gp-inv{position:fixed;inset:0;display:grid;place-items:center;background:rgba(2,8,23,.6);z-index:45;color:#fff;font-family:inherit}#gp-inv.hidden{display:none}
      .inv{background:linear-gradient(180deg,#16274f,#0b1530);border:2px solid #38bdf8;border-radius:12px;padding:18px 22px;width:min(940px,94vw);box-shadow:0 12px 40px #000b}
      .inv-h{display:flex;justify-content:space-between;align-items:baseline;gap:16px;margin-bottom:12px}.inv-h b{font-size:26px;letter-spacing:1px}.inv-h span{font-size:12px;color:#93c5fd;text-align:right}
      .inv-slots{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
      .inv-s{position:relative;height:178px;border:2px solid rgba(255,255,255,.25);border-radius:8px;background:linear-gradient(160deg,var(--c) 0%,rgba(6,15,36,.92) 78%);padding:8px;cursor:grab;display:flex;flex-direction:column;align-items:center;text-align:center;user-select:none}
      .inv-s.sel{border-color:#facc15;box-shadow:0 0 14px #facc15aa}.inv-s.empty{opacity:.5}.inv-s:hover{border-color:#fff}
      .inv-k{position:absolute;left:7px;top:5px;font-size:11px;font-weight:900}.inv-ic{font-size:46px;margin-top:14px;line-height:1.1}.inv-n{font-weight:900;font-size:13px;margin-top:6px}.inv-sub{font-size:11px;color:#cbd5e1;margin-top:3px}
      .inv-s button{margin-top:auto;background:#ef4444;color:#fff;border:0;border-radius:4px;padding:4px 14px;font-weight:900;font-size:11px;cursor:pointer}
      .inv-da{background:#ef4444;color:#fff;border:0;border-radius:3px;padding:1px 6px;font-size:10px;font-weight:900;cursor:pointer;margin-left:4px}.inv-b{display:flex;gap:26px;margin-top:14px;flex-wrap:wrap}.inv-b h4{margin:0 0 6px;font-size:12px;color:#93c5fd;letter-spacing:1px}.inv-am{display:inline-block;background:rgba(255,255,255,.09);border-radius:4px;padding:3px 8px;margin:0 6px 6px 0;font-size:12px;text-transform:capitalize}`;
      document.head.appendChild(st);
      $('hud-tr').insertAdjacentHTML('afterbegin', '<div id="gp-mm"><canvas id="gp-mm-c" width="200" height="200"></canvas><div id="gp-mm-l">N</div></div>'); hud.insertAdjacentHTML('beforeend', '<div id="gp-prompt"></div><div id="gp-map" class="hidden"><canvas id="gp-map-c" width="720" height="720"></canvas><div>FULL MAP • ▲ you • <span style="color:#22c55e">●</span> teammates • <span style="color:#c084fc">purple ring</span> = storm • white ring = next safe zone • press the map key to close</div></div>');
    }
    DR = []; S = []; CH = [];
    if (window.GasWorld && GasWorld.active) {
      // loot lives inside the houses: a chest or ammo box on most floors, plus outdoor chests and ammo boxes
      GasWorld.HOUSES.forEach(h => { if (h.spawn) return; h.spots.forEach(s => { const r = Math.random(); if (r < .6) CH.push(makeChest(s.x, s.z, s.gold || Math.random() < .08, { y: s.y, rot: s.rot, house: h, floor: s.floor })); else if (r < .72) CH.push(makeChest(s.x, s.z, false, { y: s.y, rot: s.rot, house: h, floor: s.floor, ammo: true })); }); });
      for (let i = 0; i < 45; i++) { const q = GasWorld.spot(.35); CH.push(makeChest(q.x, q.z, i % 8 === 0)); }
      for (let i = 0; i < 16; i++) { const q = GasWorld.spot(.4); CH.push(makeChest(q.x, q.z, false, { ammo: true })); }   // ammo crates are scarce
    }
    else { matchGroup.children.forEach(m => { if (m.isMesh && m.geometry.type === 'BoxGeometry') S.push({ x: m.position.x, z: m.position.z, w: m.geometry.parameters.width, d: m.geometry.parameters.depth, r: m.rotation.y }); });
      for (let i = 0; i < 14; i++) { let x, z, n = 0; do { const a = Math.random() * 6.28, r = 12 + Math.random() * 74; x = Math.cos(a) * r; z = Math.sin(a) * r; n++; } while (n < 30 && S.some(s => Math.hypot(s.x - x, s.z - z) < 5)); CH.push(makeChest(x, z, i % 5 === 0)); } }
    mapOpen = false; $('gp-map').classList.add('hidden'); zoom = 0; hint();
    HB = [null, null, null, null, null]; useT = null; if (invOpen) toggleInv(false); AM = { light: 0, medium: 0, shells: 0, heavy: 0, rockets: 0 }; sel = 0; rel = null; burst = 0; RK = []; EX = []; hand = null; brState.weapon = 0; t0 = performance.now(); $('hud-feed').innerHTML = '';
    T = []; // teammates are real AI players now (world.js puts bots on your team in Duos / Trios / Squads)
    if (window.GasWorld && GasWorld.active) {
      for (let i = 0; i < 110; i++) { const q = GasWorld.spot(.5); spawnFloorWeapon(q.x, q.z); }
      GasWorld.HOUSES.forEach(h => { if (h.spawn || Math.random() > .5) return; const f = Math.floor(Math.random() * h.floors); spawnFloorWeapon(h.cx + (Math.random() - .5) * 1.5, h.cz + (Math.random() - .5) * 1.5, { house: h, floor: f }, h.fy + f * h.fh); });
    } else {
    for (const q of [[6, 4], [-6, 5], [4, -7]]) spawnFloorWeapon(q[0], q[1]);
    for (let i = 0; i < 18; i++) { let x, z, n = 0; do { const a = Math.random() * 6.28, r = 10 + Math.random() * 78; x = Math.cos(a) * r; z = Math.sin(a) * r; n++; } while (n < 30 && S.some(s => Math.hypot(s.x - x, s.z - z) < 4)); spawnFloorWeapon(x, z); } }
    buildHot(); teamPanel(); feed('<b class="y">Match started</b> — find chests for loot!');
    // render every gun / heal / ammo icon in the background while the bus flies (a few per frame)
    if (GG()) { if (!iconHook) { iconHook = true; GasGuns.onIcon(() => { if (uiState.inMatch) buildHot(); }); } GasGuns.warm([...CHART.flatMap((row, r) => Object.keys(row).map(k => ['gun', k, r])), ...['med', 'shield', 'slurp', 'ammo', 'a_light', 'a_medium', 'a_shells', 'a_heavy', 'a_rockets'].map(k => ['item', k, 0])]); }
  }
  let iconHook = false;
  function onExit() { if (window.GasBuild) GasBuild.clear(); if (window.GasWorld) GasWorld.stop(); for (const a in held) held[a] = false; mapOpen = false; const m = $('gp-map'); if (m) m.classList.add('hidden'); CH = []; S = []; T = []; DR = []; RK = []; EX = []; mdown = false; hand = null; }
  function onFrame(time) {
    const p = brState.player; if (!p) return;
    if (!(window.GasWorld && GasWorld.active)) {
    let vy = p.userData.vy || 0; if (held.jump && p.position.y <= 0) vy = .21; p.position.y += vy; vy -= .012; if (p.position.y <= 0) { p.position.y = 0; vy = 0; } p.userData.vy = vy;
    if (held.sprint && brState.keys.KeyW) { p.position.x += Math.sin(p.rotation.y) * .12; p.position.z += Math.cos(p.rotation.y) * .12; }
    const d = Math.hypot(p.position.x, p.position.z); if (d > 92) { p.position.x *= 92 / d; p.position.z *= 92 / d; }
    }
    const dt = Math.min(.05, Math.max(0, time - lastT)); lastT = time; const nowT = nowS();
    if (rel && nowT >= rel.until) { const w = HB[rel.slot], d = w && w.k === 'weapon' && WD[w.w]; if (d && w === rel.w) { const take = Math.min(d.mg - w.mag, AM[d.t]); w.mag += take; AM[d.t] -= take; } rel = null; buildHot(); }
    if (useT && nowT >= useT.until) finishUse();
    const pud = p.userData; pud.reloadP = rel ? Math.min(1, Math.max(0, 1 - (rel.until - nowT) / (rel.dur || 1))) : 0; pud.usingP = !!useT;
    if (burst > 0 && nowT >= burstT) { const w = selWeapon(); if (w && !rel) { shootOnce(w); burst--; burstT = nowT + .09; } else burst = 0; }
    if (mdown && selWeapon() && !brState.isPlayTown && !invOpen) fireInput(false);
    updateRK();
    DR.slice().forEach(d => {
      if (!d.landed) {
        d.vy -= 22 * dt; const nx = d.x + d.vx * dt, nzz = d.z + d.vz * dt, ny = d.y + d.vy * dt;
        if (window.GasWorld && GasWorld.active && GasWorld.segHit(d.x, d.y, d.z, nx, ny, nzz)) { d.vx = d.vz = 0; if (d.vy > 0) d.vy = 0; } else { d.x = nx; d.z = nzz; }
        d.y = ny; d.g.rotation.y += dt * 8; const gy = GS(d.x, d.z, d.y); if (d.y <= gy + .35) { d.y = gy + .35; if (d.vy < -3) { d.vy = -d.vy * .4; d.vx *= .5; d.vz *= .5; } else { d.landed = true; d.gy = gy; d.vx = d.vz = d.vy = 0; } } d.g.position.set(d.x, d.y, d.z);
      }
      const lb = d.g.userData.lb; if (lb) lb.visible = Math.hypot(d.x - p.position.x, d.z - p.position.z) < 16 && camera.position.distanceTo(d.g.position) > 2.5;   // name tags only near you, never filling the screen
      if (d.landed) { d.g.rotation.y += dt * (d.k === 'token' ? 4 : 1.5); d.g.position.y = (d.gy != null ? d.gy : GY(d.x, d.z)) + .45 + Math.sin(time * 2 + d.ph) * .1; if (d.k === 'ammo' || d.k === 'bucks' || d.k === 'xp' || d.k === 'mats' || d.k === 'ammo1') { const dd = Math.hypot(d.x - p.position.x, d.z - p.position.z); if (d.ownDrop) { if (dd > 3) d.ownDrop = false; } else if (dd < 1.5 && Math.abs((d.gy || 0) - p.position.y) < 1.6) pickup(d); } }   // your own drops wait until you walk away
    });
    CH.forEach(h => {
      if (h.falling) { h.g.position.y = Math.max(h.landY, h.g.position.y - 7 * dt); h.g.rotation.y += dt * .5; if (h.g.position.y <= h.landY) { h.falling = false; h.y = h.landY; if (h.balloon) { h.g.remove(h.balloon); h.balloon = null; } } }
      const vis = h.supply || (Math.abs(h.x - p.position.x) < 160 && Math.abs(h.z - p.position.z) < 160); if (h.g.visible !== vis) h.g.visible = vis; if (!vis) return;
      h.lid.rotation.x += ((h.open ? -1.2 : 0) - h.lid.rotation.x) * .15; if (!h.open) h.glow.material.opacity = .18 + Math.sin(time * 3 + h.x) * .06;
    });
    teamBars();
    const nd = nearest(DR.filter(x => x.landed), p, 3.2), nc = nd ? null : nearest(CH.filter(h => !h.open && !h.falling), p, 3.4), pr = $('gp-prompt');
    const ndr = !nd && !nc && window.GasWorld && GasWorld.active && GasWorld.doorNear ? GasWorld.doorNear(p.position.x, p.position.z, p.position.y) : null;
    pr.style.display = nd || nc || ndr ? 'block' : 'none';
    const ph = nd ? `[${nice(KB.interact)}] Pick up ${nd.k === 'weapon' ? gunIcon(nd.w, nd.r) : ITEMS[nd.k] ? itemIcon(nd.k, '') : ''}${dname(nd)}` : nc ? `[${nice(KB.interact)}] Open ${nc.gold ? 'Golden ' : ''}Chest` : ndr ? `[${nice(KB.interact)}] ${ndr.open ? 'Close' : 'Open'} Door` : '';
    if (pr._h !== ph) { pr._h = ph; pr.innerHTML = ph; }
    T.forEach((t, i) => { const ps = window.GasWorld && GasWorld.active ? GasWorld.pst() : 'ground'; if (ps === 'bus' || ps === 'fall' || ps === 'glide') { t.mesh.visible = false; t.mesh.position.set(p.position.x, p.position.y, p.position.z); return; } t.mesh.visible = true; const tx = p.position.x + Math.cos(t.a + time * .15) * 4, tz = p.position.z + Math.sin(t.a + time * .15) * 4, dx = tx - t.mesh.position.x, dz = tz - t.mesh.position.z, dd = Math.hypot(dx, dz), mv = dd > 1; if (mv) { const s = Math.min(dd, dd > 8 ? .45 : .22); t.mesh.position.x += dx / dd * s; t.mesh.position.z += dz / dd * s; t.mesh.rotation.y = Math.atan2(dx, dz); } t.mesh.position.y = Math.max(0, GY(t.mesh.position.x, t.mesh.position.z)); CharacterRigBuilder.applyHeroStance(t.mesh, time + i, mv ? 'run' : 'idle'); });
    compass(); $('br-hp-num').textContent = Math.round(brState.hp); $('br-shield-num').textContent = Math.round(brState.shield); $('br-alive').textContent = brState.bots.length + (window.GasWorld && GasWorld.active && GasWorld.PL.dead ? 0 : 1);
    const e0 = $('tm0s'); if (e0) { e0.style.width = brState.shield + '%'; $('tm0h').style.width = brState.hp + '%'; }
    draw($('gp-mm-c'), (window.GasWorld && GasWorld.active ? [80, 150, 320] : [45, 80, 110])[zoom], p.position.x, p.position.z, false);
    if (mapOpen) draw($('gp-map-c'), window.GasWorld && GasWorld.active ? GasWorld.WR : 105, 0, 0, true);
  }
  renderKB();
  const weaponZoom = () => { const w = selWeapon(); return w && WD[w.w].zm || .72; };   // aim-down-sights FOV factor (scopes zoom further)
  return { onStart, onExit, onFrame, onFire, feed, renderKB, weaponName, weaponZoom, lootNear, botTake, held, WD, CHART, gunModel, dropWeapon: (x, z, w, r, y, mag) => spawnLoose(x, z, { w, r, mag }, y),
    dropAmmo: (x, z, t, n, y) => { const amt = Math.min(AMMO_CAP[t] || 10, Math.round(n * .5)); if (amt > 0) spawnLoose(x, z, { k: 'ammo1', t, amt }, y); },   // half of an eliminated player's spares
    supplyDrop, makeChest, botEquip, wantSlot, keyName: a => nice(KB[a]), _dbg: () => ({ CH, DR, MATES, HB, AM, addItem, toggleInv, select, buildHot }), forceToken: () => { forceTok = true; return 'next chest drops the Prite Token'; } };
})();
