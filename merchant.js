/* 1단계 머천트 조회 — 네트워크를 고르면 진행 중인 머천트를 점수순으로 보여 주고 TOP 10을 후보 리스트에 담습니다.
   목록 출처: ① 내가 붙여넣은 네트워크 실제 목록 ② AI 웹 조회 결과 ③ 둘 다 없으면 업종 대표 캠페인 예시 카탈로그.
   네트워크는 로그인 뒤에만 목록을 보여 주므로 자동 로그인 수집은 하지 않습니다(계정 정지·약관 위반 위험). */
(function () {
  "use strict";
  var L = window.Lab, D = L.D, $ = L.$, esc = L.esc, won = L.won, fmt = L.fmt;
  var CAT = D.catalog || { offers: [], nets: {}, sites: {} };
  var CHW = {
    meta: /(페이스북|페북|인스타|메타|facebook|instagram|meta|sns)/i, kakao: /(카카오|카톡|kakao)/i, youtube: /(유튜브|youtube)/i,
    tiktok: /(틱톡|tiktok)/i, danggeun: /(당근)/i, naver_gfa: /(gfa|성과형|밴드)/i, naver_sa: /(검색광고|파워링크|키워드)/i,
    google_sa: /(구글|google)/i, native: /(네이티브|데이블|모비온)/i, blog: /(블로그|blog)/i, shorts: /(쇼츠|릴스|오가닉)/i
  };
  function mine() { return L.store.get("merchants", []); }
  function saveMine(list) { L.store.set("merchants", list); }
  function picks() { return L.store.get("picks", []); }
  function savePicks(list) { L.store.set("picks", list); L.emit("picks"); }
  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(/[,\s원₩%]/g, "")); return isFinite(n) ? n : 0; }
  function key(m) { return (m.net || "") + "|" + String(m.name || "").replace(/\s+/g, ""); }
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }

  function mediaRules(text) {
    var res = {};
    String(text || "").split(/[\n,\/·;|]+/).forEach(function (cl) {
      Object.keys(CHW).forEach(function (id) {
        if (!CHW[id].test(cl)) return;
        res[id] = /(불가|금지|제외|x\b|×|안\s?됨)/i.test(cl) ? "no" : (res[id] || "yes");
      });
    });
    if (/(전체|모든\s?매체|제한\s?없)/.test(text || "")) Object.keys(CHW).forEach(function (id) { if (!res[id]) res[id] = "yes"; });
    return res;
  }

  /* 예시 카탈로그: 같은 캠페인 유형도 네트워크마다 단가·승인율·참여 수가 조금씩 다르게 */
  function catalog(net) {
    return (CAT.nets[net] || []).map(function (i) {
      var o = CAT.offers[i]; if (!o) return null;
      var h = hash(net + ":" + i);
      var pf = [0.9, 0.95, 1, 1.05, 1.1][h % 5], af = [-6, -3, 0, 2, 5][(h >> 3) % 5], qf = [0.55, 0.8, 1, 1.15, 1.35][(h >> 6) % 5];
      return { id: "cat-" + net + "-" + i, src: "sample", net: net, name: o.n, cat: o.c, payout: Math.round(o.p * pf / 500) * 500,
        approve: Math.max(30, Math.min(95, o.a + af)), pop: Math.round(o.pop * qf), media: o.m, page: o.pg, end: "", url: "" };
    }).filter(Boolean);
  }
  function listFor(net) {
    var own = mine().filter(function (m) { return (m.net || "") === net; });
    return own.length ? { items: own, src: own.some(function (m) { return m.src === "ai"; }) && !own.some(function (m) { return m.src !== "ai"; }) ? "ai" : "mine" } : { items: catalog(net), src: "sample" };
  }

  /* 내 최근 60일 실적: 기준 DB당 광고비와 가장 잘 버는 채널 */
  function myStats() {
    var S = L.settings(), vat = S.vat ? 1.1 : 1, t = L.dash.today(), from = L.dash.addDays(t, -59);
    var list = L.store.get("entries", []).filter(function (e) { return L.dash.parse(e.date) >= from; });
    var spend = 0, leads = 0, byCh = {};
    list.forEach(function (e) {
      spend += +e.spend || 0; leads += +e.leads || 0;
      var c = byCh[e.ch] = byCh[e.ch] || { rev: 0, cost: 0 }; c.rev += +e.rev || 0; c.cost += (+e.spend || 0) * vat;
    });
    var best = Object.keys(byCh).filter(function (k) { return byCh[k].rev > 0; }).sort(function (a, b) { return (byCh[b].rev - byCh[b].cost) - (byCh[a].rev - byCh[a].cost); })[0];
    var own = spend > 0 && leads >= 10;
    return { refCPL: own ? spend * vat / leads : (+S.refCPL || 10000), own: own, best: best || (S.mainCh || "meta"), camps: myByCamp() };
  }
  /* 내 정산 기록(최근 90일)에서 캠페인별 실제 승인율·손익 */
  function nk(x) { return L.importer ? L.importer.normName(x) : String(x || "").toLowerCase().trim(); }
  function myByCamp() {
    var S = L.settings(), vat = S.vat ? 1.1 : 1, wht = S.wht ? 0.033 : 0, from = L.dash.addDays(L.dash.today(), -89), out = {};
    L.store.get("entries", []).forEach(function (e) {
      if (!e.camp || L.dash.parse(e.date) < from) return;
      var k = nk(e.camp), o = out[k] = out[k] || { name: e.camp, leads: 0, appr: 0, rev: 0, cost: 0 };
      o.leads += +e.leads || 0; o.appr += +e.appr || 0; o.rev += (+e.rev || 0) * (1 - wht); o.cost += (+e.spend || 0) * vat;
    });
    return out;
  }
  function mine4(m, st) {
    var map = st.camps || {}, k = nk(m.name), hit = map[k];
    if (!hit && k.length >= 3) Object.keys(map).some(function (c) { if (c.length >= 3 && (c.indexOf(k) >= 0 || k.indexOf(c) >= 0)) { hit = map[c]; return true; } return false; });
    return hit || null;
  }
  function score(m, st) {
    st = st || myStats();
    var S = L.settings(), P = +m.payout || 0, ap = +m.approve || 0;
    var me = mine4(m, st), why0 = [];
    if (me && me.leads >= 10 && me.appr > 0) {
      var real = Math.round(me.appr / me.leads * 100);
      why0.push("내 실제 승인율 " + real + "% (DB " + me.leads + "건)" + (ap && Math.abs(real - ap) >= 10 ? " · 공지 " + ap + "%" : ""));
      ap = real;
    }
    var a = (ap || 70) / 100;
    var hi = L.maxCPL(P, a, S.marginMin / 100, S.wht);
    var rules = mediaRules(m.media), why = why0, sc = 0;
    // 1) 수익 여유 (최대 40점): 한계 DB당 광고비가 내 기준 DB당 광고비의 몇 배인가
    var room = st.refCPL > 0 ? hi / st.refCPL : 0;
    sc += Math.max(0, Math.min(room / 2, 1)) * 40;
    why.push(hi > 0 ? "DB당 한계 " + won(hi) + " (기준의 " + room.toFixed(1) + "배)" : "단가·승인율로는 목표 순수익률 불가");
    // 2) 승인율 (최대 12점) · 인기 (최대 8점)
    sc += ap ? Math.max(0, Math.min((ap - 50) / 40, 1)) * 12 : 6;
    if (ap >= 80) why.push("승인율 높음 " + ap + "%");
    sc += m.pop ? Math.min(+m.pop / 300, 1) * 8 : 3;
    if (+m.pop >= 250) why.push("참여 많음(인기)");
    // 3) 채널 궁합 (최대 24점)
    var allowed = Object.keys(rules).filter(function (k) { return rules[k] === "yes"; });
    if (rules[st.best] === "yes") { sc += 18; why.push("내 주력 " + L.chName[st.best] + " 허용"); }
    else if (rules[st.best] === "no") why.push("내 주력 " + L.chName[st.best] + " 불가");
    else if (!m.media) { sc += 8; why.push("허용 매체 미확인"); }
    sc += Math.min(allowed.length, 4) * 1.5;
    // 4) 위험 (감점)
    var cat = L.catById(m.cat) || L.catById(L.analyze.detectCategory(m.name + " " + (m.media || "")));
    if (cat && cat.check) { sc -= 6; why.push(cat.name + " 심의 필요"); }
    if (cat && cat.tier === 3) why.push("Tier 3 · 렌탈 등 Tier 1에서 경험을 쌓은 뒤 권장");
    if (ap && ap < 60) { sc -= 8; why.push("승인율 낮음"); }
    if (m.end) {
      var left = Math.round((L.dash.parse(m.end) - L.dash.today()) / 864e5);
      if (left < 0) { sc -= 40; why.push("마감 지남"); } else if (left <= 7) { sc -= 10; why.push("마감 " + left + "일 남음"); }
    }
    // 5) 단가 규모 (최대 16점): 소재 테스트 비용을 감당할 수 있는 단가
    sc += Math.min(P / 40000, 1) * 16;
    // 6) 내 실적 (가감): 실제로 돌려 본 머천트는 손익으로 판단
    if (me && me.cost > 0) {
      var pm = me.rev > 0 ? (me.rev - me.cost) / me.rev : -1;
      if (pm >= S.marginMin / 100) { sc += 8; why.push("내 실적 흑자 · 순수익률 " + Math.round(pm * 100) + "%"); }
      else if (pm < 0) { sc -= 12; why.push("내 실적 적자 " + won(me.rev - me.cost)); }
      else why.push("내 실적 순수익률 " + Math.round(pm * 100) + "% (목표 미만)");
    }
    if (hi > 0) why.push("첫 테스트 최대 손실 약 " + won(Math.round(hi * 2 * 3 / 1000) * 1000) + " (소재 3개 × 끄기 기준)");
    return { sc: Math.max(0, Math.min(100, Math.round(sc))), hi: hi, rules: rules, cat: cat, why: why };
  }
  function chips(rules) {
    return Object.keys(rules).map(function (k) { return '<span class="tag ' + (rules[k] === "yes" ? "hi" : "no") + '">' + (rules[k] === "no" ? "✕ " : "") + esc(L.chName[k]) + "</span>"; }).join(" ") || '<span class="note">허용 매체 미입력</span>';
  }

  /* ───────── 화면 ───────── */
  var net = null, shown = [];
  var TIER = {1:"Tier 1 입문",2:"Tier 2 중급",3:"Tier 3 고수익·심의"};
  var SRC = { sample: ["none", "예시 카탈로그"], mine: ["good", "내 실제 목록"], ai: ["warn", "AI 웹 조회"] };
  function renderNets() {
    $("mqNets").innerHTML = D.networks.map(function (n) {
      var own = mine().filter(function (m) { return m.net === n.id; }).length, pk = picks().filter(function (m) { return m.net === n.id; }).length;
      return '<button type="button" role="radio" data-net="' + n.id + '" aria-checked="' + (n.id === net) + '"><b>' + esc(n.name) + "</b><small>" + esc(n.model) + "</small>" +
        '<span class="nmeta">' + (own ? '<span class="tag hi">내 목록 ' + own + "</span>" : '<span class="tag">예시</span>') + (pk ? '<span class="tag blue">후보 ' + pk + "</span>" : "") + "</span></button>";
    }).join("");
    var S = L.settings();
    $("mqOpen").href = (S.netUrls && S.netUrls[net]) || CAT.sites[net] || "#";
  }
  function query() {
    L.store.set("mqNet", net);
    var st = myStats(), got = listFor(net), cat = $("mqCat").value, q = $("mqQ").value.trim(), sort = $("mqSort").value;
    var inPick = {}; picks().forEach(function (p) { inPick[key(p)] = 1; });
    var rows = got.items.filter(function (m) {
      var c = m.cat || L.analyze.detectCategory(m.name + " " + (m.media || ""));
      return (!cat || c === cat) && (!q || String(m.name).indexOf(q) >= 0);
    }).map(function (m) { return { m: m, r: score(m, st) }; });
    var by = { score: function (x) { return x.r.sc; }, approve: function (x) { return +x.m.approve || 70; }, pop: function (x) { return +x.m.pop || 0; }, payout: function (x) { return +x.m.payout || 0; } }[sort] || function (x) { return x.r.sc; };
    rows.sort(function (a, b) { return by(b) - by(a) || b.r.sc - a.r.sc; });
    shown = rows.slice(0, 10);
    var s = SRC[got.src];
    $("mqSrc").innerHTML = '<span class="pill ' + s[0] + '">' + s[1] + "</span> " + (got.src === "sample"
      ? esc(L.netName[net]) + "의 실제 목록을 아직 넣지 않아 업종 대표 캠페인 유형(" + esc(CAT.asOf || "") + " 기준 예시값)으로 순위를 보여 줍니다. 아래 <b>네트워크 실제 목록 넣기</b>로 붙여넣으면 내 목록으로 바뀝니다."
      : esc(L.netName[net]) + " 목록 " + got.items.length + "개 중 조건에 맞는 " + rows.length + "개를 점수로 정렬했습니다.");
    $("mqMeta").textContent = rows.length ? "· " + rows.length + "개 중 상위 " + shown.length + "개" : "";
    $("mcBase").innerHTML = "기준 DB당 광고비 <b>" + won(st.refCPL) + "</b> " + (st.own ? "(내 최근 60일 실적)" : "(실적이 쌓이기 전 가정값 · 설정 가능)") + " · 내 주력 채널 <b>" + esc(L.chName[st.best] || st.best) + "</b>";
    if (!shown.length) { $("mqList").innerHTML = '<p class="empty">조건에 맞는 머천트가 없습니다. 업종·검색어를 비우고 다시 조회하세요.</p>'; updAdd(); return; }
    $("mqList").innerHTML = shown.map(function (x, i) {
      var m = x.m, r = x.r, cls = r.sc >= 70 ? "good" : r.sc >= 45 ? "warn" : "bad", got = inPick[key(m)];
      return '<div class="mqrow' + (got ? " got" : "") + '" data-mid="' + esc(m.id) + '">' +
        '<label class="ck"><input type="checkbox" data-mq="' + esc(m.id) + '"' + (got ? " checked disabled" : "") + ' aria-label="' + esc(m.name) + ' 후보 선택"></label>' +
        '<span class="rk">' + (i + 1) + "</span>" +
        '<div class="nm"><b>' + esc(m.name) + "</b>" + (got ? ' <span class="tag blue">후보에 담김</span>' : "") +
          '<small>' + esc(L.netName[m.net] || m.net) + (r.cat ? " · " + esc(r.cat.name) + (r.cat.tier ? " · " + TIER[r.cat.tier] : "") : "") + (m.end ? " · 마감 " + esc(m.end) : "") + (m.src === "sample" ? " · 예시" : m.src === "ai" ? " · AI 조회" : "") + "</small>" +
          '<div class="chips">' + chips(r.rules) + "</div>" +
          '<small class="why">' + esc(r.why.join(" · ")) + "</small></div>" +
        '<dl class="nums"><div><dt>단가</dt><dd>' + won(+m.payout || 0) + "</dd></div><div><dt>승인율</dt><dd>" + (m.approve ? fmt(+m.approve) + "%" : "70%*") + "</dd></div>" +
          "<div><dt>DB당 한계</dt><dd>" + (r.hi > 0 ? won(r.hi) : '<span class="neg">불가</span>') + "</dd></div><div><dt>인기</dt><dd>" + (m.pop ? fmt(+m.pop) + "곳" : "—") + "</dd></div></dl>" +
        '<div class="sc"><span class="pill ' + cls + '">' + r.sc + '점</span><button class="btn ghost sm" type="button" data-mqgo="' + esc(m.id) + '">바로 분석</button></div></div>';
    }).join("");
    updAdd();
    renderNets();
  }
  function checked() { return Array.prototype.slice.call(document.querySelectorAll("#mqList [data-mq]:checked:not(:disabled)")).map(function (c) { return c.dataset.mq; }); }
  function updAdd() {
    var n = checked().length;
    $("mqAdd").disabled = !n;
    $("mqAdd").textContent = n ? "선택한 " + n + "개 후보 리스트에 추가" : "후보 리스트에 추가";
  }
  function snapshot(m) {
    var c = m.cat || L.analyze.detectCategory(m.name + " " + (m.media || ""));
    return { id: "pk" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), net: m.net, name: m.name, cat: c || "", payout: +m.payout || 0, approve: +m.approve || 0,
      pop: +m.pop || 0, media: m.media || "", end: m.end || "", url: m.url || "", page: m.page || "", src: m.src || "mine", added: Date.now() };
  }
  function byId(id) { return shown.map(function (x) { return x.m; }).filter(function (m) { return m.id === id; })[0]; }
  function addPicks(ids) {
    var list = picks(), have = {}, n = 0;
    list.forEach(function (p) { have[key(p)] = 1; });
    ids.forEach(function (id) { var m = byId(id); if (m && !have[key(m)]) { list.push(snapshot(m)); have[key(m)] = 1; n++; } });
    savePicks(list);
    query();
    L.toast(n ? "후보 리스트에 " + n + "개를 담았습니다 (전체 " + list.length + "개). 다른 네트워크도 조회해 담아 보세요" : "이미 담긴 머천트입니다");
  }

  /* 붙여넣기: 이름·단가·승인율·허용 매체·마감·참여·링크 열 자동 연결 */
  var COLS = [["name", /(캠페인|상품|머천트|광고명|이름|name|offer)/i], ["payout", /(단가|cpa|수익|금액|커미션|지급|payout)/i], ["approve", /(승인율|승인\s?률|approval)/i],
    ["media", /(매체|허용|채널|가능|media)/i], ["end", /(마감|종료|기한|end)/i], ["pop", /(참여|인기|진행\s?수|매체사|pop)/i], ["url", /(링크|url|주소|랜딩)/i], ["net", /(네트워크|플랫폼|network)/i]];
  function importText(text) {
    var t = L.importer.parseText(text);
    if (t.length < 2) { L.toast("머리글 줄과 캠페인 줄을 함께 붙여넣으세요"); return; }
    var h = t[0], idx = {};
    COLS.forEach(function (c) { for (var i = 0; i < h.length; i++) if (idx[c[0]] == null && c[1].test(h[i]) && Object.values(idx).indexOf(i) < 0) { idx[c[0]] = i; break; } });
    if (idx.name == null || idx.payout == null) { L.toast("캠페인 이름 열과 단가 열을 찾지 못했습니다. 머리글에 '캠페인', '단가'를 넣어 주세요"); return; }
    var list = mine().filter(function (m) { return !(m.net === net && m.src === "ai"); }), n = 0;
    t.slice(1).forEach(function (r) {
      var name = String(r[idx.name] || "").trim(); if (!name) return;
      var netGuess = idx.net != null ? (Object.keys(L.netName).filter(function (k) { return String(r[idx.net] || "").indexOf(L.netName[k]) >= 0; })[0] || net) : net;
      var url = idx.url != null ? String(r[idx.url] || "").trim() : "";
      list.push({ id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), src: "mine", name: name, net: netGuess, payout: num(r[idx.payout]),
        approve: idx.approve != null ? num(r[idx.approve]) : 0, media: idx.media != null ? String(r[idx.media] || "") : "", pop: idx.pop != null ? num(r[idx.pop]) : 0,
        url: /^https?:\/\//i.test(url) ? url : "", end: idx.end != null ? L.importer.toDate(r[idx.end]) : "", cat: "" });
      n++;
    });
    saveMine(list); query(); L.toast(L.netName[net] + " 목록 " + n + "개를 반영했습니다");
  }

  /* AI 웹 조회: 공개적으로 확인되는 진행 캠페인만, 모르는 값은 비워서 */
  var aiCtl = null;
  function aiQuery() {
    var S = L.settings();
    if (S.provider === "local") { L.toast("설정에서 웹 검색이 되는 AI(Claude API 또는 Gemini)를 켜세요"); L.show("settings"); return; }
    if (S.provider === "builtin") L.toast("claude.ai 내장 Claude는 웹 검색이 없어 결과가 부정확할 수 있습니다");
    var b = $("mqAi"); b.disabled = true; b.textContent = "AI가 찾는 중…";
    var prompt = [
      "한국 제휴마케팅 네트워크 '" + L.netName[net] + "'에서 지금 진행 중인 CPA·DB 캠페인(머천트)을 웹에서 찾아 주세요.",
      "공개 페이지·블로그·카페 후기 등에서 최근 3개월 안에 확인되는 것만 쓰고, 확인하지 못한 값은 null로 두세요. 절대 지어내지 마세요.",
      "JSON 배열만 출력하세요. 다른 말은 쓰지 마세요. 최대 15개.",
      '형식: [{"name":"캠페인명","payout":숫자 또는 null,"approve":승인율 숫자 또는 null,"media":"허용 매체 설명 또는 null","end":"YYYY-MM-DD 또는 null","url":"출처 링크","pop":null}]'
    ].join("\n");
    aiCtl = new AbortController();
    window.LabAI.run({ provider: S.provider, settings: S, prompt: prompt, signal: aiCtl.signal, onText: function () {} }).then(function (t) {
      var arr = parseJSON(t);
      if (!arr.length) throw new Error("AI가 확인된 캠페인을 찾지 못했습니다. 네트워크 실제 목록을 붙여넣어 주세요.");
      var list = mine().filter(function (m) { return !(m.net === net && m.src === "ai"); }), n = 0;
      arr.slice(0, 15).forEach(function (x) {
        if (!x || !x.name) return;
        list.push({ id: "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), src: "ai", net: net, name: String(x.name).slice(0, 60), payout: num(x.payout), approve: num(x.approve),
          media: x.media ? String(x.media) : "", end: x.end && /^\d{4}-\d{2}-\d{2}$/.test(x.end) ? x.end : "", url: /^https?:\/\//i.test(x.url || "") ? x.url : "", pop: num(x.pop), cat: "" });
        n++;
      });
      saveMine(list); query(); L.toast("AI가 찾은 캠페인 " + n + "개를 반영했습니다. 단가·승인율은 네트워크에서 꼭 확인하세요");
    }).catch(function (e) { if (!(e && e.code === "cancelled")) L.toast((e && e.message) || "AI 조회에 실패했습니다"); })
      .then(function () { b.disabled = false; b.textContent = "AI로 최신 진행 캠페인 찾기"; });
  }
  function parseJSON(t) {
    var s = String(t || ""), a = s.indexOf("["), b = s.lastIndexOf("]");
    if (a < 0 || b <= a) return [];
    try { var v = JSON.parse(s.slice(a, b + 1)); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  function init() {
    net = L.store.get("mqNet", D.networks[0].id);
    L.fillSelect($("mqCat"), D.categories.map(function (c) { return [c.id, c.name]; }), 1);
    $("mqNets").addEventListener("click", function (e) { var b = e.target.closest("[data-net]"); if (!b) return; net = b.dataset.net; renderNets(); query(); });
    $("mqRun").addEventListener("click", query);
    ["mqCat", "mqSort"].forEach(function (id) { $(id).addEventListener("change", query); });
    $("mqQ").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); query(); } });
    $("mqAi").addEventListener("click", aiQuery);
    $("mqList").addEventListener("change", updAdd);
    $("mqList").addEventListener("click", function (e) {
      var b = e.target.closest("[data-mqgo]"); if (!b) return;
      var m = byId(b.dataset.mqgo); if (m && L.flow) L.flow.start(snapshot(m));
    });
    $("mqAdd").addEventListener("click", function () { addPicks(checked()); });
    $("mcPasteBtn").addEventListener("click", function () { importText($("mcPaste").value); $("mcPaste").value = ""; });
    $("mcSample").addEventListener("click", function () {
      $("mcPaste").value = "캠페인\t단가\t승인율\t허용 매체\t마감\t참여\n실비보험 보장분석\t35000\t70\t페이스북, 인스타, 유튜브\t\t320\n정수기 렌탈 상담\t20000\t80\t카카오, 당근, 페이스북\t\t400\n개인회생 무료상담\t45000\t50\t페이스북 불가, 유튜브, 네이버 검색광고\t\t160\n국비 자격증 상담\t9000\t75\t전체 매체\t\t380";
    });
    $("mcClear").addEventListener("click", function () {
      var b = $("mcClear");
      if (b.dataset.sure !== "1") { b.dataset.sure = "1"; b.textContent = "한 번 더 누르면 비웁니다"; return; }
      saveMine(mine().filter(function (m) { return m.net !== net; })); b.dataset.sure = ""; b.textContent = "이 네트워크 내 목록 비우기"; query();
    });
    L.on("entries", function () { if (!$("merchant").hidden) query(); });
    L.on("settings", function () { if (!$("merchant").hidden) query(); });
    L.on("picks", function () { if (!$("merchant").hidden) renderNets(); });
    L.onShow.merchant = function () { renderNets(); query(); };
  }
  L.merchant = { score: score, mediaRules: mediaRules, myStats: myStats, picks: picks, savePicks: savePicks, catalog: catalog };
  (L.extraInits = L.extraInits || []).push(init);
})();
