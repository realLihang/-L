// 日历渲染 + 公历节日 + 农历/节气（不涉及不准的数据，农历来自固化表）
var S = require('./shift.js');
var L = require('./lunar.js');

var WEEK_MON = ['一', '二', '三', '四', '五', '六', '日'];
var WEEK_SUN = ['日', '一', '二', '三', '四', '五', '六'];

// 公历固定节日（日期每年不变）
var FIXED_FESTIVAL = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '03-12': '植树节',
  '04-01': '愚人节',
  '05-01': '劳动节',
  '05-04': '青年节',
  '06-01': '儿童节',
  '07-01': '建党节',
  '08-01': '建军节',
  '09-10': '教师节',
  '10-01': '国庆',
  '10-31': '万圣节',
  '11-11': '双十一',
  '12-24': '平安夜',
  '12-25': '圣诞节'
};

// 第 n 个星期几是几号（weekday: 0=周日）
function nthWeekday(year, month, weekday, n) {
  var first = new Date(Date.UTC(year, month - 1, 1));
  var w = first.getUTCDay();
  return 1 + ((weekday - w + 7) % 7) + (n - 1) * 7;
}

// 按“第几个星期几”推算的节日
function movableFestivals(year) {
  var m = {};
  m['05-' + S.pad(nthWeekday(year, 5, 0, 2))] = '母亲节';
  m['06-' + S.pad(nthWeekday(year, 6, 0, 3))] = '父亲节';
  m['11-' + S.pad(nthWeekday(year, 11, 4, 4))] = '感恩节';
  return m;
}

var movableCache = {};
function festivalOf(dateKey) {
  var md = dateKey.slice(5);
  if (FIXED_FESTIVAL[md]) return FIXED_FESTIVAL[md];
  var y = dateKey.slice(0, 4);
  if (!movableCache[y]) movableCache[y] = movableFestivals(+y);
  return movableCache[y][md] || '';
}

function weekLabels(weekStart) {
  return weekStart === 1 ? WEEK_SUN : WEEK_MON;
}

// 某天相对周起始的偏移（weekStart: 0=周一, 1=周日）
function weekOffset(d, weekStart) {
  if (weekStart === 1) return d.getUTCDay();          // 周日开头
  return (d.getUTCDay() + 6) % 7;                      // 周一开头
}

// 组合出格子里要显示的节日/农历文本：农历节日 > 主要节气 > 公历节日 > 农历日
function festOf(dateKey) {
  var lu = L.lunarOf(dateKey) || { short: '', dayName: '', monthName: '', festival: '', term: '', isFest: false };
  var gf = festivalOf(dateKey);
  var text = lu.isFest ? lu.short : (gf || lu.dayName);
  return {
    text: text,
    isFest: !!(lu.isFest || gf),
    lunarDay: lu.dayName,
    lunarFull: lu.monthName + lu.dayName,
    lunarYear: lu.ganzhi + lu.animal + '年',
    festival: lu.festival || gf || '',
    term: lu.term || ''
  };
}

// 单元格公共信息
function cellInfo(d, month, s, notes, todayKey, weekStart, noOther) {
  var k = S.keyOf(d);
  var st = S.statusOf(k, s);
  var cls = [st.type];
  if (!noOther && d.getUTCMonth() !== month) cls.push('other');
  if (k === todayKey) cls.push('today');
  if (st.pos === 0) cls.push('cycle-start');
  if (st.pinned) cls.push('pinned');
  var f = festOf(k);
  return {
    key: k,
    num: d.getUTCDate(),
    type: st.type,
    pos: st.pos,
    pinned: !!st.pinned,
    cls: cls.join(' '),
    tag: (st.type === 'work' ? '班' : '休') + S.dayNoOf(st, s),
    fest: f.text,
    isFest: f.isFest,
    lunarDay: f.lunarDay,
    lunarFull: f.lunarFull,
    hasNote: !!(notes && notes[k] && notes[k].length)
  };
}

// 月视图：6 行 42 格（当月完整；首尾显示相邻月灰色补位用于星期对齐）
function buildMonth(year, month, s, notes, weekStart) {
  var first = new Date(Date.UTC(year, month, 1));
  var start = S.addDays(first, -weekOffset(first, weekStart));
  var todayKey = S.keyOf(S.todayDate());
  var days = [];
  var workCount = 0;
  var restCount = 0;
  for (var i = 0; i < 42; i++) {
    var d = S.addDays(start, i);
    var info = cellInfo(d, month, s, notes, todayKey, weekStart);
    if (info.cls.indexOf('other') < 0) {
      if (info.type === 'work') workCount++; else restCount++;
    }
    days.push(info);
  }
  return { days: days, workCount: workCount, restCount: restCount };
}

