/* localStorage wrapper. Every call is guarded: the game keeps working if storage is
   unavailable (private browsing, blocked storage, full quota). */
(function () {
  'use strict';
  var CWE = (window.CWE = window.CWE || {});
  var PREFIX = 'cold-war-editor:';
  var memory = {};

  function get(key) {
    try {
      var raw = window.localStorage.getItem(PREFIX + key);
      if (raw != null) return JSON.parse(raw);
    } catch (e) { /* fall through to memory */ }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function set(key, value) {
    memory[key] = value;
    try { window.localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function remove(key) {
    delete memory[key];
    try { window.localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
  }

  CWE.store = { get: get, set: set, remove: remove };
})();
