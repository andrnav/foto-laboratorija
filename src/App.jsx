import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeCanvas } from "qrcode.react";
import {
  Layers3, Printer, CupSoda, Frame, Box, QrCode, PlusCircle, MinusCircle,
  Pencil, ChartNoAxesColumnIncreasing, Settings, LogOut, UserRound, RefreshCw,
  ShoppingCart, Package, FlaskConical, Copy, Check, Menu, X, History,
  ChevronDown, ChevronRight, Plus, Minus, ScanLine, ShieldCheck, AlertTriangle,
  Download, Trash2, LockKeyhole, CalendarDays
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const NAV = [
  { id: "photo", label: "Foto medžiagos", icon: Layers3, sections: [{id:"paper",label:"Foto popierius"},{id:"chemical",label:"Chemija"},{id:"other",label:"Kita"}] },
  { id: "wide", label: "Plačiaformatė spauda", icon: Printer, sections: [{id:"paper",label:"Popierius"},{id:"ink",label:"Rašalas"},{id:"other",label:"Kita"}] },
  { id: "sublimation", label: "Sublimacija", icon: CupSoda, sections: [{id:"cups",label:"Puodeliai"},{id:"other",label:"Kita"}] },
  { id: "framing", label: "Rėminimas", icon: Frame, sections: [{id:"subframes",label:"Poremiai"},{id:"materials",label:"Naudojamos medžiagos"},{id:"other",label:"Kita"}] },
  { id: "other", label: "Kitos medžiagos", icon: Box, sections: [{id:"other",label:"Kita"}] },
];
const SUBCATEGORY_LABELS = Object.fromEntries(NAV.flatMap(n => n.sections.map(s => [`${n.id}:${s.id}`, s.label])));
function subcategoryLabel(category, subcategory) { return SUBCATEGORY_LABELS[`${category}:${subcategory || "other"}`] || "Kita"; }
function chemicalTone(name="") {
  const n=String(name).toLowerCase();
  if (n.includes("developer") || /\bcd\b/.test(n)) return "blue";
  if (n.includes("bleach") || /\bbf\b/.test(n)) return "red";
  if (n.includes("stabilizer") || /\bstb\b/.test(n)) return "yellow";
  return "green";
}
const INK_ORDER = ["magenta","orange","cyan","light black","yellow","light magenta","black","light cyan"];
function normalizedInkName(name="") {
  const n=String(name).toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ").trim();
  return INK_ORDER.find(color => n===color || n.includes(color)) || n;
}
function inkHex(name="") {
  const n=normalizedInkName(name);
  const colors={magenta:"#d62978",orange:"#f28c28",cyan:"#00a6d6","light black":"#8b9299",yellow:"#f2d21b","light magenta":"#ed9ac0",black:"#252525","light cyan":"#8bd8e8"};
  return colors[n] || "#a0a0a0";
}
function isInkProduct(p) { return p.kind==="ink" || p.subcategory==="ink" || (p.category==="wide" && INK_ORDER.some(c=>normalizedInkName(p.name)===c)); }
function inkSortKey(p) {
  const n=String(p.name||"").toLowerCase().replace(/[_-]+/g," ").trim();
  const i=INK_ORDER.indexOf(n);
  return i < 0 ? 100 : i;
}
function productDescription(p) { return p.description ? <small style={{display:"block",fontSize:"11px",fontWeight:400,opacity:.62,marginTop:2}}>{p.description}</small> : null; }
function ProductName({p,showUnit=true}) {
  return <div>{isInkProduct(p)&&<span aria-hidden="true" style={{display:"inline-block",width:17,height:17,minWidth:17,borderRadius:"50%",background:inkHex(p.name),marginRight:10,verticalAlign:"middle",border:"2px solid #ffffff",boxShadow:"0 0 0 1px #64756b88"}}/>}<b>{displayName(p)}</b>{productDescription(p)}{showUnit&&<small style={{display:"block"}}>{p.kind==="ink"?"Rašalo lygis (%)":p.unit||"vnt."}</small>}</div>;
}
const PAPER_COLORS = { Glossy: "green", Lustre: "blue", Silk: "pink" };
const PRODUCT_PALETTE = [
  {name:"Žalia",value:"#e3f5e7"},{name:"Mėlyna",value:"#e2efff"},{name:"Geltona",value:"#fff4cc"},
  {name:"Rožinė",value:"#ffe5eb"},{name:"Violetinė",value:"#eee5ff"},{name:"Oranžinė",value:"#ffeadb"},
  {name:"Turkio",value:"#d9f5f0"},{name:"Pilka",value:"#edf0ee"},{name:"Raudona",value:"#ffe2df"},{name:"Smėlio",value:"#f3eadb"}
];
const DEFAULT_PRODUCT_COLOR = PRODUCT_PALETTE[0].value;
const STARTER = [
  ...["Glossy","Lustre","Silk"].flatMap((surface, si) => [12.7,15.2,30.5].map((width, wi) => ({
    id:`demo-${si}-${wi}`, category:"photo", subcategory:"paper", kind:"paper", name:surface, surface, width_cm:width,
    code:`FP-${["G","L","S"][si]}${Math.round(width*10)}`, quantity:[5,2,6,4,7,0,3,4,5][si*3+wi],
    min_quantity: surface==="Lustre" && width===30.5 ? 2 : (width===30.5 ? 4 : (surface==="Silk" ? 3 : 4)), unit:"vnt."
  }))),
  ...[
    ["CD Developer","CH-CD",2.5,2,"blue"],
    ["BF Bleach Fix","CH-BF",2,2,"red"],
    ["STB Super Stabilizer","CH-STB",1.5,2,"yellow"]
  ].map((x,i)=>({id:`chem-${i}`,category:"photo",subcategory:"chemical",kind:"chemical",name:x[0],code:x[1],quantity:x[2],min_quantity:x[3],unit:"bak.",color:x[4]}))
];

function fmt(n) { return Number(n ?? 0).toLocaleString("lt-LT", { maximumFractionDigits: 2 }); }
function dateTime(d = new Date()) {
  const date = new Intl.DateTimeFormat("lt-LT", { timeZone:"Europe/Vilnius", month:"long", day:"numeric" }).format(d);
  const weekday = new Intl.DateTimeFormat("lt-LT", { timeZone:"Europe/Vilnius", weekday:"long" }).format(d);
  const time = new Intl.DateTimeFormat("lt-LT", { timeZone:"Europe/Vilnius", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).format(d);
  return `${date}, ${weekday} ${time}`;
}
function clockParts(d = new Date()) {
  const date = new Intl.DateTimeFormat("lt-LT", { timeZone:"Europe/Vilnius", month:"long", day:"numeric" }).format(d);
  const weekday = new Intl.DateTimeFormat("lt-LT", { timeZone:"Europe/Vilnius", weekday:"long" }).format(d);
  const time = new Intl.DateTimeFormat("lt-LT", { timeZone:"Europe/Vilnius", hour:"2-digit", minute:"2-digit", second:"2-digit", hour12:false }).format(d);
  return { date, weekday, time };
}
function shortTime(s) { if (!s) return "—"; return new Date(s).toLocaleString("lt-LT", { hour:"2-digit", minute:"2-digit", second:"2-digit", day:"2-digit", month:"2-digit", year:"numeric" }); }
function stockTone(p) { return Number(p.quantity) < Number(p.min_quantity) ? "low" : "ok"; }
function isRollProduct(p) { return /^(rul\.?|rulonas|rulonai)$/i.test(String(p?.unit || "").trim()); }
function displayName(p) { return p.kind === "paper" ? `${p.surface} ${String(p.width_cm).replace(".",",")} cm` : p.name; }
function chemicalSortKey(name="") {
  const n=name.toLowerCase();
  if (n.includes("cd") || n.includes("developer")) return 0;
  if (n.includes("bf") || n.includes("bleach fix")) return 1;
  if (n.includes("stb") || n.includes("stabilizer")) return 2;
  return 3;
}

function categoryLastUpdated(products, logs, active) {
  const categoryForActive = active === "photo" ? "photo" : active;
  const candidates = [];
  for (const p of products || []) {
    if (p.category === categoryForActive && p.updated_at) candidates.push(new Date(p.updated_at));
  }
  for (const log of logs || []) {
    const category = log.products?.category || log.category;
    if (category === categoryForActive && log.created_at) candidates.push(new Date(log.created_at));
  }
  const valid = candidates.filter(d => Number.isFinite(d.getTime()));
  return valid.length ? new Date(Math.max(...valid.map(d => d.getTime()))) : null;
}

export default function App() {
  const configured = Boolean(supabase);
  // Nekonfigūruotoje demonstracijoje rodomi pavyzdžiai; prijungus Supabase laukiame tikrų duomenų.
  const [products, setProducts] = useState(() => configured ? [] : STARTER);
  const [logs, setLogs] = useState([]);
  const [active, setActive] = useState("photo");
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setClockNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const canManageStock = isAdmin || isEmployee;
  const [authReady, setAuthReady] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [openSections, setOpenSections] = useState({paper:true,chem:true,history:false});
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [scannerRunning, setScannerRunning] = useState(false);
  const scannerRef = useRef(null);
  const scannerInstance = useRef(null);
  const scanInProgress = useRef(false);
  const directScanHandled = useRef(false);

  const loadData = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const { data: ps, error: pe } = await supabase.from("products").select("*").order("category").order("kind").order("name").order("width_cm");
    if (pe) { setNotice(`Duomenų nepavyko įkelti: ${pe.message}`); setLoading(false); return; }
    // Krauname istoriją puslapiais, kad senesni įrašai neliktų už 100 įrašų ribos.
    let allLogs = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data: batch, error: logError } = await supabase.from("stock_logs")
        .select("*, products(category, subcategory, name, surface, width_cm, code)")
        .order("created_at", { ascending:false }).range(from, from + pageSize - 1);
      if (logError) { setNotice(`Istorijos nepavyko įkelti: ${logError.message}`); break; }
      allLogs = allLogs.concat(batch || []);
      if (!batch || batch.length < pageSize) break;
    }
    setProducts(ps || []); setLogs(allLogs);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!supabase) { setAuthReady(true); setAdminChecked(true); return; }
    let alive = true;
    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data.session?.user || null;
      if (!alive) return;
      setUser(sessionUser);
      if (sessionUser) await checkAdmin(sessionUser.id);
      else { setIsAdmin(false); setIsEmployee(false); setAdminChecked(true); }
      if (alive) setAuthReady(true);
    };
    initSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user || null;
      setUser(sessionUser);
      setIsAdmin(false);
      setIsEmployee(false);
      setAdminChecked(false);
      if (sessionUser) {
        // Supabase auth callback is kept short; admin lookup runs asynchronously.
        setTimeout(() => { if (alive) checkAdmin(sessionUser.id); }, 0);
      } else {
        setAdminChecked(true);
      }
      setAuthReady(true);
    });
    loadData();
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [loadData]);

  async function checkAdmin(uid) {
    if (!supabase) {
      setIsAdmin(false); setIsEmployee(false); setAdminChecked(true);
      return { isAdmin: false, isEmployee: false, error: "Supabase nesukonfigūruotas." };
    }
    const { data: adminRow, error: adminError } = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
    const admin = Boolean(adminRow && !adminError);
    let employee = false;
    let employeeError = null;
    if (!admin && !adminError) {
      const result = await supabase.from("employees").select("user_id").eq("user_id", uid).maybeSingle();
      employee = Boolean(result.data && !result.error);
      employeeError = result.error;
    }
    setIsAdmin(admin);
    setIsEmployee(employee);
    setAdminChecked(true);
    return { isAdmin: admin, isEmployee: employee, error: adminError || employeeError };
  }

  const visibleProducts = useMemo(() => products.filter(p => p.category === active), [products, active]);
  const papers = visibleProducts.filter(p => p.kind === "paper");
  const chemicals = visibleProducts.filter(p => p.kind === "chemical").slice().sort((a,b) => chemicalSortKey(a.name)-chemicalSortKey(b.name) || a.name.localeCompare(b.name,"lt"));
  const orderItems = products.filter(p => p.category === active && Number(p.quantity) < Number(p.min_quantity)).slice().sort((a,b) => displayName(a).localeCompare(displayName(b,"lt")));
  const activeLogs = logs.filter(log => (log.products?.category || products.find(p => p.id === log.product_id)?.category) === active);
  const activeLabel = NAV.find(n => n.id === active)?.label || "Medžiagos";

  function flash(msg) { setNotice(msg); window.setTimeout(() => setNotice(""), 4500); }
  function toggleSection(key) { setOpenSections(s => ({...s,[key]:!s[key]})); }

  async function signIn(email, password) {
    if (!supabase) return flash("Pirmiausia sukonfigūruokite Supabase nustatymus (.env).");
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      flash(`Prisijungti nepavyko: ${error.message}`);
      return;
    }
    const uid = data.user?.id;
    if (!uid) {
      setBusy(false);
      flash("Prisijungimas patvirtintas, bet nepavyko gauti vartotojo ID. Pabandykite atnaujinti puslapį.");
      return;
    }
    const access = await checkAdmin(uid);
    setBusy(false);
    setModal(null);
    if (access.error) {
      flash(`Prisijungimas pavyko, bet nepavyko patikrinti teisių: ${access.error.message}. Patikrinkite, ar paleista darbuotojo SQL migracija.`);
    } else if (!access.isAdmin && !access.isEmployee) {
      flash("Prisijungimas pavyko, tačiau paskyrai nepriskirta darbuotojo ar administratoriaus rolė. Supabase SQL Editor paleiskite supabase/migration_2026_11_employee_role.sql.");
    } else {
      flash(access.isAdmin ? "Prisijungta kaip administratorius." : "Prisijungta kaip darbuotojas. Likučių koregavimas ir QR nuskaitymas aktyvūs.");
    }
  }
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null); setIsAdmin(false); setIsEmployee(false); flash("Atsijungta.");
  }

  async function refreshProducts() {
    if (!supabase) return flash("Rodomi demonstraciniai duomenys. Prijunkite duomenų bazę, kad duomenys būtų išsaugomi.");
    await loadData(); flash("Likučiai atnaujinti.");
  }

  async function adjustStock(product, delta, reason = "Rankinis likučio pakeitimas", absolute = false, details = null) {
    if (!canManageStock) return flash("Likučius keisti gali tik prisijungęs darbuotojas arba administratorius.");
    if (!supabase) return flash("Duomenų bazė nesukonfigūruota.");
    const newQty = absolute ? Number(delta) : Number(product.quantity) + Number(delta);
    if (!Number.isFinite(newQty) || newQty < 0) return flash("Likutis negali būti neigiamas.");
    setBusy(true);
    if (details) {
      const { error: detailsError } = await supabase.from("products").update({
        min_quantity: Number(details.min_quantity), code: details.code.trim() || null,
        color: details.color || null, description: details.description || null, tank_size: details.tank_size || "large"
      }).eq("id", product.id);
      if (detailsError) { setBusy(false); flash(`Prekės duomenų išsaugoti nepavyko: ${detailsError.message}`); return; }
    }
    const { error } = await supabase.rpc("adjust_stock", {
      p_product_id: product.id, p_new_quantity: newQty, p_reason: reason
    });
    setBusy(false);
    if (error) flash(`Nepavyko pakeisti likučio: ${error.message}`);
    else { await loadData(); setModal(null); flash(details ? "Prekės duomenys ir likutis išsaugoti." : "Likutis išsaugotas."); }
  }

  async function addProduct(values) {
    if (!isAdmin) return flash("Naujas prekes gali pridėti tik administratorius.");
    if (!supabase) return flash("Duomenų bazė nesukonfigūruota.");
    const row = {
      category: values.category, subcategory: values.subcategory || "other", kind: values.kind, name: values.name.trim(),
      surface: values.kind === "paper" ? values.surface : null,
      width_cm: values.kind === "paper" ? Number(values.width_cm) : null,
      code: values.code.trim() || null, quantity: Number(values.quantity), min_quantity: Number(values.min_quantity),
      color: values.kind === "paper" || values.kind === "chemical" ? null : (values.color || null),
      description: values.description?.trim() || null, tank_size: values.kind === "chemical" ? (values.tank_size || "large") : "large",
      unit: values.kind === "paper" ? "vnt." : (values.unit || "bak.")
    };
    const { error } = await supabase.from("products").insert(row);
    if (error) flash(`Prekės pridėti nepavyko: ${error.message}`);
    else { await loadData(); setModal(null); flash("Prekė pridėta."); }
  }

  async function deleteProduct(p) {
    if (!isAdmin || !supabase) return;
    if (!window.confirm(`Tikrai ištrinti „${displayName(p)}“? Pakeitimų istorija liks.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) flash(`Ištrinti nepavyko: ${error.message}`);
    else { await loadData(); flash("Prekė ištrinta."); }
  }

  async function scanCode(code, alreadyLocked = false) {
    const cleaned = String(code || "").trim();
    if (!cleaned || (scanInProgress.current && !alreadyLocked)) return;
    scanInProgress.current = true;
    if (!supabase) { scanInProgress.current = false; return flash("QR nuskaitymas veiks prijungus duomenų bazę."); }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("scan_stock", { p_code: cleaned });
      if (error) flash(`QR nuskaityta („${cleaned}“), bet likutis nepakeistas: ${error.message}. Patikrinkite Supabase SQL funkciją ir administratoriaus teises.`);
      else if (data?.status === "not_found") flash(`QR kodas perskaitytas („${cleaned}“), bet toks prekės kodas nerastas duomenų bazėje.`);
      else if (data?.status === "empty") flash(`„${data.name || cleaned}“ likutis jau 0. Nieko neatimta.`);
      else if (data?.status === "ok") {
        await loadData();
        flash(`Likutis atnaujintas: ${data.name || cleaned}. Dabar liko ${fmt(data.quantity)} vnt. (-1).`);
      } else flash(`QR kodas perskaitytas („${cleaned}“), tačiau duomenų bazė grąžino netikėtą atsakymą. Likutį patikrinkite rankiniu būdu.`);
    } catch (e) {
      flash(`QR kodas perskaitytas, tačiau likučio pakeisti nepavyko: ${e.message || e}`);
    } finally {
      setBusy(false);
      scanInProgress.current = false;
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("scan");
    if (!code || !authReady || !adminChecked || directScanHandled.current) return;
    directScanHandled.current = true;
    // Remove the action from the address bar immediately so refresh won't repeat it.
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("scan");
    window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
    if (!user || !canManageStock) {
      flash("QR nuskaitymas atmestas. Šiame telefono naršyklės lange prisijunkite kaip darbuotojas arba administratorius. Likutis nepakeistas.");
      return;
    }
    flash("QR kodas atpažintas. Tikrinamos administratoriaus teisės…");
    scanCode(code);
  }, [authReady, adminChecked, user, isAdmin, isEmployee]);

  async function startScanner() {
    if (!canManageStock) return flash("QR nuskaitymui prisijunkite kaip darbuotojas arba administratorius.");
    if (!supabase) return flash("Prijunkite Supabase duomenų bazę.");
    setModal({type:"scanner"});
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerInstance.current = scanner;
        await scanner.start({ facingMode:"environment" }, { fps:10, qrbox:{width:230,height:230} },
          async decoded => {
            if (scanInProgress.current) return;
            scanInProgress.current = true;
            try { await scanner.stop(); } catch {}
            scannerInstance.current = null;
            setScannerRunning(false);
            setModal(null);
            await scanCode(decoded, true);
          }, () => {});
        setScannerRunning(true);
      } catch (e) { flash(`Nepavyko paleisti kameros: ${e.message || e}`); }
    }, 250);
  }
  async function stopScanner() {
    if (scannerInstance.current) { try { await scannerInstance.current.stop(); } catch {} scannerInstance.current = null; }
    setScannerRunning(false); setModal(null);
  }

  const pageTitle = activeLabel;
  const categoryProducts = products.filter(p => p.category === active);
  const categoryPaper = categoryProducts.filter(p => p.kind === "paper");
  const categoryChem = categoryProducts.filter(p => p.kind !== "paper");
  const categoryCounts = products.reduce((a,p) => ({...a,[p.category]:(a[p.category]||0)+1}),{});

  return <div className={`app-shell ${canManageStock ? "is-admin" : "view-only"}`}>
    <style>{`
/* Kompaktiškas likučio vaizdas: skaičius pirmas, be pasikartojančio „DABAR“. */
.stock-badge{display:inline-flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;min-width:0!important;width:max-content!important;max-width:100%!important;padding:6px 9px!important;border:1px solid #dfe7e1!important;border-left:3px solid #78a98a!important;border-radius:7px!important;background:#f5f7f5!important;box-shadow:none!important;white-space:nowrap!important;color:#263b2d!important}
.stock-badge strong{font-size:15px!important;line-height:1.15!important;font-weight:750!important;color:#203b2b!important}
.stock-badge span{font-size:10px!important;line-height:1.15!important;color:#66776c!important;opacity:1!important}
.stock-badge.low{background:#fff7f6!important;border-color:#f0d8d5!important;border-left-color:#d86b66!important}
.stock-badge.low strong{color:#b83f3f!important}
.stock-badge.low span{color:#9d6662!important}
.stock-badge.ok{background:#f5f7f5!important}
.generic-row{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(90px,120px) 116px 64px!important;gap:9px!important;align-items:center!important;padding:8px 10px!important;min-width:0!important;border-bottom:1px solid #e7ece8!important}
.generic-row>:first-child{min-width:0!important;max-width:100%!important}
.generic-row>:first-child b{display:-webkit-box!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important;overflow:hidden!important;line-height:1.2!important;overflow-wrap:anywhere!important}
.generic-row .row-actions{display:flex!important;gap:5px!important;justify-content:flex-end!important;white-space:nowrap!important}
.chem-row{border-bottom:1px solid #e2eae4}
@media(max-width:760px){
.chem-row{display:grid!important;grid-template-columns:10px minmax(0,1fr) auto!important;gap:7px 8px!important;padding:10px 7px!important;align-items:center!important}
.chem-row>.chem-name{grid-column:2;grid-row:1}.chem-row>.code-copy,.chem-row>.code-no-code{grid-column:2;grid-row:2;justify-self:start}.chem-row>.tank-bar{grid-column:1 / 3;grid-row:3;justify-self:start;margin-left:18px}.chem-row>.form-note{grid-column:3;grid-row:3}.chem-row>.stock-badge{grid-column:2;grid-row:4;justify-self:start}.chem-row>.row-action{grid-column:3;grid-row:1;justify-self:end}
.generic-table{width:100%;overflow:hidden}.generic-row{grid-template-columns:minmax(0,1fr) auto 64px!important;gap:5px 7px!important;padding:7px 6px!important;min-height:0!important}.generic-row>:first-child{grid-column:1;grid-row:1;align-self:end}.generic-row>.code-copy,.generic-row>.code-no-code{grid-column:1;grid-row:2;justify-self:start;max-width:100%;font-size:11px!important}.generic-row>.wide-paper-stock,.generic-row>.stock-badge{grid-column:2;grid-row:1 / span 2;justify-self:end;align-self:center}.generic-row>.row-actions{grid-column:3;grid-row:1 / span 2;align-self:center;gap:3px!important}.generic-row .row-action{width:29px!important;height:29px!important;min-width:29px!important;padding:5px!important}.stock-badge{padding:5px 7px!important;border-radius:6px!important}.stock-badge strong{font-size:14px!important}.stock-badge span{font-size:9px!important}.subcategory-grid{grid-template-columns:minmax(0,1fr)!important}.subcategory-block{min-width:0!important}.table-head{display:none!important}
}
`}</style>
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><span></span><span></span></div><div><b>FOTO</b><small>LABORATORIJA</small></div><button className="mobile-close icon-button" onClick={()=>setMobileMenu(false)}><X size={20}/></button></div>
      <nav className="main-nav">
        {NAV.map(item => { const Icon=item.icon; return <button key={item.id} className={`nav-item ${active===item.id?"selected":""}`} onClick={()=>{setActive(item.id);setMobileMenu(false);}}><Icon size={21}/><span>{item.label}</span><small>{categoryCounts[item.id]||0}</small></button>; })}
      </nav>
      <div className="nav-divider"></div>
      <div className="nav-caption">Sandėlio veiksmai</div>
      <button className="nav-item" onClick={()=>setModal({type:"qrLibrary"})}><QrCode size={21}/><span>QR nuskaitymas</span></button>
      <button className="nav-item" onClick={()=>setModal({type:"adjust",mode:"add"})}><PlusCircle size={21}/><span>Likučių koregavimas</span></button>
      {isAdmin&&<button className="nav-item" onClick={()=>setModal({type:"product"})}><Package size={21}/><span>Pridėti prekę</span></button>}
      <div className="nav-divider"></div>
      <button className="nav-item" onClick={()=>setModal({type:"history"})}><History size={21}/><span>Istorija</span></button>
      <button className="nav-item" onClick={()=>setModal({type:"reports"})}><ChartNoAxesColumnIncreasing size={21}/><span>Ataskaitos</span></button>
      <button className="nav-item" onClick={()=>flash("Nustatymų skiltis bus išplėsta vėlesniame etape.")}><Settings size={21}/><span>Nustatymai</span></button>
      <div className="sidebar-bottom">
        {user && canManageStock ? <><div className="admin-badge"><UserRound size={18}/><div><b>{isAdmin ? "Administratorius" : "Darbuotojas"}</b><small>{user.email}</small></div></div><button className="nav-item" onClick={signOut}><LogOut size={20}/><span>Atsijungti</span></button></>
          : <button className="login-button" onClick={()=>setModal({type:"login"})}><LockKeyhole size={18}/><span>Prisijungti</span></button>}
      </div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={()=>setMobileMenu(false)} aria-label="Uždaryti meniu"/>}
    <main className="main-content">
      <header className="topbar">
        <div className="title-wrap"><button className="mobile-menu-button icon-button" onClick={()=>setMobileMenu(true)}><Menu size={23}/></button><div className="title-icon"><Layers3 size={30}/></div><div><h1>{pageTitle}</h1><p>Sandėlio likučiai ir medžiagų valdymas</p></div></div>
        <div className="top-meta"><button className="refresh-top-button" onClick={refreshProducts}><RefreshCw size={17}/> Atnaujinti</button><div className="updated"><RefreshCw size={19}/><div><small>Paskutinis pakeitimas šioje skiltyje</small><b>{categoryLastUpdated(products, logs, active) ? shortTime(categoryLastUpdated(products, logs, active)) : "Pakeitimų nėra"}</b></div></div><div className="date-meta"><div className="clock-calendar-icon"><CalendarDays size={43} strokeWidth={2.2}/></div><div className="clock-date-copy"><b>{clockParts(clockNow).weekday}</b><small>{clockParts(clockNow).date}</small></div><div className="clock-divider" aria-hidden="true"></div><div className="clock-time">{clockParts(clockNow).time}</div></div></div>
      </header>

      <section className={`panel order-panel order-panel-top ${orderItems.length ? "has-orders" : "no-orders"}`}>
        <div className="panel-heading"><div className="panel-title"><span className={`heading-icon ${orderItems.length ? "red-icon" : "green-icon"}`}><ShoppingCart size={23}/></span><div><h2>Užsakomos medžiagos</h2><p>{activeLabel} · rodomos tik šios skilties pozicijos, kurių likutis mažesnis už minimumą</p></div></div><span className={`pill-count ${orderItems.length ? "count-red" : "count-green"}`}>{orderItems.length}</span></div>
        <div className="order-list">{orderItems.map(p=><div className="order-item" key={p.id}><div className="order-indicator"></div><div><b>{displayName(p)}</b><small>{subcategoryLabel(p.category,p.subcategory)}</small><CopyCode code={p.code} flash={flash}/></div><StockBadge p={p}/></div>)}{!orderItems.length&&<div className="all-stock-ok"><Check size={18}/> Šioje skiltyje užsakomų medžiagų nėra.</div>}</div>
      </section>

      {notice && <div className="toast" role="status">{notice}<button onClick={()=>setNotice("")}><X size={16}/></button></div>}
      {!configured && <div className="setup-banner"><AlertTriangle size={20}/><div><b>Demonstracinis režimas</b><span>Matote pavyzdinius likučius. Kad duomenys išsisaugotų, prijunkite Supabase pagal README instrukciją.</span></div></div>}
      {loading && <div className="loading-line">Įkeliami sandėlio duomenys…</div>}

      

      {active === "photo" ? <>
        <div className="inventory-grid">
          <section className="panel paper-panel">
            <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><Layers3 size={23}/></span><div><h2>Foto popierius</h2></div></div>{isAdmin && <button className="small-green-button" onClick={()=>setModal({type:"product",kind:"paper"})}><Plus size={16}/> Pridėti</button>}</div>
            <div className="paper-table">
              <div className="table-head paper-head"><span>Paviršius</span><span>Plotis</span><span>Kodas</span><span>Likutis / Min.</span><span className="actions-head">Veiksmai</span></div>
              {["Glossy","Lustre","Silk"].map(surface=>{
                const rows=papers.filter(p=>p.surface===surface);
                return <div className="surface-group" key={surface}>
                  <div className={`surface-label ${PAPER_COLORS[surface]||"green"}`}>{surface}</div>
                  <div className="surface-rows">{rows.length ? rows.map(p=><ProductRow key={p.id} p={p} isAdmin={isAdmin} canManageStock={canManageStock} onAdjust={setModal} flash={flash}/>) : <div className="empty-row">Nėra {surface} pozicijų</div>}</div>
                </div>;
              })}
              {!papers.length && <div className="empty-state">Šioje kategorijoje prekių nėra.</div>}
            </div>
          </section>

          <section className="panel chemical-panel">
            <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><FlaskConical size={23}/></span><div><h2>Foto chemija</h2></div></div>{isAdmin && <button className="small-green-button" onClick={()=>setModal({type:"product",kind:"chemical"})}><Plus size={16}/> Pridėti</button>}</div>
            <div className="chem-list">
              {chemicals.map(p=><div className="chem-row" key={p.id} style={{display:"grid",gridTemplateColumns:"12px minmax(170px,1.5fr) minmax(90px,.8fr) minmax(105px,1fr) 58px minmax(145px,auto) 34px",alignItems:"center",gap:12,padding:"16px 10px",minWidth:0}}><div className={`chem-dot ${chemicalTone(p.name)}`}></div><div className="chem-name" style={{minWidth:0}}><b>{p.name}</b>{productDescription(p)}</div><CopyCode code={p.code} flash={flash}/><TankBar quantity={p.quantity} tone={chemicalTone(p.name)} small={p.tank_size==="small"}/><span className="form-note" style={{fontSize:12,whiteSpace:"nowrap"}}>{p.tank_size==="small"?"Mažas":"Didelis"}</span><StockBadge p={p}/>{canManageStock&&<button className="row-action" onClick={()=>setModal({type:"adjust",product:p,mode:"set"})} aria-label="Koreguoti"><Pencil size={15}/></button>}</div>)}
              {!chemicals.length && <div className="empty-state">Chemijos pozicijų nėra. Administratorius gali pridėti prekę.</div>}
            </div>
            <div className="chem-legend"><span><i className="legend-dot blue"></i>CD Developer</span><span><i className="legend-dot red"></i>BF Bleach Fix A / B</span><span><i className="legend-dot yellow"></i>STB Super Stabilizer</span></div>
          </section>
        </div>
        <section className="panel category-panel photo-other-panel">
          <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><Package size={23}/></span><div><h2>Kita</h2><p>Kitos foto laboratorijos medžiagos</p></div></div>{isAdmin&&<button className="small-green-button" onClick={()=>setModal({type:"product",subcategory:"other",kind:"item"})}><Plus size={16}/> Pridėti</button>}</div>
          <div className="generic-table"><div className="table-head"><span>Prekė</span><span>Kodas</span><span>Likutis / Min.</span><span>Veiksmai</span></div>
            {categoryProducts.filter(p=>(p.subcategory||"other")==="other").slice().sort((a,b)=>displayName(a).localeCompare(displayName(b),"lt")).map(p=><div className="generic-row" key={p.id} style={productRowStyle(p)}><ProductName p={p}/><CopyCode code={p.code} flash={flash}/><StockBadge p={p}/><div className="row-actions">{canManageStock&&<button className="row-action" onClick={()=>setModal({type:"adjust",product:p,mode:"set"})}><Pencil size={15}/></button>}{isAdmin&&<button className="row-action danger" onClick={()=>deleteProduct(p)}><Trash2 size={15}/></button>}</div></div>)}
            {!categoryProducts.some(p=>(p.subcategory||"other")==="other")&&<div className="empty-state">Kitos foto medžiagos bus rodomos čia.</div>}
          </div>
        </section>
      </> : <section className="panel category-panel">
        <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><Package size={23}/></span><div><h2>{activeLabel}</h2><p>Medžiagos suskirstytos pagal šios skilties kategorijas</p></div></div>{isAdmin&&<button className="small-green-button" onClick={()=>setModal({type:"product"})}><Plus size={16}/> Pridėti prekę</button>}</div>
        {<div className="subcategory-grid">{NAV.find(n=>n.id===active)?.sections.map(section=>{
          const rows=categoryProducts.filter(p=>(p.subcategory||"other")===section.id).slice().sort((a,b)=>section.id==="ink"?inkSortKey(a)-inkSortKey(b):displayName(a).localeCompare(displayName(b),"lt"));
          return <div className="subcategory-block" key={section.id}><div className="subcategory-heading"><h3>{section.label}</h3><span>{rows.length} poz.</span>{isAdmin&&<button className="small-green-button" onClick={()=>setModal({type:"product",subcategory:section.id})}><Plus size={14}/> Pridėti</button>}</div>
            <div className="generic-table"><div className="table-head"><span>Prekė</span><span>Kodas</span><span>Likutis / Min.</span><span>Veiksmai</span></div>
              {rows.map(p=><div className={`generic-row ${active==="wide"&&section.id==="paper"?"wide-paper-row":""}`} key={p.id} style={productRowStyle(p)}><ProductName p={p}/><CopyCode code={p.code} flash={flash}/><div className="wide-paper-stock"><StockBadge p={p}/></div><div className="row-actions">{canManageStock&&<button className="row-action" onClick={()=>setModal({type:"adjust",product:p,mode:"set"})}><Pencil size={15}/></button>}{isAdmin&&<button className="row-action danger" onClick={()=>deleteProduct(p)}><Trash2 size={15}/></button>}</div></div>)}
              {!rows.length&&<div className="empty-state">Šioje kategorijoje prekių nėra.{isAdmin?" Galite pridėti prekę.":""}</div>}
            </div>
          </div>;
        })}</div>}
      </section>}

      <div className="bottom-grid">
        <section className="panel history-panel">
          <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><History size={23}/></span><div><h2>Naujausi pakeitimai</h2><p>Sandėlio veiksmų istorija</p></div></div><button className="text-button" onClick={()=>setModal({type:"history"})}>Visa istorija <ChevronRight size={16}/></button></div>
          <div className="history-table"><div className="table-head"><span>Laikas</span><span>Pozicija</span><span>Pokytis</span><span>Priežastis</span></div>
            {activeLogs.slice(0,5).map(log=><div className="history-row" key={log.id}><span>{shortTime(log.created_at)}</span><b>{log.products ? displayName(log.products) : log.product_name || "Prekė"}</b><strong className={Number(log.delta)<0?"negative-text":"positive-text"}>{Number(log.delta)>0?"+":""}{fmt(log.delta)}</strong><span>{log.reason||"Likučio pakeitimas"}</span></div>)}
            {!activeLogs.length&&<div className="empty-state">Šioje skiltyje pakeitimų dar nėra.</div>}
          </div>
        </section>

      </div>
      <footer className="footer"><span>FOTO LABORATORIJA · Sandėlio sistema</span><span>{user&&isAdmin?"Administratoriaus režimas":user&&isEmployee?"Darbuotojo režimas":"Viešas peržiūros režimas"} · Laikas: Lietuva</span></footer>
    </main>

    <nav className="mobile-bottom-nav">{NAV.map(item=>{const Icon=item.icon;return <button key={item.id} className={active===item.id?"active":""} onClick={()=>{setActive(item.id);}}><Icon size={19}/><span>{item.id==="photo"?"Medžiagos":item.id==="wide"?"Spauda":item.id==="sublimation"?"Sublimacija":item.id==="framing"?"Rėminimas":"Kitos"}</span></button>})}</nav>

    {modal?.type==="login"&&<Modal title="Prisijungimas prie sandėlio" onClose={()=>setModal(null)}><LoginForm onSubmit={signIn} busy={busy}/></Modal>}
    {modal?.type==="product"&&<Modal title="Pridėti naują prekę" onClose={()=>setModal(null)}><ProductForm category={active} kind={modal.kind} subcategory={modal.subcategory} onSubmit={addProduct} busy={busy}/></Modal>}
    {modal?.type==="adjust"&&<Modal title="Likučių koregavimas" onClose={()=>setModal(null)}><AdjustForm products={products} initialProduct={modal.product} mode={modal.mode} isAdmin={isAdmin} onSubmit={adjustStock} busy={busy}/></Modal>}
    {modal?.type==="scanner"&&<Modal title="QR kodo nuskaitymas" onClose={stopScanner}><p className="modal-help">Nukreipkite kamerą į prekės QR kodą. Sėkmingai nuskaičius, likutis sumažės vienu vienetu.</p><div id="qr-reader" className="qr-reader" ref={scannerRef}></div><button className="secondary-button full-width" onClick={stopScanner}>Uždaryti kamerą</button></Modal>}
    {modal?.type==="history"&&<Modal title="Visa sandėlio istorija" onClose={()=>setModal(null)} wide><HistoryModal logs={logs} products={products}/></Modal>}
    {modal?.type==="reports"&&<Modal title="Sandėlio ataskaitos" onClose={()=>setModal(null)} wide><ReportsModal logs={logs} products={products}/></Modal>}
    {modal?.type==="qr"&&<Modal title="Prekės QR etiketė" onClose={()=>setModal(null)}><QrLabel product={modal.product}/></Modal>}
    {modal?.type==="qrLibrary"&&<Modal title="QR nuskaitymas ir etiketės" onClose={()=>setModal(null)} wide><QrLibrary products={products} isAdmin={isAdmin} canManageStock={canManageStock} onScan={startScanner} onPrint={product=>setModal({type:"qr",product})}/></Modal>}
  </div>;
}

function StockBadge({p}) { const percent=isInkProduct(p); const unit=percent?"%":(p.unit||"vnt."); return <span className={`stock-badge ${stockTone(p)}`}><strong>{fmt(p.quantity)} {unit}</strong><span>Min. {fmt(p.min_quantity)} {unit}</span></span>; }
function productRowStyle(p) {
  if (p.kind === "paper" || p.kind === "chemical" || !p.color) return undefined;
  return { backgroundColor: p.color, borderLeft: "3px solid #789985" };
}
function CopyCode({code,flash}) {
  const [copied,setCopied]=useState(false);
  if (!String(code || "").trim()) return <span className="code-no-code">Be kodo</span>;
  async function copy(){try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1400);}catch{flash("Nepavyko nukopijuoti kodo.");}}
  return <button className="code-copy" onClick={copy} title="Kopijuoti prekės kodą"><span>{code}</span>{copied?<Check size={15}/>:<Copy size={15}/>}</button>;
}
function ProductRow({p,canManageStock,onAdjust,flash}) {
  return <div className="paper-row"><span className="paper-width">{String(p.width_cm).replace(".",",")} cm{p.description&&<small style={{display:"block",fontSize:10,fontWeight:400,opacity:.65}}>{p.description}</small>}</span><CopyCode code={p.code} flash={flash}/><StockBadge p={p}/><div className="row-actions">{canManageStock&&<><button className="row-action" title="Atimti 1" onClick={()=>onAdjust({type:"adjust",product:p,mode:"remove"})}><Minus size={14}/></button><button className="row-action" title="Pridėti 1" onClick={()=>onAdjust({type:"adjust",product:p,mode:"add"})}><Plus size={14}/></button><button className="row-action" title="Koreguoti likutį" onClick={()=>onAdjust({type:"adjust",product:p,mode:"set"})}><Pencil size={14}/></button></>}</div></div>;
}
function TankBar({quantity,tone,small=false}) {
  const amount=Math.max(0,Number(quantity)||0);
  const full=Math.floor(amount+1e-8);
  const fraction=Math.round((amount-full)*10)/10;
  const limit=small?10:5;
  const shown=Math.min(full,limit);
  const showPartial=full<limit && fraction>0;
  const overflow=amount>limit;
  const tanks=Array.from({length:shown},(_,i)=>({key:i,level:1}));
  if(showPartial) tanks.push({key:"partial",level:fraction});
  return <div className={`tank-bar ${tone} ${small?"tank-bar-small":"tank-bar-large"}`} aria-label={`Likutis ${amount.toFixed(1)} bakų`}>
    {tanks.map(t=><span key={t.key} className="tank filled" title={`${Math.round(t.level*100)}%`}><i style={{height:`${Math.max(0,Math.min(1,t.level))*100}%`}}/></span>)}
    {overflow&&<b className="tank-overflow">{limit}+</b>}
  </div>;
}
function Modal({title,children,onClose,wide}) {
  useEffect(()=>{const f=e=>e.key==="Escape"&&onClose();window.addEventListener("keydown",f);return()=>window.removeEventListener("keydown",f)},[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className={`modal ${wide?"modal-wide":""}`} role="dialog" aria-modal="true"><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={20}/></button></header><div className="modal-body">{children}</div></section></div>;
}
function LoginForm({onSubmit,busy}) {
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit(email,password)}}><label>El. paštas<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@imone.lt"/></label><label>Slaptažodis<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary-button" disabled={busy}>{busy?"Jungiamasi…":"Prisijungti"}</button><p className="form-note">Darbuotojai gali keisti likučius ir naudoti QR nuskaitymą. Prekių pridėjimas ir trynimas prieinamas tik administratoriui.</p></form>;
}
function ProductForm({category,kind:forcedKind,subcategory:forcedSubcategory,onSubmit,busy}) {
  const [cat,setCat]=useState(category||"photo");const [subcategory,setSubcategory]=useState(forcedSubcategory || (forcedKind==="paper"?"paper":forcedKind==="chemical"?"chemical":"other"));const [kind,setKind]=useState(forcedKind||(forcedSubcategory==="chemical"?"chemical":forcedSubcategory==="ink"?"ink":forcedSubcategory==="paper"?"paper":"item"));const [name,setName]=useState("");const [description,setDescription]=useState("");const [tankSize,setTankSize]=useState("large");const [surface,setSurface]=useState("Glossy");const [width,setWidth]=useState("12.7");const [code,setCode]=useState("");const [qty,setQty]=useState("0");const [min,setMin]=useState("1");const [unit,setUnit]=useState(forcedSubcategory==="ink"?"%":"bak.");const [color,setColor]=useState("");
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit({category:cat,subcategory,kind,name:kind==="paper"?surface:name,surface,width_cm:width,code,quantity:qty,min_quantity:min,unit,color,description,tank_size:tankSize})}}>
    <label>Kategorija<select value={cat} onChange={e=>{const next=NAV.find(n=>n.id===e.target.value);setCat(e.target.value);const first=next?.sections[0]?.id||"other";setSubcategory(first);setKind(e.target.value==="photo"&&first==="paper"?"paper":e.target.value==="photo"&&first==="chemical"?"chemical":first==="ink"?"ink":"item");}}>{NAV.map(n=><option value={n.id} key={n.id}>{n.label}</option>)}</select></label>
    <label>Medžiagų kategorija<select value={subcategory} onChange={e=>{setSubcategory(e.target.value);if(cat==="photo"&&e.target.value==="paper")setKind("paper");else if(cat==="photo"&&e.target.value==="chemical")setKind("chemical");else setKind(e.target.value==="ink"?"ink":"item");if(e.target.value==="ink"){setUnit("%");setCat("wide");}}}>{(NAV.find(n=>n.id===cat)?.sections||[]).map(section=><option value={section.id} key={section.id}>{section.label}</option>)}</select></label>
    {kind==="paper"?<><label>Paviršius<select value={surface} onChange={e=>setSurface(e.target.value)}><option>Glossy</option><option>Lustre</option><option>Silk</option></select></label><label>Plotis<select value={width} onChange={e=>setWidth(e.target.value)}><option value="12.7">12,7 cm</option><option value="15.2">15,2 cm</option><option value="30.5">30,5 cm</option></select></label></>:<><label>Prekės pavadinimas<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Pvz., papildoma chemija"/></label><label>Matavimo vienetas<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="bak.">bak.</option><option value="vnt.">vnt.</option><option value="l">l</option><option value="kg">kg</option><option value="pak.">pak.</option><option value="rul.">rulonas</option><option value="%">%</option></select></label></>}
    <label>Aprašymas (nebūtina)<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Pvz., XXL spaudos popierius"/></label>
    {kind==="chemical"&&<label>Bako dydis<select value={tankSize} onChange={e=>setTankSize(e.target.value)}><option value="large">Didelis</option><option value="small">Mažas</option></select></label>}
    <label>Prekės kodas (nebūtina)<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Jei yra, įveskite prekės kodą"/></label>
    {kind!=="paper"&&kind!=="chemical"&&<label>Prekės spalva<select value={color} onChange={e=>setColor(e.target.value)}><option value="">Be spalvos</option>{PRODUCT_PALETTE.map(c=><option value={c.value} key={c.value}>{c.name}</option>)}</select></label>}
    <div className="form-two"><label>{kind==="ink"?"Dabartinis lygis (%)":"Dabartinis likutis"}<input type="number" required min="0" step={kind==="ink"?1:kind==="chemical"||unit==="rul."?"0.1":"0.5"} value={qty} onChange={e=>setQty(e.target.value)}/></label><label>{kind==="ink"?"Minimalus lygis (%)":"Minimalus likutis"}<input type="number" required min="0" step={kind==="ink"?1:kind==="chemical"||unit==="rul."?"0.1":"0.5"} value={min} onChange={e=>setMin(e.target.value)}/></label></div>
    <button className="primary-button" disabled={busy}>{busy?"Saugoma…":"Pridėti prekę"}</button><p className="form-note">Prekės kodas neprivalomas. Jei jį įvesite, jis turi būti unikalus. QR nuskaitymas veikia prekėms, turinčioms kodą.</p>
  </form>;
}
function AdjustForm({products,initialProduct,mode:initialMode,isAdmin,onSubmit,busy}) {
  const [mode,setMode]=useState(initialMode||"add");
  const [id,setId]=useState(initialProduct?.id||"");const product=products.find(p=>String(p.id)===String(id));
  const [amount,setAmount]=useState((initialMode||"add")==="set"?String(initialProduct?.quantity??0):"1");
  const [reason,setReason]=useState((initialMode||"add")==="add"?"Papildymas":(initialMode||"add")==="remove"?"Paėmimas":"Likučio perskaičiavimas");
  const [minQty,setMinQty]=useState(String(initialProduct?.min_quantity??0));const [code,setCode]=useState(initialProduct?.code||"");const [color,setColor]=useState(initialProduct?.color||"");
  const [description,setDescription]=useState(initialProduct?.description||"");const [tankSize,setTankSize]=useState(initialProduct?.tank_size||"large");
  function selectProduct(nextId){const p=products.find(x=>String(x.id)===nextId);setId(nextId);setAmount(mode==="set"?String(p?.quantity??0):"1");setMinQty(String(p?.min_quantity??0));setCode(p?.code||"");setColor(p?.color||"");setDescription(p?.description||"");setTankSize(p?.tank_size||"large");}
  function changeMode(next){setMode(next);setAmount(next==="set"?String(product?.quantity??0):"1");setReason(next==="add"?"Papildymas":next==="remove"?"Paėmimas":"Likučio perskaičiavimas");}
  const after=product?(mode==="set"?Number(amount):Number(product.quantity)+(mode==="remove"?-1:1)*Number(amount)):0;
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();if(!product)return;const n=Number(amount);const delta=mode==="add"?n:mode==="remove"?-n:n;onSubmit(product,delta,reason,mode==="set",isAdmin&&mode==="set"?{min_quantity:minQty,code,color,description,tank_size:tankSize}:null)}}>
    <div className="adjust-mode-switch" role="group" aria-label="Likučio veiksmas"><button type="button" className={mode==="add"?"active":""} onClick={()=>changeMode("add")}><Plus size={15}/> Pridėti</button><button type="button" className={mode==="remove"?"active":""} onClick={()=>changeMode("remove")}><Minus size={15}/> Atimti</button><button type="button" className={mode==="set"?"active":""} onClick={()=>changeMode("set")}><Pencil size={15}/> Koreguoti</button></div>
    <label>Prekė<select required value={id} onChange={e=>selectProduct(e.target.value)}><option value="">Pasirinkite prekę</option>{products.map(p=><option value={p.id} key={p.id}>{displayName(p)} · {p.code||"Be kodo"} ({fmt(p.quantity)}{p.kind==="ink"?"%":""})</option>)}</select></label>
    <label>{mode==="set"?(product?.kind==="ink"?"Naujas tikslus lygis (%)":"Naujas tikslus likutis"):(product?.kind==="ink"?"Pokytis (%)":"Kiekis")}<input type="number" required min="0" step={product?.kind==="ink"?1:product?.kind==="chemical"||isRollProduct(product)?"0.1":"0.5"} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    {isAdmin&&mode==="set"&&product&&<>
      <div className="form-two"><label>Minimalus likutis<input type="number" required min="0" step={product.kind==="chemical"||isRollProduct(product)?"0.1":"0.5"} value={minQty} onChange={e=>setMinQty(e.target.value)}/></label><label>Prekės kodas (nebūtina)<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Be kodo"/></label></div>
      <label>Aprašymas (nebūtina)<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Pvz., XXL spaudos popierius"/></label>
      {product.kind==="chemical"&&<label>Bako dydis<select value={tankSize} onChange={e=>setTankSize(e.target.value)}><option value="large">Didelis</option><option value="small">Mažas</option></select></label>}
      {product.kind!=="paper"&&product.kind!=="chemical"&&<label>Prekės spalva<select value={color} onChange={e=>setColor(e.target.value)}><option value="">Be spalvos</option>{PRODUCT_PALETTE.map(c=><option value={c.value} key={c.value}>{c.name}</option>)}</select></label>}
    </>}
    <label>Priežastis<select value={reason} onChange={e=>setReason(e.target.value)}><option>Papildymas</option><option>Paėmimas</option><option>QR nuskaitymas praleistas</option><option>Likučio perskaičiavimas</option><option>Brokuota / sugadinta</option><option>Kita</option></select></label>
    {product&&<div className="adjust-preview"><span>Dabartinis likutis</span><b>{fmt(product.quantity)}{product.kind==="ink"?"%":` ${product.unit}`}</b><span>Po pakeitimo</span><b>{fmt(after)}{product.kind==="ink"?"%":` ${product.unit}`}</b></div>}
    <button className="primary-button" disabled={busy||!product}>{busy?"Saugoma…":mode==="set"?"Išsaugoti pakeitimus":"Išsaugoti likutį"}</button>
  </form>;
}
function QrLibrary({products,isAdmin,canManageStock,onScan,onPrint}) {
  const qrProducts=products.filter(p=>p.kind==="paper");
  return <div className="qr-library"><div className="qr-library-intro"><p>Čia pateikti foto popieriaus QR kodai. Etiketę atsispausdinkite vieną kartą. Nukreipus į ją įprastą telefono kamerą, atsidarys svetainė ir likutis automatiškai sumažės 1 vnt., jei tame naršyklės lange esate prisijungę kaip darbuotojas arba administratorius.</p><button className="primary-button" onClick={onScan}><ScanLine size={16} style={{verticalAlign:"middle",marginRight:6}}/> Skenuoti QR kodą</button></div>
    {!canManageStock&&<p className="form-note">QR nuskaitymui ir likučio keitimui prisijunkite kaip darbuotojas arba administratorius. Etikečių spausdinimas prieinamas administratoriui.</p>}
    <div className="qr-library-list">{qrProducts.slice().sort((a,b)=>displayName(a).localeCompare(displayName(b),"lt")).map(p=><div className="qr-library-row" key={p.id}><div><b>{displayName(p)}</b><small>{subcategoryLabel(p.category,p.subcategory)} · {p.code}</small></div><span className="stock-badge">{fmt(p.quantity)} {p.unit}</span>{isAdmin&&<button className="secondary-button" onClick={()=>onPrint(p)}><QrCode size={15}/> Spausdinti etiketę</button>}</div>)}{!qrProducts.length&&<div className="empty-state">Foto popieriaus QR kodai atsiras pridėjus popieriaus pozicijų.</div>}</div>
  </div>;
}
function QrLabel({product}) {
  const label = displayName(product);
  return <div className="qr-label-wrap">
    <div className="qr-print-label">
      <div className="qr-brand"><span className="brand-mark"><span></span><span></span></span><b>FOTO LABORATORIJA</b></div>
      <QRCodeCanvas value={`${window.location.origin}/?scan=${encodeURIComponent(product.code)}`} size={210} level="H" includeMargin />
      <h3>{label}</h3><p>{product.code}</p><small>Vienas nuskaitymas = −1 vnt.</small>
    </div>
    <button className="primary-button full-width" onClick={()=>window.print()}><Download size={16} style={{verticalAlign:"middle",marginRight:7}}/> Spausdinti QR etiketę</button>
    <p className="form-note">QR kode yra tiesioginė saugi nuoroda. Nuskenavus įprasta telefono kamera, svetainė atsidarys ir automatiškai atims 1 vnt. tik tada, jei tame pačiame naršyklės lange esate prisijungę kaip darbuotojas arba administratorius. Kitu atveju likutis nebus keičiamas.</p>
  </div>;
}
function logCategory(log, products=[]) {
  const category = log.products?.category || products.find(p => p.id === log.product_id)?.category;
  return NAV.find(n => n.id === category)?.label || "Ištrinta / nepriskirta prekė";
}
function HistoryModal({logs, products=[]}) {
  const [category, setCategory] = useState("all");
  const filtered = logs.filter(log => category === "all" || (log.products?.category || products.find(p => p.id === log.product_id)?.category) === category);
  return <div className="report-content">
    <div className="report-filter-grid history-filter"><label>Kategorija<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Visos kategorijos</option>{NAV.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label><div className="report-result-count">Įrašų: <b>{filtered.length}</b></div></div>
    <div className="history-modal-list">{filtered.length?filtered.map(log=><div className="history-modal-row" key={log.id}><div><b>{log.products?displayName(log.products):log.product_name||"Prekė"}</b><small>{shortTime(log.created_at)} · {logCategory(log,products)} · {log.reason||"Likučio pakeitimas"}</small></div><strong className={Number(log.delta)<0?"negative-text":"positive-text"}>{Number(log.delta)>0?"+":""}{fmt(log.delta)}</strong></div>):<div className="empty-state">Pasirinktoje istorijoje įrašų nėra.</div>}</div>
  </div>;
}

const REPORT_PRESETS = [
  {value:"3",label:"3 dienos"},{value:"7",label:"7 dienos"},{value:"14",label:"14 dienų"},
  {value:"30",label:"30 dienų"},{value:"60",label:"60 dienų"},{value:"90",label:"90 dienų"},
  {value:"120",label:"120 dienų"},{value:"365",label:"365 dienos"},{value:"all",label:"Visas laikotarpis"},{value:"custom",label:"Pasirinkti datas"}
];
function localDateInput(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0,10);
}
function ReportsModal({logs, products=[]}) {
  const today = new Date();
  const [period, setPeriod] = useState("30");
  const [fromDate, setFromDate] = useState(localDateInput(new Date(today.getFullYear(),today.getMonth(),today.getDate()-29)));
  const [toDate, setToDate] = useState(localDateInput(today));
  const [category, setCategory] = useState("all");
  const [movement, setMovement] = useState("all");
  const [search, setSearch] = useState("");
  const dateRange = useMemo(() => {
    if (period === "all") return {from:null,to:null};
    if (period === "custom") return {from:fromDate ? new Date(`${fromDate}T00:00:00`) : null,to:toDate ? new Date(`${toDate}T23:59:59.999`) : null};
    const days = Number(period); const end = new Date(); const start = new Date();
    start.setDate(start.getDate() - days + 1); start.setHours(0,0,0,0);
    return {from:start,to:end};
  },[period,fromDate,toDate]);
  const invalidRange = period === "custom" && fromDate && toDate && fromDate > toDate;
  const filtered = useMemo(() => logs.filter(log => {
    const delta = Number(log.delta);
    const categoryId = log.products?.category || products.find(p=>p.id===log.product_id)?.category;
    const stamp = new Date(log.created_at);
    const linkedProduct = log.products || products.find(p=>p.id===log.product_id);
    const name = linkedProduct ? displayName(linkedProduct) : (log.product_name || "Prekė");
    const code = String(log.code || linkedProduct?.code || "").trim();
    if (invalidRange) return false;
    if (dateRange.from && stamp < dateRange.from) return false;
    if (dateRange.to && stamp > dateRange.to) return false;
    if (category !== "all" && categoryId !== category) return false;
    if (movement === "added" && delta <= 0) return false;
    if (movement === "used" && delta >= 0) return false;
    const query = search.trim().toLocaleLowerCase("lt");
    if (query && !`${name} ${code} ${log.reason||""}`.toLocaleLowerCase("lt").includes(query)) return false;
    return true;
  }),[logs,products,dateRange,category,movement,search,invalidRange]);
  const totals = useMemo(() => {
    const map = new Map();
    for (const log of filtered) {
      const key = `${log.product_id || log.product_name || "unknown"}`;
      const linkedProduct = log.products || products.find(p=>p.id===log.product_id);
      const name = linkedProduct ? displayName(linkedProduct) : (log.product_name || "Prekė");
      const code = String(log.code || linkedProduct?.code || "").trim();
      const row = map.get(key) || {key,name,code,category:logCategory(log,products),added:0,used:0,events:0,last:log.created_at};
      if (!row.code && code) row.code = code;
      const delta = Number(log.delta)||0;
      if (delta > 0) row.added += delta;
      if (delta < 0) row.used += Math.abs(delta);
      row.events += 1;
      if (new Date(log.created_at) > new Date(row.last)) row.last = log.created_at;
      map.set(key,row);
    }
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,"lt"));
  },[filtered,products]);
  const totalAdded = filtered.reduce((sum,l)=>sum+Math.max(0,Number(l.delta)||0),0);
  const totalUsed = filtered.reduce((sum,l)=>sum+Math.max(0,-(Number(l.delta)||0)),0);
  return <div className="report-content">
    <p className="report-intro">Pasirink laikotarpį, kategoriją ir judėjimo tipą. Teigiamas pokytis reiškia papildymą, neigiamas – sunaudojimą arba paėmimą iš sandėlio.</p>
    <div className="report-filter-grid">
      <label>Laikotarpis<select value={period} onChange={e=>setPeriod(e.target.value)}>{REPORT_PRESETS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
      <label>Skiltis<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">Visos skiltys</option>{NAV.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
      <label>Veiksmas<select value={movement} onChange={e=>setMovement(e.target.value)}><option value="all">Papildyta ir sunaudota</option><option value="added">Tik papildyta</option><option value="used">Tik sunaudota / paimta</option></select></label>
      <label>Prekės paieška<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Pavadinimas, kodas arba priežastis" /></label>
    </div>
    {period === "custom" && <div className="report-filter-grid custom-date-grid"><label>Nuo datos<input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} /></label><label>Iki datos<input type="date" value={toDate} min={fromDate || undefined} onChange={e=>setToDate(e.target.value)} /></label></div>}
    {invalidRange && <p className="report-validation">„Nuo“ data negali būti vėlesnė už „iki“ datą.</p>}
    <div className="report-summary-cards"><div><small>Įvykių</small><b>{filtered.length}</b></div><div><small>Papildyta iš viso</small><b className="positive-text">+{fmt(totalAdded)}</b></div><div><small>Sunaudota / paimta</small><b className="negative-text">−{fmt(totalUsed)}</b></div></div>
    <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Prekė</th><th>Kodas</th><th>Kategorija</th><th>Papildyta</th><th>Sunaudota</th><th>Įvykių</th><th>Paskutinis veiksmas</th></tr></thead><tbody>
      {totals.map(row=><tr key={row.key}><td><b>{row.name}</b></td><td>{row.code || "—"}</td><td>{row.category}</td><td className="positive-text">{row.added?`+${fmt(row.added)}`:"—"}</td><td className="negative-text">{row.used?`−${fmt(row.used)}`:"—"}</td><td>{row.events}</td><td>{shortTime(row.last)}</td></tr>)}
      {!totals.length&&<tr><td colSpan="7" className="report-empty">Pagal pasirinktus filtrus įrašų nerasta.</td></tr>}
    </tbody></table></div>
    <p className="form-note">Ataskaita skaičiuojama pagal užregistruotus sandėlio likučio pakeitimus. Pradiniai likučiai ir prekės sukūrimas be likučio judėjimo istorijos į sumas neįtraukiami.</p>
  </div>;
}