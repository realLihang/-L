var S = require('../../utils/shift.js');
var C = require('../../utils/calendar.js');
var store = require('../../utils/store.js');

Page({
  data: {
    groups: [],
    total: 0,
    statText: ''
  },

  onShow: function () {
    this.settings = store.getSettings();
    this.notes = store.getNotes();
    this.render();
  },

  render: function () {
    var groups = C.buildAgenda(this.notes);
    var total = 0;
    groups.forEach(function (g) { total += g.items.length; });

    var t = S.todayDate();
    var y = t.getUTCFullYear();
    var yc = C.countRange(y + '-01-01', y + '-12-31', this.settings);

    this.setData({
      groups: groups,
      total: total,
      statText: y + ' 年上班 ' + yc.work + ' 天 · 休班 ' + yc.rest + ' 天 · 备忘 ' + total + ' 条'
    });
  },

  delNote: function (e) {
    var key = e.currentTarget.dataset.key;
    var id = e.currentTarget.dataset.id;
    var self = this;
    wx.showModal({
      title: '删除备忘',
      content: '删除后无法恢复，确定吗？',
      success: function (res) {
        if (res.confirm) {
          self.notes = store.removeNote(key, id);
          self.render();
        }
      }
    });
  },

  goIndex: function () {
    wx.navigateBack({
      fail: function () {
        wx.reLaunch({ url: '/pages/index/index' });
      }
    });
  }
});
