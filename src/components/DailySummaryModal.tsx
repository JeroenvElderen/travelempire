import type {DailySummary} from '../simulation/dailySummary';
import './daily-summary.css';
const money=(n:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(n);
const signed=(n:number)=>(n>0?'+':'')+money(n);
export default function DailySummaryModal({summary,onClose}:{summary:DailySummary;onClose:()=>void}){
 const date=new Intl.DateTimeFormat('en-IE',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(summary.day+'T12:00:00Z'));
 return <div className="te-day-overlay" role="presentation">
  <section className="te-day-dialog" role="dialog" aria-modal="true" aria-labelledby="te-day-title">
   <header className="te-day-header"><div><small>TRAVELEMPIRE · DAILY REPORT</small><h2 id="te-day-title">Day complete</h2><p>{date}</p></div>
    <button type="button" aria-label="Close daily report" onClick={onClose}>✕</button></header>
   <div className="te-day-scroll">
    <div className="te-day-net"><small>OPERATING PROFIT</small><strong className={summary.net>=0?'positive':'negative'}>{signed(summary.net)}</strong><span>Revenue {money(summary.revenue)} · Expenses {money(summary.expenses)}</span></div>
    <div className="te-day-grid">
     <article><small>Passenger fares</small><strong>{money(summary.taxiRevenue)}</strong></article>
     <article><small>Ferry income</small><strong>{money(summary.ferryRevenue)}</strong></article>
     <article><small>Other income</small><strong>{money(summary.otherRevenue)}</strong></article>
     <article><small>Passenger journeys</small><strong>{summary.trips.toLocaleString('en-IE')}</strong></article>
     <article><small>Distance driven</small><strong>{summary.distanceKm.toLocaleString('en-IE')} km</strong></article>
     <article><small>New roads discovered</small><strong>{summary.roadsDiscovered.toLocaleString('en-IE')}</strong></article>
     <article><small>New harbours</small><strong>{summary.harboursDiscovered.toLocaleString('en-IE')}</strong></article>
     <article><small>Fleet changes</small><strong>{summary.fleetChange>=0?'+':''}{summary.fleetChange}</strong></article>
    </div>
    <h3>Expense breakdown</h3>
    {summary.expenseBreakdown.length?<div className="te-day-rows">{summary.expenseBreakdown.map(x=><div key={x.label}><span>{x.label}</span><strong>{money(x.amount)}</strong></div>)}</div>:<p className="te-day-subtle">No operating expenses were recorded.</p>}
    <h3>Company position</h3>
    <div className="te-day-rows">
     <div><span>Closing cash balance</span><strong>{money(summary.cash)}</strong></div>
     <div><span>Cash change during day</span><strong>{signed(summary.cashChange)}</strong></div>
     <div><span>Operating taxis / explorers</span><strong>{summary.activeTaxis} / {summary.activeExplorers}</strong></div>
     <div><span>Outstanding loan balances</span><strong>{money(summary.loanBalance)}</strong></div>
     <div><span>Revenue partnership obligations</span><strong>{money(summary.partnershipRemaining)}</strong></div>
    </div>
    <p className="te-day-subtle">Operating profit excludes loan funding, capital transactions and principal repayments. Cash movement includes financing, purchases and transfers. Road and harbour counts compare the start and end snapshots.</p>
   </div>
   <footer className="te-day-footer"><button type="button" onClick={onClose}>Continue to next day</button></footer>
  </section>
 </div>;
}
