import {useEffect,useState} from 'react';
import type {Company} from '../company';
import type {FerryNetwork} from '../maritime/ferries';
import {loadFerryNetwork} from '../maritime/ferries';
import {ferryRoutePrice} from '../maritime/routePlanning';
import './ferry-routes.css';

export default function FerryRoutesPanel({company,onPurchase}:{company:Company|null;onPurchase:(routeId:string,price:number)=>void}){
 const [network,setNetwork]=useState<FerryNetwork|null>(null);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;loadFerryNetwork().then(value=>{if(active)setNetwork(value)}).catch(e=>{if(active)setError(String(e))});return()=>{active=false}},[]);
 const ports=new Map(network?.ports.map(p=>[p.id,p.name])??[]);
 const owned=new Set(company?.purchasedFerryRouteIds??[]);
 return <section className="ferry-routes-panel"><div className="ferry-routes-heading"><div><span>MARITIME NETWORK · V2.2.2</span><h2>Ferry Connections</h2><p>Purchase each route once to unlock travel in both directions for all your vehicles.</p></div><strong>From €2,000 / route</strong></div>
 {error&&<p role="alert">Ferry data could not be loaded: {error}</p>}
 {network&&network.routes.length===0&&<div className="ferry-empty"><strong>No ferry routes imported yet</strong><p>Real ferry route data must be added before connections can be purchased or used. Your existing vehicles continue operating normally.</p></div>}
 <div className="ferry-routes-grid">{network?.routes.map(r=>{const price=ferryRoutePrice(r.id),purchased=owned.has(r.id);return <article key={r.id} className="ferry-route-card"><span>⛴️ {r.name||'Ferry connection'}</span><h3>{ports.get(r.from)||r.from} ↔ {ports.get(r.to)||r.to}</h3><p>{r.durationMinutes} min crossing · all vehicle types</p><footer><strong>{purchased?'Purchased':new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(price)}</strong><button disabled={purchased||!company||company.cash<price} onClick={()=>onPurchase(r.id,price)}>{purchased?'Unlocked':!company?'Create company':company.cash<price?'Insufficient funds':'Purchase route'}</button></footer></article>})}</div>
 </section>;
}
