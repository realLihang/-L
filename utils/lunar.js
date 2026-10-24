// 农历 / 节气 / 传统节日。数据来自 utils/lunar-data.js（生成时已校验）
var S = require('./shift.js');   // 复用 keyOf / parseKey / diffDays，避免重复实现
var DATA = require('./lunar-data.js');
var DAY = 86400000;

var MONTH_FULL = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
var DAY_FULL = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];
var TERMS = ['小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'];
var GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
var ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
var ANIMAL = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

function keyOf(d) { return S.keyOf(d); }
function parseKey(s) { return S.parseKey(s); }
function diffDays(a, b) { return S.diffDays(a, b); }

// 农历传统节日（key = 月-日，闰月不重复过节）
var FESTIVAL = {
  '1-1': '春节',
  '1-15': '元宵',
  '2-2': '龙抬头',
  '5-5': '端午',
  '7-7': '七夕',
  '7-15': '中元',
  '8-15': '中秋',
  '9-9': '重阳',
  '12-8': '腊八',
  '12-23': '小年'
};
// 既是节气也是传统节日
var TERM_FESTIVAL = { '清明': 1, '冬至': 1 };
// 节气里值得高亮显示的（其余只作为信息）
var TERM_MAIN = { '立春': 1, '清明': 1, '立夏': 1, '夏至': 1, '立秋': 1, '秋分': 1, '立冬': 1, '冬至': 1 };

var termCache = {};
function termDays(year) {
  if (termCache[year]) return termCache[year];
  var raw = DATA.terms[year];
  if (!raw) return null;
  var arr = [];
  for (var i = 0; i < 24; i++) arr.push(parseInt(raw.substr(i * 2, 2), 36));
  termCache[year] = arr;
  return arr;
}

function solarTermOf(dateKey) {
  var year = +dateKey.slice(0, 4);
  var arr = termDays(year);
  if (!arr) return '';
  var doy = Math.floor((parseKey(dateKey).getTime() - Date.UTC(year, 0, 1)) / DAY);
  for (var i = 0; i < 24; i++) {
    if (arr[i] === doy) return TERMS[i];
  }
  return '';
}

// 主入口：公历日期 → 农历信息
function lunarOf(dateKey) {
  var y = +dateKey.slice(0, 4);
  var rec = DATA.years[y];
  var ly = y;
  var date = parseKey(dateKey);
  if (!rec || diffDays(date, parseKey(rec[0])) < 0) {
    if (!DATA.years[y - 1]) return null;
    ly = y - 1;
    rec = DATA.years[ly];
  }

  var start = parseKey(rec[0]);
  var diff = diffDays(date, start);
  if (diff < 0) return null;

  var sizes = rec[1];
  var leap = rec[2];
  var idx = 0;
  var cum = 0;
  while (idx < sizes.length) {
    var len = 29 + (sizes.charAt(idx) === '1' ? 1 : 0);
    if (cum + len > diff) break;
    cum += len;
    idx++;
  }
  if (idx >= sizes.length) return null;

  var month, isLeap = false;
  if (leap > 0) {
    if (idx < leap) month = idx + 1;
    else if (idx === leap) { month = leap; isLeap = true; }
    else month = idx;
  } else {
    month = idx + 1;
  }

  var day = diff - cum + 1;
  var daysInMonth = 29 + (sizes.charAt(idx) === '1' ? 1 : 0);

  var festival = '';
  if (!isLeap) {
    if (FESTIVAL[month + '-' + day]) festival = FESTIVAL[month + '-' + day];
    else if (month === 12 && day === daysInMonth) festival = '除夕';
  }

  var term = solarTermOf(dateKey);
  var monthName = (isLeap ? '闰' : '') + MONTH_FULL[month - 1] + '月';
  var dayName = DAY_FULL[day - 1] || ('' + day);
  var isTermFest = !!(term && TERM_FESTIVAL[term]);

  // 格子里的短文本优先级：农历节日 > 主要节气 > 农历日（公历节日由调用方再兜一层）
  var isFest = !!festival || !!(term && TERM_MAIN[term]);
  var short = festival || (term && TERM_MAIN[term] ? term : '') || dayName;

  return {
    year: ly,
    month: month,
    isLeap: isLeap,
    day: day,
    monthName: monthName,
    dayName: dayName,
    festival: festival,
    term: term,
    isTermFest: isTermFest,
    isFest: isFest,
    short: short,
    text: monthName + dayName,
    ganzhi: GAN[(ly - 4) % 10] + ZHI[(ly - 4) % 12],
    animal: ANIMAL[(ly - 4) % 12],
    full: monthName + dayName + (festival ? ' · ' + festival : '') + (term ? ' · ' + term : '')
  };
}

module.exports = {
  lunarOf: lunarOf,
  solarTermOf: solarTermOf,
  TERMS: TERMS
};
