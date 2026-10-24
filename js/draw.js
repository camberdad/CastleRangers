/* ============ Castle Rangers :: canvas rendering ============ */

var W = 2000, H = 1125;     // logical world (rendered scaled 0.64 into 1280x720 canvas)
var VIEW_SCALE = 0.64;
var GROUND = 1000;          // ground line
var WALL_W = 296;           // castle wall width
var WALL_TOP = 671;         // top of the wall (walkway)
var BOW = { x: 319, y: 609 }; // bow anchor (archer's hands)
var ARCHER_F = { x: 234, y: WALL_TOP }; // archer feet
var GRAVITY = 1406;         // px/s^2 (world units)
var KEEP_BOX = { x: 1745, w: 275, top: GROUND - 350, gateX: 1845 }; // enemy keep geometry

/* ---------- seeded rng for stable decor ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

var THEMES = {
  day: {
    skyTop: '#6db7e8', skyBot: '#cdeaf6', sun: '#fff6cf', glow: 'rgba(255,244,190,.55)',
    sunX: 1225, sunY: 162, sunR: 52, stars: false,
    mtFar: '#93aec2', mtNear: '#7593a8', hillFar: '#7f9f5c', hillNear: '#5f8442',
    ground: '#6d9140', groundBot: '#4a6a2b', tree: '#3d6b2e', treeDark: '#2f5424',
    cloud: 'rgba(255,255,255,.88)', cloudShade: 'rgba(210,225,235,.9)', night: false, rain: false
  },
  sunset: {
    skyTop: '#3d2f66', skyBot: '#f0914e', sun: '#ffd9a0', glow: 'rgba(255,170,90,.55)',
    sunX: 1262, sunY: 375, sunR: 64, stars: false,
    mtFar: '#6b5482', mtNear: '#54406b', hillFar: '#6b6340', hillNear: '#4f5231',
    ground: '#6f7a38', groundBot: '#4a4f24', tree: '#40542a', treeDark: '#2f3f20',
    cloud: 'rgba(255,205,165,.75)', cloudShade: 'rgba(200,140,120,.7)', night: false, rain: false
  },
  night: {
    skyTop: '#070c1e', skyBot: '#1d2b4d', sun: '#e8ecf5', glow: 'rgba(200,215,255,.35)',
    sunX: 1275, sunY: 150, sunR: 42, stars: true,
    mtFar: '#2a3550', mtNear: '#1f2942', hillFar: '#2c3a2c', hillNear: '#1f2c20',
    ground: '#33472a', groundBot: '#21301a', tree: '#1e3020', treeDark: '#152218',
    cloud: 'rgba(120,140,180,.35)', cloudShade: 'rgba(70,85,120,.4)', night: true, rain: false
  },
  storm: {
    skyTop: '#2f353d', skyBot: '#69717c', sun: '#c9cdd4', glow: 'rgba(200,205,215,.25)',
    sunX: 1188, sunY: 188, sunR: 46, stars: false,
    mtFar: '#59616c', mtNear: '#464e58', hillFar: '#565f49', hillNear: '#414a38',
    ground: '#4f5a37', groundBot: '#343c26', tree: '#333e2a', treeDark: '#262e20',
    cloud: 'rgba(150,156,166,.8)', cloudShade: 'rgba(105,110,120,.85)', night: false, rain: true
  }
};

/* ---------- pre-built decor ---------- */
var _rng = mulberry32(1337);
var STARS = [];
for (var i = 0; i < 140; i++) STARS.push({ x: _rng() * W, y: _rng() * 450, r: 0.6 + _rng() * 1.5, p: _rng() * 6.28 });

var CLOUDS = [];
for (var i = 0; i < 9; i++) {
  CLOUDS.push({ x: _rng() * W, y: 62 + _rng() * 238, sc: 0.7 + _rng() * 1.1, spd: 5 + _rng() * 9, off: _rng() * 100 });
}

var SPECKS = [];
for (var i = 0; i < 170; i++) {
  SPECKS.push({ x: _rng() * W, y: GROUND + 4 + _rng() * (H - GROUND - 6), r: 1 + _rng() * 2.4, s: _rng() });
}

var MTS = [];  // mountain peaks
(function () {
  var x = -60;
  while (x < W + 120) {
    var w = 160 + _rng() * 240;
    MTS.push({ x: x, h: 110 + _rng() * 185, w: w });
    x += w * 0.62;
  }
})();

var FTREES = []; // far trees on hills
for (var i = 0; i < 32; i++) FTREES.push({ x: _rng() * W, sc: 0.5 + _rng() * 0.55, d: _rng() });

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hillY(x) {
  return 719 + 25 * Math.sin(x * 0.00496 + 1.3) + 15 * Math.sin(x * 0.01128 + 4.1);
}

