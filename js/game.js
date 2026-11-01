Warning: truncated output (original token count: 21717)
Total output lines: 2086

/* ============ Castle Rangers :: game core ============ */

var cv = document.getElementById('game');
var ctx = cv.getContext('2d');

function $(id) { return document.getElementById(id); }
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

var el = {
  hud: $('hud'),
  hpFill: $('hpFill'), hpText: $('hpText'),
  keepFill: $('keepFill'), keepText: $('keepText'),
  lvlName: $('lvlName'), waveInfo: $('waveInfo'),
  scoreVal: $('scoreVal'), roundVal: $('roundVal'), goldVal: $('goldVal'),
  fpsWrap: $('fpsWrap'), fpsVal: $('fpsVal'),
  ammoBar: $('ammoBar'),
  powerWrap: $('powerWrap'), powerFill: $('powerFill'),
  toast: $('toast'),
  titleGold: $('titleGold'), titleNext: $('titleNext'), titlePlayer: $('titlePlayer'),
  levelGrid: $('levelGrid'),
  profileList: $('profileList'), newProfileName: $('newProfileName'), newProfileBtn: $('newProfileBtn'),
  arrowGrid: $('arrowGrid'), armoryGold: $('armoryGold'),
  hsBoard: $('hsBoard'), hsStatus: $('hsStatus'),
  winStars: $('winStars'), winLevel: $('winLevel'), winScore: $('winScore'),
  winGold: $('winGold'), winCastle: $('winCastle'), nextBtn: $('nextBtn'),
  loseLevel: $('loseLevel'), loseScore: $('loseScore'), loseKills: $('loseKills'), loseGold: $('loseGold'),
  setFps: $('setFps'), setFpsCounter: $('setFpsCounter'), setBlood: $('setBlood'),
  setDiff: $('setDiff'), setTraj: $('setTraj'), setDmgNums: $('setDmgNums'),
  setShootStyle: $('setShootStyle'),
  setShake: $('setShake'), setShakeState: $('setShakeState'), setVol: $('setVol'), volVal: $('volVal'), setMute: $('setMute')
};

var SCREENS = ['screen-title', 'screen-levels', 'screen-armory', 'screen-settings',
  'screen-howto', 'screen-pause', 'screen-win', 'screen-lose', 'screen-profiles', 'screen-highscores'];
var highScorePollTimer = null;
function hideAllScreens() {
  if (highScorePollTimer !== null) { clearInterval(highScorePollTimer); highScorePollTimer = null; }
  SCREENS.forEach(function (id) { hide($(id)); });
}

/* ================= STATE ================= */
var state = 'title';           // title|levels|armory|settings|howto|playing|paused|win|lose
var settingsFrom = 'title';

var level = null, levelIdx = 0;
var enemies = [], arrows = [], bolts = [], particles = [], decals = [], texts = [], stuck = [];
var castleHP = 100, castleMax = 100, castleFlash = 0;
var keep = null, keepSmokeT = 0;   // enemy keep (second objective)
var score = 0, runGold = 0, kills = 0, arrowsShot = 0;
var elapsed = 0, spawnQ = [], waves = [], qi = 0;
var aimActive = false, aimX = 0, aimY = 0, aimPower = 0, aimDX = 1, aimDY = -0.12;
var shotCooldown = 0, hoverActive = false, lastSolve = null, uidSeq = 0, fireHeld = false;
var recoil = 0, shake = 0, lightFlash = 0, smokeT = 0;
var stormFlashTimer = 0;
var ambT = 0, introT = 0, lastWaveShown = 0;
var fpsCount = 0, fpsTime = 0;
var MAXPULL = 188;
var MAP_THEMES = ['day', 'dawn', 'sunset', 'sunsetGold', 'sunsetRose', 'sunsetEmber', 'violetDusk', 'night', 'moonlit', 'aurora', 'storm'];
var lastMapTheme = '';

function chooseMapTheme() {
  var options = MAP_THEMES.filter(function (theme) { return theme !== lastMapTheme; });
  var choice = options[Math.floor(Math.random() * options.length)] || MAP_THEMES[0];
  lastMapTheme = choice;
  return choice;
}

function diff() { return DIFFS[SETTINGS.difficulty] || DIFFS.normal; }

/* ================= NAVIGATION ================= */
function showTitle() {
  state = 'title';
  hideAllScreens(); hide(el.hud);
  show($('screen-title'));
  el.titleGold.textContent = PROGRESS.gold;
  el.titlePlayer.textContent = Player.current || 'Guest';
  var next = clamp(PROGRESS.unlocked, 1, totalLevels());
  el.titleNext.textContent = 'Level ' + next + ' — ' + LEVELS[next - 1].name;
  castleHP = castleMax = 100;
  level = null;
  keep = null;
  window.dispatchEvent(new Event('castle-title-screen'));
}
function showLevels() {
  state = 'levels'; hideAllScreens(); hide(el.hud);
  buildLevelGrid(); show($('screen-levels'));
}
function showArmory() {
  state = 'armory'; hideAllScreens(); hide(el.hud);
  buildArmory(); show($('screen-armory'));
}
function showSettings(from) {
  settingsFrom = from;
  state = 'settings'; hideAllScreens();
  if (from !== 'pause') hide(el.hud);
  show($('screen-settings'));
}
function showHowto() {
  state = 'howto'; hideAllScreens(); hide(el.hud);
  show($('screen-howto'));
}
function showProfiles() {
  state = 'profiles'; hideAllScreens(); hide(el.hud);
  buildProfileList();
  show($('screen-profiles'));
}
function buildProfileList() {
  var list = el.profileList;
  list.innerHTML = '';
  var names = Player.names();
  if (names.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'profileBtn';
    empty.style.opacity = '.55';
    empty.style.cursor = 'default';
    empty.innerHTML = '<span>No saved archers yet</span>';
    list.appendChild(empty);
  }
  names.forEach(function (name) {
    var p = Player.db.list[name] || {};
    var starsTotal = Object.keys(p.stars || {}).reduce(function (a, k) { return a + (p.stars[k] || 0); }, 0);
    var btn = document.createElement('button');
    btn.className = 'profileBtn';
    btn.innerHTML = '<span>' + name + '</span>' +
      '<span class="pMeta">' + (p.gold || 0) + 'g · ' + starsTotal + '★ · Lv ' + clamp(p.unlocked || 1, 1, totalLevels()) + '</span>';
    btn.addEventListener('click', function () {
      Sound.click();
      Player.load(name);
      showTitle();
      toast('Welcome back, ' + name + '!');
    });
    list.appendChild(btn);
  });
}

/* ================= HIGH SCORES ================= */
function showHighScores() {
  state = 'highscores'; hideAllScreens(); hide(el.hud);
  el.hsStatus.textContent = '';
  el.hsBoard.innerHTML = '<div class="hsEmpty">Loading…</div>';
  show($('screen-highscores'));
  refreshHighScores();
  highScorePollTimer = setInterval(function () {
    if (state === 'highscores' && !document.hidden) refreshHighScores();
  }, 15000);
}
function refreshHighScores() {
  el.hsStatus.textContent = Leaderboard.configured() ? 'Live' : 'Local';
  el.hsStatus.style.opacity = Leaderboard.configured() ? '1' : '.6';
  Leaderboard.fetchBoard(function (res) {
    buildHighScores(res.scores || [], res.online, res.reason);
  });
}
function buildHighScores(scores, online, reason) {
  var board = el.hsBoard;
  board.innerHTML = '';
  var note = document.createElement('div');
  note.className = 'hsNote';
  if (online) {
    note.textContent = 'Global board — cumulative kills and total playtime sync about every 5 seconds during active play.';
  } else if (Leaderboard.configured()) {
    note.textContent = 'Could not reach the global board — showing this device’s local scores.';
  } else {
    note.textContent = 'Offline board — showing this device’s scores. (Add a jsonbin.io Bin ID + key in js/leaderboard.js to share scores globally.)';
  }
  board.appendChild(note);

  if (!scores.length) {
    var empty = document.createElement('div');
    empty.className = 'hsEmpty';
    empty.textContent = 'No scores yet — go win a battle!';
    board.appendChild(empty);
    return;
  }

  var table = document.createElement('div');
  table.className = 'hsTable';
  var head = document.createElement('div');
  head.className = 'hsRow hsHead';
  head.innerHTML = '<span class="hsRank">#</span><span class="hsName">Archer</span>' +
    '<span class="hsScore">Score</span><span class="hsGold">Gold</span>' +
    '<span class="hsLvl">Level</span><span class="hsShots">Arrows Fired:</span>' +
    '<span class="hsTime">Total Time Played</span><span class="hsMeta">Highest Level Passed · Kills</span>';
  table.appendChild(head);

  scores.slice(0, 100).forEach(function (s, i) {
    var row = document.createElement('div');
    row.className = 'hsRow' + (Player.current && s.name === Player.current ? ' hsMine' : '') + (s.active ? ' hsActive' : '');
    row.innerHTML = '<span class="hsRank">' + (i + 1) + '</span>' +
      '<span class="hsName"></span>' +
      '<span class="hsScore">' + (s.score || 0) + '</span>' +
      '<span class="hsGold">' + (s.gold || 0) + 'g</span>' +
      '<span class="hsLvl">Lv ' + (s.level || 1) + '</span>' +
      '<span class="hsShots">' + (s.shots == null ? '—' : s.shots) + '</span>' +
      '<span class="hsTime">' + formatPlayedTime(s.timePlayed) + '</span>' +
      '<span class="hsMeta"></span>';
    row.querySelector('.hsName').textContent = s.name || 'Guest';
    var meta = row.querySelector('.hsMeta');
    var highestPassed = Math.max(0, (Number(s.level) || 1) - (s.won ? 0 : 1));
    meta.textContent = (highestPassed ? 'Level ' + highestPassed : 'None') + ' passed · ' + (s.kills || 0) + ' total kills';
    table.appendChild(row);
  });
  board.appendChild(table);
}

