/* 4단계 광고 제작 — 플랫폼을 고르면 그 매체에 맞춘 제목·소제목, 광고 이미지(Gemini 나노바나나 + 글자 합성), 최적화 셋팅값을 만듭니다.
   셋팅 카드(card·block)는 3단계 분석 결과의 '자세한 분석'과 분석 기록 미리보기에서도 같이 씁니다. */
(function () {
  "use strict";
  var L = window.Lab, D = L.D, $ = L.$, esc = L.esc, won = L.won, fmt = L.fmt, pct = L.pct;
  var BY = {}; (D.studio || []).forEach(function (p) { BY[p.id] = p; });
  var NOCAT = { target: "관심 고객", pain: "지금 조건이 맞는지 모르겠다", benefit: "무료로 확인할 수 있습니다", number: "내 조건", keywords: ["무료 상담"] };

  function has(id) { return !!BY[id]; }
  function r100(v) { return Math.max(100, Math.round(v / 100) * 100); }
  function r1k(v) { return Math.max(1000, Math.round(v / 1000) * 1000); }

  function ageOf(ctx, cat) {
    if (ctx.age) return String(ctx.age).replace(/\s/g, "").replace(/세?$/, "세") + " (캠페인 인정 연령)";
    var m = String(ctx.terms || "").match(/(\d{2})\s*(?:세)?\s*[~\-]\s*(\d{2})\s*세/);
    if (m) return m[1] + "~" + m[2] + "세 (캠페인 인정 연령)";
    return cat ? cat.target : "캠페인 인정 연령";
  }

  /* 단가·승인율 → 매체에 입력할 숫자 (광고 관리자 입력값은 VAT 제외) */
  function numbers(chId, ctx) {
    var S = L.settings(), P = +ctx.payout || 0, a = Math.min(100, Math.max(0, +ctx.approve || 70)) / 100;
    var vatF = S.vat ? 1.1 : 1;
    var limit = L.maxCPL(P, a, S.marginMin / 100, S.wht) / vatF;
    var target = L.maxCPL(P, a, (S.marginMin + S.marginMax) / 200, S.wht) / vatF;
    var p = BY[chId] || { budget: [2, 20000] };
    var b = ((D.opsRules || {}).bench || {})[chId] || { ctr: 0.006, cvr: 0.04 };
    var ok = P > 0 && limit > 0;
    return {
      ok: ok, vat: S.vat, P: P, a: a,
      limit: ok ? r100(limit) : 0, cap: ok ? r100(target) : 0,
      daily: ok ? Math.max(p.budget[1], r1k(target * p.budget[0])) : 0,
      kill: ok ? r1k(limit * 2) : 0, cpc: ok ? r100(limit * b.cvr) : 0,
      ctr: b.ctr, cvr: b.cvr
    };
  }

  function filler(chId, ctx) {
    var cat = L.catById(ctx.cat) || null, c = cat || NOCAT, n = numbers(chId, ctx);
    var t = c.target.split(",")[0].trim();
    var code = t.charCodeAt(t.length - 1) - 0xac00;
    var money = function (v) { return n.ok ? won(v) : "단가 입력 시 계산"; };
    var map = {
      target: t, "이라면": code >= 0 && code <= 11171 && code % 28 ? "이라면" : "라면",
      pain: c.pain, benefit: String(c.benefit).replace(/있다$/, "있습니다").replace(/는다$/, "습니다"),
      number: c.number, keyword: c.keywords[0],
      daily: money(n.daily), cap: money(n.cap), limit: money(n.limit), kill: money(n.kill), cpc: money(n.cpc),
      ctr: pct(n.ctr), cvr: pct(n.cvr, 0), age: ageOf(ctx, cat)
    };
    return function (s) { return String(s).replace(/\{([^{}]+)\}/g, function (m, k) { return map[k] != null ? map[k] : m; }); };
  }

  function passRows(chId, n, f) {
    var p = BY[chId];
    return [
      ["CTR (클릭률)", pct(n.ctr) + " 이상"],
      ["랜딩 신청률", pct(n.cvr, 0) + " 이상"],
      ["CPC (VAT 제외)", n.ok ? won(n.cpc) + " 이하" : "단가 입력 시 계산"],
      ["DB당 광고비 (VAT 제외)", n.ok ? won(n.cap) + " 이하 = 목표 · " + won(n.limit) + " = 한계" : "단가 입력 시 계산"],
      ["끄기 기준", n.ok ? "소재·광고 세트 지출 " + won(n.kill) + "에 DB 0건" : "목표 DB당 광고비의 2배 지출에 DB 0건"]
    ].concat(p && p.extra ? [[p.extra[0], f(p.extra[1])]] : []);
  }

  /* 매체 1개 카드 */
  function card(chId, ctx, rank) {
    var p = BY[chId], ch = L.chById(chId);
    if (!p || !ch) return "";
    var n = numbers(chId, ctx), f = filler(chId, ctx), cat = L.catById(ctx.cat);
    var sp = ((D.opsRules || {}).spec || {})[chId];
    var fact = function (label, v, key) { return '<div class="fact' + (key ? " key" : "") + '"><small>' + esc(label) + "</small><b>" + v + "</b></div>"; };
    var money = function (v) { return n.ok ? won(v) : "—"; };
    return '<div class="stcard stack" data-stc="' + chId + '">' +
      '<div class="plan-head"><h3>' + esc(ch.name) + "</h3>" + (rank ? '<span class="pill ' + (rank <= 2 ? "good" : "warn") + '">' + rank + "순위</span>" : "") + "</div>" +
      '<p class="fitline">' + L.emph(p.tone) + "</p>" +
      '<div class="plan-kpis">' +
        fact("시작 일예산", money(n.daily), true) +
        fact("목표 DB당 광고비 · 비용 상한", money(n.cap), true) +
        fact("DB당 한계 (순수익 " + L.settings().marginMin + "%)", money(n.limit)) +
        fact("최대 CPC", money(n.cpc)) +
        fact("끄기 기준 지출", money(n.kill)) +
      "</div>" +
      (n.ok ? '<p class="note">모든 금액은 광고 관리자에 그대로 넣는 <b>VAT 제외</b> 값입니다' + (n.vat ? " (실제 결제는 10% 더 나갑니다)" : "") + ".</p>" : '<p class="note"><b>CPA 단가를 넣으면 예산·입찰·끄기 기준 금액이 계산됩니다.</b></p>') +

      '<div class="plan-sec"><h4><span>1</span>광고 제작 전략</h4>' +
        '<div class="fmts">' + p.formats.map(function (x) { return "<div><b>" + esc(x[0]) + "</b><span>" + L.emph(x[1]) + "</span><small>" + esc(x[2]) + "</small></div>"; }).join("") + "</div>" +
        (sp && sp.note ? '<p class="note">규격 요약: ' + esc(sp.note) + (sp.headMax ? " · 제목 " + sp.headMax + "자 안팎" : "") + "</p>" : "") +
        "<h5>" + esc(p.sceneTitle) + (cat ? ' <small class="muted">· ' + esc(cat.name) + " 기준 예시</small>" : "") + "</h5>" +
        '<div class="scenes">' + p.scenes.map(function (s) { return "<div><b>" + esc(s[0]) + "</b><span>" + esc(f(s[1])) + "</span></div>"; }).join("") + "</div>" +
        "<h5>카피 공식 (바로 복사)</h5>" +
        '<div class="copies">' + p.copy.map(function (c) { var v = f(c[1]); return '<div><small>' + esc(c[0]) + "</small><p>" + esc(v) + '</p><button class="btn ghost sm" type="button" data-copy="' + esc(v) + '">복사</button></div>'; }).join("") + "</div>" +
        (cat ? '<div class="avoid"><b>이 업종에서 피할 표현</b> ' + esc(cat.avoid) + "</div>" : "") +
      "</div>" +

      '<div class="plan-sec"><h4><span>2</span>최적화 셋팅 (광고 관리자 입력값)</h4>' +
        '<div class="tablewrap"><table class="data stt"><tbody>' +
          p.setup.map(function (s) { return "<tr><th>" + esc(s[0]) + "</th><td>" + L.emph(f(s[1])) + "</td></tr>"; }).join("") +
        "</tbody></table></div></div>" +

      '<div class="plan-sec"><h4><span>3</span>테스트 설계 · 합격선</h4><p>' + L.emph(f(p.test)) + "</p>" +
        '<div class="tablewrap"><table class="data stt"><tbody>' +
          passRows(chId, n, f).map(function (r) { return "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>"; }).join("") +
        "</tbody></table></div></div>" +

      '<div class="plan-sec"><h4><span>4</span>하지 말 것</h4><ul class="checks">' +
        p.dont.map(function (d) { return '<li class="no">' + esc(d) + "</li>"; }).join("") + "</ul></div>" +

      '<div class="row">' +
        '<button class="btn blue" type="button" data-stops="' + chId + '">이 플랫폼으로 캠페인 운영 시작</button>' +
        '<button class="btn ghost" type="button" data-stcopy="' + chId + '">셋팅안 전체 복사</button>' +
        '<button class="btn ghost" type="button" data-stch="' + chId + '">채널 셋팅 자세히</button>' +
      "</div></div>";
  }

  function text(chId, ctx) {
    var p = BY[chId], ch = L.chById(chId); if (!p || !ch) return "";
    var f = filler(chId, ctx), n = numbers(chId, ctx), cat = L.catById(ctx.cat);
    var strip = function (s) { return String(s).replace(/\*\*/g, ""); };
    return ["[" + ch.name + " 광고 제작 · 셋팅안]" + (cat ? " 업종: " + cat.name : "") + (n.ok ? " · 단가 " + won(n.P) + " · 승인율 " + fmt(n.a * 100) + "%" : ""),
      "톤: " + strip(p.tone),
      "숫자(VAT 제외): 일예산 " + f("{daily}") + " · 비용 상한 " + f("{cap}") + " · DB당 한계 " + f("{limit}") + " · 최대 CPC " + f("{cpc}") + " · 끄기 " + f("{kill}"),
      "", "■ 제작 포맷"].concat(p.formats.map(function (x) { return "- " + x[0] + ": " + x[1]; }))
      .concat(["", "■ " + p.sceneTitle]).concat(p.scenes.map(function (s) { return "- " + s[0] + ": " + f(s[1]); }))
      .concat(["", "■ 카피"]).concat(p.copy.map(function (c) { return "- " + c[0] + ": " + f(c[1]); }))
      .concat(["", "■ 최적화 셋팅"]).concat(p.setup.map(function (s) { return "- " + s[0] + ": " + f(s[1]); }))
      .concat(["", "■ 테스트: " + f(p.test), "■ 합격선"]).concat(passRows(chId, n, f).map(function (r) { return "- " + r[0] + ": " + r[1]; }))
      .concat(["", "■ 하지 말 것"]).concat(p.dont.map(function (d) { return "- " + d; })).join("\n");
  }

  /* 여러 매체를 탭으로 묶은 블록 (랜딩 분석·메뉴 공용). ctx를 data 속성에 넣어 저장된 기록에서도 동작 */
  function block(chIds, ctx, opts) {
    opts = opts || {};
    var ids = chIds.filter(has);
    if (!ids.length) return "";
    var c = { cat: ctx.cat || "", payout: +ctx.payout || 0, approve: +ctx.approve || 70, terms: ctx.terms || "", age: ctx.age || "" };
    return '<div class="panel stack studio plan" data-stctx="' + esc(JSON.stringify(c)) + '">' +
      (opts.title !== false ? '<div class="plan-head"><h3>' + esc(opts.title || "플랫폼별 광고 제작 · 최적화 셋팅") + '</h3><span class="tag">매체별 바로 집행용</span></div>' +
        '<p class="note">' + esc(opts.note || "탭을 눌러 매체를 바꾸세요. 같은 캠페인이라도 매체마다 소재 형태, 카피 톤, 예산·입찰 값이 달라집니다.") + "</p>" : "") +
      '<div class="seg wrap sttabs" role="tablist">' + ids.map(function (id, i) {
        return '<button type="button" data-stab="' + id + '" aria-pressed="' + (i === 0 ? "true" : "false") + '">' + (opts.ranked ? (i + 1) + ". " : "") + esc(L.chName[id]) + "</button>";
      }).join("") + "</div>" +
      ids.map(function (id, i) { return '<div class="stpane"' + (i === 0 ? "" : " hidden") + ' data-stp="' + id + '">' + card(id, c, opts.ranked ? i + 1 : 0) + "</div>"; }).join("") +
      "</div>";
  }

  function ctxOf(el) {
    var w = el.closest("[data-stctx]");
    try { return w ? JSON.parse(w.dataset.stctx) : readForm(); } catch (e) { return readForm(); }
  }

  /* 어디서든(분석 결과, 분석 기록 미리보기, 제작 화면) 탭·버튼이 동작하도록 문서 단위로 처리 */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-stab],[data-stops],[data-stcopy],[data-stch],[data-mkgo]");
    if (!b) return;
    if (b.dataset.stab) {
      var w = b.closest(".studio"); if (!w) return;
      w.querySelectorAll("[data-stab]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      w.querySelectorAll("[data-stp]").forEach(function (x) { x.hidden = x.dataset.stp !== b.dataset.stab; });
      return;
    }
    var pv = document.getElementById("pvClose"), inPv = !!b.closest("#pvBody");
    var ctx = ctxOf(b), cat = L.catById(ctx.cat);
    if (b.dataset.mkgo) { if (inPv && pv) pv.click(); open(b.dataset.mkgo, b.closest("#studio") ? null : ctx); return; }
    if (b.dataset.stcopy) { L.copyText(text(b.dataset.stcopy, ctx), "셋팅안을 복사했습니다"); if (b.closest("#studio")) made(); return; }
    if (b.dataset.stch) {
      L.show("channels");
      var t = document.querySelector('#chTabs [data-ch="' + b.dataset.stch + '"]'); if (t) t.click();
      return;
    }
    if (b.dataset.stops) {
      if (inPv && pv) pv.click();
      opsFor(b.dataset.stops, ctx, cat);
    }
  });
  function opsFor(id, ctx, cat) {
    if (!L.ops) return;
    var p = BY[id], f = filler(id, ctx), w = L.flow && L.flow.work(), pickT = sel(id).t;
    var name = (w && w.name ? w.name : (cat ? cat.keywords[0] : "새 캠페인")) + " · " + L.chName[id];
    if (w) L.flow.patch({ platform: id, made: true });
    L.ops.create({ name: name, ch: id, cat: ctx.cat || "", net: w ? w.net : "", payout: ctx.payout, approve: ctx.approve,
      terms: ctx.terms || (ctx.age ? ctx.age + "세" : ""), head: pickT || (p ? f(p.copy[0][1]) : ""), fromPlan: text(id, ctx) });
  }

  /* ───────── 4단계 화면 ───────── */
  var cur = null, loadedAt = null, mk = {}, imgs = {}, bg = null, more = 0, ratio = {};
  function readForm() {
    var w = L.flow && L.flow.work();
    return { cat: $("stCat").value, payout: L.num("stPayout"), approve: L.num("stApprove") || 70, age: $("stAge").value.trim(), terms: w ? w.media || "" : "" };
  }
  function blockedOf() { var w = L.flow && L.flow.work(); return w && L.merchant ? L.merchant.mediaRules(w.media) : {}; }
  function order(catId) {
    var cat = L.catById(catId), rules = blockedOf();
    var first = cat ? cat.channels.filter(has) : [];
    var ids = first.concat((D.studio || []).map(function (p) { return p.id; }).filter(function (id) { return first.indexOf(id) < 0; }));
    return ids.filter(function (id) { return rules[id] !== "no"; }).concat(ids.filter(function (id) { return rules[id] === "no"; }));
  }
  function made() { if (L.flow && L.flow.work()) L.flow.patch({ made: true, platform: cur }); }
  function sel(id) { return mk[id] || (mk[id] = { t: "", s: "" }); }

  /* 제목·소제목 후보: 매체 카피 공식 + 업종 앵글 */
  var TITLE_RX = /(제목|헤드라인|카피 A|카피 B|첫 줄|첫 자막|썸네일|캡션)/, SUB_RX = /(설명|본문|서브)/;
  function cleanAngle(x) { return String(x).replace(/\(.*?\)/g, "").trim(); }
  function candidates(id, ctx) {
    var p = BY[id], f = filler(id, ctx), cat = L.catById(ctx.cat), c = cat || { angles: ["무료 확인"], keywords: ["무료 상담"] };
    var T = L.wins ? L.wins.titles(ctx.cat).map(function (t) { return t.slice(0, 40); }) : [], Sb = [];
    p.copy.forEach(function (x) { var v = f(x[1]); if (TITLE_RX.test(x[0])) T.push(v); else if (SUB_RX.test(x[0])) Sb.push(v); });
    var a0 = cleanAngle(c.angles[0]), a1 = cleanAngle(c.angles[1] || c.angles[0]);
    var search = id === "naver_sa" || id === "google_sa";
    if (id === "danggeun") T.push(f("[우리 동네] " + a0 + " 정리했어요"), f("우리 동네 {target}분들 많이 물어보신 {keyword}"));
    else if (id === "kakao") T.push(f("{keyword} 1분 무료 확인"), f(a0 + ", 지금 바로 조회"));
    else if (search) T.push(f("{keyword} 무료 비교"), f(a0 + " 무료 상담"));
    else T.push(f("{target}{이라면} 꼭 확인하세요"), f("{keyword}, 이것 모르고 가입하면 손해"), f(a0 + ", 1분이면 확인됩니다"), f(a1 + " 무료로 받아보세요"));
    Sb.push(f("{benefit}"), "1분 신청 · 상담은 무료, 결정은 천천히", f("{target} 맞춤으로 {number} 비교"));
    var uniq = function (arr) { var seen = {}; return arr.filter(function (x) { x = x.trim(); if (!x || seen[x]) return false; seen[x] = 1; return true; }); };
    return { t: uniq(T.concat(mk[id] && mk[id].aiT || [])), s: uniq(Sb.concat(mk[id] && mk[id].aiS || [])) };
  }
  function renderCopy(ctx) {
    var id = cur, p = BY[id], sp = ((D.opsRules || {}).spec || {})[id] || {}, max = sp.headMax || 30;
    var cand = candidates(id, ctx), m = sel(id);
    var n = cand.t.length, off = n ? more % n : 0;
    var tList = cand.t.slice(off).concat(cand.t.slice(0, off)).slice(0, 5), sList = cand.s.slice(0, 4);
    if (!m.t || cand.t.indexOf(m.t) < 0 && !m.edited) m.t = tList[0] || "";
    if (!m.s || cand.s.indexOf(m.s) < 0 && !m.edited) m.s = sList[0] || "";
    var opt = function (name, v, on) {
      var len = v.length, over = name === "mkT" && len > max;
      return '<label class="mkopt' + (on ? " on" : "") + '"><input type="radio" name="' + name + '" value="' + esc(v) + '"' + (on ? " checked" : "") + "><span>" + esc(v) + '</span><small class="' + (over ? "warnc" : "muted") + '">' + len + "자" + (over ? " · 길어요" : "") + "</small></label>";
    };
    $("mkCopy").innerHTML =
      '<div class="row between"><h3 class="sub">추천 제목 · 소제목 <small class="muted">' + esc(L.chName[id]) + " 톤 · 제목 " + max + '자 안팎</small></h3><div class="row"><button class="btn ghost sm" type="button" id="mkMore">↻ 다른 안</button><button class="btn ghost sm" type="button" id="mkAiT">AI 추천</button></div></div>' +
      '<p class="fitline">' + L.emph(p.tone) + "</p>" +
      "<h4>제목</h4>" + '<div class="mkopts">' + tList.map(function (v) { return opt("mkT", v, v === m.t); }).join("") + "</div>" +
      "<h4>소제목 · 본문 첫 줄</h4>" + '<div class="mkopts">' + sList.map(function (v) { return opt("mkS", v, v === m.s); }).join("") + "</div>" +
      '<div class="inputs"><label class="f full">제목 직접 수정<input type="text" id="mkTitle" value="' + esc(m.t) + '"></label><label class="f full">소제목 직접 수정<input type="text" id="mkSub" value="' + esc(m.s) + '"></label></div>' +
      '<div class="row"><button class="btn ghost sm" type="button" id="mkCopyBtn">제목 · 소제목 복사</button></div>' +
      (L.catById(ctx.cat) ? '<div class="avoid"><b>피할 표현</b> ' + esc(L.catById(ctx.cat).avoid) + "</div>" : "");
  }

  /* 이미지: 비율 · 지시문 · 캔버스 합성 */
  var SIZE = { "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080], "16:9": [1280, 720], "비즈보드": [1029, 258] };
  var API_RATIO = { "비즈보드": "21:9" };
  var SCENE = {
    insurance: "a Korean family in their 30s-40s at a bright kitchen table calmly reviewing papers on a tablet, warm natural light",
    rental: "a bright modern Korean apartment kitchen with a sleek white water purifier on the counter, clean and minimal",
    legal: "a calm, hopeful consultation scene: a counselor and a client talking at a tidy desk, soft daylight, faces not identifiable",
    startup: "a small cozy unmanned self-service cafe in a Korean neighborhood, warm evening light",
    education: "a Korean adult in their 30s studying with a laptop and notebook at home, focused and hopeful",
    telecom: "a cozy Korean living room with a TV and a wifi router on a shelf, family relaxing",
    home: "a bright freshly renovated Korean apartment living room, moving boxes neatly stacked",
    health: "a natural skincare or wellness product on a clean bathroom shelf, soft daylight, no medical imagery",
    local: "a bright, clean neighborhood fitness or pilates studio with equipment, morning light, no people's bodies emphasized",
    medical: "a clean, calm clinic reception or consultation room, soft light, no patients, no procedures, no before/after"
  };
  var MOOD = {
    meta: "authentic lifestyle photo, scroll-stopping, natural light, real people feel",
    tiktok: "UGC style, shot on a smartphone, casual and real, vertical framing",
    youtube: "bright presenter-style composition, high contrast, clear focal point",
    danggeun: "plain neighborhood photo taken with a phone, not glossy, warm local feel",
    kakao: "a single clean object on a simple solid light background, icon-like, lots of empty space",
    naver_gfa: "clean informative banner photo, tidy composition",
    native: "editorial news-photo style, documentary feel",
    naver_sa: "simple clean square thumbnail with one clear subject", google_sa: "simple clean square thumbnail with one clear subject"
  };
  function ratios(id) { var sp = ((D.opsRules || {}).spec || {})[id] || {}; var r = (sp.ratios || ["1:1"]).filter(function (x) { return SIZE[x]; }); return r.length ? r : ["1:1"]; }
  function curRatio() { var r = ratios(cur); return r.indexOf(ratio[cur]) >= 0 ? ratio[cur] : r[0]; }
  function buildPrompt(ctx) {
    var w = L.flow && L.flow.work(), cat = L.catById(ctx.cat), m = sel(cur), ch = L.chById(cur);
    var page = String((w && w.page) || ($("lpText") && $("lpText").value) || "").replace(/\s+/g, " ").slice(0, 240);
    var overlay = $("mkOverlay").checked, r = curRatio();
    return [
      "Create a photorealistic advertising image for a Korean " + (ch ? ch.name : cur) + " ad, aspect ratio " + (API_RATIO[r] || r) + ".",
      "Offer: " + (cat ? cat.name : "consultation service") + (page ? " — landing page says: \"" + page + "\"" : "") + ".",
      "Audience: " + (cat ? cat.target : "Korean adults") + ".",
      "Scene: " + (SCENE[ctx.cat] || "a trustworthy, bright real-life scene related to the offer") + ".",
      "Style: " + (MOOD[cur] || "clean, trustworthy") + ".",
      overlay ? "Do NOT render any text, letters, numbers, logos or watermarks. Keep the " + (r === "비즈보드" ? "left half" : r === "9:16" ? "upper-middle area" : "top third") + " simple and uncluttered so a Korean headline can be placed there later."
        : "Render this Korean headline clearly with correct spelling in bold sans-serif: \"" + m.t + "\"" + (m.s ? " and a smaller subline \"" + m.s + "\"" : "") + ". No other text.",
      "Avoid: exaggerated claims, money piles, before/after or medical imagery, celebrities, real brand logos, anything that looks like an official government notice."
    ].join("\n");
  }
  function wrap(ctx2, text, maxW) {
    var words = String(text || "").split(/(\s+)/), lines = [], line = "";
    words.forEach(function (wd) {
      var test = line + wd;
      if (ctx2.measureText(test).width > maxW && line.trim()) { lines.push(line.trim()); line = wd.trim(); }
      else line = test;
    });
    if (line.trim()) lines.push(line.trim());
    // 띄어쓰기 없는 긴 줄은 글자 단위로 자름
    var out = [];
    lines.forEach(function (l) {
      if (ctx2.measureText(l).width <= maxW) { out.push(l); return; }
      var cur2 = "";
      Array.from(l).forEach(function (ch) { if (ctx2.measureText(cur2 + ch).width > maxW && cur2) { out.push(cur2); cur2 = ch; } else cur2 += ch; });
      if (cur2) out.push(cur2);
    });
    return out;
  }
  function draw() {
    var cv = $("mkCanvas"); if (!cv || !cur) return;
    var r = curRatio(), sz = SIZE[r] || SIZE["1:1"], W = sz[0], H = sz[1];
    cv.width = W; cv.height = H;
    var g = cv.getContext("2d"); if (!g) return;
    var m = sel(cur), font = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    if (bg && bg.complete && bg.naturalWidth) {
      var s2 = Math.max(W / bg.naturalWidth, H / bg.naturalHeight), dw = bg.naturalWidth * s2, dh = bg.naturalHeight * s2;
      g.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      var gr = g.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, "#1FB865"); gr.addColorStop(1, "#0e5a8a");
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = "rgba(255,255,255,.08)";
      for (var i = 0; i < 6; i++) { g.beginPath(); g.arc(W * (0.15 + i * 0.17), H * (0.75 - (i % 2) * 0.35), Math.min(W, H) * 0.18, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = "rgba(255,255,255,.55)"; g.font = "700 " + Math.round(Math.min(W, H) * 0.035) + "px " + font; g.textAlign = "right";
      g.fillText("이미지 생성 전 시안", W - Math.min(W, H) * 0.05, H - Math.min(W, H) * 0.05);
    }
    if (!$("mkOverlay").checked) return;
    var biz = r === "비즈보드", pad = biz ? 40 : Math.round(W * 0.07), maxW = biz ? W * 0.55 : W - pad * 2;
    var tSize = biz ? 44 : Math.round(Math.min(W, H) * (r === "16:9" ? 0.075 : 0.085)), sSize = Math.round(tSize * 0.55);
    g.font = "800 " + tSize + "px " + font;
    var tl = wrap(g, m.t, maxW).slice(0, biz ? 2 : 3);
    g.font = "600 " + sSize + "px " + font;
    var sl = biz ? [] : wrap(g, m.s, maxW).slice(0, 2);
    var blockH = tl.length * tSize * 1.22 + (sl.length ? sSize * 0.6 + sl.length * sSize * 1.3 : 0) + (biz ? 0 : sSize * 2.4);
    var y0 = biz ? (H - tl.length * tSize * 1.22) / 2 : r === "9:16" ? H * 0.16 : Math.max(pad, H * 0.08);
    // 가독성 그라데이션
    var shade = g.createLinearGradient(0, biz ? 0 : y0 - pad, biz ? W * 0.7 : 0, biz ? 0 : y0 + blockH + pad);
    shade.addColorStop(0, "rgba(0,0,0,.62)"); shade.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = shade;
    if (biz) g.fillRect(0, 0, W * 0.75, H); else g.fillRect(0, Math.max(0, y0 - pad), W, blockH + pad * 2);
    g.textAlign = "left"; g.textBaseline = "top"; g.fillStyle = "#fff";
    g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 8;
    g.font = "800 " + tSize + "px " + font;
    var y = y0;
    tl.forEach(function (l) { g.fillText(l, pad, y); y += tSize * 1.22; });
    if (sl.length) {
      y += sSize * 0.6; g.font = "600 " + sSize + "px " + font; g.fillStyle = "rgba(255,255,255,.92)";
      sl.forEach(function (l) { g.fillText(l, pad, y); y += sSize * 1.3; });
    }
    g.shadowBlur = 0;
    if (!biz) {
      var cta = (BY[cur] && /CTA|버튼/.test(BY[cur].copy[BY[cur].copy.length - 1][0]) ? BY[cur].copy[BY[cur].copy.length - 1][1].split(/[\/(]/)[0].trim() : "자세히 보기") || "자세히 보기";
      g.font = "800 " + sSize + "px " + font;
      var cw = g.measureText(cta).width + sSize * 1.6, ch2 = sSize * 1.9, cy = y + sSize * 0.6;
      g.fillStyle = "#1FB865";
      if (g.roundRect) { g.beginPath(); g.roundRect(pad, cy, cw, ch2, ch2 / 2); g.fill(); } else g.fillRect(pad, cy, cw, ch2);
      g.fillStyle = "#fff"; g.textBaseline = "middle"; g.fillText(cta, pad + sSize * 0.8, cy + ch2 / 2);
    }
  }
  function thumbs() {
    var list = imgs[cur] || [];
    $("mkThumbs").innerHTML = list.map(function (u, i) { return '<button type="button" data-mkimg="' + i + '" aria-pressed="' + (bg && bg.src === u) + '"><img src="' + u + '" alt="생성 이미지 ' + (i + 1) + '"></button>'; }).join("");
  }
  function renderImg(ctx) {
    var rs = ratios(cur), r = curRatio();
    $("mkRatio").innerHTML = rs.map(function (x) { return '<button type="button" data-mkr="' + esc(x) + '" aria-pressed="' + (x === r) + '">' + esc(x) + "</button>"; }).join("");
    var sp = ((D.opsRules || {}).spec || {})[cur] || {};
    $("mkRatioNote").textContent = sp.text ? "검색광고는 문구가 핵심 · 이미지는 확장소재용" : (sp.note || "");
    if (!$("mkPrompt").dataset.edited) $("mkPrompt").value = buildPrompt(ctx);
    thumbs();
    var S = L.settings();
    if (!$("mkMsg").dataset.busy && !$("mkMsg").dataset.keep) $("mkMsg").innerHTML = S.geminiKey ? "나노바나나(" + esc(S.imgModel || "gemini-2.5-flash-image") + ")로 배경 이미지를 만들고, 제목·소제목은 캔버스로 합성해 한글이 깨지지 않게 합니다."
      : "이미지 생성은 <b>Gemini API 키</b>가 필요합니다. 키가 없으면 위 시안을 쓰거나 지시문을 복사해 Gemini 앱에서 만드세요. " + '<button class="linkbtn" type="button" data-goto="settings">설정 열기</button>';
    draw();
  }
  function genImage() {
    var S = L.settings(), b = $("mkGen"), msg = $("mkMsg");
    if (!S.geminiKey) { renderImg(readForm()); L.toast("설정에서 Gemini API 키를 넣으면 이미지를 만들 수 있습니다"); return; }
    var refs = $("lpImgs") ? Array.prototype.slice.call($("lpImgs").files || []) : [];
    var prompt = $("mkPrompt").value + (refs.length ? "\nUse the attached landing page screenshot(s) only for product and color cues. Do not copy any text from them." : "");
    b.disabled = true; b.textContent = "생성 중…"; msg.dataset.busy = "1"; msg.innerHTML = '<span class="spin"></span> 이미지를 만드는 중입니다. 10~30초 걸립니다…';
    var id = cur, r = curRatio();
    window.LabAI.image({ settings: S, prompt: prompt, aspect: API_RATIO[r] || r, refs: refs }).then(function (urls) {
      imgs[id] = urls.concat(imgs[id] || []).slice(0, 8);
      var im = new Image(); im.onload = function () { if (cur === id) { bg = im; draw(); thumbs(); } }; im.src = urls[0];
      thumbs(); delete msg.dataset.busy; msg.dataset.keep = id; msg.textContent = "이미지 " + urls.length + "장을 만들었습니다. PNG 저장을 누르면 제목이 합성된 광고 이미지로 저장됩니다.";
      made();
    }).catch(function (e) { delete msg.dataset.busy; msg.textContent = (e && e.message) || "이미지 생성에 실패했습니다"; L.toast(msg.textContent); })
      .then(function () { b.disabled = false; b.textContent = "나노바나나로 이미지 생성"; });
  }
  function download() {
    var cv = $("mkCanvas");
    try {
      var a = document.createElement("a");
      a.download = (L.chName[cur] || cur) + "_" + curRatio().replace(":", "x") + "_" + Date.now().toString(36) + ".png";
      a.href = cv.toDataURL("image/png"); document.body.appendChild(a); a.click(); a.remove();
      made(); L.toast("광고 이미지를 저장했습니다");
    } catch (e) { L.toast("이 화면에서는 저장이 막혀 있습니다. 이미지를 길게 눌러 저장하세요"); }
  }
  function aiTitles() {
    var S = L.settings();
    if (S.provider === "local") { L.toast("설정에서 AI 엔진을 켜면 제목을 추천해 드립니다"); L.show("settings"); return; }
    var ctx = readForm(), id = cur, cat = L.catById(ctx.cat), sp = ((D.opsRules || {}).spec || {})[id] || {}, w = L.flow && L.flow.work();
    var b = $("mkAiT"); b.disabled = true; b.textContent = "추천 중…";
    var prompt = [
      "한국 " + L.chById(id).name + " 광고 카피라이터로서, 아래 캠페인의 광고 제목 5개와 소제목 3개를 만들어 주세요.",
      "매체 톤: " + BY[id].tone.replace(/\*\*/g, ""), "제목 길이: " + (sp.headMax || 30) + "자 안팎",
      "업종: " + (cat ? cat.name + " / 타깃 " + cat.target + " / 고민 " + cat.pain + " / 혜택 " + cat.benefit : "미정"),
      w && w.page ? "랜딩 페이지 내용: " + String(w.page).slice(0, 500) : "",
      cat ? "피할 표현: " + cat.avoid : "", "단정·과장 금지, 후기형이면 [광고] 표기.",
      '출력은 JSON 한 줄만: {"titles":["..."],"subs":["..."]}'
    ].filter(Boolean).join("\n");
    window.LabAI.run({ provider: S.provider, settings: Object.assign({}, S, { web: false }), prompt: prompt, onText: function () {} }).then(function (t) {
      var s2 = String(t || ""), a = s2.indexOf("{"), z = s2.lastIndexOf("}"), j = {};
      try { j = JSON.parse(s2.slice(a, z + 1)); } catch (e) { j = {}; }
      var T = (j.titles || []).map(String).filter(Boolean).slice(0, 5), Sb = (j.subs || []).map(String).filter(Boolean).slice(0, 3);
      if (!T.length) throw new Error("AI 제목을 받지 못했습니다");
      var m = sel(id); m.aiT = T.concat(m.aiT || []); m.aiS = Sb.concat(m.aiS || []); m.t = T[0]; if (Sb[0]) m.s = Sb[0]; m.edited = false;
      more = 0; renderCopy(readForm()); renderImg(readForm()); L.toast("AI 제목 " + T.length + "개를 추가했습니다");
    }).catch(function (e) { L.toast((e && e.message) || "AI 추천에 실패했습니다"); }).then(function () { b.disabled = false; b.textContent = "AI 추천"; });
  }


  /* ───────── 소재 묶음: 앵글 4개 × 문구 5개 + 이미지 지시문 10개 ───────── */
  var bkAI = {};
  function batch(id, ctx) {
    if (bkAI[id]) return bkAI[id];
    var f = filler(id, ctx), cat = L.catById(ctx.cat), c = cat || { angles: ["무료 확인", "조건 비교", "혜택 안내", "신청 방법"] };
    var dg = id === "danggeun", search = id === "naver_sa" || id === "google_sa";
    var angles = c.angles.slice(0, 4).map(cleanAngle);
    var rows = [];
    angles.forEach(function (a) {
      var tpl = search ? [a + " {keyword}", "{keyword} " + a + " 무료 상담", a + " · 1분 신청", (/비교/.test(a) ? "{keyword} " + a : "{keyword} 비교 " + a), a + " 무료 확인"]
        : dg ? ["[우리 동네] " + a + " 정리했어요", "{keyword} 알아보신다면 " + a + "부터", "이웃분들 많이 물어본 " + a, a + ", 이번 달 조건 확인해 보세요", "우리 동네 {keyword} " + a + (/비교$/.test(a) ? "" : " 비교")]
        : [a + ", {keyword} 이번 달 조건 확인", "{keyword} 알아보신다면 " + a + "부터", "{target}{이라면} " + a + " 확인해 보세요", a + " · 1분이면 무료 확인", "{keyword}, " + a + (/비교$/.test(a) ? "하고" : " 비교하고") + " 결정하세요"];
      tpl.forEach(function (t) { rows.push({ angle: a, text: f(t) }); });
    });
    var base = SCENE[ctx.cat] || "a trustworthy, bright real-life scene related to the offer", mood = MOOD[id] || "clean, trustworthy";
    var shots = ["close-up of the product in a real home", "a person's hands using it naturally", "wide shot of the room where it is used", "eye-level smartphone photo, slightly imperfect framing",
      "top-down flat lay on a table", "morning natural light by a window", "evening warm indoor light", "outdoor neighborhood context nearby", "minimal composition with lots of empty space", "a relatable everyday moment of a family or single household"];
    var imgsP = shots.map(function (sh) { return base + ", " + sh + ". Style: " + mood + ". No text, letters, logos or watermarks."; });
    return { rows: rows, imgs: imgsP, src: "rule" };
  }
  function renderBatch(ctx) {
    var b = batch(cur, ctx), sp = ((D.opsRules || {}).spec || {})[cur] || {}, max = cur === "danggeun" ? 28 : (sp.headMax || 30);
    var over = b.rows.filter(function (r) { return r.text.length > max; }).length;
    $("bkMsg").innerHTML = (b.src === "ai" ? '<span class="pill warn">AI 생성</span> ' : '<span class="pill none">규칙 생성</span> ') + esc(L.chName[cur]) + " 기준 " + b.rows.length + "개 · 글자 수 기준 " + max + "자" +
      (over ? ' · <span class="warnc">' + over + "개는 길어서 줄여야 합니다</span>" : "") + ". 한 번에 다 올리지 말고 <b>3개씩 3일</b> 테스트하고, 진 소재 자리에 다음 문구를 넣으며 순환하세요.";
    $("bkTable").innerHTML = "<thead><tr><th>#</th><th>앵글</th><th>문구</th><th class=\"n\">글자</th><th></th></tr></thead><tbody>" + b.rows.map(function (r, i) {
      var long = r.text.length > max;
      return "<tr><td class=\"num\">" + (i + 1) + '</td><td class="ang">' + esc(r.angle) + "</td><td>" + esc(r.text) + '</td><td class="n ' + (long ? "warnc" : "") + '">' + r.text.length + '</td><td><button class="btn ghost sm" type="button" data-bkuse="' + i + '">제목으로</button></td></tr>';
    }).join("") + "</tbody>";
    $("bkImgs").innerHTML = b.imgs.map(function (t, i) { return "<div><span>" + esc(t) + '</span><button class="btn ghost sm" type="button" data-bkimg="' + i + '">사용</button></div>'; }).join("");
  }
  function batchTSV() {
    var b = batch(cur, readForm());
    return ["플랫폼\t앵글\t문구\t글자 수\t상태"].concat(b.rows.map(function (r) { return [L.chName[cur], r.angle, r.text.replace(/\t/g, " "), r.text.length, "대기"].join("\t"); }))
      .concat(["", "이미지 지시문"]).concat(b.imgs).join("\n");
  }
  function aiBatch() {
    var S = L.settings();
    if (S.provider === "local") { L.toast("설정에서 AI 엔진을 켜면 소재 묶음을 만들어 드립니다"); L.show("settings"); return; }
    var ctx = readForm(), id = cur, cat = L.catById(ctx.cat), w = L.flow && L.flow.work(), sp = ((D.opsRules || {}).spec || {})[id] || {};
    var max = id === "danggeun" ? 28 : (sp.headMax || 30), angles = (cat ? cat.angles : ["혜택", "가성비", "편의", "교체 시기"]).slice(0, 4).map(cleanAngle);
    var prompt = [
      "[역할] 너는 " + L.chById(id).name + " 사용자의 시선을 0.5초 만에 잡는 한국 퍼포먼스 마케터다.",
      "[입력] 업종: " + (cat ? cat.name + " / 타깃 " + cat.target + " / 고민 " + cat.pain + " / 혜택 " + cat.benefit : "미정") + (w && w.page ? "\n랜딩 페이지 내용: " + String(w.page).slice(0, 600) : ""),
      "[매체 톤] " + BY[id].tone.replace(/\*\*/g, ""),
      "[제약] 1. 공백 포함 " + max + "자 이내 2. 과장·허위 표현 금지('최고','1위','무조건','공짜','100%') " + (cat ? "3. 피할 표현: " + cat.avoid : ""),
      "[앵글] " + angles.join(" / ") + " — 각 앵글마다 5개씩 총 20개",
      "[이미지] 글자 없는 광고 사진용 영어 지시문 10개 (실제 스마트폰 사진처럼, 장면·구도·빛을 서로 다르게)",
      '출력은 JSON 한 덩어리만: {"copies":[{"angle":"앵글","text":"문구"}],"images":["prompt"]}'
    ].join("\n");
    var btn = $("bkAi"); btn.disabled = true; btn.textContent = "만드는 중…";
    window.LabAI.run({ provider: S.provider, settings: Object.assign({}, S, { web: false }), prompt: prompt, onText: function () {} }).then(function (t) {
      var s2 = String(t || ""), a = s2.indexOf("{"), z = s2.lastIndexOf("}"), j = {};
      try { j = JSON.parse(s2.slice(a, z + 1)); } catch (e) { j = {}; }
      var rows = (j.copies || []).filter(function (x) { return x && x.text; }).map(function (x) { return { angle: String(x.angle || ""), text: String(x.text).trim() }; }).slice(0, 30);
      if (!rows.length) throw new Error("AI 소재 묶음을 받지 못했습니다");
      var rule = batch(id, ctx);
      bkAI[id] = { rows: rows, imgs: (j.images || []).map(String).filter(Boolean).slice(0, 10).concat(rule.imgs).slice(0, 10), src: "ai" };
      renderBatch(readForm()); L.toast("AI 소재 " + rows.length + "개를 만들었습니다");
    }).catch(function (e) { L.toast((e && e.message) || "AI 생성에 실패했습니다"); }).then(function () { btn.disabled = false; btn.textContent = "AI로 다시 만들기"; });
  }

  /* ───────── 브릿지 페이지 HTML ───────── */
  function bridgeHTML() {
    var w = L.flow && L.flow.work(), ctx = readForm(), cat = L.catById(ctx.cat), m = sel(cur), st = L.store.get("bridge", {});
    var url = $("brUrl").value.trim(), pixel = ($("brPixel").value || "").replace(/\D/g, ""), gtm = ($("brGtm").value || "").trim().toUpperCase();
    if (!/^GTM-[A-Z0-9]+$/.test(gtm)) gtm = "";
    var safeUrl = /^https?:\/\//i.test(url) ? url : "#";
    var page = String((w && w.page) || "");
    var pts = page.split(/[.\n·]|폼:/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length >= 6 && x.length <= 60 && !/(무효|금지|폼|승인|DB|연락처|이름,|성함)/.test(x); }).slice(0, 3);
    if (pts.length < 2 && cat) pts = [cat.benefit.replace(/있다$/, "있습니다").replace(/는다$/, "습니다"), "신청은 1분이면 끝나고 상담은 무료입니다", "상담 후 결정해도 괜찮습니다"];
    var h = function (x) { return esc(x); };
    var title = m.t || (cat ? cat.keywords[0] + " 무료 확인" : "무료 상담 안내"), sub = m.s || (cat ? cat.benefit : "");
    return [
      "<!doctype html>", '<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
      "<title>" + h(title) + "</title>", '<meta name="robots" content="noindex">',
      gtm ? "<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','" + gtm + "');</script>" : "",
      pixel ? "<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','" + pixel + "');fbq('track','PageView');</script>" : "",
      $("brExtra").value.trim(),
      "<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;background:#f4f5f7;color:#1b1d22}main{max-width:480px;margin:0 auto;padding:28px 20px 40px}.ad{display:inline-block;font-size:12px;font-weight:700;color:#7a808a;border:1px solid #d5d9e0;border-radius:6px;padding:2px 8px}h1{font-size:26px;line-height:1.35;margin:14px 0 8px;letter-spacing:-.02em}.sub{color:#555b66;font-size:16px;margin:0 0 18px}ul{list-style:none;padding:0;margin:0 0 22px;display:grid;gap:10px}li{background:#fff;border-radius:14px;padding:14px 16px;font-size:15px;font-weight:600}li:before{content:'✔ ';color:#1FB865}.go{display:block;text-align:center;background:#1FB865;color:#fff;font-size:18px;font-weight:800;text-decoration:none;padding:17px;border-radius:14px}.note{font-size:12px;color:#7a808a;line-height:1.6;margin-top:22px}</style>",
      "</head><body>", gtm ? '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=' + gtm + '" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>' : "",
      "<main>", '<span class="ad">광고 · 제휴 안내</span>', "<h1>" + h(title) + "</h1>", sub ? '<p class="sub">' + h(sub) + "</p>" : "",
      "<ul>" + pts.map(function (x) { return "<li>" + h(x) + "</li>"; }).join("") + "</ul>",
      '<a class="go" id="go" href="' + h(safeUrl) + '" rel="nofollow">' + h(cat ? "무료로 확인하기" : "신청하러 가기") + " →</a>",
      '<p class="note">이 페이지는 제휴 마케팅 광고 안내 페이지입니다. 신청은 광고주(서비스 제공사) 페이지에서 진행되며, 운영자는 광고주로부터 수수료를 받을 수 있습니다. 운영자는 광고주의 공식 대리점이 아닙니다.' + ($("brOwner").value.trim() ? "<br>" + h($("brOwner").value.trim()) : "") + "</p>",
      "</main>",
      "<script>document.getElementById('go').addEventListener('click',function(e){var u=this.href;if(!/^https?:/.test(u))return;e.preventDefault();try{if(window.fbq)fbq('track','Lead');}catch(_){}try{(window.dataLayer=window.dataLayer||[]).push({event:'apply_click'});}catch(_){}setTimeout(function(){location.href=u;},350);});</script>",
      "</body></html>"
    ].filter(Boolean).join("\n");
  }
  function renderBridge() {
    var w = L.flow && L.flow.work();
    if (!$("brUrl").dataset.touched) $("brUrl").value = (w && w.url) || "";
    var html = bridgeHTML();
    $("brOut").value = html;
    // 미리보기에는 스크립트를 빼고 넣음 (픽셀이 미리보기에서 집계되지 않도록)
    $("brPreview").srcdoc = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  }

  function syncFromWork(force) {
    var w = L.flow && L.flow.work(); if (!w) return;
    var stamp = (w.at || 0) + ":" + w.name;
    if (!force && loadedAt === stamp) return;
    loadedAt = stamp;
    $("stCat").value = w.cat || ""; $("stPayout").value = w.payout || ""; $("stApprove").value = w.approve || 70;
    $("stAge").value = L.flow.ageOf(w.media);
    if (!cur && (w.platform || w.best)) cur = w.platform || w.best;
  }
  function render() {
    syncFromWork(false);
    var ctx = readForm();
    L.store.set("studio", ctx);
    var ids = order(ctx.cat), cat = L.catById(ctx.cat), rules = blockedOf(), w = L.flow && L.flow.work();
    if (!cur || ids.indexOf(cur) < 0) cur = ids[0];
    $("stPlats").innerHTML = ids.map(function (id) {
      var n = numbers(id, ctx), p = BY[id], pos = cat ? cat.channels.indexOf(id) : -1, no = rules[id] === "no";
      return '<button type="button" role="radio" class="plat' + (no ? " no" : "") + '" data-stgo="' + id + '" aria-checked="' + (id === cur) + '">' +
        '<span class="pt"><b>' + esc(L.chName[id]) + "</b>" + (no ? '<span class="pill bad">조건상 불가</span>' : pos >= 0 ? '<span class="pill ' + (pos < 2 ? "good" : "warn") + '">' + (pos + 1) + "순위</span>" : "") + "</span>" +
        "<small>" + esc(p.formats[0][0]) + "</small><span class=\"pn\">" + (n.ok ? "상한 " + won(n.cap) : "단가 입력 시 계산") + "</span></button>";
    }).join("");
    $("stHint").innerHTML = (w ? "<b>" + esc(w.name) + "</b>의 조건을 불러왔습니다. " : "") +
      (cat ? esc(cat.name) + " 추천 순서: " + cat.channels.filter(has).map(function (id) { return esc(L.chName[id]); }).join(" → ") : "업종을 고르면 그 업종에 맞는 매체 순서와 카피 예시로 바뀝니다.") +
      (Object.keys(rules).some(function (k) { return rules[k] === "no"; }) ? ' · <span class="neg">캠페인 조건상 불가 매체는 뒤로 뺐습니다</span>' : "");
    renderCopy(ctx);
    renderImg(ctx);
    renderBatch(ctx);
    renderBridge();
    $("stBody").innerHTML = '<div class="panel stack studio plan" data-stctx="' + esc(JSON.stringify(ctx)) + '"><div class="plan-head"><h3>최적화 셋팅 · 테스트 기준</h3><span class="tag">광고 관리자 입력값</span></div>' + card(cur, ctx, 0) + "</div>";
    if (rules[cur] === "no") $("stBody").insertAdjacentHTML("afterbegin", '<div class="notice bad"><b>' + esc(L.chName[cur]) + "는 이 캠페인 조건상 집행 불가입니다.</b> 집행하면 무효·정산 제외 위험이 있습니다.</div>");
  }
  function pickPlat(id) {
    if (!BY[id]) return;
    cur = id; more = 0; bg = null; delete $("mkMsg").dataset.keep;
    var list = imgs[id]; if (list && list[0]) { var im = new Image(); im.onload = function () { if (cur === id) { bg = im; draw(); } }; im.src = list[0]; }
    delete $("mkPrompt").dataset.edited;
    if (L.flow && L.flow.work()) L.flow.patch({ platform: id }); else L.emit("view");
    render();
  }
  function runAI() {
    var ctx = readForm(), id = cur || "meta", out = $("stAiOut"), m = sel(id);
    if (L.settings().provider === "local") { L.toast("설정에서 AI 엔진을 켜면 대본·카피를 만들어 드립니다"); L.show("settings"); return; }
    out.innerHTML = "";
    var prompt = [
      "당신은 한국 CPA 제휴마케팅(DB 캠페인)과 " + L.chById(id).name + " 광고 제작 전문가입니다.",
      "아래 셋팅안을 바탕으로 이 매체에서 바로 집행할 수 있는 광고 소재와 셋팅을 완성해 주세요. 확인하지 않은 수치를 지어내지 말고, 매체 정책·업종 심의를 지키는 표현만 쓰세요.",
      "", "[고른 제목] " + (m.t || "-") + " / [고른 소제목] " + (m.s || "-"), "", text(id, ctx), "",
      "다음 순서로 답하세요:",
      "## 이 매체에서 이기는 이유와 주의점 (3줄)",
      "## 완성 소재 3안 (각각: 첫 문장 · 화면/이미지 구성 · 자막·본문 · CTA · 규격)",
      "## 영상이면 촬영 대본 1개 (초 단위), 이미지면 디자인 지시서 1개",
      "## 광고 관리자 셋팅 순서 (클릭 순서대로, 위 숫자 사용)",
      "## 3일차·7일차 판단 기준",
      "규칙: 한국어, 핵심 문장은 **굵게**. 마지막 줄에 'KEYWORDS: …'로 레퍼런스 검색 키워드 5개."
    ].join("\n");
    L.analyze.aiBlock(out, { prompt: prompt, runBtn: $("stAi"), stopBtn: $("stStop") });
  }

  function init() {
    if (!$("studio")) return;
    L.fillSelect($("stCat"), D.categories.map(function (c) { return [c.id, c.name]; }), 1);
    var s = L.store.get("studio", {});
    $("stCat").value = s.cat || ""; $("stPayout").value = s.payout || ""; $("stApprove").value = s.approve || 70; $("stAge").value = s.age || "";
    ["stCat", "stPayout", "stApprove", "stAge"].forEach(function (id) { $(id).addEventListener("change", render); });
    $("stPlats").addEventListener("click", function (e) { var b = e.target.closest("[data-stgo]"); if (b) pickPlat(b.dataset.stgo); });
    $("stBody").addEventListener("click", function (e) { var c = e.target.closest("[data-copy]"); if (c) L.copyText(c.dataset.copy, "복사했습니다"); });
    $("mkCopy").addEventListener("change", function (e) {
      var m = sel(cur);
      if (e.target.name === "mkT") { m.t = e.target.value; m.edited = false; }
      else if (e.target.name === "mkS") { m.s = e.target.value; m.edited = false; }
      else return;
      renderCopy(readForm()); if (!$("mkPrompt").dataset.edited) $("mkPrompt").value = buildPrompt(readForm()); draw(); renderBridge();
    });
    $("mkCopy").addEventListener("input", function (e) {
      var m = sel(cur);
      if (e.target.id === "mkTitle") { m.t = e.target.value; m.edited = true; draw(); }
      if (e.target.id === "mkSub") { m.s = e.target.value; m.edited = true; draw(); }
    });
    $("mkCopy").addEventListener("click", function (e) {
      if (e.target.closest("#mkMore")) { more += 1; var m = sel(cur); m.t = ""; m.edited = false; renderCopy(readForm()); draw(); }
      else if (e.target.closest("#mkAiT")) aiTitles();
      else if (e.target.closest("#mkCopyBtn")) { var m2 = sel(cur); L.copyText(m2.t + "\n" + m2.s, "제목·소제목을 복사했습니다"); made(); }
    });
    $("mkRatio").addEventListener("click", function (e) { var b = e.target.closest("[data-mkr]"); if (!b) return; ratio[cur] = b.dataset.mkr; delete $("mkPrompt").dataset.edited; renderImg(readForm()); });
    $("mkThumbs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-mkimg]"); if (!b) return;
      var u = (imgs[cur] || [])[+b.dataset.mkimg]; if (!u) return;
      var im = new Image(); im.onload = function () { bg = im; draw(); thumbs(); }; im.src = u;
    });
    $("mkOverlay").addEventListener("change", function () { delete $("mkPrompt").dataset.edited; renderImg(readForm()); });
    $("mkPrompt").addEventListener("input", function () { $("mkPrompt").dataset.edited = "1"; });
    $("mkPromptReset").addEventListener("click", function () { delete $("mkPrompt").dataset.edited; $("mkPrompt").value = buildPrompt(readForm()); });
    $("mkPromptCopy").addEventListener("click", function () { L.copyText($("mkPrompt").value, "이미지 지시문을 복사했습니다"); });
    $("mkGen").addEventListener("click", genImage);
    $("bkAi").addEventListener("click", aiBatch);
    $("bkCopy").addEventListener("click", function () { L.copyText(batchTSV(), "소재 묶음을 복사했습니다. 구글시트 A1에 붙여넣으세요"); made(); });
    $("bkTable").addEventListener("click", function (e) {
      var b = e.target.closest("[data-bkuse]"); if (!b) return;
      var r = batch(cur, readForm()).rows[+b.dataset.bkuse]; if (!r) return;
      var m = sel(cur); m.t = r.text; m.edited = true; renderCopy(readForm()); draw(); renderBridge();
      $("mkCopy").scrollIntoView({ block: "start", behavior: "smooth" }); L.toast("제목으로 넣었습니다");
    });
    $("bkImgs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-bkimg]"); if (!b) return;
      var t = batch(cur, readForm()).imgs[+b.dataset.bkimg]; if (!t) return;
      $("mkPrompt").value = t + "\nAspect ratio " + (API_RATIO[curRatio()] || curRatio()) + "."; $("mkPrompt").dataset.edited = "1";
      $("mkPrompt").closest("details").open = true; $("mkImg").scrollIntoView({ block: "start", behavior: "smooth" }); L.toast("이미지 지시문을 넣었습니다. 나노바나나로 이미지 생성을 누르세요");
    });
    var bst = L.store.get("bridge", {});
    $("brPixel").value = bst.pixel || ""; $("brGtm").value = bst.gtm || ""; $("brOwner").value = bst.owner || ""; $("brExtra").value = bst.extra || "";
    ["brUrl", "brPixel", "brGtm", "brOwner", "brExtra"].forEach(function (k) {
      $(k).addEventListener("input", function () {
        if (k === "brUrl") $("brUrl").dataset.touched = "1";
        L.store.set("bridge", { pixel: $("brPixel").value.trim(), gtm: $("brGtm").value.trim(), owner: $("brOwner").value.trim(), extra: $("brExtra").value });
        renderBridge();
      });
    });
    $("brCopy").addEventListener("click", function () { L.copyText($("brOut").value, "브릿지 페이지 HTML을 복사했습니다. index.html로 저장해 내 도메인에 올리세요"); });
    $("mkDown").addEventListener("click", download);
    $("stAi").addEventListener("click", runAI);
    $("stAiOut").addEventListener("click", function (e) { var b = e.target.closest("[data-kw]"); if (b) L.goExplore(b.dataset.kw); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!$("studio").hidden) draw(); });
    L.onShow.studio = render;
    L.on("settings", function () { if (!$("studio").hidden) render(); });
    L.on("work", function () { if (!$("studio").hidden) { syncFromWork(false); } });
  }

  function open(id, ctx) {
    if (ctx) {
      if (ctx.cat != null) $("stCat").value = ctx.cat; if (ctx.payout) $("stPayout").value = ctx.payout; if (ctx.approve) $("stApprove").value = ctx.approve;
      if (ctx.age) $("stAge").value = ctx.age; else if (ctx.terms && L.flow) $("stAge").value = L.flow.ageOf(ctx.terms);
      var w = L.flow && L.flow.work(); if (w) loadedAt = (w.at || 0) + ":" + w.name;
    }
    if (id && BY[id]) { cur = id; bg = null; delete $("mkPrompt").dataset.edited; if (L.flow && L.flow.work()) L.flow.patch({ platform: id }); }
    L.show("studio");
  }
  L.studio = { block: block, card: card, text: text, numbers: numbers, has: has, open: open, candidates: candidates,
    current: function () { return cur; }, startOps: function () { opsFor(cur, readForm(), L.catById(readForm().cat)); }, draw: draw };
  (L.extraInits = L.extraInits || []).push(init);
})();