/* ================= BACKGROUND ================= */
function drawBackground(ctx, themeName, t) {
  var th = THEMES[themeName] || THEMES.day;

  // sky
  var sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, th.skyTop);
  sky.addColorStop(1, th.skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);

  // stars
  if (th.stars) {
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i];
      var tw = 0.55 + 0.45 * Math.sin(t * 1.6 + s.p);
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#e8ecf8';
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  }

  // sun / moon
  var grd = ctx.createRadialGradient(th.sunX, th.sunY, th.sunR * 0.2, th.sunX, th.sunY, th.sunR * 2.6);
  grd.addColorStop(0, th.glow);
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(th.sunX - th.sunR * 3, th.sunY - th.sunR * 3, th.sunR * 6, th.sunR * 6);
  ctx.fillStyle = th.sun;
  ctx.beginPath(); ctx.arc(th.sunX, th.sunY, th.sunR, 0, 6.2832); ctx.fill();

  // clouds
  for (var i = 0; i < CLOUDS.length; i++) {
    var c = CLOUDS[i];
    var cx = ((c.x + (t * c.spd + c.off)) % (W + 340)) - 170;
    drawCloud(ctx, cx, c.y, c.sc, th);
  }

  // far mountains
  ctx.fillStyle = th.mtFar;
  ctx.beginPath();
  ctx.moveTo(-80, 700);
  for (var i = 0; i < MTS.length; i++) {
    var m = MTS[i];
    ctx.lineTo(m.x, 694);
    ctx.lineTo(m.x + m.w * 0.5, 694 - m.h);
    ctx.lineTo(m.x + m.w, 694);
  }
  ctx.lineTo(W + 80, 700);
  ctx.closePath(); ctx.fill();

  // snow caps
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (var i = 0; i < MTS.length; i++) {
    var m = MTS[i];
    if (m.h < 150) continue;
    var px = m.x + m.w * 0.5, py = 694 - m.h;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + 28, py + 58);
    ctx.lineTo(px + 12, py + 48);
    ctx.lineTo(px - 3, py + 60);
    ctx.lineTo(px - 18, py + 48);
    ctx.lineTo(px - 30, py + 58);
    ctx.closePath(); ctx.fill();
  }

  // near hill band
  ctx.fillStyle = th.hillNear;
  ctx.beginPath();
  ctx.moveTo(-40, GROUND);
  for (var x = -40; x <= W + 40; x += 32) ctx.lineTo(x, hillY(x) + 32);
  ctx.lineTo(W + 40, GROUND);
  ctx.closePath(); ctx.fill();

  // far trees on hills
  for (var i = 0; i < FTREES.length; i++) {
    var tr = FTREES[i];
    var tx = tr.x, ty = hillY(tx) + 32 - tr.d * 7;
    drawTree(ctx, tx, ty, 16 * tr.sc + 8, th.treeDark, th.tree);
  }
}

function drawCloud(ctx, x, y, sc, th) {
  ctx.fillStyle = th.cloud;
  ctx.beginPath();
  ctx.ellipse(x, y, 52 * sc, 17 * sc, 0, 0, 6.2832);
  ctx.ellipse(x - 30 * sc, y + 5 * sc, 30 * sc, 13 * sc, 0, 0, 6.2832);
  ctx.ellipse(x + 32 * sc, y + 5 * sc, 33 * sc, 14 * sc, 0, 0, 6.2832);
  ctx.ellipse(x + 6 * sc, y - 11 * sc, 30 * sc, 17 * sc, 0, 0, 6.2832);
  ctx.fill();
}

function drawTree(ctx, x, y, size, dark, light) {
  ctx.fillStyle = '#4a3524';
  ctx.fillRect(x - 2.5, y - size * 0.5, 5, size * 0.55);
  ctx.fillStyle = light;
  ctx.beginPath();
  ctx.moveTo(x, y - size * 1.9);
  ctx.lineTo(x + size * 0.62, y - size * 0.45);
  ctx.lineTo(x - size * 0.62, y - size * 0.45);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(x, y - size * 1.9);
  ctx.lineTo(x + size * 0.62, y - size * 0.45);
  ctx.lineTo(x, y - size * 0.45);
  ctx.closePath(); ctx.fill();
}

/* ================= GROUND ================= */
function drawGround(ctx, themeName) {
  var th = THEMES[themeName] || THEMES.day;
  var g = ctx.createLinearGradient(0, GROUND, 0, H);
  g.addColorStop(0, th.ground);
  g.addColorStop(1, th.groundBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, GROUND, W, H - GROUND);

  // grass edge
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  ctx.fillRect(0, GROUND, W, 3);

  // speckles
  for (var i = 0; i < SPECKS.length; i++) {
    var s = SPECKS[i];
    ctx.fillStyle = s.s > 0.5 ? 'rgba(0,0,0,.13)' : 'rgba(255,255,255,.07)';
    ctx.fillRect(s.x, s.y, s.r * 2.2, s.r);
  }
}

/* ================= DECALS (blood, stuck arrows) ================= */
function drawBloodDecal(ctx, d) {
  var a = Math.min(1, d.life / 8) * 0.85;
  ctx.globalAlpha = a;
  ctx.fillStyle = '#7d1410';
  ctx.beginPath();
  ctx.ellipse(d.x, d.y, d.rx, d.ry, 0, 0, 6.2832);
  ctx.fill();
  ctx.fillStyle = '#5c0d0a';
  for (var i = 0; i < d.splat.length; i++) {
    var s = d.splat[i];
    ctx.beginPath();
    ctx.arc(d.x + s.dx, d.y + s.dy, s.r, 0, 6.2832);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawStuckArrow(ctx, a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rot);
  ctx.strokeStyle = '#5a4326';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(4, 0); ctx.stroke();
  ctx.fillStyle = '#cfd6de';
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(11, -3.2); ctx.lineTo(11, 3.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = a.fletch || '#d8d8d8';
  ctx.beginPath();
  ctx.moveTo(-22, 0); ctx.lineTo(-16, -4); ctx.lineTo(-13, 0); ctx.closePath();
  ctx.moveTo(-22, 0); ctx.lineTo(-16, 4); ctx.lineTo(-13, 0); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ================= CASTLE ================= */
function drawCastle(ctx, flash, hpRatio, t) {
  ctx.save();

  // flag pole + banner
  ctx.strokeStyle = '#3a2c1c';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(52, WALL_TOP - 4); ctx.lineTo(52, WALL_TOP - 78); ctx.stroke();
  var wave = Math.sin(t * 3) * 5;
  ctx.fillStyle = '#b83a2e';
  ctx.beginPath();
  ctx.moveTo(54, WALL_TOP - 74);
  ctx.quadraticCurveTo(90, WALL_TOP - 70 + wave, 124, WALL_TOP - 62 + wave * 1.4);
  ctx.lineTo(124, WALL_TOP - 44 + wave * 1.2);
  ctx.quadraticCurveTo(90, WALL_TOP - 40 + wave * 0.6, 54, WALL_TOP - 42);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e8c15a';
  ctx.beginPath(); ctx.arc(84, WALL_TOP - 57 + wave * 0.5, 7, 0, 6.2832); ctx.fill();

  // crenellations at back
  ctx.fillStyle = '#8d8779';
  var merlons = [[6, 30], [42, 76]];
  for (var i = 0; i < merlons.length; i++) {
    ctx.fillRect(merlons[i][0], WALL_TOP - 26, merlons[i][1] - merlons[i][0], 26);
  }

  // wall body
  var wg = ctx.createLinearGradient(0, 0, WALL_W, 0);
  wg.addColorStop(0, '#7c766a');
  wg.addColorStop(0.85, '#948d7e');
  wg.addColorStop(1, '#a8a091');
  ctx.fillStyle = wg;
  ctx.fillRect(0, WALL_TOP, WALL_W, H - WALL_TOP);

  // bricks
  ctx.strokeStyle = 'rgba(0,0,0,.16)';
  ctx.lineWidth = 1.5;
  for (var y = WALL_TOP; y < H; y += 24) {
    var row = Math.floor((y - WALL_TOP) / 24);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WALL_W, y); ctx.stroke();
    var off = (row % 2) * 30;
    for (var x = off; x < WALL_W; x += 60) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, Math.min(y + 24, H)); ctx.stroke();
    }
  }

  // walkway top
  ctx.fillStyle = '#b0a894';
  ctx.fillRect(0, WALL_TOP - 6, WALL_W, 6);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(0, WALL_TOP, WALL_W, 3);

  // damage cracks
  if (hpRatio < 0.7) {
    ctx.strokeStyle = 'rgba(30,20,10,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(60, WALL_TOP + 60); ctx.lineTo(78, WALL_TOP + 110); ctx.lineTo(62, WALL_TOP + 155); ctx.lineTo(84, WALL_TOP + 205);
    ctx.stroke();
  }
  if (hpRatio < 0.4) {
    ctx.beginPath();
    ctx.moveTo(140, WALL_TOP + 40); ctx.lineTo(120, WALL_TOP + 95); ctx.lineTo(142, WALL_TOP + 140);
    ctx.moveTo(30, WALL_TOP + 200); ctx.lineTo(52, WALL_TOP + 250); ctx.lineTo(36, WALL_TOP + 300);
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,14,8,.28)';
    ctx.fillRect(0, WALL_TOP, WALL_W, H - WALL_TOP);
  }

  // impact flash
  if (flash > 0.01) {
    ctx.fillStyle = 'rgba(255,120,60,' + (flash * 0.4) + ')';
    ctx.fillRect(0, WALL_TOP, WALL_W, H - WALL_TOP);
  }

  ctx.restore();
}

