/* Balancing & Vibration Calculator - UI. Plain vanilla JS, no dependencies. */
(function () {
  "use strict";
  var D = window.BC_DATA, C = window.BC_CALC, F = window.BC_FMT;
  var VERSION = "3.0.0";
  var LS = "ahbc.v2.";
  var view = document.getElementById("view");
  var $ = function (s, r) { return (r || document).querySelector(s); };

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function calcById(id) { for (var i = 0; i < D.calcs.length; i++) if (D.calcs[i].id === id) return D.calcs[i]; }
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(function () { t.classList.remove("show"); }, 1800); }

  /* ---------- state (remembered in localStorage) ---------- */
  function defaults(calc) {
    var s = { in: {}, conv: [] };
    calc.rows.forEach(function (r) {
      if (r.kind === "in") s.in[r.key] = String(r.default);
      if (r.kind === "dd") s.in[r.key] = r.default;
      if (r.unit && typeof r.unit === "object" && r.unit.dd) s.in[r.unit.dd] = r.unit.default;
    });
    calc.conv.forEach(function (cv) { s.conv.push({ v: String(cv.val), frm: cv.frm, to: cv.to }); });
    return s;
  }
  function load(calc) {
    var s = defaults(calc);
    try {
      var saved = JSON.parse(localStorage.getItem(LS + calc.id) || "null");
      if (saved && saved.in) {
        for (var k in s.in) if (typeof saved.in[k] === "string") s.in[k] = saved.in[k];
        (saved.conv || []).forEach(function (c, i) { if (s.conv[i] && c) { s.conv[i].v = String(c.v == null ? "" : c.v); s.conv[i].frm = c.frm; s.conv[i].to = c.to; } });
      }
    } catch (e) { /* ignore corrupt storage */ }
    // drop any saved dropdown value that is no longer a valid option
    calc.rows.forEach(function (r) {
      if (r.kind === "dd" && optionsFor(r.lst).indexOf(s.in[r.key]) < 0) s.in[r.key] = r.default;
      if (r.unit && r.unit.dd && D.lists[r.unit.list].indexOf(s.in[r.unit.dd]) < 0) s.in[r.unit.dd] = r.unit.default;
    });
    s.conv.forEach(function (c, i) {
      var us = D.convCats[calc.conv[i].cat].units.map(function (u) { return u.u; });
      if (us.indexOf(c.frm) < 0) c.frm = calc.conv[i].frm; if (us.indexOf(c.to) < 0) c.to = calc.conv[i].to;
    });
    return s;
  }
  function save(calc, s) { try { localStorage.setItem(LS + calc.id, JSON.stringify(s)); } catch (e) {} }
  function optionsFor(lst) { return D.lists[lst].map(function (o) { return Array.isArray(o) ? o[0] : o; }); }
  function optionLabel(lst, o) {
    if (lst === "Grades") return o[0] + "  -  " + o[2];
    if (lst === "Mat") return o[1] ? o[0] + "  (E " + o[1] + " GPa, ρ " + o[2] + ")" : o[0];
    if (lst === "DMat") return o[1] ? o[0] + "  (ρ " + o[1].toFixed(2) + " g/cm³)" : o[0];
    return Array.isArray(o) ? o[0] : o;
  }

  /* ---------- units ---------- */
  function unitOf(r, s) {
    var u = r.unit;
    if (u === undefined || u === null) return "";
    if (typeof u === "string") return u;
    if (u.dd) return s.in[u.dd];
    if (u.ref) return s.in[u.ref];
    return "";
  }
  function uname(calc, r, s) {
    if (r.uname) return r.uname;
    if (r.kind === "dd") return "";
    var u = unitOf(r, s);
    if (!u) return "";
    return D.unames[u] || u;
  }

  /* ---------- message classification for check rows ---------- */
  function msgClass(key, text) {
    if (!text) return "empty";
    if (key === "app" || key === "acc") return "note";
    if (key === "tchk") return /^DRILL EACH/i.test(text) ? "ok" : "warn";
    var t = text.toUpperCase();
    if (/^RIGID|INPUTS OK|TRIAL RESPONSE OK|WITHIN 30-70|≤ 10 %/.test(t)) return "ok";
    if (/SUPERCRITICAL|EXCEEDS|WEAK|MUST|ENTER CUSTOM|ENTER A CUSTOM|BETWEEN THE BEARINGS/.test(t)) return "bad";
    return "warn";
  }
  var ICON = { ok: "✓", warn: "!", bad: "!", note: "i", empty: "–" };

  /* ---------- router ---------- */
  var current = null;
  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    var parts = h.split("/");
    if (parts[0] === "calc" && calcById(parts[1])) renderCalc(calcById(parts[1]));
    else if (parts[0] === "about") renderAbout();
    else renderHome();
    window.scrollTo(0, 0);
    $("#toast").classList.remove("show");
  }
  window.addEventListener("hashchange", route);

  function setBar(title, no, isHome) {
    $("#abTitle").textContent = title;
    var n = $("#abNo"); n.hidden = !no; n.textContent = no || "";
    $("#btnBack").hidden = isHome;
    document.title = isHome ? "Balancing & Vibration Calculator" : title + " - Balancing Calc";
  }
  $("#btnBack").addEventListener("click", function () { location.hash = "#/"; });
  $("#btnReset").addEventListener("click", function () {
    if (current && current.calc) {
      if (!confirm("Reset all inputs and converters on \"" + current.calc.short + "\" to the default values?")) return;
      localStorage.removeItem(LS + current.calc.id); renderCalc(current.calc); toast("Reset to defaults");
    } else {
      if (!confirm("Reset every calculator to its default values?")) return;
      D.calcs.forEach(function (c) { localStorage.removeItem(LS + c.id); }); toast("All calculators reset");
    }
  });

  /* ---------- home ---------- */
  var deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferredPrompt = e; var b = $("#btnInstall"); if (b) b.hidden = false; });

  function renderHome() {
    current = null; setBar("Balancing Calculator", "", true);
    view.innerHTML = "";
    view.appendChild(el("div", { class: "hero" }, [
      el("h1", { text: "Balancing, Vibration & High-Speed Rotor Calculator" }),
      el("p", { text: "American Hofmann field edition · mirrors workbook v3. Pick a calculator below." }),
      el("div", { class: "legend" }, [el("span", { class: "lg-in", text: "Input" }), el("span", { class: "lg-out", text: "Result" }), el("span", { class: "lg-key", text: "Key result" })])
    ]));
    var list = el("nav", { class: "card", "aria-label": "Calculators" });
    D.calcs.forEach(function (c) {
      var convs = c.conv.map(function (cv) { return D.convCats[cv.cat].name.split(" /")[0].toLowerCase(); }).join(", ");
      list.appendChild(el("a", { class: "item", href: "#/calc/" + c.id }, [
        el("span", { class: "num", text: String(c.no) }),
        el("span", { class: "it" }, [el("b", { text: c.short }), el("small", { text: c.sub }), el("small", { text: "Converter: " + convs + "." })]),
        el("span", { class: "chev", html: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>' })
      ]));
    });
    view.appendChild(list);
    var standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    view.appendChild(el("div", { class: "links" }, [
      el("button", { class: "lbtn primary", id: "btnInstall", hidden: !deferredPrompt, onclick: function () {
        if (!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt.userChoice.then(function () { deferredPrompt = null; $("#btnInstall").hidden = true; });
      } }, ["Install app on this phone"]),
      el("a", { class: "lbtn", href: "#/about" }, [standalone ? "References & assumptions" : "References, assumptions & how to install"])
    ]));
    view.appendChild(el("p", { class: "foot", html: "Inputs are remembered on this device. ↺ (top right) resets to defaults.<br>Works offline once loaded · v" + VERSION }));
  }

  /* ---------- about / references ---------- */
  function renderAbout() {
    current = null; setBar("References & help", "", false);
    view.innerHTML = "";
    var p = el("div", { class: "prose" });
    p.innerHTML =
      "<h3>Install on your phone</h3>" +
      "<p><b>iPhone / iPad (Safari):</b> open the app link, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</p>" +
      "<p><b>Android (Chrome):</b> open the link, tap <b>Install app</b> on the home screen of this calculator, or ⋮ menu → <b>Install app / Add to Home screen</b>.</p>" +
      "<p>After the first visit everything is stored on the phone, so it works with no signal.</p>" +
      "<h3>How to use</h3><ul><li>Yellow boxes are inputs; green boxes are results and can't be edited.</li>" +
      "<li>Tap <b>i</b> on any line for a plain-English description, the formula and the full-precision value.</li>" +
      "<li>Each calculator ends with its own unit converter.</li><li>Your last inputs are remembered; ↺ resets to defaults.</li></ul>" +
      "<h3>Assumptions</h3><p>Rigid bearings and supports; Euler-Bernoulli beam (no shear, no gyroscopic stiffening); disc treated as a point mass; vibration conversions valid for a single sinusoid only. Drill removal: ideal cylinder + drill-point cone with typical handbook densities - drill wander, chamfers, burrs, voids and coatings are not modelled, so treat it as an estimate and re-check the balance.</p>" +
      "<p>Not included: tolerance transfer to non-bearing correction planes and outboard / overhung rotors (ISO 21940-11 cl. 7.3+), two-plane influence-coefficient balancing, bearing / support stiffness in critical speeds, ISO 21940-12 flexible-rotor tolerances.</p>" +
      "<h3>Verification</h3><p>The calculation engine is a direct port of workbook v3 and was checked against the workbook's own Verification sheet (469 cases) and a full LibreOffice recalculation of every result line in 4 input cases, all to a relative error below 1e-9.</p>";
    view.appendChild(p);
    view.appendChild(el("h2", { class: "sec", text: "Formulas & references" }));
    var box = el("div", { class: "card" }); var body = el("div", { class: "refbody", style: "border:0" });
    D.calcs.forEach(function (c) { c.refs.forEach(function (r) { body.appendChild(refEl(r, c.no + " · ")); }); });
    D.generalRefs.forEach(function (r) { body.appendChild(refEl(r, "")); });
    box.appendChild(body); view.appendChild(box);
    view.appendChild(el("p", { class: "foot", text: "Balancing & Vibration Calculator v" + VERSION + " · formulas mirror the Excel workbook v3" }));
  }
  function symEl(sym) {
    if (!sym) return null;
    var e = el("span", { class: "sym" }), i = sym.indexOf("_");
    if (i < 0) e.textContent = sym; else { e.appendChild(document.createTextNode(sym.slice(0, i))); e.appendChild(el("sub", { text: sym.slice(i + 1) })); }
    return e;
  }
  function refEl(r, pre) { return el("div", { class: "ref" }, [el("b", { text: pre + r.topic }), el("div", { class: "f", text: r.formula }), el("small", { text: r.source })]); }

  /* ---------- calculator screen ---------- */
  var uid = 0;
  function infoBtn(panel) {
    var b = el("button", { class: "info", type: "button", "aria-label": "More about this line", "aria-expanded": "false", text: "i" });
    b.addEventListener("click", function () { var open = panel.hidden; panel.hidden = !open; b.setAttribute("aria-expanded", String(open)); });
    return b;
  }
  function morePanel(r) {
    var m = el("div", { class: "more", hidden: true });
    if (r.desc) m.appendChild(el("p", { text: r.desc }));
    if (r.note) m.appendChild(el("p", { class: "f", text: r.note }));
    return m;
  }

  function renderCalc(calc) {
    var s = load(calc);
    var updaters = [];
    current = { calc: calc, s: s };
    setBar(calc.short, String(calc.no), false);
    view.innerHTML = "";
    view.appendChild(el("p", { class: "sub", text: calc.title + " - " + calc.sub }));
    var card = null, inputs = [];

    function persist() { save(calc, s); }
    function refresh() {
      var res = C.compute(calc.id, s.in);
      updaters.forEach(function (fn) { fn(res); });
    }

    calc.rows.forEach(function (r) {
      if (r.kind === "sec") {
        view.appendChild(el("h2", { class: "sec", text: r.label }));
        card = el("div", { class: "card" }); view.appendChild(card); return;
      }
      var id = "f" + (++uid), more = morePanel(r), row;
      if (r.kind === "in" || r.kind === "dd") {
        var field = el("div", { class: "field" }), ctl;
        if (r.kind === "dd") {
          ctl = el("select", { class: "inp", id: id });
          D.lists[r.lst].forEach(function (o) { var v = Array.isArray(o) ? o[0] : o; ctl.appendChild(el("option", { value: v, text: optionLabel(r.lst, o) })); });
          ctl.value = s.in[r.key];
          ctl.addEventListener("change", function () { s.in[r.key] = ctl.value; persist(); refresh(); });
          field.appendChild(ctl);
        } else {
          ctl = el("input", { class: "inp", id: id, type: "text", inputmode: "decimal", autocomplete: "off", autocorrect: "off", spellcheck: "false", enterkeyhint: "next", "aria-describedby": id + "e" });
          ctl.value = s.in[r.key];
          ctl.addEventListener("input", function () { s.in[r.key] = ctl.value; persist(); refresh(); });
          ctl.addEventListener("focus", function () { try { ctl.select(); } catch (e) {} });
          field.appendChild(ctl);
          if (r.dv === "angle") {
            field.appendChild(el("button", { class: "pm", type: "button", "aria-label": "Change sign", text: "±", onclick: function () {
              var v = ctl.value.trim(); ctl.value = v.charAt(0) === "-" ? v.slice(1) : (v ? "-" + v : "-"); s.in[r.key] = ctl.value; persist(); refresh(); } }));
          }
          inputs.push(ctl);
          var u = r.unit;
          if (u && typeof u === "object" && u.dd) {
            var us = el("select", { class: "inp unit", "aria-label": "Unit for " + r.label });
            D.lists[u.list].forEach(function (o) { us.appendChild(el("option", { value: o, text: o })); });
            us.value = s.in[u.dd];
            us.addEventListener("change", function () { s.in[u.dd] = us.value; persist(); refresh(); });
            field.appendChild(us);
          } else if (u) {
            var fx = el("span", { class: "ufix" }); field.appendChild(fx);
            updaters.push(function () { fx.textContent = unitOf(r, s); });
          }
        }
        var un = el("div", { class: "uname" }), er = el("div", { class: "err", id: id + "e", hidden: true });
        row = el("div", { class: "row in" + (r.kind === "dd" ? " dd" : "") }, [
          el("div", { class: "ih" }, [el("label", { class: "lab", for: id }, [r.label, symEl(r.sym), r.opt ? el("span", { class: "optional", text: "optional" }) : null]), un]),
          field, infoBtn(more), er, more]);
        updaters.push(function (res) {
          un.textContent = uname(calc, r, s); un.hidden = !un.textContent;
          if (r.kind === "in") {
            var e = res.errors[r.key] || ""; er.textContent = e; er.hidden = !e; ctl.classList.toggle("bad", !!e);
            if (calc.id === "crit" && (r.key === "Ec" || r.key === "rc")) row.classList.toggle("dim", s.in.mat !== "Custom");
            if (calc.id === "drill" && r.key === "rc") row.classList.toggle("dim", s.in.mat !== "Custom");
            if (calc.id === "drill" && r.key === "dc") row.classList.toggle("dim", s.in.dsel !== optionsFor("DrillSz").slice(-1)[0]);
          }
        });
      } else if (r.kind === "out") {
        var out = el("output", { for: "" }), ue = el("span", { class: "u" }), box = el("div", { class: "res" }, [out, ue]);
        var un2 = el("div", { class: "uname" }), fv = el("p", { class: "fv" });
        more.appendChild(fv);
        row = el("div", { class: "row out" + (r.hi ? " key" : "") }, [
          el("div", { class: "rh" }, [el("div", { class: "lb" }, [el("div", { class: "lab" }, [r.label.trim(), symEl(r.sym)]), un2]), box, infoBtn(more)]),
          more]);
        updaters.push(function (res) {
          var v = res.out[r.key], txt = F.excel(v, r.fmt);
          var unit = unitOf(r, s);
          out.textContent = txt || "—"; box.classList.toggle("blank", !txt);
          ue.textContent = /%$/.test(r.fmt) ? "" : unit;
          un2.textContent = uname(calc, r, s);
          fv.textContent = txt ? "Full value: " + F.full(/%$/.test(r.fmt) ? v * 100 : v) + (/%$/.test(r.fmt) ? " %" : (unit ? " " + unit : "")) : "Enter valid inputs above to see this result.";
          box.setAttribute("aria-label", r.label.trim() + ": " + (txt ? txt + " " + unit : "no result"));
        });
      } else if (r.kind === "txt") {
        var msg = el("div", { class: "msg", role: "status" }), ic = el("span", { class: "ic" }), mt = el("span");
        msg.appendChild(ic); msg.appendChild(mt);
        row = el("div", { class: "row txt" }, [el("div", { class: "rh" }, [el("div", { class: "lab", text: r.label }), infoBtn(more)]), msg, more]);
        updaters.push(function (res) {
          var t = res.out[r.key] || "", k = msgClass(r.key, t);
          msg.className = "msg " + k; ic.textContent = ICON[k]; mt.textContent = t || "Complete the inputs to see this check.";
        });
      }
      card.appendChild(row);
    });

    // Enter / Go jumps to the next input, like Tab / Enter in the workbook
    function chainEnter(list) {
      list.forEach(function (inp, i) {
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); if (list[i + 1]) list[i + 1].focus(); else inp.blur(); }
        });
      });
    }

    // ---------- per-tab unit converter ----------
    view.appendChild(el("h2", { class: "sec", text: "Unit converter" }));
    var cc = el("div", { class: "card" }); view.appendChild(cc);
    var convInputs = [];
    calc.conv.forEach(function (cv, i) {
      var cat = D.convCats[cv.cat], st = s.conv[i];
      var vin = el("input", { class: "inp", type: "text", inputmode: "decimal", autocomplete: "off", spellcheck: "false", enterkeyhint: "next", "aria-label": cat.name + " value" });
      vin.value = st.v;
      function sel(val, lab) {
        var x = el("select", { class: "inp unit", "aria-label": lab });
        cat.units.forEach(function (u) { x.appendChild(el("option", { value: u.u, text: u.u })); });
        x.value = val; return x;
      }
      var sf = sel(st.frm, "From unit"), stu = sel(st.to, "To unit");
      var res = el("div", { class: "cres", role: "status" }), fac = el("div", { class: "cfac" }), err = el("div", { class: "err", hidden: true });
      var swap = el("button", { class: "swap", type: "button", "aria-label": "Swap units", html: '<svg viewBox="0 0 24 24"><path d="M7 4v16M7 20l-3.5-3.5M7 20l3.5-3.5M17 20V4M17 4l-3.5 3.5M17 4l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
      function name(u) { for (var j = 0; j < cat.units.length; j++) if (cat.units[j].u === u) return cat.units[j].name; return ""; }
      function upd() {
        var raw = C.parseNum(vin.value), bad = raw !== null && !C.num(raw);
        var v = C.convert(cv.cat, raw, sf.value, stu.value), t = F.sig(v);
        res.textContent = t || "—"; res.classList.toggle("blank", !t);
        err.hidden = !bad; err.textContent = bad ? C.DV_MSG.num : ""; vin.classList.toggle("bad", bad);
        fac.textContent = "1 " + sf.value + " (" + name(sf.value) + ") = " + F.sig(C.factor(cv.cat, sf.value, stu.value)) + " " + stu.value + " (" + name(stu.value) + ")";
        st.v = vin.value; st.frm = sf.value; st.to = stu.value; persist();
      }
      vin.addEventListener("input", upd); sf.addEventListener("change", upd); stu.addEventListener("change", upd);
      vin.addEventListener("focus", function () { try { vin.select(); } catch (e) {} });
      swap.addEventListener("click", function () { var a = sf.value; sf.value = stu.value; stu.value = a; upd(); });
      convInputs.push(vin);
      cc.appendChild(el("div", { class: "conv" }, [
        el("h3", {}, [el("span", { text: cat.name }), swap]),
        el("div", { class: "cd", text: D.convDesc[cv.cat] }),
        el("div", { class: "cgrid" }, [vin, sf, res, stu]),
        err, fac]));
      upd();
    });
    chainEnter(inputs); chainEnter(convInputs);

    // ---------- formulas & references (tucked away) ----------
    var refs = el("details", { class: "refs" }, [el("summary", { text: "Formulas & references" })]);
    var rb = el("div", { class: "refbody" });
    calc.refs.forEach(function (r) { rb.appendChild(refEl(r, "")); });
    D.generalRefs.forEach(function (r) { rb.appendChild(refEl(r, "")); });
    refs.appendChild(rb); view.appendChild(refs);

    // ---------- previous / next ----------
    var i = D.calcs.indexOf(calc), prev = D.calcs[i - 1], next = D.calcs[i + 1];
    view.appendChild(el("div", { class: "pn" }, [
      prev ? el("a", { class: "lbtn", href: "#/calc/" + prev.id, text: "◀ " + prev.short }) : el("a", { class: "lbtn", href: "#/", text: "⌂ Home" }),
      next ? el("a", { class: "lbtn", href: "#/calc/" + next.id, text: next.short + " ▶" }) : el("a", { class: "lbtn", href: "#/", text: "⌂ Home" })
    ]));
    refresh();
  }

  route();

  /* ---------- offline support (service worker needs https or localhost; skipped for file://) ---------- */
  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol) && !window.BC_STANDALONE) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
