import {useMemo,useState} from 'react';
import {Anchor,ArrowLeftRight,CheckCircle2,ChevronDown,Clock3,LockKeyhole,MapPin,RefreshCw,Search,Ship,Ticket,TrendingUp,UsersRound} from 'lucide-react';
import type {Company,Headquarters} from '../company';
import type {FerryNetwork,FerryRoute,FerryPort} from '../maritime/ferries';
import {ferryRoutePrice} from '../maritime/routePlanning';
import {ferryPhase,ferryForecastDeparture} from '../maritime/ferryService';
import {ferryVoyageEconomics,standardFerryFare} from '../maritime/ferryEconomics';
import './ferry-routes.css';
import './ferry-floating.css';

type FerryTab='routes'|'harbours'|'fleet';
type RouteOwnershipFilter='all'|'unowned'|'purchased';
type Props={
 company:Company|null;
 onPurchase:(routeId:string,price:number)=>void;
 onTicketPriceChange:(routeId:string,fare:number)=>void;
 unlockedHarbourIds:string[];
 network:FerryNetwork|null;
 onReloadNetwork:()=>Promise<void>;
 gameNow:number;
 headquarters:Headquarters|null;
 ferryRevenueByDay:Record<string,number>;
};
const euros=(value:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
const minuteText=(minutes:number)=>minutes>=60?`${Math.floor(minutes/60)}h ${Math.round(minutes%60)}m`:`${Math.round(minutes)}m`;
const distance=(a:[number,number],b:[number,number])=>
 Math.hypot((a[0]-b[0])*Math.cos((a[1]+b[1])*Math.PI/360),a[1]-b[1]);
const displayName=(port:FerryPort|undefined,id:string)=>port?.name||id;

export default function FerryRoutesPanel({
 company,onPurchase,onTicketPriceChange,unlockedHarbourIds,network,
 onReloadNetwork,gameNow,headquarters,ferryRevenueByDay
}:Props){
 const [tab,setTab]=useState<FerryTab>('routes');
 const [routeFilter,setRouteFilter]=useState<RouteOwnershipFilter>('all');
 const [query,setQuery]=useState('');
 const [error,setError]=useState('');
 const [reloading,setReloading]=useState(false);
 const [lastReloaded,setLastReloaded]=useState('');
 const [showAll,setShowAll]=useState(false);
 const discovered=useMemo(()=>new Set(unlockedHarbourIds),[unlockedHarbourIds]);
 const purchased=useMemo(()=>new Set(company?.purchasedFerryRouteIds??[]),[company?.purchasedFerryRouteIds]);
 const ports=useMemo(()=>new Map(network?.ports.map(port=>[port.id,port])??[]),[network]);
 const eligibleRoutes=useMemo(()=>[...(network?.routes??[])].filter(r=>
  purchased.has(r.id)||discovered.has(r.from)||discovered.has(r.to))
  .sort((a,b)=>Number(purchased.has(b.id))-Number(purchased.has(a.id))||
   (a.name??'').localeCompare(b.name??'')),[network,purchased,discovered]);
 const boughtRoutes=useMemo(()=>eligibleRoutes.filter(r=>purchased.has(r.id)),[eligibleRoutes,purchased]);
 const gameDay=new Date(gameNow).toISOString().slice(0,10);
 const todayReceipts=ferryRevenueByDay[gameDay]??0;
 const orientation=(route:FerryRoute)=>{
  const from=ports.get(route.from),to=ports.get(route.to);
  if(!from||!to||!headquarters)return {from:route.from,to:route.to};
  const h:[number,number]=[headquarters.lng,headquarters.lat];
  return distance(h,to.position)<distance(h,from.position)
   ?{from:route.to,to:route.from}:{from:route.from,to:route.to};
 };
 const service=(route:FerryRoute)=>{
  const start=company?.ferryServiceStartedAt?.[route.id];
  return typeof start==='number'&&Number.isFinite(start)
   ?ferryPhase(start,route.durationMinutes,gameNow):null;
 };
 const sailing=boughtRoutes.filter(r=>service(r)?.phase==='sailing').length;
 const normalizedQuery=query.toLowerCase().trim();
 const filteredRoutes=eligibleRoutes.filter(r=>{
  if(routeFilter==='unowned'&&purchased.has(r.id))return false;
  if(routeFilter==='purchased'&&!purchased.has(r.id))return false;
  const names=`${r.name??''} ${displayName(ports.get(r.from),r.from)} ${displayName(ports.get(r.to),r.to)}`.toLowerCase();
  return !normalizedQuery||names.includes(normalizedQuery);
 });
 const matchingPorts=[...(network?.ports??[])].filter(p=>
  !normalizedQuery||p.name.toLowerCase().includes(normalizedQuery))
  .sort((a,b)=>Number(discovered.has(b.id))-Number(discovered.has(a.id))||
   a.name.localeCompare(b.name));
 const visibleRoutes=showAll?filteredRoutes:filteredRoutes.slice(0,35);
 const visiblePorts=showAll?matchingPorts:matchingPorts.slice(0,45);
 const reloadData=async()=>{
  if(reloading)return;
  setReloading(true);setError('');setLastReloaded('');
  try{await onReloadNetwork();setLastReloaded('Harbour and route data refreshed');}
  catch(e){setError(`Reload failed: ${String(e)}`);}
  finally{setReloading(false);}
 };
 const portCard=(port:FerryPort)=>{
  const unlocked=discovered.has(port.id);
  const connections=(network?.routes??[]).filter(r=>r.from===port.id||r.to===port.id);
  const incoming=connections.some(r=>purchased.has(r.id)&&!unlocked);
  return <article className="ferry-port-card" key={port.id}>
   <span className={'ferry-port-symbol '+(unlocked?'is-discovered':'')}>{unlocked?<Anchor size={22}/>:<LockKeyhole size={20}/>}</span>
   <div className="ferry-port-copy"><strong>{port.name}</strong><small>{connections.length} connection{connections.length===1?'':'s'}</small></div>
   <span className={'ferry-state '+(unlocked?'is-unlocked':incoming?'is-approaching':'is-locked')}>
    {unlocked?<><CheckCircle2 size={14}/> Discovered</>:incoming?'Unlock on arrival':<><LockKeyhole size={13}/> Locked</>}
   </span>
  </article>;
 };
 return <section className="ferry-routes-panel">
  <header className="ferry-hero">
   <div className="ferry-hero-identity"><span className="ferry-hero-symbol"><Ship size={23}/></span>
    <div><h2>Ferries</h2><p>Routes &amp; services</p></div>
   </div>
  </header>
  <nav className="ferry-tabs" aria-label="Ferries sections">
   {([['routes','Routes',ArrowLeftRight],['harbours','Harbours',Anchor],['fleet','Fleet',Ship]] as const).map(([key,label,Icon])=>
    <button key={key} type="button" className={tab===key?'active':''} aria-current={tab===key?'page':undefined} onClick={()=>{setTab(key);setShowAll(false);setQuery('')}}><Icon size={19}/><span>{tab===key?label:''}</span></button>)}
  </nav>
  <div className="ferry-mini-summary" aria-label="Ferry operations summary">
   <span><strong>{boughtRoutes.length}</strong> routes</span>
   <span><strong>{sailing}</strong> sailing</span>
   <span><strong>{euros(todayReceipts)}</strong> today</span>
  </div>
  {error&&<p className="ferry-alert" role="alert">{error}</p>}
  {lastReloaded&&<p role="status" className="ferry-reload-status">{lastReloaded}</p>}
  <div className="ferry-toolbar">
   <label className="ferry-search"><Search size={17}/><input value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false)}} placeholder={tab==='harbours'?'Search harbours':'Search ferry routes'} aria-label={tab==='harbours'?'Search harbours':'Search ferry routes'}/></label>
   <button type="button" className="ferry-reload" aria-label={reloading?'Refreshing ferry data':'Refresh ferry data'} title="Refresh ferry data" disabled={reloading} onClick={()=>{void reloadData()}}><RefreshCw size={17}/></button>
  </div>
  {tab==='routes'&&<>
   <div className="ferry-route-filters" role="group" aria-label="Filter ferry routes by ownership">
    {([['all','All routes',eligibleRoutes.length],['unowned','Unowned',eligibleRoutes.length-boughtRoutes.length],['purchased','Purchased',boughtRoutes.length]] as const).map(([filter,label,count])=>
     <button key={filter} type="button" className={routeFilter===filter?'active':''} aria-pressed={routeFilter===filter}
      onClick={()=>{setRouteFilter(filter);setShowAll(false)}}>
      {label}<span>{count}</span>
     </button>)}
   </div>
   <div className="ferry-section-heading"><div><h3>Connections</h3></div><span>{filteredRoutes.length} routes</span></div>
   {visibleRoutes.length===0&&<div className="ferry-empty"><Anchor size={25}/><strong>{network?(routeFilter==='unowned'?'No unowned routes match your filters':routeFilter==='purchased'?'No purchased routes match your filters':'No routes currently available'):'Loading ferry network…'}</strong><p>{routeFilter==='purchased'?'Purchase a route from the Unowned filter to start ferry operations.':'Discover a harbour access road or reach a destination by ferry to reveal more routes.'}</p></div>}
   <div className="ferry-routes-grid">{visibleRoutes.map(route=>{
    const owned=purchased.has(route.id),origin=orientation(route),from=displayName(ports.get(origin.from),origin.from),to=displayName(ports.get(origin.to),origin.to);
    const phase=owned?service(route):null;
    const goingBack=phase?.direction==='return';
    const originName=goingBack?to:from,destinationName=goingBack?from:to;
    const progress=phase?(phase.phase==='sailing'?phase.progress:phase.phase==='turnaround'?1:0):0;
    const fare=company?.ferryTicketPrices?.[route.id]??standardFerryFare(route.durationMinutes);
    const start=company?.ferryServiceStartedAt?.[route.id];
    const departure=owned&&typeof start==='number'&&Number.isFinite(start)?
     ferryForecastDeparture(start,route.durationMinutes,gameNow):gameNow;
    const quote=ferryVoyageEconomics(route.durationMinutes,departure,fare);
    const estimatedPassengers=quote.passengers;
    const price=ferryRoutePrice(route.id),accessible=discovered.has(route.from)||discovered.has(route.to);
    const phaseText=phase?.phase==='sailing'?'En route':phase?.phase==='turnaround'?'Docked · turnaround':phase?'Boarding':'Not started';
    return <article className="ferry-route-card" key={route.id}>
     <div className="ferry-route-top">
      <span className="ferry-card-icon"><Ship size={20}/></span>
      <div className="ferry-route-name"><strong>{from} <ArrowLeftRight size={13} aria-label="and"/> {to}</strong><small>{minuteText(route.durationMinutes)} crossing</small></div>
      <span className={'ferry-state '+(owned?'is-unlocked':'is-locked')}>{owned?phaseText:'Unowned'}</span>
     </div>
     {owned&&phase?.phase==='sailing'&&<div className="ferry-mini-progress" aria-label={`Sailing progress ${Math.round(progress*100)}%`}><div style={{width:`${progress*100}%`}}/></div>}
     <div className="ferry-route-bottom">
      <div><small>{owned?'Fare':'Route price'}</small><strong>{owned?`€${fare.toFixed(2)}`:euros(price)}</strong></div>
      {!owned&&<button type="button" className="ferry-buy" disabled={!company||company.cash<price||!accessible} onClick={()=>onPurchase(route.id,price)}>{!company?'Create company':!accessible?'Discover harbour':company.cash<price?'Not enough funds':'Buy route'}</button>}
      {owned&&<span className="ferry-route-owned"><CheckCircle2 size={14}/> Owned</span>}
     </div>
     <details className="ferry-route-expanded">
      <summary>Route details <ChevronDown size={15}/></summary>
      <div className="ferry-route-expanded-content">
       {owned&&<div className="ferry-route-progress">
        <div className="ferry-route-terminals"><div><MapPin size={14}/><strong>{originName}</strong></div><div><MapPin size={14}/><strong>{destinationName}</strong></div></div>
        <div className="ferry-progress-line"><div className="ferry-progress-fill" style={{width:`${progress*100}%`}}/><span className="ferry-progress-boat" style={{left:`${Math.max(3,Math.min(97,progress*100))}%`}}><Ship size={18}/></span></div>
        <div className="ferry-journey-caption">{phase?.phase==='sailing'?`About ${minuteText(route.durationMinutes*(1-phase.progress))} remaining (game time)`:phase?.phase==='turnaround'?'Docked · preparing return trip':'Waiting for departure'}</div>
       </div>}
       <div className="ferry-route-details">
        <div><Ticket size={15}/><span>Fare</span><strong>€{fare.toFixed(2)}</strong></div>
        <div><Clock3 size={15}/><span>Crossing</span><strong>{minuteText(route.durationMinutes)}</strong></div>
        <div><UsersRound size={15}/><span>Est. passengers</span><strong>{estimatedPassengers}/{quote.capacity}</strong></div>
        <div><UsersRound size={15}/><span>Est. occupancy</span><strong>{Math.round(quote.occupancy*100)}%</strong></div>
        <div><Ticket size={15}/><span>Operating cost</span><strong>{euros(quote.cost)}</strong></div>
        <div><TrendingUp size={15}/><span>Est. net / crossing</span><strong>{euros(quote.net)}</strong></div>
       </div>
       {owned&&<div className="ferry-fare-control"><label htmlFor={'ferry-fare-'+route.id}><span>Ticket price</span><strong>€{fare.toFixed(2)}</strong></label><input id={'ferry-fare-'+route.id} type="range" min="1" max="100" step="0.5" value={Math.max(1,Math.min(100,Math.round(fare*2)/2))} onChange={e=>onTicketPriceChange(route.id,Number(e.target.value))}/><small>Estimated revenue {euros(quote.revenue)} · net {euros(quote.net)} before research bonuses and bank deductions.</small></div>}
      </div>
     </details>
    </article>;
   })}</div>
   {filteredRoutes.length>visibleRoutes.length&&<button type="button" className="ferry-show-more" onClick={()=>setShowAll(true)}>Show all {filteredRoutes.length} connections</button>}

  </>}
  {tab==='harbours'&&<>
   <div className="ferry-section-heading"><div><h3>Harbours</h3></div><span>{discovered.size} discovered</span></div>
   <div className="ferry-harbour-grid">{visiblePorts.map(portCard)}</div>
   {matchingPorts.length===0&&<div className="ferry-empty">No harbours match this search.</div>}
   {matchingPorts.length>visiblePorts.length&&<button type="button" className="ferry-show-more" onClick={()=>setShowAll(true)}>Show all {matchingPorts.length} harbours</button>}

  </>}
  {tab==='fleet'&&<>
   <div className="ferry-section-heading"><div><h3>My ferries</h3></div><span>{boughtRoutes.length} services</span></div>
   {boughtRoutes.length===0&&<div className="ferry-empty"><Ship size={26}/><strong>No ferries in service</strong><p>Purchase a ferry connection in Routes to start its automatic service.</p><button type="button" onClick={()=>setTab('routes')}>Browse routes</button></div>}
   <div className="ferry-fleet-grid">{boughtRoutes.filter(r=>!normalizedQuery||`${r.name??''} ${displayName(ports.get(r.from),r.from)} ${displayName(ports.get(r.to),r.to)}`.toLowerCase().includes(normalizedQuery)).map(route=>{
    const phase=service(route),orientationIds=orientation(route);
    const origin=phase?.direction==='return'?orientationIds.to:orientationIds.from;
    const destination=phase?.direction==='return'?orientationIds.from:orientationIds.to;
    return <article className="ferry-fleet-card" key={route.id}><div className="ferry-fleet-icon"><Ship size={31}/></div><div><strong>{displayName(ports.get(origin),origin)} → {displayName(ports.get(destination),destination)}</strong><small>{route.id} · {minuteText(route.durationMinutes)} crossing</small></div><span className={'ferry-state '+(phase?.phase==='sailing'?'is-unlocked':'is-approaching')}>{phase?.phase==='sailing'?'Sailing':phase?.phase==='turnaround'?'In harbour':'Boarding'}</span><div className="ferry-fleet-foot"><span><TrendingUp size={16}/> Automatic ticket revenue</span><span>Progress {Math.round((phase?.progress??0)*100)}%</span></div></article>;
   })}</div>
  </>}
 </section>;
}
