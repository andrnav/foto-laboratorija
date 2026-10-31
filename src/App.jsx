import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeCanvas } from "qrcode.react";
import {
  Layers3, Printer, CupSoda, Frame, Box, QrCode, PlusCircle, MinusCircle,
  Pencil, ChartNoAxesColumnIncreasing, Settings, LogOut, UserRound, RefreshCw,
  ShoppingCart, Package, FlaskConical, Copy, Check, Menu, X, Search, History,
  ChevronDown, ChevronRight, Plus, Minus, ScanLine, ShieldCheck, AlertTriangle,
  Download, Trash2, LockKeyhole
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
const CHEMICAL_COLORS = { "CD Developer": "blue", "BF Bleach Fix": "red", "STB Super Stabilizer": "yellow" };
const PAPER_COLORS = { Glossy: "green", Lustre: "blue", Silk: "pink" };
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
  return new Intl.DateTimeFormat("lt-LT", { timeZone:"Europe/Vilnius", year:"numeric",month:"2-digit",day:"2-digit",weekday:"long",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false }).format(d);
}
function shortTime(s) { if (!s) return "—"; return new Date(s).toLocaleString("lt-LT", { hour:"2-digit", minute:"2-digit", second:"2-digit", day:"2-digit", month:"2-digit", year:"numeric" }); }
function stockTone(p) { return Number(p.quantity) < Number(p.min_quantity) ? "low" : "ok"; }
function displayName(p) { return p.kind === "paper" ? `${p.surface} ${String(p.width_cm).replace(".",",")} cm` : p.name; }
function chemicalSortKey(name="") {
  const n=name.toLowerCase();
  if (n.includes("cd") || n.includes("developer")) return 0;
  if (n.includes("bf") || n.includes("bleach fix")) return 1;
  if (n.includes("stb") || n.includes("stabilizer")) return 2;
  return 3;
}