/* ================= ENEMY KEEP ================= */
function drawEnemyCastle(ctx, keep, t) {
  if (!keep) return;
  var B = KEEP_BOX;
  var top = B.top;
  var towerW = 66;
  var towerTop = top - 84;
  var gateCX = B.gateX;
  var gateW = 92, gateH = 132;
  var ratio = Math.max(0, Math.min(1, keep.hp / keep.maxHp));

  if (keep.destroyed) {
    // rubble mound
    ctx.save();
    ctx.fillStyle = '#3f3c36';
    ctx.beginPath();
    ctx.moveTo(B.x, GROUND);
    ctx.lineTo(B.x + 20, GROUND - 62);
    ctx.lineTo(B.x + 70, GROUND - 98);
    ctx.lineTo(B.x + 122, GROUND - 66);
    ctx.lineTo(B.x + 172, GROUND - 112);
    ctx.lineTo(B.x + 224, GROUND - 58);
    ctx.lineTo(B.x + B.w, GROUND);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#55524a';
    for (var i = 0; i < 11; i++) {
      var bx = B.x + 16 + ((i * 61) % (B.w - 44));
      var by = GROUND - 12 - ((i * 37) % 74);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate((i * 0.7) % 1.2 - 0.6);
      ctx.fillRect(-16, -11, 32, 22);
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-16, -11, 32, 22);
      ctx.restore();
    }
    for (var s = 0; s < keep.stuck.length; s++) drawStuckArrow(ctx, keep.stuck[s]);
    ctx.restore();
    return;
  }

  ctx.save();

  /* towers */
  function tower(tx) {
    var g = ctx.createLinearGradient(tx, 0, tx + towerW, 0);
    g.addColorStop(0, '#33312c');
    g.addColorStop(1, '#45423b');
    ctx.fillStyle = g;
    ctx.fillRect(tx, towerTop, towerW, GROUND - towerTop);
    ctx.fillStyle = '#26241f';
    ctx.beginPath();
    ctx.moveTo(tx - 9, towerTop + 2);
    ctx.lineTo(tx + towerW / 2, towerTop - 54);
    ctx.lineTo(tx + towerW + 9, towerTop + 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)';
    ctx.lineWidth = 1.5;
    for (var y = towerTop + 24; y < GROUND; y += 24) {
      ctx.beginPath(); ctx.moveTo(tx, y); ctx.lineTo(tx + towerW, y); ctx.stroke();
    }
    ctx.fillStyle = '#12110f';
    ctx.fillRect(tx + towerW / 2 - 5, towerTop + 46, 10, 28);
  }
  tower(B.x - 16);
  tower(B.x + B.w - towerW + 16);

  /* body */
  var g2 = ctx.createLinearGradient(0, top, 0, GROUND);
  g2.addColorStop(0, '#4d4a42');
  g2.addColorStop(1, '#37342e');
  ctx.fillStyle = g2;
  ctx.fillRect(B.x, top, B.w, GROUND - top);

  /* crenellations */
  ctx.fillStyle = '#413e37';
  for (var c = 0; c < 6; c++) {
    ctx.fillRect(B.x + 8 + c * 46, top - 24, 28, 24);
  }

  /* brick joints */
  ctx.strokeStyle = 'rgba(0,0,0,.28)';
  ctx.lineWidth = 1.5;
  for (var y2 = top + 26; y2 < GROUND; y2 += 26) {
    ctx.beginPath(); ctx.moveTo(B.x, y2); ctx.lineTo(B.x + B.w, y2); ctx.stroke();
    var off = (Math.floor((y2 - top) / 26) % 2) * 34;
    for (var x2 = B.x + off; x2 < B.x + B.w; x2 += 68) {
      ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2, Math.min(y2 + 26, GROUND)); ctx.stroke();
    }
  }

  /* gate arch opening */
  var gl = gateCX - gateW / 2, gr = gateCX + gateW / 2, gt = GROUND - gateH;
  ctx.fillStyle = '#0e0d0b';
  ctx.beginPath();
  ctx.moveTo(gl, GROUND);
  ctx.lineTo(gl, gt + 34);
  ctx.quadraticCurveTo(gateCX, gt - 24, gr, gt + 34);
  ctx.lineTo(gr, GROUND);
  ctx.closePath(); ctx.fill();

  /* portcullis raised inside arch */
  ctx.strokeStyle = '#6a6459';
  ctx.lineWidth = 4;
  for (var b = 0; b < 5; b++) {
    var bxx = gl + 10 + b * (gateW - 20) / 4;
    ctx.beginPath(); ctx.moveTo(bxx, gt + 6); ctx.lineTo(bxx, gt + 58); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(gl, gt + 26); ctx.lineTo(gr, gt + 26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(gl, gt + 50); ctx.lineTo(gr, gt + 50); ctx.stroke();

  /* stone arch frame */
  ctx.strokeStyle = '#5e5a50';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(gl - 5, GROUND);
  ctx.lineTo(gl - 5, gt + 34);
  ctx.quadraticCurveTo(gateCX, gt - 30, gr + 5, gt + 34);
  ctx.lineTo(gr + 5, GROUND);
  ctx.stroke();

  /* arrow slits */
  ctx.fillStyle = '#14130f';
  ctx.fillRect(B.x + 46, top + 56, 14, 36);
  ctx.fillRect(B.x + B.w - 62, top + 56, 14, 36);

  /* torches flanking the gate */
  for (var k = -1; k <= 1; k += 2) {
    var fx = gateCX + k * 76, fy = GROUND - 152;
    var fl = 0.75 + 0.25 * Math.sin(t * 9 + k * 2);
    var grd = ctx.createRadialGradient(fx, fy, 2, fx, fy, 36 * fl);
    grd.addColorStop(0, 'rgba(255,210,120,.85)');
    grd.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(fx, fy, 36 * fl, 0, 6.2832); ctx.fill();
    ctx.fillStyle = Math.sin(t * 14 + k) > 0 ? '#ffd257' : '#ff9a3c';
    ctx.beginPath();
    ctx.ellipse(fx, fy - 9 * fl, 6, 14 * fl, 0, 0, 6.2832);
    ctx.fill();
    ctx.strokeStyle = '#54493a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(fx, fy + 6); ctx.lineTo(fx, fy + 20); ctx.stroke();
  }

  /* banner on left tower */
  var bx0 = B.x - 16 + towerW / 2;
  ctx.strokeStyle = '#2a2118'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(bx0, towerTop - 52); ctx.lineTo(bx0, towerTop - 110); ctx.stroke();
  var wv = Math.sin(t * 3 + 1) * 5;
  ctx.fillStyle = '#5c1b18';
  ctx.beginPath();
  ctx.moveTo(bx0 + 2, towerTop - 106);
  ctx.quadraticCurveTo(bx0 + 34, towerTop - 102 + wv, bx0 + 66, towerTop - 96 + wv * 1.4);
  ctx.lineTo(bx0 + 66, towerTop - 78 + wv * 1.2);
  ctx.quadraticCurveTo(bx0 + 34, towerTop - 74 + wv * 0.6, bx0 + 2, towerTop - 76);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a1614';
  ctx.beginPath(); ctx.arc(bx0 + 32, towerTop - 90 + wv * 0.5, 6, 0, 6.2832); ctx.fill();

  /* damage cracks */
  if (ratio < 0.7) {
    ctx.strokeStyle = 'rgba(15,12,8,.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(B.x + 60, top + 40);
    ctx.lineTo(B.x + 76, top + 96);
    ctx.lineTo(B.x + 58, top + 142);
    ctx.lineTo(B.x + 80, top + 196);
    ctx.stroke();
  }
  if (ratio < 0.4) {
    ctx.beginPath();
    ctx.moveTo(B.x + 172, top + 30); ctx.lineTo(B.x + 150, top + 92); ctx.lineTo(B.x + 176, top + 150);
    ctx.moveTo(B.x + 238, top + 70); ctx.lineTo(B.x + 214, top + 132); ctx.lineTo(B.x + 234, top + 190);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10,8,6,.3)';
    ctx.fillRect(B.x, top, B.w, GROUND - top);
  }

  /* impact flash */
  if (keep.flash > 0.01) {
    ctx.fillStyle = 'rgba(255,120,60,' + (keep.flash * 0.45) + ')';
    ctx.fillRect(B.x - 16, towerTop - 54, B.w + 32, GROUND - towerTop + 54);
  }

  /* arrows stuck in the keep */
  for (var s = 0; s < keep.stuck.length; s++) drawStuckArrow(ctx, keep.stuck[s]);

  /* hp bar above keep */
  var barW = B.w, barX = B.x, barY = top - 54;
  ctx.fillStyle = 'rgba(0,0,0,.7)';
  rr(ctx, barX - 2, barY - 2, barW + 4, 17, 4); ctx.fill();
  ctx.fillStyle = ratio > 0.55 ? '#5da84d' : (ratio > 0.25 ? '#d8a63a' : '#c8452f');
  rr(ctx, barX, barY, barW * ratio, 13, 3); ctx.fill();
  ctx.fillStyle = '#e8c15a';
  ctx.font = 'bold 14px Georgia';
  ctx.textAlign = 'center';
  ctx.fillText('CASTLE', barX + barW / 2, barY - 9);

  ctx.restore();
}

