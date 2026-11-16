/* 사업화 도구
   1) 월 목표 역산(수익 계산 화면): 월 순수익 목표 → 필요한 승인 DB·광고비·동시 캠페인 수·운전자금
   2) 이긴 소재 기록장: 3단계 점검에서 목표 이하로 DB를 만든 소재를 자동 저장 → 4단계 제목 후보 맨 앞에 */
(function () {
  "use strict";
  var L = window.Lab, D = L.D, $ = L.$, esc = L.esc, won = L.won, fmt = L.fmt;

  /* ───────── 1) 월 목표 역산 ───────── */
  var PF = ["pgGoal", "pgPayout", "pgApprove", "pgCpl", "pgCap", "pgFixed", "pgSettle", "pgWin"];
  function val(id) { return Math.max(0, parseFloat($(id).value) || 0); }
  function plan() {
    var S = L.settings(), goal = val("pgGoal"), P = val("pgPayout"), a = val("pgApprove") / 100;
    var cpl = val("pgCpl"), cap = val("pgCap"), fixed = val("pgFixed"), settle = val("pgSettle"), win = val("pgWin") / 100;
    var wht = S.wht ? 0.033 : 0;
    var perLeadRev = P * a * (1 - wht);                 // DB 1건당 실제 들어오는 돈(원천징수 후)
    var perLead = perLeadRev - cpl;                      // DB 1건당 순이익 (cpl은 부가세 포함 실제 지출)
    var out = $("pgOut");
    if (!P || !a || !cpl) { out.innerHTML = '<p class="note">단가 · 승인율 · 목표 DB당 광고비를 넣으세요.</p>'; return; }
    if (perLead <= 0) {
      out.innerHTML = '<div class="notice bad"><b>이 조건으로는 목표를 만들 수 없습니다.</b> DB 1건당 들어오는 돈 ' + won(perLeadRev) + "보다 DB당 광고비 " + won(cpl) + "가 큽니다. 단가가 더 높거나 승인율이 높은 머천트를 고르거나, DB당 광고비를 낮춰야 합니다.</div>";
      return;
    }
    var leads = Math.ceil((goal + fixed) / perLead), spend = leads * cpl, rev = leads * P * a;
    var dLeads = leads / 30, dSpend = spend / 30, camps = cap ? Math.max(1, Math.ceil(dSpend / cap)) : 1;
    var margin = rev ? (rev * (1 - wht) - spend - fixed) / rev : 0;
    // 테스트 비용: 이기는 캠페인 1개를 찾는 동안 지는 캠페인들의 손실(끄기 기준 × 소재 3개)
    var hi = L.maxCPL(P, a, S.marginMin / 100, S.wht), loseCost = hi > 0 ? hi * 2 * 3 : cpl * 6;
    var tries = win > 0 ? Math.ceil(camps / win) : camps, testBudget = Math.max(0, tries - camps) * loseCost;
    var capital = dSpend * (settle + 15) + testBudget;
    var row = function (k, v, note) { return "<tr><th>" + k + '</th><td class="num"><b>' + v + "</b></td><td>" + (note || "") + "</td></tr>"; };
    var cls = margin >= S.marginMin / 100 ? "good" : margin > 0 ? "warn" : "bad";
    out.innerHTML =
      '<div class="tablewrap"><table class="data pgtbl"><tbody>' +
      row("DB 1건당 순이익", won(perLead), "들어오는 돈 " + won(perLeadRev) + " − DB당 광고비 " + won(cpl)) +
      row("한 달 필요한 DB", fmt(leads) + "건", "하루 " + (Math.round(dLeads * 10) / 10) + "건 · 그중 승인 약 " + fmt(Math.round(leads * a)) + "건") +
      row("한 달 광고비", won(spend), "하루 " + won(Math.round(dSpend)) + " (부가세 포함 실제 지출)") +
      row("한 달 정산 매출", won(Math.round(rev)), "원천징수 전 금액") +
      row("예상 순수익률", '<span class="pill ' + cls + '">' + Math.round(margin * 100) + "%</span>", "목표 " + S.marginMin + "~" + S.marginMax + "%") +
      row("동시에 돌릴 캠페인", camps + "개", "캠페인당 하루 " + won(cap) + " 상한 기준. 한 캠페인에 몰면 학습이 깨지고 위험이 커집니다") +
      row("이기는 캠페인 " + camps + "개 찾기", "약 " + tries + "개 테스트", "성공률 " + Math.round(win * 100) + "% 가정 · 실패분 손실 약 " + won(Math.round(testBudget / 1000) * 1000)) +
      row("필요 운전자금", won(Math.round(capital / 10000) * 10000), "광고비는 바로 나가고 정산은 " + settle + "일 뒤 → (정산 주기 + 15일) × 하루 광고비 + 테스트 손실") +
      "</tbody></table></div>" +
      '<ul class="checks">' +
      (capital > goal * 1.5 ? '<li class="no">운전자금이 월 목표의 ' + (Math.round(capital / Math.max(goal, 1) * 10) / 10) + "배입니다. 정산 주기가 짧은 네트워크(주 정산)를 우선하거나 목표를 단계적으로 올리세요.</li>" : "") +
      (camps >= 4 ? '<li class="tip2">캠페인 ' + camps + "개를 혼자 관리하려면 하루 점검 시간이 1시간 이상 필요합니다. 처음 2개월은 1~2개로 시작해 이 표의 1/3 목표부터 맞추세요.</li>" : "") +
      '<li class="tip2">이 표는 "목표 DB당 광고비를 지킬 때"의 계획입니다. 실제 DB당 광고비는 3단계 점검에서 확인해 여기 값을 바꿔 보세요.</li></ul>';
    L.store.set("plan", PF.reduce(function (o, id) { o[id] = $(id).value; return o; }, {}));
  }
  function initPlan() {
    if (!$("pgOut")) return;
    var S = L.settings(), saved = L.store.get("plan", {}) || {};
    var P = 30000, a = 0.7, mid = Math.round(L.maxCPL(P, a, (S.marginMin + S.marginMax) / 200, S.wht) / 100) * 100;
    var dflt = { pgGoal: S.goalProfit || 3000000, pgPayout: P, pgApprove: 70, pgCpl: mid, pgCap: 50000, pgFixed: 50000, pgSettle: 30, pgWin: 33 };
    PF.forEach(function (id) { $(id).value = saved[id] != null && saved[id] !== "" ? saved[id] : dflt[id]; $(id).addEventListener("input", plan); });
    $("pgFromCalc").addEventListener("click", function () {
      if ($("cPayout") && +$("cPayout").value) $("pgPayout").value = $("cPayout").value;
      if ($("cApprove") && +$("cApprove").value) $("pgApprove").value = $("cApprove").value;
      var s = L.settings(), p = +$("pgPayout").value, ap = +$("pgApprove").value / 100;
      $("pgCpl").value = Math.round(L.maxCPL(p, ap, (s.marginMin + s.marginMax) / 200, s.wht) / 100) * 100;
      plan(); L.toast("위 계산기의 단가·승인율과 목표 순수익률 기준 DB당 광고비를 넣었습니다");
    });
    plan();
  }

  /* ───────── 2) 이긴 소재 기록장 ───────── */
  function wins() { return L.store.get("wins", []) || []; }
  function isTitle(s) { s = String(s || "").trim(); return s.length >= 8 && !/^[A-Za-z가-힣]?\s*\d*\s*$/.test(s) && !/^[A-Z]\s/.test(s); }
  /* 점검 저장 시 호출: 목표선(한계) 이하로 DB를 만든 소재를 기록 */
  function record(o, rows, stage) {
    var S = L.settings(), vat = S.vat ? 1.1 : 1, hi = L.maxCPL(+o.payout || 0, (+o.approve || 70) / 100, S.marginMin / 100, S.wht);
    var head = o.stages && o.stages.s1 && o.stages.s1.inputs && o.stages.s1.inputs.head || "";
    var list = wins(), added = 0;
    (rows || []).forEach(function (r) {
      if (!r || !+r.leads || !+r.spend) return;
      var cpl = r.spend * vat / r.leads;
      if (hi > 0 && cpl > hi) return;
      var name = String(r.name || "").trim(), title = isTitle(name) ? name : (head || name);
      if (!title) return;
      var k = o.id + "|" + name;
      list = list.filter(function (w) { return w.k !== k; });
      list.unshift({ k: k, title: title, label: name, cat: o.cat || "", ch: o.ch || "", camp: o.name || "", cpl: Math.round(cpl), leads: +r.leads, hi: Math.round(hi), stage: stage, at: Date.now() });
      added++;
    });
    if (added) { L.store.set("wins", list.slice(0, 200)); L.toast("이긴 소재 " + added + "개를 기록장에 저장했습니다 · 4단계 제목 후보 맨 앞에 나옵니다"); L.emit("wins"); }
    return added;
  }
  function titles(cat) {
    var seen = {};
    return wins().filter(function (w) { return (!cat || w.cat === cat) && isTitle(w.title); })
      .sort(function (a, b) { return a.cpl / (a.hi || 1) - b.cpl / (b.hi || 1); })
      .map(function (w) { return w.title; }).filter(function (t) { if (seen[t]) return false; seen[t] = 1; return true; }).slice(0, 3);
  }
  function renderWins() {
    var box = $("stWins"); if (!box) return;
    var w = L.flow && L.flow.work ? L.flow.work() : null, cat = w && w.cat || "";
    var list = wins().filter(function (x) { return !cat || x.cat === cat; }).slice(0, 8);
    var all = wins().length;
    box.hidden = !all;
    if (!all) return;
    box.innerHTML = '<div class="row between"><h3 class="sub">이긴 소재 기록장 <small class="muted">' + (cat ? esc(L.catName[cat] || cat) + " · " : "") + "3단계 점검에서 목표 이하로 DB를 만든 소재</small></h3></div>" +
      (list.length ? '<div class="tablewrap"><table class="data"><thead><tr><th>제목 · 소재</th><th>매체</th><th>캠페인</th><th class="n">DB당 광고비</th><th class="n">한계 대비</th><th class="n">DB</th></tr></thead><tbody>' +
        list.map(function (x) {
          var r = x.hi ? Math.round(x.cpl / x.hi * 100) : 0;
          return "<tr><td>" + esc(x.title) + (x.label && x.label !== x.title ? ' <span class="muted">(' + esc(x.label) + ")</span>" : "") + "</td><td>" + esc(L.chName[x.ch] || x.ch) + "</td><td>" + esc(x.camp) +
            '</td><td class="n">' + won(x.cpl) + '</td><td class="n"><span class="pill ' + (r <= 80 ? "good" : "warn") + '">' + r + '%</span></td><td class="n">' + fmt(x.leads) + "</td></tr>";
        }).join("") + "</tbody></table></div><p class=\"note\">같은 업종의 새 캠페인은 이 제목의 <b>구조(대상 호출·숫자·혜택)</b>를 그대로 두고 단어만 바꿔 시작하면 첫 테스트 적중률이 올라갑니다.</p>"
        : '<p class="note">이 업종에서 이긴 소재가 아직 없습니다. 다른 업종 기록 ' + all + "개가 있습니다.</p>");
  }

  function init() {
    initPlan();
    renderWins();
    L.on("work", renderWins); L.on("wins", renderWins);
    if (L.onShow) { var prev = L.onShow.studio; L.onShow.studio = function () { if (prev) prev(); renderWins(); }; }
  }
  L.wins = { record: record, titles: titles, list: wins, render: renderWins };
  L.plan = { run: plan };
  (L.extraInits = L.extraInits || []).push(init);
})();
