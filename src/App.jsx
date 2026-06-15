import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ─── STORAGE (localStorage) ─────────────────────────────────
const useStorage = (key, defaultValue) => {
  const [data, setData] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });
  const dataRef = useRef(data);

  const save = useCallback((newData) => {
    const val = typeof newData === "function" ? newData(dataRef.current) : newData;
    dataRef.current = val;
    setData(val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key]);

  return [data, save, true]; // always loaded
};

// ─── DATE UTILS ─────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
const fmtDateLong = (d) => new Date(d + "T12:00:00").toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
const shiftDay = (d, n) => { const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const lastNDays = (n, from) => {
  const arr = []; const base = from || todayStr();
  for (let i = n - 1; i >= 0; i--) arr.push(shiftDay(base, -i));
  return arr;
};
const weekdayNarrow = (d) => new Date(d + "T12:00:00").toLocaleDateString("it-IT", { weekday: "narrow" });

// ─── CONFIG ──────────────────────────────────────────────────
// Dopo aver pubblicato il Google Sheet come CSV, incolla qui l'URL.
// File → Condividi → Pubblica sul web → Foglio 1 → CSV → Pubblica
// L'URL ha questa forma:
// https://docs.google.com/spreadsheets/d/e/XXXXXXX/pub?gid=0&single=true&output=csv
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSRANhdeT5wcJ9OrohIq5FRny7NZF13-ai7hOizVu8BTnGmEllQuJykqgigJm-xTYnaV-SWjUNomvre/pub?gid=866182632&single=true&output=csv";

// Quanto spesso ri-fetchare il foglio (ms). Default: 1 ora.
const SHEET_REFRESH_MS = 60 * 60 * 1000;

// ─── CSV PARSER (leggero, gestisce campi quoted) ────────────
const parseCSV = (text) => {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map(line => {
    const vals = []; let cur = ""; let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] || "").replace(/^"|"$/g, ""); });
    return obj;
  }).filter(r => r.id && r.tipo && r.nome);
};

// ─── HOOK: PASTI DA GOOGLE SHEETS ───────────────────────────
const usePastiDB = (defaultPasti) => {
  const [pasti, setPasti] = useState(() => {
    try {
      const cached = localStorage.getItem("vitasana-pasti-cache");
      if (cached) return JSON.parse(cached);
    } catch {}
    return defaultPasti;
  });
  const [source, setSource] = useState("cache");

  useEffect(() => {
    if (!SHEET_CSV_URL) { setSource("default"); return; }

    // Controlla se serve refresh
    const lastFetch = +(localStorage.getItem("vitasana-pasti-ts") || "0");
    if (Date.now() - lastFetch < SHEET_REFRESH_MS) { setSource("cache"); return; }

    (async () => {
      try {
        const res = await fetch(SHEET_CSV_URL);
        if (!res.ok) throw new Error(res.status);
        const text = await res.text();
        const rows = parseCSV(text);
        if (rows.length > 0) {
          const mapped = rows.map(r => ({
            id: r.id,
            tipo: r.tipo,
            nome: r.nome,
            tempo: parseInt(r.tempo) || 10,
            emoji: r.emoji || "🍽️",
          }));
          setPasti(mapped);
          localStorage.setItem("vitasana-pasti-cache", JSON.stringify(mapped));
          localStorage.setItem("vitasana-pasti-ts", String(Date.now()));
          setSource("sheet");
        }
      } catch (e) {
        console.warn("Fetch Google Sheet fallito, uso cache/default:", e);
        setSource("fallback");
      }
    })();
  }, []);

  return [pasti, source];
};

