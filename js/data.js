/* ============ Castle Rangers :: data, settings, saves, level definitions ============ */

var Store = {
  get(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ }
  },
  clear(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
};

/* Keep a timestamped local backup beside the active save. Stable keys and a
   newer backup allow profile/level progress to survive game updates. */
function validProgressSave(value) {
  return !!value && typeof value === 'object' && (typeof value.unlocked === 'number' || typeof value.gold === 'number' || Array.isArray(value.owned));
}
function validPlayerSave(value) {
  return !!value && typeof value === 'object' && value.list && typeof value.list === 'object';
}
function readPersistentSave(primaryKey, backupKey, isValid, fallback) {
  var primary = Store.get(primaryKey, null);
  var backup = Store.get(backupKey, null);
  if (backup && isValid(backup.data)) {
    var primaryTime = Number(primary && primary._savedAt) || 0;
    var backupTime = Number(backup.savedAt || backup.data._savedAt) || 0;
    if (!isValid(primary) || backupTime > primaryTime) {
      primary = backup.data;
      Store.set(primaryKey, primary);
    }
  }
  return isValid(primary) ? primary : fallback;
}
function writePersistentSave(primaryKey, backupKey, value) {
  var snapshot = JSON.parse(JSON.stringify(value));
  snapshot._savedAt = Date.now();
  Store.set(backupKey, { savedAt: snapshot._savedAt, data: snapshot });
  Store.set(primaryKey, snapshot);
  return snapshot;
}


/* ---------------- Settings ---------------- */
var DEFAULT_SETTINGS = {
  fps: 60,          // target frames per second (0 = unlimited)
  fpsCounter: true,
  blood: 2,         // 0 none, 1 low, 2 medium, 3 high
  difficulty: 'normal',
  shootStyle: 'auto', // 'auto' = click target, arrow arcs there | 'drag' = classic slingshot draw
  trajectory: true,
  dmgNums: true,
  shake: true,
  volume: 70,
  mute: false
};

var SETTINGS = Object.assign({}, DEFAULT_SETTINGS, Store.get('cr_settings', {}));

function saveSettings() { Store.set('cr_settings', SETTINGS); }

function migrateRemovedArrow(progress) {
  if (!progress || typeof progress !== 'object') return;
  var hasShrapnel = Array.isArray(progress.owned) && progress.owned.indexOf('shrapnel') >= 0;
  var level = Math.max(0, Math.min(5, Math.floor(Number(progress.upgrades && progress.upgrades.shrapnel) || 0)));
  if (hasShrapnel) {
    var base = Math.max(60, Math.round(3200 * 0.08));
    progress.gold = (Number(progress.gold) || 0) + 3200 + base * level * (level + 1) / 2;
    progress.owned = progress.owned.filter(function (id) { return id !== 'shrapnel'; });
  }
  if (progress.equipped === 'shrapnel') progress.equipped = 'std';
  if (progress.upgrades) delete progress.upgrades.shrapnel;
}

/* ---------------- Progress ---------------- */
var DEFAULT_PROGRESS = {
  unlocked: 1,              // highest playable level (1-based)
  gold: 0,
  stars: {},                // { levelIndex(1-based): 0-3 }
  best: {},                 // { levelIndex: best score }
  owned: ['std'],
  equipped: 'std',
  upgrades: {}
};

var PROGRESS = Object.assign({}, DEFAULT_PROGRESS, readPersistentSave('cr_progress', 'cr_progress_backup', validProgressSave, {}));
if (!Array.isArray(PROGRESS.owned) || PROGRESS.owned.indexOf('std') < 0) PROGRESS.owned = ['std'];
if (!PROGRESS.upgrades || typeof PROGRESS.upgrades !== 'object') PROGRESS.upgrades = {};
if (!PROGRESS.equipped || PROGRESS.owned.indexOf(PROGRESS.equipped) < 0) PROGRESS.equipped = 'std';
if (typeof PROGRESS.unlocked !== 'number' || PROGRESS.unlocked < 1) PROGRESS.unlocked = 1;
migrateRemovedArrow(PROGRESS);