/* ================= ARCHER ================= */
/* o = {t, aiming, power, dirX, dirY, arrowId, recoil} */
function drawArcher(ctx, o) {
  var t = o.t;
  var dirX = o.dirX !== undefined ? o.dirX : 1;
  var dirY = o.dirY !== undefined ? o.dirY : -0.12;
  var power = o.power || 0;
  var F = ARCHER_F;
  var bob = Math.sin(t * 2.1) * 1.6;

  ctx.save();

  // recoil push
  var lenDir = Math.hypot(dirX, dirY) || 1;
  var dxn = dirX / lenDir;
  var dyn = dirY / lenDir;
  var bx = BOW.x - dxn * (o.recoil || 0) * 10;
  var by = BOW.y - dyn * (o.recoil || 0) * 10;
  var cx = (bx + ARCHER_F.x + 26) / 2;

  // legs
  ctx.strokeStyle = '#2f3a4a';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(F.x - 6, F.y - 30);
  ctx.lineTo(F.x - 10, F.y);
  ctx.moveTo(F.x + 8, F.y - 30);
  ctx.lineTo(F.x + 11, F.y);
  ctx.stroke();
  ctx.strokeStyle = '#3d2b18';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(F.x - 10, F.y); ctx.lineTo(F.x - 16, F.y);
  ctx.moveTo(F.x + 11, F.y); ctx.lineTo(F.x + 17, F.y);
  ctx.stroke();

  var topY = F.y - 30 + bob;

  // quiver (behind, on back = left side)
  ctx.save();
  ctx.translate(F.x - 14, topY - 18);
  ctx.rotate(0.35);
  ctx.fillStyle = '#5a3d1e';
  rr(ctx, -5, -20, 10, 28, 3); ctx.fill();
  ctx.fillStyle = '#cfd6de';
  for (var i = 0; i < 3; i++) {
    ctx.fillRect(-3.8 + i * 2.8, -26, 1.6, 8);
    ctx.fillStyle = i % 2 ? '#b83a2e' : '#d8d8d8';
  }
  ctx.restore();

  // torso (tunic)
  ctx.fillStyle = '#2f5fa8';
  rr(ctx, F.x - 12, topY - 28, 26, 32, 6); ctx.fill();
  ctx.fillStyle = '#1f4a86';
  rr(ctx, F.x - 12, topY - 2, 26, 6, 3); ctx.fill();
  // belt
  ctx.fillStyle = '#5a3d1e';
  ctx.fillRect(F.x - 12, topY + 2, 26, 4);
  ctx.fillStyle = '#e8c15a';
  ctx.fillRect(F.x + 1, topY + 2, 5, 4);

  // head
  var hx = F.x + 6, hy = topY - 44;
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath(); ctx.arc(hx, hy, 10.5, 0, 6.2832); ctx.fill();
  // hood
  ctx.fillStyle = '#37692f';
  ctx.beginPath();
  ctx.arc(hx, hy, 11, Math.PI * 0.95, Math.PI * 2.15);
  ctx.lineTo(hx - 4, hy - 6);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(hx + 2, hy - 11);
  ctx.quadraticCurveTo(hx + 14, hy - 18, hx + 18, hy - 8);
  ctx.quadraticCurveTo(hx + 12, hy - 12, hx + 4, hy - 7);
  ctx.closePath();
  ctx.fillStyle = '#b83a2e';
  ctx.fill();
  // eye
  ctx.fillStyle = '#20242c';
  ctx.fillRect(hx - 5.5, hy - 2, 3, 3);

  /* ---- arms ---- */
  var shoulder = { x: F.x + 4, y: topY - 24 };
  var frontHand = { x: bx - dxn * 3, y: by - dyn * 3 };

  // back arm (to nock)
  var pullLen = 5 + power * 38;
  var nock = { x: bx - dxn * pullLen, y: by - dyn * pullLen };
  ctx.strokeStyle = '#2f5fa8';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(shoulder.x - 1.5, shoulder.y + 0);
  var midX = (shoulder.x + nock.x) / 2;
  var midY = (shoulder.y + nock.y) / 2 - 2.5;
  ctx.quadraticCurveTo(midX, midY, nock.x, nock.y);
  ctx.stroke();
  // hand
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath(); ctx.arc(nock.x, nock.y, 3, 0, 6.2832); ctx.fill();

  // front arm (to bow hand)
  ctx.strokeStyle = '#3a6cb8';
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(shoulder.x + 0.8, shoulder.y + 0);
  ctx.quadraticCurveTo((shoulder.x + frontHand.x) / 2, shoulder.y + 5.5, frontHand.x, frontHand.y);
  ctx.stroke();

  /* ---- bow ---- */
  drawBow(ctx, bx, by, dxn, dyn, power, nock, o.arrowId || 'std');

  // front hand over bow grip
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath(); ctx.arc(frontHand.x, frontHand.y, 4, 0, 6.2832); ctx.fill();

  // draw power gauge arc at the bow (Bow Master style)
  if (o.aiming && power > 0.02) {
    var R2 = 62;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,.42)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(bx, by, R2, 0, 6.2832); ctx.stroke();
    ctx.strokeStyle = 'hsl(' + Math.round(120 - power * 120) + ',90%,55%)';
    ctx.beginPath(); ctx.arc(bx, by, R2, -Math.PI / 2, -Math.PI / 2 + 6.2832 * power); ctx.stroke();
  }

  ctx.restore();
}