// ─── DATABASE PASTI (fallback se Sheet non configurato) ─────
const DEFAULT_PASTI = [
  { id:"c1", tipo:"colazione", nome:"Yogurt greco + frutti di bosco + noci", tempo:5, emoji:"🫐" },
  { id:"c2", tipo:"colazione", nome:"Uova strapazzate + pane integrale + avocado", tempo:10, emoji:"🍳" },
  { id:"c3", tipo:"colazione", nome:"Frittata verdure + feta", tempo:15, emoji:"🥚" },
  { id:"c4", tipo:"colazione", nome:"Pancake avena e banana + burro d'arachidi", tempo:15, emoji:"🥞" },
  { id:"c5", tipo:"colazione", nome:"Cottage cheese + semi di chia + miele", tempo:5, emoji:"🥣" },
  { id:"c6", tipo:"colazione", nome:"Toast integrale + salmone affumicato + avocado", tempo:5, emoji:"🥑" },
  { id:"c7", tipo:"colazione", nome:"Porridge avena + proteine whey + noci", tempo:10, emoji:"🥣" },
  { id:"c8", tipo:"colazione", nome:"Skyr + granola proteica + mandorle", tempo:5, emoji:"🥜" },
  { id:"p1", tipo:"pranzo", nome:"Pollo grigliato + quinoa + verdure al forno", tempo:30, emoji:"🍗" },
  { id:"p2", tipo:"pranzo", nome:"Insalata di lenticchie + feta + pomodorini", tempo:15, emoji:"🥗" },
  { id:"p3", tipo:"pranzo", nome:"Salmone al forno + riso integrale + broccoli", tempo:25, emoji:"🐟" },
  { id:"p4", tipo:"pranzo", nome:"Bowl di ceci + avocado + riso + verdure", tempo:20, emoji:"🥙" },
  { id:"p5", tipo:"pranzo", nome:"Pasta integrale + tonno + pomodorini + olive", tempo:20, emoji:"🍝" },
  { id:"p6", tipo:"pranzo", nome:"Wrap integrale + pollo + hummus + verdure", tempo:10, emoji:"🌯" },
  { id:"p7", tipo:"pranzo", nome:"Zuppa di fagioli + orzo + verdure di stagione", tempo:35, emoji:"🍲" },
  { id:"p8", tipo:"pranzo", nome:"Insalata greca + pane integrale + olio evo", tempo:10, emoji:"🥒" },
  { id:"p9", tipo:"pranzo", nome:"Burger di tacchino + pane integrale + insalata", tempo:20, emoji:"🍔" },
  { id:"d1", tipo:"cena", nome:"Merluzzo al vapore + patate + spinaci", tempo:25, emoji:"🐟" },
  { id:"d2", tipo:"cena", nome:"Frittata di zucchine + insalata mista", tempo:15, emoji:"🥚" },
  { id:"d3", tipo:"cena", nome:"Petto di tacchino + verdure grigliate + farro", tempo:25, emoji:"🥩" },
  { id:"d4", tipo:"cena", nome:"Vellutata di zucca + crostini integrali + ricotta", tempo:30, emoji:"🎃" },
  { id:"d5", tipo:"cena", nome:"Insalata di tonno + fagioli + cipolla rossa", tempo:10, emoji:"🥫" },
  { id:"d6", tipo:"cena", nome:"Orata al forno + carciofi + olive", tempo:30, emoji:"🐠" },
  { id:"d7", tipo:"cena", nome:"Tofu saltato + verdure + riso basmati", tempo:20, emoji:"🍚" },
  { id:"d8", tipo:"cena", nome:"Uova in camicia + asparagi + pane integrale", tempo:15, emoji:"🥚" },
  { id:"s1", tipo:"spuntino", nome:"Mela + burro d'arachidi", tempo:2, emoji:"🍎" },
  { id:"s2", tipo:"spuntino", nome:"Yogurt greco + mandorle", tempo:2, emoji:"🥜" },
  { id:"s3", tipo:"spuntino", nome:"Hummus + bastoncini di verdure", tempo:5, emoji:"🥕" },
  { id:"s4", tipo:"spuntino", nome:"Frutta secca mix (30g)", tempo:1, emoji:"🥜" },
  { id:"s5", tipo:"spuntino", nome:"Ricotta + miele + noci", tempo:3, emoji:"🍯" },
  { id:"s6", tipo:"spuntino", nome:"Banana + cioccolato fondente 85%", tempo:2, emoji:"🍌" },
];

// ─── LOGICA SEMAFORO ────────────────────────────────────────
const valutaPasto = (testo, tipo) => {
  const t = testo.toLowerCase();
  let score = 0; const checks = [];
  const protKw = ["uov","pollo","tacchino","pesce","salmone","tonno","merluzzo","orata","yogurt","greco","cottage","ricotta","feta","formaggio","legum","lenticch","ceci","fagioli","tofu","whey","protei","skyr","prosciutto","bresaola","hummus","arachid","mozzarella","parmigiano","gamberi"];
  const carbKw = ["pane","pasta","riso","farro","orzo","quinoa","avena","patate","cereali","toast","wrap","crostini","pancake","porridge","granola","banana","mela","frutta"];
  const hasProt = protKw.some(k => t.includes(k));
  const hasCarb = carbKw.some(k => t.includes(k));
  if (hasProt) { score++; checks.push({ ok:true, label:"Proteine presenti" }); }
  else checks.push({ ok:false, label:"Aggiungi proteine" });
  if (hasCarb && hasProt) { score++; checks.push({ ok:true, label:"Carbo accompagnati" }); }
  else if (hasCarb && !hasProt) checks.push({ ok:false, label:"Carbo senza proteine!" });
  else if (!hasCarb) { score++; checks.push({ ok:true, label:"Nessun carbo isolato" }); }
  if (tipo === "colazione") {
    const dolceKw = ["cornetto","brioche","biscott","marmellata","cereali zuccher","nutella"];
    const isDolce = dolceKw.some(k => t.includes(k));
    if (!isDolce && hasProt) { score++; checks.push({ ok:true, label:"Colazione proteica" }); }
    else if (isDolce) checks.push({ ok:false, label:"Troppo dolce" });
    else checks.push({ ok:false, label:"Serve proteina a colazione" });
  } else score++;
  return { color: score >= 3 ? "verde" : score >= 2 ? "giallo" : "rosso", checks };
};

// ─── CONSTANTS ──────────────────────────────────────────────
const SEMAFORO_CLR = { verde:"#10b981", giallo:"#f59e0b", rosso:"#ef4444" };
const TIPO_E = { colazione:"☀️", pranzo:"🌤️", cena:"🌙", spuntino:"🍏" };
const TIPO_L = { colazione:"Colazione", pranzo:"Pranzo", cena:"Cena", spuntino:"Spuntino" };

