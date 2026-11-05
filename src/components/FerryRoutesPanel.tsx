import {useEffect,useMemo,useState} from 'react';
import type {Company} from '../company';
import type {FerryNetwork} from '../maritime/ferries';
import {loadFerryNetwork} from '../maritime/ferries';
import {ferryRoutePrice} from '../maritime/routePlanning';
import './ferry-routes.css';

export default function FerryRoutesPanel({company,onPurchase,unlockedHarbourIds}:{company:Company|null;onPurchase:(routeId:string,price:number)=>void;unlockedHarbourIds:string[]}){
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
 const sortedRoutes=useMemo(()=>[...(network?.routes??[])].sort((a,b)=>{
  const score=(r:typeof a)=>Number(discoveredPorts.has(r.from)||discoveredPorts.has(r.to));
  return score(b)-score(a);
 }),[network,discoveredPorts]);
 const ports=new Map(network?.ports.map(p=>[p.id,p.name])??[]);
 const owned=new Set(company?.purchasedFerryRouteIds??[]);
 return <section className="ferry-routes-panel"><div className="ferry-routes-heading"><div><span>MARITIME NETWORK · V2.2.2</span><h2>Ferry Connections</h2><p>Purchase each route once to unlock travel in both directions for all your vehicles.</p></div><strong>From €2,000 / route</strong></div>
 {error&&<p role="alert">Ferry data could not be loaded: {error}</p>}
 {network&&network.routes.length===0&&<div className="ferry-empty"><strong>No ferry routes imported yet</strong><p>Real ferry route data must be added before connections can be purchased or used. Your existing vehicles continue operating normally.</p></div>}
 <div className="ferry-route-tools"><strong aria-live="polite">{network?`${network.routes.length.toLocaleString('en-IE')} routes available · ${owned.size} purchased`:'Loading ferry routes…'}</strong><button type="button" disabled={reloading} onClick={()=>{void reloadData()}}>{reloading?'Reloading…':'↻ Reload data'}</button></div>
 {lastReloaded&&<p role="status" className="ferry-reload-status">{lastReloaded}</p>}
 <div className="ferry-routes-grid">{sortedRoutes.map(r=>{const price=ferryRoutePrice(r.id),purchased=owned.has(r.id),accessible=discoveredPorts.has(r.from)||discoveredPorts.has(r.to);return <article key={r.id} className="ferry-route-card"><span>⛴️ {(discoveredPorts.has(r.from)||discoveredPorts.has(r.to))?'📍 Discovered harbour · ':''}{r.name||'Ferry connection'}</span><h3>{ports.get(r.from)||r.from} ↔ {ports.get(r.to)||r.to}</h3><p>{r.durationMinutes} min {r.durationEstimated?'estimated ':''}crossing · all vehicle types</p><footer><strong>{purchased?'Purchased':new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(price)}</strong><button disabled={purchased||!company||company.cash<price||!accessible} onClick={()=>onPurchase(r.id,price)}>{purchased?'Unlocked':!company?'Create company':company.cash<price?'Insufficient funds':!accessible?'Discover harbour road':'Purchase route'}</button></footer></article>})}</div>
 </section>;
}