function saveProgress() {
  if (Player.current) Player.save();
  writePersistentSave('cr_progress', 'cr_progress_backup', PROGRESS);
}

/* ---------------- Player profiles ---------------- */
var Player = {
  current: '',
  db: readPersistentSave('cr_players', 'cr_players_backup', validPlayerSave, { list: {}, last: '' }),

  names() { return Object.keys(this.db.list).sort(); },

  save() {
    if (!this.current) return;
    this.db.list[this.current] = JSON.parse(JSON.stringify(PROGRESS));
    this.db.last = this.current;
    this.db = writePersistentSave('cr_players', 'cr_players_backup', this.db);
  },

  load(name) {
    if (!this.db.list[name]) return false;
    this.current = name;
    PROGRESS = Object.assign({}, DEFAULT_PROGRESS, JSON.parse(JSON.stringify(this.db.list[name])));
    if (!Array.isArray(PROGRESS.owned) || PROGRESS.owned.indexOf('std') < 0) PROGRESS.owned = ['std'];
    if (!PROGRESS.upgrades || typeof PROGRESS.upgrades !== 'object') PROGRESS.upgrades = {};
    if (!PROGRESS.equipped || PROGRESS.owned.indexOf(PROGRESS.equipped) < 0) PROGRESS.equipped = 'std';
    if (typeof PROGRESS.unlocked !== 'number' || PROGRESS.unlocked < 1) PROGRESS.unlocked = 1;
    this.db.last = name;
    this.db = writePersistentSave('cr_players', 'cr_players_backup', this.db);
    writePersistentSave('cr_progress', 'cr_progress_backup', PROGRESS);
    return true;
  },

  create(name) {
    name = String(name || '').trim().slice(0, 16);
    if (!name) return null;
    if (!this.db.list[name]) {
      this.db.list[name] = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
      this.db = writePersistentSave('cr_players', 'cr_players_backup', this.db);
    }
    this.load(name);
    return name;
  },

  /* true when a profile should be picked before the title screen */
  needsPick() { return !this.current; }
};

