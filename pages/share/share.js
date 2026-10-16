var S = require('../../utils/shift.js');
var L = require('../../utils/lunar.js');
var store = require('../../utils/store.js');

Page({
  data: {},

  onLoad: function () {
    this.s = store.getSettings();
  },

  onReady: function () {
    this.drawPoster();
  },

  // 转发小程序卡片（带来 UV）
  onShareAppMessage: function () {
    var s = this.s;
    var t = S.todayDate();
    var key = S.keyOf(t);
    var isWork = S.statusOf(key, s).type === 'work';
    return {
      title: '倒班日历 · 今天' + (isWork ? '上班' : '休班') + '（上' + s.workDays + '休' + s.restDays + '）',
      path: '/pages/index/index'
    };
  },

  drawPoster: function () {
    var self = this;
    wx.createSelectorQuery().select('#poster').fields({ node: true, size: true }).exec(function (res) {
      if (!res || !res[0] || !res[0].node) {
        wx.showToast({ title: '卡片生成失败', icon: 'none' });
        return;
      }
      var canvas = res[0].node;
      var W = res[0].width;
      var H = res[0].height;
      var info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      var dpr = info.pixelRatio || 2;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      var ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      self.render(ctx, W, H, canvas);
    });
  },

  render: function (ctx, W, H, canvas) {
    var self = this;
    var s = this.s;
    var t = S.todayDate();
    var key = S.keyOf(t);
    var st = S.statusOf(key, s);
    var isWork = st.type === 'work';
    var main = isWork ? '#c62828' : '#177a41';
    var soft = isWork ? '#fdecec' : '#e4f6ea';
    var lo = L.lunarOf(key) || {};
    var lunarText = lo.text || '';
    var festival = lo.festival || '';
    var term = lo.term || '';
    var dayNo = S.dayNoOf(st, s);
    var total = isWork ? s.workDays : s.restDays;
    var dateText = S.fmtCn(t);
    var target = isWork ? s.workDays : S.cycleLen(s);
    var left = target - st.pos;
    var nextLabel = isWork ? '距下次休班' : '距下次上班';
    var sub = festival || term || (lunarText ? ('农历' + lunarText) : '');

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // 顶部主色带
    var headH = H * 0.15;
    ctx.fillStyle = main;
    ctx.fillRect(0, 0, W, headH);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold ' + (W * 0.060) + 'px "PingFang SC", sans-serif';
    ctx.fillText('倒班日历', W * 0.06, headH * 0.5);
    ctx.font = (W * 0.036) + 'px "PingFang SC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(dateText, W * 0.94, headH * 0.5);

    // 中部大状态块
    var blockTop = headH + H * 0.05;
    var blockH = H * 0.22;
    ctx.fillStyle = soft;
    this.roundRect(ctx, W * 0.30, blockTop, W * 0.40, blockH, W * 0.05);
    ctx.fill();
    ctx.fillStyle = main;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + (W * 0.17) + 'px "PingFang SC", sans-serif';
    ctx.fillText(isWork ? '班' : '休', W * 0.5, blockTop + blockH * 0.5);
    ctx.fillStyle = '#1c1f23';
    ctx.font = (W * 0.050) + 'px "PingFang SC", sans-serif';
    ctx.fillText(isWork ? '今天上班' : '今天休班', W * 0.5, blockTop + blockH + H * 0.035);
    if (sub) {
      ctx.fillStyle = '#8a6d3b';
      ctx.font = (W * 0.040) + 'px "PingFang SC", sans-serif';
      ctx.fillText(sub, W * 0.5, blockTop + blockH + H * 0.080);
    }

    // 进度
    var proTop = blockTop + blockH + H * 0.13;
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'left';
    ctx.font = (W * 0.040) + 'px "PingFang SC", sans-serif';
    ctx.fillText('本轮' + (isWork ? '上班' : '休班') + '第 ' + dayNo + ' 天 / 共 ' + total + ' 天', W * 0.06, proTop);
    var barTop = proTop + H * 0.035;
    var barH = H * 0.020;
    ctx.fillStyle = '#eef0f2';
    this.roundRect(ctx, W * 0.06, barTop, W * 0.88, barH, barH / 2);
    ctx.fill();
    var ratio = total > 0 ? dayNo / total : 0;
    if (ratio < 0) ratio = 0;
    if (ratio > 1) ratio = 1;
    ctx.fillStyle = main;
    this.roundRect(ctx, W * 0.06, barTop, W * 0.88 * ratio, barH, barH / 2);
    ctx.fill();

    // 两个信息卡
    var cardTop = barTop + H * 0.07;
    var cardH = H * 0.14;
    var gap = W * 0.04;
    var cardW = (W * 0.88 - gap) / 2;
    this.infoCard(ctx, W * 0.06, cardTop, cardW, cardH, nextLabel, left + ' 天', soft, main, W * 0.04);
    this.infoCard(ctx, W * 0.06 + cardW + gap, cardTop, cardW, cardH, '排班规则', '上' + s.workDays + '休' + s.restDays, '#f2f3f5', '#1c1f23', W * 0.04);

    // 底部 slogan
    var footTop = cardTop + cardH + H * 0.06;
    ctx.fillStyle = '#9aa1ab';
    ctx.textAlign = 'center';
    ctx.font = (W * 0.038) + 'px "PingFang SC", sans-serif';
    ctx.fillText('微信搜索「倒班日历」，一起管好倒班生活', W * 0.5, footTop);
    ctx.fillText('数据仅存本机 · 永久免费', W * 0.5, footTop + H * 0.035);

    wx.canvasToTempFilePath({
      canvas: canvas,
      success: function (rr) { self._temp = rr.tempFilePath; },
      fail: function () { wx.showToast({ title: '卡片生成失败', icon: 'none' }); }
    });
  },

  // 圆角矩形路径（兼容旧基础库，不依赖 ctx.roundRect）
  roundRect: function (ctx, x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  infoCard: function (ctx, x, y, w, h, label, value, soft, color, radius) {
    ctx.fillStyle = soft;
    this.roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.fillStyle = '#6b7280';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = (w * 0.110) + 'px "PingFang SC", sans-serif';
    ctx.fillText(label, x + w / 2, y + h * 0.30);
    ctx.fillStyle = color;
    ctx.font = 'bold ' + (w * 0.240) + 'px "PingFang SC", sans-serif';
    ctx.fillText(value, x + w / 2, y + h * 0.64);
  },

  saveAlbum: function () {
    var self = this;
    if (!this._temp) {
      wx.showToast({ title: '请稍候再试', icon: 'none' });
      return;
    }
    wx.saveImageToPhotosAlbum({
      filePath: this._temp,
      success: function () {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
      },
      fail: function (err) {
        var msg = (err && err.errMsg) || '';
        if (/auth|deny|album/i.test(msg)) {
          wx.showModal({
            title: '需要相册权限',
            content: '保存图片需要允许访问相册，请在设置中开启。',
            confirmText: '去设置',
            success: function (rr) { if (rr.confirm) wx.openSetting(); }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  }
});