const ESERCIZI = [
  { id:"forza", nome:"Forza / Pesi", emoji:"💪", desc:"45 min, focus gambe-glutei-schiena" },
  { id:"passi", nome:"Passi", emoji:"🚶‍♀️", desc:"Obiettivo 7.500/giorno", hasValue:true, unita:"passi" },
  { id:"cardio", nome:"Cardio / Ballo / Nuoto", emoji:"✨", desc:"L'attività che ti piace" },
  { id:"camminata_post", nome:"Camminata post-pasto", emoji:"🍽️", desc:"10-15 min, il trucco migliore" },
];

const MOTIVAZIONI = [
  "Ogni pasto è un'occasione per prenderti cura di te, non per punirti.",
  "3 abitudini costanti battono 10 regole seguite a metà.",
  "La camminata post-pasto è il trucco più sottovalutato. 10 minuti cambiano tutto.",
  "Il muscolo consuma glucosio anche a riposo. Ogni allenamento è un investimento.",
  "Acne, capelli, peso, energia: stessa radice. Ogni giorno li migliori tutti insieme.",
  "La bilancia oscilla. L'energia che senti al mattino non mente.",
  "Meglio 2 allenamenti fatti che 5 pianificati e saltati.",
];

const ACHIEVEMENTS = [
  { id:"first_meal", emoji:"🌱", nome:"Primo pasto", desc:"Hai loggato il primo pasto", check: (d) => Object.values(d).some(e => e.pasti?.length > 0) },
  { id:"first_workout", emoji:"🏋️", nome:"Prima sessione", desc:"Primo esercizio registrato", check: (d) => Object.values(d).some(e => e.esercizi?.length > 0) },
  { id:"full_day", emoji:"⭐", nome:"Giornata completa", desc:"3 pasti + 1 esercizio in un giorno", check: (d) => Object.values(d).some(e => (e.pasti?.length||0) >= 3 && (e.esercizi?.length||0) >= 1) },
  { id:"streak_3", emoji:"🔥", nome:"3 giorni di fila", desc:"Streak di 3 giorni", check: (_, s) => s >= 3 },
  { id:"streak_7", emoji:"💎", nome:"Una settimana!", desc:"7 giorni consecutivi", check: (_, s) => s >= 7 },
  { id:"streak_14", emoji:"👑", nome:"Due settimane!", desc:"14 giorni — sei inarrestabile", check: (_, s) => s >= 14 },
  { id:"streak_30", emoji:"🏆", nome:"Un mese!", desc:"30 giorni. Sei una forza della natura.", check: (_, s) => s >= 30 },
  { id:"water_champ", emoji:"💧", nome:"Idratazione", desc:"8 bicchieri in un giorno", check: (d) => Object.values(d).some(e => (e.acqua||0) >= 8) },
  { id:"steps_10k", emoji:"🎯", nome:"10.000 passi", desc:"Raggiunto 10k in un giorno", check: (d) => Object.values(d).some(e => (e.esercizi||[]).some(x => x.tipo === "passi" && x.valore >= 10000)) },
  { id:"all_green", emoji:"🟢", nome:"Tutto verde", desc:"3 pasti tutti verdi in un giorno", check: (d) => Object.values(d).some(e => {
    if ((e.pasti?.length||0) < 3) return false;
    return e.pasti.every(p => valutaPasto(p.testo, p.tipo).color === "verde");
  })},
];

// ─── SHARED UI ──────────────────────────────────────────────
const ProgressRing = ({ progress, size=70, stroke=6, color="#0f766e", children }) => {
  const r = (size - stroke) / 2, circ = 2 * Math.PI * r, p = Math.min(Math.max(progress,0),1);
  return (
    <div className="relative flex items-center justify-center" style={{ width:size, height:size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={circ*(1-p)} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset .5s ease" }}/>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

const Dot = ({ color }) => <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SEMAFORO_CLR[color] }}/>;

const Pill = ({ children, active, onClick }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${active ? "bg-teal-600 text-white shadow" : "bg-white text-gray-500 border border-gray-200"}`}>
    {children}
  </button>
);

const Card = ({ children, className="" }) => <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 ${className}`}>{children}</div>;

const SectionHead = ({ kicker, title }) => (
  <div className="mb-1">
    <p className="text-[10px] text-teal-600 font-bold uppercase tracking-widest">{kicker}</p>
    <p className="text-lg font-extrabold text-gray-800">{title}</p>
  </div>
);

const DateNav = ({ date, setDate }) => {
  const isToday = date === todayStr();
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-2.5">
      <button onClick={() => setDate(shiftDay(date, -1))} className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-teal-50 hover:text-teal-600 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button onClick={() => setDate(todayStr())} className="text-center">
        <p className="text-sm font-bold text-gray-800 capitalize">{fmtDateLong(date)}</p>
        {!isToday && <p className="text-[10px] text-teal-600 font-medium">Tocca per tornare a oggi</p>}
      </button>
      <button onClick={() => !isToday && setDate(shiftDay(date, 1))} disabled={isToday}
        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isToday ? "bg-gray-50 text-gray-200" : "bg-gray-50 text-gray-400 hover:bg-teal-50 hover:text-teal-600"}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  );
};

