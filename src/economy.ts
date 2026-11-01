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
export function advanceLoans(loans:BusinessLoan[],gameSeconds:number){let principal=0,interest=0,payments=0;const updated=loans.map(loan=>{let next={...loan,accruedGameSeconds:loan.accruedGameSeconds+gameSeconds};while(next.accruedGameSeconds>=86400&&next.remainingDays>0){next.accruedGameSeconds-=86400;const charge=next.balance*next.annualRate/365;const paid=Math.min(next.balance+charge,next.remainingDays===1?next.balance+charge:next.dailyPayment);const principalPaid=Math.max(0,paid-charge);next.balance=Math.max(0,next.balance-principalPaid);next.remainingDays--;interest+=charge;principal+=principalPaid;payments+=paid;}return next;}).filter(l=>l.balance>0.005);return{loans:updated,principal,interest,payments};}
