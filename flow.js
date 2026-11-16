/* 광고 만들기 6단계 흐름 — 지금 작업 중인 광고(work), 상단 작업 바, 레일 진행률, 떠 있는 '다음 단계' 버튼, 2단계 후보 선택 화면.
   work: { name, net, cat, payout, approve, media, page, url, pop, src, analyzed, platform, made, opsId } */
(function () {
  "use strict";
  var L = window.Lab, D = L.D, $ = L.$, esc = L.esc, won = L.won, fmt = L.fmt;
  var STEPS = ["merchant", "pick", "landing", "studio", "ops", "check"];

  function work() { return L.store.get("work", null); }
  function setWork(w) { L.store.set("work", w); L.emit("work"); }
  function patch(p) { var w = work(); if (!w) return null; w = Object.assign({}, w, p); setWork(w); return w; }
  function picks() { return L.merchant ? L.merchant.picks() : []; }
  function ageOf(text) { var m = String(text || "").match(/(\d{2})\s*(?:세)?\s*[~\-]\s*(\d{2})\s*세/); return m ? m[1] + "~" + m[2] : ""; }

  /* 3단계로: 조건 자동 기입 후 바로 분석 */
  function fillLanding(w) {
    if (!$("lpForm")) return;
    $("lpName").value = w.name || "";
    $("lpUrl").value = w.url || "";
    $("lpNet").value = w.net || "";
    $("lpCat").value = w.cat || "";
    $("lpPayout").value = w.payout || "";
    $("lpApprove").value = w.approve || 70;
    $("lpText").value = w.page || "";
    $("lpTerms").value = w.media || "";
  }
  function start(m) {
    var w = { name: m.name, net: m.net || "", cat: m.cat || L.analyze.detectCategory(m.name + " " + (m.media || "")) || "", payout: +m.payout || 0, approve: +m.approve || 70,
      media: m.media || "", page: m.page || "", url: m.url || "", pop: +m.pop || 0, src: m.src || "", analyzed: false, platform: "", made: false, opsId: "", at: Date.now() };
    setWork(w);
    L.show("landing");
    L.anaTab("lp");
    fillLanding(w);
    if ($("lpExWrap")) $("lpExWrap").open = false;
    var f = $("lpForm");
    if (f.requestSubmit) f.requestSubmit(); else $("lpRun").click();
    L.toast("'" + w.name + "' 조건을 채우고 분석을 시작했습니다");
  }

  /* ───────── 상단 작업 바 ───────── */
  function renderTop() {
    var w = work();
    if (!w) {
      $("workBar").innerHTML = '<span class="lab">작업 중인 광고 없음</span><span class="note">1단계에서 네트워크를 조회해 후보를 담고, 2단계에서 하나를 고르세요.</span>';
      $("workReset").hidden = true;
      return;
    }
    $("workReset").hidden = false;
    var cat = L.catById(w.cat);
    $("workBar").innerHTML = '<span class="lab">작업 중</span><b>' + esc(w.name) + '</b><span class="chipset">' +
      (w.net ? '<span class="tag">' + esc(L.netName[w.net] || w.net) + "</span>" : "") +
      (cat ? '<span class="tag">' + esc(cat.name) + "</span>" : "") +
      (w.payout ? '<span class="tag blue">' + won(w.payout) + " · " + fmt(w.approve || 70) + "%</span>" : "") +
      (w.platform ? '<span class="tag hi">' + esc(L.chName[w.platform] || w.platform) + "</span>" : "") + "</span>";
  }

  /* ───────── 레일 진행률 ───────── */
  function doneMap() {
    var w = work(), op = w && w.opsId && L.ops && L.ops.get ? L.ops.get(w.opsId) : null;
    return {
      merchant: picks().length > 0 || !!w, pick: !!w, landing: !!(w && w.analyzed), studio: !!(w && w.made),
      ops: !!(w && w.opsId && op), check: !!(op && op.launch)
    };
  }
  function renderRail() {
    var dm = doneMap(), n = STEPS.filter(function (k) { return dm[k]; }).length;
    STEPS.forEach(function (k, i) {
      var el = document.querySelector('.menu [data-view="' + k + '"] .n');
      if (!el) return;
      el.classList.toggle("done", !!dm[k]);
      el.textContent = dm[k] ? "✓" : String(i + 1);
    });
    $("progTxt").textContent = n + " / 6";
    $("progBar").style.width = Math.round(n / 6 * 100) + "%";
    var pc = picks().length, c = $("pickCount");
    c.textContent = pc ? String(pc) : ""; c.classList.toggle("on", pc > 0);
  }

  /* ───────── 다음 단계 버튼 ───────── */
  function cur() { var b = document.querySelector('.menu button[aria-current="page"]'); return b ? b.dataset.view : ""; }
  function renderNext() {
    var v = cur(), w = work(), bar = $("nextBar"), btn = $("nextBtn"), sub = $("nextSub");
    var cfg = null;
    if (v === "merchant") cfg = { sub: picks().length ? "후보 " + picks().length + "개 담김" : "TOP 10에서 체크하고 후보에 담으세요", label: "다음: 후보 선택 →", go: function () { L.show("pick"); } };
    else if (v === "pick") cfg = { sub: selected() ? "선택: " + selected().name : "후보를 하나 고르세요", label: "이 광고로 분석 시작 →", dis: !selected(), go: function () { var p = selected(); if (p) start(p); } };
    else if (v === "landing") cfg = { sub: w && w.analyzed ? "분석 완료 · 플랫폼을 골라 광고를 만드세요" : "분석을 실행하세요", label: "다음: 광고 제작 →", go: function () { L.studio.open(w && w.platform || null); } };
    else if (v === "studio") cfg = { sub: L.studio && L.studio.current() ? L.chName[L.studio.current()] + " 셋팅으로" : "플랫폼을 고르세요", label: "이 플랫폼으로 캠페인 운영 시작 →", go: function () { L.studio.startOps(); } };
    else if (v === "ops") cfg = { sub: w && w.opsId ? "등록한 캠페인을 점검하세요" : "캠페인을 등록하세요", label: "다음: 3단계 점검 →", go: function () { if (w && w.opsId && L.ops.get(w.opsId)) L.ops.open(w.opsId); else L.show("check"); } };
    if (!cfg) { bar.hidden = true; return; }
    bar.hidden = false; sub.textContent = cfg.sub; btn.textContent = cfg.label; btn.disabled = !!cfg.dis;
    btn.onclick = cfg.go;
  }
  function refresh() { renderTop(); renderRail(); renderNext(); }

  /* ───────── 2단계 후보 선택 ───────── */
  function selected() {
    var id = L.store.get("pickSel", ""), list = picks();
    return list.filter(function (p) { return p.id === id; })[0] || null;
  }
  function renderPick() {
    var list = picks(), st = L.merchant.myStats();
    var rows = list.map(function (p) { return { p: p, r: L.merchant.score(p, st) }; }).sort(function (a, b) { return b.r.sc - a.r.sc; });
    var sel = selected();
    if (!sel && rows.length) { L.store.set("pickSel", rows[0].p.id); sel = rows[0].p; }
    var nets = {}; list.forEach(function (p) { nets[p.net] = (nets[p.net] || 0) + 1; });
    $("pkMeta").textContent = list.length ? "· " + list.length + "개 (" + Object.keys(nets).map(function (k) { return (L.netName[k] || k) + " " + nets[k]; }).join(", ") + ")" : "";
    $("pkClear").hidden = !list.length; $("pkAi").disabled = list.length < 2;
    if (!rows.length) {
      $("pkList").innerHTML = '<div class="empty-state"><b>후보 리스트가 비어 있습니다.</b><p>1단계 머천트 조회에서 네트워크별 추천 TOP 10을 보고 체크한 뒤 <b>후보 리스트에 추가</b>를 누르세요. 여러 네트워크에서 담을 수 있습니다.</p><div class="row"><button class="btn blue sm" type="button" data-view="merchant">1단계 머천트 조회로</button></div></div>';
    } else {
      $("pkList").innerHTML = rows.map(function (x, i) {
        var p = x.p, r = x.r, on = sel && sel.id === p.id, cls = r.sc >= 70 ? "good" : r.sc >= 45 ? "warn" : "bad", a = (+p.approve || 70) / 100;
        return '<article class="pkcard' + (on ? " on" : "") + '" data-pk="' + esc(p.id) + '">' + (i === 0 && rows.length > 1 ? '<span class="best">추천 1위</span>' : "") +
          '<label class="pkhead"><input type="radio" name="pkSel" value="' + esc(p.id) + '"' + (on ? " checked" : "") + '><span><b>' + esc(p.name) + "</b><small>" + esc(L.netName[p.net] || p.net) + (r.cat ? " · " + esc(r.cat.name) + (r.cat.tier ? " · Tier " + r.cat.tier : "") : "") + (p.src === "sample" ? " · 예시" : "") + "</small></span></label>" +
          '<div class="pkfacts"><div><small>점수</small><b><span class="pill ' + cls + '">' + r.sc + "점</span></b></div><div><small>단가</small><b>" + won(+p.payout || 0) + "</b></div><div><small>승인율</small><b>" + (p.approve ? fmt(+p.approve) + "%" : "70%*") + "</b></div>" +
            "<div><small>DB당 한계</small><b>" + (r.hi > 0 ? won(r.hi) : '<span class="neg">불가</span>') + "</b></div><div><small>DB 1건 기대 매출</small><b>" + won((+p.payout || 0) * a) + "</b></div><div><small>인기</small><b>" + (p.pop ? fmt(p.pop) + "곳" : "—") + "</b></div></div>" +
          '<div class="chips">' + Object.keys(r.rules).map(function (k) { return '<span class="tag ' + (r.rules[k] === "yes" ? "hi" : "no") + '">' + (r.rules[k] === "no" ? "✕ " : "") + esc(L.chName[k]) + "</span>"; }).join(" ") + "</div>" +
          '<p class="note">' + esc(r.why.join(" · ")) + "</p>" +
          '<div class="row"><button class="btn ghost sm" type="button" data-pkgo="' + esc(p.id) + '">이 광고로 분석 →</button><button class="btn ghost sm danger" type="button" data-pkdel="' + esc(p.id) + '">빼기</button></div></article>';
      }).join("");
    }
    $("pkSel").textContent = sel ? sel.name + " · " + (L.netName[sel.net] || sel.net) + " · " + won(+sel.payout || 0) : "아직 고르지 않았습니다";
    $("pkGo").disabled = !sel;
    renderNext();
  }
  function aiPick() {
    var list = picks(); if (list.length < 2) return;
    var st = L.merchant.myStats(), S = L.settings();
    $("pkAiOut").innerHTML = "";
    var lines = list.map(function (p, i) {
      var r = L.merchant.score(p, st);
      return (i + 1) + ". " + p.name + " / " + (L.netName[p.net] || p.net) + " / 단가 " + won(+p.payout || 0) + " / 승인율 " + (p.approve || "미상") + "% / DB당 한계 " + won(r.hi) +
        " / 허용 매체: " + (p.media || "미상") + " / 인기 " + (p.pop || "미상") + " / 점수 " + r.sc + " (" + r.why.join(", ") + ")";
    });
    var prompt = [
      "당신은 한국 CPA 제휴마케팅 전문가입니다. 아래 후보 광고 중 지금 집행하면 매출 대비 순수익 " + S.marginMin + "~" + S.marginMax + "%를 가장 안정적으로 낼 광고 1개를 고르세요.",
      "내 기준 DB당 광고비: " + won(st.refCPL) + " · 내 주력 채널: " + (L.chName[st.best] || st.best),
      "", "[후보]"].concat(lines).concat(["",
      "다음 순서로 답하세요:",
      "## 최종 추천 (1개, 이유 3가지)",
      "## 후보별 한 줄 평가 (표: 후보, 장점, 위험, 추천 매체)",
      "## 추천 광고의 첫 주 집행 방향 (주 매체, 시작 일예산, 끄기 기준)",
      "규칙: 한국어, 주어진 숫자만 근거로, 확인 안 된 수치는 지어내지 말 것. 핵심 문장은 **굵게**."]).join("\n");
    L.analyze.aiBlock($("pkAiOut"), { prompt: prompt, runBtn: $("pkAi"), stopBtn: $("pkStop") });
  }

  function init() {
    $("pkList").addEventListener("change", function (e) { if (e.target.name === "pkSel") { L.store.set("pickSel", e.target.value); renderPick(); } });
    $("pkList").addEventListener("click", function (e) {
      var g = e.target.closest("[data-pkgo]"), d = e.target.closest("[data-pkdel]");
      if (g) { var p = picks().filter(function (x) { return x.id === g.dataset.pkgo; })[0]; if (p) { L.store.set("pickSel", p.id); start(p); } }
      if (d) { L.merchant.savePicks(picks().filter(function (x) { return x.id !== d.dataset.pkdel; })); renderPick(); }
    });
    $("pkGo").addEventListener("click", function () { var p = selected(); if (p) start(p); });
    $("pkAi").addEventListener("click", aiPick);
    $("pkClear").addEventListener("click", function () {
      var b = $("pkClear");
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "한 번 더 누르면 비웁니다"; return; }
      b.dataset.sure = ""; b.textContent = "비우기"; L.merchant.savePicks([]); L.store.set("pickSel", ""); renderPick();
    });
    $("pkAiOut").addEventListener("click", function (e) { var b = e.target.closest("[data-kw]"); if (b) L.goExplore(b.dataset.kw); });
    $("workReset").addEventListener("click", function () {
      var b = $("workReset");
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "한 번 더 누르면 새로 시작"; setTimeout(function () { b.dataset.sure = ""; b.textContent = "↺ 새 작업"; }, 3000); return; }
      b.dataset.sure = ""; b.textContent = "↺ 새 작업";
      setWork(null); L.show("merchant"); L.toast("작업을 비웠습니다. 담아 둔 후보 리스트는 그대로 있습니다");
    });
    L.onShow.pick = renderPick;
    ["work", "picks", "ops", "view"].forEach(function (ev) { L.on(ev, refresh); });
    refresh();
  }
  L.flow = { work: work, patch: patch, start: start, refresh: refresh, ageOf: ageOf, fillLanding: fillLanding };
  (L.extraInits = L.extraInits || []).push(init);
})();
