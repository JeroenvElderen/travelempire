import type {Company} from './company';
import type {FleetState,BusinessLoan,FinancePeriod} from './simulation/taxi';
import {accountingOf,vatIncluded} from './accounting';
import {depotCapacity,depotDailyTotal,upgradesFor,DEPOT_UPGRADES} from './depotFinance';
import {OFFERS,type VehicleOffer} from './dealership';
import {financeQuote,leaseQuote} from './economy';
import {corporateOf} from './corporate';

export type ForecastScenario='conservative'|'expected'|'optimistic';
export type ForecastHorizon=7|30|90|180;
export type ExpansionMode='none'|'cash'|'finance'|'lease';
export type ForecastPlan={scenario:ForecastScenario;days:ForecastHorizon;vehicleId:string;vehicleCount:number;mode:ExpansionMode;depositPercent:number;financeDays:30|60|90|180;depotId:string;depotUpgrade:string;newDepot:boolean};
export type ForecastDay={day:number;date:string;revenue:number;operatingExpenses:number;loanPayments:number;leasePayments:number;taxPayments:number;savingsTransfer:number;capitalSpending:number;cash:number;savings:number;profit:number;groupCash:number};
export type ForecastResult={points:ForecastDay[];startCash:number;closingCash:number;closingSavings:number;totalRevenue:number;totalOperatingExpenses:number;totalLoanPayments:number;totalLeasePayments:number;totalTaxes:number;totalInvestments:number;totalSavingsTransfers:number;breakEvenDailyRevenue:number;breakEvenTrips:number|null;historicalTripsPerGameDay:number;baselineDailyRevenue:number;baselineDailyExpenses:number;historyRealDays:number;capacityAvailable:number;investmentCost:number;estimatedPaybackDays:number|null;alerts:string[];warnings:string[];estimatedVehicleDailyProfit:number;minimumCash:number;taxLiabilityAtEnd:number;closingGroupCash:number;closingSubsidiaryCash:number;corporateLoanPayments:number};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const addDays=(epoch:number,days:number)=>new Date(epoch+days*86400000).toISOString().slice(0,10);
const monthOf=(epoch:number)=>new Date(epoch).toISOString().slice(0,7);
const finite=(n:number)=>Number.isFinite(n)?n:0;
const SCENARIO={conservative:{revenue:.7,variableCosts:1.15},expected:{revenue:1,variableCosts:1},optimistic:{revenue:1.25,variableCosts:.95}} as const;
const DRIVER_COST=500;
function sampleHistory(history:FinancePeriod[],realNow:number){
 const end=new Date(realNow).toISOString().slice(0,10);
 const start=new Date(realNow-13*86400000).toISOString().slice(0,10);
 const rows=history.filter(h=>h.day>=start&&h.day<=end);
 const uniqueDays=new Set(rows.map(r=>r.day));
 const elapsedRealDays=uniqueDays.size?Math.max(1,(Date.parse(end)-Date.parse([...uniqueDays].sort()[0]))/86400000+1):0;
 const gameDays=elapsedRealDays*4;
 const revenue=rows.reduce((a,h)=>a+finite(h.revenue),0);
 const expenses=rows.reduce((a,h)=>{
  if(!h.categories)return a+finite(h.expenses);
  const c=h.categories;
  return a+finite(c.fuel)+finite(c.maintenance)+finite(c.exploration)+finite(c.payroll)+finite(c.insurance)+finite(c.overhead);
 },0);
 const trips=rows.reduce((a,h)=>a+finite(h.trips),0);
 return {gameDays,revenuePerDay:gameDays?revenue/gameDays:0,expensesPerDay:gameDays?expenses/gameDays:0,tripsPerDay:gameDays?trips/gameDays:0,realDays:elapsedRealDays};
}
function dailyLoan(loan:BusinessLoan){
 if(loan.remainingDays<=0)return {paid:0,interest:0};
 const interest=loan.balance*loan.annualRate/365;
 const paid=Math.min(loan.balance+interest,loan.remainingDays===1?loan.balance+interest:loan.dailyPayment);
 return {paid,interest};
}
export function forecastBusiness(company:Company,fleet:FleetState,plan:ForecastPlan,gameEpochMs:number,realNow=Date.now()):ForecastResult{
 const scenario=SCENARIO[plan.scenario];
 const history=sampleHistory(fleet.financeHistory??[],realNow);
 const vehicleCount=Math.max(1,fleet.taxis.filter(t=>t.kind===undefined||t.kind==='taxi').length);
 const bank=fleet.bank;
 const accounting=accountingOf(fleet.accounting);
 const settings=accounting.settings;
 const selectedOffer:VehicleOffer=OFFERS.find(o=>o.id===plan.vehicleId)??OFFERS[0];
 const requestedCount=clamp(Math.floor(finite(plan.vehicleCount)),0,20);
 const addedCount=plan.mode==='none'?0:requestedCount;
 const quote=financeQuote(selectedOffer.price,clamp(plan.depositPercent,10,50),plan.financeDays);
 const lease=leaseQuote(selectedOffer.price,plan.financeDays);
 const perVehicleInitial=plan.mode==='cash'?selectedOffer.price+DRIVER_COST:plan.mode==='finance'?quote.deposit+DRIVER_COST:lease.upfront+DRIVER_COST;
 const depot=plan.depotId==='main'?{id:'main',name:'Headquarters',capacity:5}:(company.depots??[]).find(d=>d.id===plan.depotId)??{id:'main',name:'Headquarters',capacity:5};
 const upgrades=upgradesFor(fleet,depot.id);
 const occupied=fleet.taxis.filter(t=>(t.depotId??'main')===depot.id).length;
 const capacityAvailable=Math.max(0,depotCapacity(depot,upgrades)-occupied);
 const upgrade=DEPOT_UPGRADES.find(u=>u.id===plan.depotUpgrade);
 const canUpgrade=!!upgrade&&(upgrades[upgrade.id]??0)<upgrade.max;
 const upgradeCost=canUpgrade?upgrade.cost:0;
 const newDepotCost=plan.newDepot?10000:0;
 const investmentCost=perVehicleInitial*addedCount+upgradeCost+newDepotCost;
 const oldDebt=(fleet.loans??[]).reduce((a,l)=>a+l.balance,0);
 const newBorrowing=plan.mode==='finance'?quote.principal*addedCount:0;
 const warnings:string[]=[];
 if(history.gameDays===0)warnings.push('No historical operating data: revenue assumptions are zero until the fleet records fares.');
 if(history.realDays<3&&history.realDays>0)warnings.push('Short history: projections are highly sensitive to the first few operating days.');
 if(addedCount>capacityAvailable+(plan.depotUpgrade==='capacity'&&canUpgrade?5:0)+(plan.newDepot?5:0))warnings.push('Planned vehicles exceed available depot parking; allocate vehicles or expand capacity first.');
 if(plan.mode==='finance'&&newBorrowing+oldDebt>75000)warnings.push('Planned borrowing exceeds the existing €75,000 financing limit.');
 if(plan.mode==='finance'&&(fleet.loans??[]).length+addedCount>2)warnings.push('Planned vehicle loans exceed the two-active-loan limit.');
 if(investmentCost>company.cash)warnings.push('Upfront investment exceeds current operating cash.');
 if(plan.depotUpgrade&&plan.depotUpgrade!=='none'&&!canUpgrade)warnings.push('Selected depot upgrade is already at its maximum level.');
 const baseRevenue=history.revenuePerDay*scenario.revenue;
 const baseExpenses=history.expensesPerDay*scenario.variableCosts;
 const perVehicleRevenue=vehicleCount?history.revenuePerDay/vehicleCount*scenario.revenue:0;
 const perVehicleVariableCost=vehicleCount?history.expensesPerDay/vehicleCount*.65*scenario.variableCosts:0;
 const addedDailyRevenue=perVehicleRevenue*addedCount;
 const addedDailyExpenses=(perVehicleVariableCost+15)*addedCount;
 const baseFacility=depotDailyTotal(depot.id==='main',upgrades,depotCapacity(depot,upgrades));
 const modifiedUpgrades=upgrade&&canUpgrade?{...upgrades,[upgrade.id]:(upgrades[upgrade.id]??0)+1}:upgrades;
 const incrementalFacility=upgrade&&canUpgrade?depotDailyTotal(depot.id==='main',modifiedUpgrades,depotCapacity(depot,modifiedUpgrades))-baseFacility:0;
 const newDepotDaily=plan.newDepot?depotDailyTotal(false,{},5):0;
 const upgradeSavings=upgrade&&canUpgrade?(upgrade.id==='workshop'?baseExpenses*.08:upgrade.id==='fuel'||upgrade.id==='charging'?baseExpenses*.05:0):0;
 const upgradeRevenue=upgrade?.id==='dispatch'&&canUpgrade?baseRevenue*.03:0;
 const extraRevenue=addedDailyRevenue+upgradeRevenue;
 const extraCost=addedDailyExpenses+incrementalFacility+newDepotDaily-upgradeSavings;
 const loans=(fleet.loans??[]).map(l=>({...l}));
 const corporate=corporateOf(fleet.corporate);
 const corporateLoans=corporate.loans.map(l=>({...l}));
 const projectedSubsidiaries=corporate.subsidiaries.filter(s=>s.active).map(s=>({...s}));
 let subsidiaryCash=projectedSubsidiaries.reduce((a,s)=>a+s.cash,0);
 let corporateLoanPayments=0;
 const leases=(fleet.leases??[]).map(l=>({...l}));
 if(plan.mode==='finance')for(let i=0;i<addedCount;i++)loans.push({id:'projection-'+i,principal:quote.principal,balance:quote.principal,annualRate:.09,termDays:plan.financeDays,remainingDays:plan.financeDays,dailyPayment:quote.instalment,accruedGameSeconds:0});
 if(plan.mode==='lease')for(let i=0;i<addedCount;i++)leases.push({id:'projection-'+i,vehicleId:'projection-'+i,vehicleName:selectedOffer.model,dailyPayment:lease.daily,remainingDays:plan.financeDays,termDays:plan.financeDays,accruedGameSeconds:0,totalPaid:0});
 let cash=company.cash-investmentCost,savings=bank?.savings??0;
 let pendingTax=accounting.periods.reduce((a,p)=>a+Math.max(0,p.vatCollected-p.vatInput-p.vatPaid)+Math.max(0,p.corporateTax-p.corporateTaxPaid),0);
 let currentMonth=monthOf(gameEpochMs);
 let monthlyRevenue=0,monthlyExpense=0,monthlyInputVAT=0,monthlyOutputVAT=0;
 let totalRevenue=0,totalOperatingExpenses=0,totalLoanPayments=0,totalLeasePayments=0,totalTaxes=0,totalSavingsTransfers=0;
 let minimumCash=cash;
 const points:ForecastDay[]=[{day:0,date:addDays(gameEpochMs,0),revenue:0,operatingExpenses:0,loanPayments:0,leasePayments:0,taxPayments:0,savingsTransfer:0,capitalSpending:investmentCost,cash,savings,profit:0,groupCash:cash+savings+subsidiaryCash}];
 const alerts:string[]=[];
 const taxSettlement=(dateMonth:string)=>{
  if(dateMonth===currentMonth)return 0;
  const vat=Math.max(0,monthlyOutputVAT-monthlyInputVAT);
  const corporate=Math.max(0,(monthlyRevenue-monthlyExpense-monthlyOutputVAT+monthlyInputVAT)*settings.corporateRate/100);
  pendingTax+=vat+corporate;
  monthlyRevenue=0;monthlyExpense=0;monthlyInputVAT=0;monthlyOutputVAT=0;
  currentMonth=dateMonth;
  const payment=Math.min(Math.max(0,cash),pendingTax);
  cash-=payment;pendingTax-=payment;return payment;
 };
 for(let day=1;day<=plan.days;day++){
  const date=addDays(gameEpochMs,day);
  const paidAtBoundary=taxSettlement(date.slice(0,7));
  let loanPayments=0,loanInterest=0,leasePayments=0;
  for(const l of loans){
   if(l.remainingDays<=0)continue;
   const payment=dailyLoan(l);
   loanPayments+=payment.paid;loanInterest+=payment.interest;
   l.balance=Math.max(0,l.balance-(payment.paid-payment.interest));l.remainingDays--;
  }
  for(const l of leases){if(l.remainingDays>0){leasePayments+=l.dailyPayment;l.remainingDays--;}}
  for(const l of corporateLoans){
   if(l.remainingDays<=0||l.balance<=0)continue;
   const interest=Math.round(l.balance*l.annualRate/365*100)/100;
   const paid=Math.min(Math.round((l.balance+interest)*100)/100,l.remainingDays===1?Math.round((l.balance+interest)*100)/100:l.dailyPayment);
   l.balance=Math.max(0,Math.round((l.balance-(paid-interest))*100)/100);l.remainingDays--;
   loanPayments+=paid;loanInterest+=interest;corporateLoanPayments+=paid;
  }
  for(const sub of projectedSubsidiaries){
   if(sub.lastSettledDay.slice(0,7)!==date.slice(0,7)){
    const settlement=Math.min(Math.max(0,sub.cash),sub.taxLiability);
    sub.cash-=settlement;sub.taxLiability-=settlement;
   }
   sub.cash+=sub.revenuePerDay-sub.expensesPerDay;
   sub.taxLiability+=Math.max(0,(sub.revenuePerDay-sub.expensesPerDay)*settings.corporateRate/100);
   sub.lastSettledDay=date;
  }
  subsidiaryCash=projectedSubsidiaries.reduce((a,s)=>a+s.cash,0);
  const revenue=baseRevenue+extraRevenue;
  const operatingExpenses=baseExpenses+extraCost+loanInterest+leasePayments;
  const inputVat=vatIncluded(Math.max(0,(baseExpenses+extraCost)*.3),settings.vatRate);
  const outputVat=vatIncluded(revenue,settings.vatRate);
  monthlyRevenue+=revenue;monthlyExpense+=operatingExpenses;monthlyInputVAT+=inputVat;monthlyOutputVAT+=outputVat;
  cash+=revenue-(baseExpenses+extraCost)-loanPayments-leasePayments;
  const savingsTransfer=Math.max(0,Math.min(Math.max(0,cash-(bank?.minimumOperatingCash??5000)),revenue*(bank?.autoSavePercent??0)/100));
  cash-=savingsTransfer;savings+=savingsTransfer;
  totalRevenue+=revenue;totalOperatingExpenses+=operatingExpenses;totalLoanPayments+=loanPayments;totalLeasePayments+=leasePayments;totalTaxes+=paidAtBoundary;totalSavingsTransfers+=savingsTransfer;
  minimumCash=Math.min(minimumCash,cash);
  points.push({day,date,revenue,operatingExpenses,loanPayments,leasePayments,taxPayments:paidAtBoundary,savingsTransfer,capitalSpending:0,cash,savings,profit:revenue-operatingExpenses,groupCash:cash+savings+subsidiaryCash});
 }
 const dailyObligations=(fleet.loans??[]).reduce((a,l)=>a+(l.remainingDays>0?l.dailyPayment:0),0)+(fleet.leases??[]).reduce((a,l)=>a+(l.remainingDays>0?l.dailyPayment:0),0);
 const breakEvenDailyRevenue=(baseExpenses+extraCost+dailyObligations+(plan.mode==='finance'?quote.instalment*addedCount:plan.mode==='lease'?lease.daily*addedCount:0))/(1-settings.vatRate/(100+settings.vatRate));
 const farePerTrip=history.tripsPerDay>0?history.revenuePerDay/history.tripsPerDay:0;
 const breakEvenTrips=farePerTrip>0?Math.ceil(breakEvenDailyRevenue/farePerTrip):null;
 const incrementalDailyCash=extraRevenue-extraCost-(plan.mode==='finance'?quote.instalment*addedCount:plan.mode==='lease'?lease.daily*addedCount:0);
 const estimatedPaybackDays=investmentCost>0&&incrementalDailyCash>0?Math.ceil(investmentCost/incrementalDailyCash):null;
 if(minimumCash<0)alerts.push('Projected operating cash falls below €0. Planned investments may be unaffordable.');
 if(minimumCash<(bank?.minimumOperatingCash??5000))alerts.push('Projected cash falls below the configured minimum operating reserve.');
 if(breakEvenDailyRevenue>baseRevenue+extraRevenue)alerts.push('Forecast fare revenue is below the estimated break-even threshold.');
 if(pendingTax>0&&cash<pendingTax)alerts.push('Projected unpaid tax liabilities exceed closing operating cash.');
 if(loans.some(l=>l.remainingDays>0)||leases.some(l=>l.remainingDays>0))alerts.push('Loan and lease payments remain due after the forecast horizon.');
 if(addedCount>0&&estimatedPaybackDays===null)alerts.push('Planned expansion does not achieve positive incremental daily cash flow under this scenario.');
 return {points,startCash:company.cash,closingCash:cash,closingSavings:savings,totalRevenue,totalOperatingExpenses,totalLoanPayments,totalLeasePayments,totalTaxes,totalInvestments:investmentCost,totalSavingsTransfers,breakEvenDailyRevenue,breakEvenTrips,historicalTripsPerGameDay:history.tripsPerDay,baselineDailyRevenue:history.revenuePerDay,baselineDailyExpenses:history.expensesPerDay,historyRealDays:history.realDays,capacityAvailable,investmentCost,estimatedPaybackDays,alerts,warnings,estimatedVehicleDailyProfit:perVehicleRevenue-perVehicleVariableCost-15,minimumCash,taxLiabilityAtEnd:pendingTax,closingGroupCash:cash+savings+subsidiaryCash,closingSubsidiaryCash:subsidiaryCash,corporateLoanPayments};
}