function drawBow(ctx, bx, by, dirX, dirY, power, nock, arrowId) {
  var len = Math.hypot(dirX, dirY) || 1;
  var dx = dirX / len, dy = dirY / len;
  var px = -dy, py = dx;          // perpendicular
  var R = 48;

  var t1 = { x: bx + px * R - dx * 8, y: by + py * R - dy * 8 };
  var t2 = { x: bx - px * R - dx * 8, y: by - py * R - dy * 8 };

  // wooden limbs (curve toward target)
  var ctl = { x: bx + dx * (20 + power * 14), y: by + dy * (20 + power * 14) };
  ctx.strokeStyle = '#6b4a24';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.quadraticCurveTo(ctl.x, ctl.y, t2.x, t2.y);
  ctx.stroke();
  ctx.strokeStyle = '#8a6234';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.quadraticCurveTo(ctl.x, ctl.y, t2.x, t2.y);
  ctx.stroke();

  // string
  ctx.strokeStyle = power > 0.65 ? '#f0d9a8' : 'rgba(235,235,225,.9)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(t1.x, t1.y);
  ctx.lineTo(nock.x, nock.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.stroke();

  // arrow on string
  var tip = { x: nock.x + dx * 92, y: nock.y + dy * 92 };
  ctx.strokeStyle = '#5a4326';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(nock.x, nock.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  // head
  ctx.fillStyle = arrowId === 'fire' ? '#ff9a3c' : '#cfd6de';
  ctx.beginPath();
  ctx.moveTo(tip.x + dx * 7, tip.y + dy * 7);
  ctx.lineTo(tip.x - dx * 4 + px * 4.4, tip.y - dy * 4 + py * 4.4);
  ctx.lineTo(tip.x - dx * 4 - px * 4.4, tip.y - dy * 4 - py * 4.4);
  ctx.closePath(); ctx.fill();
  // fletching
  var f0 = { x: nock.x + dx * 14, y: nock.y + dy * 14 };
  var f1 = { x: nock.x + dx * 26, y: nock.y + dy * 26 };
  ctx.fillStyle = arrowId === 'fire' ? '#e0603a' : (arrowId === 'broad' ? '#e8c15a' : '#d8d8d8');
  ctx.beginPath();
  ctx.moveTo(f0.x, f0.y);
  ctx.lineTo(f0.x + px * 6 - dx * 4, f0.y + py * 6 - dy * 4);
  ctx.lineTo(f1.x + px * 4 - dx * 4, f1.y + py * 4 - dy * 4);
  ctx.lineTo(f1.x, f1.y);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(f0.x, f0.y);
  ctx.lineTo(f0.x - px * 6 - dx * 4, f0.y - py * 6 - dy * 4);
  ctx.lineTo(f1.x - px * 4 - dx * 4, f1.y - py * 4 - dy * 4);
  ctx.lineTo(f1.x, f1.y);
  ctx.closePath(); ctx.fill();

  // grip
  ctx.strokeStyle = '#3a2a16';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(bx - dx * 7, by - dy * 7);
  ctx.lineTo(bx + dx * 7, by + dy * 7);
  ctx.stroke();
}

/* ================= ENEMIES ================= */
function drawEnemy(ctx, e) {
  var def = e.def;
  var w = e.w, h = e.h;
  var legH = Math.round(h * 0.3);
  var bodyH = h - legH - Math.round(h * 0.18);
  var headR = Math.round(h * 0.09) + 1;

  ctx.save();
  ctx.translate(e.x + w / 2, GROUND);

  if (e.state === 'dying') {
    ctx.globalAlpha = e.alpha;
    ctx.rotate(e.deathRot);
  }

  var walk = e.state === 'walk' || e.state === 'shoot';
  var sw = walk ? Math.sin(e.walkT) : 0;
  var bodyBob = walk ? Math.abs(Math.sin(e.walkT)) * 2.5 : Math.sin(e.t * 2) * 1.2;

  /* legs */
  var legSwing = sw * (def.boss ? 8 : 6);
  ctx.strokeStyle = '#33313a';
  ctx.lineWidth = w * 0.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-w * 0.14, -legH);
  ctx.lineTo(-w * 0.14 - legSwing, 0);
  ctx.moveTo(w * 0.14, -legH);
  ctx.lineTo(w * 0.14 + legSwing, 0);
  ctx.stroke();
  // boots
  ctx.strokeStyle = '#241f18';
  ctx.lineWidth = w * 0.22;
  ctx.beginPath();
  ctx.moveTo(-w * 0.14 - legSwing, 0);
  ctx.lineTo(-w * 0.14 - legSwing - 5, 0);
  ctx.moveTo(w * 0.14 + legSwing, 0);
  ctx.lineTo(w * 0.14 + legSwing - 5, 0);
  ctx.stroke();

  var top = -legH - bodyH - bodyBob;

  /* torso */
  ctx.fillStyle = def.color;
  rr(ctx, -w / 2, top, w, bodyH + legH * 0.15, w * 0.24);
  ctx.fill();
  // tunic trim
  ctx.fillStyle = def.trim;
  ctx.fillRect(-w / 2, top + bodyH - 8, w, 8);
  // straps
  ctx.strokeStyle = 'rgba(0,0,0,.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, top + 4);
  ctx.lineTo(w * 0.3, top + bodyH - 12);
  ctx.stroke();

  // armor plate
  if (def.armor) {
    ctx.fillStyle = '#8a8f99';
    rr(ctx, -w * 0.34, top + 3, w * 0.68, bodyH * 0.52, 5);
    ctx.fill();
    ctx.strokeStyle = '#5f656e';
    ctx.lineWidth = 1.5;
    rr(ctx, -w * 0.34, top + 3, w * 0.68, bodyH * 0.52, 5);
    ctx.stroke();
    ctx.fillStyle = '#c9ced6';
    ctx.beginPath(); ctx.arc(-w * 0.26, top + 9, 1.6, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.26, top + 9, 1.6, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(0, top + bodyH * 0.45, 1.6, 0, 6.2832); ctx.fill();
  }

  /* head */
  var hy = top - headR - 2;
  ctx.fillStyle = '#d9a878';
  ctx.beginPath(); ctx.arc(w * 0.06, hy, headR, 0, 6.2832); ctx.fill();

  // headgear
  if (e.type === 'shield' || e.type === 'warlord' || e.type === 'captain' || def.boss) {
    ctx.fillStyle = e.type === 'warlord' ? '#8a8f99' : (e.type === 'frostgiant' ? '#c7f2ff' : (e.type === 'necromancer' ? '#443052' : (e.type === 'stormcaller' ? '#8acaff' : '#7d838e')));
    rr(ctx, w * 0.06 - headR - 1, hy - headR - 1, headR * 2 + 2, headR * 1.7, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,20,24,.85)';
    ctx.fillRect(w * 0.06 - headR, hy - 1, headR * 1.5, 3);
    if (e.type === 'necromancer') {
      ctx.fillStyle = '#c587ff';
      ctx.beginPath(); ctx.arc(w * 0.06, hy - 1, 2.2, 0, 6.2832); ctx.fill();
    }
    if (e.type === 'captain') {
      ctx.fillStyle = '#b83a2e';
      ctx.beginPath();
      ctx.ellipse(w * 0.06 + 2, hy - headR - 5, 3.5, 7, 0.35, 0, 6.2832);
      ctx.fill();
    }
    if (e.type === 'warlord' || e.type === 'ogre' || e.type === 'frostgiant') {
      ctx.fillStyle = e.type === 'frostgiant' ? '#d8f8ff' : '#e6d8b8';
      ctx.beginPath();
      ctx.moveTo(w * 0.06 - headR + 1, hy - headR + 2);
      ctx.lineTo(w * 0.06 - headR - 10, hy - headR - 14);
      ctx.lineTo(w * 0.06 - headR + 7, hy - headR - 2);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.06 + headR - 1, hy - headR + 2);
      ctx.lineTo(w * 0.06 + headR + 10, hy - headR - 14);
      ctx.lineTo(w * 0.06 + headR - 7, hy - headR - 2);
      ctx.closePath(); ctx.fill();
    }
  } else if (e.type === 'runner' || e.type === 'crossbow') {
    ctx.fillStyle = def.trim;
    ctx.beginPath();
    ctx.arc(w * 0.06, hy, headR + 1, Math.PI, Math.PI * 2.1);
    ctx.fill();
    ctx.fillRect(w * 0.06 - headR - 1, hy - 1, headR * 2 + 2, 4);
  } else if (e.type === 'brute') {
    ctx.strokeStyle = 'rgba(60,30,20,.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.06 - 4, hy - headR + 3);
    ctx.lineTo(w * 0.06 + 4, hy - headR + 3);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#4a3524';
    ctx.beginPath();
    ctx.arc(w * 0.06, hy, headR + 1, Math.PI * 0.9, Math.PI * 2.2);
    ctx.fill();
  }

  // eye (facing left)
  ctx.fillStyle = '#1c1c22';
  ctx.fillRect(w * 0.06 - headR * 0.75, hy - 2, 3, 3.4);

  /* shield (front = left side) */
  if (def.shield) {
    ctx.fillStyle = '#8a939e';
    rr(ctx, -w / 2 - 9, top + 4, 14, bodyH + legH * 0.1, 6);
    ctx.fill();
    ctx.strokeStyle = '#5b636d';
    ctx.lineWidth = 2;
    rr(ctx, -w / 2 - 9, top + 4, 14, bodyH + legH * 0.1, 6);
    ctx.stroke();
    ctx.fillStyle = '#b7bec7';
    ctx.beginPath(); ctx.arc(-w / 2 - 2, top + bodyH / 2 + 6, 4, 0, 6.2832); ctx.fill();
  }

  /* weapon */
  var pivot = { x: -w * 0.16, y: top + bodyH * 0.35 };
  drawWeapon(ctx, def.weapon, pivot, w, e);

  /* hp bar */
  if (e.state !== 'dying') {
    var bw = Math.max(w + 8, 42);
    var by = -h - 16;
    var ratio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    rr(ctx, -bw / 2 - 1, by - 1, bw + 2, 8, 3); ctx.fill();
    ctx.fillStyle = ratio > 0.55 ? '#5da84d' : (ratio > 0.25 ? '#d8a63a' : '#c8452f');
    rr(ctx, -bw / 2, by, bw * ratio, 6, 2.5); ctx.fill();
    if (def.boss) {
      ctx.fillStyle = '#e8c15a';
      ctx.font = 'bold 10px Georgia';
      ctx.textAlign = 'center';
      ctx.fillText(String(def.name || 'ELITE').toUpperCase(), 0, by - 5);
    }
  }

  /* arrow lodged in the body (stays while the corpse falls) */
  if (e.stuckArrow) {
    drawStuckArrow(ctx, {
      x: e.stuckArrow.dx, y: e.stuckArrow.dy,
      rot: e.stuckArrow.rot, fletch: e.stuckArrow.fletch
    });
  }

  ctx.restore();
}

function drawWeapon(ctx, kind, p, w, e) {
  var big = e.def.boss ? 1.35 : (e.type === 'brute' ? 1.2 : 1);
  var a = -2.45; // default raised-forward

  if (e.state === 'attack') {
    var k = e.attackT;
    if (k < 0.3) a = -2.45 + (k / 0.3) * 1.95;          // wind up to -0.5
    else if (k < 0.7) a = -0.5 + ((k - 0.3) / 0.4) * 2.9; // swing forward to 2.4
    else a = 2.4 + ((k - 0.7) / 0.3) * 0.45;
  } else if (e.state === 'shoot') {
    a = Math.PI; // pointing left (at castle)
  }

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(a);

  if (kind === 'sword') {
    var L = 30 * big;
    ctx.strokeStyle = '#5a3d1e';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-10, 0); ctx.stroke();
    ctx.strokeStyle = '#cfd6de';
    ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.strokeStyle = '#f2f5f8';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(2, -1.4); ctx.lineTo(L - 2, -1.4); ctx.stroke();
    ctx.strokeStyle = '#8a7448';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
  } else if (kind === 'dagger') {
    var L = 17;
    ctx.strokeStyle = '#cfd6de';
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.strokeStyle = '#5a3d1e';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(0, 0); ctx.stroke();
  } else if (kind === 'club') {
    var L = 32 * big;
    ctx.strokeStyle = '#6b4a24';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(L * 0.7, 0); ctx.stroke();
    ctx.fillStyle = '#7d5a2e';
    ctx.beginPath(); ctx.arc(L * 0.85, 0, 8.5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#4a3520';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(L * 0.85, 0, 8.5, 0, 6.2832); ctx.stroke();
    // spikes
    ctx.fillStyle = '#c9c2b2';
    for (var i = 0; i < 3; i++) {
      var sa = -0.8 + i * 0.8;
      ctx.beginPath();
      ctx.moveTo(L * 0.85 + Math.cos(sa) * 8, Math.sin(sa) * 8);
      ctx.lineTo(L * 0.85 + Math.cos(sa) * 14, Math.sin(sa) * 14);
      ctx.lineTo(L * 0.85 + Math.cos(sa + 0.28) * 8, Math.sin(sa + 0.28) * 8);
      ctx.closePath(); ctx.fill();
    }
  } else if (kind === 'axe') {
    var L = 36;
    ctx.strokeStyle = '#5a3d1e';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(L, 0); ctx.stroke();
    ctx.fillStyle = '#b7bec7';
    ctx.beginPath();
    ctx.moveTo(L - 4, -6);
    ctx.quadraticCurveTo(L + 16, -4, L + 18, 12);
    ctx.quadraticCurveTo(L + 6, 6, L - 4, 6);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7f8792';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (kind === 'crossbow') {
    ctx.strokeStyle = '#5a3d1e';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(24, 0); ctx.stroke();
    ctx.strokeStyle = '#8a939e';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(6, -14); ctx.lineTo(6, 14); ctx.stroke();
    ctx.strokeStyle = 'rgba(230,230,230,.9)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(6, -14); ctx.lineTo(-6, 0); ctx.lineTo(6, 14);
    ctx.stroke();
    if (e.state === 'shoot' && e.shotAnim > 0) {
      ctx.fillStyle = '#cfd6de';
      ctx.fillRect(-14, -1.6, 16, 3.2);
    }
  }

  ctx.restore();
}

/* ================= PROJECTILES ================= */
function arrowFletchColor(type) {
  if (type === 'fire') return '#e0603a';
  if (type === 'broad') return '#e8c15a';
  if (type === 'poison') return '#9be85c';
  if (type === 'frost') return '#9fd8ff';
  if (type === 'chain') return '#ffe066';
  if (type === 'lightning') return '#68dcff';
  if (type === 'holy') return '#fff3c4';
  if (type === 'cluster') return '#d0d0d0';
  if (type === 'gatling') return '#c2c2c2';
  if (type === 'fan') return '#dcc06a';
  if (type === 'sunder') return '#ffb066';
  if (type === 'glacial') return '#8fd6ff';
  if (type === 'leech') return '#ff5a7a';
  return '#e2e2e2';
}

function drawArrowEnt(ctx, a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rot);
  var magic = ({
    chain: '#78e8ff', holy: '#ffe47a', glacial: '#9fe9ff',
    leech: '#ff62c7', sunder: '#ffad62', lightning: '#68dcff',
    homing: '#70f5d2', cluster: '#d29aff', gatling: '#fff078'
  })[a.type];
  if (magic) {
    var pulse = 0.68 + Math.sin(ambT * 13 + a.x * 0.03) * 0.18;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowColor = magic;
    ctx.shadowBlur = a.type === 'glacial' || a.type === 'holy' ? 20 : 14;
    ctx.fillStyle = magic;
    ctx.beginPath(); ctx.arc(2, 0, a.type === 'glacial' ? 7 : 5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = magic;
    ctx.lineWidth = a.type === 'glacial' ? 2 : 1.5;
    ctx.beginPath(); ctx.moveTo(-23, 0); ctx.lineTo(3, 0); ctx.stroke();
    if (a.type === 'chain') {
      ctx.beginPath(); ctx.moveTo(-20, -3); ctx.lineTo(-15, 3); ctx.lineTo(-10, -3); ctx.lineTo(-5, 3); ctx.lineTo(0, -2); ctx.stroke();
    } else if (a.type === 'holy') {
      ctx.beginPath(); ctx.moveTo(2, -11); ctx.lineTo(4, -2); ctx.lineTo(11, 0); ctx.lineTo(4, 2); ctx.lineTo(2, 11); ctx.lineTo(0, 2); ctx.lineTo(-7, 0); ctx.lineTo(0, -2); ctx.closePath(); ctx.fill();
    } else if (a.type === 'lightning') {
      ctx.beginPath(); ctx.moveTo(-19, -6); ctx.lineTo(-12, 1); ctx.lineTo(-15, -4); ctx.lineTo(-6, 5); ctx.stroke();
    } else if (a.type === 'glacial') {
      ctx.beginPath(); ctx.moveTo(-9, -7); ctx.lineTo(-6, -3); ctx.lineTo(-9, 1); ctx.lineTo(-12, -3); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-16, 4); ctx.lineTo(-13, 8); ctx.lineTo(-16, 12); ctx.lineTo(-19, 8); ctx.closePath(); ctx.fill();
    } else if (a.type === 'leech') {
      ctx.beginPath(); ctx.ellipse(-5, 0, 13, 5, Math.sin(ambT * 5) * 0.25, 0, 6.2832); ctx.stroke();
    } else if (a.type === 'sunder') {
      ctx.beginPath(); ctx.moveTo(-16, -7); ctx.lineTo(-12, -2); ctx.lineTo(-16, 3); ctx.lineTo(-20, -2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-2, 9); ctx.lineTo(-5, 13); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  ctx.strokeStyle = '#5a4326';
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(5, 0); ctx.stroke();
  ctx.fillStyle = a.type === 'fire' ? '#ff9a3c' : (a.type === 'frost' ? '#bfe8ff' : '#cfd6de');
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-1, -4); ctx.lineTo(-1, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = arrowFletchColor(a.type);
  ctx.beginPath();
  ctx.moveTo(-24, 0); ctx.lineTo(-18, -5); ctx.lineTo(-14, 0); ctx.closePath();
  ctx.moveTo(-24, 0); ctx.lineTo(-18, 5); ctx.lineTo(-14, 0); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBoltEnt(ctx, b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.rot);
  ctx.strokeStyle = '#3d3126';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(5, 0); ctx.stroke();
  ctx.fillStyle = '#a9b0ba';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(1, -3); ctx.lineTo(1, 3); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/* ================= WEATHER / OVERLAYS ================= */
function drawRain(ctx, t) {
  ctx.strokeStyle = 'rgba(190,212,240,.34)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (var i = 0; i < 110; i++) {
    var s = i * 137.5;
    var spd = 700 + (i % 7) * 90;
    var x = ((s * 3.7 + t * 260) % (W + 300)) - 150;
    var y = ((s * 1.3 + t * spd) % (H + 80)) - 40;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 10, y + 30);
  }
  ctx.stroke();
}

function drawNightShade(ctx) {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(6,10,28,.42)');
  g.addColorStop(0.6, 'rgba(6,10,28,.26)');
  g.addColorStop(1, 'rgba(4,6,20,.34)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawVignette(ctx) {
  var g = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

