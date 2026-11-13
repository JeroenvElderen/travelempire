import {useMemo,useState} from 'react';
import {Anchor,ArrowLeftRight,CheckCircle2,Clock3,Coins,Compass,LockKeyhole,MapPin,RefreshCw,Search,Ship,Ticket,TrendingUp,UsersRound,Waves} from 'lucide-react';
import type {Company,Headquarters} from '../company';
import type {FerryNetwork,FerryRoute,FerryPort} from '../maritime/ferries';
import {ferryRoutePrice} from '../maritime/routePlanning';
import {ferryPhase} from '../maritime/ferryService';
import './ferry-routes.css';

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
const expectedFare=(duration:number)=>4+Math.max(10,Math.min(240,duration))*0.16;
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
   <div className="ferry-port-copy"><strong>{port.name}</strong><small>{connections.length} ferry connection{connections.length===1?'':'s'} · {port.position[1].toFixed(3)}°, {port.position[0].toFixed(3)}°</small></div>
   <span className={'ferry-state '+(unlocked?'is-unlocked':incoming?'is-approaching':'is-locked')}>
    {unlocked?<><CheckCircle2 size={14}/> Discovered</>:incoming?'Unlock on arrival':<><LockKeyhole size={13}/> Locked</>}
   </span>
  </article>;
 };
 return <section className="ferry-routes-panel">
  <header className="ferry-hero">
   <div className="ferry-hero-identity"><span className="ferry-hero-symbol"><Ship size={30}/></span>
    <div><span className="ferry-overline">TRAVELEMPIRE · MARITIME OPERATIONS</span><h2>Ferries</h2><p>Routes, harbours and fleet activity across Greece</p></div>
   </div>
   <div className="ferry-hero-decoration"><Waves size={100} strokeWidth={.8}/><Ship size={62} strokeWidth={1}/></div>
  </header>
  <nav className="ferry-tabs" aria-label="Ferries sections">
   {([['routes','Routes',ArrowLeftRight],['harbours','Harbours',Anchor],['fleet','Fleet',Ship]] as const).map(([key,label,Icon])=>
    <button key={key} type="button" className={tab===key?'active':''} aria-current={tab===key?'page':undefined} onClick={()=>{setTab(key);setShowAll(false);setQuery('')}}><Icon size={19}/>{label}</button>)}
  </nav>
  <div className="ferry-stats">
   <article><Ship size={22}/><strong>{boughtRoutes.length}</strong><span>Purchased routes</span></article>
   <article><Anchor size={22}/><strong>{discovered.size} / {network?.ports.length??0}</strong><span>Discovered harbours</span></article>
   <article><Coins size={22}/><strong>{euros(todayReceipts)}</strong><span>Today's ferry receipts</span></article>
   <article><Waves size={22}/><strong>{sailing}</strong><span>Currently sailing</span></article>
  </div>
  {error&&<p className="ferry-alert" role="alert">{error}</p>}
  {lastReloaded&&<p role="status" className="ferry-reload-status">{lastReloaded}</p>}
  <div className="ferry-toolbar">
   <label className="ferry-search"><Search size={17}/><input value={query} onChange={e=>{setQuery(e.target.value);setShowAll(false)}} placeholder={tab==='harbours'?'Search harbours':'Search ferry routes'} aria-label={tab==='harbours'?'Search harbours':'Search ferry routes'}/></label>
   <button type="button" className="ferry-reload" disabled={reloading} onClick={()=>{void reloadData()}}><RefreshCw size={16}/>{reloading?'Refreshing…':'Refresh data'}</button>
  </div>
  {tab==='routes'&&<>
   <div className="ferry-route-filters" role="group" aria-label="Filter ferry routes by ownership">
    {([['all','All routes',eligibleRoutes.length],['unowned','Unowned',eligibleRoutes.length-boughtRoutes.length],['purchased','Purchased',boughtRoutes.length]] as const).map(([filter,label,count])=>
     <button key={filter} type="button" className={routeFilter===filter?'active':''} aria-pressed={routeFilter===filter}
      onClick={()=>{setRouteFilter(filter);setShowAll(false)}}>
      {label}<span>{count}</span>
     </button>)}
   </div>
   <div className="ferry-section-heading"><div><h3>Ferry connections</h3><p>Buy a route once to operate one automatic ferry in both directions.</p></div><span>{filteredRoutes.length} available</span></div>
   {visibleRoutes.length===0&&<div className="ferry-empty"><Anchor size={25}/><strong>{network?(routeFilter==='unowned'?'No unowned routes match your filters':routeFilter==='purchased'?'No purchased routes match your filters':'No routes currently available'):'Loading ferry network…'}</strong><p>{routeFilter==='purchased'?'Purchase a route from the Unowned filter to start ferry operations.':'Discover a harbour access road or reach a destination by ferry to reveal more routes.'}</p></div>}
   <div className="ferry-routes-grid">{visibleRoutes.map(route=>{
    const owned=purchased.has(route.id),origin=orientation(route),from=displayName(ports.get(origin.from),origin.from),to=displayName(ports.get(origin.to),origin.to);
    const phase=owned?service(route):null;
    const goingBack=phase?.direction==='return';
    const originName=goingBack?to:from,destinationName=goingBack?from:to;
    const progress=phase?(phase.phase==='sailing'?phase.progress:phase.phase==='turnaround'?1:0):0;
    const fare=company?.ferryTicketPrices?.[route.id]??expectedFare(route.durationMinutes);
    const base=expectedFare(route.durationMinutes);
    const estimatedPassengers=Math.min(90,Math.max(0,Math.round((12+Math.min(55,route.durationMinutes*.22))*Math.max(.2,Math.min(1.8,Math.pow(fare/base,-.75))))));
    const price=ferryRoutePrice(route.id),accessible=discovered.has(route.from)||discovered.has(route.to);
    const phaseText=phase?.phase==='sailing'?'En route':phase?.phase==='turnaround'?'Docked · turnaround':phase?'Boarding':'Not started';
    return <article className="ferry-route-card" key={route.id}>
     <div className="ferry-route-top"><span className="ferry-card-icon"><Ship size={23}/></span><div className="ferry-route-name"><strong>{from} <ArrowLeftRight size={16} aria-label="and"/> {to}</strong><small>{route.name??'Aegean ferry connection'} · {route.id}</small></div><span className={'ferry-state '+(owned?'is-unlocked':'is-locked')}>{owned?<><span className="ferry-green-dot"/> {phaseText}</>:'Available'}</span></div>
     <div className="ferry-route-progress">
      <div className="ferry-route-terminals"><div><MapPin size={16}/><strong>{originName}</strong><span>{goingBack?'Return departure':'Departure'}</span></div><div><MapPin size={16}/><strong>{destinationName}</strong><span>{discovered.has(goingBack?origin.from:origin.to)?'Discovered':'Unlock on arrival'}</span></div></div>
      <div className="ferry-progress-line"><div className="ferry-progress-fill" style={{width:`${progress*100}%`}}/><span className="ferry-progress-boat" style={{left:`${Math.max(3,Math.min(97,progress*100))}%`}}><Ship size={22}/></span></div>
      <div className="ferry-journey-caption"><Clock3 size={14}/>{phase?.phase==='sailing'?`About ${minuteText(route.durationMinutes*(1-phase.progress))} remaining (game time)`:phase?.phase==='turnaround'?'Arrived at destination · preparing next sailing':owned?'Waiting for departure':'Purchase to start automatic sailings'}</div>
     </div>
     <div className="ferry-route-details"><div><Ticket size={17}/><span>Ticket fare</span><strong>€{fare.toFixed(2)}</strong></div><div><Clock3 size={17}/><span>Crossing time</span><strong>{minuteText(route.durationMinutes)}</strong></div><div><UsersRound size={17}/><span>Est. passengers</span><strong>{estimatedPassengers}</strong></div></div>
     {owned&&<div className="ferry-fare-control"><label htmlFor={'ferry-fare-'+route.id}><span>Passenger ticket price</span><strong>€{fare.toFixed(2)}</strong></label><input id={'ferry-fare-'+route.id} type="range" min="1" max="100" step="0.5" value={Math.max(1,Math.min(100,Math.round(fare*2)/2))} onChange={e=>onTicketPriceChange(route.id,Number(e.target.value))}/><small>Estimated ticket income per crossing: {euros(estimatedPassengers*fare)} before operating costs.</small></div>}
     <footer><span>{owned?'Route purchased':euros(price)}</span>{!owned&&<button type="button" disabled={!company||company.cash<price||!accessible} onClick={()=>onPurchase(route.id,price)}>{!company?'Create a company':!accessible?'Discover a harbour':company.cash<price?'Insufficient funds':'Buy route'}</button>}{owned&&<span className="ferry-owned-label"><CheckCircle2 size={16}/> Automatic service active</span>}</footer>
    </article>;
   })}</div>
   {filteredRoutes.length>visibleRoutes.length&&<button type="button" className="ferry-show-more" onClick={()=>setShowAll(true)}>Show all {filteredRoutes.length} connections</button>}
   <div className="ferry-discovery-panel"><span><Compass size={25}/></span><div><strong>Harbours unlock when your ferry docks</strong><p>Purchased ferries sail automatically. When a boat reaches its destination, that harbour becomes permanently discovered and its connecting routes become available. Return trips unlock their destination too.</p></div></div>
  </>}
  {tab==='harbours'&&<>
   <div className="ferry-section-heading"><div><h3>Harbour network</h3><p>Unlock terminals by road exploration or by docking a ferry.</p></div><span>{discovered.size} discovered</span></div>
   <div className="ferry-harbour-grid">{visiblePorts.map(portCard)}</div>
   {matchingPorts.length===0&&<div className="ferry-empty">No harbours match this search.</div>}
   {matchingPorts.length>visiblePorts.length&&<button type="button" className="ferry-show-more" onClick={()=>setShowAll(true)}>Show all {matchingPorts.length} harbours</button>}
   <div className="ferry-discovery-panel"><span><Anchor size={25}/></span><div><strong>Expand your maritime empire</strong><p>Ferries unlock their actual arrival harbour when they dock. Already discovered harbours remain available after a reload.</p></div></div>
  </>}
  {tab==='fleet'&&<>
   <div className="ferry-section-heading"><div><h3>Automatic ferry fleet</h3><p>One service vessel operates every purchased route, alternating outward and return sailings.</p></div><span>{boughtRoutes.length} vessels</span></div>
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
