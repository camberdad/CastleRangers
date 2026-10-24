/* ============ Castle Rangers :: shared high-score board (jsonbin.io) ============ */
/*
  HOW TO TURN ON THE SHARED LEADERBOARD  (about 3 minutes, free)
  ------------------------------------------------------------------------------
  1. Go to https://jsonbin.io and Sign Up (free).
  2. Click "Create Bin". Paste this exact content, then save:

         {"scores":[]}

  3. Open the bin. Copy the BIN ID (the code in the URL after "/b/").
  4. Open "API Keys" (top-right profile menu) and copy your X-MASTER-KEY.
  5. Paste both strings below between the quotes, then reload the game.
     The High Scores screen will say "Live" once it connects.

  SECURITY NOTE
  ------------------------------------------------------------------------------
  This key lives in the page source, so anyone who views source could abuse it.
  That is normal for a static hobby game. LEADERBOARD_SAFE brackets every
  submission (score/gold/name/level sanity + a local copy of the reject rules)
  so the worst case is a few junk rows, not a broken board. Swap this out for a
  Supabase table or a serverless endpoint later if you ever want real auth.

  Leave both strings empty ("") to run the game in OFFLINE mode: scores are
  still saved locally on each device and the board just shows your own runs.
*/
var LEADERBOARD_CONFIG = {
  BIN_ID:       "6ad6cdd5ffd5d160537aa4c8",   // e.g. "6ad6cdd5ffd5d160537aa4c8"
  MASTER_KEY:   "$2a$10$OmxbDlh.OurDTGKaYwqizutCuGS/Y4YXOfRUOAOW.IGybb1zV9bfu",   // e.g. "$2a$10$OmxbDlh.OurDTGKaYwqizutCuGS/Y4YXOfRUOAOW.IGybb1zV9bfu"
  MAX_ENTRIES:  200,  // keep the bin from growing forever
  MAX_SCORE:    9999999,
  MAX_GOLD:     9999999
};