function formatPlayedTime(seconds) {
  if (seconds == null || !isFinite(Number(seconds))) return '—';
  seconds = Math.max(0, Math.floor(Number(seconds)));
  var hours = Math.floor(seconds / 3600);
  var minutes = Math.floor((seconds % 3600) / 60);
  var secs = seconds % 60;
  return hours ? hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0') : minutes + ':' + String(secs).padStart(2, '0');
}

/* ================= TOAST ================= */
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.remove('show');
  void el.toast.offsetWidth;
  el.toast.classList.add('show');
}

/* ================= LEVEL FLOW ================= */
function startLevel(idx0) {
  levelIdx = clamp(idx0, 0, totalLevels() - 1);
  level = Object.assign({}, LEVELS[levelIdx]);
  level.theme = chooseMapTheme();
  stormFlashTimer = level.theme === 'storm' ? 18 + Math.random() * 18 : 0;
  var built = buildSpawnQueue(level);
  spawnQ = built.queue; waves = built.waves; qi = 0;
  enemies = []; arrows = []; bolts = []; particles = []; decals = []; texts = []; stuck = [];
  castleMax = 100; castleHP = 100; castleFlash = 0;
  var keepMax = (300 + 22 * levelIdx) * diff().hp;
  keep = {
    hp: keepMax, maxHp: keepMax, flash: 0,
    destroyed: false, stuck: [], nagT: 0
  };
  keepSmokeT = 0;
  score = 0; runGold = 0; kills = 0; arrowsShot = 0; elapsed = 0;
  aimActive = false; aimPower = 0; aimDX = 1; aimDY = -0.12; recoil = 0;
  shotCooldown = 0; hoverActive = false; lastSolve = null; fireHeld = false;
  shake = 0; lightFlash = 0; smokeT = 0; lastWaveShown = 1;
  state = 'playing';
  hideAllScreens(); show(el.hud);
  buildAmmoBar();
  updateHUD();
  Sound.resume();
  toast('Level ' + (levelIdx + 1) + ' — ' + level.name);
}

function currentWaveNum() {
  for (var i = 0; i < waves.length; i++) if (elapsed <= waves[i].lastT) return i + 1;
  return waves.length;
}

function winLevel() {
  state = 'win';
  Sound.win();
  var ratio = castleHP / castleMax;
  var stars = ratio >= 0.7 ? 3 : (ratio >= 0.4 ? 2 : 1);
  runGold += level.gold;
  PROGRESS.gold += runGold;
  var L = levelIdx + 1;
  PROGRESS.stars[L] = Math.max(PROGRESS.stars[L] || 0, stars);
  PROGRESS.best[L] = Math.max(PROGRESS.best[L] || 0, score);
  if (levelIdx + 2 <= totalLevels()) PROGRESS.unlocked = Math.max(PROGRESS.unlocked, levelIdx + 2);
  saveProgress();
  hide(el.hud);
  el.winStars.innerHTML = '';
  for (var i = 0; i < 3; i++) {
    var s = document.createElement('span');
    s.textContent = '★';
    if (i >= stars) s.className = 'off';
    el.winStars.appendChild(s);
  }
  el.winLevel.textContent = L + ' — ' + level.name;
  el.winScore.textContent = score;
  el.winGold.textContent = '+' + runGold + 'g';
  el.winCastle.querySelector('b').textContent = Math.ceil(castleHP) + ' / ' + castleMax;
  if (levelIdx + 1 < totalLevels()) { show(el.nextBtn); el.nextBtn.textContent = 'Next Level'; }
  else { hide(el.nextBtn); }
  hideAllScreens(); show($('screen-win'));
  submitScore(true, stars);
}

function loseLevel() {
  if (state !== 'playing') return;
  state = 'lose';
  PROGRESS.gold += runGold;
  saveProgress();
  el.loseGold.textContent = '+' + runGold + 'g';
  Sound.lose();
  hide(el.hud);
  el.loseLevel.textContent = (levelIdx + 1) + ' — ' + level.name;
  el.loseScore.textContent = score;
  el.loseKills.textContent = kills;
  hideAllScreens(); show($('screen-lose'));
  submitScore(false, 0);
}

/* ---- push this run to the local + shared high-score boards ---- */
function submitScore(won, stars) {
  if (typeof Leaderboard === 'undefined') return;
  var p = PROGRESS || {};
  var entry = {
    name: Player.current || 'Guest',
    score: score,
    gold: (p.gold || 0),
    level: Math.max(levelIdx + 1, Math.max(1, (Number(p.unlocked) || 1) - 1)),
    stars: stars || 0,
    kills: Leaderboard.getTotalKills(Player.current || 'Guest'),
    shots: arrowsShot,
    timePlayed: Leaderboard.getPlayedTime(Player.current || 'Guest'),
    arrow: (p.equipped || 'std'),
    diff: (SETTINGS && SETTINGS.difficulty) || 'normal',
    won: !!won
  };
  try {
    Leaderboard.submit(entry, function (ok) {
      if (ok) toast('Score posted to the global board!');
      else if (Leaderboard.configured()) toast('Score saved (global board offline).');
    });
  } catch (e) { /* never let scoring break the game */ }
}

/* ================= ARMORY / AMMO ================= */
function buildAmmoBar() {
  el.ammoBar.innerHTML = '';
  ARROW_ORDER.forEach(function (id, i) {
    var ar = ARROWS[id];
    var owned = PROGRESS.owned.indexOf(id) >= 0;
    var b = document.createElement('button');
    b.className = 'ammoSlot' + (PROGRESS.equipped === id ? ' active' : '') + (owned ? '' : ' locked');
    b.innerHTML = '<span class="ico">' + ar.icon + '</span><span class="nm">' + ar.name + '</span>';
    b.title = ar.name + ' [' + (i + 1) + '] — ' + ar.desc;
    if (owned) b.addEventListener('click', function () { equipArrow(id); });
    else b.disabled = true;
    el.ammoBar.appendChild(b);
  });
}

function equipArrow(id) {
  if (PROGRESS.owned.indexOf(id) < 0) return;
  if (PROGRESS.equipped === id) return;
  PROGRESS.equipped = id;
  saveProgress();
  buildAmmoBar();
  Sound.click();
}

