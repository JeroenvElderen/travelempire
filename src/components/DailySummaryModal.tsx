import {useEffect,useState} from 'react';
import {ArrowRight,BarChart3,Building2,CalendarCheck,CarFront,CheckCircle2,ChevronRight,Coins,Compass,CreditCard,Flag,Landmark,Layers3,Ship,Target,TrendingUp,Wallet,X,Wrench} from 'lucide-react';
import type {DailySummary} from '../simulation/dailySummary';
import './daily-summary.css';

const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n);
const compact=(n:number)=>new Intl.NumberFormat('en-IE',{notation:'compact',maximumFractionDigits:1}).format(n);
const signed=(n:number)=>(n>0?'+':'')+money(n);
const recorded=(n:number|null|undefined)=>n===null||n===undefined?'Not recorded':money(n);
const change=(current:number,previous:number|null)=>previous!==null&&Math.abs(previous)>.005?100*(current-previous)/Math.abs(previous):null;
type Detail='operations'|'exploration'|'fleet'|'maritime';
const sections=[{id:'operations',name:'Operations',Icon:CarFront},{id:'exploration',name:'Exploration',Icon:Compass},{id:'fleet',name:'Fleet',Icon:CarFront},{id:'maritime',name:'Maritime',Icon:Ship}] as const;
const shortDay=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
export default function DailySummaryModal({summary,onClose,valuation,creditScore,companyName='TravelEmpire',researchName}:{summary:DailySummary;onClose:()=>void;valuation?:number;creditScore?:number;companyName?:string;researchName?:string}){
 const [section,setSection]=useState<Detail>('operations');
 const [metric,setMetric]=useState<'revenue'|'profit'>('revenue');
 const [details,setDetails]=useState(false);
 useEffect(()=>{
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};
  document.addEventListener('keydown',key);
  return()=>document.removeEventListener('keydown',key);
 },[onClose]);
 const date=new Intl.DateTimeFormat('en-IE',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(summary.day+'T12:00:00Z'));
 const profitChange=change(summary.net,summary.previousNet);
 const revenueChange=change(summary.revenue,summary.previousRevenue);
 const margin=summary.revenue>0?100*summary.net/summary.revenue:0;
 const bankPaid=summary.bankRepayments??null;
 const afterBanks=summary.cashAfterBankRepayments??null;
 const otherCashMovements=summary.otherCashMovements??null;
 const openingCash=summary.openingCash??summary.cash-summary.cashChange;
 const lenderRows=summary.bankLenderRepayments??[];
 const series=summary.weekly;
 const values=series.map(p=>metric==='revenue'?p.revenue:p.profit);
 const min=Math.min(0,...values),max=Math.max(1,...values),range=max-min;
 const last=values.at(-1)??0;
 const mean=series.length?series.reduce((a,b)=>a+b.revenue,0)/series.length:0;
 const outlookLow=mean*.90,outlookHigh=mean*1.10;
 const highlights=[...(summary.roadsDiscovered>0?[{name:summary.roadsDiscovered.toLocaleString('en-IE')+' roads discovered',kind:'exploration' as Detail}]:[]),
  ...(summary.harboursDiscovered>0?[{name:summary.harboursDiscovered+' harbours unlocked',kind:'maritime' as Detail}]:[]),
  ...(summary.ferryCrossings>0?[{name:summary.ferryCrossings+' ferry crossings completed',kind:'maritime' as Detail}]:[]),
  ...(summary.fleetChange!==0?[{name:(summary.fleetChange>0?'+':'')+summary.fleetChange+' vehicles '+(summary.fleetChange>0?'added':'removed'),kind:'fleet' as Detail}]:[]),
  ...summary.events.map(name=>({name,kind:'operations' as Detail}))].slice(0,6);
 const detailsFor:Record<Detail,Array<[string,string]>>={
  operations:[['Passenger journeys',String(summary.trips)],['Taxi revenue',money(summary.taxiRevenue)],['Distance driven',summary.distanceKm.toFixed(1)+' km'],['Other income',money(summary.otherRevenue)]],
  exploration:[['New road segments',String(summary.roadsDiscovered)],['Harbours unlocked',String(summary.harboursDiscovered)],['Explorers in fleet',String(summary.activeExplorers)],['Total distance driven',summary.distanceKm.toFixed(1)+' km']],
  fleet:[['Total vehicles',String(summary.fleetSize)],['Passenger taxis',String(summary.activeTaxis)],['Explorers',String(summary.activeExplorers)],['Change today',(summary.fleetChange>=0?'+':'')+summary.fleetChange]],
  maritime:[['Ferry revenue',money(summary.ferryRevenue)],['Crossings recorded',String(summary.ferryCrossings)],['New harbours',String(summary.harboursDiscovered)],['Revenue share committed',summary.activeBankShare+'%']]
 };
 return <div className="te-day-overlay" role="presentation">
  <section className="te-day-dialog" role="dialog" aria-modal="true" aria-labelledby="te-day-title">
   <div className="te-day-scroll">
    <header className="te-day-hero">
     <div className="te-day-hero-top"><span className="te-day-logo"><span className="te-day-logo-icon">✈</span> Travel<span>Empire</span></span>
      <button type="button" className="te-day-close" aria-label="Close daily report" onClick={onClose}><X size={21}/></button>
     </div>
     <div className="te-day-hero-title"><CalendarCheck size={31}/><div><h2 id="te-day-title">Daily Empire Report</h2><p>{companyName} · {date}</p></div></div>
    </header>
    <section className="te-day-profit" aria-label="Daily profit">
     <div className="te-day-profit-symbol"><Coins size={39}/></div>
     <div><small>OPERATING PROFIT</small><strong className={summary.net>=0?'positive':'negative'}>{signed(summary.net)}</strong>
      <span className={profitChange===null?'te-day-muted':profitChange>=0?'positive':'negative'}>{profitChange===null?'First recorded comparison':(profitChange>=0?'▲ +':'▼ ')+profitChange.toFixed(1)+'% vs previous day'}</span></div>
    </section>
    <div className="te-day-finance">
     <article><Wallet size={19}/><small>REVENUE</small><strong>{money(summary.revenue)}</strong><span className={revenueChange===null?'te-day-muted':revenueChange>=0?'positive':'negative'}>{revenueChange===null?'Gross income':(revenueChange>=0?'▲ +':'▼ ')+revenueChange.toFixed(1)+'%'}</span></article>
     <article><Layers3 size={19}/><small>EXPENSES</small><strong>{money(summary.expenses)}</strong><span>Operating costs</span></article>
     <article><Target size={19}/><small>OPERATING MARGIN</small><strong>{margin.toFixed(1)}%</strong><span>Before bank financing</span></article>
    </div>
    <section className="te-day-panel te-day-cash-reconciliation" aria-label="Revenue-share repayments and cash reconciliation">
     <h3><Landmark size={20}/> Bank repayments & cash</h3>
     <div className="te-day-cash-grid">
      <div><small>Bank revenue shares · {summary.activeBankShare}% active</small><strong className="negative">{bankPaid===null?'Not recorded':'−'+money(bankPaid)}</strong></div>
      <div><small>Operating result after bank shares</small><strong className={afterBanks!==null&&afterBanks<0?'negative':'positive'}>{recorded(afterBanks)}</strong></div>
      <div><small>Closing cash balance</small><strong className={summary.cash<0?'negative':'positive'}>{money(summary.cash)}</strong></div>
     </div>
     {lenderRows.length>0&&<div className="te-day-lender-list">
      {lenderRows.map(row=><div key={row.bank}><span>{row.bank} · {row.sharePercent}% share</span><strong className="negative">−{money(row.amount)}</strong></div>)}
     </div>}
     <p className="te-day-muted">Bank repayments are deducted from settled taxi and ferry receipts. They reduce cash, but are not operating expenses. The after-bank result does not include purchases, account transfers or other financing cash flows.</p>
     {bankPaid===null&&<p className="te-day-muted">Historical bank deductions were not recorded per game day in older saves. Future daily reports will show actual collected amounts; no estimated 41% charge is substituted.</p>}
     {summary.cash<0&&<p className="te-day-cash-warning" role="alert">Operating cash is negative. The day's positive operating profit does not by itself explain the cash balance. Review the reconciliation below for other cash movements and timing differences.</p>}
     <div className="te-day-cash-details">
      <h4>Operating cash reconciliation</h4>
      <div className="te-day-list">
       <div><span>Opening operating cash</span><strong>{money(openingCash)}</strong></div>
       <div><span>Operating profit before bank financing</span><strong>{signed(summary.net)}</strong></div>
       <div><span>Revenue-share repayments</span><strong className="negative">{bankPaid===null?'Not recorded':'−'+money(bankPaid)}</strong></div>
       <div><span>Other cash movements / timing adjustments</span><strong>{recorded(otherCashMovements)}</strong></div>
       <div><span>Closing operating cash</span><strong className={summary.cash<0?'negative':''}>{money(summary.cash)}</strong></div>
      </div>
      <p className="te-day-muted">{bankPaid===null?'Complete reconciliation is unavailable for this historical game day.':'The other-movements remainder balances opening and closing cash; it may include vehicle purchases, loan principal, taxes, transfers and unrecorded adjustments. It is not a fully itemised cash ledger.'}</p>
     </div>
    </section>
    <nav className="te-day-categories" aria-label="Daily report categories">
     {sections.map(({id,name,Icon})=><button type="button" key={id} className={section===id?'active '+id:id} aria-pressed={section===id} onClick={()=>setSection(id)}>
      <Icon size={23}/><span>{name}</span></button>)}
    </nav>
    <section className="te-day-selected" aria-label={section+' details'}>
     <div className="te-day-selected-head"><strong>{sections.find(item=>item.id===section)?.name} at a glance</strong><span>Completed day</span></div>
     <div className="te-day-selected-grid">{detailsFor[section].map(([label,value])=><div key={label}><small>{label}</small><strong>{value}</strong></div>)}</div>
    </section>
    <div className="te-day-overview-grid">
     <section className="te-day-panel"><h3><Building2 size={20}/> Empire Overview</h3>
      <div className="te-day-list">
       {typeof valuation==='number'&&<div><span>Company valuation</span><strong>{money(valuation)}</strong></div>}
       <div><span>Cash balance</span><strong>{money(summary.cash)}</strong></div>
       <div><span>Total loan debt</span><strong>{money(summary.loanBalance)}</strong></div>
       <div><span>Partnership obligations</span><strong>{money(summary.partnershipRemaining)}</strong></div>
       {typeof creditScore==='number'&&<div><span>Credit score</span><strong>{creditScore} / 850</strong></div>}
      </div>
     </section>
     <section className="te-day-panel"><h3><Flag size={20}/> Key Events Today</h3>
      {highlights.length?<ul className="te-day-events">{highlights.map((event,i)=><li key={i}><CheckCircle2 size={16}/><span>{event.name}</span></li>)}</ul>:<p className="te-day-muted">No major milestones recorded. Your empire kept operating.</p>}
      {researchName&&<p className="te-day-research"><TrendingUp size={15}/> Research active: {researchName}</p>}
     </section>
    </div>
    <section className="te-day-panel te-day-trends">
     <div className="te-day-chart-heading"><div className="te-day-switch" role="group" aria-label="Chart metric">
      <button type="button" className={metric==='revenue'?'active':''} aria-pressed={metric==='revenue'} onClick={()=>setMetric('revenue')}>Revenue</button>
      <button type="button" className={metric==='profit'?'active':''} aria-pressed={metric==='profit'} onClick={()=>setMetric('profit')}>Profit</button></div><span>Last 7 days</span></div>
     <div className="te-day-chart">
      <div className="te-day-bars">{series.map((item,i)=>{const v=values[i];return <div key={item.day} className="te-day-bar-wrap" title={shortDay(item.day)+' · '+money(v)}><div className="te-day-bar" style={{height:Math.max(4,100*(Math.max(0,v-min))/range)+'%'}}/><small>{shortDay(item.day)}</small></div>})}
       {!series.length&&<span className="te-day-muted">No chart history yet</span>}</div>
      <div className="te-day-chart-total"><strong>{money(last)}</strong><small>{metric==='revenue'?'Latest revenue':'Latest profit'}</small></div>
     </div>
    </section>
    <section className="te-day-panel te-day-outlook"><h3><Target size={20}/> Next Day Outlook <ChevronRight size={18}/></h3>
     <div className="te-day-list">
      <div><span><Wrench size={16}/> Operating fleet</span><strong>{summary.fleetSize} vehicles</strong></div>
      <div><span><CreditCard size={16}/> Outstanding loans</span><strong>{money(summary.loanBalance)}</strong></div>
      <div><span><Landmark size={16}/> Bank partnership shares</span><strong>{summary.activeBankShare}%</strong></div>
      <div><span><BarChart3 size={16}/> Expected revenue (estimate)</span><strong>{series.length?compact(outlookLow)+'–'+compact(outlookHigh):'Not available'}</strong></div>
     </div><p className="te-day-muted">Forecast uses recorded daily revenue; not a guaranteed result.</p>
    </section>
    <div className="te-day-detail-toggle"><button type="button" aria-expanded={details} onClick={()=>setDetails(v=>!v)}><BarChart3 size={17}/> {details?'Hide financial breakdown':'View Details'} <ChevronRight size={16}/></button></div>
    {details&&<section className="te-day-panel te-day-breakdown"><h3>Detailed Financial Breakdown</h3>
     <div className="te-day-list">
      <div><span>Taxi revenue</span><strong className="positive">{money(summary.taxiRevenue)}</strong></div>
      <div><span>Ferry revenue</span><strong className="positive">{money(summary.ferryRevenue)}</strong></div>
      <div><span>Other income</span><strong className="positive">{money(summary.otherRevenue)}</strong></div>
      {summary.expenseBreakdown.map(entry=><div key={entry.label}><span>{entry.label}</span><strong className="negative">−{money(entry.amount)}</strong></div>)}
      <div><span>Operating profit (before bank shares)</span><strong>{signed(summary.net)}</strong></div>
      <div><span>Bank financing repayments</span><strong className="negative">{bankPaid===null?'Not recorded':'−'+money(bankPaid)}</strong></div>
      <div><span>Operating result after bank shares</span><strong>{recorded(afterBanks)}</strong></div>
      <div><span>Opening operating cash</span><strong>{money(openingCash)}</strong></div>
      <div><span>Other cash movements / timing adjustments</span><strong>{recorded(otherCashMovements)}</strong></div>
      <div><span>Closing operating cash</span><strong className={summary.cash<0?'negative':''}>{money(summary.cash)}</strong></div>
      <div><span>Closing cash change</span><strong>{signed(summary.cashChange)}</strong></div>
     </div><p className="te-day-muted">Revenue-share repayments, capital injections and loan principal are excluded from operating profit. 'Other cash movements' is a reconciliation remainder, not an itemised explanation.</p>
    </section>}
    <footer className="te-day-footer"><button type="button" onClick={onClose}><ArrowRight size={19}/> Continue to Next Day</button></footer>
   </div>
  </section>
 </div>;
}
