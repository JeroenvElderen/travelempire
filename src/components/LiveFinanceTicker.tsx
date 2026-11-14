import {useState} from 'react';
import {Activity,ChevronDown,ChevronUp} from 'lucide-react';
import type {FinancePeriod,FinancialTransaction} from '../simulation/taxi';
import {dayFinance,dayExpenseBreakdown,classifyActivity} from '../simulation/liveFinance';
import './live-finance-ticker.css';

const euros=(value:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(Math.abs(value));
type Category={label:string;value:number};
function incomeCategories(transactions:readonly FinancialTransaction[],gameDay:string,revenue:number):Category[]{
 const sums=new Map<string,number>();
 for(const transaction of transactions){
  if(!Number.isFinite(transaction.time)||!Number.isFinite(transaction.amount)||transaction.amount<=0||
   new Date(transaction.time).toISOString().slice(0,10)!==gameDay||classifyActivity(transaction)!=='income')continue;
  const description=transaction.description.toLowerCase();
  const category=/ferry|passenger.*boat|ticket.*boat/.test(description)?'Ferry fares':
   /taxi|passenger|trip|fare/.test(description)?'Taxi fares':
   /hotel|room|property|rent|real estate/.test(description)?'Properties & hotels':
   /investment|dividend|interest/.test(description)?'Investments':'Other income';
  sums.set(category,(sums.get(category)??0)+transaction.amount);
 }
 // The saved transaction ledger is capped. Reconcile to the authoritative
 // daily operating revenue rather than presenting partial ledger totals.
 const captured=[...sums.values()].reduce((a,b)=>a+b,0);
 if(captured>revenue+.01&&captured>0){
  const factor=revenue/captured;
  for(const [key,value] of sums)sums.set(key,value*factor);
 }else if(revenue-captured>.01){
  sums.set('Other / unclassified revenue',(sums.get('Other / unclassified revenue')??0)+revenue-captured);
 }
 return [...sums].filter(([,value])=>value>.005).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
}
export default function LiveFinanceTicker({history,transactions,bankCollectionsByDay,gameNow}:{
 history:readonly FinancePeriod[];transactions:readonly FinancialTransaction[];bankCollectionsByDay?:Readonly<Record<string,number>>;gameNow:number
}){
 const [expanded,setExpanded]=useState(false);
 const [view,setView]=useState<'expense'|'income'>('expense');
 const gameDay=new Date(gameNow).toISOString().slice(0,10);
 const totals=dayFinance(history,gameNow);
 const bankPaid=bankCollectionsByDay?.[gameDay]??0;
 const afterBanks=totals.net-bankPaid;
 const categories=expanded?(view==='expense'
  ?dayExpenseBreakdown(history,gameNow).map(({label,value})=>({label,value}))
  :incomeCategories(transactions,gameDay,totals.income)):[];
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
