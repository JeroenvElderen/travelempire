import {useState} from 'react';
import {Activity,ChevronDown,ChevronUp} from 'lucide-react';
import type {FinancePeriod,FinancialTransaction} from '../simulation/taxi';
import {detailedFinanceBreakdown,type FinanceJournal} from '../simulation/financeJournal';
import {dayFinance} from '../simulation/liveFinance';
import './live-finance-ticker.css';

const euros=(value:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Math.abs(value));
export default function LiveFinanceTicker({history,transactions,financeJournal,bankCollectionsByDay,gameNow}:{
 history:readonly FinancePeriod[];transactions:readonly FinancialTransaction[];financeJournal?:FinanceJournal;bankCollectionsByDay?:Readonly<Record<string,number>>;gameNow:number
}){
 const [expanded,setExpanded]=useState(false);
 const [view,setView]=useState<'expense'|'income'>('expense');
 const gameDay=new Date(gameNow).toISOString().slice(0,10);
 void transactions;
 const totals=dayFinance(history,gameNow);
 const bankPaid=bankCollectionsByDay?.[gameDay]??0;
 const afterBanks=totals.net-bankPaid;
 const categories=expanded?detailedFinanceBreakdown(financeJournal,history,gameNow,view==='income'?'income':'expense'):[];
 const categoryTotal=view==='expense'?totals.expenses:totals.income;
 const renderAmount=(amount:number)=>(amount>=0?'+':'−')+euros(amount);
 return <div className="live-finance-wrap">
  <button type="button" className="live-finance-main" aria-expanded={expanded}
   aria-controls="live-finance-activity" onClick={()=>setExpanded(v=>!v)}>
   <span className="live-finance-summary">
    <span className="live-finance-summary-title"><Activity size={17} aria-hidden="true"/> Today</span>
    <strong className={afterBanks>=0?'income':'expense'}>{renderAmount(afterBanks)}</strong>
    {expanded?<ChevronUp size={17} aria-hidden="true"/>:<ChevronDown size={17} aria-hidden="true"/>}
   </span>
  </button>
  {expanded&&<div id="live-finance-activity" className="live-finance-panel">
   <div className="live-finance-overview">
    <div><span>Revenue</span><strong className="income">{euros(totals.income)}</strong></div>
    <div><span>Expenses</span><strong className="expense">{euros(totals.expenses)}</strong></div>
    <div><span>After banks</span><strong className={afterBanks>=0?'income':'expense'}>{renderAmount(afterBanks)}</strong></div>
   </div>
   <div className="live-finance-category-tabs" role="group" aria-label="Finance category view">
    <button type="button" className={view==='expense'?'selected':''} aria-pressed={view==='expense'} onClick={()=>setView('expense')}>Expenses by Category</button>
    <button type="button" className={view==='income'?'selected':''} aria-pressed={view==='income'} onClick={()=>setView('income')}>Income by Category</button>
   </div>
   <div className="live-finance-panel-heading"><strong>{view==='expense'?'Expenses':'Income'} by Category</strong><small>{gameDay}</small></div>
   <div className="live-finance-category-list">
    {categories.length===0?<p>No {view==='expense'?'expenses':'income'} recorded for today.</p>:categories.map(category=>{
     const share=categoryTotal>0?Math.min(100,100*category.value/categoryTotal):0;
     return <div className="live-finance-category-row" key={category.label}>
      <div className="live-finance-category-meta"><span>{category.label}</span><strong className={view==='expense'?'expense':'income'}>{euros(category.value)}</strong><small>{share.toFixed(1)}%</small></div>
      <div className="live-finance-category-track"><span style={{width:`${share}%`}}/></div>
     </div>;
    })}
   </div>
  </div>}
 </div>;
}
