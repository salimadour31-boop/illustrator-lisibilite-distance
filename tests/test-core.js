// Tests du cœur de calcul (Node.js, sans dépendance) / core tests
var fs = require("fs"), vm = require("vm"), path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "LisibiliteDistance.jsx"), "utf8");
var ctx = { LD_NO_MAIN: true, app: { locale: "fr_FR" }, $: { locale: "fr_FR" }, Math: Math, String: String, Number: Number, isNaN: isNaN, parseFloat: parseFloat };
vm.createContext(ctx); vm.runInContext(src, ctx);
var C = ctx.LD_CORE, pass = 0, fail = 0;
function ok(name, cond, info) { if (cond) pass++; else { fail++; console.log("ÉCHEC / FAIL: " + name + (info !== undefined ? " → " + info : "")); } }
function near(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-6); }

// Angle visuel / visual angle
ok("20′ à 10 m ≈ 58,18 mm", near(C.heightForAngle(10000, 20), 58.178, 0.01), C.heightForAngle(10000, 20));
ok("16′ à 3 m ≈ 13,96 mm", near(C.heightForAngle(3000, 16), 13.963, 0.01), C.heightForAngle(3000, 16));
ok("aller-retour hauteur ↔ distance", near(C.distanceForAngle(C.heightForAngle(7321, 22), 22), 7321, 1e-6));
// AltFTool : 1,5 m d'écran vu de 8 m, 22′ → environ 51 mm
ok("22′ à 8 m ≈ 51 mm (exemple publié)", near(C.heightForAngle(8000, 22), 51.2, 0.3), C.heightForAngle(8000, 22));
// 1 pouce / 10 pieds ≈ 28,6′
ok("1 in / 10 ft équivaut à ≈ 28,6′", near(C.heightForAngle(10 * 304.8, 28.65), 25.4, 0.02), C.heightForAngle(3048, 28.65));

// Règle / rule
var R = { mode: "rule" };
ok("règle : 50 pieds → 5 pouces", near(C.required(R, 50 * 304.8), 5 * 25.4, 1e-9));
ok("règle : 6 pouces → 60 pieds", near(C.maxDistance(R, 6 * 25.4), 60 * 304.8, 1e-9));

// ADA 703.5.5
var IN = 25.4, FT = 304.8;
ok("ADA bande basse < 72 in : 5/8 in", near(C.adaRequired(60 * IN, 60 * IN), 0.625 * IN));
ok("ADA bande basse 72 in : 5/8 in", near(C.adaRequired(72 * IN, 60 * IN), 0.625 * IN));
ok("ADA bande basse 12 ft : 5/8 + 6 × 1/8 = 1 3/8 in", near(C.adaRequired(12 * FT, 60 * IN), 1.375 * IN, 1e-9), C.adaRequired(12 * FT, 60 * IN) / IN);
ok("ADA bande moyenne < 15 ft : 2 in", near(C.adaRequired(10 * FT, 90 * IN), 2 * IN));
ok("ADA bande moyenne 20 ft : 2 + 5/8 in", near(C.adaRequired(20 * FT, 90 * IN), 2.625 * IN, 1e-9));
ok("ADA bande haute < 21 ft : 3 in", near(C.adaRequired(20 * FT, 130 * IN), 3 * IN));
ok("ADA bande haute 31 ft : 3 + 10/8 in", near(C.adaRequired(31 * FT, 130 * IN), 4.25 * IN, 1e-9));
ok("ADA limite 70 in incluse dans bande basse", near(C.adaRequired(1 * FT, 70 * IN), 0.625 * IN));
ok("ADA limite 120 in incluse dans bande moyenne", near(C.adaRequired(1 * FT, 120 * IN), 2 * IN));
ok("ADA pose < 40 in → NaN", isNaN(C.adaRequired(5 * FT, 39 * IN)));
ok("ADA distance max inverse", near(C.adaMaxDistance(1.375 * IN, 60 * IN), 12 * FT, 1e-6));
ok("ADA trop petit même de près → 0", C.adaMaxDistance(0.5 * IN, 60 * IN) === 0);
ok("ADA statut « ada » si pose non conforme", C.status(30, NaN, 10) === "ada");

// Statut / status
ok("statut ok", C.status(12, 10, 10) === "ok");
ok("statut juste (dans la marge)", C.status(10.5, 10, 10) === "juste");
ok("statut exactement requis = juste", C.status(10, 10, 10) === "juste");
ok("statut trop petit", C.status(9.9, 10, 10) === "petit");
ok("statut marge 0 : égal = ok", C.status(10, 10, 0) === "ok");

