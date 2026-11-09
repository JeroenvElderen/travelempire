import type {RestStop} from './simulation/driverRest';

export type InvestablePOI=RestStop & {kind:'hotel'|'parking'};
export type PropertyHolding={id:string;name:string;kind:'hotel'|'parking';position:[number,number];valuationCents:number;investedCents:number;dividendsCents:number;lastDay:number};
export type PropertyPortfolio={holdings:Record<string,PropertyHolding>};
const prefix='travelempire.property-investments.v1.';
export const emptyPortfolio=():PropertyPortfolio=>({holdings:{}});
export function loadPortfolio(companyId:string|undefined):PropertyPortfolio{
 if(!companyId)return emptyPortfolio();
 try{
  const raw=localStorage.getItem(prefix+companyId);
  const data=raw?JSON.parse(raw) as PropertyPortfolio:null;
  if(data&&data.holdings&&typeof data.holdings==='object')return data;
 }catch{/* Ignore invalid browser storage */}
 return emptyPortfolio();
}
export function savePortfolio(companyId:string,portfolio:PropertyPortfolio):void{
 localStorage.setItem(prefix+companyId,JSON.stringify(portfolio));
}
export function propertyValuationCents(p:InvestablePOI):number{
 // Stable simulated property valuations based on the real OSM POI ID.
 // No randomized repricing on refresh.
 let hash=2166136261;
 for(const ch of p.id){hash=Math.imul(hash^ch.charCodeAt(0),16777619);}
 const variation=(hash>>>0)%101;
 const euros=p.kind==='hotel'?650000+variation*11000:90000+variation*3100;
 return euros*100;
}
export const ownership=(holding:PropertyHolding|undefined):number=>
 holding?Math.min(1,holding.investedCents/holding.valuationCents):0;
export function buyPropertyShare(portfolio:PropertyPortfolio,p:InvestablePOI,amountCents:number,gameNow:number):PropertyPortfolio{
 const old=portfolio.holdings[p.id];
 const valuationCents=old?.valuationCents??propertyValuationCents(p);
 const remaining=valuationCents-(old?.investedCents??0);
 if(!Number.isSafeInteger(amountCents)||amountCents<=0||amountCents>remaining)throw Error('Invalid investment amount');
 const holding:PropertyHolding={
  id:p.id,name:p.name|| (p.kind==='hotel'?'Hotel':'Parking facility'),
  kind:p.kind,position:p.position,valuationCents,
  investedCents:(old?.investedCents??0)+amountCents,
  dividendsCents:old?.dividendsCents??0,
  lastDay:old?.lastDay??Math.floor(gameNow/86400000)
 };
 return {holdings:{...portfolio.holdings,[p.id]:holding}};
}
function demandFactor(id:string,day:number):number{
 let h=day|0;for(let i=0;i<id.length;i++)h=Math.imul(h^id.charCodeAt(i),16777619);
 return 0.7+((h>>>0)%61)/100;
}
export function settlePropertyDividends(portfolio:PropertyPortfolio,gameNow:number):{portfolio:PropertyPortfolio;incomeCents:number;days:number}{
 const today=Math.floor(gameNow/86400000);
 let incomeCents=0,days=0,changed=false;
 const holdings={...portfolio.holdings};
 for(const [id,h] of Object.entries(portfolio.holdings)){
  if(!h||!Number.isFinite(h.lastDay)||!Number.isFinite(h.valuationCents)||!Number.isFinite(h.investedCents)||h.valuationCents<=0)continue;
  if(today<=h.lastDay)continue;
  // Bound catch-up after inactive sessions; don't create an unlimited windfall.
  const from=Math.max(h.lastDay,today-30);
  let payment=0;
  for(let d=from+1;d<=today;d++){
   const baseRate=h.kind==='hotel'?0.0006:0.00035;
   payment+=Math.round(h.investedCents*baseRate*demandFactor(id,d));
  }
  incomeCents+=payment;days=Math.max(days,today-from);changed=true;
  holdings[id]={...h,dividendsCents:h.dividendsCents+payment,lastDay:today};
 }
 return {portfolio:changed?{holdings}:portfolio,incomeCents,days};
}
export const euro=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(cents/100);
