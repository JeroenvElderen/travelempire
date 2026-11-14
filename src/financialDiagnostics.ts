/** Financial audit: observational only. No writes to the economy or bank balances. */
export type FinancialBreakdown=Record<string,number>;
export type FinancialAuditEntry={
 id:number;realTime:string;gameTime:string;kind:string;description:string;
 gross:number;operatingCost:number;bankShare:number;savings:number;other:number;
 cashDelta:number;cashBefore:number;cashAfter:number;pendingBefore:number;pendingAfter:number;
 breakdown?:FinancialBreakdown;bankLenders?:FinancialBreakdown;reference?:string;
 discrepancy?:number;warnings?:string[];
};
type Input=Omit<FinancialAuditEntry,'id'|'realTime'|'cashDelta'|'cashAfter'|'discrepancy'|'warnings'> & {cashDelta?:number;cashAfter?:number};
const events:FinancialAuditEntry[]=[];
let sequence=0;
const cents=(n:number)=>Math.round(n*100)/100;
const finite=(n:number)=>Number.isFinite(n)?cents(n):0;
const fmt=(n:number)=>finite(n).toFixed(2);
export function recordFinancialAudit(entry:Input){
 const cashDelta=finite(entry.cashDelta??(entry.gross-entry.operatingCost-entry.bankShare-entry.savings+entry.other));
 const cashAfter=finite(entry.cashAfter??(entry.cashBefore+entry.pendingAfter));
 // A flush transfers pending cash into committed cash; it is not a new settlement.
 const discrepancy=entry.kind==='cash-flush'
  ?finite((entry.cashAfter-entry.cashBefore)-entry.other)
  :finite((entry.pendingAfter-entry.pendingBefore)-cashDelta);
 const warnings:string[]=[];
 if(Math.abs(discrepancy)>0.02&&entry.kind!=='cash-flush'&&entry.kind!=='property')
  warnings.push('Pending cash changed by '+fmt(entry.pendingAfter-entry.pendingBefore)+' but recorded event delta is '+fmt(cashDelta));
 if(entry.kind==='cash-flush'&&Math.abs(discrepancy)>0.02)
  warnings.push('Cash flush does not match committed balance difference');
 // Compare the next event's opening committed/pending balance with the last
 // event's closing values. A discontinuity can indicate an uninstrumented
 // purchase, transfer or reload; it is not proof of missing money.
 const previous=events[events.length-1];
 if(previous){
  const committedGap=finite(entry.cashBefore-previous.cashBefore-
   (previous.kind==='cash-flush'?previous.other:0));
  const pendingGap=finite(entry.pendingBefore-previous.pendingAfter);
  if(Math.abs(committedGap)>0.02||Math.abs(pendingGap)>0.02)
   warnings.push('Untraced balance change since prior audit event: committed '+
    fmt(committedGap)+', pending '+fmt(pendingGap)+
    '. Could be a purchase, transfer, reload or another uninstrumented action.');
 }
 if(entry.kind!=='cash-flush'&&entry.gross>0&&entry.bankShare>entry.gross*0.45001+0.02)
  warnings.push('Bank deduction exceeds 45% of gross receipts');
 if(entry.cashBefore+entry.pendingBefore>=0&&cashAfter<0)
  warnings.push('Operating cash crossed below zero');
 const result:FinancialAuditEntry={...entry,id:++sequence,realTime:new Date().toISOString(),cashDelta,cashAfter,discrepancy,warnings};
 events.push(result);
 if(events.length>5000)events.shift();
}
export function financialAuditEntries(){return events.slice()}
export function clearFinancialAudit(){events.length=0}
export function financialAuditTotals(input:readonly FinancialAuditEntry[]){
 const settlements=input.filter(e=>e.kind!=='cash-flush'&&e.kind!=='cash-snapshot');
 const sum=(key:keyof Pick<FinancialAuditEntry,'gross'|'operatingCost'|'bankShare'|'savings'|'other'|'cashDelta'>)=>cents(settlements.reduce((a,e)=>a+e[key],0));
 const byCategory:FinancialBreakdown={};
 const byLender:FinancialBreakdown={};
 for(const e of settlements){
  for(const [k,v] of Object.entries(e.breakdown??{}))byCategory[k]=cents((byCategory[k]??0)+v);
  for(const [k,v] of Object.entries(e.bankLenders??{}))byLender[k]=cents((byLender[k]??0)+v);
 }
 return {gross:sum('gross'),operatingCost:sum('operatingCost'),bankShare:sum('bankShare'),savings:sum('savings'),other:sum('other'),cashDelta:sum('cashDelta'),byCategory,byLender,warnings:input.filter(e=>(e.warnings?.length??0)>0).length};
}
const stringify=(v:unknown)=>JSON.stringify(v);
export function financialAuditReport(){
 const totals=financialAuditTotals(events);
 const first=events[0],last=events[events.length-1];
 return [
 'TravelEmpire — detailed financial audit (read-only)','Exported UTC: '+new Date().toISOString(),
 'Capture: '+(first?.realTime??'none')+' to '+(last?.realTime??'none'),
 'Entries: '+events.length+'; warning events: '+totals.warnings,
 'Important: this captures instrumented events only, not complete historical bookkeeping. Cash snapshots and flushes are excluded from settlement totals. Never interpret missing categories as zero spending.',
 'Total receipts: EUR '+fmt(totals.gross),'Operating expenses: EUR '+fmt(totals.operatingCost),
 'Bank revenue-share deductions: EUR '+fmt(totals.bankShare),'Savings transfers: EUR '+fmt(totals.savings),
 'Other signed cash movements: EUR '+fmt(totals.other),'Recorded settlement cash delta: EUR '+fmt(totals.cashDelta),
 'EXPENSE BREAKDOWN: '+stringify(totals.byCategory),'BANK LENDERS: '+stringify(totals.byLender),
 '--- CHRONOLOGICAL EVENT RECORDS (JSONL; amounts EUR) ---',
 ...events.map(e=>stringify(e))
 ].join('\n');
}