var MAX_ARROW_UPGRADES = 5;
var ARROW_UPGRADE_DAMAGE_PER_LEVEL = 0.15;
var ARROW_PURCHASE_PRICE_MULTIPLIER = 1.885;
var HIGH_TIER_ARROW_UNLOCK_ROUND = 20;
var HIGH_TIER_ARROW_PRICE_MULTIPLIER = 1.5;
var ARROW_UPGRADE_COST_STEPS = [1, 2.5, 6, 16, 42];
var ARROW_UPGRADE_PATHS = {
  std: { cost: 45, color: '#f3da8c', motif: 'diamond', names: ['Keen Edge', 'Swift Fletching', 'Twin Temper', 'Trueflight', 'Masterwork'], effects: ['Sharper point and +15% damage', 'Faster flight and stronger headshots', 'Adds reliable armor-piercing force', 'Near-perfect aim and another damage surge', 'Masterwork speed and devastating precision'] },
  broad: { cost: 80, color: '#ffc247', motif: 'blade', names: ['Razor Bevel', 'Armor Splitter', 'Warhead Barbs', 'Siegebreaker', 'Executioner Crown'], effects: ['Adds an armor-piercing point', 'Stronger strike with a tempered core', 'Pierces a second foe', 'Deepens the armor punch', 'Pierces a line of three enemies'] },
  fire: { cost: 125, color: '#ff672e', motif: 'flame', names: ['Kindled Core', 'Oil Baptism', 'Dragon Breath', 'Wildfire', 'Solar Inferno'], effects: ['Hotter burn and longer ignition', 'Adds a scorching splash', 'Burn pulses faster', 'Burning enemies ignite nearby foes', 'Inferno burn lasts longer and hits harder'] },
  triple: { cost: 145, color: '#ff9d3c', motif: 'trident', names: ['Split Fletch', 'Triad Burst', 'Fourfold Volley', 'Quiver Echo', 'Fivefold Tempest'], effects: ['Broadens and strengthens the three-arrow spread', 'Adds a fourth arrow', 'Widens the four-arrow volley', 'Adds a fifth arrow', 'A sweeping five-arrow storm'] },
  poison: { cost: 165, color: '#a8f542', motif: 'drop', names: ['Venom Coat', 'Virulent Dose', 'Nerve Rot', 'Plague Bloom', 'Abyssal Venom'], effects: ['More venom and longer poison', 'Poison ticks faster', 'Venom weakens enemy armor', 'Poison jumps to a nearby foe', 'Severe long-lasting plague damage'] },
  frost: { cost: 175, color: '#85d9ff', motif: 'snow', names: ['Rime Edge', 'Deep Freeze', 'Permafrost', 'Whiteout', 'Absolute Zero'], effects: ['Longer chill and sharper ice', 'Enemies move slower', 'Adds a chance to freeze on impact', 'Chill reaches a wider area', 'Near-freezing enemies stay locked down'] },
  pierce: { cost: 180, color: '#e4e8f0', motif: 'chevron', names: ['Hardpoint', 'Drill Tip', 'Ballista Core', 'Linebreaker', 'Worldpiercer'], effects: ['Pierces one more enemy', 'Stronger armor-drilling damage', 'Pierces a deeper line', 'More damage through armor', 'Pierces a long line of enemies'] },
  fan: { cost: 190, color: '#ffd866', motif: 'feather', names: ['Feather Split', 'Wide Arc', 'Cyclone Volley', 'Tempest Fan', 'Skyfall'], effects: ['Adds a dart to the fan', 'Adds a seventh dart', 'Adds an eighth dart', 'Adds a ninth dart', 'Ten arrows sweep the field'] },
  explosive: { cost: 240, color: '#ff783d', motif: 'burst', names: ['Spark Charge', 'Blast Casing', 'Shatterburst', 'Siege Payload', 'Starfall Bomb'], effects: ['Larger blast radius', 'Heavier explosive charge', 'Blast throws a second shock ring', 'Much wider siege explosion', 'Massive detonation with heavy splash'] },
  cluster: { cost: 280, color: '#d18aff', motif: 'cluster', names: ['Scatter Core', 'Dart Flock', 'Swarm Split', 'Cloudburst', 'Meteor Cluster'], effects: ['Splits into one extra dart', 'Darts spread across a wider cone', 'Adds two splinter darts', 'Each dart hits harder', 'A dense storm of empowered darts'] },
  lightning: { cost: 340, color: '#52efff', motif: 'bolt', names: ['Charge Node', 'Forking Bolt', 'Storm Conductor', 'Heavenstrike', 'Thunder God'], effects: ['Longer lightning reach', 'Chains to another enemy', 'Lightning deals stronger falloff damage', 'Strikes two additional enemies', 'Expanded multi-target storm strike'] },
  chain: { cost: 320, color: '#61dfff', motif: 'zigzag', names: ['Copper Conduit', 'Arc Link', 'Storm Circuit', 'Chain Reaction', 'Tempest Network'], effects: ['Longer arcs and one extra jump', 'Chain damage falls off less', 'Adds another lightning jump', 'Much longer connection range', 'A far-reaching chain of empowered arcs'] },
  glacial: { cost: 480, color: '#9cecff', motif: 'crystal', names: ['Crystal Growth', 'Cryo Focus', 'Polar Surge', 'Glacier Heart', 'Nova Crown'], effects: ['Wider freezing nova', 'Stronger and longer chill', 'Expanding crystal shockwave', 'Nova slows a broad battlefield', 'Enormous, deep-freezing blast'] },
  holy: { cost: 430, color: '#fff08a', motif: 'star', names: ['Sanctified Edge', 'Sun Sigil', 'Judgement', 'Seraphic Lance', 'Divine Cataclysm'], effects: ['More damage to bosses', 'Radiant bolt pierces another foe', 'Boss smite grows stronger', 'Holy light pierces a full rank', 'Devastating judgement against bosses'] },
  sunder: { cost: 520, color: '#ff9f52', motif: 'hammer', names: ['Maul Core', 'Fracture Rune', 'Cataclysm', 'Ruinous Impact', 'Worldshatter'], effects: ['Wider blast and armor fracture', 'Fracture lasts longer', 'Impact deals heavier splash damage', 'Larger explosion and deeper fracture', 'Crushing blast shatters armor'] },
  leech: { cost: 390, color: '#ff58a9', motif: 'orbit', names: ['Sanguine Seal', 'Deep Siphon', 'Crimson Tide', 'Life Devourer', 'Eternal Hunger'], effects: ['Siphons more health', 'Longer reach and stronger healing', 'Adds a blood-rune impact burst', 'Drains more damage into the castle', 'Massive restorative siphon'] },
  gatling: { cost: 220, color: '#54f5ff', motif: 'coil', names: ['Rapid Coil', 'Twin Dynamo', 'Overclock', 'Storm Feed', 'Infinite Arsenal'], effects: ['Faster single-bolt fire', 'Brighter bolts and faster cycling', 'Overclocked rapid fire', 'Extra speed and bolt power', 'Maximum automatic fire rate'] }
};
function getArrowUpgradeLevel(id) {
  return clamp(Math.floor(Number(PROGRESS.upgrades && PROGRESS.upgrades[id]) || 0), 0, MAX_ARROW_UPGRADES);
}
function getArrowPowerMultiplier(id) {
  return 1 + getArrowUpgradeLevel(id) * ARROW_UPGRADE_DAMAGE_PER_LEVEL;
}
function getArrowUpgradeCost(id, level) {
  var path = ARROW_UPGRADE_PATHS[id] || ARROW_UPGRADE_PATHS.std;
  return Math.round(path.cost * ARROW_UPGRADE_COST_STEPS[level]);
}
function getArrowUpgradePath(id) {
  return ARROW_UPGRADE_PATHS[id] || ARROW_UPGRADE_PATHS.std;
}
function getUpgradedArrow(id, level) {
  var source = ARROWS[id] || ARROWS.std;
  var ar = Object.assign({}, source);
  ['burn', 'slow', 'explode', 'cluster', 'chain', 'lightning', 'sunder', 'nova'].forEach(function (key) {
    if (source[key]) ar[key] = Object.assign({}, source[key]);
  });
  var n = clamp(level || 0, 0, MAX_ARROW_UPGRADES);
  if (!n) return ar;
  switch (id) {
    case 'std': ar.speed *= 1 + n * 0.055; ar.headshotBonus = n * 0.1; ar.armorPierce = n >= 3 ? 0.1 + (n - 3) * 0.04 : 0; break;
    case 'broad': ar.pierce = (ar.pierce || 0) + Math.ceil(n / 2); break;
    case 'fire': ar.burn.dps *= 1 + n * 0.18; ar.burn.dur += n * 0.32; ar.splashBurn = n >= 2 ? 45 + n * 14 : 0; ar.burn.interval = n >= 3 ? 0.36 : 0.5; break;
    case 'triple': ar.spreadCount += Math.floor(n / 2); ar.spreadSpan = 0.18 + n * 0.02; break;
    case 'poison': ar.burn.dps *= 1 + n * 0.22; ar.burn.dur += n * 0.4; ar.burn.interval = Math.max(0.22, 0.5 - n * 0.045); ar.poisonArmorBreak = n * 0.04; break;
    case 'frost': ar.slow.factor = Math.max(0.1, ar.slow.factor - n * 0.045); ar.slow.dur += n * 0.35; ar.freezeChance = n >= 3 ? (n - 2) * 0.08 : 0; ar.slow.splashRadius = n >= 4 ? 65 + n * 18 : 0; break;
    case 'pierce': ar.pierce += n; break;
    case 'fan': ar.spreadCount += n; ar.spreadSpan = 0.3 + n * 0.035; break;
    case 'explosive': ar.explode.r += n * 22; ar.explode.mult += n * 0.11; ar.explode.secondRing = n >= 3; break;
    case 'cluster': ar.cluster.count += n; ar.cluster.spread += n * 0.08; ar.cluster.damageMult = 0.55 + n * 0.07; break;
    case 'lightning': ar.lightning.targets += Math.floor(n / 2); ar.lightning.range += n * 34; ar.lightning.falloff = Math.min(0.9, ar.lightning.falloff + n * 0.025); break;
    case 'chain': ar.chain.jumps += Math.ceil(n / 2); ar.chain.range += n * 35; ar.chain.falloff = Math.min(0.88, ar.chain.falloff + n * 0.025); break;
    case 'glacial': ar.nova.r += n * 22; ar.nova.factor = Math.max(0.08, ar.nova.factor - n * 0.025); ar.nova.dur += n * 0.4; break;
    case 'holy': ar.pierce += Math.floor(n / 2); ar.holyBossMultiplier = 2 + n * 0.22; break;
    case 'sunder': ar.explode.r += n * 18; ar.explode.mult += n * 0.14; ar.sunder.mult += n * 0.09; ar.sunder.dur += n * 0.25; break;
    case 'leech': ar.leech = Math.min(0.95, ar.leech + n * 0.07); ar.leechRange = 90 + n * 28; break;
    case 'gatling': ar.cadence = Math.max(0.045, ar.cadence * (1 - n * 0.09)); ar.speed *= 1 + n * 0.035; break;
  }
  return ar;
}
function getArrowPurchaseCost(id) {
  var multiplier = ARROW_PURCHASE_PRICE_MULTIPLIER;
  if (ARROWS[id].unlock >= HIGH_TIER_ARROW_UNLOCK_ROUND) multiplier *= HIGH_TIER_ARROW_PRICE_MULTIPLIER;
  return Math.round(ARROWS[id].cost * multiplier);
}

