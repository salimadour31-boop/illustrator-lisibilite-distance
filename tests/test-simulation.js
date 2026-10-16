// Simulation de l'API Illustrator (objets factices) / mock Illustrator API simulation
// Ne remplace pas un essai réel dans Illustrator. / Does not replace a real test in Illustrator.
var fs = require("fs"), vm = require("vm"), path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "LisibiliteDistance.jsx"), "utf8");
var pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) pass++; else { fail++; console.log("ÉCHEC / FAIL: " + name + (info !== undefined ? " → " + info : "")); } }
var PT = 25.4 / 72;

// Polices factices : hauteur de H, x, alif / mock fonts: glyph heights (fraction of em)
var FONTS = { "Arial": { H: 0.716, x: 0.519, "\u0627": 0.0 }, "Frutiger": { H: 0.70, x: 0.53, "\u0627": 0.0 }, "NotoKufi": { H: 0.70, x: 0.5, "\u0627": 0.62 } };
var measured = 0;
function font(n) { return { name: n }; }

function Coll(arr, extra) { var o = arr; o.add = extra && extra.add; return o; }
function Item(type, parent) { this.typename = type; this.parent = parent; this.hidden = false; this.locked = false; this.note = ""; this.name = ""; }
Item.prototype.remove = function () { var k = this.parent._kids, i = k.indexOf(this); if (i >= 0) k.splice(i, 1); this.removed = true; };

function Run(frame, text, size, fnt, vs) { this.frame = frame; this.contents = text; this.characterAttributes = { size: size, verticalScale: vs || 100, textFont: fnt }; }

function TextFrame(parent, runs) {
    Item.call(this, "TextFrame", parent);
    var self = this;
    this.textRanges = runs.map(function (r) { return new Run(self, r[0], r[1], font(r[2]), r[3]); });
    this.contents = runs.map(function (r) { return r[0]; }).join("");
    this.matrix = { mValueA: 1, mValueB: 0, mValueC: 0, mValueD: 1 };
    this.visibleBounds = [0, 100, 200, 0]; this.geometricBounds = this.visibleBounds;
    var ca = {};
    this.textRange = { characterAttributes: ca };
}
TextFrame.prototype = Object.create(Item.prototype);
TextFrame.prototype.createOutline = function () {
    var ca = this.textRange.characterAttributes, f = ca.textFont ? FONTS[ca.textFont.name] : null, h = f ? f[this.contents] : 0;
    measured++;
    var g = new Item("GroupItem", this.parent); this.parent._kids.push(g);
    g.geometricBounds = [0, (h || 0) * ca.size, 50, 0];
    this.remove();
    return g;
};

function Path(parent, sw) { Item.call(this, "PathItem", parent); this.stroked = true; this.strokeWidth = sw; this.guides = false; this.clipping = false; this.visibleBounds = [0, 10, 100, 0]; }
Path.prototype = Object.create(Item.prototype);

function Layer(doc, name) {
    Item.call(this, "Layer", doc); this.name = name || "Calque"; this.visible = true; this.printable = true; this._kids = []; var self = this;
    this.textFrames = Coll([], { add: function () { var t = new TextFrame(self, []); t.textRange = { characterAttributes: {} }; self._kids.push(t); return t; } });
    this.textFrames.pointText = function (pos) { var t = new TextFrame(self, []); t.textRange = { characterAttributes: {} }; t.pos = pos; t.isLabel = true; self._kids.push(t); return t; };
    this.pathItems = { rectangle: function (top, left, w, h) { var p = new Path(self, 1); p.rect = [top, left, w, h]; p.isMarker = true; self._kids.push(p); return p; } };
}
Layer.prototype = Object.create(Item.prototype);
Layer.prototype.remove = function () { var a = this.parent._layers, i = a.indexOf(this); if (i >= 0) a.splice(i, 1); this.removed = true; };
Object.defineProperty(TextFrame.prototype, "contents", {
    get: function () { return this._c; },
    set: function (v) { this._c = v; }
});