// Hauteur réelle / real height
ok("72 pt × 0,7 = 17,78 mm", near(C.realHeight(72, 0.7, 100, 1, 1), 17.78, 1e-9));
ok("échelle verticale 50 %", near(C.realHeight(72, 0.7, 50, 1, 1), 8.89, 1e-9));
ok("bloc mis à l'échelle ×2 et document 1:10", near(C.realHeight(10, 0.7, 100, 2, 10), 10 * 0.7 * 2 * 10 * 25.4 / 72, 1e-9));
var sz = C.sizeFor(58.18, 0.72, 100, 1, 1);
ok("corps conseillé arrondi au 0,5 pt supérieur", sz * 2 === Math.round(sz * 2) && C.realHeight(sz, 0.72, 100, 1, 1) >= 58.18 && C.realHeight(sz - 0.5, 0.72, 100, 1, 1) < 58.18, sz);
ok("corps conseillé exact non arrondi vers le haut", C.sizeFor(C.realHeight(40, 0.7, 100, 1, 1), 0.7, 100, 1, 1) === 40);
ok("matrice identité → 1", C.matrixVScale(1, 0, 0, 1) === 1);
ok("matrice échelle verticale 3", near(C.matrixVScale(1, 0, 0, 3), 3));
ok("matrice rotation 30° → 1", near(C.matrixVScale(Math.cos(0.5236), Math.sin(0.5236), -Math.sin(0.5236), Math.cos(0.5236)), 1, 1e-9));

// Notes et calques / notes and layers
ok("note distance=12 (m par défaut)", C.parseNoteDistance("distance=12", "m") === 12000);
ok("note d: 40 ft", near(C.parseNoteDistance("panneau ; d: 40 ft", "m"), 40 * FT));
ok("note dist = 2,5 m", C.parseNoteDistance("dist = 2,5 m", "m") === 2500);
ok("note sans unité en pieds", near(C.parseNoteDistance("distance=30", "ft"), 30 * FT));
ok("note sans distance → NaN", isNaN(C.parseNoteDistance("à revoir avec le client", "m")));
ok("note « hd=3 » n'est pas une distance", isNaN(C.parseNoteDistance("hd=3", "m")));
ok("note hauteur=1,6", C.parseNoteBaseline("distance=4; hauteur=1,6", "m") === 1600);
ok("note h: 60 in", near(C.parseNoteBaseline("h: 60 in", "m"), 60 * IN));
ok("calque « Hall [12 m] »", C.parseLayerDistance("Hall [12 m]") === 12000);
ok("calque « Façade [60ft] »", near(C.parseLayerDistance("Façade [60ft]"), 60 * FT));
ok("calque sans crochets → NaN", isNaN(C.parseLayerDistance("Calque 1")));

// Écritures / scripts
var k = C.classify("Sortie EXIT 3 مخرج");
ok("classify : arabe compté", k.arabic === 4, k.arabic);
ok("classify : majuscules / minuscules / chiffres", k.upper === 5 && k.lower === 5 && k.digit === 1, JSON.stringify(k));
ok("classify : tatweel et harakat ignorés", C.classify("\u0640\u064E").arabic === 0);
ok("refs capitale par défaut", C.refsFor("Sortie", "cap").join() === "cap");
ok("refs x pour bas de casse", C.refsFor("Sortie", "x").join() === "x");
ok("refs capitale pour tout en majuscules même en mode x", C.refsFor("EXIT 3", "x").join() === "cap");
ok("refs bilingue arabe + latin", C.refsFor("مخرج Exit", "cap").join() === "alef,cap");
ok("refs arabe seul", C.refsFor("مخرج", "x").join() === "alef");
ok("blanc : espaces, retours, insécables", C.isBlank(" \r\u00A0\u0003") && !C.isBlank(" a "));

// Formatage / formatting
ok("fmt FR", C.fmt(12.345, 1, true) === "12,3");
ok("fmt EN zéros", C.fmt(5, 2, false) === "5.00");
ok("fmtDist m", C.fmtDist(5400, "m", true) === "5,4 m" && C.fmtDist(25000, "m", true) === "25 m");
ok("fmtDist ft", C.fmtDist(60 * FT, "ft", false) === "60 ft");
ok("fmtLen mm", C.fmtLen(58.178, "m", true) === "58,2 mm" && C.fmtLen(3.456, "m", true) === "3,46 mm");

console.log(pass + " réussi(s), " + fail + " échec(s) / " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
