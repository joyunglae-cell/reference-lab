/* 매출 현황: 일간·주간·월간 매출, 광고비, 순수익, 순수익률 */
(function () {
  "use strict";
  var L = window.Lab, $ = L.$, esc = L.esc, won = L.won, fmt = L.fmt, pct = L.pct;

  var entries = [];
  var period = "day";

  /* 날짜 유틸 (현지 시간 기준) */
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(s) { var p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function monday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

  /* 예시 데이터: 기록이 하나도 없을 때만 화면에 보여 주고 저장하지 않습니다 */
  function sampleEntries() {
    var seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    var out = [], t = today();
    var plan = [
      { ch: "meta", net: "dbdbdeep", camp: "실비보험 리모델링 · 릴스", payout: 35000, base: 120000, roi: [1.25, 1.95] },
      { ch: "kakao", net: "tenping", camp: "정수기 렌탈 · 비즈보드", payout: 20000, base: 90000, roi: [1.15, 1.7] },
      { ch: "tiktok", net: "dbsense", camp: "국비 자격증 · UGC", payout: 9000, base: 50000, roi: [0.9, 1.6] }
    ];
    for (var i = 59; i >= 0; i--) {
      var d = ymd(addDays(t, -i));
      plan.forEach(function (p, j) {
        if (j === 2 && i > 40) return; // 틱톡은 최근에 시작한 것으로
        var spend = Math.round(p.base * (0.75 + rnd() * 0.6) / 1000) * 1000;
        var r = p.roi[0] + rnd() * (p.roi[1] - p.roi[0]);
        var appr = Math.max(0, Math.round(spend * 1.1 * r / p.payout));
        var leads = Math.round(appr / (0.62 + rnd() * 0.2));
        out.push({ id: "s" + i + j, date: d, net: p.net, camp: p.camp, ch: p.ch, spend: spend, rev: appr * p.payout, leads: leads, appr: appr });
      });
    }
    return out;
  }
  var SAMPLE = null, lastActs = [];
  function rows() { if (entries.length) return entries; return SAMPLE || (SAMPLE = sampleEntries()); }

  function agg(list) {
    var S = L.settings(), vat = S.vat ? 1.1 : 1, w = S.wht ? 0.033 : 0;
    var a = { rev: 0, spend: 0, cost: 0, profit: 0, leads: 0, appr: 0, pend: 0, pendRev: 0, n: list.length };
    list.forEach(function (e) {
      a.rev += +e.rev || 0; a.spend += +e.spend || 0; a.leads += +e.leads || 0; a.appr += +e.appr || 0;
      var p = +e.pend || 0;
      if (p) { a.pend += p; a.pendRev += p * (+e.payout || (+e.appr ? (+e.rev || 0) / +e.appr : 0)); }
    });
    a.cost = a.spend * vat;
    a.profit = a.rev * (1 - w) - a.cost;
    a.margin = a.rev > 0 ? a.profit / a.rev : (a.cost > 0 ? -Infinity : NaN);
    return a;
  }

  /* 기간 버킷 */
  function buckets(p) {
    var t = today(), out = [];
    if (p === "day") {
      for (var i = 13; i >= 0; i--) { var d = addDays(t, -i); out.push({ key: ymd(d), label: (d.getMonth() + 1) + "/" + d.getDate(), from: d, to: d }); }
    } else if (p === "week") {
      var m0 = monday(t);
      for (var j = 7; j >= 0; j--) { var s = addDays(m0, -7 * j); out.push({ key: ymd(s), label: (s.getMonth() + 1) + "/" + s.getDate() + "주", from: s, to: addDays(s, 6) }); }
    } else {
      for (var k = 5; k >= 0; k--) {
        var f = new Date(t.getFullYear(), t.getMonth() - k, 1);
        out.push({ key: f.getFullYear() + "-" + pad(f.getMonth() + 1), label: (f.getMonth() + 1) + "월", from: f, to: new Date(f.getFullYear(), f.getMonth() + 1, 0) });
      }
    }
    return out;
  }
  function within(e, b) { var d = parse(e.date); return d >= b.from && d <= b.to; }

  function statusPill(m) { var s = L.marginStatus(m); return '<span class="pill ' + s[0] + '">' + s[1] + "</span>"; }

  /* KPI 타일 */
  function renderKpis() {
    var t = today(), all = rows();
    var mFrom = new Date(t.getFullYear(), t.getMonth(), 1);
    var pmFrom = new Date(t.getFullYear(), t.getMonth() - 1, 1), pmTo = new Date(t.getFullYear(), t.getMonth(), 0);
    var cur = agg(all.filter(function (e) { var d = parse(e.date); return d >= mFrom && d <= t; }));
    var prev = agg(all.filter(function (e) { var d = parse(e.date); return d >= pmFrom && d <= pmTo; }));
    var wk = agg(all.filter(function (e) { var d = parse(e.date); return d >= monday(t) && d <= t; }));
    var td = agg(all.filter(function (e) { return e.date === ymd(t); }));
    var st = L.marginStatus(cur.margin);
    var delta = prev.n ? cur.profit - prev.profit : NaN;
    var S = L.settings();
    $("kpis").innerHTML =
      '<div class="kpi hero"><small>이번 달 순수익</small><b>' + won(cur.profit) + "</b><span>" +
        (isFinite(delta) ? "지난달 전체 " + won(prev.profit) : "지난달 기록 없음") + "</span></div>" +
      '<div class="kpi ' + st[0] + '"><small>이번 달 순수익률</small><b>' + (isFinite(cur.margin) ? pct(cur.margin) : "—") + "</b>" +
        statusPill(cur.margin) + '<span>목표 ' + S.marginMin + "~" + S.marginMax + "%</span></div>" +
      '<div class="kpi"><small>이번 달 확정 매출</small><b>' + won(cur.rev) + "</b><span>승인 " + fmt(cur.appr) + "건 · DB " + fmt(cur.leads) + "건" + (cur.pend ? " · <b class=\"warnc\">대기 " + fmt(cur.pend) + "건" + (cur.pendRev ? " (예상 " + won(cur.pendRev) + ")" : "") + "</b>" : "") + "</span></div>" +
      '<div class="kpi"><small>이번 달 광고비' + (S.vat ? " (VAT 포함)" : "") + "</small><b>" + won(cur.cost) + "</b><span>ROAS " + (cur.cost > 0 ? fmt(cur.rev / cur.cost * 100) + "%" : "—") + "</span></div>" +
      '<div class="kpi"><small>이번 주 순수익</small><b class="' + (wk.profit >= 0 ? "pos" : "neg") + '">' + won(wk.profit) + "</b><span>" + (isFinite(wk.margin) ? "순수익률 " + pct(wk.margin) : "기록 없음") + "</span></div>" +
      '<div class="kpi"><small>오늘 순수익</small><b class="' + (td.profit >= 0 ? "pos" : "neg") + '">' + won(td.profit) + "</b><span>" + (td.n ? "기록 " + td.n + "건" : "오늘 기록 없음") + "</span></div>";
  }

  /* 광고비 누락 점검: 매출은 있는데 그날 광고비가 하나도 없는 날 (무료 채널 기록은 제외) */
  function missingSpendDays(list) {
    var byDay = {};
    list.forEach(function (e) {
      var d = byDay[e.date] = byDay[e.date] || { rev: 0, spend: 0, paid: false };
      d.rev += +e.rev || 0; d.spend += +e.spend || 0;
      if (e.ch !== "blog" && e.ch !== "shorts") d.paid = true;
    });
    return Object.keys(byDay).filter(function (k) { var d = byDay[k]; return d.paid && d.rev > 0 && !d.spend; }).sort();
  }
  function renderSpendWarn() {
    var t = today(), from = new Date(t.getFullYear(), t.getMonth(), 1);
    var days = entries.length ? missingSpendDays(entries.filter(function (e) { var d = parse(e.date); return d >= from && d <= t; })) : [];
    $("spendWarn").hidden = !days.length;
    if (days.length) $("spendWarn").innerHTML = "<b>광고비가 빠진 날이 " + days.length + "일 있습니다</b> (" + days.slice(-4).map(function (x) { return x.slice(5); }).join(", ") + (days.length > 4 ? " 외" : "") +
      "). 이 날들은 매출만 잡혀 <b>순수익률이 실제보다 높게</b> 보입니다. 아래 '기록 가져오기'에서 종류를 <b>광고비</b>로 두고 광고 관리자 보고서를 넣으세요.";
    return days;
  }

  /* 월 목표 진행률 */
  function renderGoal() {
    var S = L.settings(), t = today(), all = rows();
    var mFrom = new Date(t.getFullYear(), t.getMonth(), 1);
    var days = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(), passed = t.getDate(), left = days - passed;
    var cur = agg(all.filter(function (e) { var d = parse(e.date); return d >= mFrom && d <= t; }));
    var goal = +S.goalProfit || 0;
    if (!goal) {
      $("goalCard").innerHTML = '<h3 class="sub">이번 달 목표</h3><p class="note">설정에서 월 목표 순수익을 넣으면 진행률과 남은 기간의 하루 필요 순수익을 계산합니다.</p><div class="row"><button class="btn ghost sm" type="button" data-goto="settings">목표 설정</button></div>';
      return;
    }
    var ratio = Math.max(0, cur.profit) / goal, pace = cur.profit / Math.max(1, passed) * days;
    var need = left > 0 ? (goal - cur.profit) / left : 0;
    var mid = (S.marginMin + S.marginMax) / 200;
    var needSpend = need > 0 && mid > 0 ? need / mid : 0; // 목표 순수익률로 벌 때 필요한 하루 매출
    $("goalCard").innerHTML =
      '<div class="row between"><h3 class="sub">이번 달 목표 순수익</h3><span class="pill ' + (pace >= goal ? "good" : "warn") + '">' + (pace >= goal ? "달성 페이스" : "페이스 부족") + "</span></div>" +
      '<div class="goalnum"><b>' + won(cur.profit) + '</b><span class="note">목표 ' + won(goal) + " · " + pct(ratio, 0) + "</span></div>" +
      '<div class="track"><i style="width:' + Math.min(100, ratio * 100).toFixed(1) + '%"></i></div>' +
      '<div class="facts">' +
        '<div class="fact"><small>이 페이스면 월말</small><b class="num">' + won(pace) + "</b></div>" +
        '<div class="fact"><small>남은 ' + left + "일 하루 필요 순수익</small><b class=\"num\">" + (need > 0 ? won(need) : "달성") + "</b></div>" +
        '<div class="fact"><small>필요 하루 매출 (목표율 기준)</small><b class="num">' + (needSpend > 0 ? won(needSpend) : "—") + "</b></div>" +
      "</div>";
  }

  /* 오늘 할 일: 기록을 보고 규칙으로 뽑는 액션 */
  function renderActions() {
    var S = L.settings(), t = today(), acts = [];
    if (!entries.length) acts.push(["tip2", "첫 매출 기록을 입력하세요. 기록이 쌓여야 판단이 정확해집니다."]);
    else if (!entries.some(function (e) { return e.date === ymd(t); })) acts.push(["tip2", "오늘(" + (t.getMonth() + 1) + "/" + t.getDate() + ") 광고비·매출 기록이 아직 없습니다."]);
    var from = addDays(t, -2), recent = rows().filter(function (e) { return parse(e.date) >= from; });
    var groups = {};
    recent.forEach(function (e) { var k = e.ch + "|" + (e.camp || e.net); (groups[k] = groups[k] || []).push(e); });
    Object.keys(groups).forEach(function (k) {
      var a = agg(groups[k]), p = k.split("|"), name = (L.chName[p[0]] || p[0]) + " · " + p[1];
      if (a.profit < 0 && a.n >= 2) acts.push(["no", "<b>" + esc(name) + "</b>: 최근 3일 손실 " + won(a.profit) + ". 소재 교체 또는 중단을 검토하세요."]);
      else if (isFinite(a.margin) && a.margin * 100 < S.marginMin && a.n >= 2) acts.push(["no", "<b>" + esc(name) + "</b>: 최근 3일 순수익률 " + pct(a.margin) + " (목표 " + S.marginMin + "% 미만). DB당 광고비를 점검하세요."]);
      else if (isFinite(a.margin) && a.margin * 100 >= S.marginMin && a.n >= 3) acts.push(["ok", "<b>" + esc(name) + "</b>: 3일 연속 목표 구간(" + pct(a.margin) + "). 예산 20% 증액 후보입니다."]);
    });
    var log = L.store.get("log", []);
    log.forEach(function (r) {
      var cost = r.spend * (S.vat ? 1.1 : 1), gross = r.appr * r.payout, profit = gross * (1 - (S.wht ? .033 : 0)) - cost;
      if (r.spend > 0 && profit < 0) acts.push(["no", "소재 테스트 <b>" + esc(r.name) + "</b>이 손실입니다. 끄기 기준(목표 CPA 2배 지출)을 넘었는지 확인하세요."]);
    });
    var hist = L.store.get("history", []);
    var lastAd = hist.filter(function (h) { return h.kind === "ad"; })[0];
    if (!lastAd || Date.now() - lastAd.at > 7 * 864e5) acts.push(["tip2", "이번 주 새 레퍼런스를 분석하세요. 광고 분석에 30일 이상 게재된 광고를 넣어 보세요."]);
    if (L.ops) L.ops.dueList().forEach(function (x) {
      acts.unshift(["no", '<b>' + esc(x.o.name) + "</b>: " + esc(x.n.label) + ' → <button class="linkbtn" type="button" data-ckgo="' + esc(x.o.id) + '">3단계 점검하기</button>']);
    });
    var miss = renderSpendWarn();
    if (miss.length) acts.unshift(["no", "광고비가 빠진 날 <b>" + miss.length + "일</b> — 순수익률이 부풀려 보입니다. 광고 관리자 보고서를 '광고비'로 가져오세요."]);
    L.store.get("priceAlerts", []).filter(function (a) { return Date.now() - (a.at || 0) < 7 * 864e5; }).slice(0, 3).forEach(function (a) {
      acts.unshift(["no", "<b>" + esc(a.camp) + "</b> 단가 하락 " + won(a.from) + " → " + won(a.to) + ". 한계 DB당 광고비가 낮아졌으니 예산·입찰을 다시 맞추세요."]);
    });
    var lastBk = L.store.get("lastBackup", 0);
    if (entries.length && L.store.backend() !== "claude" && L.store.backend() !== "gist" && Date.now() - lastBk > 30 * 864e5)
      acts.push(["tip2", "기록이 이 브라우저에만 있습니다. 설정에서 <b>GitHub 연결</b>이나 <b>전체 백업 복사</b>를 해 두세요."]);
    var reps = L.store.get("reports", []);
    if (!reps.some(function (r) { return r.date === ymd(t) && r.period === "day"; })) acts.push(["tip2", "AI 비서에서 오늘의 일간 보고서를 받아 보세요."]);
    lastActs = acts;
    $("actions").innerHTML = acts.slice(0, 7).map(function (a) { return '<li class="' + a[0] + '">' + a[1] + "</li>"; }).join("") || '<li class="ok">지금 처리할 항목이 없습니다.</li>';
  }

  function renderBizCheck() {
    var st = L.store.get("bizchecks", {}), n = 0;
    $("bizCheck").innerHTML = L.D.bizChecklist.map(function (c, i) {
      if (st[i]) n++;
      return '<li><label><input type="checkbox" id="bc' + i + '" data-bc="' + i + '"' + (st[i] ? " checked" : "") + "><span><b>" + esc(c.k) + "</b><small>" + esc(c.v) + "</small></span></label></li>";
    }).join("");
    $("bizProg").textContent = n + " / " + L.D.bizChecklist.length + " 완료";
  }

  /* 막대 차트: 매출 vs 광고비 */
  function niceMax(v) {
    if (v <= 0) return 100000;
    var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function manwon(v) { return v === 0 ? "0" : fmt(v / 10000) + "만"; }
  function barPath(x, y, w, h, r) {
    if (h <= 0.5) return "";
    r = Math.min(r, h, w / 2);
    return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y + "H" + (x + w - r) + "Q" + (x + w) + "," + y + " " + (x + w) + "," + (y + r) + "V" + (y + h) + "Z";
  }
  var chartData = [];
  function renderChart(bs) {
    var W = Math.max(300, Math.round($("chart").clientWidth) || 760), H = W < 560 ? 220 : 250, pl = 54, pr = 8, pt = 10, pb = 28, iw = W - pl - pr, ih = H - pt - pb;
    var max = niceMax(Math.max.apply(null, bs.map(function (b) { return Math.max(b.a.rev, b.a.cost); }).concat([0])));
    var y = function (v) { return pt + ih - v / max * ih; };
    var gw = iw / bs.length, bw = Math.min(24, (gw * 0.72 - 2) / 2);
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="기간별 매출과 광고비 막대 차트"><g class="grid axis">';
    for (var i = 0; i <= 4; i++) {
      var v = max / 4 * i, yy = y(v);
      svg += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '"></line><text x="' + (pl - 8) + '" y="' + (yy + 4) + '" text-anchor="end">' + manwon(v) + "</text>";
    }
    svg += "</g><g>";
    bs.forEach(function (b, k) {
      var cx = pl + gw * k + gw / 2;
      svg += '<path class="b1" d="' + barPath(cx - bw - 1, y(b.a.rev), bw, pt + ih - y(b.a.rev), 4) + '"></path>';
      svg += '<path class="b2" d="' + barPath(cx + 1, y(b.a.cost), bw, pt + ih - y(b.a.cost), 4) + '"></path>';
    });
    svg += '</g><line class="base" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + (pt + ih) + '" y2="' + (pt + ih) + '"></line><g class="xl">';
    var every = Math.max(1, Math.ceil(44 / gw));
    bs.forEach(function (b, k) {
      if ((bs.length - 1 - k) % every) return; // 최신 기간 라벨은 항상 표시
      svg += '<text x="' + (pl + gw * k + gw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(b.label) + "</text>";
    });
    svg += "</g><g>";
    bs.forEach(function (b, k) {
      svg += '<rect class="hit" data-k="' + k + '" x="' + (pl + gw * k) + '" y="' + pt + '" width="' + gw + '" height="' + ih + '" tabindex="0" aria-label="' + esc(b.label) + " 매출 " + won(b.a.rev) + ", 광고비 " + won(b.a.cost) + '"></rect>';
    });
    svg += "</g></svg>";
    chartData = bs.map(function (b, k) { return { b: b, x: (pl + gw * k + gw / 2) / W, top: y(Math.max(b.a.rev, b.a.cost)) / H }; });
    $("chart").innerHTML = svg + '<div class="tip" id="tip" hidden></div>';
  }
  function showTip(k) {
    var d = chartData[k]; if (!d) return;
    var tip = $("tip"), box = $("chart"), a = d.b.a;
    document.querySelectorAll("#chart .hit").forEach(function (r) { r.classList.toggle("on", +r.dataset.k === k); });
    tip.innerHTML = "<b>" + esc(d.b.label) + "</b>" +
      '<div><span><i class="sw s1"></i> 매출</span><span class="num">' + won(a.rev) + "</span></div>" +
      '<div><span><i class="sw s2"></i> 광고비</span><span class="num">' + won(a.cost) + "</span></div>" +
      '<div><span>순수익</span><span class="num ' + (a.profit >= 0 ? "pos" : "neg") + '">' + won(a.profit) + "</span></div>" +
      "<div><span>순수익률</span><span>" + (isFinite(a.margin) ? pct(a.margin) : "—") + "</span></div>";
    tip.hidden = false;
    var w = box.clientWidth, tw = tip.offsetWidth, left = d.x * w - tw / 2;
    left = Math.max(0, Math.min(w - tw, left));
    tip.style.left = left + "px";
    tip.style.top = Math.max(0, d.top * box.clientHeight - tip.offsetHeight - 8) + "px";
  }
  function hideTip() {
    var t = $("tip"); if (t) t.hidden = true;
    document.querySelectorAll("#chart .hit.on").forEach(function (r) { r.classList.remove("on"); });
  }

  function mixTable(list, key, names) {
    var groups = {};
    list.forEach(function (e) { (groups[e[key] || "etc"] = groups[e[key] || "etc"] || []).push(e); });
    var arr = Object.keys(groups).map(function (k) { return { k: k, a: agg(groups[k]) }; }).sort(function (x, y) { return y.a.profit - x.a.profit; });
    if (!arr.length) return '<tbody><tr><td class="empty">이 기간에 기록이 없습니다.</td></tr></tbody>';
    return '<thead><tr><th></th><th class="n">매출</th><th class="n">광고비</th><th class="n">순수익</th><th class="n">순수익률</th><th>상태</th></tr></thead><tbody>' +
      arr.map(function (r) {
        return "<tr><td><b>" + esc(names[r.k] || r.k) + '</b></td><td class="n">' + won(r.a.rev) + '</td><td class="n">' + won(r.a.cost) +
          '</td><td class="n ' + (r.a.profit >= 0 ? "pos" : "neg") + '">' + won(r.a.profit) + '</td><td class="n">' + (isFinite(r.a.margin) ? pct(r.a.margin) : "—") + "</td><td>" + statusPill(r.a.margin) + "</td></tr>";
      }).join("") + "</tbody>";
  }

  function renderEntries() {
    var list = entries.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).slice(0, 40);
    if (!list.length) { $("entries").innerHTML = '<tbody><tr><td class="empty">아직 기록이 없습니다. 위의 기록 가져오기로 정산·광고비를 가져오세요.</td></tr></tbody>'; return; }
    $("entries").innerHTML = '<thead><tr><th>날짜</th><th>채널</th><th>네트워크 · 캠페인</th><th class="n">광고비</th><th class="n">매출</th><th class="n">순수익</th><th></th></tr></thead><tbody>' +
      list.map(function (e) {
        var a = agg([e]);
        return "<tr><td class=\"num\">" + esc(e.date.slice(5)) + "</td><td>" + esc(L.chName[e.ch] || e.ch) + "</td><td>" + esc(L.netName[e.net] || e.net) + (e.camp ? ' <span class="muted">· ' + esc(e.camp) + "</span>" : "") +
          '</td><td class="n">' + won(e.spend) + '</td><td class="n">' + won(e.rev) + '</td><td class="n ' + (a.profit >= 0 ? "pos" : "neg") + '">' + won(a.profit) +
          '</td><td><button class="x" type="button" data-del="' + esc(e.id) + '" aria-label="기록 삭제">×</button></td></tr>';
      }).join("") + "</tbody>";
  }

  function render() {
    $("dashSample").hidden = entries.length > 0;
    document.querySelectorAll("#periodSeg button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.p === period ? "true" : "false"); });
    renderKpis();
    renderGoal();
    renderActions();
    var all = rows();
    var bs = buckets(period).map(function (b) { b.list = all.filter(function (e) { return within(e, b); }); b.a = agg(b.list); return b; });
    renderChart(bs);
    var tot = agg([].concat.apply([], bs.map(function (b) { return b.list; })));
    $("periodTable").innerHTML = '<thead><tr><th>기간</th><th class="n">매출</th><th class="n">광고비</th><th class="n">순수익</th><th class="n">순수익률</th><th>상태</th><th class="n">DB</th><th class="n">승인</th></tr></thead><tbody>' +
      bs.slice().reverse().map(function (b) {
        var a = b.a;
        return "<tr><td>" + esc(b.label) + '</td><td class="n">' + won(a.rev) + '</td><td class="n">' + won(a.cost) + '</td><td class="n ' + (a.profit >= 0 ? "pos" : "neg") + '">' + won(a.profit) +
          '</td><td class="n">' + (isFinite(a.margin) ? pct(a.margin) : "—") + "</td><td>" + (a.n ? statusPill(a.margin) : '<span class="pill none">기록 없음</span>') + '</td><td class="n">' + fmt(a.leads) + '</td><td class="n">' + fmt(a.appr) + "</td></tr>";
      }).join("") +
      '<tr class="total"><td>합계</td><td class="n">' + won(tot.rev) + '</td><td class="n">' + won(tot.cost) + '</td><td class="n ' + (tot.profit >= 0 ? "pos" : "neg") + '">' + won(tot.profit) +
      '</td><td class="n">' + (isFinite(tot.margin) ? pct(tot.margin) : "—") + "</td><td>" + statusPill(tot.margin) + '</td><td class="n">' + fmt(tot.leads) + '</td><td class="n">' + fmt(tot.appr) + "</td></tr></tbody>";
    var rangeList = [].concat.apply([], bs.map(function (b) { return b.list; }));
    $("mixRange").textContent = { day: "최근 14일", week: "최근 8주", month: "최근 6개월" }[period];
    $("byChannel").innerHTML = mixTable(rangeList, "ch", L.chName);
    $("byNetwork").innerHTML = mixTable(rangeList, "net", L.netName);
    var campNames = {};
    var campRows = rangeList.map(function (e) {
      var k = (L.importer ? L.importer.normName(e.camp) : String(e.camp || "")) || "_";
      if (!campNames[k]) campNames[k] = e.camp || "(이름 없음)";
      return Object.assign({}, e, { _ck: k });
    });
    $("byCamp").innerHTML = mixTable(campRows, "_ck", campNames);
    renderEntries();
  }

  function init() {
    entries = L.store.get("entries", []);
    period = L.store.get("period", "day");
    $("periodSeg").addEventListener("click", function (e) {
      var b = e.target.closest("[data-p]"); if (!b) return;
      period = b.dataset.p; L.store.set("period", period); render();
    });
    var chart = $("chart");
    chart.addEventListener("mousemove", function (e) { var r = e.target.closest(".hit"); if (r) showTip(+r.dataset.k); });
    chart.addEventListener("click", function (e) { var r = e.target.closest(".hit"); if (r) showTip(+r.dataset.k); });
    chart.addEventListener("focusin", function (e) { var r = e.target.closest(".hit"); if (r) showTip(+r.dataset.k); });
    chart.addEventListener("mouseleave", hideTip);
    chart.addEventListener("focusout", hideTip);

    $("entries").addEventListener("click", function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      entries = entries.filter(function (x) { return x.id !== b.dataset.del; });
      L.store.set("entries", entries); render(); L.toast("기록을 삭제했습니다");
    });
    $("csvBtn").addEventListener("click", function () {
      if (!entries.length) { L.toast("복사할 기록이 없습니다"); return; }
      var head = "날짜,네트워크,캠페인,채널,광고비,매출,DB,승인,순수익";
      var body = entries.map(function (e) {
        var a = agg([e]);
        return [e.date, L.netName[e.net] || e.net, '"' + String(e.camp || "").replace(/"/g, '""') + '"', L.chName[e.ch] || e.ch, e.spend, e.rev, e.leads, e.appr, Math.round(a.profit)].join(",");
      }).join("\n");
      L.copyText(head + "\n" + body, "CSV를 복사했습니다. 엑셀·구글시트에 붙여넣으세요.");
    });
    renderBizCheck();
    $("bizCheck").addEventListener("change", function (e) {
      var i = e.target.dataset.bc; if (i == null) return;
      var st = Object.assign({}, L.store.get("bizchecks", {})); st[i] = e.target.checked;
      L.store.set("bizchecks", st); renderBizCheck();
    });
    L.on("settings", render);
    L.on("ops", function () { if (!$("dashboard").hidden) render(); });
    L.on("entries", function () { entries = L.store.get("entries", []); render(); });
    L.onShow.dashboard = render;
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { if (!$("dashboard").hidden) render(); }, 150); });
  }

  L.dash = {
    agg: agg, rows: rows, buckets: buckets, within: within, ymd: ymd, parse: parse, today: today, addDays: addDays, monday: monday,
    hasData: function () { return entries.length > 0; },
    summaryText: function () {
      renderActions();
      var t = today(), mFrom = new Date(t.getFullYear(), t.getMonth(), 1);
      var cur = agg(rows().filter(function (e) { var d = parse(e.date); return d >= mFrom && d <= t; }));
      var strip = function (h) { return String(h).replace(/<[^>]+>/g, ""); };
      return ["[제휴광고 레퍼런스 랩] " + ymd(t), (entries.length ? "" : "(예시 데이터) ") + "이번 달 순수익 " + won(cur.profit) + " · 순수익률 " + (isFinite(cur.margin) ? pct(cur.margin) : "-") + (cur.pend ? " · 확정 대기 " + fmt(cur.pend) + "건" : ""),
        "", "오늘 할 일"].concat(lastActs.slice(0, 7).map(function (a) { return (a[0] === "no" ? "❗ " : a[0] === "ok" ? "✅ " : "→ ") + strip(a[1]); })).join("\n");
    }, render: function () { if (!$("dashboard").hidden) render(); }
  };
  (L.extraInits = L.extraInits || []).push(init);
})();