function buildArmory() {
  el.armoryGold.textContent = PROGRESS.gold + ' gold';
  el.arrowGrid.innerHTML = '';
  ARROW_ORDER.forEach(function (id) {
    var ar = ARROWS[id];
    var owned = PROGRESS.owned.indexOf(id) >= 0;
    var eq = PROGRESS.equipped === id;
    var card = document.createElement('div');
    card.className = 'arrowCard' + (eq ? ' equipped' : '');

    var tag = '';
    if (eq) tag = '<span class="aTag">EQUIPPED</span>';
    else if (owned) tag = '<span class="aTag">OWNED</span>';
    else tag = '<span class="aTag">' + getArrowPurchaseCost(id) + 'g</span>';

    var powerLevel = getArrowUpgradeLevel(id);
    var powerMult = getArrowPowerMultiplier(id);
    var upgradePath = getArrowUpgradePath(id);
    var upgradedStats = getUpgradedArrow(id, powerLevel);
    var currentUpgradeName = powerLevel ? upgradePath.names[powerLevel - 1] : 'Base form';
    var powerPips = '<div class="powerPips" aria-label="Power level ' + powerLevel + ' of ' + MAX_ARROW_UPGRADES + '">';
    for (var pip = 0; pip < MAX_ARROW_UPGRADES; pip++) powerPips += '<i' + (pip < powerLevel ? ' class="active"' : '') + '></i>';
    powerPips += '</div>';
    card.style.setProperty('--upgrade-color', upgradePath.color);
    var stats = 'Damage <b>' + Math.round(upgradedStats.dmg * powerMult) + '</b> · Power <b>' + powerLevel + '/' + MAX_ARROW_UPGRADES + '</b> · <b>' + currentUpgradeName + '</b>';
    if (powerLevel) stats += ' · ' + upgradePath.effects[powerLevel - 1];
    if (ar.auto) stats += ' · <b>hold and aim cursor to fire automatically</b>';
    if (upgradedStats.burn) stats += ' · ' + (ar.poison ? 'Poison' : 'Burn') + ' <b>' + Math.round(upgradedStats.burn.dps * powerMult) + '/s</b> for <b>' + upgradedStats.burn.dur + 's</b>';
    if (upgradedStats.spread) stats += ' · <b>' + (upgradedStats.spreadCount || 3) + ' arrows</b> per shot';
    if (upgradedStats.pierce) stats += ' · pierces <b>' + upgradedStats.pierce + '</b> enemies';
    if (upgradedStats.explode) stats += ' · blast radius <b>' + upgradedStats.explode.r + '</b>';
    if (upgradedStats.lightning) stats += ' · calls lightning on impact, hitting up to <b>' + upgradedStats.lightning.targets + ' monsters</b>';
    if (upgradedStats.sunder) stats += ' · shatters armor, <b>+' + Math.round((upgradedStats.sunder.mult - 1) * 100) + '%</b> damage taken';
    if (upgradedStats.nova) stats += ' · <b>chills all</b> within <b>' + upgradedStats.nova.r + '</b>';
    if (upgradedStats.leech) stats += ' · heals castle <b>' + Math.round(upgradedStats.leech * 100) + '%</b> of damage';
    if (upgradedStats.speed < 1) stats += ' · slightly slower';
    if (upgradedStats.speed > 1) stats += ' · faster';

    card.innerHTML =
      '<div class="aTop"><span class="aName">' + ar.icon + ' ' + ar.name + '</span>' + tag + '</div>' +
      '<div class="aDesc">' + ar.desc + '</div>' +
      '<div class="aStats">' + stats + '</div>' + powerPips +
      (powerLevel < MAX_ARROW_UPGRADES ? '<div class="aUpgradePreview">Next: <b>' + upgradePath.names[powerLevel] + '</b> — ' + upgradePath.effects[powerLevel] + '</div>' : '');
    card.querySelector('.aName').style.color = upgradePath.color;
    if (powerLevel) card.style.boxShadow = '0 0 ' + (6 + powerLevel * 5) + 'px ' + upgradePath.color + '66';

    var btn = document.createElement('button');
    btn.className = 'btn small' + (owned ? '' : ' gold');
    if (eq) { btn.textContent = 'Equipped'; btn.disabled = true; }
    else if (owned) {
      btn.textContent = 'Equip';
      btn.addEventListener('click', function () { equipArrow(id); buildArmory(); });
    } else {
      var arrowCost = getArrowPurchaseCost(id);
      btn.textContent = 'Buy — ' + arrowCost + 'g';
      btn.disabled = PROGRESS.gold < arrowCost;
      if (!btn.disabled) btn.addEventListener('click', function () {
        PROGRESS.gold -= arrowCost;
        PROGRESS.owned.push(id);
        PROGRESS.equipped = id;
        saveProgress();
        Sound.coin();
        buildArmory();
      });
    }
    card.appendChild(btn);

    var powerBtn = document.createElement('button');
    powerBtn.className = 'btn small powerUpgrade';
    if (!owned) {
      powerBtn.textContent = 'Unlock arrow to upgrade power';
      powerBtn.disabled = true;
    } else if (powerLevel >= MAX_ARROW_UPGRADES) {
      powerBtn.textContent = 'Power Maxed (5/5)';
      powerBtn.disabled = true;
    } else {
      var powerCost = getArrowUpgradeCost(id, powerLevel);
      powerBtn.textContent = 'Upgrade ' + (powerLevel + 1) + ': ' + upgradePath.names[powerLevel] + ' — ' + powerCost + 'g';
      powerBtn.title = upgradePath.effects[powerLevel];
      powerBtn.disabled = PROGRESS.gold < powerCost;
      if (!powerBtn.disabled) powerBtn.addEventListener('click', function () {
        PROGRESS.gold -= powerCost;
        PROGRESS.upgrades = Object.assign({}, PROGRESS.upgrades || {});
        PROGRESS.upgrades[id] = powerLevel + 1;
        saveProgress();
        Sound.coin();
        buildArmory();
      });
    }
    card.appendChild(powerBtn);
    el.arrowGrid.appendChild(card);
  });
}

function buildLevelGrid() {
  el.levelGrid.innerHTML = '';
  LEVELS.forEach(function (lv, i) {
    var unlocked = levelUnlocked(i);
    var card = document.createElement('div');
    card.className = 'lvlCard' + (unlocked ? '' : ' locked') + (lv.boss ? ' boss' : '');
    var st = PROGRESS.stars[i + 1] || 0;
    var starStr = '';
    for (var s = 0; s < 3; s++) starStr += (s < st ? '★' : '<span class="off">★</span>');
    card.innerHTML =
      '<div class="num">' + (i + 1) + (lv.boss ? ' <span style="font-size:12px">BOSS</span>' : '') + '</div>' +
      '<div class="nm">' + lv.name + '</div>' +
      '<div class="gold">+' + lv.gold + 'g</div>' +
      '<div class="st">' + (st ? starStr : (unlocked ? '' : '<span style="opacity:.5">—</span>')) + '</div>' +
      (unlocked ? '' : '<span class="lockIco">🔒</span>');
    if (unlocked) card.addEventListener('click', function () { Sound.click(); startLevel(i); });
    el.levelGrid.appendChild(card);
  });
}

/* ================= INPUT ================= */
function toWorld(cx, cy) {
  var r = cv.getBoundingClientRect();
  return { x: (cx - r.left) * (W / r.width), y: (cy - r.top) * (H / r.height) };
}

function updateAimFrom(px, py) {
  aimX = px; aimY = py;
  var dx = BOW.x - px, dy = BOW.y - py;
  var len = Math.hypot(dx, dy);
  aimPower = clamp(len / MAXPULL, 0, 1);
  if (len > 8) { aimDX = dx / len; aimDY = dy / len; }
}

function isAuto() { return SETTINGS.shootStyle !== 'drag'; }

/* Solve a launch velocity from the bow that passes through (tx, ty).
   Low-arc solution; raises speed until the point is reachable.
   Close targets (enemies at the wall) get a direct-fire shot. */
function solveBallistic(tx, ty, speedMultiplier) {
  speedMultiplier = speedMultiplier || 1;
  var dx = tx - BOW.x;
  if (dx < 6) { tx = BOW.x + 6; dx = 6; }
  var g = GRAVITY;
  if (dx < 188) {
    var dist = Math.hypot(dx, ty - BOW.y);
    var t = dist / (2063 * speedMultiplier);
    var vx = dx / t;
    var vy = (ty - BOW.y) / t - 0.5 * g * t;
    return { vx: vx, vy: vy, v: Math.hypot(vx, vy) };
  }
  var dyUp = BOW.y - ty; // positive when target is above the bow (y-up math)
  var v = 1950 * speedMultiplier;
  for (var i = 0; i < 9; i++) {
    var a = g * dx * dx / (2 * v * v);
    var D = dx * dx - 4 * a * (dyUp + a);
    if (D >= 0) {
      var tan = (dx - Math.sqrt(D)) / (2 * a); // flatter trajectory
      var inv = 1 / Math.sqrt(1 + tan * tan);
      return { vx: v * inv, vy: -v * tan * inv, v: v };
    }
    v *= 1.28;
  }
  return null;
}

