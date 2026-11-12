/** Revenue-backed funding contracts. Percentages apply to GROSS eligible
 * passenger and owned-ferry receipts. There is no fixed daily instalment;
 * collections stop at the contractual repayment cap. */
export type BankPartnership={
 id:string;bank:string;principal:number;revenueShare:number;
 repaymentMultiple:number;repaymentCap:number;repaid:number;
 startedAt:number;
};
export type PartnershipOffer={
 bank:string;requested:number;funding:number;revenueShare:number;
 repaymentMultiple:number;repaymentCap:number;approved:boolean;reason:string;
};
export const PARTNERSHIP_BANKS=[
 {id:'conservative',name:'Conservative Bank',share:12,multiple:1.30,appraisal:1.4},
 {id:'growth',name:'Growth Capital Bank',share:18,multiple:1.45,appraisal:3.5},
 {id:'empire',name:'Empire Investment Group',share:25,multiple:1.65,appraisal:6},
] as const;
const cents=(v:number)=>Math.round(v*100)/100;
export function partnershipOffer(bankId:string,request:number,valuation:number,
 averageDailyRevenue:number,creditScore:number,active:readonly BankPartnership[]):PartnershipOffer{
 const bank=PARTNERSHIP_BANKS.find(b=>b.id===bankId)??PARTNERSHIP_BANKS[1];
 const committed=active.reduce((sum,d)=>sum+(d.repaid<d.repaymentCap-.005?d.revenueShare:0),0);
 const outstanding=active.reduce((sum,d)=>sum+Math.max(0,d.repaymentCap-d.repaid),0);
 const ceiling=Math.max(0,Math.min(10000000,valuation*bank.appraisal+
  Math.max(0,averageDailyRevenue)*90-outstanding*.25));
 const affordableShare=committed+bank.share<=45;
 const eligible=creditScore>=550&&averageDailyRevenue>=500&&active.filter(d=>d.repaid<d.repaymentCap-.005).length<3&&affordableShare;
 const requested=Number.isFinite(request)?Math.max(0,Math.round(request)):0;
 // Bank may counteroffer a smaller amount rather than silently refuse.
 const funding=eligible?Math.min(requested,Math.floor(ceiling/10000)*10000):0;
 const approved=eligible&&requested>=500000&&requested<=10000000&&funding>=500000;
 const reason=creditScore<550?'Credit score must be at least 550':
  averageDailyRevenue<500?'At least €500 average daily revenue is required':
  active.filter(d=>d.repaid<d.repaymentCap-.005).length>=3?'Maximum three active partnerships':
  !affordableShare?'Total bank revenue shares cannot exceed 45%':
  requested<500000||requested>10000000?'Request €500,000 to €10,000,000':
  funding<500000?'Insufficient valuation for a bank offer':
  funding<requested?'The bank will counteroffer a lower amount':'Offer available';
 return {bank:bank.name,requested,funding,revenueShare:bank.share,
  repaymentMultiple:bank.multiple,repaymentCap:cents(funding*bank.multiple),
  approved,reason};
}
export function collectBankRevenue(deals:readonly BankPartnership[],gross:number):
 {deals:BankPartnership[];paid:number;settlements:{bank:string;amount:number}[]}{
 if(!deals.length||gross<=0)return{deals:[...deals],paid:0,settlements:[]};
 let paid=0;
 const settlements:{bank:string;amount:number}[]=[];
 const updated=deals.map(d=>{
  const amount=Math.min(Math.max(0,cents(d.repaymentCap-d.repaid)),Math.max(0,cents(gross*d.revenueShare/100)));
  if(amount<=0)return d;
  paid=cents(paid+amount);
  settlements.push({bank:d.bank,amount});
  return {...d,repaid:cents(d.repaid+amount)};
 });
 return{deals:updated,paid,settlements};
}
export function revenueAverage(days:readonly {revenue:number}[]):number{
 if(!days.length)return 0;
 return cents(days.slice(-30).reduce((sum,d)=>sum+Math.max(0,d.revenue),0)/Math.min(30,days.length));
}