/* ---------------- Arrows (weapons) ---------------- */
var ARROWS = {
  std: {
    id: 'std', name: 'Standard', icon: '↑', dmg: 34, cost: 0, unlock: 1, speed: 1, cadence: 0.38,
    desc: 'Reliable field arrow. Balanced damage and speed.'
  },
  broad: {
    id: 'broad', name: 'Broadhead', icon: '✦', dmg: 56,     cost: 180, unlock: 2, speed: 1, cadence: 0.45,
    desc: 'Barbed warhead punches through mail. Heavy damage.'
  },
  fire: {
    id: 'fire', name: 'Fire Arrow', icon: '※', dmg: 28,     cost: 320, unlock: 5, speed: 0.94, cadence: 0.5,
    burn: { dps: 10, dur: 3.5 },
    desc: 'Rags soaked in oil. Sets enemies ablaze for damage over time.'
  },
  triple: {
    id: 'triple', name: 'Triple Shot', icon: 'Ⅲ', dmg: 27,     cost: 500, unlock: 7, speed: 1, cadence: 0.7,
    spread: true,
    desc: 'Loose three arrows in one volley. Great against crowds.'
  },
  poison: {
    id: 'poison', name: 'Poison Tip', icon: '✜', dmg: 26,     cost: 700, unlock: 9, speed: 1, cadence: 0.45,
    burn: { dps: 13, dur: 4 }, poison: true,
    desc: 'Foul venom. Wrecks the body for heavy damage over time.'
  },
  pierce: {
    id: 'pierce', name: 'Piercebolt', icon: '➤', dmg: 50,     cost: 900, unlock: 11, speed: 1.05, cadence: 0.55,
    pierce: 3,
    desc: 'Armor-splitting bolt. Punches straight through up to 3 enemies.'
  },
  explosive: {
    id: 'explosive', name: 'Blast Arrow', icon: '◉', dmg: 34,     cost: 1200, unlock: 14, speed: 0.9, cadence: 1.0,
    explode: { r: 144, mult: 0.85 },
    desc: 'Powder charge on a shaft. Detonates on impact, shredding everything nearby.'
  },
  frost: {
    id: 'frost', name: 'Frost Arrow', icon: '❄', dmg: 30, cost: 1000, unlock: 10, speed: 1, cadence: 0.45,
    slow: { factor: 0.4, dur: 3 },
    desc: 'Rime-tipped shaft. Chills the blood, slowing enemies to a crawl.'
  },
  cluster: {
    id: 'cluster', name: 'Cluster Bolt', icon: '✳', dmg: 24, cost: 1400, unlock: 16, speed: 0.95, cadence: 0.85,
    cluster: { count: 4, speed: 420, spread: 0.9 },
    desc: 'Splits mid-flight into a swarm of iron darts. Devastating against crowds.'
  },
  chain: {
    id: 'chain', name: 'Chain Bolt', icon: '⚡', dmg: 40, cost: 1600, unlock: 20, speed: 1.05, cadence: 0.6,
    chain: { jumps: 4, range: 380, falloff: 0.7 },
    desc: 'A vivid lightning arc leaps between up to five foes.'
  },
  holy: {
    id: 'holy', name: 'Holy Bolt', icon: '★', dmg: 55, cost: 2000, unlock: 24, speed: 1.1, cadence: 0.5,
    holy: true, pierce: 1,
    desc: 'Radiant bolt pierces one foe, ignores armor, and smites bosses.'
  },
  gatling: {
    id: 'gatling', name: 'Gatling Launcher', icon: '╳', dmg: 18, cost: 4800, unlock: 50, speed: 1.2, cadence: 0.12,
    spread: true,
    auto: true,
    desc: 'Rapid-fire barrel looses a flurry. Great at keeping crowds pinned.'
  },
  fan: {
    id: 'fan', name: 'Fan Volley', icon: '❖', dmg: 24, cost: 850, unlock: 12, speed: 1, cadence: 0.78,
    spread: true, spreadCount: 5,
    desc: 'Five iron darts loosed as one draw. Sprays the field wide.'
  },
  homing: {
    id: 'homing', name: 'Hunter Arrow', icon: '➹', dmg: 40, cost: 1500, unlock: 18, speed: 1, cadence: 0.6,
    homing: true,
    desc: 'Burdened tip hunts movement. Curves mid-air to chase its prey.'
  },
  sunder: {
    id: 'sunder', name: 'Sunder Maul', icon: '⚒', dmg: 46, cost: 1900, unlock: 28, speed: 1, cadence: 0.6,
    sunder: { dur: 4, mult: 1.7 },
    explode: { r: 190, mult: 2.1 },
    desc: 'Hammer-forged head cracks armor and erupts on impact, blasting nearby enemies.'
  },
  glacial: {
    id: 'glacial', name: 'Glacial Nova', icon: '❆', dmg: 120, cost: 2600, unlock: 22, speed: 1, cadence: 0.7,
    nova: { r: 260, factor: 0.2, dur: 4 },
    desc: 'Powerful crystalline impact and wide cold shockwave that heavily chills nearby enemies.'
  },
  leech: {
    id: 'leech', name: 'Leech Bolt', icon: '❥', dmg: 38, cost: 4200, unlock: 44, speed: 1.05, cadence: 0.55,
    leech: 0.5,
    desc: 'A vampiric rune drains its target and sends half the damage back to your castle.'
  }
};
var ARROW_ORDER = ['std', 'broad', 'fire', 'triple', 'poison', 'frost', 'pierce', 'fan', 'explosive', 'cluster', 'homing', 'chain', 'sunder', 'holy', 'glacial', 'leech', 'gatling'];