// 周视图：以 weekAnchor 所在周为基准的 7 天
function buildWeek(weekAnchor, s, notes, weekStart) {
  var start = S.addDays(weekAnchor, -weekOffset(weekAnchor, weekStart));
  var todayKey = S.keyOf(S.todayDate());
  var days = [];
  for (var i = 0; i < 7; i++) {
    var d = S.addDays(start, i);
    var info = cellInfo(d, d.getUTCMonth(), s, notes, todayKey, weekStart, true);
    var st = { type: info.type, pos: info.pos, pinned: info.pinned };
    days.push({
      key: info.key,
      num: d.getUTCDate(),
      monthNum: d.getUTCMonth() + 1,
      weekCn: S.WEEK_CN[S.weekIdx(d)],
      type: info.type,
      isWork: info.type === 'work',
      cls: info.cls,
      tag: info.tag,
      fest: info.fest,
      isFest: info.isFest,
      lunarDay: info.lunarDay,
      lunarFull: info.lunarFull,
      hasNote: info.hasNote,
      noteCount: (notes && notes[info.key]) ? notes[info.key].length : 0,
      progress: st.type === 'work'
        ? '上班第 ' + S.dayNoOf(st, s) + ' 天 / ' + s.workDays
        : '休班第 ' + S.dayNoOf(st, s) + ' 天 / ' + s.restDays,
      countdown: S.countdownOf(info.key, s)
    });
  }
  return days;
}

// 年视图：12 个月缩览
function buildYear(year, s, notes, weekStart) {
  var todayKey = S.keyOf(S.todayDate());
  var months = [];
  for (var m = 0; m < 12; m++) {
    var first = new Date(Date.UTC(year, m, 1));
    var start = S.addDays(first, -weekOffset(first, weekStart));
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var d = S.addDays(start, i);
      var k = S.keyOf(d);
      var st = S.statusOf(k, s);
      var cls = st.type;
      if (d.getUTCMonth() !== m) cls += ' other';
      if (k === todayKey) cls += ' today';
      cells.push({ key: k, cls: cls, num: d.getUTCDate(), inMonth: d.getUTCMonth() === m });
    }
    months.push({ month: m, label: (m + 1) + '月', cells: cells });
  }
  return months;
}

// 某一天的详情（弹层用）
function buildDetail(dateKey, s, notes) {
  var d = S.parseKey(dateKey);
  var st = S.statusOf(dateKey, s);
  var list = (notes && notes[dateKey]) ? notes[dateKey] : [];
  var t = S.todayDate();
  var diff = S.diffDays(d, t);
  var rel = diff === 0 ? '今天' : (diff > 0 ? diff + ' 天后' : (-diff) + ' 天前');
  var f = festOf(dateKey);
  return {
    key: dateKey,
    dateText: (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日',
    fullText: d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日',
    weekCn: S.WEEK_CN[S.weekIdx(d)],
    lunarFull: f.lunarFull,
    lunarYear: f.lunarYear,
    lunarDay: f.lunarDay,
    festival: f.festival,
    term: f.term,
    type: st.type,
    isWork: st.type === 'work',
    typeText: st.type === 'work' ? '上班' : '休班',
    progress: st.type === 'work'
      ? '本轮上班第 ' + S.dayNoOf(st, s) + ' 天 / 共 ' + s.workDays + ' 天'
      : '本轮休班第 ' + S.dayNoOf(st, s) + ' 天 / 共 ' + s.restDays + ' 天',
    countdown: S.countdownOf(dateKey, s),
    pinned: !!st.pinned,
    fest: f.festival,
    rel: rel,
    notes: list
  };
}

// 日程列表：按日期升序，附带相对天数
function buildAgenda(notes) {
  var today = S.todayDate();
  var out = [];
  for (var k in notes) {
    if (!Object.prototype.hasOwnProperty.call(notes, k)) continue;
    var arr = notes[k] || [];
    if (!arr.length) continue;
    var d = S.parseKey(k);
    var diff = S.diffDays(d, today);
    var f = festOf(k);
    out.push({
      key: k,
      dateText: (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日',
      yearText: d.getUTCFullYear() + '年',
      weekCn: S.WEEK_CN[S.weekIdx(d)],
      fest: f.festival,
      lunarDay: f.lunarDay,
      diff: diff,
      relText: diff === 0 ? '今天' : (diff > 0 ? diff + ' 天后' : (-diff) + ' 天前'),
      passed: diff < 0,
      items: arr
    });
  }
  out.sort(function (a, b) { return a.key < b.key ? -1 : (a.key > b.key ? 1 : 0); });
  return out;
}

// 统计：某年/某月的班休天数
function countRange(startKey, endKey, s) {
  var start = S.parseKey(startKey);
  var end = S.parseKey(endKey);
  var work = 0;
  var rest = 0;
  var d = start;
  while (d.getTime() <= end.getTime()) {
    if (S.statusOf(S.keyOf(d), s).type === 'work') work++; else rest++;
    d = S.addDays(d, 1);
  }
  return { work: work, rest: rest, total: work + rest };
}

module.exports = {
  weekLabels: weekLabels,
  weekOffset: weekOffset,
  festivalOf: festivalOf,
  buildMonth: buildMonth,
  buildWeek: buildWeek,
  buildYear: buildYear,
  buildDetail: buildDetail,
  buildAgenda: buildAgenda,
  countRange: countRange
};
