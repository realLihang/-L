var S = require('../../utils/shift.js');
var C = require('../../utils/calendar.js');
var L = require('../../utils/lunar.js');
var store = require('../../utils/store.js');

var app = getApp();

// 千分位金额格式化：4801 -> "4,801"
function fmtMoney(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

Page({
  data: {
    viewMode: 'month',          // month | week | year
    year: 2026,
    month: 9,
    monthLabel: '',
    weekdays: [],
    months: [],
    monthTrackX: -100,
    monthTrackT: 'none',
    monthOps: [0.4, 1, 0.4],
    weeks: [],
    weekTrackX: -100,
    weekTrackT: 'none',
    weekOps: [0.4, 1, 0.4],
    yearData: [],
    weekRangeText: '',
    cycleText: '',
    nextRestText: '',
    salary: { label: '', workDays: 0, dailyText: '0', baseText: '0', workPayText: '0', totalText: '0' },
    today: {},
    settings: {},
    showDetail: false,
    detail: null,
    inputText: '',
    agendaPreview: []
  },

  onLoad: function () {
    this.settings = store.getSettings();
    this.notes = store.getNotes();
    var t = S.todayDate();
    this.viewYear = t.getUTCFullYear();
    this.viewMonth = t.getUTCMonth();
    this.weekAnchor = t;
    this.render();
  },

  onShow: function () {
    this.settings = store.getSettings();
    this.notes = store.getNotes();
    this.render();
  },

  onReady: function () {
    this.measurePager('month');
  },

  onPullDownRefresh: function () {
    this.settings = store.getSettings();
    this.notes = store.getNotes();
    this.render();
    wx.stopPullDownRefresh();
  },

  /* ---------- 渲染 ---------- */
  render: function () {
    var s = this.settings;
    var t = S.todayDate();
    var todayKey = S.keyOf(t);
    var mode = this.data.viewMode;
    var wdLabels = C.weekLabels(s.weekStart);

    // 只构建当前视图需要的数据，避免无谓的农历/状态计算（年视图下尤其明显）
    var patch = {
      settings: s,
      viewMode: mode,
      year: this.viewYear,
      month: this.viewMonth,
      monthLabel: this.viewYear + ' 年 ' + (this.viewMonth + 1) + ' 月',
      weekdays: wdLabels,
      monthTrackX: -100,
      monthTrackT: 'none',
      monthOps: [0.4, 1, 0.4],
      weekTrackX: -100,
      weekTrackT: 'none',
      weekOps: [0.4, 1, 0.4],
      noteCount: this.countNotes()
    };

    var statText;
    if (mode === 'year') {
      patch.yearData = C.buildYear(this.viewYear, s, this.notes, s.weekStart);
      var yc = C.countRange(this.viewYear + '-01-01', this.viewYear + '-12-31', s);
      statText = this.viewYear + ' 年上班 ' + yc.work + ' 天 · 休班 ' + yc.rest + ' 天';
      patch.weekRangeText = '';
    } else if (mode === 'week') {
      var _wprev = S.addDays(this.weekAnchor, -7);
      var _wnext = S.addDays(this.weekAnchor, 7);
      var weeks = [
        this.wrapWeek(_wprev, s),
        this.wrapWeek(this.weekAnchor, s),
        this.wrapWeek(_wnext, s)
      ];
      weeks.forEach(function (w, i) { w.pos = i; });
      patch.weeks = weeks;
      var weekDays = weeks[1].days;
      var weekStartKey = weekDays.length ? weekDays[0].key : todayKey;
      var weekEndKey = weekDays.length ? weekDays[6].key : todayKey;
      var wc = C.countRange(weekStartKey, weekEndKey, s);
      statText = '本周上班 ' + wc.work + ' 天 · 休班 ' + wc.rest + ' 天';
      patch.weekRangeText = this.rangeText(weekStartKey, weekEndKey);
    } else {
      var monthData = C.buildMonth(this.viewYear, this.viewMonth, s, this.notes, s.weekStart);
      var _pm = this.adjMonth(this.viewYear, this.viewMonth, -1);
      var _nm = this.adjMonth(this.viewYear, this.viewMonth, 1);
      // 左右两页渲染真实的上一月/下一月：滑动时相邻月滑入、不会出现空白白屏
      // 静止时 pager 的 overflow:hidden 已把相邻月裁到屏外，不会在两侧露出（满足“不预览相邻月”的诉求）
      patch.months = [
        this.wrapMonth(_pm.y, _pm.m, C.buildMonth(_pm.y, _pm.m, s, this.notes, s.weekStart)),
        this.wrapMonth(this.viewYear, this.viewMonth, monthData),
        this.wrapMonth(_nm.y, _nm.m, C.buildMonth(_nm.y, _nm.m, s, this.notes, s.weekStart))
      ];
      // 用稳定的位置主键 pos(0/1/2)，换月时只更新内容、不重建节点，避免重置瞬间闪烁
      patch.months.forEach(function (mm, i) { mm.pos = i; });
      statText = '本月上班 ' + monthData.workCount + ' 天 · 休班 ' + monthData.restCount + ' 天';
      patch.weekRangeText = '';
    }

    // 薪资口径：当月基本工资 + 上个月上班补贴（当月还没结束，补贴按上月实际出勤计）
    var _prev = this.adjMonth(this.viewYear, this.viewMonth, -1);
    var prevWorkCount = (mode === 'month')
      ? patch.months[0].workCount          // 月视图左页即上一月，统计已算好，复用避免重复构建
      : C.buildMonth(_prev.y, _prev.m, s, this.notes, s.weekStart).workCount;
    var _daily = s.dailySubsidy;
    var _base = s.baseSalary;
    var _workPay = prevWorkCount * _daily;
    patch.salary = {
      label: this.viewYear + ' 年 ' + (this.viewMonth + 1) + ' 月',
      prevLabel: (_prev.m + 1) + '月',
      workDays: prevWorkCount,
      dailyText: fmtMoney(_daily),
      baseText: fmtMoney(_base),
      workPayText: fmtMoney(_workPay),
      totalText: fmtMoney(_workPay + _base)
    };

    var st = S.statusOf(todayKey, s);
    var nextRest = this.findNext(todayKey, 'rest', s);
    var nextWork = this.findNext(todayKey, 'work', s);

    patch.cycleText = '上 ' + s.workDays + ' 天 / 休 ' + s.restDays + ' 天，每轮 ' + S.cycleLen(s) + ' 天，从' +
      S.WEEK_CN[S.weekIdx(S.parseKey(s.anchor))] + '开始';
    patch.nextRestText = st.type === 'work'
      ? '下次休班：' + S.fmtCn(nextRest)
      : '下次上班：' + S.fmtCn(nextWork);
    patch.statText = statText;
    patch.today = {
      type: st.type,
      isWork: st.type === 'work',
      week: S.WEEK_CN[S.weekIdx(t)],
      dateText: S.fmtCn(t),
      lunarText: (L.lunarOf(todayKey) || {}).text || '',
      typeText: st.type === 'work' ? '上班' : '休班',
      progress: st.type === 'work'
        ? '本轮上班第 ' + S.dayNoOf(st, s) + ' 天 / 共 ' + s.workDays + ' 天'
        : '本轮休班第 ' + S.dayNoOf(st, s) + ' 天 / 共 ' + s.restDays + ' 天',
      countdown: S.countdownOf(todayKey, s) + (st.pinned ? '（这天手动改过）' : '')
    };
    patch.agendaPreview = this.buildPreviewAgenda();

    this.setData(patch);
  },

  // 统计备忘总条数
  countNotes: function () {
    var n = 0;
    var notes = this.notes || {};
    for (var nk in notes) {
      if (Object.prototype.hasOwnProperty.call(notes, nk)) {
        n += (notes[nk] || []).length;
      }
    }
    return n;
  },

  buildPreviewAgenda: function () {
    var t = S.todayDate();
    var list = [];
    var keys = Object.keys(this.notes || {});
    keys.sort();
    for (var i = 0; i < keys.length && list.length < 3; i++) {
      var k = keys[i];
      var arr = this.notes[k] || [];
      if (!arr.length) continue;
      var d = S.parseKey(k);
      var diff = S.diffDays(d, t);
      if (diff < 0) continue;                       // 只显示今天及以后
      list.push({
        key: k,
        dateText: (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日',
        weekCn: S.WEEK_CN[S.weekIdx(d)],
        relText: diff === 0 ? '今天' : diff + ' 天后',
        text: arr[0].text,
        more: arr.length > 1 ? ('等 ' + arr.length + ' 条') : ''
      });
    }
    return list;
  },

  rangeText: function (a, b) {
    var da = S.parseKey(a);
    var db = S.parseKey(b);
    return (da.getUTCMonth() + 1) + '月' + da.getUTCDate() + '日 — ' +
      (db.getUTCMonth() + 1) + '月' + db.getUTCDate() + '日';
  },

  // 从某天之后找第一个指定类型的日子
  findNext: function (fromKey, type, s) {
    var d = S.parseKey(fromKey);
    for (var i = 1; i <= 400; i++) {
      var x = S.addDays(d, i);
      if (S.statusOf(S.keyOf(x), s).type === type) return x;
    }
    return S.addDays(d, 1);
  },

  /* ---------- 月份 / 周 / 年切换 ---------- */
  // 计算相邻月份（处理跨年）
  adjMonth: function (y, m, d) {
    m += d;
    while (m > 11) { m -= 12; y++; }
    while (m < 0) { m += 12; y--; }
    return { y: y, m: m };
  },

  // 给某月数据补上 key / label，供 swiper 渲染时做 wx:key 与调试
  wrapMonth: function (y, m, data) {
    return {
      key: y + '-' + m,
      year: y,
      month: m,
      label: y + ' 年 ' + (m + 1) + ' 月',
      days: data.days,
      workCount: data.workCount,
      restCount: data.restCount
    };
  },

  // 给某周数据补上 key（本周首天），供 swiper 渲染时做 wx:key
  wrapWeek: function (anchor, s) {
    return { key: S.keyOf(anchor), days: C.buildWeek(anchor, s, this.notes, s.weekStart) };
  },

  /* ---------- 自定义滑动（月 / 周） ----------
     用原生 touch + translateX 自己实现三页无限滑动，取代 swiper：
     - 拖动时 track 实时跟随手指（transition:none），滑入的页透明度随位移连续从 0.4→1 变亮
     - 松手后只设一次目标值并开 300ms 过渡，动画从“松手那一刻的位置”沿滑动方向继续滑到落定居中
     - 落定后瞬时把中间页重置回索引 1（前后是同一月份，看不出跳变），下一周/月继续连续
  */
  measurePager: function (kind) {
    var self = this;
    var sel = kind === 'month' ? '#monthPager' : '#weekPager';
    wx.createSelectorQuery().select(sel).boundingClientRect(function (r) {
      if (r && r.width) {
        if (kind === 'month') self._monthW = r.width; else self._weekW = r.width;
      }
    }).exec();
  },

  setTrack: function (kind, x, transition, opsX) {
    if (kind === 'month') {
      this.setData({
        monthTrackX: x,
        monthTrackT: transition,
        monthOps: opsX === undefined ? this.data.monthOps : this._ops(opsX)
      });
    } else {
      this.setData({
        weekTrackX: x,
        weekTrackT: transition,
        weekOps: opsX === undefined ? this.data.weekOps : this._ops(opsX)
      });
    }
  },

  // 根据 track 位移算三页透明度：居中页=1，相邻页最大降到 0.4，随位移连续变化
  _ops: function (T) {
    var o = [];
    for (var i = 0; i < 3; i++) {
      var d = Math.abs(i * 100 + T);
      var dd = d > 100 ? 100 : d;
      o.push(1 - 0.6 * dd / 100);
    }
    return o;
  },

  // 把上一轮“还在飞的一半”立即结算掉，避免和新的手势打架
  finalizePending: function () {
    if (this._pending) {
      var p = this._pending;
      this._pending = null;
      if (this._pgTimer) clearTimeout(this._pgTimer);
      this._pgTimer = null;
      this._animating = false;
      if (p.kind === 'month') this.shiftMonth(p.dir); else this.shiftWeek(p.dir);
    }
  },

  pagerStart: function (e) {
    this.finalizePending();
    var kind = e.currentTarget.dataset.kind;
    var w = (kind === 'month' ? this._monthW : this._weekW) || 0;
    if (!w) w = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()).windowWidth;
    this._pg = {
      kind: kind,
      startX: e.touches[0].clientX,
      baseX: kind === 'month' ? this.data.monthTrackX : this.data.weekTrackX,
      w: w,
      dragged: false
    };
    this.setTrack(kind, this._pg.baseX, 'none');
  },

  pagerMove: function (e) {
    var pg = this._pg;
    if (!pg) return;
    var dx = e.touches[0].clientX - pg.startX;
    if (Math.abs(dx) > 8) pg.dragged = true;
    var x = pg.baseX + dx / pg.w * 100;
    if (x > 30) x = 30;          // 限制不要滑出界太多
    if (x < -230) x = -230;
    this.setTrack(pg.kind, x, 'none', x);
  },

  pagerEnd: function (e) {
    var pg = this._pg;
    if (!pg) return;
    this._pg = null;
    var dx = e.changedTouches[0].clientX - pg.startX;
    var x = pg.baseX + dx / pg.w * 100;
    var dir = 0;
    if (x < -150) dir = 1;        // 下一月/周
    else if (x > -50) dir = -1;   // 上一月/周
    this._pending = (dir === 0) ? null : { kind: pg.kind, dir: dir };
    this.slideTo(pg.kind, dir);
    this._tapGuard = pg.dragged;
  },

  // dir: 0 回中；+1 去下一页；-1 去上一页
  slideTo: function (kind, dir) {
    var target = -100 - dir * 100;
    var self = this;
    this.setTrack(kind, target, 'transform 300ms ease-out', target);
    this._animating = true;
    if (this._pgTimer) clearTimeout(this._pgTimer);
    this._pgTimer = setTimeout(function () {
      self._animating = false;
      self._pgTimer = null;
      if (self._pending) {
        var p = self._pending;
        self._pending = null;
        if (p.kind === 'month') self.shiftMonth(p.dir); else self.shiftWeek(p.dir);
        // shiftMonth/shiftWeek → render() 会把 track 重置回 -100 / none，前后同一月/周故无跳变
      } else {
        self.setTrack(kind, -100, 'none', -100);
      }
    }, 320);
  },

  animateBtn: function (kind, dir) {
    this.finalizePending();
    this._pending = { kind: kind, dir: dir };
    this.slideTo(kind, dir);
  },

  shiftMonth: function (n) {
    this.viewMonth += n;
    if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
    if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
    this.render();
  },

  shiftWeek: function (n) {
    this.weekAnchor = S.addDays(this.weekAnchor, n * 7);
    this.render();
  },

  prevMonth: function () { this.animateBtn('month', -1); },
  nextMonth: function () { this.animateBtn('month', 1); },
  prevWeek: function () { this.animateBtn('week', -1); },
  nextWeek: function () { this.animateBtn('week', 1); },

  goToday: function () {
    var t = S.todayDate();
    this.viewYear = t.getUTCFullYear();
    this.viewMonth = t.getUTCMonth();
    this.weekAnchor = t;
    this.render();
  },

  switchView: function (e) {
    var mode = e.currentTarget.dataset.mode;
    if (mode === this.data.viewMode) return;
    var self = this;
    this.setData({ viewMode: mode }, function () {
      self.render();
      if (mode !== 'year') self.measurePager(mode);   // 年视图无 pager，无需测量宽度
    });
  },

  // 月/周视图的滑动由自定义 pager（pagerStart/Move/End）处理，无需再手写手势
  // 年视图点击某月 → 进入该月
  onTapYearMonth: function (e) {
    var m = parseInt(e.currentTarget.dataset.month, 10);
    this.viewMonth = m;
    this.setData({ viewMode: 'month' });
    this.render();
  },

  /* ---------- 某天详情 ---------- */
  onTapDay: function (e) {
    if (this._tapGuard) { this._tapGuard = false; return; }
    var key = e.currentTarget.dataset.key;
    if (!key || key.indexOf('-') < 0) return;   // 空白占位（oN）或非日期 key 忽略
    this.openDetail(key);
  },

  openDetail: function (key) {
    var d = C.buildDetail(key, this.settings, this.notes);
    this.setData({ showDetail: true, detail: d, inputText: '' });
  },

  closeDetail: function () {
    this.setData({ showDetail: false, detail: null, inputText: '' });
  },

  noop: function () {},

  // 手动切换这一天的班 / 休
  togglePin: function () {
    var key = this.data.detail.key;
    var cur = S.statusOf(key, this.settings);
    var pins = this.settings.pins || {};
    if (cur.pinned) {
      delete pins[key];
    } else {
      pins[key] = cur.type === 'work' ? 'rest' : 'work';
    }
    this.settings.pins = pins;
    this.settings = store.saveSettings(this.settings);
    wx.showToast({
      title: (cur.pinned ? '已恢复自动' : (cur.type === 'work' ? '改为休班' : '改为上班')),
      icon: 'none'
    });
    this.setData({ detail: C.buildDetail(key, this.settings, this.notes) });
    this.render();
  },

  resetPin: function () {
    var key = this.data.detail.key;
    delete this.settings.pins[key];
    this.settings = store.saveSettings(this.settings);
    wx.showToast({ title: '已恢复自动', icon: 'none' });
    this.setData({ detail: C.buildDetail(key, this.settings, this.notes) });
    this.render();
  },

  onInput: function (e) {
    this.setData({ inputText: e.detail.value });
  },

  addNote: function () {
    var text = (this.data.inputText || '').trim();
    if (!text) {
      wx.showToast({ title: '先写点内容', icon: 'none' });
      return;
    }
    var key = this.data.detail.key;
    store.addNote(key, text);
    this.notes = store.getNotes();
    this.setData({
      inputText: '',
      detail: C.buildDetail(key, this.settings, this.notes)
    });
    this.render();
  },

  delNote: function (e) {
    var id = e.currentTarget.dataset.id;
    var key = this.data.detail.key;
    this.notes = store.removeNote(key, id);
    this.setData({ detail: C.buildDetail(key, this.settings, this.notes) });
    this.render();
  },

  /* ---------- 跳转 ---------- */
  goAgenda: function () {
    wx.navigateTo({ url: '/pages/agenda/agenda' });
  },

  goSettings: function () {
    wx.navigateTo({ url: '/pages/settings/settings' });
  },

  goShare: function () {
    wx.navigateTo({ url: '/pages/share/share' });
  },

  onShareAppMessage: function () {
    return {
      title: '倒班日历 · 上 ' + this.settings.workDays + ' 天休 ' + this.settings.restDays + ' 天',
      path: '/pages/index/index'
    };
  }
});