/* ---------------- Enemies ---------------- */
var ENEMIES = {
  raider: {
    hp: 30, speed: 105, dmg: 6, gold: 6, score: 25, w: 36, h: 64,
    color: '#9c5a33', trim: '#6e3d20', weapon: 'sword', name: 'Raider'
  },
  runner: {
    hp: 22, speed: 215, dmg: 4, gold: 8, score: 30, w: 30, h: 58,
    color: '#717d33', trim: '#4c5423', weapon: 'dagger', name: 'Runner'
  },
  brute: {
    hp: 110, speed: 74, dmg: 14, gold: 18, score: 70, w: 54, h: 84,
    color: '#6d4c41', trim: '#48322a', weapon: 'club', name: 'Brute'
  },
  shield: {
    hp: 74, speed: 92, dmg: 9, gold: 16, score: 60, w: 44, h: 70,
    color: '#4a5c74', trim: '#33404f', weapon: 'sword', shield: true, name: 'Shield-Bearer'
  },
  crossbow: {
    hp: 44, speed: 97, dmg: 7, gold: 14, score: 55, w: 36, h: 64,
    color: '#54604a', trim: '#39442f', weapon: 'crossbow', ranged: true, shotEvery: 2.4,
    name: 'Crossbowman'
  },
  captain: {
    hp: 200, speed: 82, dmg: 16, gold: 35, score: 130, w: 48, h: 78,
    color: '#5c4a78', trim: '#3d3153', weapon: 'sword', armor: 0.75, name: 'Captain'
  },
  warlord: {
    hp: 500, speed: 54, dmg: 27, gold: 150, score: 400, w: 76, h: 110,
    color: '#7a2420', trim: '#4a1512', weapon: 'axe', boss: true, name: 'Warlord'
  }
};

/* ---------------- Difficulty ---------------- */
var DIFFS = {
  easy:   { hp: 0.45, spd: 0.7, dmg: 0.45, label: 'Easy' },
  normal: { hp: 0.65, spd: 0.85, dmg: 0.65, label: 'Normal' },
  hard:   { hp: 0.9,  spd: 0.95, dmg: 0.9,  label: 'Hard' }
};

/* ---------------- Levels ----------------
 * waves: units = [[type, count]...], gap = ms between spawns, pause = ms after wave
 * theme: day | sunset | night | storm
 */
