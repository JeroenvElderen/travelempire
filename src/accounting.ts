import type {AccountingPeriod,AccountingSettings,AccountingState,FleetState} from './simulation/taxi';
export type TaxJurisdiction={code:string;name:string;corporateRate:number;standardVatRate:number;transportVatRate:number;vatFrequencyMonths:number;vatDueDay:number;corporateDueMonth:number;corporateDueDay:number;source:string};
/** Default profiles for the simulation; specialist exemptions and local registrations require separate classification. */
export const TAX_JURISDICTIONS:Record<string,TaxJurisdiction>={
 GR:{code:'GR',name:'Greece',corporateRate:22,standardVatRate:24,transportVatRate:13,vatFrequencyMonths:1,vatDueDay:28,corporateDueMonth:7,corporateDueDay:31,source:'AADE / Greek Ministry of Finance'},
 IE:{code:'IE',name:'Ireland',corporateRate:12.5,standardVatRate:23,transportVatRate:0,vatFrequencyMonths:2,vatDueDay:23,corporateDueMonth:9,corporateDueDay:23,source:'Irish Revenue'},
};
export const DEFAULT_ACCOUNTING_SETTINGS:AccountingSettings={corporateRate:0,vatRate:0,settlement:'scheduled',countryCode:'GR',vatFrequencyMonths:1,vatDueDay:28,corporateDueMonth:7,corporateDueDay:31};
export function jurisdictionFor(code?:string){return TAX_JURISDICTIONS[(code??'GR').toUpperCase()]??TAX_JURISDICTIONS.GR}
export function accountingSettingsFor(code:string):AccountingSettings{
 const j=jurisdictionFor(code);
 return {corporateRate:j.corporateRate,vatRate:j.transportVatRate,settlement:'scheduled',countryCode:j.code,vatFrequencyMonths:j.vatFrequencyMonths,vatDueDay:j.vatDueDay,corporateDueMonth:j.corporateDueMonth,corporateDueDay:j.corporateDueDay};
}

export const roundMoney=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;
export function accountingOf(value?:AccountingState):AccountingState{
 const legacy=!!value&&value.schemaVersion!==2;
 const settings=legacy?accountingSettingsFor(value?.settings?.countryCode??'GR'):{...accountingSettingsFor(value?.settings?.countryCode??'GR'),...value?.settings};
 const archive=value?.archivedTaxPeriods??(value?.periods??[]).filter(p=>p.vatCollected!==0||p.vatInput!==0||p.corporateTax!==0||p.vatPaid!==0||p.corporateTaxPaid!==0).map(p=>({...p}));
 const periods=(value?.periods??[]).map(p=>({...p,netRevenue:p.grossRevenue,netExpenses:p.grossExpenses,vatCollected:0,vatInput:0,corporateTax:0,vatPaid:0,corporateTaxPaid:0}));
 return {settings:{...settings,corporateRate:0,vatRate:0},periods,lastSettledMonth:value?.lastSettledMonth,schemaVersion:3,legacyTaxReviewRequired:false,lastTaxPaymentDate:value?.lastTaxPaymentDate,taxPaymentHistory:value?.taxPaymentHistory??[],taxesDisabled:true,archivedTaxPeriods:archive,taxArchivedAt:value?.taxArchivedAt??(archive.length?new Date().toISOString():undefined)};
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
 const state=accountingOf(value),rate=0;
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
/** Date-scoped settlement: never sweep all available cash every simulation tick. */
export function settleAccounting(value:AccountingState|undefined,currentMonth:string,availableCash:number,gameEpochMs?:number){
 const state=accountingOf(value),periods=state.periods.map(p=>({...p}));
 if(state.taxesDisabled)return {accounting:state,paidVat:0,paidCorporate:0};
 const now=new Date(gameEpochMs??Date.parse(currentMonth+'-01T00:00:00Z'));
 const date=now.toISOString().slice(0,10);
 const month=now.getUTCMonth()+1,year=now.getUTCFullYear(),day=now.getUTCDate();
 const frequency=state.settings.vatFrequencyMonths??1;
 const dueDay=state.settings.vatDueDay??28;
 const corporateMonth=state.settings.corporateDueMonth??7,corporateDay=state.settings.corporateDueDay??31;
 const history=[...(state.taxPaymentHistory??[])];
 // Migration quarantine: existing liability stays on balance sheet but cannot be
 // silently paid using new rules until an explicit migration review is completed.
 if(state.legacyTaxReviewRequired)return {accounting:{...state,periods},paidVat:0,paidCorporate:0};
 if(state.lastTaxPaymentDate===date)return {accounting:{...state,periods},paidVat:0,paidCorporate:0};
 let remaining=Math.max(0,Math.floor(availableCash*100)/100),paidVat=0,paidCorporate=0;
 for(const period of periods){
  const [py,pm]=period.month.split('-').map(Number);
  if(!py||!pm||period.month>=currentMonth)continue;
  period.closed=true;
  // VAT return for a completed filing block, due in the following month.
  const blockEnd=Math.ceil(pm/frequency)*frequency;
  const dueVatYear=py+Math.floor(blockEnd/12);
  const dueVatMonth=blockEnd%12+1;
  const vatIsDue=year>dueVatYear||(year===dueVatYear&&(month>dueVatMonth||(month===dueVatMonth&&day>=dueDay)));
  if(vatIsDue){
   const due=Math.max(0,roundMoney(period.vatCollected-period.vatInput-period.vatPaid));
   const payment=Math.min(due,remaining);
   if(payment>0){period.vatPaid=roundMoney(period.vatPaid+payment);remaining=roundMoney(remaining-payment);paidVat=roundMoney(paidVat+payment);history.push({date,period:period.month,kind:'vat' as const,amount:payment});}
  }
  // Annual corporate tax is assessed on calendar-year trading results. Payments
  // for the previous tax year are due at the configured annual filing deadline.
  const corpYear=py+1;
  const corpDue=year>corpYear||(year===corpYear&&(month>corporateMonth||(month===corporateMonth&&day>=corporateDay)));
  if(corpDue){
   const due=Math.max(0,roundMoney(period.corporateTax-period.corporateTaxPaid));
   const payment=Math.min(due,remaining);
   if(payment>0){period.corporateTaxPaid=roundMoney(period.corporateTaxPaid+payment);remaining=roundMoney(remaining-payment);paidCorporate=roundMoney(paidCorporate+payment);history.push({date,period:period.month,kind:'corporate' as const,amount:payment});}
  }
 }
 return {accounting:{...state,periods,lastSettledMonth:currentMonth,lastTaxPaymentDate:date,taxPaymentHistory:history.slice(-2000)},paidVat,paidCorporate};
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
