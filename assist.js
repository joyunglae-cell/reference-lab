/* AI 비서 · 일간/주간/월간 보고서 · 분석 기록(미리보기) · 매체 추천 · 최신 사례 */
(function () {
  "use strict";
  var L = window.Lab, D = L.D, $ = L.$, esc = L.esc, won = L.won, fmt = L.fmt, pct = L.pct;
  var HIST_MAX = 60;

  function inArtifact() { return !!(window.claude && typeof window.claude.use === "function"); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function when(ts) { return new Date(ts).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function ytId(url) {
    var m = String(url || "").match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : "";
  }
  /* 저장된 HTML을 다시 그릴 때 스크립트·이벤트 속성을 걷어 냅니다 */
  function clean(html) {
    var tpl = document.createElement("template");
    tpl.innerHTML = String(html || "");
    tpl.content.querySelectorAll("script,iframe,object,embed,style,link,meta").forEach(function (n) { n.remove(); });
    tpl.content.querySelectorAll("*").forEach(function (n) {
      Array.prototype.slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
      });
    });
    return tpl.innerHTML;
  }
  function plain(md) { return String(md || "").replace(/^\s*KEYWORDS\s*:.*$/gim, "").trim(); }

  /* ───────── 분석 기록 저장소 ───────── */
  function hAll() { return L.store.get("history", []); }
  L.hist = {
    save: function (o) {
      var item = Object.assign({ id: uid(), at: Date.now(), ai: "" }, o);
      var list = [item].concat(hAll()).slice(0, HIST_MAX);
      L.store.set("history", list);
      renderCount();
      return item.id;
    },
    update: function (id, patch) {
      var list = hAll().map(function (h) { return h.id === id ? Object.assign({}, h, patch) : h; });
      L.store.set("history", list);
      if (!$("history").hidden) renderHist();
      if (openId === id) openPreview(id);
    },
    all: hAll
  };
  function renderCount() { var n = hAll().length; $("histCount").textContent = n ? String(n) : ""; }

  var KIND = { ad: "광고 분석", landing: "랜딩 분석", report: "보고서", cases: "사례", ops: "운영 점검" };
  var hFilter = "all";
  function renderHist() {
    document.querySelectorAll("#histFilter button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.hf === hFilter ? "true" : "false"); });
    var q = $("histSearch").value.trim().toLowerCase();
    var list = hAll().filter(function (h) {
      if (hFilter !== "all" && h.kind !== hFilter) return false;
      if (!q) return true;
      return [h.title, h.url, h.excerpt, h.ai].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    if (!list.length) {
      $("histCards").innerHTML = '<div class="panel empty-state" style="grid-column:1/-1"><b>' + (hAll().length ? "조건에 맞는 기록이 없습니다." : "아직 저장된 분석이 없습니다.") +
        "</b><p>광고 분석·랜딩 분석을 실행하거나 AI 비서에서 보고서를 받으면 여기에 자동으로 쌓입니다.</p></div>";
      return;
    }
    $("histCards").innerHTML = list.map(function (h) {
      var yt = ytId(h.url);
      var glyph = h.kind === "report" ? (h.badge || "보고서") : (h.platform || KIND[h.kind]);
      var num = (String(h.badge || "").match(/[\d,]+(점|원|%)/) || [""])[0];
      return '<button type="button" class="hcard" data-open="' + esc(h.id) + '">' +
        '<div class="hthumb">' + (yt ? '<img alt="" loading="lazy" src="https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg" onerror="this.remove()">' : "") +
          '<div class="glyph">' + (num ? "<b>" + esc(num) + "</b>" : "") + "<span>" + esc(glyph) + "</span></div>" +
          '<span class="tag blue kind">' + esc(KIND[h.kind] || h.kind) + "</span></div>" +
        '<div class="hbody"><div class="hmeta"><span>' + esc(when(h.at)) + "</span>" + (h.badge ? '<span class="tag hi">' + esc(h.badge) + "</span>" : "") +
          (h.ai ? '<span class="tag">AI 분석 포함</span>' : "") + "</div>" +
          "<h4>" + esc(h.title || h.url || "제목 없음") + "</h4>" +
          "<p>" + esc(h.ai ? plain(h.ai).replace(/[#*|>`-]/g, " ").slice(0, 220) : (h.excerpt || "")) + "</p></div></button>";
    }).join("");
  }

  /* 오른쪽 미리보기 패널 */
  var openId = null, lastFocus = null;
  function openPreview(id) {
    var h = hAll().filter(function (x) { return x.id === id; })[0];
    if (!h) return;
    if (!openId) lastFocus = document.activeElement;
    openId = id;
    $("pvTitle").innerHTML = '<span class="tag blue">' + esc(KIND[h.kind] || "") + "</span> " + esc(h.title || "") +
      "<small>" + esc(when(h.at)) + (h.url ? ' · <a href="' + esc(/^https?:/i.test(h.url) ? h.url : "#") + '" target="_blank" rel="noopener noreferrer">' + esc(h.url) + "</a>" : "") + "</small>";
    var yt = ytId(h.url), body = "";
    if (yt && !inArtifact()) body += '<iframe class="embed" src="https://www.youtube-nocookie.com/embed/' + yt + '" title="광고 영상 미리보기" allowfullscreen loading="lazy"></iframe>';
    else if (yt) body += '<img alt="광고 썸네일" src="https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg" style="border-radius:14px" onerror="this.remove()">';
    if (h.ai) body += '<div class="panel stack ai-box"><h3 class="sub">AI 분석 <span class="tag">' + esc(L.provLabel[h.provider] || "") + '</span></h3><div class="ai-body">' + window.LabAI.md(plain(h.ai)) + "</div></div>";
    if (h.localHtml) body += '<div class="stack">' + clean(h.localHtml) + "</div>";
    if (!body) body = '<p class="note">저장된 내용이 없습니다.</p>';
    $("pvBody").innerHTML = body;
    // 저장 당시의 AI 진행 표시·버튼은 미리보기에서 숨김
    $("pvBody").querySelectorAll(".thinking,[data-copyai],.err").forEach(function (n) { n.remove(); });
    $("preview").hidden = false;
    $("pvClose").focus();
  }
  function closePreview() {
    $("preview").hidden = true; openId = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ───────── 데이터 요약 (보고서·비서 공통) ───────── */
  function periodRange(p) {
    var d = L.dash, t = d.today();
    if (p === "day") return { from: t, to: t, pFrom: d.addDays(t, -1), pTo: d.addDays(t, -1), label: "오늘", prev: "어제" };
    if (p === "week") { var m = d.monday(t); return { from: m, to: t, pFrom: d.addDays(m, -7), pTo: d.addDays(m, -1), label: "이번 주", prev: "지난주" }; }
    var f = new Date(t.getFullYear(), t.getMonth(), 1);
    return { from: f, to: t, pFrom: new Date(t.getFullYear(), t.getMonth() - 1, 1), pTo: new Date(t.getFullYear(), t.getMonth(), 0), label: "이번 달", prev: "지난달" };
  }
  function slice(from, to) { var d = L.dash; return d.rows().filter(function (e) { var x = d.parse(e.date); return x >= from && x <= to; }); }
  function groupBy(list, fn) {
    var g = {};
    list.forEach(function (e) { var k = fn(e); (g[k] = g[k] || []).push(e); });
    return Object.keys(g).map(function (k) { return { k: k, a: L.dash.agg(g[k]) }; }).sort(function (x, y) { return y.a.profit - x.a.profit; });
  }
  function reportData(p) {
    var r = periodRange(p), cur = slice(r.from, r.to), prev = slice(r.pFrom, r.pTo);
    return {
      r: r, cur: L.dash.agg(cur), prev: L.dash.agg(prev),
      byCh: groupBy(cur, function (e) { return L.chName[e.ch] || e.ch; }),
      byCamp: groupBy(cur, function (e) { return (L.chName[e.ch] || e.ch) + " · " + (e.camp || L.netName[e.net] || e.net); }),
      sample: !L.dash.hasData()
    };
  }
  function aggLine(a) {
    return "매출 " + won(a.rev) + ", 광고비 " + won(a.cost) + ", 순수익 " + won(a.profit) + ", 순수익률 " + (isFinite(a.margin) ? pct(a.margin) : "-") + ", DB " + fmt(a.leads) + "건, 승인 " + fmt(a.appr) + "건";
  }
  function dataContext() {
    var S = L.settings(), d = L.dash, t = d.today();
    var last30 = slice(d.addDays(t, -29), t);
    var lines = [
      "[목표] 매출 대비 순수익률 " + S.marginMin + "~" + S.marginMax + "%, 월 목표 순수익 " + won(S.goalProfit || 0) + ". 광고비 부가세 " + (S.vat ? "포함" : "제외") + ", 원천징수 " + (S.wht ? "차감" : "미반영") + ".",
      d.hasData() ? "[최근 30일 합계] " + aggLine(d.agg(last30)) : "[주의] 아직 실제 매출 기록이 없어 아래 수치는 예시 데이터입니다.",
      "[최근 30일 채널별] " + groupBy(last30, function (e) { return L.chName[e.ch] || e.ch; }).map(function (g) { return g.k + ": " + aggLine(g.a); }).join(" / "),
      "[최근 30일 네트워크별] " + groupBy(last30, function (e) { return L.netName[e.net] || e.net; }).map(function (g) { return g.k + ": 순수익 " + won(g.a.profit) + ", 순수익률 " + (isFinite(g.a.margin) ? pct(g.a.margin) : "-"); }).join(" / "),
      "[최근 30일 캠페인 상위·하위] " + (function () { var g = groupBy(last30, function (e) { return (L.chName[e.ch] || e.ch) + " · " + (e.camp || e.net); }); return g.slice(0, 3).concat(g.length > 3 ? g.slice(-2) : []).map(function (x) { return x.k + " 순수익 " + won(x.a.profit) + " (" + (isFinite(x.a.margin) ? pct(x.a.margin) : "-") + ")"; }).join(" / "); })(),
      "[최근 분석] " + (hAll().slice(0, 5).map(function (h) { return (KIND[h.kind] || h.kind) + ": " + h.title + (h.badge ? " (" + h.badge + ")" : ""); }).join(" / ") || "없음"),
      "[보드 상위 레퍼런스] " + (L.board().slice(0, 3).map(function (b) { return (L.chName[b.channel] || b.channel) + " " + (L.catName[b.cat] || "") + " " + (b.note || b.url); }).join(" / ") || "없음"),
      "[운영 중인 캠페인] " + ((L.ops ? L.ops.all() : []).slice(0, 5).map(function (o) { var n = L.ops.nextStep(o); return o.name + " (" + (L.chName[o.ch] || o.ch) + ", " + n.label + (o.stages && o.stages.s2 && o.stages.s2.verdict ? ", 1차 판정 " + o.stages.s2.verdict : "") + (o.stages && o.stages.s3 && o.stages.s3.verdict ? ", 재확인 판정 " + o.stages.s3.verdict : "") + ")"; }).join(" / ") || "없음"),
      "[오늘 날짜] " + d.ymd(t)
    ];
    return lines.join("\n");
  }
  var ROLE = "당신은 한국 CPA 제휴마케팅(디비디비딥·디비마켓·디비센스·텐핑·애드팟 등)과 퍼포먼스 광고(Meta, 인스타그램, 카카오, 유튜브, 틱톡, 네이버, 당근, 블로그·숏폼 등)를 운영하는 1인 사업자의 전담 AI 비서입니다. 사용자의 목표는 매출 대비 순수익 30~40%를 안정적으로 유지하며 사업화하는 것입니다. 아래 사용자 데이터를 근거로, 한국어로, 바로 실행할 수 있게 구체적으로 답하세요. 데이터에 없는 수치를 지어내지 말고, 예시 데이터라면 그렇다고 밝히세요. 핵심 문장은 **굵게** 표시하세요.";

  /* ───────── 보고서 ───────── */
  var repPeriod = "day";
  function localReport(p) {
    var d = reportData(p), c = d.cur, v = d.prev, S = L.settings();
    var st = L.marginStatus(c.margin);
    function delta(a, b) { if (!b) return ""; var x = a - b; return '<span class="' + (x >= 0 ? "pos" : "neg") + '">' + (x >= 0 ? "+" : "") + won(x) + "</span>"; }
    var acts = [];
    d.byCamp.forEach(function (g) {
      if (g.a.profit < 0) acts.push(["no", "<b>" + esc(g.k) + "</b> 손실 " + won(g.a.profit) + " → 소재 교체 또는 중단"]);
      else if (isFinite(g.a.margin) && g.a.margin * 100 < S.marginMin) acts.push(["no", "<b>" + esc(g.k) + "</b> 순수익률 " + pct(g.a.margin) + " → DB당 광고비·랜딩 신청률 점검"]);
      else if (isFinite(g.a.margin) && g.a.margin * 100 >= S.marginMin) acts.push(["ok", "<b>" + esc(g.k) + "</b> 목표 구간 " + pct(g.a.margin) + " → 유지 또는 20% 증액"]);
    });
    if (!c.n) acts.push(["tip2", d.r.label + " 기록이 없습니다. 매출 현황에 광고비·매출을 입력하세요."]);
    return (d.sample ? '<div class="notice"><b>예시 데이터 기준 보고서입니다.</b> 매출 현황에 실제 기록을 넣으면 내 데이터로 바뀝니다.</div>' : "") +
      '<div class="row between"><h3 class="sub">' + esc(d.r.label) + ' 보고서 <small class="muted">' + esc(L.dash.ymd(d.r.from)) + (p === "day" ? "" : " ~ " + esc(L.dash.ymd(d.r.to))) + '</small></h3><span class="pill ' + st[0] + '">' + st[1] + "</span></div>" +
      '<div class="rep-stats">' +
        '<div class="fact key"><small>순수익</small><b>' + won(c.profit) + "</b>" + delta(c.profit, v.n ? v.profit : 0) + "</div>" +
        '<div class="fact"><small>순수익률</small><b class="num">' + (isFinite(c.margin) ? pct(c.margin) : "—") + '</b><span class="note">목표 ' + S.marginMin + "~" + S.marginMax + "%</span></div>" +
        '<div class="fact"><small>매출</small><b class="num">' + won(c.rev) + "</b>" + delta(c.rev, v.n ? v.rev : 0) + "</div>" +
        '<div class="fact"><small>광고비</small><b class="num">' + won(c.cost) + "</b>" + delta(c.cost, v.n ? v.cost : 0) + "</div>" +
        '<div class="fact"><small>DB · 승인</small><b class="num">' + fmt(c.leads) + " · " + fmt(c.appr) + "</b></div>" +
      "</div>" +
      (d.byCh.length ? '<div class="tablewrap"><table class="data"><thead><tr><th>채널</th><th class="n">매출</th><th class="n">광고비</th><th class="n">순수익</th><th class="n">순수익률</th></tr></thead><tbody>' +
        d.byCh.map(function (g) { return "<tr><td><b>" + esc(g.k) + '</b></td><td class="n">' + won(g.a.rev) + '</td><td class="n">' + won(g.a.cost) + '</td><td class="n ' + (g.a.profit >= 0 ? "pos" : "neg") + '">' + won(g.a.profit) + '</td><td class="n">' + (isFinite(g.a.margin) ? pct(g.a.margin) : "—") + "</td></tr>"; }).join("") + "</tbody></table></div>" : "") +
      "<h4>바로 할 일</h4>" + '<ul class="checks">' + acts.slice(0, 8).map(function (a) { return '<li class="' + a[0] + '">' + a[1] + "</li>"; }).join("") + "</ul>";
  }
  function renderReport() {
    document.querySelectorAll("#repSeg button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.rp === repPeriod ? "true" : "false"); });
    var S = L.settings();
    $("reportBox").innerHTML = localReport(repPeriod) +
      '<div class="row"><button class="btn blue" type="button" id="repAi">' + (S.provider === "local" ? "AI를 켜면 보고서를 써 드립니다" : "AI 보고서 작성") + '</button>' +
      '<button class="btn ghost" type="button" id="repStop" hidden>중지</button><button class="btn ghost" type="button" id="repSave">이 보고서 저장</button></div>' +
      '<div id="repOut" class="stack"></div>';
  }
  function saveReport(ai) {
    var d = reportData(repPeriod);
    var id = L.hist.save({
      kind: "report", title: d.r.label + " 보고서 (" + L.dash.ymd(d.r.to) + ")", badge: "순수익 " + won(d.cur.profit),
      excerpt: aggLine(d.cur), localHtml: localReport(repPeriod), ai: ai || ""
    });
    var reps = L.store.get("reports", []).filter(function (r) { return !(r.date === L.dash.ymd(d.r.to) && r.period === repPeriod); });
    L.store.set("reports", [{ id: id, date: L.dash.ymd(d.r.to), period: repPeriod }].concat(reps).slice(0, 120));
    return id;
  }
  function runReport() {
    var S = L.settings();
    if (S.provider === "local") { L.show("settings"); return; }
    var d = reportData(repPeriod);
    var prompt = ROLE + "\n\n" + dataContext() + "\n\n[" + d.r.label + " 실적] " + aggLine(d.cur) + "\n[" + d.r.prev + " 실적] " + aggLine(d.prev) +
      "\n[" + d.r.label + " 채널별] " + d.byCh.map(function (g) { return g.k + ": " + aggLine(g.a); }).join(" / ") +
      "\n[" + d.r.label + " 캠페인별] " + d.byCamp.map(function (g) { return g.k + ": " + aggLine(g.a); }).join(" / ") +
      "\n\n" + d.r.label + " 보고서를 작성하세요. 순서:\n## 한 줄 결론\n## 핵심 수치와 " + d.r.prev + " 대비 변화\n## 잘된 것 / 안된 것 (원인 가설)\n## 끌 것 · 유지할 것 · 키울 것 (예산 숫자 포함)\n## 다음 " + ({ day: "하루", week: "한 주", month: "한 달" }[repPeriod]) + " 실행 계획\n## 새로 테스트할 소재·매체 제안\n" +
      "마지막 줄에 'KEYWORDS: …'로 레퍼런스 검색 키워드 5개.";
    var id = saveReport("");
    var out = $("repOut"); out.innerHTML = "";
    L.analyze.aiBlock(out, { prompt: prompt, images: [], urls: [], runBtn: $("repAi"), stopBtn: $("repStop"), histId: id });
  }

  /* ───────── AI 비서 대화 ───────── */
  var chat = [], chatCtl = null;
  function renderChat() {
    if (!chat.length) {
      $("chat").innerHTML = '<div class="msg ai"><p>안녕하세요. 매출 기록·분석 기록·보드를 보고 답하는 광고 비서입니다. 위의 빠른 질문을 누르거나 궁금한 것을 적어 주세요.</p></div>';
      return;
    }
    $("chat").innerHTML = chat.map(function (m) {
      return m.role === "user" ? '<div class="msg user">' + esc(m.content) + "</div>" : '<div class="msg ai' + (m.err ? " err" : "") + '">' + window.LabAI.md(plain(m.content)) + "</div>";
    }).join("");
    $("chat").scrollTop = $("chat").scrollHeight;
  }
  function sendChat(text) {
    text = String(text || "").trim();
    if (!text) return;
    var S = L.settings();
    if (S.provider === "local") { L.toast("설정에서 AI 엔진을 먼저 켜세요"); L.show("settings"); return; }
    if (chatCtl) return;
    chat.push({ role: "user", content: text, at: Date.now() });
    var turns = chat.filter(function (m) { return !m.err; }).slice(-12).map(function (m) { return { role: m.role, content: m.content }; });
    while (turns.length && turns[0].role !== "user") turns.shift();
    turns[0] = { role: "user", content: ROLE + "\n\n[내 데이터 요약]\n" + dataContext() + "\n\n[질문]\n" + turns[0].content };
    var bubble = { role: "assistant", content: "", at: Date.now() };
    chat.push(bubble);
    renderChat();
    var el = $("chat").lastElementChild;
    el.innerHTML = '<div class="thinking"><span class="spin"></span><span>생각 중…</span></div>';
    chatCtl = new AbortController();
    $("chatSend").textContent = "중지";
    $("chatText").value = "";
    var frame = 0;
    window.LabAI.run({
      provider: S.provider, settings: S, messages: turns, signal: chatCtl.signal,
      onText: function (t) {
        bubble.content = t;
        if (!frame) frame = requestAnimationFrame(function () { frame = 0; el.innerHTML = window.LabAI.md(plain(t)); $("chat").scrollTop = $("chat").scrollHeight; });
      }
    }).then(function (t) { bubble.content = t || bubble.content; })
      .catch(function (e) {
        if (e && e.code === "cancelled") { if (!bubble.content) bubble.content = "(중지했습니다)"; return; }
        bubble.content = "**응답 실패.** " + ((e && e.message) || "알 수 없는 오류"); bubble.err = true;
      })
      .then(function () {
        chatCtl = null; $("chatSend").textContent = "보내기";
        chat = chat.slice(-40);
        L.store.set("chat", chat);
        renderChat();
      });
  }

  /* ───────── 매체 추천 ───────── */
  function mediaScore(m, o) {
    if (o.kind !== "both" && m.kind !== o.kind) return null;
    if (o.budget === 0 && m.kind === "paid") return null;
    var cat = L.catById(o.cat), sc = 0, why = [];
    if (m.fit.indexOf(o.cat) >= 0) { sc += 40; why.push((cat ? cat.name : "업종") + "과 잘 맞음"); } else sc += 8;
    var ci = cat ? cat.channels.indexOf(m.id) : -1;
    if (ci >= 0) { sc += 12 - ci * 4; why.push("업종 추천 채널 " + (ci + 1) + "순위"); }
    if (o.age >= m.age[0] && o.age <= m.age[1]) { sc += 25; why.push("타깃 연령대 도달이 좋음"); } else sc += 4;
    if (m.kind === "organic") { sc += o.budget <= 1 ? 18 : 8; why.push("광고비 없이 시작 가능"); }
    else {
      var fitBudget = o.budget >= 3 ? 20 : o.budget === 2 ? (m.cost <= 2 ? 20 : 10) : (m.cost <= 1 ? 20 : m.cost === 2 ? 10 : 0);
      sc += fitBudget; if (fitBudget >= 20) why.push("예산 규모에 적합");
    }
    return { m: m, sc: sc, why: why };
  }
  function renderMedia() {
    var o = { cat: $("mCat").value, budget: +$("mBudget").value, kind: $("mKind").value, age: +$("mAge").value };
    L.store.set("media", o);
    var list = D.media.map(function (m) { return mediaScore(m, o); }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc; });
    $("mediaList").innerHTML = list.map(function (x, i) {
      var m = x.m;
      return '<article class="panel mcard' + (i < 3 ? " top" : "") + '"><header><div class="row"><span class="mrank">#' + (i + 1) + "</span><h4>" + esc(m.name) + "</h4></div>" +
        '<span class="pill ' + (i < 3 ? "good" : "none") + '">' + (i < 3 ? "추천 " + x.sc + "점" : x.sc + "점") + "</span></header>" +
        '<div class="row"><span class="tag ' + (m.kind === "paid" ? "blue" : "hi") + '">' + (m.kind === "paid" ? "유료 광고" : "무료 운영") + '</span><span class="tag">비용 ' + (m.cost ? "●●●".slice(0, m.cost) + "○○○".slice(0, 3 - m.cost) : "없음") + '</span><span class="tag">' + m.age[0] + "~" + m.age[1] + "세 강함</span></div>" +
        '<p class="note">' + esc(x.why.join(" · ")) + "</p>" +
        "<dl><dt>장점</dt><dd>" + esc(m.pro) + "</dd><dt>주의</dt><dd>" + esc(m.con) + "</dd><dt>시작</dt><dd>" + esc(m.start) + "</dd></dl></article>";
    }).join("") || '<p class="empty">조건에 맞는 매체가 없습니다. 예산이나 운영 방식을 바꿔 보세요.</p>';
    renderCaseLinks();
  }

  /* ───────── 최신 사례 ───────── */
  function caseQuery() {
    var cat = L.catById($("mCat").value);
    return (cat ? cat.keywords[0] + " " : "") + "제휴마케팅 수익 후기";
  }
  function renderCaseLinks() {
    var q = caseQuery(), k = encodeURIComponent(q), cat = L.catById($("mCat").value);
    var links = [
      { t: "구글 · 최근 1개월", d: q, u: "https://www.google.com/search?q=" + k + "&tbs=qdr:m" },
      { t: "네이버 블로그 · 최신순", d: q, u: "https://search.naver.com/search.naver?where=blog&query=" + k + "&nso=so%3Add%2Cp%3A1m" },
      { t: "유튜브 · 최신 업로드", d: q, u: "https://www.youtube.com/results?search_query=" + k + "&sp=CAI%253D" },
      { t: "Meta 광고 라이브러리", d: "경쟁 광고 실제 집행 사례", u: L.refLinks(cat ? cat.keywords[0] : "상담 신청")[0].u }
    ];
    $("caseLinks").innerHTML = L.linkCards(links);
    var c = L.store.get("cases", null);
    $("caseMeta").textContent = c ? "마지막 갱신 " + when(c.at) + " · " + (L.provLabel[c.provider] || "") + (c.catName ? " · " + c.catName : "") : "아직 갱신한 적이 없습니다. 아래 검색 링크로 직접 보거나 AI로 갱신하세요.";
    if (c && c.text && !$("caseOut").dataset.live) $("caseOut").innerHTML = '<div class="panel stack ai-box"><div class="ai-body">' + window.LabAI.md(plain(c.text)) + "</div></div>";
  }
  function runCases() {
    var S = L.settings();
    if (S.provider === "local") { L.toast("설정에서 AI 엔진을 켜면 최신 사례를 검색해 정리합니다"); L.show("settings"); return; }
    var cat = L.catById($("mCat").value);
    var web = S.provider !== "builtin" && S.web !== false;
    var prompt = ROLE + "\n\n" +
      (web
        ? "웹 검색으로 최근 3개월 안에 공개된 한국의 CPA 제휴마케팅·퍼포먼스 광고 사례(블로그, 유튜브, 기사, 커뮤니티)를 5~8개 찾아 정리하세요. 업종: " + (cat ? cat.name : "전체") + ". 가능하면 이 업종과 다음 매체 관련 사례를 우선: " + D.media.slice(0, 6).map(function (m) { return m.name; }).join(", ") + ".\n각 사례마다: ### 제목 / 출처 링크와 게시 날짜 / 업종·매체 / 핵심 전략(훅·타깃·예산) / 공개된 수치(없으면 '비공개') / 내가 적용할 점.\n출처 링크가 없는 사례는 쓰지 마세요. 마지막에 ## 공통 패턴 3가지 와 ## 이번 주 따라 해볼 것 을 쓰세요."
        : "지금 이 엔진은 웹 검색을 할 수 없습니다. 최신 사례를 지어내지 말고, 대신 " + (cat ? cat.name : "CPA 제휴") + " 업종에서 널리 알려진 성공 패턴 5가지를 '패턴'으로 정리하세요(구체적인 인물·수치를 만들지 말 것). 각 패턴: 매체, 소재 방식, 타깃, 예산 운용, 확인할 검색어. 마지막에 최신 사례를 직접 찾는 검색어 5개를 제시하세요.") +
      "\n마지막 줄에 'KEYWORDS: …'로 레퍼런스 검색 키워드 5개.";
    var id = L.hist.save({ kind: "cases", title: (cat ? cat.name : "전체") + " 최신 사례", badge: web ? "웹 검색" : "패턴 정리", excerpt: "다른 사람들의 사례 정리" });
    var out = $("caseOut"); out.innerHTML = ""; out.dataset.live = "1";
    var stop = document.createElement("button"); stop.className = "btn ghost sm"; stop.type = "button"; stop.textContent = "중지"; stop.hidden = true;
    $("caseRun").after(stop);
    var p = L.analyze.aiBlock(out, { prompt: prompt, images: [], urls: [], runBtn: $("caseRun"), stopBtn: stop, histId: id });
    if (p) p.then(function () {
      stop.remove(); delete out.dataset.live;
      var h = hAll().filter(function (x) { return x.id === id; })[0];
      if (h && h.ai) { L.store.set("cases", { at: Date.now(), provider: S.provider, text: h.ai, catName: cat ? cat.name : "" }); renderCaseLinks(); }
    });
  }

  /* ───────── 초기화 ───────── */
  function init() {
    renderCount();
    // 분석 기록
    $("histFilter").addEventListener("click", function (e) { var b = e.target.closest("[data-hf]"); if (b) { hFilter = b.dataset.hf; renderHist(); } });
    $("histSearch").addEventListener("input", renderHist);
    $("histCards").addEventListener("click", function (e) { var b = e.target.closest("[data-open]"); if (b) openPreview(b.dataset.open); });
    $("pvClose").addEventListener("click", closePreview);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("preview").hidden) closePreview(); });
    $("pvBody").addEventListener("click", function (e) {
      var pb = e.target.closest("[data-plancopy],[data-planlog],[data-planch],[data-planops]");
      if (pb) { if (pb.dataset.planch || pb.dataset.planops) closePreview(); L.analyze.planClick(pb); return; }
      var b = e.target.closest("[data-copy],[data-kw]"); if (!b) return;
      if (b.dataset.copy != null) L.copyText(b.dataset.copy, "문구를 복사했습니다");
      else { closePreview(); L.goExplore(b.dataset.kw); }
    });
    $("pvCopy").addEventListener("click", function () {
      var h = hAll().filter(function (x) { return x.id === openId; })[0]; if (!h) return;
      L.copyText(h.ai ? plain(h.ai) : $("pvBody").innerText, "내용을 복사했습니다");
    });
    $("pvAsk").addEventListener("click", function () {
      var h = hAll().filter(function (x) { return x.id === openId; })[0]; if (!h) return;
      closePreview(); L.show("assistant");
      $("chatText").value = "아래 " + (KIND[h.kind] || "분석") + " 결과를 바탕으로, 내가 지금 바로 실행할 다음 단계 3가지를 예산과 함께 알려줘.\n\n[" + h.title + "]\n" + (h.ai ? plain(h.ai).slice(0, 3000) : (h.excerpt || ""));
      $("chatText").focus();
    });
    var pendingDel = null;
    $("pvDel").addEventListener("click", function () {
      if (pendingDel !== openId) { pendingDel = openId; $("pvDel").textContent = "한 번 더 누르면 삭제"; return; }
      L.store.set("history", hAll().filter(function (x) { return x.id !== openId; }));
      pendingDel = null; $("pvDel").textContent = "삭제";
      closePreview(); renderHist(); renderCount(); L.toast("기록을 삭제했습니다");
    });
    L.onShow.history = renderHist;

    // AI 비서
    chat = L.store.get("chat", []);
    $("chatQuick").innerHTML = D.assistantPrompts.map(function (p, i) { return '<button class="chip" type="button" data-q="' + i + '">' + esc(p[0]) + "</button>"; }).join("");
    $("chatQuick").addEventListener("click", function (e) { var b = e.target.closest("[data-q]"); if (b) sendChat(D.assistantPrompts[+b.dataset.q][1]); });
    $("chatForm").addEventListener("submit", function (e) { e.preventDefault(); if (chatCtl) { chatCtl.abort(); return; } sendChat($("chatText").value); });
    $("chatText").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("chatForm").requestSubmit(); } });
    $("chatClear").addEventListener("click", function () { chat = []; L.store.set("chat", chat); renderChat(); });
    $("repSeg").addEventListener("click", function (e) { var b = e.target.closest("[data-rp]"); if (b) { repPeriod = b.dataset.rp; renderReport(); } });
    $("reportBox").addEventListener("click", function (e) {
      if (e.target.closest("#repAi")) runReport();
      else if (e.target.closest("#repSave")) { saveReport(""); L.toast("보고서를 분석 기록에 저장했습니다"); }
      else { var b = e.target.closest("[data-copy],[data-kw],[data-goto]"); if (!b) return;
        if (b.dataset.copy != null) L.copyText(b.dataset.copy, "복사했습니다"); else if (b.dataset.kw != null) L.goExplore(b.dataset.kw); else L.show(b.dataset.goto); }
    });
    L.onShow.assistant = function () {
      var S = L.settings();
      $("chatHint").textContent = S.provider === "local" ? "AI가 꺼져 있습니다. 설정에서 엔진을 켜면 대화와 AI 보고서를 쓸 수 있습니다." : "엔진: " + L.provLabel[S.provider] + " · Enter 보내기, Shift+Enter 줄바꿈";
      renderReport(); renderChat();
    };

    // 매체 추천 · 사례
    L.fillSelect($("mCat"), D.categories.map(function (c) { return [c.id, c.name]; }));
    var mo = L.store.get("media", { cat: "insurance", budget: 1, kind: "both", age: 40 });
    $("mCat").value = mo.cat; $("mBudget").value = String(mo.budget); $("mKind").value = mo.kind; $("mAge").value = String(mo.age);
    ["mCat", "mBudget", "mKind", "mAge"].forEach(function (id) { $(id).addEventListener("change", renderMedia); });
    $("caseRun").addEventListener("click", runCases);
    $("caseOut").addEventListener("click", function (e) { var b = e.target.closest("[data-kw],[data-copy],[data-goto]"); if (!b) return;
      if (b.dataset.kw != null) L.goExplore(b.dataset.kw); else if (b.dataset.copy != null) L.copyText(b.dataset.copy, "복사했습니다"); else L.show(b.dataset.goto); });
    L.onShow.media = renderMedia;
  }
  (L.extraInits = L.extraInits || []).push(init);
})();