var LEVELS = [
  {
    name: 'The First Raid', theme: 'day', hpMul: 1.0, spdMul: 1.0, gold: 40,
    waves: [
      { units: [['raider', 5]], gap: 1500, pause: 2400 },
      { units: [['raider', 5]], gap: 1200 }
    ]
  },
  {
    name: 'Quick Feet', theme: 'day', hpMul: 1.0, spdMul: 1.0, gold: 55,
    waves: [
      { units: [['raider', 4], ['runner', 3]], gap: 1100, pause: 2400 },
      { units: [['runner', 6]], gap: 850 }
    ]
  },
  {
    name: 'Shield Wall', theme: 'day', hpMul: 1.05, spdMul: 1.0, gold: 70,
    waves: [
      { units: [['raider', 4], ['shield', 2]], gap: 1200, pause: 2400 },
      { units: [['shield', 3], ['raider', 4]], gap: 950 }
    ]
  },
  {
    name: 'The Brute', theme: 'day', hpMul: 1.1, spdMul: 1.0, gold: 90,
    waves: [
      { units: [['raider', 5], ['brute', 2]], gap: 1100, pause: 2400 },
      { units: [['brute', 2], ['runner', 5]], gap: 900 }
    ]
  },
  {
    name: 'Dusk Patrol', theme: 'sunset', hpMul: 1.15, spdMul: 1.05, gold: 105,
    waves: [
      { units: [['runner', 6], ['raider', 4]], gap: 900, pause: 2200 },
      { units: [['shield', 3], ['raider', 4]], gap: 1000, pause: 2200 },
      { units: [['brute', 2]], gap: 1500 }
    ]
  },
  {
    name: 'Bolt from the Blue', theme: 'sunset', hpMul: 1.2, spdMul: 1.05, gold: 120,
    waves: [
      { units: [['crossbow', 3], ['raider', 4]], gap: 1000, pause: 2400 },
      { units: [['crossbow', 2], ['runner', 5]], gap: 850, pause: 2200 },
      { units: [['shield', 3], ['crossbow', 2]], gap: 950 }
    ]
  },
  {
    name: 'Reinforcements', theme: 'sunset', hpMul: 1.25, spdMul: 1.1, gold: 145,
    waves: [
      { units: [['brute', 3], ['shield', 3]], gap: 1200, pause: 2200 },
      { units: [['raider', 6], ['runner', 5]], gap: 800, pause: 2200 },
      { units: [['brute', 3], ['crossbow', 2]], gap: 1100 }
    ]
  },
  {
    name: 'The Warlord', theme: 'sunset', hpMul: 1.3, spdMul: 1.1, gold: 220, boss: true,
    waves: [
      { units: [['shield', 3], ['raider', 5]], gap: 1000, pause: 2400 },
      { units: [['crossbow', 3], ['runner', 5]], gap: 900, pause: 2800 },
      { units: [['warlord', 1], ['brute', 2]], gap: 2200 }
    ]
  },
  {
    name: 'Night Crawlers', theme: 'night', hpMul: 1.35, spdMul: 1.15, gold: 165,
    waves: [
      { units: [['runner', 8]], gap: 700, pause: 2000 },
      { units: [['raider', 6], ['shield', 3]], gap: 900, pause: 2200 },
      { units: [['brute', 3], ['runner', 5]], gap: 850 }
    ]
  },
  {
    name: 'Dark Archers', theme: 'night', hpMul: 1.4, spdMul: 1.15, gold: 185,
    waves: [
      { units: [['crossbow', 4], ['shield', 3]], gap: 950, pause: 2200 },
      { units: [['crossbow', 4], ['runner', 6]], gap: 800, pause: 2200 },
      { units: [['brute', 3], ['crossbow', 3]], gap: 1000 }
    ]
  },
  {
    name: 'Iron Column', theme: 'night', hpMul: 1.45, spdMul: 1.2, gold: 210,
    waves: [
      { units: [['shield', 5], ['brute', 3]], gap: 1100, pause: 2200 },
      { units: [['shield', 4], ['crossbow', 3], ['raider', 5]], gap: 850, pause: 2200 },
      { units: [['brute', 4], ['runner', 6]], gap: 800 }
    ]
  },
  {
    name: 'Siege Engine', theme: 'night', hpMul: 1.5, spdMul: 1.2, gold: 280, boss: true,
    waves: [
      { units: [['brute', 4], ['shield', 4]], gap: 1000, pause: 2200 },
      { units: [['crossbow', 4], ['runner', 6]], gap: 800, pause: 2400 },
      { units: [['warlord', 1], ['crossbow', 3]], gap: 1900 }
    ]
  },
  {
    name: 'Storm Front', theme: 'storm', hpMul: 1.55, spdMul: 1.25, gold: 240,
    waves: [
      { units: [['runner', 8], ['raider', 6]], gap: 700, pause: 2000 },
      { units: [['shield', 4], ['brute', 3], ['crossbow', 3]], gap: 900, pause: 2200 },
      { units: [['raider', 8], ['runner', 6]], gap: 650 }
    ]
  },
  {
    name: 'Relentless', theme: 'storm', hpMul: 1.6, spdMul: 1.25, gold: 265,
    waves: [
      { units: [['brute', 4], ['shield', 5]], gap: 1000, pause: 2000 },
      { units: [['crossbow', 5], ['runner', 8]], gap: 750, pause: 2000 },
      { units: [['brute', 5], ['crossbow', 4]], gap: 850, pause: 2000 },
      { units: [['shield', 6], ['raider', 8]], gap: 650 }
    ]
  },
  {
    name: 'Last Watch', theme: 'storm', hpMul: 1.7, spdMul: 1.3, gold: 320,
    waves: [
      { units: [['shield', 5], ['crossbow', 4], ['brute', 4]], gap: 850, pause: 2000 },
      { units: [['runner', 10]], gap: 550, pause: 2000 },
      { units: [['brute', 5], ['shield', 5], ['crossbow', 4]], gap: 800 }
    ]
  },
  {
    name: 'The Final Siege', theme: 'storm', hpMul: 1.8, spdMul: 1.3, gold: 600, boss: true,
    waves: [
      { units: [['shield', 6], ['crossbow', 5], ['brute', 4]], gap: 850, pause: 2200 },
      { units: [['runner', 10], ['raider', 8]], gap: 600, pause: 2200 },
      { units: [['warlord', 1], ['brute', 4]], gap: 2000, pause: 2600 },
      { units: [['warlord', 1], ['crossbow', 4], ['shield', 5]], gap: 1600 }
    ]
  },
  /* ---- Chapter 5: dusk resurgence ---- */
  {
    name: 'Rising Dusk', theme: 'sunset', hpMul: 1.85, spdMul: 1.35, gold: 300,
    waves: [
      { units: [['runner', 8], ['shield', 4]], gap: 750, pause: 2000 },
      { units: [['raider', 8], ['crossbow', 4]], gap: 800, pause: 2000 },
      { units: [['brute', 4], ['runner', 6]], gap: 800 }
    ]
  },
  {
    name: 'Crossbow Nest', theme: 'sunset', hpMul: 1.9, spdMul: 1.35, gold: 320,
    waves: [
      { units: [['crossbow', 6], ['shield', 4]], gap: 850, pause: 2200 },
      { units: [['crossbow', 5], ['brute', 3]], gap: 900, pause: 2200 },
      { units: [['crossbow', 6], ['runner', 8]], gap: 700 }
    ]
  },
  {
    name: 'Captains of Ruin', theme: 'sunset', hpMul: 1.95, spdMul: 1.4, gold: 340,
    waves: [
      { units: [['captain', 1], ['shield', 4]], gap: 1200, pause: 2200 },
      { units: [['captain', 1], ['raider', 6], ['crossbow', 3]], gap: 900, pause: 2200 },
      { units: [['captain', 2], ['brute', 3]], gap: 1400 }
    ]
  },
  {
    name: "Warlord's Revenge", theme: 'sunset', hpMul: 2.0, spdMul: 1.4, gold: 450, boss: true,
    waves: [
      { units: [['captain', 2], ['shield', 5]], gap: 1100, pause: 2200 },
      { units: [['crossbow', 5], ['runner', 8]], gap: 750, pause: 2600 },
      { units: [['warlord', 1], ['captain', 2]], gap: 2200 }
    ]
  },
  /* ---- Chapter 6: the long storm ---- */
  {
    name: 'Midnight Storm', theme: 'storm', hpMul: 2.05, spdMul: 1.45, gold: 380,
    waves: [
      { units: [['runner', 12]], gap: 550, pause: 2000 },
      { units: [['shield', 6], ['brute', 4]], gap: 950, pause: 2000 },
      { units: [['crossbow', 5], ['raider', 8]], gap: 700 }
    ]
  },
  {
    name: 'The Iron Tide', theme: 'storm', hpMul: 2.1, spdMul: 1.45, gold: 400,
    waves: [
      { units: [['shield', 8], ['captain', 1]], gap: 900, pause: 2200 },
      { units: [['shield', 6], ['crossbow', 5], ['brute', 4]], gap: 800, pause: 2200 },
      { units: [['captain', 2], ['runner', 8]], gap: 800 }
    ]
  },
  {
    name: 'Blasted Heavens', theme: 'storm', hpMul: 2.15, spdMul: 1.5, gold: 420,
    waves: [
      { units: [['brute', 6], ['crossbow', 5]], gap: 900, pause: 2000 },
      { units: [['captain', 2], ['shield', 6]], gap: 1000, pause: 2000 },
      { units: [['runner', 12], ['brute', 4]], gap: 650 }
    ]
  },
  {
    name: 'The Commander', theme: 'storm', hpMul: 2.2, spdMul: 1.5, gold: 550, boss: true,
    waves: [
      { units: [['captain', 3], ['crossbow', 5]], gap: 1000, pause: 2200 },
      { units: [['shield', 8], ['brute', 5]], gap: 850, pause: 2600 },
      { units: [['warlord', 1], ['captain', 3]], gap: 2000 }
    ]
  },
  /* ---- Chapter 7: the last watch ---- */
  {
    name: 'Endless Night', theme: 'night', hpMul: 2.3, spdMul: 1.55, gold: 450,
    waves: [
      { units: [['runner', 14]], gap: 480, pause: 1800 },
      { units: [['runner', 10], ['raider', 8]], gap: 550, pause: 1800 },
      { units: [['runner', 12], ['brute', 5]], gap: 520 }
    ]
  },
  {
    name: 'Siege Within', theme: 'night', hpMul: 2.4, spdMul: 1.55, gold: 470,
    waves: [
      { units: [['captain', 2], ['crossbow', 6]], gap: 900, pause: 2000 },
      { units: [['brute', 6], ['shield', 8]], gap: 800, pause: 2000 },
      { units: [['captain', 3], ['runner', 10]], gap: 700 }
    ]
  },
  {
    name: 'The Long Watch', theme: 'night', hpMul: 2.5, spdMul: 1.6, gold: 500,
    waves: [
      { units: [['shield', 8], ['crossbow', 6], ['brute', 5]], gap: 800, pause: 2000 },
      { units: [['runner', 14]], gap: 480, pause: 2000 },
      { units: [['captain', 3], ['brute', 5], ['crossbow', 5]], gap: 850 }
    ]
  },
  {
    name: 'Fall of Kings', theme: 'storm', hpMul: 2.6, spdMul: 1.6, gold: 650, boss: true,
    waves: [
      { units: [['captain', 3], ['shield', 8]], gap: 950, pause: 2200 },
      { units: [['crossbow', 7], ['runner', 10]], gap: 650, pause: 2600 },
      { units: [['warlord', 1], ['captain', 3], ['brute', 4]], gap: 1800 }
    ]
  },
  {
    name: 'Last Stand', theme: 'storm', hpMul: 2.7, spdMul: 1.65, gold: 750,
    waves: [
      { units: [['shield', 10], ['captain', 3]], gap: 850, pause: 2000 },
      { units: [['crossbow', 8], ['brute', 6]], gap: 750, pause: 2000 },
      { units: [['runner', 16]], gap: 450, pause: 2000 },
      { units: [['captain', 4], ['brute', 6]], gap: 900 }
    ]
  },
  {
    name: 'The Final Warlord', theme: 'storm', hpMul: 2.8, spdMul: 1.7, gold: 1200, boss: true,
    waves: [
      { units: [['captain', 4], ['shield', 8], ['crossbow', 6]], gap: 800, pause: 2200 },
      { units: [['runner', 14], ['brute', 6]], gap: 600, pause: 2400 },
      { units: [['warlord', 1], ['captain', 4]], gap: 2000, pause: 2800 },
      { units: [['warlord', 1], ['captain', 4], ['crossbow', 6]], gap: 1700 }
    ]
  }
];