function Doc() {
    var self = this; this.typename = "Document"; this._layers = []; this.documentColorSpace = "CMYK"; this.selection = []; this.scaleFactor = 1;
    this.layers = { add: function () { var L = new Layer(self, "Nouveau"); self._layers.unshift(L); return L; } };
    Object.defineProperty(this.layers, "length", { get: function () { return self._layers.length; } });
    for (var i = 0; i < 50; i++) (function (i) { Object.defineProperty(self.layers, i, { get: function () { return self._layers[i]; } }); })(i);
    this.artboards = [{ artboardRect: [0, 1190, 842, 0] }]; this.artboards.getActiveArtboardIndex = function () { return 0; };
}
function all(doc, type) { var out = []; doc._layers.forEach(function (L) { L._kids.forEach(function (k) { if (k.typename === type) out.push(k); }); }); return out; }
Object.defineProperty(Doc.prototype, "textFrames", { get: function () { return all(this, "TextFrame"); } });
Object.defineProperty(Doc.prototype, "pathItems", { get: function () { return all(this, "PathItem"); } });
function layer(doc, name) { var L = new Layer(doc, name); doc._layers.push(L); return L; }
function text(L, runs) { var t = new TextFrame(L, runs); L._kids.push(t); return t; }

function makeCtx(locale, doc) {
    var alerts = [];
    var ctx = {
        LD_NO_MAIN: true, Math: Math, String: String, Number: Number, isNaN: isNaN, parseFloat: parseFloat, Array: Array, Infinity: Infinity,
        alert: function (m) { alerts.push(String(m)); },
        app: { locale: locale, documents: { length: doc ? 1 : 0 }, activeDocument: doc, redraw: function () {} },
        $: { locale: locale },
        RGBColor: function () {}, CMYKColor: function () { this.cmyk = true; },
        Folder: { userData: "/tmp" }, File: function () { this.exists = false; this.open = function () { return false; }; }
    };
    vm.createContext(ctx); vm.runInContext(src, ctx); ctx.alerts = alerts; return ctx;
}
function cfg(X, o) { var c = X.LD_defaults(), k; c.scope = "doc"; for (k in o) c[k] = o[k]; return c; }
function markLayer(doc) { return doc._layers.filter(function (L) { return L.name === "Lisibilité à distance – repères"; })[0]; }

