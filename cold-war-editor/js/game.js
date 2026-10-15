/* Game rules and scoring. All points come from meta.scoring in the JSON. */
(function () {
  'use strict';
  var CWE = (window.CWE = window.CWE || {});
  var NOT_BLAME = 'not_blame';

  function Game(data) {
    this.data = data;
    this.days = (data.days || []).slice().sort(function (a, b) { return a.day - b.day; });
  }

  Game.prototype.manuscriptsFor = function (dayIndex) {
    var d = this.days[dayIndex];
    if (!d) return [];
    return (this.data.manuscripts || []).filter(function (m) { return m.day === d.day; });
  };

  Game.prototype.totalManuscripts = function () {
    var n = 0;
    for (var i = 0; i < this.days.length; i++) n += this.manuscriptsFor(i).length;
    return n;
  };

  Game.prototype.schoolLabel = function (id) {
    var s = (this.data.schools || {})[id];
    return s ? s.label : String(id);
  };

  /* Is step C skipped for this answer? */
  Game.prototype.skipsApproach = function (schoolChoice) { return schoolChoice === NOT_BLAME; };

  Game.prototype.score = function (m, a) {
    var sc = this.data.meta.scoring;
    var k = m.key || {};
    a = a || {};
    var mainOk = a.main != null && (k.mainArgument || []).indexOf(a.main) >= 0;
    var cons = k.concessions || [];
    // 0 means the player chose "No concession", which is right only when the key lists none.
    var concessionOk = a.concession != null && (a.concession === 0 ? cons.length === 0 : cons.indexOf(a.concession) >= 0);
    var conPts = typeof sc.concession === 'number' ? sc.concession : 0;
    var schoolOk = a.school != null && a.school === k.school;
    var approachSkipped = a.school === NOT_BLAME;
    var approachOk;
    if (approachSkipped) approachOk = k.school === NOT_BLAME;
    else approachOk = k.approach != null && a.approach != null &&
      (a.approach === k.approach || (k.approachAlsoAccept || []).indexOf(a.approach) >= 0);
    var stampOk = a.stamp != null && a.stamp === k.stamp;
    var max = sc.mainArgument + conPts + sc.school + sc.approach;
    var pts = (mainOk ? sc.mainArgument : 0) + (concessionOk ? conPts : 0) + (schoolOk ? sc.school : 0) + (approachOk ? sc.approach : 0);
    return {
      mainOk: mainOk, concessionOk: concessionOk, schoolOk: schoolOk, approachOk: approachOk, approachSkipped: approachSkipped,
      stampOk: stampOk, points: pts, max: max,
      compliance: stampOk ? sc.stamp : 0, complianceMax: sc.stamp,
      trapHit: !(mainOk && concessionOk && schoolOk)
    };
  };

  Game.prototype.dayTotals = function (dayIndex, answers) {
    var self = this;
    var t = { points: 0, max: 0, compliance: 0, complianceMax: 0, stamped: 0, count: 0 };
    this.manuscriptsFor(dayIndex).forEach(function (m) {
      var a = answers[m.id];
      t.count++;
      var s = self.score(m, a);
      t.max += s.max;
      t.complianceMax += s.complianceMax;
      if (a && a.stamp) {
        t.stamped++;
        t.points += s.points;
        t.compliance += s.compliance;
      }
    });
    t.pct = t.max ? Math.round((t.points / t.max) * 100) : 0;
    return t;
  };

  Game.prototype.totals = function (answers) {
    var t = { points: 0, max: 0, compliance: 0, complianceMax: 0, days: [] };
    for (var i = 0; i < this.days.length; i++) {
      var d = this.dayTotals(i, answers);
      t.days.push(d);
      t.points += d.points; t.max += d.max; t.compliance += d.compliance; t.complianceMax += d.complianceMax;
    }
    t.pct = t.max ? Math.round((t.points / t.max) * 100) : 0;
    t.compliancePct = t.complianceMax ? Math.round((t.compliance / t.complianceMax) * 100) : 0;
    return t;
  };

  Game.prototype.band = function (pct) {
    var bands = ((this.data.endings || {}).integrityBands || []).slice().sort(function (a, b) { return b.min - a.min; });
    for (var i = 0; i < bands.length; i++) if (pct >= bands[i].min) return bands[i];
    return bands[bands.length - 1] || null;
  };

  /* Trap ids the player fell into most often (A or B wrong). Ignores the warm-up "none". */
  Game.prototype.commonTraps = function (answers) {
    var self = this, counts = {}, order = [];
    for (var i = 0; i < this.days.length; i++) {
      this.manuscriptsFor(i).forEach(function (m) {
        var a = answers[m.id];
        if (!a || !a.stamp || !m.trap || m.trap === 'none') return;
        if (self.score(m, a).trapHit) {
          if (!counts[m.trap]) { counts[m.trap] = 0; order.push(m.trap); }
          counts[m.trap]++;
        }
      });
    }
    var best = 0;
    order.forEach(function (t) { best = Math.max(best, counts[t]); });
    if (!best) return { ids: [], count: 0 };
    return { ids: order.filter(function (t) { return counts[t] === best; }), count: best };
  };

  /* A short name for a trap: the text before its first colon or question mark. */
  Game.prototype.trapName = function (id) {
    var text = (this.data.traps || {})[id] || id;
    var m = /^([^:?]{1,60}[:?])/.exec(text);
    if (!m) return text;
    return m[1].replace(/:$/, '');
  };

  CWE.Game = Game;
  CWE.NOT_BLAME = NOT_BLAME;
})();
