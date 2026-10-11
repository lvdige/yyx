/* ==========================================================================
 * ui.js — 界面渲染与交互（Apple Music 风格）
 * 视图：首页 / 专辑 / 专辑详情 / 歌曲 / 播放列表 / 歌曲页 / 搜索 / 正在播放
 * ========================================================================== */
(function (global) {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------------- 图标 ---------------- */
  var ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a.8.8 0 0 0 1.24.67l10.3-6.5a.8.8 0 0 0 0-1.34L9.24 4.83A.8.8 0 0 0 8 5.5Z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5.5" width="3.6" height="13" rx="1.2"/><rect x="13.9" y="5.5" width="3.6" height="13" rx="1.2"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.7 4.6 13.4a4.9 4.9 0 0 1 0-6.9 4.8 4.8 0 0 1 6.9 0l.5.5.5-.5a4.8 4.8 0 0 1 6.9 0 4.9 4.9 0 0 1 0 6.9Z"/></svg>',
    heartFilled: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.7 4.6 13.4a4.9 4.9 0 0 1 0-6.9 4.8 4.8 0 0 1 6.9 0l.5.5.5-.5a4.8 4.8 0 0 1 6.9 0 4.9 4.9 0 0 1 0 6.9Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/></svg>',
    lyrics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6.5h16M4 12h10M4 17.5h7"/><circle cx="17.5" cy="17.5" r="2.2"/><path d="M19.7 17.5V10l1.8-.6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.4" fill="currentColor"/></svg>',
    remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 6.5h14M9 6.5V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8v1.7M6.5 6.5l.8 12.2A1.5 1.5 0 0 0 8.8 20h6.4a1.5 1.5 0 0 0 1.5-1.3l.8-12.2"/><path d="M10 10.5v5.5M14 10.5v5.5"/></svg>',
    folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M13 3v5h5"/></svg>',
    music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></svg>',
    shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6.5h4l10 11h4"/><path d="M15.5 6.5h4.5v4.5"/><path d="M3 17.5h4l3-3.3"/><path d="M14 9.8l1.5-1.6M3 6.5h1.6M18 17.5h2.4"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><rect x="4" y="4.5" width="2.4" height="3" rx="0.8"/><rect x="4" y="10.5" width="2.4" height="3" rx="0.8"/><rect x="4" y="16.5" width="2.4" height="3" rx="0.8"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>'
  };

  /* 专辑视图：grid 方格 / list 列表（localStorage 记忆） */
  function albumView() {
    try { return localStorage.getItem('amp_album_view_v1') === 'list' ? 'list' : 'grid'; }
    catch (e) { return 'grid'; }
  }
  function setAlbumView(v) {
    try { localStorage.setItem('amp_album_view_v1', v === 'list' ? 'list' : 'grid'); } catch (e) {}
  }

  function renderViewToggle(active) {
    return '<div class="view-toggle" role="group" aria-label="专辑视图切换">' +
      '<button class="vt-btn' + (active === 'grid' ? ' active' : '') + '" data-album-view="grid" title="方格视图">' + ICONS.grid + '</button>' +
      '<button class="vt-btn' + (active === 'list' ? ' active' : '') + '" data-album-view="list" title="列表视图">' + ICONS.list + '</button></div>';
  }

  /* ---------------- 状态 ---------------- */
  var MODE_LABEL = { 'order': '顺序播放', 'repeat': '列表循环', 'repeat-one': '单曲循环', 'shuffle': '随机播放' };
  var state = {
    library: null,          /* 主音乐库 */
    folderLibrary: null,    /* 文件夹补充库 */
    currentView: 'home',
    searchQuery: '',
    nowplayingOpen: false,
    npSongKey: null,
    lyricExpanded: false,
    lyricLines: null,
    currentLyrics: null,
    npBaseColor: null,
    queueList: []           /* 当前渲染的歌曲列表（用于双击播放） */
  };

  /* ---------------- Toast ---------------- */
  var toastTimer = null;
  function showToast(msg) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2400);
  }

  /* ---------------- 工具 ---------------- */
  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0 || sec == null) return '-:--';
    var s = Math.floor(sec % 60);
    var m = Math.floor(sec / 60);
    return (m < 10 ? m : m) + ':' + (s < 10 ? '0' + s : s);
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function getSongByKey(key) {
    if (!key) return null;
    if (state.library && state.library.byKey.get(key)) return state.library.byKey.get(key);
    if (state.folderLibrary && state.folderLibrary.byKey.get(key)) return state.folderLibrary.byKey.get(key);
    var locals = player.getLocalSongs();
    for (var i = 0; i < locals.length; i++) {
      if (locals[i].key === key) return locals[i];
    }
    return null;
  }
  function allSongs() {
    var out = [];
    if (state.library) out = out.concat(state.library.songs);
    if (state.folderLibrary) out = out.concat(state.folderLibrary.songs);
    return out;
  }
  function allAlbums() {
    var out = [];
    if (state.library) out = out.concat(state.library.albums);
    if (state.folderLibrary) out = out.concat(state.folderLibrary.albums);
    return out;
  }

  /* 封面地址解析（歌曲封面与专辑封面分开识别：
     歌曲有自己的封面文件（coverUrl）→ 优先用它；没有才回退专辑封面） */
  function coverSrc(song) {
    if (song.coverUrl) return song.coverUrl;
    if (song.coverDataUrl) return song.coverDataUrl;
    var alb = findAlbum(song.albumId);
    if (alb) {
      if (alb.coverDataUrl) return alb.coverDataUrl;
      if (alb.coverUrl) return alb.coverUrl;
      if (alb.coverFile) {
        if (!alb._coverObj) alb._coverObj = URL.createObjectURL(alb.coverFile);
        return alb._coverObj;
      }
    }
    return '';
  }
  function findAlbum(albumId) {
    var albs = allAlbums();
    for (var i = 0; i < albs.length; i++) if (albs[i].id === albumId) return albs[i];
    return null;
  }

  /* ---------------- 主色提取 ---------------- */
  function extractColor(imgEl) {
    return new Promise(function (resolve) {
      var onDone = function () {
        try {
          var c = document.createElement('canvas');
          c.width = 40; c.height = 40;
          var ctx = c.getContext('2d');
          ctx.drawImage(imgEl, 0, 0, 40, 40);
          var d = ctx.getImageData(0, 0, 40, 40).data;
          var r = 0, g = 0, b = 0, n = 0;
          for (var i = 0; i < d.length; i += 4) {
            r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
          }
          if (!n) return resolve(null);
          resolve({ r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) });
        } catch (e) { resolve(null); }
      };
      if (imgEl.complete && imgEl.naturalWidth) onDone();
      else {
        imgEl.addEventListener('load', onDone, { once: true });
        imgEl.addEventListener('error', function () { resolve(null); }, { once: true });
      }
    });
  }

  /* ---------------- 路由 ---------------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    if (!h) return { view: 'home' };
    var parts = h.split('/').map(decodeURIComponent);
    return { view: parts[0], arg: parts[1], arg2: parts[2] };
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    bindGlobalEvents();
    var theme = localStorage.getItem('amp_theme_v1') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    /* 同步播放模式图标（不弹提示） */
    $('#btn-mode').setAttribute('data-mode', player.mode || 'repeat');
    /* 音量滑条初始状态 */
    onPlayerVolume(player.volume, player.muted);
    refreshPlaylistNav();
    render();
    window.addEventListener('hashchange', function () {
      state.nowplayingOpen = parseHash().view === 'nowplaying';
      render();
    });
    /* 扫描音乐库 */
    Scanner.loadLibrary().then(function (lib) {
      if (lib) {
        state.library = lib;
        refreshPlaylistNav();
        render();
        if (lib.songs.length) {
          showToast('已自动扫描到 ' + lib.albums.length + ' 张专辑，共 ' + lib.songs.length + ' 首歌曲');
        }
      } else {
        render(); /* 显示"选择文件夹"空状态 */
      }
    });
  }

  /* ---------------- 全局事件 ---------------- */
  function bindGlobalEvents() {
    /* 侧边栏 + 移动端底部 Tab 导航 */
    document.addEventListener('click', function (e) {
      var nav = e.target.closest('.nav-item[data-hash], .mtab[data-hash]');
      if (nav) {
        location.hash = nav.getAttribute('data-hash');
        return;
      }
      var menuItem = e.target.closest('[data-menu-action]');
      if (menuItem) { handleMenuAction(menuItem); return; }
      var modalBtn = e.target.closest('[data-modal-action]');
      if (modalBtn) { handleModalAction(modalBtn); return; }
    });

    /* 视图内事件委托 */
    $('#view').addEventListener('click', onViewClick);
    $('#view').addEventListener('dblclick', onViewDblClick);

    /* 搜索 */
    var searchInput = $('#search-input');
    var debounceTimer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        state.searchQuery = searchInput.value.trim();
        $('#search-clear').hidden = !state.searchQuery;
        if (state.searchQuery) {
          location.hash = '#/search';
        } else if (parseHash().view === 'search') {
          location.hash = '#/home';
        }
        render();
      }, 220);
    });
    $('#search-clear').addEventListener('click', function () {
      searchInput.value = '';
      state.searchQuery = '';
      $('#search-clear').hidden = true;
      location.hash = '#/home';
      render();
    });

    /* 主题 */
    $('#btn-theme').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', cur);
      localStorage.setItem('amp_theme_v1', cur);
    });

    /* 新建播放列表 */
    $('#btn-new-playlist').addEventListener('click', function () {
      openPrompt('新建播放列表', '输入播放列表名称', '', function (name) {
        var pl = player.createPlaylist(name);
        if (pl) {
          refreshPlaylistNav();
          location.hash = '#/playlist/' + pl.id;
          showToast('已创建播放列表「' + pl.name + '」');
        }
      });
    });

    /* 导入 */
    $('#btn-import-file').addEventListener('click', function () {
      var input = $('#file-input-audio');
      input.value = '';
      input.click();
    });
    $('#file-input-audio').addEventListener('change', onAudioImported);

    /* 返回按钮 */
    $('#btn-back').addEventListener('click', goBack);

    /* 迷你播放条 */
    $('#btn-play').addEventListener('click', function () { player.toggle(); });
    $('#btn-prev').addEventListener('click', function () { player.prev(); });
    $('#btn-next').addEventListener('click', function () { player.next(); });
    $('#btn-stop').addEventListener('click', function () { player.stop(); });
    $('#btn-mode').addEventListener('click', function () { player.cycleMode(); });
    $('#btn-mute').addEventListener('click', function () { player.toggleMute(); });
    $('#btn-nowplaying').addEventListener('click', function () {
      if (!player.current) return;
      location.hash = '#/nowplaying';
    });
    $('#mp-cover').addEventListener('click', function () {
      if (!player.current) return;
      location.hash = '#/nowplaying';
    });
    $('#mp-info').addEventListener('click', function () {
      if (!player.current) return;
      location.hash = '#/nowplaying';
    });

    /* 正在播放页 */
    $('#np-close').addEventListener('click', function () { goBack(); });
    $('#np-play').addEventListener('click', function () { player.toggle(); });
    $('#np-prev').addEventListener('click', function () { player.prev(); });
    $('#np-next').addEventListener('click', function () { player.next(); });
    $('#np-fav').addEventListener('click', function () {
      if (!player.current) return;
      var fav = player.toggleFavorite(player.current);
      updateNpFav(fav);
      showToast(fav ? '已加入我喜欢的' : '已取消收藏');
    });
    $('#np-add-to-list').addEventListener('click', function () {
      if (player.current) openAddToListModal(player.current);
    });
    $('#np-page').addEventListener('click', function () {
      if (!player.current) return;
      location.hash = '#/song/' + encodeURIComponent(player.current.key);
    });
    $('#np-lyric-toggle').addEventListener('click', function () {
      state.lyricExpanded = !state.lyricExpanded;
      var scroll = $('#np-lyric-scroll');
      scroll.classList.toggle('expanded', state.lyricExpanded);
      $('#np-lyric-toggle').textContent = state.lyricExpanded ? '收起' : '查看全部';
    });

    /* 进度条拖动 */
    bindSlider($('#mp-progress-bar'), function (ratio) {
      var dur = player.audio.duration || (player.current ? player.current.duration : 0);
      player.seek(ratio * dur);
    });
    bindSlider($('#np-progress-bar'), function (ratio) {
      var dur = player.audio.duration || (player.current ? player.current.duration : 0);
      player.seek(ratio * dur);
    });
    bindSlider($('#volume-bar'), function (ratio) {
      player.setVolume(ratio);
    });
    $('#volume-bar').addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp') { e.preventDefault(); player.setVolume(player.volume + 0.05); }
      if (e.key === 'ArrowDown') { e.preventDefault(); player.setVolume(player.volume - 0.05); }
    });
    $('#mp-progress-bar').addEventListener('keydown', function (e) {
      var dur = player.audio.duration || 0;
      if (e.key === 'ArrowLeft') { e.preventDefault(); player.seek((player.audio.currentTime || 0) - 5); }
      if (e.key === 'ArrowRight') { e.preventDefault(); player.seek((player.audio.currentTime || 0) + 5); }
      if (e.key === 'Home') { e.preventDefault(); player.seek(0); }
      if (e.key === 'End') { e.preventDefault(); player.seek(dur); }
    });

    /* 键盘快捷键 */
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); player.toggle(); }
      else if (e.key === 'ArrowLeft' && !e.ctrlKey) { e.preventDefault(); player.seek((player.audio.currentTime || 0) - 5); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); player.seek((player.audio.currentTime || 0) + 5); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); player.setVolume(player.volume + 0.05); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); player.setVolume(player.volume - 0.05); }
      else if (e.key.toLowerCase() === 'm') { player.toggleMute(); }
      else if (e.key.toLowerCase() === 'n') { player.next(); }
      else if (e.key.toLowerCase() === 'p') { player.prev(); }
      else if (e.key.toLowerCase() === 'l' && player.current) { player.toggleFavorite(player.current); refreshPlaylistNav(); }
    });

    /* 点击空白关闭菜单 */
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.menu')) closeMenu();
    }, true);
    window.addEventListener('resize', closeMenu);
  }

  /* ---------------- 滑块 ---------------- */
  function bindSlider(track, onSeek) {
    var dragging = false;
    function ratioFromEvent(e) {
      var r = track.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      return Math.max(0, Math.min(1, x / r.width));
    }
    function onDown(e) {
      e.preventDefault();
      dragging = true;
      track.classList.add('dragging');
      onSeek(ratioFromEvent(e));
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    }
    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      onSeek(ratioFromEvent(e));
    }
    function onUp() {
      dragging = false;
      track.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    }
    track.addEventListener('mousedown', onDown);
    track.addEventListener('touchstart', onDown, { passive: false });
    /* 键盘 ←/→ 已在全局处理 */
  }

  /* ---------------- 文件导入 ---------------- */
  async function onAudioImported(e) {
    var files = e.target.files;
    if (!files || !files.length) return;
    var songs = await player.importFiles(files);
    if (songs.length) {
      refreshPlaylistNav();
      render();
      showToast('已导入 ' + songs.length + ' 个本地音频');
      if (songs.length === 1) {
        player.loadSong(songs[0]);
        location.hash = '#/nowplaying';
      }
    } else {
      showToast('未找到支持的音频文件');
    }
  }

  /* ---------------- 视图渲染 ---------------- */
  function render() {
    var route = parseHash();
    var viewEl = $('#view');
    closeMenu();
    updateSidebarActive(route);

    /* 返回按钮：首页且未搜索时隐藏（电脑顶部 + 手机顶部通用） */
    $('#btn-back').hidden = route.view === 'home' && !state.searchQuery;

    if (route.view === 'nowplaying') {
      state.nowplayingOpen = true;
      openNowplaying();
      viewEl.innerHTML = renderLoading('');
      return;
    }
    state.nowplayingOpen = false;
    $('#nowplaying-view').hidden = true;

    if (route.view === 'search' && state.searchQuery) {
      viewEl.innerHTML = renderSearch(state.searchQuery);
      return;
    }
    switch (route.view) {
      case 'albums': viewEl.innerHTML = renderAlbums(); break;
      case 'album': viewEl.innerHTML = renderAlbumPage(route.arg); break;
      case 'songs': viewEl.innerHTML = renderSongsPage(); break;
      case 'song': viewEl.innerHTML = renderSongPage(route.arg); _songPageSongKey = route.arg; break;
      case 'playlist': viewEl.innerHTML = renderPlaylistPage(route.arg); break;
      case 'home':
      default: viewEl.innerHTML = renderHome(); break;
    }
    /* 视图内动画：重置 */
    applyStagger(viewEl);
  }

  function applyStagger(root) {
    var cards = $$('.album-card, .album-list-item, .song-row', root);
    cards.forEach(function (el, i) { el.style.setProperty('--i', Math.min(i, 24)); });
  }

  function updateSidebarActive(route) {
    $$('.nav-item[data-hash]').forEach(function (el) {
      var hash = el.getAttribute('data-hash');
      var active = false;
      if (route.view === 'home' && hash === '#/home') active = true;
      if (route.view === 'albums' && hash === '#/albums') active = true;
      if (route.view === 'songs' && hash === '#/songs') active = true;
      if (route.view === 'playlist' && hash === '#/playlist/' + route.arg) active = true;
      if (route.view === 'album' && hash === '#/albums') active = true;
      el.classList.toggle('active', active);
    });
    /* 移动端 Tab 栏 */
    $$('.mtab[data-hash]').forEach(function (el) {
      var hash = el.getAttribute('data-hash');
      var active = false;
      if (route.view === 'home' && hash === '#/home') active = true;
      if (route.view === 'albums' && hash === '#/albums') active = true;
      if (route.view === 'album' && hash === '#/albums') active = true;
      if (route.view === 'songs' && hash === '#/songs') active = true;
      if (route.view === 'playlist' && hash === '#/playlist/favorites') active = true;
      el.classList.toggle('active', active);
    });
  }

  function renderLoading(text) {
    return '<div class="library-loading"><div class="loading-ring"></div><p>' + esc(text || '正在加载音乐库…') + '</p></div>';
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    if (!state.library && !state.folderLibrary) {
      return renderEmptyLibrary();
    }
    var songs = allSongs();
    var albums = allAlbums();
    var recentKeys = player.getRecent();
    var recentSongs = [];
    recentKeys.forEach(function (k) {
      var s = getSongByKey(k);
      if (s && recentSongs.length < 6) recentSongs.push(s);
    });

    var html = '<div class="view-page">';
    html += '<div class="page-head"><div class="page-title-block">' +
      '<div class="page-kicker">音乐库</div>' +
      '<div class="page-title">欢迎回来</div>' +
      '<div class="page-sub">' + albums.length + ' 张专辑 · ' + songs.length + ' 首歌曲</div></div>' +
      '<div class="page-head-actions"><button class="btn btn-primary" id="home-play-all">' + ICONS.play + '播放全部</button></div></div>';

    if (recentSongs.length) {
      html += '<div class="section-head"><h2>最近播放</h2><a class="section-link" href="#/playlist/recent">查看全部</a></div>';
      html += renderSongTable(recentSongs, { noIndex: true });
    }

    html += '<div class="section-head"><h2>专辑</h2><div class="section-actions">' + renderViewToggle(albumView()) +
      '<a class="section-link" href="#/albums">查看全部</a></div></div>';
    html += renderAlbumGrid(albums.slice(0, 12));

    html += '</div>';
    return html;
  }

  /* ---------------- 空库 ---------------- */
  function renderEmptyLibrary() {
    var html = '<div class="view-page"><div class="empty-state">' +
      '<div class="empty-icon">' + ICONS.music + '</div>' +
      '<h3>音乐库为空</h3>' +
      '<p>将专辑文件夹放进网站同目录下的 <b>Music</b> 文件夹（每个专辑一个子文件夹，封面命名为 cover.png / cover.jpg / cover.bmp，歌词与歌曲同名 .lrc），然后刷新页面自动扫描。</p>' +
      '<button class="btn" id="empty-import-file">' + ICONS.file + '导入本地音频文件</button>' +
      '</div></div>';
    return html;
  }

  /* ---------------- 专辑网格 / 列表 ---------------- */
  function renderAlbums() {
    var albums = allAlbums();
    var html = '<div class="view-page"><div class="page-head"><div class="page-title-block">' +
      '<div class="page-kicker">资料库</div><div class="page-title">专辑</div>' +
      '<div class="page-sub">' + albums.length + ' 张专辑</div></div>' +
      '<div class="page-head-actions">' + renderViewToggle(albumView()) + '</div></div>';
    if (!albums.length) {
      html += '<div class="empty-state"><div class="empty-icon">' + ICONS.music + '</div><h3>还没有专辑</h3><p>将专辑文件夹放入 Music 目录后刷新页面。</p></div>';
    } else {
      html += renderAlbumGrid(albums);
    }
    html += '</div>';
    return html;
  }

  function renderAlbumGrid(albums) {
    if (!albums.length) return '<div class="empty-state"><p>暂无内容</p></div>';
    var view = albumView();
    var html = view === 'list' ? '<div class="album-list">' : '<div class="album-grid">';
    albums.forEach(function (alb) {
      var cover = alb.coverDataUrl || alb.coverUrl || (alb.coverFile && !alb._coverObj ? '' : (alb.coverFile ? alb._coverObj : ''));
      if (alb.coverFile && !alb._coverObj) alb._coverObj = URL.createObjectURL(alb.coverFile);
      cover = alb.coverDataUrl || alb.coverUrl || (alb.coverFile ? alb._coverObj : '');
      var imgHtml = cover
        ? '<img src="' + esc(cover) + '" alt="" loading="lazy">'
        : '<div class="cover-fallback">' + ICONS.music + '</div>';
      if (view === 'list') {
        html += '<div class="album-list-item" data-album="' + esc(alb.id) + '">' +
          '<div class="album-cover-wrap">' + imgHtml + '</div>' +
          '<div class="album-list-info">' +
          '<div class="album-name">' + esc(alb.name) + '</div>' +
          '<div class="album-artist">' + esc(alb.artist || '未知艺术家') + '</div>' +
          '<div class="album-song-count">' + alb.songs.length + ' 首歌曲</div></div>' +
          '<div class="album-list-meta">' + ICONS.chevron + '</div>' +
          '</div>';
      } else {
        html += '<div class="album-card" data-album="' + esc(alb.id) + '">' +
          '<div class="album-cover-wrap">' + imgHtml +
          '<span class="play-hover">' + ICONS.play + '</span></div>' +
          '<div class="album-name">' + esc(alb.name) + '</div>' +
          '<div class="album-artist">' + esc(alb.artist || '未知艺术家') + '</div>' +
          '<div class="album-song-count">' + alb.songs.length + ' 首歌曲</div>' +
          '</div>';
      }
    });
    html += '</div>';
    return html;
  }

  /* ---------------- 专辑详情 ---------------- */
  function renderAlbumPage(albumId) {
    var alb = findAlbum(albumId);
    if (!alb) return renderEmptyLibrary();
    var cover = alb.coverDataUrl || alb.coverUrl;
    if (!cover && alb.coverFile) {
      if (!alb._coverObj) alb._coverObj = URL.createObjectURL(alb.coverFile);
      cover = alb._coverObj;
    }
    var head = '<div class="page-head"><div class="album-cover-wrap" style="width:170px;height:170px;flex:none">' +
      (cover ? '<img src="' + esc(cover) + '" alt="">' : '<div class="cover-fallback">' + ICONS.music + '</div>') + '</div>' +
      '<div class="page-title-block"><div class="page-kicker">专辑</div>' +
      '<div class="page-title">' + esc(alb.name) + '</div>' +
      '<div class="page-sub">' + esc(alb.artist || '未知艺术家') + ' · ' + alb.songs.length + ' 首歌曲</div></div>' +
      '<div class="page-head-actions"><button class="btn btn-primary" data-play-album="' + esc(alb.id) + '">' + ICONS.play + '播放</button></div></div>';
    var html = '<div class="view-page">' + head + renderSongTable(alb.songs) + '</div>';
    return html;
  }

  /* ---------------- 全部歌曲 ---------------- */
  function renderSongsPage() {
    var songs = allSongs();
    var html = '<div class="view-page"><div class="page-head"><div class="page-title-block">' +
      '<div class="page-kicker">资料库</div><div class="page-title">歌曲</div>' +
      '<div class="page-sub">' + songs.length + ' 首歌曲</div></div>' +
      '<div class="page-head-actions"><button class="btn btn-primary" id="songs-play-all">' + ICONS.play + '播放全部</button></div></div>';
    html += songs.length ? renderSongTable(songs) : '<div class="empty-state"><div class="empty-icon">' + ICONS.music + '</div><h3>还没有歌曲</h3></div>';
    html += '</div>';
    return html;
  }

  /* ---------------- 播放列表 ---------------- */
  function renderPlaylistPage(id) {
    var title, subtitle, list, canRemove = false, canRemoveLocal = false;
    var keys;

    if (id === 'favorites') {
      title = '我喜欢的'; subtitle = '已收藏的歌曲';
      keys = Array.from(player.favorites);
      list = keys.map(getSongByKey).filter(Boolean);
      canRemove = true;
    } else if (id === 'recent') {
      title = '最近播放'; subtitle = '最近听过的歌曲';
      keys = player.getRecent();
      list = keys.map(getSongByKey).filter(Boolean);
    } else if (id === 'local') {
      title = '本地导入'; subtitle = '从本机导入的音频';
      list = player.getLocalSongs().slice().reverse();
      canRemoveLocal = true;
    } else {
      var pl = null;
      player.getPlaylists().forEach(function (p) { if (p.id === id) pl = p; });
      if (!pl) return renderEmptyLibrary();
      title = pl.name; subtitle = '自定义播放列表';
      keys = pl.songs;
      list = keys.map(getSongByKey).filter(Boolean);
      canRemove = true;
      var actions = '<button class="btn" data-pl-rename="' + esc(pl.id) + '">' + ICONS.info + '重命名</button>' +
        '<button class="btn" data-pl-delete="' + esc(pl.id) + '">' + ICONS.remove + '删除</button>';
    }

    var head = '<div class="page-head"><div class="page-title-block"><div class="page-kicker">播放列表</div>' +
      '<div class="page-title">' + esc(title) + '</div>' +
      '<div class="page-sub">' + subtitle + ' · ' + list.length + ' 首歌曲</div></div>' +
      '<div class="page-head-actions">' + (actions || '') +
      (list.length ? '<button class="btn btn-primary" data-play-list="' + esc(id) + '">' + ICONS.play + '播放</button>' : '') +
      '</div></div>';
    var html = '<div class="view-page">' + head;
    html += list.length ? renderSongTable(list, { removeFrom: canRemove ? id : null, removeLocal: canRemoveLocal }) :
      '<div class="empty-state"><div class="empty-icon">' + ICONS.heart + '</div><h3>这个列表还是空的</h3><p>在歌曲上点击收藏或"添加到播放列表"即可加入。</p></div>';
    html += '</div>';
    return html;
  }

  /* ---------------- 歌曲页 ---------------- */
  function renderSongPage(key) {
    var song = getSongByKey(key);
    if (!song) return renderEmptyLibrary();
    var alb = findAlbum(song.albumId);
    var cover = coverSrc(song);
    var fav = player.isFavorite(song.key);
    var metaRows = [
      ['歌曲', song.title || song.fileName],
      ['艺术家', song.artist || (alb ? alb.artist : '') || '未知艺术家'],
      ['专辑', song.album || '未知专辑'],
      ['文件', song.fileName],
      ['标签', song.needTag ? '无标签（按文件名显示）' : (song.title ? '已读取标签' : '无标签（按文件名显示）')],
      ['时长', song.duration ? fmtTime(song.duration) : '未知']
    ];
    var metaHtml = metaRows.map(function (r) {
      return '<div class="song-page-meta-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
    }).join('');

    /* 歌词区：优先同名 lrc，其次标签内嵌歌词（静态全文） */
    var lyricText = song.lrcText || song.tagLyrics || '';
    var lyricHtml = '';
    if (lyricText) {
      try {
        var lp = Lyrics.parse(lyricText);
        lyricHtml = '<div class="song-page-lyric-block">' +
          '<div class="section-head"><h2>歌词</h2></div>' +
          '<div class="song-page-lyrics">' +
          (lp.lines.length ? lp.lines.map(function (l) { return '<div>' + esc(l.text) + '</div>'; }).join('') : esc(lyricText).replace(/\n/g, '<br>')) +
          '</div></div>';
      } catch (e) {
        lyricHtml = '';
      }
    }

    var html = '<div class="view-page">' +
      '<div class="page-head"><div class="album-cover-wrap" style="width:170px;height:170px;flex:none">' +
      (cover ? '<img src="' + esc(cover) + '" alt="">' : '<div class="cover-fallback">' + ICONS.music + '</div>') + '</div>' +
      '<div class="page-title-block"><div class="page-kicker">歌曲</div>' +
      '<div class="page-title">' + esc(song.title) + '</div>' +
      '<div class="page-sub">' + esc(song.artist || '未知艺术家') + ' · ' + esc(song.album) + '</div></div>' +
      '<div class="page-head-actions">' +
      '<button class="btn" data-song-fav="' + esc(song.key) + '">' + (fav ? ICONS.heartFilled : ICONS.heart) + (fav ? '已收藏' : '收藏') + '</button>' +
      '<button class="btn" data-song-addlist="' + esc(song.key) + '">' + ICONS.plus + '添加到播放列表</button>' +
      '<button class="btn btn-primary" data-song-play="' + esc(song.key) + '">' + ICONS.play + '播放</button>' +
      '</div></div>' +
      '<div class="song-page-meta">' + metaHtml + '</div>' +
      lyricHtml +
      '<div class="section-head"><h2>同专辑歌曲</h2></div>' +
      '<div data-alb-key="' + esc(alb ? alb.name : '') + '">' + renderSongTable(alb ? alb.songs : [song]) + '</div>' +
      '</div>';
    return html;
  }

  /* 歌曲详情页实时跟随当前播放歌曲：
     切歌时局部更新头部/元信息/歌词/同专辑列表，不整页重建（避免卡顿、信息不更新、焦点丢失） */
  var _songPageSongKey = null;
  function updateSongPage() {
    var route = parseHash();
    if (route.view !== 'song') return;
    var song = player.current;
    if (!song) return;
    if (_songPageSongKey === song.key) {
      updateSongPageFav(song);
      moveSongPageFocus(song);
      return;
    }
    _songPageSongKey = song.key;

    var alb = findAlbum(song.albumId);
    var cover = coverSrc(song);
    var view = $('#view');
    var wrap = $('.page-head .album-cover-wrap', view);
    if (wrap) wrap.innerHTML = cover
      ? '<img src="' + esc(cover) + '" alt="">'
      : '<div class="cover-fallback">' + ICONS.music + '</div>';
    var titleEl = $('.page-title', view);
    if (titleEl) titleEl.textContent = song.title || song.fileName;
    var subEl = $('.page-sub', view);
    if (subEl) subEl.textContent = (song.artist || (alb ? alb.artist : '') || '未知艺术家') + ' · ' + (song.album || '');
    var favBtn = $('.page-head-actions [data-song-fav]', view);
    if (favBtn) favBtn.setAttribute('data-song-fav', song.key);
    var playBtn = $('.page-head-actions [data-song-play]', view);
    if (playBtn) playBtn.setAttribute('data-song-play', song.key);
    updateSongPageFav(song);

    /* 元信息 */
    var metaWrap = $('.song-page-meta', view);
    if (metaWrap) {
      var metaRows = [
        ['歌曲', song.title || song.fileName],
        ['艺术家', song.artist || (alb ? alb.artist : '') || '未知艺术家'],
        ['专辑', song.album || '未知专辑'],
        ['文件', song.fileName],
        ['标签', song.needTag ? '无标签（按文件名显示）' : (song.title ? '已读取标签' : '无标签（按文件名显示）')],
        ['时长', song.duration ? fmtTime(song.duration) : '未知']
      ];
      metaWrap.innerHTML = metaRows.map(function (r) {
        return '<div class="song-page-meta-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
      }).join('');
    }

    /* 歌词区 */
    updateSongPageLyrics(route, song);

    /* 同专辑列表：专辑没变只移动焦点；变了才重建 */
    var albSongs = alb ? alb.songs : [song];
    var headEl = null;
    $$('.section-head', view).forEach(function (h) {
      if (h.textContent.indexOf('同专辑歌曲') >= 0) headEl = h;
    });
    if (!headEl) return;
    var tableEl = headEl.nextElementSibling;
    if (tableEl && tableEl.getAttribute && tableEl.getAttribute('data-alb-key') !== (alb ? alb.name : '')) {
      var table = document.createElement('div');
      table.setAttribute('data-alb-key', alb ? alb.name : '');
      table.innerHTML = renderSongTable(albSongs);
      headEl.parentNode.replaceChild(table, tableEl);
    } else {
      moveSongPageFocus(song);
    }
  }

  function moveSongPageFocus(song) {
    var view = $('#view');
    $$('.song-row.playing', view).forEach(function (el) { el.classList.remove('playing'); });
    if (song) {
      var row = $('.song-row[data-key="' + cssEscape(song.key) + '"]', view);
      if (row) row.classList.add('playing');
    }
  }

  function updateSongPageFav(song) {
    var favBtn = $('.page-head-actions [data-song-fav]', $('#view'));
    if (!favBtn) return;
    var f = player.isFavorite(song.key);
    favBtn.innerHTML = (f ? ICONS.heartFilled : ICONS.heart) + (f ? '已收藏' : '收藏');
  }

  function updateSongPageLyrics(route, song) {
    if (route.view !== 'song' || !song) return;
    var view = $('#view');
    var lyricText = song.lrcText || song.tagLyrics || '';
    var block = $('.song-page-lyric-block', view);
    var headEl = null;
    $$('.section-head', view).forEach(function (h) {
      if (h.textContent.indexOf('同专辑歌曲') >= 0) headEl = h;
    });
    if (lyricText) {
      var lines = '';
      try {
        var lp = Lyrics.parse(lyricText);
        lines = lp.lines.length ? lp.lines.map(function (l) { return '<div>' + esc(l.text) + '</div>'; }).join('') : esc(lyricText).replace(/\n/g, '<br>');
      } catch (e) { lines = ''; }
      if (block) {
        block.innerHTML = '<div class="section-head"><h2>歌词</h2></div><div class="song-page-lyrics">' + lines + '</div>';
      } else if (headEl) {
        var nb = document.createElement('div');
        nb.className = 'song-page-lyric-block';
        nb.innerHTML = '<div class="section-head"><h2>歌词</h2></div><div class="song-page-lyrics">' + lines + '</div>';
        headEl.parentNode.insertBefore(nb, headEl);
      }
    } else if (block) {
      block.parentNode.removeChild(block);
    }
  }

  /* ---------------- 搜索 ---------------- */
  function renderSearch(q) {
    var ql = q.toLowerCase();
    var songs = allSongs().filter(function (s) {
      return (s.title || '').toLowerCase().indexOf(ql) >= 0 ||
             (s.artist || '').toLowerCase().indexOf(ql) >= 0 ||
             (s.album || '').toLowerCase().indexOf(ql) >= 0 ||
             (s.fileName || '').toLowerCase().indexOf(ql) >= 0;
    });
    var albums = allAlbums().filter(function (a) {
      return (a.name || '').toLowerCase().indexOf(ql) >= 0 ||
             (a.artist || '').toLowerCase().indexOf(ql) >= 0;
    });
    var html = '<div class="view-page"><div class="page-head"><div class="page-title-block">' +
      '<div class="page-kicker">搜索</div><div class="page-title">“' + esc(q) + '”</div>' +
      '<div class="page-sub">' + songs.length + ' 首歌曲 · ' + albums.length + ' 张专辑</div></div></div>';
    if (albums.length) {
      html += '<div class="section-head"><h2>专辑</h2></div>' + renderAlbumGrid(albums);
    }
    html += '<div class="section-head"><h2>歌曲</h2></div>';
    html += songs.length ? renderSongTable(songs) : '<div class="empty-state"><p>没有找到相关歌曲</p></div>';
    html += '</div>';
    return html;
  }

  /* ---------------- 歌曲列表 ---------------- */
  function renderSongTable(songs, opts) {
    opts = opts || {};
    if (!songs.length) return '<div class="empty-state"><p>暂无歌曲</p></div>';
    var html = '<div class="song-table">';
    songs.forEach(function (song, i) {
      var isCur = player.current && player.current.key === song.key;
      var cover = coverSrc(song);
      var thumb = cover
        ? '<img src="' + esc(cover) + '" alt="" loading="lazy">'
        : '<div class="cover-fallback">' + ICONS.music + '</div>';
      var fav = player.isFavorite(song.key);
      var actions = '';
      actions += '<button class="icon-btn ic-mobile-play" data-song-playnow="' + esc(song.key) + '" title="播放">' + ICONS.play + '</button>';
      actions += '<button class="icon-btn" data-song-fav="' + esc(song.key) + '" title="' + (fav ? '取消收藏' : '收藏') + '">' + (fav ? ICONS.heartFilled : ICONS.heart) + '</button>';
      actions += '<button class="icon-btn" data-song-addlist="' + esc(song.key) + '" title="添加到播放列表">' + ICONS.plus + '</button>';
      actions += '<button class="icon-btn" data-song-open="' + esc(song.key) + '" title="歌曲页">' + ICONS.info + '</button>';
      if (opts.removeFrom) {
        actions += '<button class="icon-btn" data-song-remove="' + esc(song.key) + '" data-list-id="' + esc(opts.removeFrom) + '" title="从列表移除">' + ICONS.remove + '</button>';
      }
      if (opts.removeLocal) {
        actions += '<button class="icon-btn" data-local-remove="' + esc(song.key) + '" title="删除本地导入">' + ICONS.remove + '</button>';
      }
      var sub = song.artist ? (song.artist + (song.album ? ' · ' + song.album : '')) : song.album;
      html += '<div class="song-row' + (isCur ? ' playing' : '') + (opts.single ? ' single' : '') + '" data-key="' + esc(song.key) + '">' +
        '<div class="song-index"><span class="idx-num">' + (opts.noIndex ? '' : String(i + 1)) + '</span>' +
        '<span class="eq"><span></span><span></span><span></span></span></div>' +
        '<div class="song-main"><div class="song-thumb">' + thumb + '</div>' +
        '<div class="song-titles"><div class="song-title' + (song.hasLrc || song.tagLyrics ? ' has-lyric' : '') + '"><a class="open-page" data-song-open="' + esc(song.key) + '" title="打开歌曲页">' + esc(song.title || song.baseName) + '</a></div>' +
        '<div class="song-sub">' + esc(sub || '') + '</div></div></div>' +
        (opts.noAlbum ? '' : '<div class="song-album">' + esc(song.album || '') + '</div>') +
        '<div class="song-actions">' + actions + '</div>' +
        '<div class="song-duration">' + (song.duration ? fmtTime(song.duration) : '--:--') + '</div>' +
        '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ---------------- 视图点击 / 双击 ---------------- */
  function onViewClick(e) {
    var target = e.target;

    /* 播放全部 */
    var playAll = target.closest('#home-play-all, #songs-play-all');
    if (playAll) {
      var all = allSongs();
      if (all.length) playList(all, 0);
      return;
    }
    var playAlbum = target.closest('[data-play-album]');
    if (playAlbum) {
      var alb = findAlbum(playAlbum.getAttribute('data-play-album'));
      if (alb) playList(alb.songs, 0);
      return;
    }
    var playListBtn = target.closest('[data-play-list]');
    if (playListBtn) {
      var plId = playListBtn.getAttribute('data-play-list');
      var songs = playlistSongs(plId);
      if (songs.length) playList(songs, 0);
      return;
    }

    /* 专辑视图切换（方格 / 列表） */
    var vtBtn = target.closest('.vt-btn');
    if (vtBtn) {
      setAlbumView(vtBtn.getAttribute('data-album-view'));
      render();
      return;
    }

    /* 专辑卡片 */
    var card = target.closest('.album-card, .album-list-item');
    if (card) {
      location.hash = '#/album/' + card.getAttribute('data-album');
      return;
    }

    /* 行播放按钮（移动端触摸等价路径） */
    var playNow = target.closest('[data-song-playnow]');
    if (playNow) {
      var pk = playNow.getAttribute('data-song-playnow');
      var pSong = getSongByKey(pk);
      if (pSong) {
        var rows = $$('.song-row', $('#view'));
        var list = [];
        rows.forEach(function (r) {
          var k = r.getAttribute('data-key');
          var s = getSongByKey(k);
          if (s) list.push(s);
        });
        if (!list.length) list = [pSong];
        playList(list, Math.max(0, list.indexOf(pSong)));
      }
      return;
    }

    /* 歌曲页"播放"按钮 */
    var spBtn = target.closest('[data-song-play]');
    if (spBtn) {
      var sk = spBtn.getAttribute('data-song-play');
      var s0 = getSongByKey(sk);
      if (s0) {
        var alb0 = findAlbum(s0.albumId);
        if (alb0 && alb0.songs.length) playList(alb0.songs, Math.max(0, alb0.songs.indexOf(s0)));
        else playList([s0], 0);
      }
      return;
    }

    /* 歌曲页入口（标题链接） */
    var openBtn = target.closest('[data-song-open]');
    if (openBtn) {
      location.hash = '#/song/' + encodeURIComponent(openBtn.getAttribute('data-song-open'));
      return;
    }

    /* 收藏 */
    var favBtn = target.closest('[data-song-fav]');
    if (favBtn) {
      var s1 = getSongByKey(favBtn.getAttribute('data-song-fav'));
      if (s1) {
        var f = player.toggleFavorite(s1);
        var route0 = parseHash();
        if (route0.view === 'song') {
          /* 歌曲页：局部更新（头部按钮 + 列表行图标），避免整页重建跳回原歌曲 */
          if (_songPageSongKey === s1.key) updateSongPageFav(s1);
          var rows0 = $$('.song-row[data-key="' + cssEscape(s1.key) + '"]', $('#view'));
          rows0.forEach(function (row) {
            var rBtn = $('[data-song-fav]', row);
            if (rBtn) rBtn.innerHTML = f ? ICONS.heartFilled : ICONS.heart;
          });
        } else {
          render();
        }
        refreshPlaylistNav();
        showToast(f ? '已加入「我喜欢的」' : '已取消收藏');
      }
      return;
    }

    /* 添加到播放列表 */
    var addBtn = target.closest('[data-song-addlist]');
    if (addBtn) {
      var s2 = getSongByKey(addBtn.getAttribute('data-song-addlist'));
      if (s2) openAddToListModal(s2);
      return;
    }

    /* 从列表移除 */
    var rmBtn = target.closest('[data-song-remove]');
    if (rmBtn) {
      var key3 = rmBtn.getAttribute('data-song-remove');
      var listId = rmBtn.getAttribute('data-list-id');
      if (listId === 'favorites') {
        var s3 = getSongByKey(key3);
        if (s3) player.toggleFavorite(s3);
      } else {
        player.removeFromPlaylist(listId, key3);
      }
      refreshPlaylistNav();
      render();
      return;
    }

    /* 删除本地导入 */
    var localRm = target.closest('[data-local-remove]');
    if (localRm) {
      var s4 = getSongByKey(localRm.getAttribute('data-local-remove'));
      if (s4) {
        player.removeLocalSong(s4);
        refreshPlaylistNav();
        render();
        showToast('已移除本地导入');
      }
      return;
    }

    /* 播放列表操作 */
    var renameBtn = target.closest('[data-pl-rename]');
    if (renameBtn) {
      var rid = renameBtn.getAttribute('data-pl-rename');
      var rp = null;
      player.getPlaylists().forEach(function (p) { if (p.id === rid) rp = p; });
      if (rp) {
        openPrompt('重命名播放列表', '输入新名称', rp.name, function (name) {
          player.renamePlaylist(rid, name);
          refreshPlaylistNav();
          render();
        });
      }
      return;
    }
    var delBtn = target.closest('[data-pl-delete]');
    if (delBtn) {
      var did = delBtn.getAttribute('data-pl-delete');
      openConfirm('删除播放列表', '确定要删除这个播放列表吗？', function () {
        player.deletePlaylist(did);
        refreshPlaylistNav();
        location.hash = '#/songs';
      });
      return;
    }

    /* 空状态按钮 */
    if (target.closest('#empty-import-file')) {
      $('#file-input-audio').click();
      return;
    }
  }

  function onViewDblClick(e) {
    var row = e.target.closest('.song-row');
    if (!row) return;
    var key = row.getAttribute('data-key');
    var song = getSongByKey(key);
    if (!song) return;
    /* 双击：以当前列表为队列播放 */
    var rows = $$('.song-row', $('#view'));
    var list = [];
    rows.forEach(function (r) {
      var k = r.getAttribute('data-key');
      var s = getSongByKey(k);
      if (s) list.push(s);
    });
    if (!list.length) list = [song];
    var idx = list.indexOf(song);
    playList(list, idx);
  }

  function playlistSongs(plId) {
    if (plId === 'favorites') return Array.from(player.favorites).map(getSongByKey).filter(Boolean);
    if (plId === 'recent') return player.getRecent().map(getSongByKey).filter(Boolean);
    if (plId === 'local') return player.getLocalSongs().slice().reverse();
    var pl = null;
    player.getPlaylists().forEach(function (p) { if (p.id === plId) pl = p; });
    return pl ? pl.songs.map(getSongByKey).filter(Boolean) : [];
  }

  function playList(list, idx) {
    if (!list.length) return;
    player.loadSong(list[idx], list, idx);
    refreshPlaylistNav();
    updateMiniPlayer();
    /* 正在播放页的内容由 onPlayerLoaded 回调驱动更新，这里不再重复全量刷新 */
  }

  /* ---------------- 播放器回调 ---------------- */
  function onPlayerTime(current, duration) {
    if (!duration || !isFinite(duration)) return;
    var ratio = Math.max(0, Math.min(1, current / duration));
    setBar($('#mp-progress-fill'), $('#mp-progress-thumb'), ratio);
    setBar($('#np-progress-fill'), $('#np-progress-thumb'), ratio);
    $('#mp-current').textContent = fmtTime(current);
    $('#mp-duration').textContent = fmtTime(duration);
    $('#np-current').textContent = fmtTime(current);
    $('#np-duration').textContent = fmtTime(duration);
    if (state.nowplayingOpen && state.lyricLines) {
      Lyrics.updateHighlight(state.lyricLines, current, $('#np-lyric-scroll'));
    }
  }

  function setBar(fill, thumb, ratio) {
    if (fill) fill.style.width = (ratio * 100) + '%';
    if (thumb) thumb.style.left = (ratio * 100) + '%';
  }

  function onPlayerState(st) {
    var playBtn = $('#btn-play');
    var npPlay = $('#np-play');
    var isPlaying = st === 'playing';
    playBtn.classList.toggle('playing', isPlaying);
    npPlay.classList.toggle('playing', isPlaying);
    $('#btn-stop').classList.toggle('active-stop', st === 'stopped');
    if (st === 'stopped') {
      setBar($('#mp-progress-fill'), $('#mp-progress-thumb'), 0);
      setBar($('#np-progress-fill'), $('#np-progress-thumb'), 0);
      $('#mp-current').textContent = '0:00';
      $('#np-current').textContent = '0:00';
    }
    /* 列表行播放态刷新 */
    var cur = player.current;
    $$('.song-row.playing', $('#view')).forEach(function (el) {
      el.classList.remove('playing');
    });
    if (cur) {
      var row = $('.song-row[data-key="' + cssEscape(cur.key) + '"]', $('#view'));
      if (row) row.classList.add('playing');
    }
    updateMiniPlayer();
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/"/g, '\\"');
  }

  function onPlayerLoading(song) {
    $('#mp-loading').hidden = false;
    /* 切歌：清掉上一首的歌词缓存与 np 页状态，避免显示旧歌词/旧封面 */
    state.lyricLines = null;
    state.currentLyrics = null;
    state.npSongKey = null;
    updateMiniPlayer();
  }

  function onPlayerLoaded(song) {
    $('#mp-loading').hidden = true;
    state.npSongKey = null; /* 歌曲已就绪，np 页下一次更新执行全量刷新（封面/背景色/歌词） */
    updateMiniPlayer();
    if (state.nowplayingOpen) updateNowplaying(true);
    renderRowsMeta();
  }

  function onPlayerMeta(song) {
    /* 专辑无封面时，用解析出的内嵌封面回填 */
    if (song.coverDataUrl) {
      var alb = findAlbum(song.albumId);
      if (alb && !alb.coverDataUrl && !alb.coverUrl && !alb.coverFile) {
        alb.coverDataUrl = song.coverDataUrl;
        refreshVisibleCovers();
      }
    }
    renderRowsMeta();
    if (state.nowplayingOpen) updateNowplaying(true);
  }

  /* 局部刷新当前视图中的封面缩略图（不重建列表，避免滚动跳位） */
  function refreshVisibleCovers() {
    var route = parseHash();
    if (route.view === 'album') { render(); return; }
    var rows = $$('.song-row', $('#view'));
    rows.forEach(function (row) {
      var key = row.getAttribute('data-key');
      var s = getSongByKey(key);
      if (!s) return;
      var thumb = $('.song-thumb', row);
      if (!thumb) return;
      var src = coverSrc(s);
      if (src) {
        thumb.innerHTML = '<img src="' + esc(src) + '" alt="" loading="lazy">';
      }
    });
    var cards = $$('.album-card', $('#view'));
    cards.forEach(function (card) {
      var aid = card.getAttribute('data-album');
      var a = findAlbum(aid);
      if (!a) return;
      var src = a.coverDataUrl || a.coverUrl || (a.coverFile ? (a._coverObj || (a._coverObj = URL.createObjectURL(a.coverFile))) : '');
      if (src) {
        var wrap = $('.album-cover-wrap', card);
        if (wrap) wrap.innerHTML = '<img src="' + esc(src) + '" alt="" loading="lazy"><span class="play-hover">' + ICONS.play + '</span>';
      }
    });
  }

  function renderRowsMeta() {
    /* 歌曲详情页：跟随当前播放歌曲局部更新（不整页重建，避免卡顿） */
    var route = parseHash();
    if (route.view === 'song') { updateSongPage(); return; }
    var rows = $$('.song-row', $('#view'));
    rows.forEach(function (row) {
      var key = row.getAttribute('data-key');
      var s = getSongByKey(key);
      if (!s) return;
      var titleEl = $('.song-title .open-page', row);
      if (titleEl) titleEl.textContent = s.title || s.baseName;
      var durEl = $('.song-duration', row);
      if (durEl && s.duration) durEl.textContent = fmtTime(s.duration);
    });
  }

  function onPlayerLyrics(parsed) {
    state.currentLyrics = parsed || null;
    var has = !!(parsed && parsed.lines && parsed.lines.length);
    /* 无歌词时隐藏"查看全部/收起"按钮 */
    $('#np-lyric-toggle').style.display = has ? '' : 'none';
    /* 歌曲详情页跟随更新歌词区（若页面显示的就是当前播放歌曲） */
    var route = parseHash();
    if (route.view === 'song' && player.current && _songPageSongKey === player.current.key) {
      updateSongPageLyrics(route, player.current);
    }
    if (!state.nowplayingOpen) return;
    var scroll = $('#np-lyric-scroll');
    if (has) {
      state.lyricLines = Lyrics.render(scroll, parsed, function (t) { player.seek(t); });
      if (player.audio && player.audio.currentTime) {
        Lyrics.updateHighlight(state.lyricLines, player.audio.currentTime, scroll);
      }
    } else {
      scroll.textContent = '';
      var empty = document.createElement('div');
      empty.className = 'np-lyric-empty';
      empty.id = 'np-lyric-empty';
      empty.textContent = '暂无歌词';
      scroll.appendChild(empty);
      state.lyricLines = null;
    }
  }

  function onPlayerVolume(vol, muted) {
    var ratio = muted ? 0 : vol;
    setBar($('#volume-fill'), $('#volume-thumb'), ratio);
    $('#btn-mute').classList.toggle('muted', muted);
    $('#volume-value').textContent = Math.round(ratio * 100) + '%';
  }

  function onPlayerMode(mode, label) {
    $('#btn-mode').setAttribute('data-mode', mode);
    $('#btn-mode').title = label || MODE_LABEL[mode] || '';
    showToast('播放模式：' + (label || MODE_LABEL[mode] || mode));
  }

  function onPlayerLists() {
    refreshPlaylistNav();
  }

  /* ---------------- 迷你播放条 ---------------- */
  function updateMiniPlayer() {
    var song = player.current;
    var mp = $('#mini-player');
    if (!song) {
      mp.hidden = true;
      return;
    }
    mp.hidden = false;
    var cover = coverSrc(song);
    var img = $('#mp-cover-img');
    var fb = $('#mp-cover-fallback');
    if (cover) {
      img.src = cover;
      img.hidden = false;
      fb.hidden = true;
    } else {
      img.hidden = true;
      fb.hidden = false;
    }
    $('#mp-title').textContent = song.title || song.baseName;
    var alb = findAlbum(song.albumId);
    $('#mp-artist').textContent = song.artist || (alb ? alb.artist : '') || '未知艺术家';
    if (song.duration) $('#mp-duration').textContent = fmtTime(song.duration);
    /* 注意：这里不再调用 onPlayerVolume/onPlayerMode/onPlayerState——
       它们会与播放器回调形成递归（onPlayerState 末尾又调用 updateMiniPlayer），
       栈溢出会导致切歌中断。这些状态由各自的播放器回调驱动。 */
  }

  /* ---------------- 正在播放页 ---------------- */
  function openNowplaying() {
    var view = $('#nowplaying-view');
    view.hidden = false;
    updateNowplaying(true);
  }
  function goBack() {
    var route = parseHash();
    if (route.view === 'home') return; /* 首页不返回 */
    if (route.view === 'nowplaying' && !player.current) {
      /* np 页无播放内容：直接回首页 */
      location.hash = '#/home';
      return;
    }
    /* 有历史则回退，否则兜底回首页 */
    if (history.length > 1) {
      history.back();
    } else {
      location.hash = '#/home';
    }
  }

  function updateNowplaying(force) {
    var song = player.current;
    if (!song) return;
    var songChanged = force || state.npSongKey !== song.key;

    if (songChanged) {
      state.npSongKey = song.key;
      var cover = coverSrc(song);
      var img = $('#np-art-img');
      var fb = $('#np-art-fallback');
      if (cover) {
        img.src = cover;
        img.hidden = false;
        fb.hidden = true;
      } else {
        img.hidden = true;
        fb.hidden = false;
      }
      $('#np-title').textContent = song.title || song.baseName;
      var alb = findAlbum(song.albumId);
      $('#np-artist').textContent = song.artist || (alb ? alb.artist : '') || '未知艺术家';
      $('#np-album').textContent = song.album || '';
      updateNpQueue();

      /* 背景主色（换歌时重算） */
      state.npBaseColor = null;
      if (cover) {
        var img2 = new Image();
        img2.onload = function () {
          extractColor(img2).then(function (c) {
            if (!c) return;
            state.npBaseColor = c;
            $('#np-bg').style.background =
              'radial-gradient(120% 100% at 20% 0%, rgba(' + c.r + ',' + c.g + ',' + c.b + ',0.75), transparent 62%),' +
              'radial-gradient(120% 100% at 85% 100%, rgba(' + Math.round(c.r * 0.6) + ',' + Math.round(c.g * 0.6) + ',' + Math.round(c.b * 0.6) + ',0.5), transparent 60%), var(--bg0)';
          });
        };
        img2.src = cover;
      } else {
        $('#np-bg').style.background = 'var(--bg0)';
      }

      /* 歌词：优先用缓存渲染；无缓存则触发一次加载 */
      if (state.currentLyrics) onPlayerLyrics(state.currentLyrics);
      else if (song && !state.lyricLines) player._loadLyrics();
    }

    updateNpFav(player.isFavorite(song.key));
    onPlayerState(player.playing ? 'playing' : (player.stopped ? 'stopped' : 'paused'));
    if (!force && player.audio && player.audio.duration) {
      onPlayerTime(player.audio.currentTime, player.audio.duration);
    }
  }

  function updateNpFav(fav) {
    var btn = $('#np-fav');
    btn.classList.toggle('faved', fav);
    btn.innerHTML = (fav ? ICONS.heartFilled : ICONS.heart) + '<span>' + (fav ? '已收藏' : '收藏') + '</span>';
  }

  var _npQueueKey = ''; /* 队列指纹：内容没变就不重建 DOM（切歌只移动高亮），避免大队列卡顿 */
  function updateNpQueue() {
    var queue = player.queue;
    var wrap = $('#np-queue');
    $('#np-queue-count').textContent = queue.length + ' 首';
    if (!queue.length) {
      if (wrap.getAttribute('data-empty') !== '1') {
        wrap.innerHTML = '<div class="empty-state" style="padding:20px"><p>队列为空</p></div>';
        wrap.setAttribute('data-empty', '1');
      }
      return;
    }
    wrap.removeAttribute('data-empty');
    var fp = queue.length + '|' + (queue[0] ? queue[0].key : '') + '|' + (queue[queue.length - 1] ? queue[queue.length - 1].key : '');
    if (fp !== _npQueueKey) {
      _npQueueKey = fp;
      var html = '<div class="song-table">';
      queue.forEach(function (s, i) {
        var isCur = player.current && player.current.key === s.key;
        var cover = coverSrc(s);
        var thumb = cover ? '<img src="' + esc(cover) + '" alt="" loading="lazy">' : '<div class="cover-fallback">' + ICONS.music + '</div>';
        html += '<div class="song-row' + (isCur ? ' playing' : '') + '" data-key="' + esc(s.key) + '" data-queue-index="' + i + '">' +
          '<div class="song-index"><span class="idx-num">' + (i + 1) + '</span><span class="eq"><span></span><span></span><span></span></span></div>' +
          '<div class="song-main"><div class="song-thumb">' + thumb + '</div>' +
          '<div class="song-titles"><div class="song-title">' + esc(s.title || s.baseName) + '</div>' +
          '<div class="song-sub">' + esc(s.artist || '') + '</div></div></div>' +
          '<div class="song-duration">' + (s.duration ? fmtTime(s.duration) : '--:--') + '</div></div>';
      });
      html += '</div>';
      wrap.innerHTML = html;
      $$('.song-row[data-queue-index]', wrap).forEach(function (row) {
        row.addEventListener('dblclick', function () {
          playList(player.queue, parseInt(row.getAttribute('data-queue-index'), 10));
        });
        row.addEventListener('click', function () {
          playList(player.queue, parseInt(row.getAttribute('data-queue-index'), 10));
        });
      });
    } else {
      /* 队列没变：只移动当前歌曲高亮 */
      var curKey = player.current ? player.current.key : '';
      $$('.song-row[data-queue-index]', wrap).forEach(function (row) {
        row.classList.toggle('playing', row.getAttribute('data-key') === curKey);
      });
    }
  }

  /* ---------------- 侧边栏 ---------------- */
  function refreshPlaylistNav() {
    var fav = player.favorites.size;
    var recent = player.getRecent().length;
    var local = player.getLocalSongs().length;
    $('#cnt-favorites').textContent = fav || '';
    $('#cnt-recent').textContent = recent || '';
    $('#cnt-local').textContent = local || '';
    var wrap = $('#custom-playlist-buttons');
    wrap.innerHTML = '';
    player.getPlaylists().forEach(function (pl) {
      var b = document.createElement('button');
      b.className = 'nav-item';
      b.setAttribute('data-hash', '#/playlist/' + pl.id);
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16M4 12h16M4 18.5h10"/></svg><span>' + esc(pl.name) + '</span><span class="nav-count">' + pl.songs.length + '</span>';
      wrap.appendChild(b);
    });
  }

  /* ---------------- 模态框 / 菜单 ---------------- */
  function openPrompt(title, message, value, onOk) {
    var overlay = $('#overlay');
    overlay.hidden = false;
    var div = document.createElement('div');
    div.className = 'modal';
    div.innerHTML = '<h3>' + esc(title) + '</h3><p>' + esc(message) + '</p>' +
      '<input type="text" maxlength="60" value="' + esc(value) + '">' +
      '<div class="modal-actions"><button class="btn" data-modal-action="cancel">取消</button>' +
      '<button class="btn btn-primary" data-modal-action="ok">确定</button></div>';
    overlay.appendChild(div);
    var input = $('input', div);
    input.focus();
    input.select();
    div._onOk = function () { return onOk(input.value); };
  }

  function openConfirm(title, message, onOk) {
    var overlay = $('#overlay');
    overlay.hidden = false;
    var div = document.createElement('div');
    div.className = 'modal';
    div.innerHTML = '<h3>' + esc(title) + '</h3><p>' + esc(message) + '</p>' +
      '<div class="modal-actions"><button class="btn" data-modal-action="cancel">取消</button>' +
      '<button class="btn btn-primary" data-modal-action="ok">确定</button></div>';
    overlay.appendChild(div);
    div._onOk = onOk;
  }

  function handleModalAction(btn) {
    var modal = btn.closest('.modal');
    var overlay = $('#overlay');
    var action = btn.getAttribute('data-modal-action');
    if (action === 'ok' && modal && modal._onOk) {
      var result = modal._onOk();
      if (result === false) return; /* 校验失败不关闭 */
    }
    if (modal) modal.remove();
    overlay.hidden = true;
  }

  function openAddToListModal(song) {
    var overlay = $('#overlay');
    overlay.hidden = false;
    var div = document.createElement('div');
    div.className = 'modal';
    var plHtml = player.getPlaylists().map(function (pl) {
      var has = pl.songs.indexOf(song.key) >= 0;
      return '<button class="menu-item" data-add-to-list="' + esc(pl.id) + '">' +
        (has ? ICONS.heartFilled : ICONS.plus) + '<span>' + esc(pl.name) + (has ? '（已添加）' : '') + '</span></button>';
    }).join('');
    div.innerHTML = '<h3>添加到播放列表</h3><p>' + esc(song.title || song.fileName) + '</p>' +
      '<div class="submenu-scroll" style="max-height:240px;overflow-y:auto;margin-top:10px">' +
      '<button class="menu-item" data-add-new-list="1">' + ICONS.plus + '<span>新建播放列表…</span></button>' + plHtml + '</div>' +
      '<div class="modal-actions"><button class="btn" data-modal-action="cancel">关闭</button></div>';
    overlay.appendChild(div);

    $$('[data-add-to-list]', div).forEach(function (b) {
      b.addEventListener('click', function () {
        var ok = player.addToPlaylist(b.getAttribute('data-add-to-list'), song);
        refreshPlaylistNav();
        div.remove();
        overlay.hidden = true;
        showToast(ok ? '已添加到播放列表' : '已存在于该列表');
      });
    });
    $('[data-add-new-list]', div).addEventListener('click', function () {
      div.remove();
      overlay.hidden = true;
      openPrompt('新建播放列表', '输入名称后歌曲将自动加入', '', function (name) {
        var pl = player.createPlaylist(name);
        if (pl) {
          player.addToPlaylist(pl.id, song);
          refreshPlaylistNav();
          showToast('已创建并添加');
        }
      });
    });
  }

  /* ---------------- 菜单（预留扩展） ---------------- */
  function closeMenu() {
    $$('.menu').forEach(function (m) { m.remove(); });
    var ov = $('#overlay');
    if (ov && !$('.modal', ov)) ov.hidden = true;
  }

  /* ---------------- 导出 ---------------- */
  global.UI = {
    init: init,
    render: render,
    showToast: showToast,
    refreshPlaylistNav: refreshPlaylistNav,
    updateMiniPlayer: updateMiniPlayer,
    getSongByKey: getSongByKey,
    onPlayerTime: onPlayerTime,
    onPlayerState: onPlayerState,
    onPlayerLoading: onPlayerLoading,
    onPlayerLoaded: onPlayerLoaded,
    onPlayerMeta: onPlayerMeta,
    onPlayerLyrics: onPlayerLyrics,
    onPlayerVolume: onPlayerVolume,
    onPlayerMode: onPlayerMode,
    onPlayerLists: onPlayerLists,
    allSongs: allSongs,
    allAlbums: allAlbums,
    findAlbum: findAlbum,
    coverSrc: coverSrc,
    fmtTime: fmtTime
  };
})(window);
