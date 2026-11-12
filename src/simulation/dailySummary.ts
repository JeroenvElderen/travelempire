import type {FleetState} from './taxi';

export type DayBaseline={day:string;discovered:number;harbours:number;cash:number;fleetSize:number};
export type DailySummary={
 day:string;revenue:number;expenses:number;net:number;taxiRevenue:number;
 ferryRevenue:number;otherRevenue:number;trips:number;distanceKm:number;
 roadsDiscovered:number;harboursDiscovered:number;fleetSize:number;
 activeExplorers:number;activeTaxis:number;cash:number;cashChange:number;
 fleetChange:number;loanBalance:number;partnershipRemaining:number;
 expenseBreakdown:{label:string;amount:number}[];
};
const round=(n:number)=>Math.round(n*100)/100;
export const gameDay=(epochMs:number)=>new Date(epochMs).toISOString().slice(0,10);
export function dayBaseline(day:string,fleet:FleetState,cash:number,harbours:number):DayBaseline{
 return {day,discovered:(fleet.exploredEdgeIds??[]).length,harbours,
  cash, fleetSize:fleet.taxis.length};
}
const expenseNames:Record<string,string>={fuel:'Fuel',maintenance:'Maintenance',exploration:'Exploration',
 payroll:'Payroll',insurance:'Insurance',overhead:'Overhead',interest:'Loan interest'};
export function buildDailySummary(day:string,fleet:FleetState,baseline:DayBaseline,
 cash:number,harbours:number):DailySummary{
 const records=(fleet.financeHistory??[]).filter(row=>row.day===day);
 const revenue=round(records.reduce((sum,row)=>sum+row.revenue,0));
 const expenses=round(records.reduce((sum,row)=>sum+row.expenses,0));
 const trips=records.reduce((sum,row)=>sum+row.trips,0);
 const vehicles=(fleet.vehicleFinanceHistory??[]).filter(row=>row.day===day);
 const taxiRevenue=round(vehicles.reduce((sum,row)=>sum+row.revenue,0));
 const distanceKm=round(vehicles.reduce((sum,row)=>sum+row.km,0));
 const ferryRevenue=round(Math.min(revenue,Math.max(0,fleet.ferryRevenueByDay?.[day]??0)));
 const expenseMap=new Map<string,number>();
 for(const record of records)for(const [category,amount] of Object.entries(record.categories??{}))
  expenseMap.set(category,(expenseMap.get(category)??0)+amount);
 const reported=[...expenseMap.values()].reduce((sum,v)=>sum+v,0);
 if(expenses>reported+.01)expenseMap.set('other',expenses-reported);
 const expenseBreakdown=[...expenseMap].filter(([,amount])=>amount>.005)
  .sort((a,b)=>b[1]-a[1]).map(([label,amount])=>({label:expenseNames[label]??'Other operating costs',amount:round(amount)}));
 return {day,revenue,expenses,net:round(revenue-expenses),taxiRevenue,ferryRevenue,
  otherRevenue:round(revenue-taxiRevenue-ferryRevenue),trips,distanceKm,
  roadsDiscovered:Math.max(0,(fleet.exploredEdgeIds??[]).length-baseline.discovered),
  harboursDiscovered:Math.max(0,harbours-baseline.harbours),
  fleetSize:fleet.taxis.length,activeExplorers:fleet.taxis.filter(t=>t.kind==='explorer').length,
  activeTaxis:fleet.taxis.filter(t=>t.kind!=='explorer').length,
  cash:round(cash),cashChange:round(cash-baseline.cash),
  fleetChange:fleet.taxis.length-baseline.fleetSize,
  loanBalance:round((fleet.loans??[]).reduce((sum,loan)=>sum+Math.max(0,loan.balance),0)),
  partnershipRemaining:round((fleet.bankPartnerships??[]).reduce((sum,d)=>sum+Math.max(0,d.repaymentCap-d.repaid),0)),
  expenseBreakdown};
}
export function readSummaryBaseline(companyId:string):DayBaseline|null{
 try{const data=JSON.parse(localStorage.getItem('travelempire.dayBaseline.v1.'+companyId)??'null') as DayBaseline|null;
  return data&&typeof data.day==='string'&&typeof data.discovered==='number'?data:null;
 }catch{return null;}
}
export function saveSummaryBaseline(companyId:string,baseline:DayBaseline):void{
 try{localStorage.setItem('travelempire.dayBaseline.v1.'+companyId,JSON.stringify(baseline));}catch{/* Private browsing */}
}
