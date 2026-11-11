import type {BusinessLoan,FleetState,Taxi} from './taxi';
import type {Company} from '../company';
import {dailyPayment,creditScore} from '../economy';
import {valueCompany} from '../equity';

const money=(amount:number)=>Math.round((amount+Number.EPSILON)*100)/100;
export const LOAN_TERMS=[180,365,730,1825] as const;
export const MIN_SECURED_LOAN=1000;

export function appraisedVehicleValue(t:Taxi):number{
 if(t.ownership==='leased'||(t.purchasePrice??0)<=0||t.kind==='explorer')return 0;
 const age=Math.max(0,2026-(t.vehicleYear??2026));
 const mileage=Math.max(0,t.vehicleMileage??0);
 const baseline=t.purchasePrice??0;
 return money(Math.max(0,baseline*Math.pow(.88,age)*Math.pow(.92,mileage/30000)*
  Math.max(.1,Math.min(1,(t.vehicleCondition??100)/100))));
}

export function lendingAssessment(company:Company,fleet:FleetState,gameNow:number){
 const valuation=valueCompany(company,fleet,gameNow);
 const outstanding=(fleet.loans??[]).reduce((sum,l)=>sum+Math.max(0,l.balance),0)+
  (fleet.corporate?.loans??[]).reduce((sum,l)=>sum+Math.max(0,l.balance),0);
 const score=creditScore(company.cash,fleet.loans??[],(fleet.leases??[]).length,
  fleet.financePaymentsMade??0,(fleet.creditMisses??0)+(fleet.creditDefaults??0)*3,
  valuation.value);
 // The FIRST secured loan can borrow up to the full appraised company value
 // at strong credit, less other existing liabilities. Loans never create
 // unlimited additional borrowing capacity simply by adding cash.
 const ratio=score>=700?1:score>=650?.85:score>=600?.65:score>=500?.35:0;
 const creditLimit=money(Math.max(0,valuation.value*ratio));
 const available=money(Math.max(0,creditLimit-outstanding));
 const collateral=fleet.taxis.reduce((sum,t)=>sum+appraisedVehicleValue(t),0);
 return {score,companyValue:valuation.value,creditLimit,available,outstanding,
  collateral,ratio,canBorrow:score>=500&&(fleet.loans??[]).filter(l=>l.secured).length<3};
}
export function securedRate(score:number,days:number):number{
 const risk=score>=750?.052:score>=700?.065:score>=650?.079:score>=600?.10:.135;
 const length=days>730?.015:days>365?.008:0;
 return Math.round((risk+length)*10000)/10000;
}
export function securedQuote(company:Company,fleet:FleetState,gameNow:number,amount:number,days:number){
 const assessment=lendingAssessment(company,fleet,gameNow);
 const valid=Number.isFinite(amount)&&amount>=MIN_SECURED_LOAN&&
  amount<=assessment.available+.001&&LOAN_TERMS.includes(days as typeof LOAN_TERMS[number])&&assessment.canBorrow;
 const rate=securedRate(assessment.score,days);
 const instalment=Number.isFinite(amount)&&amount>0&&Number.isFinite(days)&&days>0?
  dailyPayment(amount,rate,days):0;
 return {...assessment,amount,days,rate,instalment,
  totalPaid:instalment*days,totalInterest:instalment*days-amount,approved:valid};
}
export function createSecuredLoan(amount:number,rate:number,days:number):BusinessLoan{
 return {id:crypto.randomUUID(),purpose:'business',secured:true,
  principal:money(amount),balance:money(amount),annualRate:rate,termDays:days,
  remainingDays:days,dailyPayment:dailyPayment(amount,rate,days),
  accruedGameSeconds:0,missedPayments:0,totalMissedPayments:0,collateralRecovered:0};
}
export type Repossession={loanId:string;vehicleId:string;vehicleName:string;value:number};
export type SecuredSettlement={
 loans:BusinessLoan[];taxis:Taxi[];payments:number;principal:number;interest:number;
 paymentCount:number;missed:number;repossessions:Repossession[];
};
/** Simulated-day instalments. No negative cash and no free payments.
 * After 3 consecutive misses, the lender may repossess owned financed
 * passenger vehicles at 70% liquidation value. The proceeds reduce debt;
 * any deficiency remains owed. Starter vehicles, explorers and leases are safe.
 */
export function advanceSecuredLoans(loans:BusinessLoan[],seconds:number,
 availableCash:number,taxis:Taxi[]):SecuredSettlement{
 let remainingCash=Math.max(0,availableCash),payments=0,principal=0,interest=0;
 let paymentCount=0,missed=0;
 const repossessions:Repossession[]=[];
 const seized=new Set<string>();
 const updated=loans.map(original=>{
  const loan={...original,accruedGameSeconds:original.accruedGameSeconds+Math.max(0,seconds)};
  while(loan.accruedGameSeconds>=86400&&loan.remainingDays>0&&loan.balance>.005){
   loan.accruedGameSeconds-=86400;
   const charge=money(loan.balance*loan.annualRate/365);
   const instalment=money(Math.min(loan.balance+charge,
    loan.remainingDays===1?loan.balance+charge:loan.dailyPayment));
   if(remainingCash+.001>=instalment){
    remainingCash=money(Math.max(0,remainingCash-instalment));
    const paidPrincipal=money(Math.max(0,instalment-charge));
    loan.balance=money(Math.max(0,loan.balance-paidPrincipal));
    loan.remainingDays--;
    loan.paymentsMade=(loan.paymentsMade??0)+1;
    loan.missedPayments=0;
    payments+=instalment;principal+=paidPrincipal;interest+=charge;paymentCount++;
   }else{
    // Missed instalments extend the repayment schedule. Interest continues
    // to accrue; a modest late fee is capitalised but never paid fictitiously.
    const lateFee=money(Math.min(100,loan.balance*.002));
    loan.balance=money(loan.balance+charge+lateFee);
    loan.missedPayments=(loan.missedPayments??0)+1;
    loan.totalMissedPayments=(loan.totalMissedPayments??0)+1;
    interest+=charge+lateFee;missed++;
    if(loan.missedPayments>=3&&loan.missedPayments%3===0){
     const candidate=taxis.filter(t=>!seized.has(t.id)&&
      t.ownership==='owned'&&appraisedVehicleValue(t)>0&&
      !loans.some(l=>l.purpose==='vehicle'&&l.vehicleId===t.id&&l.balance>.005))
      .sort((a,b)=>appraisedVehicleValue(b)-appraisedVehicleValue(a))[0];
     if(candidate){
      const value=money(Math.min(loan.balance,appraisedVehicleValue(candidate)*.7));
      if(value>0){
       loan.balance=money(Math.max(0,loan.balance-value));
       loan.collateralRecovered=money((loan.collateralRecovered??0)+value);
       seized.add(candidate.id);
       repossessions.push({loanId:loan.id,vehicleId:candidate.id,vehicleName:candidate.name,value});
      }
     }
    }
   }
  }
  return loan;
 }).filter(l=>l.balance>.005);
 return {loans:updated,taxis:taxis.filter(t=>!seized.has(t.id)),
  payments:money(payments),principal:money(principal),interest:money(interest),
  paymentCount,missed,repossessions};
}
