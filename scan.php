<?php
/**
 * scan.php — 自动扫描 Music 目录，生成音乐库 JSON 清单
 *
 * 部署说明：
 *   · 将本文件与 index.html 放在同一目录（服务器需支持 PHP）
 *   · 每次访问网站时，js/scanner.js 会自动请求本文件并返回最新清单，
 *     因此"每次访问自动扫描文件夹"。
 *   · 输出结构：
 *       { "generated": "...", "albums": [ { name, artist, cover, songs: [...] } ] }
 *
 * 专辑约定：
 *   · Music/ 下每个子文件夹 = 一张专辑
 *   · 专辑封面：专辑文件夹内 cover.png / cover.jpg / cover.jpeg / cover.bmp（大小写不敏感）
 *   · 歌词：与歌曲同名的 .lrc 文件（如 01.mp3 → 01.lrc）
 *   · 支持解析 MP3 标签（ID3v2.2/2.3/2.4 + ID3v1，UTF-8 / UTF-16 / GBK）
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, must-revalidate');

$root = __DIR__ . DIRECTORY_SEPARATOR . 'Music';
$audioExts = array('mp3', 'flac', 'm4a', 'aac', 'ogg', 'opus', 'wav', 'ape', 'wma', 'aiff', 'aif');

$albums = array();

if (is_dir($root)) {
    $entries = @scandir($root);
    if ($entries === false) $entries = array();
    foreach ($entries as $name) {
        if ($name === '.' || $name === '..') continue;
        $path = $root . DIRECTORY_SEPARATOR . $name;
        if (!is_dir($path)) continue;
        $album = scanAlbum($path, $name, $audioExts);
        if (!empty($album['songs'])) {
            $albums[] = $album;
        }
    }
    /* 根目录直接放音频时，归入"未分类" */
    $rootSongs = array();
    $rootCover = null;
    foreach ($entries as $name) {
        if ($name === '.' || $name === '..') continue;
        $path = $root . DIRECTORY_SEPARATOR . $name;
        if (!is_file($path)) continue;
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if (in_array($ext, $audioExts)) {
            $rootSongs[] = makeSongEntry($path, $name, 'Music', '未分类', $audioExts, $rootCover);
        }
    }
    if (count($rootSongs)) {
        $albums[] = array('name' => '未分类', 'artist' => '', 'cover' => null, 'coverData' => $rootCover, 'songs' => $rootSongs);
    }}

echo json_encode(array('generated' => date('c'), 'albums' => $albums));
exit;

/* ---------------- 扫描单个专辑目录 ---------------- */

