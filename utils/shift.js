// 倒班周期计算核心：全部按 UTC 计算，避免跨时区/夏令时导致日期偏移
var WEEK_CN = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function keyOf(d) {
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

function parseKey(s) {
  var p = String(s).split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
}

function addDays(d, n) {
  return new Date(d.getTime() + n * 86400000);
}

function diffDays(a, b) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

// 周一=0 ... 周日=6
function weekIdx(d) {
  return (d.getUTCDay() + 6) % 7;
}

function todayDate() {
  var n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

function fmtCn(d) {
  return (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日 ' + WEEK_CN[weekIdx(d)];
}

function cycleLen(s) {
  return Math.max(1, s.workDays) + Math.max(1, s.restDays);
}

// 按周期自动推算某天的状态
function autoStatus(dateKey, s) {
  var len = cycleLen(s);
  var off = diffDays(parseKey(dateKey), parseKey(s.anchor));
  var pos = ((off % len) + len) % len;
  return { type: pos < s.workDays ? 'work' : 'rest', pos: pos };
}

// 叠加手动覆盖后的最终状态
function statusOf(dateKey, s) {
  var p = autoStatus(dateKey, s);
  if (s.pins && Object.prototype.hasOwnProperty.call(s.pins, dateKey)) {
    return { type: s.pins[dateKey], pos: p.pos, pinned: true };
  }
  return p;
}

// 某天在本轮中的第几天（1 起）
function dayNoOf(status, s) {
  return status.type === 'work' ? (status.pos + 1) : (status.pos - s.workDays + 1);
}

// 距离下次切换还有几天
function countdownOf(dateKey, s) {
  var st = statusOf(dateKey, s);
  var target = st.type === 'work' ? s.workDays : cycleLen(s);
  var left = target - st.pos;
  return st.type === 'work'
    ? '再上 ' + left + ' 天开始休班'
    : '再休 ' + left + ' 天回去上班';
}

// 接下来两轮的文字预览
function buildPreview(s) {
  var a = parseKey(s.anchor);
  var len = cycleLen(s);
  var out = [];
  for (var r = 0; r < 2; r++) {
    var st = addDays(a, r * len);
    var we = addDays(st, s.workDays - 1);
    var rs = addDays(st, s.workDays);
    var re = addDays(st, len - 1);
    out.push({
      idx: r + 1,
      work: fmtCn(st) + ' — ' + fmtCn(we) + '　上班 ' + s.workDays + ' 天',
      rest: fmtCn(rs) + ' — ' + fmtCn(re) + '　休班 ' + s.restDays + ' 天'
    });
  }
  return out;
}

module.exports = {
  WEEK_CN: WEEK_CN,
  pad: pad,
  keyOf: keyOf,
  parseKey: parseKey,
  addDays: addDays,
  diffDays: diffDays,
  weekIdx: weekIdx,
  todayDate: todayDate,
  fmtCn: fmtCn,
  cycleLen: cycleLen,
  autoStatus: autoStatus,
  statusOf: statusOf,
  dayNoOf: dayNoOf,
  countdownOf: countdownOf,
  buildPreview: buildPreview
};
