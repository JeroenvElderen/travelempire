import {useState} from 'react';
import type {Company} from '../company';
import type {FleetState,DepotUpgradeKind} from '../simulation/taxi';
import {DEPOT_UPGRADES,aggregateDepot,depotCapacity,depotDailyCost,upgradesFor} from '../depotFinance';
import './depot-finance.css';
type Props={company:Company|null;fleet:FleetState;onUpgrade:(depotId:string,kind:DepotUpgradeKind)=>void};
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(n);
export default function DepotFinancePanel({company,fleet,onUpgrade}:Props){
 const [days,setDays]=useState<7|30|90>(30);
 const [selected,setSelected]=useState('all');
 const [detail,setDetail]=useState(false);
 if(!company)return <p>Create a company to manage depot finances.</p>;
 const depots=[{id:'main',name:'Headquarters',capacity:5},...(company.depots??[])];
 const cutoff=new Date(Date.now()-(days-1)*86400000).toISOString().slice(0,10);
 const history=(fleet.depotFinanceHistory??[]).filter(r=>r.day>=cutoff);
 const summary=depots.map(d=>{
  const records=history.filter(r=>r.depotId===d.id);
  const totals=aggregateDepot(records);
  const vehicles=fleet.taxis.filter(t=>(t.depotId??'main')===d.id);
  const upgrades=upgradesFor(fleet,d.id);
  const capacity=depotCapacity(d,upgrades);
  const expenses=totals.vehicleExpenses+totals.facilityExpenses+totals.allocatedOverhead;
  const profit=totals.revenue-expenses;
  return {...d,records,totals,vehicles,upgrades,capacity,expenses,profit,margin:totals.revenue>0?100*profit/totals.revenue:0};
 }).sort((a,b)=>b.profit-a.profit);
 const chosen=selected==='all'?summary:summary.filter(d=>d.id===selected);
 const hasHistory=history.length>0;
 const total=aggregateDepot(history);
 const totalExpenses=total.vehicleExpenses+total.facilityExpenses+total.allocatedOverhead;
 const alerts=summary.flatMap(d=>[
  ...(d.vehicles.length>d.capacity?[`${d.name}: parking capacity exceeded`]:[]),
  ...(d.records.length&&d.profit<0?[`${d.name}: operating loss of ${money(-d.profit)} in the selected period`]:[]),
  ...(d.vehicles.length<Math.max(1,Math.floor(d.capacity*.25))?[`${d.name}: low utilisation (${d.vehicles.length}/${d.capacity} spaces)`]:[])
 ]);
 return <div className="depot-finance">
  <div className="depot-finance-header"><div><h2>Depot profitability</h2><p>Revenue and existing vehicle costs are allocated to their assigned depots. Facility expenses are charged separately.</p></div><label>Period <select value={days} onChange={e=>setDays(Number(e.target.value) as 7|30|90)}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label></div>
  <div className="depot-finance-metrics"><article><small>DEPOT REVENUE</small><strong>{money(total.revenue)}</strong></article><article><small>ALLOCATED + FACILITY COSTS</small><strong>{money(totalExpenses)}</strong></article><article><small>OPERATING PROFIT</small><strong>{money(total.revenue-totalExpenses)}</strong></article><article><small>DEPOTS</small><strong>{depots.length}</strong></article></div>
  {alerts.length>0&&<section className="depot-finance-alerts"><h3>Financial alerts</h3>{alerts.map((a,i)=><p key={i} role="status">{a}</p>)}</section>}
  <h3>Profitability ranking</h3>
  <div className="depot-finance-ranking">{summary.map((d,i)=><button key={d.id} onClick={()=>setSelected(d.id)} className={selected===d.id?'selected':''}><span>#{i+1} · {d.name}<small>{d.vehicles.length}/{d.capacity} vehicles · {d.totals.trips} trips</small></span><strong>{money(d.profit)}<small>{d.margin.toFixed(1)}% margin</small></strong></button>)}</div>
  <div className="depot-finance-header"><h3>Depot details & upgrades</h3><label>Location <select value={selected} onChange={e=>setSelected(e.target.value)}><option value="all">All depots</option>{depots.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label></div>
  {chosen.map(d=><section className="depot-finance-detail" key={d.id}>
   <h3>{d.name}</h3><p>{d.vehicles.length} vehicles assigned · {d.capacity} parking spaces · {d.totals.km.toFixed(1)} km driven</p>
   <div className="depot-finance-metrics"><article><small>FARE REVENUE</small><strong>{money(d.totals.revenue)}</strong></article><article><small>VEHICLE COSTS (ALLOCATED)</small><strong>{money(d.totals.vehicleExpenses)}</strong></article><article><small>FACILITY COSTS (NEW)</small><strong>{money(d.totals.facilityExpenses)}</strong></article><article><small>SHARE OF EXISTING OVERHEAD</small><strong>{money(d.totals.allocatedOverhead)}</strong></article></div>
   <h4>Monthly facility cost estimate</h4><div className="depot-finance-costs">{Object.entries(depotDailyCost(d.id==='main',d.upgrades,d.capacity)).map(([name,value])=><div key={name}><span>{name}</span><strong>{money(value*30)}</strong></div>)}</div>
   <h4>Facility upgrades</h4><div className="depot-finance-upgrades">{DEPOT_UPGRADES.map(u=><article key={u.id}><strong>{u.name} · Level {d.upgrades[u.id]??0}/{u.max}</strong><small>{u.description}</small><button disabled={(d.upgrades[u.id]??0)>=u.max||company.cash<u.cost} onClick={()=>onUpgrade(d.id,u.id)}>{(d.upgrades[u.id]??0)>=u.max?'Max level':`Upgrade · ${money(u.cost)}`}</button></article>)}</div>
  </section>)}
  <button className="depot-finance-toggle" onClick={()=>setDetail(!detail)}>{detail?'Hide':'Show'} daily history</button>
  {detail&&<div className="depot-finance-history">{history.filter(r=>selected==='all'||r.depotId===selected).sort((a,b)=>b.day.localeCompare(a.day)).slice(0,100).map(r=><div key={r.day+r.depotId}><span>{r.day} · {r.depotName}</span><strong>{money(r.revenue-r.vehicleExpenses-r.facilityExpenses-r.allocatedOverhead)}</strong></div>)}</div>}
  {!hasHistory&&<p>Depot financial history begins with this update. Previous vehicle expenses cannot be reliably attributed retroactively.</p>}
  <p className="depot-finance-note">Existing office overhead and vehicle costs are allocated for reporting only, not charged twice. Facility rent, utilities, insurance, maintenance facilities and administration are additional expenses. Upgrades are capital purchases, not operating costs.</p>
 </div>;
}