function scanAlbum($dir, $name, $audioExts) {
    $cover = findCover($dir);
    $coverRel = $cover !== null ? 'Music/' . $name . '/' . basename($cover) : null;
    $songs = array();
    $files = @scandir($dir);
    if ($files === false) $files = array();
    $audio = array();
    foreach ($files as $f) {
        if ($f === '.' || $f === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $f;
        if (!is_file($path)) continue;
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (in_array($ext, $audioExts)) $audio[] = $f;
    }
    natsort($audio);
    $artist = '';
    $tagCover = null;
    foreach ($audio as $f) {
        $entry = makeSongEntry($dir . DIRECTORY_SEPARATOR . $f, $f, 'Music/' . $name, $name, $audioExts, $tagCover);
        $songs[] = $entry;
        if ($artist === '' && !empty($entry['artist'])) $artist = $entry['artist'];
    }
    $coverData = ($cover === null) ? $tagCover : null;
    return array('name' => $name, 'artist' => $artist, 'cover' => $coverRel, 'coverData' => $coverData, 'songs' => $songs);
}

function makeSongEntry($path, $fileName, $relDir, $albumName, $audioExts, &$tagCover = null) {
    $base = preg_replace('/\.[^.]+$/', '', $fileName);
    $rel = $relDir . '/' . $fileName;
    /* 同名 .lrc */
    $hasLrc = false;
    $lrcText = null;
    $lrcPath = dirname($path) . DIRECTORY_SEPARATOR . $base . '.lrc';
    $dir = dirname($path);
    if (is_file($lrcPath)) {
        $hasLrc = true;
        $txt = @file_get_contents($lrcPath);
        if ($txt !== false) $lrcText = substr($txt, 0, 512 * 1024);
    } else {
        foreach (array('.LRC') as $suf) {
            if (is_file($dir . DIRECTORY_SEPARATOR . $base . $suf)) { $hasLrc = true; break; }
        }
    }
    $tag = parseId3($path);
    if ($tagCover === null && isset($tag['cover'])) $tagCover = $tag['cover'];
    $entry = array(
        'file'     => $rel,
        'title'    => isset($tag['title']) ? $tag['title'] : null,
        'artist'   => isset($tag['artist']) ? $tag['artist'] : null,
        'album'    => isset($tag['album']) ? $tag['album'] : $albumName,
        'track'    => isset($tag['track']) ? $tag['track'] : null,
        'hasLrc'   => $hasLrc,
        'lrcText'  => $lrcText,
        'lyrics'   => isset($tag['lyrics']) ? $tag['lyrics'] : null,
        'duration' => probeDuration($path)
    );
    return $entry;
}

function findCover($dir) {
    $names = array('cover.png','cover.jpg','cover.jpeg','cover.bmp',
                   'cover.PNG','cover.JPG','cover.JPEG','cover.BMP',
                   'Cover.png','Cover.jpg','Cover.jpeg','Cover.bmp',
                   'COVER.png','COVER.jpg','COVER.JPEG','COVER.BMP',
                   'folder.jpg','Folder.jpg','Folder.JPG','album.jpg','Album.jpg');
    foreach ($names as $n) {
        if (is_file($dir . DIRECTORY_SEPARATOR . $n)) return $dir . DIRECTORY_SEPARATOR . $n;
    }
    return null;
}

/* ---------------- MP3 标签解析 ---------------- */

function parseId3($file) {
    $size = @filesize($file);
    if ($size === false || $size < 8) return array();
    $h = @fopen($file, 'rb');
    if (!$h) return array();
    $head = fread($h, 10);
    if (strlen($head) >= 3 && substr($head, 0, 3) === 'ID3') {
        $ver = ord($head[3]);
        $tagSize = syncsafeBytes($head, 6);
        $end = 10 + $tagSize;
        if ($tagSize > 0 && $tagSize < 64 * 1024 * 1024) {
            $frameIdLen = ($ver === 2) ? 3 : 4;
            $out = array();
            $pos = 10;
            while ($pos + $frameIdLen + 6 <= $end) {
                fseek($h, $pos);
                $id = fread($h, $frameIdLen);
                if (strlen($id) < $frameIdLen || ord($id[0]) === 0) break;
                $meta = fread($h, 6);
                if (strlen($meta) < 6) break;
                if ($ver === 2) {
                    $fsize = (ord($meta[0]) << 16) | (ord($meta[1]) << 8) | ord($meta[2]);
                    $body = $pos + 6;
                } elseif ($ver === 3) {
                    $tmp = unpack('N', substr($meta, 0, 4));
                    $fsize = $tmp[1];
                    $body = $pos + 10;
                } else {
                    $fsize = syncsafeBytes($meta, 0);
                    $body = $pos + 10;
                }
                if ($fsize <= 0 || $body + $fsize > $end) { $pos = $body + $fsize; continue; }
                fseek($h, $body);
                $data = fread($h, $fsize);
                if (strlen($data) < $fsize) break;
                $t = $id[0];
                if ($t === 'T' && $id !== 'TXXX') {
                    if ($ver === 2) {
                        if ($id === 'TT2') $out['title'] = id3Text($data);
                        elseif ($id === 'TP1') $out['artist'] = id3Text($data);
                        elseif ($id === 'TAL') $out['album'] = id3Text($data);
                        elseif ($id === 'TRK') $out['track'] = id3Text($data);
                    } else {
                        if ($id === 'TIT2') $out['title'] = id3Text($data);
                        elseif ($id === 'TPE1') $out['artist'] = id3Text($data);
                        elseif ($id === 'TALB') $out['album'] = id3Text($data);
                        elseif ($id === 'TRCK') $out['track'] = id3Text($data);
                    }
                } elseif ($id === 'USLT' && !isset($out['lyrics'])) {
                    $out['lyrics'] = id3Lyrics($data);
                } elseif (($id === 'APIC' || $id === 'PIC') && !isset($out['cover']) && strlen($data) > 12) {
                    $out['cover'] = parseApic($data, $ver);
                }
                $pos = $body + $fsize;
            }
            fclose($h);
            if (empty($out['title']) && empty($out['artist'])) {
                $v1 = parseId3v1($file);
                if (!empty($v1)) $out = array_merge($out, $v1);
            }
            return $out;
        }
    }
    fclose($h);
    $v1 = parseId3v1($file);
    return $v1 ? $v1 : array();
}

function parseId3v1($file) {
    $size = @filesize($file);
    if ($size === false || $size < 128) return array();
    $h = @fopen($file, 'rb');
    if (!$h) return array();
    fseek($h, -128, SEEK_END);
    $tag = fread($h, 128);
    fclose($h);
    if (strlen($tag) < 128 || substr($tag, 0, 3) !== 'TAG') return array();
    $out = array();
    $title = cleanV1Text(substr($tag, 3, 30));
    $artist = cleanV1Text(substr($tag, 33, 30));
    $album = cleanV1Text(substr($tag, 63, 30));
    if ($title !== '') $out['title'] = $title;
    if ($artist !== '') $out['artist'] = $artist;
    if ($album !== '') $out['album'] = $album;
    return $out;
}

function syncsafeBytes($s, $off) {
    return ((ord($s[$off]) & 0x7f) << 21) | ((ord($s[$off + 1]) & 0x7f) << 14) |
           ((ord($s[$off + 2]) & 0x7f) << 7) | (ord($s[$off + 3]) & 0x7f);
}

function parseApic($data, $ver) {
    $enc = ord($data[0]);
    $len = strlen($data);
    if ($ver === 2) {
        $mime = substr($data, 1, 3);
        if ($mime === 'JPG') $mime = 'image/jpeg';
        elseif ($mime === 'PNG') $mime = 'image/png';
        else $mime = 'image/jpeg';
        $p = 4;
    } else {
        $p = 1;
        $ms = $p;
        while ($p < $len && $data[$p] !== "\x00") $p++;
        $mime = substr($data, $ms, $p - $ms);
        $p++; /* picture type */
    }
    if ($enc === 1 || $enc === 2) {
        while ($p + 1 < $len && !($data[$p] === "\x00" && $data[$p + 1] === "\x00")) $p++;
        $p += 2;
    } else {
        while ($p < $len && $data[$p] !== "\x00") $p++;
        $p++;
    }
    $img = substr($data, $p);
    if (strlen($img) < 30) return null;
    if (!preg_match('#^image/(jpeg|jpg|png|bmp|gif|webp)$#i', $mime)) $mime = 'image/jpeg';
    return 'data:' . $mime . ';base64,' . base64_encode($img);
}

function probeDuration($path) {
    static $hasFfprobe = null;
    if ($hasFfprobe === null) {
        $out = array(); $code = 0;
        @exec('ffprobe -version 2>&1', $out, $code);
        $hasFfprobe = ($code === 0);
    }
    if (!$hasFfprobe) return null;
    $out = array(); $code = 0;
    @exec('ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ' .
          escapeshellarg($path) . ' 2>&1', $out, $code);
    if ($code !== 0 || empty($out)) return null;
    $d = (float)trim(end($out));
    return ($d > 0) ? round($d, 1) : null;
}

function id3Text($data) {
    if ($data === '') return '';
    $enc = ord($data[0]);
    $body = substr($data, 1);
    $body = rtrim($body, "\x00");
    $s = decodeId3Bytes($body, $enc);
    return trim($s, " \t\r\n");
}

function id3Lyrics($data) {
    if (strlen($data) < 4) return '';
    $enc = ord($data[0]);
    $len = strlen($data);
    $pos = 4; /* 编码 + 3 语言字节 */
    if ($enc === 1 || $enc === 2) {
        while ($pos + 1 < $len && !($data[$pos] === "\x00" && $data[$pos + 1] === "\x00")) $pos++;
        $pos += 2;
    } else {
        while ($pos < $len && $data[$pos] !== "\x00") $pos++;
        $pos++;
    }
    $text = substr($data, $pos);
    $text = rtrim($text, "\x00");
    return trim(decodeId3Bytes($text, $enc), " \t\r\n");
}

function decodeId3Bytes($bytes, $enc) {
    if ($bytes === '') return '';
    if ($enc === 1) {
        if (strlen($bytes) >= 2 && $bytes[0] === "\xFF" && $bytes[1] === "\xFE") return utf16ToUtf8(substr($bytes, 2), true);
        if (strlen($bytes) >= 2 && $bytes[0] === "\xFE" && $bytes[1] === "\xFF") return utf16ToUtf8(substr($bytes, 2), false);
        return utf16ToUtf8($bytes, true);
    }
    if ($enc === 2) return utf16ToUtf8($bytes, false);
    if ($enc === 3) return $bytes;
    /* 编码 0：ISO-8859-1，中文文件多为 GBK */
    if (isUtf8($bytes)) return $bytes;
    if (hasHighByte($bytes)) return gbkToUtf8($bytes);
    return $bytes;
}

function utf16ToUtf8($s, $littleEndian) {
    $out = '';
    $len = strlen($s);
    for ($i = 0; $i + 1 < $len; $i += 2) {
        $code = $littleEndian ? (ord($s[$i]) | (ord($s[$i + 1]) << 8)) : ((ord($s[$i]) << 8) | ord($s[$i + 1]));
        if ($code >= 0xD800 && $code <= 0xDBFF && $i + 3 < $len) {
            $lo = $littleEndian ? (ord($s[$i + 2]) | (ord($s[$i + 3]) << 8)) : ((ord($s[$i + 2]) << 8) | ord($s[$i + 3]));
            $code = 0x10000 + (($code - 0xD800) << 10) + ($lo - 0xDC00);
            $i += 2;
        }
        if ($code < 0x80) $out .= chr($code);
        elseif ($code < 0x800) $out .= chr(0xC0 | ($code >> 6)) . chr(0x80 | ($code & 0x3F));
        elseif ($code < 0x10000) $out .= chr(0xE0 | ($code >> 12)) . chr(0x80 | (($code >> 6) & 0x3F)) . chr(0x80 | ($code & 0x3F));
        else $out .= chr(0xF0 | ($code >> 18)) . chr(0x80 | (($code >> 12) & 0x3F)) . chr(0x80 | (($code >> 6) & 0x3F)) . chr(0x80 | ($code & 0x3F));
    }
    return $out;
}

function isUtf8($s) {
    if (function_exists('mb_check_encoding')) return mb_check_encoding($s, 'UTF-8');
    return preg_match('//u', $s) === 1;
}

function hasHighByte($s) {
    for ($i = 0, $n = strlen($s); $i < $n; $i++) {
        if (ord($s[$i]) > 127) return true;
    }
    return false;
}

function gbkToUtf8($s) {
    if (function_exists('mb_convert_encoding')) return mb_convert_encoding($s, 'UTF-8', 'GBK');
    if (function_exists('iconv')) {
        $r = @iconv('GBK', 'UTF-8', $s);
        return ($r === false) ? $s : $r;
    }
    return $s;
}

function cleanV1Text($s) {
    $s = rtrim($s, "\x00 ");
    if ($s === '') return '';
    if (isUtf8($s)) return $s;
    return hasHighByte($s) ? gbkToUtf8($s) : $s;
}
