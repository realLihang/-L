var store = require('./utils/store.js');

App({
  globalData: {
    settings: null,
    notes: {}
  },

  onLaunch: function () {
    this.refresh();
  },

  onShow: function () {
    this.refresh();
  },

  refresh: function () {
    this.globalData.settings = store.getSettings();
    this.globalData.notes = store.getNotes();
    return this.globalData;
  },

  saveSettings: function (s) {
    this.globalData.settings = store.saveSettings(s);
    return this.globalData.settings;
  },

  saveNotes: function (n) {
    this.globalData.notes = store.saveNotes(n);
    return this.globalData.notes;
  }
});
