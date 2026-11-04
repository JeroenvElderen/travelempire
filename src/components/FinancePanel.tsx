import {useEffect,useState} from 'react';
import {BarChart3,Receipt,Wallet,CreditCard,History} from 'lucide-react';
import type {Company} from '../company';
import type {FleetState,EconomyUpgrade} from '../simulation/taxi';
import {LOAN_OFFERS,UPGRADES,creditScore} from '../economy';
import {bankOf} from '../banking';
import DepotFinancePanel from './DepotFinancePanel';
import AccountingPanel from './AccountingPanel';
import ForecastingPanel from './ForecastingPanel';
import EquityPanel from './EquityPanel';
import CorporatePanel from './CorporatePanel';
import type {DepotUpgradeKind} from '../simulation/taxi';
import '../finance.css';
type BudgetCategory='fuel'|'maintenance'|'exploration'|'payroll'|'insurance'|'overhead';
type Budgets=Record<BudgetCategory,number>;
const defaultBudgets:Budgets={fuel:1000,maintenance:1000,exploration:2000,payroll:2500,insurance:750,overhead:1500};
const budgetLabels:Record<BudgetCategory,string>={fuel:'Fuel and charging',maintenance:'Maintenance and servicing',exploration:'Exploration',payroll:'Driver payroll',insurance:'Insurance',overhead:'Office and depot overhead'};
const budgetCategories=Object.keys(defaultBudgets) as BudgetCategory[];
type Props={company:Company|null;fleet:FleetState;gameEpochMs:number;onAcquire:(id:string,discount:number,loanPercent:number)=>void;onFoundSubsidiary:(name:string,city:string,capital:number)=>void;onCorporateTransfer:(id:string,amount:number,direction:'to'|'from')=>void;onCorporateMerge:(sourceId:string,targetId:string)=>void;onCorporateRestructure:(id:string,vehicles:number,depots:number)=>void;onCorporateAssetTransfer:(sourceId:string,targetId:string,vehicles:number,depots:number)=>void;onFoundForeign:(name:string,city:string,code:string,capital:number)=>void;onAcquireForeign:(id:string,loanPercent:number)=>void;onTransferForeign:(id:string,amount:number,direction:'to'|'from')=>void;onInvest:(investorId:string)=>void;onIssueShares:(investorId:string,amount:number)=>void;onDividend:(amount:number)=>void;onBuyback:(investorId:string,shares:number)=>void;onLoan:(amount:number)=>void;onEarlyRepayment:(loanId:string)=>void;onDepotUpgrade:(depotId:string,kind:DepotUpgradeKind)=>void;onAccountingSettings:(corporateRate:number,vatRate:number)=>void;onTransfer:(from:'operating'|'savings'|'reserve',to:'operating'|'savings'|'reserve',amount:number)=>void;onBankSettings:(percent:number,minimum:number)=>void;onUpgrade:(id:EconomyUpgrade)=>void;onWageChange:(multiplier:number)=>void;error:string};
const money=(value:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
export default function FinancePanel({company,fleet,gameEpochMs,onAcquire,onFoundSubsidiary,onCorporateTransfer,onCorporateMerge,onCorporateRestructure,onCorporateAssetTransfer,onFoundForeign,onAcquireForeign,onTransferForeign,onInvest,onIssueShares,onDividend,onBuyback,onLoan,onEarlyRepayment,onDepotUpgrade,onAccountingSettings,onTransfer,onBankSettings,onUpgrade,onWageChange,error}:Props){
 const [tab,setTab]=useState<'overview'|'performance'|'costs'|'capital'|'activity'|'budgets'|'banking'|'reports'|'depots'|'accounting'|'forecast'|'equity'|'corporate'>('overview');
 const [transferFrom,setTransferFrom]=useState<'operating'|'savings'|'reserve'>('operating');
 const [transferTo,setTransferTo]=useState<'operating'|'savings'|'reserve'>('savings');
 const [transferAmount,setTransferAmount]=useState('');
 const [bankSearch,setBankSearch]=useState('');
 const [reportRange,setReportRange]=useState<7|30|90>(30);
 const [periodDays,setPeriodDays]=useState<7|30|90>(30);
 const [ledgerSearch,setLedgerSearch]=useState('');
 const [ledgerVehicle,setLedgerVehicle]=useState('all');
 const [ledgerMonth,setLedgerMonth]=useState('all');
 const [chartGrouping,setChartGrouping]=useState<'daily'|'weekly'|'monthly'>('daily');
 const [vehiclePeriod,setVehiclePeriod]=useState('all');
 const [ledgerFilter,setLedgerFilter]=useState<'all'|'income'|'expense'>('all');
 const [budgets,setBudgets]=useState<Budgets>(defaultBudgets);
 const [budgetEnabled,setBudgetEnabled]=useState(false);
 useEffect(()=>{
  setBudgetEnabled(false);
  if(!company){setBudgets(defaultBudgets);return;}
  try{
   const raw=localStorage.getItem('travelempire.finance.budgets.v1.'+company.id);
   const parsed=raw?JSON.parse(raw) as Partial<Budgets>:null;
   setBudgets(Object.fromEntries(budgetCategories.map(k=>{const value=parsed?.[k];return [k,typeof value==='number'&&Number.isFinite(value)?Math.max(0,value):defaultBudgets[k]];})) as Budgets);
  }catch{setBudgets(defaultBudgets);}
  setBudgetEnabled(true);
 },[company?.id]);
 useEffect(()=>{if(company&&budgetEnabled)localStorage.setItem('travelempire.finance.budgets.v1.'+company.id,JSON.stringify(budgets))},[company?.id,budgets,budgetEnabled]);
 const bank=bankOf(fleet.bank);
 const cashAvailable=(company?.cash??0);
 const bankTotal=cashAvailable+bank.savings+bank.reserve;
 const score=creditScore(cashAvailable,fleet.loans??[],(fleet.leases??[]).length,fleet.financePaymentsMade??0);
 const debt=(fleet.loans??[]).reduce((a,l)=>a+l.balance,0);
 const expenses=(fleet.fuelExpense??0)+(fleet.maintenanceExpense??0)+(fleet.explorationExpense??0)+(fleet.driverWages??0)+(fleet.insuranceExpense??0)+(fleet.serviceExpense??0)+(fleet.overheadExpense??0)+(fleet.loanInterestExpense??0)+(fleet.leaseExpense??0);
 const profit=fleet.revenue-expenses;
 const vehicleValue=(t:FleetState['taxis'][number])=>{
  const age=Math.max(0,new Date().getFullYear()-(t.vehicleYear??new Date().getFullYear()));
  const km=(t.vehicleMileage??0);
  return Math.max(1000,15000*Math.pow(0.88,age)*Math.pow(0.92,km/30000)*(t.vehicleCondition??100)/100);
 };
 const value=fleet.taxis.reduce((sum,t)=>sum+vehicleValue(t),0);
 const history=fleet.financeHistory??[];
 const periods=[{label:'Last 7 days',days:7},{label:'Last 30 days',days:30},{label:'Last 90 days',days:90}].map(p=>{const cutoff=new Date(Date.now()-(p.days-1)*86400000).toISOString().slice(0,10);const rows=history.filter(h=>h.day>=cutoff);return {...p,revenue:rows.reduce((a,h)=>a+h.revenue,0),expenses:rows.reduce((a,h)=>a+h.expenses,0),trips:rows.reduce((a,h)=>a+h.trips,0)};});
 const daily=history.slice().sort((a,b)=>a.day.localeCompare(b.day));
 const dailyRecent=daily.filter(h=>h.day>=new Date(Date.now()-(periodDays-1)*86400000).toISOString().slice(0,10));
 const monthly=Array.from(daily.reduce((map,h)=>{
  const key=h.day.slice(0,7),old=map.get(key)??{day:key,revenue:0,expenses:0,trips:0};
  map.set(key,{day:key,revenue:old.revenue+h.revenue,expenses:old.expenses+h.expenses,trips:old.trips+h.trips});
  return map;
 },new Map<string,{day:string;revenue:number;expenses:number;trips:number}>()).values()).sort((a,b)=>a.day.localeCompare(b.day)).slice(-12);
 const chart=(rows:{day:string;revenue:number;expenses:number}[],title:string)=>{
  const max=Math.max(1,...rows.flatMap(h=>[h.revenue,h.expenses]));
  return <div className="finance-trend"><h3>{title}</h3>{rows.length===0?<p>No financial history recorded for this period.</p>:
   <><div className="finance-trend-legend"><span>● Revenue</span><span>● Expenses</span></div><div className="finance-trend-bars" role="img" aria-label={title+' comparing revenue and expenses'}>
   {rows.map(h=><div className="finance-trend-day" key={h.day} title={h.day+' · Revenue '+money(h.revenue)+' · Expenses '+money(h.expenses)}>
    <div className="finance-trend-pair"><span style={{height:(h.revenue/max*100)+'%'}}/><span style={{height:(h.expenses/max*100)+'%'}}/></div>
    <small>{h.day.slice(5)}</small>
   </div>)}</div></>}</div>;
 };
 const totalOperatingBudget=budgetCategories.reduce((sum,k)=>sum+budgets[k],0);
 const budgetActual:Budgets={fuel:fleet.fuelExpense??0,maintenance:(fleet.maintenanceExpense??0)+(fleet.serviceExpense??0),
  exploration:fleet.explorationExpense??0,payroll:fleet.driverWages??0,insurance:fleet.insuranceExpense??0,overhead:fleet.overheadExpense??0};
 const historicalExpenses=history.reduce((sum,h)=>sum+h.expenses,0);
 const currentMonth=new Date().toISOString().slice(0,7);
 const currentMonthHistory=history.filter(h=>h.day.startsWith(currentMonth));
 const monthRecordedExpenses=currentMonthHistory.reduce((sum,h)=>sum+h.expenses,0);
 const monthRecordedRevenue=currentMonthHistory.reduce((sum,h)=>sum+h.revenue,0);
 // Category-level spending is recorded as lifetime totals, not dated ledger
 // entries. Do not misrepresent lifetime amounts as monthly actuals.
 const ledger=(fleet.transactions??[]).filter(t=>
  (ledgerFilter==='all'||(ledgerFilter==='income'?t.amount>0:t.amount<0))&&
  (ledgerVehicle==='all'||t.taxiId===ledgerVehicle)&&
  (ledgerMonth==='all'||new Date(t.time).toISOString().slice(0,7)===ledgerMonth)&&
  (t.description.toLowerCase().includes(ledgerSearch.toLowerCase())||t.id.toLowerCase().includes(ledgerSearch.toLowerCase())));
 const monthCategories=history.filter(h=>h.day.startsWith(currentMonth)).reduce((sum,h)=>{
  if(h.categories)for(const key of budgetCategories)sum[key]+=h.categories[key]??0;
  return sum;
 },{fuel:0,maintenance:0,exploration:0,payroll:0,insurance:0,overhead:0} as Budgets);
 const hasMonthlyCategories=history.some(h=>h.day.startsWith(currentMonth)&&!!h.categories);
 const groupedChart=chartGrouping==='monthly'?monthly:chartGrouping==='daily'?dailyRecent:(()=>{
  const buckets=new Map<string,{day:string;revenue:number;expenses:number}>();
  for(const h of dailyRecent){const d=new Date(h.day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const key=d.toISOString().slice(0,10);
   const prev=buckets.get(key)??{day:key,revenue:0,expenses:0};prev.revenue+=h.revenue;prev.expenses+=h.expenses;buckets.set(key,prev);}
  return [...buckets.values()].sort((a,b)=>a.day.localeCompare(b.day));
 })();
 const recordedVehicleHistory=(fleet.vehicleFinanceHistory??[]).filter(v=>vehiclePeriod==='all'||v.day.startsWith(vehiclePeriod));
 const vehicleTotals=new Map<string,{revenue:number;expenses:number;km:number;trips:number}>();
 for(const v of recordedVehicleHistory){const old=vehicleTotals.get(v.taxiId)??{revenue:0,expenses:0,km:0,trips:0};vehicleTotals.set(v.taxiId,{revenue:old.revenue+v.revenue,expenses:old.expenses+v.expenses,km:old.km+v.km,trips:old.trips+v.trips});}
 const forecastDays=history.slice(-30);
 const dailyAverage=forecastDays.length?forecastDays.reduce((sum,h)=>sum+h.revenue-h.expenses,0)/forecastDays.length:0;

 return <section className="company-dashboard finance-page finance-v214"><div className="finance-heading"><div><span className="eyebrow">FINANCIAL MANAGEMENT · PHASE 1</span><h1>Finance</h1><p>Understand cash flow, profitability and the financial health of your transport business.</p></div><span className="finance-live-badge">● LIVE COMPANY DATA</span></div><div className="finance-tabs" role="tablist" aria-label="Finance sections">{([['overview','Overview',Wallet],['performance','Performance',BarChart3],['costs','Costs & fleet',Receipt],['capital','Loans & upgrades',CreditCard],['activity','Transactions',History],['budgets','Budgets',Wallet],['banking','Banking',CreditCard],['reports','Reports',BarChart3],['depots','Depots',Wallet],['accounting','Accounting',Receipt],['forecast','Forecast',BarChart3],['equity','Investors',Wallet],['corporate','Group',BarChart3]] as const).map(([id,label,Icon])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={e=>{setTab(id);if(window.matchMedia('(max-width: 650px)').matches)e.currentTarget.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});}}><Icon size={16}/>{label}</button>)}</div><div className="finance-intro"><span>FINANCIAL HISTORY · RECORDED DAYS</span><span>Values reflect saved game records, not real-world accounts</span></div><div className="finance-overview-kpis">
 <div className="company-metrics"><article><small>AVAILABLE CASH</small><strong>{money(company?.cash??0)}</strong></article><article><small>PASSENGER REVENUE</small><strong>{money(fleet.revenue)}</strong></article><article><small>OPERATING PROFIT</small><strong>{money(profit)}</strong></article><article><small>OUTSTANDING DEBT</small><strong>{money(debt)}</strong></article><article><small>EST. FLEET ASSETS</small><strong>{money(value)}</strong></article><article><small>EST. EQUITY</small><strong>{money(bankTotal+value-debt)}</strong></article></div>
 </div>{tab==='overview'&&<div className="finance-tab-content"><div className="finance-section-heading"><h2>Operating analytics</h2><span>Lifetime business efficiency</span></div><p>Lifetime performance from saved simulation totals. Rates include exploration kilometres and exclude vehicle purchases; values are not daily forecasts.</p><div className="company-metrics"><article><small>REVENUE / KM</small><strong>{money(fleet.distanceKm&&fleet.distanceKm>0?fleet.revenue/fleet.distanceKm:0)}</strong></article><article><small>OPERATING PROFIT / KM</small><strong>{money(fleet.distanceKm&&fleet.distanceKm>0?profit/fleet.distanceKm:0)}</strong></article><article><small>REVENUE / COMPLETED TRIP</small><strong>{money(fleet.completed>0?fleet.revenue/fleet.completed:0)}</strong></article><article><small>FLEET DISTANCE</small><strong>{(fleet.distanceKm??0).toFixed(1)} km</strong></article><article><small>ACTIVE VEHICLES</small><strong>{fleet.taxis.filter(t=>t.status!=='IDLE'&&!t.deliveryUntil).length} / {fleet.taxis.length}</strong></article><article><small>EXPLORATION COST</small><strong>{money(fleet.explorationExpense??0)}</strong></article></div>
 <div className="finance-section-heading"><h2>Financial notifications</h2><span>Automatically evaluated</span></div>
 {cashAvailable<bank.minimumOperatingCash&&<p className="finance-budget-alert" role="alert">Operating cash is below your minimum reserve threshold of {money(bank.minimumOperatingCash)}.</p>}
 {(fleet.loans??[]).some(l=>l.remainingDays<=3)&&<p className="finance-budget-alert" role="alert">One or more loans have 3 or fewer game days remaining.</p>}
 {dailyAverage<0&&<p className="finance-budget-alert" role="alert">Negative average daily operating cash flow: {money(dailyAverage)} per recorded day.</p>}
 {cashAvailable>=bank.minimumOperatingCash&&!(fleet.loans??[]).some(l=>l.remainingDays<=3)&&dailyAverage>=0&&<p>No active financial alerts.</p>}
 <div className="finance-section-heading"><h2>Cash flow overview</h2><span>Based on recorded daily activity</span></div>
 {chart(daily.slice(-14),'Daily revenue and expenses · last 14 recorded days')}
 <div className="company-metrics"><article><small>RECORDED REVENUE</small><strong>{money(history.reduce((a,h)=>a+h.revenue,0))}</strong></article><article><small>RECORDED EXPENSES</small><strong>{money(historicalExpenses)}</strong></article><article><small>RECORDED OPERATING CASH FLOW</small><strong>{money(history.reduce((a,h)=>a+h.revenue-h.expenses,0))}</strong></article></div>
 </div>}{tab==='performance'&&<div className="finance-tab-content"><div className="finance-section-heading"><h2>Operating statement</h2><span>Revenue less recurring expenses</span></div><div className="finance-rows">{([['Passenger fares',fleet.revenue],['Fuel / charging',-(fleet.fuelExpense??0)],['Maintenance reserve',-(fleet.maintenanceExpense??0)],['Explorer travel (€2.50/km)',-(fleet.explorationExpense??0)],['Driver wages + employer costs',-(fleet.driverWages??0)],['Commercial insurance',-(fleet.insuranceExpense??0)],['Office and depot overhead',-(fleet.overheadExpense??0)],['Vehicle servicing',-(fleet.serviceExpense??0)],['Loan interest',-(fleet.loanInterestExpense??0)],['Operating profit',profit],['Loan principal repaid (cash flow only)',-(fleet.loanPrincipalPaid??0)]] as [string,number][]).map(([label,amount])=><div key={label}><span>{label}</span><strong>{money(amount)}</strong></div>)}</div>
 <div className="finance-section-heading"><h2>Financial performance</h2><select aria-label="Performance period" value={periodDays} onChange={e=>setPeriodDays(Number(e.target.value) as 7|30|90)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></div><p>Daily snapshots are recorded from this version onward. Older transactions are not reconstructed into historical periods.</p><div className="company-metrics">{periods.filter(p=>p.days===periodDays).map(p=><article key={p.days}><small>{p.label.toUpperCase()}</small><strong>{money(p.revenue-p.expenses)} profit</strong><span>Revenue {money(p.revenue)} · Expenses {money(p.expenses)} · {p.trips} trips</span></article>)}</div>
 <label>Chart grouping <select value={chartGrouping} onChange={e=>setChartGrouping(e.target.value as typeof chartGrouping)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
 {chart(groupedChart,chartGrouping+' revenue and expenses')}
 {chart(monthly,'Monthly revenue and expenses · last 12 recorded months')}
 <div className="finance-section-heading"><h2>Cash-flow forecast</h2><span>Based on last 30 recorded days</span></div>
 <p>Simple historical average, not guaranteed income. Excludes planned vehicle purchases, future loan principal and unexpected costs.</p>
 <div className="company-metrics"><article><small>EST. CASH IN 7 DAYS</small><strong>{money((company?.cash??0)+dailyAverage*7)}</strong></article><article><small>EST. CASH IN 30 DAYS</small><strong>{money((company?.cash??0)+dailyAverage*30)}</strong></article><article><small>AVERAGE DAILY OPERATING FLOW</small><strong>{money(dailyAverage)}</strong></article></div>
 <h3>Daily profit trend · last {periodDays} days</h3><div style={{display:'flex',alignItems:'end',gap:3,height:100,overflowX:'auto',padding:'10px 0'}} aria-label="Daily profit bar chart">{history.slice(-periodDays).map(h=>{const net=h.revenue-h.expenses;const max=Math.max(1,...history.slice(-periodDays).map(x=>Math.abs(x.revenue-x.expenses)));return <div key={h.day} title={`${h.day}: ${money(net)}`} style={{height:`${Math.max(3,Math.abs(net)/max*90)}%`,background:net>=0?'#30b98b':'#df6d69',minWidth:9,borderRadius:2}}/>;})}{!history.length&&<span>No daily history recorded yet.</span>}</div>
 </div>}{tab==='costs'&&<div className="finance-tab-content"><div className="finance-section-heading"><h2>Driver salary policy</h2><span>Applies to future wage accrual</span></div><p>Wage multiplier affects future wage accrual only; previously paid wages are unchanged. 100% is the existing baseline.</p><label>Wage level <select value={fleet.wageMultiplier??1} onChange={e=>onWageChange(Number(e.target.value))}>{[0.75,1,1.25,1.5,2].map(v=><option key={v} value={v}>{Math.round(v*100)}% of baseline</option>)}</select></label>
 <h2>Vehicle profitability & depreciation</h2><label>Historical vehicle period <select value={vehiclePeriod} onChange={e=>setVehiclePeriod(e.target.value)}><option value="all">All recorded periods</option>{[...new Set((fleet.vehicleFinanceHistory??[]).map(v=>v.day.slice(0,7)))].sort().reverse().map(m=><option key={m} value={m}>{m}</option>)}</select></label><p>Per-vehicle lifetime operating contribution excludes unallocated depot overhead, loan interest and purchase costs. Estimated resale value uses age, mileage and condition.</p><div className="finance-rows">{fleet.taxis.map(t=>{const cost=(t.fuelExpense??0)+(t.maintenanceExpense??0)+(t.explorationExpense??0)+(t.driverWages??0)+(t.insuranceExpense??0);return <div key={t.id}><span>{t.name} · {t.driver} · {Math.round(t.operatingKm??0)} km<br/>Revenue {money(t.tripRevenue??0)} · Costs {money(cost)} · Est. value {money(vehicleValue(t))} · Cost/km {money((t.operatingKm??0)>0?cost/(t.operatingKm??1):0)} · Revenue/km {money((t.operatingKm??0)>0?(t.tripRevenue??0)/(t.operatingKm??1):0)}{vehicleTotals.has(t.id)&&<> · Selected period: {money(vehicleTotals.get(t.id)!.revenue)} revenue / {money(vehicleTotals.get(t.id)!.expenses)} costs / {vehicleTotals.get(t.id)!.km.toFixed(1)} km</>}</span><strong>{money((t.tripRevenue??0)-cost)}</strong></div>;})}{!fleet.taxis.length&&<p>No vehicles purchased yet.</p>}</div>
 </div>}{tab==='capital'&&<div className="finance-tab-content"><div className="finance-section-heading"><h2>Business loans</h2><span>Finance your company growth</span></div><p>Maximum two active loans and €75,000 outstanding, including financed vehicles. Repayments are made every simulated day; interest is charged on the remaining balance. Borrowing is not revenue and principal repayment is not an operating expense.</p><div className="finance-options">{LOAN_OFFERS.map(l=><article key={l.amount}><strong>{money(l.amount)}</strong><small>{(l.rate*100).toFixed(0)}% annual interest · {l.days} game days</small><button disabled={!company||(fleet.loans??[]).length>=2||debt+l.amount>75000} onClick={()=>onLoan(l.amount)}>Take loan</button></article>)}</div>
 {(fleet.loans??[]).map(l=><div className="finance-loan" key={l.id}><strong>{money(l.balance)} outstanding</strong><span>{l.remainingDays} game days remaining · {money(l.dailyPayment)} / game day</span></div>)}
 <div className="finance-section-heading"><h2>Fleet financing and credit</h2><span>Simulated lender assessment</span></div>
 <div className="company-metrics"><article><small>CREDIT SCORE</small><strong>{score} / 850</strong></article><article><small>FINANCED VEHICLES</small><strong>{(fleet.loans??[]).filter(l=>l.purpose==='vehicle').length}</strong></article><article><small>ACTIVE LEASES</small><strong>{(fleet.leases??[]).length}</strong></article><article><small>LEASE PAYMENTS TO DATE</small><strong>{money(fleet.leaseExpense??0)}</strong></article></div>
 <p>Credit score is a gameplay estimate based on available cash, debt, leases and recorded repayments. It does not represent a real credit rating.</p>
 {(fleet.loans??[]).filter(l=>l.purpose==='vehicle').map(l=><div className="finance-loan" key={l.id}><strong>Vehicle finance · {fleet.taxis.find(t=>t.id===l.vehicleId)?.name??'Vehicle'}</strong><span>{money(l.balance)} outstanding · {l.remainingDays} game days · {money(l.dailyPayment)} / game day</span><button disabled={!company||company.cash<l.balance} onClick={()=>onEarlyRepayment(l.id)}>Repay remaining balance</button></div>)}
 {(fleet.leases??[]).map(l=><div className="finance-loan" key={l.id}><strong>Lease · {l.vehicleName}</strong><span>{l.remainingDays} game days remaining · {money(l.dailyPayment)} / game day · {money(l.totalPaid)} paid</span><small>Vehicle is returned automatically when the term ends. No ownership or resale rights.</small></div>)}
 <h2>Company upgrades</h2><div className="finance-options">{UPGRADES.map(u=><article key={u.id}><strong>{u.name}</strong><small>{u.detail}</small><span>{money(u.cost)}</span><button disabled={!company||(fleet.upgrades??[]).includes(u.id)||(company.cash<u.cost)} onClick={()=>onUpgrade(u.id)}>{(fleet.upgrades??[]).includes(u.id)?'Purchased':'Purchase upgrade'}</button></article>)}</div>
 </div>}{tab==='activity'&&<div className="finance-tab-content"><div className="finance-section-heading"><h2>Recent transactions</h2><span>Latest 100 recorded entries</span></div><div className="finance-ledger-controls"><label>Search <input value={ledgerSearch} onChange={e=>setLedgerSearch(e.target.value)} placeholder="Description or transaction ID"/></label><label>Vehicle <select value={ledgerVehicle} onChange={e=>setLedgerVehicle(e.target.value)}><option value="all">All vehicles</option>{fleet.taxis.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Month <select value={ledgerMonth} onChange={e=>setLedgerMonth(e.target.value)}><option value="all">All dates</option>{[...new Set((fleet.transactions??[]).map(t=>new Date(t.time).toISOString().slice(0,7)))].sort().reverse().map(m=><option key={m} value={m}>{m}</option>)}</select></label><label>Show <select value={ledgerFilter} onChange={e=>setLedgerFilter(e.target.value as typeof ledgerFilter)}><option value="all">All transactions</option><option value="income">Money in</option><option value="expense">Money out</option></select></label><span>{ledger.length} entries · Net {money(ledger.reduce((a,t)=>a+t.amount,0))}</span></div><div className="finance-rows">{ledger.slice(0,100).map(x=><div key={x.id}><span>{new Date(x.time).toLocaleString()} · {x.description}</span><strong>{money(x.amount)}</strong></div>)}{!(fleet.transactions??[]).length&&<p>No transactions yet.</p>}</div>
 </div>}{tab==='budgets'&&<div className="finance-tab-content">
 <div className="finance-section-heading"><h2>Monthly operating budgets</h2><span>Saved for this company</span></div>
 <p>Set monthly spending limits. The game currently records category expenses as lifetime totals, and now tracks monthly category totals for newly recorded activity. Older records may lack category detail. Alerts compare recorded monthly expenses against budgets.</p>
 <div className="company-metrics"><article><small>MONTHLY OPERATING BUDGET</small><strong>{money(totalOperatingBudget)}</strong></article>
 <article><small>THIS MONTH · RECORDED EXPENSES</small><strong>{money(monthRecordedExpenses)}</strong></article>
 <article><small>THIS MONTH · RECORDED REVENUE</small><strong>{money(monthRecordedRevenue)}</strong></article>
 <article><small>BUDGET REMAINING</small><strong>{money(totalOperatingBudget-monthRecordedExpenses)}</strong></article></div>
 {hasMonthlyCategories&&budgetCategories.map(k=>budgets[k]>=0&&monthCategories[k]>0&&monthCategories[k]>=budgets[k]*.8?<p key={k} className="finance-budget-alert" role="alert">{budgetLabels[k]}: {monthCategories[k]>budgets[k]?'Budget exceeded':'At least 80% of budget used'} · {money(monthCategories[k])} / {money(budgets[k])}</p>:null)}
 {totalOperatingBudget>0&&monthRecordedExpenses>=totalOperatingBudget*.8&&<p className="finance-budget-alert" role="alert">{monthRecordedExpenses>totalOperatingBudget?'Monthly operating budget exceeded.':'Warning: monthly operating expenses have reached at least 80% of your budget.'}</p>}
 {totalOperatingBudget===0&&monthRecordedExpenses>0&&<p className="finance-budget-alert" role="alert">No operating budget allocated, but expenses have been recorded.</p>}
 <div className="finance-budget-list">{budgetCategories.map(k=><label className="finance-budget-row" key={k}><span>{budgetLabels[k]}<small>{hasMonthlyCategories?`This month: ${money(monthCategories[k])}`:`Lifetime recorded: ${money(budgetActual[k])}`}</small></span><span>€ <input aria-label={budgetLabels[k]+' monthly budget'} type="number" min="0" step="50" value={budgets[k]} onChange={e=>setBudgets(old=>({...old,[k]:Math.max(0,Number(e.target.value)||0)}))}/></span></label>)}</div>
 <p>Budgets are planning targets, not spending caps. They do not automatically block purchases or payments.</p>
 </div>}{tab==='banking'&&<div className="finance-tab-content">
 <div className="finance-section-heading"><h2>Business banking</h2><span>Company funds · simulated euros</span></div>
 <div className="company-metrics"><article><small>OPERATING ACCOUNT</small><strong>{money(cashAvailable)}</strong></article><article><small>SAVINGS</small><strong>{money(bank.savings)}</strong></article><article><small>EMERGENCY RESERVE</small><strong>{money(bank.reserve)}</strong></article><article><small>TOTAL CASH ACROSS ACCOUNTS</small><strong>{money(bankTotal)}</strong></article></div>
 <h3>Transfer between accounts</h3><div className="finance-bank-controls">
 <label>From <select value={transferFrom} onChange={e=>setTransferFrom(e.target.value as typeof transferFrom)}>{(['operating','savings','reserve'] as const).map(a=><option key={a} value={a}>{a}</option>)}</select></label>
 <label>To <select value={transferTo} onChange={e=>setTransferTo(e.target.value as typeof transferTo)}>{(['operating','savings','reserve'] as const).map(a=><option key={a} value={a}>{a}</option>)}</select></label>
 <label>Amount € <input type="number" min="0.01" step="0.01" value={transferAmount} onChange={e=>setTransferAmount(e.target.value)}/></label>
 <button disabled={!company||transferFrom===transferTo||!(Number(transferAmount)>0)} onClick={()=>{onTransfer(transferFrom,transferTo,Number(transferAmount));setTransferAmount('');}}>Transfer funds</button></div>
 <h3>Automatic savings policy</h3><p>Whenever taxi fares or ferry ticket income is recorded, automatically transfer your chosen percentage of that income into savings, while keeping your minimum operating cash balance untouched. Loan proceeds and account transfers do not trigger savings. This is a transfer, not an expense.</p>
 <div className="finance-bank-controls"><label>Save each income <select value={bank.autoSavePercent} onChange={e=>onBankSettings(Number(e.target.value),bank.minimumOperatingCash)}>{[0,5,10,15,20,25,50].map(p=><option key={p} value={p}>{p}%</option>)}</select></label>
 <label>Minimum operating cash € <input type="number" min="0" step="500" value={bank.minimumOperatingCash} onChange={e=>onBankSettings(bank.autoSavePercent,Number(e.target.value))}/></label></div>
 {cashAvailable<bank.minimumOperatingCash&&<p role="alert" className="finance-budget-alert">Low operating cash: balance is below your configured minimum.</p>}
 {cashAvailable<0&&<p role="alert" className="finance-budget-alert">Operating account has a negative balance.</p>}
 <h3>Bank account ledger</h3><label>Search bank transactions <input value={bankSearch} onChange={e=>setBankSearch(e.target.value)} placeholder="Transfer, loan, repayment…"/></label>
 <div className="finance-rows">{bank.entries.filter(e=>e.description.toLowerCase().includes(bankSearch.toLowerCase())).slice(0,100).map(e=><div key={e.id}><span>{new Date(e.time).toLocaleString()} · {e.account.toUpperCase()} · {e.description}</span><strong>{money(e.amount)}</strong></div>)}{!bank.entries.length&&<p>No bank transfers recorded yet.</p>}</div>
 <p>Bank ledger records transfers, loan movements and financed vehicle purchases from this update onward. Operating cash still uses the existing company cash balance.</p>
 </div>}{tab==='corporate'&&<CorporatePanel company={company} fleet={fleet} gameEpochMs={gameEpochMs} onAcquire={onAcquire} onFound={onFoundSubsidiary} onTransfer={onCorporateTransfer} onMerge={onCorporateMerge} onRestructure={onCorporateRestructure} onAssetTransfer={onCorporateAssetTransfer} onFoundForeign={onFoundForeign} onAcquireForeign={onAcquireForeign} onTransferForeign={onTransferForeign} error={error}/>}{tab==='equity'&&<EquityPanel company={company} fleet={fleet} gameEpochMs={gameEpochMs} onInvest={onInvest} onIssue={onIssueShares} onDividend={onDividend} onBuyback={onBuyback} error={error}/>}{tab==='forecast'&&<ForecastingPanel company={company} fleet={fleet} gameEpochMs={gameEpochMs}/>}{tab==='accounting'&&<AccountingPanel company={company} fleet={fleet} onSettings={onAccountingSettings}/>}{tab==='depots'&&<DepotFinancePanel company={company} fleet={fleet} onUpgrade={onDepotUpgrade}/>}{tab==='reports'&&<div className="finance-tab-content">
 <div className="finance-section-heading"><h2>Financial reports</h2><span>Saved activity only</span></div>
 <label>Reporting period <select value={reportRange} onChange={e=>setReportRange(Number(e.target.value) as 7|30|90)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label>
 {(()=>{const cutoff=new Date(Date.now()-(reportRange-1)*86400000).toISOString().slice(0,10);
 const records=history.filter(h=>h.day>=cutoff);const income=records.reduce((a,h)=>a+h.revenue,0);const spent=records.reduce((a,h)=>a+h.expenses,0);
 const cashflow=income-spent;const filename='travelempire-finance-'+reportRange+'d.csv';
 const csv=['Date,Revenue,Expenses,Profit,Trips',...records.map(h=>[h.day,h.revenue.toFixed(2),h.expenses.toFixed(2),(h.revenue-h.expenses).toFixed(2),h.trips].join(','))].join('\n');
 return <><div className="company-metrics"><article><small>REVENUE</small><strong>{money(income)}</strong></article><article><small>EXPENSES</small><strong>{money(spent)}</strong></article><article><small>OPERATING PROFIT</small><strong>{money(cashflow)}</strong></article><article><small>COMPLETED TRIPS</small><strong>{records.reduce((a,h)=>a+h.trips,0)}</strong></article></div>
 <button className="finance-export" onClick={()=>{const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>Export report as CSV</button>
 {chart(records,'Revenue and expenses · '+reportRange+' days')}</>;})()}
 <h3>Upcoming loan repayments</h3><div className="finance-rows">{(fleet.loans??[]).map(l=><div key={l.id}><span>{l.purpose==='vehicle'?'Vehicle financing':'Business loan'} · {l.remainingDays} game days remaining · {(l.annualRate*100).toFixed(1)}% annual interest</span><strong>{money(l.dailyPayment)} / game day</strong></div>)}{!(fleet.loans??[]).length&&<p>No active loans.</p>}</div>
 <p>Reports use available daily snapshots. Cash-flow projections exclude capital purchases and loan principal; historical records may be incomplete.</p>
 </div>}{error&&<p role="alert" className="finance-error">{error}</p>}<p className="finance-note">Fleet asset value is an indicative gameplay estimate, not a market appraisal. Maintenance reserves are expensed as accrued, while servicing is a separate expense. Purchases and loan principal affect cash and assets/debt, not operating profit.</p></section>;
}
