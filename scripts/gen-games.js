#!/usr/bin/env node
/* Scans /games for every .html file (and every sub-folder that has an index.html)
   and writes /games.json, which the Games tab in index.html loads.
   Runs automatically on deploy ("build" in package.json) and by hand: node scripts/gen-games.js
   To rename a game, add  "filename.html": "Nice Name"  to scripts/names.json
   scripts/more-games.json:  "hide"  files/folders in /games to leave out (duplicates, player shells),
   "pages"  games inside a sub-folder and their names ("flash/index.html?game=bloons": "Bloons"),
   "cats"  a game's categories instead of the guessed ones (key = the game's "file" in games.json) */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), GAMES = path.join(ROOT, 'games');
let OVER = {};
try { OVER = JSON.parse(fs.readFileSync(path.join(__dirname, 'names.json'), 'utf8')); } catch (e) {}
let MORE = {};
try { MORE = JSON.parse(fs.readFileSync(path.join(__dirname, 'more-games.json'), 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') { console.error('scripts/more-games.json: ' + e.message); process.exit(1); } }
const HIDE = new Set(MORE.hide || []), PAGES = MORE.pages || {}, CATS = MORE.cats || {};

/* words used to split run-together names such as "clpokemonsilver" */
const VOCAB = `a an the of and in on at to for vs with from
poke pokemon pokemons emerald red blue green yellow gold silver crystal ruby sapphire fire leaf firered leafgreen fr lg
pure retro rocket edition legacy fusion fused ultimate dimension unbound volume radical glazed gaia vega voyager unova
elysium elite redux exceeded extended cut flow horizons imperium enhanced random randomized randomizer battle frontier
mini sea glass seaglass energized mega moemon kaizo iron perfect modern quetzal roaring amnesia clover bills secret garden
garden stadium pinball snap mystery dungeon sors scrambled scarlet violet shin sigma lazarus saiph evolved omniversal
crest light platinum liquid low budget crystal clear advance wild indigo sun sky tourmaline ultra violet run bun rbynova
nova recharged pink hoenns hoenn last wish odyssey nameless dream stone record keepers remnants wah rowe aesthetic all
bonanza bros celia celias stupid rom hack rogue theta ex ambrosia fusion3 pit the too many types unown king
sonic knuckles robotnik eggman shadow sally tails amy mania heroes classic classics megamix battle spinball hedgehog
chaotix hellfire saga scorched quest delta origins score rush challenges super challenge contemporary return time place
dr mean bean machine mushroom blast erazor mon asuhro ashuro sm64 smb
mario luigi wario waluigi peach yoshi donkey kong diddy racing kart party tennis golf builder land paper thousand year door
ttyd star road retooled sunshine64 sunshine taco stand ware inc world galaxy good boy practice pro mode black dse pit
zelda link links awakening dx minish cap majora mask redux us oot ocarina master oracle ages seasons indigo ch2 chapter
kirby kirbys dreamland amazing mirror tilt tumble crystal shards 64 nightmare
mega man megaman battle chip chipchallenge network wily wars zero sequels x bn mmbn
madden nfl nba nhl fifa football soccer baseball hockey blitz special hitz triple play live international tony hawk hawks
skater underground skateboarding bmx wwf attitude no mercy wrestling worldcup cup
mortal kombat mk mythologies sub myth gen amped smash bros remix street fighter alpha umuh something umuhsomething
fatal fury heroes gunstar ultimate
need speed nfs carbon own city most wanted porsche unleashed wave race outrun crazy taxi excite bike gba f zero fzero hydro thunder
final fantasy legend golden sun lost age harvest moon fire emblem earthbound phantasy shining force dragon warrior monsters
dragonball ball z gt form legacy goku super warriors advanced
castlevania aria sorrow bloodline circle moon chain memories harmony dissonance metroid fusion mission metal gear solid slug
metalslug banjo kazooie tooie conker bad fur day crash bandicoot bomberman hero bubsy buck bumble commander keen doom quake
duke nukem earth worm jim ecco dolphin ristar rocket knight adventures toejam earl streets rage golden axe gain ground
altered beast alien storm kid chameleon shinobi revenge shantae shrek sim simcity pilotwings pilot wings resident evil
serious sam max payne meat boy pac man pacman world another galaxy rhythm heaven puyo fever pyro toad opposum possum country
oops alle eevees alleevees one piece lets go pikachu eevee garf caught act general chaos glover grand theft auto gta advance
south park starfox fox steel empire tetris tmnt turtles toy story gen towers triple twitch warioland waverace worldcup
zombies ate my neighbors neighboors tomb raider hunter turok dinosaur acko mach challenge walk forest inkwell viewpoint
columns iii ii xi iv vi vii viii ix harry potter chamber secrets sorcerers philosophers lucid lime peach snow white
simpsons road rangers range gba nicktoons freeze frame frenzy ootmasterquest master quest
birthday grimace dynamite headdy danganronpa dbz superwarriors tcg trading card game pic cross picross apotris
game watch gallery collection and gallery3 midways greatest hits midway
tmnt mrdriller mr driller drill monster 4 sapphire tetris sors hajime ippo natsuki sovereign skys zombiesatemy
octopath hollow castle hyper drive rebooted reboot boot revolution lego racers jet force gemini klonoa inclement stunning steel
mobius eye ordinary animal forest alien hominid balatro backyard hang loco combat devolved heart soul captain lang
hajime ippo aesthetic aestheticred ambrosia dream flora gigared giga glazed cryst gen genesis deluxe zero mission
shadow dancer ninja gaiden akuma ninjagaiden orgaiden ak man organ ordinary rouge extreme extremerandomizer
adventure island castle fortress rpg tactics advance wars pocket monsters orange sprout sapphire rebirth
eevee eeveelutions piece grim reaper lost woods reload remastered rebalanced plus vanilla version hyperdrive
yes no key dash super duper monkey ball junior jr galaxies spin attack break out space invaders frogger
sword shield location tele telelocation sims taco tuesday maker
`.split(/\s+/).filter(w=>w.length>1&&!/^\d+$/.test(w));
const WORDS = new Set(VOCAB);
const MAXW = Math.max(...VOCAB.map(w => w.length));

const SPECIAL = { gba: 'GBA', gb: 'GB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL', fifa: 'FIFA', dx: 'DX', gta: 'GTA', sm64: 'SM64',
  mmbn: 'Mega Man Battle Network', dbz: 'DBZ', tmnt: 'TMNT', wwf: 'WWF', mk: 'MK', bn: 'BN', tcg: 'TCG', nfs: 'Need for Speed',
  rom: 'ROM', ex: 'EX', ii: 'II', iii: 'III', iv: 'IV', vi: 'VI', vii: 'VII', viii: 'VIII', ix: 'IX', xi: 'XI', us: 'US', ttyd: 'TTYD',
  ch2: 'Ch.2', oot: 'OoT', gt: 'GT', fr: 'FR', lg: 'LG', mon: 'Mon', pokemon: 'Pokémon', poke: 'Poké', pokemons: 'Pokémon', dse: 'DSE',
  rto6: 'RTO6', gschronicles: 'GS Chronicles', frlg: 'FRLG', ips: 'IPS', cf: 'CF', cg: 'CG', tc: 'TC', tp: 'TP', rs: 'RS', bm: 'BM',
  mmwilywars: 'Mega Man Wily Wars', sors: 'SORS', dk: 'DK', nes: 'NES', f: 'F', x: 'X', z: 'Z', wah: 'WAH', ugs: 'UGS' };
const SMALL = new Set(['a', 'an', 'the', 'of', 'and', 'in', 'on', 'at', 'to', 'for', 'vs', 'with', 'from']);

function segment(s) {
  /* split a lowercase run into known words, minimising unknown letters */
  const n = s.length, best = Array(n + 1).fill(null);
  best[0] = { cost: 0, prev: -1, word: '' };
  for (let i = 0; i < n; i++) {
    if (!best[i]) continue;
    for (let l = 1; l <= Math.min(MAXW, n - i); l++) {
      const w = s.substr(i, l);
      if (WORDS.has(w)) {
        const c = best[i].cost + 1 + (l <= 2 ? 3 : 0);
        if (!best[i + l] || c < best[i + l].cost) best[i + l] = { cost: c, prev: i, word: w };
      }
    }
    /* unknown single letter (heavily penalised) */
    const c2 = best[i].cost + 12;
    if (!best[i + 1] || c2 < best[i + 1].cost) best[i + 1] = { cost: c2, prev: i, word: s[i], unk: true };
  }
  const out = []; let i = n;
  while (i > 0) { const b = best[i]; out.unshift(b); i = b.prev; }
  /* glue neighbouring unknown letters into one word */
  const res = []; let buf = '';
  for (const b of out) { if (b.unk) buf += b.word; else { if (buf) { res.push(buf); buf = ''; } res.push(b.word); } }
  if (buf) res.push(buf);
  return res;
}

function cap(w, first) {
  if (SPECIAL[w.toLowerCase()]) return SPECIAL[w.toLowerCase()];
  if (!first && SMALL.has(w.toLowerCase())) return w.toLowerCase();
  if (/^v?\d+(\.\d+)*$/i.test(w)) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function prettify(file) {
  let b = file.replace(/\.html$/i, '');
  if (OVER[file]) return OVER[file];
  b = b.replace(/#U00e9/gi, 'é').replace(/#U00a0/gi, ' ').replace(/\s*\(\d+\)\s*$/, '').trim();
  if (/^cl./.test(b)) b = b.slice(2);
  if (/\s/.test(b)) {
    /* already written with spaces: just tidy the first letter */
    return b.replace(/\s+/g, ' ').replace(/^[a-z]/, c => c.toUpperCase());
  }
  /* split camelCase and letter/digit boundaries first */
  b = b.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
       .replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2').replace(/[-_&+]+/g, ' ');
  const toks = [];
  for (const part of b.split(/\s+/).filter(Boolean)) {
    if (/^\d+(\.\d+)*$/.test(part)) { toks.push(part); continue; }
    const low = part.toLowerCase();
    if (WORDS.has(low) || SPECIAL[low]) { toks.push(low); continue; }
    if (part === part.toUpperCase() && part.length <= 5) { toks.push(part); continue; }
    const seg = segment(low);
    const unk = seg.some(w => !WORDS.has(w));
    const tiny = seg.filter(w => w.length <= 2 && !SMALL.has(w) && !SPECIAL[w]).length;
    toks.push(...(unk || tiny > 1 ? [low] : seg));
  }
  const out = toks.map((t, i) => cap(t, i === 0));
  /* "Poké mon" never needed; fix a few joined results */
  return out.join(' ').replace(/Poké (?=[a-z])/g, 'Poké').replace(/\s+/g, ' ').trim();
}

function genre(name, file) {
  const s = name.toLowerCase();
  const t = [
    [/poke|pok.mon|emerald|firered|leafgreen|moemon/, 'Pokémon'],
    [/sonic|robotnik|knuckles/, 'Sonic'],
    [/zelda|majora|ocarina|minish|oracle of|link'?s? awakening|\bloz|clloz/, 'Zelda'],
    [/mario|luigi|wario|waluigi|sm64|smbdx|supermario|yoshi|donkey|diddy|peach/, 'Mario & Co'],
    [/kirby/, 'Kirby'],
    [/mega ?man|mmbn|megaman|battle network/, 'Mega Man'],
    [/madden|\bnfl\b|\bnba\b|\bnhl\b|fifa|football|soccer|\bgolf|tennis|world ?cup|baseball|tony ?hawk|\bbmx|skater|\bwwf\b|wrestl|triple ?play|hockey|world cup/, 'Sports'],
    [/mortal|street ?fighter|fatal fury|smash|world heroes|dragon ?ball|\bdbz\b|\bmk\b|kombat/, 'Fighting'],
    [/need for speed|\bnfs\b|kart|racing|race|outrun|crazy ?taxi|f ?zero|fzero|excite|hydro|mach bike/, 'Racing'],
    [/final fantasy|golden sun|harvest|fire ?emblem|earthbound|phantasy|shining|dragon ?warrior|chrono|rpg/, 'RPG'],
    [/castlevania|metroid|banjo|crash|bomberman|bubsy|ristar|ecco|\bjim\b|kid |alex kidd|aladdin|shantae|rocket ?knight|klonoa|glover|ninja|gaiden/, 'Platformer'],
    [/doom|quake|goldeneye|perfect dark|halo|duke|serious sam|max ?payne|turok/, 'Shooter'],
    [/tetris|puyo|columns|picross|pac|apotris|dig ?dug|mr ?driller/, 'Puzzle'],
    [/harry ?potter|lego|shrek|simpsons|south ?park|nicktoon|garf|toy ?story|snow ?white|one ?piece/, 'Licensed']
  ];
  for (const [re, g] of t) if (re.test(s)) return g;
  return 'Retro';
}

const PLAT = { gba: 'GBA', mgba: 'GBA', gb: 'Game Boy', gbc: 'Game Boy', n64: 'N64', parallel_n64: 'N64', mupen64plus_next: 'N64', nes: 'NES', snes: 'SNES', segamd: 'Genesis', segagg: 'Game Gear',
  sms: 'Master System', nds: 'DS', psx: 'PlayStation', arcade: 'Arcade', dos: 'DOS', segacd: 'Sega CD', sega32x: '32X' };
function platform(text) {
  const m = /EJS_core\s*=\s*["']([^"']+)["']/.exec(text) || /\bcore\s*:\s*["']([^"']+)["']/.exec(text);
  return m ? (PLAT[m[1].toLowerCase()] || m[1].toUpperCase()) : '';
}

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const enc = p => p.split('/').map(encodeURIComponent).join('/');

const items = [];
function add(file, url, text, nice) {
  const name = OVER[file] || nice || prettify(file.replace(/\.html?$/i, '') + '.html');
  const g = genre(name, file), p = platform(text);
  const hue = hash(file) % 360;
  const hint = p ? 'Press PLAY, then click inside the game. The game file loads from the internet, so the first load can take a few seconds.' : '';
  items.push({ id: 'g_' + file.replace(/[^a-z0-9]+/gi, '_').toLowerCase(), name, url, hint, file,
    colors: ['hsl(' + hue + ',62%,42%)', 'hsl(' + ((hue + 40) % 360) + ',58%,18%)'], cats: CATS[file] || [g].concat(p ? [p] : []) });
}
for (const ent of fs.readdirSync(GAMES, { withFileTypes: true })) {
  if (HIDE.has(ent.name)) continue;
  let file = null, url = null, text = '';
  if (ent.isFile() && /\.html?$/i.test(ent.name)) {
    file = ent.name; url = '/games/' + enc(ent.name);
    /* only read the top of big files, the emulator setting is near the top or the middle of small wrappers */
    try { const st = fs.statSync(path.join(GAMES, ent.name)); if (st.size < 200000) text = fs.readFileSync(path.join(GAMES, ent.name), 'utf8'); } catch (e) {}
  } else if (ent.isDirectory() && fs.existsSync(path.join(GAMES, ent.name, 'index.html'))) {
    file = ent.name; url = '/games/' + enc(ent.name) + '/index.html';
  } else continue;
  add(file, url, text);
}
/* games inside sub-folders, listed in more-games.json (skipped if the page is missing) */
for (const [page, nice] of Object.entries(PAGES)) {
  const q = page.indexOf('?'), rel = q < 0 ? page : page.slice(0, q);
  if (!fs.existsSync(path.join(GAMES, rel))) { console.warn('more-games.json: games/' + rel + ' not found, skipped'); continue; }
  add(page, '/games/' + enc(rel) + (q < 0 ? '' : page.slice(q)), '', nice);
}
items.sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync(path.join(ROOT, 'games.json'), JSON.stringify(items));
console.log('games.json: ' + items.length + ' games');
