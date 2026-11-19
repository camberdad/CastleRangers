/* ============ Castle Rangers :: shared high-score board (Firebase Cloud Firestore) ============ */
/*
  The global board lives in Google Firebase Cloud Firestore (free Spark plan), in the
  `castlerangers_scores` collection of the same Firebase project as TankShot.

  - One document per player, keyed by lower-case name, so saving a score is a single
    small write instead of downloading and re-uploading the whole board.
  - The project ID below is public by design. firestore.rules (in this repo) protects
    the data: anyone may read, but a player's score, level, kills and playtime can only
    go up, and nothing can be deleted. Paste that file into
    Firebase console -> Firestore Database -> Rules -> Publish.
  - Scores that cannot upload (offline, daily quota reached) stay on this device and are
    sent automatically later.

  Leave FIREBASE_PROJECT_ID empty ("") to run the game in OFFLINE mode: scores are still
  saved locally on each device and the board just shows your own runs.
*/
var LEADERBOARD_CONFIG = {
  FIREBASE_PROJECT_ID: "tankshot-b4d94",
  FIREBASE_API_KEY:    "",                      // optional; not needed with the published rules
  COLLECTION:          "castlerangers_scores",
  BOARD_SIZE:          100,   // rows downloaded for the High Scores screen
  MAX_ENTRIES:         200,   // local cache cap
  SYNC_SECONDS:        30,    // live kills/playtime upload cadence during play
  MAX_SCORE:           9999999,
  MAX_GOLD:            9999999
};

