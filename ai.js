/* AI 분석 연결부
   - builtin : claude.ai 아티팩트 안에서 열었을 때 쓰는 내장 Claude (API 키 불필요, 링크 직접 열람 불가)
   - claude  : Claude API (내 API 키). 웹 검색·웹 페이지 열람 도구 사용
   - gemini  : Gemini API (내 API 키). URL 컨텍스트·구글 검색·유튜브 영상 이해 사용
   API 키는 이 브라우저의 localStorage에만 저장되고 각 AI 회사 서버로만 전송됩니다. */
window.LabAI = (function () {
  "use strict";

  var SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm";
  // 동적 필터링 웹 도구(_20260209)를 지원하는 모델. 그 외 모델은 기본 버전 도구를 씁니다.
  var NEW_WEB_TOOLS = /^claude-(fable-5|opus-5|sonnet-5|opus-4-[678]|sonnet-4-6)/;
  var FALLBACK_MODELS = /^claude-(opus-5|fable-5)/;

  var builtinPromise = null;
  function builtin() {
    if (!builtinPromise) {
      builtinPromise = (window.claude && typeof window.claude.use === "function")
        ? Promise.resolve(window.claude.use("sample")).catch(function () { return null; })
        : Promise.resolve(null);
    }
    return builtinPromise;
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { reject(new Error("이미지를 읽지 못했습니다.")); };
      r.readAsDataURL(file);
    });
  }

  function isYouTube(url) {
    return /^https?:\/\/(www\.|m\.)?(youtube\.com\/(watch|shorts\/)|youtu\.be\/)/i.test(url || "");
  }

  /* ───── Claude API (공식 SDK, 브라우저 직접 호출) ───── */
  var sdkPromise = null;
  async function runClaude(o) {
    var s = o.settings;
    if (!s.claudeKey) throw new Error("설정에서 Claude API 키를 입력하세요.");
    if (!sdkPromise) sdkPromise = import(SDK_URL);
    var Anthropic;
    try { Anthropic = (await sdkPromise).default; }
    catch (e) { sdkPromise = null; throw new Error("Claude SDK를 불러오지 못했습니다. 인터넷 연결을 확인하세요. (claude.ai 미리보기 안에서는 외부 API 호출이 막혀 있습니다)"); }

    var client = new Anthropic({ apiKey: s.claudeKey, dangerouslyAllowBrowser: true });
    var model = s.claudeModel || "claude-opus-5";
    var content = [];
    for (var i = 0; i < o.images.length; i++) {
      var f = o.images[i];
      content.push({ type: "image", source: { type: "base64", media_type: f.type || "image/png", data: await fileToBase64(f) } });
    }
    var msgs;
    if (o.messages && o.messages.length) {
      // 대화형(비서): 마지막 사용자 턴에만 이미지를 붙입니다
      msgs = o.messages.map(function (m, i) {
        return { role: m.role, content: i === o.messages.length - 1 ? content.concat([{ type: "text", text: m.content }]) : m.content };
      });
    } else {
      content.push({ type: "text", text: o.prompt });
      msgs = [{ role: "user", content: content }];
    }
    var params = { model: model, max_tokens: 16000, messages: msgs };
    if (s.web !== false) {
      var fresh = NEW_WEB_TOOLS.test(model);
      params.tools = [
        { type: fresh ? "web_search_20260209" : "web_search_20250305", name: "web_search", max_uses: 5 },
        { type: fresh ? "web_fetch_20260209" : "web_fetch_20250910", name: "web_fetch", max_uses: 5 }
      ];
    }
    var useBeta = FALLBACK_MODELS.test(model);
    if (useBeta) {
      // 안전 분류기가 요청을 거절하면 서버가 권장 모델로 자동 재시도
      params.betas = ["server-side-fallback-2026-07-01"];
      params.fallbacks = "default";
    }
    var api = useBeta ? client.beta.messages : client.messages;

    var shown = "";
    for (var round = 0; round < 5; round++) {
      var stream = api.stream(params);
      if (o.signal) o.signal.addEventListener("abort", function () { try { stream.abort(); } catch (e) {} }, { once: true });
      stream.on("text", function (delta) { shown += delta; o.onText(shown); });
      var msg;
      try { msg = await stream.finalMessage(); }
      catch (e) {
        if (o.signal && o.signal.aborted) throw { code: "cancelled" };
        var status = e && e.status;
        if (status === 401) throw new Error("Claude API 키가 올바르지 않습니다.");
        if (status === 429) throw new Error("Claude API 사용 한도에 걸렸습니다. 잠시 후 다시 시도하세요.");
        if (status === 404) throw new Error("모델 이름을 찾을 수 없습니다: " + model);
        throw new Error("Claude API 오류: " + (e && e.message ? e.message : e));
      }
      if (msg.stop_reason === "refusal") throw new Error("Claude가 이 요청을 거절했습니다. 입력 내용을 바꿔 다시 시도하세요.");
      if (msg.stop_reason !== "pause_turn") break;
      // 웹 도구가 긴 작업 중 멈춘 경우: 지금까지의 응답을 붙여 이어서 요청
      params.messages = params.messages.concat([{ role: "assistant", content: msg.content }]);
      shown += "\n\n";
    }
    return shown;
  }

  /* ───── Gemini API (REST) ───── */
  async function runGemini(o) {
    var s = o.settings;
    if (!s.geminiKey) throw new Error("설정에서 Gemini API 키를 입력하세요.");
    var model = s.geminiModel || "gemini-2.5-flash";
    var parts = [];
    (o.urls || []).forEach(function (u) { if (isYouTube(u)) parts.push({ file_data: { file_uri: u } }); });
    for (var i = 0; i < o.images.length; i++) {
      parts.push({ inline_data: { mime_type: o.images[i].type || "image/png", data: await fileToBase64(o.images[i]) } });
    }
    var contents;
    if (o.messages && o.messages.length) {
      contents = o.messages.map(function (m, i) {
        var p = i === o.messages.length - 1 ? parts.concat([{ text: m.content }]) : [{ text: m.content }];
        return { role: m.role === "assistant" ? "model" : "user", parts: p };
      });
    } else {
      parts.push({ text: o.prompt });
      contents = [{ role: "user", parts: parts }];
    }
    var body = { contents: contents };
    if (s.web !== false) body.tools = [{ url_context: {} }, { google_search: {} }];

    async function call(b) {
      var res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": s.geminiKey },
        body: JSON.stringify(b),
        signal: o.signal
      });
      var json = await res.json().catch(function () { return {}; });
      return { ok: res.ok, status: res.status, json: json };
    }
    var r;
    try {
      r = await call(body);
      // 도구 조합을 지원하지 않는 모델이면 도구 없이 한 번 더
      if (!r.ok && r.status === 400 && body.tools) { delete body.tools; r = await call(body); }
    } catch (e) {
      if (o.signal && o.signal.aborted) throw { code: "cancelled" };
      throw new Error("Gemini API에 연결하지 못했습니다. (claude.ai 미리보기 안에서는 외부 API 호출이 막혀 있습니다)");
    }
    if (!r.ok) {
      var m = (r.json.error && r.json.error.message) || ("HTTP " + r.status);
      if (r.status === 400 && /API key/i.test(m)) m = "Gemini API 키가 올바르지 않습니다.";
      throw new Error("Gemini API 오류: " + m);
    }
    var cand = (r.json.candidates || [])[0];
    var text = cand && cand.content && cand.content.parts
      ? cand.content.parts.map(function (p) { return p.text || ""; }).join("") : "";
    if (!text) throw new Error("Gemini가 빈 응답을 보냈습니다" + (cand && cand.finishReason ? " (" + cand.finishReason + ")" : "") + ".");
    var src = cand.groundingMetadata && cand.groundingMetadata.groundingChunks;
    if (src && src.length) {
      text += "\n\n### 참고한 출처\n" + src.filter(function (c) { return c.web; }).slice(0, 8)
        .map(function (c) { return "- [" + (c.web.title || c.web.uri) + "](" + c.web.uri + ")"; }).join("\n");
    }
    o.onText(text);
    return text;
  }

  /* ───── 내장 Claude (claude.ai 아티팩트 안) ───── */
  async function runBuiltin(o) {
    var sample = await builtin();
    if (!sample) throw new Error("내장 Claude는 claude.ai에서 이 페이지를 열었을 때만 쓸 수 있습니다. 설정에서 Claude API 또는 Gemini를 선택하세요.");
    var opts = { onText: function (u) { o.onText(u.text); }, signal: o.signal, modelTier: "complex" };
    if (o.images.length) {
      var lim = await sample.limits().catch(function () { return null; });
      if (lim && lim.images) opts.images = o.images.slice(0, lim.images.maxCount);
    }
    try {
      if (o.messages && o.messages.length) opts.cache = false;
      var r = await sample(o.messages && o.messages.length ? o.messages.map(function (m) { return { role: m.role, content: m.content }; }) : o.prompt, opts);
      return r.text + (r.truncated ? "\n\n(답변이 길어 중간에 끊겼습니다. 입력을 줄여 다시 시도하세요.)" : "");
    } catch (e) {
      if (e && e.code === "cancelled") throw e;
      var copy = {
        not_granted: "이 페이지의 Claude 사용이 허용되지 않았습니다.",
        sampling_disabled: "이 계정에서는 내장 Claude를 쓸 수 없습니다.",
        rate_limited: "사용량 한도에 걸렸습니다. 잠시 후 다시 시도하세요.",
        session_expired: "claude.ai에 다시 로그인하세요.",
        prompt_too_large: "입력이 너무 깁니다. 붙여넣은 텍스트를 줄이세요.",
        image_rejected: "이미지를 받지 못했습니다. JPG·PNG로 다시 올려 주세요.",
        refused: "Claude가 이 요청을 거절했습니다. 입력 내용을 바꿔 다시 시도하세요."
      };
      throw new Error(copy[e && e.code] || "내장 Claude 호출이 실패했습니다. 다시 시도하세요.");
    }
  }

  /* 월 사용량 집계와 한도 (설정의 aiLimit, 0 = 제한 없음) */
  function month() { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1); }
  function usage() {
    var st = window.LabStore, u = st ? st.get("aiUsage", null) : null;
    return u && u.month === month() ? u : { month: month(), calls: 0 };
  }
  async function run(o) {
    o.images = o.images || [];
    var lim = +(o.settings && o.settings.aiLimit) || 0, u = usage();
    if (o.provider !== "local" && lim > 0 && u.calls >= lim) throw new Error("이번 달 AI 호출 한도(" + lim + "회)에 도달했습니다. 설정에서 한도를 늘릴 수 있습니다.");
    var p;
    if (o.provider === "claude") p = runClaude(o);
    else if (o.provider === "gemini") p = runGemini(o);
    else if (o.provider === "builtin") p = runBuiltin(o);
    else throw new Error("AI가 꺼져 있습니다.");
    var res = await p;
    if (window.LabStore) { var nu = usage(); nu.calls += 1; window.LabStore.set("aiUsage", nu); }
    return res;
  }

  /* ───── 이미지 생성: Gemini 이미지 모델(나노바나나) ─────
     결과는 data: URL 배열. 엔진 선택과 관계없이 Gemini 키로 호출합니다. */
  async function image(o) {
    var s = o.settings || {};
    if (!s.geminiKey) throw new Error("설정에서 Gemini API 키를 입력하세요. (이미지 생성은 Gemini 키로 동작합니다)");
    var lim = +s.aiLimit || 0, u = usage();
    if (lim > 0 && u.calls >= lim) throw new Error("이번 달 AI 호출 한도(" + lim + "회)에 도달했습니다. 설정에서 한도를 늘릴 수 있습니다.");
    var model = s.imgModel || "gemini-2.5-flash-image", parts = [];
    var refs = o.refs || [];
    for (var i = 0; i < refs.length && i < 3; i++) parts.push({ inline_data: { mime_type: refs[i].type || "image/png", data: await fileToBase64(refs[i]) } });
    parts.push({ text: o.prompt });
    var body = { contents: [{ role: "user", parts: parts }], generationConfig: { responseModalities: ["IMAGE", "TEXT"] } };
    if (o.aspect) body.generationConfig.imageConfig = { aspectRatio: o.aspect };
    async function call(b) {
      var res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
        method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": s.geminiKey }, body: JSON.stringify(b), signal: o.signal
      });
      return { ok: res.ok, status: res.status, json: await res.json().catch(function () { return {}; }) };
    }
    var r;
    try {
      r = await call(body);
      // 비율 지정을 모르는 모델이면 비율 없이 한 번 더
      if (!r.ok && r.status === 400 && body.generationConfig.imageConfig) { delete body.generationConfig.imageConfig; r = await call(body); }
    } catch (e) {
      if (o.signal && o.signal.aborted) throw { code: "cancelled" };
      throw new Error("Gemini API에 연결하지 못했습니다. (claude.ai 미리보기 안에서는 외부 API 호출이 막혀 있습니다. PC 파일 버전이나 Netlify 등 내 사이트에서 쓰세요)");
    }
    if (!r.ok) {
      var m = (r.json.error && r.json.error.message) || ("HTTP " + r.status);
      if (r.status === 404) m = "이미지 모델 '" + model + "'을 찾지 못했습니다. 설정에서 이미지 생성 모델 이름을 확인하세요.";
      throw new Error("이미지 생성 오류: " + m);
    }
    var out = [], note = "";
    (r.json.candidates || []).forEach(function (c) {
      ((c.content && c.content.parts) || []).forEach(function (p) {
        var d = p.inlineData || p.inline_data;
        if (d && d.data) out.push("data:" + (d.mimeType || d.mime_type || "image/png") + ";base64," + d.data);
        else if (p.text) note += p.text;
      });
    });
    if (window.LabStore) { var nu = usage(); nu.calls += 1; window.LabStore.set("aiUsage", nu); }
    if (!out.length) {
      var fr = r.json.candidates && r.json.candidates[0] && r.json.candidates[0].finishReason;
      throw new Error("이미지를 받지 못했습니다" + (fr ? " (" + fr + ")" : "") + (note ? ": " + note.slice(0, 120) : ". 지시문에서 민감한 표현을 빼고 다시 시도하세요."));
    }
    return out;
  }

  /* ───── 안전한 간이 마크다운 렌더러 ───── */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  function md(src) {
    var lines = String(src || "").replace(/\r/g, "").split("\n");
    var out = [], list = null, table = null;
    function close() {
      if (list) { out.push("</" + list + ">"); list = null; }
      if (table) { out.push("</tbody></table></div>"); table = null; }
    }
    lines.forEach(function (raw) {
      var line = raw.trimEnd();
      var m;
      if (/^\s*\|.*\|\s*$/.test(line)) {
        if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) return;
        var cells = line.trim().slice(1, -1).split("|").map(function (c) { return inline(c.trim()); });
        if (!table) { close(); table = true; out.push('<div class="tablewrap"><table class="mdt"><thead><tr><th>' + cells.join("</th><th>") + "</th></tr></thead><tbody>"); return; }
        out.push("<tr><td>" + cells.join("</td><td>") + "</td></tr>");
        return;
      }
      if (table) { out.push("</tbody></table></div>"); table = null; }
      if (!line.trim()) { close(); return; }
      if ((m = line.match(/^(#{1,4})\s+(.*)$/))) { close(); var lv = Math.min(m[1].length + 2, 5); out.push("<h" + lv + ">" + inline(m[2]) + "</h" + lv + ">"); return; }
      if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) { if (list !== "ul") { close(); list = "ul"; out.push("<ul>"); } out.push("<li>" + inline(m[1]) + "</li>"); return; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { if (list !== "ol") { close(); list = "ol"; out.push("<ol>"); } out.push("<li>" + inline(m[1]) + "</li>"); return; }
      if (/^\s*>\s?/.test(line)) { close(); out.push("<blockquote>" + inline(line.replace(/^\s*>\s?/, "")) + "</blockquote>"); return; }
      if (/^\s*(---|\*\*\*)\s*$/.test(line)) { close(); out.push("<hr>"); return; }
      close(); out.push("<p>" + inline(line) + "</p>");
    });
    close();
    return out.join("");
  }

  return { run: run, image: image, builtin: builtin, md: md, isYouTube: isYouTube, usage: usage };
})();
