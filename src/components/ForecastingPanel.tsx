import {useMemo,useState} from 'react';
import type {Company} from '../company';
import type {FleetState} from '../simulation/taxi';
import {OFFERS} from '../dealership';
import {DEPOT_UPGRADES,depotCapacity,upgradesFor} from '../depotFinance';
import {forecastBusiness,type ForecastPlan,type ForecastHorizon,type ForecastScenario,type ExpansionMode} from '../forecasting';
import './forecasting-panel.css';
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const initialPlan:ForecastPlan={scenario:'expected',days:90,vehicleId:OFFERS[0].id,vehicleCount:1,mode:'none',depositPercent:25,financeDays:90,depotId:'main',depotUpgrade:'none',newDepot:false};
type Props={company:Company|null;fleet:FleetState;gameEpochMs:number};
export default function ForecastingPanel({company,fleet,gameEpochMs}:Props){
 const [plan,setPlan]=useState<ForecastPlan>(initialPlan);
 const change=<K extends keyof ForecastPlan>(key:K,value:ForecastPlan[K])=>setPlan(old=>({...old,[key]:value}));
 const result=useMemo(()=>company?forecastBusiness(company,fleet,plan,gameEpochMs):null,[company,fleet,plan,gameEpochMs]);
 if(!company||!result)return <p>Create a company to unlock business forecasts.</p>;
 const points=result.points;
 const minimum=Math.min(...points.map(p=>p.cash),0);
 const maximum=Math.max(...points.map(p=>p.cash),1);
 const scale=maximum-minimum||1;
 const path=points.map((p,i)=>`${i/(points.length-1)*640},${160-(p.cash-minimum)/scale*150}`).join(' ');
 const depots=[{id:'main',name:'Headquarters',capacity:5},...(company.depots??[])];
 const selectedDepot=depots.find(d=>d.id===plan.depotId)??depots[0];
 const occupied=fleet.taxis.filter(t=>(t.depotId??'main')===selectedDepot.id).length;
 const capacity=depotCapacity(selectedDepot,upgradesFor(fleet,selectedDepot.id));
 const perDayRevenue=result.totalRevenue/plan.days;
 const perDayCosts=result.totalOperatingExpenses/plan.days;
 const download=()=>{
  const rows=['Game day,Date,Fare revenue,Operating expenses,Loan payments,Lease payments,Tax payments,Savings transfer,Capital spending,Operating cash,Savings,Operating profit',...points.map(p=>[p.day,p.date,p.revenue,p.operatingExpenses,p.loanPayments,p.leasePayments,p.taxPayments,p.savingsTransfer,p.capitalSpending,p.cash,p.savings,p.profit].map((v,i)=>i===1?v:typeof v==='number'?v.toFixed(2):v).join(','))];
  const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='travelempire-financial-forecast.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 return <div className="forecasting-panel">
  <header className="forecasting-header"><div><h2>Financial forecasting & planning</h2><p>Deterministic projections based on saved company performance and scheduled obligations.</p></div><button type="button" onClick={download}>Export forecast CSV</button></header>
  <div className="forecasting-controls">
   <label>Scenario<select value={plan.scenario} onChange={e=>change('scenario',e.target.value as ForecastScenario)}><option value="conservative">Conservative</option><option value="expected">Expected</option><option value="optimistic">Optimistic</option></select></label>
   <label>Forecast horizon<select value={plan.days} onChange={e=>change('days',Number(e.target.value) as ForecastHorizon)}><option value={7}>7 game days</option><option value={30}>30 game days</option><option value={90}>90 game days</option><option value={180}>180 game days</option></select></label>
  </div>
  <div className="forecasting-metrics"><article><small>CLOSING OPERATING CASH</small><strong>{money(result.closingCash)}</strong></article><article><small>CASH CHANGE</small><strong>{money(result.closingCash-result.startCash)}</strong></article><article><small>PROJECTED REVENUE</small><strong>{money(result.totalRevenue)}</strong></article><article><small>PROJECTED OPERATING EXPENSES</small><strong>{money(result.totalOperatingExpenses)}</strong></article><article><small>PROJECTED TAX PAYMENTS</small><strong>{money(result.totalTaxes)}</strong></article><article><small>CLOSING SAVINGS</small><strong>{money(result.closingSavings)}</strong></article></div>
  <section className="forecasting-chart"><div className="forecasting-chart-title"><h3>Operating cash projection</h3><span>Start {money(result.startCash)} · End {money(result.closingCash)}</span></div><svg viewBox="0 0 640 175" preserveAspectRatio="none" role="img" aria-label={`Cash projection from ${money(result.startCash)} to ${money(result.closingCash)} over ${plan.days} simulated days`}><line x1="0" x2="640" y1={160-(0-minimum)/scale*150} y2={160-(0-minimum)/scale*150} stroke="#9c7c70" strokeDasharray="6 6" strokeWidth="1"/><polyline points={path} fill="none" stroke="#61c5a6" strokeWidth="3" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg><div className="forecasting-axis"><span>Day 0</span><span>Day {plan.days}</span></div></section>
  <section className="forecasting-planner"><h3>What-if fleet & depot expansion</h3><p>Planning only: no purchases, leases or upgrades are made until you buy them in the existing game screens.</p>
   <div className="forecasting-controls"><label>Vehicle acquisition<select value={plan.mode} onChange={e=>change('mode',e.target.value as ExpansionMode)}><option value="none">No new vehicles</option><option value="cash">Buy outright</option><option value="finance">Finance purchase</option><option value="lease">Lease vehicles</option></select></label>
   {plan.mode!=='none'&&<><label>Vehicle model<select value={plan.vehicleId} onChange={e=>change('vehicleId',e.target.value)}>{OFFERS.map(o=><option key={o.id} value={o.id}>{o.model} · {money(o.price)}</option>)}</select></label><label>Additional vehicles<input type="number" min={1} max={20} value={plan.vehicleCount} onChange={e=>change('vehicleCount',Math.max(1,Math.min(20,Number(e.target.value)||1)))}/></label>{plan.mode==='finance'&&<label>Deposit<select value={plan.depositPercent} onChange={e=>change('depositPercent',Number(e.target.value))}>{[10,20,25,30,40,50].map(v=><option key={v} value={v}>{v}%</option>)}</select></label>}{(plan.mode==='finance'||plan.mode==='lease')&&<label>Term<select value={plan.financeDays} onChange={e=>change('financeDays',Number(e.target.value) as ForecastPlan['financeDays'])}>{[30,60,90,180].map(v=><option key={v} value={v}>{v} game days</option>)}</select></label>}</>}
   <label>Depot<select value={plan.depotId} onChange={e=>change('depotId',e.target.value)}>{depots.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Planned facility upgrade<select value={plan.depotUpgrade} onChange={e=>change('depotUpgrade',e.target.value)}><option value="none">No upgrade</option>{DEPOT_UPGRADES.map(u=><option key={u.id} value={u.id}>{u.name} · {money(u.cost)}</option>)}</select></label><label className="forecasting-checkbox"><input type="checkbox" checked={plan.newDepot} onChange={e=>change('newDepot',e.target.checked)}/> Plan new depot (€10,000)</label></div>
   <div className="forecasting-metrics"><article><small>UPFRONT INVESTMENT</small><strong>{money(result.investmentCost)}</strong></article><article><small>ESTIMATED PAYBACK</small><strong>{result.estimatedPaybackDays===null?'Not reached':result.estimatedPaybackDays+' days'}</strong></article><article><small>SELECTED DEPOT CAPACITY</small><strong>{occupied}/{capacity} spaces</strong></article><article><small>EST. ADDED VEHICLE PROFIT / DAY</small><strong>{money(result.estimatedVehicleDailyProfit)}</strong></article></div>
  </section>
  <div className="forecasting-columns"><section><h3>Break-even analysis</h3><div><span>Required fare revenue per game day</span><strong>{money(result.breakEvenDailyRevenue)}</strong></div><div><span>Projected fare revenue per game day</span><strong>{money(perDayRevenue)}</strong></div><div><span>Projected costs per game day</span><strong>{money(perDayCosts)}</strong></div><div><span>Break-even trips per game day</span><strong>{result.breakEvenTrips===null?'Insufficient fare data':result.breakEvenTrips}</strong></div><div><span>Historical trips per game day</span><strong>{result.historicalTripsPerGameDay.toFixed(1)}</strong></div></section>
   <section><h3>Scheduled obligations</h3><div><span>Loan payments</span><strong>{money(result.totalLoanPayments)}</strong></div><div><span>Lease payments</span><strong>{money(result.totalLeasePayments)}</strong></div><div><span>Tax settlements</span><strong>{money(result.totalTaxes)}</strong></div><div><span>Capital investment</span><strong>{money(result.totalInvestments)}</strong></div><div><span>Automatic savings transfers</span><strong>{money(result.totalSavingsTransfers)}</strong></div><div><span>Lowest projected cash</span><strong>{money(result.minimumCash)}</strong></div><div><span>Estimated closing unpaid tax</span><strong>{money(result.taxLiabilityAtEnd)}</strong></div></section></div>
  {(result.warnings.length>0||result.alerts.length>0)&&<section className="forecasting-alerts"><h3>Financial risks & assumptions</h3>{result.warnings.map((m,i)=><p key={'w'+i}>{m}</p>)}{result.alerts.map((m,i)=><p key={'a'+i}>{m}</p>)}</section>}
  <p className="forecasting-note">Forecasts are estimates, not guaranteed outcomes. The simulation uses up to 14 days of saved real-time finance history (four simulated days per real day), your current bank balances, outstanding loans and leases, tax settings and depot costs. Conservative and optimistic scenarios vary revenue and operating costs; they do not predict actual passenger demand. No history means no assumed fares. Future VAT and corporate tax are simplified monthly estimates; forecasts do not change game state.</p>
 </div>;
}