var Leaderboard = (function () {
  var LOCAL_KEY = 'cr_highscores';
  var REMOTE_KEY = 'cr_highscores_firestore_cache';
  var PENDING_KEY = 'cr_highscores_pending';
  var BACKOFF_KEY = 'cr_highscores_backoff';
  var MIGRATED_KEY = 'cr_highscores_firestore_migrated';
  var READ_CACHE_MS = 60 * 1000;
  var QUOTA_BACKOFF_MS = 30 * 60 * 1000;
  var ERROR_BACKOFF_MS = 2 * 60 * 1000;
  var ACTIVE_WINDOW_MS = Math.max(45, LEADERBOARD_CONFIG.SYNC_SECONDS * 2.5) * 1000;
  var BASE = 'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(LEADERBOARD_CONFIG.FIREBASE_PROJECT_ID) + '/databases/(default)/documents';

  function configured() {
    return !!LEADERBOARD_CONFIG.FIREBASE_PROJECT_ID && !window.CR_LEADERBOARD_OFFLINE;
  }
  function canSync() { return configured() && typeof fetch === 'function'; }

  /* ---- local cache (always used; the global board layers on top) ---- */
  function localGet() {
    var v = Store.get(LOCAL_KEY, { scores: [] });
    if (!v || !Array.isArray(v.scores)) v = { scores: [] };
    return v;
  }
  function localSet(data) { Store.set(LOCAL_KEY, data); }

  var TIME_KEY = 'cr_total_play_time';
  var KILL_KEY = 'cr_total_enemy_kills';
  var timeState = Store.get(TIME_KEY, { players: {} });
  if (!timeState || !timeState.players) timeState = { players: {} };
  var killState = Store.get(KILL_KEY, { players: {} });
  if (!killState || !killState.players) killState = { players: {} };
  Object.keys(timeState.players).forEach(function (key) {
    timeState.players[key].syncing = false;
    timeState.players[key].retryAt = 0;
  });

  function playerKey(name) { return String(name || 'Guest').trim().toLowerCase() || 'guest'; }
  function localRow(name) {
    var key = playerKey(name);
    return localGet().scores.find(function (s) { return playerKey(s.name) === key; });
  }
  function killRecord(name) {
    var key = playerKey(name);
    if (!killState.players[key]) {
      var cached = localRow(name);
      killState.players[key] = {
        total: Math.max(0, Math.floor(Number(cached && cached.kills) || 0)),
        pending: 0, ready: !canSync(), loading: false, retryAt: 0
      };
    }
    var rec = killState.players[key];
    rec.total = Math.max(0, Math.floor(Number(rec.total) || 0));
    rec.pending = Math.max(0, Math.floor(Number(rec.pending) || 0));
    if (rec.ready == null) rec.ready = !canSync();
    return rec;
  }
  function saveKillState() {
    var saved = { players: {} };
    Object.keys(killState.players).forEach(function (key) {
      var rec = killState.players[key];
      saved.players[key] = { total: rec.total, pending: rec.pending };
    });
    Store.set(KILL_KEY, saved);
  }
  // The first time a player syncs this session, add kills made on this device
  // since the last upload on top of the total already stored on the board.
  function applyKillBaseline(name, stored) {
    var rec = killRecord(name);
    if (rec.ready) return;
    var remoteBase = Math.max(0, Math.floor(Number(stored && stored.kills) || 0));
    var localBase = Math.max(0, rec.total - rec.pending);
    rec.total = Math.max(remoteBase, localBase) + rec.pending;
    rec.pending = Math.max(0, rec.total - remoteBase);
    rec.ready = true;
    rec.loading = false;
    saveKillState();
  }
  function prepareKills(name) {
    var rec = killRecord(name);
    if (rec.ready || rec.loading || !canSync() || Date.now() < rec.retryAt || backoff()) return;
    rec.loading = true;
    readPlayer(name)
      .then(function (stored) {
        if (rec.ready) return;
        applyKillBaseline(name, stored);
        persistRemoteStats(name, playerTime(name));
      })
      .catch(function () {
        rec.loading = false;
        rec.retryAt = Date.now() + 10000;
      });
  }
  function recordKill(name) {
    var rec = killRecord(name);
    rec.total++;
    rec.pending++;
    saveKillState();
    prepareKills(name);
  }
  function getTotalKills(name) {
    var rec = killRecord(name);
    prepareKills(name);
    return rec.total;
  }
  function acceptRemoteKills(name, savedTotal) {
    var rec = killRecord(name);
    savedTotal = Math.max(0, Math.floor(Number(savedTotal) || 0));
    rec.total = Math.max(rec.total, savedTotal);
    if (rec.ready) rec.pending = Math.max(0, rec.total - savedTotal);
    saveKillState();
  }
  function playerTime(name) {
    var key = playerKey(name);
    if (!timeState.players[key]) {
      var cached = localRow(name);
      var baseline = cached ? Math.max(0, Number(cached.timePlayed) || 0) : 0;
      timeState.players[key] = { total: baseline, pending: 0, syncing: false, retryAt: 0 };
    }
    return timeState.players[key];
  }
  function saveTimeState() {
    var saved = { players: {} };
    Object.keys(timeState.players).forEach(function (key) {
      var rec = timeState.players[key];
      saved.players[key] = { total: rec.total, pending: rec.pending, saveRemainder: rec.saveRemainder || 0 };
    });
    Store.set(TIME_KEY, saved);
  }
  function updateLocalTime(name, total) {
    var data = localGet(), key = playerKey(name), changed = false;
    data.scores.forEach(function (row) {
      if (playerKey(row.name) === key && Number(row.timePlayed || 0) < total) {
        row.timePlayed = Math.floor(total);
        changed = true;
      }
    });
    if (changed) localSet(data);
  }
  function overlayLocalTimes(scores) {
    scores.forEach(function (row) {
      var rec = timeState.players[playerKey(row.name)];
      if (rec) row.timePlayed = Math.max(Number(row.timePlayed) || 0, Math.floor(rec.total));
      var kills = killState.players[playerKey(row.name)];
      if (kills) row.kills = Math.max(Number(row.kills) || 0, Number(kills.total) || 0);
    });
    return scores;
  }
  function persistRemoteStats(name, rec) {
    if (!canSync() || rec.syncing || rec.pending < LEADERBOARD_CONFIG.SYNC_SECONDS ||
        Date.now() < rec.retryAt || !rec.snapshot || backoff()) return;
    var kills = killRecord(name);
    if (!kills.ready) { prepareKills(name); return; }
    rec.syncing = true;
    var entry = Object.assign({}, rec.snapshot, {
      name: name,
      timePlayed: Math.floor(rec.total),
      active: true
    });
    submit(entry, function (ok) {
      rec.retryAt = ok ? 0 : Date.now() + 15000;
      rec.syncing = false;
    });
  }
  function trackTime(name, dt, snapshot) {
    dt = Number(dt);
    if (!isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 30);
    var rec = playerTime(name);
    if (snapshot) rec.snapshot = snapshot;
    rec.total += dt;
    rec.pending += dt;
    rec.saveRemainder = (rec.saveRemainder || 0) + dt;
    if (rec.saveRemainder >= 1) {
      rec.saveRemainder %= 1;
      updateLocalTime(name, rec.total);
      saveTimeState();
    }
    persistRemoteStats(name, rec);
  }
  function getPlayedTime(name) { return Math.floor(playerTime(name).total); }
  function acceptPlayedTime(name, total) {
    var rec = playerTime(name);
    rec.total = Math.max(rec.total, Number(total) || 0);
    rec.pending = Math.max(0, rec.total - (Number(total) || 0));
    updateLocalTime(name, rec.total);
    saveTimeState();
  }

  function optInt(v) { return v == null ? null : Math.max(0, Math.floor(Number(v) || 0)); }
  function sanitize(entry) {
    var name = String(entry.name || 'Guest').trim().slice(0, 16) || 'Guest';
    var stamp = Number(entry.t) || Date.now();
    var s = Math.max(0, Math.min(LEADERBOARD_CONFIG.MAX_SCORE, Math.floor(Number(entry.score) || 0)));
    var g = Math.max(0, Math.min(LEADERBOARD_CONFIG.MAX_GOLD, Math.floor(Number(entry.gold) || 0)));
    var lvl = Math.max(1, Math.min(1000, Math.floor(Number(entry.level) || 1)));
    return {
      name: name, score: s, gold: g, level: lvl,
      levelsCompleted: entry.levelsCompleted == null ? null : Math.min(1000, optInt(entry.levelsCompleted)),
      stars: Math.max(0, Math.min(3, Math.floor(Number(entry.stars) || 0))),
      kills: Math.min(1000000000, Math.max(0, Math.floor(Number(entry.kills) || 0))),
      shots: optInt(entry.shots),
      timePlayed: optInt(entry.timePlayed),
      arrow: String(entry.arrow || 'std').slice(0, 12),
      diff: String(entry.diff || 'normal').slice(0, 10),
      won: !!entry.won,
      active: !!entry.active && (Date.now() - stamp < ACTIVE_WINDOW_MS),
      t: stamp
    };
  }

  function sortBoard(list) {
    list.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (b.gold !== a.gold) return b.gold - a.gold;
      return b.level - a.level;
    });
    return list;
  }

  // Names are the only player identity available to this board. Keep one
  // case-insensitive entry per name, preserving its best score and furthest level.
  function oneRunPerPlayer(list) {
    list = list.map(function (r) { return Object.assign({}, r); });
    sortBoard(list);
    var seen = Object.create(null);
    var unique = [];
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      var player = playerKey(entry.name);
      if (seen[player] !== undefined) {
        var kept = unique[seen[player]];
        kept.level = Math.max(Number(kept.level) || 1, Number(entry.level) || 1);
        kept.timePlayed = Math.max(Number(kept.timePlayed) || 0, Number(entry.timePlayed) || 0);
        kept.gold = Math.max(Number(kept.gold) || 0, Number(entry.gold) || 0);
        kept.kills = Math.max(Number(kept.kills) || 0, Number(entry.kills) || 0);
        kept.stars = Math.max(Number(kept.stars) || 0, Number(entry.stars) || 0);
        if (entry.shots != null) kept.shots = Math.max(Number(kept.shots) || 0, Number(entry.shots) || 0);
        if (entry.levelsCompleted != null) kept.levelsCompleted = Math.max(Number(kept.levelsCompleted) || 0, Number(entry.levelsCompleted) || 0);
        if ((Number(entry.t) || 0) >= (Number(kept.t) || 0)) {
          kept.active = !!entry.active;
          kept.won = !!entry.won;
          kept.t = Number(entry.t) || Date.now();
        }
        continue;
      }
      seen[player] = unique.length;
      unique.push(entry);
    }
    return sortBoard(unique);
  }
  function mergeRows(a, b) { return oneRunPerPlayer([a, b].filter(Boolean))[0]; }

  function mergeLocal(entry) {
    var data = localGet();
    data.scores.push(entry);
    data.scores = oneRunPerPlayer(data.scores);
    if (data.scores.length > LEADERBOARD_CONFIG.MAX_ENTRIES) {
      data.scores = data.scores.slice(0, LEADERBOARD_CONFIG.MAX_ENTRIES);
    }
    localSet(data);
    return data;
  }

  /* ---- pending uploads (kept until Firestore accepts them) ---- */
  function pending() { var p = Store.get(PENDING_KEY, []); return Array.isArray(p) ? p : []; }
  function savePending(rows) { Store.set(PENDING_KEY, rows); }
  function addPending(row) { savePending(oneRunPerPlayer(pending().concat([row]))); }
  function clearPending(row) {
    savePending(pending().filter(function (p) {
      return playerKey(p.name) !== playerKey(row.name) || (Number(p.t) || 0) > (Number(row.t) || 0);
    }));
  }

  /* ---- Firestore REST helpers ---- */
  function keyQs(sep) {
    return LEADERBOARD_CONFIG.FIREBASE_API_KEY ? sep + 'key=' + encodeURIComponent(LEADERBOARD_CONFIG.FIREBASE_API_KEY) : '';
  }
  // Document IDs may not contain "/" and must not be "." / ".." / "__x__",
  // so prefix them and swap slashes. firestore.rules checks the same mapping.
  function docId(name) { return 'p_' + playerKey(name).replace(/\//g, '|'); }
  function docUrl(name) {
    return BASE + '/' + LEADERBOARD_CONFIG.COLLECTION + '/' + encodeURIComponent(docId(name)) + keyQs('?');
  }
  function toDoc(r) {
    var int = function (n) { return n == null ? { nullValue: null } : { integerValue: String(Math.floor(n)) }; };
    return { fields: {
      game: { stringValue: 'CastleRangers' },
      name: { stringValue: r.name }, nameLower: { stringValue: playerKey(r.name) },
      score: int(r.score), gold: int(r.gold), level: int(r.level), levelsCompleted: int(r.levelsCompleted),
      stars: int(r.stars), kills: int(r.kills), shots: int(r.shots), timePlayed: int(r.timePlayed),
      arrow: { stringValue: r.arrow }, diff: { stringValue: r.diff },
      won: { booleanValue: !!r.won }, active: { booleanValue: !!r.active }, t: int(r.t)
    } };
  }
  function fromDoc(doc) {
    var f = (doc && doc.fields) || {};
    var val = function (k) {
      var v = f[k];
      if (!v || 'nullValue' in v) return null;
      if (v.integerValue != null) return Number(v.integerValue);
      if (v.doubleValue != null) return Number(v.doubleValue);
      if (v.booleanValue != null) return !!v.booleanValue;
      return v.stringValue != null ? v.stringValue : null;
    };
    var row = {};
    ['name', 'score', 'gold', 'level', 'levelsCompleted', 'stars', 'kills', 'shots', 'timePlayed',
      'arrow', 'diff', 'won', 'active', 't'].forEach(function (k) { row[k] = val(k); });
    return sanitize(row);
  }

  function backoff() { var b = Store.get(BACKOFF_KEY, null); return b && b.until > Date.now() ? b : null; }
  function setBackoff(ms, message) { Store.set(BACKOFF_KEY, { until: Date.now() + ms, message: message }); }
  function request(url, options) {
    if (!canSync()) return Promise.reject(new Error('unconfigured'));
    var paused = backoff();
    if (paused) return Promise.reject(new Error(paused.message));
    return fetch(url, Object.assign({ cache: 'no-store', headers: { 'Content-Type': 'application/json' } }, options || {}))
      .then(function (response) {
        if (response.ok || response.status === 404) return response;
        return response.text().then(function (body) {
          var status = '';
          try { status = (JSON.parse(body).error || {}).status || ''; } catch (x) {}
          var quota = response.status === 429 || status === 'RESOURCE_EXHAUSTED';
          var error = new Error(quota ? 'quota' : 'http ' + response.status);
          error.http = response.status;
          if (quota) setBackoff(QUOTA_BACKOFF_MS, 'quota');
          else if (response.status >= 500) setBackoff(ERROR_BACKOFF_MS, 'offline');
          throw error;
        });
      }, function (networkError) {
        setBackoff(ERROR_BACKOFF_MS, 'offline');
        throw networkError;
      });
  }
  function readPlayer(name) {
    return request(docUrl(name)).then(function (r) { return r.status === 404 ? null : r.json().then(fromDoc); });
  }
  var boardInflight = null;
  function readBoard() {
    var snap = Store.get(REMOTE_KEY, null);
    if (snap && Array.isArray(snap.scores) && Date.now() - snap.at < READ_CACHE_MS) return Promise.resolve(snap.scores);
    if (boardInflight) return boardInflight;
    var body = { structuredQuery: {
      from: [{ collectionId: LEADERBOARD_CONFIG.COLLECTION }],
      orderBy: [{ field: { fieldPath: 'score' }, direction: 'DESCENDING' }],
      limit: LEADERBOARD_CONFIG.BOARD_SIZE
    } };
    boardInflight = request(BASE + ':runQuery' + keyQs('?'), { method: 'POST', body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        var scores = (Array.isArray(rows) ? rows : [])
          .filter(function (x) { return x && x.document; })
          .map(function (x) { return fromDoc(x.document); });
        Store.set(REMOTE_KEY, { at: Date.now(), scores: scores });
        return scores;
      })
      .then(function (v) { boardInflight = null; return v; }, function (e) { boardInflight = null; throw e; });
    return boardInflight;
  }
  function patch(row) {
    return request(docUrl(row.name), { method: 'PATCH', body: JSON.stringify(toDoc(row)) }).then(function () { return row; });
  }
  // One write per save. The rules reject lowering a score (e.g. the same name played
  // further on another device): then merge with the stored values and write once more.
  function writePlayer(row) {
    var kills = killRecord(row.name);
    var first = kills.ready ? Promise.resolve(row) : readPlayer(row.name).then(function (stored) {
      applyKillBaseline(row.name, stored);
      return mergeRows(stored, row);
    });
    return first.then(function (r) {
      r = Object.assign({}, r, { kills: Math.max(Number(r.kills) || 0, killRecord(r.name).total) });
      return patch(r).catch(function (error) {
        if (error.http !== 403) throw error;
        return readPlayer(r.name).then(function (stored) {
          if (!stored) throw error;
          return patch(mergeRows(stored, r));
        });
      });
    });
  }

  var queue = Promise.resolve();
  function flushPending() {
    queue = queue.then(function () {
      var rows = pending();
      return rows.reduce(function (p, row) {
        return p.then(function () {
          return writePlayer(sanitize(row)).then(function (saved) {
            clearPending(row);
            mergeLocal(saved);
            acceptPlayedTime(saved.name, saved.timePlayed);
            acceptRemoteKills(saved.name, saved.kills);
            Store.clear(REMOTE_KEY);
          });
        });
      }, Promise.resolve()).then(function () { return true; });
    }).catch(function () { return false; });
    return queue;
  }

  /* ---- fetch the shared board (falls back to local on any failure) ---- */
  function fetchBoard(cb) {
    var local = oneRunPerPlayer(localGet().scores.map(sanitize));
    if (!canSync()) {
      cb({ online: false, scores: overlayLocalTimes(local), reason: configured() ? 'nocors' : 'unconfigured' });
      return;
    }
    readBoard()
      .then(function (scores) {
        // Show this device's own players (and anything still uploading) at their latest values.
        var mine = Object.create(null);
        (typeof Player !== 'undefined' && Player.names ? Player.names() : []).forEach(function (n) { mine[playerKey(n)] = true; });
        var extra = local.filter(function (r) { return mine[playerKey(r.name)]; }).concat(pending().map(sanitize));
        var known = Object.create(null);
        scores.forEach(function (r) { known[playerKey(r.name)] = true; });
        extra = extra.filter(function (r) { return known[playerKey(r.name)] || mine[playerKey(r.name)]; });
        cb({ online: true, scores: overlayLocalTimes(oneRunPerPlayer(scores.concat(extra))), reason: '' });
        if (pending().length && !backoff()) flushPending();
      })
      .catch(function (e) {
        cb({ online: false, scores: overlayLocalTimes(local), reason: e && e.message === 'quota' ? 'quota' : 'offline' });
      });
  }

  /*
    Submit a run. Strategy:
      1. ALWAYS write to the local board first so nothing is ever lost.
      2. Queue it for Firestore and upload it as a single document write.
    cb(ok, board, reason)
  */
  function submit(entry, cb) {
    cb = cb || function () {};
    entry = sanitize(entry);
    entry = mergeRows(localRow(entry.name) && sanitize(localRow(entry.name)), entry);
    entry.t = Date.now();
    mergeLocal(entry);

    if (!canSync()) { cb(false, localGet().scores, 'unconfigured'); return; }
    addPending(entry);
    flushPending().then(function (ok) {
      cb(ok, localGet().scores, ok ? '' : (backoff() && backoff().message) || 'offline');
    });
  }

  // First run on Firestore: re-upload this device's profiles from the old (JSONBin-era)
  // local board so returning players keep their scores.
  function migrateLocalProfiles() {
    if (!canSync() || Store.get(MIGRATED_KEY, false)) return;
    var names = Object.create(null);
    (typeof Player !== 'undefined' && Player.names ? Player.names() : []).forEach(function (n) { names[playerKey(n)] = true; });
    localGet().scores.forEach(function (r) {
      if (names[playerKey(r.name)]) addPending(sanitize(Object.assign({}, r, { active: false })));
    });
    Store.set(MIGRATED_KEY, true);
  }
  if (canSync()) {
    setTimeout(function () {
      migrateLocalProfiles();
      if (pending().length && !backoff()) flushPending();
    }, 3000);
  }

  return {
    configured: configured,
    fetchBoard: fetchBoard,
    submit: submit,
    flush: flushPending,
    trackTime: trackTime,
    recordKill: recordKill,
    getTotalKills: getTotalKills,
    getPlayedTime: getPlayedTime,
    localBoard: function () { return oneRunPerPlayer(localGet().scores); },
    lastName: function () { return Player && Player.current ? Player.current : 'Guest'; }
  };
})();
