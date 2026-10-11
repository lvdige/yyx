/* ==========================================================================
 * scanner.js — 音乐库扫描器
 * 三级自动扫描通道（依次尝试）：
 *   1. scan.php          服务器支持 PHP 时自动扫描 Music 目录（含标签）
 *   2. Music/music.json  静态清单（用 make_music_json.py 或 scan.php 生成）
 *   3. 选择文件夹        浏览器 File API 扫描用户选择的 Music 文件夹
 * 统一归一化为 Library：{ source, albums, songs, byKey }
 * ========================================================================== */
(function (global) {
  'use strict';

  var COVER_NAMES = ['cover.png', 'cover.jpg', 'cover.jpeg', 'cover.bmp',
                     'cover.PNG', 'cover.JPG', 'cover.JPEG', 'cover.BMP'];

  /* 把相对路径安全转成 URL（处理中文、空格、#、? 等） */
  function encodePath(path) {
    if (!path) return '';
    return path.split('/').map(function (seg) {
      return encodeURIComponent(seg).replace(/%2F/gi, '/');
    }).join('/');
  }

  /* ---------------- 通道 1 & 2：JSON 归一化 ---------------- */
  function normalizeJson(raw, source) {
    var albums = [];
    var songs = [];
    var byKey = new Map();
    var list = (raw && Array.isArray(raw.albums)) ? raw.albums : [];

    list.forEach(function (alb, ai) {
      var albumId = 'a' + ai;
      var name = clean(alb.name) || ('专辑 ' + (ai + 1));
      var artist = clean(alb.artist) || '';
      var albumSongs = (alb.songs && alb.songs.length) ? alb.songs : [];
      var entry = {
        id: albumId,
        name: name,
        artist: artist,
        coverUrl: alb.cover ? encodePath(alb.cover) : '',
        coverDataUrl: alb.coverData || '',
        songs: []
      };

      albumSongs.forEach(function (s, si) {
        var fileName = (s.file || '').split('/').pop();
        var base = fileName.replace(/\.[^.]+$/, '');
        var dir = (s.file || '').slice(0, -(fileName.length));
        var song = {
          key: albumId + '::' + (s.id || fileName),
          id: String(s.id != null ? s.id : si),
          fileName: fileName,
          baseName: base,
          albumId: albumId,
          album: clean(s.album) || name,
          artist: clean(s.artist) || artist || '',
          title: clean(s.title) || '',
          track: s.track != null ? s.track : '',
          url: encodePath(s.file),
          file: null,
          isLocal: false,
          coverUrl: s.coverFile ? encodePath(s.coverFile) : entry.coverUrl,
          coverFile: null,
          coverDataUrl: s.cover || entry.coverDataUrl,
          lrcUrl: s.hasLrc ? encodePath(dir + base + '.lrc') : '',
          lrcFile: null,
          lrcText: (s.lrcText && String(s.lrcText).trim()) ? String(s.lrcText).trim() : '',
          tagLyrics: (s.lyrics && String(s.lyrics).trim()) ? String(s.lyrics).trim() : '',
          hasLrc: !!s.hasLrc,
          duration: Number(s.duration) > 0 ? Number(s.duration) : 0,
          needTag: !clean(s.title) && !clean(s.artist)   /* 播放时再解析标签 */
        };
        song.title = song.title || song.baseName;
        entry.songs.push(song);
        songs.push(song);
        byKey.set(song.key, song);
      });

      if (entry.songs.length) {
        entry.songs.sort(compareSongs);
        albums.push(entry);
      }
    });

    return buildLibrary(albums, songs, byKey, source);
  }

  /* ---------------- 通道 3：文件夹扫描 ---------------- */
  function scanFolderFiles(fileList) {
    var files = [];
    for (var i = 0; i < fileList.length; i++) files.push(fileList[i]);

    var dirMap = {};   /* dirName -> { files: [], cover: File|null } */
    var rootFiles = [];

    files.forEach(function (f) {
      var rel = f.webkitRelativePath || '';
      var parts = rel.split('/');
      if (parts.length >= 2 && parts[0]) {
        var dirName = parts[0];
        var fileName = parts[parts.length - 1];
        if (!dirMap[dirName]) dirMap[dirName] = { files: [], cover: null };
        if (isCoverName(fileName)) {
          if (!dirMap[dirName].cover) dirMap[dirName].cover = f;
          return;
        }
        if (ID3.isAudioName(fileName) || isLrcName(fileName)) {
          dirMap[dirName].files.push(f);
        }
      } else {
        if (ID3.isAudioName(f.name)) rootFiles.push(f);
      }
    });

    var albums = [];
    var songs = [];
    var byKey = new Map();
    var ai = 0;

    Object.keys(dirMap).forEach(function (dirName) {
      var group = dirMap[dirName];
      var audioFiles = group.files.filter(function (f) { return ID3.isAudioName(f.name); });
      if (!audioFiles.length) return;
      var albumId = 'a' + ai++;
      var entry = {
        id: albumId,
        name: dirName,
        artist: '',
        coverUrl: '',
        coverFile: group.cover || null,
        coverDataUrl: '',
        songs: []
      };
      audioFiles.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }); });
      audioFiles.forEach(function (f) {
        var base = f.name.replace(/\.[^.]+$/, '');
        var lrcFile = group.files.find(function (x) {
          return x !== f && isLrcName(x.name) &&
            x.name.replace(/\.[^.]+$/, '').toLowerCase() === base.toLowerCase();
        }) || null;
        var song = {
          key: albumId + '::' + f.name,
          id: f.name,
          fileName: f.name,
          baseName: base,
          albumId: albumId,
          album: dirName,
          artist: '',
          title: base,
          track: '',
          url: '',
          file: f,
          isLocal: true,
          coverUrl: '',
          coverFile: entry.coverFile,
          coverDataUrl: '',
          lrcUrl: '',
          lrcFile: lrcFile,
          lrcText: '',
          tagLyrics: '',
          hasLrc: !!lrcFile,
          duration: 0,
          needTag: true
        };
        entry.songs.push(song);
        songs.push(song);
        byKey.set(song.key, song);
      });
      albums.push(entry);
    });

    if (rootFiles.length) {
      var rootAlbum = {
        id: 'a' + ai,
        name: '未分类',
        artist: '',
        coverUrl: '',
        coverFile: null,
        coverDataUrl: '',
        songs: []
      };
      rootFiles.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hans-CN', { numeric: true }); });
      rootFiles.forEach(function (f) {
        var base = f.name.replace(/\.[^.]+$/, '');
        var song = {
          key: rootAlbum.id + '::' + f.name,
          id: f.name,
          fileName: f.name,
          baseName: base,
          albumId: rootAlbum.id,
          album: '未分类',
          artist: '',
          title: base,
          track: '',
          url: '',
          file: f,
          isLocal: true,
          coverUrl: '',
          coverFile: null,
          coverDataUrl: '',
          lrcUrl: '',
          lrcFile: null,
          lrcText: '',
          tagLyrics: '',
          hasLrc: false,
          duration: 0,
          needTag: true
        };
        rootAlbum.songs.push(song);
        songs.push(song);
        byKey.set(song.key, song);
      });
      albums.push(rootAlbum);
    }

    albums.forEach(function (a) { a.songs.sort(compareSongs); });
    return buildLibrary(albums, songs, byKey, 'folder');
  }

  /* ---------------- 本地文件导入 ---------------- */
  function scanImportedFiles(fileList) {
    var songs = [];
    for (var i = 0; i < fileList.length; i++) {
      var f = fileList[i];
      if (!ID3.isAudioName(f.name)) continue;
      var base = f.name.replace(/\.[^.]+$/, '');
      songs.push({
        key: 'local::' + f.name + '::' + (f.lastModified || i),
        id: f.name,
        fileName: f.name,
        baseName: base,
        albumId: 'local',
        album: '本地导入',
        artist: '',
        title: base,
        track: '',
        url: '',
        file: f,
        isLocal: true,
        coverUrl: '',
        coverFile: null,
        coverDataUrl: '',
        lrcUrl: '',
        lrcFile: null,
        lrcText: '',
        tagLyrics: '',
        hasLrc: false,
        duration: 0,
        needTag: true
      });
    }
    return songs;
  }

  /* ---------------- 工具 ---------------- */
  function buildLibrary(albums, songs, byKey, source) {
    var lib = { source: source, albums: albums, songs: songs, byKey: byKey };
    if (byKey.size === 0) lib.empty = true;
    return lib;
  }

  function compareSongs(a, b) {
    var ta = parseTrack(a.track), tb = parseTrack(b.track);
    if (ta != null && tb != null && ta !== tb) return ta - tb;
    if (ta != null && tb == null) return -1;
    if (ta == null && tb != null) return 1;
    return String(a.fileName || a.baseName).localeCompare(String(b.fileName || b.baseName), 'zh-Hans-CN', { numeric: true });
  }
  function parseTrack(t) {
    if (t == null || t === '') return null;
    var m = String(t).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }
  function isCoverName(name) {
    return COVER_NAMES.indexOf(name) >= 0;
  }
  function isLrcName(name) {
    return /\.lrc$/i.test(name);
  }
  function clean(s) {
    if (s == null) return '';
    return String(s).replace(/\u0000/g, '').trim();
  }

  /* ---------------- 入口：加载音乐库 ---------------- */
  var _cacheBust = Date.now();

  /**
   * 加载音乐库。返回 Promise<Library|null>
   * 通道优先级：
   *   http(s) 模式：scan.php（每次访问自动扫描）→ Music/music.json → Music/music.js
   *   file://  模式：Music/music.js（<script> 引入，无需服务器）→ 用户选择文件夹
   */
  function isFileProtocol() {
    return location.protocol === 'file:' || location.protocol === 'about:';
  }

  function usableLib(lib) {
    return lib && lib.songs && lib.songs.length ? lib : null;
  }

  async function loadLibrary() {
    var fileMode = isFileProtocol();

    if (!fileMode) {
      /* 通道 1：scan.php */
      try {
        var r1 = await fetch('scan.php?_=' + _cacheBust, { method: 'GET', cache: 'no-store' });
        if (r1.ok) {
          var j1 = await r1.json();
          if (j1 && Array.isArray(j1.albums)) {
            var lib1 = usableLib(normalizeJson(j1, 'php'));
            if (lib1) return lib1;
          }
        }
      } catch (e) { /* 忽略，走下一通道 */ }

      /* 通道 2：Music/music.json */
      try {
        var r2 = await fetch('Music/music.json?_=' + _cacheBust, { method: 'GET', cache: 'no-store' });
        if (r2.ok) {
          var j2 = await r2.json();
          if (j2 && Array.isArray(j2.albums)) {
            var lib2 = usableLib(normalizeJson(j2, 'json'));
            if (lib2) return lib2;
          }
        }
      } catch (e) { /* 忽略 */ }
    }

    /* 通道 3：Music/music.js（<script> 引入的全局变量，file:// 直接打开时自动加载） */
    if (window.MUSIC_LIBRARY && Array.isArray(window.MUSIC_LIBRARY.albums)) {
      var lib3 = usableLib(normalizeJson(window.MUSIC_LIBRARY, 'js'));
      if (lib3) return lib3;
    }

    /* 通道 4：需要用户选择文件夹 */
    return null;
  }

  global.Scanner = {
    loadLibrary: loadLibrary,
    normalizeJson: normalizeJson,
    scanFolderFiles: scanFolderFiles,
    scanImportedFiles: scanImportedFiles,
    encodePath: encodePath,
    isCoverName: isCoverName,
    isLrcName: isLrcName,
    isFileProtocol: isFileProtocol
  };
})(window);
