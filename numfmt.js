/* 숫자 입력 콤마 표시: 모든 숫자 입력칸을 1,000 단위 콤마로 보여 줍니다.
   - 화면에는 "30,000"으로 보이지만 코드가 읽는 .value는 "30000" 그대로라 계산이 바뀌지 않습니다.
   - 나중에 그려지는 입력칸(점검 폼 등)도 자동으로 바뀝니다. */
(function () {
  "use strict";
  var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  function raw(s) { return String(s == null ? "" : s).replace(/[,\s원]/g, ""); }
  function clean(s) {
    s = raw(s).replace(/[^\d.\-]/g, "");
    var neg = s.charAt(0) === "-"; s = s.replace(/-/g, "");
    var i = s.indexOf("."); if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
    return (neg ? "-" : "") + s;
  }
  function fmt(v) {
    var s = clean(v), m = s.match(/^(-?)(\d*)(\.\d*)?$/);
    if (!m) return s;
    var int = m[2].replace(/^0+(?=\d)/, "");
    return m[1] + int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (m[3] || "");
  }
  function onInput(e) {
    var el = e.target, shown = desc.get.call(el), pos = el.selectionStart == null ? shown.length : el.selectionStart;
    var before = clean(shown.slice(0, pos)).length, next = fmt(shown);
    if (next === shown) return;
    desc.set.call(el, next);
    // 커서를 같은 숫자 뒤로 되돌림
    var n = 0, p = 0;
    while (p < next.length && n < before) { if (next.charAt(p) !== ",") n++; p++; }
    try { el.setSelectionRange(p, p); } catch (x) {}
  }
  function conv(el) {
    if (!el || el.dataset.num || el.type !== "number") return;
    var step = el.getAttribute("step"), dec = step === "any" || /\./.test(step || "");
    var v = desc.get.call(el);
    el.dataset.num = dec ? "dec" : "int";
    el.type = "text";
    el.setAttribute("inputmode", dec ? "decimal" : "numeric");
    el.setAttribute("autocomplete", "off");
    el.classList.add("numf");
    Object.defineProperty(el, "value", {
      configurable: true,
      get: function () { return raw(desc.get.call(this)); },
      set: function (x) { desc.set.call(this, fmt(x)); }
    });
    desc.set.call(el, fmt(v));
    el.addEventListener("input", onInput);
  }
  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.tagName === "INPUT") conv(root);
    root.querySelectorAll('input[type="number"]').forEach(conv);
  }
  scan(document);
  try {
    new MutationObserver(function (list) {
      list.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); }); });
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}
  window.LabNum = { fmt: fmt, raw: raw, scan: scan };
})();
