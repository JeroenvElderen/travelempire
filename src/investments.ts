import type {RestStop} from './simulation/driverRest';

export type InvestablePOI=RestStop & {kind:'hotel'|'parking'};
export type PropertyHolding={
 id:string;name:string;kind:'hotel'|'parking';position:[number,number];
 valuationCents:number;investedCents:number;dividendsCents:number;
 /** Last settled simulated hour. Legacy saves may only have lastDay. */
 lastHour?:number;lastDay?:number
};
export type PropertyPortfolio={holdings:Record<string,PropertyHolding>};
export type PropertyOperations={activityPercent:number;capacity:number;unitRateEuros:number;grossCents:number;costCents:number;netCents:number};
const prefix='travelempire.property-investments.v1.';
const HOUR_MS=3600000;
const MAX_CATCHUP_HOURS=30*24;
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
function stableHash(input:string):number{
 let hash=2166136261;
 for(const ch of input)hash=Math.imul(hash^ch.charCodeAt(0),16777619);
 return hash>>>0;
}
export function propertyValuationCents(p:InvestablePOI):number{
 const variation=stableHash(p.id)%101;
 const euros=p.kind==='hotel'?650000+variation*11000:90000+variation*3100;
 return euros*100;
}
export const ownership=(holding:PropertyHolding|undefined):number=>
 holding?Math.min(1,holding.investedCents/holding.valuationCents):0;
const currentHour=(gameNow:number)=>Math.floor(gameNow/HOUR_MS);
/** Preserve paid daily dividends on v1 saves. A paid day ends at 23:00. */
function lastPaidHour(h:PropertyHolding):number{
 if(Number.isFinite(h.lastHour))return h.lastHour!;
 return Number.isFinite(h.lastDay)?(h.lastDay!+1)*24-1:0;
}
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
  lastHour:old?lastPaidHour(old):currentHour(gameNow)
 };
 return {holdings:{...portfolio.holdings,[p.id]:holding}};
}
function clamp(n:number,low:number,high:number){return Math.max(low,Math.min(high,n));}
/** Deterministic hourly hotel/parking operations; no random reroll on refresh. */
export function propertyOperations(p:Pick<PropertyHolding,'id'|'kind'|'valuationCents'>,hour:number):PropertyOperations{
 const day=Math.floor(hour/24);
 const time=((hour%24)+24)%24;
 const date=new Date(day*86400000);
 const month=date.getUTCMonth();
 const seasonal=p.kind==='hotel'
  ?(month>=5&&month<=8?1.23:month>=3&&month<=9?1:0.68)
  :1;
 const variation=(stableHash(p.id+':'+day)%21-10)/100;
 const rooms=p.kind==='hotel'
  ?clamp(Math.round(p.valuationCents/100/20000),12,180)
  :clamp(Math.round(p.valuationCents/100/8500),15,180);
 const activity=p.kind==='hotel'
  ?clamp(0.70*seasonal+variation,0.16,0.96)
  :clamp((time>=8&&time<19?0.72:time>=19&&time<23?0.48:0.20)+variation,0.08,0.96);
 const rate=p.kind==='hotel'?80:2.5;
 // Hotel room rates are nightly and spread across all 24 game hours.
 const gross=rooms*activity*rate/(p.kind==='hotel'?24:1);
 const costRatio=p.kind==='hotel'?0.60:0.52;
 const grossCents=Math.round(gross*100);
 const costCents=Math.round(gross*costRatio*100);
 return {activityPercent:Math.round(activity*100),capacity:rooms,unitRateEuros:rate,grossCents,costCents,netCents:Math.max(0,grossCents-costCents)};
}
/** Accrue once for every completed simulated hour. Never repay already settled hours. */
export function settlePropertyDividends(portfolio:PropertyPortfolio,gameNow:number):{portfolio:PropertyPortfolio;incomeCents:number;hours:number}{
 const hour=currentHour(gameNow);
 let incomeCents=0,hours=0,changed=false;
 const holdings={...portfolio.holdings};
 for(const [id,h] of Object.entries(portfolio.holdings)){
  if(!h||!Number.isFinite(h.valuationCents)||!Number.isFinite(h.investedCents)||h.valuationCents<=0)continue;
  const last=lastPaidHour(h);
  if(hour<=last)continue;
  const from=Math.max(last,hour-MAX_CATCHUP_HOURS);
  let payment=0;
  for(let t=from+1;t<=hour;t++){
   const operations=propertyOperations(h,t-1);
   payment+=Math.round(operations.netCents*ownership(h));
  }
  incomeCents+=payment;hours=Math.max(hours,hour-from);changed=true;
  holdings[id]={...h,dividendsCents:(h.dividendsCents??0)+payment,lastHour:hour};
 }
 return {portfolio:changed?{holdings}:portfolio,incomeCents,hours};
}
export const euro=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(cents/100);
