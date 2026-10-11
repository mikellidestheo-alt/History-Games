/* Original pixel art, generated as inline SVG: portraits, icons, desk objects, stamps. */
(function () {
  'use strict';
  var CWE = (window.CWE = window.CWE || {});
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  /* rows: array of strings; palette: char -> colour ('.' or ' ' is transparent). */
  function bitmap(rows, palette, cls) {
    var w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    var svg = el('svg', {
      viewBox: '0 0 ' + w + ' ' + rows.length,
      'aria-hidden': 'true', focusable: 'false', 'shape-rendering': 'crispEdges'
    });
    if (cls) svg.setAttribute('class', cls);
    var paths = {};
    rows.forEach(function (row, y) {
      var start = -1, ch = null;
      for (var x = 0; x <= row.length; x++) {
        var c = x < row.length ? row[x] : null;
        if (c !== ch) {
          if (ch && palette[ch] && start >= 0) {
            (paths[ch] = paths[ch] || []).push('M' + start + ' ' + y + 'h' + (x - start) + 'v1h-' + (x - start) + 'z');
          }
          ch = c; start = x;
        }
      }
    });
    Object.keys(paths).forEach(function (ch) {
      svg.appendChild(el('path', { d: paths[ch].join(''), fill: palette[ch] }));
    });
    return svg;
  }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var s = seed || 1;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* A 16x16 portrait for a fictional historian, varied by name. */
  function portrait(name, redacted) {
    var r = rng(hash(String(name || 'anon')));
    function pick(a) { return a[Math.floor(r() * a.length)]; }
    var pal = {
      k: '#1b1a17', s: pick(['#f1c9a5', '#e0ac85', '#c68a62', '#9c6644', '#f5d6bd']),
      h: pick(['#2b2118', '#5a3b22', '#8a6a42', '#b9b2a6', '#1d1d1d', '#a04a24']),
      c: pick(['#3b4a6b', '#5a5248', '#2f4f3f', '#6b3434', '#44444c']),
      w: '#f2efe6', g: '#2a2a2a', b: '#9fb4c7', t: pick(['#8c2d2d', '#2d4c8c', '#7a6a2a', '#3b3b3b'])
    };
    var hair = pick(['short', 'part', 'long', 'bald', 'bun']);
    var glasses = r() < 0.45;
    var rows = [
      '................',
      '.....hhhhhh.....',
      '....hhhhhhhh....',
      '...hhssssssh....',
      '...hssssssssh...',
      '...ssssssssss...',
      '...sskssssksss..',
      '...ssssssssss...',
      '...sssssssssss..',
      '....ssskkssss...',
      '.....ssssssss...',
      '......ssssss....',
      '...cccwwtwwccc..',
      '..ccccwwtwwcccc.',
      '.cccccwwtwwccccc',
      '.cccccccccccccc.'
    ];
    rows = rows.map(function (x) { return x.split(''); });
    if (hair === 'bald') { rows[1] = '................'.split(''); rows[2] = '....h......h....'.split(''); }
    if (hair === 'long') { [3, 4, 5, 6, 7, 8, 9, 10].forEach(function (y) { rows[y][3] = 'h'; rows[y][13] = 'h'; }); }
    if (hair === 'bun') { rows[0] = '......hhhh......'.split(''); }
    if (hair === 'part') { rows[2][6] = 's'; rows[1][6] = 's'; }
    if (glasses) {
      rows[6] = '...sgggsgggsss..'.split('');
      rows[6][5] = 'b'; rows[6][9] = 'b';
    }
    rows = rows.map(function (x) { return x.join(''); });
    if (redacted) {
      pal = { k: '#111', s: '#3a3a3a', h: '#2a2a2a', c: '#222', w: '#333', g: '#111', b: '#111', t: '#333' };
    }
    var svg = bitmap(rows, pal, 'portrait');
    if (redacted) {
      svg.appendChild(el('rect', { x: 2, y: 5, width: 12, height: 3, fill: '#000' }));
    }
    return svg;
  }

  var ICONS = {
    book: [
      '..kkkkkkkkkk..',
      '.krrrrrrrrrrk.',
      '.krryyyyyyrrk.',
      '.krrrrrrrrrrk.',
      '.krryyyyyyrrk.',
      '.krrrrrrrrrrk.',
      '.krrrrrrrrrrk.',
      '.krrrrrrrrrrk.',
      '.krrrrrrrrrrk.',
      '.kwwwwwwwwwwk.',
      '..kkkkkkkkkk..'
    ],
    gear: [
      '.....kk.....',
      '..k.kkkk.k..',
      '.kkkkkkkkkk.',
      '..kkk..kkk..',
      '.kkk....kkk.',
      'kkk......kkk',
      'kkk......kkk',
      '.kkk....kkk.',
      '..kkk..kkk..',
      '.kkkkkkkkkk.',
      '..k.kkkk.k..',
      '.....kk.....'
    ],
    soundOn: [
      '.....k......',
      '....kk...k..',
      '...kkk....k.',
      'kkkkkk..k.k.',
      'kkkkkk...k.k',
      'kkkkkk...k.k',
      'kkkkkk..k.k.',
      '...kkk....k.',
      '....kk...k..',
      '.....k......'
    ],
    soundOff: [
      '.....k......',
      '....kk......',
      '...kkk......',
      'kkkkkk.k...k',
      'kkkkkk..k.k.',
      'kkkkkk...k..',
      'kkkkkk..k.k.',
      '...kkk.k...k',
      '....kk......',
      '.....k......'
    ],
    flag: [
      'kkkkkk..',
      'krrrrrk.',
      'krrrrrrk',
      'krrrrrk.',
      'kkkkkk..',
      'k.......',
      'k.......',
      'k.......'
    ],
    check: [
      '.........kk',
      '........kk.',
      '.......kk..',
      'kk....kk...',
      '.kk..kk....',
      '..kkkk.....',
      '...kk......'
    ],
    cross: [
      'kk.....kk',
      '.kk...kk.',
      '..kk.kk..',
      '...kkk...',
      '..kk.kk..',
      '.kk...kk.',
      'kk.....kk'
    ],
    clock: [
      '...kkkkk...',
      '.kk.....kk.',
      '.k...k...k.',
      'k....k....k',
      'k....k....k',
      'k....kkk..k',
      'k.........k',
      '.k.......k.',
      '.kk.....kk.',
      '...kkkkk...'
    ],
    close: [
      'kk....kk',
      'kkk..kkk',
      '.kkkkkk.',
      '..kkkk..',
      '..kkkk..',
      '.kkkkkk.',
      'kkk..kkk',
      'kk....kk'
    ]
  };

  function icon(name, colors) {
    var pal = { k: 'currentColor', r: '#b33a2c', y: '#e8c766', w: '#f4efe2' };
    if (colors) for (var c in colors) pal[c] = colors[c];
    return bitmap(ICONS[name], pal, 'icon icon-' + name);
  }

  /* Desk objects for wide layouts (decorative only). */
  function lamp() {
    return bitmap([
      '.....gggggggggg.....',
      '...gggggggggggggg...',
      '..gggggggggggggggg..',
      '.gggggggggggggggggg.',
      '.yyyyyyyyyyyyyyyyyy.',
      '.........kk.........',
      '.........kk.........',
      '.........kk.........',
      '.........kk.........',
      '.........kk.........',
      '......kkkkkkkk......',
      '....kkkkkkkkkkkk....'
    ], { g: 'var(--lamp, #2f5b46)', y: '#f7e6a3', k: '#262420' }, 'decor-lamp');
  }

  function mug() {
    return bitmap([
      '..w..w....',
      '...w..w...',
      '.mmmmmmm..',
      '.mccccmmmm',
      '.mmmmmmm.m',
      '.mmmmmmm.m',
      '.mmmmmmmmm',
      '.mmmmmmm..',
      '..mmmmm...'
    ], { m: 'var(--mug, #c9c2b2)', c: '#4a2e1a', w: 'rgba(255,255,255,.6)' }, 'decor-mug');
  }

  function building() {
    var rows = [
      '..........................tt..........................',
      '.........................tttt.........................',
      '....................bbbbbbbbbbbbbb....................',
      '....................bwwbwwbbwwbwwb....................',
      '....................bbbbbbbbbbbbbb....................',
      '......bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb......',
      '......bwwbwwbwwbwwbwwbbbbbbbbbbbbwwbwwbwwbwwbwwb......',
      '......bwwbwwbwwbwwbwwbsssssssssbbwwbwwbwwbwwbwwb......',
      '......bbbbbbbbbbbbbbbbsssssssssbbbbbbbbbbbbbbbbb......',
      '......bwwbwwbwwbwwbwwbbbbbbbbbbbbwwbwwbwwbwwbwwb......',
      '......bwwbwwbwwbwwbwwbbbbbbbbbbbbwwbwwbwwbwwbwwb......',
      '......bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb......',
      '......bwwbwwbwwbwwbwwbbbbddddbbbbwwbwwbwwbwwbwwb......',
      '......bwwbwwbwwbwwbwwbbbbddddbbbbwwbwwbwwbwwbwwb......',
      '......bbbbbbbbbbbbbbbbbbbddddbbbbbbbbbbbbbbbbbbb......',
      'gggggggggggggggggggggggggggggggggggggggggggggggggggggg'
    ];
    return bitmap(rows, { b: '#5b5348', w: '#f2d98a', s: '#c9b458', d: '#2a241c', t: '#8a8174', g: '#3c3a33' }, 'decor-building');
  }

  /* The ink mark left by a stamp on a manuscript. */
  function stampMark(kind, year) {
    var wrap = document.createElement('div');
    wrap.className = 'stamp-mark stamp-mark-' + (kind === 'PUBLISH' ? 'publish' : 'reject');
    wrap.setAttribute('aria-hidden', 'true');
    var main = CWE.pixelText(kind === 'PUBLISH' ? 'PUBLISH' : 'REJECT', 'stamp-main');
    var sub = CWE.pixelText('MERIDIAN PRESS' + (year ? ' · ' + year : ''), 'stamp-sub');
    wrap.appendChild(main);
    wrap.appendChild(sub);
    // Speckles where the ink did not take.
    var r = rng(hash(kind + year + Date.now()));
    var specks = el('svg', { class: 'stamp-specks', viewBox: '0 0 100 40', preserveAspectRatio: 'none' });
    for (var i = 0; i < 26; i++) {
      specks.appendChild(el('rect', {
        x: (r() * 100).toFixed(1), y: (r() * 40).toFixed(1),
        width: (0.6 + r() * 1.6).toFixed(1), height: (0.6 + r() * 1.6).toFixed(1),
        fill: 'var(--paper)', opacity: (0.5 + r() * 0.5).toFixed(2)
      }));
    }
    wrap.appendChild(specks);
    return wrap;
  }

  CWE.art = { bitmap: bitmap, portrait: portrait, icon: icon, lamp: lamp, mug: mug, building: building, stampMark: stampMark, hash: hash };
})();
