/* 레퍼런스 탐색 — 키워드 하나로 Meta·틱톡·유튜브·인스타·구글·네이버의 레퍼런스를 추천·조회수 순으로 10~30개 모읍니다.
   출처: ① YouTube Data API(키가 있으면 실제 조회수 순) ② 웹 검색 AI(Claude API·Gemini) ③ 내 보드 ④ 많이 본 순으로 정렬된 매체 검색 바로가기.
   매체들은 광고 목록을 외부에 열어 주지 않으므로, 키가 없을 때는 정렬된 검색 결과 화면으로 바로 연결합니다. */
(function () {
  "use strict";
  var L = window.Lab, D = L.D, $ = L.$, esc = L.esc, fmt = L.fmt;
  var PLATS = [["all", "전체"], ["meta", "Meta"], ["tiktok", "틱톡"], ["youtube", "유튜브"], ["instagram", "인스타"], ["search", "구글 · 네이버"]];
  var PNAME = { meta: "Meta 광고", tiktok: "틱톡", youtube: "유튜브", instagram: "인스타그램", search: "검색", google: "구글", naver: "네이버", board: "내 보드" };
  var plat = "all", ctl = null, results = [];

  function enc(s) { return encodeURIComponent(s); }
  function metaUrl(q, sort) {
    return "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=KR&q=" + enc(q) + "&search_type=keyword_unordered&media_type=all" +
      (sort ? "&sort_data[direction]=desc&sort_data[mode]=" + sort : "");
  }
  /* 키가 없어도 바로 쓰는 '많이 본 순' 검색 바로가기 */
  function linkResults(q) {
    var cat = L.catById(L.analyze.detectCategory(q)), kws = [q, q + " 광고", q + " 후기", q + " 상담"].concat(cat ? cat.keywords.filter(function (k) { return k !== q; }).slice(0, 3) : []);
    var out = [];
    kws.forEach(function (k, i) {
      out.push({ plat: "meta", title: "Meta 광고 라이브러리 · '" + k + "' 노출 많은 순", url: metaUrl(k, "total_impressions"), why: "오래·많이 노출된 광고 = 돈을 계속 쓰는 검증된 소재. 게재 시작일과 버전 수를 확인하세요.", rank: 90 - i * 3 });
      out.push({ plat: "youtube", title: "유튜브 · '" + k + "' 조회수 순", url: "https://www.youtube.com/results?search_query=" + enc(k) + "&sp=CAM%253D", why: "조회수 순 정렬. 쇼츠 훅·자막 스타일과 댓글 반응을 보세요.", rank: 86 - i * 3 });
      out.push({ plat: "tiktok", title: "틱톡 · '" + k + "' 인기 영상", url: "https://www.tiktok.com/search?q=" + enc(k), why: "인기 순 기본 정렬. 첫 2초 자막과 UGC 톤을 참고하세요.", rank: 84 - i * 3 });
      if (i < 3) out.push({ plat: "instagram", title: "인스타 · #" + k.replace(/\s+/g, "") + " 인기 게시물", url: "https://www.instagram.com/explore/tags/" + enc(k.replace(/\s+/g, "")) + "/", why: "인기 게시물 먼저 표시. 비주얼·카피 톤 참고.", rank: 70 - i * 3 });
      if (i < 3) out.push({ plat: "search", title: "구글 · '" + k + " 광고 소재 사례'", url: "https://www.google.com/search?q=" + enc(k + " 광고 소재 사례"), why: "업종 광고 사례·후기 글.", rank: 60 - i * 3 });
      if (i < 3) out.push({ plat: "search", title: "네이버 지식iN · '" + k + "' 실제 질문", url: "https://search.naver.com/search.naver?where=kin&query=" + enc(k), why: "고객의 실제 질문 = 훅 원재료.", rank: 58 - i * 3 });
    });
    out.push({ plat: "tiktok", title: "틱톡 Creative Center · Top Ads (업종 필터)", url: "https://ads.tiktok.com/business/creativecenter/inspiration/topads/pc/ko", why: "성과 상위 광고를 업종·지역(한국)으로 거르기.", rank: 80 });
    out.push({ plat: "youtube", title: "Google 광고 투명성 센터 (경쟁 광고주 조회)", url: "https://adstransparency.google.com/?region=KR", why: "경쟁 광고주 이름으로 유튜브·검색 광고 조회.", rank: 66 });
    return out.map(function (r) { r.src = "link"; return r; });
  }
  function boardResults(q) {
    var cat = L.analyze.detectCategory(q);
    return L.board().filter(function (r) { return (cat && r.cat === cat) || String(r.note || "").indexOf(q) >= 0 || String(r.url || "").indexOf(q) >= 0; })
      .map(function (r) {
        return { plat: r.channel === "meta" ? "meta" : r.channel === "tiktok" ? "tiktok" : r.channel === "youtube" ? "youtube" : "board", title: r.note ? r.note.slice(0, 60) : r.url, url: r.url,
          metric: "게재 " + r.days + "일 · 버전 " + r.versions + "개", why: "내 보드에 저장한 레퍼런스", rank: 95, src: "board" };
      });
  }
  function ytSearch(q, n, signal) {
    var S = L.settings();
    var u = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&regionCode=KR&relevanceLanguage=ko&maxResults=" + Math.min(25, n) +
      "&q=" + enc(q + " 광고") + "&key=" + enc(S.ytKey);
    return fetch(u, { signal: signal }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || "YouTube API 오류"); return j; }); })
      .then(function (j) {
        var items = (j.items || []).filter(function (x) { return x.id && x.id.videoId; });
        if (!items.length) return [];
        var ids = items.map(function (x) { return x.id.videoId; }).join(",");
        return fetch("https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=" + ids + "&key=" + enc(S.ytKey), { signal: signal })
          .then(function (r) { return r.json(); }).then(function (v) {
            var st = {}; (v.items || []).forEach(function (x) { st[x.id] = x; });
            return items.map(function (x) {
              var s = st[x.id.videoId] || {}, views = +(s.statistics && s.statistics.viewCount) || 0, sn = x.snippet || {};
              var dm = String((s.contentDetails && s.contentDetails.duration) || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/) || [];
              var sec = (+dm[1] || 0) * 3600 + (+dm[2] || 0) * 60 + (+dm[3] || 0), short = sec > 0 && sec <= 60;
              return { plat: "youtube", title: sn.title || "", url: "https://www.youtube.com/watch?v=" + x.id.videoId, thumb: sn.thumbnails && (sn.thumbnails.medium || sn.thumbnails.default || {}).url,
                by: sn.channelTitle, date: String(sn.publishedAt || "").slice(0, 10), views: views, metric: "조회수 " + fmt(views) + "회" + (short ? " · 쇼츠" : ""),
                why: "YouTube 실제 조회수 순", rank: 100, src: "yt" };
            });
          });
      });
  }
  function aiSearch(q, n, signal) {
    var S = L.settings();
    var want = plat === "all" ? "Meta(페이스북·인스타) 광고 라이브러리, 틱톡, 인스타그램, 유튜브" : PNAME[plat];
    var prompt = [
      "한국에서 '" + q + "' 관련으로 최근 6개월 안에 집행됐거나 반응이 큰 광고·숏폼 레퍼런스를 웹에서 찾아 주세요. 대상: " + want + ".",
      "오래 게재된 광고(게재 일수), 조회수·좋아요가 많은 것, 같은 광고주가 여러 버전을 돌리는 것을 우선하세요. 실제로 확인한 링크만 쓰고, 모르는 숫자는 null로 두세요. 절대 지어내지 마세요.",
      "JSON 배열만 출력하세요. 최대 " + n + "개.",
      '형식: [{"platform":"meta|tiktok|youtube|instagram","title":"광고 첫 문장 또는 제목","advertiser":"광고주","url":"링크","metric":"게재 n일 또는 조회수 n회 등","why":"참고할 점 한 줄","score":0~100}]'
    ].join("\n");
    return window.LabAI.run({ provider: S.provider, settings: S, prompt: prompt, signal: signal, onText: function () {} }).then(function (t) {
      var s = String(t || ""), a = s.indexOf("["), b = s.lastIndexOf("]"), arr = [];
      try { arr = JSON.parse(s.slice(a, b + 1)); } catch (e) { arr = []; }
      return (Array.isArray(arr) ? arr : []).filter(function (x) { return x && /^https?:\/\//i.test(x.url || ""); }).map(function (x) {
        var p = String(x.platform || "").toLowerCase();
        p = /meta|face|페이스/.test(p) ? "meta" : /tik|틱/.test(p) ? "tiktok" : /you|유튜/.test(p) ? "youtube" : /insta|인스/.test(p) ? "instagram" : "search";
        return { plat: p, title: String(x.title || x.advertiser || x.url).slice(0, 90), url: x.url, by: x.advertiser || "", metric: x.metric || "", why: x.why || "AI 웹 검색",
          rank: Math.max(50, Math.min(99, +x.score || 75)), src: "ai" };
      });
    });
  }

  function card(r, i) {
    var badge = { yt: ["good", "실제 조회"], ai: ["warn", "AI 웹 검색"], board: ["blue", "내 보드"], link: ["none", "바로가기"] }[r.src] || ["none", ""];
    var safe = /^https?:\/\//i.test(r.url) ? r.url : "#";
    return '<article class="rfcard' + (r.thumb ? " has-thumb" : "") + '">' +
      (r.thumb ? '<a class="rfthumb" href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer"><img src="' + esc(r.thumb) + '" alt="" loading="lazy"></a>' : "") +
      '<div class="rfbody"><div class="row between"><span class="rfrank">' + (i + 1) + '</span><span class="row"><span class="tag">' + esc(PNAME[r.plat] || r.plat) + '</span><span class="pill ' + badge[0] + '">' + badge[1] + "</span></span></div>" +
      '<a class="rftitle" href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' + esc(r.title) + "</a>" +
      (r.by || r.metric ? '<small class="muted">' + esc([r.by, r.metric, r.date].filter(Boolean).join(" · ")) + "</small>" : "") +
      (r.why ? '<p class="note">' + esc(r.why) + "</p>" : "") +
      '<div class="row"><a class="btn ghost sm" href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">열기 →</a>' +
        (r.src !== "link" && r.src !== "board" ? '<button class="btn ghost sm" type="button" data-rfsave="' + i + '">보드에 저장</button><button class="btn ghost sm" type="button" data-rfana="' + i + '">이 광고 뜯어보기</button>' : "") +
      "</div></div></article>";
  }
  function paint(n) {
    var shown = results.filter(function (r) { return plat === "all" || r.plat === plat || (plat === "search" && (r.plat === "google" || r.plat === "naver")); });
    var seen = {};
    shown = shown.filter(function (r) { if (seen[r.url]) return false; seen[r.url] = 1; return true; })
      .sort(function (a, b) { var o = { yt: 0, ai: 1, board: 2, link: 3 }; return (o[a.src] - o[b.src]) || (b.views || 0) - (a.views || 0) || b.rank - a.rank; }).slice(0, n);
    results.shown = shown;
    var real = shown.filter(function (r) { return r.src !== "link"; }).length;
    $("rfMeta").textContent = shown.length ? "· " + shown.length + "개" + (real ? " (실제 레퍼런스 " + real + "개 + 바로가기 " + (shown.length - real) + "개)" : " · 많이 본 순 정렬 바로가기") : "";
    $("rfOut").innerHTML = shown.length ? shown.map(card).join("") : '<p class="empty">결과가 없습니다. 다른 키워드로 검색해 보세요.</p>';
  }
  function search(e) {
    if (e) e.preventDefault();
    var q = $("q").value.trim() || "실비보험", n = +$("rfN").value || 20, S = L.settings();
    L.store.set("q", q);
    if (ctl) ctl.abort();
    ctl = new AbortController();
    results = boardResults(q).concat(linkResults(q));
    var jobs = [], notes = [];
    if (S.ytKey && (plat === "all" || plat === "youtube")) jobs.push(ytSearch(q, n, ctl.signal).then(function (r) { results = results.concat(r); notes.push("유튜브 실제 조회수 " + r.length + "개"); }, function (er) { if (!ctl.signal.aborted) notes.push("유튜브 조회 실패: " + er.message); }));
    if ((S.provider === "claude" || S.provider === "gemini") && S.web !== false && plat !== "search") jobs.push(aiSearch(q, n, ctl.signal).then(function (r) { results = results.concat(r); notes.push("AI 웹 검색 " + r.length + "개"); }, function (er) { if (!(er && er.code === "cancelled")) notes.push("AI 검색 실패: " + ((er && er.message) || "")); }));
    var srcNote = function () {
      return (jobs.length ? notes.join(" · ") : "") + (S.ytKey ? "" : (jobs.length ? " · " : "") + "설정에 YouTube API 키를 넣으면 유튜브 광고를 실제 조회수 순으로 가져옵니다.") +
        ((S.provider === "claude" || S.provider === "gemini") ? "" : " 웹 검색이 되는 AI(Claude API·Gemini)를 켜면 Meta·틱톡 레퍼런스를 직접 찾아 목록에 넣습니다.");
    };
    paint(n);
    $("rfSrc").textContent = jobs.length ? "실제 레퍼런스를 찾는 중입니다…" : srcNote();
    $("rfStop").hidden = !jobs.length;
    if (!jobs.length) return Promise.resolve();
    return Promise.all(jobs).then(function () { paint(n); $("rfSrc").textContent = srcNote(); $("rfStop").hidden = true; });
  }

  function renderLaunch() {
    var q = $("q").value.trim() || "실비보험";
    $("launch").innerHTML = L.linkCards(L.refLinks(q, {}));
  }
  function init() {
    $("q").value = L.store.get("q", "실비보험");
    $("rfPlat").innerHTML = PLATS.map(function (p) { return '<button type="button" data-rp="' + p[0] + '" aria-pressed="' + (p[0] === plat) + '">' + esc(p[1]) + "</button>"; }).join("");
    $("rfPlat").addEventListener("click", function (e) {
      var b = e.target.closest("[data-rp]"); if (!b) return;
      plat = b.dataset.rp;
      document.querySelectorAll("#rfPlat [data-rp]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      search();
    });
    $("rfN").addEventListener("change", function () { paint(+$("rfN").value || 20); });
    $("rfForm").addEventListener("submit", function (e) { search(e); renderLaunch(); });
    $("rfStop").addEventListener("click", function () { if (ctl) ctl.abort(); $("rfStop").hidden = true; $("rfSrc").textContent = "검색을 중지했습니다."; });
    var quick = [];
    D.categories.forEach(function (c) { quick.push(c.keywords[0], c.keywords[1]); });
    $("catChips").innerHTML = quick.map(function (k) { return '<button class="chip" type="button" data-kw="' + esc(k) + '">' + esc(k) + "</button>"; }).join("");
    $("catChips").addEventListener("click", function (e) { var b = e.target.closest("[data-kw]"); if (!b) return; $("q").value = b.dataset.kw; search(); renderLaunch(); });
    $("rfOut").addEventListener("click", function (e) {
      var s = e.target.closest("[data-rfsave]"), a = e.target.closest("[data-rfana]"), list = results.shown || [];
      if (s) { var r = list[+s.dataset.rfsave]; if (r) L.addToBoard({ url: r.url, channel: r.plat === "instagram" ? "meta" : (L.chById(r.plat) ? r.plat : "meta"), cat: L.analyze.detectCategory($("q").value) || "", hook: "", days: (String(r.metric).match(/(\d+)\s*일/) || [0, 0])[1], versions: 1, note: r.title + (r.why ? " · " + r.why : "") }); }
      if (a) { var r2 = list[+a.dataset.rfana]; if (r2) { L.show("adlab"); $("adUrl").value = r2.url; $("adCopy").value = r2.title; $("adUrl").focus(); L.toast("경쟁 광고 뜯어보기에 링크를 넣었습니다. 문구·캡처를 더하고 분석하기를 누르세요"); } }
    });
    // 기준 · 소스 · 바로 저장 (접힌 영역)
    var lvCls = { "핵심": "good", "중요": "warn", "참고": "none" };
    $("criteria").innerHTML = D.criteria.map(function (c) {
      return '<div class="crit ' + (lvCls[c.lv] || "none") + '"><div class="crit-h"><span class="pill ' + (lvCls[c.lv] || "none") + '">' + esc(c.lv || "참고") + "</span><b>" + esc(c.k) + "</b></div><p>" + L.emph(c.v) + "</p></div>";
    }).join("");
    $("sources").innerHTML = D.sources.map(function (s, i) {
      var link = s.url ? '<a class="btn blue sm" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">바로가기 →</a>' : "";
      return '<article class="panel src' + (s.id === "meta" ? " main" : "") + '">' +
        '<header><span class="srcno">' + (i + 1) + '</span><div><h4>' + esc(s.name) + '</h4><span class="covers">' + esc(s.covers) + '</span></div><span class="tag ' + (s.id === "meta" ? "hi" : "blue") + '">' + esc(s.role) + "</span></header>" +
        '<div class="why"><small>왜 보나</small><p>' + L.emph(s.why) + "</p></div>" +
        '<div class="how"><small>이렇게 보세요</small><ol class="steps">' + s.how.map(function (h) { return "<li>" + L.emph(h) + "</li>"; }).join("") + "</ol></div>" +
        '<div class="row">' + link + "</div></article>";
    }).join("");
    L.fillSelect($("qsChannel"), L.chOptions);
    L.fillSelect($("qsCat"), D.categories.map(function (c) { return [c.id, c.name]; }));
    L.fillSelect($("qsHook"), D.hooks.map(function (h) { return [h.id, h.name]; }));
    $("quickSave").addEventListener("submit", function (e) {
      e.preventDefault();
      var url = $("qsUrl").value.trim(); if (!url) return;
      if (/^\d+$/.test(url)) url = "https://www.facebook.com/ads/library/?id=" + url;
      L.addToBoard({ url: url, channel: $("qsChannel").value, cat: $("qsCat").value, hook: $("qsHook").value, days: L.num("qsDays"), versions: L.num("qsVersions"), note: $("qsNote").value.trim() });
      $("qsUrl").value = ""; $("qsNote").value = "";
    });
    renderLaunch();
    L.onShow.explore = function () { if (!$("rfOut").innerHTML) search(); };
  }
  L.refs = { search: search };
  (L.extraInits = L.extraInits || []).push(init);
})();
