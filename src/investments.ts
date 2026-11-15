import type {RestStop} from './simulation/driverRest';

export type InvestablePOI=RestStop & {kind:'hotel'|'parking'};
export type PropertyHolding={
 id:string;name:string;kind:'hotel'|'parking';position:[number,number];
 valuationCents:number;investedCents:number;dividendsCents:number;
 /** Last settled simulated hour. Legacy saves may only have lastDay. */
 lastHour?:number;lastDay?:number
};
export type PropertyPortfolio={holdings:Record<string,PropertyHolding>};
export type PropertyOperations={
 activityPercent:number;
 /** Physical room count for hotels, bay count for parking. */
 capacity:number;
 occupiedUnits:number;
 vacantUnits:number;
 unitKind:'room'|'space';
 ratePeriod:'night'|'hour';
 /** Price paid per occupied room/night or parked space/hour. */
 unitRateEuros:number;
 grossCents:number;
 costCents:number;
 netCents:number;
 fixedCostCents:number;
 variableCostCents:number;
};
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
 return Number.isFinite(h.lastDay)?(h.lastDay!+1)*24:0;
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

/**
 * OSM POIs rarely include a trustworthy capacity or a published tariff.
 * Estimate a consistent physical capacity from the property's valuation.
 * It is stable across reloads; existing holdings retain their valuation.
 */
export function propertyCapacity(p:Pick<PropertyHolding,'id'|'kind'|'valuationCents'>):number{
 const value=Math.max(0,p.valuationCents/100);
 const baseline=p.kind==='hotel'?value/20000:value/4300;
 const variation=(stableHash(p.id+':capacity')%13-6)/100;
 return p.kind==='hotel'
  ?clamp(Math.round(baseline*(1+variation)),12,180)
  :clamp(Math.round(baseline*(1+variation)),15,220);
}

/** Hotel guests pay per occupied room/night; parking users pay per
 * occupied space/hour. Results are stable across refreshes and per hour,
 * and payouts are still multiplied by the player's property share.
 *
 * Hotel demand is sampled once per in-game day: guests do not instantly
 * disappear at the start of each hour. Parking demand varies by hour.
 * All revenue and cost calculations use integer cents.
 */
export function propertyOperations(p:Pick<PropertyHolding,'id'|'kind'|'valuationCents'>,hour:number):PropertyOperations{
 const day=Math.floor(hour/24);
 const time=((hour%24)+24)%24;
 const date=new Date(day*86400000);
 const month=date.getUTCMonth();
 const capacity=propertyCapacity(p);
 const hotel=p.kind==='hotel';
 const variation=(stableHash(p.id+':demand:'+day)%25-12)/100;
 const seasonal=month>=5&&month<=8?1.17:month>=3&&month<=9?1:0.75;
 const weekend=((day+4)%7+7)%7>=5;
 const desiredOccupancy=hotel
  ?clamp(0.66*seasonal+(weekend?0.06:0)+variation,0.12,0.97)
  :clamp((time>=8&&time<19?0.70:time>=19&&time<23?0.47:0.18)+
    (weekend&&time>=10&&time<21?0.08:0)+variation,0.05,0.98);
 const occupiedUnits=clamp(Math.round(capacity*desiredOccupancy),0,capacity);
 const vacantUnits=capacity-occupiedUnits;
 const activityPercent=Math.round(100*occupiedUnits/capacity);

 // Per-property tariffs remain stable, with a small hotel seasonal factor
 // and a predictable parking peak-hour surcharge.
 const priceVariation=stableHash(p.id+':price')%31;
 const rateCents=hotel
  ?Math.round((90+priceVariation)*100*(month>=5&&month<=8?1.1:1))
  :Math.round((2.5+priceVariation/20+(time>=8&&time<19?0.50:0))*100);
 const grossCents=hotel
  ?Math.round(occupiedUnits*rateCents/24)
  :occupiedUnits*rateCents;
 // Operational expenses do not vanish when a property is empty.
 // Hotels have greater staffing/room-turnover costs; parking has lower
 // variable costs but still incurs supervision, lighting and maintenance.
 const fixedCostCents=hotel?Math.round(capacity*18):Math.round(capacity*13);
 const variableCostCents=hotel
  ?Math.round(occupiedUnits*rateCents*0.24/24)
  :Math.round(occupiedUnits*rateCents*0.16);
 const costCents=fixedCostCents+variableCostCents;
 return {
  activityPercent,capacity,occupiedUnits,vacantUnits,
  unitKind:hotel?'room':'space',
  ratePeriod:hotel?'night':'hour',
  unitRateEuros:rateCents/100,
  grossCents,costCents,netCents:Math.max(0,grossCents-costCents),
  fixedCostCents,variableCostCents
 };
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
