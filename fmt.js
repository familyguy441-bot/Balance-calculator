/* Number display that mirrors the workbook's Excel number formats; non-finite values become a friendly blank (""). */
(function (g) {
  "use strict";
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function group(s) { var p = s.split("."); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ","); return p.join("."); }
  function fixed(v, minD, maxD, grp) {
    var s = Math.abs(v).toFixed(maxD);
    if (maxD > minD) { s = s.replace(/0+$/, ""); var d = (s.split(".")[1] || "").length; if (d < minD) s = Math.abs(v).toFixed(minD); s = s.replace(/\.$/, ""); }
    if (grp) s = group(s);
    var neg = v < 0 && /[1-9]/.test(s);
    return (neg ? "−" : "") + s;
  }
  function excel(v, fmt) {
    if (!isNum(v)) return "";
    fmt = fmt || "General";
    if (fmt === "General") return general(v);
    var m;
    if ((m = /^0(?:\.(0+))?E\+00$/.exec(fmt))) {
      var d = m[1] ? m[1].length : 0, s = v.toExponential(d).split("e"), ex = parseInt(s[1], 10);
      return s[0].replace("-", "−") + "E" + (ex < 0 ? "−" : "+") + (Math.abs(ex) < 10 ? "0" : "") + Math.abs(ex);
    }
    var pct = /%$/.test(fmt); if (pct) { v = v * 100; fmt = fmt.slice(0, -1); }
    var dec = fmt.split(".")[1] || "", minD = (dec.match(/0/g) || []).length, maxD = minD + (dec.match(/#/g) || []).length;
    return fixed(v, minD, maxD, fmt.indexOf(",") >= 0) + (pct ? " %" : "");
  }
  function general(v) {
    if (v === 0) return "0";
    var a = Math.abs(v);
    if (a >= 1e11 || a < 1e-5) return excel(v, "0.0000E+00");
    return fixed(v, 0, Math.max(0, 9 - Math.floor(Math.log10(a))), false);
  }
  /* Converter results: 7 significant figures, grouped, scientific for very large / very small values. */
  function sig(v) {
    if (!isNum(v)) return "";
    if (v === 0) return "0";
    var a = Math.abs(v);
    if (a >= 1e12 || a < 1e-5) return excel(v, "0.00000E+00");
    var dp = Math.max(0, 6 - Math.floor(Math.log10(a)));
    return fixed(Number(v.toPrecision(7)), 0, Math.min(dp, 12), true);
  }
  function full(v) { return isNum(v) ? String(Number(v.toPrecision(15))) : ""; }
  var API = { excel: excel, sig: sig, full: full, isNum: isNum };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else g.BC_FMT = API;
})(this);
