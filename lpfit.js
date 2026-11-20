/* 랜딩 전환 5원칙 — 4단계 광고 제작
   ① 소재-랜딩 일치 ② 타깃 명확 ③ 혜택 2가지(왜 이것 · 왜 지금) ④ 심리장벽 해소 ⑤ 인지 부하 줄이기
   고른 제목·소제목과 3단계에 넣은 랜딩 내용을 비교해 점검하고, 랜딩 상단에 그대로 쓸 문구 세트를 만듭니다. */
(function () {
  "use strict";
  var L = window.Lab, $ = L.$, esc = L.esc;

  /* 왜 지금 신청해야 하는가 — 사실일 때만 쓰는 '지금'의 이유 (업종별) */
  var NOW = {
    insurance: ["갱신 전에 점검해야 다음 달 보험료부터 바뀝니다", "보장 공백은 사고가 난 뒤에는 메울 수 없습니다", "청구하지 않은 보험금은 청구 기한이 지나면 받기 어렵습니다"],
    rental: ["이번 달 사은품 조건은 광고주 사정에 따라 바뀔 수 있습니다", "지금 쓰는 제품 약정이 끝나기 전에 비교해야 손해가 없습니다", "설치 일정은 신청 순서대로 잡힙니다"],
    legal: ["연체가 길어질수록 선택할 수 있는 방법이 줄어듭니다", "독촉이 시작되기 전에 상담받는 것이 유리합니다", "상담은 무료라 확인만 해 봐도 손해가 없습니다"],
    startup: ["좋은 상권은 먼저 상담한 사람에게 먼저 안내됩니다", "이번 모집 조건(가맹비·지원 혜택)은 기간이 정해져 있습니다", "창업 설명회·상담 일정은 선착순으로 잡힙니다"],
    education: ["국비·지원 과정은 모집 기간이 끝나면 다음 기수까지 기다려야 합니다", "개강 전에 상담해야 일정에 맞춰 준비할 수 있습니다", "지원금 조건은 접수 시점 기준으로 적용됩니다"],
    telecom: ["약정이 끝난 뒤 그대로 두면 할인 없이 요금이 계속 나갑니다", "이번 달 가입 혜택(사은품·요금 할인)은 기간 한정입니다", "설치 희망일은 신청 순서대로 배정됩니다"],
    home: ["이사·시공 성수기에는 원하는 날짜가 먼저 마감됩니다", "견적은 무료라 미리 비교해 둘수록 유리합니다", "계약 전에 여러 견적을 받아야 추가 비용을 막을 수 있습니다"],
    health: ["이번 구성(체험가·사은품)은 준비된 수량까지만 진행됩니다", "꾸준히 쓰려면 지금 맞는 제품인지 먼저 확인하는 것이 좋습니다"],
    local: ["오픈·체험 이벤트는 기간과 인원이 정해져 있습니다", "원하는 시간대 수업은 먼저 신청한 순서로 마감됩니다"],
    medical: ["상담 예약은 원하는 날짜가 먼저 마감됩니다", "상담만 받아 보고 결정해도 됩니다"]
  };
  var NOW_ANY = ["이번 혜택은 광고주가 정한 기간 동안만 진행됩니다", "신청은 1분, 확인만 해 봐도 손해가 없습니다"];

  /* 심리장벽(불안) 해소 문구 — "사기 아냐?" "매일 전화 오는 거 아냐?" "중요한 걸 숨긴 거 아냐?" */
  var SAFE = [
    ["전화 폭탄 걱정", "신청하신 내용 확인을 위해 담당자가 1회 연락드립니다. 원치 않으면 바로 연락 중단을 요청할 수 있습니다."],
    ["가입·계약 강요 걱정", "상담은 무료이며 가입·계약 의무가 없습니다. 듣고 나서 천천히 결정하세요."],
    ["개인정보 걱정", "입력한 정보는 상담 목적으로만 쓰이며, 요청하면 언제든 삭제됩니다. (개인정보 처리방침 링크)"],
    ["숨은 조건 걱정", "비용·조건·유의사항을 신청 전에 모두 공개합니다. 추가 비용이 생기면 미리 안내합니다."],
    ["누가 운영하나 걱정", "운영사(광고주) 이름·사업자 정보·고객센터 번호를 페이지 하단에 공개합니다."]
  ];
  var SAFE_CAT = {
    legal: ["상담 내용 비밀 걱정", "상담 내용은 비밀이 보장되며, 가족·직장에 알려지지 않습니다. (광고주 확인 후 사용)"],
    insurance: ["기존 보험 해지 걱정", "분석만 받아 보셔도 됩니다. 기존 보험을 바꿀지는 결과를 보고 직접 결정합니다."],
    medical: ["의료 정보 걱정", "상담 예약만 진행되며, 진료·시술 여부는 의료진 상담 후 직접 결정합니다."],
    startup: ["수익 과장 걱정", "예상 매출이 아니라 실제 운영 조건(가맹비·인테리어·로열티)을 먼저 안내합니다."]
  };

  var STOP = ["매달", "매월", "정말", "진짜", "무료", "확인", "지금", "바로", "정리", "안내", "이것", "모르고", "하면", "하세요", "있어요", "드려요", "받아보세요", "분들", "많이", "물어보신"];
  function tokens(s) {
    return String(s || "").replace(/[\[\]()'"“”‘’!?,.·~…:]/g, " ").split(/\s+/).filter(function (w) {
      // 동사·형용사(나가는, 싶지, 모른다, 않으셨나요 등)는 빼고 명사 위주로
      return !/(는데|던|한지|른다|는다|나요|셨나요|싶지|않|지만|지요|어요|아요|해요|세요|습니다|ㅂ니다|니다|하는|되는|나가는|있는|없는)$/.test(w) && !/^(않|싶|모르|나가)/.test(w);
    }).map(function (w) {
      return w.replace(/(이라면|라면|에서|으로|에게|까지|부터|이면|하면|이고|입니다|은|는|이|가|을|를|에|의|도|로|과|와|만|요)$/, "");
    }).filter(function (w) { return w.length >= 2 && !/^\d+$/.test(w) && STOP.indexOf(w) < 0; });
  }
  function catOf(ctx) { return L.catById(ctx && ctx.cat) || null; }
  function targets(cat, ctx) {
    var list = cat ? String(cat.target).split(/[,·]/).map(function (x) { return x.trim(); }).filter(Boolean) : ["이 서비스가 필요한 분"];
    var age = ctx && ctx.age ? String(ctx.age) : "";
    var out = list.slice(0, 3).map(function (t) { var c = t.charCodeAt(t.length - 1) - 0xac00; return t + (c >= 0 && c <= 11171 && c % 28 ? "이라면" : "라면") + " 해당됩니다"; });
    if (age) out.unshift("만 " + age.replace(/\s/g, "") + "세라면 신청할 수 있습니다");
    return out.slice(0, 4);
  }
  function kit(ctx, title, sub) {
    var cat = catOf(ctx), now = (cat && NOW[cat.id]) || NOW_ANY;
    var benefit = cat ? String(cat.benefit).replace(/있다$/, "있습니다").replace(/는다$/, "습니다") : "조건을 무료로 확인할 수 있습니다";
    var safe = SAFE.slice(0, 4); if (cat && SAFE_CAT[cat.id]) safe = [SAFE_CAT[cat.id]].concat(safe.slice(0, 3));
    return {
      hero: title || (cat ? cat.keywords[0] + " 1분 무료 확인" : "1분 무료 확인"),
      heroSub: sub || benefit,
      targets: targets(cat, ctx),
      whyThis: [benefit, cat ? cat.number + "을(를) 숫자로 보여 주세요 (예: 평균 ○○원 절감)" : "혜택을 숫자 하나로 보여 주세요", cat ? cleanA(cat.angles[0]) + " · " + cleanA(cat.angles[1] || cat.angles[0]) : "다른 곳과 다른 점 1가지"],
      whyNow: now.slice(0, 3),
      safe: safe
    };
  }
  function cleanA(a) { return String(a || "").replace(/\(.*?\)/g, "").trim(); }

  /* 5원칙 점검: 제목·소제목 ↔ 랜딩 내용 */
  function audit(ctx, title, sub, page) {
    var cat = catOf(ctx), top = String(page || "").replace(/\s+/g, " ").slice(0, 220), all = String(page || "");
    var has = !!all.trim(), R = [];
    // ① 일치
    var tk = tokens(title).slice(0, 5), hit = tk.filter(function (w) { return top.indexOf(w) >= 0 || top.indexOf(w.slice(0, Math.max(2, w.length - 1))) >= 0; });
    var miss = tk.filter(function (w) { return hit.indexOf(w) < 0; });
    R.push({ no: 1, k: "소재-랜딩 일치", st: !has ? "none" : !tk.length ? "warn" : hit.length / tk.length >= 0.5 ? "good" : hit.length ? "warn" : "bad",
      msg: !has ? "3단계에 랜딩 내용을 넣으면 제목의 핵심 단어가 랜딩 첫 화면에 있는지 자동으로 봅니다." :
        !tk.length ? "제목에서 핵심 단어를 찾지 못했습니다. 대상·상품·혜택 단어가 들어간 제목을 고르세요." :
        hit.length / tk.length >= 0.5 ? "제목의 핵심 단어(" + hit.join(", ") + ")가 랜딩 첫 화면에 있습니다." :
        "랜딩 첫 화면에 제목의 핵심 단어 " + miss.map(function (w) { return "'" + w + "'"; }).join(", ") + "가 없습니다. 클릭한 이유가 바로 안 보이면 바로 이탈합니다.",
      fix: "랜딩(또는 브릿지) 맨 위 큰 글씨를 광고 제목과 같은 말로: \"" + (title || "광고 제목") + "\"" });
    // ② 타깃
    var tw = cat ? String(cat.target).split(/[,·\s]/).map(function (x) { return x.replace(/(을|를|이|가|의)$/, ""); }).filter(function (x) { return x.length >= 2; }) : [];
    var ageHit = /\d{2}\s*(~|-|대|세)/.test(top) || /(해당|대상|이런 분)/.test(top);
    var tHit = tw.filter(function (w) { return top.indexOf(w) >= 0; });
    R.push({ no: 2, k: "타깃 명확", st: !has ? "none" : ageHit || tHit.length ? "good" : "warn",
      msg: !has ? "랜딩 첫 화면에 '나도 해당되는지'가 바로 보이는지 확인합니다." : ageHit || tHit.length ? "첫 화면에 대상(" + (tHit.slice(0, 3).join(", ") || "연령·해당 여부") + ")이 보입니다." : "첫 화면에 '누구를 위한 것인지'가 없습니다. 좋은 혜택을 보고 들어와도 '나도 되나?'가 풀리지 않으면 떠납니다.",
      fix: "제목 바로 아래 '이런 분이라면 해당돼요' 체크 3줄 (아래 문구 세트)" });
    // ③ 혜택 2가지
    var nowHit = /(오늘|이번\s?달|이번 주|마감|선착순|한정|기간|까지|지금|조기|접수|개강|갱신|약정)/.test(all);
    var whyHit = /(\d|무료|절감|할인|지원|혜택|사은품|환급|비교)/.test(all);
    R.push({ no: 3, k: "혜택: 왜 이것 · 왜 지금", st: !has ? "none" : whyHit && nowHit ? "good" : whyHit || nowHit ? "warn" : "bad",
      msg: !has ? "'왜 이 상품인가'와 '왜 지금 신청해야 하나' 두 가지가 모두 있는지 봅니다." :
        whyHit && nowHit ? "왜 이 상품인지와 지금 신청할 이유가 모두 보입니다." :
        whyHit ? "'왜 이 상품'은 있지만 <b>'왜 지금'</b>이 없습니다. 대부분 여기서 놓칩니다. 지금 신청하면 받는 것, 미루면 놓치는 것을 써 주세요." :
        nowHit ? "'지금'의 이유는 있지만 혜택이 숫자로 보이지 않습니다." : "혜택과 지금 신청할 이유가 모두 약합니다.",
      fix: "버튼 바로 위에 '지금 신청하면' 1줄 · 단, 광고주 조건에 실제로 있는 기한·혜택만 쓰기" });
    // ④ 심리장벽
    var trust = (all.match(/(개인정보|처리방침|무료 상담|부담|강요|언제든|삭제|비밀|안심|후기|누적|인증|사업자|고객센터|1회|연락 중단|의무 없)/g) || []).length;
    R.push({ no: 4, k: "심리장벽 해소", st: !has ? "none" : trust >= 3 ? "good" : trust >= 1 ? "warn" : "bad",
      msg: !has ? "입력폼 근처에 불안('사기 아냐?', '전화 폭탄?', '숨긴 조건?')을 풀어 주는 문구가 있는지 봅니다." :
        trust >= 3 ? "안심 장치(" + trust + "개)가 있습니다." : "안심 장치가 " + trust + "개뿐입니다. 연락처를 남기기 직전에 불안이 가장 커집니다.",
      fix: "폼 바로 위·아래에 안심 문구 3개 (연락 횟수 · 강요 없음 · 개인정보 삭제)" });
    // ⑤ 인지 부하
    var issues = [], max = 30;
    if (String(title || "").length > max) issues.push("제목이 " + String(title).length + "자로 깁니다(" + max + "자 안팎)");
    if (!/\d/.test(String(title || "") + String(sub || ""))) issues.push("제목·소제목에 숫자가 없습니다(금액·기간·시간 하나)");
    if (String(sub || "").length > 40) issues.push("소제목이 40자를 넘습니다");
    if (has) {
      var sent = all.split(/[.!?\n。]/).map(function (x) { return x.trim(); }).filter(function (x) { return x.length > 4; });
      var avg = sent.length ? sent.reduce(function (a, x) { return a + x.length; }, 0) / sent.length : 0;
      if (avg > 45) issues.push("랜딩 문장이 평균 " + Math.round(avg) + "자로 깁니다(한 줄 30자 이내 권장)");
      var form = all.match(/폼\s*[:：]\s*([^\n]+)/);
      if (form && form[1].split(/[,·/]/).length > 4) issues.push("입력 항목이 " + form[1].split(/[,·/]/).length + "개입니다(4개 이하 권장)");
    }
    R.push({ no: 5, k: "인지 부하", st: issues.length === 0 ? "good" : issues.length === 1 ? "warn" : "bad",
      msg: issues.length ? issues.join(" · ") : "대충 훑어봐도 핵심이 보이는 길이와 구성입니다.",
      fix: "3초 구조: 큰 제목 → 대상 체크 3줄 → 혜택 숫자 1개 → 지금 이유 1줄 → 안심 3줄 → 버튼" });
    var pts = { good: 20, warn: 10, bad: 0, none: 10 };
    return { items: R, score: R.reduce(function (a, r) { return a + pts[r.st]; }, 0), checked: has };
  }

  var PILL = { good: ["good", "통과"], warn: ["warn", "보완"], bad: ["bad", "수정 필요"], none: ["none", "랜딩 내용 필요"] };
  function currentInputs() {
    var ctx = L.store.get("studio", {}) || {}, w = L.flow && L.flow.work ? L.flow.work() : null;
    return { ctx: ctx, title: ($("mkTitle") && $("mkTitle").value || "").trim(), sub: ($("mkSub") && $("mkSub").value || "").trim(), page: (w && w.page) || "" };
  }
  function setText(k) {
    return [
      "[랜딩 상단 · 소재와 같은 메시지]", k.hero, k.heroSub, "",
      "[이런 분이라면 해당돼요]"].concat(k.targets.map(function (x) { return "✔ " + x; }),
      ["", "[왜 이것 · 혜택]"], k.whyThis.map(function (x) { return "• " + x; }),
      ["", "[왜 지금 · 버튼 바로 위]"], k.whyNow.slice(0, 2).map(function (x) { return "• " + x; }),
      ["", "[안심하세요 · 폼 바로 위/아래]"], k.safe.slice(0, 3).map(function (x) { return "• " + x[1]; })).join("\n");
  }
  function render() {
    var box = $("stLp"); if (!box) return;
    var I = currentInputs(), a = audit(I.ctx, I.title, I.sub, I.page), k = kit(I.ctx, I.title, I.sub);
    var cls = a.score >= 80 ? "good" : a.score >= 50 ? "warn" : "bad";
    box.innerHTML =
      '<div class="row between"><h3 class="sub">랜딩 전환 5원칙 점검 <small class="muted">클릭한 이유가 랜딩에서 바로 이어지는가</small></h3><span class="pill ' + cls + '">' + a.score + "점" + (a.checked ? "" : " · 랜딩 미입력") + "</span></div>" +
      '<div class="lp5">' + a.items.map(function (r) {
        var p = PILL[r.st];
        return '<div class="lp5i ' + r.st + '"><div class="row between"><b>' + r.no + ". " + esc(r.k) + '</b><span class="pill ' + p[0] + '">' + p[1] + "</span></div><p>" + r.msg + '</p><small>→ ' + esc(r.fix) + "</small></div>";
      }).join("") + "</div>" +
      '<h4>랜딩 상단에 그대로 쓸 문구 세트</h4>' +
      '<div class="lpkit">' +
        '<div><b>① 첫 화면 (광고 제목과 같은 말)</b><p class="big">' + esc(k.hero) + "</p><p>" + esc(k.heroSub) + "</p></div>" +
        "<div><b>② 이런 분이라면 해당돼요</b><ul>" + k.targets.map(function (x) { return "<li>✔ " + esc(x) + "</li>"; }).join("") + "</ul></div>" +
        "<div><b>③ 왜 이것 · 왜 지금</b><ul>" + k.whyThis.slice(0, 2).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + k.whyNow.slice(0, 2).map(function (x) { return '<li class="now">⏰ ' + esc(x) + "</li>"; }).join("") + "</ul></div>" +
        "<div><b>④ 안심하세요 (폼 근처)</b><ul>" + k.safe.slice(0, 3).map(function (x) { return "<li><small>" + esc(x[0]) + "</small> " + esc(x[1]) + "</li>"; }).join("") + "</ul></div>" +
      "</div>" +
      '<p class="note">⏰ \'왜 지금\'은 광고주 조건에 실제로 있는 기한·수량·혜택만 쓰세요. 없는 마감을 만들면 허위·과장 광고가 되고 승인율도 떨어집니다. 안심 문구 중 연락 횟수·비밀 보장은 광고주 정책과 같은지 확인 후 쓰세요.</p>' +
      '<div class="row"><button class="btn ghost sm" type="button" id="lpCopy">문구 세트 복사</button><button class="btn ghost sm" type="button" data-view="landing">3단계 랜딩 내용 고치기</button></div>';
    $("lpCopy").addEventListener("click", function () { L.copyText(setText(k), "랜딩 문구 세트를 복사했습니다"); });
  }
  var t = null;
  function soon() { clearTimeout(t); t = setTimeout(render, 120); }
  function init() {
    document.addEventListener("input", function (e) { if (e.target && (e.target.id === "mkTitle" || e.target.id === "mkSub")) soon(); });
    document.addEventListener("change", function (e) { if (e.target && (e.target.name === "mkT" || e.target.name === "mkS" || /^st/.test(e.target.id || ""))) soon(); });
    L.on("work", soon);
  }
  L.lpfit = { kit: kit, audit: audit, render: render, tokens: tokens, NOW: NOW, SAFE: SAFE };
  (L.extraInits = L.extraInits || []).push(init);
})();
