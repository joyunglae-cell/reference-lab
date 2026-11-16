/* 제휴광고 레퍼런스 랩 — 공통 유틸 · 메뉴 · 설정 · 기본 도구
   매출 현황은 dash.js, 광고·랜딩 분석은 analyze.js가 이어서 등록합니다. */
(function () {
  "use strict";
  var D = window.LAB_DATA;
  var $ = function (id) { return document.getElementById(id); };

  /* ───────── 저장소: store.js (브라우저 + claude.ai 계정 / GitHub Gist 동기화) ───────── */
  var store = window.LabStore;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function won(n) { return isFinite(n) ? Math.round(n).toLocaleString("ko-KR") + "원" : "—"; }
  function fmt(n, d) {
    return isFinite(n) ? n.toLocaleString("ko-KR", { maximumFractionDigits: d || 0, minimumFractionDigits: d || 0 }) : "—";
  }
  /* 강조 표시: **굵게** → 초록 강조, 숫자·단위·비율 → 색 강조 (먼저 escape) */
  function emph(t) {
    var h = esc(t);
    h = h.replace(/(?<![&#\d])(\d+(?:[.,]\d+)*(?:\s?×\s?\d+(?:[.,]\d+)*)?(?::\d+)?(?:~\d+(?:[.,]\d+)*)?(?:\s?(?:%p|%|만\s?원|원|초|일|개|건|배|회|세|주|px|명|시간))?)/g, function (m) {
      return /\d/.test(m) && /[%원초일개건배회세주px명간:×~]/.test(m) ? '<span class="hl">' + m + "</span>" : m;
    });
    return h.replace(/\*\*(.+?)\*\*/g, '<b class="em">$1</b>');
  }
  function pct(r, d) { return isFinite(r) ? fmt(r * 100, d == null ? 1 : d) + "%" : "—"; }
  var toastTimer;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function copyText(text, okMsg) {
    var fallback = function () {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      toast(ok ? okMsg : "복사하지 못했습니다. 브라우저가 클립보드를 막고 있습니다.");
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function fillSelect(el, items, keep) {
    var head = keep ? Array.prototype.slice.call(el.options, 0, keep).map(function (o) { return o.outerHTML; }).join("") : "";
    el.innerHTML = head + items.map(function (i) { return '<option value="' + esc(i[0]) + '">' + esc(i[1]) + "</option>"; }).join("");
  }
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : 0; }

  var catName = {}; D.categories.forEach(function (c) { catName[c.id] = c.name; });
  var chName = { etc: "기타" }; D.channels.forEach(function (c) { chName[c.id] = c.short; });
  var netName = { etc: "기타" }; D.networks.forEach(function (n) { netName[n.id] = n.name; });
  var hookName = {}; D.hooks.forEach(function (h) { hookName[h.id] = h.name; });
  var chOptions = D.channels.map(function (c) { return [c.id, c.short]; });
  function catById(id) { return D.categories.filter(function (c) { return c.id === id; })[0]; }
  function chById(id) { return D.channels.filter(function (c) { return c.id === id; })[0]; }

  /* ───────── 설정 ───────── */
  var DEFAULTS = {
    theme: "system", provider: "local", chosen: false,
    claudeKey: "", claudeModel: "claude-opus-5", geminiKey: "", geminiModel: "gemini-2.5-flash",
    web: true, marginMin: 30, marginMax: 40, vat: true, wht: true, netUrls: {}, goalProfit: 3000000, ghToken: "", gistId: "",
    taxMode: "person", aiLimit: 0, tgToken: "", tgChat: "", tgAuto: false, tgLast: "",
    imgModel: "gemini-2.5-flash-image", ytKey: ""
  };
  var S = Object.assign({}, DEFAULTS, store.get("settings", {}));
  function saveSettings() { store.set("settings", S); emit("settings"); }

  var listeners = {};
  function on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); }
  function emit(ev) { (listeners[ev] || []).forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }

  function marginStatus(m) {
    if (!isFinite(m)) return ["none", "기록 없음"];
    if (m < 0) return ["bad", "손실"];
    if (m * 100 < S.marginMin) return ["warn", "목표 미달"];
    if (m * 100 > S.marginMax) return ["good", "목표 초과"];
    return ["good", "목표 구간"];
  }

  /* 테마: '시스템'이면 뷰어(또는 OS)가 정한 값을 그대로 둡니다 */
  var hostTheme = document.documentElement.getAttribute("data-theme");
  function applyTheme() {
    var root = document.documentElement;
    if (S.theme === "light" || S.theme === "dark") root.setAttribute("data-theme", S.theme);
    else if (hostTheme) root.setAttribute("data-theme", hostTheme);
    else root.removeAttribute("data-theme");
  }
  applyTheme();

  /* ───────── 메뉴 ─────────
     예전 메뉴 이름(광고 분석, 채널 셋팅 등)으로 불러도 합쳐진 화면의 해당 탭으로 엽니다. */
  var views = ["merchant", "pick", "landing", "studio", "ops", "check", "dashboard", "assistant", "explore", "guide", "calc", "board", "history", "settings"];
  var alias = { rules: ["guide", "rules"], adlab: ["landing", "ad"], channels: ["guide", "channels"], media: ["guide", "media"], playbook: ["guide", "playbook"], hooks: ["guide", "hooks"] };
  var onShow = {};
  function guideTab(k) {
    if (!$("gTabs")) return;
    if (!$("gp-" + k)) k = "rules";
    document.querySelectorAll("#gTabs [data-g]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.g === k ? "true" : "false"); });
    document.querySelectorAll("#guide .gpane").forEach(function (p) { p.hidden = p.dataset.gp !== k; });
    store.set("gtab", k);
    if (onShow[k]) onShow[k]();
  }
  function anaTab(k) {
    if (!$("anaSeg")) return;
    k = k === "ad" ? "ad" : "lp";
    document.querySelectorAll("#anaSeg [data-ana]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.ana === k ? "true" : "false"); });
    $("anaLp").hidden = k !== "lp"; $("anaAd").hidden = k !== "ad";
    if (onShow[k === "ad" ? "adlab" : "lpform"]) onShow[k === "ad" ? "adlab" : "lpform"]();
  }
  function show(view, keepScroll) {
    var sub = null;
    if (alias[view]) { sub = alias[view][1]; view = alias[view][0]; }
    if (views.indexOf(view) < 0) view = "merchant";
    views.forEach(function (v) { if ($(v)) $(v).hidden = v !== view; });
    document.querySelectorAll(".menu button").forEach(function (b) {
      if (b.dataset.view === view) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
    var cur = document.querySelector('.menu button[aria-current="page"]');
    if (cur && window.innerWidth <= 900 && cur.scrollIntoView) { try { cur.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {} }
    store.set("tab", view);
    try { history.replaceState(null, "", "#" + view); } catch (e) {}
    if (view === "guide") guideTab(sub || store.get("gtab", "rules"));
    if (view === "landing") anaTab(sub || "lp");
    if (onShow[view]) onShow[view]();
    if (!keepScroll) window.scrollTo(0, 0);
    emit("view");
  }
  // 메뉴·로고·본문 어디서든 data-view / data-goto 버튼으로 이동
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-view],[data-goto]");
    if (!b || b.closest("#adOut,#lpOut,#adExample,#lpExample,#reportBox,#caseOut,#pvBody")) return;
    show(b.dataset.view || b.dataset.goto);
  });
  document.addEventListener("click", function (e) {
    var g = e.target.closest("#gTabs [data-g]"); if (g) { guideTab(g.dataset.g); return; }
    var a = e.target.closest("#anaSeg [data-ana]"); if (a) anaTab(a.dataset.ana);
  });

  /* ───────── 앱 설치 (PWA) ───────── */
  var topLevel = (function () { try { return window.top === window.self; } catch (e) { return false; } })();
  var inClaude = !!(window.claude && typeof window.claude.use === "function");
  var standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  var installEvt = null;
  if ("serviceWorker" in navigator && topLevel && !inClaude && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); installEvt = e; renderInstall(); });
  window.addEventListener("appinstalled", function () { installEvt = null; standalone = true; toast("앱을 설치했습니다. 홈 화면에서 열 수 있습니다"); renderInstall(); });
  function renderInstall() {
    var pill = $("installPill"); if (!pill) return;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var st;
    if (standalone) st = ["good", "설치됨", "지금 앱으로 실행 중입니다. 홈 화면 아이콘으로 바로 열 수 있습니다."];
    else if (!topLevel || inClaude) st = ["none", "여기선 불가", "claude.ai 안에서는 앱 설치가 되지 않습니다. Netlify(무료) 등 https로 올린 사이트 주소를 PC·휴대폰 브라우저로 열고 여기서 설치하세요."];
    else if (installEvt) st = ["good", "설치 가능", "아래 버튼을 누르면 홈 화면에 앱 아이콘이 생기고, 주소창 없이 앱처럼 열립니다."];
    else if (ios) st = ["warn", "수동 설치", "iPhone·iPad는 Safari 아래쪽 공유 버튼 → '홈 화면에 추가'를 누르세요."];
    else if (location.protocol === "file:") st = ["good", "PC 파일 버전", "PC에 저장한 파일로 실행 중입니다. 브라우저 즐겨찾기나 바탕화면 바로가기로 여세요. 기록은 이 PC의 이 브라우저에 저장되니, 휴대폰과 같이 쓰려면 설정의 GitHub 연결(동기화)을 켜세요. 앱 설치는 Netlify 등 https 주소에서 됩니다."];
    else if (!/^https:$/.test(location.protocol) && location.hostname !== "localhost") st = ["warn", "https 필요", "앱 설치는 https 주소(Netlify·GitHub Pages 등)에서만 됩니다."];
    else st = ["warn", "수동 설치", "브라우저 메뉴(⋮) → '앱 설치' 또는 '홈 화면에 추가'를 누르세요."];
    pill.className = "pill " + st[0]; pill.textContent = st[1];
    $("installText").textContent = st[2];
    $("installBtn").hidden = !installEvt || standalone;
  }

  /* ───────── 모바일 뒤로가기: 한 번은 머무름, 2초 안에 두 번이면 종료 ───────── */
  (function backGuard() {
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (!topLevel || inClaude || !(coarse || standalone) || !window.history || !history.pushState) return;
    var armed = false, timer = null;
    function guard() { try { history.pushState({ reflabGuard: 1 }, "", location.href); } catch (e) {} }
    guard();
    window.addEventListener("popstate", function () {
      var pv = $("preview");
      if (pv && !pv.hidden) { $("pvClose").click(); guard(); return; }
      if (armed) return; // 두 번째: 막지 않고 그대로 나가도록 둠 (다음 뒤로가기가 앱·사이트 종료)
      armed = true;
      toast("한 번 더 누르면 종료됩니다");
      clearTimeout(timer);
      // 두 번째 입력이 곧바로 종료되도록 가드를 다시 쌓지 않다가, 2초가 지나면 다시 쌓음
      timer = setTimeout(function () { armed = false; guard(); }, 2000);
    });
  })();

  /* ───────── 레퍼런스 탐색 ───────── */
  function refLinks(q, opt) {
    opt = opt || {};
    var k = encodeURIComponent(q);
    var plat = opt.platform || "";
    var meta = "https://www.facebook.com/ads/library/?active_status=" + (opt.active || "active") +
      "&ad_type=all&country=KR&q=" + k + "&search_type=keyword_unordered&media_type=" + (opt.media || "all") +
      (plat ? "&publisher_platforms[0]=" + plat : "");
    return [
      { t: "Meta 광고 라이브러리", d: "페북·인스타 집행 광고 · 게재일/버전 확인", u: meta },
      { t: "틱톡 검색", d: "숏폼 자연 콘텐츠 + 스파크 광고 톤", u: "https://www.tiktok.com/search?q=" + k },
      { t: "틱톡 Top Ads", d: "업종 필터 후 성과 상위 광고", u: "https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/ko" },
      { t: "유튜브 쇼츠 검색", d: "정보형 쇼츠 훅·자막 스타일", u: "https://www.youtube.com/results?search_query=" + encodeURIComponent(q + " #shorts") },
      { t: "Google 광고 투명성 센터", d: "경쟁 광고주 이름으로 유튜브 광고 조회", u: "https://adstransparency.google.com/?region=KR" },
      { t: "네이버 지식iN", d: "고객의 실제 질문 = 훅 원재료", u: "https://search.naver.com/search.naver?where=kin&query=" + k },
      { t: "인스타 해시태그", d: "UGC 톤·비주얼 참고", u: "https://www.instagram.com/explore/tags/" + encodeURIComponent(q.replace(/\s+/g, "")) + "/" },
      { t: "구글 검색", d: "업종 광고 사례·후기 글", u: "https://www.google.com/search?q=" + encodeURIComponent(q + " 광고 소재 사례") }
    ];
  }
  function linkCards(list) {
    return list.map(function (l) {
      return '<a href="' + esc(l.u) + '" target="_blank" rel="noopener noreferrer"><b>' + esc(l.t) + " →</b><small>" + esc(l.d) + "</small></a>";
    }).join("");
  }
  function goExplore(q) {
    $("q").value = q; show("explore");
    if (window.Lab && window.Lab.refs) window.Lab.refs.search();
  }

  /* ───────── 보드 ───────── */
  var board = store.get("board", []);
  function score(r) {
    return Math.round(Math.min((r.days || 0) / 60, 1) * 50 + Math.min(((r.versions || 1) - 1) / 4, 1) * 30 + (r.note && r.note.length >= 20 ? 20 : 0));
  }
  function addToBoard(r) {
    r.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    r.days = Math.max(0, +r.days || 0);
    r.versions = Math.max(1, +r.versions || 1);
    r.date = new Date().toISOString().slice(0, 10);
    board.unshift(r);
    store.set("board", board);
    toast("보드에 저장했습니다 (" + board.length + "개)");
  }
  var boardFilter = "all";
  var boardExamples = [
    { id: "ex1", url: "https://www.facebook.com/ads/library/", channel: "meta", cat: "insurance", hook: "callout", days: 74, versions: 6,
      note: "예시 · 첫 화면 '40대 이상 운전자라면' 큰 자막 + 상담사 얼굴, 폼 3문항, 버튼 '내 보험료 확인'", date: "예시" },
    { id: "ex2", url: "https://business.kakao.com/", channel: "kakao", cat: "rental", hook: "number", days: 21, versions: 2,
      note: "예시 · 비즈보드 '정수기 월 1만원대 + 현금 사은품' 오브젝트 이미지", date: "예시" }
  ];
  function renderBoard() {
    document.querySelectorAll("#boardFilter button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.bf === boardFilter ? "true" : "false");
    });
    var ex = !board.length;
    var items = (ex ? boardExamples : board).filter(function (r) { return boardFilter === "all" || r.channel === boardFilter; })
      .slice().sort(function (a, b) { return score(b) - score(a); });
    var head = ex ? '<p class="empty" style="grid-column:1/-1">아직 저장한 레퍼런스가 없어 예시 2개를 보여 줍니다. 레퍼런스 탐색이나 광고 분석에서 저장하면 사라집니다.</p>' : "";
    if (!items.length) { $("cards").innerHTML = '<p class="empty">이 채널에 저장한 레퍼런스가 없습니다.</p>'; return; }
    $("cards").innerHTML = head + items.map(function (r) {
      var s = score(r);
      var safeUrl = /^https?:\/\//i.test(r.url) ? r.url : "#";
      return '<article class="panel ref' + (ex ? " example" : "") + '"><header><span class="score ' + (s >= 60 ? "s-hi" : "s-mid") + '">' + s + "점</span>" +
        '<div class="row"><span class="tag">' + esc(chName[r.channel] || r.channel) + '</span><span class="tag">' + esc(catName[r.cat] || r.cat || "업종 미지정") + "</span></div></header>" +
        '<div class="row"><span class="tag hi">' + esc(hookName[r.hook] || r.hook || "훅 미지정") + '</span><span class="note num">게재 ' + r.days + "일 · 버전 " + r.versions + "개 · " + esc(r.date) + "</span></div>" +
        (r.note ? "<p>" + esc(r.note) + "</p>" : "") +
        '<a href="' + esc(safeUrl) + '" target="_blank" rel="noopener noreferrer">' + esc(r.url) + "</a>" +
        (ex ? "" : '<div class="row"><button class="btn ghost sm" type="button" data-rm="' + esc(r.id) + '">삭제</button></div>') + "</article>";
    }).join("");
  }
  function initBoard() {
    $("boardFilter").innerHTML = [["all", "전체"]].concat(chOptions).map(function (o) {
      return '<button type="button" data-bf="' + o[0] + '">' + esc(o[1]) + "</button>";
    }).join("");
    $("boardFilter").addEventListener("click", function (e) {
      var b = e.target.closest("[data-bf]"); if (!b) return;
      boardFilter = b.dataset.bf; renderBoard();
    });
    $("cards").addEventListener("click", function (e) {
      var b = e.target.closest("[data-rm]"); if (!b) return;
      board = board.filter(function (r) { return r.id !== b.dataset.rm; });
      store.set("board", board); renderBoard(); toast("삭제했습니다");
    });
    $("nets").innerHTML = D.networks.map(function (n) {
      return '<div class="net"><header><b>' + esc(n.name) + '</b><span class="tag">' + esc(n.model) + "</span>" +
        '<a href="https://www.google.com/search?q=' + encodeURIComponent(n.name + " 제휴마케팅") + '" target="_blank" rel="noopener noreferrer" class="note">공식 사이트 찾기 →</a></header>' +
        "<p>" + esc(n.note) + "</p></div>";
    }).join("");
    var checks = store.get("checks", {});
    $("netCheck").innerHTML = D.networkChecklist.map(function (c, i) {
      return '<li><label><input type="checkbox" id="nc' + i + '" data-c="' + i + '"' + (checks[i] ? " checked" : "") + "> <span>" + esc(c) + "</span></label></li>";
    }).join("");
    $("netCheck").addEventListener("change", function (e) {
      if (e.target.dataset.c == null) return;
      checks[e.target.dataset.c] = e.target.checked; store.set("checks", checks);
    });
    onShow.board = renderBoard;
  }

  /* ───────── 업종 플레이북 ───────── */
  function initPlaybook() {
    $("cats").innerHTML = D.categories.map(function (c) {
      return '<article class="panel cat"><header><h4>' + esc(c.name) + '</h4><span class="tag hi">' + esc(c.tag) + "</span></header>" +
        '<dl class="kv"><dt>타깃</dt><dd>' + esc(c.target) + "</dd>" +
        "<dt>추천 채널</dt><dd>" + c.channels.map(function (id, i) { return i === 0 ? '<span class="tag blue">1순위 ' + esc(chName[id]) + "</span>" : esc(chName[id]); }).join(" · ") + "</dd>" +
        "<dt>앵글</dt><dd>" + c.angles.map(esc).join(" / ") + "</dd>" +
        "<dt>고객 고민</dt><dd>" + esc(c.pain) + "</dd></dl>" +
        '<div class="avoid"><b>피할 표현</b> ' + esc(c.avoid) + (c.check ? " <b>심의·정책 확인 필수.</b>" : "") + "</div>" +
        '<div class="kwrow">' + c.keywords.map(function (k) { return '<button class="chip" type="button" data-go="' + esc(k) + '">' + esc(k) + "</button>"; }).join("") + "</div></article>";
    }).join("");
    $("cats").addEventListener("click", function (e) {
      var b = e.target.closest("[data-go]"); if (b) goExplore(b.dataset.go);
    });
  }

  /* ───────── 채널 셋팅 ───────── */
  var ruleClass = { "끄기": "off", "지켜보기": "watch", "증액": "up", "교체": "swap" };
  function renderChannel(id) {
    var c = chById(id) || D.channels[0];
    document.querySelectorAll("#chTabs button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.ch === c.id ? "true" : "false"); });
    var fits = D.categories.filter(function (k) { return k.channels[0] === c.id; }).map(function (k) { return k.name; });
    var med = (D.media || []).filter(function (m) { return m.id === c.id; })[0];
    if (!fits.length && med) fits = med.fit.map(function (id) { return catName[id]; }).filter(Boolean);
    $("chBody").innerHTML =
      '<div class="chbody">' +
        '<div class="panel stack"><h3 class="sub">' + esc(c.name) + '</h3><p class="fitline">' + emph(c.fit) + "</p>" +
          (fits.length ? '<p class="note">' + (med && !D.categories.some(function (k) { return k.channels[0] === c.id; }) ? "잘 맞는 업종" : "이 채널이 1순위인 업종") + ': <b>' + fits.map(esc).join(", ") + "</b></p>" : "") +
          '<table class="specs">' + c.specs.map(function (s) { return "<tr><th>" + esc(s[0]) + "</th><td>" + emph(s[1]) + "</td></tr>"; }).join("") + "</table>" +
          '<p class="policy"><b>정책 주의</b> ' + emph(c.policy) + "</p>" +
          (window.Lab && window.Lab.studio && window.Lab.studio.has(c.id) ? '<div class="row"><button class="btn blue sm" type="button" data-stopen="' + c.id + '">이 채널 광고 제작 전략 · 셋팅값 보기</button></div>' : "") + "</div>" +
        '<div class="panel stack"><h3 class="sub">셋팅 순서</h3><ol class="steps">' +
          c.structure.map(function (s, i) { return "<li" + (i === 0 ? ' class="first"' : "") + ">" + emph(s) + "</li>"; }).join("") + "</ol>" +
          '<h3 class="sub">운영 규칙</h3><div class="rules">' +
          c.rules.map(function (r) { return '<div class="rule ' + ruleClass[r[0]] + '"><span class="pill ' + ruleClass[r[0]] + '">' + esc(r[0]) + "</span><span>" + emph(r[1]) + "</span></div>"; }).join("") +
        "</div></div>" +
      "</div>";
    store.set("ch", c.id);
  }
  function initChannels() {
    $("chTabs").innerHTML = D.channels.map(function (c) { return '<button type="button" data-ch="' + c.id + '">' + esc(c.name) + "</button>"; }).join("");
    $("chTabs").addEventListener("click", function (e) { var b = e.target.closest("[data-ch]"); if (b) renderChannel(b.dataset.ch); });
    $("chBody").addEventListener("click", function (e) { var b = e.target.closest("[data-stopen]"); if (b && window.Lab.studio) window.Lab.studio.open(b.dataset.stopen); });
    $("compliance").innerHTML = D.compliance.map(function (c) { return "<div><b>" + esc(c.k) + "</b><span>" + emph(c.v) + "</span></div>"; }).join("");
    $("trends").innerHTML = D.trends.map(function (c) { return "<div><b>" + esc(c.k) + "</b><span>" + emph(c.v) + "</span></div>"; }).join("");
    renderChannel(store.get("ch", "meta"));
    $("chAsOf").textContent = D.contentAsOf || "";
    $("chCheck").addEventListener("click", function () {
      var c = chById(store.get("ch", "meta")) || D.channels[0];
      show("assistant");
      $("chatText").value = c.name + "의 최근 6개월 광고 정책·소재 규격·캠페인 유형 변경 사항을 웹에서 찾아, 아래 내 기준 정보와 달라진 점만 표로 정리해줘(출처 링크 포함). 기준 정보: " +
        c.specs.map(function (x) { return x[0] + " " + x[1]; }).join(" / ") + " / 정책: " + c.policy.replace(/\*\*/g, "");
      $("chatText").focus();
      toast("AI 비서에 질문을 준비했습니다. 웹 검색이 되는 Claude API·Gemini에서 보내기를 누르세요");
    });
  }

  /* ───────── 소재 공식 ───────── */
  function fillHook(tpl, c) {
    var t = c.target.split(",")[0].trim();
    var code = t.charCodeAt(t.length - 1) - 0xac00;
    var josa = code >= 0 && code <= 11171 && code % 28 ? "이라면" : "라면";
    return tpl.replace("{target}", t).replace("{이라면}", josa)
      .replace("{pain}", c.pain).replace("{benefit}", c.benefit)
      .replace("{number}", c.number).replace("{keyword}", c.keywords[0]);
  }
  /* 훅마다 현재 보여 주는 문장 번호와 AI로 만든 추가 문장 */
  var hookIdx = {}, hookExtra = {}, hookCat = null;
  function hookPool(h) { return h.alts.concat(hookExtra[hookCat + ":" + h.id] || []); }
  function hookLine(h, c) {
    var pool = hookPool(h), i = hookIdx[h.id] || 0;
    var t = pool[i % pool.length];
    return /\{/.test(t) ? fillHook(t, c) : t; // AI 문장은 이미 완성형
  }
  function renderHookCard(h, c) {
    var pool = hookPool(h), i = (hookIdx[h.id] || 0) % pool.length, line = hookLine(h, c);
    return '<div class="hook" data-hid="' + h.id + '"><div><div class="row"><span class="tag blue">' + esc(h.name) + '</span><span class="hookno">' + (i + 1) + " / " + pool.length + "</span></div><b>" + esc(line) + "</b><small>" + esc(h.note) + "</small></div>" +
      '<div class="hookbtns"><button class="btn ghost sm" type="button" data-refresh="' + h.id + '" title="다른 문장 보기" aria-label="' + esc(h.name) + ' 새로고침">↻ 새로</button>' +
      (S.provider !== "local" ? '<button class="btn ghost sm" type="button" data-aihook="' + h.id + '" title="AI로 새 문장 3개 만들기">AI 생성</button>' : "") +
      '<button class="btn ghost sm" type="button" data-copy="' + esc(line) + '">복사</button></div></div>';
  }
  function renderHooks(id) {
    var c = catById(id) || D.categories[0];
    if (hookCat !== c.id) { hookIdx = {}; hookCat = c.id; }
    document.querySelectorAll("#hookCats button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.hc === c.id ? "true" : "false"); });
    $("hookOut").innerHTML = D.hooks.map(function (h) { return renderHookCard(h, c); }).join("");
    var steps = [
      ["0–2초", "훅 한 줄을 큰 자막으로. 예: " + hookLine(D.hooks[0], c)],
      ["2–6초", "공감: " + c.pain + ". 고객이 실제로 쓰는 말투로."],
      ["6–11초", "해결: " + c.benefit + ". 근거 숫자(" + c.number + ")를 화면에."],
      ["11–15초", "CTA: '아래 버튼으로 무료 확인' + 신청이 1분이면 끝난다는 부담 낮추기."],
      ["자막", "모든 대사를 자막으로. 소리 없이 봐도 이해되게."],
      ["주의", c.avoid]
    ];
    $("script").innerHTML = steps.map(function (s) { return "<div><span>" + esc(s[0]) + "</span><p>" + emph(s[1]) + "</p></div>"; }).join("");
    store.set("hc", c.id);
  }
  function refreshHook(hid) {
    var h = D.hooks.filter(function (x) { return x.id === hid; })[0], c = catById(hookCat);
    if (!h || !c) return;
    var n = hookPool(h).length;
    hookIdx[hid] = ((hookIdx[hid] || 0) + 1) % n;
    var card = document.querySelector('#hookOut [data-hid="' + hid + '"]');
    if (card) card.outerHTML = renderHookCard(h, c);
  }
  function aiHook(hid, btn) {
    var h = D.hooks.filter(function (x) { return x.id === hid; })[0], c = catById(hookCat);
    if (!h || !c) return;
    btn.disabled = true; btn.textContent = "생성 중…";
    var have = hookPool(h).map(function (t) { return /\{/.test(t) ? fillHook(t, c) : t; });
    var prompt = "한국 퍼포먼스 광고(숏폼·피드) 첫 문장 카피라이터로서, '" + h.name + "' 유형의 훅 문장 3개를 새로 만들어 주세요.\n" +
      "업종: " + c.name + " / 타깃: " + c.target + " / 고객 고민: " + c.pain + " / 혜택: " + c.benefit + "\n" +
      "유형 설명: " + h.note + "\n피할 표현: " + c.avoid + "\n이미 있는 문장(중복 금지): " + have.join(" | ") + "\n" +
      "조건: 각 30자 안팎, 단정·과장 금지, 후기형이면 앞에 [광고] 표기. 번호 없이 한 줄에 하나씩, 문장만 출력.";
    window.LabAI.run({ provider: S.provider, settings: Object.assign({}, S, { web: false }), prompt: prompt, onText: function () {} })
      .then(function (t) {
        var lines = String(t || "").split("\n").map(function (x) { return x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/^["']|["']$/g, "").trim(); })
          .filter(function (x) { return x && x.length <= 80 && !/^#/.test(x); }).slice(0, 3);
        if (!lines.length) throw new Error("새 문장을 받지 못했습니다.");
        var key = hookCat + ":" + hid;
        hookExtra[key] = (hookExtra[key] || []).concat(lines);
        hookIdx[hid] = h.alts.length + hookExtra[key].length - lines.length;
        var card = document.querySelector('#hookOut [data-hid="' + hid + '"]');
        if (card) card.outerHTML = renderHookCard(h, c);
        toast("새 훅 " + lines.length + "개를 만들었습니다. ↻로 넘겨 보세요");
      })
      .catch(function (e) { btn.disabled = false; btn.textContent = "AI 생성"; toast((e && e.message) || "AI 생성에 실패했습니다"); });
  }
  function initHooks() {
    $("hookCats").innerHTML = D.categories.map(function (c) { return '<button type="button" data-hc="' + c.id + '">' + esc(c.name) + "</button>"; }).join("");
    $("hookCats").addEventListener("click", function (e) { var b = e.target.closest("[data-hc]"); if (b) renderHooks(b.dataset.hc); });
    $("hookOut").addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy],[data-refresh],[data-aihook]"); if (!b) return;
      if (b.dataset.refresh) refreshHook(b.dataset.refresh);
      else if (b.dataset.aihook) aiHook(b.dataset.aihook, b);
      else copyText(b.dataset.copy, "문구를 복사했습니다");
    });
    $("hookAll").addEventListener("click", function () { D.hooks.forEach(function (h) { refreshHook(h.id); }); renderHooks(hookCat); });
    renderHooks(store.get("hc", "insurance"));
    onShow.hooks = function () { renderHooks(hookCat || "insurance"); };
  }

  /* ───────── 수익 계산기 ───────── */
  var calcDefaults = { cPayout: 35000, cApprove: 70, cCpm: 6000, cCtr: 1.2, cCvr: 4, cBudget: 100000, cMargin: 35, cFixed: 0, cVat: true, cWht: true };
  var log = store.get("log", []);
  var logExamples = [
    { name: "실비_대상호출_릴스", ch: "meta", spend: 150000, leads: 9, appr: 6, payout: 35000 },
    { name: "렌탈_현금사은품_비즈보드", ch: "kakao", spend: 200000, leads: 14, appr: 11, payout: 20000 },
    { name: "자격증_무료_UGC", ch: "tiktok", spend: 80000, leads: 12, appr: 7, payout: 8000 }
  ];
  /* 목표 순수익률 m을 지키는 DB 1건당 최대 광고비(부가세 포함) */
  function maxCPL(payout, approve, m, wht) { return payout * approve * (1 - (wht ? 0.033 : 0) - m); }

  function runCalc() {
    var v = {};
    Object.keys(calcDefaults).forEach(function (k) {
      var el = $(k); v[k] = el.type === "checkbox" ? el.checked : (parseFloat(el.value) || 0);
    });
    store.set("calc", v);
    var P = v.cPayout, a = v.cApprove / 100, ctr = v.cCtr / 100, cvr = v.cCvr / 100, m = v.cMargin / 100;
    var vat = v.cVat ? 1.1 : 1, w = v.cWht ? 0.033 : 0;
    var cost = v.cBudget * vat;
    var impr = v.cCpm > 0 ? v.cBudget / v.cCpm * 1000 : 0;
    var clicks = impr * ctr, leads = clicks * cvr, appr = leads * a;
    var gross = appr * P, net = gross * (1 - w), profit = net - cost;
    var margin = gross > 0 ? profit / gross : -Infinity;
    var mCPL = maxCPL(P, a, m, v.cWht), mCPC = mCPL * cvr, mCPM = mCPC * ctr * 1000 / vat;
    var cpc = clicks > 0 ? cost / clicks : Infinity, cpl = leads > 0 ? cost / leads : Infinity;
    var needCvr = mCPL > 0 && isFinite(cpc) ? cpc / mCPL : Infinity;

    var cls = margin >= m ? "good" : margin >= 0 ? "warn" : "bad";
    var msg = cls === "good"
      ? "목표 순수익률을 넘습니다. 3일 연속 유지되면 예산을 하루 20%씩 늘리며 스케일하세요."
      : cls === "warn"
        ? "이익은 나지만 목표에 못 미칩니다. DB당 광고비를 " + won(mCPL) + " 이하로 낮추거나(소재 CTR·랜딩 신청률 개선) 단가가 더 높은 캠페인을 찾으세요."
        : "손실 구간입니다. 소재를 교체하거나 채널·타깃을 바꾸고, 같은 캠페인이 다른 네트워크에 더 높은 단가로 있는지 확인하세요.";
    $("verdict").className = "verdict " + cls;
    $("verdict").innerHTML = '<span class="m">' + (isFinite(margin) ? pct(margin) : "—") + "</span><p><b>매출 대비 순수익률.</b> " + esc(msg) + "</p>";

    function lim(label, val, now) {
      var state = val > 0 && isFinite(now) ? (now <= val ? '<span class="ok">여유 있음</span>' : '<span class="over">초과</span>') : "";
      return '<div class="limit"><small>' + label + "</small><b>" + (val > 0 ? won(val) : "불가") + "</b><span>현재 " + (isFinite(now) ? won(now) : "—") + " " + state + "</span></div>";
    }
    $("limits").innerHTML = lim("DB 1건당 최대 광고비", mCPL, cpl) + lim("최대 CPC", mCPC, cpc) + lim("최대 CPM (부가세 전)", mCPM, v.cCpm) +
      '<div class="limit"><small>지금 CPC로 필요한 신청률</small><b>' + (isFinite(needCvr) ? pct(needCvr) : "—") + "</b><span>현재 " + fmt(v.cCvr, 1) + "%</span></div>";

    function funnel(k, fixed) {
      fixed = fixed || 0;
      return "<tr><td>노출</td><td>" + fmt(impr * k) + "회</td></tr><tr><td>클릭</td><td>" + fmt(clicks * k) + "회</td></tr>" +
        "<tr><td>DB 신청</td><td>" + fmt(leads * k, 1) + "건</td></tr><tr><td>승인 DB</td><td>" + fmt(appr * k, 1) + "건</td></tr>" +
        "<tr><td>매출</td><td>" + won(gross * k) + "</td></tr><tr><td>광고비" + (v.cVat ? " (VAT 포함)" : "") + "</td><td>−" + won(cost * k) + "</td></tr>" +
        (w ? "<tr><td>원천징수 3.3%</td><td>−" + won(gross * w * k) + "</td></tr>" : "") +
        (fixed ? "<tr><td>고정비 (도메인·호스팅·툴)</td><td>−" + won(fixed) + "</td></tr>" : "") +
        '<tr class="total"><td>순수익</td><td class="' + (profit * k - fixed >= 0 ? "pos" : "neg") + '">' + won(profit * k - fixed) + "</td></tr>" +
        (gross > 0 ? "<tr><td>ROAS (매출 ÷ 광고비)</td><td>" + fmt(gross / cost * 100) + "%</td></tr>" : "");
    }
    $("funnelDay").innerHTML = funnel(1);
    $("funnelMonth").innerHTML = funnel(30, v.cFixed);
    renderLog();
  }
  function logRowCalc(r) {
    var vat = $("cVat").checked ? 1.1 : 1, w = $("cWht").checked ? 0.033 : 0, m = num("cMargin") / 100;
    var cost = r.spend * vat, gross = r.appr * r.payout, profit = gross * (1 - w) - cost;
    var margin = gross > 0 ? profit / gross : -Infinity;
    return { cpl: r.leads ? cost / r.leads : Infinity, rate: r.leads ? r.appr / r.leads : 0, gross: gross, profit: profit, margin: margin,
      verdict: margin >= m ? ["up", "스케일"] : margin >= 0 ? ["watch", "개선"] : ["off", "중단"] };
  }
  function renderLog() {
    var rows = log.length ? log : logExamples, ex = !log.length;
    var head = '<tr><th>소재명</th><th>채널</th><th class="n">광고비</th><th class="n">DB</th><th class="n">승인</th><th class="n">단가</th><th class="n">DB당 비용</th><th class="n">승인율</th><th class="n">매출</th><th class="n">순수익</th><th class="n">순수익률</th><th>판정</th><th></th></tr>';
    var body = rows.map(function (r, i) {
      var c = logRowCalc(r);
      var cells = ex
        ? "<td>" + esc(r.name) + "</td><td>" + esc(chName[r.ch]) + '</td><td class="n">' + won(r.spend) + '</td><td class="n">' + r.leads + '</td><td class="n">' + r.appr + '</td><td class="n">' + won(r.payout) + "</td>"
        : '<td><input type="text" data-i="' + i + '" data-k="name" value="' + esc(r.name) + '" aria-label="소재명"></td>' +
          '<td><select data-i="' + i + '" data-k="ch" aria-label="채널">' + chOptions.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === r.ch ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select></td>" +
          [["spend", "광고비"], ["leads", "DB"], ["appr", "승인"], ["payout", "단가"]].map(function (k) {
            return '<td><input type="number" min="0" data-i="' + i + '" data-k="' + k[0] + '" value="' + r[k[0]] + '" aria-label="' + k[1] + '"></td>';
          }).join("");
      return "<tr" + (ex ? ' class="ex"' : "") + ">" + cells +
        '<td class="n">' + won(c.cpl) + '</td><td class="n">' + pct(c.rate, 0) + '</td><td class="n">' + won(c.gross) +
        '</td><td class="n ' + (c.profit >= 0 ? "pos" : "neg") + '">' + won(c.profit) + '</td><td class="n">' + (isFinite(c.margin) ? pct(c.margin) : "—") +
        '</td><td><span class="pill ' + c.verdict[0] + '">' + c.verdict[1] + "</span></td>" +
        "<td>" + (ex ? "" : '<button class="x" type="button" data-del="' + i + '" aria-label="행 삭제">×</button>') + "</td></tr>";
    }).join("");
    $("log").innerHTML = "<thead>" + head + "</thead><tbody>" + body + "</tbody>";
  }
  function setCalc(values) {
    Object.keys(values).forEach(function (k) { if ($(k)) $(k).value = values[k]; });
    runCalc();
  }
  function initCalc() {
    var st = Object.assign({}, calcDefaults, store.get("calc", {}));
    Object.keys(calcDefaults).forEach(function (k) {
      var el = $(k);
      if (el.type === "checkbox") el.checked = !!st[k]; else el.value = st[k];
      el.addEventListener("input", runCalc);
    });
    $("log").addEventListener("change", function (e) {
      var t = e.target; if (t.dataset.i == null) return;
      var r = log[+t.dataset.i]; if (!r) return;
      r[t.dataset.k] = t.type === "number" ? Math.max(0, parseFloat(t.value) || 0) : t.value;
      store.set("log", log); renderLog();
    });
    $("log").addEventListener("click", function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      log.splice(+b.dataset.del, 1); store.set("log", log); renderLog();
    });
    $("logAdd").addEventListener("click", function () {
      log.push({ name: "새 소재 " + (log.length + 1), ch: "meta", spend: 0, leads: 0, appr: 0, payout: num("cPayout") });
      store.set("log", log); renderLog();
    });
    runCalc();
  }

  /* ───────── 텔레그램 알림 ───────── */
  function L() { return window.Lab; }
  function sendTelegram(text) {
    if (!S.tgToken || !S.tgChat) return Promise.reject(new Error("봇 토큰과 대화 ID를 먼저 넣으세요."));
    var url = "https://api.telegram.org/bot" + encodeURIComponent(S.tgToken).replace(/%3A/gi, ":") + "/sendMessage";
    var body = new URLSearchParams({ chat_id: S.tgChat, text: text, disable_web_page_preview: "true" });
    return fetch(url, { method: "POST", body: body }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.ok === false) throw new Error("텔레그램 오류: " + (j.description || ("HTTP " + r.status)) + " (토큰·대화 ID를 확인하세요)");
        return "보냈습니다. 텔레그램을 확인하세요.";
      });
    }, function () {
      // 브라우저가 응답 읽기를 막는 경우: 응답 없이 전송만 시도
      return fetch(url, { method: "POST", body: body, mode: "no-cors" }).then(function () { return "전송 요청을 보냈습니다. 텔레그램에서 도착했는지 확인하세요."; },
        function () { throw new Error("텔레그램에 연결하지 못했습니다. (claude.ai 미리보기 안에서는 외부 전송이 막혀 있습니다)"); });
    });
  }
  function autoTelegram() {
    var today = new Date().toISOString().slice(0, 10);
    if (!S.tgAuto || !S.tgToken || !S.tgChat || S.tgLast === today || !L().dash) return;
    sendTelegram(L().dash.summaryText()).then(function () { S.tgLast = today; saveSettings(); }, function () {});
  }

  /* ───────── 설정 화면 ───────── */
  var builtinReady = false;
  var provLabel = { local: "AI 꺼짐 (기본 분석)", builtin: "Claude (claude.ai 내장)", claude: "Claude API", gemini: "Gemini API" };
  function aiReady() {
    if (S.provider === "claude") return !!S.claudeKey;
    if (S.provider === "gemini") return !!S.geminiKey;
    if (S.provider === "builtin") return builtinReady;
    return false;
  }
  function renderAiState() {
    var links = D.networks.filter(function (n) { return S.netUrls[n.id]; }).map(function (n) {
      return '<a href="' + esc(S.netUrls[n.id]) + '" target="_blank" rel="noopener noreferrer">' + esc(n.name) + " →</a>";
    });
    var ss = syncState();
    $("aiState").innerHTML = '<div><span class="dot ' + (ss[0] === "good" ? "on" : ss[0] === "bad" ? "bad" : ss[0] === "warn" ? "warn" : "") + '"></span>저장 <b>' + esc(syncWord[store.status().mode]) + "</b></div>" +
      '<div><span class="dot' + (aiReady() ? " on" : "") + '"></span>AI <b>' + esc(provLabel[S.provider]) + "</b></div>" +
      (S.provider !== "local" && !aiReady() ? "<div>설정에서 " + (S.provider === "builtin" ? "다른 엔진을 선택하세요" : "API 키를 입력하세요") + "</div>" : "") +
      (links.length ? '<div class="row">' + links.join("") + "</div>" : "");
  }
  var syncWord = { claude: "claude.ai 계정 · 자동", gist: "GitHub Gist · 자동", local: "이 브라우저만" };
  function syncState() {
    var st = store.status();
    if (st.state === "error") return ["bad", "동기화 오류"];
    if (st.state === "saving" || st.state === "loading") return ["warn", "동기화 중"];
    if (st.mode === "local") return ["none", "브라우저 저장"];
    return ["good", "동기화됨"];
  }
  function renderSync() {
    var st = store.status(), ss = syncState();
    var pill = $("syncPill");
    if (!pill) return;
    pill.className = "pill " + ss[0]; pill.textContent = ss[1];
    var when = st.last ? new Date(st.last).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
    var text = {
      claude: "claude.ai에서 열어 두면 매출 기록·보드·분석 기록·대화가 <b>내 계정의 비공개 저장소</b>에 자동 저장되어 다른 기기에서도 그대로 이어집니다.",
      gist: "기록이 <b>내 GitHub 비공개 Gist</b>에 자동 저장됩니다. 다른 기기에서 같은 토큰으로 연결하면 그대로 불러옵니다.",
      local: "지금은 <b>이 브라우저에만</b> 저장됩니다. 브라우저 데이터를 지우면 사라지니 GitHub에 연결하거나 claude.ai에서 여세요."
    }[st.mode];
    $("syncText").innerHTML = text + (when ? ' <span class="note">마지막 저장 ' + esc(when) + "</span>" : "") + (st.error ? '<br><span class="neg">' + esc(st.error) + "</span>" : "");
    var dot = $("mSync"); if (dot) dot.className = "syncdot " + (ss[0] === "good" ? "on" : ss[0] === "bad" ? "bad" : "");
  }
  function renderSettings() {
    document.querySelectorAll("#themeSeg button, #themeSide button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.t === S.theme ? "true" : "false"); });
    $("sMin").value = S.marginMin; $("sMax").value = S.marginMax; $("sGoal").value = S.goalProfit || ""; $("sRefCPL").value = S.refCPL || "";
    $("sGhToken").value = S.ghToken || "";
    renderSync();
    $("sVat").checked = !!S.vat; $("sWht").checked = !!S.wht;
    $("sTax").value = S.taxMode || "custom";
    $("sTaxNote").textContent = {
      person: "개인으로 정산받으면 네트워크가 3.3%를 떼고 지급하고, 광고비 부가세 10%는 돌려받지 못해 비용이 됩니다.",
      business: "일반과세 사업자는 광고비 부가세를 매입세액으로 공제받고, 정산은 세금계산서로 받아 원천징수가 없습니다. 실제 신고는 세무사와 확인하세요.",
      custom: "부가세·원천징수 반영을 아래에서 직접 고릅니다."
    }[S.taxMode || "custom"];
    $("sAiLimit").value = S.aiLimit || 0;
    $("aiUsage").textContent = window.LabAI.usage().calls + "회" + (S.aiLimit ? " / " + S.aiLimit + "회" : "");
    $("sTgToken").value = S.tgToken || ""; $("sTgChat").value = S.tgChat || ""; $("sTgAuto").checked = !!S.tgAuto;
    var tgOn = S.tgToken && S.tgChat; $("tgPill").className = "pill " + (tgOn ? "good" : "none"); $("tgPill").textContent = tgOn ? (S.tgAuto ? "자동 전송" : "연결됨") : "꺼짐";
    document.querySelectorAll('input[name="prov"]').forEach(function (r) { r.checked = r.value === S.provider; });
    $("engBuiltin").classList.toggle("dim", !builtinReady);
    $("sClaudeKey").value = S.claudeKey; $("sClaudeModel").value = S.claudeModel;
    $("sGeminiKey").value = S.geminiKey; $("sGeminiModel").value = S.geminiModel; $("sImgModel").value = S.imgModel || ""; $("sYtKey").value = S.ytKey || "";
    $("sWeb").checked = S.web !== false;
  }
  function initSettings() {
    ["themeSeg", "themeSide"].forEach(function (id) {
      $(id).addEventListener("click", function (e) {
        var b = e.target.closest("[data-t]"); if (!b) return;
        S.theme = b.dataset.t; applyTheme(); saveSettings(); renderSettings();
      });
    });
    function bindNum(id, key, lo, hi) {
      $(id).addEventListener("change", function () {
        var v = Math.min(hi, Math.max(lo, parseFloat($(id).value) || 0));
        S[key] = v;
        if (S.marginMin > S.marginMax) { if (key === "marginMin") S.marginMax = v; else S.marginMin = v; }
        saveSettings(); renderSettings();
      });
    }
    bindNum("sMin", "marginMin", 0, 90); bindNum("sMax", "marginMax", 0, 90);
    $("sGoal").addEventListener("change", function () { S.goalProfit = Math.max(0, parseFloat($("sGoal").value) || 0); saveSettings(); });
    $("sRefCPL").addEventListener("change", function () { S.refCPL = Math.max(0, parseFloat($("sRefCPL").value) || 0); saveSettings(); });
    $("sGhToken").addEventListener("change", function () { S.ghToken = $("sGhToken").value.trim(); saveSettings(); });
    $("ghConnect").addEventListener("click", function () {
      S.ghToken = $("sGhToken").value.trim();
      if (!S.ghToken) { toast("GitHub 토큰을 먼저 입력하세요"); return; }
      saveSettings();
      if (store.backend() === "claude") { toast("claude.ai에서는 계정 저장소에 이미 자동 저장됩니다. GitHub 연결은 직접 배포한 사이트에서 쓰세요."); return; }
      $("ghConnect").disabled = true;
      store.connectGist().then(function (changed) {
        $("ghConnect").disabled = false;
        var st = store.status();
        if (st.state === "error") { toast(st.error); return; }
        toast("GitHub에 연결했습니다");
        if (changed) setTimeout(function () { location.reload(); }, 600);
      });
    });
    $("ghSync").addEventListener("click", function () { store.syncNow().then(function () { toast(store.status().state === "error" ? store.status().error : "동기화했습니다"); }); });
    $("ghDisconnect").addEventListener("click", function () {
      S.ghToken = ""; S.gistId = ""; saveSettings(); store.disconnectGist(); renderSettings(); toast("GitHub 연결을 해제했습니다. 기록은 이 브라우저에 남아 있습니다.");
    });
    store.onStatus(function () { renderSync(); renderAiState(); });
    // 다른 기기에서 바뀐 기록을 받아오면 화면을 새로 그립니다 (입력 중이면 알림만)
    store.onStatus(function (ev) {
      if (ev !== "remote") return;
      var el = document.activeElement, typing = el && /INPUT|TEXTAREA|SELECT/.test(el.tagName) && el.type !== "button";
      if (typing) { toast("다른 기기의 새 기록을 받았습니다 · 입력을 마친 뒤 새로고침하면 반영됩니다"); return; }
      toast("다른 기기의 새 기록을 불러와 화면을 새로 고칩니다");
      setTimeout(function () { location.reload(); }, 1200);
    });
    $("sVat").addEventListener("change", function () { S.vat = $("sVat").checked; S.taxMode = "custom"; saveSettings(); renderSettings(); });
    $("sWht").addEventListener("change", function () { S.wht = $("sWht").checked; S.taxMode = "custom"; saveSettings(); renderSettings(); });
    $("sTax").addEventListener("change", function () {
      S.taxMode = $("sTax").value;
      if (S.taxMode === "person") { S.vat = true; S.wht = true; }
      if (S.taxMode === "business") { S.vat = false; S.wht = false; }
      saveSettings(); renderSettings(); toast("세금 기준을 바꿨습니다. 매출 현황·보고서 계산에 바로 반영됩니다");
    });
    $("sAiLimit").addEventListener("change", function () { S.aiLimit = Math.max(0, parseInt($("sAiLimit").value, 10) || 0); saveSettings(); renderSettings(); });
    [["sTgToken", "tgToken"], ["sTgChat", "tgChat"]].forEach(function (p) {
      $(p[0]).addEventListener("change", function () { S[p[1]] = $(p[0]).value.trim(); saveSettings(); renderSettings(); });
    });
    $("sTgAuto").addEventListener("change", function () { S.tgAuto = $("sTgAuto").checked; saveSettings(); renderSettings(); });
    $("tgSend").addEventListener("click", function () {
      $("tgMsg").textContent = "보내는 중…";
      sendTelegram(L().dash.summaryText()).then(function (m) { $("tgMsg").textContent = m; }, function (e) { $("tgMsg").textContent = e.message; });
    });
    $("sWeb").addEventListener("change", function () { S.web = $("sWeb").checked; saveSettings(); });
    $("engines").addEventListener("change", function (e) {
      if (e.target.name !== "prov") return;
      S.provider = e.target.value; S.chosen = true; saveSettings(); renderAiState();
    });
    [["sClaudeKey", "claudeKey"], ["sClaudeModel", "claudeModel"], ["sGeminiKey", "geminiKey"], ["sGeminiModel", "geminiModel"], ["sImgModel", "imgModel"], ["sYtKey", "ytKey"]].forEach(function (p) {
      $(p[0]).addEventListener("change", function () { S[p[1]] = $(p[0]).value.trim(); saveSettings(); renderAiState(); });
    });
    $("aiTest").addEventListener("click", function () {
      var btn = $("aiTest"), msg = $("aiTestMsg");
      if (S.provider === "local") { msg.textContent = "AI가 꺼져 있습니다. 위에서 엔진을 고르세요."; return; }
      btn.disabled = true; msg.textContent = "연결 확인 중…";
      window.LabAI.run({ provider: S.provider, settings: Object.assign({}, S, { web: false }), prompt: "연결 테스트입니다. '연결 성공'이라고만 답하세요.", onText: function () {} })
        .then(function (t) { msg.textContent = "응답: " + String(t).trim().slice(0, 60); })
        .catch(function (e) { msg.textContent = (e && e.message) || "연결에 실패했습니다."; })
        .then(function () { btn.disabled = false; });
    });

    $("conn").innerHTML = D.connections.map(function (g) {
      return "<div><b>" + esc(g.group) + "</b>" + g.items.map(function (i) {
        return '<a href="' + esc(i[1]) + '" target="_blank" rel="noopener noreferrer">' + esc(i[0]) + " →</a>";
      }).join("") + "</div>";
    }).join("");
    $("netUrls").innerHTML = D.networks.map(function (n) {
      return '<label class="f">' + esc(n.name) + '<input type="url" id="nu_' + n.id + '" data-net="' + n.id + '" placeholder="https://" value="' + esc(S.netUrls[n.id] || "") + '"></label>';
    }).join("");
    $("netUrls").addEventListener("change", function (e) {
      var id = e.target.dataset.net; if (!id) return;
      var v = e.target.value.trim();
      if (v && !/^https?:\/\//i.test(v)) { toast("주소는 https:// 로 시작해야 합니다"); return; }
      S.netUrls = Object.assign({}, S.netUrls); S.netUrls[id] = v; saveSettings(); renderAiState();
    });

    $("exportBtn").addEventListener("click", function () {
      store.set("lastBackup", Date.now());
      copyText(JSON.stringify(store.snapshot()), "전체 백업을 복사했습니다. 메모장에 붙여넣어 보관하세요. (API 키·토큰 제외)");
    });
    $("importToggle").addEventListener("click", function () { $("importForm").hidden = !$("importForm").hidden; });
    $("importForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var data;
      try { data = JSON.parse($("importText").value); } catch (err) { $("importMsg").textContent = "JSON 형식이 아닙니다. '전체 백업 복사'로 만든 내용을 그대로 붙여넣으세요."; return; }
      var src = {};
      if (data && data.keys) Object.keys(data.keys).forEach(function (k) { src[k] = data.keys[k].v; });
      else src = data || {};
      var added = 0;
      ["board", "entries", "history", "reports"].forEach(function (k) {
        if (!Array.isArray(src[k])) return;
        var cur = store.get(k, []).slice(), ids = {};
        cur.forEach(function (r) { ids[r.id] = 1; });
        src[k].forEach(function (r) { if (r && r.id && !ids[r.id]) { cur.push(r); added++; } });
        store.set(k, cur);
      });
      if (Array.isArray(src.log)) store.set("log", store.get("log", []).concat(src.log));
      ["checks", "bizchecks", "calc", "media", "cases", "chat"].forEach(function (k) { if (src[k] != null) store.set(k, src[k]); });
      if (src.settings && typeof src.settings === "object") {
        var keep = { claudeKey: S.claudeKey, geminiKey: S.geminiKey, ghToken: S.ghToken };
        S = Object.assign({}, DEFAULTS, S, src.settings, keep); store.set("settings", S);
      }
      $("importMsg").textContent = "항목 " + added + "개를 합쳤습니다. 화면을 새로 불러옵니다…";
      setTimeout(function () { location.reload(); }, 900);
    });
    $("resetBtn").addEventListener("click", function () { $("resetConfirm").hidden = false; });
    $("resetNo").addEventListener("click", function () { $("resetConfirm").hidden = true; });
    $("resetYes").addEventListener("click", function () {
      $("resetYes").disabled = true;
      store.wipe().then(function () { location.reload(); }, function () { location.reload(); });
    });

    renderSettings();
    renderAiState();
    renderInstall();
    $("installBtn").addEventListener("click", function () {
      if (!installEvt) return;
      installEvt.prompt();
      installEvt.userChoice.then(function (r) { if (r && r.outcome !== "accepted") toast("설치를 취소했습니다"); installEvt = null; renderInstall(); });
    });
    window.LabAI.builtin().then(function (s) {
      builtinReady = !!s;
      // claude.ai 안에서 처음 열었고 엔진을 고른 적이 없으면 내장 Claude를 기본으로
      if (builtinReady && !S.chosen && S.provider === "local") { S.provider = "builtin"; store.set("settings", S); }
      renderSettings(); renderAiState();
    });
    onShow.settings = renderSettings;
  }

  /* ───────── 외부 모듈에 공개 ───────── */
  window.Lab = {
    D: D, $: $, store: store, esc: esc, won: won, fmt: fmt, pct: pct, num: num, toast: toast, copyText: copyText,
    fillSelect: fillSelect, catName: catName, chName: chName, netName: netName, hookName: hookName, chOptions: chOptions,
    catById: catById, chById: chById, settings: function () { return S; }, marginStatus: marginStatus, maxCPL: maxCPL,
    on: on, emit: emit, show: show, onShow: onShow, guideTab: guideTab, anaTab: anaTab, refLinks: refLinks, linkCards: linkCards, goExplore: goExplore,
    fillHook: fillHook, addToBoard: addToBoard, setCalc: setCalc, aiReady: aiReady, provLabel: provLabel,
    board: function () { return board; },
    emph: emph,
    addLogRows: function (rows) { rows.forEach(function (r) { log.push(r); }); store.set("log", log); renderLog(); }
  };

  var inits = [initBoard, initPlaybook, initChannels, initHooks, initCalc, initSettings];
  var booted = false;
  function boot() {
    if (booted) return; booted = true;
    S = Object.assign({}, DEFAULTS, store.get("settings", {}));
    board = store.get("board", []); log = store.get("log", []);
    applyTheme();
    (window.Lab.extraInits || []).forEach(function (fn) { inits.push(fn); });
    inits.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    setTimeout(autoTelegram, 1500);
    // 주소의 #화면이름 때문에 로드 직후 브라우저가 섹션 위치로 내려가는 것을 되돌림
    if (document.readyState !== "complete") window.addEventListener("load", function () { setTimeout(function () { if (window.scrollY < 200) window.scrollTo(0, 0); }, 0); }, { once: true });
    var start = (location.hash || "").slice(1);
    show(views.indexOf(start) >= 0 || alias[start] ? start : store.get("tab", "merchant"));
  }
  // 계정·GitHub 저장소를 먼저 불러온 뒤 화면을 그립니다 (최대 4초 대기)
  function start() {
    var late = false;
    var t = setTimeout(function () { late = true; boot(); }, 4000);
    store.ready.then(function (changed) {
      clearTimeout(t);
      if (!late) boot();
      else if (changed) { toast("다른 기기의 최신 기록을 불러와 화면을 새로 고칩니다"); setTimeout(function () { location.reload(); }, 1200); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else setTimeout(start, 0);
})();
