/* Meridian pixel lettering: a tiny original 5x7 bitmap alphabet drawn as inline SVG.
   Used for headings, stamps and signage only. Body text always uses system fonts. */
(function () {
  'use strict';
  var CWE = (window.CWE = window.CWE || {});

  // Each glyph: 7 rows (cap height). Comma and semicolon have an 8th descender row.
  var G = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    'J': ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
    '.': ['.', '.', '.', '.', '.', '.', '#'],
    ',': ['..', '..', '..', '..', '..', '.#', '.#', '#.'],
    ':': ['.', '.', '#', '.', '.', '#', '.'],
    ';': ['..', '..', '.#', '..', '..', '.#', '.#', '#.'],
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    "'": ['#', '#', '.', '.', '.', '.', '.'],
    '"': ['#.#', '#.#', '...', '...', '...', '...', '...'],
    '-': ['....', '....', '....', '####', '....', '....', '....'],
    '–': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '—': ['.......', '.......', '.......', '#######', '.......', '.......', '.......'],
    '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
    ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
    '·': ['.', '.', '.', '#', '.', '.', '.'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
    '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '.#.#.', '#####', '.#.#.']
  };
  G['’'] = G["'"]; G['‘'] = G["'"]; G['“'] = G['"']; G['”'] = G['"'];

  // Two accent rows sit above the cap height.
  var ACC = {
    acute: ['...#.', '..#..'], grave: ['.#...', '..#..'], circ: ['..#..', '.#.#.'],
    diaer: ['.....', '.#.#.'], tilde: ['.##.#', '#..#.']
  };
  var COMPOSE = {
    'É': ['E', 'acute'], 'È': ['E', 'grave'], 'Ê': ['E', 'circ'], 'Ë': ['E', 'diaer'],
    'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ä': ['A', 'diaer'],
    'Ó': ['O', 'acute'], 'Ò': ['O', 'grave'], 'Ô': ['O', 'circ'], 'Ö': ['O', 'diaer'],
    'Ú': ['U', 'acute'], 'Ù': ['U', 'grave'], 'Û': ['U', 'circ'], 'Ü': ['U', 'diaer'],
    'Í': ['I', 'acute'], 'Ì': ['I', 'grave'], 'Î': ['I', 'circ'], 'Ï': ['I', 'diaer'],
    'Ñ': ['N', 'tilde']
  };

  var ROWS = 10; // 2 accent rows + 7 cap rows + 1 descender row
  var NS = 'http://www.w3.org/2000/svg';

  function glyphFor(ch) {
    var up = ch.toUpperCase();
    if (up.length !== 1) up = ch;
    if (G[up]) return { rows: G[up], accent: null };
    if (COMPOSE[up]) {
      return { rows: G[COMPOSE[up][0]], accent: ACC[COMPOSE[up][1]] };
    }
    return null;
  }

  function canRender(word) {
    for (var i = 0; i < word.length; i++) if (!glyphFor(word[i])) return false;
    return true;
  }

  // Build an SVG for one word. Returns null if any glyph is missing.
  function wordSVG(word) {
    var rects = [];
    var x = 0;
    for (var i = 0; i < word.length; i++) {
      var g = glyphFor(word[i]);
      if (!g) return null;
      var w = g.rows[0].length;
      var rows = g.rows.slice();
      if (g.accent) {
        var off = Math.floor((5 - w) / 2);
        for (var a = 0; a < 2; a++) pushRuns(rects, g.accent[a].substr(off, w), x, a);
      }
      for (var r = 0; r < rows.length; r++) pushRuns(rects, rows[r], x, r + 2);
      x += w + 1;
    }
    var width = Math.max(1, x - 1);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + width + ' ' + ROWS);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('shape-rendering', 'crispEdges');
    svg.setAttribute('class', 'px-word');
    svg.style.width = (width / 7) + 'em';
    svg.style.height = (ROWS / 7) + 'em';
    var path = document.createElementNS(NS, 'path');
    path.setAttribute('d', rects.join(''));
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    return svg;
  }

  function pushRuns(out, row, x0, y) {
    var start = -1;
    for (var c = 0; c <= row.length; c++) {
      var on = c < row.length && row[c] === '#';
      if (on && start < 0) start = c;
      if (!on && start >= 0) {
        out.push('M' + (x0 + start) + ' ' + y + 'h' + (c - start) + 'v1h-' + (c - start) + 'z');
        start = -1;
      }
    }
  }

  /* Render text as pixel lettering. The real text stays in the DOM for screen readers
     and copy/paste; words with unsupported characters fall back to a bold system font. */
  function pixelText(text, cls) {
    var wrap = document.createElement('span');
    wrap.className = 'px-text' + (cls ? ' ' + cls : '');
    var sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    wrap.appendChild(sr);
    var vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    vis.className = 'px-vis';
    var words = String(text).split(/\s+/).filter(Boolean);
    words.forEach(function (w, i) {
      var svg = canRender(w) ? wordSVG(w) : null;
      if (svg) vis.appendChild(svg);
      else {
        var f = document.createElement('span');
        f.className = 'px-fallback';
        f.textContent = w;
        vis.appendChild(f);
      }
      if (i < words.length - 1) vis.appendChild(document.createTextNode(' '));
    });
    wrap.appendChild(vis);
    return wrap;
  }

  CWE.pixelText = pixelText;
  CWE.pixelWordSVG = wordSVG;
})();
