import {useEffect,useMemo,useState} from 'react';
import type {Company} from '../company';
import type {FerryNetwork} from '../maritime/ferries';
import {loadFerryNetwork} from '../maritime/ferries';
import {ferryRoutePrice} from '../maritime/routePlanning';
import './ferry-routes.css';

export default function FerryRoutesPanel({company,onPurchase,onTicketPriceChange,unlockedHarbourIds}:{company:Company|null;onPurchase:(routeId:string,price:number)=>void;onTicketPriceChange:(routeId:string,fare:number)=>void;unlockedHarbourIds:string[]}){
 const [network,setNetwork]=useState<FerryNetwork|null>(null);
 const [error,setError]=useState('');
 const [reloading,setReloading]=useState(false);
 const [lastReloaded,setLastReloaded]=useState('');
 useEffect(()=>{let active=true;loadFerryNetwork().then(value=>{if(active)setNetwork(value)}).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[]);
 const reloadData=async()=>{
  if(reloading)return;
  setReloading(true);setError('');setLastReloaded('');
  try{
   const latest=await loadFerryNetwork(undefined,true);
   setNetwork(latest);
   setLastReloaded(`Updated: ${latest.routes.length} routes loaded`);
  }catch(e){setError(`Reload failed: ${String(e)}`);}
  finally{setReloading(false);}
 };
 const discoveredPorts=useMemo(()=>new Set(unlockedHarbourIds),[unlockedHarbourIds]);
 const owned=useMemo(()=>new Set(company?.purchasedFerryRouteIds??[]),[company?.purchasedFerryRouteIds]);
 // An owned route must remain manageable even if its mapped terminal road
 // temporarily disappears from the loaded road graph.
 const sortedRoutes=useMemo(()=>[...(network?.routes??[])].filter(r=>
  owned.has(r.id)||discoveredPorts.has(r.from)||discoveredPorts.has(r.to))
  .sort((a,b)=>Number(owned.has(b.id))-Number(owned.has(a.id))||(a.name??'').localeCompare(b.name??'')),
  [network,discoveredPorts,owned]);
 const ports=new Map(network?.ports.map(p=>[p.id,p.name])??[]);
 return <section className="ferry-routes-panel"><div className="ferry-routes-heading"><div><span>MARITIME NETWORK · V2.2.2</span><h2>Ferry Connections</h2><p>Purchase each route once to unlock travel in both directions for all your vehicles.</p></div><strong>From €250,000 / route</strong></div>
 {error&&<p role="alert">Ferry data could not be loaded: {error}</p>}
 {network&&network.routes.length===0&&<div className="ferry-empty"><strong>No ferry routes imported yet</strong><p>Real ferry route data must be added before connections can be purchased or used. Your existing vehicles continue operating normally.</p></div>}
 <div className="ferry-route-tools"><strong aria-live="polite">{network?`${sortedRoutes.filter(r=>!owned.has(r.id)).length.toLocaleString('en-IE')} available routes · ${owned.size} purchased`:'Loading ferry routes…'}</strong><button type="button" disabled={reloading} onClick={()=>{void reloadData()}}>{reloading?'Reloading…':'↻ Reload data'}</button></div>
 {lastReloaded&&<p role="status" className="ferry-reload-status">{lastReloaded}</p>}
 {network&&network.routes.length>0&&sortedRoutes.length===0&&<div className="ferry-empty"><strong>No ferry connections discovered yet</strong><p>Explore the nearest road to a harbour with an explorer vehicle. Its ferry connections will appear here once the harbour unlocks.</p></div>}
 <div className="ferry-routes-grid">{sortedRoutes.map(r=>{const price=ferryRoutePrice(r.id),purchased=owned.has(r.id),accessible=discoveredPorts.has(r.from)||discoveredPorts.has(r.to);return <article key={r.id} className="ferry-route-card"><span>⛴️ {(discoveredPorts.has(r.from)||discoveredPorts.has(r.to))?'📍 Discovered harbour · ':''}{r.name||'Ferry connection'}</span><h3>{ports.get(r.from)||r.from} ↔ {ports.get(r.to)||r.to}</h3><p>{r.durationMinutes} min {r.durationEstimated?'estimated ':''}crossing · all vehicle types</p>{purchased&&(()=>{const standardFare=4+Math.max(10,Math.min(240,r.durationMinutes))*0.16;const configured=company?.ferryTicketPrices?.[r.id];const fare=typeof configured==='number'&&Number.isFinite(configured)?configured:standardFare;const baseline=Math.round(12+Math.min(55,r.durationMinutes*0.22));const demandFactor=Math.max(0.2,Math.min(1.8,Math.pow(fare/standardFare,-0.75)));const passengers=Math.min(90,Math.max(0,Math.round(baseline*demandFactor)));return <div className="ferry-fare-control" style={{padding:'12px 0'}}><label htmlFor={'ferry-fare-'+r.id} style={{display:'flex',justifyContent:'space-between',gap:8}}><span>Passenger ticket price</span><strong>€{fare.toFixed(2)}</strong></label><input id={'ferry-fare-'+r.id} type="range" min="1" max="100" step="0.5" value={Math.max(1,Math.min(100,Math.round(fare*2)/2))} onChange={e=>onTicketPriceChange(r.id,Number(e.target.value))} style={{width:'100%'}}/><small>Estimated passengers / crossing: {passengers} · ticket revenue: €{(passengers*fare).toFixed(2)}</small></div>})()}<footer><strong>{purchased?'Purchased':new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(price)}</strong><button disabled={purchased||!company||company.cash<price||!accessible} onClick={()=>onPurchase(r.id,price)}>{purchased?'Unlocked':!company?'Create company':company.cash<price?'Insufficient funds':!accessible?'Discover harbour road':'Purchase route'}</button></footer></article>})}</div>
 </section>;
}
