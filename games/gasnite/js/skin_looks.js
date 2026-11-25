// ==================== SKIN LOOKS: per-outfit appearance recipes ====================
// Every outfit is turned into a full "look" that the hero rig (character_rig.js) builds:
// body type, head type, hairstyle, headwear, top / bottom / shoes / gloves, accessories, prints
// and colours. Older outfits get their look derived from their palette + archetype (with a
// stable per-skin variation), the original Gasnite skins (#101+) have hand-made looks below.
// Style names are read too: "Shadow", "Gold", "Arctic", "Crimson", "Neon", "No Hat"... all change the build.

const SkinLooks = (() => {
  // ---------- tiny helpers ----------
  const hash = s => { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const pick = (arr, seed, salt) => arr[hash(seed + '|' + salt) % arr.length];
  const chance = (p, seed, salt) => (hash(seed + '#' + salt) % 1000) / 1000 < p;
  const rgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const shade = (a, t) => t < 0 ? mix(a, '#000000', -t) : mix(a, '#ffffff', t);
  const lum = a => { const [r, g, b] = rgb(a); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  function hueShift(a, deg) {
    let [r, g, b] = rgb(a).map(v => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    h = (h + deg / 360 + 1) % 1; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return s === 0 ? a : hex(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255);
  }

  // Outfits presented with a feminine build/face (everything else uses the standard build).
  const FEM = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27, 28, 31, 33, 34, 35, 36, 37, 38, 40, 43, 44, 46, 47, 50, 51, 54, 55, 57, 60, 62, 63, 65, 66, 67, 68, 69, 70, 71, 74, 75, 76, 77, 79, 80, 81, 82, 83, 85, 87, 88, 90, 91, 94, 100]);
  const EYES = ['#5b3a1e', '#3b2414', '#2563eb', '#15803d', '#0e7490', '#6b7280', '#7c3aed', '#92400e', '#3b2414', '#5b3a1e'];
  const GRAPHICS = ['star', 'bolt', 'heart', 'smile', 'diamond', 'flame', 'note', 'number', 'wave', 'eye', 'skullz', 'circle'];
  const LIPS = ['#c0405a', '#b4536a', '#d9536f', '#9f3a4a', '#c2185b'];
  const FLAT_HAIR = ['short', 'buzz', 'long', 'ponytail', 'braids', 'bob', 'slick', 'locs'];   // styles that fit under hats

  // ---------- derived looks for the original 100 outfits ----------
  function derive(o) {
    const id = o.id, num = o.num, [skin, hair, top, pants, acc] = o.palette, A = o.archetype, fem = FEM.has(num);
    const P = (arr, salt) => pick(arr, id, salt), H = (p, salt) => chance(p, id, salt);
    const darkTop = lum(top) < .25;
    const L = {
      body: fem ? 'slim' : (H(.2, 'mus') ? 'muscle' : 'std'), fem, head: 'human',
      hair: 'short', bangs: 'none', hat: 'none', top: 'tee', bottom: 'pants', shoes: 'boots', gloves: 'none', legwear: null,
      graphic: null, tPat: null, bPat: null, extras: [], tail: null, rarity: o.rarity,
      face: {
        style: fem ? 'soft' : 'hero', brow: fem ? 'arched' : P(['soft', 'soft', 'fierce', 'thick'], 'brow'), mouth: P(['smile', 'smirk', 'smile', 'neutral', 'grin'], 'mouth'),
        lashes: fem, lips: fem ? P(LIPS, 'lip') : null, blush: fem && H(.55, 'blush'), freckles: H(.14, 'frk'),
        beard: !fem && H(.24, 'beard') ? P(['stubble', 'stubble', 'goatee', 'full'], 'bt') : null, paint: null, mask: null, glow: null
      },
      c: {
        skin, hair, hair2: null, eyes: P(EYES, 'eye'), top, top2: P(['#f8fafc', '#111827', shade(top, darkTop ? .35 : -.35)], 't2'), trim: acc,
        bottom: pants, shoe: '#1f2937', sole: '#e5e7eb', glove: '#1f2937', hat: acc, sock: '#f1f5f9', metal: acc, sleeve: null, fur2: null
      }
    };
    L.hair = fem ? P(['long', 'ponytail', 'bob', 'bun', 'highpony', 'braids', 'curly', 'long', 'ponytail', 'spacebuns', 'puffs', 'twintails', 'long'], 'hair')
      : P(['short', 'quiff', 'spiky', 'buzz', 'undercut', 'curly', 'short', 'afro', 'locs', 'slick', 'quiff', 'mohawk', 'spiky'], 'hair');
    L.bangs = fem ? P(['side', 'straight', 'parted', 'none', 'side', 'parted'], 'bang') : P(['none', 'none', 'side', 'spiky', 'none'], 'bang');
    if (H(.18, 'tips')) L.c.hair2 = P([acc, '#f8fafc', '#facc15', '#f472b6', '#38bdf8'], 'h2');
    const flatHair = () => { if (!FLAT_HAIR.includes(L.hair)) L.hair = fem ? P(['long', 'ponytail', 'bob', 'braids'], 'fh') : P(['short', 'buzz', 'slick'], 'fh'); };
    const tee = () => P(['tee', 'tee', 'jacket', 'hoodie', 'jersey', fem ? 'jacket' : 'tank', 'sweater'], 'top');

    switch (A) {
      case 'hero_suit':
        Object.assign(L, { top: 'suit', bottom: 'tights', shoes: 'tallboots', gloves: 'gloves', graphic: 'emblem' });
        L.c.glove = acc; L.c.shoe = shade(acc, -.15); L.extras.push('belt');
        if (H(.45, 'dm')) L.face.mask = 'domino';
        if (H(.5, 'cape') || o.rarity === 'legendary') L.extras.push('cape');
        if (!fem) L.body = H(.5, 'hb') ? 'muscle' : 'std';
        break;
      case 'casual':
        L.top = tee(); L.bottom = fem ? P(['jeans', 'skirt', 'shorts', 'pants', 'joggers', 'skirt'], 'bot') : P(['jeans', 'pants', 'joggers', 'shorts', 'cargo'], 'bot');
        L.shoes = P(['sneakers', 'sneakers', 'boots'], 'shoe');
        if (['tee', 'crop', 'hoodie', 'tank'].includes(L.top) && H(.75, 'gfx')) L.graphic = P(GRAPHICS, 'g');
        if (H(.22, 'tp')) L.tPat = P(['stripes', 'plaid', 'dots', 'checker'], 'tpat');
        if ((L.bottom === 'skirt' || L.bottom === 'shorts') && fem) L.legwear = P([null, 'socks', 'thighhighs', 'stockings'], 'leg');
        L.extras.push(...P([[], [], ['necklace'], ['glasses'], ['neckphones'], ['scarf'], ['wristbands']], 'ex'));
        if (L.shoes === 'sneakers') { L.c.shoe = P(['#f8fafc', acc, '#111827'], 'sc'); }
        break;
      case 'visor':
        L.hat = P(['visor', 'cap', 'visor'], 'hat'); L.top = P(['jersey', 'tee', 'jersey'], 'top'); L.bottom = fem && H(.5, 'sk') ? 'skirt' : 'shorts';
        L.shoes = 'sneakers'; L.c.shoe = '#f8fafc'; L.legwear = 'socks'; L.c.sock = '#f8fafc';
        if (H(.35, 'gl')) L.extras.push('glasses'); L.extras.push('wristbands');
        if (L.hat === 'cap') flatHair();
        break;
      case 'ninja':
        Object.assign(L, { hat: 'ninja', top: 'gi', bottom: 'hakama', shoes: 'boots', gloves: 'wraps' });
        L.face.mask = 'ninja'; L.extras.push('sash'); if (H(.5, 'sc')) L.extras.push('scarf');
        L.hair = fem && H(.6, 'np') ? 'ponytail' : 'none'; L.bangs = 'none'; L.c.shoe = '#111827'; L.c.hat = top;
        break;
      case 'tactical':
        Object.assign(L, { top: 'vest', bottom: 'cargo', shoes: 'boots', gloves: 'fingerless' });
        L.sleeves = P(['short', 'long'], 'slv');
        L.hat = P(['none', 'headband', 'beret', 'cap', 'goggles', 'none'], 'hat'); if (L.hat !== 'none' && L.hat !== 'goggles') flatHair();
        L.extras.push('pouches'); if (H(.6, 'hol')) L.extras.push('holster'); if (H(.4, 'kp')) L.extras.push('kneepads');
        if (H(.3, 'camo')) L.bPat = 'camo';
        L.c.top2 = shade(top, -.25); L.c.hat = P([acc, shade(top, -.3), '#111827'], 'hc');
        break;
      case 'hood':
        Object.assign(L, { top: 'hoodie', hat: 'hood', bottom: P(['joggers', 'jeans', 'pants'], 'bot'), shoes: 'sneakers' });
        if (H(.5, 'gfx')) L.graphic = P(GRAPHICS, 'g');
        L.hair = fem ? P(['long', 'bob', 'long'], 'hh') : 'short'; L.bangs = fem ? P(['side', 'straight', 'parted'], 'hb') : P(['side', 'none'], 'hb');
        L.c.hat = top; L.c.shoe = P(['#f8fafc', '#111827', acc], 'sc');
        break;
      case 'cat_cowl':
        Object.assign(L, { hat: 'cowl', top: 'suit', bottom: 'tights', shoes: 'tallboots', gloves: 'gloves' });
        L.face.mask = 'cowl'; L.extras.push('belt'); L.c.hat = shade(top, -.1); L.c.glove = shade(top, -.2); L.c.shoe = shade(top, -.2);
        L.hair = fem && H(.55, 'cl') ? 'long' : 'none'; L.bangs = 'none';
        break;
      case 'cap':
        L.hat = P(['cap', 'cap', 'backcap'], 'hat'); flatHair(); L.top = P(['tee', 'jacket', 'hoodie', 'vest', 'jersey'], 'top');
        L.bottom = P(['jeans', 'cargo', 'shorts', 'pants'], 'bot'); L.shoes = P(['sneakers', 'boots'], 'shoe');
        if (L.top === 'tee' || L.top === 'hoodie') L.graphic = P(GRAPHICS, 'g');
        if (L.shoes === 'sneakers') L.c.shoe = P(['#f8fafc', acc], 'sc');
        if (fem && L.bottom === 'shorts') L.legwear = P([null, 'socks'], 'leg');
        break;
      case 'trench':
        Object.assign(L, { top: 'coat', bottom: 'pants', shoes: 'boots', gloves: 'gloves' });
        if (H(.6, 'sc')) L.extras.push('scarf'); if (H(.3, 'br')) { L.hat = 'beret'; flatHair(); }
        break;
      case 'helmet':
        Object.assign(L, { hat: 'helmet', top: P(['suit', 'jacket', 'suit'], 'top'), bottom: 'pants', shoes: 'boots', gloves: 'gloves' });
        L.hair = 'none'; L.tPat = L.top === 'suit' ? 'racing' : null; L.c.glove = '#111827'; L.c.hat = acc;
        break;
      case 'mask':
        L.face.mask = P(['lucha', 'balaclava', 'lucha'], 'mk');
        L.top = L.face.mask === 'lucha' ? P(fem ? ['suit', 'jacket', 'suit'] : ['bare', 'suit', 'jacket'], 'top') : P(['jacket', 'vest', 'suit'], 'top');
        if (L.top === 'bare') L.body = 'muscle';
        L.bottom = P(['pants', 'tights', 'cargo'], 'bot'); L.shoes = 'tallboots'; L.gloves = 'gloves';
        if (L.face.mask === 'balaclava') { L.hair = 'none'; L.bangs = 'none'; } else { L.hair = 'none'; L.extras.push('wristbands'); }
        L.c.glove = shade(top, -.25); L.c.shoe = shade(pants, -.2);
        break;
      case 'santa_hat':
        Object.assign(L, { hat: 'santa', top: 'sweater', bottom: fem && H(.5, 'sk') ? 'skirt' : 'pants', shoes: 'boots' });
        flatHair(); L.extras.push('scarf'); L.tPat = 'knit'; if (L.bottom === 'skirt') L.legwear = 'stockings';
        L.c.hat = '#dc2626';
        break;
      case 'crown':
        L.hat = fem ? 'tiara' : 'crown'; L.top = fem ? 'dress' : 'armor'; L.bottom = fem ? 'longskirt' : 'pants'; L.shoes = 'boots';
        L.extras.push('cape', 'necklace'); L.c.hat = '#fbbf24'; L.c.metal = '#fbbf24';
        if (!fem) L.gloves = 'gauntlets';
        break;
      case 'fish':
        Object.assign(L, { head: 'fish', top: P(['tee', 'jacket'], 'top'), bottom: 'pants', shoes: 'sneakers' });
        L.hair = 'none'; L.bangs = 'none'; L.c.fur2 = shade(skin, .45); L.c.shoe = '#f8fafc';
        break;
    }
    if (L.hat === 'helmet' || L.head !== 'human') L.face.beard = null;
    if (o.rarity === 'legendary' || o.rarity === 'special') L.glowTrim = true;
    if (L.top === 'jacket' && H(.35, 'slv')) L.c.sleeve = shade(L.c.top, lum(L.c.top) > .5 ? -.25 : .25);
    return L;
  }

  // ---------- original Gasnite skins (hand-made looks) ----------
  const ORIGINAL = {
    101: { // Chompion — bulldog wrestler
      body: 'muscle', head: 'dog', hair: 'none', top: 'bare', bottom: 'trunks', shoes: 'tallboots', gloves: 'wraps', tail: 'stub',
      extras: ['champbelt', 'collar', 'kneepads'], face: { style: 'beast', brow: 'fierce', mouth: 'grin' }, glowTrim: true,
      c: { skin: '#c98d55', fur2: '#f3dfc4', eyes: '#3b2414', bottom: '#dc2626', trim: '#facc15', shoe: '#dc2626', sole: '#f8fafc', metal: '#facc15', glove: '#f8fafc' },
      styles: [{}, { c: { skin: '#6b6f7a', fur2: '#e5e7eb', bottom: '#111827', trim: '#a855f7', shoe: '#111827', metal: '#d4d4d8' } }]
    },
    102: { // Komodo Kai — lizard explorer
      body: 'std', head: 'lizard', hair: 'none', top: 'vest', under: 'bare', bottom: 'cargoshorts', shoes: 'claws', gloves: 'none', tail: 'lizard',
      hat: 'goggles', extras: ['neckerchief', 'pouches'], face: { style: 'beast', brow: 'soft', mouth: 'grin' },
      c: { skin: '#e0602b', fur2: '#f7c75a', eyes: '#facc15', top: '#c8a86a', bottom: '#556b2f', trim: '#14b8a6', hat: '#7c4a1e', metal: '#94a3b8' },
      styles: [{}, { c: { skin: '#3f9d4a', fur2: '#d9f99d', top: '#7c5a3a', bottom: '#1f2937', trim: '#f97316', eyes: '#fb923c' } }]
    },
    103: { // Sunset Spurs — desert ranger
      body: 'slim', fem: true, head: 'human', hair: 'braids', bangs: 'parted', hat: 'cowboy', top: 'poncho', under: 'tee', bottom: 'jeans', shoes: 'cowboyboots', gloves: 'gloves',
      extras: ['neckerchief', 'holster'], face: { style: 'soft', brow: 'arched', mouth: 'smirk', lashes: true, lips: '#a7434f', freckles: true },
      c: { skin: '#b9774c', hair: '#2b1a12', eyes: '#5b3a1e', top: '#c2410c', top2: '#f5e6c8', trim: '#0f766e', bottom: '#3b5b8c', hat: '#8b5a2b', shoe: '#6b3f1d', glove: '#7c4a1e', metal: '#fbbf24' },
      styles: [{}, { c: { top: '#1e3a8a', trim: '#e2e8f0', hat: '#1f2937', bottom: '#111827', shoe: '#111827' } }]
    },
    104: { // Ironhorn — oni warrior
      body: 'std', head: 'human', hair: 'long', bangs: 'spiky', hat: 'horns', top: 'armor', bottom: 'hakama', shoes: 'boots', gloves: 'gauntlets',
      extras: ['pauldrons', 'sash'], glowTrim: true,
      face: { style: 'hero', brow: 'fierce', mouth: 'fangs', glow: '#fbbf24', paint: 'oni' },
      c: { skin: '#d9a77f', hair: '#16131c', hair2: '#dc2626', eyes: '#fbbf24', top: '#9b1c1c', top2: '#1f1a24', trim: '#e0b04a', bottom: '#27232f', hat: '#efe6d2', hat2: '#7f1d1d', shoe: '#1f1a24', metal: '#e0b04a', glove: '#27232f' },
      styles: [{}, { c: { top: '#166534', trim: '#fde68a', hair2: '#22c55e', hat2: '#14532d', eyes: '#86efac', bottom: '#1c2a22' } }]
    },
    105: { // Riot Riff — punk rocker
      body: 'std', head: 'human', hair: 'mohawk', hat: 'none', top: 'leather', under: 'tee', bottom: 'jeans', bPat: 'rips', shoes: 'tallboots', gloves: 'fingerless',
      graphic: 'bolt', extras: ['spikes', 'walletchain', 'wristbands'],
      face: { style: 'hero', brow: 'fierce', mouth: 'smirk', liner: true, piercing: true },
      c: { skin: '#f0c7a5', hair: '#84cc16', hair2: '#facc15', eyes: '#15803d', top: '#17171b', top2: '#dc2626', trim: '#d4d4d8', bottom: '#1f2937', shoe: '#111827', glove: '#111111', metal: '#e5e7eb' },
      styles: [{}, { c: { hair: '#3b82f6', hair2: '#e0f2fe', top: '#2c4a7a', top2: '#f8fafc', bottom: '#111827' } }]
    },
    106: { // Logjam — lumberjack bear
      body: 'bulky', head: 'bear', hair: 'none', hat: 'beanie', top: 'jacket', tPat: 'buffalo', under: 'tee', bottom: 'jeans', shoes: 'boots', gloves: 'none', tail: 'stub',
      extras: ['suspenders'], face: { style: 'beast', brow: 'soft', mouth: 'smile' },
      c: { skin: '#7a4a2a', fur2: '#d9b48a', eyes: '#2b1a12', top: '#b91c1c', top2: '#efe3c8', trim: '#1a1a1a', bottom: '#2f4a73', hat: '#f97316', shoe: '#a16207', sole: '#3b2a1a' },
      styles: [{}, { c: { skin: '#eef2f7', fur2: '#ffffff', eyes: '#1f2937', top: '#1d4ed8', hat: '#e11d48', bottom: '#374151', shoe: '#78350f' } }]
    },
    107: { // Ember Tail — fox ninja
      body: 'slim', fem: true, head: 'fox', hair: 'none', hat: 'none', top: 'gi', bottom: 'hakama', shoes: 'boots', gloves: 'wraps', tail: 'fox',
      extras: ['longscarf', 'sash'], face: { style: 'beast', brow: 'arched', mouth: 'smirk', lashes: true },
      c: { skin: '#e8772a', fur2: '#fff3e6', eyes: '#f59e0b', top: '#23202b', top2: '#e8772a', trim: '#e11d48', bottom: '#15131a', shoe: '#15131a', glove: '#f3f4f6' },
      styles: [{}, { c: { skin: '#f4f6fb', fur2: '#ffffff', eyes: '#38bdf8', trim: '#2563eb', top: '#1e293b' } }]
    },
    108: { // Bubblegum Beat — pop idol
      body: 'slim', fem: true, head: 'human', hair: 'twintails', bangs: 'straight', hat: 'starclips', top: 'stagejacket', under: 'tee', bottom: 'skirt', legwear: 'thighhighs', shoes: 'sneakers', gloves: 'none',
      graphic: 'heart', extras: ['wristbands'], glowTrim: true,
      face: { style: 'anime', brow: 'arched', mouth: 'smile', lashes: true, lips: '#e0567a', blush: true },
      c: { skin: '#f6d3bf', hair: '#f472b6', hair2: '#a78bfa', eyes: '#c026d3', top: '#fbf8ff', top2: '#f472b6', trim: '#facc15', bottom: '#a78bfa', sock: '#ffffff', shoe: '#f472b6', sole: '#ffffff', metal: '#facc15' },
      styles: [{}, { c: { hair: '#60a5fa', hair2: '#1e3a8a', top: '#1c1a2e', top2: '#7c3aed', bottom: '#312e81', sock: '#111827', shoe: '#7c3aed', eyes: '#2563eb', trim: '#22d3ee' } }]
    },
    109: { // Kickflip Kiki — skater
      body: 'slim', fem: true, head: 'human', hair: 'bob', bangs: 'side', hairSplit: true, hat: 'none', top: 'hoodie', bottom: 'shorts', legwear: 'socks', shoes: 'sneakers', bPat: null,
      graphic: 'smile', extras: ['kneepads'], face: { style: 'soft', brow: 'arched', mouth: 'grin', lashes: true, lips: '#9f3a4a', freckles: false },
      c: { skin: '#8d5a3b', hair: '#121212', hair2: '#2dd4bf', eyes: '#3b2414', top: '#eab308', trim: '#ef4444', bottom: '#111827', sock: '#f8fafc', shoe: '#f8fafc', sole: '#ef4444' },
      styles: [{}, { c: { top: '#f97316', hair2: '#f472b6', trim: '#7c3aed', bottom: '#1e3a8a', sole: '#7c3aed' } }]
    },
    110: { // Slopestyle Sam — snowboarder
      body: 'std', head: 'human', hair: 'short', bangs: 'side', hat: 'beanie', top: 'puffer', bottom: 'baggy', shoes: 'boots', gloves: 'mitts',
      extras: ['goggles'], face: { style: 'hero', brow: 'soft', mouth: 'grin', freckles: true },
      c: { skin: '#f2c9a8', hair: '#facc15', eyes: '#2563eb', top: '#f1f5f9', top2: '#2dd4bf', trim: '#f97316', bottom: '#6d28d9', hat: '#2dd4bf', shoe: '#334155', glove: '#f97316', metal: '#f97316' },
      styles: [{}, { c: { top: '#111827', top2: '#a3e635', bottom: '#1f2937', hat: '#a3e635', glove: '#a3e635', trim: '#a3e635' } }]
    },
    111: { // Bassline Blaze — DJ
      body: 'std', head: 'human', hair: 'locs', hat: 'none', top: 'varsity', under: 'tee', bottom: 'joggers', shoes: 'sneakers', gloves: 'none',
      graphic: 'note', extras: ['neckphones', 'shades', 'chain'], face: { style: 'hero', brow: 'thick', mouth: 'smirk', beard: 'goatee' },
      c: { skin: '#5a3a26', hair: '#1a1210', hair2: '#d4a017', eyes: '#3b2414', top: '#6d28d9', sleeve: '#f8fafc', top2: '#111827', trim: '#facc15', bottom: '#15151a', shoe: '#f8fafc', sole: '#facc15', metal: '#facc15' },
      styles: [{}, { c: { top: '#0d9488', sleeve: '#111827', trim: '#f472b6', sole: '#f472b6', metal: '#e5e7eb', top2: '#f472b6' } }]
    },
    112: { // Tinker-9 — scrap robot
      body: 'std', head: 'robot', hair: 'none', hat: 'none', top: 'suit', tPat: 'panels', bottom: 'pants', bPat: 'panels', shoes: 'boots', gloves: 'gloves', tail: null,
      extras: ['belt'], face: { style: 'robot', glow: '#22d3ee' }, robot: true,
      c: { skin: '#cbd5e1', eyes: '#22d3ee', top: '#f97316', top2: '#e2e8f0', trim: '#22d3ee', bottom: '#e2e8f0', shoe: '#475569', glove: '#334155', metal: '#94a3b8' },
      styles: [{}, { c: { skin: '#a1734a', top: '#4d7c0f', top2: '#78716c', bottom: '#57534e', trim: '#facc15', eyes: '#facc15', metal: '#78716c' } }]
    }
  };

  function fromOriginal(o, def) {
    const L = {
      body: 'std', fem: false, head: 'human', hair: 'none', bangs: 'none', hat: 'none', top: 'tee', bottom: 'pants', shoes: 'boots', gloves: 'none', legwear: null,
      graphic: null, tPat: null, bPat: null, extras: [], tail: null, rarity: o.rarity, original: true
    };
    Object.keys(def).forEach(k => { if (k !== 'c' && k !== 'face' && k !== 'styles') L[k] = Array.isArray(def[k]) ? def[k].slice() : def[k]; });
    const [skin, hair, top, pants, acc] = o.palette;
    L.face = Object.assign({ style: 'hero', brow: 'soft', mouth: 'smile', lashes: false, lips: null, blush: false, freckles: false, beard: null, paint: null, mask: null, glow: null }, def.face || {});
    L.c = Object.assign({ skin, hair, hair2: null, eyes: '#3b2414', top, top2: '#f8fafc', trim: acc, bottom: pants, shoe: '#1f2937', sole: '#e5e7eb', glove: '#1f2937', hat: acc, sock: '#f1f5f9', metal: acc, sleeve: null, fur2: null }, def.c || {});
    return L;
  }

  // ---------- style variants ----------
  function applyStyle(L, o, si, def) {
    if (!si) return L;
    if (def && def.styles && def.styles[si]) { const st = def.styles[si]; Object.assign(L.c, st.c || {}); Object.keys(st).forEach(k => { if (k !== 'c') L[k] = st[k]; }); return L; }
    const n = String((o.styles || [])[si] || '').toLowerCase(), c = L.c;
    let hit = false;
    const set = (t, b, a, extra) => { if (t) c.top = t; if (b) c.bottom = b; if (a) { c.trim = a; c.metal = a; if (L.hat !== 'santa') c.hat = a; } if (extra) Object.assign(c, extra); hit = true; };
    if (/no hat|no helmet|unmasked|hood down|no mask|human/.test(n)) { L.hat = 'none'; L.face.mask = null; if (L.hair === 'none') L.hair = L.fem ? 'long' : 'short'; hit = true; }
    if (/\busa\b/.test(n)) set('#1d4ed8', '#dc2626', '#f8fafc');
    else if (/\bcan\b/.test(n)) set('#dc2626', '#f8fafc', '#dc2626');
    else if (/\bgbr\b/.test(n)) set('#1e3a8a', '#f8fafc', '#dc2626');
    else if (/\bger\b/.test(n)) set('#111111', '#dc2626', '#facc15');
    else if (/unreal|prismatic|rainbow|holo/.test(n)) { set('#6d28d9', '#1e1b4b', '#f0abfc'); L.glowTrim = true; }
    else if (/shadow|midnight|noir|onyx|dark|stealth|obsidian|inked|eclipse|black|night|goth|phantom|carbon|covert/.test(n)) set('#1b1c24', '#0e0f14', lum(c.trim) < .35 ? '#a855f7' : null, { top2: '#2a2b36', sleeve: null });
    else if (/gold|golden|champion|solar|midas|trophy|fncs/.test(n)) set('#c99a2e', '#3b2a10', '#fde68a', { metal: '#fbbf24' });
    else if (/arctic|ice|frost|snow|winter|blizzard|frozen|white|glacier|light inversion/.test(n)) set('#e2eef8', '#c3d3e3', '#38bdf8', { top2: '#f8fafc' });
    else if (/crimson|\bred\b|scarlet|rosso|ruby|blood|fire|inferno|santa/.test(n)) set('#b91c1c', '#3f0d0d', '#fca5a5');
    else if (/neon|cyber|electric|plasma|volt|glitch|overdrive|pulse|corrupt|reactive|90s/.test(n)) { set('#101624', '#0b0f1a', '#22d3ee'); L.glowTrim = true; }
    else if (/pink|rose|coral|candy|bubble|princess/.test(n)) set('#ec4899', '#831843', '#fce7f3');
    else if (/blue|ocean|deep|abyss|sea|tidal|reef|dive|indigo/.test(n)) set('#1d4ed8', '#172554', '#38bdf8');
    else if (/green|jungle|zombie|toxic|camo|evergreen|clover|fairway|jade|goop|ooze|swamp/.test(n)) { set('#15803d', '#14532d', '#a3e635'); if (/camo/.test(n)) L.bPat = 'camo'; }
    else if (/desert|sand|dune|safari|dawn|oasis|stillsuit/.test(n)) set('#d6a35c', '#7c5a2e', '#f59e0b');
    else if (/purple|arcane|nebula|shimmer|royal|violet|amethyst|doom/.test(n)) set('#7e22ce', '#3b0764', '#e879f9');
    else if (/orange|pumpkin|rust|sunset/.test(n)) set('#ea580c', '#431407', '#fde047');
    else if (/bronze/.test(n)) set('#a0602e', '#3a2412', '#f3b27a', { metal: '#c2783c' });
    else if (/silver|chrome|steel|metal|diamond/.test(n)) set('#cbd5e1', '#64748b', '#f8fafc', { metal: '#e2e8f0' });
    if (/checker/.test(n)) { L.bPat = 'checker'; hit = true; }
    if (/plaid|cozy/.test(n)) { L.tPat = 'plaid'; hit = true; }
    if (/snowflake|festive|reindeer|snowman/.test(n)) { L.tPat = 'knit'; hit = true; }
    if (!hit) { // no keyword: rotate the outfit colours around the colour wheel
      const d = si * 137;
      c.top = hueShift(c.top, d); c.bottom = hueShift(c.bottom, d * .6); c.trim = hueShift(c.trim, d); c.hat = hueShift(c.hat, d); c.top2 = hueShift(c.top2, d * .5); if (c.sleeve) c.sleeve = hueShift(c.sleeve, d);
    }
    return L;
  }

  // Light skin tones wash out under the bright lobby lights: keep them warm and a touch deeper.
  function toneSkin(a) {
    const [r, g, b] = rgb(a), mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2;
    if (l < .5 || mx - mn < .08) return a;                       // deep tones and greys stay as they are
    const k = (.5 + (l - .5) * .72) / l, warm = r >= g && g >= b;  // pull lightness toward the middle…
    return warm ? hex(r * k * 1.02, g * k * .96, b * k * .88) : hex(r * k, g * k, b * k); // …and keep natural tones warm
  }

  const cache = new Map();
  function resolve(o, si = 0) {
    si = si || 0;
    const k = o.id + '|' + si;
    if (cache.has(k)) return cache.get(k);
    const def = ORIGINAL[o.num];
    let L = def ? fromOriginal(o, def) : derive(o);
    L = applyStyle(L, o, si, def);
    if (L.head === 'human') L.c.skin = toneSkin(L.c.skin);
    L.id = o.id; L.styleIdx = si; L.key = k;
    cache.set(k, L);
    return L;
  }

  return { resolve, ORIGINAL, util: { hash, mix, shade, lum, hueShift, rgb } };
})();
