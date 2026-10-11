/* Short stamp and paper sounds, synthesised with the Web Audio API.
   Nothing is created until the player turns sound on with a tap (iOS requirement). */
(function () {
  'use strict';
  var CWE = (window.CWE = window.CWE || {});
  var ctx = null;
  var enabled = false;

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) { /* ignore */ } }
    return ctx;
  }

  function noiseBuffer(c, seconds) {
    var len = Math.max(1, Math.floor(c.sampleRate * seconds));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function stamp() {
    if (!enabled) return;
    var c = ensure(); if (!c) return;
    var t = c.currentTime;
    // Low thump
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.16);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.25);
    // Wooden knock
    var n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.08);
    var f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    var ng = c.createGain();
    ng.gain.setValueAtTime(0.5, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    n.connect(f); f.connect(ng); ng.connect(c.destination);
    n.start(t);
  }

  function paper() {
    if (!enabled) return;
    var c = ensure(); if (!c) return;
    var t = c.currentTime;
    var n = c.createBufferSource(); n.buffer = noiseBuffer(c, 0.35);
    var f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(1800, t);
    f.frequency.linearRampToValueAtTime(4200, t + 0.3);
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    n.connect(f); f.connect(g); g.connect(c.destination);
    n.start(t);
  }

  function tick() {
    if (!enabled) return;
    var c = ensure(); if (!c) return;
    var t = c.currentTime;
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + 0.05);
  }

  CWE.audio = {
    setEnabled: function (on) { enabled = !!on; if (enabled) ensure(); },
    isEnabled: function () { return enabled; },
    stamp: stamp, paper: paper, tick: tick
  };
})();
