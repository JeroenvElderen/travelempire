import type {BusinessLoan,EconomyUpgrade} from './simulation/taxi';
// Gameplay approximations, calibrated in euros; not official Greek taxi tariffs.
export const GAME_SECONDS_PER_REAL_SECOND=4;
export const LOAN_OFFERS=[{amount:5000,rate:0.06,days:30},{amount:20000,rate:0.08,days:60},{amount:50000,rate:0.10,days:90}] as const;
export const UPGRADES: {id:EconomyUpgrade;name:string;cost:number;detail:string}[]=[
 {id:'fuel',name:'Fuel partnership',cost:5000,detail:'5% lower fuel and charging costs'},
 {id:'workshop',name:'Maintenance workshop',cost:10000,detail:'10% lower servicing and maintenance accrual'},
 {id:'dispatch',name:'Dispatch software',cost:15000,detail:'5% higher passenger revenue'},
 {id:'training',name:'Driver training centre',cost:20000,detail:'20% faster career progression (new trips)'},
];
export function dailyPayment(amount:number,rate:number,days:number){const daily=rate/365;return amount*daily/(1-Math.pow(1+daily,-days));}
export function createLoan(amount:number,rate:number,days:number):BusinessLoan{return{id:crypto.randomUUID(),principal:amount,balance:amount,annualRate:rate,termDays:days,remainingDays:days,dailyPayment:dailyPayment(amount,rate,days),accruedGameSeconds:0};}
export const FINANCE_TERMS=[30,60,90,180] as const;
export function financeQuote(price:number,depositPercent:number,days:number,rate=0.09){
 const deposit=Math.round(price*depositPercent/100*100)/100;
 const principal=Math.max(0,Math.round((price-deposit)*100)/100);
 const instalment=dailyPayment(principal,rate,days);
 return {deposit,principal,instalment,totalCost:deposit+instalment*days,interest:instalment*days-principal};
}
export function leaseQuote(price:number,days:number){
 // Gameplay lease: 10% upfront, daily rental with 15% premium over the term.
 const upfront=Math.round(price*0.1*100)/100;
 const daily=Math.round(((price-upfront)*1.15/days)*100)/100;
 return {upfront,daily,totalCost:upfront+daily*days};
}
export function advanceLeases<T extends {accruedGameSeconds:number;remainingDays:number;dailyPayment:number;totalPaid:number}>(leases:T[],gameSeconds:number){
 let payments=0;const expired:T[]=[];
 const updated=leases.map(lease=>{const next={...lease,accruedGameSeconds:lease.accruedGameSeconds+gameSeconds};
  while(next.accruedGameSeconds>=86400&&next.remainingDays>0){next.accruedGameSeconds-=86400;next.remainingDays--;next.totalPaid+=next.dailyPayment;payments+=next.dailyPayment;}
  if(next.remainingDays<=0)expired.push(next);return next;
 }).filter(l=>l.remainingDays>0);
 return {leases:updated,expired,payments};
}
export function creditScore(cash:number,loans:BusinessLoan[],leaseCount:number,paymentsMade=0,missedHistory=0,assetValue?:number){
 const debt=loans.reduce((a,l)=>a+Math.max(0,l.balance),0);
 const payments=paymentsMade;
 const misses=Math.max(0,missedHistory);
 return Math.max(300,Math.min(850,Math.round(
  650+Math.min(80,Math.max(0,cash)/1000)+Math.min(60,payments*3)
  -(assetValue&&assetValue>0?Math.min(140,85*debt/assetValue):debt/700)
  -leaseCount*12-Math.min(320,misses*35)
 )));
}
export function advanceLoans(loans:BusinessLoan[],gameSeconds:number){let principal=0,interest=0,payments=0;const updated=loans.map(loan=>{let next={...loan,accruedGameSeconds:loan.accruedGameSeconds+gameSeconds};while(next.accruedGameSeconds>=86400&&next.remainingDays>0){next.accruedGameSeconds-=86400;const charge=next.balance*next.annualRate/365;const paid=Math.min(next.balance+charge,next.remainingDays===1?next.balance+charge:next.dailyPayment);const principalPaid=Math.max(0,paid-charge);next.balance=Math.max(0,next.balance-principalPaid);next.remainingDays--;next.paymentsMade=(next.paymentsMade??0)+1;interest+=charge;principal+=principalPaid;payments+=paid;}return next;}).filter(l=>l.balance>0.005);return{loans:updated,principal,interest,payments};}
