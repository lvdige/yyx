/* ==========================================================================
 * player.js — 播放核心
 * · 每次播放都完整读取整个音频文件（fetch 全量 → Blob → ObjectURL），
 *   因此进度条可任意拖动调节，不依赖服务器 Range/多线程支持。
 * · 播放队列 / 四种播放模式 / 收藏 / 播放列表 / 最近播放 / 本地导入(IndexedDB)
 * ========================================================================== */
(function (global) {
  'use strict';

  var LS_FAV = 'amp_favorites_v1';
  var LS_PL = 'amp_playlists_v1';
  var LS_RECENT = 'amp_recent_v1';
  var LS_VOL = 'amp_volume_v1';
  var LS_MUTE = 'amp_mute_v1';
  var LS_MODE = 'amp_mode_v1';
  var LS_THEME = 'amp_theme_v1';
  var IDB_NAME = 'amp-library';
  var IDB_STORE = 'local-files';

  var MODES = ['order', 'repeat', 'repeat-one', 'shuffle'];
  var MODE_LABEL = { 'order': '顺序播放', 'repeat': '列表循环', 'repeat-one': '单曲循环', 'shuffle': '随机播放' };

  function Player() {
    this.audio = null;
    this.cb = {};
    this.queue = [];
    this.index = -1;
    this.mode = 'order';
    this.volume = 0.8;
    this.muted = false;
    this.current = null;       /* Song */
    this.loading = false;
    this.playing = false;
    this.stopped = true;
    this._blobUrl = '';
    this._curBlob = null;
    this._lyrics = null;       /* 已解析歌词 {meta, lines} */
    this.favorites = new Set();
    this.playlists = [];
    this.recent = [];
    this.localSongs = [];      /* IndexedDB 恢复的本地导入歌曲 */
    this._dbPromise = null;
  }

  Player.prototype.init = function (audioEl, callbacks) {
    var self = this;
    this.audio = audioEl;
    this.cb = callbacks || {};
    this.volume = clamp01(parseFloat(localStorage.getItem(LS_VOL)) || 0.8);
    this.muted = localStorage.getItem(LS_MUTE) === '1';
    var savedMode = localStorage.getItem(LS_MODE);
    this.mode = MODES.indexOf(savedMode) >= 0 ? savedMode : 'repeat';  /* 默认列表循环 */
    this.audio.volume = this.muted ? 0 : this.volume;

    this.loadLists();
    this._loadLocalDb().then(function (songs) {
      self.localSongs = songs;
      self._emit('localReady', songs);
    });

    this.audio.addEventListener('loadedmetadata', function () {
      if (self.current) {
        self.current.duration = self.audio.duration || 0;
        self._emit('duration', self.current.duration);
      }
      self._errRetry = 0; /* 真实加载成功，重置错误重试计数 */
    });
    this.audio.addEventListener('timeupdate', function () {
      if (!self.audio.duration) return;
      self._emit('time', self.audio.currentTime, self.audio.duration);
    });
    this.audio.addEventListener('ended', function () { self._onEnded(); });
    this.audio.addEventListener('play', function () {
      self.playing = true; self.stopped = false;
      self._emit('playstate', 'playing');
      self._pushRecent(self.current);
    });
    this.audio.addEventListener('pause', function () {
      self.playing = false;
      self._emit('playstate', 'paused');
    });
    this.audio.addEventListener('error', function () {
      self.loading = false;
      var song = self.current;
      if (!song) return;
      /* 快速切歌时，上一首的请求被中止可能误触发 error 事件：
         静默重试当前歌曲（最多 2 次），仍失败才真正报错 */
      if (!self._errRetry) self._errRetry = 0;
      if (self._errRetry < 2) {
        self._errRetry++;
        try { self.audio.removeAttribute('src'); self.audio.load(); } catch (e) { /* 忽略 */ }
        setTimeout(function () {
          if (self.current !== song) return; /* 用户已切走则放弃重试 */
          self.loadSong(song);
        }, 120);
        return;
      }
      self._errRetry = 0;
      self._emit('error', '播放出错，文件可能已损坏或无法访问');
    });
    return this;
  };

  /* ---------------- 加载并播放 ---------------- */
  Player.prototype.loadSong = async function (song, queue, startIndex) {
    var self = this;
    if (!song) return;
    if (Array.isArray(queue) && queue.length) {
      this.queue = queue.slice();
      this.index = Math.max(0, startIndex != null ? startIndex : queue.indexOf(song));
    } else {
      /* 保持当前队列，定位 index */
      var idx = this.queue.indexOf(song);
      if (idx < 0) { this.queue = [song]; this.index = 0; }
      else this.index = idx;
    }
    this.current = song;
    this._lyrics = null;
    this.loading = true;
    this.stopped = false;
    try { this._emit('loading', song); } catch (e) { /* UI 异常不阻断播放 */ }

    try {
      var url = '';
      var buf = null;

      if (song._blobUrl) {
        url = song._blobUrl;
      } else if (song.file instanceof File || song.file instanceof Blob) {
        url = URL.createObjectURL(song.file);
        song._blobUrl = url;
        buf = await song.file.arrayBuffer();
      } else if (location.protocol === 'file:' || location.protocol === 'about:') {
        /* file:// 直接打开：浏览器禁止 fetch 本地文件，把相对路径转成
           绝对 file:// 地址交给 <audio> 直接播放（本地文件进度条可任意拖动） */
        url = toFileUrl(song.url);
        song._blobUrl = url;
      } else {
        var resp = await fetch(song.url);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var blob = await resp.blob();
        url = URL.createObjectURL(blob);
        song._blobUrl = url;
        buf = await blob.arrayBuffer();
      }

      if (this.current !== song) return; /* 播放请求已被更新的歌曲取代 */

      /* 有标签需求时解析标签（列表已显示标签的跳过） */
      if (buf && (song.needTag || !song.title || !song.artist)) {
        try {
          var tag = ID3.parse(buf, song.fileName);
          if (tag) {
            var changed = false;
            if (tag.title && !song.title) { song.title = tag.title; changed = true; }
            if (tag.artist) { song.artist = tag.artist; changed = true; }
            if (tag.album && !song.album) { song.album = tag.album; changed = true; }
            if (tag.track && !song.track) { song.track = tag.track; changed = true; }
            if (tag.lyrics && !song.tagLyrics) { song.tagLyrics = tag.lyrics; changed = true; }
            if (tag.cover && !song.coverUrl && !song.coverDataUrl) { song.coverDataUrl = tag.cover; changed = true; }
            song.needTag = false;
            if (changed) {
              this._emit('meta', song);
              if (tag.lyrics) this._loadLyrics();
            }
          }
        } catch (e) { /* 标签解析失败不影响播放 */ }
      }

      var oldUrl = this._blobUrl;
      this._blobUrl = url;
      /* 只撤销确实不再使用的 blob: 地址：
         若旧地址仍是队列中某首歌缓存的 _blobUrl（切回上一首还要复用），则不撤销 */
      if (oldUrl && oldUrl !== url && oldUrl.indexOf('blob:') === 0 &&
          !this.queue.some(function (q) { return q._blobUrl === oldUrl; })) {
        URL.revokeObjectURL(oldUrl);
      }

      this.audio.src = url;
      this.loading = false;
      try { this._emit('loaded', song); } catch (e) { /* UI 异常不阻断播放 */ }
      try { await this.audio.play(); } catch (e) { /* 自动播放被拒则保持暂停 */ }
      if (!this._lyrics) this._loadLyrics();
      this._pushRecent(song);
    } catch (err) {
      this.loading = false;
      this._emit('error', '无法读取文件：' + (err && err.message ? err.message : '未知错误'));
    }
  };

  /* ---------------- 歌词加载 ---------------- */
  Player.prototype._loadLyrics = function () {
    var self = this;
    var song = this.current;
    if (!song) return;
    this._lyrics = null;
    var src = null;

    if (song.lrcFile) {
      src = song.lrcFile.text().then(function (t) { return t; });
    } else if (song.lrcText) {
      src = Promise.resolve(song.lrcText);
    } else if (song.lrcUrl && !(location.protocol === 'file:' || location.protocol === 'about:')) {
      /* 仅 http(s) 模式下动态拉取 lrc 文件（file:// 下 fetch 被浏览器禁止） */
      src = fetch(song.lrcUrl).then(function (r) {
        if (!r.ok) return null;
        return r.text();
      }).catch(function () { return null; });
    } else if (song.tagLyrics) {
      src = Promise.resolve(song.tagLyrics);
    } else {
      src = Promise.resolve(null);
    }

    src.then(function (text) {
      if (self.current !== song) return;
      if (text && text.trim()) {
        self._lyrics = Lyrics.parse(text);
        self._emit('lyrics', self._lyrics);
      } else {
        self._lyrics = null;
        self._emit('lyrics', null);
      }
    }).catch(function () {
      self._lyrics = null;
      self._emit('lyrics', null);
    });
  };

  /* ---------------- 控制 ---------------- */
  Player.prototype.toggle = function () {
    if (!this.current) return;
    if (this.loading) return;
    if (this.audio.paused) {
      this.audio.play().catch(function () {});
    } else {
      this.audio.pause();
    }
  };

  Player.prototype.stop = function () {
    if (!this.current) return;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.stopped = true;
    this.playing = false;
    this._emit('playstate', 'stopped');
    this._emit('time', 0, this.audio.duration || (this.current ? this.current.duration : 0));
  };

  Player.prototype.seek = function (t) {
    if (!this.audio || !this.current) return;
    if (!isFinite(t)) return;
    var dur = this.audio.duration || this.current.duration || 0;
    this.audio.currentTime = clamp(t, 0, dur || t);
    this._emit('time', this.audio.currentTime, dur);
  };

  Player.prototype.next = function () {
    if (!this.queue.length) return;
    var nextIdx = this._nextIndex(1);
    if (nextIdx < 0) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.playing = false;
      this.stopped = true;
      this._emit('playstate', 'stopped');
      this._emit('time', 0, this.audio.duration || (this.current ? this.current.duration : 0));
      return;
    }
    this.loadSong(this.queue[nextIdx]);
  };

  Player.prototype.prev = function () {
    if (!this.queue.length) return;
    /* 播放超过 3 秒时，上一首回到本曲开头 */
    if (this.audio && this.audio.currentTime > 3 && !this.stopped) {
      this.seek(0);
      return;
    }
    var prevIdx = this._nextIndex(-1);
    if (prevIdx < 0) return;
    this.loadSong(this.queue[prevIdx]);
  };

  Player.prototype._nextIndex = function (dir) {
    var n = this.queue.length;
    if (!n) return -1;
    if (this.mode === 'shuffle') {
      if (n === 1) return 0;
      var cands = [];
      for (var i = 0; i < n; i++) if (i !== this.index) cands.push(i);
      return cands[Math.floor(Math.random() * cands.length)];
    }
    var idx = this.index + dir;
    if (this.mode === 'repeat') {
      idx = (idx + n) % n;
      return idx;
    }
    if (idx < 0) return n - 1;               /* 顺序模式：回卷到末尾 */
    if (idx >= n) return -1;                 /* 顺序模式：末尾结束 */
    return idx;
  };

  Player.prototype._onEnded = function () {
    if (this.mode === 'repeat-one') {
      this.audio.currentTime = 0;
      this.audio.play().catch(function () {});
      return;
    }
    this.next();
  };

  /* ---------------- 音量 ---------------- */
  Player.prototype.setVolume = function (v) {
    this.volume = clamp01(v);
    this.muted = false;
    this.audio.volume = this.volume;
    this.audio.muted = false;
    localStorage.setItem(LS_VOL, String(this.volume));
    this._emit('volume', this.volume, this.muted);
  };
  Player.prototype.toggleMute = function () {
    this.muted = !this.muted;
    this.audio.volume = this.muted ? 0 : this.volume;
    this.audio.muted = this.muted;
    localStorage.setItem(LS_MUTE, this.muted ? '1' : '0');
    this._emit('volume', this.volume, this.muted);
  };
  Player.prototype.cycleMode = function () {
    var i = MODES.indexOf(this.mode);
    this.mode = MODES[(i + 1) % MODES.length];
    localStorage.setItem(LS_MODE, this.mode);
    this._emit('mode', this.mode, MODE_LABEL[this.mode]);
  };
  Player.prototype.setMode = function (m) {
    if (MODES.indexOf(m) < 0) return;
    this.mode = m;
    localStorage.setItem(LS_MODE, m);
    this._emit('mode', m, MODE_LABEL[m]);
  };

  /* ---------------- 收藏 ---------------- */
  Player.prototype.isFavorite = function (key) {
    return this.favorites.has(key);
  };
  Player.prototype.toggleFavorite = function (song) {
    var key = song ? song.key : null;
    if (!key) return false;
    if (this.favorites.has(key)) this.favorites.delete(key);
    else this.favorites.add(key);
    this._saveFavorites();
    this._emit('lists');
    return this.favorites.has(key);
  };

  /* ---------------- 播放列表 ---------------- */
  Player.prototype.getPlaylists = function () { return this.playlists; };
  Player.prototype.createPlaylist = function (name) {
    name = (name || '').trim();
    if (!name) return null;
    var id = 'pl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var pl = { id: id, name: name, songs: [] };
    this.playlists.push(pl);
    this._savePlaylists();
    this._emit('lists');
    return pl;
  };
  Player.prototype.renamePlaylist = function (id, name) {
    var pl = this._findPlaylist(id);
    if (!pl) return false;
    pl.name = (name || '').trim() || pl.name;
    this._savePlaylists();
    this._emit('lists');
    return true;
  };
  Player.prototype.deletePlaylist = function (id) {
    this.playlists = this.playlists.filter(function (p) { return p.id !== id; });
    this._savePlaylists();
    this._emit('lists');
  };
  Player.prototype.addToPlaylist = function (id, song) {
    var pl = this._findPlaylist(id);
    if (!pl || !song) return false;
    if (pl.songs.indexOf(song.key) < 0) pl.songs.push(song.key);
    this._savePlaylists();
    this._emit('lists');
    return true;
  };
  Player.prototype.removeFromPlaylist = function (id, key) {
    var pl = this._findPlaylist(id);
    if (!pl) return false;
    pl.songs = pl.songs.filter(function (k) { return k !== key; });
    this._savePlaylists();
    this._emit('lists');
    return true;
  };
  Player.prototype._findPlaylist = function (id) {
    for (var i = 0; i < this.playlists.length; i++) {
      if (this.playlists[i].id === id) return this.playlists[i];
    }
    return null;
  };

  /* ---------------- 最近播放 ---------------- */
  Player.prototype.getRecent = function () { return this.recent; };
  Player.prototype._pushRecent = function (song) {
    if (!song) return;
    var arr = this.recent.filter(function (k) { return k !== song.key; });
    arr.unshift(song.key);
    if (arr.length > 50) arr.length = 50;
    this.recent = arr;
    localStorage.setItem(LS_RECENT, JSON.stringify(arr));
    this._emit('lists');
  };

  /* ---------------- 本地导入 (IndexedDB) ---------------- */
  Player.prototype.getLocalSongs = function () { return this.localSongs; };

  Player.prototype.importFiles = async function (fileList) {
    var self = this;
    var songs = Scanner.scanImportedFiles(fileList);
    if (!songs.length) return [];
    var db = await this._openDb();
    var tx = db.transaction(IDB_STORE, 'readwrite');
    var store = tx.objectStore(IDB_STORE);
    songs.forEach(function (s) {
      store.put({ key: s.key, file: s.file, title: s.title, artist: s.artist, album: s.album, addedAt: Date.now() });
    });
    await new Promise(function (resolve) {
      tx.oncomplete = resolve;
      tx.onerror = resolve;
      tx.onabort = resolve;
    });
    this.localSongs = this.localSongs.concat(songs);
    this._emit('localReady', this.localSongs);
    this._emit('lists');
    return songs;
  };

  Player.prototype.removeLocalSong = async function (song) {
    var self = this;
    this.localSongs = this.localSongs.filter(function (s) { return s.key !== song.key; });
    var db = await this._openDb();
    return new Promise(function (resolve) {
      var tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(song.key);
      tx.oncomplete = function () { self._emit('localReady', self.localSongs); self._emit('lists'); resolve(); };
      tx.onerror = function () { resolve(); };
    });
  };

  Player.prototype._loadLocalDb = async function () {
    var self = this;
    var db = await this._openDb();
    return new Promise(function (resolve) {
      var tx = db.transaction(IDB_STORE, 'readonly');
      var req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = function () {
        var rows = req.result || [];
        var songs = rows.map(function (r) {
          var base = (r.file && r.file.name || '').replace(/\.[^.]+$/, '');
          return {
            key: r.key, id: r.file.name, fileName: r.file.name, baseName: base,
            albumId: 'local', album: '本地导入',
            artist: r.artist || '', title: r.title || base, track: '',
            url: '', file: r.file, isLocal: true,
            coverUrl: '', coverFile: null, coverDataUrl: '',
            lrcUrl: '', lrcFile: null, tagLyrics: '', hasLrc: false,
            duration: r.duration || 0, needTag: true
          };
        });
        resolve(songs);
      };
      req.onerror = function () { resolve([]); };
    });
  };

  Player.prototype._openDb = function () {
    var self = this;
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return this._dbPromise;
  };

  /* ---------------- 列表存储 ---------------- */
  Player.prototype.loadLists = function () {
    try {
      var f = JSON.parse(localStorage.getItem(LS_FAV) || '[]');
      this.favorites = new Set(Array.isArray(f) ? f : []);
    } catch (e) { this.favorites = new Set(); }
    try {
      var p = JSON.parse(localStorage.getItem(LS_PL) || '[]');
      this.playlists = Array.isArray(p) ? p : [];
    } catch (e) { this.playlists = []; }
    try {
      var r = JSON.parse(localStorage.getItem(LS_RECENT) || '[]');
      this.recent = Array.isArray(r) ? r : [];
    } catch (e) { this.recent = []; }
  };
  Player.prototype._saveFavorites = function () {
    localStorage.setItem(LS_FAV, JSON.stringify(Array.from(this.favorites)));
  };
  Player.prototype._savePlaylists = function () {
    localStorage.setItem(LS_PL, JSON.stringify(this.playlists));
  };

  /* ---------------- 事件 ---------------- */
  Player.prototype._emit = function (name) {
    if (this.cb[name]) {
      try { this.cb[name].apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { /* 回调异常不影响播放 */ }
    }
  };

  /* ---------------- 工具 ---------------- */
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* file:// 模式下把相对路径（Music/xx/01.mp3）转成绝对 file:// 地址。
     注意 song.url 已经过 encodeURIComponent 逐段编码，这里不能再编码（会双重编码）。 */
  function toFileUrl(relPath) {
    try {
      var href = location.href;
      var base = href.slice(0, href.lastIndexOf('/') + 1);
      return base + String(relPath);
    } catch (e) {
      return relPath;
    }
  }

  global.Player = Player;
})(window);