function autoFire(tx, ty) {
  if (state !== 'playing' || shotCooldown > 0) return;
  var ar = ARROWS[PROGRESS.equipped] || ARROWS.std;
  var tunedArrow = getUpgradedArrow(ar.id, getArrowUpgradeLevel(ar.id));
  var sol = ar.id === 'gatling' ? solveGatlingAim(tx, ty) : solveBallistic(tx, ty, tunedArrow.speed);
  if (!sol) return;
  aimX = tx; aimY = ty;
  aimDX = sol.vx; aimDY = sol.vy;
  aimPower = clamp(sol.v / 1875, 0.35, 1);
  spawnVolley(ar, sol.vx, sol.vy, 0.85);
  Sound.shoot();
  recoil = 1;
  shotCooldown = getUpgradedArrow(ar.id, getArrowUpgradeLevel(ar.id)).cadence || 0.42;
}

function solveGatlingAim(tx, ty) {
  var dx = tx - BOW.x, dy = ty - BOW.y;
  var gatling = getUpgradedArrow('gatling', getArrowUpgradeLevel('gatling'));
  if (dx >= 0) return solveBallistic(tx, ty, ga…5717 tokens truncated…);
        addText(a.x, a.y - 14, 'HEADSHOT!', '#ffd25a', 18, 1);
      } else {
        Sound.hit();
      }

      // holy bolts shred bosses
      if (a.holy && e.def.boss) {
        dmg *= a.holyBossMultiplier || 2;
        addText(a.x, a.y - 26, 'SMITE!', '#fff3c4', 16, 1);
      }

      spawnBlood(a.x, a.y, head ? 12 : 7);
      if (SETTINGS.dmgNums) addText(a.x + 6, a.y - 6, Math.round(dmg) + (head ? '!' : ''), head ? '#ffd25a' : '#f0f0f0', head ? 16 : 13, 0.7);

      if (a.burn && e.state !== 'dying') {
        e.burn = a.burn.dur;
        e.burnDps = a.burn.dps;
        e.burnInterval = a.burn.interval || 0.5;
        e.burnTick = Math.min(0.4, e.burnInterval);
        e.burnKind = a.poison ? 'poison' : 'fire';
      }
      if (a.poisonArmorBreak && e.state !== 'dying') {
        e.armorWeak = Math.max(e.armorWeak || 0, a.poisonArmorBreak);
        e.armorWeakTimer = 3 + a.upgradeLevel * 0.35;
        addText(a.x, a.y - 30, 'VENOM BREAK', '#a8f542', 12, 0.7);
      }
      if (a.poison && a.upgradeLevel >= 4) {
        var plagueTarget = null, plagueDist = 160;
        for (var pi = 0; pi < enemies.length; pi++) {
          var plague = enemies[pi];
          if (plague === e || plague.state === 'dying') continue;
          var pd = Math.hypot(plague.x + plague.w / 2 - (e.x + e.w / 2), plague.h - e.h);
          if (pd < plagueDist) { plagueDist = pd; plagueTarget = plague; }
        }
        if (plagueTarget) {
          plagueTarget.burn = Math.max(plagueTarget.burn, a.burn.dur * 0.65);
          plagueTarget.burnDps = Math.max(plagueTarget.burnDps, a.burn.dps * 0.6);
          plagueTarget.burnInterval = a.burn.interval;
          plagueTarget.burnTick = a.burn.interval;
          plagueTarget.burnKind = 'poison';
          plagueTarget.armorWeak = Math.max(plagueTarget.armorWeak || 0, a.poisonArmorBreak);
          plagueTarget.armorWeakTimer = 3 + a.upgradeLevel * 0.35;
          addText(plagueTarget.x + plagueTarget.w / 2, GROUND - plagueTarget.h - 18, 'PLAGUE!', '#a8f542', 13, 0.8);
        }
      }
      if (a.type === 'fire' && a.upgradeLevel >= 4 && a.burn) {
        var wildCount = 0;
        for (var wi = 0; wi < enemies.length; wi++) {
          var wild = enemies[wi];
          if (wild === e || wild.state === 'dying' || wild.burn > 0) continue;
          if (Math.hypot(wild.x + wild.w / 2 - (e.x + e.w / 2), wild.h - e.h) > 135) continue;
          wild.burn = a.burn.dur * 0.7;
          wild.burnDps = a.burn.dps * 0.55;
          wild.burnTick = 0.35;
          wild.burnInterval = 0.35;
          wild.burnKind = 'fire';
          spawnFlame(wild.x + wild.w / 2, GROUND - wild.h * 0.55, 'fire');
          wildCount++;
        }
        if (wildCount) addText(e.x + e.w / 2, GROUND - e.h - 35, 'WILDFIRE!', '#ff7a38', 14, 0.8);
      }

      // frost chill
      if (a.slow && e.state !== 'dying') {
        e.slow = Math.max(e.slow, a.slow.dur);
        e.slowFactor = a.slow.factor;
        addText(a.x, a.y - 20, 'CHILLED', '#9fd8ff', 13, 0.8);
        if (a.freezeChance && Math.random() < a.freezeChance) {
          e.slow = Math.max(e.slow, 1.1);
          e.slowFactor = 0;
          addText(a.x, a.y - 40, 'FROZEN!', '#bff4ff', 14, 0.8);
        }
        if (a.slow.splashRadius) {
          for (var fs = 0; fs < enemies.length; fs++) {
            var frostTarget = enemies[fs];
            if (frostTarget === e || frostTarget.state === 'dying') continue;
            var frostDist = Math.hypot(frostTarget.x + frostTarget.w / 2 - (e.x + e.w / 2), frostTarget.h - e.h);
            if (frostDist > a.slow.splashRadius) continue;
            frostTarget.slow = Math.max(frostTarget.slow, a.slow.dur * 0.65);
            frostTarget.slowFactor = Math.min(frostTarget.slowFactor || 1, a.slow.factor);
            particles.push({ kind: 'arcaneRing', x: frostTarget.x + frostTarget.w / 2, y: GROUND - frostTarget.h * 0.5,
              r: 4, vr: 100, life: 0.28, maxLife: 0.28, tint: getArrowUpgradePath('frost').color });
          }
        }
      }

      // sunder cracks the target's armor so follow-up hits land harder
      if (a.sunder && e.state !== 'dying') {
        e.sunder = a.sunder.dur;
        e.sunderMult = a.sunder.mult;
        addText(a.x, a.y - 24, 'SUNDER!', '#ffd08a', 15, 0.9);
      }
      if (e.sunder > 0) dmg *= e.sunderMult;

      var boom = a.explode;
      damageEnemy(e, dmg, { head: head, arrow: a });
      spawnArcaneBurst(a.x, a.y, a.type);
      spawnUpgradeImpact(a.x, a.y, a.type, a.upgradeLevel || 0);

      // Lightning Shot calls repeated bolts down onto nearby living monsters.
      if (a.lightning && !boom) {
        var zap = a.lightning;
        var struck = Object.create(null);
        struck[e.uid] = true;
        spawnLightningStrike(e.x + e.w / 2, GROUND - e.h * 0.55);
        for (var z = 1; z < zap.targets; z++) {
          var target = null, targetDist = zap.range;
          for (var zi = 0; zi < enemies.length; zi++) {
            var candidate = enemies[zi];
            if (candidate.state === 'dying' || struck[candidate.uid]) continue;
            var dist = Math.hypot(candidate.x + candidate.w / 2 - a.x, GROUND - candidate.h * 0.5 - a.y);
            if (dist < targetDist) { targetDist = dist; target = candidate; }
          }
          if (!target) break;
          struck[target.uid] = true;
          var tx = target.x + target.w / 2, ty = GROUND - target.h * 0.55;
          spawnLightningStrike(tx, ty);
          spawnArcaneBurst(tx, ty, 'lightning');
          var zapDamage = dmg * Math.pow(zap.falloff, z);
          if (target.def.armor && !a.holy) zapDamage *= target.def.armor;
          damageEnemy(target, zapDamage, {});
          addText(tx, ty - 14, 'ZAP!', '#a8f4ff', 14, 0.7);
        }
      }

      // glacial nova chills everything around the impact
      if (a.nova) {
        var nr = a.nova.r;
        for (var nv = 0; nv < enemies.length; nv++) {
          var ne = enemies[nv];
          if (ne.state === 'dying') continue;
          var nd = Math.hypot(ne.x + ne.w / 2 - a.x, GROUND - ne.h * 0.5 - a.y);
          if (nd > nr) continue;
          ne.slow = Math.max(ne.slow, a.nova.dur);
          ne.slowFactor = Math.min(ne.slowFactor || 1, a.nova.factor);
        }
        for (var np = 0; np < 16; np++) {
          var nang = (np / 16) * Math.PI * 2;
          particles.push({
            kind: 'smoke', x: a.x, y: a.y,
            vx: Math.cos(nang) * 150, vy: Math.sin(nang) * 90 - 30,
            r: 5 + Math.random() * 4, life: 0.4, tint: 'frost'
          });
        }
        addText(a.x, a.y - 26, 'NOVA!', '#9fd8ff', 16, 0.9);
      }

      // leech siphons part of the damage back into the castle wall
      if (a.splashBurn) {
        for (var fi = 0; fi < enemies.length; fi++) {
          var fe = enemies[fi];
          if (fe === e || fe.state === 'dying' || Math.hypot(fe.x + fe.w / 2 - (e.x + e.w / 2), fe.h - e.h) > a.splashBurn) continue;
          fe.burn = Math.max(fe.burn, a.burn.dur * 0.45);
          fe.burnDps = Math.max(fe.burnDps, a.burn.dps * 0.3);
          fe.burnTick = 0.35; fe.burnInterval = 0.35; fe.burnKind = 'fire';
          spawnFlame(fe.x + fe.w / 2, GROUND - fe.h * 0.5, 'fire');
        }
      }

      if (a.leech) {
        var heal = Math.round(dmg * a.leech);
        if (heal > 0) {
          castleHP = Math.min(castleMax, castleHP + heal);
          addText(a.x, a.y - 34, '+' + heal + ' HP', '#8effa0', 13, 0.85);
          if (a.leechRange) {
            for (var li = 0; li < enemies.length; li++) {
              var le = enemies[li];
              if (le === e || le.state === 'dying') continue;
              var ld = Math.hypot(le.x + le.w / 2 - (e.x + e.w / 2), le.h - e.h);
              if (ld < a.leechRange) {
                var siphon = dmg * a.leech * 0.18;
                damageEnemy(le, siphon, {});
                castleHP = Math.min(castleMax, castleHP + siphon * a.leech * 0.5);
              }
            }
          }
        }
      }

      // chain lightning jumps to nearby foes
      if (a.chain && !boom) {
        var ch = a.chain;
        var fromX = a.x, fromY = a.y;
        var lastUid = e.uid;
        var curDmg = dmg * ch.falloff;
        for (var c = 0; c < ch.jumps; c++) {
          var best = null, bestD = ch.range;
          for (var k = 0; k < enemies.length; k++) {
            var oe = enemies[k];
            if (oe.state === 'dying' || oe.uid === lastUid) continue;
            var d = Math.hypot(oe.x + oe.w / 2 - fromX, GROUND - oe.h * 0.5 - fromY);
            if (d < bestD) { bestD = d; best = oe; }
          }
          if (!best) break;
          // zap particle trail
          for (var s = 0; s < 5; s++) {
            var st = s / 4;
            particles.push({
              kind: 'spark',
              x: fromX + (best.x + best.w / 2 - fromX) * st,
              y: fromY + (GROUND - best.h * 0.5 - fromY) * st,
              vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40,
              r: 1.4, life: 0.16
            });
          }
          addText(best.x + best.w / 2, GROUND - best.h - 10, 'ZAP!', '#ffe066', 13, 0.7);
          spawnArcaneBurst(best.x + best.w / 2, GROUND - best.h * 0.5, 'chain');
          damageEnemy(best, curDmg, {});
          curDmg *= ch.falloff;
          lastUid = best.uid;
          fromX = best.x + best.w / 2; fromY = GROUND - best.h * 0.5;
        }
      }

      if (boom) {
        explodeAt(a.x, a.y, a);
        arrows.splice(i, 1);
        consumed = true;
        break;
      }
      if (a.pierceLeft > 0) {
        a.pierceLeft--;
        a.lastHitUid = e.uid;
        a.dmg *= 0.75;
        continue;
      }
      consumed = true;
      break;
    }
    if (consumed) { arrows.splice(i, 1); continue; }

    // enemy keep (second objective) — arrows lodge in the stonework
    if (keep && !keep.destroyed &&
        a.x >= KEEP_BOX.x && a.x <= KEEP_BOX.x + KEEP_BOX.w &&
        a.y >= KEEP_BOX.top && a.y <= GROUND) {
      var kdmg = a.dmg * (0.5 + 0.5 * a.power);
      damageKeep(kdmg, a.x, a.y);
      spawnArcaneBurst(a.x, a.y, a.type);
      spawnUpgradeImpact(a.x, a.y, a.type, a.upgradeLevel || 0);
      spawnSparks(a.x, a.y);
      Sound.buildHit();
      if (!a.explode) {
        keep.stuck.push({
          x: a.x, y: a.y, rot: a.rot,
          fletch: arrowFletchColor(a.type)
        });
        if (keep.stuck.length > 26) keep.stuck.shift();
      } else {
        explodeAt(a.x, a.y, a);
      }
      arrows.splice(i, 1);
      continue;
    }

    // ground
    if (a.y >= GROUND) {
      spawnArcaneBurst(a.x, GROUND - 6, a.type);
      spawnUpgradeImpact(a.x, GROUND - 6, a.type, a.upgradeLevel || 0);
      if (a.explode && a.x > WALL_W + 6) explodeAt(a.x, GROUND - 6, a);
      else if (a.x > WALL_W + 6) {
        stuck.push({
          x: a.x, y: GROUND - 1,
          rot: clamp(a.rot, 0.5, 1.25),
          fletch: arrowFletchColor(a.type)
        });
        if (stuck.length > 40) stuck.shift();
        Sound.ground();
      }
      arrows.splice(i, 1);
      continue;
    }
    // offscreen
    if (a.x > W + 90 || a.x < -90 || a.y > H + 40) arrows.splice(i, 1);
  }
}