/* Procedurally extend the campaign to 300 rounds (adds rounds 31-300).
   Seeded RNG so the generated campaign is identical on every load.
   Difficulty grows in controlled steps, with enemy speed and health capped
   so the final rounds remain playable. */
(function extendCampaign() {
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(408172903);
  var themes = ['day', 'sunset', 'night', 'storm'];
  var pools = [
    ['raider', 'runner'],
    ['raider', 'shield', 'runner'],
    ['shield', 'brute', 'crossbow'],
    ['crossbow', 'captain', 'shield'],
    ['captain', 'brute', 'crossbow', 'runner'],
    ['captain', 'brute', 'shield', 'crossbow', 'runner']
  ];
  var adj = ['Relentless', 'Silent', 'Burning', 'Iron', 'Shadow', 'Crimson', 'Frozen', 'Hollow', 'Raging', 'Astral'];
  var noun = ['Horde', 'March', 'Tide', 'Siege', 'Onslaught', 'Vanguard', 'Legion', 'Assault', 'Reign', 'Eclipse'];
  for (var i = 0; i < 270; i++) {
    var n = 30 + i + 1; // round number 31..300
    var theme = themes[Math.floor(rng() * themes.length)];
    var boss = (n % 10 === 0); // a boss round every ten rounds
    var hpMul = 2.8 + Math.min(6.5, i * 0.024);
    var spdMul = 1.7 + Math.min(0.9, i * 0.003);
    var gold = 1200 + i * 18 + (boss ? 500 : 0);
    var poolIdx = Math.min(pools.length - 1, Math.floor(i / 45));
    var waveCount = 3 + Math.floor(rng() * Math.min(3, 1 + Math.floor(i / 90))); // 3-5 waves
    var waves = [];
    for (var w = 0; w < waveCount; w++) {
      var pool = pools[Math.min(pools.length - 1, poolIdx + (w % 2))];
      var unitCount = 1 + Math.floor(rng() * Math.min(3, pool.length));
      var units = [];
      var used = {};
      for (var u = 0; u < unitCount; u++) {
        var ti = Math.floor(rng() * pool.length);
        if (used[ti]) continue;
        used[ti] = true;
        var type = pool[ti];
        var count = 3 + Math.floor(rng() * (4 + Math.min(5, Math.floor(i / 45))));
        units.push([type, count]);
      }
      if (units.length === 0) units.push(['raider', 4]);
      var gap = Math.max(520, 1100 - i * 2.1);
      var pause = 1900 + Math.floor(rng() * 500);
      waves.push({ units: units, gap: gap, pause: pause });
    }
    if (boss) {
      waves.push({ units: [['warlord', 1], ['captain', 1 + Math.min(4, Math.floor(i / 60))]], gap: 1900, pause: 2600 });
    }
    LEVELS.push({
      name: adj[i % adj.length] + ' ' + noun[Math.floor(i / adj.length) % noun.length] + ' ' + n,
      theme: theme, hpMul: hpMul, spdMul: spdMul, gold: gold, boss: boss,
      waves: waves
    });
  }
})();

