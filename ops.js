/* 캠페인 운영: 3단계 점검
   1단계 게시 전 검토 → 게시 → 2단계 1차 점검(채널별 2~4일차) → 3단계 재확인(7~21일차)
   각 단계: 규칙 기반 진단을 즉시 보여 주고, AI가 켜져 있으면 채널 특성에 맞춘 재수정안을 작성합니다. */
(function () {
  "use strict";
  var L = window.Lab, D = L.D, $ = L.$, esc = L.esc, won = L.won, fmt = L.fmt, pct = L.pct;
  var R = D.opsRules;

  /* ───────── 저장 ───────── */
  function all() { return L.store.get("ops", []); }
  function saveAll(list) { L.store.set("ops", list); }
  function get(id) { return all().filter(function (o) { return o.id === id; })[0]; }
  function patch(id, fn) {
    var list = all().map(function (o) { if (o.id !== id) return o; var c = JSON.parse(JSON.stringify(o)); fn(c); c.updated = Date.now(); return c; });
    saveAll(list);
    return get(id);
  }

  /* ───────── 날짜 ───────── */
  function d() { return L.dash; }
  function timing(ch) { return R.timing[ch] || [3, 7, "기본 일정입니다."]; }
  function dueDates(o) {
    if (!o.launch) return null;
    var t = timing(o.ch), base = d().parse(o.launch);
    return { s2: d().addDays(base, t[0]), s3: d().addDays(base, t[1]) };
  }
  function dayDiff(a, b) { return Math.round((a - b) / 864e5); }
  function nextStep(o) {
    var st = o.stages || {};
    if (st.s3 && st.s3.done) return { n: 4, label: "완료", cls: "none" };
    if (!o.launch) return { n: 1, label: st.s1 ? "게시 대기" : "게시 전 검토", cls: "warn" };
    var due = dueDates(o), t = d().today();
    var key = st.s2 && st.s2.done ? "s3" : "s2", when = due[key], dd = dayDiff(when, t);
    var name = key === "s2" ? "1차 점검" : "재확인";
    return { n: key === "s2" ? 2 : 3, due: when, dd: dd, cls: dd < 0 ? "bad" : dd === 0 ? "warn" : "none",
      label: dd < 0 ? name + " " + (-dd) + "일 지남" : dd === 0 ? "오늘 " + name : name + " D-" + dd };
  }
  function dueList() {
    return all().map(function (o) { return { o: o, n: nextStep(o) }; }).filter(function (x) { return x.n.n > 1 && x.n.n < 4 && x.n.dd <= 0; });
  }

  /* ───────── 계산 공통 ───────── */
  function limits(o) {
    var S = L.settings(), P = +o.payout || 0, a = (+o.approve || 70) / 100;
    return { P: P, a: a, hi: L.maxCPL(P, a, S.marginMin / 100, S.wht), mid: L.maxCPL(P, a, (S.marginMin + S.marginMax) / 200, S.wht), has: P > 0 };
  }
  function metrics(o, m) {
    var S = L.settings(), vat = S.vat ? 1.1 : 1, w = S.wht ? 0.033 : 0;
    var cost = (+m.spend || 0) * vat, impr = +m.impr || 0, clicks = +m.clicks || 0, leads = +m.leads || 0;
    var appr = m.appr !== "" && m.appr != null && !isNaN(parseFloat(m.appr)) ? +m.appr : leads * ((+o.approve || 70) / 100);
    var rev = appr * (+o.payout || 0), profit = rev * (1 - w) - cost;
    return {
      cost: cost, impr: impr, clicks: clicks, leads: leads, appr: appr, apprGiven: m.appr !== "" && m.appr != null,
      ctr: impr ? clicks / impr : NaN, cpc: clicks ? cost / clicks : NaN, cpm: impr ? cost / impr * 1000 : NaN,
      cvr: clicks ? leads / clicks : NaN, cpl: leads ? cost / leads : NaN, rate: leads ? appr / leads : NaN,
      rev: rev, profit: profit, margin: rev > 0 ? profit / rev : (cost > 0 ? -Infinity : NaN), freq: +m.freq || 0
    };
  }
  function money(v) { return isFinite(v) ? won(v) : "—"; }
  function fact(label, value, cls) { return '<div class="fact' + (cls ? " " + cls : "") + '"><small>' + esc(label) + "</small><b class=\"num\">" + value + "</b></div>"; }
  function checks(items) { return '<ul class="checks">' + items.map(function (i) { return '<li class="' + i[0] + '">' + i[1] + "</li>"; }).join("") + "</ul>"; }

  /* ───────── 1단계: 게시 전 검토 ───────── */
  function review1(o, f) {
    var ch = L.chById(o.ch), spec = R.spec[o.ch] || {}, lim = limits(o), cat = L.catById(o.cat);
    var must = [], warn = [], good = [];
    var copy = (f.head || "") + "\n" + (f.body || "") + "\n" + (f.cta || "");
    var c = L.analyze.analyzeCopy(copy);
    // 규격
    if (spec.text) {
      if (f.kind !== "text") warn.push(esc(ch.short) + "은 검색형(텍스트) 광고입니다. 소재 종류를 '텍스트'로 두고 제목·설명 문구를 점검하세요.");
      else good.push("검색형 텍스트 광고 규격");
    } else if (spec.ratios && f.kind !== "text") {
      if (spec.ratios.indexOf(f.ratio) < 0) must.push("비율 <b>" + esc(f.ratio) + "</b>은 " + esc(ch.short) + " 권장 비율(" + esc(spec.ratios.join(", ")) + ")이 아닙니다. 지면에 맞지 않으면 잘리거나 성과가 떨어집니다.");
      else good.push("비율 " + esc(f.ratio) + " (" + esc(spec.note) + ")");
    }
    if (f.kind === "video" && spec.len) {
      var sec = +f.sec || 0;
      if (!sec) warn.push("영상 길이를 입력하면 권장 길이(" + spec.len[0] + "~" + spec.len[1] + "초)와 비교합니다.");
      else if (sec < spec.len[0] || sec > spec.len[1]) warn.push("영상 " + sec + "초 → " + esc(ch.short) + " 권장 " + spec.len[0] + "~" + spec.len[1] + "초로 편집을 권합니다.");
      else good.push("영상 길이 " + sec + "초");
    }
    // 첫 문장
    var head = String(f.head || "").trim();
    if (!head) must.push("첫 문장(헤드라인)이 비어 있습니다. 첫 화면 문구가 성과의 대부분을 결정합니다.");
    else {
      if (spec.headMax && head.length > spec.headMax) warn.push("첫 문장 " + head.length + "자 → " + esc(ch.short) + "에서는 " + spec.headMax + "자 안팎이 잘 읽힙니다.");
      if (c.callout) good.push("첫 문장에서 대상을 부름 (타깃 외 클릭·무효 DB 감소)");
      else warn.push("첫 문장에 대상 호출이 없습니다. 예: '" + esc(cat ? L.fillHook(D.hooks[0].alts[0], cat) : "40대 운전자라면…") + "'");
      if (c.number) good.push("숫자 포함 (클릭률에 유리)"); else warn.push("구체적인 숫자(금액·기간·비율)를 넣으면 클릭률이 오릅니다.");
    }
    if (!String(f.cta || "").trim() && !c.cta.length) warn.push("CTA가 없습니다. '무료로 확인', '조건 비교하기'처럼 부담 낮은 행동 문구를 넣으세요.");
    if (c.risks.length) must.push("심사·법규 위험 표현: <b>" + esc(c.risks.join(", ")) + "</b>. 반려·계정 제재 위험이 있으니 바꾸세요.");
    if (c.review && !c.adLabel) must.push("후기형 문구인데 광고 표기가 없습니다. 첫 부분에 '[광고]' 또는 '유료광고'를 넣으세요.");
    // 캠페인 목표
    if (spec.paid) {
      if (f.goal === "traffic" || f.goal === "reach" || f.goal === "view") must.push("캠페인 목표가 '" + esc({ traffic: "트래픽", reach: "도달", view: "조회" }[f.goal]) + "'입니다. DB 캠페인은 <b>전환(리드) 목표</b>로 해야 매체가 신청할 사람을 찾습니다.");
      else good.push("전환(리드) 목표");
    }
    // 타깃
    var aMin = +f.ageMin || 0, aMax = +f.ageMax || 0;
    if (o.ageMin && o.ageMax && aMin && aMax && (aMin < o.ageMin || aMax > o.ageMax)) must.push("타깃 연령 " + aMin + "~" + aMax + "세가 캠페인 인정 연령(" + o.ageMin + "~" + o.ageMax + "세)을 벗어납니다. 벗어난 DB는 무효 처리될 수 있습니다.");
    else if (aMin && aMax && aMax - aMin < 10) warn.push("연령 폭이 " + (aMax - aMin) + "세로 좁습니다. 초기에는 넓게 두고 첫 문장으로 대상을 거르는 편이 학습에 유리합니다.");
    else if (aMin && aMax) good.push("타깃 연령 " + aMin + "~" + aMax + "세");
    var interests = String(f.interest || "").split(/[,·\n]/).filter(function (x) { return x.trim(); });
    if (f.tmode === "interest" && interests.length > 4) warn.push("관심사 " + interests.length + "개를 겹치면 타깃이 너무 좁아집니다. 3개 이하 또는 광범위 타깃과 비교하세요.");
    if (f.tmode === "retarget") warn.push("리타깃만으로 시작하면 볼륨이 작습니다. 광범위 타깃 세트를 함께 두세요.");
    if (f.tmode === "broad") good.push("광범위 타깃 (자동화 캠페인에 유리)");
    // 예산
    var bud = +f.budget || 0;
    if (spec.paid && lim.has) {
      var rec = Math.max(30000, Math.round(lim.mid * 3 / 1000) * 1000);
      if (!bud) warn.push("일예산을 입력하면 목표 DB당 광고비(" + won(lim.mid) + ")와 비교합니다.");
      else if (bud < lim.mid * 2) warn.push("일예산 " + won(bud) + "은 목표 DB당 광고비의 2배 미만이라 하루 DB가 1~2건도 어려워 학습이 느립니다. " + won(rec) + " 이상을 권합니다.");
      else if (bud > lim.mid * 15) warn.push("테스트 단계 일예산으로는 큽니다. 소재 검증 전에는 " + won(rec) + " 안팎으로 시작하세요.");
      else good.push("일예산 " + won(bud) + " (목표 DB당 광고비 " + won(lim.mid) + " 기준 적정)");
    } else if (spec.paid && !lim.has) warn.push("캠페인 단가를 입력하면 예산 적정성과 한계 CPC를 계산합니다.");
    // 체크리스트
    if (spec.paid && !f.track) must.push("전환 추적이 설치되지 않았습니다. 추적 없이 게시하면 매체가 학습할 수 없습니다.");
    if (!f.allowed) must.push("네트워크 캠페인 조건에서 <b>" + esc(ch.short) + " 집행 허용</b> 여부를 먼저 확인하세요. 불허 매체 DB는 정산에서 빠집니다.");
    if (!f.bridge && spec.paid) warn.push("브릿지 페이지 없이 네트워크 랜딩으로 바로 보내면 픽셀 설치·문구 일치가 어렵습니다.");
    if (cat && cat.check && !f.shimui) must.push(esc(cat.name) + "은 심의·정책 확인이 필요한 업종입니다. 광고주 승인 문구 범위인지 확인하세요.");
    var score = Math.max(0, Math.min(100, 100 - must.length * 16 - warn.length * 6));
    return { must: must, warn: warn, good: good, score: score, copy: c };
  }
  function render1Result(o, r) {
    var ok = !r.must.length;
    return '<div class="panel stack result"><div class="row between"><h3 class="sub">게시 전 검토 결과</h3><span class="pill ' + (ok ? (r.warn.length ? "warn" : "good") : "bad") + '">' +
      (ok ? (r.warn.length ? "게시 가능 · 개선 권장" : "게시 가능") : "수정 후 게시") + "</span></div>" +
      '<div class="facts">' + fact("검토 점수", r.score + "점", r.score >= 80 ? "key" : "") + fact("필수 수정", r.must.length + "건") + fact("권장 개선", r.warn.length + "건") + fact("잘된 점", r.good.length + "건") + "</div>" +
      (r.must.length ? "<h4>필수 수정</h4>" + checks(r.must.map(function (x) { return ["no", x]; })) : "") +
      (r.warn.length ? "<h4>권장 개선</h4>" + checks(r.warn.map(function (x) { return ["tip2", x]; })) : "") +
      (r.good.length ? "<h4>잘된 점</h4>" + checks(r.good.map(function (x) { return ["ok", x]; })) : "") + "</div>";
  }

  /* ───────── 2·3단계: 성과 진단 ───────── */
  /* 참고치: 같은 채널에서 내가 완료한 점검이 3건 이상이면 내 실적 중앙값, 아니면 기본 참고치 */
  function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); var n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : NaN; }
  function bench(ch) {
    var base = R.bench[ch] || { ctr: 0.006, cvr: 0.04 }, ctr = [], cvr = [];
    all().forEach(function (o) {
      if (o.ch !== ch || !o.stages) return;
      ["s2", "s3"].forEach(function (k) {
        var x = o.stages[k] && o.stages[k].inputs; if (!x) return;
        var impr = +x.impr || 0, clicks = +x.clicks || 0, leads = +x.leads || 0;
        if (impr >= R.minImpr && clicks) { ctr.push(clicks / impr); if (clicks >= 30) cvr.push(leads / clicks); }
      });
    });
    var own = ctr.length >= 3;
    return { ctr: own ? median(ctr) : base.ctr, cvr: own && cvr.length >= 3 ? median(cvr) : base.cvr, own: own, n: ctr.length };
  }
  function diagnose(o, m, stageNo, prev) {
    var lim = limits(o), b = bench(o.ch), S = L.settings();
    var acts = [], verdict;
    if (m.impr && m.impr < R.minImpr) acts.push(["tip2", "노출 " + fmt(m.impr) + "회로 아직 데이터가 적습니다(" + fmt(R.minImpr) + "회 미만). 소재 교체보다 <b>예산을 유지하며 하루 더 쌓는 것</b>을 권합니다."]);
    if (isFinite(m.ctr)) {
      if (m.ctr < b.ctr * 0.7) acts.push(["no", "CTR " + pct(m.ctr, 2) + " → " + (b.own ? "내 " + L.chById(o.ch).short + " 평균" : "참고치") + "(" + pct(b.ctr, 2) + ")보다 낮습니다. <b>소재(첫 문장·첫 화면) 문제</b>입니다. 훅만 바꾼 새 버전 2~3개를 넣으세요."]);
      else acts.push(["ok", "CTR " + pct(m.ctr, 2) + " (" + (b.own ? "내 평균" : "참고치") + " " + pct(b.ctr, 2) + " 이상) — 소재가 시선을 잡고 있습니다."]);
    }
    if (isFinite(m.cvr)) {
      if (m.cvr < b.cvr * 0.6 && m.clicks >= 30) acts.push(["no", "클릭→신청 전환율 " + pct(m.cvr, 1) + " → <b>광고와 랜딩의 말이 다르거나 폼이 부담</b>스럽습니다. 브릿지 페이지 첫 줄을 소재 첫 문장과 같게 바꾸세요."]);
      else if (m.clicks >= 30) acts.push(["ok", "클릭→신청 전환율 " + pct(m.cvr, 1) + " — 랜딩 연결이 괜찮습니다."]);
    }
    if (lim.has && isFinite(m.cpl)) {
      if (m.cpl <= lim.mid) acts.push(["ok", "DB당 광고비 " + won(m.cpl) + " ≤ 목표 " + won(lim.mid) + " — <b>유지하며 증액 후보</b>입니다."]);
      else if (m.cpl <= lim.hi) acts.push(["tip2", "DB당 광고비 " + won(m.cpl) + " — 한계(" + won(lim.hi) + ") 안이지만 목표보다 높습니다. 성과 나쁜 소재부터 끄세요."]);
      else acts.push(["no", "DB당 광고비 " + won(m.cpl) + " > 한계 " + won(lim.hi) + " → 이대로는 순수익 " + S.marginMin + "%를 지킬 수 없습니다."]);
    } else if (lim.has && m.cost >= lim.hi * 2 && !m.leads) acts.push(["no", "지출 " + won(m.cost) + "(한계 DB당 광고비의 2배 이상)인데 DB 0건 → <b>끄기 기준</b>에 해당합니다."]);
    if (m.apprGiven && isFinite(m.rate) && m.rate < (+o.approve || 70) / 100 - 0.1) acts.push(["no", "승인율 " + pct(m.rate, 0) + " → 예상(" + (o.approve || 70) + "%)보다 낮습니다. <b>타깃 연령·지역을 캠페인 인정 범위로 좁히고</b> 첫 문장으로 대상을 명확히 하세요."]);
    if (m.freq >= 3) acts.push(["no", "빈도 " + m.freq + " → 같은 사람에게 너무 자주 노출됩니다. 소재 교체나 타깃 확장이 필요합니다."]);
    if (prev && isFinite(prev.cpl) && isFinite(m.cpl)) {
      var ch = (m.cpl - prev.cpl) / prev.cpl;
      acts.push([ch <= 0 ? "ok" : "no", "1차 점검 대비 DB당 광고비 " + (ch <= 0 ? "개선 " : "악화 ") + pct(Math.abs(ch), 0) + " (" + won(prev.cpl) + " → " + won(m.cpl) + ")"]);
    }
    var mg = m.margin, minM = S.marginMin / 100;
    if (!m.cost) verdict = ["none", "입력 대기", "지출·노출·클릭·DB를 넣으면 판정합니다."];
    else if (m.impr && m.impr < R.minImpr && stageNo === 2) verdict = ["warn", "판단 보류", "데이터가 쌓일 때까지 예산·타깃을 그대로 두세요."];
    else if (isFinite(mg) && mg >= minM) verdict = ["good", stageNo === 3 ? "스케일" : "유지 · 증액 준비", stageNo === 3 ? "하루 20%씩 증액하고, 2순위 채널에 같은 소재로 소액 테스트를 시작하세요." : "학습을 방해하지 않도록 수정 없이 유지하고, 3일 연속 목표 이하면 20% 증액하세요."];
    else if (isFinite(mg) && mg >= 0) verdict = ["warn", "최적화", "이익은 나지만 목표 미달입니다. 아래 원인부터 한 번에 하나씩 고치세요."];
    else verdict = ["bad", stageNo === 3 ? "중단 · 재설계" : "수정 필요", stageNo === 3 ? "이 조합은 멈추고 소재·채널·캠페인 중 하나를 바꿔 새 사이클을 시작하세요." : "끄기 기준에 가까운 소재부터 끄고, 훅을 바꾼 새 소재를 넣으세요."];
    return { acts: acts, verdict: verdict };
  }
  function renderMetrics(o, m, dg, stageNo) {
    var lim = limits(o);
    return '<div class="panel stack result"><div class="row between"><h3 class="sub">' + (stageNo === 2 ? "1차 점검" : "재확인") + ' 진단</h3><span class="pill ' + dg.verdict[0] + '">' + esc(dg.verdict[1]) + "</span></div>" +
      '<p class="verdict-line">' + esc(dg.verdict[2]) + "</p>" +
      '<div class="facts">' +
        fact("CTR", isFinite(m.ctr) ? pct(m.ctr, 2) : "—") + fact("CPC", money(m.cpc)) + fact("CPM", money(m.cpm)) + fact("클릭→신청", isFinite(m.cvr) ? pct(m.cvr, 1) : "—") +
        fact("DB당 광고비", money(m.cpl), lim.has && isFinite(m.cpl) && m.cpl <= lim.mid ? "key" : "") +
        fact("추정 순수익", money(m.profit)) + fact("순수익률", isFinite(m.margin) ? pct(m.margin) : "—") +
        fact("목표 / 한계", lim.has ? won(lim.mid) + " / " + won(lim.hi) : "단가 미입력") +
      "</div>" +
      (m.apprGiven ? "" : '<p class="note">승인 수를 비워 두어 예상 승인율 ' + (o.approve || 70) + "%로 추정했습니다.</p>") +
      "<h4>원인과 조치</h4>" + checks(dg.acts.length ? dg.acts : [["tip2", "지표를 입력하면 원인을 진단합니다."]]) + "</div>";
  }
  function creativeRows(o, rows) {
    var lim = limits(o), S = L.settings(), vat = S.vat ? 1.1 : 1;
    var valid = rows.filter(function (r) { return r.name || r.spend; });
    if (!valid.length) return "";
    var best = null;
    valid.forEach(function (r) { r.cpl = r.leads ? r.spend * vat / r.leads : Infinity; if (r.leads && (!best || r.cpl < best.cpl)) best = r; });
    return '<div class="panel stack"><h3 class="sub">소재별 판정</h3><div class="tablewrap"><table class="data"><thead><tr><th>소재</th><th class="n">지출</th><th class="n">클릭</th><th class="n">DB</th><th class="n">DB당 광고비</th><th>판정</th></tr></thead><tbody>' +
      valid.map(function (r) {
        var v = !r.leads && lim.has && r.spend * vat >= lim.hi * 2 ? ["off", "끄기"] : !r.leads ? ["watch", "관찰"] : lim.has && r.cpl > lim.hi ? ["off", "끄기"] : r === best ? ["up", "예산 이동"] : ["watch", "유지"];
        return "<tr><td>" + esc(r.name || "소재") + '</td><td class="n">' + won(r.spend * vat) + '</td><td class="n">' + fmt(r.clicks) + '</td><td class="n">' + fmt(r.leads) + '</td><td class="n">' + (isFinite(r.cpl) ? won(r.cpl) : "—") + '</td><td><span class="pill ' + v[0] + '">' + v[1] + "</span></td></tr>";
      }).join("") + "</tbody></table></div><p class=\"note\">끄는 소재의 예산은 '예산 이동' 소재로 옮기고, 같은 구조로 훅만 바꾼 새 소재 1~2개를 추가하세요.</p></div>";
  }

  /* ───────── AI 프롬프트 ───────── */
  function chContext(o) {
    var ch = L.chById(o.ch), spec = R.spec[o.ch] || {}, cat = L.catById(o.cat), lim = limits(o), t = timing(o.ch);
    return [
      "[채널] " + ch.name + " — " + ch.fit,
      "[채널 규격] " + ch.specs.map(function (x) { return x[0] + ": " + x[1]; }).join(" / ") + (spec.note ? " / 핵심: " + spec.note : ""),
      "[채널 운영 규칙] " + ch.rules.map(function (x) { return x[0] + ": " + x[1]; }).join(" / "),
      "[채널 정책 주의] " + ch.policy,
      "[업종] " + (cat ? cat.name + " / 기본 타깃 " + cat.target + " / 피할 표현: " + cat.avoid : "미지정"),
      "[캠페인] " + (o.name || "") + (o.net ? " / 네트워크 " + (L.netName[o.net] || o.net) : "") + " / 단가 " + (lim.has ? won(lim.P) : "미입력") + " / 예상 승인율 " + (o.approve || 70) + "%" + (o.ageMin ? " / 인정 연령 " + o.ageMin + "~" + o.ageMax + "세" : "") + (o.terms ? " / 조건: " + o.terms : ""),
      lim.has ? "[한계선] DB당 광고비 한계 " + won(lim.hi) + " (순수익 " + L.settings().marginMin + "%), 목표 " + won(lim.mid) : "",
      "[점검 일정] 게시 후 " + t[0] + "일차 1차 점검, " + t[1] + "일차 재확인 (" + t[2] + ")"
    ].filter(Boolean).join("\n");
  }
  var AI_RULES = "\n규칙: 한국어, 바로 실행할 수 있게 숫자와 함께. 확인하지 않은 수치를 지어내지 말 것. 채널 규격과 정책, 업종 심의를 지키는 표현만 제안. 핵심 문장은 **굵게**. 마지막 줄에 'KEYWORDS: …'로 레퍼런스 검색 키워드 5개.";
  function prompt1(o, f, r) {
    return "당신은 한국 CPA 제휴마케팅 퍼포먼스 광고 전문가입니다. 아래 광고를 **게시 전에 검토**하고, 이 채널 특성에 맞게 재수정해 주세요.\n\n" + chContext(o) +
      "\n\n[소재] 종류 " + f.kind + ", 비율 " + f.ratio + (f.sec ? ", " + f.sec + "초" : "") + "\n[첫 문장] " + (f.head || "") + "\n[본문] " + (f.body || "") + "\n[CTA] " + (f.cta || "") +
      "\n[타깃] " + (f.ageMin || "?") + "~" + (f.ageMax || "?") + "세, 성별 " + f.gender + ", 지역 " + (f.region || "전국") + ", 방식 " + f.tmode + ", 관심사 " + (f.interest || "없음") +
      "\n[캠페인 목표] " + f.goal + " / 일예산 " + (f.budget ? won(+f.budget) : "미입력") + " / 입찰 " + f.bid +
      "\n[체크] 전환추적 " + (f.track ? "O" : "X") + ", 브릿지 " + (f.bridge ? "O" : "X") + ", 허용 매체 확인 " + (f.allowed ? "O" : "X") + ", 심의 확인 " + (f.shimui ? "O" : "X") +
      (f.imgCount ? "\n[첨부] 광고 화면 캡처 " + f.imgCount + "장 — 화면 구성·글자 크기·안전 영역·첫 화면 인상을 직접 보고 평가" : "") +
      "\n[규칙 기반 검토] 점수 " + r.score + "점 / 필수 수정: " + r.must.map(strip).join(" | ") + " / 권장: " + r.warn.map(strip).join(" | ") +
      "\n\n다음 순서로:\n## 게시 가능 여부 판정\n## 필수 수정 사항 (왜, 어떻게)\n## " + L.chById(o.ch).short + " 최적화 재수정안 (첫 문장 3안, 본문 2안, CTA, 화면 구성 수정, 자막·음성)\n## 타깃 설정 권장값 (연령·성별·지역·방식·제외 대상)\n## 예산·입찰 권장값과 이유\n## 게시 직전 최종 체크리스트\n## 1차 점검일(" + timing(o.ch)[0] + "일차)에 볼 지표와 기준" + AI_RULES;
  }
  function prompt23(o, stageNo, m, dg, rows, memo, prev) {
    var lim = limits(o);
    return "당신은 한국 CPA 제휴마케팅 퍼포먼스 광고 전문가입니다. 게시 후 " + (stageNo === 2 ? "1차 점검" : "재확인") + " 단계입니다. 성과를 진단하고 이 채널 특성에 맞게 광고를 재수정해 주세요.\n\n" + chContext(o) +
      "\n\n[게시일] " + o.launch + " / [경과] " + dayDiff(d().today(), d().parse(o.launch)) + "일" +
      "\n[지표] 광고비(VAT 반영) " + money(m.cost) + ", 노출 " + fmt(m.impr) + ", 클릭 " + fmt(m.clicks) + ", DB " + fmt(m.leads) + ", 승인 " + fmt(m.appr) + (m.apprGiven ? "" : "(추정)") + (m.freq ? ", 빈도 " + m.freq : "") +
      "\n[계산] CTR " + (isFinite(m.ctr) ? pct(m.ctr, 2) : "-") + ", CPC " + money(m.cpc) + ", CPM " + money(m.cpm) + ", 클릭→신청 " + (isFinite(m.cvr) ? pct(m.cvr, 1) : "-") + ", DB당 광고비 " + money(m.cpl) + ", 추정 순수익률 " + (isFinite(m.margin) ? pct(m.margin) : "-") +
      (prev ? "\n[1차 점검 때] DB당 광고비 " + money(prev.cpl) + ", CTR " + (isFinite(prev.ctr) ? pct(prev.ctr, 2) : "-") : "") +
      "\n[소재별] " + (rows.filter(function (r) { return r.name || r.spend; }).map(function (r) { return (r.name || "소재") + ": 지출 " + won(r.spend) + ", 클릭 " + r.clicks + ", DB " + r.leads; }).join(" / ") || "미입력") +
      "\n[현재 소재 첫 문장] " + ((o.stages && o.stages.s1 && o.stages.s1.inputs && o.stages.s1.inputs.head) || o.head || "미입력") +
      "\n[운영 메모] " + (memo || "없음") +
      "\n[규칙 기반 판정] " + dg.verdict[1] + " — " + dg.acts.map(function (a) { return strip(a[1]); }).join(" | ") +
      "\n\n다음 순서로:\n## 판정 한 줄 (" + (stageNo === 2 ? "유지·증액 준비 / 수정 / 보류" : "스케일 / 최적화 / 중단·재설계") + ")\n## 퍼널별 원인 (노출→클릭→신청→승인)\n## 소재별 조치 (끄기·유지·예산 이동)\n## " + L.chById(o.ch).short + " 맞춤 재수정 소재 3개 (첫 문장·화면·CTA, 규격 준수)\n## 타깃·입찰·예산 조정 (구체적 숫자)" +
      (stageNo === 2 ? "\n## 재확인일(" + timing(o.ch)[1] + "일차)까지 할 일과 볼 기준" : "\n## 다음 7일 계획 (예산, 2순위 채널 확장, 새 테스트)\n## 이 캠페인을 사업으로 키울지 판단 근거") + AI_RULES;
  }
  function strip(h) { return String(h || "").replace(/<[^>]+>/g, ""); }

  /* ───────── 화면 ───────── */
  var curId = null, curStage = 1, filter = "active";
  function renderList() {
    var list = all();
    document.querySelectorAll("#opsFilter button").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.of === filter ? "true" : "false"); });
    var shown = list.filter(function (o) { var n = nextStep(o).n; return filter === "all" || (filter === "done" ? n === 4 : n < 4); });
    var due = dueList().length;
    $("opsBadge").textContent = due ? String(due) : "";
    $("opsBadge").hidden = !due;
    if (!shown.length) {
      $("opsList").innerHTML = '<div class="panel empty-state"><b>' + (list.length ? "이 조건의 캠페인이 없습니다." : "등록된 캠페인이 없습니다.") + "</b><p>4단계 광고 제작에서 <b>이 플랫폼으로 캠페인 운영 시작</b>을 누르거나 '+ 새 캠페인'으로 등록하세요. 게시 전 검토 → 1차 점검 → 재확인 일정이 채널에 맞게 잡힙니다.</p></div>";
      return;
    }
    $("opsList").innerHTML = shown.sort(function (a, b) { return (b.updated || 0) - (a.updated || 0); }).map(function (o) {
      var n = nextStep(o), ch = L.chById(o.ch), steps = [1, 2, 3].map(function (i) {
        var done = o.stages && o.stages["s" + i] && (i === 1 ? o.launch : o.stages["s" + i].done);
        return '<i class="' + (done ? "done" : n.n === i ? "now" : "") + '"></i>';
      }).join("");
      return '<button type="button" class="ocard' + (o.id === curId ? " on" : "") + '" data-op="' + esc(o.id) + '">' +
        '<div class="row between"><span class="tag blue">' + esc(ch ? ch.short : o.ch) + '</span><span class="pill ' + n.cls + '">' + esc(n.label) + "</span></div>" +
        "<h4>" + esc(o.name || "이름 없는 캠페인") + "</h4>" +
        '<div class="osteps" aria-label="진행 ' + Math.min(n.n, 3) + '/3">' + steps + "</div>" +
        '<p class="note">' + (o.launch ? "게시 " + esc(o.launch) + (n.due ? " · 다음 " + esc(d().ymd(n.due)) : "") : "게시 전") + (o.payout ? " · 단가 " + won(o.payout) : "") + "</p></button>";
    }).join("");
  }

  function stepHead(o) {
    var due = dueDates(o), t = timing(o.ch), st = o.stages || {};
    var items = [
      { n: 1, t: "게시 전 검토", sub: o.launch ? "게시 " + o.launch : "소재·타깃·예산 점검", done: !!o.launch },
      { n: 2, t: "1차 점검", sub: due ? d().ymd(due.s2) + " (" + t[0] + "일차)" : "게시 후 " + t[0] + "일차", done: !!(st.s2 && st.s2.done) },
      { n: 3, t: "재확인", sub: due ? d().ymd(due.s3) + " (" + t[1] + "일차)" : "게시 후 " + t[1] + "일차", done: !!(st.s3 && st.s3.done) }
    ];
    return '<div class="stepper" role="tablist">' + items.map(function (it) {
      return '<button type="button" role="tab" data-stage="' + it.n + '" aria-selected="' + (curStage === it.n) + '" class="' + (it.done ? "done" : "") + '"><span class="sn">' + (it.done ? "✓" : it.n) + "</span><span><b>" + it.t + "</b><small>" + esc(it.sub) + "</small></span></button>";
    }).join("") + "</div>" + '<p class="note timing">' + esc(t[2]) + "</p>";
  }

  function v(x, k, dflt) { return x && x[k] != null && x[k] !== "" ? x[k] : dflt; }
  function stage1Form(o) {
    var s1 = (o.stages && o.stages.s1 && o.stages.s1.inputs) || {}, cat = L.catById(o.cat), spec = R.spec[o.ch] || {};
    var ratios = ["9:16", "4:5", "1:1", "16:9", "비즈보드", "기타"];
    var opt = function (list, val) { return list.map(function (x) { var k = Array.isArray(x) ? x[0] : x, l = Array.isArray(x) ? x[1] : x; return '<option value="' + esc(k) + '"' + (String(val) === String(k) ? " selected" : "") + ">" + esc(l) + "</option>"; }).join(""); };
    var cb = function (id, label, on) { return '<label class="toggle full"><input type="checkbox" id="' + id + '"' + (on ? " checked" : "") + "> " + label + "</label>"; };
    return '<form class="panel stack" id="s1Form"><h3 class="sub">1단계 · 게시 전 검토 <small class="muted">' + esc(spec.note || "") + "</small></h3>" +
      '<div class="inputs">' +
        '<label class="f">소재 종류<select id="s1kind">' + opt([["video", "영상"], ["image", "이미지"], ["text", "텍스트(검색·블로그)"]], v(s1, "kind", spec.text ? "text" : "video")) + "</select></label>" +
        '<label class="f">비율<select id="s1ratio">' + opt(ratios, v(s1, "ratio", (spec.ratios || ["9:16"])[0])) + "</select></label>" +
        '<label class="f">영상 길이 (초)<input type="number" id="s1sec" min="0" value="' + esc(v(s1, "sec", "")) + '"></label>' +
        '<label class="f">캠페인 목표<select id="s1goal">' + opt([["conv", "전환(리드·판매)"], ["traffic", "트래픽"], ["reach", "도달"], ["view", "조회"], ["organic", "무료 게시"]], v(s1, "goal", spec.paid ? "conv" : "organic")) + "</select></label>" +
        '<label class="f full">첫 문장 · 헤드라인<input type="text" id="s1head" value="' + esc(v(s1, "head", o.head || "")) + '" placeholder="' + esc(cat ? L.fillHook(D.hooks[0].alts[0], cat) : "첫 화면 문구") + '"></label>' +
        '<label class="f full">본문 · 자막 · 설명 문구<textarea id="s1body" rows="3">' + esc(v(s1, "body", "")) + "</textarea></label>" +
        '<label class="f">CTA 버튼 · 문구<input type="text" id="s1cta" value="' + esc(v(s1, "cta", "")) + '" placeholder="무료로 확인하기"></label>' +
        '<label class="f">일예산 (원)<input type="number" id="s1budget" min="0" step="1000" value="' + esc(v(s1, "budget", "")) + '"></label>' +
        '<label class="f">타깃 연령 (시작)<input type="number" id="s1ageMin" min="13" max="80" value="' + esc(v(s1, "ageMin", o.ageMin || "")) + '"></label>' +
        '<label class="f">타깃 연령 (끝)<input type="number" id="s1ageMax" min="13" max="80" value="' + esc(v(s1, "ageMax", o.ageMax || "")) + '"></label>' +
        '<label class="f">성별<select id="s1gender">' + opt([["all", "전체"], ["f", "여성"], ["m", "남성"]], v(s1, "gender", "all")) + "</select></label>" +
        '<label class="f">타깃 방식<select id="s1tmode">' + opt([["broad", "광범위(연령·성별만)"], ["interest", "관심사"], ["lookalike", "유사 타깃"], ["retarget", "리타깃"], ["keyword", "키워드(검색)"], ["region", "지역 중심"]], v(s1, "tmode", spec.text ? "keyword" : "broad")) + "</select></label>" +
        '<label class="f">지역<input type="text" id="s1region" value="' + esc(v(s1, "region", "")) + '" placeholder="전국 / 서울 강서구 반경 3km"></label>' +
        '<label class="f">입찰<select id="s1bid">' + opt([["auto", "자동(전환 최적화)"], ["cap", "비용 상한"], ["manual", "수동 CPC"]], v(s1, "bid", "auto")) + "</select></label>" +
        '<label class="f full">관심사 · 키워드 (쉼표로)<input type="text" id="s1interest" value="' + esc(v(s1, "interest", "")) + '"></label>' +
        cb("s1track", "전환 추적(픽셀·태그) 설치 완료", v(s1, "track", false)) +
        cb("s1bridge", "브릿지 페이지 사용", v(s1, "bridge", false)) +
        cb("s1allowed", "네트워크 조건에서 이 채널 집행 허용 확인", v(s1, "allowed", false)) +
        cb("s1shimui", "광고주 심의 문구·표기 확인", v(s1, "shimui", false)) +
        '<label class="f full">광고 화면 캡처 (게시 전 미리보기 스크린샷, 여러 장)<input type="file" id="s1imgs" accept="image/png,image/jpeg,image/webp" multiple></label>' +
      "</div>" +
      '<div class="row"><button class="btn blue" type="submit" id="s1run">검토하기</button><button class="btn ghost" type="button" id="s1stop" hidden>중지</button></div>' +
      '<div class="panel stack convert"><h4>다른 채널용으로 AI 재수정</h4><p class="note">같은 소재를 다른 채널 규격·톤에 맞게 바꿉니다.</p><div class="row"><select id="s1to" aria-label="변환할 채널">' +
        L.chOptions.filter(function (c) { return c[0] !== o.ch; }).map(function (c) { return '<option value="' + c[0] + '">' + esc(c[1]) + "</option>"; }).join("") +
        '</select><button class="btn ghost sm" type="button" id="s1conv">변환하기</button><button class="btn ghost sm" type="button" id="s1convStop" hidden>중지</button></div></div>' +
      "</form>" +
      '<div id="s1Out" class="stack">' + (o.stages && o.stages.s1 ? savedBlock(o, "s1") : "") + "</div>" +
      '<div class="panel stack launchbox"><div class="row between"><div><h3 class="sub">게시 완료 표시</h3><p class="note">실제로 광고를 게시한 날을 저장하면 1차 점검(' + timing(o.ch)[0] + "일차)·재확인(" + timing(o.ch)[1] + '일차) 일정이 잡히고 매출 현황의 오늘 할 일에 알림이 뜹니다.</p></div></div>' +
      '<div class="row"><input type="date" id="s1launch" value="' + esc(o.launch || d().ymd(d().today())) + '" aria-label="게시일"><button class="btn blue sm" type="button" id="s1go">' + (o.launch ? "게시일 수정" : "게시 완료") + "</button></div></div>";
  }
  function metricForm(o, n) {
    var s = (o.stages && o.stages["s" + n] && o.stages["s" + n].inputs) || {}, t = timing(o.ch);
    var rows = s.rows || [{}, {}, {}];
    var num = function (id, label, val, step) { return '<label class="f">' + label + '<input type="number" id="' + id + '" min="0" step="' + (step || 1) + '" value="' + esc(val == null ? "" : val) + '"></label>'; };
    return '<form class="panel stack" id="s' + n + 'Form"><h3 class="sub">' + (n === 2 ? "2단계 · 1차 점검" : "3단계 · 재확인") + ' <small class="muted">게시 후 ' + (n === 2 ? t[0] : t[1]) + "일차 · 게시일부터 누적 지표</small></h3>" +
      (!o.launch ? '<div class="notice"><b>아직 게시 전입니다.</b> 1단계에서 게시 완료를 누르면 점검일이 잡힙니다. 지표는 지금 넣어도 진단됩니다.</div>' : "") +
      '<div class="inputs four">' +
        num("s" + n + "spend", "광고비 (원, VAT 제외)", s.spend, 1000) + num("s" + n + "impr", "노출", s.impr) + num("s" + n + "clicks", "클릭", s.clicks) + num("s" + n + "leads", "DB 신청", s.leads) +
        num("s" + n + "appr", "승인 (모르면 비움)", s.appr) + num("s" + n + "freq", "빈도 (선택)", s.freq, 0.1) +
      "</div>" +
      '<details class="rowsbox"' + (rows.some(function (r) { return r.name || r.spend; }) ? " open" : "") + '><summary>소재별 지표 (선택)</summary><div class="tablewrap"><table class="data"><thead><tr><th>소재명</th><th>광고비</th><th>클릭</th><th>DB</th></tr></thead><tbody>' +
        [0, 1, 2].map(function (i) { var r = rows[i] || {}; return '<tr><td><input type="text" data-r="' + i + '" data-k="name" value="' + esc(r.name || "") + '" aria-label="소재명"></td><td><input type="number" min="0" data-r="' + i + '" data-k="spend" value="' + esc(r.spend || "") + '" aria-label="광고비"></td><td><input type="number" min="0" data-r="' + i + '" data-k="clicks" value="' + esc(r.clicks || "") + '" aria-label="클릭"></td><td><input type="number" min="0" data-r="' + i + '" data-k="leads" value="' + esc(r.leads || "") + '" aria-label="DB"></td></tr>'; }).join("") +
      "</tbody></table></div></details>" +
      '<label class="f">운영 메모 (바꾼 것, 이상한 점)<textarea id="s' + n + 'memo" rows="2">' + esc(s.memo || "") + "</textarea></label>" +
      '<label class="f">광고 관리자 캡처 (선택)<input type="file" id="s' + n + 'imgs" accept="image/png,image/jpeg,image/webp" multiple></label>' +
      '<div class="row"><button class="btn blue" type="submit" id="s' + n + 'run">' + (n === 2 ? "1차 점검하기" : "재확인하기") + '</button><button class="btn ghost" type="button" id="s' + n + 'stop" hidden>중지</button>' +
      '<button class="btn ghost" type="button" id="s' + n + 'toDash">매출 현황에 기록</button></div></form>' +
      '<div id="s' + n + 'Out" class="stack">' + (o.stages && o.stages["s" + n] ? savedBlock(o, "s" + n) : "") + "</div>";
  }
  function savedBlock(o, key) {
    var s = o.stages[key];
    if (!s) return "";
    return (s.html ? '<div class="stack">' + s.html + "</div>" : "") +
      (s.ai ? '<div class="panel stack ai-box"><div class="ai-head"><h3 class="sub">AI 재수정안 <span class="tag">' + esc(L.provLabel[s.provider] || "") + '</span></h3><span class="note">' + esc(new Date(s.at).toLocaleString("ko-KR")) + '</span></div><div class="ai-body">' + window.LabAI.md(String(s.ai).replace(/^\s*KEYWORDS\s*:.*$/gim, "")) + "</div></div>" : "");
  }

  /* ───────── 단계별 예시 미리보기 (샘플 입력 · 저장·AI 호출 없음) ───────── */
  var EX_AI = {
    1: "## 게시 가능 여부\n**수정 후 게시**: 캠페인 목표와 타깃 연령 2가지만 고치면 됩니다.\n## 재수정안\n1. 40대 운전자라면, 보험료 이 항목부터 확인하세요\n2. 운전자보험 갱신 전 3분 비교로 월 보험료가 달라집니다\n## 타깃 · 예산\n- 연령 30~60세, 광범위 타깃, 일예산 **39,000원** (목표 DB당 광고비의 3배)",
    2: "## 판정\n**수정 필요** — 소재 A는 끄고 B로 예산 이동\n## 원인\n- CTR 0.30%: 첫 화면에서 대상이 드러나지 않음\n## 재수정 소재\n1. [대상 호출] 50대 이상이라면 실비 청구, 이것부터 확인하세요\n## 다음 점검\n- 7일차까지 **DB당 광고비 12,957원 이하** 유지 여부",
    3: "## 판정\n**스케일** — 7일 순수익률 목표 구간 진입\n## 다음 7일\n- 일예산 하루 20%씩 증액, 2순위 채널(유튜브 쇼츠)에 같은 소재로 일 3만 원 테스트\n- 새 훅 2개 추가해 피로 대비"
  };
  function exampleBlock(o, n) {
    var eo = Object.assign({}, o, { payout: o.payout || 30000, approve: o.approve || 70, ageMin: o.ageMin || 30, ageMax: o.ageMax || 60 }), html;
    if (n === 1) {
      var f = { kind: "video", ratio: "16:9", sec: 45, goal: "traffic", head: "실비보험 보장분석 무료 이벤트", body: "무조건 보험료가 줄어듭니다", cta: "", budget: 10000,
        ageMin: 25, ageMax: 65, gender: "all", tmode: "interest", region: "", bid: "auto", interest: "보험, 재테크, 육아, 자동차, 건강", track: true, bridge: false, allowed: true, shimui: false, imgCount: 0 };
      html = render1Result(eo, review1(eo, f));
    } else {
      var m = n === 2 ? { spend: 90000, impr: 40000, clicks: 120, leads: 4, appr: "", freq: 1.6 } : { spend: 420000, impr: 210000, clicks: 2600, leads: 44, appr: 33, freq: 2.1 };
      var mm = metrics(eo, m), prev = n === 3 ? metrics(eo, { spend: 90000, impr: 40000, clicks: 120, leads: 4, appr: "" }) : null;
      var rows = n === 2 ? [{ name: "A 대상호출", spend: 60000, clicks: 70, leads: 0 }, { name: "B 숫자제시", spend: 30000, clicks: 50, leads: 4 }, {}] : [];
      html = renderMetrics(eo, mm, diagnose(eo, mm, n, prev), n) + creativeRows(eo, rows);
    }
    var has = o.stages && o.stages["s" + n] && o.stages["s" + n].html;
    return '<details class="example" id="opsEx"' + (has ? "" : " open") + '><summary><span class="exlabel">예시</span> ' + (n === 1 ? "게시 전 검토" : n === 2 ? "1차 점검" : "재확인") +
      ' 결과 미리보기 <span class="note">샘플 입력으로 만든 결과입니다. 위에서 검토·점검을 실행하면 내 결과가 나옵니다.</span></summary><div class="exbody stack">' + html +
      '<div class="panel stack exai"><div class="ai-head"><h3 class="sub">AI 재수정안 <span class="exlabel">AI 응답 예시</span></h3></div><div class="ai-body">' + window.LabAI.md(EX_AI[n]) + "</div></div></div></details>";
  }

  function renderSel() {
    var list = all();
    $("ckSel").innerHTML = list.length ? list.map(function (o) {
      var n = nextStep(o);
      return '<option value="' + esc(o.id) + '"' + (o.id === curId ? " selected" : "") + ">" + esc(o.name || "이름 없는 캠페인") + " · " + esc(L.chName[o.ch] || o.ch) + " · " + esc(n.label) + "</option>";
    }).join("") : '<option value="">등록된 캠페인이 없습니다</option>';
    $("ckSel").disabled = !list.length;
  }
  function renderDetail() {
    var o = curId && get(curId);
    if ($("ckSel")) renderSel();
    if (!o) {
      $("opsDetail").innerHTML = '<div class="panel empty-state"><b>점검할 캠페인이 없습니다.</b><p>5단계 캠페인 운영(시작)에서 캠페인을 등록하면 게시 전 검토 → 1차 점검 → 재확인을 여기서 진행합니다.</p><div class="row"><button class="btn blue sm" type="button" data-view="ops">캠페인 운영(시작)으로</button></div></div>';
      return;
    }
    var ch = L.chById(o.ch), cat = L.catById(o.cat), lim = limits(o);
    $("opsDetail").innerHTML =
      '<div class="panel stack ohead"><div class="row between"><div><span class="eyebrow">' + esc(ch ? ch.name : "") + (cat ? " · " + esc(cat.name) : "") + "</span><h3>" + esc(o.name) + '</h3></div><div class="row">' +
        '<button class="btn ghost sm" type="button" id="opEdit">정보 수정</button><button class="btn ghost sm danger" type="button" id="opDel">삭제</button></div></div>' +
        '<div class="facts">' + fact("단가 · 승인율", o.payout ? won(o.payout) + " · " + (o.approve || 70) + "%" : "미입력") + fact("DB당 광고비 한계", lim.has ? won(lim.hi) : "—") + fact("목표 DB당 광고비", lim.has ? won(lim.mid) : "—", "key") + fact("인정 연령", o.ageMin ? o.ageMin + "~" + o.ageMax + "세" : "제한 없음") + "</div>" +
        (o.fromPlan ? '<details><summary class="note">분석에서 가져온 셋팅안 보기</summary><pre class="planpre">' + esc(o.fromPlan) + "</pre></details>" : "") +
      "</div>" + stepHead(o) + '<div id="stageBody" class="stack">' + (curStage === 1 ? stage1Form(o) : metricForm(o, curStage)) + exampleBlock(o, curStage) + "</div>";
    bindStage(o);
  }

  function images(id) { var el = $(id); return el ? Array.prototype.slice.call(el.files || []) : []; }
  function runAI(o, key, out, prompt, imgs, runBtn, stopBtn, title) {
    var S = L.settings();
    var histId = L.hist.save({ kind: "ops", title: o.name + " · " + title, badge: L.chById(o.ch).short, excerpt: title, localHtml: out.innerHTML });
    var p = L.analyze.aiBlock(out, { prompt: prompt, images: imgs, urls: [], runBtn: runBtn, stopBtn: stopBtn, histId: histId });
    if (!p) return;
    p.then(function () {
      var h = L.hist.all().filter(function (x) { return x.id === histId; })[0];
      if (h && h.ai) patch(o.id, function (c) { c.stages = c.stages || {}; c.stages[key] = Object.assign({}, c.stages[key] || {}, { ai: h.ai, provider: S.provider, at: Date.now() }); });
    });
  }
  function bindStage(o) {
    document.querySelectorAll("#opsDetail .stepper [data-stage]").forEach(function (b) {
      b.addEventListener("click", function () { curStage = +b.dataset.stage; renderDetail(); });
    });
    $("opDel").addEventListener("click", function () {
      if ($("opDel").dataset.sure !== "1") { $("opDel").dataset.sure = "1"; $("opDel").textContent = "한 번 더 누르면 삭제"; return; }
      saveAll(all().filter(function (x) { return x.id !== o.id; })); curId = null; renderList(); renderDetail(); L.toast("캠페인을 삭제했습니다");
    });
    $("opEdit").addEventListener("click", function () { openNew(o); });
    if (curStage === 1) {
      var read1 = function () {
        return {
          kind: $("s1kind").value, ratio: $("s1ratio").value, sec: $("s1sec").value, goal: $("s1goal").value, head: $("s1head").value, body: $("s1body").value, cta: $("s1cta").value,
          budget: $("s1budget").value, ageMin: $("s1ageMin").value, ageMax: $("s1ageMax").value, gender: $("s1gender").value, tmode: $("s1tmode").value, region: $("s1region").value,
          bid: $("s1bid").value, interest: $("s1interest").value, track: $("s1track").checked, bridge: $("s1bridge").checked, allowed: $("s1allowed").checked, shimui: $("s1shimui").checked,
          imgCount: images("s1imgs").length
        };
      };
      $("s1Form").addEventListener("submit", function (e) {
        e.preventDefault();
        var f = read1(), r = review1(o, f), html = render1Result(o, r);
        o = patch(o.id, function (c) { c.stages = c.stages || {}; c.stages.s1 = { inputs: f, html: html, score: r.score, at: Date.now() }; if (f.head) c.head = f.head; });
        var out = $("s1Out"); out.innerHTML = html; if ($("opsEx")) $("opsEx").open = false;
        runAI(o, "s1", out, prompt1(o, f, r), images("s1imgs"), $("s1run"), $("s1stop"), "게시 전 검토");
        renderList();
      });
      $("s1conv").addEventListener("click", function () {
        var f = read1(), to = L.chById($("s1to").value), out = $("s1Out");
        if (L.settings().provider === "local") { L.toast("설정에서 AI 엔진을 켜면 채널 변환을 쓸 수 있습니다"); return; }
        var tmp = Object.assign({}, o, { ch: to.id });
        var prompt = "당신은 한국 퍼포먼스 광고 전문가입니다. 아래 " + L.chById(o.ch).short + "용 광고를 **" + to.name + "** 특성에 맞게 다시 만들어 주세요.\n\n[원래 소재] 첫 문장: " + f.head + " / 본문: " + f.body + " / CTA: " + f.cta + " / 종류 " + f.kind + " " + f.ratio +
          "\n\n[바꿀 채널 정보]\n" + chContext(tmp) + "\n\n다음 순서로:\n## " + to.short + "에 맞게 바꾼 이유 (채널 특성 3가지)\n## 재수정 소재 3안 (첫 문장·본문·CTA·화면 구성, 규격 명시)\n## 타깃·예산·입찰 권장값\n## 이 채널에서 피할 것" + AI_RULES;
        var h = document.createElement("div"); h.className = "stack"; out.prepend(h);
        L.analyze.aiBlock(h, { prompt: prompt, images: images("s1imgs"), urls: [], runBtn: $("s1conv"), stopBtn: $("s1convStop"),
          histId: L.hist.save({ kind: "ops", title: o.name + " · " + to.short + "용 변환", badge: to.short, excerpt: "채널 변환" }) });
      });
      $("s1go").addEventListener("click", function () {
        var day = $("s1launch").value; if (!day) { L.toast("게시일을 선택하세요"); return; }
        patch(o.id, function (c) { c.launch = day; });
        var t = timing(o.ch);
        L.toast("게시일을 저장했습니다. " + t[0] + "일차 1차 점검, " + t[1] + "일차 재확인 일정이 잡혔습니다");
        curStage = 2; renderList(); renderDetail(); L.emit("ops");
      });
    } else {
      var n = curStage;
      var readM = function () {
        var rows = [0, 1, 2].map(function (i) {
          var r = {};
          document.querySelectorAll('#s' + n + 'Form [data-r="' + i + '"]').forEach(function (inp) { r[inp.dataset.k] = inp.type === "number" ? (parseFloat(inp.value) || 0) : inp.value.trim(); });
          return r;
        });
        return { spend: $("s" + n + "spend").value, impr: $("s" + n + "impr").value, clicks: $("s" + n + "clicks").value, leads: $("s" + n + "leads").value,
          appr: $("s" + n + "appr").value, freq: $("s" + n + "freq").value, memo: $("s" + n + "memo").value, rows: rows };
      };
      $("s" + n + "Form").addEventListener("submit", function (e) {
        e.preventDefault();
        var f = readM();
        if (!+f.spend) { L.toast("광고비를 입력하세요"); return; }
        var m = metrics(o, f);
        var prev = n === 3 && o.stages && o.stages.s2 && o.stages.s2.inputs ? metrics(o, o.stages.s2.inputs) : null;
        var dg = diagnose(o, m, n, prev);
        var html = renderMetrics(o, m, dg, n) + creativeRows(o, f.rows);
        o = patch(o.id, function (c) { c.stages = c.stages || {}; c.stages["s" + n] = { inputs: f, html: html, verdict: dg.verdict[1], done: true, at: Date.now() }; });
        var out = $("s" + n + "Out"); out.innerHTML = html; if ($("opsEx")) $("opsEx").open = false;
        runAI(o, "s" + n, out, prompt23(o, n, m, dg, f.rows, f.memo, prev), images("s" + n + "imgs"), $("s" + n + "run"), $("s" + n + "stop"), n === 2 ? "1차 점검" : "재확인");
        renderList(); L.emit("ops");
      });
      $("s" + n + "toDash").addEventListener("click", function () {
        var f = readM();
        if (!+f.spend) { L.toast("광고비를 입력하세요"); return; }
        var m = metrics(o, f);
        var entries = L.store.get("entries", []).slice();
        entries.push({ id: Date.now().toString(36) + "o", date: d().ymd(d().today()), net: o.net || "etc", camp: o.name + (n === 2 ? " (1차 점검 누적)" : " (재확인 누적)"),
          ch: o.ch, spend: +f.spend, rev: Math.round(m.appr * (+o.payout || 0)), leads: +f.leads || 0, appr: Math.round(m.appr) });
        L.store.set("entries", entries); L.emit("entries");
        L.toast("매출 현황에 누적 기록으로 추가했습니다. 일별 기록과 겹치지 않게 확인하세요");
      });
    }
  }

  /* ───────── 새 캠페인 ───────── */
  var editing = null;
  function openNew(o) {
    editing = o ? o.id : null;
    var f = $("opsNewForm"); f.hidden = false;
    $("onName").value = o ? o.name : ""; $("onCh").value = o ? o.ch : "meta"; $("onCat").value = o ? (o.cat || "") : ""; $("onNet").value = o ? (o.net || "") : "";
    $("onPayout").value = o ? (o.payout || "") : ""; $("onApprove").value = o ? (o.approve || 70) : 70;
    $("onAgeMin").value = o && o.ageMin ? o.ageMin : ""; $("onAgeMax").value = o && o.ageMax ? o.ageMax : ""; $("onTerms").value = o ? (o.terms || "") : "";
    $("onSubmit").textContent = o ? "저장" : "등록하고 게시 전 검토 시작";
    f.scrollIntoView({ block: "start", behavior: "smooth" }); $("onName").focus();
  }
  function create(p) {
    var ageM = String(p.terms || "").match(/(\d{2})\s*(?:세)?\s*[~\-]\s*(\d{2})\s*세/);
    var o = { id: "op" + Date.now().toString(36), name: p.name || "새 캠페인", ch: p.ch || "meta", cat: p.cat || "", net: p.net || "", payout: +p.payout || 0, approve: +p.approve || 70,
      ageMin: +p.ageMin || (ageM ? +ageM[1] : 0), ageMax: +p.ageMax || (ageM ? +ageM[2] : 0), terms: p.terms || "", head: p.head || "", fromPlan: p.fromPlan || "",
      created: Date.now(), updated: Date.now(), launch: "", stages: {} };
    saveAll([o].concat(all()));
    curId = o.id; curStage = 1; filter = "active";
    if (L.flow) L.flow.patch({ opsId: o.id, platform: o.ch });
    L.show("check");
    L.toast("캠페인을 등록했습니다. 게시 전 검토부터 진행하세요");
    return o.id;
  }

  function init() {
    L.fillSelect($("onCh"), L.chOptions);
    L.fillSelect($("onCat"), D.categories.map(function (c) { return [c.id, c.name]; }), 1);
    L.fillSelect($("onNet"), D.networks.map(function (n) { return [n.id, n.name]; }), 1);
    $("opsNew").addEventListener("click", function () { openNew(null); });
    $("onCancel").addEventListener("click", function () { $("opsNewForm").hidden = true; });
    $("opsNewForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var p = { name: $("onName").value.trim(), ch: $("onCh").value, cat: $("onCat").value, net: $("onNet").value, payout: $("onPayout").value, approve: $("onApprove").value,
        ageMin: $("onAgeMin").value, ageMax: $("onAgeMax").value, terms: $("onTerms").value.trim() };
      if (!p.name) { L.toast("캠페인 이름을 입력하세요"); return; }
      $("opsNewForm").hidden = true;
      if (editing) {
        patch(editing, function (c) { c.name = p.name; c.ch = p.ch; c.cat = p.cat; c.net = p.net; c.payout = +p.payout || 0; c.approve = +p.approve || 70; c.ageMin = +p.ageMin || 0; c.ageMax = +p.ageMax || 0; c.terms = p.terms; });
        renderList(); renderDetail(); L.toast("저장했습니다");
      } else create(p);
    });
    $("opsFilter").addEventListener("click", function (e) { var b = e.target.closest("[data-of]"); if (b) { filter = b.dataset.of; renderList(); } });
    $("opsList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-op]"); if (!b) return;
      open(b.dataset.op);
    });
    $("opsDetail").addEventListener("click", function (e) {
      var b = e.target.closest("[data-copy],[data-kw]"); if (!b) return;
      if (b.dataset.copy != null) L.copyText(b.dataset.copy, "복사했습니다"); else L.goExplore(b.dataset.kw);
    });
    L.onShow.ops = renderList;
    L.onShow.check = function () {
      if (!curId || !get(curId)) { var first = all().map(function (o) { return { o: o, n: nextStep(o) }; }).filter(function (x) { return x.n.n < 4; })[0] || all().map(function (o) { return { o: o, n: nextStep(o) }; })[0]; curId = first ? first.o.id : null; if (first) curStage = Math.min(first.n.n, 3); }
      renderDetail();
    };
    $("ckSel").addEventListener("change", function () { if ($("ckSel").value) open($("ckSel").value); });
    document.addEventListener("click", function (e) { var b = e.target.closest("[data-ckgo]"); if (b) open(b.dataset.ckgo); });
    renderList();
  }

  function open(id) {
    var o = get(id); if (!o) return;
    curId = id; var n = nextStep(o).n; curStage = n > 3 ? 3 : n;
    if ($("check").hidden) L.show("check"); else renderDetail();
    renderList();
  }
  L.ops = { create: create, open: open, get: get, dueList: dueList, nextStep: nextStep, all: all };
  (L.extraInits = L.extraInits || []).push(init);
})();
