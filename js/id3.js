/* ==========================================================================
 * id3.js — 音频标签解析器（纯前端，无外部依赖）
 * 支持：MP3(ID3v2.2/2.3/2.4 + ID3v1)、FLAC(Vorbis Comment + Picture)、
 *       M4A/MP4(ilst atoms)、OGG(Vorbis/Opus Comments)、WAV(INFO)
 * 解析：标题 / 艺术家 / 专辑 / 音轨号 / 内嵌封面(APIC) / 内嵌歌词(USLT)
 * ========================================================================== */
(function (global) {
  'use strict';

  var AUDIO_EXTS = ['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.ape', '.wma', '.aiff', '.aif'];

  function isAudioName(name) {
    var n = String(name || '').toLowerCase();
    for (var i = 0; i < AUDIO_EXTS.length; i++) {
      if (n.endsWith(AUDIO_EXTS[i])) return true;
    }
    return false;
  }

  function bytesToStr(buf, start, len, enc) {
    try {
      var slice = buf.slice(start, start + len);
      if (enc === 'utf16le') {
        var s = '';
        for (var i = 0; i + 1 < slice.length; i += 2) {
          s += String.fromCharCode(slice[i] | (slice[i + 1] << 8));
        }
        return s;
      }
      if (enc === 'utf16be') {
        var s2 = '';
        for (var j = 0; j + 1 < slice.length; j += 2) {
          s2 += String.fromCharCode((slice[j] << 8) | slice[j + 1]);
        }
        return s2;
      }
      if (enc === 'latin1') {
        var s3 = '';
        for (var k = 0; k < slice.length; k++) s3 += String.fromCharCode(slice[k]);
        return s3;
      }
      if (enc === 'gbk') {
        try { return new TextDecoder('gbk', { fatal: true }).decode(slice); } catch (e) { return null; }
      }
      if (enc === 'utf8') {
        try { return new TextDecoder('utf-8', { fatal: true }).decode(slice); } catch (e) { return null; }
      }
    } catch (e) { return null; }
    return null;
  }

  /* 把可能是 GBK/ISO-8859-1 的字节转为可读字符串：优先 UTF-8 严格解码，失败回退 GBK */
  function smartDecode(buf, start, len, enc) {
    if (enc === 'utf16le') return bytesToStr(buf, start, len, 'utf16le');
    if (enc === 'utf16be') return bytesToStr(buf, start, len, 'utf16be');
    if (enc === 'utf8') {
      var u = bytesToStr(buf, start, len, 'utf8');
      return u != null ? u : bytesToStr(buf, start, len, 'gbk') || bytesToStr(buf, start, len, 'latin1') || '';
    }
    /* 编码 0：ID3 规范为 ISO-8859-1，但中文文件常是 GBK */
    var latin = bytesToStr(buf, start, len, 'latin1');
    if (latin == null) return '';
    var hasHigh = false;
    for (var i = 0; i < latin.length; i++) {
      if (latin.charCodeAt(i) > 127) { hasHigh = true; break; }
    }
    if (!hasHigh) return latin;
    var g = bytesToStr(buf, start, len, 'gbk');
    if (g != null) return g;
    return latin;
  }

  function readSyncsafe(buf, offset) {
    return ((buf[offset] & 0x7f) << 21) | ((buf[offset + 1] & 0x7f) << 14) |
           ((buf[offset + 2] & 0x7f) << 7) | (buf[offset + 3] & 0x7f);
  }
  function readU32(buf, offset) {
    return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
  }

  function cleanText(s) {
    if (s == null) return '';
    return String(s).replace(/\u0000/g, '').replace(/[\uFEFF]/g, '').trim();
  }

  /* ---------------- MP3 ---------------- */
  function parseMp3(buf) {
    var tag = null;
    if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
      tag = parseId3v2(buf);
    }
    if (!tag) tag = {};
    var v1 = parseId3v1(buf);
    if (v1) {
      if (!tag.title) tag.title = v1.title;
      if (!tag.artist) tag.artist = v1.artist;
      if (!tag.album) tag.album = v1.album;
      if (!tag.track) tag.track = v1.track;
    }
    return tag;
  }

  function parseId3v2(buf) {
    var ver = buf[3], rev = buf[4];
    var size = readSyncsafe(buf, 6);
    var end = Math.min(10 + size, buf.length);
    var frames = {};
    var pos = 10;
    var frameIdLen = ver === 2 ? 3 : 4;
    while (pos + frameIdLen + 2 <= end) {
      var id = '';
      for (var i = 0; i < frameIdLen; i++) id += String.fromCharCode(buf[pos + i]);
      if (id.charCodeAt(0) === 0) break;
      var fsize, flags;
      if (ver === 2) {
        fsize = ((buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5]);
        pos += 6;
      } else if (ver === 3) {
        fsize = readU32(buf, pos + 4);
        flags = readU32(buf, pos + 8);
        pos += 10;
      } else {
        fsize = readSyncsafe(buf, pos + 4);
        flags = readU32(buf, pos + 8);
        pos += 10;
      }
      if (fsize <= 0 || pos + fsize > end) { pos += Math.max(fsize, 0); continue; }
      var body = pos;
      var frameEnd = pos + fsize;

      /* 压缩帧（v2.3 flags bit 6）不解析文本帧，跳过 */
      if (flags !== undefined && (flags & 0x80)) { pos = frameEnd; continue; }

      var t = id.charAt(0);
      if (t === 'T' && id !== 'TXXX') {
        var enc = buf[body];
        var encName = enc === 1 ? 'utf16le' : enc === 2 ? 'utf16be' : enc === 3 ? 'utf8' : 'latin';
        /* v2.2: TT2/TP1/TAL/TRK；v2.3+: TIT2/TPE1/TALB/TRCK */
        var val = smartDecode(buf, body + 1, frameEnd - body - 1, encName);
        if (val) {
          if (ver === 2) {
            if (id === 'TT2') frames.title = val;
            else if (id === 'TP1') frames.artist = val;
            else if (id === 'TAL') frames.album = val;
            else if (id === 'TRK') frames.track = val;
          } else {
            if (id === 'TIT2') frames.title = val;
            else if (id === 'TPE1') frames.artist = val;
            else if (id === 'TALB') frames.album = val;
            else if (id === 'TRCK') frames.track = val;
          }
        }
      } else if (id === 'USLT' || id === 'ULT') {
        var e2 = buf[body];
        var enc2 = e2 === 1 ? 'utf16le' : e2 === 2 ? 'utf16be' : e2 === 3 ? 'utf8' : 'latin';
        var lang = body + 1;
        var descStart = lang + 3;
        var descEnd = descStart;
        while (descEnd < frameEnd && buf[descEnd] !== 0) descEnd++;
        var textStart = Math.min(descEnd + 1, frameEnd);
        var lyr = smartDecode(buf, textStart, frameEnd - textStart, enc2);
        if (lyr && !frames.lyrics) frames.lyrics = lyr;
      } else if (id === 'APIC' || id === 'PIC') {
        var cover = parseApic(buf, body, frameEnd, ver);
        if (cover) frames.cover = cover;
      }
      pos = frameEnd;
    }
    var out = {};
    if (frames.title) out.title = cleanText(frames.title);
    if (frames.artist) out.artist = cleanText(frames.artist);
    if (frames.album) out.album = cleanText(frames.album);
    if (frames.track) out.track = cleanText(frames.track);
    if (frames.lyrics) out.lyrics = cleanText(frames.lyrics);
    if (frames.cover) out.cover = frames.cover;
    return out;
  }

  function parseApic(buf, body, frameEnd, ver) {
    try {
      var enc = buf[body];
      var pos = body + 1;
      var mime;
      if (ver === 2) {
        mime = '';
        for (var i = 0; i < 3; i++) mime += String.fromCharCode(buf[pos + i]);
        if (mime === 'JPG') mime = 'image/jpeg';
        else if (mime === 'PNG') mime = 'image/png';
        else return null;
        pos += 3;
      } else {
        var mimeStart = pos;
        while (pos < frameEnd && buf[pos] !== 0) pos++;
        mime = bytesToStr(buf, mimeStart, pos - mimeStart, 'latin1');
        pos++; /* 类型字节 */
      }
      pos++; /* picture type */
      while (pos < frameEnd && buf[pos] !== 0) pos++; /* description */
      pos++;
      if (pos >= frameEnd) return null;
      var mimeType = /^image\/(jpeg|jpg|png|bmp|gif|webp)$/i.test(mime) ? mime.toLowerCase() : null;
      if (!mimeType) {
        if (mime.indexOf('jpeg') >= 0 || mime.indexOf('jpg') >= 0) mimeType = 'image/jpeg';
        else if (mime.indexOf('png') >= 0) mimeType = 'image/png';
        else if (mime.indexOf('bmp') >= 0) mimeType = 'image/bmp';
        else mimeType = 'image/jpeg';
      }
      var data = buf.slice(pos, frameEnd);
      if (!data || data.length < 20) return null;
      return 'data:' + mimeType + ';base64,' + arrayBufferToBase64(data);
    } catch (e) { return null; }
  }

  function parseId3v1(buf) {
    if (buf.length < 128) return null;
    var off = buf.length - 128;
    if (buf[off] !== 0x54 || buf[off + 1] !== 0x41 || buf[off + 2] !== 0x47) return null; /* TAG */
    var title = smartDecode(buf, off + 3, 30, 'latin');
    var artist = smartDecode(buf, off + 33, 30, 'latin');
    var album = smartDecode(buf, off + 63, 30, 'latin');
    var track = '';
    if (buf[off + 125] === 0 && buf[off + 126] !== 0) track = String(buf[off + 126]);
    return {
      title: cleanText(title),
      artist: cleanText(artist),
      album: cleanText(album),
      track: track
    };
  }

  /* ---------------- FLAC ---------------- */
  function parseFlac(buf) {
    var out = {};
    var pos = 4; /* fLaC */
    var last = false;
    while (!last && pos + 4 <= buf.length) {
      var header = readU32(buf, pos);
      last = (header & 0x80000000) !== 0;
      var type = (header >> 24) & 0x7f;
      var len = header & 0xffffff;
      pos += 4;
      if (pos + len > buf.length) break;
      if (type === 4) { /* VORBIS_COMMENT */
        var p = pos;
        var vendorLen = readU32(buf, p); p += 4;
        p += vendorLen;
        var count = readU32(buf, p); p += 4;
        for (var i = 0; i < count && p + 4 <= pos + len; i++) {
          var clen = readU32(buf, p); p += 4;
          if (p + clen > pos + len) break;
          var kv = bytesToStr(buf, p, clen, 'utf8') || bytesToStr(buf, p, clen, 'latin1') || '';
          p += clen;
          var eq = kv.indexOf('=');
          if (eq > 0) {
            var key = kv.slice(0, eq).toUpperCase();
            var value = kv.slice(eq + 1);
            if (key === 'TITLE') out.title = value;
            else if (key === 'ARTIST') out.artist = value;
            else if (key === 'ALBUM') out.album = value;
            else if (key === 'TRACKNUMBER') out.track = value;
            else if (key === 'LYRICS' && !out.lyrics) out.lyrics = value;
          }
        }
      } else if (type === 6) { /* PICTURE */
        var pp = pos;
        pp += 4; /* picture type */
        var mimeLen = readU32(buf, pp); pp += 4;
        var mimeStr = bytesToStr(buf, pp, mimeLen, 'latin1') || 'image/jpeg';
        pp += mimeLen;
        var descLen = readU32(buf, pp); pp += 4;
        pp += descLen;
        pp += 16; /* width, height, depth, colors */
        var dataLen = readU32(buf, pp); pp += 4;
        if (pp + dataLen <= pos + len && dataLen > 20 && !out.cover) {
          var dt = buf.slice(pp, pp + dataLen);
          out.cover = 'data:' + mimeStr + ';base64,' + arrayBufferToBase64(dt);
        }
      }
      pos += len;
    }
    return Object.keys(out).length ? out : null;
  }

  /* ---------------- M4A / MP4 ---------------- */
  function parseMp4(buf) {
    var out = {};
    function walk(start, end, depth) {
      if (depth > 8) return;
      var pos = start;
      while (pos + 8 <= end) {
        var size = readU32(buf, pos);
        var type = bytesToStr(buf, pos + 4, 4, 'latin1');
        var hdr = 8;
        if (size === 1) {
          if (pos + 16 > end) break;
          var hi = readU32(buf, pos + 8), lo = readU32(buf, pos + 12);
          size = hi * 4294967296 + lo;
          hdr = 16;
        } else if (size === 0) {
          size = end - pos;
        }
        if (size < hdr || pos + size > end) break;
        var body = pos + hdr;
        var payloadEnd = pos + size;

        if (type === 'moov' || type === 'udta' || type === 'ilst') {
          walk(body, payloadEnd, depth + 1);
        } else if (type === 'meta') {
          /* meta 有 4 字节版本/flags 前缀 */
          walk(body + 4, payloadEnd, depth + 1);
        } else if (type === '©nam' || type === '©ART' || type === '©alb' ||
                   type === 'aART' || type === '©gen' || type === '©lyr' || type === 'trkn' || type === 'covr') {
          var data = findDataAtom(buf, body, payloadEnd);
          if (data) {
            if (type === 'trkn') {
              var n = (data[2] << 8) | data[3];
              if (n > 0) out.track = String(n);
            } else if (type === 'covr') {
              var sig = data[0] === 0xff && data[1] === 0xd8 ? 'image/jpeg' :
                        data[0] === 0x89 && data[1] === 0x50 ? 'image/png' : null;
              if (sig && data.length > 20) {
                out.cover = 'data:' + sig + ';base64,' + arrayBufferToBase64(data);
              }
            } else {
              var txt = bytesToStr(data, 0, data.length, 'utf8') || bytesToStr(data, 0, data.length, 'latin1') || '';
              txt = cleanText(txt);
              if (!txt) txt = bytesToStr(data, 0, data.length, 'utf16le');
              if (txt) {
                if (type === '©nam') out.title = cleanText(txt);
                else if (type === '©ART') out.artist = cleanText(txt);
                else if (type === '©alb') out.album = cleanText(txt);
                else if (type === '©lyr' && !out.lyrics) out.lyrics = cleanText(txt);
              }
            }
          }
        }
        pos = payloadEnd;
      }
    }
    walk(0, buf.length, 0);
    return Object.keys(out).length ? out : null;
  }

  function findDataAtom(buf, start, end) {
    var pos = start;
    while (pos + 8 <= end) {
      var size = readU32(buf, pos);
      var type = bytesToStr(buf, pos + 4, 4, 'latin1');
      if (size < 8 || pos + size > end) break;
      if (type === 'data') {
        /* data: 4 字节类型 + 4 字节 locale + payload */
        return buf.slice(pos + 16, pos + size);
      }
      pos += size;
    }
    return null;
  }

  /* ---------------- OGG ---------------- */
  function parseOgg(buf) {
    var pos = 0;
    var packets = [];
    var cur = [];
    var page = 0;
    while (pos + 27 <= buf.length && page < 8) {
      if (buf[pos] !== 0x4f || buf[pos + 1] !== 0x67 || buf[pos + 2] !== 0x67 || buf[pos + 3] !== 0x53) break; /* OggS */
      var segCount = buf[pos + 26];
      var segPos = pos + 27;
      if (segPos + segCount > buf.length) break;
      var payloadStart = segPos + segCount;
      var p = payloadStart;
      for (var i = 0; i < segCount; i++) {
        var seg = buf[segPos + i];
        if (seg < 255) {
          if (p + seg <= buf.length) cur.push(buf.slice(p, p + seg));
          p += seg;
          if (cur.length) { packets.push(concatBytes(cur)); cur = []; }
        } else {
          if (p + 255 <= buf.length) cur.push(buf.slice(p, p + 255));
          p += 255;
        }
      }
      pos = p;
      page++;
      if (packets.length >= 3) break;
    }
    if (!packets.length) return null;

    var first = packets[0];
    var out = {};
    if (bytesToStr(first, 0, Math.min(7, first.length), 'latin1') === 'vorbis') {
      if (packets.length >= 2 && bytesToStr(packets[1], 0, 6, 'latin1') === 'vorbis') {
        parseVorbisComments(packets[1], 7, out);
      }
    } else if (bytesToStr(first, 0, Math.min(8, first.length), 'latin1') === 'OpusHead') {
      for (var j = 1; j < packets.length; j++) {
        if (bytesToStr(packets[j], 0, Math.min(8, packets[j].length), 'latin1') === 'OpusTags') {
          parseVorbisComments(packets[j], 8, out);
          break;
        }
      }
    }
    return Object.keys(out).length ? out : null;
  }

  function parseVorbisComments(pkt, start, out) {
    var p = start;
    var vendorLen = readU32(pkt, p); p += 4;
    p += vendorLen;
    var count = readU32(pkt, p); p += 4;
    for (var i = 0; i < count && p + 4 <= pkt.length; i++) {
      var clen = readU32(pkt, p); p += 4;
      if (p + clen > pkt.length) break;
      var kv = bytesToStr(pkt, p, clen, 'utf8') || bytesToStr(pkt, p, clen, 'latin1') || '';
      p += clen;
      var eq = kv.indexOf('=');
      if (eq > 0) {
        var key = kv.slice(0, eq).toUpperCase();
        var value = kv.slice(eq + 1);
        if (key === 'TITLE') out.title = value;
        else if (key === 'ARTIST') out.artist = value;
        else if (key === 'ALBUM') out.album = value;
        else if (key === 'TRACKNUMBER') out.track = value;
        else if ((key === 'LYRICS' || key === 'UNSYNCEDLYRICS') && !out.lyrics) out.lyrics = value;
      }
    }
  }

  /* ---------------- WAV ---------------- */
  function parseWav(buf) {
    if (bytesToStr(buf, 0, 4, 'latin1') !== 'RIFF') return null;
    if (bytesToStr(buf, 8, 4, 'latin1') !== 'WAVE') return null;
    var out = {};
    var pos = 12;
    while (pos + 8 <= buf.length) {
      var id = bytesToStr(buf, pos, 4, 'latin1');
      var size = readU32(buf, pos + 4);
      var body = pos + 8;
      if (body + size > buf.length) break;
      if (id === 'LIST' && bytesToStr(buf, body, 4, 'latin1') === 'INFO') {
        var p = body + 4;
        var infoEnd = body + size;
        while (p + 8 <= infoEnd) {
          var sid = bytesToStr(buf, p, 4, 'latin1');
          var ssize = readU32(buf, p + 4);
          if (p + 8 + ssize > infoEnd) break;
          var txt = smartDecode(buf, p + 8, ssize, 'latin1');
          if (sid === 'INAM') out.title = txt;
          else if (sid === 'IART') out.artist = txt;
          else if (sid === 'IPRD') out.album = txt;
          else if (sid === 'ITRK') out.track = txt;
          p += 8 + ssize + (ssize % 2);
        }
      }
      pos = body + size + (size % 2);
    }
    return Object.keys(out).length ? out : null;
  }

  /* ---------------- 入口 ---------------- */
  function parseTags(buffer, filename) {
    try {
      if (!buffer || buffer.byteLength < 16) return null;
      var u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      var magic = bytesToStr(u8, 0, 4, 'latin1');
      var tag = null;
      if (magic === 'ID3' || (u8[0] === 0xff && (u8[1] & 0xe0) === 0xe0)) tag = parseMp3(u8);
      else if (magic === 'fLaC') tag = parseFlac(u8);
      else if (magic === 'ftyp' || magic === 'moov' || magic === 'mdat' || magic === 'wide' || magic === 'free') tag = parseMp4(u8);
      else if (magic === 'OggS') tag = parseOgg(u8);
      else if (magic === 'RIFF') tag = parseWav(u8);
      if (tag) tag.hasTags = true;
      return tag;
    } catch (e) {
      return null;
    }
  }

  function arrayBufferToBase64(u8) {
    var chunk = 0x8000;
    var out = '';
    for (var i = 0; i < u8.length; i += chunk) {
      var sub = u8.subarray(i, Math.min(i + chunk, u8.length));
      out += String.fromCharCode.apply(null, sub);
    }
    return btoa(out);
  }

  function concatBytes(arr) {
    var total = 0, i;
    for (i = 0; i < arr.length; i++) total += arr[i].length;
    var out = new Uint8Array(total);
    var pos = 0;
    for (i = 0; i < arr.length; i++) { out.set(arr[i], pos); pos += arr[i].length; }
    return out;
  }

  global.ID3 = {
    parse: parseTags,
    isAudioName: isAudioName,
    AUDIO_EXTS: AUDIO_EXTS
  };
})(window);