/* Flatten a level's waves into a timed spawn queue with wave boundaries. */
function buildSpawnQueue(level) {
  var queue = [];
  var waves = [];
  var t = 1600; // grace period before first spawn
  for (var wi = 0; wi < level.waves.length; wi++) {
    var w = level.waves[wi];
    var startIdx = queue.length;
    var firstT = t;
    for (var u = 0; u < w.units.length; u++) {
      var type = w.units[u][0];
      var count = w.units[u][1];
      for (var i = 0; i < count; i++) {
        queue.push({ t: t, type: type, wave: wi });
        t += (w.gap || 1000);
      }
    }
    var lastT = t - (w.gap || 1000);
    waves.push({ firstT: firstT, lastT: lastT, startIdx: startIdx, endIdx: queue.length });
    t += (w.pause || 2200);
  }
  return { queue: queue, waves: waves };
}

/* Level helpers */
function levelUnlocked(idx0) { return (idx0 + 1) <= PROGRESS.unlocked; }
function totalLevels() { return LEVELS.length; }

/* Migrate a legacy solo save into a profile named after db.last or first name */
(function migrateLegacy() {
  if (!Player.db.last && Player.names().length === 0) {
    var legacy = Store.get('cr_progress', null);
    if (legacy && (legacy.gold > 0 || legacy.unlocked > 1 ||
      Object.keys(legacy.stars || {}).length > 0 || Object.keys(legacy.best || {}).length > 0 ||
      (legacy.owned && legacy.owned.length > 1) || (legacy.equipped && legacy.equipped !== 'std') ||
      Object.keys(legacy.upgrades || {}).length > 0)) {
      Player.db.list['Archer'] = JSON.parse(JSON.stringify(legacy));
      Player.db.last = 'Archer';
      Player.db = writePersistentSave('cr_players', 'cr_players_backup', Player.db);
    }
  }
  if (Player.db.last && Player.db.list[Player.db.last]) Player.load(Player.db.last);
})();

