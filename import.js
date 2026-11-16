/* 기록 가져오기
   - 정산(네트워크): 리포트 표 붙여넣기 / CSV·엑셀 → 날짜·캠페인·DB·승인·대기·수익
   - 광고비(매체): Meta·카카오·구글·틱톡 광고 관리자 보고서 → 날짜·캠페인·지출
   같은 날짜·캠페인 기록은 해당 값만 갱신하고, 단가가 전보다 떨어진 캠페인은 경고합니다.
   (로그인 정보를 저장하거나 네트워크 사이트에 자동 접속하지 않습니다) */
(function () {
  "use strict";
  var L = window.Lab, $ = L.$, esc = L.esc, won = L.won, fmt = L.fmt;
  var XLSX_URL = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";

  var FIELDS = [
    ["date", "날짜"], ["camp", "캠페인"], ["leads", "DB 신청"], ["appr", "승인(확정)"], ["pend", "확정 대기"],
    ["rev", "수익(정산)"], ["spend", "광고비(지출)"]
  ];
  /* 필드마다 우선순위 패턴을 차례로 적용해 가장 그럴듯한 열 하나를 고릅니다 */
  var PRIORITY = [
    ["date", [/(날짜|일자|date|day|보고\s?시작|reporting\s?starts)/i, /(기간|일시)/i]],
    ["spend", [/(광고비|지출|amount\s?spent|spend|비용\s?\(|cost)/i, /(비용|소진)/i]],
    ["pend", [/(대기|미확정|보류|심사|pending)/i]],
    ["appr", [/(승인|확정|approved|confirm)/i, /(유효|인정|valid)/i]],
    ["leads", [/(db|디비)/i, /(접수|신청|lead|유입|참여|전환|결과|results)/i]],
    ["rev", [/(정산|수익|수수료|커미션|commission|payout|revenue)/i, /(금액|매출|적립|포인트)/i]],
    ["camp", [/(캠페인\s?이름|campaign\s?name|캠페인|campaign|광고명|상품|머천트|offer)/i, /(광고\s?세트|광고\s?그룹|프로모션|광고)/i]]
  ];
  var rows = [], header = [], map = {};

  /* ── 파싱 ── */
  function splitLine(line, delim) {
    if (delim === "\t") return line.split("\t");
    if (delim === ",") {
      var out = [], cur = "", q = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
        else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
      }
      out.push(cur); return out;
    }
    return line.split(/\s{2,}/);
  }
  function parseText(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n").filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var sample = lines.slice(0, 5).join("\n");
    var delim = sample.indexOf("\t") >= 0 ? "\t" : (sample.match(/,/g) || []).length >= lines.slice(0, 5).length ? "," : "  ";
    return lines.map(function (l) { return splitLine(l, delim).map(function (c) { return c.trim(); }); });
  }
  function isHeader(r) {
    var textish = r.filter(function (c) { return c && !/^[\d,.\-/\s원%₩:]+$/.test(String(c)); }).length;
    return textish >= Math.max(2, Math.ceil(r.length / 2)) && PRIORITY.some(function (f) { return r.some(function (c) { return f[1].some(function (re) { return re.test(String(c)); }); }); });
  }
  function num(v) {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    var n = parseFloat(String(v).replace(/[,\s원₩건개]/g, ""));
    return isFinite(n) ? n : 0;
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  /* 연도가 없는 날짜(09-28)는 올해로 두되, 오늘보다 2일 넘게 미래면 작년으로 봅니다 (1월에 12월 리포트) */
  function toDate(v, now) {
    if (v == null || v === "") return "";
    now = now || new Date();
    if (typeof v === "number" && v > 30000 && v < 80000) { // 엑셀 날짜 일련번호
      var dt = new Date(Math.round((v - 25569) * 864e5));
      return dt.getUTCFullYear() + "-" + pad(dt.getUTCMonth() + 1) + "-" + pad(dt.getUTCDate());
    }
    var s = String(v).trim(), m;
    if ((m = s.match(/(20\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/))) return m[1] + "-" + pad(+m[2]) + "-" + pad(+m[3]);
    if ((m = s.match(/^(20\d{2})(\d{2})(\d{2})$/))) return m[1] + "-" + m[2] + "-" + m[3];
    if ((m = s.match(/^(\d{1,2})[.\-/월\s]+(\d{1,2})/))) {
      var y = now.getFullYear(), d = new Date(y, +m[1] - 1, +m[2]);
      if (d - now > 2 * 864e5) y -= 1;
      return y + "-" + pad(+m[1]) + "-" + pad(+m[2]);
    }
    return "";
  }
  function autoMap(h) {
    var m = {}, used = {};
    PRIORITY.forEach(function (f) {
      for (var pi = 0; pi < f[1].length && m[f[0]] == null; pi++) {
        for (var i = 0; i < h.length; i++) {
          var t = String(h[i]);
          if (used[i] || !f[1][pi].test(t)) continue;
          if (f[0] === "leads" && /(승인|확정|대기)/.test(t)) continue;
          if (f[0] === "appr" && /(대기|미확정)/.test(t)) continue;
          if (f[0] === "camp" && /(광고비|비용|지출)/.test(t)) continue;
          if (f[0] === "spend" && /(단가|당\s?비용|per|cpc|cpm|cpa)/i.test(t)) continue;
          m[f[0]] = i; used[i] = 1; break;
        }
      }
    });
    return m;
  }
  /* 캠페인 이름 비교용: 공백·대소문자·괄호 꾸밈 차이를 무시 */
  function normName(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/[\[\]()·_\-]/g, " ").replace(/\s+/g, " ").trim(); }

  function load(table) {
    table = table.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
    if (!table.length) { $("impMsg").textContent = "읽을 수 있는 표가 없습니다."; $("impMap").innerHTML = ""; $("impPreview").innerHTML = ""; $("impRun").disabled = true; return; }
    var hi = table.slice(0, 6).findIndex(isHeader);
    if (hi >= 0) { header = table[hi].map(String); rows = table.slice(hi + 1); }
    else { header = table[0].map(function (_, i) { return "열 " + (i + 1); }); rows = table; }
    rows = rows.filter(function (r) { return !/(합계|총계|total|소계)/i.test(r.join(" ")); });
    map = autoMap(header);
    // 지출 열만 있고 정산 열이 없으면 광고비 모드로 자동 전환
    if (map.spend != null && map.rev == null && map.appr == null) $("impMode").value = "spend";
    else if (map.rev != null || map.appr != null) $("impMode").value = "settle";
    renderMap(); renderPreview();
  }

  /* ── 화면 ── */
  function mode() { return $("impMode").value; }
  function renderMap() {
    var want = mode() === "spend" ? ["date", "camp", "spend", "leads"] : ["date", "camp", "leads", "appr", "pend", "rev", "spend"];
    $("impMap").innerHTML = FIELDS.filter(function (f) { return want.indexOf(f[0]) >= 0; }).map(function (f) {
      return '<label class="f">' + esc(f[1]) + '<select data-field="' + f[0] + '"><option value="">없음</option>' +
        header.map(function (h, i) { return '<option value="' + i + '"' + (map[f[0]] === i ? " selected" : "") + ">" + esc(h || "열 " + (i + 1)) + "</option>"; }).join("") + "</select></label>";
    }).join("");
  }
  function build() {
    var payout = num($("impPayout").value), net = $("impNet").value, ch = $("impCh").value, today = L.dash.ymd(L.dash.today()), sp = mode() === "spend";
    return rows.map(function (r) {
      var get = function (k) { return map[k] == null ? "" : r[map[k]]; };
      if (sp) return { date: map.date != null ? toDate(get("date")) : today, camp: String(get("camp") || "").trim(), net: net, ch: ch, spend: num(get("spend")), leads: map.leads != null ? num(get("leads")) : null };
      var appr = num(get("appr")), leads = map.leads == null ? appr : num(get("leads"));
      var rev = map.rev != null ? num(get("rev")) : appr * payout;
      return { date: map.date != null ? toDate(get("date")) : today, camp: String(get("camp") || "").trim(), net: net, ch: ch,
        leads: leads, appr: appr, pend: map.pend != null ? num(get("pend")) : 0, rev: rev, spend: map.spend != null ? num(get("spend")) : null };
    }).filter(function (x) { return x.date && (sp ? x.spend > 0 : (x.rev || x.appr || x.leads || x.pend)); });
  }
  function renderPreview() {
    var list = build(), sp = mode() === "spend";
    var bad = rows.length - list.length;
    $("impMsg").innerHTML = "<b>" + list.length + "행</b>을 가져올 수 있습니다" + (bad > 0 ? ' <span class="note">(날짜를 못 읽었거나 숫자가 없는 ' + bad + "행 제외)</span>" : "") +
      (!sp && map.rev == null && !num($("impPayout").value) ? ' <span class="neg">수익 열이 없으면 CPA 단가를 넣어 주세요 (승인 × 단가로 계산).</span>' : "") +
      (sp && map.spend == null ? ' <span class="neg">지출(광고비) 열을 연결하세요.</span>' : "");
    if (!list.length) { $("impPreview").innerHTML = ""; $("impRun").disabled = true; return; }
    var tot = list.reduce(function (a, x) { a.rev += x.rev || 0; a.appr += x.appr || 0; a.leads += x.leads || 0; a.spend += x.spend || 0; a.pend += x.pend || 0; return a; }, { rev: 0, appr: 0, leads: 0, spend: 0, pend: 0 });
    var head = sp ? '<th>날짜</th><th>캠페인</th><th class="n">광고비</th>' : '<th>날짜</th><th>캠페인</th><th class="n">DB</th><th class="n">승인</th><th class="n">대기</th><th class="n">수익</th>';
    var cells = function (x) {
      return sp ? '<td class="num">' + esc(x.date) + "</td><td>" + esc(x.camp || "—") + '</td><td class="n">' + won(x.spend) + "</td>"
        : '<td class="num">' + esc(x.date) + "</td><td>" + esc(x.camp || "—") + '</td><td class="n">' + fmt(x.leads) + '</td><td class="n">' + fmt(x.appr) + '</td><td class="n">' + fmt(x.pend) + '</td><td class="n">' + won(x.rev) + "</td>";
    };
    $("impPreview").innerHTML = '<div class="tablewrap"><table class="data"><thead><tr>' + head + "</tr></thead><tbody>" +
      list.slice(0, 8).map(function (x) { return "<tr>" + cells(x) + "</tr>"; }).join("") +
      (list.length > 8 ? '<tr><td colspan="6" class="note">… 외 ' + (list.length - 8) + "행</td></tr>" : "") +
      '<tr class="total"><td>합계</td><td></td>' + (sp ? '<td class="n">' + won(tot.spend) + "</td>" : '<td class="n">' + fmt(tot.leads) + '</td><td class="n">' + fmt(tot.appr) + '</td><td class="n">' + fmt(tot.pend) + '</td><td class="n">' + won(tot.rev) + "</td>") + "</tr></tbody></table></div>";
    $("impRun").disabled = false;
  }
  function run() {
    var list = build(); if (!list.length) return;
    var sp = mode() === "spend", payout = num($("impPayout").value);
    var entries = L.store.get("entries", []).slice(), added = 0, updated = 0, drops = [];
    var prices = Object.assign({}, L.store.get("prices", {}));
    // 정산은 날짜·네트워크·캠페인, 광고비는 날짜·채널·캠페인으로 같은 기록을 찾음
    var key = function (e) { return e.date + "|" + (sp ? (e.ch || "") : (e.net || "")) + "|" + normName(e.camp); };
    var idx = {}; entries.forEach(function (e, i) { idx[key(e)] = i; });
    list.forEach(function (x) {
      var k = key(x);
      if (!sp && x.appr > 0 && x.rev > 0) {
        var unit = Math.round(x.rev / x.appr), pk = (x.net || "") + "|" + normName(x.camp), old = prices[pk];
        if (old && old.unit && unit < old.unit * 0.95 && x.date >= (old.date || "")) drops.push({ camp: x.camp || "(이름 없음)", from: old.unit, to: unit });
        if (!old || x.date >= (old.date || "")) prices[pk] = { unit: unit, date: x.date };
      }
      if (k in idx) {
        var e = entries[idx[k]];
        entries[idx[k]] = sp
          ? Object.assign({}, e, { spend: x.spend })
          : Object.assign({}, e, { leads: x.leads, appr: x.appr, pend: x.pend, rev: x.rev, spend: x.spend != null ? x.spend : e.spend });
        updated++;
      } else {
        entries.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: x.date, net: x.net, camp: x.camp, ch: x.ch,
          spend: x.spend || 0, rev: x.rev || 0, leads: sp ? 0 : x.leads, appr: x.appr || 0, pend: x.pend || 0, payout: payout || undefined });
        idx[k] = entries.length - 1; added++;
      }
    });
    L.store.set("entries", entries); L.store.set("prices", prices);
    if (drops.length) L.store.set("priceAlerts", drops.concat(L.store.get("priceAlerts", [])).slice(0, 20).map(function (d) { d.at = d.at || Date.now(); return d; }));
    L.emit("entries");
    $("impMsg").innerHTML = '<span class="pos"><b>새 기록 ' + added + "건, 갱신 " + updated + "건</b>을 반영했습니다.</span> " +
      (sp ? "광고비가 같은 날짜의 정산 기록과 합쳐져 순수익이 계산됩니다." : "광고비는 매체 광고 관리자 보고서를 '광고비' 종류로 가져오세요.") +
      (drops.length ? '<br><span class="neg"><b>단가 하락 감지:</b> ' + drops.map(function (d) { return esc(d.camp) + " " + won(d.from) + " → " + won(d.to); }).join(", ") + ". 캠페인 운영의 한계 DB당 광고비를 다시 확인하세요.</span>" : "");
    L.toast((sp ? "광고비" : "정산") + " 기록을 가져왔습니다 (추가 " + added + " · 갱신 " + updated + ")");
    L.store.set("impPrefs", { net: $("impNet").value, ch: $("impCh").value, payout: $("impPayout").value });
  }
  var xlsxPromise = null;
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxPromise) xlsxPromise = new Promise(function (res, rej) {
      var sc = document.createElement("script"); sc.src = XLSX_URL;
      sc.onload = function () { window.XLSX ? res(window.XLSX) : rej(new Error("엑셀 도구를 불러오지 못했습니다")); };
      sc.onerror = function () { xlsxPromise = null; rej(new Error("엑셀 도구를 불러오지 못했습니다. 파일을 CSV로 저장해 올리거나 표를 복사해 붙여넣으세요.")); };
      document.head.appendChild(sc);
    });
    return xlsxPromise;
  }
  function onFile(file) {
    if (!file) return;
    $("impMsg").textContent = "파일을 읽는 중…";
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      loadXlsx().then(function (X) {
        return file.arrayBuffer().then(function (buf) {
          var wb = X.read(buf, { type: "array" });
          load(X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" }));
        });
      }).catch(function (e) { $("impMsg").textContent = e.message; });
    } else {
      var r = new FileReader();
      r.onload = function () {
        var t = String(r.result || "");
        // 한글 윈도우 엑셀 CSV(EUC-KR)가 깨지면 다시 읽기
        if (/\uFFFD/.test(t.slice(0, 2000))) { var r2 = new FileReader(); r2.onload = function () { load(parseText(r2.result)); }; r2.readAsText(file, "euc-kr"); return; }
        load(parseText(t));
      };
      r.readAsText(file, "utf-8");
    }
  }

  function init() {
    L.fillSelect($("impNet"), L.D.networks.map(function (n) { return [n.id, n.name]; }).concat([["etc", "기타"]]));
    L.fillSelect($("impCh"), L.chOptions.concat([["etc", "기타"]]));
    var pr = L.store.get("impPrefs", {});
    if (pr.net) $("impNet").value = pr.net; if (pr.ch) $("impCh").value = pr.ch; if (pr.payout) $("impPayout").value = pr.payout;
    $("impText").addEventListener("input", function () { load(parseText($("impText").value)); });
    $("impFile").addEventListener("change", function () { onFile($("impFile").files[0]); });
    $("impMap").addEventListener("change", function (e) { var f = e.target.dataset.field; if (!f) return; map[f] = e.target.value === "" ? undefined : +e.target.value; renderPreview(); });
    $("impMode").addEventListener("change", function () { if (rows.length) { renderMap(); renderPreview(); } });
    ["impNet", "impCh", "impPayout"].forEach(function (id) { $(id).addEventListener("input", function () { if (rows.length) renderPreview(); }); });
    $("impRun").addEventListener("click", run);
    $("impSample").addEventListener("click", function () {
      var t = L.dash.today(), y = L.dash.addDays(t, -1);
      $("impText").value = "날짜\t캠페인명\t접수\t승인\t대기\t정산금액\n" + L.dash.ymd(y) + "\t실비보험 보장분석\t12\t9\t2\t270,000\n" + L.dash.ymd(t) + "\t실비보험 보장분석\t8\t6\t2\t180,000";
      load(parseText($("impText").value));
    });
  }
  L.importer = { parseText: parseText, toDate: toDate, autoMap: autoMap, normName: normName };
  (L.extraInits = L.extraInits || []).push(init);
})();
