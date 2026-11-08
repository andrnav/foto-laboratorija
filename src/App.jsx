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
  { id: "framing", label: "Rėminimas", icon: Frame, sections: [{id:"subframes",label:"Poremiai"},{id:"framing_materials",label:"Rėminimo medžiagos"},{id:"bases",label:"Pagrindai"},{id:"materials",label:"Naudojamos medžiagos"},{id:"other",label:"Kita"}] },
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
  // Ilgesnius pavadinimus tikriname pirmiau, kad „Light Cyan“ netaptų „Cyan“.
  return [...INK_ORDER].sort((a,b)=>b.length-a.length).find(color => n===color || n.includes(color)) || n;
}
function inkHex(name="") {
  const n=normalizedInkName(name);
  const colors={magenta:"#d62978",orange:"#f28c28",cyan:"#00a6d6","light black":"#8b9299",yellow:"#f2d21b","light magenta":"#f9cfe0",black:"#252525","light cyan":"#c8eff8"};
  return colors[n] || "#a0a0a0";
}
function isInkProduct(p) { return Boolean(p) && (p.kind==="ink" || p.subcategory==="ink" || (p.category==="wide" && INK_ORDER.some(c=>normalizedInkName(p.name)===c))); }
function inkSortKey(p) {
  const n=String(p.name||"").toLowerCase().replace(/[_-]+/g," ").trim();
  const i=INK_ORDER.indexOf(n);
  return i < 0 ? 100 : i;
}
function productDescription(p) { return p.description ? <small className="product-description" style={{display:"block",fontSize:"12px",fontWeight:500,color:"#65776c",opacity:1,marginTop:3,lineHeight:1.25}}>{p.description}</small> : null; }
function ProductName({p}) {
  return <div className={isInkProduct(p) ? "ink-product-name" : undefined}>{isInkProduct(p)&&<span className="ink-color-swatch" aria-hidden="true" style={{display:"inline-block",width:34,height:25,minWidth:34,borderRadius:"6px",background:inkHex(p.name),border:"2px solid #ffffff",boxShadow:"0 0 0 1px #64756b88"}}/>}<b>{displayName(p)}</b>{productDescription(p)}</div>;
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
  if (n.includes("bf") || n.includes("bleach fix")) {
    // A+B pakuotė rodoma po atskirų A ir B pozicijų.
    if (n.includes("a+b") || n.includes("a + b") || n.includes("a ir b")) return 2;
    if (n.includes("bleach fix b")) return 1;
    if (n.includes("bleach fix a")) return 0.5;
    return 1.5;
  }
  if (n.includes("stb") || n.includes("stabilizer")) return 3;
  return 4;
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
      unit: values.kind === "paper" ? "vnt." : (values.subcategory === "ink" ? "%" : (values.unit || "bak."))
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
:root{
 --bg:#eef2f5;--surface:#ffffff;--surface-2:#f7f9fb;--ink:#172b3a;--muted:#667887;--line:#dce5eb;
 --accent:#176b70;--accent-2:#dceff0;--accent-dark:#104e53;--danger:#b94b52;--danger-bg:#fff0f0;
 --shadow:0 8px 24px rgba(29,52,68,.07);--radius:16px;
}
*{box-sizing:border-box}
.app-shell{display:flex;min-height:100vh;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:14px;line-height:1.45}
button,input,select,textarea{font:inherit}button{cursor:pointer;transition:background .16s ease,border-color .16s ease,transform .16s ease,box-shadow .16s ease}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #69b9bd;outline-offset:2px}
.sidebar{position:sticky;top:0;display:flex;flex:0 0 248px;flex-direction:column;width:248px;height:100vh;padding:22px 16px 16px;background:#142f3a;color:#eaf3f5;border-right:1px solid #254653;z-index:30}
.brand{display:flex;align-items:center;gap:12px;padding:4px 12px 28px;color:#fff}.brand b{display:block;font-size:22px;line-height:1.05;letter-spacing:.06em}.brand small{display:block;margin-top:3px;color:#a9c1c7;font-size:10px;font-weight:750;letter-spacing:.16em}.brand-mark{display:flex;flex-direction:column;gap:5px}.brand-mark span{display:block;width:31px;height:10px;border-radius:8px;background:#55c3b6;transform:skewY(-24deg)}.brand-mark span+span{width:23px;margin-left:7px;background:#9bd8d1}
.mobile-close{margin-left:auto}.main-nav{display:flex;flex-direction:column;gap:5px}.nav-item{display:flex;align-items:center;gap:12px;width:100%;min-height:45px;padding:10px 12px;border:1px solid transparent;border-radius:10px;background:transparent;color:#c5d6da;text-align:left;font-weight:650}.nav-item svg{flex:0 0 21px;color:#83b7b7}.nav-item span{flex:1;min-width:0}.nav-item small{color:#91aeb3;font-size:11px}.nav-item:hover{background:#1d414c;color:#fff}.nav-item.selected{background:#23636a;border-color:#39838a;color:#fff;box-shadow:inset 3px 0 #79d2c7}.nav-item.selected svg{color:#b9eee6}.nav-divider{height:1px;margin:17px 7px;background:#31515b}.nav-caption{padding:4px 12px 8px;color:#83a3aa;font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.sidebar-bottom{margin-top:auto}.admin-badge{display:flex;align-items:center;gap:10px;padding:12px;border:1px solid #31545d;border-radius:12px;background:#1b414b;color:#e8f5f4}.admin-badge small{display:block;max-width:165px;overflow:hidden;color:#a9c5c8;text-overflow:ellipsis}.login-button{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:12px;border:1px solid #42636a;border-radius:10px;background:#1b414b;color:#fff}.mobile-close,.mobile-menu-button,.mobile-bottom-nav{display:none}
.main-content{flex:1;min-width:0;width:calc(100% - 248px);max-width:none;padding:26px clamp(18px,3vw,44px) 28px;overflow:hidden}.topbar{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:0 auto 24px;max-width:1540px}.title-wrap{display:flex;align-items:center;gap:14px;min-width:220px}.title-icon,.heading-icon{display:grid;place-items:center;flex:0 0 46px;width:46px;height:46px;border-radius:13px;background:var(--accent-2);color:var(--accent)}.title-wrap h1{margin:0;color:var(--ink);font-size:clamp(23px,2vw,30px);font-weight:800;letter-spacing:-.04em}.title-wrap p{margin:3px 0 0;color:var(--muted);font-size:13px}.top-meta{display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap}.refresh-top-button,.small-green-button,.primary-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:40px;padding:9px 14px;border:1px solid var(--accent);border-radius:10px;background:var(--accent);color:#fff;font-weight:750;box-shadow:0 3px 8px #176b701c}.refresh-top-button:hover,.small-green-button:hover,.primary-button:hover{background:var(--accent-dark);transform:translateY(-1px)}.updated{display:flex;align-items:center;gap:10px;padding:5px 12px;color:var(--accent)}.updated small,.updated b{display:block}.updated small{color:var(--muted);font-size:11px}.updated b{color:var(--ink);font-size:12px}.date-meta{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid #c9dfdf;border-radius:13px;background:#f7fcfb;color:var(--accent-dark)}.clock-calendar-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:#dcefed}.clock-calendar-icon svg{width:21px;height:21px}.clock-date-copy b,.clock-date-copy small{display:block}.clock-date-copy b{font-size:12px}.clock-date-copy small{color:var(--muted);font-size:10px}.clock-divider{height:30px;width:1px;background:#cbdcdd}.clock-time{font-size:22px;font-weight:850;font-variant-numeric:tabular-nums;letter-spacing:-.04em}
.panel{min-width:0;margin:0 0 18px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow);overflow:hidden}.order-panel-top,.inventory-grid,.photo-other-panel,.bottom-grid{width:100%;max-width:1540px;margin-left:auto;margin-right:auto}.panel-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:17px 20px;border-bottom:1px solid var(--line);background:linear-gradient(110deg,#fff,#f8fbfc)}.panel-title{display:flex;align-items:center;gap:12px;min-width:0}.panel-title h2{margin:0;color:var(--ink);font-size:18px;font-weight:800;letter-spacing:-.025em}.panel-title p{margin:3px 0 0;color:var(--muted);font-size:11px}.heading-icon{width:38px;height:38px;flex-basis:38px;border-radius:11px}.green-icon{background:#e0f1ee;color:var(--accent)}.red-icon{background:var(--danger-bg);color:var(--danger)}.pill-count{display:grid;place-items:center;min-width:29px;height:29px;padding:0 8px;border-radius:9px;font-weight:800}.count-red{background:#ffe5e5;color:var(--danger)}.count-green{background:#e1f1ed;color:var(--accent)}
.order-list{display:flex;flex-direction:column;gap:0;padding:7px 18px 12px}.order-item{display:flex!important;align-items:center!important;gap:14px!important;padding:12px 8px!important;border-bottom:1px solid var(--line)}.order-item:last-child{border-bottom:0}.order-indicator{width:5px;height:38px;border-radius:5px;background:#d66d70}.order-item>div:nth-child(2){width:auto!important;flex:1 1 auto;min-width:0}.order-item>div:nth-child(2)>b{color:var(--ink)}.order-item small{display:block;color:var(--muted)}.order-item .stock-badge{margin-left:auto}.all-stock-ok{display:flex;align-items:center;gap:9px;padding:16px;color:var(--accent)}
.inventory-grid{display:flex;flex-flow:column nowrap;gap:18px;align-items:stretch}.inventory-grid>.panel{width:100%;min-width:0}.paper-panel,.chemical-panel{overflow:hidden}.paper-table{padding:14px 16px 17px}.table-head{display:flex;align-items:center;gap:12px;padding:10px 13px;border-radius:9px;background:#edf3f4;color:#506873;font-size:11px;font-weight:800}.paper-head{margin-bottom:9px}.paper-head>span:nth-child(1){flex:0 0 17%}.paper-head>span:nth-child(2){flex:0 0 15%}.paper-head>span:nth-child(3){flex:0 0 20%}.paper-head>span:nth-child(4){flex:0 0 20%}.paper-head>span:nth-child(5){flex:1 1 120px;text-align:center}.surface-group{display:flex;align-items:stretch;gap:12px;min-width:0;padding:0 0 11px;margin-bottom:10px;border-bottom:1px solid var(--line)}.surface-group:last-child{padding-bottom:0;margin-bottom:0;border-bottom:0}.surface-label{display:flex;flex:0 0 15%;align-items:center;justify-content:center;min-width:100px;min-height:130px;padding:12px;border-radius:12px;font-size:23px;font-weight:850;letter-spacing:-.04em}.surface-label.green{background:#dff3e7;color:#24563d}.surface-label.blue{background:#dceef8;color:#24536a}.surface-label.pink{background:#f9e5ed;color:#78445b}.surface-rows{display:flex;flex:1 1 0;flex-direction:column;gap:7px;min-width:0}.paper-row{display:flex!important;flex-flow:row nowrap!important;align-items:center!important;gap:12px!important;min-width:0!important;min-height:49px;margin:0!important;padding:7px 10px!important;border:1px solid transparent!important;border-radius:10px!important}.surface-group.glossy .paper-row{background:#f0f8f1!important;border-color:#e1eee3!important}.surface-group.lustre .paper-row{background:#eff6fb!important;border-color:#dfebf3!important}.surface-group.silk .paper-row{background:#fbf1f5!important;border-color:#f2e2e9!important}.paper-row .paper-width{flex:0 0 16%!important;min-width:85px!important;padding:0 5px!important;color:#1b3039!important;font-size:17px!important;font-weight:850!important;white-space:nowrap!important}.paper-row>.code-copy,.paper-row>.code-no-code{flex:0 0 20%!important;min-width:0!important;white-space:nowrap!important;color:#48616a}.paper-row>.stock-badge{flex:0 0 auto!important;margin-right:auto!important}.paper-row>.row-actions{display:flex!important;flex:0 0 auto!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;min-width:max-content!important;margin-left:auto!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}.row-action{display:inline-flex!important;flex:0 0 34px!important;align-items:center!important;justify-content:center!important;width:34px!important;height:34px!important;min-width:34px!important;padding:6px!important;border:1px solid #d5e1e4!important;border-radius:9px!important;background:#fff!important;color:#315d60!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important}.row-action:hover{border-color:#80b8b6!important;background:#e9f5f3!important}.row-action.danger{color:var(--danger)}
.stock-badge{display:inline-flex!important;flex-direction:column!important;align-items:flex-start!important;gap:2px!important;width:max-content!important;max-width:100%!important;padding:6px 10px!important;border:1px solid #d9e4e4!important;border-left:3px solid #4e9990!important;border-radius:9px!important;background:#f3f8f7!important;color:var(--ink)!important;white-space:nowrap!important;box-shadow:none!important}.stock-badge strong{color:#1d3b3a!important;font-size:15px!important;font-weight:850!important;line-height:1.15!important}.stock-badge span{color:#687b7b!important;font-size:10px!important;font-weight:650!important;line-height:1.15!important}.stock-badge.low{border-color:#f0d4d4!important;border-left-color:#c45c61!important;background:#fff5f4!important}.stock-badge.low strong{color:#b13e45!important}.stock-unused{display:inline-block!important;padding:0!important;border:0!important;background:transparent!important;color:#75858a!important;font-size:12px!important;font-weight:700!important;white-space:nowrap!important}
.chemical-panel .chem-list{display:flex;flex-direction:column;gap:0;padding:5px 18px 8px}.chem-row{display:flex!important;flex-flow:row nowrap!important;align-items:center!important;gap:14px!important;min-width:0!important;padding:13px 8px!important;border-bottom:1px solid var(--line)!important}.chem-row:last-child{border-bottom:0!important}.chem-dot{flex:0 0 7px!important;width:7px!important;height:36px!important;border-radius:6px}.chem-dot.blue,.legend-dot.blue{background:#69b8dc}.chem-dot.red,.legend-dot.red{background:#df777d}.chem-dot.yellow,.legend-dot.yellow{background:#e8c85e}.chem-name{flex:1 1 240px!important;min-width:120px!important;color:var(--ink)}.chem-name b{font-size:14px}.chem-row>.code-copy,.chem-row>.code-no-code{flex:0 0 100px!important;white-space:nowrap!important;color:#526c74}.tank-bar{flex:0 1 130px!important;min-width:50px!important;max-width:130px!important}.chem-row>.stock-badge{flex:0 0 auto!important;margin-left:auto!important}.chem-row>.row-action{flex:0 0 34px!important;width:34px!important;height:34px!important;min-width:34px!important}.chem-legend{display:flex;flex-wrap:wrap;gap:10px 18px;padding:11px 20px;border-top:1px solid var(--line);background:#f8fafb;color:var(--muted);font-size:11px}.chem-legend span{display:flex;align-items:center;gap:6px}.legend-dot{display:inline-block;width:8px;height:8px;border-radius:50%}
.generic-table{padding:12px 14px}.generic-table>.table-head{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(100px,.8fr) minmax(110px,.8fr) minmax(100px,.8fr)}.generic-row{display:grid!important;grid-template-columns:minmax(0,1.5fr) minmax(100px,.8fr) minmax(110px,.8fr) minmax(100px,.8fr)!important;gap:10px!important;align-items:center!important;padding:10px 12px!important;border-bottom:1px solid var(--line)!important;min-width:0!important}.generic-row:last-child{border-bottom:0!important}.generic-row>:first-child{min-width:0!important;color:var(--ink)}.generic-row>:first-child>b{overflow-wrap:anywhere}.row-actions{display:flex;justify-content:flex-end;gap:6px;min-width:0}.code-copy,.code-no-code{display:inline-flex;align-items:center;gap:6px;min-width:0;color:#526b73;font-size:12px;white-space:nowrap}.code-copy button,.code-copy svg{flex:0 0 auto}.product-description{display:block!important;margin-top:3px!important;color:#61777d!important;font-size:11px!important;font-weight:550!important;line-height:1.3!important}.subcategory-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;padding:16px}.subcategory-block{min-width:0;border:1px solid var(--line);border-radius:13px;overflow:hidden}.subcategory-heading{display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f4f8f9;border-bottom:1px solid var(--line)}.subcategory-heading h3{flex:1;margin:0;font-size:14px}.subcategory-heading>span{color:var(--muted);font-size:11px}.subcategory-heading .small-green-button{min-height:32px;padding:6px 9px;font-size:11px}
.ink-product-name{display:flex!important;align-items:center!important;gap:8px!important;min-width:0!important;white-space:nowrap!important}.ink-product-name>b{overflow:hidden;text-overflow:ellipsis}.ink-product-name .ink-color-swatch{flex:0 0 28px!important;width:28px!important;min-width:28px!important;height:21px!important;border-radius:5px!important}.wide-paper-stock{min-width:0}.empty-state,.empty-row{padding:20px;color:var(--muted);text-align:center}.setup-banner,.loading-line{display:flex;align-items:center;gap:12px;max-width:1540px;margin:0 auto 16px;padding:13px 16px;border:1px solid #ead9a8;border-radius:12px;background:#fff9e9;color:#775d24}.setup-banner span{display:block;font-size:12px}.toast{position:fixed;right:22px;bottom:22px;z-index:100;padding:12px 16px;border-radius:10px;background:#173c42;color:white;box-shadow:var(--shadow)}.toast button{margin-left:12px;border:0;background:transparent;color:white}
.bottom-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}.history-table{padding:10px 16px}.history-table .table-head,.history-row{display:grid;grid-template-columns:100px minmax(150px,1.2fr) 90px minmax(130px,1fr);gap:12px;align-items:center}.history-row{padding:10px 8px;border-bottom:1px solid var(--line);font-size:12px}.history-row:last-child{border-bottom:0}.positive-text{color:#25806c}.negative-text{color:#b94b52}.text-button{display:inline-flex;align-items:center;gap:5px;border:0;background:transparent;color:var(--accent);font-weight:750}.footer{display:flex;justify-content:space-between;gap:12px;max-width:1540px;margin:24px auto 0;padding:14px 2px;border-top:1px solid var(--line);color:#829197;font-size:10px}
/* Dialogai ir formos */
.modal-backdrop{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:18px;background:rgba(13,34,43,.56);backdrop-filter:blur(5px)}.modal{width:min(520px,100%);max-height:min(90vh,900px);overflow:auto;border:1px solid #dce6e8;border-radius:18px;background:#fff;box-shadow:0 24px 80px #071c2a55}.modal.modal-wide{width:min(900px,100%)}.modal-header{display:flex;align-items:center;justify-content:space-between;padding:17px 20px;border-bottom:1px solid var(--line)}.modal-header h2{margin:0;font-size:18px}.modal-body{padding:20px}.modal-help,.form-note{color:var(--muted);font-size:12px}.form-stack{display:flex;flex-direction:column;gap:13px}.form-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.modal label,.report-filter-grid label{display:flex;flex-direction:column;gap:6px;color:#425a63;font-size:12px;font-weight:700}.modal input,.modal select,.modal textarea,.report-filter-grid input,.report-filter-grid select{width:100%;min-width:0;padding:10px 11px;border:1px solid #d5e1e5;border-radius:9px;background:#fbfcfd;color:var(--ink)}.secondary-button{padding:9px 13px;border:1px solid #cbdadd;border-radius:9px;background:#fff;color:#38545c;font-weight:700}.full-width{width:100%}.icon-button{display:grid;place-items:center;width:36px;height:36px;border:1px solid #d5e1e5;border-radius:9px;background:#fff;color:#45616a}.small-green-button{min-height:34px;padding:7px 11px;font-size:12px}.qr-reader{width:100%;min-height:220px}.report-content{padding:18px}.report-intro{margin-top:0;color:var(--muted)}.report-filter-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.custom-date-grid{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:12px}.report-summary-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0}.report-summary-cards>div{padding:14px;border:1px solid var(--line);border-radius:11px;background:#f7fafb}.report-summary-cards small,.report-summary-cards b{display:block}.report-summary-cards small{color:var(--muted)}.report-summary-cards b{margin-top:5px;font-size:21px}.report-table-wrap{overflow:auto}.report-table{width:100%;border-collapse:collapse;font-size:12px}.report-table th,.report-table td{padding:10px;border-bottom:1px solid var(--line);text-align:left;white-space:nowrap}.report-table th{background:#f1f6f7;color:#506873}.report-validation{color:var(--danger)}
@media(min-width:1500px){.inventory-grid{flex-flow:row wrap;align-items:flex-start}.inventory-grid>.paper-panel{flex:1 1 56%;min-width:620px}.inventory-grid>.chemical-panel{flex:1 1 40%;min-width:470px}.paper-panel,.chemical-panel{align-self:stretch}}
@media(min-width:761px) and (max-width:1499px){.inventory-grid{flex-direction:column}.inventory-grid>.panel{width:100%}.paper-head>span:nth-child(1){flex-basis:17%}.paper-head>span:nth-child(2){flex-basis:15%}.paper-head>span:nth-child(3){flex-basis:20%}.paper-head>span:nth-child(4){flex-basis:20%}}
@media(max-width:1050px) and (min-width:761px){.sidebar{flex-basis:210px;width:210px;padding-inline:12px}.main-content{padding:20px 18px}.topbar{align-items:flex-start;flex-direction:column}.top-meta{justify-content:flex-start}.subcategory-grid{grid-template-columns:1fr}.chem-row{gap:9px!important}.chem-name{flex-basis:180px!important}.tank-bar{flex-basis:90px!important}}
@media(max-width:760px){.app-shell{display:block;padding-bottom:66px}.sidebar{position:fixed;left:0;top:0;bottom:0;width:min(290px,86vw);height:100dvh;transform:translateX(-105%);transition:transform .22s ease;box-shadow:12px 0 30px #102d3a30}.sidebar.sidebar-open{transform:translateX(0)}.mobile-close{display:grid}.mobile-menu-button{display:grid;flex:0 0 38px}.main-content{width:100%;padding:15px 12px 20px}.topbar{align-items:flex-start;gap:12px;margin-bottom:15px}.title-wrap{gap:9px}.title-icon{width:38px;height:38px;flex-basis:38px}.title-icon svg{width:23px}.title-wrap h1{font-size:21px}.title-wrap p{font-size:11px}.top-meta{width:100%;justify-content:flex-start;gap:7px}.refresh-top-button{min-height:35px;padding:7px 10px;font-size:11px}.updated{gap:6px;padding:4px}.updated small{font-size:9px}.updated b{font-size:10px}.date-meta{margin-left:auto;padding:5px 7px;gap:6px}.clock-calendar-icon{width:29px;height:29px}.clock-date-copy b{font-size:10px}.clock-date-copy small{font-size:9px}.clock-time{font-size:16px}.panel{border-radius:13px;margin-bottom:13px}.panel-heading{padding:12px 13px}.panel-title h2{font-size:16px}.panel-title p{font-size:10px}.heading-icon{width:34px;height:34px;flex-basis:34px}.order-list{padding:5px 10px 9px}.order-item{gap:9px!important;padding:10px 4px!important}.order-item>div:nth-child(2)>b{font-size:13px}.order-item .stock-badge{padding:5px 7px!important}.inventory-grid{display:flex;flex-direction:column;gap:12px}.paper-table{padding:9px}.paper-head{display:none!important}.surface-group{gap:8px;padding-bottom:8px;margin-bottom:8px}.surface-label{flex:0 0 74px;min-width:74px;min-height:0;padding:6px 3px;border-radius:9px;font-size:13px;writing-mode:vertical-rl;transform:none}.surface-rows{gap:6px}.surface-rows .paper-row{display:grid!important;grid-template-columns:minmax(0,1fr) auto 34px!important;grid-template-rows:auto auto!important;grid-template-areas:"width stock actions" "code code code"!important;gap:5px 6px!important;padding:8px!important;border-radius:9px!important;min-height:0!important}.paper-row .paper-width{grid-area:width!important;min-width:0!important;padding:0!important;font-size:14px!important}.paper-row>.code-copy,.paper-row>.code-no-code{grid-area:code!important;flex:initial!important;font-size:11px!important}.paper-row>.stock-badge{grid-area:stock!important;justify-self:end!important;margin:0!important;padding:5px 7px!important}.paper-row .stock-badge strong{font-size:13px!important}.paper-row .stock-badge span{font-size:9px!important}.paper-row>.row-actions{grid-area:actions!important;min-width:32px!important;width:32px!important;margin:0!important;justify-content:flex-end!important}.paper-row .row-actions .row-action{display:none!important}.paper-row .row-actions .row-action:last-child{display:inline-flex!important;flex:0 0 30px!important;width:30px!important;height:30px!important;min-width:30px!important;max-width:30px!important}.chemical-panel .chem-list{padding:5px 9px}.chem-row{display:grid!important;grid-template-columns:8px minmax(0,1fr) auto 32px!important;grid-template-rows:auto auto auto!important;gap:5px 7px!important;padding:9px 5px!important;border:0!important;border-bottom:1px solid var(--line)!important}.chem-row>.chem-dot{grid-column:1!important;grid-row:1/4!important;width:7px!important;height:auto!important}.chem-row>.chem-name{grid-column:2/5!important;grid-row:1!important;min-width:0!important}.chem-row>.chem-name>b{font-size:13px}.chem-row>.code-copy,.chem-row>.code-no-code{grid-column:2!important;grid-row:2!important;flex:initial!important;font-size:11px}.chem-row>.tank-bar{grid-column:2/5!important;grid-row:3!important;justify-self:start!important;max-width:100%!important;transform:scale(.82);transform-origin:left center}.chem-row>.stock-badge{grid-column:3!important;grid-row:2!important;justify-self:end!important;margin:0!important;padding:5px 7px!important}.chem-row>.row-action{grid-column:4!important;grid-row:2!important;justify-self:end!important;width:30px!important;height:30px!important;min-width:30px!important;padding:4px!important}.chem-legend{padding:9px 12px;font-size:10px}.generic-table{padding:8px}.generic-table>.table-head{display:none}.generic-row{grid-template-columns:minmax(0,1fr) auto 32px!important;grid-template-rows:auto auto!important;gap:5px 7px!important;padding:9px 7px!important}.generic-row>:first-child{grid-column:1/4;grid-row:1}.generic-row>.code-copy,.generic-row>.code-no-code{grid-column:1;grid-row:2;font-size:11px}.generic-row>.stock-badge,.generic-row>.wide-paper-stock{grid-column:2;grid-row:2;justify-self:end}.generic-row>.row-actions{grid-column:3;grid-row:2}.generic-row .row-action{width:30px!important;height:30px!important;min-width:30px!important}.subcategory-grid{grid-template-columns:1fr;gap:10px;padding:9px}.subcategory-heading{padding:10px}.history-table{padding:8px}.history-table .table-head{display:none}.history-row{grid-template-columns:75px minmax(0,1fr) 60px;gap:6px;padding:9px 4px}.history-row span:last-child{grid-column:2/4;color:var(--muted)}.bottom-grid{display:block}.footer{flex-direction:column;gap:5px;margin-top:14px}.mobile-bottom-nav{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;justify-content:space-around;gap:2px;padding:7px 4px calc(7px + env(safe-area-inset-bottom));border-top:1px solid #d7e2e5;background:#fff;box-shadow:0 -5px 18px #19394712}.mobile-bottom-nav button{display:flex;flex:1;flex-direction:column;align-items:center;gap:3px;padding:5px 2px;border:0;border-radius:8px;background:transparent;color:#71858b;font-size:9px;font-weight:700}.mobile-bottom-nav button.active{background:#e3f1ef;color:var(--accent)}.scrim{position:fixed;inset:0;z-index:25;border:0;background:#0b253b66}.modal-backdrop{padding:8px}.modal-body{padding:14px}.form-two,.report-filter-grid,.custom-date-grid{grid-template-columns:1fr}.report-summary-cards{gap:6px}.report-summary-cards>div{padding:9px}.report-summary-cards b{font-size:17px}}
/* NEW VISUAL SYSTEM: CSS-only redesign. Application markup and behavior stay intact. */
:root{
 --bg:#f4f1eb;--surface:#fffdf9;--surface-2:#f8f6f1;--ink:#202c35;--muted:#788087;--line:#e7e1d7;
 --accent:#bd5b3d;--accent-2:#f7e8df;--accent-dark:#93432e;--danger:#b64a4a;--danger-bg:#fae9e5;
 --shadow:0 10px 30px rgba(54,43,32,.055);--radius:20px;
}
html,body,#root{min-height:100%;background:var(--bg)}
.app-shell{display:flex;flex-direction:column;min-height:100vh;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
/* Navigation becomes a full-width top command bar instead of a left sidebar. */
.sidebar{position:relative;top:auto;z-index:30;display:flex;flex:0 0 auto;flex-flow:row wrap;align-items:center;gap:8px;width:100%;height:auto;min-height:0;padding:13px clamp(16px,3vw,48px);border:0;border-bottom:1px solid #ded6ca;background:#252f38;color:#f8f4ed;box-shadow:0 5px 20px #29231c12}
.brand{flex:0 0 190px;gap:11px;padding:5px 14px 5px 2px;color:#fff}.brand b{font-size:20px;letter-spacing:.08em}.brand small{color:#c1c5c4;font-size:9px}.brand-mark span{background:#e58a66}.brand-mark span+span{background:#f0c4a7}
.main-nav{display:flex;flex:1 1 500px;flex-flow:row wrap;align-items:center;gap:5px;min-width:0}.nav-item{display:inline-flex;flex:0 0 auto;align-items:center;justify-content:center;gap:8px;width:auto;min-height:38px;padding:8px 11px;border:1px solid transparent;border-radius:999px;background:transparent;color:#d7d9d7;font-size:12px;font-weight:700;white-space:nowrap}.nav-item svg{flex:0 0 17px;width:17px;height:17px;color:#d49a7e}.nav-item span{flex:0 1 auto}.nav-item small{color:#aeb8b8;font-size:10px}.nav-item:hover{background:#35424a;color:#fff}.nav-item.selected{border-color:#d27a59;background:#f1e0d6;color:#472e27;box-shadow:none}.nav-item.selected svg,.nav-item.selected small{color:#8e4a35}
.sidebar>.nav-divider,.sidebar>.nav-caption{display:none}.sidebar>button.nav-item{margin:0 1px}.sidebar-bottom{display:flex;flex:0 0 auto;align-items:center;gap:8px;margin:0 0 0 auto}.admin-badge{padding:8px 11px;border:1px solid #53616a;border-radius:999px;background:#303d46;color:#fff}.admin-badge small{max-width:180px;color:#c4ccca}.login-button{width:auto;padding:9px 14px;border-color:#6d777b;border-radius:999px;background:#35424a}
.mobile-close,.mobile-menu-button,.mobile-bottom-nav{display:none}
.main-content{flex:1 1 auto;width:100%;max-width:1640px;margin:0 auto;padding:30px clamp(16px,3vw,46px) 42px;overflow:visible}
.topbar{align-items:center;gap:24px;max-width:none;margin:0 0 27px;padding:0 0 22px;border-bottom:1px solid #ded6ca}.title-wrap{gap:16px}.title-icon{width:54px;height:54px;flex-basis:54px;border-radius:17px;background:#293740;color:#f3b18e}.title-wrap h1{font-size:clamp(27px,2.6vw,36px);font-weight:850;letter-spacing:-.055em}.title-wrap p{margin-top:5px;font-size:13px}.top-meta{gap:10px}.refresh-top-button,.small-green-button,.primary-button{min-height:40px;border:0;border-radius:999px;background:var(--accent);box-shadow:none}.refresh-top-button:hover,.small-green-button:hover,.primary-button:hover{background:var(--accent-dark)}.updated{padding:7px 12px;border-left:1px solid #ded6ca;color:var(--accent)}.updated b{font-size:12px}.date-meta{padding:8px 13px;border:1px solid #e3cfc2;border-radius:14px;background:#fff8f2;color:#85452f}.clock-calendar-icon{background:#f5e3d8}.clock-divider{background:#e7d3c7}.clock-time{font-size:23px}
.panel{margin-bottom:20px;border:1px solid #e6dfd5;border-radius:19px;background:var(--surface);box-shadow:0 7px 22px rgba(60,48,37,.045)}.order-panel-top,.inventory-grid,.photo-other-panel,.bottom-grid{max-width:none}.panel-heading{padding:18px 22px;border-bottom:1px solid #eee7dd;background:transparent}.panel-title h2{font-size:19px;letter-spacing:-.035em}.panel-title p{font-size:11px}.heading-icon{border-radius:13px;background:#f1e7dd;color:#9d563b}.green-icon{background:#f2e5dc;color:#a95638}.red-icon{background:#fae9e5;color:var(--danger)}.pill-count{border-radius:50%;background:#f4e7dd}.count-red{background:#f8e2dc;color:var(--danger)}.count-green{background:#e9eee8;color:#55705b}
.order-list{padding:8px 22px 13px}.order-item{gap:16px!important;padding:13px 8px!important}.order-indicator{width:4px;height:42px;border-radius:4px;background:#d47a5b}.order-item>div:nth-child(2)>b{font-size:14px}.order-item small{margin-top:2px}.all-stock-ok{color:#5f7969}
.inventory-grid{display:flex;flex-flow:row wrap;align-items:stretch;gap:20px}.inventory-grid>.panel{min-width:0}.inventory-grid>.paper-panel{flex:1 1 58%;min-width:min(100%,560px)}.inventory-grid>.chemical-panel{flex:1 1 36%;min-width:min(100%,390px)}.paper-panel,.chemical-panel{align-self:stretch}.paper-table{padding:15px 18px 18px}.table-head{gap:14px;padding:11px 14px;border-radius:11px;background:#f0eee8;color:#716c62;font-size:11px;letter-spacing:.025em}.paper-head>span:nth-child(1){flex-basis:17%}.paper-head>span:nth-child(2){flex-basis:15%}.paper-head>span:nth-child(3){flex-basis:20%}.paper-head>span:nth-child(4){flex-basis:20%}.surface-group{gap:12px;padding-bottom:12px;margin-bottom:12px;border-color:#eee7dd}.surface-label{border-radius:14px;font-size:22px}.surface-label.green{background:#e5eee4;color:#3c624a}.surface-label.blue{background:#e4edf1;color:#385f70}.surface-label.pink{background:#f3e6e9;color:#805361}.surface-rows{gap:7px}.paper-row{gap:12px!important;min-height:48px!important;padding:7px 11px!important;border-radius:10px!important}.surface-group.glossy .paper-row{background:#f4f8f1!important;border-color:#e9f0e5!important}.surface-group.lustre .paper-row{background:#f1f6f7!important;border-color:#e5edef!important}.surface-group.silk .paper-row{background:#faf2f3!important;border-color:#f2e7e8!important}.paper-row .paper-width{font-size:17px!important;font-weight:850!important;color:#26353a!important}.paper-row>.code-copy,.paper-row>.code-no-code{color:#66736f}.stock-badge{border-radius:10px!important;border-color:#dfe7df!important;background:#f5f7f3!important;color:#263d32!important}.stock-badge strong{font-weight:850}.paper-row>.row-actions{gap:6px!important}.row-action{width:35px!important;height:35px!important;min-width:35px!important;border:1px solid #e0ded5!important;border-radius:10px!important;background:#fffdf9!important;color:#6c5548!important}.row-action:hover{border-color:#c98263!important;background:#f8eee8!important;color:#8e4b35!important}
.chemical-panel .chem-list{padding:7px 15px 13px}.chem-row{gap:10px!important;padding:12px 5px!important;border-bottom:1px solid #eee7dd!important}.chem-dot{border-radius:99px}.chem-name>b{font-size:13px;color:#29363b}.chem-row .code-copy,.chem-row .code-no-code{font-size:11px;color:#6d7774}.tank-bar{border-color:#d9e0d9!important;background:#f8faf7!important}.chem-legend{padding:10px 17px;border-top:1px solid #eee7dd;color:#747d78}
.generic-table,.history-table{padding:13px 16px}.generic-row,.history-row{border-color:#eee7dd!important}.generic-row:hover,.history-row:hover{background:#faf7f2!important}.subcategory-grid{gap:14px;padding:14px}.subcategory-card{border-color:#e9e1d7!important;border-radius:15px!important;background:#fffdf9!important}.subcategory-heading{background:#f5f0e9!important}.footer{color:#85847d}
.toast{border:1px solid #e4d5c8;border-radius:12px;background:#fffaf5;color:#584438;box-shadow:var(--shadow)}.setup-banner{border:1px solid #ead7c8;border-radius:13px;background:#fff7ef;color:#754c35}.loading-line{color:#8b5b43}.empty-state,.empty-row{color:#88877f}
.modal-backdrop{background:#202a30a8}.modal{border:1px solid #e5ddd2;border-radius:20px;background:#fffdf9;box-shadow:0 25px 90px #171f2470}.modal-header{border-color:#eee7dd}.modal input,.modal select,.modal textarea,.report-filter-grid input,.report-filter-grid select{border-color:#e1d9cf;border-radius:10px;background:#fffefa}.secondary-button,.icon-button{border-color:#e1d9cf;border-radius:10px;background:#fffefa;color:#66594f}.report-summary-cards>div{border-color:#e9e1d7;border-radius:13px;background:#f8f5ef}.report-table th{background:#f2eee7;color:#6c675e}.report-table td,.report-table th{border-color:#eae3d9}
/* Medium screens: keep the navigation horizontal and let content cards wrap naturally. */
@media(min-width:761px) and (max-width:1250px){.sidebar{padding-inline:15px}.brand{flex-basis:165px}.main-nav{flex-basis:calc(100% - 180px)}.sidebar-bottom{margin-left:auto}.main-content{padding:23px 18px 34px}.topbar{align-items:flex-start;flex-direction:column}.top-meta{justify-content:flex-start}.inventory-grid>.paper-panel,.inventory-grid>.chemical-panel{flex:1 1 100%;min-width:0}}
@media(max-width:760px){
 .app-shell{display:flex;flex-direction:column;padding-bottom:68px}.sidebar{position:relative;left:auto;top:auto;bottom:auto;display:flex;flex-flow:row wrap;align-items:center;width:100%;height:auto;min-height:0;padding:10px 12px;transform:none;box-shadow:none}.brand{flex:1 1 100%;padding:2px 4px 9px}.brand b{font-size:18px}.brand-mark span{width:27px;height:8px}.mobile-close{display:none}.main-nav{display:flex;flex:1 1 100%;flex-flow:row nowrap;gap:5px;overflow-x:auto;padding:3px 0 7px;scrollbar-width:none}.main-nav::-webkit-scrollbar{display:none}.nav-item{flex:0 0 auto;min-height:35px;padding:7px 10px;font-size:11px}.nav-item svg{width:16px;height:16px}.nav-item small{display:none}.sidebar>button.nav-item{display:inline-flex;min-height:33px;padding:6px 9px;font-size:10px}.sidebar-bottom{display:flex;flex:1 1 100%;justify-content:flex-end;margin:0}.admin-badge{padding:6px 9px}.sidebar-bottom .nav-item{display:inline-flex}.main-content{width:100%;padding:15px 12px 22px}.topbar{align-items:flex-start;gap:12px;margin-bottom:15px;padding-bottom:14px}.title-wrap{gap:9px}.title-icon{width:39px;height:39px;flex-basis:39px;border-radius:12px}.title-icon svg{width:22px}.title-wrap h1{font-size:21px}.title-wrap p{font-size:11px}.top-meta{width:100%;justify-content:flex-start;gap:7px}.refresh-top-button{min-height:35px;padding:7px 10px;font-size:11px}.updated{gap:6px;padding:4px 7px}.updated small{font-size:9px}.updated b{font-size:10px}.date-meta{margin-left:auto;padding:5px 7px;gap:6px}.clock-calendar-icon{width:29px;height:29px}.clock-date-copy b{font-size:10px}.clock-date-copy small{font-size:9px}.clock-time{font-size:16px}.panel{border-radius:13px;margin-bottom:13px}.panel-heading{padding:12px 13px}.panel-title h2{font-size:16px}.panel-title p{font-size:10px}.heading-icon{width:34px;height:34px;flex-basis:34px}.order-list{padding:5px 10px 9px}.order-item{gap:9px!important;padding:10px 4px!important}.order-item>div:nth-child(2)>b{font-size:13px}.order-item .stock-badge{padding:5px 7px!important}.inventory-grid{display:flex;flex-direction:column;gap:12px}.inventory-grid>.paper-panel,.inventory-grid>.chemical-panel{width:100%;min-width:0}.paper-table{padding:9px}.paper-head{display:none!important}.surface-group{gap:8px;padding-bottom:8px;margin-bottom:8px}.surface-label{flex:0 0 74px;min-width:74px;min-height:0;padding:6px 3px;border-radius:9px;font-size:13px;writing-mode:vertical-rl;transform:none}.surface-rows{gap:6px}.surface-rows .paper-row{display:grid!important;grid-template-columns:minmax(0,1fr) auto 34px!important;grid-template-rows:auto auto!important;grid-template-areas:"width stock actions" "code code code"!important;gap:5px 6px!important;padding:8px!important;border-radius:9px!important;min-height:0!important}.paper-row .paper-width{grid-area:width!important;min-width:0!important;padding:0!important;font-size:14px!important}.paper-row>.code-copy,.paper-row>.code-no-code{grid-area:code!important;flex:initial!important;font-size:11px!important}.paper-row>.stock-badge{grid-area:stock!important;justify-self:end!important;margin:0!important;padding:5px 7px!important}.paper-row .stock-badge strong{font-size:13px!important}.paper-row .stock-badge span{font-size:9px!important}.paper-row>.row-actions{grid-area:actions!important;min-width:32px!important;width:32px!important;margin:0!important;justify-content:flex-end!important}.paper-row .row-actions .row-action{display:none!important}.paper-row .row-actions .row-action:last-child{display:inline-flex!important;flex:0 0 30px!important;width:30px!important;height:30px!important;min-width:30px!important;max-width:30px!important}.chemical-panel .chem-list{padding:5px 9px}.chem-row{display:grid!important;grid-template-columns:8px minmax(0,1fr) auto 32px!important;grid-template-rows:auto auto auto!important;gap:5px 7px!important;padding:9px 5px!important;border:0!important;border-bottom:1px solid var(--line)!important}.chem-row>.chem-dot{grid-column:1!important;grid-row:1/4!important;width:7px!important;height:auto!important}.chem-row>.chem-name{grid-column:2/5!important;grid-row:1!important;min-width:0!important}.chem-row>.chem-name>b{font-size:13px}.chem-row>.code-copy,.chem-row>.code-no-code{grid-column:2!important;grid-row:2!important;flex:initial!important;font-size:11px}.chem-row>.tank-bar{grid-column:2/5!important;grid-row:3!important;justify-self:start!important;max-width:100%!important;transform:scale(.82);transform-origin:left center}.chem-row>.stock-badge{grid-column:3!important;grid-row:2!important;justify-self:end!important;margin:0!important;padding:5px 7px!important}.chem-row>.row-action{grid-column:4!important;grid-row:2!important;justify-self:end!important;width:30px!important;height:30px!important;min-width:30px!important;padding:4px!important}.chem-legend{padding:9px 12px;font-size:10px}.generic-table{padding:8px}.generic-table>.table-head{display:none}.generic-row{grid-template-columns:minmax(0,1fr) auto 32px!important;grid-template-rows:auto auto!important;gap:5px 7px!important;padding:9px 7px!important}.generic-row>:first-child{grid-column:1/4;grid-row:1}.generic-row>.code-copy,.generic-row>.code-no-code{grid-column:1;grid-row:2;font-size:11px}.generic-row>.stock-badge,.generic-row>.wide-paper-stock{grid-column:2;grid-row:2;justify-self:end}.generic-row>.row-actions{grid-column:3;grid-row:2}.generic-row .row-action{width:30px!important;height:30px!important;min-width:30px!important}.subcategory-grid{grid-template-columns:1fr;gap:10px;padding:9px}.subcategory-heading{padding:10px}.history-table{padding:8px}.history-table .table-head{display:none}.history-row{grid-template-columns:75px minmax(0,1fr) 60px;gap:6px;padding:9px 4px}.history-row span:last-child{grid-column:2/4;color:var(--muted)}.bottom-grid{display:block}.footer{flex-direction:column;gap:5px;margin-top:14px}.mobile-bottom-nav{display:none}.scrim{display:none}.modal-backdrop{padding:8px}.modal-body{padding:14px}.form-two,.report-filter-grid,.custom-date-grid{grid-template-columns:1fr}.report-summary-cards{gap:6px}.report-summary-cards>div{padding:9px}.report-summary-cards b{font-size:17px}
}

`}

</style>
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
                return <div className={`surface-group ${surface.toLowerCase()}`} key={surface}>
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
              {chemicals.map(p=><div className="chem-row" key={p.id} style={{display:"grid",gridTemplateColumns:"12px minmax(160px,1.4fr) minmax(85px,.7fr) minmax(95px,1fr) minmax(120px,auto) 34px",alignItems:"center",gap:10,padding:"12px 9px",minWidth:0}}><div className={`chem-dot ${chemicalTone(p.name)}`}></div><div className="chem-name" style={{minWidth:0}}><b>{p.name}</b>{productDescription(p)}</div><CopyCode code={p.code} flash={flash}/><TankBar quantity={p.quantity} tone={chemicalTone(p.name)} small={p.tank_size==="small"}/><StockBadge p={p}/>{canManageStock&&<button className="row-action" onClick={()=>setModal({type:"adjust",product:p,mode:"set"})} aria-label="Koreguoti"><Pencil size={15}/></button>}</div>)}
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

function StockBadge({p}) { if (Number(p.quantity) === 0 && Number(p.min_quantity) === 0) return <span className="stock-unused">Nenaudojama</span>; const percent=isInkProduct(p); const unit=percent?"%":(p.unit||"vnt."); return <span className={`stock-badge ${stockTone(p)}`}><strong>{fmt(p.quantity)} {unit}</strong><span>Min. {fmt(p.min_quantity)} {unit}</span></span>; }
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
  return <div className="paper-row"><span className="paper-width">{String(p.width_cm).replace(".",",")} cm{p.description&&<small style={{display:"block",fontSize:12,fontWeight:500,color:"#65776c",opacity:1}}>{p.description}</small>}</span><CopyCode code={p.code} flash={flash}/><StockBadge p={p}/><div className="row-actions">{canManageStock&&<><button className="row-action" title="Atimti 1" onClick={()=>onAdjust({type:"adjust",product:p,mode:"remove"})}><Minus size={14}/></button><button className="row-action" title="Pridėti 1" onClick={()=>onAdjust({type:"adjust",product:p,mode:"add"})}><Plus size={14}/></button><button className="row-action" title="Koreguoti likutį" onClick={()=>onAdjust({type:"adjust",product:p,mode:"set"})}><Pencil size={14}/></button></>}</div></div>;
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
  const [cat,setCat]=useState(category||"photo");const [subcategory,setSubcategory]=useState(forcedSubcategory || (forcedKind==="paper"?"paper":forcedKind==="chemical"?"chemical":"other"));const [kind,setKind]=useState(forcedKind||(forcedSubcategory==="chemical"?"chemical":forcedSubcategory==="ink"?"ink":forcedSubcategory==="paper"?"paper":"item"));const [name,setName]=useState("");const [description,setDescription]=useState("");const [tankSize,setTankSize]=useState("large");const [surface,setSurface]=useState("Glossy");const [width,setWidth]=useState("12.7");const [code,setCode]=useState("");const [qty,setQty]=useState("0");const [min,setMin]=useState("1");const [unit,setUnit]=useState(forcedSubcategory==="ink"||forcedKind==="ink"?"%":"bak.");const [color,setColor]=useState("");
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit({category:cat,subcategory,kind:subcategory==="ink"?"ink":kind,name:kind==="paper"?surface:name,surface,width_cm:width,code,quantity:qty,min_quantity:min,unit:subcategory==="ink"?"%":unit,color,description,tank_size:tankSize})}}>
    <label>Kategorija<select value={cat} onChange={e=>{const next=NAV.find(n=>n.id===e.target.value);setCat(e.target.value);const first=next?.sections[0]?.id||"other";setSubcategory(first);setKind(e.target.value==="photo"&&first==="paper"?"paper":e.target.value==="photo"&&first==="chemical"?"chemical":first==="ink"?"ink":"item");}}>{NAV.map(n=><option value={n.id} key={n.id}>{n.label}</option>)}</select></label>
    <label>Medžiagų kategorija<select value={subcategory} onChange={e=>{setSubcategory(e.target.value);if(cat==="photo"&&e.target.value==="paper")setKind("paper");else if(cat==="photo"&&e.target.value==="chemical")setKind("chemical");else setKind(e.target.value==="ink"?"ink":"item");if(e.target.value==="ink"){setUnit("%");setCat("wide");}}}>{(NAV.find(n=>n.id===cat)?.sections||[]).map(section=><option value={section.id} key={section.id}>{section.label}</option>)}</select></label>
    {kind==="paper"?<><label>Paviršius<select value={surface} onChange={e=>setSurface(e.target.value)}><option>Glossy</option><option>Lustre</option><option>Silk</option></select></label><label>Plotis<select value={width} onChange={e=>setWidth(e.target.value)}><option value="12.7">12,7 cm</option><option value="15.2">15,2 cm</option><option value="30.5">30,5 cm</option></select></label></>:<><label>Prekės pavadinimas<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Pvz., papildoma chemija"/></label><label>Matavimo vienetas<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="bak.">bak.</option><option value="vnt.">vnt.</option><option value="l">l</option><option value="kg">kg</option><option value="pak.">pak.</option><option value="rul.">rulonas</option><option value="%">%</option></select></label></>}
    <label>Aprašymas (nebūtina)<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Pvz., XXL spaudos popierius"/></label>
    {kind==="chemical"&&<label>Bako dydis<select value={tankSize} onChange={e=>setTankSize(e.target.value)}><option value="large">Didelis</option><option value="small">Mažas</option></select></label>}
    <label>Prekės kodas (nebūtina)<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Jei yra, įveskite prekės kodą"/></label>
    {kind!=="paper"&&kind!=="chemical"&&<label>Prekės spalva<select value={color} onChange={e=>setColor(e.target.value)}><option value="">Be spalvos</option>{PRODUCT_PALETTE.map(c=><option value={c.value} key={c.value}>{c.name}</option>)}</select></label>}
    <div className="form-two"><label>{(kind==="ink"||subcategory==="ink")?"Dabartinis lygis (%)":"Dabartinis likutis"}<input type="number" required min="0" step={(kind==="ink"||subcategory==="ink")?1:kind==="chemical"||unit==="rul."?"0.1":"0.5"} value={qty} onChange={e=>setQty(e.target.value)}/></label><label>{(kind==="ink"||subcategory==="ink")?"Minimalus lygis (%)":"Minimalus likutis"}<input type="number" required min="0" step={(kind==="ink"||subcategory==="ink")?1:kind==="chemical"||unit==="rul."?"0.1":"0.5"} value={min} onChange={e=>setMin(e.target.value)}/></label></div>
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
    <label>Prekė<select required value={id} onChange={e=>selectProduct(e.target.value)}><option value="">Pasirinkite prekę</option>{products.map(p=><option value={p.id} key={p.id}>{displayName(p)} · {p.code||"Be kodo"} ({fmt(p.quantity)}{isInkProduct(p)?"%":""})</option>)}</select></label>
    <label>{mode==="set"?(isInkProduct(product)?"Naujas tikslus lygis (%)":"Naujas tikslus likutis"):(isInkProduct(product)?"Pokytis (%)":"Kiekis")}<input type="number" required min="0" step={isInkProduct(product)?1:product?.kind==="chemical"||isRollProduct(product)?"0.1":"0.5"} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    {isAdmin&&mode==="set"&&product&&<>
      <div className="form-two"><label>Minimalus likutis<input type="number" required min="0" step={product.kind==="chemical"||isRollProduct(product)?"0.1":"0.5"} value={minQty} onChange={e=>setMinQty(e.target.value)}/></label><label>Prekės kodas (nebūtina)<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Be kodo"/></label></div>
      <label>Aprašymas (nebūtina)<input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Pvz., XXL spaudos popierius"/></label>
      {product.kind==="chemical"&&<label>Bako dydis<select value={tankSize} onChange={e=>setTankSize(e.target.value)}><option value="large">Didelis</option><option value="small">Mažas</option></select></label>}
      {product.kind!=="paper"&&product.kind!=="chemical"&&<label>Prekės spalva<select value={color} onChange={e=>setColor(e.target.value)}><option value="">Be spalvos</option>{PRODUCT_PALETTE.map(c=><option value={c.value} key={c.value}>{c.name}</option>)}</select></label>}
    </>}
    <label>Priežastis<select value={reason} onChange={e=>setReason(e.target.value)}><option>Papildymas</option><option>Paėmimas</option><option>QR nuskaitymas praleistas</option><option>Likučio perskaičiavimas</option><option>Brokuota / sugadinta</option><option>Kita</option></select></label>
    {product&&<div className="adjust-preview"><span>Dabartinis likutis</span><b>{fmt(product.quantity)}{isInkProduct(product)?"%":` ${product.unit}`}</b><span>Po pakeitimo</span><b>{fmt(after)}{isInkProduct(product)?"%":` ${product.unit}`}</b></div>}
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