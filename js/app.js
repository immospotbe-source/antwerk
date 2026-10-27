/* Antwerk 2026 – Immo Spot : visitor registration (static site, no build step).
   Design/flow follow the approved design. Storage = POST to the Google Apps Script web app
   (config.js > ENDPOINT_URL). Nothing is kept in the browser; the Google Sheet is the admin view. */
(() => {
  "use strict";
  const C = window.ANTWERK_CONFIG || {};
  const T = window.ANTWERK_I18N;
  const LANGS = ["nl", "en", "he"];
  const $ = id => document.getElementById(id);
  const DEFAULT_LANG = LANGS.includes(C.DEFAULT_LANG) ? C.DEFAULT_LANG : "nl";
  const RESET_SECONDS = Math.max(2, Number(C.THANKYOU_RESET_SECONDS) || 20);
  const SEND_TIMEOUT_MS = 25000;

  let lang = DEFAULT_LANG;
  try { const q = new URLSearchParams(location.search).get("lang"); if (LANGS.includes(q)) lang = q; } catch (e) {}
  const t = k => T[lang][k];

  // ---------- views ----------
  const VIEWS = ["v-start", "v-service", "v-raffle", "v-thanks"];
  function show(id) { VIEWS.forEach(v => { $(v).hidden = v !== id; }); window.scrollTo({ top: 0 }); }
  $("go-service").onclick = () => show("v-service");
  $("go-raffle").onclick = () => show("v-raffle");
  document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", () => { clearErrors(); setNote(""); show("v-start"); }));

  // ---------- language ----------
  let lastThanks = null;
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "he" ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(el => { const v = T[lang][el.dataset.i18n]; if (typeof v === "string") el.textContent = v; });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => { el.placeholder = T[lang][el.dataset.i18nPh]; });
    LANGS.forEach(l => $("lang-" + l).setAttribute("aria-pressed", lang === l));
    document.querySelectorAll("[data-doc]").forEach(a => { a.href = a.dataset.doc + ".html?lang=" + (lang === "he" ? "en" : lang); });
    fillPrice(); clearErrors(); renderNote();
    if (lastThanks && !$("v-thanks").hidden) renderThanks(lastThanks);
  }
  function setLang(l) { lang = l; applyLang(); }
  LANGS.forEach(l => { $("lang-" + l).onclick = () => setLang(l); });

  // ---------- service form ----------
  const PRICE_VALUE = ["< € 200.000", "€ 200.000 – 300.000", "€ 300.000 – 400.000", "€ 400.000 – 500.000", "€ 500.000 – 750.000", "€ 750.000 – 1.000.000", "> € 1.000.000"];
  const PRICE_RENT = ["< € 800 / mnd", "€ 800 – 1.000 / mnd", "€ 1.000 – 1.300 / mnd", "€ 1.300 – 1.700 / mnd", "€ 1.700 – 2.500 / mnd", "> € 2.500 / mnd"];
  const interest = () => (document.querySelector("input[name=interest]:checked") || {}).value || "";
  let priceMode = "value";
  function fillPrice() {
    const i = interest();
    // Management asks for the number of properties; letting asks for monthly rent; buying/selling for a price class.
    priceMode = i === "beheer" ? "count" : i === "verhuren" ? "rent" : "value";
    const count = priceMode === "count";
    $("price").hidden = count; $("pcount").hidden = !count;
    $("price-label").htmlFor = count ? "pcount" : "price";
    $("pcount").placeholder = t("countPh");
    const sel = $("price"), prev = sel.value;
    const list = priceMode === "rent" ? PRICE_RENT : PRICE_VALUE;   // option VALUE stays Dutch/canonical, label is localised
    sel.innerHTML = "";
    sel.add(new Option(t("choosePrice"), ""));
    list.forEach(v => sel.add(new Option(priceMode === "rent" ? v.replace("/ mnd", t("perMonth")) : v, v)));
    sel.value = list.includes(prev) ? prev : "";
    $("price-label").textContent = { count: t("priceCount"), rent: t("priceRent"), value: t("priceValue") }[priceMode];
  }
  document.querySelectorAll("input[name=interest]").forEach(c => c.addEventListener("change", () => { fillPrice(); setErr("interest", ""); }));
  $("sq-join").addEventListener("change", () => { $("sq-quiz").hidden = !$("sq-join").checked; if (!$("sq-join").checked) clearErrors(); });

  function setErr(k, msg) { const e = $("e-" + k); if (e) e.textContent = msg; const f = $("f-" + k); if (f) f.classList.toggle("invalid", !!msg); }
  const QS = ["q1", "q2", "q3", "q4"], QFIELDS = { q1: "sold", q2: "rented", q3: "managed", q4: "entrants" };
  const ERR_KEYS = ["interest", "first", "last", "phone", "email", "price", "consent", "rf-first", "rf-last", "rf-phone", "rf-email", "rf-consent",
    ...["rq", "sq"].flatMap(p => [...QS.map(q => `${p}-${q}`), `${p}-g`])];
  function buildQuiz() {
    document.querySelectorAll(".quiz").forEach(box => {
      const p = box.dataset.prefix;
      const box3 = (q, k) => `<div class="field qbox" id="f-${p}-${q}"><label for="${p}-${q}" data-i18n="${k}"></label>` +
        `<input type="text" inputmode="numeric" id="${p}-${q}" autocomplete="off"><div class="err" id="e-${p}-${q}"></div></div>`;
      box.innerHTML = `<div class="quiz-head"><span class="ic"><svg><use href="#i-cash"/></svg></span><div><b data-i18n="quizT"></b><small data-i18n="${p === "sq" ? "quizDopt" : "quizD"}"></small></div></div>` +
        `<div class="qgroup"><div class="qtitle" data-i18n="qHead"></div>` +
        `<div class="qboxes">${box3("q1", "qSold")}${box3("q2", "qRented")}${box3("q3", "qManaged")}</div>` +
        `<div class="err" id="e-${p}-g"></div></div>` +
        `<div class="field" id="f-${p}-q4"><label class="qtitle" for="${p}-q4" data-i18n="q4b"></label>` +
        `<input type="text" inputmode="numeric" id="${p}-q4" autocomplete="off" class="qone"><div class="err" id="e-${p}-q4"></div></div>`;
    });
  }
  const toInt = v => { v = String(v).replace(/[\s.,]/g, ""); return /^\d{1,6}$/.test(v) ? parseInt(v, 10) : null; };
  function readQuiz(p, bad) {
    const out = {};
    QS.forEach(q => { const n = toInt($(`${p}-${q}`).value); if (n === null) bad.push([`${p}-${q}`, t("eQuiz")]); out[QFIELDS[q]] = n; });
    return out;
  }
  function clearErrors() { ERR_KEYS.forEach(k => setErr(k, "")); }
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  const validPhone = p => p.replace(/\D/g, "").length >= 8;
  function focusFirst(bad) { const f = $("f-" + bad[0][0]); f && f.scrollIntoView({ behavior: "smooth", block: "center" }); }

  function validateService() {
    clearErrors();
    const i = interest();
    const cnt = toInt($("pcount").value);
    const d = {
      path: "services", services: i ? [i] : [], firstName: $("first").value.trim(), lastName: $("last").value.trim(),
      phone: $("phone").value.trim(), email: $("email").value.trim(),
      priceType: priceMode, price: priceMode === "count" ? (cnt ? String(cnt) : "") : $("price").value,
      propertyType: $("ptype").value, region: $("region").value.trim(), timing: $("timing").value,
      remarks: $("notes").value.trim(), consent: $("consent").checked, quiz: null, website: $("hp1").value
    };
    const bad = [];
    if (!i) bad.push(["interest", t("eInterest")]);
    if (!d.firstName) bad.push(["first", t("eFirst")]);
    if (!d.lastName) bad.push(["last", t("eLast")]);
    if (!validPhone(d.phone)) bad.push(["phone", t("ePhone")]);
    if (!validEmail(d.email)) bad.push(["email", t("eEmail")]);
    if (!d.price) bad.push(["price", priceMode === "count" ? t("eCount") : t("ePrice")]);
    if ($("sq-join").checked) d.quiz = readQuiz("sq", bad);   // optional questions: only validated when ticked
    if (!d.consent) bad.push(["consent", t("eConsent")]);
    bad.forEach(([k, m]) => setErr(k, m));
    if (["sq-q1", "sq-q2", "sq-q3"].some(k => bad.some(x => x[0] === k))) $("e-sq-g").textContent = t("eQuiz3");
    if (bad.length) { focusFirst(bad); return null; }
    return d;
  }
  function validateRaffle() {
    clearErrors();
    const d = { path: "contest", services: [], firstName: $("rf-first").value.trim(), lastName: $("rf-last").value.trim(),
      phone: $("rf-phone").value.trim(), email: $("rf-email").value.trim(), consent: $("rf-consent").checked, website: $("hp2").value };
    const bad = [];
    if (!d.firstName) bad.push(["rf-first", t("eFirst")]);
    if (!d.lastName) bad.push(["rf-last", t("eLast")]);
    if (!validPhone(d.phone)) bad.push(["rf-phone", t("ePhone")]);
    if (!validEmail(d.email)) bad.push(["rf-email", t("eEmail")]);
    d.quiz = readQuiz("rq", bad);
    const groupBad = ["rq-q1", "rq-q2", "rq-q3"].some(k => bad.some(x => x[0] === k));
    if (!d.consent) bad.push(["rf-consent", t("eRfConsent")]);
    bad.forEach(([k, m]) => setErr(k, m));
    if (groupBad) $("e-rq-g").textContent = t("eQuiz3");
    if (bad.length) { focusFirst(bad); return null; }
    return d;
  }

  // ---------- sending ----------
  let noteKey = "";
  function renderNote() {
    ["status-note", "rf-status-note"].forEach(id => { const n = $(id); n.textContent = noteKey ? t(noteKey) : ""; n.classList.toggle("bad", !!noteKey); });
  }
  function setNote(k) { noteKey = k; renderNote(); }
  const sids = {};   // one submission id per form until it is saved, so a retry after a time-out is recognised by the server
  const newId = () => Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

  /* Returns {state:"saved", duplicate} | {state:"unconfirmed"} | {state:"notconnected"} | {state:"error"}.
     1) normal POST (text/plain = no CORS preflight; Apps Script answers with JSON we can read).
     2) if the browser blocks reading the answer (TypeError), re-send once with mode:"no-cors". The request is delivered
        but the answer is opaque -> "unconfirmed" (shown as success). The server ignores a repeated submission id, so a
        double delivery never creates two rows. */
  async function send(payload) {
    const url = (C.ENDPOINT_URL || "").trim();
    if (!url) return { state: "notconnected" };
    const body = JSON.stringify(payload);
    const opts = mode => {
      const ctrl = typeof AbortController === "function" ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), SEND_TIMEOUT_MS) : null;
      return { o: { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, redirect: "follow", mode, signal: ctrl ? ctrl.signal : undefined }, done: () => timer && clearTimeout(timer) };
    };
    let a = opts("cors");
    try {
      const res = await fetch(url, a.o); a.done();
      let j = null; try { j = await res.json(); } catch (e) {}
      if (res.ok && j && j.ok === true) return { state: "saved", duplicate: !!j.duplicate };
      return { state: "error" };       // server refused or answered something that is not our script
    } catch (e) {
      a.done();
      if (!(e instanceof TypeError)) return { state: "error" };   // timeout/abort
    }
    const b = opts("no-cors");
    try { await fetch(url, b.o); b.done(); return { state: "unconfirmed" }; }
    catch (e) { b.done(); return { state: "error" }; }
  }

  async function submitWith(btn, label, payload) {
    btn.disabled = true; btn.textContent = t("saving"); setNote("");
    let r;
    try { payload.language = lang; payload.sid = sids[payload.path] || (sids[payload.path] = newId()); payload.clientTime = new Date().toISOString(); payload.v = 2; r = await send(payload); }
    finally { btn.disabled = false; btn.textContent = t(label); }
    if (r.state === "saved" || r.state === "unconfirmed") delete sids[payload.path];
    if (r.state === "notconnected") { setNote("notConnected"); return null; }
    if (r.state === "error") { setNote("sendFailed"); return null; }
    return r;
  }
  $("lead-form").addEventListener("submit", async e => {
    e.preventDefault();
    const d = validateService(); if (!d) return;
    const r = await submitWith($("submit"), "submit", d);
    if (r) showThanks({ kind: "service", name: d.firstName, duplicate: !!r.duplicate });
  });
  $("raffle-form").addEventListener("submit", async e => {
    e.preventDefault();
    const d = validateRaffle(); if (!d) return;
    const r = await submitWith($("rf-submit"), "rfSubmit", d);
    if (r) showThanks({ kind: "raffle", name: d.firstName, duplicate: !!r.duplicate });
  });

  // ---------- thank you (auto-returns to the start for the next visitor on a shared tablet) ----------
  let timer = null;
  function renderThanks(s) {
    const svc = s.kind === "service";
    $("thanks-title").textContent = svc ? t("thanks")(s.name) : t("luck")(s.name);
    $("thanks-body").textContent = svc ? t("thanksBody") : t("rfBody");
    $("thanks-dup").hidden = !s.duplicate; $("thanks-dup").textContent = s.duplicate ? t("dupNote") : "";
    $("thanks-steps").hidden = !svc;
    $("thanks-raffle").textContent = svc ? t("thanksRaffle") : t("rfRaffle");
    $("thanks-end").textContent = svc ? t("thanksEnd") : t("rfEnd");
    if (secondsLeft != null) $("countdown").textContent = t("countdown")(secondsLeft);
  }
  let secondsLeft = null;
  function showThanks(s) {
    lastThanks = s; secondsLeft = RESET_SECONDS; renderThanks(s); show("v-thanks");
    clearInterval(timer);
    timer = setInterval(() => { secondsLeft--; $("countdown").textContent = t("countdown")(Math.max(0, secondsLeft)); if (secondsLeft <= 0) resetAll(true); }, 1000);
  }
  function resetAll(auto) {
    clearInterval(timer); lastThanks = null; secondsLeft = null; noteKey = "";
    $("lead-form").reset(); $("raffle-form").reset(); $("sq-quiz").hidden = true; $("countdown").textContent = "";
    if (auto && lang !== DEFAULT_LANG) lang = DEFAULT_LANG;   // next visitor starts in the default language
    applyLang(); show("v-start");
  }
  $("again").onclick = () => resetAll(false);

  buildQuiz();
  applyLang();
})();
