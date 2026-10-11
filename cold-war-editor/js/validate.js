/* Content checks for data/manuscripts.json. Problems are reported, never fixed:
   the teacher's text is shown exactly as written. */
(function () {
  'use strict';
  var CWE = (window.CWE = window.CWE || {});

  function validate(data) {
    var problems = [];
    function p(msg) { problems.push(msg); }
    if (!data || typeof data !== 'object') { p('The file is not a JSON object.'); return problems; }

    var meta = data.meta || {};
    var sc = meta.scoring || {};
    ['mainArgument', 'school', 'approach', 'stamp'].forEach(function (k) {
      if (typeof sc[k] !== 'number') p('meta.scoring.' + k + ' should be a number.');
    });
    var approaches = Array.isArray(data.approaches) ? data.approaches : [];
    if (!approaches.length) p('approaches should be a non-empty list.');
    var schools = data.schools || {};
    if (!schools.not_blame) p('schools.not_blame is missing (needed for the approach-skip rule).');
    Object.keys(schools).forEach(function (id) {
      if (!schools[id] || !schools[id].label) p('schools.' + id + ' has no label.');
      if (!schools[id] || !schools[id].definition) p('schools.' + id + ' has no definition.');
    });
    var traps = data.traps || {};

    var days = Array.isArray(data.days) ? data.days : [];
    if (!days.length) p('days should be a non-empty list.');
    var dayByNum = {};
    days.forEach(function (d, i) {
      var where = 'days[' + i + '] (day ' + d.day + ')';
      if (dayByNum[d.day]) p(where + ': duplicate day number.');
      dayByNum[d.day] = d;
      ['title', 'climate', 'directive', 'rulebookTip'].forEach(function (k) {
        if (!d[k]) p(where + ': missing ' + k + '.');
      });
      (d.schoolOptions || []).forEach(function (s) { if (!schools[s]) p(where + ': schoolOptions has unknown school "' + s + '".'); });
      (d.publishSchools || []).forEach(function (s) { if (!schools[s]) p(where + ': publishSchools has unknown school "' + s + '".'); });
      if (!(d.schoolOptions || []).length) p(where + ': schoolOptions is empty.');
    });

    var ms = Array.isArray(data.manuscripts) ? data.manuscripts : [];
    if (!ms.length) p('manuscripts should be a non-empty list.');
    var ids = {};
    ms.forEach(function (m, i) {
      var where = 'manuscript ' + (m.id || '#' + (i + 1));
      if (!m.id) p('manuscripts[' + i + ']: missing id.');
      else if (ids[m.id]) p(where + ': duplicate id.');
      ids[m.id] = true;
      var day = dayByNum[m.day];
      if (!day) p(where + ': day ' + m.day + ' does not exist in days.');
      var n = Array.isArray(m.sentences) ? m.sentences.length : 0;
      if (!n) p(where + ': has no sentences.');
      if (!m.dossier) p(where + ': missing dossier.');
      var k = m.key || {};
      if (!m.key) p(where + ': missing key.');
      if (!Array.isArray(k.mainArgument) || !k.mainArgument.length) p(where + ': key.mainArgument should list at least one sentence number.');
      ['mainArgument', 'concessions', 'subMessages'].forEach(function (f) {
        if (k[f] != null && !Array.isArray(k[f])) { p(where + ': key.' + f + ' should be a list.'); return; }
        (k[f] || []).forEach(function (idx) {
          if (!(Number.isInteger(idx) && idx >= 1 && idx <= n)) p(where + ': key.' + f + ' refers to sentence ' + idx + ', but the extract has ' + n + ' sentences.');
        });
      });
      if (!schools[k.school]) p(where + ': key.school "' + k.school + '" is not a known school.');
      else if (day && (day.schoolOptions || []).indexOf(k.school) < 0) p(where + ': key.school "' + k.school + '" is not one of day ' + m.day + "'s schoolOptions, so it cannot be chosen.");
      if (k.school === 'not_blame') {
        if (k.approach != null) p(where + ': key.approach should be null when the school is not_blame.');
      } else if (approaches.indexOf(k.approach) < 0) {
        p(where + ': key.approach "' + k.approach + '" is not one of the approaches.');
      }
      (k.approachAlsoAccept || []).forEach(function (a) {
        if (approaches.indexOf(a) < 0) p(where + ': approachAlsoAccept has unknown approach "' + a + '".');
      });
      if (k.stamp !== 'PUBLISH' && k.stamp !== 'REJECT') p(where + ': key.stamp should be "PUBLISH" or "REJECT".');
      else if (day && schools[k.school]) {
        var expected = (day.publishSchools || []).indexOf(k.school) >= 0 ? 'PUBLISH' : 'REJECT';
        if (expected !== k.stamp) p(where + ': key.stamp is ' + k.stamp + ', but day ' + m.day + "'s directive implies " + expected + ' for ' + k.school + '.');
      }
      if (!traps[m.trap]) p(where + ': trap "' + m.trap + '" has no entry in traps.');
      if (!m.explanation) p(where + ': missing explanation.');
      if (!Array.isArray(m.anchors)) p(where + ': anchors should be a list.');
    });
    days.forEach(function (d) {
      if (!ms.some(function (m) { return m.day === d.day; })) p('day ' + d.day + ' has no manuscripts.');
    });

    var bands = (data.endings || {}).integrityBands;
    if (!Array.isArray(bands) || !bands.length) p('endings.integrityBands should be a non-empty list.');
    else if (!bands.some(function (b) { return b.min === 0; })) p('endings.integrityBands has no band with min 0.');
    if (!(data.endings || {}).twoAxisNote) p('endings.twoAxisNote is missing.');
    var db = data.debrief || {};
    if (!Array.isArray(db.summary)) p('debrief.summary should be a list.');
    if (!db.reflectionPrompt) p('debrief.reflectionPrompt is missing.');
    if (!db.examReminder) p('debrief.examReminder is missing.');
    return problems;
  }

  CWE.validate = validate;
})();