const WaterTracker = ({ count, onChange }) => (
  <Card>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xl">💧</span>
        <div>
          <p className="text-sm font-bold text-gray-700">Acqua</p>
          <p className="text-[10px] text-gray-400">{count}/8 bicchieri</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(0, count - 1))}
          className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-400 font-bold text-lg transition-colors">−</button>
        <div className="w-10 text-center font-bold text-lg text-blue-600">{count}</div>
        <button onClick={() => onChange(count + 1)}
          className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 hover:bg-teal-100 font-bold text-lg transition-colors">+</button>
      </div>
    </div>
    <div className="flex gap-1 mt-2.5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${i < count ? "bg-blue-400" : "bg-gray-100"}`}/>
      ))}
    </div>
  </Card>
);

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
const Dashboard = ({ diario, saveDiario, streak, date, setDate }) => {
  const entry = diario[date] || {};
  const pasti = entry.pasti || [];
  const esercizi = entry.esercizi || [];
  const acqua = entry.acqua || 0;
  const passi = esercizi.find(e => e.tipo === "passi")?.valore || 0;
  const isToday = date === todayStr();

  const setAcqua = (v) => {
    saveDiario({ ...diario, [date]: { ...entry, pasti, esercizi, acqua: v } });
  };

  const pesoEntries = Object.entries(diario).filter(([_, v]) => v.peso).sort(([a],[b]) => a.localeCompare(b)).slice(-10);
  const unlockedCount = ACHIEVEMENTS.filter(a => a.check(diario, streak)).length;

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <SectionHead kicker={isToday ? "Oggi" : fmtDate(date)} title={fmtDateLong(date).charAt(0).toUpperCase() + fmtDateLong(date).slice(1)} />
        <div className="flex items-center gap-2">
          {unlockedCount > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-full px-2.5 py-1 flex items-center gap-1">
              <span className="text-xs">🏅</span>
              <span className="text-xs font-bold text-purple-600">{unlockedCount}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-full px-3 py-1.5">
            <span className="text-base">{streak > 0 ? "🔥" : "💤"}</span>
            <span className="text-sm font-bold text-amber-700">{streak}</span>
          </div>
        </div>
      </div>

      <DateNav date={date} setDate={setDate} />

      <Card>
        <div className="flex justify-around items-center">
          <div className="text-center">
            <ProgressRing progress={pasti.length / 3} color="#0f766e" size={74}>
              <span className="text-lg font-extrabold text-teal-700">{pasti.length}<span className="text-[10px] text-gray-400 font-medium">/3</span></span>
            </ProgressRing>
            <p className="text-[11px] text-gray-500 mt-1.5 font-semibold">Pasti</p>
          </div>
          <div className="text-center">
            <ProgressRing progress={Math.min(esercizi.length / 2, 1)} color="#e8654f" size={74}>
              <span className="text-lg font-extrabold text-red-500">{esercizi.length}</span>
            </ProgressRing>
            <p className="text-[11px] text-gray-500 mt-1.5 font-semibold">Esercizi</p>
          </div>
          <div className="text-center">
            <ProgressRing progress={passi / 7500} color="#c98a2b" size={74}>
              <span className="text-sm font-extrabold text-amber-600">{passi > 999 ? `${(passi/1000).toFixed(1)}k` : passi}</span>
            </ProgressRing>
            <p className="text-[11px] text-gray-500 mt-1.5 font-semibold">Passi</p>
          </div>
        </div>
      </Card>

      <WaterTracker count={acqua} onChange={setAcqua} />

      <Card>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Pasti</h3>
        {pasti.length > 0 ? (
          <div className="space-y-1.5">
            {pasti.map((p, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0">
                <span>{TIPO_E[p.tipo]}</span>
                <Dot color={valutaPasto(p.testo, p.tipo).color}/>
                <span className="text-sm text-gray-700 flex-1 truncate">{p.testo}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-300 italic">Vai al Diario per registrare i pasti</p>}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-700 mb-3">Settimana</h3>
        <div className="flex justify-between">
          {lastNDays(7).map(dd => {
            const e = diario[dd]; const n = (e?.pasti?.length || 0); const hasEx = (e?.esercizi?.length || 0) > 0;
            const sel = dd === date; const dt = new Date(dd + "T12:00:00");
            return (
              <button key={dd} onClick={() => setDate(dd)} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-400 font-medium">{weekdayNarrow(dd)}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                  sel ? "bg-teal-600 text-white scale-110 shadow-md" : n >= 3 && hasEx ? "bg-teal-100 text-teal-700" : n > 0 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-300"
                }`}>{dt.getDate()}</div>
                <div className="flex gap-0.5">
                  {[0,1,2].map(j => <div key={j} className={`w-1 h-1 rounded-full ${j < n ? "bg-teal-500" : "bg-gray-200"}`}/>)}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {pesoEntries.length > 1 && (
        <Card>
          <h3 className="text-sm font-bold text-gray-700 mb-3">Trend peso</h3>
          <div className="flex items-end gap-1.5 h-24">
            {(() => {
              const vals = pesoEntries.map(([_, v]) => v.peso);
              const min = Math.min(...vals) - 0.5, max = Math.max(...vals) + 0.5, range = max - min || 1;
              return pesoEntries.map(([dd, v], i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-gray-500 font-medium">{v.peso}</span>
                  <div className="w-full rounded-t-lg transition-all duration-500" style={{
                    height: `${Math.max(((v.peso - min) / range) * 64, 4)}px`,
                    background: i === pesoEntries.length - 1 ? "linear-gradient(180deg, #0f766e, #14b8a6)" : "#d1d5db"
                  }}/>
                  <span className="text-[7px] text-gray-400">{dd.slice(5)}</span>
                </div>
              ));
            })()}
          </div>
          {(() => {
            const first = pesoEntries[0][1].peso, last = pesoEntries[pesoEntries.length-1][1].peso, diff = last - first;
            return <p className="text-xs text-center mt-2 font-medium" style={{ color: diff <= 0 ? "#10b981" : "#ef4444" }}>
              {diff <= 0 ? "↓" : "↑"} {Math.abs(diff).toFixed(1)} kg dal primo inserimento
            </p>;
          })()}
        </Card>
      )}

      <div className="bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 rounded-2xl p-4">
        <p className="text-sm text-teal-700 italic leading-relaxed">{MOTIVAZIONI[new Date(date + "T12:00:00").getDay()]}</p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// DIARIO PASTI
// ═══════════════════════════════════════════════════════════════
const DiarioPasti = ({ diario, saveDiario, date, setDate, pastiDB }) => {
  const entry = diario[date] || {};
  const pasti = entry.pasti || [];
  const [tipo, setTipo] = useState("colazione");
  const [testo, setTesto] = useState("");
  const [showSugg, setShowSugg] = useState(false);

  const add = (text) => {
    if (!text.trim()) return;
    const e = { ...entry, pasti: [...pasti, { tipo, testo: text.trim() }], esercizi: entry.esercizi || [], acqua: entry.acqua || 0 };
    saveDiario({ ...diario, [date]: e });
    setTesto(""); setShowSugg(false);
  };
  const remove = (i) => {
    saveDiario({ ...diario, [date]: { ...entry, pasti: pasti.filter((_, j) => j !== i) } });
  };

  const suggestions = pastiDB.filter(p => p.tipo === tipo);

  return (
    <div className="space-y-4 pb-4">
      <SectionHead kicker="Diario pasti" title="Cosa hai mangiato?" />
      <DateNav date={date} setDate={setDate} />

      <div className="flex gap-2">
        {["colazione","pranzo","cena","spuntino"].map(t => (
          <button key={t} onClick={() => { setTipo(t); setShowSugg(false); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${tipo === t ? "bg-teal-600 text-white shadow-lg shadow-teal-200" : "bg-white text-gray-400 border border-gray-200"}`}>
            <span className="block text-base">{TIPO_E[t]}</span>
            <span className="mt-0.5 block">{TIPO_L[t]}</span>
          </button>
        ))}
      </div>

      <Card>
        <div className="flex gap-2">
          <input value={testo} onChange={e => setTesto(e.target.value)} onKeyDown={e => e.key === "Enter" && add(testo)}
            placeholder={`Cosa hai mangiato a ${TIPO_L[tipo].toLowerCase()}?`}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50"/>
          <button onClick={() => add(testo)} disabled={!testo.trim()}
            className="bg-teal-600 text-white w-11 rounded-xl text-lg font-bold disabled:opacity-20 hover:bg-teal-700 transition-colors shrink-0">+</button>
        </div>

        {testo.trim().length > 2 && (
          <div className="mt-3 p-3 rounded-xl bg-gray-50 space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <Dot color={valutaPasto(testo, tipo).color}/>
              <span className="text-xs font-bold text-gray-600">Valutazione live</span>
            </div>
            {valutaPasto(testo, tipo).checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span>{c.ok ? "✅" : "⚠️"}</span>
                <span className={c.ok ? "text-gray-500" : "text-amber-600 font-semibold"}>{c.label}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => setShowSugg(!showSugg)} className="text-xs text-teal-600 font-semibold mt-3 hover:underline">
          {showSugg ? "✕ Chiudi" : "💡 Scegli dai suggerimenti"}
        </button>

        {showSugg && (
          <div className="mt-2 space-y-1 max-h-52 overflow-y-auto">
            {suggestions.map(s => (
              <button key={s.id} onClick={() => add(s.nome)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-teal-50 transition-colors text-left group">
                <span className="text-lg">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{s.nome}</p>
                  <p className="text-[10px] text-gray-400">⏱ {s.tempo} min</p>
                </div>
                <span className="text-teal-400 opacity-0 group-hover:opacity-100 text-lg transition-opacity">+</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Registrati</h3>
        {pasti.length > 0 ? (
          <div className="space-y-1.5">
            {pasti.map((p, i) => {
              const v = valutaPasto(p.testo, p.tipo);
              return (
                <div key={i} className="flex items-center gap-2.5 py-2 border-b border-gray-50 last:border-0 group">
                  <span>{TIPO_E[p.tipo]}</span><Dot color={v.color}/>
                  <span className="text-sm text-gray-700 flex-1 truncate">{p.testo}</span>
                  <button onClick={() => remove(i)} className="text-gray-200 group-hover:text-red-400 text-base transition-colors">✕</button>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-gray-300 italic">Nessun pasto registrato</p>}
      </Card>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">Regole d'oro</p>
        <div className="grid grid-cols-2 gap-1.5 text-[11px] text-amber-800">
          <div className="flex items-center gap-1.5">🚫 <span>Mai carbo nudi</span></div>
          <div className="flex items-center gap-1.5">🚶‍♀️ <span>Cammina post-pasto</span></div>
          <div className="flex items-center gap-1.5">🍳 <span>Colazione proteica</span></div>
          <div className="flex items-center gap-1.5">🥤 <span>Riduci zuccheri</span></div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SUGGERIMENTI PASTI
// ═══════════════════════════════════════════════════════════════
const SuggerimentiPasti = ({ diario, saveDiario, date, pastiDB }) => {
  const [filtro, setFiltro] = useState("tutti");
  const [tempoMax, setTempoMax] = useState(60);
  const entry = diario[date] || {};
  const filtered = pastiDB.filter(p => (filtro === "tutti" || p.tipo === filtro) && p.tempo <= tempoMax);

  const addToLog = (item) => {
    const e = { ...entry, pasti: [...(entry.pasti||[]), { tipo: item.tipo, testo: item.nome }], esercizi: entry.esercizi || [], acqua: entry.acqua || 0 };
    saveDiario({ ...diario, [date]: e });
  };

  const dayIdx = new Date(date + "T12:00:00").getDate();
  const colazioni = pastiDB.filter(p => p.tipo === "colazione");
  const pranzi = pastiDB.filter(p => p.tipo === "pranzo");
  const cene = pastiDB.filter(p => p.tipo === "cena");
  const menuGiorno = {
    colazione: colazioni[dayIdx % (colazioni.length || 1)] || colazioni[0],
    pranzo: pranzi[dayIdx % (pranzi.length || 1)] || pranzi[0],
    cena: cene[dayIdx % (cene.length || 1)] || cene[0],
  };

  return (
    <div className="space-y-4 pb-4">
      <SectionHead kicker="Idee piatti" title="Cosa mangio oggi?" />

      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-4 text-white shadow-lg shadow-teal-200">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-75 mb-3">Menu suggerito</p>
        {Object.entries(menuGiorno).map(([tipo, item]) => (
          <div key={tipo} className="flex items-center gap-3 py-2 border-b border-white/10 last:border-0">
            <span className="text-lg">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] opacity-60 font-medium">{TIPO_L[tipo]}</span>
              <p className="text-sm font-medium truncate">{item.nome}</p>
            </div>
            <button onClick={() => addToLog(item)} className="bg-white/20 hover:bg-white/30 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-colors shrink-0">+ Log</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {["tutti","colazione","pranzo","cena","spuntino"].map(f => (
          <Pill key={f} active={filtro === f} onClick={() => setFiltro(f)}>{f === "tutti" ? "Tutti" : TIPO_L[f]}</Pill>
        ))}
      </div>

      <div className="flex items-center gap-3 px-1">
        <span className="text-[11px] text-gray-400 font-medium">Tempo max</span>
        <input type="range" min={5} max={60} step={5} value={tempoMax} onChange={e => setTempoMax(+e.target.value)} className="flex-1 accent-teal-600 h-1"/>
        <span className="text-xs font-bold text-teal-700 w-12 text-right">{tempoMax} min</span>
      </div>

      <div className="space-y-2">
        {filtered.map(item => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
            <span className="text-2xl">{item.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{item.nome}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">{TIPO_L[item.tipo]}</span>
                <span className="text-[10px] text-gray-400">⏱ {item.tempo} min</span>
              </div>
            </div>
            <button onClick={() => addToLog(item)} className="bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors shrink-0">+ Log</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ESERCIZI & PROGRESSO
// ═══════════════════════════════════════════════════════════════
const EserciziProgresso = ({ diario, saveDiario, streak, date, setDate }) => {
  const entry = diario[date] || {};
  const esercizi = entry.esercizi || [];
  const [adding, setAdding] = useState(null);
  const [val, setVal] = useState("");
  const [pesoIn, setPesoIn] = useState("");
  const [showAch, setShowAch] = useState(false);

  const addEx = (tipo, valore, note) => {
    const e = { ...entry, pasti: entry.pasti || [], esercizi: [...esercizi, { tipo, ...(valore ? { valore: +valore } : {}), ...(note ? { note } : {}) }], acqua: entry.acqua || 0 };
    saveDiario({ ...diario, [date]: e });
    setAdding(null); setVal("");
  };
  const removeEx = (i) => {
    saveDiario({ ...diario, [date]: { ...entry, esercizi: esercizi.filter((_, j) => j !== i) } });
  };
  const savePeso = () => {
    if (!pesoIn) return;
    saveDiario({ ...diario, [date]: { ...entry, pasti: entry.pasti || [], esercizi, acqua: entry.acqua || 0, peso: +pesoIn } });
    setPesoIn("");
  };

  const week = lastNDays(7);
  const weekForza = week.reduce((s, d) => s + (diario[d]?.esercizi || []).filter(x => x.tipo === "forza").length, 0);
  const weekPassiArr = week.map(d => (diario[d]?.esercizi || []).find(x => x.tipo === "passi")?.valore || 0);
  const weekPassiAvg = Math.round(weekPassiArr.reduce((a, b) => a + b, 0) / 7);

  const checklist = [
    { label: `Forza: ${weekForza}/3 sessioni`, done: weekForza >= 3 },
    { label: `Passi medi: ${weekPassiAvg.toLocaleString("it-IT")}/7.500`, done: weekPassiAvg >= 7500 },
    { label: `Pasti oggi: ${(entry.pasti?.length || 0)}/3`, done: (entry.pasti?.length || 0) >= 3 },
    { label: `Acqua oggi: ${(entry.acqua || 0)}/8`, done: (entry.acqua || 0) >= 8 },
    { label: `Peso registrato questa sett.`, done: week.some(d => diario[d]?.peso) },
  ];

  const achievements = ACHIEVEMENTS.map(a => ({ ...a, unlocked: a.check(diario, streak) }));

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <SectionHead kicker="Fitness" title="Muoviti bene" />
        <button onClick={() => setShowAch(!showAch)}
          className="bg-purple-50 border border-purple-100 rounded-xl px-3 py-1.5 flex items-center gap-1.5 hover:bg-purple-100 transition-colors">
          <span className="text-sm">🏅</span>
          <span className="text-xs font-bold text-purple-600">{achievements.filter(a => a.unlocked).length}/{achievements.length}</span>
        </button>
      </div>

      <DateNav date={date} setDate={setDate} />

      {showAch && (
        <Card className="border-purple-100">
          <h3 className="text-sm font-bold text-purple-700 mb-3">Traguardi</h3>
          <div className="grid grid-cols-2 gap-2">
            {achievements.map(a => (
              <div key={a.id} className={`p-2.5 rounded-xl border text-center transition-all ${a.unlocked ? "bg-purple-50 border-purple-200" : "bg-gray-50 border-gray-100 opacity-40"}`}>
                <span className="text-xl block">{a.emoji}</span>
                <p className="text-[11px] font-bold text-gray-700 mt-1">{a.nome}</p>
                <p className="text-[9px] text-gray-400">{a.desc}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2">
        {ESERCIZI.map(t => (
          <button key={t.id} onClick={() => setAdding(adding === t.id ? null : t.id)}
            className={`p-3 rounded-xl border text-left transition-all ${adding === t.id ? "border-teal-400 bg-teal-50 shadow-md" : "border-gray-100 bg-white shadow-sm hover:border-teal-200"}`}>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-lg">{t.emoji}</span>
              <span className="text-xs font-bold text-gray-700">{t.nome}</span>
            </div>
            <p className="text-[10px] text-gray-400 ml-7">{t.desc}</p>
          </button>
        ))}
      </div>

      {adding && (
        <Card className="border-teal-200">
          {ESERCIZI.find(t => t.id === adding)?.hasValue ? (
            <div className="flex gap-2">
              <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="Quanti passi?"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400"/>
              <button onClick={() => addEx("passi", val)} disabled={!val}
                className="bg-teal-600 text-white px-4 rounded-xl text-sm font-bold disabled:opacity-20">Salva</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={val} onChange={e => setVal(e.target.value)} placeholder="Note (opzionale)"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400"/>
              <button onClick={() => addEx(adding, null, val || ESERCIZI.find(t => t.id === adding)?.nome)}
                className="bg-teal-600 text-white px-4 rounded-xl text-sm font-bold">Salva</button>
            </div>
          )}
        </Card>
      )}

      <Card>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Oggi</h3>
        {esercizi.length > 0 ? (
          <div className="space-y-1.5">
            {esercizi.map((ex, i) => {
              const tmpl = ESERCIZI.find(t => t.id === ex.tipo);
              return (
                <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-gray-50 last:border-0 group">
                  <span>{tmpl?.emoji || "🏃"}</span>
                  <span className="text-sm text-gray-700 flex-1">
                    {tmpl?.nome || ex.tipo}
                    {ex.valore ? ` — ${ex.valore.toLocaleString("it-IT")} ${tmpl?.unita || ""}` : ""}
                    {ex.note && !ex.valore ? ` — ${ex.note}` : ""}
                  </span>
                  <button onClick={() => removeEx(i)} className="text-gray-200 group-hover:text-red-400 transition-colors">✕</button>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-gray-300 italic">Nessun esercizio</p>}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Peso</h3>
        {entry.peso ? (
          <span className="text-2xl font-extrabold text-teal-700">{entry.peso} <span className="text-sm text-gray-400 font-medium">kg</span></span>
        ) : (
          <div className="flex gap-2">
            <input type="number" step="0.1" value={pesoIn} onChange={e => setPesoIn(e.target.value)} placeholder="es. 68.5"
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-teal-400"/>
            <button onClick={savePeso} disabled={!pesoIn}
              className="bg-teal-600 text-white px-4 rounded-xl text-sm font-bold disabled:opacity-20">Salva</button>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Passi — settimana</h3>
        <div className="flex items-end gap-1.5 h-20">
          {weekPassiArr.map((p, i) => {
            const max = Math.max(...weekPassiArr, 7500);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                {p > 0 && <span className="text-[8px] text-gray-400 font-medium">{p > 999 ? `${(p/1000).toFixed(1)}k` : p}</span>}
                <div className="w-full rounded-t-md transition-all duration-300" style={{
                  height: `${Math.max((p / max) * 52, 2)}px`,
                  backgroundColor: p >= 7500 ? "#10b981" : p > 0 ? "#fbbf24" : "#e5e7eb"
                }}/>
                <span className="text-[9px] text-gray-400">{weekdayNarrow(week[i])}</span>
              </div>
            );
          })}
        </div>
        <div className="h-px bg-gray-100 my-2"/>
        <p className="text-xs text-gray-500 text-center">Media: <b className={weekPassiAvg >= 7500 ? "text-teal-600" : "text-amber-600"}>{weekPassiAvg.toLocaleString("it-IT")}</b> / 7.500</p>
      </Card>

      <Card>
        <h3 className="text-sm font-bold text-gray-700 mb-2">Checklist settimanale</h3>
        <div className="space-y-2">
          {checklist.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${c.done ? "bg-teal-100 text-teal-600" : "bg-gray-100 text-gray-300"}`}>
                {c.done && "✓"}
              </div>
              <span className={`text-sm ${c.done ? "text-gray-700" : "text-gray-400"}`}>{c.label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl p-4">
        <p className="text-xs text-red-700 italic font-medium">Meglio 2 allenamenti fatti che 5 pianificati e saltati. 💪</p>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [diario, saveDiario] = useStorage("vitasana-diario-v2", {});
  const [pastiDB, pastiSource] = usePastiDB(DEFAULT_PASTI);
  const [date, setDate] = useState(todayStr());

  const streak = useMemo(() => {
    let count = 0, d = new Date();
    const te = diario[todayStr()];
    const todayOk = (te?.pasti?.length || 0) >= 2 && (te?.esercizi?.length || 0) >= 1;
    if (!todayOk) d.setDate(d.getDate() - 1);
    while (true) {
      const k = d.toISOString().slice(0, 10), e = diario[k];
      if (e && (e.pasti?.length || 0) >= 2 && (e.esercizi?.length || 0) >= 1) { count++; d.setDate(d.getDate() - 1); }
      else break;
    }
    if (todayOk) count++;
    return count;
  }, [diario]);

  const tabs = [
    { id:"dashboard", label:"Home", icon: (a) => <svg viewBox="0 0 24 24" fill={a?"#0f766e":"none"} stroke={a?"#0f766e":"#94a3b8"} strokeWidth={a?0:1.8} className="w-6 h-6"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path d="M9 22V12h6v10" stroke={a?"white":"#94a3b8"} strokeWidth={1.8} fill="none"/></svg> },
    { id:"diario", label:"Diario", icon: (a) => <svg viewBox="0 0 24 24" fill="none" stroke={a?"#0f766e":"#94a3b8"} strokeWidth={1.8} className="w-6 h-6"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg> },
    { id:"suggerimenti", label:"Idee", icon: (a) => <svg viewBox="0 0 24 24" fill="none" stroke={a?"#0f766e":"#94a3b8"} strokeWidth={1.8} className="w-6 h-6"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg> },
    { id:"esercizi", label:"Fitness", icon: (a) => <svg viewBox="0 0 24 24" fill="none" stroke={a?"#0f766e":"#94a3b8"} strokeWidth={1.8} className="w-6 h-6"><path d="M18 20V10M12 20V4M6 20v-6"/></svg> },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-24">
        {tab === "dashboard" && <Dashboard diario={diario} saveDiario={saveDiario} streak={streak} date={date} setDate={setDate}/>}
        {tab === "diario" && <DiarioPasti diario={diario} saveDiario={saveDiario} date={date} setDate={setDate} pastiDB={pastiDB}/>}
        {tab === "suggerimenti" && <SuggerimentiPasti diario={diario} saveDiario={saveDiario} date={date} pastiDB={pastiDB}/>}
        {tab === "esercizi" && <EserciziProgresso diario={diario} saveDiario={saveDiario} streak={streak} date={date} setDate={setDate}/>}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-lg z-50" style={{ maxWidth: 480 }}>
        <div className="flex justify-around py-1.5 px-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-2xl transition-all ${tab === t.id ? "bg-teal-50" : ""}`}>
              {t.icon(tab === t.id)}
              <span className={`text-[10px] font-bold ${tab === t.id ? "text-teal-700" : "text-gray-400"}`}>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="h-1.5"/>
      </div>
    </div>
  );
}
