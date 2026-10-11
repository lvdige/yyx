/* ==========================================================================
 * app.js — 应用入口：组装 Player 与 UI，绑定播放器事件
 * ========================================================================== */
(function () {
  'use strict';

  var audio = document.getElementById('audio');
  var player = new Player();

  player.init(audio, {
    time: function (cur, dur) { UI.onPlayerTime(cur, dur); },
    playstate: function (st) { UI.onPlayerState(st); },
    loading: function (song) { UI.onPlayerLoading(song); },
    loaded: function (song) { UI.onPlayerLoaded(song); },
    meta: function (song) { UI.onPlayerMeta(song); },
    lyrics: function (parsed) { UI.onPlayerLyrics(parsed); },
    volume: function (v, m) { UI.onPlayerVolume(v, m); },
    mode: function (m, label) { UI.onPlayerMode(m, label); },
    lists: function () { UI.onPlayerLists(); },
    duration: function (d) { UI.onPlayerTime(audio.currentTime, d); },
    error: function (msg) {
      var el = document.getElementById('mp-loading');
      if (el) el.hidden = true;
      UI.showToast(msg);
    },
    localReady: function () { UI.refreshPlaylistNav(); UI.render(); }
  });

  /* 暴露到全局（ui.js 引用） */
  window.player = player;

  document.addEventListener('DOMContentLoaded', function () {
    UI.init();
  });
})();
