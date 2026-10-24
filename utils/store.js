// 本地存储：排班设置 + 日程备忘（同步读写，简单可靠）
var KEY_SETTINGS = 'shift_settings_v1';
var KEY_NOTES = 'shift_notes_v1';

var DEFAULTS = {
  workDays: 14,
  restDays: 7,
  anchor: '2026-09-24',   // 周四，上班第 1 天
  weekStart: 0,           // 0=周一开头，1=周日开头
  dailySubsidy: 80,       // 每个上班日的补贴
  baseSalary: 3121,       // 每月固定基本工资补贴
  pins: {}
};

// 旧版默认值，用于自动迁移（未手动改过设置的老用户会跟着更新）
var LEGACY_ANCHOR = '2026-10-01';
var LEGACY_BASE = 3450;   // 旧版基本工资默认值

function clamp(v, def) {
  var n = parseInt(v, 10);
  if (!isFinite(n)) n = def;
  return Math.min(60, Math.max(1, n));
}

function clampNum(v, def, min, max) {
  var n = parseInt(v, 10);
  if (!isFinite(n)) n = def;
  return Math.min(max, Math.max(min, n));
}

function normalize(o) {
  o = o || {};
  return {
    workDays: clamp(o.workDays, DEFAULTS.workDays),
    restDays: clamp(o.restDays, DEFAULTS.restDays),
    anchor: /^\d{4}-\d{2}-\d{2}$/.test(o.anchor) ? o.anchor : DEFAULTS.anchor,
    weekStart: o.weekStart === 1 ? 1 : 0,
    dailySubsidy: clampNum(o.dailySubsidy, DEFAULTS.dailySubsidy, 0, 99999),
    baseSalary: clampNum(o.baseSalary, DEFAULTS.baseSalary, 0, 999999),
    pins: (o.pins && typeof o.pins === 'object') ? o.pins : {}
  };
}

function getSettings() {
  var raw = null;
  try {
    raw = wx.getStorageSync(KEY_SETTINGS);
  } catch (e) {}
  // 仍是旧默认且没手动改过任何一天 → 迁移到新的起始日
  if (raw && raw.anchor === LEGACY_ANCHOR && !Object.keys(raw.pins || {}).length) {
    raw.anchor = DEFAULTS.anchor;
    saveSettings(normalize(raw));
  }
  // 基本工资旧默认值 → 新默认值（3450 → 3121），已手动改过的保持不变
  if (raw && raw.baseSalary === LEGACY_BASE) {
    raw.baseSalary = DEFAULTS.baseSalary;
    saveSettings(normalize(raw));
  }
  if (raw) return normalize(raw);
  return normalize(null);
}

function saveSettings(s) {
  s = normalize(s);
  try { wx.setStorageSync(KEY_SETTINGS, s); } catch (e) {}
  return s;
}

function getNotes() {
  try {
    var raw = wx.getStorageSync(KEY_NOTES);
    if (raw && typeof raw === 'object') return raw;
  } catch (e) {}
  return {};
}

function saveNotes(n) {
  n = n || {};
  try { wx.setStorageSync(KEY_NOTES, n); } catch (e) {}
  return n;
}

function newId() {
  return Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
}

function addNote(dateKey, text) {
  text = String(text || '').trim();
  if (!text) return null;
  var n = getNotes();
  if (!n[dateKey]) n[dateKey] = [];
  var item = { id: newId(), text: text, ts: Date.now() };
  n[dateKey].push(item);
  saveNotes(n);
  return item;
}

function removeNote(dateKey, id) {
  var n = getNotes();
  if (!n[dateKey]) return n;
  n[dateKey] = n[dateKey].filter(function (x) { return x.id !== id; });
  if (!n[dateKey].length) delete n[dateKey];
  saveNotes(n);
  return n;
}

function clearNotes() {
  return saveNotes({});
}

module.exports = {
  DEFAULTS: DEFAULTS,
  normalize: normalize,
  getSettings: getSettings,
  saveSettings: saveSettings,
  getNotes: getNotes,
  saveNotes: saveNotes,
  addNote: addNote,
  removeNote: removeNote,
  clearNotes: clearNotes
};
