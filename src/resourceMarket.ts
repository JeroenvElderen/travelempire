import {COLLECTOR_PARTS,collectorStorageCapacity,collectorStorageUsage,collectorVehicles,type CollectorPart,type CollectorState} from './resourceCollectors';
import {supplierStock} from './generatedSuppliers';

export type MarketSide='buy'|'sell';
export type MarketTrade={id:string;at:number;part:CollectorPart;side:MarketSide;quantity:number;totalCents:number};
export type MarketVolume={bought:number;sold:number};
export type ResourceMarket={day:number;volume:Partial<Record<CollectorPart,MarketVolume>>;history:MarketTrade[];boughtCents:number;soldCents:number};
const DAY=86400000;
export const MARKET_BASE_CENTS:Record<CollectorPart,number>={mechanical:4500,business:3600,construction:3000,electronics:7500,research:9000,energy:5500,marine:11000,rare:24000};
export const MARKET_DAILY_LIMIT:Record<CollectorPart,number>={mechanical:100,business:100,construction:120,electronics:70,research:60,energy:80,marine:45,rare:20};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
function hash(s:string){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
export function marketForDay(state:CollectorState,now:number):ResourceMarket{
 const old=state.market,day=Math.max(old?.day??0,Math.floor(now/DAY));
 return old&&old.day===day?old:{day,volume:{},history:old?.history??[],boughtCents:old?.boughtCents??0,soldCents:old?.soldCents??0};
}
export function marketUnitPrices(state:CollectorState,part:CollectorPart,now:number){
 const market=marketForDay(state,now),v=market.volume[part]??{bought:0,sold:0},limit=MARKET_DAILY_LIMIT[part];
 const discoveredSupply=Object.values(state.suppliers??{}).filter(s=>s.part===part).reduce((n,s)=>n+supplierStock(s,now),0);
 const scarcity=1.15-Math.min(.30,discoveredSupply/3000*.30);
 const daily=.85+(hash(part+':'+market.day)%301)/1000;
 const pressure=clamp(1+(v.bought-v.sold)/limit*.25,.75,1.25);
 const mid=Math.round(MARKET_BASE_CENTS[part]*scarcity*daily*pressure);
 return {buyCents:Math.ceil(mid*1.25),sellCents:Math.floor(mid*.65),buyAvailable:Math.max(0,limit-v.bought),sellAvailable:Math.max(0,limit-v.sold)};
}
export function marketQuote(state:CollectorState,levels:Partial<Record<string,number>>,cash:number,now:number,part:CollectorPart,side:MarketSide,quantity:number){
 if(!COLLECTOR_PARTS.includes(part)||!['buy','sell'].includes(side)||!Number.isSafeInteger(quantity)||quantity<=0)throw Error('Enter a valid whole-unit quantity');
 const prices=marketUnitPrices(state,part,now);
 const storage=collectorStorageUsage(state),capacity=collectorStorageCapacity(state,levels);
 const incoming=collectorVehicles(state).reduce((n,v)=>n+(v.trip?.part===part?v.trip.quantity:0),0);
 const free=Math.max(0,Math.min(capacity-storage.stored-storage.reserved,Math.floor(capacity/8)-(state.stock[part]??0)-incoming));
 const unitCents=side==='buy'?prices.buyCents:prices.sellCents;
 const totalCents=unitCents*quantity;
 if(!Number.isSafeInteger(totalCents))throw Error('Invalid trade value');
 const maxQuantity=side==='buy'?Math.max(0,Math.min(prices.buyAvailable,free,Math.floor(Math.max(0,cash)*100/unitCents))):Math.max(0,Math.min(prices.sellAvailable,state.stock[part]??0));
 let reason:string|null=null;
 if(quantity>maxQuantity){
  if(side==='buy'&&quantity>prices.buyAvailable||side==='sell'&&quantity>prices.sellAvailable)reason='Daily market limit reached';
  else if(side==='buy'&&quantity>free)reason='Insufficient warehouse space (including incoming cargo)';
  else if(side==='buy')reason='Insufficient company cash';
  else reason='Insufficient available inventory';
 }
 return {unitCents,totalCents,maxQuantity,reason};
}
export function executeMarketTrade(state:CollectorState,levels:Partial<Record<string,number>>,cash:number,now:number,part:CollectorPart,side:MarketSide,quantity:number,id:string,expectedTotalCents:number){
 const market=marketForDay(state,now);
 if(market.history.some(t=>t.id===id))throw Error('Trade already recorded');
 const quote=marketQuote(state,levels,cash,now,part,side,quantity);
 if(quote.reason)throw Error(quote.reason);
 if(quote.totalCents!==expectedTotalCents)throw Error('Market price changed. Review the updated quote.');
 const volume=market.volume[part]??{bought:0,sold:0},buy=side==='buy';
 const trade:MarketTrade={id,at:now,part,side,quantity,totalCents:quote.totalCents};
 const next:CollectorState={...state,stock:{...state.stock,[part]:(state.stock[part]??0)+(buy?quantity:-quantity)},market:{...market,volume:{...market.volume,[part]:{bought:volume.bought+(buy?quantity:0),sold:volume.sold+(buy?0:quantity)}},history:[trade,...market.history].slice(0,50),boughtCents:market.boughtCents+(buy?quote.totalCents:0),soldCents:market.soldCents+(buy?0:quote.totalCents)}};
 return {state:next,trade,cashDeltaCents:buy?-quote.totalCents:quote.totalCents};
}