var Leaderboard = (function () {
  var LOCAL_KEY = 'cr_highscores';
  var base = 'https://api.jsonbin.io/v3/b/';

  function configured() {
    return !!(LEADERBOARD_CONFIG.BIN_ID && LEADERBOARD_CONFIG.MASTER_KEY);
  }

  function headers() {
    var h = { 'Content-Type': 'application/json', 'X-Bin-Meta': 'false' };
    if (LEADERBOARD_CONFIG.MASTER_KEY) h['X-Master-Key'] = LEADERBOARD_CONFIG.MASTER_KEY;
    return h;
  }

  /* ---- local cache (always used; the global board layers on top) ---- */
  function localGet() {
    var v = Store.get(LOCAL_KEY, { scores: [] });
    if (!v || !Array.isArray(v.scores)) v = { scores: [] };
    return v;
  }
  function localSet(data) { Store.set(LOCAL_KEY, data); }

  var TIME_KEY = 'cr_total_play_time';
  var timeState = Store.get(TIME_KEY, { players: {} });
  if (!timeState || !timeState.players) timeState = { players: {} };
  Object.keys(timeState.players).forEach(function (key) {
    timeState.players[key].syncing = false;
    timeState.players[key].retryAt = 0;
  });
  var syncUrl = function () { return base + encodeURIComponent(LEADERBOARD_CONFIG.BIN_ID); };
  var remoteWriteQueue = Promise.resolve();
  function queueRemoteWrite(job) {
    var queued = remoteWriteQueue.then(job, job);
    remoteWriteQueue = queued.catch(function () {});
    return queued;
  }

  function playerKey(name) { return String(name || 'Guest').trim().toLowerCase() || 'guest'; }
  function playerTime(name) {
    var key = playerKey(name);
    if (!timeState.players[key]) {
      var cached = localGet().scores.find(function (s) { return playerKey(s.name) === key; });
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
    });
    return scores;
  }
  function persistRemoteStats(name, rec) {
    if (!configured() || typeof fetch !== 'function' || rec.syncing || rec.pending < 15 || Date.now() < rec.retryAt || !rec.snapshot) return;
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
    dt = Math.min(dt, 1);
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

  function sanitize(entry) {
    var name = String(entry.name || 'Guest').trim().slice(0, 16) || 'Guest';
    var stamp = Number(entry.t) || Date.now();
    var s = Math.max(0, Math.min(LEADERBOARD_CONFIG.MAX_SCORE, Math.floor(Number(entry.score) || 0)));
    var g = Math.max(0, Math.min(LEADERBOARD_CONFIG.MAX_GOLD, Math.floor(Number(entry.gold) || 0)));
    var lvl = Math.max(1, Math.floor(Number(entry.level) || 1));
    var out = {
      name: name, score: s, gold: g, level: lvl,
      stars: Math.max(0, Math.min(3, Math.floor(Number(entry.stars) || 0))),
      kills: Math.max(0, Math.floor(Number(entry.kills) || 0)),
      shots: entry.shots == null ? null : Math.max(0, Math.floor(Number(entry.shots) || 0)),
      timePlayed: entry.timePlayed == null ? null : Math.max(0, Math.floor(Number(entry.timePlayed) || 0)),
      arrow: String(entry.arrow || 'std').slice(0, 12),
      diff: String(entry.diff || 'normal').slice(0, 10),
      won: !!entry.won,
      active: !!entry.active && (Date.now() - stamp < 45000),
      t: stamp
    };
    return out;
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
    sortBoard(list);
    var seen = Object.create(null);
    var unique = [];
    for (var i = 0; i < list.length; i++) {
      var entry = list[i];
      var player = String(entry.name || 'Guest').trim().toLowerCase() || 'guest';
      if (seen[player] !== undefined) {
        var kept = unique[seen[player]];
        kept.level = Math.max(Number(kept.level) || 1, Number(entry.level) || 1);
        kept.timePlayed = Math.max(Number(kept.timePlayed) || 0, Number(entry.timePlayed) || 0);
        kept.gold = Math.max(Number(kept.gold) || 0, Number(entry.gold) || 0);
        kept.kills = Math.max(Number(kept.kills) || 0, Number(entry.kills) || 0);
        kept.stars = Math.max(Number(kept.stars) || 0, Number(entry.stars) || 0);
        if (entry.shots != null) kept.shots = Math.max(Number(kept.shots) || 0, Number(entry.shots) || 0);
        if ((Number(entry.t) || 0) >= (Number(kept.t) || 0)) {
          kept.active = !!entry.active;
          kept.t = Number(entry.t) || Date.now();
        }
        continue;
      }
      seen[player] = unique.length;
      unique.push(entry);
    }
    return sortBoard(unique);
  }

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

  /* ---- fetch the shared board (falls back to local on any failure) ---- */
  function fetchBoard(cb) {
    var local = oneRunPerPlayer(localGet().scores.map(sanitize));
    if (!configured() || typeof fetch !== 'function') {
      cb({ online: false, scores: overlayLocalTimes(local), reason: configured() ? 'nocors' : 'unconfigured' });
      return;
    }
    fetch(base + encodeURIComponent(LEADERBOARD_CONFIG.BIN_ID), { headers: headers(), cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (d) {
        var scores = d && d.record && Array.isArray(d.record.scores) ? d.record.scores : (d && Array.isArray(d.scores) ? d.scores : []);
        cb({ online: true, scores: overlayLocalTimes(oneRunPerPlayer(scores.map(sanitize))), reason: '' });
      })
      .catch(function (e) {
        cb({ online: false, scores: overlayLocalTimes(local), reason: 'offline' });
      });
  }

  /*
    Submit a run. Strategy:
      1. ALWAYS write to the local board first so nothing is ever lost.
      2. If configured, fetch the live board, merge this run into it,
         de-dupe, cap, and PUT it back.
    cb(ok, board, reason)
  */
  function submit(entry, cb) {
    cb = cb || function () {};
    entry = sanitize(entry);
    mergeLocal(entry);

    if (!configured() || typeof fetch !== 'function') { cb(false, localGet().scores, 'unconfigured'); return; }

    queueRemoteWrite(function () {
      return fetch(base + encodeURIComponent(LEADERBOARD_CONFIG.BIN_ID), { headers: headers(), cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (d) {
          var scores = d && d.record && Array.isArray(d.record.scores) ? d.record.scores : (d && Array.isArray(d.scores) ? d.scores : []);
          scores = scores.map(sanitize);
          scores.push(entry);
          scores = oneRunPerPlayer(scores);
          if (scores.length > LEADERBOARD_CONFIG.MAX_ENTRIES) scores = scores.slice(0, LEADERBOARD_CONFIG.MAX_ENTRIES);
          return fetch(base + encodeURIComponent(LEADERBOARD_CONFIG.BIN_ID), {
            method: 'PUT', headers: headers(), body: JSON.stringify({ scores: scores })
          }).then(function (r2) {
            if (!r2.ok) throw new Error('http ' + r2.status);
            return scores;
          });
        });
    }).then(function (scores) {
      localSet({ scores: scores });
      var savedRow = scores.find(function (row) { return playerKey(row.name) === playerKey(entry.name); });
      if (savedRow) acceptPlayedTime(entry.name, savedRow.timePlayed);
      cb(true, scores, '');
    })
      .catch(function () { cb(false, localGet().scores, 'offline'); });
  }

  return {
    configured: configured,
    fetchBoard: fetchBoard,
    submit: submit,
    trackTime: trackTime,
    getPlayedTime: getPlayedTime,
    localBoard: function () { return oneRunPerPlayer(localGet().scores); },
    lastName: function () { return Player && Player.current ? Player.current : 'Guest'; }
  };
})();

