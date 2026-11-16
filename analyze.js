/* 광고 분석 · 랜딩 분석
   1) 규칙 기반 기본 분석을 즉시 보여 주고
   2) AI 엔진이 켜져 있으면 그 아래에 AI 심층 분석을 스트리밍합니다. */
(function () {
  "use strict";
  var L = window.Lab, D = L.D, $ = L.$, esc = L.esc, won = L.won, fmt = L.fmt, pct = L.pct;

  /* ───────── 공통 판별기 ───────── */
  function detectPlatform(url) {
    var u = String(url || "").toLowerCase();
    if (/youtube\.com\/shorts\//.test(u)) return { id: "youtube", ch: "youtube", name: "유튜브 쇼츠", format: "9:16 세로 · 60초 이하", look: ["첫 1초 자막과 얼굴", "반복 시청 유도(루프) 구조", "고정 댓글·설명란 링크"] };
    if (/youtube\.com\/watch|youtu\.be\//.test(u)) return { id: "youtube", ch: "youtube", name: "유튜브 동영상", format: "16:9 가로 · 인스트림/인피드", look: ["건너뛰기 전 5초 메시지", "화면 속 CTA 버튼과 컴패니언 배너", "설명형 전개 순서"] };
    if (/instagram\.com\/(reel|reels)\//.test(u)) return { id: "instagram", ch: "meta", name: "인스타그램 릴스", format: "9:16 세로 · 15~30초", look: ["위 14%·아래 20% 안전 영역", "커버 이미지 문구", "음원·트렌드 사운드 사용"] };
    if (/instagram\.com\/p\//.test(u)) return { id: "instagram", ch: "meta", name: "인스타그램 피드", format: "4:5 또는 1:1 · 이미지/캐러셀", look: ["첫 장의 헤드라인", "캐러셀 넘김 유도", "캡션 첫 줄"] };
    if (/tiktok\.com/.test(u)) return { id: "tiktok", ch: "tiktok", name: "틱톡", format: "9:16 세로 · 21~34초 권장", look: ["첫 2초 멈춤 장치", "말하는 얼굴 + 큰 자막", "댓글 반응과 스파크 광고 여부"] };
    if (/facebook\.com\/ads\/library/.test(u)) {
      var m = u.match(/[?&]id=(\d+)/);
      return { id: "metalib", ch: "meta", name: "Meta 광고 라이브러리" + (m ? " (ID " + m[1] + ")" : ""), format: "페북·인스타 전 지면", look: ["게재 시작일(30일+ 여부)", "'여러 버전' 표시", "같은 광고주의 다른 소재", "랜딩 URL"] };
    }
    if (/facebook\.com|fb\.watch|fb\.com/.test(u)) return { id: "facebook", ch: "meta", name: "페이스북 게시물", format: "4:5 피드 · 9:16 릴스", look: ["기본 문구 첫 125자", "댓글 반응", "공유 수"] };
    if (/kakao|daum\.net/.test(u)) return { id: "kakao", ch: "kakao", name: "카카오", format: "비즈보드 · 디스플레이", look: ["텍스트 2줄의 숫자·혜택", "오브젝트 이미지", "랜딩 유형(채널·비즈니스폼·외부)"] };
    return { id: "web", ch: "meta", name: "웹 페이지", format: "알 수 없음", look: ["광고 원본 지면을 확인하세요"] };
  }

  function detectCategory(text, fallback) {
    var t = String(text || "").toLowerCase(), best = null, bestN = 0;
    Object.keys(D.detect).forEach(function (id) {
      var n = D.detect[id].reduce(function (s, w) { return s + (t.indexOf(w.toLowerCase()) >= 0 ? 1 : 0); }, 0);
      if (n > bestN) { best = id; bestN = n; }
    });
    return fallback || best;
  }
  function detectNetwork(url) {
    var u = String(url || "").toLowerCase(), found = null;
    Object.keys(D.networkDomains).forEach(function (id) {
      if (!found && D.networkDomains[id].some(function (w) { return u.indexOf(w) >= 0; })) found = id;
    });
    return found;
  }

  function analyzeCopy(text) {
    var t = String(text || "").trim();
    var first = t.split(/\n|[.!?。]\s/)[0] || "";
    var r = {
      has: !!t, len: t.length, first: first,
      number: /\d/.test(t),
      callout: /(이라면|라면|분들|하시는 분|님들|님이라면|\d+\s?대|\d+\s?세|사장님|직장인|주부|부모님|운전자|신혼)/.test(first || t),
      question: /\?|나요|까요|인가요|있나요/.test(first),
      loss: /(손해|새고|놓치|모르면|후회|낭비|비싸게|폭탄|날리)/.test(t),
      review: /(후기|써보니|해보니|받아보니|달라진|솔직)/.test(t),
      adLabel: /(\[광고\]|#광고|유료광고|광고\s?포함|협찬)/.test(t),
      cta: D.ctaWords.filter(function (w) { return t.indexOf(w) >= 0; }),
      risks: D.riskWords.filter(function (w) { return t.indexOf(w) >= 0; })
    };
    r.hook = r.review ? "story" : r.callout ? "callout" : r.loss ? "loss" : r.question ? "question" : /(실수|하지 마|주의)/.test(t) ? "mistake"
      : /(비교|vs|차이)/i.test(t) ? "compare" : /무료/.test(t) ? "free" : r.number ? "number" : "";
    return r;
  }

  function linksBlock(keyword) {
    return '<div class="panel stack"><h3 class="sub">관련 광고 레퍼런스 더 찾기 <small class="muted">키워드: ' + esc(keyword) + "</small></h3>" +
      '<div class="launch">' + L.linkCards(L.refLinks(keyword).slice(0, 6)) + "</div></div>";
  }
  function checks(items) {
    return '<ul class="checks">' + items.map(function (i) { return '<li class="' + i[0] + '">' + i[1] + "</li>"; }).join("") + "</ul>";
  }
  function fact(label, value, key) { return '<div class="fact' + (key ? " key" : "") + '"><small>' + esc(label) + "</small><b>" + value + "</b></div>"; }

  /* ───────── 내 광고로 적용하기: 최종 셋팅안 ───────── */
  var CH_SETUP = {
    meta: { goal: "판매(전환) 또는 잠재 고객 목표", build: "ABO · 광고 세트 2개(광범위 / 관심사 비교) × 소재 3개", place: "자동 게재(릴스·피드·스토리)", track: "Meta 픽셀 + 전환 API" },
    kakao: { goal: "전환 목표 · 전환 최적화 입찰", build: "디스플레이로 소재 검증 → 이긴 카피만 비즈보드", place: "디스플레이 → 비즈보드", track: "카카오 픽셀 & SDK" },
    youtube: { goal: "디맨드젠 · 전환수 최대화", build: "광고 그룹 1개 × 세로·정사각·가로 영상 3종", place: "쇼츠 · 인피드 · 인스트림", track: "Google 태그(GA4 전환)" },
    tiktok: { goal: "웹사이트 전환 · 광범위 타깃", build: "광고 그룹 1개 × UGC 소재 3~5개", place: "인피드 (스파크 광고 권장)", track: "TikTok 픽셀 + 이벤트 API" },
    danggeun: { goal: "전문가 모드 · 지역 광고", build: "지역 2~3곳 × 소재 2개 비교", place: "홈 피드", track: "UTM 링크 (광고센터 전환 추적 지원 여부 확인)" },
    naver_gfa: { goal: "웹사이트 전환", build: "지면별 광고 그룹(메인·스마트채널·밴드) × 소재 2개", place: "지면 직접 선택", track: "네이버 전환 추적 스크립트" },
    naver_sa: { goal: "파워링크 · 키워드별 CPC 입찰", build: "세부 키워드 20~30개 × 문구 2종", place: "통합검색 · 모바일", track: "네이버 전환 추적 스크립트" },
    google_sa: { goal: "검색 캠페인 · 전환수 최대화", build: "구문·완전 일치 키워드 × 반응형 검색 광고 1개", place: "구글 검색", track: "Google 태그(GA4 전환)" },
    native: { goal: "클릭당 과금 · 기사형 소재", build: "제목 3종 × 썸네일 2종", place: "언론사 기사 하단", track: "UTM + 매체 스크립트" },
    blog: { goal: "무료 · 검색 유입", build: "질문형 글 주 3회", place: "네이버 통합검색·블로그 탭", track: "브릿지 페이지 UTM" },
    shorts: { goal: "무료 · 숏폼 오가닉", build: "같은 대본 3개 플랫폼 동시 업로드", place: "쇼츠 · 릴스 · 틱톡", track: "프로필 링크 UTM" }
  };
  var plans = {};
  function buildPlan(o) {
    var S = L.settings(), cat = o.cat, P = o.payout || 0, a = (o.approve || 70) / 100;
    var main = o.channels[0], sub = o.channels[1];
    var hi = L.maxCPL(P, a, S.marginMin / 100, S.wht), mid = L.maxCPL(P, a, (S.marginMin + S.marginMax) / 200, S.wht);
    var has = P > 0 && hi > 0;
    var r1k = function (v) { return Math.max(1000, Math.round(v / 1000) * 1000); };
    var daily = has ? Math.max(30000, r1k(mid * 2.5)) : 0, kill = has ? r1k(hi * 2) : 0;
    var ageM = String(o.terms || "").match(/(\d{2})\s*(?:세)?\s*[~\-]\s*(\d{2})\s*세/);
    var age = ageM ? ageM[1] + "~" + ageM[2] + "세 (캠페인 인정 연령)" : (cat ? cat.target : "캠페인 인정 연령 확인");
    var hookIds = [o.hook || "callout"].concat(["callout", "number", "loss", "question", "free"].filter(function (h) { return h !== o.hook; })).slice(0, 3);
    var creatives = cat ? hookIds.map(function (id, i) {
      var h = D.hooks.filter(function (x) { return x.id === id; })[0];
      return { name: (cat.keywords[0] + "_" + h.name + "_" + String.fromCharCode(65 + i)).replace(/\s+/g, ""), hook: h.name, line: L.fillHook(h.alts[i === 0 ? 0 : 1] || h.tpl, cat) };
    }) : [];
    var fmt = { meta: "9:16 릴스 15~30초 + 4:5 이미지", kakao: "텍스트 2줄 + 오브젝트 이미지", youtube: "쇼츠 9:16 30초 설명형", tiktok: "9:16 UGC 21~34초", danggeun: "동네 톤 이미지 + 짧은 제목", naver_gfa: "이미지형 + 스마트채널 짧은 문구", naver_sa: "제목·설명 문구", google_sa: "반응형 검색 광고", native: "기사형 제목 + 썸네일", blog: "정보형 글", shorts: "9:16 숏폼" }[main.id] || "지면 규격 확인";
    var su = CH_SETUP[main.id] || {};
    var id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    plans[id] = { o: o, creatives: creatives, main: main, payout: P };
    var money = function (v) { return has ? won(v) : "단가 입력 시 계산"; };
    var days = [
      ["D0", "브릿지 페이지 제작 + " + (su.track || "전환 추적") + " 설치, 소재 " + (creatives.length || 3) + "개 등록, 네트워크 허용 매체·무효 기준 재확인"],
      ["D1~3", "학습 기간: 예산·타깃 수정 금지. 소재별 지출이 " + money(kill) + "을 넘고 DB 0건이면 그 소재만 끄기"],
      ["D4", "중간 점검: DB당 광고비가 " + money(hi) + " 이하인 소재만 남기고, 클릭은 많은데 DB가 없으면 랜딩 문구 수정"],
      ["D5~7", "이긴 소재 일예산 20%씩 증액, 같은 구조로 훅만 바꾼 새 소재 2개 추가" + (sub ? ", " + sub.short + " 소액 테스트 시작" : "")],
      ["D8", "매출 현황에 7일 기록 확인 → AI 비서 주간 보고서로 유지·증액·중단 결정"]
    ];
    var html =
      '<div class="panel stack plan"><div class="plan-head"><h3>내 광고로 적용하기 · 최종 셋팅안</h3><span class="pill good">' + esc(main.short) + " 우선</span></div>" +
      '<p class="note">' + (o.kind === "ad" ? "분석한 레퍼런스의 구조를 빌려, 내 캠페인으로 더 나은 조건에서 시작하는 셋팅입니다." : "이 캠페인을 목표 순수익률 안에서 집행하기 위한 셋팅입니다.") + (has ? "" : " <b>CPA 단가를 넣으면 예산·끄기 기준 금액이 계산됩니다.</b>") + "</p>" +
      '<div class="plan-kpis">' +
        fact("DB당 광고비 한계 (순수익 " + S.marginMin + "%)", money(hi), true) +
        fact("목표 DB당 광고비", money(mid), true) +
        fact("테스트 일예산", money(daily)) + fact("7일 테스트 예산", money(daily * 7)) +
      "</div>" +
      '<div class="plan-sec"><h4><span>1</span>채널 · 캠페인</h4><div class="tablewrap"><table class="data"><tbody>' +
        "<tr><th>주 채널</th><td><b>" + esc(main.name) + "</b>" + (sub ? ' <span class="note">· 2순위 ' + esc(sub.short) + "</span>" : "") + "</td></tr>" +
        "<tr><th>캠페인 목표</th><td>" + esc(su.goal || "전환") + "</td></tr>" +
        "<tr><th>구조</th><td>" + esc(su.build || "") + "</td></tr>" +
        "<tr><th>타깃</th><td>" + esc(age) + " · 처음엔 넓게, 소재 첫 문장으로 대상을 부르기</td></tr>" +
        "<tr><th>지면 · 규격</th><td>" + esc((su.place || "") + " · " + fmt) + "</td></tr>" +
        "<tr><th>전환 추적</th><td>" + esc(su.track || "") + " (브릿지 페이지의 '신청' 클릭을 전환으로)</td></tr>" +
        (o.blocked && o.blocked.length ? '<tr><th>사용 금지</th><td class="neg">' + esc(o.blocked.join(", ")) + " — 캠페인 조건상 집행 불가</td></tr>" : "") +
      "</tbody></table></div></div>" +
      (creatives.length ? '<div class="plan-sec"><h4><span>2</span>소재 3개 (첫 문장 A/B/C 테스트)</h4><div class="hookout">' + creatives.map(function (c) {
        return '<div class="hook"><div><div class="row"><span class="tag blue">' + esc(c.hook) + '</span><span class="hookno">' + esc(c.name) + "</span></div><b>" + esc(c.line) + '</b></div><div class="hookbtns"><button class="btn ghost sm" type="button" data-copy="' + esc(c.line) + '">복사</button></div></div>';
      }).join("") + "</div></div>" : "") +
      '<div class="plan-sec"><h4><span>3</span>브릿지 페이지</h4><ul class="checks">' +
        '<li class="tip2">첫 줄은 <b>소재의 첫 문장과 같은 말</b>로 시작 (광고와 랜딩의 말이 같아야 신청률이 오릅니다)</li>' +
        '<li class="tip2">혜택 3줄 → 신청 버튼 → 네트워크 링크 순서. 폼은 네트워크 랜딩 것을 그대로 사용</li>' +
        '<li class="tip2">' + esc(su.track || "전환 추적") + " 설치 후 테스트 클릭으로 전환이 잡히는지 확인</li>" +
        (cat ? '<li class="no">피할 표현: ' + esc(cat.avoid) + "</li>" : "") +
      "</ul></div>" +
      '<div class="plan-sec"><h4><span>4</span>7일 테스트 일정</h4><div class="days">' + days.map(function (d) { return "<div><b>" + d[0] + "</b><span>" + esc(d[1]) + "</span></div>"; }).join("") + "</div></div>" +
      '<div class="plan-sec"><h4><span>5</span>판단 기준</h4><div class="rules">' +
        '<div class="rule off"><span class="pill off">끄기</span><span>소재별 지출 ' + money(kill) + " 이상 + DB 0건, 또는 3일 평균 DB당 광고비가 " + money(hi) + " 초과</span></div>" +
        '<div class="rule up"><span class="pill up">증액</span><span>3일 연속 DB당 광고비 ' + money(mid) + " 이하 → 하루 20%씩</span></div>" +
        '<div class="rule watch"><span class="pill watch">점검</span><span>승인율이 ' + Math.round(a * 100) + "%보다 10%p 이상 낮으면 타깃 연령·지역부터 좁히기</span></div>" +
      "</div></div>" +
      '<div class="row"><button class="btn blue sm" type="button" data-planops="' + id + '">이 셋팅안으로 캠페인 운영 시작 (3단계 점검)</button>' +
        '<button class="btn ghost sm" type="button" data-planlog="' + id + '">소재 3개를 테스트 기록에 등록</button>' +
        '<button class="btn ghost sm" type="button" data-plancopy="' + id + '">셋팅안 복사</button>' +
        '<button class="btn ghost sm" type="button" data-planch="' + esc(main.id) + '">' + esc(main.short) + " 셋팅 자세히</button></div></div>";
    plans[id].text = ["[내 광고 최종 셋팅안] " + (cat ? cat.name : ""), "주 채널: " + main.name + (sub ? " / 2순위: " + sub.short : ""),
      "목표: " + (su.goal || ""), "구조: " + (su.build || ""), "타깃: " + age, "추적: " + (su.track || ""),
      "DB당 광고비 한계: " + money(hi) + " / 목표: " + money(mid) + " / 일예산: " + money(daily) + " / 끄기: 소재별 " + money(kill) + " 지출 후 DB 0건",
      "소재:"].concat(creatives.map(function (c) { return "- " + c.name + ": " + c.line; })).concat(["일정:"]).concat(days.map(function (d) { return "- " + d[0] + " " + d[1]; })).join("\n");
    plans[id].summary = "주 채널 " + main.name + ", 목표 DB당 광고비 " + money(mid) + ", 일예산 " + money(daily) + ", 끄기 기준 소재별 " + money(kill);
    return { html: html, id: id };
  }
  function planClick(b) {
    var gone = function () { L.toast("저장된 기록에서는 이 버튼을 쓸 수 없습니다. 분석을 다시 실행하세요"); return true; };
    if (b.dataset.plancopy) { var p = plans[b.dataset.plancopy]; if (!p) return gone(); L.copyText(p.text, "셋팅안을 복사했습니다"); return true; }
    if (b.dataset.planlog) {
      var q = plans[b.dataset.planlog]; if (!q) return gone();
      if (!q.creatives.length) { L.toast("업종을 선택하면 소재를 등록할 수 있습니다"); return true; }
      L.addLogRows(q.creatives.map(function (c) { return { name: c.name, ch: q.main.id, spend: 0, leads: 0, appr: 0, payout: q.payout }; }));
      L.toast("수익 계산기의 테스트 기록에 소재 " + q.creatives.length + "개를 등록했습니다");
      return true;
    }
    if (b.dataset.planops) {
      var z = plans[b.dataset.planops]; if (!z) return gone();
      L.ops.create({ name: (z.o.cat ? z.o.cat.name + " · " : "") + z.main.short + " 캠페인", ch: z.main.id, cat: z.o.cat ? z.o.cat.id : "",
        payout: z.payout, approve: z.o.approve || 70, terms: z.o.terms || "", head: z.creatives[0] ? z.creatives[0].line : "", fromPlan: z.text });
      return true;
    }
    if (b.dataset.planch) { L.show("channels"); var t = document.querySelector('#chTabs [data-ch="' + b.dataset.planch + '"]'); if (t) t.click(); return true; }
    return false;
  }

  /* ───────── AI 실행 공통 ───────── */
  function aiBlock(out, opts) {
    var S = L.settings();
    if (S.provider === "local") {
      out.insertAdjacentHTML("beforeend", '<div class="panel stack"><h3 class="sub">AI 심층 분석</h3><p class="note">AI가 꺼져 있습니다. 설정에서 Claude 또는 Gemini를 켜면 반응이 좋은 이유, 구성 분해, 각색 대본, 채널별 전략과 최근 흐름까지 분석합니다.</p><div class="row"><button class="btn ghost sm" type="button" data-goto="settings">AI 설정 열기</button></div></div>');
      return null;
    }
    var box = document.createElement("div");
    box.className = "panel stack ai-box";
    box.innerHTML = '<div class="ai-head"><h3 class="sub">AI 심층 분석 <span class="tag blue">' + esc(L.provLabel[S.provider]) + "</span></h3>" +
      '<button class="btn ghost sm" type="button" data-copyai>결과 복사</button></div>' +
      '<div class="thinking"><span class="spin"></span><span>분석 중입니다. 링크를 열어 보고 검색하는 경우 1~2분 걸릴 수 있습니다…</span></div>' +
      '<div class="ai-body" hidden></div><div class="ai-kw row" hidden></div>';
    out.appendChild(box);
    var body = box.querySelector(".ai-body"), think = box.querySelector(".thinking"), kw = box.querySelector(".ai-kw");
    var raw = "", frame = 0;
    function paint() {
      frame = 0;
      var shown = raw.replace(/^\s*KEYWORDS\s*:.*$/gim, "").trim();
      body.innerHTML = window.LabAI.md(shown);
      body.hidden = !shown; think.hidden = !!shown;
    }
    box.querySelector("[data-copyai]").addEventListener("click", function () { L.copyText(raw, "AI 분석 결과를 복사했습니다"); });
    var ctl = new AbortController();
    opts.stopBtn.hidden = false; opts.runBtn.disabled = true;
    opts.stopBtn.onclick = function () { ctl.abort(); };
    return window.LabAI.run({
      provider: S.provider, settings: S, prompt: opts.prompt, images: opts.images, urls: opts.urls, signal: ctl.signal,
      onText: function (t) { raw = t; if (!frame) frame = requestAnimationFrame(paint); }
    }).then(function (t) {
      raw = t || raw; paint();
      if (opts.histId && L.hist) L.hist.update(opts.histId, { ai: raw, provider: S.provider });
      var m = raw.match(/KEYWORDS\s*:\s*(.+)$/im);
      if (m) {
        var words = m[1].split(/[,，·]/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 8);
        kw.innerHTML = '<span class="note">추천 검색어로 레퍼런스 찾기:</span>' + words.map(function (w) { return '<button class="chip" type="button" data-kw="' + esc(w) + '">' + esc(w) + "</button>"; }).join("");
        kw.hidden = !words.length;
      }
    }).catch(function (e) {
      think.hidden = true;
      if (e && e.code === "cancelled") { paint(); box.insertAdjacentHTML("beforeend", '<p class="note">분석을 중지했습니다.</p>'); return; }
      paint();
      if (opts.histId && L.hist && raw) L.hist.update(opts.histId, { ai: raw, provider: S.provider });
      box.insertAdjacentHTML("beforeend", '<div class="err"><b>AI 분석 실패.</b> ' + esc((e && e.message) || "알 수 없는 오류") + "</div>");
    }).then(function () {
      opts.stopBtn.hidden = true; opts.runBtn.disabled = false;
    });
  }

  function commonRules() {
    return [
      "- 한국어로, 실행 가능한 수준으로 구체적으로 쓴다. 숫자·기간·예산을 가능한 한 제시한다.",
      "- 확인하지 못한 수치(조회수, 성과, 단가 등)를 지어내지 않는다. 추정이면 '추정'이라고 쓴다.",
      "- 링크를 열 수 없으면 그 사실을 먼저 밝히고, 제공된 문구·캡처·메타데이터만으로 분석한다.",
      "- 경쟁 광고를 그대로 복제하지 말고 구조만 차용한다. 상표·저작권·초상권 위험을 피한다.",
      "- 보험·금융·건강·법률 광고의 심의, 공정위 추천·보증 심사지침(광고 표기), 매체 정책을 지키는 표현만 제안한다.",
      "- 마크다운 제목(##)과 글머리표로 정리하고, 가장 중요한 문장은 **굵게** 표시한다.",
      "- 맨 마지막 줄에 'KEYWORDS: 키워드1, 키워드2, …' 형식으로 레퍼런스 검색용 한국어 키워드 5~8개를 쓴다."
    ].join("\n");
  }

  /* ───────── 광고 분석 ───────── */
  function readAd() {
    return {
      urls: $("adUrl").value.split(/\s+/).map(function (s) { return s.trim(); }).filter(function (s) { return /^https?:\/\//i.test(s); }),
      copy: $("adCopy").value, images: Array.prototype.slice.call($("adImgs").files || []),
      days: L.num("adDays"), versions: L.num("adVersions"), views: L.num("adViews"), likes: L.num("adLikes"), comments: L.num("adComments"),
      mine: $("adMine").value, cat: $("adCat").value, payout: L.num("adPayout"), approve: L.num("adApprove") || 70
    };
  }
  /* e: 폼 제출 이벤트 · ex: 예시 미리보기용 입력(저장·AI 호출 없음) */
  function runAd(e, ex) {
    if (e) e.preventDefault();
    var f = ex || readAd();
    var urls = f.urls;
    if (!urls.length) { L.toast("http로 시작하는 광고 링크를 넣어 주세요"); return; }
    var copy = f.copy, images = f.images || [];
    var days = f.days, versions = f.versions, views = f.views, likes = f.likes, comments = f.comments;
    var plats = urls.map(detectPlatform), plat = plats[0];
    var catId = detectCategory(copy + " " + urls.join(" ") + " " + f.mine, f.cat);
    var cat = L.catById(catId);
    var c = analyzeCopy(copy);
    var er = views > 0 ? (likes + comments) / views : NaN;

    // 성과 신호 점수 (0~100)
    var sDays = Math.min(days / 60, 1) * 40, sVer = Math.min(Math.max(versions - 1, 0) / 4, 1) * 20;
    var sEng = isFinite(er) ? Math.min(er / 0.03, 1) * 20 : 0;
    var sCopy = c.has ? (c.number ? 5 : 0) + (c.callout ? 5 : 0) + (c.cta.length ? 5 : 0) + (c.risks.length ? 0 : 5) : 0;
    var total = Math.round(sDays + sVer + sEng + sCopy);

    var reasons = [];
    if (days >= 30) reasons.push(["ok", "<b>" + days + "일째 게재 중</b>: 광고주가 계속 돈을 쓰고 있다는 뜻입니다. 수익이 나는 소재일 가능성이 높습니다."]);
    else if (days > 0) reasons.push(["tip2", "게재 " + days + "일: 아직 테스트 단계일 수 있습니다. 2~3주 뒤 살아 있는지 다시 확인하세요."]);
    if (versions >= 3) reasons.push(["ok", "<b>버전 " + versions + "개</b>: 같은 구조로 문구·썸네일을 바꿔 가며 스케일 중입니다. 구조 자체가 검증된 포맷입니다."]);
    if (isFinite(er)) reasons.push([er >= 0.02 ? "ok" : "tip2", "참여율 " + pct(er) + " (좋아요+댓글 ÷ 조회수). " + (er >= 0.02 ? "평균 이상으로 반응이 좋습니다." : "반응보다 도달 위주로 성과를 내는 소재일 수 있습니다.")]);
    if (c.callout) reasons.push(["ok", "첫 문장에서 <b>대상을 직접 부릅니다</b>. 광범위 타깃에서도 알고리즘이 맞는 사람에게 보내도록 돕고, DB 승인율도 올립니다."]);
    if (c.number) reasons.push(["ok", "<b>구체적인 숫자</b>가 있어 스크롤을 멈추게 하고 클릭률을 올립니다."]);
    if (c.loss) reasons.push(["ok", "<b>손실 회피</b> 표현으로 '지금 확인해야 할 이유'를 만듭니다."]);
    if (c.question) reasons.push(["ok", "질문형 첫 문장으로 댓글·체류를 유도합니다."]);
    if (c.review && !c.adLabel) reasons.push(["no", "후기형인데 <b>광고 표기가 보이지 않습니다</b>. 각색할 때는 첫 부분에 '광고' 표기를 넣으세요."]);
    if (c.risks.length) reasons.push(["no", "심사 위험 표현: <b>" + c.risks.map(esc).join(", ") + "</b>. 그대로 따라 쓰면 반려되거나 계정 제재 위험이 있습니다."]);
    if (!c.has) reasons.push(["tip2", "광고 문구나 자막을 붙여넣으면 훅 유형·위험 표현까지 판별합니다."]);
    if (!days && plat.id === "metalib") reasons.push(["tip2", "광고 라이브러리에서 '게재 시작' 날짜와 버전 수를 확인해 입력하면 성과 신호 점수가 정확해집니다."]);

    var rewrites = "";
    if (cat) {
      var order = [c.hook || "callout"].concat(["callout", "number", "loss", "question", "free"].filter(function (h) { return h !== c.hook; })).slice(0, 4);
      rewrites = '<div class="hookout">' + order.map(function (id) {
        var h = D.hooks.filter(function (x) { return x.id === id; })[0]; if (!h) return "";
        var line = L.fillHook(h.tpl, cat);
        return '<div class="hook"><div><span class="tag blue">' + esc(h.name) + (id === c.hook ? " · 원본과 같은 구조" : "") + "</span><b>" + esc(line) + '</b></div><button class="btn ghost sm" type="button" data-copy="' + esc(line) + '">복사</button></div>';
      }).join("") + "</div>";
    } else rewrites = '<p class="note">업종을 선택하면 업종에 맞춘 각색 문구가 나옵니다.</p>';

    var variants = [
      ["Meta 릴스 · 인스타", "9:16, 첫 1.5초에 훅 자막. 위 14%·아래 20%는 비우고, 15~30초 안에 CTA."],
      ["Meta 피드", "4:5 이미지 1장 + 큰 글씨 한 줄. 기본 문구 첫 125자 안에 대상·혜택·CTA."],
      ["유튜브 쇼츠", "상담사·전문가 얼굴로 설명형 20~40초. 첫 문장은 검색어처럼('실비보험 청구 안 하면…')."],
      ["틱톡", "폰으로 찍은 UGC 톤, 음성 내레이션 필수. 7일마다 훅만 바꾼 새 버전 투입."],
      ["카카오 비즈보드", "텍스트 2줄(숫자+혜택) + 오브젝트 이미지. 40~60대 대상 업종에 우선."],
      ["당근 · 네이버 GFA", "동네·생활 톤의 이미지 1장 + 짧은 문구. '우리 동네', 지역명, 견적·혜택 숫자를 앞에."]
    ];

    var keyword = cat ? cat.keywords[0] : (c.first || "").split(/\s+/).slice(0, 2).join(" ") || "광고";
    var srcCh = L.chById(plat.ch) || D.channels[0];
    var planChs = [srcCh].concat((cat ? cat.channels : ["meta", "youtube", "kakao"]).map(L.chById).filter(function (x) { return x && x.id !== srcCh.id; }));
    var plan = buildPlan({ kind: "ad", cat: cat, channels: planChs, payout: f.payout, approve: f.approve, hook: c.hook, terms: "" });
    var out = ex ? ex.target : $("adOut");
    out.innerHTML =
      '<div class="panel stack result"><div class="row between"><h3 class="sub">기본 분석</h3><span class="tag">규칙 기반 · 즉시</span></div>' +
        '<div class="facts">' + fact("플랫폼", esc(plat.name)) + fact("포맷", esc(plat.format)) + fact("업종 추정", esc(cat ? cat.name : "판별 불가")) +
          fact("훅 유형", esc(L.hookName[c.hook] || "판별 불가")) + fact("성과 신호 점수", total + "점", true) + "</div>" +
        '<div class="scorebar" aria-hidden="true"><i style="width:' + total + '%"></i></div>' +
        '<p class="note">점수 = 게재 기간 40 + 버전 수 20 + 참여율 20 + 카피 요소 20. 입력한 정보가 많을수록 정확합니다.</p>' +
        "<h4>반응이 좋은 이유 (추정)</h4>" + checks(reasons) +
        "<h4>원본에서 꼭 확인할 것</h4>" + checks(plat.look.map(function (l) { return ["tip2", esc(l)]; })) +
        (c.has ? "<h4>카피 진단</h4>" + checks([
          [c.callout ? "ok" : "no", "대상 호출 " + (c.callout ? "있음" : "없음")],
          [c.number ? "ok" : "no", "숫자 " + (c.number ? "있음" : "없음")],
          [c.cta.length ? "ok" : "no", "CTA 단어 " + (c.cta.length ? esc(c.cta.join(", ")) : "없음")],
          [c.risks.length ? "no" : "ok", "위험 표현 " + (c.risks.length ? esc(c.risks.join(", ")) : "없음")],
          ["tip2", "글자 수 " + c.len + "자" + (c.len > 125 ? " · 피드 기본 문구는 125자 이후 잘립니다" : "")]
        ]) : "") +
      "</div>" +
      '<div class="panel stack"><h3 class="sub">내 소재로 각색하기' + (cat ? ' <small class="muted">' + esc(cat.name) + "</small>" : "") + "</h3>" + rewrites +
        '<h4>채널별 변형</h4><div class="criteria">' + variants.map(function (v) { return "<div><b>" + esc(v[0]) + "</b><span>" + esc(v[1]) + "</span></div>"; }).join("") + "</div></div>" +
      plan.html +
      linksBlock(keyword);

    if (ex) return;
    lastAd = { url: urls[0], channel: plat.ch, cat: catId || "", hook: c.hook || "", days: days, versions: versions || 1, note: (c.first || "").slice(0, 120) };

    var prompt = [
      "당신은 한국 CPA 제휴마케팅(DB 수집형·CPS)과 퍼포먼스 광고(Meta, 인스타그램, 유튜브, 틱톡, 카카오) 전문가입니다.",
      "아래 광고 레퍼런스를 분석해 제휴마케터가 매출 대비 순수익 " + L.settings().marginMin + "~" + L.settings().marginMax + "%를 목표로 자기 소재를 만들 수 있게 도와주세요.",
      "", "[광고 링크]", urls.join("\n"),
      "[플랫폼 판별] " + plats.map(function (p) { return p.name + " / " + p.format; }).join(" ; "),
      "[업종] " + (cat ? cat.name : "미정"),
      "[관찰 지표] 게재 " + (days || "미입력") + "일, 버전 " + (versions || "미입력") + "개, 조회수 " + (views || "미입력") + ", 좋아요 " + (likes || "미입력") + ", 댓글 " + (comments || "미입력"),
      "[광고 문구·자막]", copy || "(미입력)",
      "[내가 홍보할 캠페인] " + (f.mine || "(미입력)") + (f.payout ? " / CPA 단가 " + won(f.payout) + ", 예상 승인율 " + (f.approve || 70) + "%" : ""),
      "[내 셋팅안 초안] " + plans[plan.id].summary,
      images.length ? "[첨부 이미지] 광고 화면 캡처 " + images.length + "장" : "",
      "[기본 분석 결과] 성과 신호 점수 " + total + "점, 훅 유형 " + (L.hookName[c.hook] || "판별 불가") + (c.risks.length ? ", 위험 표현 " + c.risks.join(", ") : ""),
      "", "다음 순서로 답하세요:",
      "## 한 줄 요약",
      "## 이 광고의 도달·반응이 좋은 이유 (근거와 함께 5가지 이내)",
      "## 구성 분해 (0~3초 훅 / 전개 / 증거·신뢰 장치 / CTA / 편집·자막·사운드 / 랜딩 연결)",
      "## 추정 타깃과 매체 셋팅 (캠페인 목표, 타깃, 지면, 예산 규모 추정)",
      "## 각색 전략: 훅 5안, 본문 카피 2안, 15초 숏폼 대본 1개(초 단위)",
      "## 채널별 변형 (Meta 피드·릴스, 인스타, 유튜브 쇼츠, 틱톡, 카카오 비즈보드)",
      "## 심의·정책 위험과 대체 표현",
      "## 테스트 계획 (소재 수, 일예산, 끄기·증액 기준)",
      "## 내 광고로 적용하는 최종 셋팅안 (위 초안을 더 낫게: 주 채널·캠페인 목표·타깃·예산·소재 3개 문장·브릿지 페이지·전환 추적·7일 일정·끄기/증액 기준을 표와 숫자로. 원본보다 나은 점을 명시)",
      "", "규칙:", commonRules()
    ].filter(function (x) { return x !== ""; }).join("\n");

    var histId = L.hist ? L.hist.save({
      kind: "ad", title: (c.first || plat.name).slice(0, 80), url: urls[0], platform: plat.name, cat: catId || "",
      badge: "성과 신호 " + total + "점", excerpt: reasons.map(function (r) { return r[1].replace(/<[^>]+>/g, ""); }).slice(0, 2).join(" "),
      localHtml: out.innerHTML
    }) : null;
    aiBlock(out, { prompt: prompt, images: images, urls: urls, runBtn: $("adRun"), stopBtn: $("adStop"), histId: histId });
  }
  var lastAd = null;

  /* ───────── 랜딩 분석 ───────── */
  var CH_WORDS = {
    meta: /(페이스북|페북|인스타|메타|facebook|instagram|meta)/i,
    kakao: /(카카오|카톡|kakao)/i,
    youtube: /(유튜브|youtube|구글|google)/i,
    tiktok: /(틱톡|tiktok)/i,
    danggeun: /(당근|daangn|karrot)/i,
    naver_gfa: /(gfa|성과형\s?디스플레이|네이버\s?디스플레이|밴드\s?광고)/i,
    naver_sa: /(검색광고|파워링크|네이버\s?검색|키워드\s?광고)/i,
    google_sa: /(구글\s?검색|google\s?search|구글\s?ads)/i,
    native: /(네이티브|데이블|모비온|dable)/i,
    blog: /(블로그|blog)/i,
    shorts: /(오가닉|자체\s?계정|개인\s?계정|쇼츠\s?계정)/i
  };
  function channelRules(terms) {
    var res = {};
    String(terms || "").split(/[\n,\/·;]+/).forEach(function (clause) {
      Object.keys(CH_WORDS).forEach(function (id) {
        if (!CH_WORDS[id].test(clause)) return;
        if (/(불가|금지|제외|안\s?됨|x\b|ⅹ|×)/i.test(clause)) res[id] = "no";
        else if (/(허용|가능|ok|o\b|○)/i.test(clause)) res[id] = res[id] || "yes";
      });
    });
    return res;
  }

  function readLp() {
    return {
      name: $("lpName").value.trim(), url: $("lpUrl").value.trim(), text: $("lpText").value, terms: $("lpTerms").value,
      images: Array.prototype.slice.call($("lpImgs").files || []), net: $("lpNet").value, cat: $("lpCat").value,
      payout: L.num("lpPayout"), approve: L.num("lpApprove")
    };
  }
  function runLanding(e, ex) {
    if (e) e.preventDefault();
    var f = ex || readLp();
    var url = f.url;
    if (url && !/^https?:\/\//i.test(url)) { L.toast("링크는 http로 시작해야 합니다. 링크가 없으면 비워 두세요"); return; }
    var text = f.text || "", terms = f.terms || "", images = f.images || [];
    if (!url && !text && !f.payout && !f.cat) { L.toast("단가·업종·페이지 내용 중 하나 이상을 넣거나, 2단계에서 광고를 고르세요"); return; }
    var netId = f.net || detectNetwork(url);
    var catId = detectCategory(url + " " + text + " " + terms, f.cat);
    var cat = L.catById(catId);
    var S = L.settings();
    var P = f.payout, a = Math.min(100, Math.max(0, f.approve)) / 100;
    var forms = D.formWords.filter(function (w) { return text.indexOf(w) >= 0; });
    var ctas = D.ctaWords.filter(function (w) { return text.indexOf(w) >= 0; });
    var risks = D.riskWords.filter(function (w) { return text.indexOf(w) >= 0; });
    var rules = channelRules(terms);

    var lo = L.maxCPL(P, a, S.marginMax / 100, S.wht), hi = L.maxCPL(P, a, S.marginMin / 100, S.wht);
    var profitHtml;
    if (P > 0) {
      profitHtml = '<div class="facts">' +
        fact("DB당 최대 광고비 · 순수익 " + S.marginMin + "%", won(hi), true) +
        fact("DB당 최대 광고비 · 순수익 " + S.marginMax + "%", won(lo), true) +
        fact("승인 1건 기대 매출", won(P)) + fact("DB 1건 기대 매출", won(P * a)) + "</div>" +
        '<div class="tablewrap"><table class="data"><thead><tr><th>랜딩 신청률</th><th class="n">최대 CPC (' + S.marginMin + '%)</th><th class="n">최대 CPC (' + S.marginMax + "%)</th></tr></thead><tbody>" +
        [0.03, 0.05, 0.08, 0.12].map(function (r) { return "<tr><td>" + pct(r, 0) + '</td><td class="n">' + won(hi * r) + '</td><td class="n">' + won(lo * r) + "</td></tr>"; }).join("") +
        "</tbody></table></div>" +
        '<p class="note">광고비는 ' + (S.vat ? "부가세 포함" : "부가세 제외") + ", 정산금은 " + (S.wht ? "원천징수 3.3% 차감" : "원천징수 미반영") + " 기준입니다. 이 CPC 안에서 클릭을 살 수 있는 채널이 1순위입니다." +
        (hi <= 0 ? " <b class=\"neg\">현재 단가·승인율로는 목표 순수익률을 만들 수 없습니다.</b>" : "") + "</p>";
    } else profitHtml = '<p class="note">CPA 단가를 넣으면 목표 순수익률을 지키는 DB당 최대 광고비와 CPC 한계를 계산합니다.</p>';

    var mediaFit = {}; (D.media || []).forEach(function (m) { mediaFit[m.id] = m; });
    var chRank = D.channels.map(function (ch) {
      var pos = cat ? cat.channels.indexOf(ch.id) : -1;
      var m = mediaFit[ch.id];
      var sc = (pos >= 0 ? 6 - pos * 1.5 : 0) + (m && cat && m.fit.indexOf(cat.id) >= 0 ? 2 : 0) + (m && m.kind === "organic" ? -0.5 : 0);
      if (rules[ch.id] === "no") sc = -1;
      return { ch: ch, sc: sc };
    }).sort(function (x, y) { return y.sc - x.sc; });
    var ruleCls = { "끄기": "off", "지켜보기": "watch", "증액": "up", "교체": "swap" };
    var shown = chRank.filter(function (r) { return r.sc >= 0; }).slice(0, 4);
    var blocked = chRank.filter(function (r) { return r.sc < 0; });
    var rest = chRank.filter(function (r) { return r.sc >= 0; }).slice(4);
    var rankHtml = shown.map(function (r, i) {
      var c = r.ch;
      var label = i === 0 ? '<span class="pill good">1순위</span>' : i === 1 ? '<span class="pill good">2순위</span>' : i === 2 ? '<span class="pill warn">3순위</span>' : '<span class="pill none">보조</span>';
      return '<div class="panel stack"><div class="row between"><h3 class="sub">' + esc(c.name) + "</h3>" + label + "</div>" +
        "<p>" + esc(c.fit) + "</p>" +
        '<ol class="steps">' + c.structure.slice(0, 3).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
        '<div class="rules">' + c.rules.slice(0, 3).map(function (x) { return '<div class="rule"><span class="pill ' + (ruleCls[x[0]] || "swap") + '">' + esc(x[0]) + "</span><span>" + esc(x[1]) + "</span></div>"; }).join("") + "</div></div>";
    }).join("") +
      (rest.length || blocked.length ? '<div class="panel stack"><h3 class="sub">그 밖의 채널</h3>' +
        (rest.length ? '<p class="note">' + rest.map(function (r) { return esc(r.ch.short); }).join(" · ") + " — 채널 셋팅 메뉴에서 셋팅 방법을 확인하세요.</p>" : "") +
        (blocked.length ? '<p><span class="pill bad">사용 불가</span> ' + blocked.map(function (r) { return esc(r.ch.short); }).join(", ") + ' <span class="note">캠페인 조건상 집행하면 무효·정산 제외 위험이 있습니다.</span></p>' : "") + "</div>" : "");

    var lpChecks = [
      [netId ? "ok" : "tip2", "네트워크: " + (netId ? "<b>" + esc(L.netName[netId]) + "</b>" : "링크에서 판별 불가 (직접 선택하세요)")],
      [cat ? "ok" : "tip2", "업종: " + (cat ? "<b>" + esc(cat.name) + "</b> · 타깃 " + esc(cat.target) : "판별 불가 (직접 선택하세요)")],
      text ? [forms.length <= 4 ? "ok" : "no", "폼 항목 추정 " + forms.length + "개" + (forms.length ? " (" + esc(forms.join(", ")) + ")" : "") + (forms.length > 4 ? " · 항목이 많아 신청률이 낮을 수 있습니다. 브릿지 페이지에서 기대감을 먼저 만드세요." : "")] : ["tip2", "랜딩 문구를 붙여넣으면 폼 항목 수, CTA, 위험 표현을 판별합니다."],
      text ? [ctas.length ? "ok" : "no", "CTA 표현: " + (ctas.length ? esc(ctas.join(", ")) : "뚜렷하지 않음")] : null,
      text ? [risks.length ? "no" : "ok", "랜딩의 위험 표현: " + (risks.length ? "<b>" + esc(risks.join(", ")) + "</b> · 광고 소재에 옮겨 쓰지 마세요" : "없음")] : null,
      Object.keys(rules).length ? ["tip2", "캠페인 조건의 매체 규칙: " + Object.keys(rules).map(function (k) { return esc(L.chName[k]) + " " + (rules[k] === "no" ? "불가" : "허용"); }).join(", ")] : ["tip2", "캠페인 조건(허용 매체, 인정 연령, 무효 기준)을 넣으면 채널 추천에 반영합니다."]
    ].filter(Boolean);

    var keyword = cat ? cat.keywords[0] : "상담 신청";
    var plan = buildPlan({ kind: "landing", cat: cat, channels: shown.map(function (r) { return r.ch; }).concat(D.channels).filter(function (x, i, arr) { return arr.indexOf(x) === i && rules[x.id] !== "no"; }),
      payout: P, approve: a * 100, hook: "", terms: terms, blocked: blocked.map(function (r) { return r.ch.short; }) });
    var stIds = chRank.filter(function (r) { return r.sc >= 0 && L.studio && L.studio.has(r.ch.id); }).map(function (r) { return r.ch.id; }).slice(0, 6);
    var studioHtml = L.studio ? L.studio.block(stIds, { cat: catId || "", payout: P, approve: a * 100, terms: terms },
      { title: "플랫폼별 광고 제작 전략 · 최적화 셋팅", ranked: true, note: "추천 순서대로 매체 탭을 눌러 보세요. 매체마다 소재 포맷·장면 구성·카피와 광고 관리자에 넣을 예산·입찰·끄기 기준(VAT 제외)이 이 캠페인 단가로 계산되어 있습니다. '이 플랫폼으로 캠페인 운영 시작'을 누르면 3단계 점검으로 이어집니다." }) : "";
    var out = ex ? ex.target : $("lpOut");
    var top = chRank.filter(function (r) { return r.sc >= 0 && L.studio && L.studio.has(r.ch.id); });
    var issues = lpChecks.filter(function (c) { return c[0] === "no"; }).length;
    var ctxJson = esc(JSON.stringify({ cat: catId || "", payout: P, approve: a * 100, terms: terms }));
    var verdict = P > 0 ? (hi > 0 ? (hi >= 8000 ? ["good", "집행 여유 있음", "DB당 " + won(hi) + "까지 써도 순수익 " + S.marginMin + "%가 남습니다. 1순위 플랫폼부터 소액 테스트하세요."]
        : ["warn", "빠듯함", "DB당 한계가 " + won(hi) + "로 낮습니다. CPC가 싼 매체·소재로 신청률을 높여야 합니다."])
      : ["bad", "목표 불가", "현재 단가·승인율로는 목표 순수익률을 만들 수 없습니다. 단가가 더 높은 네트워크나 다른 캠페인을 고르세요."]) : ["none", "단가 미입력", "CPA 단가를 넣으면 수익 한계선을 계산합니다."];
    out.innerHTML =
      '<div class="panel stack result sumcard"><div class="row between"><h3 class="sub">핵심 요약' + (f.name ? ' <small class="muted">' + esc(f.name) + "</small>" : "") + '</h3><span class="pill ' + verdict[0] + '">' + esc(verdict[1]) + "</span></div>" +
        '<div class="facts">' + fact("DB당 최대 광고비 · 순수익 " + S.marginMin + "%", P > 0 ? won(hi) : "—", true) + fact("목표 DB당 광고비 · " + S.marginMax + "%", P > 0 ? won(lo) : "—", true) +
          fact("1순위 플랫폼", top[0] ? esc(top[0].ch.short) : "—") + fact("진단 경고", issues ? issues + "건" : "없음") + "</div>" +
        "<p>" + esc(verdict[2]) + "</p></div>" +
      '<div class="panel stack mkpick" data-stctx="' + ctxJson + '"><div class="row between"><h3 class="sub">추천 플랫폼 → 광고 만들기</h3><span class="note">누르면 4단계에서 그 플랫폼에 맞춘 제목·이미지·셋팅을 만듭니다</span></div>' +
        '<div class="mkchips">' + top.slice(0, 6).map(function (r, i) {
          return '<button class="mkchip' + (i === 0 ? " first" : "") + '" type="button" data-mkgo="' + r.ch.id + '"><span class="rk">' + (i + 1) + "</span><b>" + esc(r.ch.short) + "</b><small>" + esc((L.D.studio.filter(function (x) { return x.id === r.ch.id; })[0] || { formats: [[""]] }).formats[0][0]) + "</small></button>";
        }).join("") + "</div>" +
        (blocked.length ? '<p class="note"><span class="pill bad">사용 불가</span> ' + blocked.map(function (r) { return esc(r.ch.short); }).join(", ") + " — 캠페인 조건상 집행하면 무효·정산 제외 위험</p>" : "") + "</div>" +
      '<div class="panel stack"><h3 class="sub">캠페인 진단</h3>' + checks(lpChecks) +
        (cat ? '<div class="avoid"><b>피할 표현</b> ' + esc(cat.avoid) + "</div>" : "") + "</div>" +
      '<details class="panel stack more"><summary><b>자세한 분석 보기</b> <span class="note">수익 한계 표 · 채널별 셋팅 방향 · 플랫폼별 셋팅 · 7일 실행안 · 최근 흐름 · 레퍼런스</span></summary>' +
        '<div class="stack"><h3 class="sub">수익성 한계선</h3>' + profitHtml + "</div>" +
        (cat ? "<div><h4>추천 앵글</h4><p>" + cat.angles.map(esc).join(" · ") + "</p></div>" : "") +
        '<h3 class="sub">채널별 셋팅 방향</h3><div class="grid2">' + rankHtml + "</div>" +
        studioHtml +
        plan.html +
        '<div class="stack"><h3 class="sub">최근 흐름</h3><div class="criteria">' + D.trends.map(function (t) { return "<div><b>" + esc(t.k) + "</b><span>" + esc(t.v) + "</span></div>"; }).join("") + "</div></div>" +
        linksBlock(keyword) +
      "</details>";

    if (ex) return;
    lastLp = { payout: P, approve: a * 100 };
    if (L.flow) {
      var wv = { name: f.name || (cat ? cat.keywords[0] : "랜딩") + (netId ? " · " + L.netName[netId] : ""), net: netId || "", cat: catId || "", payout: P, approve: a * 100,
        media: terms, page: text, url: url, analyzed: true, best: top[0] ? top[0].ch.id : "" };
      if (L.flow.work()) L.flow.patch(wv); else L.store.set("work", Object.assign({ platform: "", made: false, opsId: "", at: Date.now() }, wv)), L.emit("work");
    }

    var prompt = [
      "당신은 한국 CPA 제휴마케팅(디비디비딥, 디비마켓, 디비센스, 텐핑, 애드팟 등 DB·CPA 네트워크)과 퍼포먼스 광고 전문가입니다.",
      "아래는 제휴 네트워크에서 발행한 광고 링크(머천트 랜딩)입니다. 이 캠페인으로 매출 대비 순수익 " + S.marginMin + "~" + S.marginMax + "%를 꾸준히 내는 광고 전략을 세워 주세요.",
      "링크를 열 수 있으면 직접 열어 상품, 혜택, 폼 항목, 유의사항을 확인하세요. 웹 검색이 가능하면 이 업종의 최근 광고 흐름과 경쟁 광고를 찾아 반영하고 출처를 밝히세요.",
      "", "[랜딩 URL] " + (url || "(없음 · 아래 페이지 내용으로 판단)"),
      "[네트워크] " + (netId ? L.netName[netId] : "미상"),
      "[업종 추정] " + (cat ? cat.name + " (기본 타깃: " + cat.target + ")" : "미상"),
      "[CPA 단가] " + (P ? won(P) : "미입력") + " / [예상 승인율] " + fmt(a * 100) + "%",
      P ? "[계산된 한계] DB당 최대 광고비: 순수익 " + S.marginMin + "% 기준 " + won(hi) + ", " + S.marginMax + "% 기준 " + won(lo) + " (광고비 " + (S.vat ? "VAT 포함" : "VAT 제외") + ", 원천징수 " + (S.wht ? "차감" : "미반영") + ")" : "",
      "[캠페인 조건] " + (terms || "(미입력)"),
      "[내 셋팅안 초안] " + plans[plan.id].summary,
      "[랜딩 문구]", text ? text.slice(0, 6000) : "(미입력)",
      images.length ? "[첨부 이미지] 랜딩 캡처 " + images.length + "장" : "",
      "", "다음 순서로 답하세요:",
      "## 캠페인 요약 (광고주·상품, 전환 조건, 폼 항목, 무효 위험)",
      "## 수익성 판단 (위 한계선을 기준으로 채널별로 현실적인 CPC·CPM 범위와 가능 여부)",
      "## 타깃 정의 (핵심 / 확장 / 제외 대상, 인정 연령 반영)",
      "## 채널별 전략 표 (" + stIds.map(function (id) { return L.chName[id]; }).join(", ") + ": 추천도, 캠페인 목표, 타깃, 소재 방향, 시작 일예산, 끄기·증액 기준)",
      "## 플랫폼별 광고 제작 전략 (위 표의 상위 3개 매체마다: 그 매체 특성에 맞춘 소재 포맷·규격, 장면/이미지 구성, 첫 문장 3안, 본문, CTA, 광고 관리자 셋팅 값(목표·입찰·예산·타깃·게재 위치))",
      "## 소재 아이디어 5개 (훅 문장 + 화면 구성 + CTA)",
      "## 브릿지 페이지·랜딩 개선 제안 (픽셀·전환 API 설치 포함)",
      "## 최근 흐름 (업종·매체 트렌드, 출처가 있으면 링크)",
      "## 관련 광고 레퍼런스 찾는 법 (Meta 광고 라이브러리·틱톡 Top Ads 검색어)",
      "## 위험 요소와 대응 (심의, 정책, 무효 DB)",
      "## 첫 2주 실행 계획 (일자별)",
      "## 내 광고 최종 셋팅안 (위 초안을 더 낫게: 주 채널·캠페인 목표·타깃·예산·소재 3개 문장·브릿지 페이지·전환 추적·끄기/증액 기준을 표와 숫자로)",
      "", "규칙:", commonRules()
    ].filter(function (x) { return x !== ""; }).join("\n");

    var histId = L.hist ? L.hist.save({
      kind: "landing", title: f.name || ((netId ? L.netName[netId] + " · " : "") + (cat ? cat.name : "랜딩") + (P ? " · 단가 " + won(P) : "")), url: url,
      platform: netId ? L.netName[netId] : "랜딩", cat: catId || "",
      badge: P > 0 ? "DB당 최대 " + won(hi) : "단가 미입력",
      excerpt: chRank.filter(function (r) { return r.sc > 0; }).map(function (r) { return r.ch.short; }).slice(0, 3).join(" → ") + " 순으로 추천",
      localHtml: out.innerHTML
    }) : null;
    aiBlock(out, { prompt: prompt, images: images, urls: url ? [url] : [], runBtn: $("lpRun"), stopBtn: $("lpStop"), histId: histId });
  }
  var lastLp = null;

  /* ───────── 예시 미리보기 (저장·AI 호출 없이 샘플 입력으로 그림) ───────── */
  var AD_EX_AI = [
    "## 한 줄 요약",
    "40대 운전자를 첫 문장에서 부르고 **'월 2만원'이라는 숫자로 스크롤을 멈추게 하는** 대상 호출 + 숫자형 광고입니다.",
    "## 도달·반응이 좋은 이유",
    "- 52일째 게재, 버전 5개: 광고주가 **예산을 늘리며 변형 테스트 중**인 검증된 구조",
    "- 첫 줄의 대상 호출이 광범위 타깃에서도 알고리즘이 맞는 연령에 보내도록 돕고 무효 DB를 줄임",
    "- '무료로 내 보험료 확인'처럼 부담 낮은 CTA",
    "## 각색 전략 (구조만 차용)",
    "1. 50대 이상 운전자라면, 이 특약 하나 빠져 있는지 확인해 보세요",
    "2. 운전자보험 갱신 전에 이것부터 비교하면 월 보험료가 달라집니다",
    "3. 15초 대본: 0~2초 대상 호출 자막 → 2~6초 흔한 실수 → 6~11초 비교 화면 → 11~15초 무료 확인 CTA",
    "## 테스트 계획",
    "- 훅 4개 × 일 3만 원 × 7일, **목표 CPA의 2배를 쓰고 DB 0건이면 끄기**",
    "- '무조건' 같은 위험 표현은 빼고 심의 받은 문구 범위 안에서 작성"
  ].join("\n");
  var LP_EX_AI = [
    "## 캠페인 요약",
    "실비보험 무료 보장분석 DB. 폼 4문항(이름·연락처·나이·상담 시간), **30~60세만 인정**, 카카오 집행 불가.",
    "## 채널별 전략",
    "| 채널 | 추천 | 시작 일예산 | 소재 방향 |",
    "|---|---|---|---|",
    "| Meta 릴스·피드 | 1순위 | 5만 원 | 40대 부모 대상 호출 + 월 보험료 숫자 |",
    "| 유튜브 쇼츠 | 2순위 | 3만 원 | 상담사 얼굴 설명형 30초 |",
    "| 네이버 GFA | 3순위 | 3만 원 | 보장 공백 점검 이미지형 |",
    "## 첫 2주 실행 계획",
    "- 1~3일: 브릿지 페이지 + 픽셀·전환 API 설치, 소재 6개 제작",
    "- 4~10일: **DB당 광고비 14,000원 이하 유지** 소재만 남기기",
    "- 11~14일: 이긴 소재 20% 증액, 새 훅 3개 투입"
  ].join("\n");
  function renderExamples() {
    var aiNote = function (md) {
      return '<div class="panel stack exai"><div class="ai-head"><h3 class="sub">AI 심층 분석 <span class="exlabel">AI 응답 예시</span></h3></div>' +
        '<div class="ai-body">' + window.LabAI.md(md) + "</div></div>";
    };
    runAd(null, {
      target: $("adExample"),
      urls: ["https://www.facebook.com/ads/library/?id=1234567890"],
      copy: "40대 이상 운전자라면 꼭 보세요. 운전자보험 하나 바꿨더니 월 2만원 줄었습니다. 무료로 내 보험료 확인하기",
      days: 52, versions: 5, views: 0, likes: 0, comments: 0, mine: "", cat: "insurance", payout: 30000, approve: 70
    });
    $("adExample").insertAdjacentHTML("beforeend", aiNote(AD_EX_AI));
    runLanding(null, {
      target: $("lpExample"),
      url: "https://example.com/campaign/insurance-analysis",
      text: "실비보험 무료 보장분석 이벤트. 이름 연락처 나이 상담 시간 입력 후 상담 신청",
      terms: "페이스북·인스타 허용, 카카오 불가, 30~60세만 인정",
      net: "dbdbdeep", cat: "insurance", payout: 30000, approve: 70
    });
    $("lpExample").insertAdjacentHTML("beforeend", aiNote(LP_EX_AI));
  }

  function hint(id, kind) {
    var S = L.settings(), el = $(id);
    var base = {
      local: "AI가 꺼져 있어 규칙 기반 분석만 나옵니다. 설정에서 AI 엔진을 켤 수 있습니다.",
      builtin: "내장 Claude는 링크를 직접 열지 못합니다. " + (kind === "ad" ? "광고 문구와 화면 캡처를" : "랜딩 문구와 캡처를") + " 함께 넣어야 정확합니다.",
      claude: "Claude API가 링크를 열어 보고 웹 검색으로 최근 흐름까지 반영합니다." + (S.web === false ? " (설정에서 웹 사용이 꺼져 있음)" : ""),
      gemini: "Gemini가 링크를 열어 보고 구글 검색을 반영합니다." + (kind === "ad" ? " 유튜브 링크는 영상을 직접 보고 분석합니다." : "") + (S.web === false ? " (설정에서 웹 사용이 꺼져 있음)" : "")
    };
    el.textContent = base[S.provider] || "";
  }

  function init() {
    L.fillSelect($("adCat"), L.D.categories.map(function (c) { return [c.id, c.name]; }), 1);
    L.fillSelect($("lpCat"), L.D.categories.map(function (c) { return [c.id, c.name]; }), 1);
    L.fillSelect($("lpNet"), L.D.networks.map(function (n) { return [n.id, n.name]; }), 1);
    $("adForm").addEventListener("submit", function (e) { runAd(e); $("adExWrap").open = false; });
    $("lpForm").addEventListener("submit", function (e) { runLanding(e); $("lpExWrap").open = false; });
    renderExamples();
    L.on("settings", renderExamples);
    $("adSave").addEventListener("click", function () {
      if (!lastAd) { L.toast("먼저 분석을 실행하세요"); return; }
      L.addToBoard(Object.assign({}, lastAd));
    });
    $("lpToCalc").addEventListener("click", function () {
      var P = L.num("lpPayout");
      if (!P) { L.toast("CPA 단가를 먼저 입력하세요"); return; }
      L.setCalc({ cPayout: P, cApprove: L.num("lpApprove") || 70 });
      L.show("calc");
    });
    // 결과 영역의 공통 버튼 (복사, 키워드 검색, 설정 이동)
    ["adOut", "lpOut", "adExample", "lpExample"].forEach(function (id) {
      $(id).addEventListener("click", function (e) {
        var pb = e.target.closest("[data-plancopy],[data-planlog],[data-planch],[data-planops]");
        if (pb && planClick(pb)) return;
        var b = e.target.closest("[data-copy],[data-kw],[data-goto]"); if (!b) return;
        if (b.dataset.copy != null) L.copyText(b.dataset.copy, "문구를 복사했습니다");
        else if (b.dataset.kw != null) L.goExplore(b.dataset.kw);
        else L.show(b.dataset.goto);
      });
    });
    L.onShow.adlab = function () { hint("adHint", "ad"); };
    L.onShow.landing = function () { hint("lpHint", "lp"); };
  }

  L.analyze = { aiBlock: aiBlock, commonRules: commonRules, detectPlatform: detectPlatform, planClick: planClick, analyzeCopy: analyzeCopy, detectCategory: detectCategory };
  (L.extraInits = L.extraInits || []).push(init);
})();
