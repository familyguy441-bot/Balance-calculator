/* Balancing & Vibration Calculator - calculation engine.
   Every formula is a direct port of the v2 workbook (spec.py). Blank / invalid inputs arrive as NaN
   and propagate, so any result the workbook would show as "" (IFERROR / ISBLANK) comes out NaN here
   and the UI shows a friendly blank. */
(function (g) {
  "use strict";
  var PI = Math.PI, G0 = 9.80665, LB = 0.45359237, OZ = 28.349523125, IN = 25.4, LBF = 4.4482216152605;
  var OZIN = OZ * IN; // g·mm per oz-in
  var SQ2 = Math.sqrt(2);
  var DATA = (typeof module !== "undefined" && module.exports) ? require("./data.js") : g.BC_DATA;

  function rad(d) { return d * PI / 180; }
  function deg(r) { return r * 180 / PI; }
  function mod(a, n) { return a - n * Math.floor(a / n); }           // Excel MOD (sign of divisor)
  function atan2x(x, y) { return (x === 0 && y === 0) ? NaN : Math.atan2(y, x); } // Excel ATAN2(x,y); #DIV/0 at origin
  function num(v) { return typeof v === "number" && isFinite(v); }
  function fin(v) { return num(v) ? v : NaN; }

  var GRADES = {}, GRADE_APP = {}, MATS = {};
  DATA.lists.Grades.forEach(function (r) { GRADES[r[0]] = r[1]; GRADE_APP[r[0]] = r[2]; });
  DATA.lists.Mat.forEach(function (r) { MATS[r[0]] = [r[1], r[2]]; });

  var C = {};

  C.bal = function (p) {
    var o = {};
    var rmm = p.r * (p.ru === "in" ? 25.4 : 1);
    o.G = (p.grade in GRADES) ? GRADES[p.grade] : NaN;
    o.mkg = p.m * (p.mu === "lb" ? LB : 1);
    o.w = 2 * PI * p.n / 60;
    o.U = 1000 * o.G * o.mkg / o.w;
    o.Uoz = o.U / OZIN;
    o.e = o.U / o.mkg;
    o.emil = o.e / 25.4;
    o.L = p.la + p.lb;
    var rA = p.lb / o.L, rB = p.la / o.L;
    o.sA = p.lim === "Yes" ? Math.min(0.7, Math.max(0.3, rA)) : rA;
    o.sB = p.lim === "Yes" ? Math.min(0.7, Math.max(0.3, rB)) : rB;
    o.UA = o.U * o.sA; o.UAoz = o.UA / OZIN;
    o.UB = o.U * o.sB; o.UBoz = o.UB / OZIN;
    o.mA = o.UA / rmm; o.mB = o.UB / rmm;
    if (num(p.la) && num(p.lb) && p.la > 0 && p.lb > 0) {
      var s = p.lb / (p.la + p.lb);
      o.chk = (s > 0.7 || s < 0.3)
        ? (p.lim === "Yes" ? "Raw split outside 30/70 - limited per ISO 21940-11" : "Raw split outside 30/70 - ISO recommends limiting")
        : "Split within 30-70 % - no limiting needed";
    } else o.chk = "";
    o.app = GRADE_APP[p.grade] || "";
    return o;
  };

  C.force = function (p) {
    var o = {};
    o.Ug = p.U * (p.uu === "oz-in" ? OZIN : 1);
    o.Ukgm = o.Ug / 1000000;
    o.w = 2 * PI * p.n / 60;
    o.F = o.Ukgm * o.w * o.w;
    o.Flbf = o.F / LBF;
    o.Wt = p.m * (p.mu === "lb" ? LB : 1) * G0;
    o.pct = o.F / o.Wt;
    o.chk = num(o.pct) ? (o.pct <= 0.1 ? "F ≤ 10 % of rotor weight (common rule-of-thumb limit)"
                                       : "F > 10 % of rotor weight - exceeds common rule-of-thumb limit") : "";
    return o;
  };

  C.corr = function (p) {
    var o = {};
    o.mg = p.U * (p.uu === "oz-in" ? OZIN : 1) / (p.r * (p.ru === "in" ? 25.4 : 1));
    o.moz = o.mg / OZ;
    o.U2 = p.w2 * (p.wu === "oz" ? OZ : 1) * p.r2 * (p.r2u === "in" ? 25.4 : 1);
    o.U2oz = o.U2 / OZIN;
    o.cgo = p.cg / OZIN;
    o.cog = p.co * OZIN;
    return o;
  };

  var VIBTYPES = DATA.lists.VibType;
  C.vib = function (p) {
    var o = {};
    o.fHz = p.fu === "Hz" ? p.f : p.f / 60;
    o.w = 2 * PI * o.fHz;
    var x = p.x, w = o.w;
    switch (VIBTYPES.indexOf(p.vt)) {
      case 0: o.vpk = x / 1000 * w / 2; break;
      case 1: o.vpk = x * 0.0254 * w / 2; break;
      case 2: o.vpk = x * SQ2; break;
      case 3: o.vpk = x; break;
      case 4: o.vpk = x * 25.4; break;
      case 5: o.vpk = x * 25.4 * SQ2; break;
      case 6: o.vpk = x * G0 / w * 1000; break;
      case 7: o.vpk = x * G0 * SQ2 / w * 1000; break;
      case 8: o.vpk = x / w * 1000; break;
      case 9: o.vpk = x * SQ2 / w * 1000; break;
      default: o.vpk = NaN;
    }
    o.dpp = 2 * o.vpk / w * 1000;
    o.dpk = o.dpp / 2;
    o.dmil = o.dpp / 25.4;
    o.vrms = o.vpk / SQ2;
    o.vin = o.vpk / 25.4;
    o.vinr = o.vrms / 25.4;
    o.apk = o.vpk / 1000 * w;
    o.arms = o.apk / SQ2;
    o.gpk = o.apk / G0;
    o.grms = o.arms / G0;
    return o;
  };

  var SPDU = DATA.lists.SpdU;
  C.speed = function (p) {
    var o = {};
    var dm = p.d * (p.du === "in" ? 0.0254 : 0.001);
    var i = SPDU.indexOf(p.su);
    o.rpm = i === 0 ? p.s : i === 1 ? p.s * 60 : i === 2 ? p.s * 60 / (2 * PI) : NaN;
    o.hz = o.rpm / 60;
    o.w = o.rpm * 2 * PI / 60;
    o.per = 1000 / o.hz;
    o.vs = PI * dm * o.hz;
    o.vsf = o.vs / 0.3048 * 60;
    o.ac = o.w * o.w * dm / 2;
    o.acg = o.ac / G0;
    return o;
  };

  var BASIS = DATA.lists.Basis;
  C.crit = function (p, blank) {
    blank = blank || {};
    var o = {};
    var k_ = p.lu === "in" ? 0.0254 : 0.001;
    var Lm = p.L * k_, Dm = p.D * k_, dm = p.di * k_, am = p.a * k_;
    var Im = PI / 64 * (Math.pow(Dm, 4) - Math.pow(dm, 4));
    var Am = PI / 4 * (Dm * Dm - dm * dm);
    var mdk = p.md * (p.mdu === "lb" ? LB : 1);
    var mat = MATS[p.mat];
    o.E = p.mat === "Custom" ? p.Ec : (mat ? mat[0] : NaN);
    o.rho = p.mat === "Custom" ? p.rc : (mat ? mat[1] : NaN);
    var Epa = o.E * 1e9;
    o.I = Im * 1e12;
    o.ms = o.rho * Am * Lm;
    o.ns = Math.pow(PI / Lm, 2) * Math.sqrt(Epa * Im / (o.rho * Am)) * 60 / (2 * PI);
    o.k = 3 * Epa * Im * Lm / (am * am * Math.pow(Lm - am, 2)) / 1000;
    o.kus = o.k * 1000 * 0.0254 / LBF;
    o.nd = Math.sqrt(o.k * 1000 / mdk) * 60 / (2 * PI);
    o.ndk = mdk > 0 ? 1 / Math.sqrt(1 / (o.ns * o.ns) + 1 / (o.nd * o.nd)) : o.ns;
    var b = BASIS.indexOf(p.basis);
    o.nc = b === 0 ? o.ns : b === 1 ? o.nd : b === 2 ? o.ndk : NaN;
    o.fc = o.nc / 60;
    o.ratio = p.nop / o.nc;
    o.sm = Math.abs(o.nc - p.nop) / p.nop;
    var r = fin(o.ratio);
    o.cls = num(r) ? (r < 0.7 ? "RIGID - n_op < 70 % of 1st critical: low-speed balancing per ISO 21940-11 normally adequate"
      : r < 1 ? "FLEXIBLE / NEAR-CRITICAL - n_op ≥ 70 % of 1st critical: consider ISO 21940-12 high-speed balancing"
      : "FLEXIBLE (SUPERCRITICAL) - operates above 1st critical: ISO 21940-12 high-speed balancing") : "";
    var diNum = num(p.di) && !blank.di, DNum = num(p.D);
    if (diNum && DNum && p.di >= p.D) o.chk = "Bore must be smaller than the outside diameter";
    else if (mdk > 0 && (!(p.a > 0) || p.a >= (num(p.L) ? p.L : 0))) o.chk = "Disc position must lie between the bearings (0 < a < L)";
    else if (p.mat === "Custom" && (!num(p.Ec) || blank.Ec || !num(p.rc) || blank.rc)) o.chk = "Enter custom E and density";
    else o.chk = "Inputs OK";
    return o;
  };

  C.trial = function (p) {
    var o = {};
    var wtg = p.wt * (p.wtu === "oz" ? OZ : 1);
    var rtm = p.rt * (p.rtu === "in" ? 25.4 : 1), rcm = p.rcw * (p.rtu === "in" ? 25.4 : 1);
    var ex = p.t * Math.cos(rad(p.pt)) - p.o * Math.cos(rad(p.po));
    var ey = p.t * Math.sin(rad(p.pt)) - p.o * Math.sin(rad(p.po));
    o.E = Math.sqrt(ex * ex + ey * ey);
    o.pE = mod(deg(atan2x(ex, ey)), 360);
    o.alpha = o.E / wtg;
    o.pal = mod(o.pE - p.at, 360);
    var wc0 = p.o / o.alpha;
    o.wc = wc0 * rtm / rcm;
    o.wcoz = o.wc / OZ;
    o.ac = mod(p.po + 180 - o.pal, 360);
    var cx = wc0 * Math.cos(rad(o.ac)) - wtg * Math.cos(rad(p.at));
    var cy = wc0 * Math.sin(rad(o.ac)) - wtg * Math.sin(rad(p.at));
    o.wa = Math.sqrt(cx * cx + cy * cy) * rtm / rcm;
    o.aa = mod(deg(atan2x(cx, cy)), 360);
    o.chk = (num(o.E) && p.o > 0) ? (o.E / p.o >= 0.25 ? "Trial response OK (|T − O| ≥ 25 % of O)"
      : "Weak trial response (< 25 % of O) - use a larger trial weight") : "";
    return o;
  };

  /* Input validation exactly as the workbook's data-validation rules. Returns "" when OK. */
  var DV_MSG = { pos: "Enter a number greater than 0.", nonneg: "Enter a number of 0 or more.",
                 angle: "Enter an angle between -360 and 360 degrees.", num: "Enter a number." };
  function parseNum(s) {
    if (s === null || s === undefined) return null;
    s = String(s).trim().replace(/\s/g, "");
    if (s === "") return null;
    if (/^[-+]?(\d+[.,]?\d*|[.,]\d+)(e[-+]?\d+)?$/i.test(s)) return parseFloat(s.replace(",", "."));
    return NaN;
  }
  function validate(dv, v) {
    if (v === null) return "";
    if (!num(v)) return DV_MSG.num;
    if (dv === "pos" && !(v > 0)) return DV_MSG.pos;
    if (dv === "nonneg" && !(v >= 0)) return DV_MSG.nonneg;
    if (dv === "angle" && !(v >= -360 && v <= 360)) return DV_MSG.angle;
    if (Math.abs(v) > 1e15) return DV_MSG.num;
    return "";
  }

  /* Build the numeric parameter object from raw (string or number) inputs per the spec:
     required blank/invalid -> NaN (results blank, like the workbook's ISBLANK guard), optional blank -> 0. */
  function calcById(id) { for (var i = 0; i < DATA.calcs.length; i++) if (DATA.calcs[i].id === id) return DATA.calcs[i]; }
  function prepare(id, raw) {
    var calc = calcById(id), p = {}, blank = {}, errors = {};
    calc.rows.forEach(function (r) {
      if (r.kind === "in") {
        var v = typeof raw[r.key] === "number" ? raw[r.key] : parseNum(raw[r.key]);
        var err = validate(r.dv, v);
        if (err) { errors[r.key] = err; p[r.key] = NaN; }
        else if (v === null) { blank[r.key] = true; p[r.key] = r.opt ? 0 : NaN; }
        else p[r.key] = v;
      } else if (r.kind === "dd") p[r.key] = raw[r.key];
      if (r.unit && typeof r.unit === "object" && r.unit.dd) p[r.unit.dd] = raw[r.unit.dd];
    });
    return { p: p, blank: blank, errors: errors };
  }
  function compute(id, raw) {
    var pr = prepare(id, raw);
    var out = C[id](pr.p, pr.blank);
    return { out: out, errors: pr.errors };
  }

  function convert(cat, v, from, to) {
    var units = DATA.convCats[cat].units, f = null, t = null;
    units.forEach(function (u) { if (u.u === from) f = u.f; if (u.u === to) t = u.f; });
    if (v === null || !num(v) || f === null || t === null) return NaN;
    return v * f / t;
  }
  function factor(cat, from, to) { return convert(cat, 1, from, to); }

  var API = { calc: C, compute: compute, prepare: prepare, convert: convert, factor: factor,
              parseNum: parseNum, validate: validate, num: num, DV_MSG: DV_MSG };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else g.BC_CALC = API;
})(this);
