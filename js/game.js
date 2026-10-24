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
    '<span class="hsTime">Total Time Played</span><span class="hsMeta">Result</span>';
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
    meta.textContent = (s.active ? 'In progress' : (s.won ? '★'.repeat(Math.max(1, s.stars || 1)) + ' won' : 'fell')) +
      ' · ' + (s.kills || 0) + ' total kills';
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
function getArrowUpgradeLevel(id) {
  return clamp(Math.floor(Number(PROGRESS.upgrades && PROGRESS.upgrades[id]) || 0), 0, MAX_ARROW_UPGRADES);
}
function getArrowPowerMultiplier(id) {
  return 1 + getArrowUpgradeLevel(id) * ARROW_UPGRADE_DAMAGE_PER_LEVEL;
}
function getArrowUpgradeCost(id, level) {
  var ar = ARROWS[id];
  var baseCost = Math.max(60, Math.round((ar.cost || 100) * 0.08));
  return baseCost * (level + 1);
}

function buildArmory() {
  el.armoryGold.textContent = PROGRESS.gold + ' gold';
  el.arrowGrid.innerHTML = '';
  ARROW_ORDER.forEach(function (id) {
    var ar = ARROWS[id];
    var owned = PROGRESS.owned.indexOf(id) >= 0;
    var eq = PROGRESS.equipped === id;
    var lvlLocked = PROGRESS.unlocked < ar.unlock;
    var card = document.createElement('div');
    card.className = 'arrowCard' + (eq ? ' equipped' : '');

    var tag = '';
    if (eq) tag = '<span class="aTag">EQUIPPED</span>';
    else if (owned) tag = '<span class="aTag">OWNED</span>';
    else if (lvlLocked) tag = '<span class="aTag">LV ' + ar.unlock + '</span>';
    else tag = '<span class="aTag">' + ar.cost + 'g</span>';

    var powerLevel = getArrowUpgradeLevel(id);
    var powerMult = getArrowPowerMultiplier(id);
    var stats = 'Damage <b>' + Math.round(ar.dmg * powerMult) + '</b> · Power <b>' + powerLevel + '/' + MAX_ARROW_UPGRADES + '</b>';
    if (ar.auto) stats += ' · <b>hold cursor button to fire</b>';
    if (ar.burn) stats += ' · ' + (ar.poison ? 'Poison' : 'Burn') + ' <b>' + Math.round(ar.burn.dps * powerMult) + '/s</b> for <b>' + ar.burn.dur + 's</b>';
    if (ar.spread) stats += ' · <b>' + (ar.spreadCount || 3) + ' arrows</b> per shot';
    if (ar.pierce) stats += ' · pierces <b>' + ar.pierce + '</b> enemies';
    if (ar.explode) stats += ' · blast radius <b>' + ar.explode.r + '</b>';
    if (ar.lightning) stats += ' · calls lightning on impact, hitting up to <b>' + ar.lightning.targets + ' monsters</b>';
    if (ar.sunder) stats += ' · shatters armor, <b>+' + Math.round((ar.sunder.mult - 1) * 100) + '%</b> damage taken';
    if (ar.nova) stats += ' · <b>chills all</b> within <b>' + ar.nova.r + '</b>';
    if (ar.leech) stats += ' · heals castle <b>' + Math.round(ar.leech * 100) + '%</b> of damage';
    if (ar.speed < 1) stats += ' · slightly slower';
    if (ar.speed > 1) stats += ' · faster';

    card.innerHTML =
      '<div class="aTop"><span class="aName">' + ar.icon + ' ' + ar.name + '</span>' + tag + '</div>' +
      '<div class="aDesc">' + ar.desc + '</div>' +
      '<div class="aStats">' + stats + '</div>';

    var btn = document.createElement('button');
    btn.className = 'btn small' + (owned ? '' : ' gold');
    if (eq) { btn.textContent = 'Equipped'; btn.disabled = true; }
    else if (owned) {
      btn.textContent = 'Equip';
      btn.addEventListener('click', function () { equipArrow(id); buildArmory(); });
    } else if (lvlLocked) {
      btn.textContent = 'Unlocks at Level ' + ar.unlock;
      btn.disabled = true;
    } else {
      btn.textContent = 'Buy — ' + ar.cost + 'g';
      btn.disabled = PROGRESS.gold < ar.cost;
      if (!btn.disabled) btn.addEventListener('click', function () {
        PROGRESS.gold -= ar.cost;
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
      powerBtn.textContent = 'Power +' + Math.round(ARROW_UPGRADE_DAMAGE_PER_LEVEL * 100) + '% — ' + powerCost + 'g';
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
function solveBallistic(tx, ty) {
  var dx = tx - BOW.x;
  if (dx < 6) { tx = BOW.x + 6; dx = 6; }
  var g = GRAVITY;
  if (dx < 188) {
    var dist = Math.hypot(dx, ty - BOW.y);
    var t = dist / 2063;
    var vx = dx / t;
    var vy = (ty - BOW.y) / t - 0.5 * g * t;
    return { vx: vx, vy: vy, v: Math.hypot(vx, vy) };
  }
  var dyUp = BOW.y - ty; // positive when target is above the bow (y-up math)
  var v = 1950;
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
  var sol = solveBallistic(tx, ty);
  if (!sol) return;
  aimX = tx; aimY = ty;
  aimDX = sol.vx; aimDY = sol.vy;
  aimPower = clamp(sol.v / 1875, 0.35, 1);
  spawnVolley(ar, sol.vx, sol.vy, 0.85);
  Sound.shoot();
  recoil = 1;
  shotCooldown = ar.cadence || 0.42;
}

function updateHover(px, py) {
  if (state !== 'playing' || !isAuto()) return;
  aimX = px; aimY = py;
  lastSolve = solveBallistic(px, py);
  if (lastSolve) {
    aimDX = lastSolve.vx; aimDY = lastSolve.vy;
    aimPower = clamp(lastSolve.v / 1875, 0.35, 1);
  }
}

cv.addEventListener('mousedown', function (e) {
  Sound.resume();
  if (state !== 'playing') return;
  if (PROGRESS.equipped === 'gatling') { fireHeld = true; return; }
  var p = toWorld(e.clientX, e.clientY);
  if (isAuto()) {
    hoverActive = true;
    autoFire(p.x, p.y);
  } else {
    aimActive = true;
    updateAimFrom(p.x, p.y);
  }
});
window.addEventListener('mousemove', function (e) {
  var p = toWorld(e.clientX, e.clientY);
  if (isAuto()) {
    if (state === 'playing' && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H) {
      hoverActive = true;
      updateHover(p.x, p.y);
    }
  } else if (aimActive) {
    updateAimFrom(p.x, p.y);
  }
});
cv.addEventListener('mouseleave', function () { hoverActive = false; lastSolve = null; fireHeld = false; });
window.addEventListener('mouseup', function () {
  fireHeld = false;
  if (isAuto() || !aimActive) return;
  if (aimPower > 0.1 && state === 'playing') fireArrow();
  aimActive = false;
});
cv.addEventListener('touchstart', function (e) {
  e.preventDefault();
  Sound.resume();
  if (state !== 'playing') return;
  var t = e.touches[0];
  var p = toWorld(t.clientX, t.clientY);
  if (PROGRESS.equipped === 'gatling') { fireHeld = true; return; }
  if (isAuto()) {
    autoFire(p.x, p.y);
  } else {
    aimActive = true;
    updateAimFrom(p.x, p.y);
  }
}, { passive: false });
window.addEventListener('touchmove', function (e) {
  if (isAuto() || !aimActive) return;
  e.preventDefault();
  var t = e.touches[0];
  var p = toWorld(t.clientX, t.clientY);
  updateAimFrom(p.x, p.y);
}, { passive: false });
window.addEventListener('touchend', function () {
  fireHeld = false;
  if (isAuto() || !aimActive) return;
  if (aimPower > 0.1 && state === 'playing') fireArrow();
  aimActive = false;
});
window.addEventListener('touchcancel', function () { fireHeld = false; aimActive = false; });
window.addEventListener('blur', function () { fireHeld = false; aimActive = false; });
cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

window.addEventListener('keydown', function (e) {
  if (e.key === 'p' || e.key === 'P') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
  } else if (e.key === 'Escape') {
    if (state === 'playing') pauseGame();
    else if (state === 'paused') resumeGame();
    else if (state === 'settings' && settingsFrom === 'pause') { hideAllScreens(); show($('screen-pause')); state = 'paused'; }
  } else if (state === 'playing') {
    var keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9, '-': 10, '=': 11, '\\': 12, '[': 13, ']': 14, "'": 15, ';': 16, ',': 17 };
    var idx = keyMap[e.key];
    if (idx !== undefined) {
      var id = ARROW_ORDER[idx];
      if (id && PROGRESS.owned.indexOf(id) >= 0) equipArrow(id);
    }
  }
});

function pauseGame() {
  if (state !== 'playing') return;
  state = 'paused';
  aimActive = false; fireHeld = false;
  show($('screen-pause'));
}
function resumeGame() {
  if (state !== 'paused') return;
  hide($('screen-pause'));
  state = 'playing';
}

document.addEventListener('visibilitychange', function () {
  if (document.hidden && state === 'playing') pauseGame();
});

/* ================= FIRING ================= */
function spawnVolley(ar, vx, vy, power) {
  var len = Math.hypot(vx, vy) || 1;
  var dx = vx / len, dy = vy / len;
  function mk(angOff) {
    var c = Math.cos(angOff), s = Math.sin(angOff);
    var mvx = (dx * c - dy * s) * len;
    var mvy = (dx * s + dy * c) * len;
    arrows.push({
      x: BOW.x + dx * 28, y: BOW.y + dy * 28, vx: mvx, vy: mvy,
      rot: Math.atan2(mvy, mvx), type: ar.id, dmg: ar.dmg * getArrowPowerMultiplier(ar.id),
      burn: ar.burn ? { dps: ar.burn.dps * getArrowPowerMultiplier(ar.id), dur: ar.burn.dur } : null, poison: !!ar.poison,
      explode: ar.explode || null, pierceLeft: ar.pierce || 0, lastHitUid: -1,
      slow: ar.slow || null, chain: ar.chain || null, cluster: ar.cluster || null,
      holy: !!ar.holy, auto: !!ar.auto,
      homing: !!ar.homing, lightning: ar.lightning || null, leech: ar.leech || 0,
      sunder: ar.sunder || null, nova: ar.nova || null,
      power: power, dead: false
    });
    arrowsShot++;
  }
  if (ar.spread) {
    var n = ar.spreadCount || 3;
    var span = n <= 3 ? 0.18 : 0.3;
    if (n === 1) mk(0);
    else for (var s = 0; s < n; s++) mk(((s / (n - 1)) - 0.5) * span);
  }
  else mk(0);
}

function fireArrow() {
  var ar = ARROWS[PROGRESS.equipped] || ARROWS.std;
  var len = Math.hypot(aimDX, aimDY) || 1;
  var dx = aimDX / len, dy = aimDY / len;
  var speed = (671 + aimPower * 1375) * ar.speed;
  spawnVolley(ar, dx * speed, dy * speed, aimPower);
  Sound.shoot();
  recoil = 1;
  shotCooldown = ar.cadence || 0.42;
}

function explodeAt(x, y, a) {
  Sound.explode();
  if (SETTINGS.shake) shake = Math.min(16, shake + 11);
  addText(x, y - 26, 'BOOM!', '#ffb35a', 20, 0.9);
  for (var i = 0; i < 22; i++) {
    var ang = Math.random() * Math.PI * 2;
    var sp = 80 + Math.random() * 260;
    particles.push({
      kind: 'flame', x: x, y: y,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60,
      r: 3 + Math.random() * 5, life: 0.25 + Math.random() * 0.4
    });
  }
  for (var i = 0; i < 10; i++) {
    particles.push({
      kind: 'smoke', x: x, y: y,
      vx: (Math.random() - 0.5) * 90, vy: -30 - Math.random() * 70,
      r: 6 + Math.random() * 8, life: 0.7 + Math.random() * 0.7
    });
  }
  var r = a.explode.r, dmg = a.dmg * a.explode.mult;
  for (var i = 0; i < enemies.length; i++) {
    var e = enemies[i];
    if (e.state === 'dying') continue;
    var d = Math.hypot(e.x + e.w / 2 - x, GROUND - e.h * 0.5 - y);
    if (d > r) continue;
    var fall = 1 - d / r;
    damageEnemy(e, dmg * (0.45 + 0.55 * fall), {});
    spawnBlood(e.x + e.w / 2, GROUND - e.h * 0.5, 8);
  }
  // splash damages the enemy keep
  if (keep && !keep.destroyed) {
    var kcx = clamp(x, KEEP_BOX.x, KEEP_BOX.x + KEEP_BOX.w);
    var kcy = clamp(y, KEEP_BOX.top, GROUND);
    var kd = Math.hypot(x - kcx, y - kcy);
    if (kd < r) damageKeep(dmg * (0.4 + 0.6 * (1 - kd / r)), kcx, kcy);
  }
}

/* ================= DAMAGE / BLOOD ================= */
function addText(x, y, txt, color, size, life) {
  if (texts.length > 44) texts.shift();
  texts.push({ x: x, y: y, txt: txt, color: color, size: size || 15, life: life || 0.9, max: life || 0.9, vy: -46 });
}

function spawnBlood(x, y, n) {
  var b = SETTINGS.blood;
  if (b <= 0) return;
  n = Math.max(1, Math.round(n * (0.45 + b * 0.5)));
  for (var i = 0; i < n; i++) {
    var a = -Math.PI * (0.15 + Math.random() * 0.7);
    var sp = 70 + Math.random() * (110 + b * 55);
    particles.push({
      kind: 'blood', x: x, y: y,
      vx: Math.cos(a) * sp + 45, vy: Math.sin(a) * sp,
      r: 1.6 + Math.random() * (1 + b * 0.8),
      life: 0.5 + Math.random() * 0.7
    });
  }
}

function spawnSparks(x, y) {
  for (var i = 0; i < 7; i++) {
    var a = Math.random() * Math.PI * 2;
    var sp = 120 + Math.random() * 160;
    particles.push({ kind: 'spark', x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, r: 1.2 + Math.random(), life: 0.18 + Math.random() * 0.2 });
  }
}

function arcaneColor(type) {
  return ({
    chain: '#78e8ff', holy: '#ffe47a', glacial: '#9fe9ff',
    leech: '#ff62c7', sunder: '#ffad62',
    lightning: '#82e8ff', homing: '#70f5d2', cluster: '#d29aff', gatling: '#fff078'
  })[type] || '';
}

function spawnLightningStrike(x, y) {
  var points = [{ x: x + (Math.random() - 0.5) * 34, y: 0 }];
  var segments = 9;
  for (var i = 1; i < segments; i++) {
    points.push({ x: x + (Math.random() - 0.5) * 70, y: y * i / segments });
  }
  points.push({ x: x, y: y });
  particles.push({ kind: 'lightning', points: points, life: 0.22, maxLife: 0.22 });
}

function spawnArcaneBurst(x, y, type) {
  var color = arcaneColor(type);
  if (!color) return;
  particles.push({ kind: 'arcaneRing', x: x, y: y, r: 7, vr: type === 'glacial' ? 260 : 190, life: 0.34, maxLife: 0.34, tint: color });
  var count = type === 'glacial' ? 18 : 12;
  for (var i = 0; i < count; i++) {
    var ang = Math.random() * Math.PI * 2;
    var speed = 65 + Math.random() * (type === 'holy' ? 230 : 190);
    particles.push({
      kind: 'arcane', x: x, y: y,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed - 35,
      r: 2 + Math.random() * 3, rot: ang, spin: (Math.random() - 0.5) * 9,
      life: 0.28 + Math.random() * 0.38, maxLife: 0.66, tint: color
    });
  }
}

function spawnFlame(x, y, kind) {
  particles.push({
    kind: 'flame', x: x + (Math.random() - 0.5) * 22, y: y - Math.random() * 30,
    vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 60,
    r: 2.5 + Math.random() * 3.5, life: 0.3 + Math.random() * 0.35,
    tint: kind === 'poison' ? 'poison' : 'fire'
  });
}

function addBloodDecal(x, y, big) {
  if (SETTINGS.blood <= 0) return;
  var n = 3 + Math.floor(Math.random() * 5) + (big ? 4 : 0) + SETTINGS.blood;
  var splat = [];
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2;
    var d = Math.random() * (big ? 34 : 14);
    splat.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d * 0.35, r: 1 + Math.random() * (big ? 4 : 2.4) });
  }
  decals.push({
    kind: 'blood', x: x, y: y,
    rx: (big ? 14 + Math.random() * 10 : 4 + Math.random() * 4),
    ry: (big ? 4.5 + Math.random() * 2.5 : 1.6),
    splat: splat,
    life: 9 + SETTINGS.blood * 5
  });
  if (decals.length > 90) decals.splice(0, decals.length - 90);
}

function damageEnemy(e, dmg, opts) {
  if (e.state === 'dying') return;
  opts = opts || {};
  e.hp -= dmg;
  score += Math.round(dmg);
  if (e.hp <= 0) killEnemy(e, opts.head, opts.arrow);
}

function killEnemy(e, head, arrow) {
  e.state = 'dying';
  e.deathT = 0;
  e.deathRot = 0;
  e.alpha = 1;
  e.burn = 0;
  kills++;
  Leaderboard.recordKill(Player.current || 'Guest');
  score += e.def.score + (head ? 40 : 0);
  runGold += e.def.gold;
  if (arrow) {
    e.stuckArrow = {
      dx: arrow.x - (e.x + e.w / 2), dy: arrow.y - GROUND, rot: arrow.rot,
      fletch: arrowFletchColor(arrow.type)
    };
  }
  addText(e.x + e.w / 2, GROUND - e.h - 22, '+' + e.def.gold + 'g', '#e8c15a', 14, 1);
  Sound.death();
  var bx = e.x + e.w / 2;
  if (SETTINGS.blood > 0) {
    spawnBlood(bx, GROUND - e.h * 0.6, 14 + SETTINGS.blood * 9);
    addBloodDecal(bx, GROUND + 3 + Math.random() * 8, !!e.def.boss);
    if (SETTINGS.blood >= 3) {
      for (var i = 0; i < 6; i++) spawnBlood(bx + (Math.random() - 0.5) * e.w, GROUND - Math.random() * e.h, 4);
    }
  }
  if (e.def.boss) {
    shake = SETTINGS.shake ? 16 : 0;
    toast('The ' + e.def.name + ' has fallen!');
  }
}

function castleHit(dmg) {
  if (state !== 'playing') return;
  castleHP -= dmg;
  castleFlash = 1;
  if (SETTINGS.shake) shake = Math.min(14, shake + 7);
  Sound.buildHit();
  addText(WALL_W + 30 + Math.random() * 40, WALL_TOP + 40 + Math.random() * 60, '-' + Math.round(dmg), '#ff8a6a', 16, 0.9);
  if (castleHP <= 0) { castleHP = 0; loseLevel(); }
}

function damageKeep(dmg, hx, hy) {
  if (!keep || keep.destroyed || state !== 'playing') return;
  keep.hp -= dmg;
  keep.flash = 1;
  score += Math.round(dmg);
  // coin trickle for chip damage on the enemy castle
  var coins = Math.max(1, Math.round(dmg * 0.35));
  runGold += coins;
  if (SETTINGS.shake) shake = Math.min(10, shake + 4);
  if (SETTINGS.dmgNums) {
    addText(hx, hy - 16, Math.round(dmg), '#ffb35a', 14, 0.7);
    addText(hx + 12, hy - 32, '+' + coins + 'g', '#e8c15a', 12, 0.8);
  }
  if (keep.hp <= 0) destroyKeep();
}

function destroyKeep() {
  if (!keep || keep.destroyed) return;
  keep.hp = 0;
  keep.destroyed = true;
  keep.stuck.length = 0;
  Sound.explode();
  if (SETTINGS.shake) shake = 16;
    toast('The enemy castle has fallen!');
  addText(KEEP_BOX.x + KEEP_BOX.w / 2, KEEP_BOX.top - 70, 'CASTLE DESTROYED!', '#ffd25a', 22, 1.4);
  runGold += 75 + levelIdx * 15;
  score += 350;
  var kx = KEEP_BOX.x + KEEP_BOX.w / 2, ky = KEEP_BOX.top + 90;
  for (var i = 0; i < 30; i++) {
    var ang = Math.random() * Math.PI * 2;
    var sp = 90 + Math.random() * 300;
    particles.push({
      kind: 'flame', x: kx, y: ky,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 80,
      r: 4 + Math.random() * 6, life: 0.3 + Math.random() * 0.5
    });
  }
  for (var i = 0; i < 16; i++) {
    particles.push({
      kind: 'smoke', x: KEEP_BOX.x + 20 + Math.random() * (KEEP_BOX.w - 40),
      y: KEEP_BOX.top + Math.random() * 120,
      vx: (Math.random() - 0.5) * 110, vy: -40 - Math.random() * 90,
      r: 8 + Math.random() * 10, life: 1 + Math.random() * 1.2
    });
  }
}

/* ================= SPAWNING ================= */
function spawnEnemy(type) {
  var def = ENEMIES[type];
  if (!def) return;
  var d = diff();
  var EASE_HP = 0.7, EASE_DMG = 0.7, EASE_SPD = 0.55;
  var hpMul = level.hpMul * d.hp * EASE_HP;
  var spdMul = level.spdMul * d.spd * EASE_SPD;
  var maxHp = def.hp * hpMul;
  enemies.push({
    type: type, def: def,
    x: KEEP_BOX.gateX - 14 + Math.random() * 40,
    y: GROUND, w: def.w, h: def.h,
    hp: maxHp, maxHp: maxHp,
    speed: def.speed * spdMul * 1.25,
    dmg: def.dmg * d.dmg * EASE_DMG,
    state: 'walk',
    walkT: Math.random() * 6.28,
    t: 0,
    attackTimer: 1.1, didHit: false, attackT: 0,
    shotTimer: 1.2 + Math.random() * 1.5, shotAnim: 0,
    healTimer: def.healer ? 0.9 : 0,
    burn: 0, burnDps: 0, burnTick: 0,
    slow: 0, slowFactor: 1, sunder: 0, sunderMult: 1,
    deathT: 0, deathRot: 0, alpha: 1,
    stopX: def.ranged ? 969 + Math.random() * 500 : 0,
    uid: ++uidSeq, burnKind: 'fire'
  });
  if (def.boss) { Sound.boss(); toast('The ' + def.name + ' approaches!'); }
  else Sound.spawn();
}

function fireBolt(e) {
  var bx = e.x + 6, by = GROUND - e.h * 0.62;
  bolts.push({ x: bx, y: by, vx: -675, vy: -38, rot: Math.atan2(-38, -675), dmg: e.dmg, dead: false });
  Sound.bolt();
  e.shotAnim = 0.25;
}

/* ================= UPDATE ================= */
function step(dt) {
  ambT += dt;
  recoil = Math.max(0, recoil - dt * 6);
  shake = Math.max(0, shake - dt * 28);
  castleFlash = Math.max(0, castleFlash - dt * 3);
  if (keep) keep.flash = Math.max(0, keep.flash - dt * 3);
  shotCooldown = Math.max(0, shotCooldown - dt);
  if (state === 'playing') update(dt);
}

function update(dt) {
  elapsed += dt * 1000;
  // storm lightning
  if (level.theme === 'storm') {
    lightFlash = Math.max(0, lightFlash - dt * 3.2);
    if (Math.random() < dt * 0.14) { lightFlash = 1; }
  }

  // spawns
  while (qi < spawnQ.length && elapsed >= spawnQ[qi].t) {
    spawnEnemy(spawnQ[qi].type);
    qi++;
  }

  // wave toast
  var cw = currentWaveNum();
  if (cw !== lastWaveShown && qi < spawnQ.length) {
    lastWaveShown = cw;
    var waveInfo = waves[cw - 1];
    if (waveInfo && waveInfo.elite) {
      var eliteSpawn = spawnQ[waveInfo.startIdx];
      toast('Elite wave — ' + (ENEMIES[eliteSpawn.type] || {}).name + ' incoming!');
    } else {
      toast('Wave ' + cw + ' of ' + waves.length);
    }
  }

  updateArrows(dt);
  updateBolts(dt);
  updateEnemies(dt);
  updateParticles(dt);
  updateTexts(dt);
  updateDecals(dt);

  // Gatling fires at its best target only while the cursor button is held.
  var eq = PROGRESS.equipped;
  var arEq = ARROWS[eq] || ARROWS.std;
  if (state === 'playing' && arEq.auto && fireHeld && shotCooldown <= 0) {
    var best = null, bestDist = 1e12;
    for (var i = 0; i < enemies.length; i++) {
      var de = enemies[i];
      if (de.state !== 'dying') {
        var d = Math.hypot((de.x + de.w / 2) - 1845, (GROUND - de.h * 0.55) - 780);
        if (d < bestDist) { bestDist = d; best = de; }
      }
    }
    if (best) {
      autoFire(best.x + best.w / 2 - best.speed * 0.3, GROUND - best.h * 0.55);
    } else if (enemies.length === 0 && keep && !keep.destroyed) {
      autoFire(1845, 780);
    }
  }

  // castle smoke when badly damaged
  if (castleHP / castleMax < 0.3) {
    smokeT -= dt;
    if (smokeT <= 0) {
      smokeT = 0.32;
      particles.push({
        kind: 'smoke', x: 30 + Math.random() * (WALL_W - 30), y: WALL_TOP - 10 - Math.random() * 20,
        vx: 8 + Math.random() * 14, vy: -26 - Math.random() * 18,
        r: 5 + Math.random() * 7, life: 1.2 + Math.random()
      });
    }
  }

  // keep smoke when badly damaged
  if (keep && !keep.destroyed && keep.hp / keep.maxHp < 0.3) {
    keepSmokeT -= dt;
    if (keepSmokeT <= 0) {
      keepSmokeT = 0.35;
      particles.push({
        kind: 'smoke', x: KEEP_BOX.x + 30 + Math.random() * (KEEP_BOX.w - 60), y: KEEP_BOX.top - 8 - Math.random() * 44,
        vx: 10 + Math.random() * 16, vy: -30 - Math.random() * 20,
        r: 6 + Math.random() * 8, life: 1.3 + Math.random()
      });
    }
  }

  // win check: wipe the wave AND raze the keep
  if (state === 'playing' && qi >= spawnQ.length && enemies.length === 0) {
    if (keep && !keep.destroyed) {
      keep.nagT -= dt;
      if (keep.nagT <= 0) { keep.nagT = 8; toast('Destroy the enemy castle!'); }
    } else {
      winLevel();
    }
  }
}

function updateArrows(dt) {
  for (var i = arrows.length - 1; i >= 0; i--) {
    var a = arrows[i];
    a.vy += GRAVITY * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot = Math.atan2(a.vy, a.vx);

    // hunter arrow bends toward the nearest living foe
    if (a.homing) {
      var tgt = null, hDist = 1e9;
      for (var h = 0; h < enemies.length; h++) {
        var eh = enemies[h];
        if (eh.state === 'dying') continue;
        var hd = Math.hypot(eh.x + eh.w / 2 - a.x, (GROUND - eh.h * 0.5) - a.y);
        if (hd < hDist) { hDist = hd; tgt = eh; }
      }
      if (tgt && hDist < 1500) {
        var want = Math.atan2((GROUND - tgt.h * 0.5) - a.y, (tgt.x + tgt.w / 2) - a.x);
        var cur = Math.atan2(a.vy, a.vx);
        var dAng = want - cur;
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;
        var turn = clamp(dAng, -7 * dt, 7 * dt);
        var hspd = Math.hypot(a.vx, a.vy);
        var na = cur + turn;
        a.vx = Math.cos(na) * hspd;
        a.vy = Math.sin(na) * hspd;
        a.rot = na;
      }
    }

    // cluster bolt splits mid-flight into a cone of darts
    if (a.cluster && !a.split) {
      a.splitT = (a.splitT || 0) + dt;
      if (a.splitT > 0.28) {
        var cl = a.cluster;
        var baseAng = Math.atan2(a.vy, a.vx);
        var spd = Math.hypot(a.vx, a.vy) || cl.speed;
        for (var c = 0; c < cl.count; c++) {
          var off = ((c / (cl.count - 1 || 1)) - 0.5) * cl.spread;
          var ang = baseAng + off;
          arrows.push({
            x: a.x, y: a.y,
            vx: Math.cos(ang) * spd * 0.85, vy: Math.sin(ang) * spd * 0.85,
            rot: ang, type: a.type, dmg: a.dmg * 0.55,
            burn: null, poison: false, explode: null, pierceLeft: 0, lastHitUid: -1,
            slow: null, chain: null, cluster: null, holy: a.holy,
            power: a.power, dead: false, split: true
          });
        }
        addText(a.x, a.y - 12, 'SPLIT!', '#d0d0d0', 13, 0.7);
        arrows.splice(i, 1);
        continue;
      }
    }

    // enemy hits
    var consumed = false;
    for (var j = 0; j < enemies.length; j++) {
      var e = enemies[j];
      if (e.state === 'dying') continue;
      if (e.uid === a.lastHitUid) continue;
      if (a.x < e.x - 6 || a.x > e.x + e.w + 6) continue;
      if (a.y < GROUND - e.h - 4 || a.y > GROUND + 2) continue;

      var head = a.y < GROUND - e.h * 0.82;
      var dmg = a.dmg * (0.5 + 0.5 * a.power);

      if (e.def.armor && !a.holy) dmg *= e.def.armor;

      if (e.def.shield && a.x < e.x + e.w * 0.45) {
        if (Math.random() < 0.45) {
          spawnSparks(a.x, a.y);
          Sound.block();
          addText(a.x, a.y - 10, 'BLOCKED', '#b9c4d4', 13, 0.7);
          consumed = true;
          break;
        }
        dmg *= 0.6;
      }

      if (head) {
        dmg *= 2.4;
        Sound.headshot();
        addText(a.x, a.y - 14, 'HEADSHOT!', '#ffd25a', 18, 1);
      } else {
        Sound.hit();
      }

      // holy bolts shred bosses
      if (a.holy && e.def.boss) {
        dmg *= 2;
        addText(a.x, a.y - 26, 'SMITE!', '#fff3c4', 16, 1);
      }

      spawnBlood(a.x, a.y, head ? 12 : 7);
      if (SETTINGS.dmgNums) addText(a.x + 6, a.y - 6, Math.round(dmg) + (head ? '!' : ''), head ? '#ffd25a' : '#f0f0f0', head ? 16 : 13, 0.7);

      if (a.burn && e.state !== 'dying') {
        e.burn = a.burn.dur;
        e.burnDps = a.burn.dps;
        e.burnTick = 0.4;
        e.burnKind = a.poison ? 'poison' : 'fire';
      }

      // frost chill
      if (a.slow && e.state !== 'dying') {
        e.slow = Math.max(e.slow, a.slow.dur);
        e.slowFactor = a.slow.factor;
        addText(a.x, a.y - 20, 'CHILLED', '#9fd8ff', 13, 0.8);
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
      if (a.leech) {
        var heal = Math.round(dmg * a.leech);
        if (heal > 0) {
          castleHP = Math.min(castleMax, castleHP + heal);
          addText(a.x, a.y - 34, '+' + heal + ' HP', '#8effa0', 13, 0.85);
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
        e.burnTick = 0.5;
        damageEnemy(e, e.burnDps * 0.5, {});
        if (e.state === 'dying') continue;
      }
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