// ---------- 1. Panneau à 5 m, angle 20′ / panel at 5 m ----------
var d = new Doc(), L1 = layer(d, "Panneau");
var big = text(L1, [["SORTIE", 72, "Arial"]]);        // 72 × 0,716 × 0,3528 = 18,19 mm
var mid = text(L1, [["Accueil", 50, "Arial"]]);       // 12,63 mm (requis 29,09 mm) → trop petit
var small = text(L1, [["Horaires ", 30, "Arial"], ["8h-18h", 12, "Arial"]]);
var X = makeCtx("fr_FR", d);
var req5 = X.LD_CORE.heightForAngle(5000, 20);
var R = X.LD_run(d, cfg(X, { distance: "5", crit: "a20" }));
var res = R.res;
ok("3 textes analysés", res.texts.length === 3, res.texts.length);
ok("requis 20′ à 5 m ≈ 29,1 mm", Math.abs(req5 - 29.09) < 0.01, req5);
var tBig = res.texts.filter(function (t) { return t.item === big; })[0];
ok("72 pt Arial : hauteur réelle mesurée 18,19 mm", Math.abs(tBig.worst.h - 72 * 0.716 * PT) < 1e-6, tBig.worst.h);
ok("72 pt Arial à 5 m : trop petit (18,2 < 29,1)", tBig.status === "petit");
ok("corps conseillé pour 29,1 mm ≈ 115,5 pt", tBig.worst.advise === 115.5, tBig.worst.advise);
var tSmall = res.texts.filter(function (t) { return t.item === small; })[0];
ok("passage le plus petit retenu (12 pt)", tSmall.worst.size === 12);
ok("deux passages trop petits listés", tSmall.smallRuns.length === 2, tSmall.smallRuns.length);
ok("police mesurée une seule fois (cache)", measured === 1, measured);
ok("calque temporaire supprimé", d._layers.every(function (L) { return L.name !== "__LisibiliteDistance_tmp"; }));
var ML = markLayer(d);
ok("calque de repères créé, non imprimable", ML && ML.printable === false);
ok("3 cadres + 3 étiquettes", ML && ML._kids.filter(function (k) { return k.isMarker; }).length === 3 && ML._kids.filter(function (k) { return k.isLabel; }).length === 3);
ok("couleur CMJN dans document CMJN", ML && ML._kids[0].strokeColor && ML._kids[0].strokeColor.cmyk === true);
ok("étiquette en français avec distance max", ML && /TROP PETIT · capitale 18,2 mm < 29,1 mm requis à 5,0 m · lisible jusqu'à 3,1 m · corps conseillé ≥ 115,5 pt/.test(ML._kids.filter(function (k) { return k.isLabel; })[0].contents), ML && ML._kids[1].contents);
ok("textes trop petits sélectionnés", d.selection.length === 3, d.selection.length);
ok("message de synthèse", /3 texte\(s\) trop petit\(s\), 0 juste\(s\), 0 conforme\(s\)/.test(R.msg), R.msg);
ok("rapport : critère et hauteur requise", /angle visuel 20′/.test(R.report) && /Hauteur requise à cette distance : 29,1 mm/.test(R.report), R.report.split("\n").slice(0, 2).join(" | "));

// ---------- 2. Distance 2 m : statuts ok / juste ----------
var R2 = X.LD_run(d, cfg(X, { distance: "2", crit: "a20", margin: "10" })); // requis 11,64 mm
var st = {}; R2.res.texts.forEach(function (t) { st[t.item === big ? "big" : t.item === mid ? "mid" : "small"] = t.status; });
ok("à 2 m (requis 11,64 mm) : 72 pt ok, 50 pt juste (12,63 < +10 %), 12 pt trop petit", st.big === "ok" && st.mid === "juste" && st.small === "petit", JSON.stringify(st));
ok("repères recréés (pas de doublon de calque)", d._layers.filter(function (L) { return L.name === "Lisibilité à distance – repères"; }).length === 1);
var R2b = X.LD_run(d, cfg(X, { distance: "2", crit: "a20", margin: "10", labelOk: false }));
ok("sans étiquette des conformes : 2 repères (juste + trop petit)", markLayer(d)._kids.filter(function (k) { return k.isMarker; }).length === 2);
var mm = 50 * 0.716 * PT; // 50 pt Arial = 12,63 mm ; distance choisie pour un requis à 95 % / distance giving a 95 % requirement
var R2d = X.LD_run(d, cfg(X, { distance: String(mm / X.LD_CORE.heightForAngle(1000, 20) * 0.95), crit: "a20", margin: "10" }));
var midSt = R2d.res.texts.filter(function (t) { return t.item === mid; })[0].status;
ok("dans la marge de 10 % : juste", midSt === "juste", midSt);

// ---------- 3. Échelle 1:10 et grand format ----------
var R3 = X.LD_run(d, cfg(X, { distance: "5", scale: "10" }));
ok("document au 1:10 : 72 pt et 50 pt deviennent conformes", R3.res.texts.filter(function (t) { return t.item !== small && t.status === "ok"; }).length === 2);
d.scaleFactor = 10;
var R3b = X.LD_run(d, cfg(X, { distance: "5", scale: "1", useDocFactor: true }));
ok("grand format ×10 appliqué", Math.abs(R3b.res.factor.factor - 10) < 1e-9 && /grand format ×10/.test(R3b.report), R3b.report.split("\n")[2]);
var R3c = X.LD_run(d, cfg(X, { distance: "5", scale: "1", useDocFactor: false }));
ok("grand format non appliqué si décoché", R3c.res.factor.factor === 1 && /non appliqué/.test(R3c.report));
d.scaleFactor = 1;

// ---------- 4. Distances par calque et par note ----------
var L2 = layer(d, "Couloir [1 m]"), near1 = text(L2, [["Salle 12", 24, "Frutiger"]]);
var noted = text(L1, [["Info", 24, "Frutiger"]]); noted.note = "distance=0,5";
var R4 = X.LD_run(d, cfg(X, { distance: "5" }));
var tN = R4.res.texts.filter(function (t) { return t.item === near1; })[0], tNo = R4.res.texts.filter(function (t) { return t.item === noted; })[0];
ok("distance lue dans le nom du calque (1 m)", tN.dist === 1000 && tN.distSrc === "calque");
ok("distance lue dans la note (0,5 m)", tNo.dist === 500 && tNo.distSrc === "note");
ok("24 pt Frutiger à 1 m : conforme (5,93 > 5,82 mm, marge 10 % → juste)", tN.status === "juste", tN.worst.h + " / " + tN.req);

// ---------- 5. Arabe : hauteur de l'alif ----------
var ar = text(L1, [["مخرج Exit", 60, "NotoKufi"]]);
var R5 = X.LD_run(d, cfg(X, { distance: "3" }));
var tA = R5.res.texts.filter(function (t) { return t.item === ar; })[0];
ok("texte bilingue : alif (0,62) plus petit que H (0,70) retenu", tA.worst.ref === "alef" && Math.abs(tA.worst.h - 60 * 0.62 * PT) < 1e-6, tA.worst.ref + " " + tA.worst.h);
ok("alif mesuré, pas estimé", tA.worst.fallback === false);
var arF = text(L1, [["مخرج", 60, "Arial"]]);
var R5b = X.LD_run(d, cfg(X, { distance: "3" }));
var tAF = R5b.res.texts.filter(function (t) { return t.item === arF; })[0];
ok("glyphe absent de la police : valeur estimée signalée", tAF.worst.fallback === true && /mesure estimée/.test(R5b.report));
arF.remove(); ar.remove();

// ---------- 6. Masqués, verrouillés, bloc mis à l'échelle ----------
var Lh = layer(d, "Masqué"); Lh.visible = false; text(Lh, [["Caché", 6, "Arial"]]);
var lk = text(L1, [["Verrouillé", 10, "Arial"]]); lk.locked = true;
var scaled = text(L1, [["ÉCHELLE", 20, "Arial"]]); scaled.matrix = { mValueA: 3, mValueB: 0, mValueC: 0, mValueD: 3 };
var R6 = X.LD_run(d, cfg(X, { distance: "5", enlarge: true }));
ok("texte d'un calque masqué ignoré", R6.res.texts.every(function (t) { return t.text !== "Caché"; }));
var tS = R6.res.texts.filter(function (t) { return t.item === scaled; })[0];
ok("bloc mis à l'échelle ×3 pris en compte", Math.abs(tS.worst.h - 20 * 3 * 0.716 * PT) < 1e-6 && tS.frameScale === 3);
ok("verrouillé : non agrandi", lk.textRanges[0].characterAttributes.size === 10);
ok("verrouillé : non sélectionné", d.selection.indexOf(lk) < 0);
ok("agrandissement : 72 pt → 115,5 pt", big.textRanges[0].characterAttributes.size === 115.5, big.textRanges[0].characterAttributes.size);
ok("agrandissement : chaque passage au corps conseillé", small.textRanges[1].characterAttributes.size === 115.5 && small.textRanges[0].characterAttributes.size === 115.5);
ok("message d'agrandissement", /texte\(s\) agrandi\(s\)/.test(R6.msg) && /1 verrouillé\(s\) ignoré\(s\)/.test(R6.msg), R6.msg);
var R6b = X.LD_run(d, cfg(X, { distance: "5" }));
ok("après agrandissement : 72 pt devenu conforme (juste ou ok)", R6b.res.texts.filter(function (t) { return t.item === big; })[0].status !== "petit");

// ---------- 7. Traits fins ----------
var thin = new Path(L1, 0.25); L1._kids.push(thin); thin.name = "Filet";
var thick = new Path(L1, 6); L1._kids.push(thick);
var R7 = X.LD_run(d, cfg(X, { distance: "5", strokes: true, strokeArcmin: "1" })); // 1′ à 5 m = 1,45 mm ; 0,25 pt = 0,088 mm
ok("trait 0,25 pt invisible à 5 m signalé", R7.res.strokes.length === 1 && R7.res.strokes[0].item === thin, R7.res.strokes.length);
ok("épaisseur conseillée ≈ 4,13 pt", Math.abs(R7.res.strokes[0].advisePt - 4.13) < 0.02, R7.res.strokes[0].advisePt);
ok("trait 6 pt conforme", R7.res.strokes.every(function (s) { return s.item !== thick; }));
ok("rapport nomme le trait", /« Filet » — TRAIT FIN/.test(R7.report));
var R7b = X.LD_run(d, cfg(X, { distance: "5", strokes: false }));
ok("traits non contrôlés si décoché", R7b.res.strokes.length === 0);
ok("repères non analysés comme traits", R7.res.strokes.every(function (s) { return !s.item.isMarker; }));

// ---------- 8. ADA ----------
var R8 = X.LD_run(d, cfg(X, { distance: "12", unit: "ft", crit: "ada", baseline: "5" })); // 60 in → 1 3/8 in requis
ok("ADA : hauteur requise 1 3/8 in à 12 ft (pose 5 ft)", Math.abs(R8.res.texts[0].req - 1.375 * 25.4) < 1e-6, R8.res.texts[0].req);
ok("ADA : étiquette en pouces et pieds", /in requis à 12 ft/.test(R8.report), R8.report.split("\n")[4]);
var R8b = X.LD_run(d, cfg(X, { distance: "12", unit: "ft", crit: "ada", baseline: "3" })); // 36 in < 40 in
ok("ADA : pose à 36 in non conforme", R8b.res.counts.ada === R8b.res.texts.length && /hauteur de pose non conforme/.test(R8b.msg));

// ---------- 9. Analyser, effacer, sélection, erreurs ----------
X.LD_run(d, cfg(X, { action: "clear" }));
ok("effacer : calque de repères supprimé", !markLayer(d));
var RA = X.LD_run(d, cfg(X, { distance: "5", action: "analyze" }));
ok("analyser : aucun repère créé", !markLayer(d) && /Textes : /.test(RA.msg));
ok("effacer sans repère", /Aucun repère/.test(X.LD_run(d, cfg(X, { action: "clear" })).msg));
var d9 = new Doc(), L9 = layer(d9, "A"), only = text(L9, [["Titre", 100, "Arial"]]); text(L9, [["Autre", 8, "Arial"]]);
d9.selection = [only];
var Z = makeCtx("en_US", d9);
var R9 = Z.LD_run(d9, cfg(Z, { scope: "sel", distance: "3" }));
ok("portée sélection : 1 seul texte", R9.res.texts.length === 1);
ok("interface anglaise", /text\(s\) too small/.test(R9.msg), R9.msg);
ok("distance invalide refusée", Z.LD_run(d9, cfg(Z, { distance: "abc" })).error === true);
d9.selection = [];
ok("sélection vide → message", /No visible text/.test(Z.LD_run(d9, cfg(Z, { scope: "sel", distance: "3" })).msg));
var E = makeCtx("fr_FR", null); E.LD_main();
ok("alerte sans document", /Ouvrez d'abord un document/.test(E.alerts[0]), E.alerts[0]);
var dE = new Doc(); layer(dE, "Vide"); var E2 = makeCtx("fr_FR", dE); E2.LD_main();
ok("alerte sans sélection ni texte", /Rien n'est sélectionné/.test(E2.alerts[0]), E2.alerts[0]);

console.log(pass + " réussi(s), " + fail + " échec(s) / " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
