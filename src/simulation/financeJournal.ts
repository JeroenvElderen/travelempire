import type {FinancePeriod} from './taxi';

/** Authoritative per-day operational category postings, not a reconstruction
 * from the 100-item recent activity list. The day totals remain the P&L source.
 * Amounts are positive magnitudes; the side identifies income or expense.
 */
export type FinancePosting={day:string;side:'income'|'expense';category:string;amount:number};
export type FinanceJournal=Record<string,Record<string,number>>;
export const FINANCE_CATEGORY_LABELS:Record<string,string>={
 'taxi.fares':'Taxi passenger fares',
 'ferry.fares':'Ferry fares',
 'ferry.operations':'Ferry operating costs',
 'property.rental':'Property income',
 'hotel.rooms':'Hotel accommodation & services',
 'hotel.operations':'Hotel operating costs',
 'collector.operations':'Resource collection operating costs',
 'construction.crew':'Construction crew wages',
 'construction.supplies':'Construction materials & deliveries',
 'hotel.staff':'Hotel staffing',
 'taxi.fuel':'Taxi fuel & charging',
 'taxi.maintenance':'Taxi maintenance & servicing',
 'taxi.payroll':'Driver wages',
 'taxi.insurance':'Vehicle insurance',
 'exploration.operations':'Exploration operating costs',
 'depot.facilities':'Depot facilities',
 'company.overhead':'Company overhead',
 'finance.interest':'Loan interest',
 'vehicle.leases':'Vehicle lease operating costs',
 'legacy.income':'Legacy income · original category unavailable',
 'legacy.expense':'Legacy expenses · original category unavailable',
};
const finitePositive=(value:number)=>Number.isFinite(value)&&value>0?value:0;
export function postFinance(journal:FinanceJournal|undefined,postings:readonly FinancePosting[]):FinanceJournal{
 if(!postings.length)return journal??{};
 const next={...(journal??{})};
 for(const posting of postings){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(posting.day)||!posting.category||
   !Number.isFinite(posting.amount)||posting.amount<=0)continue;
  const key=posting.day+'|'+posting.side;
  const old=next[key]??{};
  next[key]={...old,[posting.category]:(old[posting.category]??0)+posting.amount};
 }
 // Keep 365 simulated days without growing localStorage indefinitely.
 const days=[...new Set(Object.keys(next).map(key=>key.slice(0,10)))].sort();
 for(const day of days.slice(0,-365)){delete next[day+'|income'];delete next[day+'|expense'];}
 return next;
}
export type FinanceCategoryRow={category:string;label:string;value:number};
export function detailedFinanceBreakdown(
 journal:FinanceJournal|undefined,history:readonly FinancePeriod[],gameNow:number,side:'income'|'expense',
):FinanceCategoryRow[]{
 const day=new Date(gameNow).toISOString().slice(0,10);
 const amount=history.filter(p=>p.day===day).reduce((sum,p)=>
  sum+finitePositive(side==='income'?p.revenue:p.expenses),0);
 const values=journal?.[day+'|'+side]??{};
 const recorded=Object.entries(values).filter(([,v])=>finitePositive(v)>0);
 const sum=recorded.reduce((total,[,v])=>total+v,0);
 const scale=sum>amount+.005&&sum>0?amount/sum:1;
 const rows=recorded.map(([category,value])=>({
  category,label:FINANCE_CATEGORY_LABELS[category]??category.replace(/[._]/g,' '),
  value:value*scale,
 }));
 const missing=Math.max(0,amount-sum);
 if(missing>.005)rows.push({
  category:'legacy.'+side,
  label:FINANCE_CATEGORY_LABELS['legacy.'+side],value:missing,
 });
 return rows.filter(row=>row.value>.005).sort((a,b)=>b.value-a.value);
}


/** All date ranges refer to the simulation's existing UTC day keys. */
export function financePeriodRows(history:readonly FinancePeriod[],gameNow:number,days:number):FinancePeriod[]{
 const end=new Date(gameNow).toISOString().slice(0,10);
 const start=new Date(gameNow-(Math.max(1,Math.floor(days))-1)*86400000).toISOString().slice(0,10);
 return history.filter(row=>row.day>=start&&row.day<=end).sort((a,b)=>a.day.localeCompare(b.day));
}
export type DivisionFinanceRow={division:string;revenue:number;expenses:number;profit:number;margin:number|null};
const DIVISION_LABELS:Record<string,string>={
 taxi:'Taxis & road fleet',ferry:'Ferries',property:'Property & parking',hotel:'Hotels',
 construction:'Construction',collector:'Resource logistics',exploration:'Exploration',
 depot:'Depot facilities',company:'Company overhead',finance:'Financing',vehicle:'Vehicle leases',
 legacy:'Unclassified / legacy',
};
export function divisionFinanceReport(journal:FinanceJournal|undefined,history:readonly FinancePeriod[]):DivisionFinanceRow[]{
 const totals=new Map<string,{revenue:number;expenses:number}>();
 const days=new Map<string,FinancePeriod>();
 for(const row of history){
  const previous=days.get(row.day);
  days.set(row.day,{day:row.day,revenue:(previous?.revenue??0)+finitePositive(row.revenue),expenses:(previous?.expenses??0)+finitePositive(row.expenses),trips:0});
 }
 for(const row of days.values()){
  const at=Date.parse(row.day+'T00:00:00Z');
  if(!Number.isFinite(at))continue;
  for(const side of ['income','expense'] as const){
   for(const entry of detailedFinanceBreakdown(journal,[row],at,side)){
    const prefix=entry.category.split('.')[0];
    const division=DIVISION_LABELS[prefix]??'Other recorded activity';
    const sum=totals.get(division)??{revenue:0,expenses:0};
    if(side==='income')sum.revenue+=entry.value;else sum.expenses+=entry.value;
    totals.set(division,sum);
   }
  }
 }
 return [...totals].map(([division,v])=>({...v,division,profit:v.revenue-v.expenses,margin:v.revenue>0?(v.revenue-v.expenses)/v.revenue*100:null}))
  .sort((a,b)=>b.revenue-a.revenue||b.expenses-a.expenses||a.division.localeCompare(b.division));
}

/** Add a posted operating expense to the daily history without disturbing
 * other divisions' totals, including a delayed posting to an older day. */
export function recordDailyOperatingExpense(history:readonly FinancePeriod[]|undefined,day:string,amount:number):FinancePeriod[]{
 const rows=[...(history??[])];
 if(!Number.isFinite(amount)||amount<=0)return rows;
 const i=rows.findIndex(row=>row.day===day);
 if(i>=0)rows[i]={...rows[i],expenses:rows[i].expenses+amount};
 else rows.push({day,revenue:0,expenses:amount,trips:0});
 return rows.sort((a,b)=>a.day.localeCompare(b.day)).slice(-365);
}
