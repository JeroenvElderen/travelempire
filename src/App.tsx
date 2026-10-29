import { useState } from "react";
import { BarChart3, Building2, CarFront, Compass, FlaskConical, Landmark, Map as MapIcon, Menu, X } from "lucide-react";
import WorldMap from "./components/WorldMap";

const navigation = [
  { name: "World", icon: MapIcon },
  { name: "Fleet", icon: CarFront },
  { name: "Operations", icon: Compass },
  { name: "Company", icon: Building2 },
  { name: "Finance", icon: Landmark },
  { name: "Empire", icon: BarChart3 },
  { name: "Research", icon: FlaskConical },
] as const;
type Page = (typeof navigation)[number]["name"];

export default function App() {
  const [page, setPage] = useState<Page>("World");
  const [drawerOpen, setDrawerOpen] = useState(false);
  return <div className="shell">
    <aside className={`sidebar ${drawerOpen ? "open" : ""}`}>
      <header className="brand"><div className="brand-mark">T</div><div><strong>TRAVELEMPIRE</strong><small>WORLDFRONT 2.0</small></div><button className="close-menu" aria-label="Close menu" onClick={() => setDrawerOpen(false)}><X size={19}/></button></header>
      <div className="side-label">MANAGEMENT</div>
      <nav className="navigation" aria-label="Main navigation">{navigation.map(({name,icon:Icon})=><button key={name} className={page===name ? "selected":""} onClick={()=>{setPage(name);setDrawerOpen(false);}}><Icon size={19}/><span>{name}</span></button>)}</nav>
      <div className="sidebar-bottom"><span className="status-dot"/> Foundation preview <small>Simulation not connected</small></div>
    </aside>
    {drawerOpen && <button className="backdrop" aria-label="Close navigation" onClick={()=>setDrawerOpen(false)} />}
    <main className="main">
      <header className="topbar"><button className="menu-toggle" aria-label="Open navigation" onClick={()=>setDrawerOpen(true)}><Menu size={21}/></button><div className="breadcrumbs">TRAVELEMPIRE <span>/</span> <b>{page.toUpperCase()}</b></div><div className="phase">FOUNDATION · V0.1</div></header>
      {page==="World" ? <section className="world"><WorldMap/><div className="map-overlay"><small>GLOBAL OPERATIONS</small><h1>Build your taxi empire.</h1><p>Explore the world. Establish your first company. Grow a fleet across borders.</p><span className="preview-pill">Map preview — no taxis or game data yet</span></div><div className="map-legend"><span className="status-dot"/> World map online</div></section>
      : <section className="placeholder"><span className="eyebrow">MANAGEMENT CENTER</span><h1>{page}</h1><p>This module is reserved for an upcoming development milestone. No simulated figures are shown until the authoritative backend is implemented.</p><div className="placeholder-card"><span>MODULE STATUS</span><strong>Planned</strong><small>Foundation preview · no live company data</small></div></section>}
    </main>
    <nav className="mobile-tabs" aria-label="Mobile navigation">{navigation.slice(0,5).map(({name,icon:Icon})=><button key={name} className={page===name ? "active":""} onClick={()=>setPage(name)}><Icon size={19}/><span>{name}</span></button>)}<button onClick={()=>setDrawerOpen(true)}><Menu size={19}/><span>More</span></button></nav>
  </div>;
}
