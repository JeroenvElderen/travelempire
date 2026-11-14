import {useEffect,useState} from 'react';
import {Activity,ChevronDown,ChevronUp,ArrowDownLeft,ArrowUpRight,Landmark} from 'lucide-react';
import type {FinancePeriod,FinancialTransaction} from '../simulation/taxi';
import {dayFinance,dayExpenseBreakdown,recentActivity,type ActivityType} from '../simulation/liveFinance';
import './live-finance-ticker.css';

const euros=(value:number)=>new Intl.NumberFormat('en-IE',{
 style:'currency',currency:'EUR',maximumFractionDigits:2
}).format(Math.abs(value));
type Filter='all'|ActivityType;

export default function LiveFinanceTicker({history,transactions,bankCollectionsByDay,gameNow}:{
 history:readonly FinancePeriod[];transactions:readonly FinancialTransaction[];bankCollectionsByDay?:Readonly<Record<string,number>>;gameNow:number
}){
 const [index,setIndex]=useState(0);
 const [expanded,setExpanded]=useState(false);
 const [filter,setFilter]=useState<Filter>('all');
 const entries=recentActivity(transactions,20);
 const totals=dayFinance(history,gameNow);
 const bankPaid=bankCollectionsByDay?.[new Date(gameNow).toISOString().slice(0,10)]??0;
 const afterBankCash=totals.net-bankPaid;
 const gameDay=new Date(gameNow).toISOString().slice(0,10);
 const entryDay=(time:number)=>new Date(time).toISOString().slice(0,10);
 const expenses=expanded?dayExpenseBreakdown(history,gameNow):[];
 useEffect(()=>{
  if(expanded||entries.length<2)return;
  const timer=window.setInterval(()=>setIndex(i=>(i+1)%entries.length),4000);
  return()=>window.clearInterval(timer);
 },[expanded,entries.length]);
 const current=entries[index%Math.max(1,entries.length)];
 const visible=filter==='all'?entries:entries.filter(entry=>entry.type===filter);
 const renderAmount=(amount:number)=>(amount>=0?'+':'−')+euros(amount);
 return <div className="live-finance-wrap">
  <button type="button" className="live-finance-main" aria-expanded={expanded}
   aria-controls="live-finance-activity" onClick={()=>setExpanded(v=>!v)}>
   <span className="live-finance-heading"><span><Activity size={13}/> LIVE FINANCES</span>
    <span>{expanded?'Hide activity':'View activity'} {expanded?<ChevronUp size={12}/>:<ChevronDown size={12}/>}</span>
   </span>
   <span className="live-finance-totals">
    <span><small>INCOME · GAME DAY</small><strong className="income">+{euros(totals.income)}</strong></span>
    <span><small>EXPENSES · GAME DAY</small><strong className="expense">−{euros(totals.expenses)}</strong></span>
    <span><small>NET AFTER BANKS</small><strong className={afterBankCash>=0?'income':'expense'}>{renderAmount(afterBankCash)}</strong></span>
   </span>
   <span className="live-finance-current" aria-live="off">
    <span className="live-finance-current-label" key={current?.id??'none'}>
     {current?current.description+' · '+entryDay(current.time)+(entryDay(current.time)===gameDay?'':' · earlier game day'):'No transactions recorded yet'}
    </span>
    {current&&<strong className={current.type==='income'?'income':current.type==='expense'?'expense':'neutral'}>{renderAmount(current.amount)}</strong>}
   </span>
  </button>
  {expanded&&<div id="live-finance-activity" className="live-finance-panel">
   <div className="live-finance-panel-heading"><strong>Recent financial activity</strong><small>Latest 20 ledger entries</small></div>
   <div className="live-finance-filters" role="group" aria-label="Filter finance activity">
    {(['all','income','expense','financing'] as const).map(option=>
     <button type="button" key={option} aria-pressed={filter===option}
      className={filter===option?'selected':''} onClick={()=>setFilter(option)}>
      {option==='all'?'All':option==='income'?'Income':option==='expense'?'Expenses':'Financing'}</button>)}
   </div>
   <div className="live-finance-list" role="list">
    {visible.length===0?<p>No matching transactions yet.</p>:visible.map(entry=>
     <div className="live-finance-entry" role="listitem" key={entry.id}>
      {entry.type==='income'?<ArrowDownLeft size={15} className="income"/>:
       entry.type==='expense'?<ArrowUpRight size={15} className="expense"/>:
       <Landmark size={15} className="neutral"/>}
      <span className="live-finance-entry-description">{entry.description}
       <small>{entry.type==='financing'?'Financing / capital':entry.type==='income'?'Operating income':'Operating expense'} · {new Date(entry.time).toISOString().slice(0,16).replace('T',' ')} game UTC{entryDay(entry.time)===gameDay?'':' · earlier game day'}</small>
      </span>
      <strong className={entry.type==='income'?'income':entry.type==='expense'?'expense':'neutral'}>{renderAmount(entry.amount)}</strong>
     </div>)}
   </div>
   {expenses.length>0&&<div className="live-finance-breakdown">
    <strong>Today's expenses by category</strong>
    {expenses.map(expense=><div key={expense.category}>
     <span>{expense.label}</span><span className="expense">−{euros(expense.value)}</span>
    </div>)}
   </div>}
   <p className="live-finance-disclaimer">Game day {gameDay}. Headline totals use booked operating history for this game day; activity includes older transactions and financing flows. Operating profit today: {renderAmount(totals.net)} · Bank revenue-share collections: −{euros(bankPaid)} · Cash contribution after bank shares: {renderAmount(afterBankCash)}. This excludes vehicle purchases, other loan principal and savings transfers.</p>
  </div>}
 </div>;
}
