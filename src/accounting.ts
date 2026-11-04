import type {AccountingPeriod,AccountingSettings,AccountingState,FleetState} from './simulation/taxi';
export const DEFAULT_ACCOUNTING_SETTINGS:AccountingSettings={corporateRate:22,vatRate:13,settlement:'monthly'};
export const roundMoney=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export function accountingOf(value?:AccountingState):AccountingState{
 return {settings:{...DEFAULT_ACCOUNTING_SETTINGS,...value?.settings},periods:value?.periods??[],lastSettledMonth:value?.lastSettledMonth};
}
export function periodMonth(epochMs:number){return new Date(epochMs).toISOString().slice(0,7);}
export function vatIncluded(gross:number,rate:number){return gross*rate/(100+rate);}
export function taxDue(period:AccountingPeriod,rate:number){
 const taxableProfit=Math.max(0,period.netRevenue-period.netExpenses-period.depreciation);
 return roundMoney(taxableProfit*rate/100);
}
export function periodLiability(period:AccountingPeriod){
 return Math.max(0,roundMoney(period.vatCollected-period.vatInput-period.vatPaid))+Math.max(0,roundMoney(period.corporateTax-period.corporateTaxPaid));
}
export function bookAccounting(value:AccountingState|undefined,month:string,grossRevenue:number,grossExpenses:number,vatEligibleExpenses:number,depreciation:number){
 const state=accountingOf(value),rate=state.settings.vatRate;
 const periods=state.periods.map(p=>({...p}));
 let period=periods.find(p=>p.month===month);
 if(!period){period={month,grossRevenue:0,netRevenue:0,grossExpenses:0,netExpenses:0,vatCollected:0,vatInput:0,depreciation:0,corporateTax:0,vatPaid:0,corporateTaxPaid:0,closed:false};periods.push(period);}
 const outputVat=vatIncluded(Math.max(0,grossRevenue),rate);
 const inputVat=vatIncluded(Math.max(0,Math.min(grossExpenses,vatEligibleExpenses)),rate);
 period.grossRevenue+=grossRevenue;
 period.netRevenue+=grossRevenue-outputVat;
 period.grossExpenses+=grossExpenses;
 period.netExpenses+=grossExpenses-inputVat;
 period.vatCollected+=outputVat;
 period.vatInput+=inputVat;
 period.depreciation+=depreciation;
 period.corporateTax=taxDue(period,state.settings.corporateRate);
 periods.sort((a,b)=>a.month.localeCompare(b.month));
 return {...state,periods:periods.slice(-120)};
}
export function settleAccounting(value:AccountingState|undefined,currentMonth:string,availableCash:number){
 const state=accountingOf(value),periods=state.periods.map(p=>({...p}));
 let remaining=Math.max(0,availableCash);
 let paidVat=0,paidCorporate=0;
 for(const period of periods){
  if(period.month>=currentMonth)continue;
  period.closed=true;
  const vat=Math.max(0,roundMoney(period.vatCollected-period.vatInput-period.vatPaid));
  const vatPayment=Math.min(vat,Math.floor(remaining*100)/100);
  period.vatPaid=roundMoney(period.vatPaid+vatPayment);remaining-=vatPayment;paidVat+=vatPayment;
  const tax=Math.max(0,roundMoney(period.corporateTax-period.corporateTaxPaid));
  const taxPayment=Math.min(tax,Math.floor(remaining*100)/100);
  period.corporateTaxPaid=roundMoney(period.corporateTaxPaid+taxPayment);remaining-=taxPayment;paidCorporate+=taxPayment;
 }
 return {accounting:{...state,periods,lastSettledMonth:currentMonth},paidVat:roundMoney(paidVat),paidCorporate:roundMoney(paidCorporate)};
}
export function vehicleBookValue(t:FleetState['taxis'][number]){
 if(t.ownership==='leased')return 0;
 const cost=t.purchasePrice??15000;
 return Math.max(0,cost-(t.accumulatedDepreciation??0));
}
export function depreciationTick(t:FleetState['taxis'][number],seconds:number){
 if(t.ownership==='leased')return 0;
 const price=t.purchasePrice??15000;
 return Math.max(0,Math.min(vehicleBookValue(t),price*seconds/(365*5*86400)));
}
export function balanceSheet(fleet:FleetState,operatingCash:number){
 const bank=fleet.bank;
 const cash=operatingCash+(bank?.savings??0)+(bank?.reserve??0);
 const vehicles=fleet.taxis.reduce((sum,t)=>sum+vehicleBookValue(t),0);
 const loans=(fleet.loans??[]).reduce((sum,l)=>sum+l.balance,0);
 const taxLiabilities=accountingOf(fleet.accounting).periods.reduce((sum,p)=>sum+periodLiability(p),0);
 return {cash,vehicles,assets:cash+vehicles,loans,taxLiabilities,liabilities:loans+taxLiabilities,equity:cash+vehicles-loans-taxLiabilities};
}
