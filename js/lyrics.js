/* ==========================================================================
 * lyrics.js — LRC 歌词解析与渲染（无外部依赖）
 * 支持 [mm:ss.xx] / [mm:ss] 多时间标签、元信息 [ti:][ar:][al:][by:][offset:]
 * ========================================================================== */
(function (global) {
  'use strict';

  var TIME_RE = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  var META_RE = /^\[(ti|ar|al|by|re|ve|offset|length):(.*)\]$/i;

  /**
   * 解析 LRC 文本
   * @returns {{ meta:Object, lines:Array<{time:number,text:string,times:Array<number>}> }}
   */
  function parse(text) {
    var meta = {};
    var lines = [];
    if (!text) return { meta: meta, lines: lines };
    var raw = String(text).replace(/\r\n/g, '\n').split('\n');

    for (var i = 0; i < raw.length; i++) {
      var line = raw[i];
      if (!line.trim()) continue;

      /* 元信息行 */
      var metaHit = line.match(META_RE);
      if (metaHit) {
        var key = metaHit[1].toLowerCase();
        var value = metaHit[2].trim();
        if (key === 'offset') meta.offset = parseInt(value, 10) || 0;
        else meta[key] = value;
        continue;
      }

      var times = [];
      var textPart = line;
      TIME_RE.lastIndex = 0;
      var m;
      while ((m = TIME_RE.exec(line)) !== null) {
        var min = parseInt(m[1], 10);
        var sec = parseInt(m[2], 10);
        var frac = m[3] ? parseFloat('0.' + m[3]) : 0;
        times.push(min * 60 + sec + frac);
        textPart = textPart.replace(m[0], '');
      }
      if (times.length && textPart.trim()) {
        lines.push({ time: times[0], times: times, text: textPart.trim() });
      } else if (!times.length && textPart.trim()) {
        /* 无时间标签的行：作为"翻译/附加行"挂到前一行（若有） */
        if (lines.length) {
          var last = lines[lines.length - 1];
          if (!last.extra) last.extra = [];
          last.extra.push(textPart.trim());
        }
      }
    }

    lines.sort(function (a, b) { return a.time - b.time; });
    var offset = meta.offset || 0;
    if (offset) {
      for (var j = 0; j < lines.length; j++) {
        lines[j].time = Math.max(0, lines[j].time + offset / 1000);
        for (var k = 0; k < lines[j].times.length; k++) {
          lines[j].times[k] = Math.max(0, lines[j].times[k] + offset / 1000);
        }
      }
    }
    return { meta: meta, lines: lines };
  }

  /**
   * 在渲染容器中渲染歌词行
   * @param container 容器元素
   * @param parsed parse() 的返回值
   * @param onClick 点击某行时的回调 (time)
   */
  function render(container, parsed, onClick) {
    container.textContent = '';
    if (!parsed || !parsed.lines.length) {
      var empty = document.createElement('div');
      empty.className = 'np-lyric-empty';
      empty.textContent = '暂无歌词';
      container.appendChild(empty);
      return;
    }
    var frag = document.createDocumentFragment();
    parsed.lines.forEach(function (line, idx) {
      var div = document.createElement('div');
      div.className = 'lyric-line';
      div.setAttribute('data-time', line.time);
      var timeSpan = document.createElement('span');
      timeSpan.className = 'lyric-time';
      timeSpan.textContent = formatTime(line.time);
      div.appendChild(timeSpan);
      div.appendChild(document.createTextNode(line.text));
      if (line.extra && line.extra.length) {
        var sub = document.createElement('div');
        sub.className = 'lyric-extra';
        sub.textContent = line.extra.join(' ');
        div.appendChild(sub);
      }
      if (onClick) {
        div.addEventListener('click', function () { onClick(line.time); });
      }
      div._line = line;
      div._idx = idx;
      frag.appendChild(div);
    });
    container.appendChild(frag);
    return container.querySelectorAll('.lyric-line');
  }

  /**
   * 更新高亮：给定当前播放时间，标记激活行并滚动到可视区
   * @param lineEls NodeList 歌词行元素
   * @param currentTime 秒
   * @param scrollContainer 滚动容器
   * @returns {number} 当前行索引，-1 表示无
   */
  function updateHighlight(lineEls, currentTime, scrollContainer) {
    if (!lineEls || !lineEls.length) return -1;
    var activeIdx = -1;
    for (var i = 0; i < lineEls.length; i++) {
      if (lineEls[i]._line.time <= currentTime) activeIdx = i;
      else break;
    }
    lineEls.forEach(function (el, idx) {
      var on = idx === activeIdx;
      el.classList.toggle('active', on);
    });
    if (activeIdx >= 0 && scrollContainer && lineEls[activeIdx]) {
      var target = lineEls[activeIdx];
      var containerRect = scrollContainer.getBoundingClientRect();
      var elRect = target.getBoundingClientRect();
      var diff = elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;
      if (Math.abs(diff) > 40) {
        /* 直接定位（不用 smooth：频繁滚动时平滑动画会造成明显卡顿） */
        scrollContainer.scrollTop += diff;
      }
    }
    return activeIdx;
  }

  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    var s = Math.floor(sec % 60);
    var m = Math.floor(sec / 60);
    return m + ':' + (s < 10 ? '0' + s : s);
  }

  global.Lyrics = { parse: parse, render: render, updateHighlight: updateHighlight, formatTime: formatTime };
})(window);
