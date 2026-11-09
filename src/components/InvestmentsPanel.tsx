import {useMemo,useState} from 'react';
import {Building2,CarFront,Coins,Hotel,Landmark,MapPin,Search} from 'lucide-react';
import type {InvestablePOI,PropertyPortfolio} from '../investments';
import {euro,ownership,propertyValuationCents} from '../investments';
import './InvestmentsPanel.css';

type Props={available:InvestablePOI[];portfolio:PropertyPortfolio;companyCash:number;onInvest:(poi:InvestablePOI,euros:number)=>string|null;error:string};
export default function InvestmentsPanel({available,portfolio,companyCash,onInvest,error}:Props){
 const [category,setCategory]=useState<'all'|'hotel'|'parking'>('all');
 const [filter,setFilter]=useState('');
 const [amount,setAmount]=useState(15000);
 const [message,setMessage]=useState('');
 const holdings=Object.values(portfolio.holdings);
 const holdingsIds=new Set(holdings.map(h=>h.id));
 const entries=useMemo(()=>{
  const byId=new Map<string,InvestablePOI>();
  for(const item of available)if(item.kind==='hotel'||item.kind==='parking')byId.set(item.id,item);
  for(const item of holdings)if(!byId.has(item.id))byId.set(item);
  return [...byId.values()].filter(p=>(category==='all'||p.kind===category)&&(!filter||((p.name||'')+' '+p.id).toLowerCase().includes(filter.toLowerCase()))).sort((a,b)=>Number(holdingsIds.has(b.id))-Number(holdingsIds.has(a.id))||(a.name||'').localeCompare(b.name||'')).slice(0,160);
 },[available,portfolio,category,filter]);
 const invested=holdings.reduce((sum,h)=>sum+h.investedCents,0);
 const dividends=holdings.reduce((sum,h)=>sum+h.dividendsCents,0);
 const expectedDaily=holdings.reduce((sum,h)=>sum+h.investedCents*(h.kind==='hotel'?0.0006:0.00035),0);
 const invest=(p:InvestablePOI,remainingCents:number)=>{
  const euros=Math.min(amount,Math.round(remainingCents/100));
  if(euros<=0)return;
  const problem=onInvest(p,euros);
  setMessage(problem??`Invested ${euro(euros*100)} in ${p.name||p.kind}`);
 };
 return <section className="investment-page">
  <div className="investment-heading"><span className="eyebrow">PROPERTY INVESTMENT · LIVE OSM LOCATIONS</span><h1>Investments</h1><p>Buy fractional ownership in real hotel and parking POIs using the same company balance as your taxis. Own 100% by purchasing more shares over time.</p></div>
  <div className="investment-metrics">
   <article><span>OWNED PROPERTIES</span><strong>{holdings.length}</strong></article>
   <article><span>TOTAL INVESTED</span><strong>{euro(invested)}</strong></article>
   <article><span>DAILY DIVIDEND EST.</span><strong>{euro(expectedDaily)}</strong></article>
   <article><span>DIVIDENDS EARNED</span><strong>{euro(dividends)}</strong></article>
  </div>
  <div className="investment-toolbar">
   <div className="investment-filters">
    {(['all','hotel','parking'] as const).map(kind=><button key={kind} type="button" className={category===kind?'active':''} onClick={()=>setCategory(kind)}>{kind==='all'?'All properties':kind==='hotel'?'Hotels':'Parking'}</button>)}
   </div>
   <label className="investment-search"><Search size={17}/><input placeholder="Search loaded properties" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
  </div>
  <div className="investment-amount"><span>Investment amount</span><div>{[5000,15000,50000,100000].map(value=><button key={value} type="button" onClick={()=>setAmount(value)} className={amount===value?'active':''}>{euro(value*100)}</button>)}</div><small>The final purchase is automatically limited to the remaining ownership. Income is simulated and may vary by game day.</small></div>
  {(message||error)&&<p className="investment-feedback" role="status">{error||message}</p>}
  <div className="investment-properties">
   {entries.map(p=>{
    const owned=portfolio.holdings[p.id];
    const value=owned?.valuationCents??propertyValuationCents(p);
    const remaining=Math.max(0,value-(owned?.investedCents??0));
    const percent=ownership(owned)*100;
    const charge=Math.min(amount*100,remaining);
    const canBuy=charge>0&&charge<=Math.max(0,Math.round(companyCash*100));
    return <article className="investment-property" key={p.id}>
     <div className="investment-property-top"><span className="investment-property-icon">{p.kind==='hotel'?<Hotel size={23}/>:<CarFront size={23}/>}</span><div className="investment-property-name"><strong>{p.name|| (p.kind==='hotel'?'Unnamed hotel':'Parking facility')}</strong><span><MapPin size={12}/>{p.kind==='hotel'?'Hotel':'Parking'} · {p.position[1].toFixed(3)}°, {p.position[0].toFixed(3)}°</span></div><span className="investment-tag">{percent===100?'Fully owned':percent>0?'Part owned':'Available'}</span></div>
     <div className="investment-property-values"><div><small>PROPERTY VALUE</small><strong>{euro(value)}</strong></div><div><small>YOUR STAKE</small><strong>{percent.toFixed(2)}%</strong></div><div><small>MONTHLY SHARE EST.</small><strong>{euro((owned?.investedCents??0)*(p.kind==='hotel'?0.0006:0.00035)*30)}</strong></div></div>
     <div className="investment-track"><span style={{width:`${percent}%`}}/></div>
     <div className="investment-property-bottom"><span>{euro(owned?.investedCents??0)} invested · {euro(remaining)} remaining</span><button type="button" disabled={!canBuy} onClick={()=>invest(p,remaining)}>{remaining<=0?'100% Owned':charge>companyCash*100?'Insufficient cash':`Invest ${euro(charge)}`}</button></div>
    </article>;
   })}
  </div>
  {entries.length===0&&<div className="investment-empty"><Building2 size={28}/><strong>No properties loaded yet</strong><p>Hotels and parking facilities come from the existing rest-stop POI tiles around headquarters and your active vehicles. As new areas load, their properties appear here.</p></div>}
  <p className="investment-disclaimer"><Landmark size={15}/> Valuations and dividends are in-game estimates, not real property prices. Dividends accrue once per simulated day, with a 30-day catch-up limit.</p>
 </section>;
}
