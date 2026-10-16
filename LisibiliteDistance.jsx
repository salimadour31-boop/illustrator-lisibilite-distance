//@target illustrator
/*
 * LisibiliteDistance.jsx — v1.0.0
 * Contrôle de lisibilité à distance / Viewing-distance legibility check
 *
 * FR : Pour la signalétique, les panneaux, affiches, kakémonos, bâches, vitrines, stands,
 *      écrans et diapositives : mesure la VRAIE hauteur des lettres de chaque texte une fois
 *      imprimé (hauteur de capitale « H », hauteur d'x en option, hauteur de l'alif pour
 *      l'arabe, mesurées sur la police réelle), en tenant compte du corps, de l'échelle
 *      verticale, de la mise à l'échelle du bloc, de l'échelle du document (1:4, 1:10…) et
 *      du facteur des documents grand format. Compare à la distance de lecture prévue
 *      (globale, ou par objet / par calque) selon un critère au choix : angle visuel
 *      (ISO 9241-303 : 16′ minimum, 20′ confortable, ou personnalisé), règle « 1 pouce par
 *      10 pieds », ou tableau ADA 2010 §703.5.5 (hauteur de pose). Indique pour chaque texte
 *      la distance maximale de lecture, le corps minimal conseillé, signale les traits trop
 *      fins pour être vus, pose des repères sur un calque non imprimable, sélectionne les
 *      textes trop petits et peut les agrandir.
 * EN : For signage, panels, posters, roll-ups, banners, windows, booths, screens and slides:
 *      measures the REAL printed letter height of every text (cap height "H", optional
 *      x-height, alef height for Arabic, measured on the actual font), taking into account
 *      point size, vertical scale, text-frame scaling, document scale (1:4, 1:10…) and the
 *      large-canvas factor. Compares it to the planned viewing distance (global, or per
 *      object / per layer) with a chosen criterion: visual angle (ISO 9241-303: 16′ minimum,
 *      20′ comfortable, or custom), "1 inch per 10 feet" rule, or ADA 2010 §703.5.5 table
 *      (mounting height). Reports the maximum reading distance and minimum advised point
 *      size of each text, flags strokes too thin to be seen, places markers on a non-printing
 *      layer, selects texts that are too small and can enlarge them.
 *
 * Auteur / Author : Amirouche Amwanes — Licence MIT / MIT License
 * Cible / Target : Adobe Illustrator CC 2018+ (ExtendScript ES3). Non testé dans Illustrator.
 * Aucun appel réseau, aucune collecte de données. / No network calls, no data collection.
 */

/* ===================================================================== */
/*  1. CŒUR DE CALCUL (pur, sans Illustrator) / PURE CALCULATION CORE     */
/* ===================================================================== */

