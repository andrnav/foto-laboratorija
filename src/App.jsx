import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Html5Qrcode } from "html5-qrcode";
import { QRCodeCanvas } from "qrcode.react";
import {
  Layers3, Printer, CupSoda, Frame, Box, QrCode, PlusCircle, MinusCircle,
  Pencil, ChartNoAxesColumnIncreasing, Settings, LogOut, UserRound, RefreshCw,
  ShoppingCart, Package, FlaskConical, Copy, Check, Menu, X, Search, History,
  ChevronDown, ChevronRight, Plus, Minus, ScanLine, ShieldCheck, AlertTriangle,
  Download, Trash2, LockKeyhole, Clock3
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const NAV = [
  { id: "photo", label: "Foto medžiagos", icon: Layers3 },
  { id: "wide", label: "Plačiaformatė spauda", icon: Printer },
  { id: "sublimation", label: "Sublimacija", icon: CupSoda },
  { id: "framing", label: "Rėminimas", icon: Frame },
  { id: "other", label: "Kitos medžiagos", icon: Box },
];
const CHEMICAL_COLORS = { "CD Developer": "blue", "BF Bleach Fix": "red", "STB Super Stabilizer": "yellow" };
const PAPER_COLORS = { Glossy: "green", Lustre: "blue", Silk: "pink" };
const STARTER = [
  ...["Glossy","Lustre","Silk"].flatMap((surface, si) => [12.7,15.2,30.5].map((width, wi) => ({
    id:`demo-${si}-${wi}`, category:"photo", kind:"paper", name:surface, surface, width_cm:width,
    code:`FP-${["G","L","S"][si]}${Math.round(width*10)}`, quantity:[5,2,6,4,7,0,3,4,5][si*3+wi],
    min_quantity: surface==="Lustre" && width===30.5 ? 2 : (width===30.5 ? 4 : (surface==="Silk" ? 3 : 4)), unit:"vnt."
  }))),
  ...[
    ["CD Developer","CH-CD",2.5,2,"blue"],
    ["BF Bleach Fix","CH-BF",2,2,"red"],
    ["STB Super Stabilizer","CH-STB",1.5,2,"yellow"]
  ].map((x,i)=>({id:`chem-${i}`,category:"photo",kind:"chemical",name:x[0],code:x[1],quantity:x[2],min_quantity:x[3],unit:"bak.",color:x[4]}))
];

function fmt(n) { return Number(n ?? 0).toLocaleString("lt-LT", { maximumFractionDigits: 2 }); }
function dateTime(d = new Date()) {
  return new Intl.DateTimeFormat("lt-LT", { timeZone:"Europe/Vilnius", year:"numeric",month:"2-digit",day:"2-digit",weekday:"long",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false }).format(d);
}
function shortTime(s) { if (!s) return "—"; return new Date(s).toLocaleString("lt-LT", { hour:"2-digit", minute:"2-digit", second:"2-digit", day:"2-digit", month:"2-digit", year:"numeric" }); }
function stockTone(p) { return Number(p.quantity) < Number(p.min_quantity) ? "low" : "ok"; }
function displayName(p) { return p.kind === "paper" ? `${p.surface} ${String(p.width_cm).replace(".",",")} cm` : p.name; }

export default function App() {
  const configured = Boolean(supabase);
  const [products, setProducts] = useState(STARTER);
  const [logs, setLogs] = useState([]);
  const [active, setActive] = useState("photo");
  const [now, setNow] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
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

  const loadData = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    const [{ data: ps, error: pe }, { data: ls }] = await Promise.all([
      supabase.from("products").select("*").order("category").order("kind").order("name").order("width_cm"),
      supabase.from("stock_logs").select("*, products(name, surface, width_cm, code)").order("created_at", { ascending:false }).limit(12)
    ]);
    if (pe) setNotice(`Duomenų nepavyko įkelti: ${pe.message}`);
    else { setProducts(ps || []); setLogs(ls || []); setLastUpdated(new Date()); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({data}) => setUser(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      setIsAdmin(false);
      if (session?.user) checkAdmin(session.user.id);
    });
    loadData();
    return () => listener.subscription.unsubscribe();
  }, [loadData]);

  async function checkAdmin(uid) {
    if (!supabase) return;
    const { data, error } = await supabase.from("admins").select("user_id").eq("user_id", uid).maybeSingle();
    setIsAdmin(Boolean(data && !error));
  }

  const visibleProducts = useMemo(() => products.filter(p => p.category === active && (
    !search || [p.name,p.surface,p.code,String(p.width_cm ?? "")].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  )), [products, active, search]);
  const papers = visibleProducts.filter(p => p.kind === "paper");
  const chemicals = visibleProducts.filter(p => p.kind === "chemical");
  const orderItems = products.filter(p => Number(p.quantity) < Number(p.min_quantity));
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
      category: values.category, kind: values.kind, name: values.name.trim(),
      surface: values.kind === "paper" ? values.surface : null,
      width_cm: values.kind === "paper" ? Number(values.width_cm) : null,
      code: values.code.trim(), quantity: Number(values.quantity), min_quantity: Number(values.min_quantity),
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

  async function scanCode(code) {
    const cleaned = String(code || "").trim();
    if (!cleaned) return;
    if (!supabase) return flash("QR nuskaitymas veiks prijungus duomenų bazę.");
    setBusy(true);
    const { data, error } = await supabase.rpc("scan_stock", { p_code: cleaned });
    setBusy(false);
    if (error) flash(`Nuskaitymo klaida: ${error.message}`);
    else if (data?.status === "not_found") flash(`Kodas „${cleaned}“ nerastas.`);
    else if (data?.status === "empty") flash("Sandėlyje likutis jau 0. Nieko neatimta.");
    else { await loadData(); flash(`Nuskaityta: ${data.name}. Atimtas 1 vnt.`); }
  }

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
            try { await scanner.stop(); } catch {}
            scannerInstance.current = null;
            setScannerRunning(false);
            setModal(null);
            await scanCode(decoded);
          }, () => {});
        setScannerRunning(true);
      } catch (e) { flash(`Nepavyko paleisti kameros: ${e.message || e}`); }
    }, 150);
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
      <button className="nav-item" onClick={startScanner}><QrCode size={21}/><span>QR nuskaitymas</span></button>
      <button className="nav-item" onClick={()=>setModal({type:"adjust",mode:"add"})}><PlusCircle size={21}/><span>Pridėti likutį</span></button>
      <button className="nav-item" onClick={()=>setModal({type:"adjust",mode:"remove"})}><MinusCircle size={21}/><span>Atimti likutį</span></button>
      <button className="nav-item" onClick={()=>setModal({type:"adjust",mode:"set"})}><Pencil size={21}/><span>Koreguoti likutį</span></button>
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
        <div className="top-meta"><div className="updated"><RefreshCw size={19}/><div><small>Paskutinį kartą atnaujinta</small><b>{lastUpdated ? shortTime(lastUpdated) : "Laukiama duomenų"}</b></div></div><div className="date-meta"><Clock3 size={18}/><div><b>{dateTime().split(",")[0]}</b><small>{dateTime().split(",")[1]?.trim()}</small></div></div><div className="digital-time">{new Intl.DateTimeFormat("lt-LT",{timeZone:"Europe/Vilnius",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now)}</div></div>
      </header>

      <section className="summary-row">
        <div className="summary-card order-summary"><div className="summary-icon"><ShoppingCart size={24}/></div><div className="summary-main"><b>Užsakomos medžiagos</b><span>{orderItems.length} pozicijos žemiau minimalaus likučio</span></div><strong className="summary-count">{orderItems.length}</strong></div>
        <button className="summary-card scan-summary" onClick={startScanner}><div className="summary-icon"><ScanLine size={24}/></div><div className="summary-main"><b>Skenuoti QR</b><span>Vienas nuskaitymas = −1 vnt.</span></div><ChevronRight size={19}/></button>
        <button className="summary-card add-summary" onClick={()=>setModal({type:"product"})}><div className="summary-icon"><Plus size={24}/></div><div className="summary-main"><b>Pridėti prekę</b><span>Bet kuriai kategorijai</span></div><ChevronRight size={19}/></button>
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
              {chemicals.map(p=><div className="chem-row" key={p.id}><div className={`chem-dot ${CHEMICAL_COLORS[p.name]||"green"}`}></div><div className="chem-name"><b>{p.name}</b><small>{p.code}</small></div><CopyCode code={p.code} flash={flash}/><TankBar quantity={p.quantity} tone={CHEMICAL_COLORS[p.name]||"green"}/><StockBadge p={p}/>{isAdmin&&<><button className="row-action" onClick={()=>setModal({type:"qr",product:p})} aria-label="QR etiketė" title="Rodyti QR etiketę"><QrCode size={15}/></button><button className="row-action" onClick={()=>setModal({type:"adjust",product:p,mode:"set"})} aria-label="Koreguoti"><Pencil size={15}/></button></>}</div>)}
              {!chemicals.length && <div className="empty-state">Chemijos pozicijų nėra. Administratorius gali pridėti prekę.</div>}
            </div>
            <div className="chem-legend"><span><i className="legend-dot blue"></i>CD Developer</span><span><i className="legend-dot red"></i>BF Bleach Fix</span><span><i className="legend-dot yellow"></i>STB Super Stabilizer</span></div>
          </section>
        </div>
      </> : <section className="panel category-panel">
        <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><Package size={23}/></span><div><h2>{activeLabel}</h2><p>Šios kategorijos medžiagos ir likučiai</p></div></div>{isAdmin&&<button className="small-green-button" onClick={()=>setModal({type:"product"})}><Plus size={16}/> Pridėti prekę</button>}</div>
        <div className="generic-table"><div className="table-head"><span>Prekė</span><span>Kodas</span><span>Likutis / Min.</span><span>Veiksmai</span></div>
          {categoryProducts.filter(p=>!search||[p.name,p.code].join(" ").toLowerCase().includes(search.toLowerCase())).map(p=><div className="generic-row" key={p.id}><div><b>{displayName(p)}</b><small>{p.kind==="paper"?"Foto popierius":p.unit||"vnt."}</small></div><CopyCode code={p.code} flash={flash}/><StockBadge p={p}/><div className="row-actions">{isAdmin&&<><button className="row-action" title="QR etiketė" onClick={()=>setModal({type:"qr",product:p})}><QrCode size={15}/></button><button className="row-action" onClick={()=>setModal({type:"adjust",product:p,mode:"set"})}><Pencil size={15}/></button><button className="row-action danger" onClick={()=>deleteProduct(p)}><Trash2 size={15}/></button></>}</div></div>)}
          {!categoryProducts.length&&<div className="empty-state">Šioje kategorijoje dar nėra prekių. {isAdmin?"Paspauskite „Pridėti prekę“.":"Prisijungęs administratorius galės jas pridėti."}</div>}
        </div>
      </section>}

      <div className="bottom-grid">
        <section className="panel history-panel">
          <div className="panel-heading"><div className="panel-title"><span className="heading-icon"><History size={23}/></span><div><h2>Naujausi pakeitimai</h2><p>Sandėlio veiksmų istorija</p></div></div><button className="text-button" onClick={()=>setModal({type:"history"})}>Visa istorija <ChevronRight size={16}/></button></div>
          <div className="history-table"><div className="table-head"><span>Laikas</span><span>Pozicija</span><span>Pokytis</span><span>Priežastis</span></div>
            {logs.slice(0,5).map(log=><div className="history-row" key={log.id}><span>{shortTime(log.created_at)}</span><b>{log.products ? displayName(log.products) : log.product_name || "Prekė"}</b><strong className={Number(log.delta)<0?"negative-text":"positive-text"}>{Number(log.delta)>0?"+":""}{fmt(log.delta)}</strong><span>{log.reason||"Likučio pakeitimas"}</span></div>)}
            {!logs.length&&<div className="empty-state">Pakeitimų istorija atsiras pradėjus naudoti sistemą.</div>}
          </div>
        </section>
        <section className="panel order-panel">
          <div className="panel-heading"><div className="panel-title"><span className="heading-icon red-icon"><ShoppingCart size={23}/></span><div><h2>Užsakomos medžiagos</h2><p>Tik kai likutis mažesnis už minimumą</p></div></div><span className="pill-count">{orderItems.length}</span></div>
          <div className="order-list">{orderItems.slice(0,6).map(p=><div className="order-item" key={p.id}><div className="order-indicator"></div><div><b>{displayName(p)}</b><small>{p.code}</small></div><StockBadge p={p}/></div>)}{!orderItems.length&&<div className="all-stock-ok"><Check size={18}/> Visų prekių likučiai atitinka minimumą.</div>}</div>
        </section>
      </div>
      <footer className="footer"><span>FOTO LABORATORIJA · Sandėlio sistema</span><span>{user&&isAdmin?"Administratoriaus režimas":"Viešas peržiūros režimas"} · Laikas: Lietuva</span></footer>
    </main>

    <nav className="mobile-bottom-nav">{NAV.map(item=>{const Icon=item.icon;return <button key={item.id} className={active===item.id?"active":""} onClick={()=>{setActive(item.id);setSearch("");}}><Icon size={19}/><span>{item.id==="photo"?"Medžiagos":item.id==="wide"?"Spauda":item.id==="sublimation"?"Sublimacija":item.id==="framing"?"Rėminimas":"Kitos"}</span></button>})}</nav>

    {modal?.type==="login"&&<Modal title="Administratoriaus prisijungimas" onClose={()=>setModal(null)}><LoginForm onSubmit={signIn} busy={busy}/></Modal>}
    {modal?.type==="product"&&<Modal title="Pridėti naują prekę" onClose={()=>setModal(null)}><ProductForm category={active} kind={modal.kind} onSubmit={addProduct} busy={busy}/></Modal>}
    {modal?.type==="adjust"&&<Modal title={modal.mode==="add"?"Pridėti likutį":modal.mode==="remove"?"Atimti likutį":"Koreguoti likutį"} onClose={()=>setModal(null)}><AdjustForm products={products} initialProduct={modal.product} mode={modal.mode} onSubmit={adjustStock} busy={busy}/></Modal>}
    {modal?.type==="scanner"&&<Modal title="QR kodo nuskaitymas" onClose={stopScanner}><p className="modal-help">Nukreipkite kamerą į prekės QR kodą. Sėkmingai nuskaičius, likutis sumažės vienu vienetu.</p><div id="qr-reader" className="qr-reader" ref={scannerRef}></div><button className="secondary-button full-width" onClick={stopScanner}>Uždaryti kamerą</button></Modal>}
    {modal?.type==="history"&&<Modal title="Pakeitimų istorija" onClose={()=>setModal(null)} wide><HistoryModal logs={logs}/></Modal>}
    {modal?.type==="qr"&&<Modal title="Prekės QR etiketė" onClose={()=>setModal(null)}><QrLabel product={modal.product}/></Modal>}
  </div>;
}