function updateBolts(dt) {
  for (var i = bolts.length - 1; i >= 0; i--) {
    var b = bolts[i];
    b.vy += GRAVITY * 0.4 * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot = Math.atan2(b.vy, b.vx);
    if (b.x <= WALL_W + 4) {
      castleHit(b.dmg);
      spawnSparks(WALL_W + 6, clamp(b.y, WALL_TOP + 10, GROUND));
      bolts.splice(i, 1);
      continue;
    }
    if (b.y >= GROUND || b.x < -40) bolts.splice(i, 1);
  }
}

function updateEnemies(dt) {
  for (var i = enemies.length - 1; i >= 0; i--) {
    var e = enemies[i];
    e.t += dt;

    if (e.state === 'dying') {
      e.deathT += dt;
      e.deathRot = Math.min(1, e.deathT / 0.55) * (Math.PI / 2) * 0.92;
      e.alpha = e.deathT > 0.55 ? Math.max(0, 1 - (e.deathT - 0.55) / 0.4) : 1;
      if (e.deathT > 0.95) enemies.splice(i, 1);
      continue;
    }

    // burn DOT
    if (e.burn > 0) {
      e.burn -= dt;
      e.burnTick -= dt;
      if (Math.random() < dt * 22) spawnFlame(e.x + e.w / 2, GROUND - e.h * 0.5, e.burnKind);
      if (e.burnTick <= 0) {
        e.burnTick = e.burnInterval || 0.5;
        damageEnemy(e, e.burnDps * 0.5, {});
        if (e.state === 'dying') continue;
      }
    }

    if (e.armorWeakTimer > 0) {
      e.armorWeakTimer -= dt;
      if (e.armorWeakTimer <= 0) { e.armorWeakTimer = 0; e.armorWeak = 0; }
    }

    if (e.shotAnim > 0) e.shotAnim -= dt;

    // sunder armor-crack wears off
    if (e.sunder > 0) {
      e.sunder -= dt;
      if (e.sunder <= 0) { e.sunder = 0; e.sunderMult = 1; }
      else if (Math.random() < dt * 6) {
        particles.push({
          kind: 'spark', x: e.x + e.w / 2 + (Math.random() - 0.5) * e.w,
          y: GROUND - Math.random() * e.h,
          vx: (Math.random() - 0.5) * 30, vy: (Math.random() - 0.5) * 30,
          r: 1.6, life: 0.3
        });
      }
    }

    // frost slow
    var spdMul = 1;
    if (e.slow > 0) {
      e.slow -= dt;
      spdMul = e.slowFactor;
      if (e.slow <= 0) e.slowFactor = 1;
      if (Math.random() < dt * 8) {
        particles.push({
          kind: 'smoke', x: e.x + e.w / 2 + (Math.random() - 0.5) * e.w, y: GROUND - Math.random() * e.h,
          vx: (Math.random() - 0.5) * 20, vy: -12 - Math.random() * 18,
          r: 3 + Math.random() * 4, life: 0.5 + Math.random() * 0.4, tint: 'frost'
        });
      }
    }

    // Necromancers mend the nearest wounded ally on a short cooldown.
    if (e.def.healer) {
      e.healTimer -= dt;
      if (e.healTimer <= 0) {
        var patient = null, patientDist = e.def.healRange;
        for (var hi = 0; hi < enemies.length; hi++) {
          var ally = enemies[hi];
          if (ally === e || ally.state === 'dying' || ally.hp >= ally.maxHp) continue;
          var hd = Math.abs(ally.x + ally.w / 2 - (e.x + e.w / 2));
          if (hd < patientDist) { patientDist = hd; patient = ally; }
        }
        if (patient) {
          var restored = Math.min(e.def.healAmount, patient.maxHp - patient.hp);
          patient.hp += restored;
          e.healTimer = e.def.healEvery;
          var hx = patient.x + patient.w / 2, hy = GROUND - patient.h * 0.55;
          particles.push({ kind: 'arcaneRing', x: hx, y: hy, r: 8, vr: 130, life: 0.45, maxLife: 0.45, tint: '#9c75ff' });
          addText(hx, hy - 18, '+' + Math.round(restored) + ' HP', '#c6a6ff', 13, 0.8);
        } else {
          e.healTimer = 0.7;
        }
      }
    }

    if (e.def.ranged) {
      if (e.x > e.stopX) {
        e.state = 'walk';
        e.x -= e.speed * spdMul * dt;
        e.walkT += dt * e.speed * spdMul * 0.02;
      } else {
        e.state = 'shoot';
        e.shotTimer -= dt;
        if (e.shotTimer <= 0) {
          e.shotTimer = e.def.shotEvery;
          fireBolt(e);
        }
      }
    } else if (e.x > WALL_W) {
      e.state = 'walk';
      e.x -= e.speed * spdMul * dt;
      e.walkT += dt * e.speed * spdMul * 0.02;
    } else {
      e.state = 'attack';
      e.x = WALL_W;
      e.attackTimer -= dt;
      e.attackT = clamp(1 - e.attackTimer / 1.1, 0, 1);
      if (!e.didHit && e.attackTimer <= 0.35) {
        e.didHit = true;
        castleHit(e.dmg);
        spawnSparks(WALL_W + 6, clamp(GROUND - e.h * 0.5, WALL_TOP + 10, GROUND));
      }
      if (e.attackTimer <= 0) {
        e.attackTimer = 1.1;
        e.didHit = false;
        e.attackT = 0;
      }
    }
  }
}

