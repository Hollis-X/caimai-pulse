/**
 * 财脉 Pulse — 简洁 loading + 单页面无弹窗
 */
(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };

  // ★ 品牌名称 —— 只改这一处，全站自动生效
  var BRAND = "财脉 Pulse";
  var API_SECRET = document.querySelector('meta[name="api-secret"]')?.content || "";

  function signUrl(url) {
    if (!API_SECRET) return url;
    var sep = url.includes("?") ? "&" : "?";
    return url + sep + "key=" + API_SECRET;
  }

  function authFetch(url, opts) {
    return fetch(signUrl(url), opts);
  }

  var STATE = {
    tab: "flash",
    flashCursor: null, flashHasMore: true, flashLoading: false,
    newsCursor: null, newsHasMore: true, newsLoading: false,
    searchKeyword: "", detailId: null,
  };

  var CONTENT = $("#contentArea");
  var NAV_BACK = $("#navBack");
  var NAV_TITLE = $("#navTitle");
  var DETAIL = $("#pageDetail");
  var DETAIL_SCROLL = $("#detailScroll");
  var SEARCH_BAR = $("#searchBar");
  var SEARCH_INPUT = $("#searchInput");
  var FLASH_TOAST = $("#flashToast");
  var FLASH_TOAST_TEXT = $("#flashToastText");
  var flashSSE = null;
  var flashPending = 0;
  var _audioCtx = null;

  function _getAudioCtx() {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    return _audioCtx;
  }

  // 初始化
  function init() {
    // 首次用户交互时解锁音频
    document.addEventListener("click", function unlock() {
      _getAudioCtx();
      document.removeEventListener("click", unlock);
    }, { once: true });
    showInlineLoading();
    renderFlash();
    connectFlashStream();
    // iOS Safari 添加主屏幕引导（仅显示一次）
    showPWAGuide();
  }

  function showPWAGuide() {
    if (window.navigator.standalone) return;
    var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!isIOS) return;
    if (localStorage.getItem("pwa_closed")) return;
    setTimeout(function () {
      var hint = document.createElement("div");
      hint.className = "ios-pwa-hint";
      hint.innerHTML = '<span class="pwa-arrow">⎋</span> 分享 → <b>添加到主屏幕</b><span class="pwa-close">✕</span>';
      hint.querySelector(".pwa-close").addEventListener("click", function (e) {
        e.stopPropagation();
        hint.remove();
        localStorage.setItem("pwa_closed", "1");
      });
      document.body.appendChild(hint);
    }, 2500);
  }

  // SSE 实时快讯

  function connectFlashStream() {
    if (flashSSE) flashSSE.close();
    flashSSE = new EventSource("/api/stream/flash");
    flashSSE.onmessage = function (e) {
      try {
        var items = JSON.parse(e.data);
        if (!items || !items.length) return;
        // 判断用户是否在顶部（200px内）
        if (window.scrollY < 200 && STATE.tab === "flash") {
          // 在顶部 → 直接插入，带淡入动画
          items.forEach(function (item) {
            prependFlashItem(item);
          });
        } else {
          // 已滚动 → 累加到悬浮提示
          flashPending += items.length;
          FLASH_TOAST_TEXT.textContent = flashPending + " 条新快讯";
          FLASH_TOAST.style.display = "flex";
          beep();
        }
      } catch (_) {}
    };
    flashSSE.onerror = function () {
      if (flashSSE) { flashSSE.close(); flashSSE = null; }
      // 断开后10秒重连（仅快讯tab且页面可见）
      if (STATE.tab === "flash" && document.visibilityState === "visible") {
        setTimeout(function(){ if (!flashSSE && STATE.tab === "flash" && document.visibilityState === "visible") connectFlashStream(); }, 10000);
      }
    };
    flashSSE.addEventListener("close", function () {
      if (flashSSE) { flashSSE.close(); flashSSE = null; }
      if (STATE.tab === "flash" && document.visibilityState === "visible") {
        setTimeout(function(){ if (!flashSSE) connectFlashStream(); }, 10000);
      }
    });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      if (flashSSE) { flashSSE.close(); flashSSE = null; }
    } else if (STATE.tab === "flash" && !flashSSE) {
      connectFlashStream();
    }
  });

  function prependFlashItem(item) {
    // 移除空状态
    var emptyEl = CONTENT.querySelector(".empty-state");
    if (emptyEl) emptyEl.remove();
    var sentinel = CONTENT.querySelector(".sentinel");
    var el = document.createElement("div");
    el.className = "flash-item fresh";
    el.innerHTML =
      '<div class="flash-dot"></div>' +
      '<div class="flash-body">' +
      '<div class="flash-time">' + fmtTime(item.time || item.pub_time) + '</div>' +
      '<div class="flash-text">' + esc(item.content || item.title || item.text) + '</div>' +
      '</div>';
    // 插入到第一个 flash-item 之前（sentinel 之前也可）
    var firstFlash = CONTENT.querySelector(".flash-item");
    if (firstFlash) {
      CONTENT.insertBefore(el, firstFlash);
    } else if (sentinel) {
      CONTENT.insertBefore(el, sentinel);
    } else {
      CONTENT.appendChild(el);
    }
  }

  // 点击悬浮提示 → 滚回顶部（不清空列表，新快讯已在列表中）
  var _savedScrollY = 0;
  FLASH_TOAST.addEventListener("click", function () {
    _savedScrollY = window.scrollY; // 记住之前位置
    flashPending = 0;
    FLASH_TOAST.style.display = "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
    // 3秒后显示"回到之前位置"小按钮
    setTimeout(function () {
      if (_savedScrollY > 300) showBackMarker(_savedScrollY);
    }, 1500);
  });

  function showBackMarker(y) {
    var existing = $(".back-marker");
    if (existing) existing.remove();
    var marker = document.createElement("div");
    marker.className = "back-marker";
    marker.textContent = "↓ 回到之前位置";
    marker.style.cssText = "text-align:center;padding:10px;color:var(--blue);font-size:12px;cursor:pointer;border-bottom:1px solid var(--sep);background:var(--bg);";
    marker.addEventListener("click", function () {
      window.scrollTo({ top: Math.min(y, document.body.scrollHeight), behavior: "smooth" });
      marker.remove();
    });
    // 插到第一个 flash-item 之前
    var firstFlash = CONTENT.querySelector(".flash-item");
    if (firstFlash) {
      CONTENT.insertBefore(marker, firstFlash);
    } else {
      CONTENT.appendChild(marker);
    }
  }

  // 声音提示
  function beep() {
    try {
      var ctx = _getAudioCtx();
      var now = ctx.currentTime;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = 880;
      gain.gain.setValueAtTime(.08, now);
      gain.gain.exponentialRampToValueAtTime(.001, now + .15);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + .15);
    } catch (_) {}
  }

  // Inline Loading
  function showInlineLoading() {
    CONTENT.innerHTML = '<div class="inline-loading"><span class="dot-spin"></span> 加载中...</div>';
  }
  function showInlineLoadingSmall() {
    // 追加模式用的小 loading
    var el = document.createElement("div");
    el.className = "inline-loading";
    el.style.padding = "16px";
    el.innerHTML = '<span class="dot-spin"></span>';
    CONTENT.appendChild(el);
    return el;
  }

  // ═══ Tab 切换 ═══════════════════════════
  function switchTab(tab) {
    if (STATE.tab === tab && CONTENT.children.length > 0) return;
    STATE.tab = tab;
    STATE.flashCursor = null; STATE.flashHasMore = true; STATE.flashLoading = false;
    STATE.newsCursor = null; STATE.newsHasMore = true; STATE.newsLoading = false;
    STATE.searchKeyword = "";
    closeDetail();

    $$(".tab-pill").forEach(function (el) { el.classList.toggle("active", el.dataset.tab === tab); });
    $$(".tabbar-item").forEach(function (el) { el.classList.toggle("active", el.dataset.tab === tab); });

    // SSE：只在快讯tab保持连接
    if (tab === "flash" && !flashSSE) connectFlashStream();
    else if (tab !== "flash" && flashSSE) { flashSSE.close(); flashSSE = null; }
    // 隐藏悬浮提示
    flashPending = 0; FLASH_TOAST.style.display = "none";

    showInlineLoading();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (tab === "flash") renderFlash();
    else if (tab === "news") renderNews();
    else if (tab === "quote") renderQuote();
    else if (tab === "calendar") renderCalendar();
  }

  $("#tabScroll").addEventListener("click", function (e) {
    var pill = e.target.closest(".tab-pill");
    if (!pill) return;
    switchTab(pill.dataset.tab);
  });

  $$(".tabbar-item").forEach(function (el) {
    el.addEventListener("click", function () { switchTab(el.dataset.tab); });
  });

  //  快讯

  function renderFlash(cursor) {
    if (STATE.flashLoading) return;
    STATE.flashLoading = true;

    if (cursor) showInlineLoadingSmall();

    authFetch("/api/flash?cursor=" + (cursor || ""))
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.code !== 0) return;
        var d = res.data || {};
        var items = d.items || [];
        STATE.flashCursor = d.next_cursor;
        STATE.flashHasMore = d.has_more;

        if (!cursor) {
          CONTENT.innerHTML = "";
          if (items.length === 0) {
            CONTENT.innerHTML = '<div class="empty-state"><div class="empty-icon">⚡</div><p>暂无快讯</p></div>';
            return;
          }
        } else {
          // 移除小 loading
          var spl = CONTENT.querySelector(".inline-loading");
          if (spl) spl.remove();
        }

        items.forEach(function (item) {
          var el = document.createElement("div");
          el.className = "flash-item";
          el.innerHTML =
            '<div class="flash-dot"></div>' +
            '<div class="flash-body">' +
            '<div class="flash-time">' + fmtTime(item.time || item.pub_time) + '</div>' +
            '<div class="flash-text">' + esc(item.title || item.content || item.text) + '</div>' +
            '</div>';
          CONTENT.appendChild(el);
        });
        if (STATE.flashHasMore) addSentinel("flash");
      })
      .catch(function () {})
      .finally(function () { STATE.flashLoading = false; });
  }

  //  资讯

  function renderNews(cursor) {
    if (STATE.newsLoading) return;
    STATE.newsLoading = true;

    var url = STATE.searchKeyword
      ? "/api/news/search?keyword=" + encodeURIComponent(STATE.searchKeyword) + "&cursor=" + (cursor || "")
      : "/api/news?cursor=" + (cursor || "");

    if (cursor) showInlineLoadingSmall();

    authFetch(url)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.code !== 0) return;
        var d = res.data || {};
        var items = d.items || [];
        STATE.newsCursor = d.next_cursor;
        STATE.newsHasMore = d.has_more;

        if (!cursor) {
          CONTENT.innerHTML = "";
          if (items.length === 0) {
            CONTENT.innerHTML = '<div class="empty-state"><div class="empty-icon">📰</div><p>暂无资讯</p></div>';
            return;
          }
        } else {
          var spl = CONTENT.querySelector(".inline-loading");
          if (spl) spl.remove();
        }

        items.forEach(function (item) {
          var el = document.createElement("div");
          el.className = "news-card";
          el.dataset.id = item.id;
          el.innerHTML =
            '<div class="news-title">' + esc(item.title) + '</div>' +
            '<div class="news-intro">' + esc(item.introduction || item.summary || "") + '</div>' +
            '<div class="news-time">' + fmtTime(item.time) + '</div>';
          el.addEventListener("click", function () { openDetail(item.id); });
          CONTENT.appendChild(el);
        });
        if (STATE.newsHasMore) addSentinel("news");
      })
      .catch(function () {})
      .finally(function () { STATE.newsLoading = false; });
  }

  //  行情 —— 全到齐统一渲染

  var CODES = ["XAUUSD", "XAGUSD", "USOIL", "UKOIL", "COPPER", "USDJPY", "EURUSD", "USDCNH"];

  function renderQuote() {
    // showInlineLoading 已在 switchTab 中调用
    var results = [];
    var todo = CODES.length;

    CODES.forEach(function (code) {
      authFetch("/api/quote/" + code)
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.code === 0 && res.data) results.push(res.data);
        })
        .finally(function () {
          todo--;
          if (todo === 0) {
            CONTENT.innerHTML = "";
            results.forEach(function (d) {
              var c = d.code || "";
              var nm = d.name || c || "";
              var price = d.close || d.price;
              // 跳过无有效价格的品种（如周末外汇）
              if (!price && !d.open && !d.high) return;
              var upsp = d.ups_price;
              var uppc = d.ups_percent;
              var hasChg = (upsp !== undefined && upsp !== null && upsp !== "") ||
                           (uppc !== undefined && uppc !== null && uppc !== "");
              var chgHtml = "";
              if (hasChg) {
                var numPc = parseFloat(uppc) || 0;
                var cls = numPc >= 0 ? "up" : "down";
                var sgn = numPc >= 0 ? "+" : "";
                chgHtml = '<div class="q-change ' + cls + '">' +
                  sgn + (upsp || "--") + "  " + sgn + (uppc || "--") + "%</div>";
              }
              var extras = [];
              if (d.open !== undefined && d.open !== null && d.open !== "") extras.push("开 " + d.open);
              if (d.high !== undefined && d.high !== null && d.high !== "") extras.push("高 " + d.high);
              if (d.low !== undefined && d.low !== null && d.low !== "") extras.push("低 " + d.low);
              if (d.volume !== undefined && d.volume !== null && d.volume !== "") extras.push("量 " + d.volume);
              var extraHtml = extras.length ? '<div class="q-extra">' + extras.map(function(e){return '<span>'+e+'</span>';}).join("") + '</div>' : "";

              var el = document.createElement("div");
              el.className = "quote-card";
              el.dataset.code = c;
              el.innerHTML =
                '<div class="q-row"><span class="q-name">' + esc(nm) + '</span><span class="q-code">' + esc(c) + '</span></div>' +
                '<div class="q-price">' + esc(String(price || "--")) + '</div>' +
                chgHtml + extraHtml;
              el.addEventListener("click", function () { toggleKline(c, el); });
              CONTENT.appendChild(el);
            });
          }
        });
    });
  }

  function toggleKline(code, cardEl) {
    var existing = cardEl.nextElementSibling;
    if (existing && existing.classList.contains("kline-panel")) { existing.remove(); return; }
    $$(".kline-panel").forEach(function (p) { p.remove(); });

    var panel = document.createElement("div");
    panel.className = "kline-panel";
    panel.innerHTML = '<div class="inline-loading" style="padding:20px"><span class="dot-spin"></span></div>';
    cardEl.after(panel);

    authFetch("/api/kline/" + code + "?count=40")
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.code !== 0 || !res.data) { panel.innerHTML = '<p style="color:var(--text2);text-align:center">暂无数据</p>'; return; }
        var d = res.data;
        var klines = d.klines || [];
        if (klines.length === 0) {
          panel.innerHTML = '<p style="color:var(--text2);text-align:center;padding:16px">暂无K线数据（可能休市）</p>';
          return;
        }
        panel.innerHTML = buildKlineChart(klines, d.name || code);
      })
      .catch(function () { panel.innerHTML = '<p style="color:var(--text2);text-align:center">加载失败</p>'; });
  }

  function buildKlineChart(klines, name) {
    var W = 360, H = 200, pad = { top: 8, bottom: 20, left: 48, right: 8 };
    var w = W - pad.left - pad.right, h = H - pad.top - pad.bottom;
    var min = Infinity, max = -Infinity;
    klines.forEach(function (k) {
      var lo = Math.min(+k.low, +k.open, +k.close), hi = Math.max(+k.high, +k.open, +k.close);
      if (lo < min) min = lo; if (hi > max) max = hi;
    });
    var range = max - min || 1;
    var scale = h / range;
    var barW = Math.max(2, Math.floor((w - klines.length * 1) / klines.length));
    var gap = Math.max(0, (w - barW * klines.length) / (klines.length + 1));

    var svg = '<svg class="kline-chart" viewBox="0 0 ' + W + ' ' + H + '" width="100%">';
    // 背景网格
    for (var i = 0; i <= 4; i++) {
      var yy = pad.top + (h * i / 4);
      svg += '<line x1="' + (pad.left) + '" y1="' + yy + '" x2="' + (W - pad.right) + '" y2="' + yy + '" stroke="var(--sep)" stroke-width="0.5"/>';
      svg += '<text x="' + (pad.left - 4) + '" y="' + (yy + 3) + '" fill="var(--text2)" font-size="9" text-anchor="end">' + (max - range * i / 4).toFixed(2) + '</text>';
    }
    // 蜡烛
    klines.forEach(function (k, i) {
      var open = +k.open, close = +k.close, high = +k.high, low = +k.low;
      var x = pad.left + gap + i * (barW + gap);
      var yOpen = pad.top + (max - Math.max(open, close)) * scale;
      var yClose = pad.top + (max - Math.min(open, close)) * scale;
      var yHigh = pad.top + (max - high) * scale;
      var yLow = pad.top + (max - low) * scale;
      var bodyH = Math.max(1, yClose - yOpen);
      var isUp = close >= open;
      var color = isUp ? 'var(--red)' : 'var(--green)';
      svg += '<line x1="' + (x + barW / 2) + '" y1="' + yHigh + '" x2="' + (x + barW / 2) + '" y2="' + yLow + '" stroke="' + color + '" stroke-width="1"/>';
      svg += '<rect x="' + x + '" y="' + yOpen + '" width="' + barW + '" height="' + bodyH + '" fill="' + color + '" rx="1"/>';
      // 时间标签
      if (i % Math.max(1, Math.floor(klines.length / 5)) === 0) {
        var ts = k.time;
        var t = '';
        if (typeof ts === 'number' && ts > 1e9) {
          var d = new Date(ts * 1000);
          t = ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
        } else {
          t = String(ts || '').slice(-5);
        }
        svg += '<text x="' + (x + barW / 2) + '" y="' + (H - 4) + '" fill="var(--text2)" font-size="8" text-anchor="middle">' + t + '</text>';
      }
    });
    svg += '</svg>';
    return '<div style="font-size:12px;font-weight:600;margin-bottom:6px">' + esc(name) + ' (' + klines.length + '条)</div>' + svg;
  }

  //  日历

  function renderCalendar() {
    authFetch("/api/calendar")
      .then(function (r) { return r.json(); })
      .then(function (res) {
        CONTENT.innerHTML = "";
        var raw = res.data || res;
        // 兼容数组或 {items:[]} 格式
        var items = Array.isArray(raw) ? raw : (raw.items || raw.data || []);
        if (items.length === 0) {
          CONTENT.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>暂无日历数据</p></div>';
          return;
        }
        items.forEach(function (item) {
          var stars = parseInt(item.star) || 0;
          var starHtml = stars >= 3 ? "⭐⭐⭐" : stars >= 2 ? "⭐⭐" : "⭐";
          var el = document.createElement("div");
          el.className = "cal-item";
          el.innerHTML =
            '<div class="cal-star">' + starHtml + '</div>' +
            '<div class="cal-body">' +
            '<div class="cal-title">' + esc(item.title || "") + '</div>' +
            '<div class="cal-time">' + fmtTime(item.pub_time) + '</div>' +
            '<div class="cal-values">前值:' + (item.previous || "--") +
            ' 预期:' + (item.consensus || "--") + ' 公布:' + (item.actual || "--") +
            (item.revised ? ' 修正:' + item.revised : "") + '</div>' +
            (item.affect_txt ? '<div class="cal-affect">影响: ' + esc(item.affect_txt) + '</div>' : "") +
            '</div>';
          CONTENT.appendChild(el);
        });
      })
      .catch(function () {});
  }

  //  详情页 Push

  function openDetail(id) {
    // 同一个文章不重复打开
    if (STATE.detailId === id) return;
    // 关闭前一个（仅清理状态，UI保持不变减少闪烁）
    STATE.detailId = id;
    STATE._reqId = (STATE._reqId || 0) + 1;
    var reqId = STATE._reqId;

    // 如果详情页未显示，做打开动画
    if (!DETAIL.classList.contains("open")) {
      DETAIL.style.display = "";
      DETAIL.classList.add("open");
      NAV_BACK.style.display = "flex";
      NAV_TITLE.textContent = "资讯详情";
      document.body.style.overflow = "hidden";
    }

    DETAIL_SCROLL.innerHTML = '<div class="inline-loading"><span class="dot-spin"></span> 加载中...</div>';

    authFetch("/api/news/" + id)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (reqId !== STATE._reqId) return;
        if (res.code !== 0) return;
        var d = res.data;
        var bodyHtml = fmtContent(d.content || d.introduction || "");
        var linkHtml = d.url
          ? '<a class="d-link" href="' + d.url.replace(/&/g,'&amp;').replace(/"/g,'"') + '" target="_blank" rel="noopener">查看原文 →</a>'
          : "";
        DETAIL_SCROLL.innerHTML =
          '<h2>' + esc(d.title) + '</h2>' +
          '<div class="d-meta">🕐 ' + fmtTime(d.time) + '</div>' +
          '<div class="d-body">' + bodyHtml + '</div>' + linkHtml;
      })
      .catch(function () { DETAIL_SCROLL.innerHTML = "<p>加载失败</p>"; });
  }

  function closeDetailNow() {
    DETAIL.classList.remove("open");
    DETAIL.style.display = "none";
  }

  function closeDetail() {
    if (!STATE.detailId) return;
    STATE.detailId = null;
    DETAIL.classList.remove("open");
    NAV_BACK.style.display = "none";
    NAV_TITLE.textContent = BRAND;
    document.body.style.overflow = "";
    setTimeout(function () { DETAIL.style.display = "none"; }, 350);
  }

  NAV_BACK.addEventListener("click", closeDetail);

  //  搜索

  $("#btnSearch").addEventListener("click", function () {
    SEARCH_BAR.style.display = "flex";
    SEARCH_INPUT.focus();
  });

  $("#searchCancel").addEventListener("click", function () {
    SEARCH_BAR.style.display = "none";
    SEARCH_INPUT.value = "";
    STATE.searchKeyword = "";
    if (STATE.tab === "news") { showInlineLoading(); renderNews(); }
  });

  SEARCH_INPUT.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var kw = SEARCH_INPUT.value.trim();
      if (!kw) return;
      STATE.searchKeyword = kw;
      switchTab("news");
      SEARCH_BAR.style.display = "none";
    }
  });

  //  无限滚动

  function addSentinel(type) {
    var s = document.createElement("div");
    s.className = "sentinel";
    s.dataset.type = type;
    CONTENT.appendChild(s);
  }

  var scrollTimer;
  window.addEventListener("scroll", function () {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      var sentinels = $$(".sentinel");
      if (!sentinels.length) return;
      var last = sentinels[sentinels.length - 1];
      var rect = last.getBoundingClientRect();
      if (rect.top < window.innerHeight + 300) {
        last.remove();
        var type = last.dataset.type;
        if (type === "flash" && STATE.flashHasMore && !STATE.flashLoading) {
          renderFlash(STATE.flashCursor);
        } else if (type === "news" && STATE.newsHasMore && !STATE.newsLoading) {
          renderNews(STATE.newsCursor);
        }
      }
    }, 100);
  }, { passive: true });

  //  工具

  function esc(s) {
    if (!s) return "";
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function fmtContent(text) {
    // 只处理 <URL> 格式链接，先转义再精确替换，绝不碰其他内容
    var html = esc(text);
    // 仅匹配 &lt;http(s)://...&gt; → 转为可点击链接
    html = html.replace(/&lt;(https?:\/\/[^&]+)&gt;/g, function(m, url) {
      return '<a href="' + url + '" target="_blank" rel="noopener" class="auto-link">' + url + '</a>';
    });
    // 换行
    html = html.replace(/\n/g, "<br>");
    return html;
  }

  function fmtTime(t) {
    if (!t) return "";
    try {
      var d = new Date(t.replace(/-/g, "/"));
      var now = new Date();
      var diff = now - d;
      if (diff < 60000) return "刚刚";
      if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
      if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
      if (diff < 604800000) return Math.floor(diff / 86400000) + "天前";
      return t.substring(0, 16);
    } catch (e) { return t; }
  }

  init();
})();