function StockBadge({p}) { return <span className={`stock-badge ${stockTone(p)}`}>{fmt(p.quantity)} <i>/</i> {fmt(p.min_quantity)}</span>; }
function CopyCode({code,flash}) {
  const [copied,setCopied]=useState(false);
  async function copy(){try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1400);}catch{flash("Nepavyko nukopijuoti kodo.");}}
  return <button className="code-copy" onClick={copy} title="Kopijuoti prekės kodą"><span>{code}</span>{copied?<Check size={15}/>:<Copy size={15}/>}</button>;
}
function ProductRow({p,isAdmin,onAdjust,flash}) {
  return <div className="paper-row"><span className="paper-width">{String(p.width_cm).replace(".",",")} cm</span><CopyCode code={p.code} flash={flash}/><StockBadge p={p}/><div className="row-actions">{isAdmin&&<><button className="row-action" title="Atimti 1" onClick={()=>onAdjust({type:"adjust",product:p,mode:"remove"})}><Minus size={14}/></button><button className="row-action" title="Pridėti 1" onClick={()=>onAdjust({type:"adjust",product:p,mode:"add"})}><Plus size={14}/></button><button className="row-action" title="Koreguoti likutį" onClick={()=>onAdjust({type:"adjust",product:p,mode:"set"})}><Pencil size={14}/></button></>}</div></div>;
}
function TankBar({quantity,tone}) {
  const full=Math.floor(Number(quantity)||0), half=(Number(quantity)||0)-full>=0.5;
  const count=Math.max(3,Math.min(5,full+(half?1:0)));
  return <div className={`tank-bar ${tone}`} aria-label={`Likutis ${quantity} bakų`}>{Array.from({length:count},(_,i)=>{const filled=i<full;const partial=i===full&&half;return <span key={i} className={`tank ${filled?"filled":partial?"partial":"empty"}`}><i/></span>})}</div>;
}
function Modal({title,children,onClose,wide}) {
  useEffect(()=>{const f=e=>e.key==="Escape"&&onClose();window.addEventListener("keydown",f);return()=>window.removeEventListener("keydown",f)},[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className={`modal ${wide?"modal-wide":""}`} role="dialog" aria-modal="true"><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={20}/></button></header><div className="modal-body">{children}</div></section></div>;
}
function LoginForm({onSubmit,busy}) {
  const [email,setEmail]=useState("");const [password,setPassword]=useState("");
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit(email,password)}}><label>El. paštas<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@imone.lt"/></label><label>Slaptažodis<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary-button" disabled={busy}>{busy?"Jungiamasi…":"Prisijungti"}</button><p className="form-note">Administratoriaus paskyra sukuriama Supabase valdymo aplinkoje. Vieši lankytojai gali tik peržiūrėti likučius.</p></form>;
}
function ProductForm({category,kind:forcedKind,onSubmit,busy}) {
  const [cat,setCat]=useState(category||"photo");const [kind,setKind]=useState(forcedKind||"paper");const [name,setName]=useState("");const [surface,setSurface]=useState("Glossy");const [width,setWidth]=useState("12.7");const [code,setCode]=useState("");const [qty,setQty]=useState("0");const [min,setMin]=useState("1");const [unit,setUnit]=useState("bak.");
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();onSubmit({category:cat,kind,name:kind==="paper"?surface:name,surface,width_cm:width,code,quantity:qty,min_quantity:min,unit})}}>
    <label>Kategorija<select value={cat} onChange={e=>setCat(e.target.value)}>{NAV.map(n=><option value={n.id} key={n.id}>{n.label}</option>)}</select></label>
    <label>Prekės tipas<select value={kind} onChange={e=>setKind(e.target.value)}><option value="paper">Foto popierius</option><option value="chemical">Chemija / kita prekė</option></select></label>
    {kind==="paper"?<><label>Paviršius<select value={surface} onChange={e=>setSurface(e.target.value)}><option>Glossy</option><option>Lustre</option><option>Silk</option></select></label><label>Plotis<select value={width} onChange={e=>setWidth(e.target.value)}><option value="12.7">12,7 cm</option><option value="15.2">15,2 cm</option><option value="30.5">30,5 cm</option></select></label></>:<><label>Prekės pavadinimas<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Pvz., papildoma chemija"/></label><label>Matavimo vienetas<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="bak.">bak.</option><option value="vnt.">vnt.</option><option value="l">l</option><option value="kg">kg</option><option value="pak.">pak.</option></select></label></>}
    <label>Prekės kodas<input required value={code} onChange={e=>setCode(e.target.value)} placeholder="Unikalus kodas QR etiketėje"/></label>
    <div className="form-two"><label>Dabartinis likutis<input type="number" required min="0" step="0.5" value={qty} onChange={e=>setQty(e.target.value)}/></label><label>Minimalus likutis<input type="number" required min="0" step="0.5" value={min} onChange={e=>setMin(e.target.value)}/></label></div>
    <button className="primary-button" disabled={busy}>{busy?"Saugoma…":"Pridėti prekę"}</button><p className="form-note">Prekės kodas turi būti unikalus. Sukūrus prekę, QR etiketę galima atsispausdinti iš prekės valdymo skilties, kai ši funkcija bus įjungta.</p>
  </form>;
}
function AdjustForm({products,initialProduct,mode,onSubmit,busy}) {
  const [id,setId]=useState(initialProduct?.id||"");const product=products.find(p=>String(p.id)===String(id));
  const [amount,setAmount]=useState(mode==="set"?String(initialProduct?.quantity??0):"1");const [reason,setReason]=useState(mode==="add"?"Papildymas":mode==="remove"?"Paėmimas":"Likučio perskaičiavimas");
  return <form className="form-stack" onSubmit={e=>{e.preventDefault();if(!product)return;const n=Number(amount);const delta=mode==="add"?n:mode==="remove"?-n:n;onSubmit(product,delta,reason,mode==="set")}}>
    <label>Prekė<select required value={id} onChange={e=>{setId(e.target.value);const p=products.find(x=>String(x.id)===e.target.value);setAmount(mode==="set"?String(p?.quantity??0):"1")}}><option value="">Pasirinkite prekę</option>{products.map(p=><option value={p.id} key={p.id}>{displayName(p)} · {p.code} ({fmt(p.quantity)})</option>)}</select></label>
    <label>{mode==="set"?"Naujas tikslus likutis":"Kiekis"}<input type="number" required min="0" step="0.5" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label>Priežastis<select value={reason} onChange={e=>setReason(e.target.value)}><option>Papildymas</option><option>Paėmimas</option><option>QR nuskaitymas praleistas</option><option>Likučio perskaičiavimas</option><option>Brokuota / sugadinta</option><option>Kita</option></select></label>
    {product&&<div className="adjust-preview"><span>Dabartinis likutis</span><b>{fmt(product.quantity)} {product.unit}</b><span>Po pakeitimo</span><b>{fmt(mode==="set"?Number(amount):Number(product.quantity)+(mode==="remove"?-1:1)*Number(amount))} {product.unit}</b></div>}
    <button className="primary-button" disabled={busy||!product}>{busy?"Saugoma…":"Išsaugoti likutį"}</button>
  </form>;
}
function QrLabel({product}) {
  const label = displayName(product);
  return <div className="qr-label-wrap">
    <div className="qr-print-label">
      <div className="qr-brand"><span className="brand-mark"><span></span><span></span></span><b>FOTO LABORATORIJA</b></div>
      <QRCodeCanvas value={product.code} size={210} level="H" includeMargin />
      <h3>{label}</h3><p>{product.code}</p><small>Vienas nuskaitymas = −1 vnt.</small>
    </div>
    <button className="primary-button full-width" onClick={()=>window.print()}><Download size={16} style={{verticalAlign:"middle",marginRight:7}}/> Spausdinti QR etiketę</button>
    <p className="form-note">QR kode užkoduotas tik prekės kodas. Atspausdinkite etiketę ir pritvirtinkite prie atitinkamos medžiagos.</p>
  </div>;
}
function HistoryModal({logs}) {
  return <div className="history-modal-list">{logs.length?logs.map(log=><div className="history-modal-row" key={log.id}><div><b>{log.products?displayName(log.products):log.product_name||"Prekė"}</b><small>{shortTime(log.created_at)} · {log.reason||"Likučio pakeitimas"}</small></div><strong className={Number(log.delta)<0?"negative-text":"positive-text"}>{Number(log.delta)>0?"+":""}{fmt(log.delta)}</strong></div>):<div className="empty-state">Kol kas pakeitimų nėra.</div>}</div>;
}