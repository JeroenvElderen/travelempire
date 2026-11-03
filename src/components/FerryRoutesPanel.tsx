import {useEffect,useMemo,useState} from 'react';
import type {RoadGraph} from '../simulation/taxi';
import type {Company} from '../company';
import type {FerryNetwork} from '../maritime/ferries';
import {loadFerryNetwork} from '../maritime/ferries';
import {ferryRoutePrice} from '../maritime/routePlanning';
import './ferry-routes.css';

export default function FerryRoutesPanel({company,onPurchase,graph,exploredEdgeIds}:{company:Company|null;onPurchase:(routeId:string,price:number)=>void;graph:RoadGraph|null;exploredEdgeIds:string[]}){
 const [network,setNetwork]=useState<FerryNetwork|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;loadFerryNetwork().then(value=>{if(active)setNetwork(value)}).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[]);
 const [discoveredPorts,setDiscoveredPorts]=useState<Set<string>>(()=>new Set());
 useEffect(()=>{
  setDiscoveredPorts(new Set());
  if(!network||!graph||!exploredEdgeIds.length)return;
  let cancelled=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const explored=new Set(exploredEdgeIds);
  const ports=network.ports;
  const discovered=new Set<string>();
  const iterator=graph.edges.entries();
  // Keep this out of the map render loop and yield between road batches.
  const step=()=>{
   if(cancelled)return;
   let count=0;
   while(count++<1000){
    const item=iterator.next();
    if(item.done){if(!cancelled)setDiscoveredPorts(new Set(discovered));return;}
    const [from,edges]=item.value;
    const a=graph.nodes.get(from);
    if(!a)continue;
    for(const edge of edges){
     if(!explored.has(edge.id))continue;
     const b=graph.nodes.get(edge.to);
     if(!b)continue;
     for(const port of ports){
      if(discovered.has(port.id))continue;
      const point=port.roadAccess??port.position;
      const dx=(a[0]-point[0])*111320*Math.cos(point[1]*Math.PI/180);
      const dy=(a[1]-point[1])*111320;
      const ex=(b[0]-point[0])*111320*Math.cos(point[1]*Math.PI/180);
      const ey=(b[1]-point[1])*111320;
      const vx=ex-dx,vy=ey-dy;
      const t=Math.max(0,Math.min(1,-(dx*vx+dy*vy)/(vx*vx+vy*vy||1)));
      if(Math.hypot(dx+t*vx,dy+t*vy)<=250)discovered.add(port.id);
     }
    }
   }
   timer=setTimeout(step,0);
  };
  timer=setTimeout(step,0);
  return()=>{cancelled=true;if(timer!==undefined)clearTimeout(timer)};
 },[network,graph,exploredEdgeIds]);
 const sortedRoutes=useMemo(()=>[...(network?.routes??[])].sort((a,b)=>{
  const score=(r:typeof a)=>Number(discoveredPorts.has(r.from)||discoveredPorts.has(r.to));
  return score(b)-score(a);
 }),[network,discoveredPorts]);
 const ports=new Map(network?.ports.map(p=>[p.id,p.name])??[]);
 const owned=new Set(company?.purchasedFerryRouteIds??[]);
 return <section className="ferry-routes-panel"><div className="ferry-routes-heading"><div><span>MARITIME NETWORK · V2.2.2</span><h2>Ferry Connections</h2><p>Purchase each route once to unlock travel in both directions for all your vehicles.</p></div><strong>From €2,000 / route</strong></div>
 {error&&<p role="alert">Ferry data could not be loaded: {error}</p>}
 {network&&network.routes.length===0&&<div className="ferry-empty"><strong>No ferry routes imported yet</strong><p>Real ferry route data must be added before connections can be purchased or used. Your existing vehicles continue operating normally.</p></div>}
 <div className="ferry-routes-grid">{sortedRoutes.map(r=>{const price=ferryRoutePrice(r.id),purchased=owned.has(r.id);return <article key={r.id} className="ferry-route-card"><span>⛴️ {(discoveredPorts.has(r.from)||discoveredPorts.has(r.to))?'📍 Discovered harbour · ':''}{r.name||'Ferry connection'}</span><h3>{ports.get(r.from)||r.from} ↔ {ports.get(r.to)||r.to}</h3><p>{r.durationMinutes} min crossing · all vehicle types</p><footer><strong>{purchased?'Purchased':new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(price)}</strong><button disabled={purchased||!company||company.cash<price} onClick={()=>onPurchase(r.id,price)}>{purchased?'Unlocked':!company?'Create company':company.cash<price?'Insufficient funds':'Purchase route'}</button></footer></article>})}</div>
 </section>;
}
