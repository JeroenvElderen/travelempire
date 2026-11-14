/** Dedicated, bounded in-memory cash-flow audit. Does not mutate game state. */
export type FinancialAuditEntry={id:number;realTime:string;gameTime:string;kind:string;description:string;gross:number;operatingCost:number;bankShare:number;savings:number;other:number;cashDelta:number;cashBefore:number;cashAfter:number;pendingBefore:number;pendingAfter:number};
const events:FinancialAuditEntry[]=[];
let sequence=0;
const cents=(n:number)=>Math.round(n*100)/100;
export function recordFinancialAudit(entry:Omit<FinancialAuditEntry,'id'|'realTime'|'cashDelta'|'cashAfter'> & {cashDelta?:number;cashAfter?:number}){
 const cashDelta=cents(entry.cashDelta??(entry.gross-entry.operatingCost-entry.bankShare-entry.savings+entry.other));
 const cashAfter=cents(entry.cashAfter??(entry.cashBefore+cashDelta));
 events.push({...entry,id:++sequence,realTime:new Date().toISOString(),cashDelta,cashAfter});
 if(events.length>2000)events.shift();
}
export function financialAuditEntries(){return events.slice()}
export function clearFinancialAudit(){events.length=0}
export function financialAuditReport(){
 return ['TravelEmpire financial diagnostics', 'Exported: '+new Date().toISOString(),
 'Entries: '+events.length,'Note: cashBefore is the committed cash before this event; pendingBefore/After track unsettled changes. Cash changes from other game actions may be outside this audit until instrumented.',
 'id | real time | game time | kind | description | gross | operating cost | bank share | savings | other | cash delta | committed cash before | projected cash after | pending before | pending after',
 ...events.map(e=>[e.id,e.realTime,e.gameTime,e.kind,e.description,e.gross,e.operatingCost,e.bankShare,e.savings,e.other,e.cashDelta,e.cashBefore,e.cashAfter,e.pendingBefore,e.pendingAfter].join(' | '))].join('\n');
}
