// ===== GASNITE ACCOUNTS =====
// In the Games section of the GasFireGames site, GASNITE uses your GasFireGames account: the same sign-in, the same friends
// and online list, and your progress is saved on the site's server (lib/gasnite.js), so it follows you to any device.
// The sign-in box only pops up there. Anywhere else (the game opened as a file, another host) there's no login at all:
// you just play, and progress is saved on that device.
// Load this BEFORE game_engine.js (game_engine reads window.GAS_SAVE_KEY and calls GasAccounts.onSave).
window.GasAccounts = (() => {
  const store = s => ({ get: k => { try { return s().getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { s().setItem(k, v); } catch (e) { } }, del: k => { try { s().removeItem(k); } catch (e) { } } });
  const ls = store(() => localStorage), ss = store(() => sessionStorage);
  const LEGACY = 'gasnite_save_v4', HTTP = /^https?:$/.test(location.protocol);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const jget = (k, d) => { try { const v = JSON.parse(ls.get(k)); return v == null ? d : v; } catch (e) { return d; } };
  const score = s => s && typeof s === 'object' ? (+s.level || 1) * 1e5 + (+s.xp || 0) : -1;     // "more progress" when two saves disagree
  const toast = m => { if (typeof showToast === 'function') showToast(m); };
  const inMatch = () => typeof uiState !== 'undefined' && !!uiState.inMatch;
  const outfitOf = id => { const L = typeof COSMETIC_DB !== 'undefined' ? COSMETIC_DB.outfit : []; return (id && L.find(o => o.id === id)) || L[9] || L[0] || null; };
  let embedded = false; try { embedded = window.top !== window && !!window.top.location.href; } catch (e) { }   // inside the site's Games tab

  // ================================ GasFireGames account (site mode) ================================
  const TOK = 'cmb_tok';                                       // the site's login token (index.html keeps it here)
  const tokUser = t => { try { const p = JSON.parse(atob(String(t).split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); return p && typeof p.u === 'string' && (!p.e || p.e > Date.now()) ? p.u : null; } catch (e) { return null; } };
  let tok = HTTP ? ls.get(TOK) || '' : '';
  const sUid = tok ? tokUser(tok) : null, SITE = !!sUid;
  const CACHE = 'gasnite_gfg_me::' + sUid, META = 'gasnite_sync::gfg:' + sUid;
  let ME = SITE ? jget(CACHE, null) : null;                    // last answer from the server (friends, requests, party)
  let meta = SITE ? jget(META, { at: 0, dirty: false }) : null; // at = cloud version this device holds, dirty = not uploaded yet
  let modOK = true, reloading = false, onSite = SITE;          // modOK = false: the site has no lib/gasnite.js yet · onSite: this page is on GasFireGames
  const saveMeta = () => ls.set(META, JSON.stringify(meta));
  async function api(body, opt) {
    opt = opt || {}; const ac = typeof AbortController !== 'undefined' ? new AbortController() : null, to = setTimeout(() => ac && ac.abort(), opt.timeout || 9000);
    try {
      const r = await fetch('/api', { method: 'POST', keepalive: !!opt.keepalive, signal: ac ? ac.signal : undefined, headers: Object.assign({ 'content-type': 'application/json' }, opt.noAuth ? {} : { authorization: 'Bearer ' + tok }), body: JSON.stringify(body) });
      let j = null; try { j = await r.json(); } catch (e) { }
      if (!j || typeof j !== 'object') throw Object.assign(new Error('The game server did not answer'), { status: r.status, net: true });
      if (!r.ok) throw Object.assign(new Error(j.error || 'Request failed'), { status: r.status, body: j });
      return j;
    } catch (e) {
      if (e && e.name === 'AbortError') throw Object.assign(new Error('The game server took too long to answer'), { net: true });
      if (e instanceof TypeError) throw Object.assign(new Error('No connection to the game server'), { net: true });
      throw e;
    } finally { clearTimeout(to); }
  }
  if (SITE) {
    window.GAS_SAVE_KEY = LEGACY + '::gfg:' + sUid;
    if (!ls.get(GAS_SAVE_KEY) && !ls.get('gasnite_migrated')) {   // the first GasFireGames account on this device keeps older progress
      let best = null, bs = -1;
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k !== LEGACY && !(k.startsWith(LEGACY + '::') && !k.includes('::gfg:') && !k.endsWith('::__guest'))) continue; const sc = score(jget(k, null)); if (sc > bs) { bs = sc; best = k; } } } catch (e) { }
      if (best) { ls.set(GAS_SAVE_KEY, ls.get(best)); meta.dirty = true; saveMeta(); }
      ls.set('gasnite_migrated', '1');
    }
  } else {
    // no account: progress is saved on this device (an older browser-only GASNITE account keeps its save)
    const old = ls.get('gasnite_session');
    window.GAS_SAVE_KEY = old && ls.get(LEGACY + '::' + old) ? LEGACY + '::' + old : LEGACY;
  }
  const siteName = () => (ME && ME.uid === sUid && ME.name) || sUid;

  // ---- cloud save: upload after saves (debounced), download when another device has newer progress
  let pushT = 0, pushing = false, again = false, pulledRaw = null;
  const card = s => ({ outfit: s.equipped && s.equipped.outfit, level: s.level, wins: s.wins, kills: s.kills });
  function onSave() {
    if (pulledRaw) { ls.set(GAS_SAVE_KEY, pulledRaw); return; }  // reloading into a downloaded save: don't let the old one overwrite it
    if (!SITE || !modOK || reloading) return; meta.dirty = true; saveMeta(); clearTimeout(pushT); pushT = setTimeout(() => push(), 3000);
  }
  async function push(force, keepalive) {
    if (!SITE || !modOK || reloading) return; if (pushing) { again = true; return; }
    let st = null; try { st = JSON.parse(ls.get(GAS_SAVE_KEY)); } catch (e) { } if (!st) return;
    pushing = true; meta.dirty = false; saveMeta(); let clash = 0;   // a save during the upload marks it dirty again
    try { const j = await api({ op: 'gnsave', state: st, base: force ? null : meta.at, profile: card(st) }, { keepalive: !!keepalive }); meta.at = j.at; saveMeta(); }
    catch (e) {
      meta.dirty = true; saveMeta();
      if (e.status === 409 && e.body) clash = +e.body.at || 1;    // another device saved first
      if (e.status === 401) { ls.del(TOK); tok = ''; }
    }
    pushing = false;
    if (clash) return reconcile(clash, false).catch(() => { });
    if (again) { again = false; push(); }
  }
  async function reconcile(cloudAt, startup) {
    meta = jget(META, meta);                                     // another tab may have synced already
    if (cloudAt > meta.at) {                                     // the cloud has a version this device hasn't seen
      if (!startup && inMatch()) return;                         // sort it out after the match
      const c = await api({ op: 'gnload' }), local = jget(GAS_SAVE_KEY, null);
      if (c.save && (!meta.dirty || !local || score(c.save) >= score(local))) return pull(c, startup);
      return push(true);                                         // this device has more progress: keep it
    }
    if (meta.dirty || (!cloudAt && ls.get(GAS_SAVE_KEY))) return push();
  }
  function pull(c, startup) {
    pulledRaw = JSON.stringify(c.save); ls.set(GAS_SAVE_KEY, pulledRaw); meta = { at: c.at, dirty: false }; saveMeta(); ss.set('gasnite_synced', sUid);
    reloading = true; if (!startup) toast('Loading your newer progress from another device…');
    overlay('Loading your progress…'); setTimeout(() => location.reload(), startup ? 100 : 1500);
  }
  async function refreshMe(startup) {
    let j;
    try { j = await api({ op: 'gnme' }); modOK = true; }
    catch (e) {
      if (e.status !== 400 || !/bad op/i.test(e.message)) throw e;
      modOK = false; const m = await api({ op: 'me' });          // the site's api/index.js doesn't have the GASNITE module yet
      j = { uid: m.uid, name: m.name, at: 0, me: {}, friends: [], in: [], out: [], party: [] };
    }
    ME = j; ls.set(CACHE, JSON.stringify(j));
    if (j.name && typeof state !== 'undefined' && state.username !== j.name) { state.username = j.name; const t = document.getElementById('lobby-player-tag'); if (t) t.textContent = j.name; }
    refreshTopBar(); if (friendsOpen()) drawFriends();
    if (modOK) await reconcile(+j.at || 0, startup);
  }
  function beat() {                                             // played in its own tab: keep you "online" on the site
    if (embedded || document.hidden || !ME || !modOK || !tok) return; const m = ME.me || {};
    api({ op: 'set', path: 'presence/' + sUid, data: { e: m.e || '🐸', c: m.c || '#1fa65a', i: m.i || '', at: 'GASNITE' } }).catch(() => { });
  }
  async function siteBoot() {
    const first = ss.get('gasnite_synced') !== sUid;
    if (first) overlay('Signing in to GasFireGames…');
    const slow = setTimeout(() => { overlay(null); toast('Could not reach GasFireGames: playing offline, your progress uploads later'); }, 8000);
    try { await refreshMe(true); if (!reloading) ss.set('gasnite_synced', sUid); }
    catch (e) {
      if (e.status === 401 || e.status === 403) { clearTimeout(slow); overlay(null); if (e.status === 401) { ls.del(TOK); tok = ''; } siteLogin(e.message); return; }
    }
    clearTimeout(slow); if (!reloading) overlay(null);
    beat(); setInterval(beat, 20000);
    setInterval(() => { if (!document.hidden && !reloading) refreshMe(false).catch(() => { }); }, 60000);
    document.addEventListener('visibilitychange', () => { if (reloading) return; if (document.hidden) { if (meta.dirty) push(false, true); } else refreshMe(false).catch(() => { }); });
    addEventListener('pagehide', () => { if (meta.dirty && !reloading) push(false, true); });
  }
  // ---- friends (the site's own friend requests and friend list, so they match the Friends tab)
  const pid = (a, b) => [a, b].sort().join('_');
  async function siteAddFriend(name) {
    name = String(name || '').trim(); if (!name) return ['Type a friend\'s username', 1];
    try {
      const n = await api({ op: 'get', path: 'names/' + name.toLowerCase() }); if (!n.exists) return ['No player called ' + name, 1];
      const t = n.data.uid; if (t === sUid) return ['That\'s you!', 1];
      if ((await api({ op: 'get', path: 'fs/' + pid(sUid, t) })).exists) return ['You are already friends', 1];
      if ((await api({ op: 'get', path: 'fr/' + t + '_' + sUid })).exists) { await siteAccept(t); return ['You are now friends with ' + name + '!']; }
      const p = await api({ op: 'get', path: 'profiles/' + t }), pd = p.data || {}, m = (ME && ME.me) || {};
      await api({ op: 'set', path: 'fr/' + sUid + '_' + t, data: { from: sUid, to: t, fromName: siteName(), toName: pd.name || name, e: m.e || '🐸', c: m.c || '#1fa65a', i: m.i || '', t: Date.now() } });
      return ['Request sent to ' + (pd.name || name) + '. It shows on their Friends tab too.'];
    } catch (e) { return [e.message || 'Could not send the request', 1]; }
  }
  const delReq = (a, b) => api({ op: 'delete', path: 'fr/' + a + '_' + b }).catch(() => { });
  async function siteAccept(from) { const [x, y] = [sUid, from].sort(); try { await api({ op: 'set', path: 'fs/' + pid(sUid, from), data: { a: x, b: y, t: Date.now() } }); } catch (e) { } await delReq(from, sUid); await delReq(sUid, from); }
  function sitePartyMembers() {
    if (!ME) return []; const fr = ME.friends || [];
    return (ME.party || []).map(u => fr.find(f => f.uid === u)).filter(Boolean).map(f => ({ u: f.uid, name: f.name, level: f.level || 1, wins: f.wins || 0, kills: f.kills || 0, online: f.online, outfit: outfitOf(f.outfit) }));
  }
  async function siteToggleParty(u) {
    const cur = (ME && ME.party) || [], on = cur.includes(u);
    if (!on && cur.length >= 3) return 'Your party is full (4 players)';
    try { const j = await api({ op: 'gnparty', list: on ? cur.filter(x => x !== u) : cur.concat([u]) }); ME.party = j.party; ls.set(CACHE, JSON.stringify(ME)); }
    catch (e) { return e.message; }
  }
  const partyMembers = () => SITE ? sitePartyMembers() : [];
  function logout() {
    if (!SITE || embedded) return;                               // inside the Games tab you log out from the site's sidebar
    reloading = true; api({ op: 'delete', path: 'presence/' + sUid }, { keepalive: true }).catch(() => { }).finally(() => { ls.del(TOK); ss.del('gasnite_synced'); location.reload(); });
  }

  // ================================ UI ================================
  function css() {
    if (document.getElementById('ga-css')) return; const st = document.createElement('style'); st.id = 'ga-css';
    st.textContent = `#ga-login,#ga-sync{position:fixed;inset:0;z-index:200;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#1e3a8a,#050b1c 70%);font-family:inherit;color:#fff}#ga-sync{z-index:210}
      .ga-card{position:relative;width:min(400px,92vw);background:rgba(10,20,46,.92);border:2px solid #38bdf8;border-radius:14px;padding:26px 28px;box-shadow:0 20px 60px #000c;text-align:center;box-sizing:border-box}
      .ga-logo{font-size:42px;font-weight:900;letter-spacing:3px;font-style:italic;color:#fde047;text-shadow:0 3px 0 #b45309,0 6px 18px #000}.ga-sub{color:#cbd5e1;font-size:14px;margin-top:6px}.ga-sub b{color:#4ade80}
      .ga-tabs{display:flex;gap:6px;margin:16px 0 14px}.ga-tabs button{flex:1;padding:9px;border:0;border-radius:6px;background:#1e293b;color:#cbd5e1;font-weight:900;cursor:pointer}.ga-tabs button.on{background:#38bdf8;color:#04122c}
      .ga-card input[type=text],.ga-card input[type=password]{width:100%;box-sizing:border-box;margin:6px 0;padding:11px 12px;border-radius:6px;border:1px solid #60a5fa;background:#0b1530;color:#fff;font-size:15px}
      .ga-go{width:100%;margin-top:8px;padding:13px;border:0;border-radius:7px;background:#fbbf24;color:#000;font-weight:900;font-size:17px;cursor:pointer}.ga-go:disabled{opacity:.6;cursor:wait}
      .ga-skip{margin-top:10px;background:none;border:0;color:#93c5fd;font-weight:700;font-size:13px;cursor:pointer;text-decoration:underline}
      .ga-err{color:#fca5a5;font-size:13px;min-height:18px;margin-top:6px}.ga-note{font-size:11px;color:#94a3b8;margin-top:12px;line-height:1.5}
      .ga-spin{width:34px;height:34px;border:4px solid #38bdf855;border-top-color:#fde047;border-radius:50%;margin:18px auto 12px;animation:gaspin .8s linear infinite}@keyframes gaspin{to{transform:rotate(360deg)}}
      #ga-friends{position:fixed;inset:0;z-index:120;display:none;place-items:center;background:rgba(2,8,23,.7);color:#fff}#ga-friends.on{display:grid}
      .gf{width:min(580px,94vw);max-height:86vh;overflow:auto;background:linear-gradient(180deg,#16274f,#0b1530);border:2px solid #38bdf8;border-radius:12px;padding:18px 20px;box-sizing:border-box}
      .gf h2{margin:0 0 4px}.gf h4{margin:16px 0 6px;color:#93c5fd;font-size:12px;letter-spacing:1px;display:flex;align-items:center;gap:8px}.gf-me{display:flex;justify-content:space-between;align-items:center;gap:10px;color:#cbd5e1;font-size:13px}
      .gf-add{display:flex;gap:6px}.gf-add input{flex:1;min-width:0;padding:9px 10px;border-radius:6px;border:1px solid #60a5fa;background:#0b1530;color:#fff}
      .gf button{padding:7px 12px;border:0;border-radius:5px;font-weight:900;cursor:pointer;background:#38bdf8;color:#04122c}.gf button.red{background:#ef4444;color:#fff}.gf button.grey{background:#334155;color:#fff}.gf button.sm{padding:3px 8px;font-size:11px}.gf button:disabled{opacity:.5;cursor:wait}
      .gf-f{display:flex;align-items:center;gap:10px;padding:8px;border-radius:7px;background:rgba(255,255,255,.06);margin-bottom:6px}.gf-av{position:relative;flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-weight:900;border:2px solid #fff;font-size:17px}
      .gf-dot{position:absolute;right:-3px;bottom:-3px;width:12px;height:12px;border-radius:50%;border:2px solid #0b1530;background:#64748b}.gf-dot.on{background:#22c55e}
      .gf-f .nm{flex:1;min-width:0}.gf-f small{color:#94a3b8;display:block}.gf-f small i{color:#4ade80;font-style:normal}.gf-msg{color:#fca5a5;font-size:12px;min-height:16px;margin-top:4px}.gf-msg.ok{color:#86efac}.gf-x{float:right;background:#334155!important;color:#fff!important}
      .gf p{color:#cbd5e1;line-height:1.55;font-size:14px}.gf p b{color:#4ade80}`;
    document.head.appendChild(st);
  }
  function overlay(text) {
    let el = document.getElementById('ga-sync'); if (!text) { if (el) el.remove(); return; }
    css(); if (!el) { el = document.createElement('div'); el.id = 'ga-sync'; document.body.appendChild(el); }
    el.innerHTML = `<div class="ga-card"><div class="ga-logo">GASNITE</div><div class="ga-spin"></div><div>${esc(text)}</div></div>`;
  }
  // the GasFireGames sign-in box (pops up by itself only in the site's Games section)
  function siteLogin(msg) {
    css(); let el = document.getElementById('ga-login'); if (!el) { el = document.createElement('div'); el.id = 'ga-login'; document.body.appendChild(el); }
    let mode = 'in';
    const draw = () => {
      el.innerHTML = `<div class="ga-card"><div class="ga-logo">GASNITE</div><div class="ga-sub">Sign in with your <b>GasFireGames</b> account</div>
        <div class="ga-tabs"><button data-m="in" class="${mode === 'in' ? 'on' : ''}">SIGN IN</button><button data-m="up" class="${mode === 'up' ? 'on' : ''}">CREATE ACCOUNT</button></div>
        <input type="text" id="ga-u" placeholder="Username" maxlength="16" autocomplete="username"><input type="password" id="ga-p" placeholder="Password" autocomplete="${mode === 'in' ? 'current-password' : 'new-password'}">
        ${mode === 'up' ? '<input type="password" id="ga-p2" placeholder="Repeat password" autocomplete="new-password">' : ''}
        <button class="ga-go" id="ga-go">${mode === 'in' ? 'SIGN IN' : 'CREATE ACCOUNT & PLAY'}</button><div class="ga-err" id="ga-e">${esc(msg || '')}</div>
        <button class="ga-skip" id="ga-skip">Play without signing in</button>
        <div class="ga-note">One account for the whole site: your GASNITE progress is saved online, and your GasFireGames friends show up in GASNITE.<br>Don't reuse a password from another site.</div></div>`;
      el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; msg = ''; draw(); });
      el.querySelector('#ga-skip').onclick = () => el.remove();
      const go = async () => {
        const u = el.querySelector('#ga-u').value.trim(), p = el.querySelector('#ga-p').value, e = el.querySelector('#ga-e'), btn = el.querySelector('#ga-go');
        if (mode === 'up' && p !== el.querySelector('#ga-p2').value) { e.textContent = 'Passwords don\'t match'; return; }
        if (mode === 'up' && !/^[A-Za-z0-9_]{3,16}$/.test(u)) { e.textContent = 'Username: 3–16 letters, numbers or _'; return; }
        if (mode === 'up' && p.length < 6) { e.textContent = 'Password must be 6+ characters'; return; }
        e.textContent = mode === 'in' ? 'Signing in…' : 'Creating your account…'; btn.disabled = true;
        try {
          const j = await api({ op: mode === 'in' ? 'login' : 'register', name: u, pw: p }, { noAuth: true });
          ls.set(TOK, j.token); const id = tokUser(j.token); if (id && mode === 'up') ls.set('gasnite_gfg_me::' + id, JSON.stringify({ uid: id, name: u }));
          location.reload();
        } catch (er) { e.textContent = /reserved/i.test(er.message) ? 'That username is reserved: create it on the main GasFireGames page' : er.message; btn.disabled = false; }
      };
      el.querySelector('#ga-go').onclick = go; el.querySelectorAll('input').forEach(i => i.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') go(); });
      setTimeout(() => { const i = el.querySelector('#ga-u'); if (i) i.focus(); }, 50);
    };
    draw();
  }
  const friendsOpen = () => { const el = document.getElementById('ga-friends'); return !!el && el.classList.contains('on'); };
  function panel() { css(); let el = document.getElementById('ga-friends'); if (!el) { el = document.createElement('div'); el.id = 'ga-friends'; document.body.appendChild(el); el.onclick = e => { if (e.target === el) el.classList.remove('on'); }; } el.classList.add('on'); return el; }
  function openFriends() {
    if (!SITE) {
      if (onSite) { siteLogin(); return; }                       // on the site but not signed in: offer the sign-in box
      const el = panel();                                        // not on the site: explain where friends live
      el.innerHTML = `<div class="gf"><button class="gf-x grey" data-close>✕</button><h2>👥 FRIENDS</h2><p>Friends, parties and online saves work when you play GASNITE in the <b>Games</b> section of GasFireGames. It signs you in with your site account automatically.</p><p>Right now you're playing without an account, so your progress is saved on this device.</p></div>`;
      el.querySelector('[data-close]').onclick = () => el.classList.remove('on'); return;
    }
    if (!tok) { siteLogin(); return; }
    panel(); drawFriends(); refreshMe(false).catch(e => drawFriends(e.message, 0));
  }
  const avatar = p => {
    const img = /^[0-9a-f]{32}/.test(p.i || '') ? p.i.slice(0, 32) : '', bg = img ? `url(/api?op=img&id=${img}) center/cover` : (/^#[0-9a-f]{3,8}$/i.test(p.c || '') ? p.c : '#1fa65a');
    return `<div class="gf-av" style="background:${bg}">${img ? '' : esc(p.e || String(p.name || '?')[0].toUpperCase())}${p.online !== undefined ? `<span class="gf-dot ${p.online ? 'on' : ''}"></span>` : ''}</div>`;
  };
  const row = (p, info, btns) => `<div class="gf-f">${avatar(p)}<div class="nm"><b>${esc(p.name)}</b><small>${info}</small></div>${btns || ''}</div>`;
  function drawFriends(msg, ok) {
    const el = document.getElementById('ga-friends'); if (!el || !SITE) return;
    const j = ME || { friends: [], in: [], out: [], party: [] }, party = sitePartyMembers(), inParty = u => (j.party || []).includes(u);
    const fr = (j.friends || []).slice().sort((a, b) => (b.online - a.online) || String(a.name).localeCompare(String(b.name)));
    const where = f => f.online ? `<i>Online${f.at ? ' · in ' + esc(f.at) : ''}</i>` : 'Offline';
    const gstat = f => f.level ? `Level ${f.level} · ${f.wins} wins${f.outfit ? ' · ' + esc(outfitOf(f.outfit).name) : ''}` : 'hasn\'t played GASNITE yet';
    const mine = Object.assign({ name: siteName(), online: true }, j.me || {}), myCard = typeof state !== 'undefined' ? state : {};
    el.innerHTML = `<div class="gf"><button class="gf-x grey" data-close>✕</button><h2>👥 FRIENDS</h2>
      <div class="gf-me"><span>Signed in as <b>${esc(siteName())}</b> · GasFireGames account${modOK ? '' : ' · <b style="color:#fca5a5">cloud saves need the site update (lib/gasnite.js)</b>'}</span>${embedded ? '' : '<button class="red" data-logout>LOG OUT</button>'}</div>
      <h4>ADD FRIEND</h4><div class="gf-add"><input id="gf-in" placeholder="Their GasFireGames username" maxlength="16" autocomplete="off"><button data-add>SEND REQUEST</button></div><div class="gf-msg ${ok ? 'ok' : ''}" id="gf-msg">${msg ? esc(msg) : ''}</div>
      ${j.in.length ? `<h4>FRIEND REQUESTS (${j.in.length})</h4>` + j.in.map(r => row(r, 'wants to be friends', `<button data-acc="${esc(r.uid)}">ACCEPT</button><button class="grey" data-dec="${esc(r.uid)}">DECLINE</button>`)).join('') : ''}
      ${j.out.length ? `<h4>SENT REQUESTS (${j.out.length})</h4>` + j.out.map(r => row(r, 'waiting for them to accept', `<button class="grey" data-cancel="${esc(r.uid)}">CANCEL</button>`)).join('') : ''}
      <h4>PARTY (${1 + party.length} / 4) · party friends play as your teammates in Duos / Trios / Squads</h4>
      ${row(mine, `Level ${myCard.level || 1} · ${myCard.wins || 0} wins · you`, '<small style="color:#fde047">LEADER</small>')}${party.map(p => { const f = fr.find(x => x.uid === p.u) || {}; return row(f, gstat(f), `<button class="grey" data-party="${esc(p.u)}">KICK</button>`); }).join('')}
      <h4>FRIENDS (${fr.length}) <button class="grey sm" data-refresh title="Refresh">↻</button></h4>${fr.length ? fr.map(f => row(f, `${where(f)} · ${gstat(f)}`, `<button data-party="${esc(f.uid)}" class="${inParty(f.uid) ? 'grey' : ''}">${inParty(f.uid) ? 'IN PARTY ✓' : 'INVITE'}</button><button class="red" data-rem="${esc(f.uid)}" title="Remove friend">✕</button>`)).join('') : '<div class="gf-msg" style="color:#94a3b8">No friends yet: add someone by their GasFireGames username. Friends you add on the site\'s Friends tab show up here too.</div>'}</div>`;
    const on = (sel, fn) => el.querySelectorAll(sel).forEach(b => b.onclick = async () => { el.querySelectorAll('.gf button').forEach(x => { if (!x.matches('[data-close]')) x.disabled = true; }); try { await fn(b); } finally { el.querySelectorAll('.gf button').forEach(x => x.disabled = false); } });
    const again = async (m, good) => { try { await refreshMe(false); } catch (e) { m = m || e.message; } drawFriends(m, good); };
    on('[data-close]', () => el.classList.remove('on')); on('[data-logout]', () => logout()); on('[data-refresh]', () => again());
    on('[data-add]', async () => { const r = await siteAddFriend(el.querySelector('#gf-in').value); await again(r[0], !r[1]); });
    on('[data-acc]', async b => { await siteAccept(b.dataset.acc); await again('You are now friends!', 1); });
    on('[data-dec]', async b => { await delReq(b.dataset.dec, sUid); await again(); });
    on('[data-cancel]', async b => { await delReq(sUid, b.dataset.cancel); await again(); });
    on('[data-rem]', async b => { const f = fr.find(x => x.uid === b.dataset.rem); if (!confirm('Remove ' + (f ? f.name : b.dataset.rem) + ' from your friends?')) return; try { await api({ op: 'delete', path: 'fs/' + pid(sUid, b.dataset.rem) }); } catch (e) { } if (inParty(b.dataset.rem)) await siteToggleParty(b.dataset.rem); await again(); partyChanged(); });
    on('[data-party]', async b => { const err = await siteToggleParty(b.dataset.party); drawFriends(err); partyChanged(); });
    const inp = el.querySelector('#gf-in'); if (inp) inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') el.querySelector('[data-add]').click(); };
  }
  function partyChanged() { refreshTopBar(); if (typeof rebuildStageCharacter === 'function') rebuildStageCharacter(); }
  function refreshTopBar() {
    const pill = document.querySelector('.party-pill'); if (!pill) return;
    const n = SITE ? 1 + partyMembers().length : 1, rq = SITE ? ((ME && ME.in) || []).length : 0, online = SITE && ME ? (ME.friends || []).filter(f => f.online).length : 0;
    pill.innerHTML = `<span class="party-icon">👥</span><span>${n} / 4${online ? ` · <b style="color:#4ade80">${online} online</b>` : ''}${rq ? ` · <b style="color:#fde047">${rq} request${rq > 1 ? 's' : ''}</b>` : ''}${!SITE && onSite ? ' · <b style="color:#93c5fd">Sign in</b>' : ''}</span>`;
    pill.title = SITE ? 'Friends & party' : onSite ? 'Sign in with your GasFireGames account' : 'Friends'; pill.style.cursor = 'pointer'; pill.onclick = openFriends;
  }
  async function probeSite() {      // no GasFireGames login yet: is this page on the site? (its /api answers with a JSON error)
    try { await api({ op: 'me' }, { noAuth: true, timeout: 5000 }); return true; } catch (e) { return !e.net && [401, 403, 500].includes(e.status); }
  }
  window.addEventListener('DOMContentLoaded', async () => {
    refreshTopBar();
    if (SITE) return siteBoot();
    if (HTTP) { onSite = await probeSite(); refreshTopBar(); if (onSite && embedded) siteLogin(); }   // the sign-in box only pops up in the site's Games section
  });
  return { get me() { return SITE ? sUid : null; }, get display() { return SITE ? siteName() : null; }, get mode() { return SITE ? 'site' : 'guest'; }, partyMembers, openFriends, logout, refreshTopBar, onSave };
})();
