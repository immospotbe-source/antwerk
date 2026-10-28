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
    fillPrice(); fillType(); clearErrors(); renderNote();
    // hide empty path descriptions
    document.querySelectorAll(".path .d").forEach(el => { el.hidden = !el.textContent.trim(); });
    if (lastThanks && !$("v-thanks").hidden) renderThanks(lastThanks);
  }
  function setLang(l) { lang = l; applyLang(); }
  LANGS.forEach(l => { $("lang-" + l).onclick = () => setLang(l); });

  // ---------- service form ----------
  const PRICE_VALUE = ["< € 200.000", "€ 200.000 – 300.000", "€ 300.000 – 400.000", "€ 400.000 – 500.000", "€ 500.000 – 750.000", "€ 750.000 – 1.000.000", "> € 1.000.000"];
  const TYPE_VALUE = ["appartement", "huis", "opbrengsteigendom"];
  const TYPE_I18N = { appartement: "tApt", huis: "tHouse", opbrengsteigendom: "tInvest" };
  const interests = () => [...document.querySelectorAll("input[name=interest]:checked")].map(el => el.value);
  function hasSvc(...keys) { const s = interests(); return keys.some(k => s.includes(k)); }
  function selectedType() { const el = $("ptype"); return el ? el.value : ""; }

  function syncPropertyFields() {
    // Type pand: only for kopen / verkopen (NOT verhuren). Price: only kopen. No regio. No aantal panden.
    const showBuy = hasSvc("kopen");
    const showType = hasSvc("kopen", "verkopen");
    const showAny = showBuy || showType;
    $("f-property").hidden = !showAny;
    $("f-ptype").hidden = !showType;
    $("f-price").hidden = !showBuy;
    if ($("f-pcount")) $("f-pcount").hidden = true;
    if ($("f-region")) $("f-region").hidden = true;
    if (!showType && $("ptype")) $("ptype").value = "";
    if (!showBuy && $("price")) $("price").value = "";
  }

  function fillPrice() {
    const sel = $("price"); if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    sel.add(new Option(t("choosePrice"), ""));
    PRICE_VALUE.forEach(v => sel.add(new Option(v, v)));
    sel.value = PRICE_VALUE.includes(prev) ? prev : "";
    if ($("price-label")) $("price-label").textContent = t("priceValue");
  }

  function fillType() {
    const sel = $("ptype"); if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = "";
    sel.add(new Option(t("chooseType"), ""));
    TYPE_VALUE.forEach(v => sel.add(new Option(t(TYPE_I18N[v]), v)));
    sel.value = TYPE_VALUE.includes(prev) ? prev : "";
    const lab = document.querySelector("#f-ptype > label");
    if (lab) lab.textContent = t("ptype");
  }

  document.querySelectorAll("input[name=interest]").forEach(c => c.addEventListener("change", () => {
    syncPropertyFields(); fillPrice(); fillType(); setErr("interest", ""); setErr("ptype", ""); setErr("price", "");
  }));

  function setErr(k, msg) { const e = $("e-" + k); if (e) e.textContent = msg; const f = $("f-" + k); if (f) f.classList.toggle("invalid", !!msg); }
  const ERR_KEYS = ["interest", "first", "last", "phone", "email", "price", "ptype", "consent", "rf-first", "rf-last", "rf-phone", "rf-email", "rf-consent", "rq-q4"];
  function buildQuiz() {
    // Contest quiz: ONLY question 2 (participants / entrants). q1–q3 group removed.
    document.querySelectorAll(".quiz").forEach(box => {
      const p = box.dataset.prefix;
      box.innerHTML =
        `<div class="quiz-head"><span class="ic"><svg><use href="#i-cash"/></svg></span><div><b data-i18n="quizT"></b><small data-i18n="quizD"></small></div></div>` +
        `<div class="field" id="f-${p}-q4"><label class="qtitle" for="${p}-q4" data-i18n="q4b"></label>` +
        `<input type="text" inputmode="numeric" id="${p}-q4" autocomplete="off" class="qone"><div class="err" id="e-${p}-q4"></div></div>`;
    });
  }
  const toInt = v => { v = String(v).replace(/[\s.,]/g, ""); return /^\d{1,6}$/.test(v) ? parseInt(v, 10) : null; };
  function clearErrors() { ERR_KEYS.forEach(k => setErr(k, "")); }
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  const validPhone = p => p.replace(/\D/g, "").length >= 8;
  function focusFirst(bad) { const f = $("f-" + bad[0][0]); f && f.scrollIntoView({ behavior: "smooth", block: "center" }); }

  function validateService() {
    clearErrors();
    const svcs = interests();
    const type = selectedType();
    const needType = hasSvc("kopen", "verkopen");
    const needPrice = hasSvc("kopen");
    const d = {
      path: "services", services: svcs, firstName: $("first").value.trim(), lastName: $("last").value.trim(),
      phone: $("phone").value.trim(), email: $("email").value.trim(),
      priceType: "value",
      price: needPrice ? $("price").value : "",
      propertyTypes: needType && type ? [type] : [],
      propertyType: needType ? type : "",
      propertyCount: "",
      region: "",
      timing: "",
      remarks: $("notes").value.trim(), consent: $("consent").checked, quiz: null, website: $("hp1").value
    };
    const bad = [];
    if (!svcs.length) bad.push(["interest", t("eInterest")]);
    if (!d.firstName) bad.push(["first", t("eFirst")]);
    if (!d.lastName) bad.push(["last", t("eLast")]);
    if (!validPhone(d.phone)) bad.push(["phone", t("ePhone")]);
    if (!validEmail(d.email)) bad.push(["email", t("eEmail")]);
    if (needType && !type) bad.push(["ptype", t("ePtype")]);
    if (needPrice && !d.price) bad.push(["price", t("ePrice")]);
    if (!d.consent) bad.push(["consent", t("eConsent")]);
    bad.forEach(([k, m]) => setErr(k, m));
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
    const entrants = toInt($("rq-q4").value);
    if (entrants === null) bad.push(["rq-q4", t("eQuiz")]);
    d.quiz = { sold: "", rented: "", managed: "", entrants: entrants };
    if (!d.consent) bad.push(["rf-consent", t("eRfConsent")]);
    bad.forEach(([k, m]) => setErr(k, m));
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
    $("thanks-steps").hidden = true;   // never show the 3 steps
    const raffleTxt = svc ? t("thanksRaffle") : t("rfRaffle");
    $("thanks-raffle").textContent = raffleTxt || "";
    $("thanks-raffle-box").hidden = !raffleTxt;
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
    $("lead-form").reset(); $("raffle-form").reset(); $("countdown").textContent = "";
    syncPropertyFields();
    if (auto && lang !== DEFAULT_LANG) lang = DEFAULT_LANG;   // next visitor starts in the default language
    applyLang(); show("v-start");
  }
  $("again").onclick = () => resetAll(false);

  buildQuiz();
  syncPropertyFields();
  applyLang();
})();
