/* ============ Castle Rangers :: WebAudio SFX (no asset files) ============ */

var Sound = (function () {
  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var failed = false;

  function init() {
    if (ctx || failed) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { failed = true; return; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = vol();
      master.connect(ctx.destination);
      // pre-render 1s of white noise
      var len = Math.floor(ctx.sampleRate * 1);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { failed = true; }
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  }

  function vol() { return SETTINGS.mute ? 0 : (SETTINGS.volume / 100); }
  function refresh() { if (master) master.gain.value = vol(); }

  function ok() { return !!ctx && !SETTINGS.mute && SETTINGS.volume > 0; }

  /* short oscillator tone with envelope + optional pitch slide */
  function tone(type, f0, f1, dur, gain, delay) {
    if (!ok()) return;
    var t0 = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  /* filtered noise burst */
  function noise(dur, freq, q, gain, delay) {
    if (!ok() || !noiseBuf) return;
    var t0 = ctx.currentTime + (delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.03);
  }

  return {
    init, resume, refresh,
    get ctx() { return ctx; },

    shoot() {
      tone('triangle', 700, 120, 0.16, 0.28);
      noise(0.12, 1800, 0.8, 0.22);
    },
    hit() {
      tone('square', 200, 90, 0.09, 0.16);
      noise(0.07, 900, 1.2, 0.2);
    },
    headshot() {
      tone('square', 380, 140, 0.14, 0.2);
      noise(0.1, 1400, 1, 0.24);
      tone('sine', 900, 1400, 0.1, 0.14, 0.04);
    },
    ground() {
      noise(0.1, 350, 0.7, 0.2);
      tone('sine', 130, 70, 0.1, 0.12);
    },
    death() {
      tone('sawtooth', 260, 60, 0.3, 0.16);
      noise(0.2, 500, 0.6, 0.16);
    },
    clank() {
      noise(0.14, 3600, 4, 0.24);
      tone('square', 1200, 700, 0.08, 0.1);
    },
    block() {
      noise(0.1, 5200, 6, 0.3);
      tone('triangle', 1600, 900, 0.07, 0.12);
    },
    buildHit() {
      tone('sine', 95, 55, 0.2, 0.3);
      noise(0.15, 250, 0.5, 0.25);
    },
    bolt() {
      tone('sawtooth', 480, 200, 0.12, 0.1);
      noise(0.09, 2200, 1.5, 0.12);
    },
    coin() {
      tone('sine', 880, 880, 0.07, 0.15);
      tone('sine', 1320, 1320, 0.1, 0.15, 0.07);
    },
    click() {
      tone('square', 500, 380, 0.045, 0.1);
    },
    win() {
      var notes = [523, 659, 784, 1047];
      for (var i = 0; i < notes.length; i++) tone('triangle', notes[i], notes[i], 0.24, 0.16, i * 0.13);
    },
    lose() {
      var notes = [392, 330, 262, 196];
      for (var i = 0; i < notes.length; i++) tone('sawtooth', notes[i], notes[i] * 0.98, 0.3, 0.13, i * 0.17);
    },
    spawn() {
      tone('sine', 220, 330, 0.12, 0.07);
    },
    boss() {
      tone('sawtooth', 90, 55, 0.5, 0.25);
      tone('sawtooth', 140, 90, 0.5, 0.18, 0.1);
      noise(0.4, 200, 0.5, 0.2);
    },
    explode() {
      noise(0.4, 160, 0.4, 0.55);
      tone('sine', 140, 35, 0.45, 0.4);
      noise(0.2, 900, 0.8, 0.3, 0.02);
    }
  };
})();
