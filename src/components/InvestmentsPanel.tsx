import {useMemo,useState} from 'react';
import {Building2,CarFront,Hotel,Landmark,MapPin,Search} from 'lucide-react';
import type {InvestablePOI,PropertyPortfolio} from '../investments';
import {euro,ownership,propertyOperations,propertyValuationCents} from '../investments';
import {investmentLimitCents,selectedInvestmentCents,defaultInvestmentEuros,asEuros} from '../investmentAmounts';
import './InvestmentsPanel.css';

type Props={available:InvestablePOI[];portfolio:PropertyPortfolio;companyCash:number;gameNow:number;onInvest:(poi:InvestablePOI,euros:number)=>string|null;error:string};
export default function InvestmentsPanel({available,portfolio,companyCash,gameNow,onInvest,error}:Props){
 const [category,setCategory]=useState<'all'|'hotel'|'parking'>('all');
 const [filter,setFilter]=useState('');
 const [amounts,setAmounts]=useState<Record<string,string>>({});
 const [message,setMessage]=useState('');
 const holdings=Object.values(portfolio.holdings);
 const holdingsIds=new Set(holdings.map(h=>h.id));
 const entries=useMemo(()=>{
  const byId=new Map<string,InvestablePOI>();
  for(const item of available)if(item.kind==='hotel'||item.kind==='parking')byId.set(item.id,item);
  for(const item of holdings)if(!byId.has(item.id))byId.set(item.id,item);
  return [...byId.values()].filter(p=>(category==='all'||p.kind===category)&&(!filter||((p.name||'')+' '+p.id).toLowerCase().includes(filter.toLowerCase()))).sort((a,b)=>Number(holdingsIds.has(b.id))-Number(holdingsIds.has(a.id))||(a.name||'').localeCompare(b.name||'')).slice(0,160);
 },[available,portfolio,category,filter]);
 const invested=holdings.reduce((sum,h)=>sum+h.investedCents,0);
 const dividends=holdings.reduce((sum,h)=>sum+h.dividendsCents,0);
 const gameHour=Math.floor(gameNow/3600000);
 const expectedHourly=holdings.reduce((sum,h)=>sum+Math.round(propertyOperations(h,gameHour).netCents*ownership(h)),0);
 const forecast=(p:InvestablePOI,valuationCents:number,ownedCents:number,additionalCents:number)=>{
  const existingShare=Math.min(1,ownedCents/valuationCents);
  const newShare=Math.min(1,(ownedCents+additionalCents)/valuationCents);
  const hourEarnings=Array.from({length:24},(_,offset)=>{
   const result=propertyOperations({id:p.id,kind:p.kind,valuationCents},gameHour+offset);
   return result.netCents;
  });
  const dailyNet=hourEarnings.reduce((sum,value)=>sum+value,0);
  return {
   existingShare,newShare,additionalShare:newShare-existingShare,
   hourBefore:Math.round(hourEarnings[0]*existingShare),
   hourAfter:Math.round(hourEarnings[0]*newShare),
   dayAfter:Math.round(dailyNet*newShare),
   monthAfter:Math.round(dailyNet*newShare*30)
  };
 };
 const invest=(p:InvestablePOI,cents:number)=>{
  if(cents<=0)return;
  const problem=onInvest(p,cents/100);
  setMessage(problem??`Invested ${euro(cents)} in ${p.name||p.kind}`);
  // A successful purchase resets only this property's input to the
  // newly available amount; other POI sliders retain their selections.
  if(!problem)setAmounts(old=>{const next={...old};delete next[p.id];return next;});
 };
 const updateAmount=(id:string,value:string)=>
  setAmounts(old=>({...old,[id]:value}));
 return <section className="investment-page">
  <div className="investment-heading"><span className="eyebrow">PROPERTY INVESTMENT · LIVE OSM LOCATIONS</span><h1>Investments</h1><p>Buy fractional ownership in real hotel and parking POIs using the same company balance as your taxis. Own 100% by purchasing more shares over time.</p></div>
  <div className="investment-metrics">
   <article><span>OWNED PROPERTIES</span><strong>{holdings.length}</strong></article>
   <article><span>TOTAL INVESTED</span><strong>{euro(invested)}</strong></article>
   <article><span>PROJECTED HOURLY INCOME</span><strong>{euro(expectedHourly)}</strong></article>
   <article><span>DIVIDENDS EARNED</span><strong>{euro(dividends)}</strong></article>
  </div>
  <div className="investment-toolbar">
   <div className="investment-filters">
    {(['all','hotel','parking'] as const).map(kind=><button key={kind} type="button" className={category===kind?'active':''} onClick={()=>setCategory(kind)}>{kind==='all'?'All properties':kind==='hotel'?'Hotels':'Parking'}</button>)}
   </div>
   <label className="investment-search"><Search size={17}/><input placeholder="Search loaded properties" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
  </div>
  {(message||error)&&<p className="investment-feedback" role="status">{error||message}</p>}
  <div className="investment-properties">
   {entries.map(p=>{
    const owned=portfolio.holdings[p.id];
    const value=owned?.valuationCents??propertyValuationCents(p);
    const remaining=Math.max(0,value-(owned?.investedCents??0));
    const percent=ownership(owned)*100;
    const performance=propertyOperations({id:p.id,kind:p.kind,valuationCents:value},gameHour);
    const limit=investmentLimitCents(remaining,companyCash);
    const rawAmount=amounts[p.id]??defaultInvestmentEuros(limit);
    const charge=selectedInvestmentCents(rawAmount,limit);
    const projection=forecast(p,value,owned?.investedCents??0,charge);
    const canBuy=charge>0;
    const inputError=rawAmount.trim()!==''&&!canBuy&&limit>0;
    return <article className="investment-property" key={p.id}>
     <div className="investment-property-top"><span className="investment-property-icon">{p.kind==='hotel'?<Hotel size={23}/>:<CarFront size={23}/>}</span><div className="investment-property-name"><strong>{p.name|| (p.kind==='hotel'?'Unnamed hotel':'Parking facility')}</strong><span><MapPin size={12}/>{p.kind==='hotel'?'Hotel':'Parking'} · {p.position[1].toFixed(3)}°, {p.position[0].toFixed(3)}°</span></div><span className="investment-tag">{percent===100?'Fully owned':percent>0?'Part owned':'Available'}</span></div>
     <div className="investment-property-values"><div><small>PROPERTY VALUE</small><strong>{euro(value)}</strong></div><div><small>YOUR STAKE</small><strong>{percent.toFixed(2)}%</strong></div><div><small>YOUR HOURLY INCOME</small><strong>{euro(Math.round(performance.netCents*ownership(owned)))}</strong></div></div>
     <div className="investment-property-performance"><span>{p.kind==='hotel'?'Room occupancy':'Parking utilisation'} <strong>{performance.activityPercent}%</strong></span><span>Gross <strong>{euro(performance.grossCents)}/h</strong></span><span>Costs <strong>{euro(performance.costCents)}/h</strong></span><span>Net <strong>{euro(performance.netCents)}/h</strong></span></div>
     <div className="investment-poi-amount">
      <div className="investment-poi-amount-header"><label htmlFor={`invest-value-${p.id}`}>Investment amount</label><strong>{euro(charge)}</strong></div>
      <input className="investment-poi-slider" type="range"
       aria-label={`Choose investment for ${p.name||p.kind}`}
       min={limit>0?0.01:0} max={Math.max(0.01,limit/100)}
       step="any" value={canBuy?charge/100:Math.min(limit/100,0.01)}
       disabled={limit===0}
       onChange={e=>updateAmount(p.id,asEuros(Math.max(1,Math.min(limit,Math.round(Number(e.target.value)*100)))))}/>
      <div className="investment-poi-range"><span>€0.01</span><span>Max {euro(limit)}</span></div>
      <div className="investment-poi-entry">
       <span>Exact amount (€)</span>
       <input id={`invest-value-${p.id}`} type="number" inputMode="decimal"
        min="0.01" max={(limit/100).toFixed(2)} step="0.01"
        value={rawAmount} disabled={limit===0}
        onChange={e=>updateAmount(p.id,e.target.value)}
        aria-invalid={inputError} aria-describedby={`invest-limit-${p.id}`}/>
       <button type="button" disabled={limit===0} onClick={()=>updateAmount(p.id,asEuros(limit))}>Max</button>
      </div>
      <small id={`invest-limit-${p.id}`}>{limit===0?
       (remaining===0?'This property is fully owned':'No available cash'):
       inputError?'Enter an amount within your available cash and remaining shares':
       `${euro(remaining)} in shares available · ${euro(Math.round(companyCash*100))} company cash`}</small>
     </div>
     <div className="investment-preview">
      <div className="investment-preview-heading"><strong>Purchase preview</strong><small>For {euro(charge)} · simulated forecast</small></div>
      <div className="investment-preview-metrics">
       <div><span>ADDITIONAL STAKE</span><strong>+{(projection.additionalShare*100).toFixed(2)}%</strong></div>
       <div><span>OWNERSHIP AFTER</span><strong>{(projection.newShare*100).toFixed(2)}%</strong></div>
       <div><span>HOURLY INCOME AFTER</span><strong>{euro(projection.hourAfter)}</strong></div>
       <div><span>24-HOUR FORECAST</span><strong>{euro(projection.dayAfter)}</strong></div>
       <div><span>30-DAY FORECAST</span><strong>{euro(projection.monthAfter)}</strong></div>
       <div><span>EXTRA PER HOUR</span><strong>+{euro(Math.max(0,projection.hourAfter-projection.hourBefore))}</strong></div>
      </div>
      <small>Projections are not guaranteed. Forecast assumes the displayed ownership stays constant and uses current simulated seasonal demand.</small>
     </div>
     <div className="investment-track"><span style={{width:`${percent}%`}}/></div>
     <div className="investment-property-bottom"><span>{euro(owned?.investedCents??0)} invested · {euro(remaining)} remaining · {euro(owned?.dividendsCents??0)} earned</span><button type="button" disabled={!canBuy} onClick={()=>invest(p,charge)}>{remaining<=0?'100% Owned':limit===0?'Insufficient cash':!canBuy?'Choose amount':`Invest ${euro(charge)}`}</button></div>
    </article>;
   })}
  </div>
  {entries.length===0&&<div className="investment-empty"><Building2 size={28}/><strong>No properties loaded yet</strong><p>Hotels and parking facilities come from the existing rest-stop POI tiles around headquarters and your active vehicles. As new areas load, their properties appear here.</p></div>}
  <p className="investment-disclaimer"><Landmark size={15}/> Valuations and dividends are in-game estimates, not real property prices. Dividends settle once per simulated hour, with a 30-day catch-up limit. Occupancy and utilisation vary with season and time.</p>
 </section>;
}