export default function App() {
  const configured = Boolean(supabase);
  const [products, setProducts] = useState(STARTER);
  const [logs, setLogs] = useState([]);
  const [active, setActive] = useState("photo");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
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
    const [{ data: ps, error: pe }, { data: ls }] = await Promise.all([
      supabase.from("products").select("*").order("category").order("kind").order("name").order("width_cm"),
      supabase.from("stock_logs").select("*, products(category, subcategory, name, surface, width_cm, code)").order("created_at", { ascending:false }).limit(100)
    ]);
    if (pe) setNotice(`Duomenų nepavyko įkelti: ${pe.message}`);
    else { setProducts(ps || []); setLogs(ls || []); setLastUpdated(new Date()); }
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
      else { setIsAdmin(false); setAdminChecked(true); }
      if (alive) setAuthReady(true);
    };
    initSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user || null;
      setUser(sessionUser);
      setIsAdmin(false);
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
    if (!supabase) { setAdminChecked(true); return; }
    const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
    setIsAdmin(Boolean(data && !error));
    setAdminChecked(true);
  }

  const visibleProducts = useMemo(() => products.filter(p => p.category === active && (
    !search || [p.name,p.surface,p.code,String(p.width_cm ?? "")].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  )), [products, active, search]);
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) flash(`Prisijungti nepavyko: ${error.message}`);
    else { setModal(null); flash("Prisijungta."); }
  }
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null); setIsAdmin(false); flash("Atsijungta.");
  }

  async function refreshProducts() {
    if (!supabase) return flash("Rodomi demonstraciniai duomenys. Prijunkite duomenų bazę, kad duomenys būtų išsaugomi.");
    await loadData(); flash("Likučiai atnaujinti.");
  }

  async function adjustStock(product, delta, reason = "Rankinis likučio pakeitimas", absolute = false) {
    if (!isAdmin) return flash("Likučius keisti gali tik administratoriaus paskyra.");
    if (!supabase) return flash("Duomenų bazė nesukonfigūruota.");
    const newQty = absolute ? Number(delta) : Number(product.quantity) + Number(delta);
    if (!Number.isFinite(newQty) || newQty < 0) return flash("Likutis negali būti neigiamas.");
    setBusy(true);
    const { error } = await supabase.rpc("adjust_stock", {
      p_product_id: product.id, p_new_quantity: newQty, p_reason: reason
    });
    setBusy(false);
    if (error) flash(`Nepavyko pakeisti likučio: ${error.message}`);
    else { await loadData(); setModal(null); flash("Likutis išsaugotas."); }
  }

  async function addProduct(values) {
    if (!isAdmin) return flash("Naujas prekes gali pridėti tik administratorius.");
    if (!supabase) return flash("Duomenų bazė nesukonfigūruota.");
    const row = {
      category: values.category, subcategory: values.subcategory || "other", kind: values.kind, name: values.name.trim(),
      surface: values.kind === "paper" ? values.surface : null,
      width_cm: values.kind === "paper" ? Number(values.width_cm) : null,
      code: values.code.trim() || null, quantity: Number(values.quantity), min_quantity: Number(values.min_quantity),
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
    if (!user || !isAdmin) {
      flash("QR nuskaitymas atmestas. Šiame telefono naršyklės lange prisijunkite kaip administratorius. Likutis nepakeistas.");
      return;
    }
    flash("QR kodas atpažintas. Tikrinamos administratoriaus teisės…");
    scanCode(code);
  }, [authReady, adminChecked, user, isAdmin]);

  async function startScanner() {
    if (!isAdmin) return flash("QR nuskaitymui prisijunkite kaip administratorius.");
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

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
      <div className="brand"><div className="brand-mark"><span></span><span></span></div><div><b>FOTO</b><small>LABORATORIJA</small></div><button className="mobile-close icon-button" onClick={()=>setMobileMenu(false)}><X size={20}/></button></div>
      <nav className="main-nav">
        {NAV.map(item => { const Icon=item.icon; return <button key={item.id} className={`nav-item ${active===item.id?"selected":""}`} onClick={()=>{setActive(item.id);setSearch("");setMobileMenu(false);}}><Icon size={21}/><span>{item.label}</span><small>{categoryCounts[item.id]||0}</small></button>; })}
      </nav>
      <div className="nav-divider"></div>
      <div className="nav-caption">Sandėlio veiksmai</div>
      <button className="nav-item" onClick={()=>setModal({type:"qrLibrary"})}><QrCode size={21}/><span>QR nuskaitymas</span></button>
      <button className="nav-item" onClick={()=>setModal({type:"adjust",mode:"add"})}><PlusCircle size={21}/><span>Likučių koregavimas</span></button>
      <button className="nav-item" onClick={()=>setModal({type:"product"})}><Package size={21}/><span>Pridėti prekę</span></button>
      <div className="nav-divider"></div>
      <button className="nav-item" onClick={()=>setModal({type:"history"})}><ChartNoAxesColumnIncreasing size={21}/><span>Ataskaitos / istorija</span></button>
      <button className="nav-item" onClick={()=>flash("Nustatymų skiltis bus išplėsta vėlesniame etape.")}><Settings size={21}/><span>Nustatymai</span></button>
      <div className="sidebar-bottom">
        {user && isAdmin ? <><div className="admin-badge"><UserRound size={18}/><div><b>Administratorius</b><small>{user.email}</small></div></div><button className="nav-item" onClick={signOut}><LogOut size={20}/><span>Atsijungti</span></button></>
          : <button className="login-button" onClick={()=>setModal({type:"login"})}><LockKeyhole size={18}/><span>Administratoriaus prisijungimas</span></button>}
      </div>
    </aside>
    {mobileMenu && <button className="scrim" onClick={()=>setMobileMenu(false)} aria-label="Uždaryti meniu"/>}
    <main className="main-content">
      <header className="topbar">
        <div className="title-wrap"><button className="mobile-menu-button icon-button" onClick={()=>setMobileMenu(true)}><Menu size={23}/></button><div className="title-icon"><Layers3 size={30}/></div><div><h1>{pageTitle}</h1><p>Sandėlio likučiai ir medžiagų valdymas</p></div></div>
        <div className="top-meta"><div className="updated"><RefreshCw size={19}/><div><small>Paskutinį kartą atnaujinta</small><b>{lastUpdated ? shortTime(lastUpdated) : "Laukiama duomenų"}</b></div></div><div className="date-meta"><div><b>{dateTime().split(",")[0]}</b><small>{dateTime().split(",")[1]?.trim()}</small></div></div></div>
      </header>

      <section className={`panel order-panel order-panel-top ${orderItems.length ? "has-orders" : "no-orders"}`}>
        <div className="panel-heading"><div className="panel-title"><span className={`heading-icon ${orderItems.length ? "red-icon" : "order-ok-icon"}`}><ShoppingCart size={23}/></span><div><h2>Užsakomos medžiagos</h2><p>{activeLabel} · rodomos tik šios skilties pozicijos, kurių likutis mažesnis už minimumą</p></div></div><span className="pill-count">{orderItems.length}</span></div>
        <div className="order-list">{orderItems.map(p=><div className="order-item" key={p.id}><div className="order-indicator"></div><div><b>{displayName(p)}</b><small>{subcategoryLabel(p.category,p.subcategory)}</small><CopyCode code={p.code} flash={flash}/></div><StockBadge p={p}/></div>)}{!orderItems.length&&<div className="all-stock-ok"><Check size={18}/> Šioje skiltyje užsakomų medžiagų nėra.</div>}</div>
      </section>

      {notice && <div className="toast" role="status">{notice}<button onClick={()=>setNotice("")}><X size={16}/></button></div>}
      {!configured && <div className="setup-banner"><AlertTriangle size={20}/><div><b>Demonstracinis režimas</b><span>Matote pavyzdinius likučius. Kad duomenys išsisaugotų, prijunkite Supabase pagal README instrukciją.</span></div></div>}
      {loading && <div className="loading-line">Įkeliami sandėlio duomenys…</div>}

      <div className="toolbar"><div className="searchbox"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ieškoti pagal pavadinimą arba kodą…"/></div><button className="secondary-button" onClick={refreshProducts}><RefreshCw size={17}/> Atnaujinti</button></div>

      {active === "photo" ? <>
        <div className="inventory-grid">
          <section className="panel paper-panel">
            <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><Layers3 size={23}/></span><div><h2>Foto popierius</h2><p>Visi paviršiai ir pločiai matomi iš karto</p></div></div>{isAdmin && <button className="small-green-button" onClick={()=>setModal({type:"product",kind:"paper"})}><Plus size={16}/> Pridėti</button>}</div>
            <div className="paper-table">
              <div className="table-head paper-head"><span>Paviršius</span><span>Plotis</span><span>Kodas</span><span>Likutis / Min.</span><span className="actions-head">Veiksmai</span></div>
              {["Glossy","Lustre","Silk"].map(surface=>{
                const rows=papers.filter(p=>p.surface===surface);
                return <div className="surface-group" key={surface}>
                  <div className={`surface-label ${PAPER_COLORS[surface]||"green"}`}>{surface}</div>
                  <div className="surface-rows">{rows.length ? rows.map(p=><ProductRow key={p.id} p={p} isAdmin={isAdmin} onAdjust={setModal} flash={flash}/>) : <div className="empty-row">Nėra {surface} pozicijų</div>}</div>
                </div>;
              })}
              {!papers.length && <div className="empty-state">Šioje kategorijoje prekių nėra.</div>}
            </div>
          </section>

          <section className="panel chemical-panel">
            <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><FlaskConical size={23}/></span><div><h2>Chemija (foto mašina)</h2><p>Bakų likutis vizualiai</p></div></div>{isAdmin && <button className="small-green-button" onClick={()=>setModal({type:"product",kind:"chemical"})}><Plus size={16}/> Pridėti</button>}</div>
            <div className="chem-list">
              {chemicals.map(p=><div className="chem-row" key={p.id}><div className={`chem-dot ${CHEMICAL_COLORS[p.name]||"green"}`}></div><div className="chem-name"><b>{p.name}</b></div><CopyCode code={p.code} flash={flash}/><TankBar quantity={p.quantity} tone={CHEMICAL_COLORS[p.name]||"green"} small={p.name==="STB Super Stabilizer"}/><StockBadge p={p}/>{isAdmin&&<button className="row-action" onClick={()=>setModal({type:"adjust",product:p,mode:"set"})} aria-label="Koreguoti"><Pencil size={15}/></button>}</div>)}
              {!chemicals.length && <div className="empty-state">Chemijos pozicijų nėra. Administratorius gali pridėti prekę.</div>}
            </div>
            <div className="chem-legend"><span><i className="legend-dot blue"></i>CD Developer</span><span><i className="legend-dot red"></i>BF Bleach Fix</span><span><i className="legend-dot yellow"></i>STB Super Stabilizer</span></div>
          </section>
        </div>
        <section className="panel category-panel photo-other-panel">
          <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><Package size={23}/></span><div><h2>Kita</h2><p>Kitos foto laboratorijos medžiagos</p></div></div>{isAdmin&&<button className="small-green-button" onClick={()=>setModal({type:"product",subcategory:"other",kind:"item"})}><Plus size={16}/> Pridėti</button>}</div>
          <div className="generic-table"><div className="table-head"><span>Prekė</span><span>Kodas</span><span>Likutis / Min.</span><span>Veiksmai</span></div>
            {categoryProducts.filter(p=>(p.subcategory||"other")==="other"&&(!search||[p.name,p.code].join(" ").toLowerCase().includes(search.toLowerCase()))).slice().sort((a,b)=>displayName(a).localeCompare(displayName(b),"lt")).map(p=><div className="generic-row" key={p.id}><div><b>{displayName(p)}</b><small>{p.unit||"vnt."}</small></div><CopyCode code={p.code} flash={flash}/><StockBadge p={p}/><div className="row-actions">{isAdmin&&<><button className="row-action" onClick={()=>setModal({type:"adjust",product:p,mode:"set"})}><Pencil size={15}/></button><button className="row-action danger" onClick={()=>deleteProduct(p)}><Trash2 size={15}/></button></>}</div></div>)}
            {!categoryProducts.some(p=>(p.subcategory||"other")==="other")&&<div className="empty-state">Kitos foto medžiagos bus rodomos čia.</div>}
          </div>
        </section>
      </> : <section className="panel category-panel">
        <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><Package size={23}/></span><div><h2>{activeLabel}</h2><p>Medžiagos suskirstytos pagal šios skilties kategorijas</p></div></div>{isAdmin&&<button className="small-green-button" onClick={()=>setModal({type:"product"})}><Plus size={16}/> Pridėti prekę</button>}</div>
        {<div className="subcategory-grid">{NAV.find(n=>n.id===active)?.sections.map(section=>{
          const rows=categoryProducts.filter(p=>(p.subcategory||"other")===section.id&&(!search||[p.name,p.code].join(" ").toLowerCase().includes(search.toLowerCase()))).slice().sort((a,b)=>displayName(a).localeCompare(displayName(b),"lt"));
          return <div className="subcategory-block" key={section.id}><div className="subcategory-heading"><h3>{section.label}</h3><span>{rows.length} poz.</span>{isAdmin&&<button className="small-green-button" onClick={()=>setModal({type:"product",subcategory:section.id})}><Plus size={14}/> Pridėti</button>}</div>
            <div className="generic-table"><div className="table-head"><span>Prekė</span><span>Kodas</span><span>Likutis / Min.</span><span>Veiksmai</span></div>
              {rows.map(p=><div className="generic-row" key={p.id}><div><b>{displayName(p)}</b><small>{p.kind==="ink"?"Rašalo lygis (%)":p.unit||"vnt."}</small></div><CopyCode code={p.code} flash={flash}/><StockBadge p={p}/><div className="row-actions">{isAdmin&&<><button className="row-action" onClick={()=>setModal({type:"adjust",product:p,mode:"set"})}><Pencil size={15}/></button><button className="row-action danger" onClick={()=>deleteProduct(p)}><Trash2 size={15}/></button></>}</div></div>)}
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
      <footer className="footer"><span>FOTO LABORATORIJA · Sandėlio sistema</span><span>{user&&isAdmin?"Administratoriaus režimas":"Viešas peržiūros režimas"} · Laikas: Lietuva</span></footer>
    </main>

    <nav className="mobile-bottom-nav">{NAV.map(item=>{const Icon=item.icon;return <button key={item.id} className={active===item.id?"active":""} onClick={()=>{setActive(item.id);setSearch("");}}><Icon size={19}/><span>{item.id==="photo"?"Medžiagos":item.id==="wide"?"Spauda":item.id==="sublimation"?"Sublimacija":item.id==="framing"?"Rėminimas":"Kitos"}</span></button>})}</nav>

    {modal?.type==="login"&&<Modal title="Administratoriaus prisijungimas" onClose={()=>setModal(null)}><LoginForm onSubmit={signIn} busy={busy}/></Modal>}
    {modal?.type==="product"&&<Modal title="Pridėti naują prekę" onClose={()=>setModal(null)}><ProductForm category={active} kind={modal.kind} subcategory={modal.subcategory} onSubmit={addProduct} busy={busy}/></Modal>}
    {modal?.type==="adjust"&&<Modal title="Likučių koregavimas" onClose={()=>setModal(null)}><AdjustForm products={products} initialProduct={modal.product} mode={modal.mode} onSubmit={adjustStock} busy={busy}/></Modal>}
    {modal?.type==="scanner"&&<Modal title="QR kodo nuskaitymas" onClose={stopScanner}><p className="modal-help">Nukreipkite kamerą į prekės QR kodą. Sėkmingai nuskaičius, likutis sumažės vienu vienetu.</p><div id="qr-reader" className="qr-reader" ref={scannerRef}></div><button className="secondary-button full-width" onClick={stopScanner}>Uždaryti kamerą</button></Modal>}
    {modal?.type==="history"&&<Modal title="Pakeitimų istorija" onClose={()=>setModal(null)} wide><HistoryModal logs={activeLogs}/></Modal>}
    {modal?.type==="qr"&&<Modal title="Prekės QR etiketė" onClose={()=>setModal(null)}><QrLabel product={modal.product}/></Modal>}
    {modal?.type==="qrLibrary"&&<Modal title="QR nuskaitymas ir etiketės" onClose={()=>setModal(null)} wide><QrLibrary products={products} isAdmin={isAdmin} onScan={startScanner} onPrint={product=>setModal({type:"qr",product})}/></Modal>}
  </div>;
}

function StockBadge({p}) { const percent=p.kind==="ink"; return <span className={`stock-badge ${stockTone(p)}`}>{fmt(p.quantity)}{percent?"%":""} <i>/</i> {fmt(p.min_quantity)}{percent?"%":""}</span>; }
function CopyCode({code,flash}) {
  const [copied,setCopied]=useState(false);
  if (!code) return <span className="code-empty">Be kodo</span>;
  async function copy(){try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1400);}catch{flash("Nepavyko nukopijuoti kodo.");}}
  return <button className="code-copy" onClick={copy} title="Kopijuoti prekės kodą"><span>{code}</span>{copied?<Check size={15}/>:<Copy size={15}/>}</button>;
}
function ProductRow({p,isAdmin,onAdjust,flash}) {
  return <div className="paper-row"><span className="paper-width">{String(p.width_cm).replace(".",",")} cm</span><CopyCode code={p.code} flash={flash}/><StockBadge p={p}/><div className="row-actions">{isAdmin&&<><button className="row-action" title="Atimti 1" onClick={()=>onAdjust({type:"adjust",product:p,mode:"remove"})}><Minus size={14}/></button><button className="row-action" title="Pridėti 1" onClick={()=>onAdjust({type:"adjust",product:p,mode:"add"})}><Plus size={14}/></button><button className="row-action" title="Koreguoti likutį" onClick={()=>onAdjust({type:"adjust",product:p,mode:"set"})}><Pencil size={14}/></button></>}</div></div>;
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
    {overflow&&<b className="tank-overflow">+</b>}
  </div>;
}
function Modal({title,children,onClose,wide}) {
  useEffect(()=>{const f=e=>e.key==="Escape"&&onClose();window.addEventListener("keydown",f);return()=>window.removeEventListener("keydown",f)},[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className={`modal ${wide?"modal-wide":""}`} role="dialog" aria-modal="true"><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={20}/></button></header><div className="modal-body">{children}</div></section></div>;
}
function LoginForm({onSubmit,busy}) {
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit(email,password)}}><label>El. paštas<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@imone.lt"/></label><label>Slaptažodis<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary-button" disabled={busy}>{busy?"Jungiamasi…":"Prisijungti"}</button><p className="form-note">Administratoriaus paskyra sukuriama Supabase valdymo aplinkoje. Vieši lankytojai gali tik peržiūrėti likučius.</p></form>;
}
function ProductForm({category,kind:forcedKind,subcategory:forcedSubcategory,onSubmit,busy}) {
  const [cat,setCat]=useState(category||"photo");const [subcategory,setSubcategory]=useState(forcedSubcategory || (forcedKind==="paper"?"paper":forcedKind==="chemical"?"chemical":"other"));const [kind,setKind]=useState(forcedKind||"item");const [name,setName]=useState("");const [surface,setSurface]=useState("Glossy");const [width,setWidth]=useState("12.7");const [code,setCode]=useState("");const [qty,setQty]=useState("0");const [min,setMin]=useState("1");const [unit,setUnit]=useState("bak.");
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit({category:cat,subcategory,kind,name:kind==="paper"?surface:name,surface,width_cm:width,code,quantity:qty,min_quantity:min,unit})}}>
    <label>Kategorija<select value={cat} onChange={e=>{const next=NAV.find(n=>n.id===e.target.value);setCat(e.target.value);const first=next?.sections[0]?.id||"other";setSubcategory(first);setKind(e.target.value==="photo"&&first==="paper"?"paper":e.target.value==="photo"&&first==="chemical"?"chemical":first==="ink"?"ink":"item");}}>{NAV.map(n=><option value={n.id} key={n.id}>{n.label}</option>)}</select></label>
    <label>Medžiagų kategorija<select value={subcategory} onChange={e=>{setSubcategory(e.target.value);if(cat==="photo"&&e.target.value==="paper")setKind("paper");else if(cat==="photo"&&e.target.value==="chemical")setKind("chemical");else setKind(e.target.value==="ink"?"ink":"item");if(e.target.value==="ink")setUnit("%");}}>{(NAV.find(n=>n.id===cat)?.sections||[]).map(section=><option value={section.id} key={section.id}>{section.label}</option>)}</select></label>
    {kind==="paper"?<><label>Paviršius<select value={surface} onChange={e=>setSurface(e.target.value)}><option>Glossy</option><option>Lustre</option><option>Silk</option></select></label><label>Plotis<select value={width} onChange={e=>setWidth(e.target.value)}><option value="12.7">12,7 cm</option><option value="15.2">15,2 cm</option><option value="30.5">30,5 cm</option></select></label></>:<><label>Prekės pavadinimas<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Pvz., papildoma chemija"/></label><label>Matavimo vienetas<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="bak.">bak.</option><option value="vnt.">vnt.</option><option value="l">l</option><option value="kg">kg</option><option value="pak.">pak.</option><option value="%">%</option></select></label></>}
    <label>Prekės kodas (nebūtina)<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Jei prekė kodo neturi, palikite tuščią"/></label>
    <div className="form-two"><label>{kind==="ink"?"Dabartinis lygis (%)":"Dabartinis likutis"}<input type="number" required min="0" max={kind==="ink"?100:undefined} step={kind==="ink"?1:kind==="chemical"?"0.1":"0.5"} value={qty} onChange={e=>setQty(e.target.value)}/></label><label>{kind==="ink"?"Minimalus lygis (%)":"Minimalus likutis"}<input type="number" required min="0" max={kind==="ink"?100:undefined} step={kind==="ink"?1:kind==="chemical"?"0.1":"0.5"} value={min} onChange={e=>setMin(e.target.value)}/></label></div>
    <button className="primary-button" disabled={busy}>{busy?"Saugoma…":"Pridėti prekę"}</button><p className="form-note">Prekės kodas turi būti unikalus. QR etiketes rasite šoninės juostos skiltyje „QR nuskaitymas“.</p>
  </form>;
}
function AdjustForm({products,initialProduct,mode:initialMode,onSubmit,busy}) {
  const [mode,setMode]=useState(initialMode||"add");
  const [id,setId]=useState(initialProduct?.id||"");const product=products.find(p=>String(p.id)===String(id));
  const [amount,setAmount]=useState((initialMode||"add")==="set"?String(initialProduct?.quantity??0):"1");const [reason,setReason]=useState((initialMode||"add")==="add"?"Papildymas":(initialMode||"add")==="remove"?"Paėmimas":"Likučio perskaičiavimas");
  function changeMode(next){setMode(next);setAmount(next==="set"?String(product?.quantity??0):"1");setReason(next==="add"?"Papildymas":next==="remove"?"Paėmimas":"Likučio perskaičiavimas");}
  const after=product?(mode==="set"?Number(amount):Number(product.quantity)+(mode==="remove"?-1:1)*Number(amount)):0;
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();if(!product)return;const n=Number(amount);const delta=mode==="add"?n:mode==="remove"?-n:n;onSubmit(product,delta,reason,mode==="set")}}>
    <div className="adjust-mode-switch" role="group" aria-label="Likučio veiksmas"><button type="button" className={mode==="add"?"active":""} onClick={()=>changeMode("add")}><Plus size={15}/> Pridėti</button><button type="button" className={mode==="remove"?"active":""} onClick={()=>changeMode("remove")}><Minus size={15}/> Atimti</button><button type="button" className={mode==="set"?"active":""} onClick={()=>changeMode("set")}><Pencil size={15}/> Koreguoti</button></div>
    <label>Prekė<select required value={id} onChange={e=>{setId(e.target.value);const p=products.find(x=>String(x.id)===e.target.value);setAmount(mode==="set"?String(p?.quantity??0):"1")}}><option value="">Pasirinkite prekę</option>{products.map(p=><option value={p.id} key={p.id}>{displayName(p)} · {p.code} ({fmt(p.quantity)}{p.kind==="ink"?"%":""})</option>)}</select></label>
    <label>{mode==="set"?(product?.kind==="ink"?"Naujas tikslus lygis (%)":"Naujas tikslus likutis"):(product?.kind==="ink"?"Pokytis (%)":"Kiekis")}<input type="number" required min={mode==="set"?0:0} max={product?.kind==="ink"?100:undefined} step={product?.kind==="ink"?1:product?.kind==="chemical"?"0.1":"0.5"} value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label>Priežastis<select value={reason} onChange={e=>setReason(e.target.value)}><option>Papildymas</option><option>Paėmimas</option><option>QR nuskaitymas praleistas</option><option>Likučio perskaičiavimas</option><option>Brokuota / sugadinta</option><option>Kita</option></select></label>
    {product&&<div className="adjust-preview"><span>Dabartinis likutis</span><b>{fmt(product.quantity)}{product.kind==="ink"?"%":` ${product.unit}`}</b><span>Po pakeitimo</span><b>{fmt(after)}{product.kind==="ink"?"%":` ${product.unit}`}</b></div>}
    <button className="primary-button" disabled={busy||!product}>{busy?"Saugoma…":"Išsaugoti likutį"}</button>
  </form>;
}
function QrLibrary({products,isAdmin,onScan,onPrint}) {
  const qrProducts=products.filter(p=>p.kind==="paper");
  return <div className="qr-library"><div className="qr-library-intro"><p>Čia pateikti foto popieriaus QR kodai. Etiketę atsispausdinkite vieną kartą. Nukreipus į ją įprastą telefono kamerą, atsidarys svetainė ir likutis automatiškai sumažės 1 vnt., jei tame naršyklės lange esate prisijungę kaip administratorius.</p><button className="primary-button" onClick={onScan}><ScanLine size={16} style={{verticalAlign:"middle",marginRight:6}}/> Skenuoti QR kodą</button></div>
    {!isAdmin&&<p className="form-note">Etikečių spausdinimui ir likučio keitimui prisijunkite kaip administratorius.</p>}
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
    <p className="form-note">QR kode yra tiesioginė saugi nuoroda. Nuskenavus įprasta telefono kamera, svetainė atsidarys ir automatiškai atims 1 vnt. tik tada, jei tame pačiame naršyklės lange esate prisijungę kaip administratorius. Kitu atveju likutis nebus keičiamas.</p>
  </div>;
}
function HistoryModal({logs}) {
  return <div className="history-modal-list">{logs.length?logs.map(log=><div className="history-modal-row" key={log.id}><div><b>{log.products?displayName(log.products):log.product_name||"Prekė"}</b><small>{shortTime(log.created_at)} · {log.reason||"Likučio pakeitimas"}</small></div><strong className={Number(log.delta)<0?"negative-text":"positive-text"}>{Number(log.delta)>0?"+":""}{fmt(log.delta)}</strong></div>):<div className="empty-state">Kol kas pakeitimų nėra.</div>}</div>;
}