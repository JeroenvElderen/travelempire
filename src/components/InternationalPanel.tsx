import {useState} from 'react';
import type {FleetState} from '../simulation/taxi';
import type {Company} from '../company';
import {bankOf} from '../banking';
import {INTERNATIONAL_COUNTRIES,FOREIGN_MARKET,countryFor,internationalSnapshot,local} from '../international';
import {corporateOf,corporateCreditCapacity} from '../corporate';
type Props={company:Company;fleet:FleetState;onFound:(name:string,city:string,code:string,capital:number)=>void;onAcquire:(id:string,loanPercent:number)=>void;onTransfer:(id:string,amount:number,direction:'to'|'from')=>void;error:string};
const money=(n:number,currency='EUR')=>new Intl.NumberFormat('en-IE',{style:'currency',currency,maximumFractionDigits:2}).format(n);
export default function InternationalPanel({company,fleet,onFound,onAcquire,onTransfer,error}:Props){
 const [country,setCountry]=useState('IRL');
 const [name,setName]=useState('International Mobility');
 const [city,setCity]=useState('Dublin');
 const [capital,setCapital]=useState(15000);
 const [offer,setOffer]=useState<string>(FOREIGN_MARKET[0].id);
 const [loan,setLoan]=useState(0);
 const [subsidiary,setSubsidiary]=useState('');
 const [amount,setAmount]=useState(1000);
 const [direction,setDirection]=useState<'to'|'from'>('to');
 const state=corporateOf(fleet.corporate);
 const foreign=state.subsidiaries.filter(s=>s.active&&s.countryCode&&s.countryCode!=='GRC');
 const stats=internationalSnapshot(state);
 const selected=FOREIGN_MARKET.find(o=>o.id===offer)??FOREIGN_MARKET[0];
 const countryInfo=countryFor(country);
 const selectedSub=foreign.find(s=>s.id===subsidiary);
 const reserve=bankOf(fleet.bank).minimumOperatingCash;
 return <div className="corporate-panel">
  <div className="corporate-metrics"><article><small>FOREIGN SUBSIDIARIES</small><strong>{stats.foreignCount}</strong></article><article><small>COUNTRIES</small><strong>{stats.countries}</strong></article><article><small>FOREIGN CASH (EUR)</small><strong>{money(stats.foreignCashEUR)}</strong></article><article><small>30-DAY NET FORECAST</small><strong>{money(stats.forecast30DaysEUR)}</strong></article></div>
  <p className="corporate-note">International exchange rates and licensing requirements are fixed gameplay assumptions, not live FX quotes or real legal/tax advice. All consolidated accounting uses EUR as its base currency.</p>
  <div className="corporate-grid"><article><h3>Open a foreign subsidiary</h3><label>Country<select value={country} onChange={e=>{setCountry(e.target.value);setCity(countryFor(e.target.value).name);}}>{INTERNATIONAL_COUNTRIES.filter(c=>c.code!=='GRC').map(c=><option key={c.code} value={c.code}>{c.name} · {c.currency}</option>)}</select></label><label>Subsidiary name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>City<input value={city} onChange={e=>setCity(e.target.value)}/></label><label>Capital contribution (EUR)<input type="number" min={10000} step={1000} value={capital} onChange={e=>setCapital(Number(e.target.value))}/></label><div><span>Registration and licensing</span><strong>{money(countryInfo.licenseCost+countryInfo.setupCost)}</strong></div><div><span>Corporate tax</span><strong>{countryInfo.corporateTax}%</strong></div><div><span>Local currency per EUR</span><strong>{(1/countryInfo.eurPerUnit).toFixed(3)} {countryInfo.currency}</strong></div><button disabled={capital+countryInfo.licenseCost+countryInfo.setupCost>company.cash-reserve} onClick={()=>onFound(name,city,country,capital)}>Establish subsidiary</button></article>
  <article><h3>Foreign acquisitions</h3><label>Available business<select value={offer} onChange={e=>setOffer(e.target.value)}>{FOREIGN_MARKET.map(o=><option key={o.id} value={o.id}>{o.name} · {countryFor(o.countryCode).name}</option>)}</select></label><div><span>Purchase price</span><strong>{money(selected.price)}</strong></div><div><span>Operating fleet / depots</span><strong>{selected.vehicles} / {selected.depots}</strong></div><div><span>Local license fee</span><strong>{money(countryFor(selected.countryCode).licenseCost)}</strong></div><label>Loan financing: {loan}%<input type="range" min={0} max={100} step={5} value={loan} onChange={e=>setLoan(Number(e.target.value))}/></label><div><span>Available credit</span><strong>{money(corporateCreditCapacity(fleet))}</strong></div><button disabled={state.subsidiaries.some(s=>s.id===offer)||selected.price*loan/100>corporateCreditCapacity(fleet)||selected.price*(1-loan/100)+countryFor(selected.countryCode).licenseCost>company.cash-reserve} onClick={()=>onAcquire(offer,loan)}>Acquire foreign company</button></article>
  <article><h3>Cross-border banking</h3><label>Foreign subsidiary<select value={subsidiary} onChange={e=>setSubsidiary(e.target.value)}><option value="">Choose subsidiary</option>{foreign.map(s=><option key={s.id} value={s.id}>{s.name} ({s.currencyCode})</option>)}</select></label><label>Transfer direction<select value={direction} onChange={e=>setDirection(e.target.value as 'to'|'from')}><option value="to">Parent EUR → foreign currency</option><option value="from">Foreign currency → parent EUR</option></select></label><label>Amount in local currency ({selectedSub?.currencyCode??'—'})<input type="number" min=".01" step=".01" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></label><div><span>EUR equivalent</span><strong>{money(amount*(selectedSub?.fxRateToEUR??1))}</strong></div><div><span>Estimated conversion fee</span><strong>{money(Math.max(1,amount*(selectedSub?.fxRateToEUR??1)*.005))}</strong></div><button disabled={!selectedSub||amount<=0} onClick={()=>onTransfer(subsidiary,amount,direction)}>Execute international transfer</button><p>Internal principal transfers cancel in consolidated cash flow; currency-conversion fees are an external group cost.</p></article>
  <article><h3>International financial outlook</h3><div><span>Daily overseas revenue</span><strong>{money(stats.dailyRevenueEUR)}</strong></div><div><span>Daily overseas operating costs</span><strong>{money(stats.dailyExpensesEUR)}</strong></div><div><span>Estimated daily local taxes</span><strong>{money(stats.dailyTaxEUR)}</strong></div><div><span>Estimated 30-day net contribution</span><strong>{money(stats.forecast30DaysEUR)}</strong></div><p>Fixed scenario assumes current operating capacity, rates and FX conversion, excluding future capital transactions.</p></article></div>
  <h3>Overseas entities</h3>{foreign.length===0&&<p>No international subsidiaries yet.</p>}
  {foreign.map(s=><article className="corporate-subsidiary" key={s.id}><h3>{s.name} · {s.city}, {countryFor(s.countryCode??'GRC').name}</h3><div className="corporate-metrics"><div><small>LOCAL BALANCE</small><strong>{money(s.localCash??local(s.cash,s.countryCode??'GRC'),s.currencyCode)}</strong></div><div><small>EUR BALANCE</small><strong>{money(s.cash)}</strong></div><div><small>LOCAL TAX RATE</small><strong>{s.foreignTaxRate}%</strong></div><div><small>VEHICLES / DEPOTS</small><strong>{s.fleetCount} / {s.depotCount}</strong></div><div><small>LICENSE</small><strong>{s.licensePaid?'Paid':'Pending'}</strong></div></div></article>)}
  {error&&<p role="alert" className="corporate-error">{error}</p>}
 </div>;
}
