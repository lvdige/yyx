#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make_music_json.py — 扫描 Music 目录，生成音乐库清单

同时输出：
  · Music/music.json  —— HTTP 服务器模式下由 scanner.js fetch 加载
  · Music/music.js    —— file:// 直接打开 HTML 时由 <script> 自动加载（无需服务器）

功能：
  · 扫描专辑目录（子文件夹=专辑）、封面（cover.png/jpg/jpeg/bmp）
  · 解析歌曲标签：MP3(ID3v2.2/2.3/2.4+ID3v1)、FLAC(Vorbis)、M4A(ilst)
  · 提取内嵌封面（APIC/PICTURE/covr）：专辑无 cover 文件时用首曲内嵌封面
  · 内嵌同名 .lrc 歌词文本（file:// 模式也能读歌词）
  · 预读歌曲时长（自动调用 ffprobe，若可用）

用法：
    python make_music_json.py            # 扫描本站目录下的 Music 文件夹
    python make_music_json.py <路径>     # 或指定 Music 文件夹路径
"""

import os
import re
import sys
import json
import base64
import shutil
import tempfile
import subprocess
from concurrent.futures import ThreadPoolExecutor

AUDIO_EXTS = {'.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.ape', '.wma', '.aiff', '.aif'}
COVER_NAMES = ('cover.png', 'cover.jpg', 'cover.jpeg', 'cover.bmp',
               'cover.PNG', 'cover.JPG', 'cover.JPEG', 'cover.BMP',
               'Cover.png', 'Cover.jpg', 'Cover.jpeg', 'Cover.bmp',
               'COVER.png', 'COVER.jpg', 'COVER.JPEG', 'COVER.BMP',
               'folder.jpg', 'Folder.jpg', 'Folder.JPG', 'album.jpg', 'Album.jpg')
FFPROBE = shutil.which('ffprobe')
FFMPEG = shutil.which('ffmpeg')
MAX_LRC = 512 * 1024


def compress_cover_data(data_url: str):
    """用 ffmpeg 把内嵌封面缩小为 512px JPEG，减小清单体积；失败返回原图。"""
    if not FFMPEG or not data_url:
        return data_url
    try:
        mime, b64s = data_url.split(',', 1)
        raw = base64.b64decode(b64s)
        ext = '.png' if 'png' in mime else '.jpg'
        with tempfile.TemporaryDirectory() as td:
            src = os.path.join(td, 'in' + ext)
            dst = os.path.join(td, 'out.jpg')
            with open(src, 'wb') as f:
                f.write(raw)
            r = subprocess.run([FFMPEG, '-y', '-v', 'error', '-i', src,
                                '-vf', 'scale=512:512:force_original_aspect_ratio=decrease',
                                '-q:v', '4', dst], capture_output=True, timeout=60)
            if r.returncode != 0 or not os.path.isfile(dst):
                return data_url
            with open(dst, 'rb') as f:
                return 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode('ascii')
    except Exception:
        return data_url


def export_cover_file(data_url: str, out_dir: str, base: str):
    """把歌曲内嵌封面导出为磁盘图片文件（有 ffmpeg 压缩为 512px JPEG），返回文件名；失败返回 None。"""
    if not data_url:
        return None
    try:
        mime, b64s = data_url.split(',', 1)
        raw = base64.b64decode(b64s)
        ext = '.png' if 'png' in mime else ('.bmp' if 'bmp' in mime else '.jpg')
        os.makedirs(out_dir, exist_ok=True)
        if FFMPEG:
            with tempfile.TemporaryDirectory() as td:
                src = os.path.join(td, 'in' + ext)
                dst = os.path.join(td, 'out.jpg')
                with open(src, 'wb') as f:
                    f.write(raw)
                r = subprocess.run([FFMPEG, '-y', '-v', 'error', '-i', src,
                                    '-vf', 'scale=512:512:force_original_aspect_ratio=decrease',
                                    '-q:v', '4', dst], capture_output=True, timeout=60)
                if r.returncode == 0 and os.path.isfile(dst):
                    with open(dst, 'rb') as f:
                        raw = f.read()
                    out = os.path.join(out_dir, base + '.jpg')
                    with open(out, 'wb') as f:
                        f.write(raw)
                    return base + '.jpg'
        out = os.path.join(out_dir, base + ext)
        with open(out, 'wb') as f:
            f.write(raw)
        return base + ext
    except Exception:
        return None


def smart_decode(raw: bytes) -> str:
    for enc in ('utf-8', 'gbk'):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return raw.decode('latin-1', errors='replace')


def utf16_to_utf8(raw: bytes, little=True) -> str:
    """UTF-16 解码。奇数长度（半个代码单元）补零字节；解码后再去掉末尾 null 终止符。
    不能用 rstrip(b'\\x00') 预处理——UTF-16LE 里 ASCII 字符的高字节就是 0x00，
    预剥会破坏字符配对导致末尾乱码。"""
    if len(raw) % 2:
        raw = raw + b'\x00'
    enc = 'utf-16-le' if little else 'utf-16-be'
    try:
        s = raw.decode(enc)
    except UnicodeDecodeError:
        s = raw.decode(enc, errors='replace')
    return s.rstrip('\x00')


def read_syncsafe(b: bytes) -> int:
    return ((b[0] & 0x7F) << 21) | ((b[1] & 0x7F) << 14) | ((b[2] & 0x7F) << 7) | (b[3] & 0x7F)


def decode_text(b: bytes, enc: int) -> str:
    if enc == 1:
        if b[:2] == b'\xff\xfe':
            return utf16_to_utf8(b[2:], True)
        if b[:2] == b'\xfe\xff':
            return utf16_to_utf8(b[2:], False)
        return utf16_to_utf8(b, True)
    if enc == 2:
        return utf16_to_utf8(b, False)
    if enc == 3:
        return smart_decode(b.rstrip(b'\x00'))
    try:
        b.decode('ascii')
        return b.rstrip(b'\x00').decode('latin-1')
    except UnicodeDecodeError:
        return smart_decode(b.rstrip(b'\x00'))


def to_data_url(mime: str, data: bytes) -> str:
    m = (mime or 'image/jpeg').lower()
    if m not in ('image/jpeg', 'image/jpg', 'image/png', 'image/bmp', 'image/gif', 'image/webp'):
        if 'jpeg' in m or 'jpg' in m:
            m = 'image/jpeg'
        elif 'png' in m:
            m = 'image/png'
        elif 'bmp' in m:
            m = 'image/bmp'
        else:
            m = 'image/jpeg'
    return 'data:' + m + ';base64,' + base64.b64encode(data).decode('ascii')


def parse_id3v2(data: bytes):
    out = {}
    ver = data[3]
    tag_size = read_syncsafe(data[6:10])
    end = min(10 + tag_size, len(data))
    pos = 10
    fid_len = 3 if ver == 2 else 4
    while pos + fid_len + 6 <= end:
        fid = data[pos:pos + fid_len]
        if fid[0] == 0:
            break
        try:
            fid_str = fid.decode('latin-1')
        except Exception:
            break
        if ver == 2:
            fsize = (data[pos + 3] << 16) | (data[pos + 4] << 8) | data[pos + 5]
            body = pos + 6
        elif ver == 3:
            fsize = int.from_bytes(data[pos + 4:pos + 8], 'big')
            body = pos + 10
        else:
            fsize = read_syncsafe(data[pos + 4:pos + 8])
            body = pos + 10
        if fsize <= 0 or body + fsize > end:
            pos = body + fsize
            continue
        payload = data[body:body + fsize]
        if fid_str.startswith('T') and fid_str != 'TXXX' and payload:
            enc = payload[0]
            text = decode_text(payload[1:].rstrip(b'\x00'), enc).strip()
            if ver == 2:
                if fid_str == 'TT2':
                    out['title'] = text
                elif fid_str == 'TP1':
                    out['artist'] = text
                elif fid_str == 'TAL':
                    out['album'] = text
                elif fid_str == 'TRK':
                    out['track'] = text
            else:
                if fid_str == 'TIT2':
                    out['title'] = text
                elif fid_str == 'TPE1':
                    out['artist'] = text
                elif fid_str == 'TALB':
                    out['album'] = text
                elif fid_str == 'TRCK':
                    out['track'] = text
        elif fid_str == 'USLT' and 'lyrics' not in out and len(payload) >= 4:
            enc = payload[0]
            p2 = 4
            if enc in (1, 2):
                while p2 + 1 < len(payload) and not (payload[p2] == 0 and payload[p2 + 1] == 0):
                    p2 += 1
                p2 += 2
            else:
                while p2 < len(payload) and payload[p2] != 0:
                    p2 += 1
                p2 += 1
            out['lyrics'] = decode_text(payload[p2:].rstrip(b'\x00'), enc).strip()
        elif (fid_str == 'APIC' or fid_str == 'PIC') and 'cover' not in out and len(payload) > 12:
            enc = payload[0]
            if ver == 2:
                mime = payload[1:4].decode('latin-1', 'replace')
                if mime == 'JPG':
                    mime = 'image/jpeg'
                elif mime == 'PNG':
                    mime = 'image/png'
                else:
                    mime = 'image/jpeg'
                p2 = 4
            else:
                p2 = 1
                mime_start = p2
                while p2 < len(payload) and payload[p2] != 0:
                    p2 += 1
                mime = payload[mime_start:p2].decode('latin-1', 'replace')
                p2 += 1  # type
            if enc in (1, 2):
                while p2 + 1 < len(payload) and not (payload[p2] == 0 and payload[p2 + 1] == 0):
                    p2 += 1
                p2 += 2
            else:
                while p2 < len(payload) and payload[p2] != 0:
                    p2 += 1
                p2 += 1
            img = payload[p2:]
            if len(img) > 30:
                out['cover'] = to_data_url(mime, img)
        pos = body + fsize
    return out


def parse_id3v1(data: bytes):
    out = {}
    if data[:3] != b'TAG':
        return out
    for key, off in (('title', 3), ('artist', 33), ('album', 63)):
        raw = data[off:off + 30].rstrip(b'\x00 ').strip()
        if raw:
            out[key] = smart_decode(raw)
    return out


def parse_flac(data: bytes):
    out = {}
    pos = 4
    last = False
    while not last and pos + 4 <= len(data):
        header = int.from_bytes(data[pos:pos + 4], 'big')
        last = bool(header & 0x80000000)
        btype = (header >> 24) & 0x7F
        blen = header & 0xFFFFFF
        pos += 4
        if pos + blen > len(data):
            break
        if btype == 4:
            p = pos
            vendor_len = int.from_bytes(data[p:p + 4], 'little'); p += 4 + vendor_len
            count = int.from_bytes(data[p:p + 4], 'little'); p += 4
            for _ in range(count):
                if p + 4 > pos + blen:
                    break
                clen = int.from_bytes(data[p:p + 4], 'little'); p += 4
                if p + clen > pos + blen:
                    break
                kv = smart_decode(data[p:p + clen]); p += clen
                if '=' in kv:
                    k, v = kv.split('=', 1)
                    ku = k.upper()
                    if ku == 'TITLE' and 'title' not in out:
                        out['title'] = v
                    elif ku == 'ARTIST' and 'artist' not in out:
                        out['artist'] = v
                    elif ku == 'ALBUM' and 'album' not in out:
                        out['album'] = v
                    elif ku == 'TRACKNUMBER' and 'track' not in out:
                        out['track'] = v
                    elif ku in ('LYRICS', 'UNSYNCEDLYRICS') and 'lyrics' not in out:
                        out['lyrics'] = v
        elif btype == 6 and 'cover' not in out:
            pp = pos + 4
            if pp + 4 <= pos + blen:
                mime_len = int.from_bytes(data[pp:pp + 4], 'little'); pp += 4
                mime = data[pp:pp + mime_len].decode('latin-1', 'replace'); pp += mime_len
                desc_len = int.from_bytes(data[pp:pp + 4], 'little'); pp += 4
                pp += desc_len + 16
                if pp + 4 <= pos + blen:
                    data_len = int.from_bytes(data[pp:pp + 4], 'little'); pp += 4
                    if pp + data_len <= pos + blen and data_len > 30:
                        out['cover'] = to_data_url(mime, data[pp:pp + data_len])
        pos += blen
    return out


def parse_mp4(data: bytes):
    out = {}

    def find_data_atom(start, end):
        p = start
        while p + 8 <= end:
            size = int.from_bytes(data[p:p + 4], 'big')
            btype = data[p + 4:p + 8].decode('latin-1', 'replace')
            if size < 8 or p + size > end:
                break
            if btype == 'data':
                return data[p + 16:p + size]
            p += size
        return None

    def walk(start, end, depth=0):
        if depth > 8:
            return
        p = start
        while p + 8 <= end:
            size = int.from_bytes(data[p:p + 4], 'big')
            btype = data[p + 4:p + 8].decode('latin-1', 'replace')
            hdr = 8
            if size == 1:
                size = int.from_bytes(data[p + 8:p + 16], 'big')
                hdr = 16
            elif size == 0:
                size = end - p
            if size < hdr or p + size > end:
                break
            body = p + hdr
            pend = p + size
            if btype in ('moov', 'udta', 'ilst'):
                walk(body, pend, depth + 1)
            elif btype == 'meta':
                walk(body + 4, pend, depth + 1)
            elif btype in ('\xa9nam', '\xa9ART', '\xa9alb', 'aART', '\xa9lyr', 'trkn', 'covr'):
                d = find_data_atom(body, pend)
                if d is not None:
                    if btype == 'trkn' and len(d) >= 4:
                        n = (d[2] << 8) | d[3]
                        if n:
                            out['track'] = str(n)
                    elif btype == 'covr' and 'cover' not in out and len(d) > 30:
                        sig = None
                        if d[0] == 0xff and d[1] == 0xd8:
                            sig = 'image/jpeg'
                        elif d[0] == 0x89 and d[1] == 0x50:
                            sig = 'image/png'
                        if sig:
                            out['cover'] = to_data_url(sig, d)
                    else:
                        txt = d.decode('utf-8', errors='ignore').strip('\x00').strip()
                        if txt:
                            if btype == '\xa9nam':
                                out['title'] = txt
                            elif btype == '\xa9ART':
                                out['artist'] = txt
                            elif btype == '\xa9alb':
                                out['album'] = txt
                            elif btype == '\xa9lyr' and 'lyrics' not in out:
                                out['lyrics'] = txt
            p = pend

    walk(0, len(data))
    return out


def parse_tags(path: str):
    try:
        with open(path, 'rb') as f:
            head = f.read(16)
            if len(head) < 16:
                return {}
            if head[:3] == b'ID3':
                f.seek(0)
                size = read_syncsafe(head[6:10])
                data = f.read(min(10 + size, 64 * 1024 * 1024))
                out = parse_id3v2(data)
                if not out.get('title') and not out.get('artist'):
                    f.seek(-128, 2)
                    v1 = f.read(128)
                    out = {**out, **{k: v for k, v in parse_id3v1(v1).items() if k not in out}}
                return out
            if head[:4] == b'fLaC':
                f.seek(0)
                return parse_flac(f.read(64 * 1024 * 1024))
            if head[4:8] in (b'ftyp', b'moov', b'mdat', b'wide', b'free'):
                f.seek(0)
                return parse_mp4(f.read(64 * 1024 * 1024))
    except OSError:
        return {}
    return {}


def probe_duration(path: str):
    if not FFPROBE:
        return None
    import time
    for attempt in range(3):
        try:
            r = subprocess.run([FFPROBE, '-v', 'error', '-show_entries', 'format=duration',
                                '-of', 'default=noprint_wrappers=1:nokey=1', path],
                               capture_output=True, text=True, timeout=60)
            s = r.stdout.strip()
            if s:
                d = float(s)
                return round(d, 1) if d > 0 else None
        except Exception:
            pass
        time.sleep(0.4 * (attempt + 1))
    return None


def read_lrc(path: str):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            return f.read(MAX_LRC)
    except OSError:
        return None


def find_cover(dirpath: str):
    for n in COVER_NAMES:
        if os.path.isfile(os.path.join(dirpath, n)):
            return n
    return None


def scan(music_dir: str):
    albums = []
    root_songs = []
    all_audio = []  # (path, callback_key) 用于并发读时长

    def make_song(full_path, rel_file, album_name, dirpath):
        base = os.path.splitext(os.path.basename(rel_file))[0]
        lrc_path = os.path.join(dirpath, base + '.lrc')
        has_lrc = os.path.isfile(lrc_path)
        tag = parse_tags(full_path)
        return {
            'file': rel_file,
            'title': tag.get('title') or None,
            'artist': tag.get('artist') or None,
            'album': tag.get('album') or album_name,
            'track': tag.get('track') or None,
            'hasLrc': has_lrc,
            'lrcText': read_lrc(lrc_path) if has_lrc else None,
            'lyrics': tag.get('lyrics') or None,
            'cover': tag.get('cover') or None,
            'duration': None,
        }

    if not os.path.isdir(music_dir):
        return albums

    covers_root = os.path.join(music_dir, '.covers')  # 歌曲封面导出目录（无音频，不会被当作专辑）

    for name in sorted(os.listdir(music_dir)):
        path = os.path.join(music_dir, name)
        if not os.path.isdir(path):
            if os.path.isfile(path) and os.path.splitext(name)[1].lower() in AUDIO_EXTS:
                s = make_song(path, 'Music/' + name, '未分类', music_dir)
                all_audio.append((path, s))
                root_songs.append(s)
            continue

        cover = find_cover(path)
        songs = []
        audio_files = [fn for fn in os.listdir(path)
                       if os.path.isfile(os.path.join(path, fn)) and os.path.splitext(fn)[1].lower() in AUDIO_EXTS]
        audio_files.sort(key=lambda s: [int(x) if x.isdigit() else x.lower() for x in re.split(r'(\d+)', s)])
        for fn in audio_files:
            s = make_song(os.path.join(path, fn), 'Music/' + name + '/' + fn, name, path)
            all_audio.append((os.path.join(path, fn), s))
            songs.append(s)
        if songs:
            # 专辑封面：cover 文件优先；否则用首曲内嵌封面（压缩为专辑级 coverData）
            cover_data = None
            if not cover:
                for s in songs:
                    if s.get('cover'):
                        cover_data = compress_cover_data(s['cover'])
                        break
            for s in songs:
                # 每首歌导出独立封面文件并单独引用（Music/.covers/<专辑>/<歌曲名>.jpg）
                if s.get('cover'):
                    cb = os.path.splitext(os.path.basename(s['file']))[0]
                    fn = export_cover_file(s['cover'], os.path.join(covers_root, name), cb)
                    if fn:
                        s['coverFile'] = 'Music/.covers/' + name + '/' + fn
                s.pop('cover', None)
            artist = next((s.get('artist') for s in songs if s.get('artist')), '')
            albums.append({
                'name': name,
                'artist': artist,
                'cover': ('Music/' + name + '/' + cover) if cover else None,
                'coverData': cover_data,
                'songs': songs,
            })

    if root_songs:
        cover_data = next((s.get('cover') for s in root_songs if s.get('cover')), None)
        for s in root_songs:
            if s.get('cover'):
                cb = os.path.splitext(os.path.basename(s['file']))[0]
                fn = export_cover_file(s['cover'], os.path.join(covers_root, '_root'), cb)
                if fn:
                    s['coverFile'] = 'Music/.covers/_root/' + fn
            s.pop('cover', None)
        if cover_data:
            cover_data = compress_cover_data(cover_data)
        albums.append({'name': '未分类', 'artist': '', 'cover': None, 'coverData': cover_data, 'songs': root_songs})

    # 并发预读时长（ffprobe 可用时）
    if FFPROBE and all_audio:
        print('正在读取歌曲时长（ffprobe）…')
        with ThreadPoolExecutor(max_workers=4) as ex:
            results = list(ex.map(lambda item: probe_duration(item[0]), all_audio))
        for (_, song), dur in zip(all_audio, results):
            song['duration'] = dur
    return albums


def main():
    base = os.path.dirname(os.path.abspath(__file__))
    music_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(base, 'Music')
    albums = scan(music_dir)
    payload = {'generated': __import__('datetime').datetime.now().isoformat(), 'albums': albums}

    out_json = os.path.join(music_dir, 'music.json')
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)

    out_js = os.path.join(music_dir, 'music.js')
    with open(out_js, 'w', encoding='utf-8') as f:
        f.write('/* 由 make_music_json.py 自动生成，请勿手动修改 */\n')
        f.write('window.MUSIC_LIBRARY = ')
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')

    # 更新 index.html 中 music.js 的版本戳，防止浏览器缓存旧的清单
    index_path = os.path.join(base, 'index.html')
    if os.path.isfile(index_path):
        try:
            with open(index_path, 'r', encoding='utf-8') as f:
                html = f.read()
            stamp = __import__('datetime').datetime.now().strftime('%Y%m%d%H%M%S')
            new_html, n = re.subn(r'(Music/music\.js)(\?v=\d+)?', r'\1?v=' + stamp, html, count=1)
            if n and new_html != html:
                with open(index_path, 'w', encoding='utf-8') as f:
                    f.write(new_html)
        except Exception:
            pass

    n_songs = sum(len(a['songs']) for a in albums)
    n_cover = sum(1 for a in albums if a.get('cover') or a.get('coverData'))
    n_coverfile = sum(1 for a in albums for s in a['songs'] if s.get('coverFile'))
    n_lrc = sum(1 for a in albums for s in a['songs'] if s.get('lrcText'))
    n_taglyr = sum(1 for a in albums for s in a['songs'] if s.get('lyrics'))
    n_dur = sum(1 for a in albums for s in a['songs'] if s.get('duration'))
    print('已生成:')
    print('  %s' % out_json)
    print('  %s' % out_js)
    print('专辑 %d 张，歌曲 %d 首（封面 %d 张，歌曲独立封面 %d 首，同名lrc %d 首，标签歌词 %d 首，时长 %d 首）' % (len(albums), n_songs, n_cover, n_coverfile, n_lrc, n_taglyr, n_dur))


if __name__ == '__main__':
    main()