function updateParticles(dt) {
  for (var i = particles.length - 1; i >= 0; i--) {
    var p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      if (p.kind === 'blood') addBloodDecal(p.x, GROUND + 1 + Math.random() * 3, false);
      particles.splice(i, 1);
      continue;
    }
    if (p.kind === 'blood') {
      p.vy += GRAVITY * 0.65 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y >= GROUND) { p.life = 0; }
    } else if (p.kind === 'spark') {
      p.vy += GRAVITY * 0.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else if (p.kind === 'flame') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r *= 0.985;
    } else if (p.kind === 'smoke') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.r += dt * 9;
    } else if (p.kind === 'arcane') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.rot += p.spin * dt;
      p.r *= 0.985;
    } else if (p.kind === 'arcaneRing') {
      p.r += p.vr * dt;
    }
  }
  if (particles.length > 620) particles.splice(0, particles.length - 620);
}

function updateTexts(dt) {
  for (var i = texts.length - 1; i >= 0; i--) {
    var t = texts[i];
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= 0.94;
    if (t.life <= 0) texts.splice(i, 1);
  }
}

function updateDecals(dt) {
  for (var i = decals.length - 1; i >= 0; i--) {
    decals[i].life -= dt;
    if (decals[i].life <= 0) decals.splice(i, 1);
  }
}

/* ================= HUD ================= */
function updateHUD() {
  var ratio = castleHP / castleMax;
  el.hpFill.style.width = (ratio * 100) + '%';
  el.hpFill.classList.toggle('low', ratio < 0.35);
  el.hpText.textContent = Math.ceil(castleHP) + ' / ' + castleMax;
  if (keep && el.keepFill) {
    var kr = Math.max(0, keep.hp / keep.maxHp);
    el.keepFill.style.width = (kr * 100) + '%';
    el.keepFill.classList.toggle('low', kr < 0.35);
    el.keepText.textContent = keep.destroyed ? 'CASTLE DESTROYED' : Math.ceil(keep.hp) + ' / ' + Math.round(keep.maxHp);
  }
  el.scoreVal.textContent = score;
  el.roundVal.textContent = levelIdx + 1;
  el.goldVal.textContent = runGold;
  var alive = enemies.length;
  var pending = spawnQ.length - qi;
  el.waveInfo.textContent = 'Wave ' + currentWaveNum() + '/' + waves.length +
    '  ·  Enemies ' + (alive + pending);
  if (aimActive || (isAuto() && hoverActive && state === 'playing')) {
    show(el.powerWrap);
    if (isAuto()) {
      var ar = ARROWS[PROGRESS.equipped] || ARROWS.std;
      var cd = ar.cadence || 0.42;
      var ready = 1 - (shotCooldown / cd);
      el.powerFill.style.width = (clamp(ready, 0, 1) * 100) + '%';
      el.powerFill.classList.toggle('low', shotCooldown > 0.02);
    } else {
      el.powerFill.style.width = (aimPower * 100) + '%';
      el.powerFill.classList.remove('low');
    }
  } else {
    hide(el.powerWrap);
  }
}

