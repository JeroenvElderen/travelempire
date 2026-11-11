import type {FinancePeriod,FinancialTransaction} from './taxi';

export type ActivityType='income'|'expense'|'financing';
export type ActivityEntry=FinancialTransaction & {type:ActivityType};
export type DayFinance={income:number;expenses:number;net:number};

/** Use booked operating finance history for the daily P&L. The transactions
 * ledger includes financing and purchases, so summing it as income would
 * falsely count loans and transfers as revenue.
 */
export function dayFinance(history:readonly FinancePeriod[],gameNow:number):DayFinance{
 const day=new Date(gameNow).toISOString().slice(0,10);
 const totals=history.filter(period=>period.day===day).reduce((sum,p)=>({
  income:sum.income+(Number.isFinite(p.revenue)?p.revenue:0),
  expenses:sum.expenses+(Number.isFinite(p.expenses)?p.expenses:0)
 }),{income:0,expenses:0});
 return {...totals,net:totals.income-totals.expenses};
}
export function classifyActivity(transaction:FinancialTransaction):ActivityType{
 const description=transaction.description.toLowerCase();
 // The ledger's transaction sign alone is not sufficient. Borrowing money
 // isn't revenue; buying a vehicle isn't an operating expense; and loan
 // principal repayment isn't an operating cost.
 if(/loan|finance|financing|lease|capital|equity|share|transfer|reserve|savings|bank|deposit|investment|investor|acquisition|buyback|dividend|purchase|vehicle sale|asset sale|sale \(net|repossession|settlement/.test(description))
  return 'financing';
 return transaction.amount>=0?'income':'expense';
}
export function recentActivity(transactions:readonly FinancialTransaction[],limit=20):ActivityEntry[]{
 return transactions.filter(t=>Number.isFinite(t.amount)).slice(0,limit)
  .map(t=>({...t,type:classifyActivity(t)}));
}

export const EXPENSE_LABELS:Record<keyof NonNullable<FinancePeriod['categories']>,string>={
 fuel:'Petrol / refuelling',maintenance:'Maintenance / servicing',
 exploration:'Exploration',payroll:'Driver wages',
 insurance:'Insurance',overhead:'Overhead / depots',interest:'Loan interest'
};
export function dayExpenseBreakdown(history:readonly FinancePeriod[],gameNow:number){
 const day=new Date(gameNow).toISOString().slice(0,10);
 const sums=new Map<string,number>();
 let recorded=0;
 for(const period of history){
  if(period.day!==day||!period.categories)continue;
  for(const [category,value] of Object.entries(period.categories)){
   if(!Number.isFinite(value)||value<=0)continue;
   sums.set(category,(sums.get(category)??0)+value);
   recorded+=value;
  }
 }
 const other=Math.max(0,dayFinance(history,gameNow).expenses-recorded);
 if(other>.01)sums.set('other',other);
 return [...sums].filter(([,value])=>value>.005)
  .sort((a,b)=>b[1]-a[1])
  .map(([category,value])=>({category,
   label:EXPENSE_LABELS[category as keyof typeof EXPENSE_LABELS]??'Other operating costs',
   value}));
}