var LD_CORE = (function () {

    var IN = 25.4, FT = 304.8, PT = 25.4 / 72;
    var ARCMIN = Math.PI / (180 * 60);

    // Hauteur (mm) vue sous un angle donné à une distance (mm) / height seen under an angle
    function heightForAngle(dMm, arcmin) { return 2 * dMm * Math.tan(arcmin * ARCMIN / 2); }
    function distanceForAngle(hMm, arcmin) { return hMm / (2 * Math.tan(arcmin * ARCMIN / 2)); }

    // ADA 2010, tableau 703.5.5 : bande selon la hauteur de la ligne de base au-dessus du sol
    // ADA 2010 table 703.5.5: band from baseline height above finish floor
    function adaBand(bMm) {
        if (!(bMm >= 40 * IN - 1e-6)) return null;                 // < 40 in : non conforme / not allowed
        if (bMm <= 70 * IN + 1e-6) return { base: 0.625 * IN, start: 72 * IN };
        if (bMm <= 120 * IN + 1e-6) return { base: 2 * IN, start: 180 * IN };
        return { base: 3 * IN, start: 21 * FT };
    }
    function adaRequired(dMm, bMm) {
        var b = adaBand(bMm);
        if (!b) return NaN;
        if (dMm < b.start) return b.base;
        return b.base + 0.125 * IN * (dMm - b.start) / FT;      // + 1/8 in par pied / per foot
    }
    function adaMaxDistance(hMm, bMm) {
        var b = adaBand(bMm);
        if (!b) return NaN;
        if (hMm < b.base - 1e-9) return 0;                         // trop petit même de près / too small even up close
        return b.start + (hMm - b.base) / (0.125 * IN) * FT;
    }

    /*
     * Critère / criterion : { mode: "angle", arcmin: 20 } | { mode: "rule" } | { mode: "ada", baseline: mm }
     */
    function required(crit, dMm, baselineMm) {
        if (crit.mode === "rule") return dMm / 120;                // 1 in / 10 ft = 1/120
        if (crit.mode === "ada") return adaRequired(dMm, baselineMm);
        return heightForAngle(dMm, crit.arcmin);
    }
    function maxDistance(crit, hMm, baselineMm) {
        if (crit.mode === "rule") return hMm * 120;
        if (crit.mode === "ada") return adaMaxDistance(hMm, baselineMm);
        return distanceForAngle(hMm, crit.arcmin);
    }

    // Statut / status : "ok" | "juste" (marge insuffisante / within margin) | "petit" (too small) | "ada" (pose < 40 in)
    function status(hMm, reqMm, marginPct) {
        if (isNaN(reqMm)) return "ada";
        if (hMm + 1e-9 < reqMm) return "petit";
        if (hMm + 1e-9 < reqMm * (1 + (marginPct || 0) / 100)) return "juste";
        return "ok";
    }

    // Hauteur réelle imprimée (mm) / real printed height (mm)
    function realHeight(sizePt, ratio, vScalePct, frameScale, factor) {
        return sizePt * ratio * (vScalePct / 100) * frameScale * factor * PT;
    }
    // Corps minimal (pt, arrondi au 0,5 supérieur) pour atteindre reqMm / minimal size reaching reqMm
    function sizeFor(reqMm, ratio, vScalePct, frameScale, factor) {
        var k = ratio * (vScalePct / 100) * frameScale * factor * PT;
        if (!(k > 0)) return NaN;
        var s = reqMm / k;
        return Math.ceil(s * 2 - 1e-9) / 2;
    }

    // Échelle verticale d'une matrice [a b c d] : longueur de l'image du vecteur (0,1)
    // vertical scale of a matrix: length of the image of the unit vector (0,1)
    function matrixVScale(a, b, c, d) {
        var s = Math.sqrt(c * c + d * d);
        return s > 0 ? s : 1;
    }

    var UNITS = { mm: 1, cm: 10, m: 1000, ft: FT, pi: FT, pieds: FT, pied: FT, "'": FT, "in": IN, po: IN, pouces: IN, pouce: IN, '"': IN };
    function toNum(s) { return parseFloat(String(s).replace(",", ".")); }
    function unitMm(u, def) {
        u = String(u || "").toLowerCase();
        if (u === "") u = def || "m";
        return UNITS.hasOwnProperty(u) ? UNITS[u] : NaN;
    }

    // Distance dans une note : « distance=12 », « d: 12 m », « dist = 40 ft »
    // distance in a note
    function parseNoteDistance(note, defUnit) {
        var m = /(?:^|[\s;,])(?:distance|dist|d)\s*[=:]\s*([0-9]+(?:[.,][0-9]+)?)\s*(mm|cm|m|ft|pieds|pied|pi|in|po|pouces|pouce|'|")?/i.exec(" " + String(note || ""));
        if (!m) return NaN;
        var v = toNum(m[1]) * unitMm(m[2], defUnit);
        return v > 0 ? v : NaN;
    }
    // Hauteur de pose dans une note : « hauteur=1,6 », « h: 160 cm »
    function parseNoteBaseline(note, defUnit) {
        var m = /(?:^|[\s;,])(?:hauteur|haut|height|h)\s*[=:]\s*([0-9]+(?:[.,][0-9]+)?)\s*(mm|cm|m|ft|pieds|pied|pi|in|po|pouces|pouce|'|")?/i.exec(" " + String(note || ""));
        if (!m) return NaN;
        var v = toNum(m[1]) * unitMm(m[2], defUnit);
        return v > 0 ? v : NaN;
    }
    // Distance dans un nom de calque : « Panneau hall [8 m] », « Façade [60ft] »
    // distance in a layer name
    function parseLayerDistance(name) {
        var m = /\[\s*([0-9]+(?:[.,][0-9]+)?)\s*(mm|cm|m|ft|pieds|pied|in|po)\s*\]/i.exec(String(name || ""));
        if (!m) return NaN;
        var v = toNum(m[1]) * unitMm(m[2], "m");
        return v > 0 ? v : NaN;
    }

    function isArabicCode(c) {
        return (c >= 0x0600 && c <= 0x06FF) || (c >= 0x0750 && c <= 0x077F) || (c >= 0x08A0 && c <= 0x08FF) ||
               (c >= 0xFB50 && c <= 0xFDFF) || (c >= 0xFE70 && c <= 0xFEFF);
    }
    // Classe les caractères d'un texte / classify characters
    function classify(s) {
        var r = { arabic: 0, upper: 0, lower: 0, digit: 0, other: 0 }, i, c, ch;
        s = String(s || "");
        for (i = 0; i < s.length; i++) {
            c = s.charCodeAt(i); ch = s.charAt(i);
            if (c <= 32 || c === 0xA0 || c === 0x2028 || c === 0x2029 || c === 3) continue;
            if (isArabicCode(c)) { if (c !== 0x0640 && !(c >= 0x064B && c <= 0x065F) && c !== 0x060C && c !== 0x061B && c !== 0x061F) r.arabic++; }
            else if (/[0-9]/.test(ch)) r.digit++;
            else if (ch.toLowerCase() !== ch) r.upper++;
            else if (ch.toUpperCase() !== ch) r.lower++;
            else r.other++;
        }
        return r;
    }
    /*
     * Glyphes de référence à mesurer pour un texte : "cap" (H), "x", "alef" (ا).
     * basis : "cap" (normes de signalétique : capitale) | "x" (hauteur d'x si bas de casse)
     * reference glyphs to measure: "cap", "x", "alef"
     */
    function refsFor(s, basis) {
        var k = classify(s), out = [];
        if (k.arabic) out.push("alef");
        if (k.upper || k.lower || k.digit || k.other) out.push(basis === "x" && k.lower ? "x" : "cap");
        return out;
    }
    var GLYPH = { cap: "H", x: "x", alef: "\u0627" };
    var FALLBACK = { cap: 0.70, x: 0.50, alef: 0.70 };      // si la mesure échoue / if measuring fails

    function isBlank(s) { return /^[\s\u00A0\u2028\u2029\u0003]*$/.test(String(s || "")); }

    // Nombre à la française (ou anglaise) / localized number
    function fmt(n, dec, fr) {
        if (isNaN(n)) return "–";
        if (n === Infinity) return "∞";
        var p = Math.pow(10, dec), s = String(Math.round(n * p) / p);
        if (dec > 0 && s.indexOf(".") < 0) { s += "."; var i; for (i = 0; i < dec; i++) s += "0"; }
        else if (dec > 0) { while (s.length - s.indexOf(".") - 1 < dec) s += "0"; }
        return fr ? s.replace(".", ",") : s;
    }
    // Distance lisible : m ou ft / readable distance
    function fmtDist(mm, unit, fr) {
        if (unit === "ft") return fmt(mm / FT, mm / FT < 10 ? 1 : 0, fr) + " ft";
        return fmt(mm / 1000, mm < 10000 ? 1 : 0, fr) + " m";
    }
    function fmtLen(mm, unit, fr) {
        if (unit === "ft") return fmt(mm / IN, 2, fr) + " in";
        return fmt(mm, mm < 10 ? 2 : 1, fr) + " mm";
    }

    return {
        IN: IN, FT: FT, PT: PT, heightForAngle: heightForAngle, distanceForAngle: distanceForAngle,
        adaBand: adaBand, adaRequired: adaRequired, adaMaxDistance: adaMaxDistance,
        required: required, maxDistance: maxDistance, status: status, realHeight: realHeight, sizeFor: sizeFor,
        matrixVScale: matrixVScale, toNum: toNum, unitMm: unitMm, parseNoteDistance: parseNoteDistance,
        parseNoteBaseline: parseNoteBaseline, parseLayerDistance: parseLayerDistance, classify: classify,
        refsFor: refsFor, GLYPH: GLYPH, FALLBACK: FALLBACK, isBlank: isBlank, fmt: fmt, fmtDist: fmtDist, fmtLen: fmtLen
    };
})();

/* ===================================================================== */
/*  2. LANGUE / LANGUAGE                                                  */
/* ===================================================================== */

var LD_FR = (function () {
    var l = "";
    try { l = String(app.locale || $.locale || ""); } catch (e) { try { l = String($.locale); } catch (e2) {} }
    return l.toLowerCase().indexOf("fr") === 0;
})();
function LD_T(fr, en) { return LD_FR ? fr : en; }

var LD_MARK_LAYER = "Lisibilité à distance – repères";
var LD_TMP_LAYER = "__LisibiliteDistance_tmp";

/* ===================================================================== */
/*  3. RÉGLAGES / SETTINGS                                                */
/* ===================================================================== */

function LD_defaults() {
    return {
        scope: "sel",         // "sel" | "doc"
        distance: "5",        // dans l'unité / in unit
        unit: "m",            // "m" | "ft"
        crit: "a20",          // "a20" | "a16" | "rule" | "ada" | "custom"
        arcmin: "20",
        baseline: "1.5",      // hauteur de pose ADA (unité) / ADA mounting height (unit)
        basis: "cap",         // "cap" | "x"
        scale: "1",           // document à l'échelle 1:N / document at scale 1:N
        useDocFactor: true,   // appliquer le facteur grand format / apply large-canvas factor
        margin: "10",         // % de marge pour « juste » / margin for "borderline"
        strokes: true,
        strokeArcmin: "1",
        labelOk: true,
        enlarge: false,
        action: "run"         // "run" | "analyze" | "clear"
    };
}

function LD_cfgFile() { return new File(Folder.userData + "/LisibiliteDistance.cfg"); }
function LD_loadCfg() {
    var c = LD_defaults(), f, line, k, v, p;
    try {
        f = LD_cfgFile();
        if (f.exists && f.open("r")) {
            while (!f.eof) {
                line = f.readln(); p = line.indexOf("=");
                if (p <= 0) continue;
                k = line.substring(0, p); v = line.substring(p + 1);
                if (!c.hasOwnProperty(k) || k === "action") continue;
                if (typeof c[k] === "boolean") c[k] = (v === "true"); else c[k] = v;
            }
            f.close();
        }
    } catch (e) {}
    return c;
}
function LD_saveCfg(c) {
    try {
        var f = LD_cfgFile(), k;
        if (f.open("w")) {
            for (k in c) if (c.hasOwnProperty(k) && k !== "action") f.writeln(k + "=" + String(c[k]));
            f.close();
        }
    } catch (e) {}
}

// Critère à partir des réglages / criterion from settings
function LD_criterion(c) {
    if (c.crit === "a16") return { mode: "angle", arcmin: 16 };
    if (c.crit === "a20") return { mode: "angle", arcmin: 20 };
    if (c.crit === "rule") return { mode: "rule" };
    if (c.crit === "ada") return { mode: "ada" };
    var a = LD_CORE.toNum(c.arcmin);
    return { mode: "angle", arcmin: a > 0 ? a : 20 };
}
function LD_critLabel(crit) {
    if (crit.mode === "rule") return LD_T("règle 1 pouce / 10 pieds", "1 inch / 10 feet rule");
    if (crit.mode === "ada") return "ADA 2010 §703.5.5";
    return LD_T("angle visuel ", "visual angle ") + LD_CORE.fmt(crit.arcmin, 1, LD_FR).replace(/[.,]0$/, "") + "\u2032";
}

// Valide les réglages : renvoie un message d'erreur ou "" / validates settings
function LD_validate(c) {
    var d = LD_CORE.toNum(c.distance), s = LD_CORE.toNum(c.scale);
    if (!(d > 0)) return LD_T("Distance de lecture invalide.", "Invalid viewing distance.");
    if (!(s > 0)) return LD_T("Échelle du document invalide (ex. 1, 4, 10).", "Invalid document scale (e.g. 1, 4, 10).");
    if (c.crit === "custom" && !(LD_CORE.toNum(c.arcmin) > 0)) return LD_T("Angle personnalisé invalide.", "Invalid custom angle.");
    if (c.crit === "ada" && !(LD_CORE.toNum(c.baseline) > 0)) return LD_T("Hauteur de pose invalide.", "Invalid mounting height.");
    if (c.strokes && !(LD_CORE.toNum(c.strokeArcmin) > 0)) return LD_T("Seuil des traits fins invalide.", "Invalid thin-stroke threshold.");
    return "";
}

/* ===================================================================== */
/*  4. COLLECTE DES OBJETS / COLLECTING ITEMS                             */
/* ===================================================================== */

function LD_isMarkLayer(L) { try { return L && L.typename === "Layer" && (L.name === LD_MARK_LAYER || L.name === LD_TMP_LAYER); } catch (e) { return false; } }

// Objet visible (lui et ses parents) et hors calque de repères / visible item, not in marker layer
function LD_visibleItem(it) {
    var p = it;
    try {
        while (p && p.typename !== "Document") {
            if (LD_isMarkLayer(p)) return false;
            if (p.typename === "Layer") { if (p.visible === false) return false; }
            else if (p.hidden === true) return false;
            p = p.parent;
        }
    } catch (e) {}
    return true;
}
function LD_isLocked(it) {
    var p = it;
    try {
        while (p && p.typename !== "Document") { if (p.locked === true) return true; p = p.parent; }
    } catch (e) {}
    return false;
}

function LD_collect(list, out, seen) {
    var i, it, t;
    for (i = 0; i < list.length; i++) {
        it = list[i]; t = it.typename;
        if (t === "TextFrame") out.texts.push(it);
        else if (t === "PathItem") out.paths.push(it);
        else if (t === "CompoundPathItem") { try { LD_collect(it.pathItems, out, seen); } catch (e) {} }
        else if (t === "GroupItem") { try { LD_collect(it.pageItems, out, seen); } catch (e2) {} }
        else if (t === "TextRange" || t === "InsertionPoint") {
            try { if (it.story && it.story.textFrames.length) out.texts.push(it.story.textFrames[0]); } catch (e3) {}
        }
    }
}
function LD_items(doc, c) {
    var out = { texts: [], paths: [] }, i;
    if (c.scope === "doc") {
        for (i = 0; i < doc.textFrames.length; i++) out.texts.push(doc.textFrames[i]);
        if (c.strokes) for (i = 0; i < doc.pathItems.length; i++) out.paths.push(doc.pathItems[i]);
    } else {
        LD_collect(doc.selection || [], out, {});
        if (!c.strokes) out.paths = [];
    }
    var t = [], p = [];
    for (i = 0; i < out.texts.length; i++) if (LD_visibleItem(out.texts[i])) t.push(out.texts[i]);
    for (i = 0; i < out.paths.length; i++) if (LD_visibleItem(out.paths[i])) p.push(out.paths[i]);
    return { texts: t, paths: p };
}

// Distance et hauteur de pose propres à l'objet / per-item distance and mounting height
function LD_itemDistance(it, defMm, unit) {
    var v = NaN, p;
    try { v = LD_CORE.parseNoteDistance(it.note, unit); } catch (e) {}
    if (v > 0) return { mm: v, src: "note" };
    p = it.parent;
    try {
        while (p && p.typename !== "Document") {
            if (p.typename === "Layer") { v = LD_CORE.parseLayerDistance(p.name); if (v > 0) return { mm: v, src: "calque" }; }
            p = p.parent;
        }
    } catch (e2) {}
    return { mm: defMm, src: "" };
}
function LD_itemBaseline(it, defMm, unit) {
    var v = NaN;
    try { v = LD_CORE.parseNoteBaseline(it.note, unit); } catch (e) {}
    return v > 0 ? v : defMm;
}

/* ===================================================================== */
/*  5. MESURE DES POLICES / FONT MEASUREMENT                              */
/* ===================================================================== */

/*
 * Mesureur : vectorise une copie temporaire de H, x ou ا à 100 pt dans la police réelle
 * et lit sa hauteur géométrique. Cache par police. Le calque temporaire est supprimé à la fin.
 * Measurer: outlines a temporary H, x or alef at 100 pt in the real font and reads its height.
 */
function LD_makeMeasurer(doc) {
    var cache = {}, layer = null, failures = 0;
    function tmp() {
        if (!layer) { layer = doc.layers.add(); layer.name = LD_TMP_LAYER; }
        return layer;
    }
    function measure(font, ref) {
        var key = "", name = "";
        try { name = String(font.name); } catch (e) { name = "?"; }
        key = name + "|" + ref;
        if (cache.hasOwnProperty(key)) return cache[key];
        var r = NaN, tf = null, g = null;
        try {
            tf = tmp().textFrames.add();
            tf.contents = LD_CORE.GLYPH[ref];
            var ca = tf.textRange.characterAttributes;
            try { ca.textFont = font; } catch (e1) {}
            ca.size = 100; ca.verticalScale = 100; ca.horizontalScale = 100; ca.baselineShift = 0;
            g = tf.createOutline(); tf = null;
            var b = g.geometricBounds, h = (b[1] - b[3]) / 100;
            if (h > 0.05 && h < 2) r = h;
        } catch (e2) {}
        try { if (g) g.remove(); } catch (e3) {}
        try { if (tf) tf.remove(); } catch (e4) {}
        if (!(r > 0)) { r = LD_CORE.FALLBACK[ref]; failures++; cache[key] = r; cache[key + "|fb"] = true; }
        else cache[key] = r;
        return r;
    }
    return {
        measure: measure,
        isFallback: function (font, ref) { var n = "?"; try { n = String(font.name); } catch (e) {} return cache.hasOwnProperty(n + "|" + ref + "|fb"); },
        failures: function () { return failures; },
        cleanup: function () { try { if (layer) layer.remove(); } catch (e) {} layer = null; }
    };
}

/* ===================================================================== */
/*  6. ANALYSE / ANALYSIS                                                 */
/* ===================================================================== */

function LD_docFactor(doc, c) {
    var f = LD_CORE.toNum(c.scale), sf = 1;
    if (!(f > 0)) f = 1;
    try { sf = Number(doc.scaleFactor); } catch (e) { sf = 1; }
    if (!(sf > 0)) sf = 1;
    return { factor: f * (c.useDocFactor ? sf : 1), docScale: sf, userScale: f };
}

function LD_frameScale(tf) {
    try { var m = tf.matrix; return LD_CORE.matrixVScale(m.mValueA, m.mValueB, m.mValueC, m.mValueD); } catch (e) { return 1; }
}

function LD_fontName(font) { try { return String(font.name); } catch (e) { return "?"; } }

/*
 * Analyse tous les textes et traits. Ne modifie rien (hormis le calque temporaire de mesure).
 * Analyses all texts and strokes. Modifies nothing (except the temporary measuring layer).
 */
function LD_analyze(doc, c, measurer) {
    var C = LD_CORE, crit = LD_criterion(c), unit = c.unit === "ft" ? "ft" : "m";
    var defMm = C.toNum(c.distance) * C.unitMm(unit, "m");
    var defBase = C.toNum(c.baseline) * C.unitMm(unit, "m");
    var fac = LD_docFactor(doc, c), margin = C.toNum(c.margin);
    if (!(margin >= 0)) margin = 0;
    var items = LD_items(doc, c);
    var res = { texts: [], strokes: [], counts: { ok: 0, juste: 0, petit: 0, ada: 0, strokes: 0, empty: 0 },
                crit: crit, unit: unit, factor: fac, defMm: defMm, defBase: defBase, items: items };
    var i, j, tf, runs, r, txt, ca, size, vs, font, refs, k, ratio, h, fs, d, base, req, worst, st, info;

    for (i = 0; i < items.texts.length; i++) {
        tf = items.texts[i];
        d = LD_itemDistance(tf, defMm, unit);
        base = LD_itemBaseline(tf, defBase, unit);
        req = C.required(crit, d.mm, base);
        fs = LD_frameScale(tf);
        worst = null;
        var smallRuns = [];
        try { runs = tf.textRanges; } catch (e) { runs = []; }
        for (j = 0; j < runs.length; j++) {
            r = runs[j];
            try { txt = r.contents; } catch (e1) { continue; }
            if (C.isBlank(txt)) continue;
            try { ca = r.characterAttributes; size = Number(ca.size); vs = Number(ca.verticalScale); font = ca.textFont; } catch (e2) { continue; }
            if (!(size > 0)) continue;
            if (!(vs > 0)) vs = 100;
            refs = C.refsFor(txt, c.basis);
            for (k = 0; k < refs.length; k++) {
                ratio = measurer.measure(font, refs[k]);
                h = C.realHeight(size, ratio, vs, fs, fac.factor);
                info = { h: h, ref: refs[k], size: size, vs: vs, ratio: ratio, font: LD_fontName(font), fallback: measurer.isFallback(font, refs[k]),
                         advise: C.sizeFor(req, ratio, vs, fs, fac.factor) };
                if (!worst || h < worst.h) worst = info;
                if (!isNaN(req) && h + 1e-9 < req) smallRuns.push({ range: r, size: Math.max(size, info.advise) });
            }
        }
        if (!worst) { res.counts.empty++; continue; }
        st = C.status(worst.h, req, margin);
        res.counts[st]++;
        res.texts.push({ item: tf, worst: worst, req: req, dist: d.mm, distSrc: d.src, baseline: base, status: st,
                         max: C.maxDistance(crit, worst.h, base), frameScale: fs, smallRuns: smallRuns,
                         locked: LD_isLocked(tf), text: LD_snippet(tf) });
    }

    if (c.strokes) {
        var sa = C.toNum(c.strokeArcmin), p, w, minW;
        for (i = 0; i < items.paths.length; i++) {
            p = items.paths[i];
            try { if (!p.stroked || p.guides || p.clipping || !(p.strokeWidth > 0)) continue; } catch (e3) { continue; }
            d = LD_itemDistance(p, defMm, unit);
            w = p.strokeWidth * C.PT * fac.factor;
            minW = C.heightForAngle(d.mm, sa);
            if (w + 1e-9 < minW) {
                res.counts.strokes++;
                res.strokes.push({ item: p, w: w, minW: minW, dist: d.mm, max: C.distanceForAngle(w, sa),
                                   advisePt: Math.ceil(minW / (C.PT * fac.factor) * 100) / 100 });
            }
        }
    }
    return res;
}

function LD_snippet(tf) {
    var s = "";
    try { s = String(tf.contents); } catch (e) {}
    s = s.replace(/[\r\n\u0003\u2028\u2029]+/g, " ").replace(/\s+/g, " ");
    if (s.length > 40) s = s.substring(0, 39) + "…";
    return s;
}

/* ===================================================================== */
/*  7. RAPPORT / REPORT                                                   */
/* ===================================================================== */

function LD_refName(ref) {
    if (ref === "x") return LD_T("hauteur d'x", "x-height");
    if (ref === "alef") return LD_T("alif", "alef");
    return LD_T("capitale", "cap height");
}
function LD_statusName(st) {
    if (st === "petit") return LD_T("TROP PETIT", "TOO SMALL");
    if (st === "juste") return LD_T("JUSTE", "BORDERLINE");
    if (st === "ada") return LD_T("POSE < 1016 mm", "MOUNT < 40 in");
    return "OK";
}

// Étiquette courte posée sur le repère / short marker label
function LD_label(t, unit) {
    var C = LD_CORE, fr = LD_FR, w = t.worst, s;
    s = LD_statusName(t.status) + " · " + LD_refName(w.ref) + " " + C.fmtLen(w.h, unit, fr);
    if (t.status === "ada") return s + LD_T(" · ADA : 40 in minimum au-dessus du sol", " · ADA: 40 in minimum above floor");
    s += (t.status === "petit" ? " < " : " / ") + C.fmtLen(t.req, unit, fr) + LD_T(" requis à ", " required at ") + C.fmtDist(t.dist, unit, fr);
    s += LD_T(" · lisible jusqu'à ", " · readable up to ") + (t.max > 0 ? C.fmtDist(t.max, unit, fr) : LD_T("aucune distance", "no distance"));
    if (t.status !== "ok") s += LD_T(" · corps conseillé ≥ ", " · advised size ≥ ") + C.fmt(w.advise, 1, fr) + " pt";
    return s;
}
function LD_strokeLabel(s, unit) {
    var C = LD_CORE, fr = LD_FR;
    return LD_T("TRAIT FIN ", "THIN STROKE ") + C.fmtLen(s.w, unit, fr) + " < " + C.fmtLen(s.minW, unit, fr) +
           LD_T(" · invisible au-delà de ", " · invisible beyond ") + C.fmtDist(s.max, unit, fr) +
           LD_T(" · épaisseur conseillée ≥ ", " · advised weight ≥ ") + C.fmt(s.advisePt, 2, fr) + " pt";
}

function LD_report(res, c) {
    var C = LD_CORE, fr = LD_FR, u = res.unit, L = [], i, t, n = res.counts;
    L.push(LD_T("Critère : ", "Criterion: ") + LD_critLabel(res.crit) + LD_T(" — distance par défaut ", " — default distance ") + C.fmtDist(res.defMm, u, fr) +
           (res.crit.mode === "ada" ? LD_T(", hauteur de pose ", ", mounting height ") + C.fmtLen(res.defBase, u, fr) : ""));
    if (res.crit.mode !== "ada") L.push(LD_T("Hauteur requise à cette distance : ", "Required height at this distance: ") + C.fmtLen(C.required(res.crit, res.defMm, res.defBase), u, fr));
    L.push(LD_T("Facteur d'agrandissement appliqué : ×", "Enlargement factor applied: ×") + C.fmt(res.factor.factor, 2, fr).replace(/[.,]00$/, "") +
           (res.factor.docScale > 1 ? LD_T(" (document grand format ×", " (large canvas ×") + res.factor.docScale + (res.factor.factor >= res.factor.docScale ? "" : LD_T(", non appliqué", ", not applied")) + ")" : ""));
    L.push(LD_T("Textes : ", "Texts: ") + res.texts.length + " — OK " + n.ok + ", " + LD_T("juste ", "borderline ") + n.juste + ", " +
           LD_T("trop petits ", "too small ") + n.petit + (n.ada ? ", " + LD_T("pose non conforme ", "invalid mount ") + n.ada : "") +
           (c.strokes ? LD_T(" — traits trop fins : ", " — strokes too thin: ") + n.strokes : ""));
    L.push("");
    var order = ["petit", "ada", "juste", "ok"], o;
    for (o = 0; o < order.length; o++) for (i = 0; i < res.texts.length; i++) {
        t = res.texts[i];
        if (t.status !== order[o]) continue;
        L.push("« " + t.text + " » — " + LD_label(t, u) + " (" + t.worst.font + " " + C.fmt(t.worst.size, 1, fr) + " pt" +
               (t.worst.fallback ? LD_T(", mesure estimée", ", estimated measure") : "") + (t.distSrc ? ", " + LD_T("distance du ", "distance from ") + t.distSrc : "") + ")");
    }
    for (i = 0; i < res.strokes.length; i++) {
        var s = res.strokes[i], nm = "";
        try { nm = s.item.name; } catch (e) {}
        L.push((nm ? "« " + nm + " » — " : "") + LD_strokeLabel(s, u));
    }
    return L.join("\n");
}

/* ===================================================================== */
/*  8. REPÈRES ET CORRECTION / MARKERS AND FIX                            */
/* ===================================================================== */

function LD_findMarkLayer(doc) {
    var i;
    for (i = 0; i < doc.layers.length; i++) if (doc.layers[i].name === LD_MARK_LAYER) return doc.layers[i];
    return null;
}
function LD_clearMarks(doc) {
    var L = LD_findMarkLayer(doc);
    if (!L) return false;
    try { L.locked = false; L.visible = true; } catch (e) {}
    L.remove();
    return true;
}

function LD_color(doc, kind) {
    var rgb = { petit: [230, 30, 40], ada: [230, 30, 40], juste: [245, 145, 0], ok: [0, 160, 80], stroke: [200, 0, 200] }[kind];
    var cmyk = { petit: [0, 95, 90, 0], ada: [0, 95, 90, 0], juste: [0, 50, 100, 0], ok: [80, 0, 90, 0], stroke: [20, 100, 0, 0] }[kind], col;
    var isCMYK = false;
    try { isCMYK = String(doc.documentColorSpace).indexOf("CMYK") >= 0; } catch (e) {}
    if (isCMYK) { col = new CMYKColor(); col.cyan = cmyk[0]; col.magenta = cmyk[1]; col.yellow = cmyk[2]; col.black = cmyk[3]; }
    else { col = new RGBColor(); col.red = rgb[0]; col.green = rgb[1]; col.blue = rgb[2]; }
    return col;
}

function LD_labelSize(doc) {
    var w = 600;
    try { var r = doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect; w = Math.abs(r[2] - r[0]); } catch (e) {}
    var s = w / 110;
    return s < 6 ? 6 : (s > 72 ? 72 : s);
}

function LD_mark(doc, L, item, kind, text, size) {
    var b, col = LD_color(doc, kind), pad = size * 0.4;
    try { b = item.visibleBounds; } catch (e) { try { b = item.geometricBounds; } catch (e2) { return; } }
    var rc = L.pathItems.rectangle(b[1] + pad, b[0] - pad, (b[2] - b[0]) + 2 * pad, (b[1] - b[3]) + 2 * pad);
    rc.filled = false; rc.stroked = true; rc.strokeColor = col; rc.strokeWidth = Math.max(0.5, size / 8);
    if (kind === "juste" || kind === "stroke") rc.strokeDashes = [size / 2, size / 4];
    var lb = L.textFrames.pointText([b[0] - pad, b[1] + pad + size * 0.35]);
    lb.contents = text;
    try { var a = lb.textRange.characterAttributes; a.size = size; a.fillColor = col; a.horizontalScale = 100; a.verticalScale = 100; } catch (e3) {}
}

function LD_placeMarks(doc, res, c) {
    LD_clearMarks(doc);
    var L = doc.layers.add(), i, t, size = LD_labelSize(doc), n = 0;
    L.name = LD_MARK_LAYER;
    try { L.printable = false; } catch (e) {}
    for (i = 0; i < res.texts.length; i++) {
        t = res.texts[i];
        if (t.status === "ok" && !c.labelOk) continue;
        LD_mark(doc, L, t.item, t.status, LD_label(t, res.unit), size); n++;
    }
    for (i = 0; i < res.strokes.length; i++) { LD_mark(doc, L, res.strokes[i].item, "stroke", LD_strokeLabel(res.strokes[i], res.unit), size); n++; }
    if (n === 0) { try { L.remove(); } catch (e2) {} return 0; }
    return n;
}

// Agrandit les passages trop petits au corps conseillé / enlarges too-small runs to the advised size
function LD_enlarge(res) {
    var i, j, t, n = 0, skipped = 0;
    for (i = 0; i < res.texts.length; i++) {
        t = res.texts[i];
        if (t.status !== "petit" || !t.smallRuns.length) continue;
        if (t.locked) { skipped++; continue; }
        for (j = 0; j < t.smallRuns.length; j++) {
            try { if (t.smallRuns[j].size > Number(t.smallRuns[j].range.characterAttributes.size)) { t.smallRuns[j].range.characterAttributes.size = t.smallRuns[j].size; } } catch (e) {}
        }
        n++;
    }
    return { done: n, skipped: skipped };
}

function LD_selectProblems(doc, res) {
    var sel = [], i;
    for (i = 0; i < res.texts.length; i++) if ((res.texts[i].status === "petit" || res.texts[i].status === "ada") && !res.texts[i].locked) sel.push(res.texts[i].item);
    for (i = 0; i < res.strokes.length; i++) if (!LD_isLocked(res.strokes[i].item)) sel.push(res.strokes[i].item);
    try { doc.selection = sel.length ? sel : null; } catch (e) {}
    return sel.length;
}

/* ===================================================================== */
/*  9. EXÉCUTION / RUN                                                    */
/* ===================================================================== */

// Exécute l'action demandée ; renvoie { msg, report } / runs the requested action
function LD_run(doc, c, measurer) {
    if (c.action === "clear") {
        return { msg: LD_clearMarks(doc) ? LD_T("Repères supprimés.", "Markers removed.") : LD_T("Aucun repère à supprimer.", "No markers to remove."), report: "" };
    }
    var err = LD_validate(c);
    if (err) return { msg: err, report: "", error: true };
    var m = measurer || LD_makeMeasurer(doc), res, report, msg, nm = 0, fix = null, nsel = 0;
    try { res = LD_analyze(doc, c, m); } finally { if (!measurer) m.cleanup(); }
    if (!res.texts.length && !res.strokes.length) {
        return { msg: c.scope === "sel" ? LD_T("Aucun texte (ni trait) visible dans la sélection.", "No visible text (or stroke) in the selection.")
                                        : LD_T("Aucun texte visible dans le document.", "No visible text in the document."), report: "", res: res };
    }
    report = LD_report(res, c);
    if (c.action === "analyze") return { msg: report, report: report, res: res };
    if (c.enlarge) fix = LD_enlarge(res);
    nm = LD_placeMarks(doc, res, c);
    nsel = LD_selectProblems(doc, res);
    msg = LD_T(res.counts.petit + " texte(s) trop petit(s), " + res.counts.juste + " juste(s), " + res.counts.ok + " conforme(s)",
               res.counts.petit + " text(s) too small, " + res.counts.juste + " borderline, " + res.counts.ok + " OK");
    if (res.counts.ada) msg += LD_T(", " + res.counts.ada + " à hauteur de pose non conforme", ", " + res.counts.ada + " with invalid mounting height");
    if (c.strokes) msg += LD_T(", " + res.counts.strokes + " trait(s) trop fin(s)", ", " + res.counts.strokes + " stroke(s) too thin");
    msg += ".\n" + LD_T(nm + " repère(s) sur le calque non imprimable « " + LD_MARK_LAYER + " ». " + nsel + " objet(s) sélectionné(s).",
                        nm + " marker(s) on the non-printing layer \"" + LD_MARK_LAYER + "\". " + nsel + " item(s) selected.");
    if (fix) msg += "\n" + LD_T(fix.done + " texte(s) agrandi(s) au corps conseillé (vérifiez les débordements des textes captifs)" + (fix.skipped ? ", " + fix.skipped + " verrouillé(s) ignoré(s)" : "") + ".",
                                fix.done + " text(s) enlarged to the advised size (check area-text overflow)" + (fix.skipped ? ", " + fix.skipped + " locked skipped" : "") + ".");
    if (fix && fix.done) msg += "\n" + LD_T("Relancez le script pour mettre à jour les repères.", "Run the script again to refresh the markers.");
    return { msg: msg, report: report, res: res };
}

/* ===================================================================== */
/* 10. INTERFACE / USER INTERFACE (ScriptUI)                              */
/* ===================================================================== */

var LD_CRITS = ["a20", "a16", "rule", "ada", "custom"];

function LD_dialog(doc, c) {
    var C = LD_CORE, T = LD_T, w = new Window("dialog", T("Lisibilité à distance — v1.0.0", "Viewing-distance legibility — v1.0.0"));
    w.orientation = "column"; w.alignChildren = ["fill", "top"];

    var p1 = w.add("panel", undefined, T("Portée et distance", "Scope and distance"));
    p1.alignChildren = ["left", "top"];
    var gS = p1.add("group");
    var rSel = gS.add("radiobutton", undefined, T("Sélection", "Selection")), rDoc = gS.add("radiobutton", undefined, T("Tout le document", "Whole document"));
    var hasSel = false;
    try { hasSel = doc.selection && doc.selection.length > 0; } catch (e) {}
    rSel.value = (c.scope !== "doc") && hasSel; rDoc.value = !rSel.value; rSel.enabled = hasSel;
    var gD = p1.add("group");
    gD.add("statictext", undefined, T("Distance de lecture :", "Viewing distance:"));
    var eD = gD.add("edittext", undefined, c.distance); eD.characters = 6;
    var dU = gD.add("dropdownlist", undefined, [T("mètres", "metres"), T("pieds", "feet")]); dU.selection = c.unit === "ft" ? 1 : 0;
    var hint = p1.add("statictext", undefined, T("Par objet : note « distance=12 » · par calque : nom « Hall [12 m] »", "Per item: note \"distance=12\" · per layer: name \"Hall [12 m]\""));
    try { hint.graphics.font = ScriptUI.newFont(hint.graphics.font.name, "ITALIC", 10); } catch (e2) {}

    var p2 = w.add("panel", undefined, T("Critère de lisibilité", "Legibility criterion"));
    p2.alignChildren = ["left", "top"];
    var dC = p2.add("dropdownlist", undefined, [
        T("Angle visuel 20′ — lecture confortable (ISO 9241-303)", "Visual angle 20′ — comfortable reading (ISO 9241-303)"),
        T("Angle visuel 16′ — seuil minimal de lecture", "Visual angle 16′ — minimum reading threshold"),
        T("Règle « 1 pouce par 10 pieds » (signalétique extérieure)", "\"1 inch per 10 feet\" rule (outdoor signage)"),
        T("ADA 2010 §703.5.5 (signalétique accessible, États-Unis)", "ADA 2010 §703.5.5 (accessible signage, USA)"),
        T("Angle visuel personnalisé", "Custom visual angle")]);
    var ci = 0, q; for (q = 0; q < LD_CRITS.length; q++) if (LD_CRITS[q] === c.crit) ci = q;
    dC.selection = ci;
    var gA = p2.add("group");
    gA.add("statictext", undefined, T("Angle (minutes d'arc) :", "Angle (arcminutes):"));
    var eA = gA.add("edittext", undefined, c.arcmin); eA.characters = 5;
    var gB = p2.add("group");
    gB.add("statictext", undefined, T("Hauteur de la ligne de base au-dessus du sol :", "Baseline height above floor:"));
    var eB = gB.add("edittext", undefined, c.baseline); eB.characters = 5;
    var uB = gB.add("statictext", undefined, "m");
    var gR = p2.add("group");
    gR.add("statictext", undefined, T("Hauteur mesurée :", "Measured height:"));
    var dR = gR.add("dropdownlist", undefined, [T("capitale H (normes de signalétique)", "cap height H (signage standards)"), T("hauteur d'x pour le bas de casse", "x-height for lowercase")]);
    dR.selection = c.basis === "x" ? 1 : 0;
    p2.add("statictext", undefined, T("Arabe : hauteur de l'alif (ا), mesurée dans la police.", "Arabic: alef (ا) height, measured in the font."));
    var calc = p2.add("statictext", undefined, "", { multiline: false }); calc.characters = 58;

    var p3 = w.add("panel", undefined, T("Échelle et options", "Scale and options"));
    p3.alignChildren = ["left", "top"];
    var gE = p3.add("group");
    gE.add("statictext", undefined, T("Le document est à l'échelle 1 :", "Document is at scale 1:"));
    var eE = gE.add("edittext", undefined, c.scale); eE.characters = 5;
    gE.add("statictext", undefined, T("(1 = taille réelle, 4 = quart, 10 = dixième)", "(1 = real size, 4 = quarter, 10 = tenth)"));
    var sf = 1; try { sf = Number(doc.scaleFactor); } catch (e3) {}
    var cF = p3.add("checkbox", undefined, T("Appliquer le facteur du document grand format (×" + sf + ")", "Apply the large-canvas document factor (×" + sf + ")"));
    cF.value = c.useDocFactor; cF.enabled = sf > 1;
    var gM = p3.add("group");
    gM.add("statictext", undefined, T("Marge « juste » :", "\"Borderline\" margin:"));
    var eM = gM.add("edittext", undefined, c.margin); eM.characters = 4; gM.add("statictext", undefined, "%");
    var gT = p3.add("group");
    var cT = gT.add("checkbox", undefined, T("Signaler les traits trop fins, seuil", "Flag strokes too thin, threshold")); cT.value = c.strokes;
    var eT = gT.add("edittext", undefined, c.strokeArcmin); eT.characters = 4; gT.add("statictext", undefined, T("′ (1′ = acuité 10/10)", "′ (1′ = 20/20 acuity)"));
    var cO = p3.add("checkbox", undefined, T("Étiqueter aussi les textes conformes", "Also label compliant texts")); cO.value = c.labelOk;
    var cX = p3.add("checkbox", undefined, T("Agrandir les textes trop petits au corps conseillé", "Enlarge too-small texts to the advised size")); cX.value = c.enlarge;
    p3.add("statictext", undefined, T("Conseil : travaillez sur une copie du fichier. Annulation : Ctrl+Z / Cmd+Z.", "Tip: work on a copy of the file. Undo: Ctrl+Z / Cmd+Z."));

    var out = w.add("edittext", undefined, "", { multiline: true, readonly: true, scrolling: true });
    out.preferredSize = [560, 140];

    var gBt = w.add("group"); gBt.alignment = ["fill", "top"];
    var bAn = gBt.add("button", undefined, T("Analyser", "Analyse"));
    var bCl = gBt.add("button", undefined, T("Effacer les repères", "Clear markers"));
    var bSv = gBt.add("button", undefined, T("Enregistrer le rapport…", "Save report…")); bSv.enabled = false;
    var sp = gBt.add("group"); sp.alignment = ["fill", "center"];
    var bCa = gBt.add("button", undefined, T("Annuler", "Cancel"), { name: "cancel" });
    var bOk = gBt.add("button", undefined, "OK", { name: "ok" });

    function read() {
        c.scope = rDoc.value ? "doc" : "sel";
        c.distance = eD.text; c.unit = dU.selection && dU.selection.index === 1 ? "ft" : "m";
        c.crit = LD_CRITS[dC.selection ? dC.selection.index : 0];
        c.arcmin = eA.text; c.baseline = eB.text; c.basis = dR.selection && dR.selection.index === 1 ? "x" : "cap";
        c.scale = eE.text; c.useDocFactor = cF.value; c.margin = eM.text;
        c.strokes = cT.value; c.strokeArcmin = eT.text; c.labelOk = cO.value; c.enlarge = cX.value;
        return c;
    }
    function refresh() {
        read();
        eA.enabled = c.crit === "custom"; gB.enabled = c.crit === "ada"; eT.enabled = c.strokes;
        uB.text = c.unit === "ft" ? "ft" : "m";
        var d = C.toNum(c.distance) * C.unitMm(c.unit, "m"), b = C.toNum(c.baseline) * C.unitMm(c.unit, "m"), rq, k;
        if (!(d > 0)) { calc.text = T("Saisissez une distance.", "Enter a distance."); return; }
        rq = C.required(LD_criterion(c), d, b);
        if (isNaN(rq)) { calc.text = T("ADA : la ligne de base doit être à 1016 mm (40 in) minimum du sol.", "ADA: baseline must be at least 40 in above floor."); return; }
        k = LD_docFactor(doc, c).factor;
        calc.text = T("À ", "At ") + C.fmtDist(d, c.unit, LD_FR) + T(" : hauteur requise ", ": required height ") + C.fmtLen(rq, c.unit, LD_FR) +
                    T(" réels (", " real (") + C.fmtLen(rq / k, c.unit, LD_FR) + T(" dans le document)", " in the document)");
    }
    var ctl = [eD, eA, eB, eE, eM, eT], z;
    for (z = 0; z < ctl.length; z++) ctl[z].onChanging = refresh;
    dU.onChange = refresh; dC.onChange = refresh; dR.onChange = refresh; cF.onClick = refresh; cT.onClick = refresh; rSel.onClick = refresh; rDoc.onClick = refresh;

    var lastReport = "";
    bAn.onClick = function () {
        read(); c.action = "analyze";
        var r = LD_run(doc, c);
        out.text = r.msg; lastReport = r.report || ""; bSv.enabled = lastReport !== "";
    };
    bCl.onClick = function () { c.action = "clear"; var r = LD_run(doc, c); out.text = r.msg; try { app.redraw(); } catch (e) {} };
    bSv.onClick = function () {
        var f = File.saveDialog(T("Enregistrer le rapport", "Save report"), "*.txt");
        if (!f) return;
        f.encoding = "UTF-8";
        if (f.open("w")) { f.write(lastReport); f.close(); out.text = T("Rapport enregistré : ", "Report saved: ") + f.fsName + "\n\n" + lastReport; }
    };
    refresh();
    var ret = w.show();
    read();
    c.action = "run";
    return ret === 1 ? c : null;
}

function LD_main() {
    if (app.documents.length === 0) { alert(LD_T("Ouvrez d'abord un document Illustrator.", "Please open an Illustrator document first.")); return; }
    var doc = app.activeDocument, c = LD_loadCfg();
    var hasSel = false;
    try { hasSel = doc.selection && doc.selection.length > 0; } catch (e) {}
    if (!hasSel && doc.textFrames.length === 0) {
        alert(LD_T("Rien n'est sélectionné et le document ne contient aucun texte.\nSélectionnez des textes (et des traits) à contrôler.",
                   "Nothing is selected and the document contains no text.\nSelect texts (and strokes) to check."));
        return;
    }
    if (!hasSel) c.scope = "doc";
    c = LD_dialog(doc, c);
    if (!c) return;
    LD_saveCfg(c);
    var r = LD_run(doc, c);
    try { app.redraw(); } catch (e2) {}
    alert(r.msg);
}

if (typeof LD_NO_MAIN === "undefined") {
    try { LD_main(); } catch (e) { alert(LD_T("Erreur : ", "Error: ") + e + (e.line ? " (ligne " + e.line + ")" : "")); }
}
