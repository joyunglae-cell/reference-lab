/* 저장소: 모든 기록을 계속 보관합니다.
   1) 이 브라우저(localStorage) — 항상
   2) claude.ai에서 열면 내 계정의 비공개 저장소(db 기능)에 자동 동기화 — 다른 기기에서도 그대로
   3) 직접 배포한 사이트에서는 GitHub Gist(비공개)에 자동 동기화 — 설정에서 토큰 연결
   키마다 마지막 수정 시각(t)을 비교해 더 최신 쪽을 씁니다. */
window.LabStore = (function () {
  "use strict";
  var PREFIX = "reflab.";
  var SYNC_KEYS = ["entries", "board", "log", "checks", "calc", "history", "reports", "chat", "cases", "settings", "bizchecks", "media", "ops", "merchants", "prices", "priceAlerts"];
  var SECRET = ["claudeKey", "geminiKey", "ghToken", "tgToken"];
  var GIST_FILE = "reflab-data.json";

  var cache = {}, meta = {}, saved = {};
  function lsRaw(k) { try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } }
  function lsGet(k) { var raw = lsRaw(k); if (raw == null) return undefined; saved[k] = raw; try { return JSON.parse(raw); } catch (e) { return undefined; } }
  function lsSet(k, v) { var json = JSON.stringify(v); saved[k] = json; try { localStorage.setItem(PREFIX + k, json); return true; } catch (e) { return false; } }
  meta = lsGet("_meta") || {};

  var listeners = [];
  var status = { mode: "local", state: "idle", last: 0, error: "" };
  function setStatus(p) { Object.assign(status, p); listeners.forEach(function (fn) { try { fn("status"); } catch (e) {} }); }

  function get(k, fallback) {
    if (!(k in cache)) cache[k] = lsGet(k);
    var v = cache[k];
    return v === undefined || v === null ? fallback : v;
  }
  function stripSecrets(k, v) {
    if (k !== "settings" || !v) return v;
    var o = Object.assign({}, v);
    SECRET.forEach(function (s) { delete o[s]; });
    return o;
  }
  function set(k, v) {
    if (!(k in cache)) get(k);
    var json = JSON.stringify(v);
    cache[k] = v;
    if (json === saved[k]) return; // 저장된 내용과 같으면 동기화하지 않음 (배열을 제자리에서 바꿔도 비교는 저장본 기준)
    lsSet(k, v);
    if (SYNC_KEYS.indexOf(k) >= 0) {
      meta[k] = Date.now();
      lsSet("_meta", meta);
      schedulePush(k);
    }
  }
  function clearAll() {
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIX) === 0) localStorage.removeItem(k); }); } catch (e) {}
    cache = {}; meta = {}; saved = {};
  }
  function applyRemote(k, v, t) {
    if (k === "settings") {
      // 비밀값(키·토큰)은 이 기기 것을 유지
      var local = get("settings", {}) || {};
      v = Object.assign({}, v || {});
      SECRET.forEach(function (s) { if (local[s]) v[s] = local[s]; });
    }
    cache[k] = v; lsSet(k, v); meta[k] = t; lsSet("_meta", meta);
  }

  /* ───── 백엔드 1: claude.ai 비공개 저장소 ───── */
  var db = null, uid = null;
  var CHUNK = 180000;
  function docPath(k) { return "data/users/" + uid + "/" + k; }
  async function dbRead(k) {
    var snap = await db.doc(docPath(k)).get();
    if (!snap.exists) return null;
    var d = snap.data();
    if (d.parts) {
      var s = "";
      for (var i = 1; i <= d.parts; i++) {
        var p = await db.doc(docPath(k + "~" + i)).get();
        if (!p.exists) return null;
        s += p.data().s;
      }
      return { t: d.t, v: JSON.parse(s) };
    }
    return { t: d.t, v: d.v };
  }
  async function dbWrite(k, v, t) {
    var json = JSON.stringify(v === undefined ? null : v);
    if (json.length <= CHUNK) { await db.doc(docPath(k)).set({ t: t, v: v === undefined ? null : v }); return; }
    var n = Math.ceil(json.length / CHUNK);
    for (var i = 1; i <= n; i++) await db.doc(docPath(k + "~" + i)).set({ s: json.slice((i - 1) * CHUNK, i * CHUNK) });
    await db.doc(docPath(k)).set({ t: t, parts: n });
  }

  /* ───── 백엔드 2: GitHub Gist ───── */
  function gh(path, opt) {
    var s = get("settings", {}) || {};
    opt = opt || {};
    return fetch("https://api.github.com" + path, {
      method: opt.method || "GET",
      headers: Object.assign({ "Accept": "application/vnd.github+json", "Authorization": "Bearer " + s.ghToken, "X-GitHub-Api-Version": "2022-11-28" },
        opt.body ? { "Content-Type": "application/json" } : {}),
      body: opt.body ? JSON.stringify(opt.body) : undefined
    }).then(function (r) {
      if (r.status === 401) throw new Error("GitHub 토큰이 올바르지 않거나 만료됐습니다.");
      if (r.status === 403 || r.status === 404) throw new Error("토큰에 Gist 권한(Gists: 읽기·쓰기)이 없거나 Gist를 찾을 수 없습니다.");
      if (!r.ok) throw new Error("GitHub 오류 HTTP " + r.status);
      return r.json();
    });
  }
  async function gistFind() {
    for (var page = 1; page <= 5; page++) {
      var list = await gh("/gists?per_page=100&page=" + page);
      var hit = list.filter(function (g) { return g.files && g.files[GIST_FILE]; })[0];
      if (hit) return hit.id;
      if (list.length < 100) break;
    }
    return null;
  }
  async function gistLoad(id) {
    var g = await gh("/gists/" + id);
    var f = g.files[GIST_FILE];
    if (!f) return {};
    var text = f.content;
    if (f.truncated && f.raw_url) text = await fetch(f.raw_url).then(function (r) { return r.text(); });
    try { return (JSON.parse(text) || {}).keys || {}; } catch (e) { return {}; }
  }
  function snapshot() {
    var keys = {};
    SYNC_KEYS.forEach(function (k) { var v = get(k); if (v !== undefined) keys[k] = { t: meta[k] || 0, v: stripSecrets(k, v) }; });
    return { app: "reflab", v: 3, saved: new Date().toISOString(), keys: keys };
  }

  /* ───── 동기화 ───── */
  var backend = null; // "claude" | "gist" | null
  var timers = {}, chains = {}, gistTimer = null;
  function schedulePush(k) {
    if (backend === "claude") {
      clearTimeout(timers[k]);
      timers[k] = setTimeout(function () { pushClaude(k); }, 1200);
    } else if (backend === "gist") {
      clearTimeout(gistTimer);
      gistTimer = setTimeout(pushGist, 2500);
    }
  }
  function pushClaude(k) {
    // 같은 문서에는 한 번에 하나씩만 씁니다
    chains[k] = (chains[k] || Promise.resolve()).then(function () {
      setStatus({ state: "saving" });
      return dbWrite(k, stripSecrets(k, get(k)), meta[k] || Date.now());
    }).then(function () { setStatus({ state: "ok", last: Date.now(), error: "" }); })
      .catch(function (e) { setStatus({ state: "error", error: (e && (e.message || e.code)) || "저장 실패" }); });
  }
  function pushGist() {
    var s = get("settings", {}) || {};
    if (!s.gistId || !s.ghToken) return Promise.resolve();
    setStatus({ state: "saving" });
    var body = { files: {} };
    body.files[GIST_FILE] = { content: JSON.stringify(snapshot()) };
    return gh("/gists/" + s.gistId, { method: "PATCH", body: body })
      .then(function () { setStatus({ state: "ok", last: Date.now(), error: "" }); })
      .catch(function (e) { setStatus({ state: "error", error: e.message }); });
  }
  function merge(remote, pushLocalNewer) {
    var changed = false;
    SYNC_KEYS.forEach(function (k) {
      var r = remote[k], lt = meta[k] || 0;
      if (r && (r.t || 0) > lt) { applyRemote(k, r.v, r.t); changed = true; }
      else if (lt > (r ? r.t || 0 : 0) && get(k) !== undefined) pushLocalNewer(k);
    });
    return changed;
  }

  async function connectClaude() {
    if (!window.claude || typeof window.claude.use !== "function") return false;
    var dbNs = await Promise.resolve(window.claude.use("db")).catch(function () { return null; });
    var userNs = await Promise.resolve(window.claude.use("user")).catch(function () { return null; });
    if (!dbNs || !userNs) return false;
    var id = await Promise.resolve(userNs.id()).catch(function () { return null; });
    if (!id) return false;
    db = dbNs; uid = id; backend = "claude";
    setStatus({ mode: "claude", state: "loading" });
    var remote = {};
    for (var i = 0; i < SYNC_KEYS.length; i++) {
      var k = SYNC_KEYS[i];
      try { var r = await dbRead(k); if (r) remote[k] = r; } catch (e) { /* 개별 키 실패는 건너뜀 */ }
    }
    var changed = merge(remote, function (k) { pushClaude(k); });
    setStatus({ state: "ok", last: Date.now() });
    return changed;
  }
  async function connectGist() {
    var s = get("settings", {}) || {};
    if (!s.ghToken) return false;
    backend = "gist";
    setStatus({ mode: "gist", state: "loading" });
    try {
      var id = s.gistId || await gistFind();
      if (!id) {
        var body = { description: "제휴광고 레퍼런스 랩 데이터 (자동 동기화)", public: false, files: {} };
        body.files[GIST_FILE] = { content: JSON.stringify(snapshot()) };
        id = (await gh("/gists", { method: "POST", body: body })).id;
      }
      if (id !== s.gistId) { s = Object.assign({}, get("settings", {}), { gistId: id }); cache.settings = s; lsSet("settings", s); }
      var remote = await gistLoad(id);
      var needPush = false;
      var changed = merge(remote, function () { needPush = true; });
      if (needPush) await pushGist();
      setStatus({ state: "ok", last: Date.now(), error: "" });
      return changed;
    } catch (e) {
      setStatus({ state: "error", error: e.message });
      return false;
    }
  }

  var ready = (async function () {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    try {
      if (await connectClaude()) return true;
      if (backend) return false;
      return await connectGist();
    } catch (e) { return false; }
  })();

  return {
    get: get, set: set, clearAll: clearAll, ready: ready, status: function () { return status; },
    onStatus: function (fn) { listeners.push(fn); },
    backend: function () { return backend; },
    connectGist: async function () { var c = await connectGist(); return c; },
    disconnectGist: function () { if (backend === "gist") backend = null; setStatus({ mode: "local", state: "idle", error: "" }); },
    syncNow: function () {
      if (backend === "gist") return pushGist();
      if (backend === "claude") { SYNC_KEYS.forEach(function (k) { if (get(k) !== undefined) pushClaude(k); }); return Promise.resolve(); }
      return Promise.resolve();
    },
    snapshot: snapshot,
    /* 모든 기록 삭제: 동기화된 사본도 비워야 다시 살아나지 않습니다 */
    wipe: async function () {
      SYNC_KEYS.forEach(function (k) { if (k !== "settings") set(k, null); });
      var s = get("settings", {}) || {};
      set("settings", { ghToken: s.ghToken, gistId: s.gistId, _wiped: Date.now() });
      if (backend === "claude") {
        SYNC_KEYS.forEach(function (k) { clearTimeout(timers[k]); pushClaude(k); });
        await Promise.all(SYNC_KEYS.map(function (k) { return chains[k]; }));
      } else if (backend === "gist") { clearTimeout(gistTimer); await pushGist(); }
      var keepMeta = meta;
      var keepS = { ghToken: s.ghToken, gistId: s.gistId };
      clearAll();
      meta = keepMeta; lsSet("_meta", meta);
      if (keepS.ghToken) lsSet("settings", keepS);
    }
  };
})();
