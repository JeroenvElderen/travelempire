import {useMemo,useState} from 'react';
import {Building2,CarFront,Hotel,Landmark,MapPin,Search} from 'lucide-react';
import type {InvestablePOI,PropertyPortfolio} from '../investments';
import {euro,ownership,propertyOperations,propertyValuationCents} from '../investments';
import {investmentLimitCents,selectedInvestmentCents,defaultInvestmentEuros,asEuros} from '../investmentAmounts';
import './InvestmentsPanel.css';
const exactEuro=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);

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
  setMessage(problem??`Invested ${exactEuro(cents)} in ${p.name||p.kind}`);
  // A successful purchase resets only this property's input to the
  // newly available amount; other POI sliders retain their selections.
  if(!problem)setAmounts(old=>{const next={...old};delete next[p.id];return next;});
 };
 const updateAmount=(id:string,value:string)=>
  setAmounts(old=>({...old,[id]:value}));
 return <section className="investment-page">
  <div className="investment-heading"><span className="eyebrow">PROPERTY INVESTMENT · LIVE OSM LOCATIONS</span><h1>Investments</h1><p>Invest in hotels with a fixed number of guest rooms or parking facilities with a fixed number of spaces. Every occupied room or space earns revenue; your ownership share determines your dividends.</p></div>
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
     <div className="investment-unit-economics">
      <div className="investment-unit-heading"><strong>{p.kind==='hotel'?'Hotel rooms':'Parking spaces'}</strong><small>Estimated operating capacity</small></div>
      <div className="investment-unit-summary">
       <div><small>TOTAL {p.kind==='hotel'?'ROOMS':'SPACES'}</small><strong>{performance.capacity}</strong></div>
       <div><small>{p.kind==='hotel'?'OCCUPIED ROOMS':'OCCUPIED SPACES'}</small><strong>{performance.occupiedUnits}</strong></div>
       <div><small>AVAILABLE</small><strong>{performance.vacantUnits}</strong></div>
      </div>
      <div className="investment-unit-track" role="progressbar" aria-label={p.kind==='hotel'?'Room occupancy':'Parking occupancy'} aria-valuenow={performance.occupiedUnits} aria-valuemin={0} aria-valuemax={performance.capacity}>
       <span style={{width:`${performance.activityPercent}%`}}/>
      </div>
      <div className="investment-unit-rate"><span>Occupancy <strong>{performance.activityPercent}%</strong></span><span>Rate <strong>{exactEuro(Math.round(performance.unitRateEuros*100))}/{p.kind==='hotel'?'night':'hour'}</strong></span></div>
      <div className="investment-unit-revenue">
       <span>Occupied {p.kind==='hotel'?'rooms':'spaces'} × {p.kind==='hotel'?'nightly':'hourly'} rate</span>
       <strong>{euro(performance.grossCents)} / hour gross</strong>
      </div>
      <div className="investment-unit-costs"><span>Fixed operating costs</span><strong>−{euro(performance.fixedCostCents)}/h</strong><span>Usage-based costs</span><strong>−{euro(performance.variableCostCents)}/h</strong></div>
      <div className="investment-unit-net"><span>Property net income</span><strong>{euro(performance.netCents)}/h</strong></div>
      <small className="investment-unit-note">Capacity and rates are gameplay estimates, not verified real-world room or parking-space counts. Hotel nightly revenue is spread over 24 game hours.</small>
     </div>
     <div className="investment-poi-amount">
      <div className="investment-poi-amount-header"><label htmlFor={`invest-value-${p.id}`}>Investment amount</label><strong>{exactEuro(charge)}</strong></div>
      <input className="investment-poi-slider" type="range"
       aria-label={`Choose investment for ${p.name||p.kind}`}
       min={limit>0?0.01:0} max={Math.max(0.01,limit/100)}
       step="any" value={canBuy?charge/100:Math.min(limit/100,0.01)}
       disabled={limit===0}
       onChange={e=>updateAmount(p.id,asEuros(Math.max(1,Math.min(limit,Math.round(Number(e.target.value)*100)))))}/>
      <div className="investment-poi-range"><span>€0.01</span><span>Max {exactEuro(limit)}</span></div>
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
      <div className="investment-preview-heading"><strong>Purchase preview</strong><small>For {exactEuro(charge)} · simulated forecast</small></div>
      <div className="investment-preview-metrics">
       <div><span>ADDITIONAL STAKE</span><strong>+{(projection.additionalShare*100).toFixed(2)}%</strong></div>
       <div><span>OWNERSHIP AFTER</span><strong>{(projection.newShare*100).toFixed(2)}%</strong></div>
       <div><span>HOURLY INCOME AFTER</span><strong>{euro(projection.hourAfter)}</strong></div>
       <div><span>24-HOUR FORECAST</span><strong>{euro(projection.dayAfter)}</strong></div>
       <div><span>30-DAY FORECAST</span><strong>{euro(projection.monthAfter)}</strong></div>
       <div><span>EXTRA PER HOUR</span><strong>+{euro(Math.max(0,projection.hourAfter-projection.hourBefore))}</strong></div>
      </div>
      <small>Forecast uses estimated room or space occupancy and unit prices over the next 24 game hours, less fixed and usage-based costs. Income is proportional to your projected ownership share.</small>
     </div>
     <div className="investment-track"><span style={{width:`${percent}%`}}/></div>
     <div className="investment-property-bottom"><span>{euro(owned?.investedCents??0)} invested · {euro(remaining)} remaining · {euro(owned?.dividendsCents??0)} earned</span><button type="button" disabled={!canBuy} onClick={()=>invest(p,charge)}>{remaining<=0?'100% Owned':limit===0?'Insufficient cash':!canBuy?'Choose amount':`Invest ${exactEuro(charge)}`}</button></div>
    </article>;
   })}
  </div>
  {entries.length===0&&<div className="investment-empty"><Building2 size={28}/><strong>No properties loaded yet</strong><p>Hotels and parking facilities come from the existing rest-stop POI tiles around headquarters and your active vehicles. As new areas load, their properties appear here.</p></div>}
  <p className="investment-disclaimer"><Landmark size={15}/> Physical capacity, rates, occupancy and valuations are deterministic gameplay estimates, not verified property information. Dividends are based on occupied rooms or parking spaces, calculated hourly, with a 30-day catch-up limit.</p>
 </section>;
}