/* ================= RENDER ================= */
function render() {
  ctx.setTransform(VIEW_SCALE, 0, 0, VIEW_SCALE, 0, 0);
  ctx.clearRect(0, 0, W, H);

  var theme = level ? level.theme : 'day';
  var sh = (SETTINGS.shake && shake > 0.2) ? shake : 0;
  if (sh > 0) ctx.translate((Math.random() - 0.5) * sh * 2, (Math.random() - 0.5) * sh * 2);

  drawBackground(ctx, theme, ambT);
  drawGround(ctx, theme);

  // stuck arrows
  for (var i = 0; i < stuck.length; i++) drawStuckArrow(ctx, stuck[i]);
  // blood decals
  for (var i = 0; i < decals.length; i++) if (decals[i].kind === 'blood') drawBloodDecal(ctx, decals[i]);

  // castle
  var hpRatio = castleMax > 0 ? castleHP / castleMax : 1;
  drawCastle(ctx, castleFlash, hpRatio, ambT);

  // enemy keep (behind its troops)
  drawEnemyCastle(ctx, keep, ambT);

  // enemies (dying behind living)
  var sorted = enemies.slice().sort(function (a, b) {
    return (a.state === 'dying' ? 1 : 0) - (b.state === 'dying' ? 1 : 0);
  });
  for (var i = 0; i < sorted.length; i++) drawEnemy(ctx, sorted[i]);

  // bolts
  for (var i = 0; i < bolts.length; i++) drawBoltEnt(ctx, bolts[i]);

  // archer
  drawArcher(ctx, {
    t: ambT,
    aiming: (aimActive || (isAuto() && hoverActive)) && state === 'playing',
    power: state === 'playing' ? aimPower : 0,
    dirX: aimDX, dirY: aimDY,
    arrowId: PROGRESS.equipped,
    recoil: recoil
  });

  // arrows in flight
  for (var i = 0; i < arrows.length; i++) drawArrowEnt(ctx, arrows[i]);

  // particles
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var a = clamp(p.life / 0.5, 0, 1);
    if (p.kind === 'blood') {
      ctx.globalAlpha = a;
      ctx.fillStyle = '#8c1210';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    } else if (p.kind === 'flame') {
      ctx.globalAlpha = a * 0.9;
      ctx.fillStyle = p.tint === 'poison'
        ? (Math.random() > 0.5 ? '#9be85c' : '#5cb832')
        : (Math.random() > 0.5 ? '#ff9a3c' : '#ff5a28');
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    } else if (p.kind === 'smoke') {
      ctx.globalAlpha = clamp(p.life / 2, 0, 0.4);
      ctx.fillStyle = p.tint === 'frost' ? '#9fd8ff' : '#555a60';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
    } else if (p.kind === 'arcaneRing') {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1) * 0.85;
      ctx.strokeStyle = p.tint;
      ctx.shadowColor = p.tint;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (p.kind === 'lightning') {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.shadowColor = '#68dcff'; ctx.shadowBlur = 18;
      ctx.strokeStyle = '#68dcff'; ctx.lineWidth = 5; ctx.lineJoin = 'round';
      ctx.beginPath();
      for (var lp = 0; lp < p.points.length; lp++) {
        if (lp === 0) ctx.moveTo(p.points[lp].x, p.points[lp].y);
        else ctx.lineTo(p.points[lp].x, p.points[lp].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = '#efffff'; ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'arcane') {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.shadowColor = p.tint;
      ctx.shadowBlur = 12;
      ctx.fillStyle = p.tint;
      ctx.beginPath();
      ctx.moveTo(0, -p.r * 1.6); ctx.lineTo(p.r * 0.65, 0);
      ctx.lineTo(0, p.r * 1.6); ctx.lineTo(-p.r * 0.65, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  // trajectory preview
  var showTraj = state === 'playing' && SETTINGS.trajectory &&
    (isAuto() ? (hoverActive && !!lastSolve) : (aimActive && aimPower > 0.06));
  if (showTraj) {
    var vx, vy;
    if (isAuto()) {
      vx = lastSolve.vx; vy = lastSolve.vy;
    } else {
      var ar = ARROWS[PROGRESS.equipped] || ARROWS.std;
      var len = Math.hypot(aimDX, aimDY) || 1;
      var speed = (671 + aimPower * 1375) * ar.speed;
      vx = (aimDX / len) * speed; vy = (aimDY / len) * speed;
    }
    var px = BOW.x, py = BOW.y;
    var sdt = 1 / 90;
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (var s = 0; s < 130; s++) {
      vy += GRAVITY * sdt;
      px += vx * sdt;
      py += vy * sdt;
      if (py >= GROUND || px > W + 40) break;
      if (s % 6 === 0) {
        var k = 1 - s / 130;
        ctx.globalAlpha = 0.15 + k * 0.55;
        ctx.beginPath(); ctx.arc(px, py, 1.4 + k * 1.8, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // weather & shade
  var th = THEMES[theme] || THEMES.day;
  if (th.rain) drawRain(ctx, ambT);
  if (th.night) drawNightShade(ctx);
  if (lightFlash > 0.01) {
    ctx.fillStyle = 'rgba(235,242,255,' + (lightFlash * 0.4) + ')';
    ctx.fillRect(-20, -20, W + 40, H + 40);
  }

  // floating texts
  ctx.textAlign = 'center';
  for (var i = 0; i < texts.length; i++) {
    var t = texts[i];
    ctx.globalAlpha = clamp(t.life / t.max, 0, 1);
    ctx.font = 'bold ' + t.size + 'px Georgia';
    ctx.strokeStyle = 'rgba(0,0,0,.8)';
    ctx.lineWidth = 3;
    ctx.strokeText(t.txt, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  drawVignette(ctx);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ================= LOOP (target FPS) ================= */
var lastT = performance.now();
var acc = 0;

function loop(now) {
  requestAnimationFrame(loop);
  var target = SETTINGS.fps;
  var actualDelta = Math.max(0, now - lastT);
  var dtRaw = actualDelta;
  lastT = now;
  if (state === 'playing') {
    var playerName = Player.current || 'Guest';
    Leaderboard.trackTime(playerName, Math.min(actualDelta, 30000) / 1000, {
      score: score,
      gold: (PROGRESS.gold || 0) + runGold,
      level: Math.max(levelIdx + 1, Math.max(1, (Number(PROGRESS.unlocked) || 1) - 1)),
      stars: 0,
      kills: Leaderboard.getTotalKills(playerName),
      shots: arrowsShot,
      arrow: (PROGRESS.equipped || 'std'),
      diff: (SETTINGS && SETTINGS.difficulty) || 'normal',
      won: false
    });
  }
  if (dtRaw > 250) dtRaw = 250;

  if (target <= 0) {
    step(dtRaw / 1000);
    fpsCount++; fpsTime += dtRaw;
  } else {
    var stepMs = 1000 / target;
    acc += dtRaw;
    var n = 0;
    while (acc >= stepMs && n < 6) {
      step(stepMs / 1000);
      acc -= stepMs;
      n++;
      fpsCount++; fpsTime += stepMs;
    }
    if (acc > stepMs * 6) acc = 0;
  }

  if (fpsTime >= 500) {
    el.fpsVal.textContent = Math.round(fpsCount / (fpsTime / 1000));
    fpsCount = 0; fpsTime = 0;
  }

  if (state === 'playing' || state === 'paused' || state === 'win' || state === 'lose') updateHUD();
  render();
}

/* ================= UI WIRING ================= */
document.addEventListener('click', function (ev) {
  var btn = ev.target.closest ? ev.target.closest('[data-action]') : null;
  if (!btn) return;
  Sound.click();
  Sound.resume();
  var act = btn.dataset.action;
  if (act === 'play') startLevel(clamp(PROGRESS.unlocked, 1, totalLevels()) - 1);
  else if (act === 'levels') showLevels();
  else if (act === 'armory') showArmory();
  else if (act === 'highscores') showHighScores();
  else if (act === 'hsRefresh') refreshHighScores();
  else if (act === 'profiles') showProfiles();
  else if (act === 'settings') showSettings('title');
  else if (act === 'howto') showHowto();
  else if (act === 'menu') showTitle();
  else if (act === 'resume') resumeGame();
  else if (act === 'pauseSettings') showSettings('pause');
  else if (act === 'settingsBack') {
    if (settingsFrom === 'pause') { hideAllScreens(); show($('screen-pause')); state = 'paused'; }
    else showTitle();
  }
  else if (act === 'quit') showTitle();
  else if (act === 'retry') startLevel(levelIdx);
  else if (act === 'replay') startLevel(levelIdx);
  else if (act === 'next') startLevel(Math.min(levelIdx + 1, totalLevels() - 1));
});

$('pauseBtn').addEventListener('click', function (e) {
  e.stopPropagation();
  pauseGame();
});

/* settings bindings */
function bindSettings() {
  el.setFps.value = String(SETTINGS.fps);
  el.setFpsCounter.checked = !!SETTINGS.fpsCounter;
  el.setBlood.value = String(SETTINGS.blood);
  el.setDiff.value = SETTINGS.difficulty;
  el.setShootStyle.value = SETTINGS.shootStyle === 'drag' ? 'drag' : 'auto';
  el.setTraj.checked = !!SETTINGS.trajectory;
  el.setDmgNums.checked = !!SETTINGS.dmgNums;
  el.setShake.checked = !!SETTINGS.shake;
  el.setShakeState.textContent = SETTINGS.shake ? 'On' : 'Off';
  el.setVol.value = String(SETTINGS.volume);
  el.volVal.textContent = SETTINGS.volume;
  el.setMute.checked = !!SETTINGS.mute;
  el.fpsWrap.classList.toggle('hidden', !SETTINGS.fpsCounter);

  el.setFps.addEventListener('change', function () { SETTINGS.fps = parseInt(el.setFps.value, 10); saveSettings(); });
  el.setFpsCounter.addEventListener('change', function () { SETTINGS.fpsCounter = el.setFpsCounter.checked; el.fpsWrap.classList.toggle('hidden', !SETTINGS.fpsCounter); saveSettings(); });
  el.setBlood.addEventListener('change', function () { SETTINGS.blood = parseInt(el.setBlood.value, 10); saveSettings(); });
  el.setDiff.addEventListener('change', function () { SETTINGS.difficulty = el.setDiff.value; saveSettings(); });
  el.setShootStyle.addEventListener('change', function () {
    SETTINGS.shootStyle = el.setShootStyle.value === 'drag' ? 'drag' : 'auto';
    aimActive = false; lastSolve = null; saveSettings();
  });
  el.setTraj.addEventListener('change', function () { SETTINGS.trajectory = el.setTraj.checked; saveSettings(); });
  el.setDmgNums.addEventListener('change', function () { SETTINGS.dmgNums = el.setDmgNums.checked; saveSettings(); });
  el.setShake.addEventListener('change', function () { SETTINGS.shake = el.setShake.checked; el.setShakeState.textContent = SETTINGS.shake ? 'On' : 'Off'; saveSettings(); });
  el.setVol.addEventListener('input', function () { SETTINGS.volume = parseInt(el.setVol.value, 10); el.volVal.textContent = SETTINGS.volume; saveSettings(); Sound.refresh(); });
  el.setMute.addEventListener('change', function () { SETTINGS.mute = el.setMute.checked; saveSettings(); Sound.refresh(); });

  $('resetProgress').addEventListener('click', function () {
    if (!confirm('Reset all progress: unlocked levels, stars, gold and purchased arrows?')) return;
    Store.clear('cr_progress');
    PROGRESS = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
    if (Player.current) {
      Player.db.list[Player.current] = JSON.parse(JSON.stringify(DEFAULT_PROGRESS));
      Store.set('cr_players', Player.db);
    }
    saveProgress();
    buildLevelGrid();
    Sound.click();
  });

  function createProfile() {
    var name = Player.create(el.newProfileName.value);
    if (!name) { el.newProfileName.focus(); return; }
    el.newProfileName.value = '';
    Sound.coin();
    showTitle();
    toast('Welcome, ' + name + '!');
  }
  el.newProfileBtn.addEventListener('click', createProfile);
  el.newProfileName.addEventListener('keydown', function (e) { if (e.key === 'Enter') createProfile(); });
}

/* ================= INIT ================= */
bindSettings();
buildLevelGrid();
if (Player.needsPick()) showProfiles();
else showTitle();
document.addEventListener('mousedown', function () { Sound.resume(); });
requestAnimationFrame(loop);

// debug: ?demo autostarts level 1 + simulates auto-aim hover (headless screenshot tests)
if (typeof location !== 'undefined' && location.search.indexOf('demo') >= 0) {
  setTimeout(function () {
    if (!Player.current) Player.create('Demo');
    startLevel(0);
    setTimeout(function () {
      if (isAuto()) { hoverActive = true; updateHover(1845, 780); }
      // scripted firing: chip the keep down, then pick off marchers
      var demoShots = 0;
      var demoT = setInterval(function () {
        if (state !== 'playing') { clearInterval(demoT); return; }
        if (demoShots < 6) { demoShots++; autoFire(1845, 780); return; }
        var tgt = null;
        for (var i = 0; i < enemies.length; i++) {
          var de = enemies[i];
          if (de.state !== 'dying' && de.x + de.w < 1700) { tgt = de; break; }
        }
        if (tgt) autoFire(tgt.x + tgt.w / 2 - tgt.speed * 0.55, GROUND - tgt.h * 0.55);
        else if (enemies.length === 0 && keep && !keep.destroyed && keep.hp > keep.maxHp * 0.55) {
          autoFire(1845, 780);
        }
      }, 500);
    }, 300);
  }, 60);
}


