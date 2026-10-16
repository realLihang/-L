var S = require('../../utils/shift.js');
var store = require('../../utils/store.js');

Page({
  data: {
    workDays: 14,
    restDays: 7,
    anchor: '',
    anchorWeek: '',
    weekStart: 0,
    weekStartText: '周一',
    pinCount: 0,
    pinList: [],
    preview: []
  },

  onShow: function () {
    this.settings = store.getSettings();
    this.render();
  },

  render: function () {
    var s = this.settings;
    var pins = s.pins || {};
    var list = [];
    Object.keys(pins).sort().forEach(function (k) {
      var d = S.parseKey(k);
      list.push({
        key: k,
        dateText: d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日',
        weekCn: S.WEEK_CN[S.weekIdx(d)],
        typeText: pins[k] === 'work' ? '上班' : '休班',
        type: pins[k]
      });
    });

    this.setData({
      workDays: s.workDays,
      restDays: s.restDays,
      anchor: s.anchor,
      anchorWeek: S.WEEK_CN[S.weekIdx(S.parseKey(s.anchor))],
      weekStart: s.weekStart,
      weekStartText: s.weekStart === 1 ? '周日' : '周一',
      pinCount: list.length,
      pinList: list,
      preview: S.buildPreview(s)
    });
  },

  apply: function () {
    this.settings = store.saveSettings(this.settings);
    this.render();
  },

  onWorkDays: function (e) {
    var v = parseInt(e.detail.value, 10);
    if (!isFinite(v)) v = store.DEFAULTS.workDays;
    this.settings.workDays = Math.min(60, Math.max(1, v));
    this.apply();
  },

  onRestDays: function (e) {
    var v = parseInt(e.detail.value, 10);
    if (!isFinite(v)) v = store.DEFAULTS.restDays;
    this.settings.restDays = Math.min(60, Math.max(1, v));
    this.apply();
  },

  onAnchorChange: function (e) {
    var v = e.detail.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      this.settings.anchor = v;
      this.apply();
    }
  },

  // 把起始日回退到最近的周四
  alignThu: function () {
    var d = S.parseKey(this.settings.anchor);
    var delta = (S.weekIdx(d) - 3 + 7) % 7;
    this.settings.anchor = S.keyOf(S.addDays(d, -delta));
    this.apply();
    wx.showToast({ title: '已对齐到周四', icon: 'none' });
  },

  setWeekStart: function (e) {
    this.settings.weekStart = parseInt(e.currentTarget.dataset.v, 10) === 1 ? 1 : 0;
    this.apply();
  },

  delPin: function (e) {
    var k = e.currentTarget.dataset.key;
    delete this.settings.pins[k];
    this.apply();
  },

  clearPins: function () {
    if (!this.data.pinCount) return;
    var self = this;
    wx.showModal({
      title: '清除手动调整',
      content: '将恢复成按周期自动推算，确定吗？',
      success: function (res) {
        if (res.confirm) {
          self.settings.pins = {};
          self.apply();
        }
      }
    });
  },

  clearNotes: function () {
    var self = this;
    wx.showModal({
      title: '清空备忘',
      content: '所有日程备忘都会被删除，确定吗？',
      success: function (res) {
        if (res.confirm) {
          store.clearNotes();
          wx.showToast({ title: '已清空', icon: 'none' });
        }
      }
    });
  },

  resetAll: function () {
    var self = this;
    wx.showModal({
      title: '恢复默认',
      content: '上班 14 天 / 休班 7 天，起始日回到 2026-09-24（周四），并清除手动调整。',
      success: function (res) {
        if (res.confirm) {
          self.settings = store.saveSettings(store.DEFAULTS);
          self.render();
        }
      }
    });
  }
});
