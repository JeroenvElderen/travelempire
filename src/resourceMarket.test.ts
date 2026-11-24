import {describe,it,expect} from 'vitest';
import {emptyCollector,collectorStorageUsage,addCollector,collectorVehicles,type CollectorTrip} from './resourceCollectors';
import {executeMarketTrade,marketQuote,marketUnitPrices,marketForDay,MARKET_DAILY_LIMIT} from './resourceMarket';
const day=86400000,now=day*10;
const initial=()=>({...emptyCollector(),stock:{mechanical:12}});
describe('resource marketplace',()=>{
 it('trades directly into warehouse stock without fabricating collection deliveries',()=>{
  const state=initial(),quote=marketQuote(state,{},100000,now,'mechanical','buy',5);
  const buy=executeMarketTrade(state,{},100000,now,'mechanical','buy',5,'buy-1',quote.totalCents);
  expect(buy.state.stock.mechanical).toBe(17);
  expect(buy.cashDeltaCents).toBe(-quote.totalCents);
  expect(buy.state.delivered).toEqual({});
  const sellQuote=marketQuote(buy.state,{},100000,now,'mechanical','sell',5);
  const sale=executeMarketTrade(buy.state,{},100000,now,'mechanical','sell',5,'sell-1',sellQuote.totalCents);
  expect(sale.state.stock.mechanical).toBe(12);
  expect(sale.cashDeltaCents).toBeLessThan(quote.totalCents);
  expect(sale.state.market?.history).toHaveLength(2);
  expect(()=>executeMarketTrade(sale.state,{},100000,now,'mechanical','sell',5,'sell-1',sellQuote.totalCents)).toThrow();
 });
 it('rejects stale prices, insufficient cash, unavailable inventory and invalid amounts',()=>{
  const state=initial();
  expect(marketQuote(state,{},0,now,'mechanical','buy',1).reason).toMatch(/cash/);
  expect(marketQuote(state,{},1000,now,'rare','sell',1).reason).toMatch(/inventory/);
  expect(()=>marketQuote(state,{},1000,now,'mechanical','buy',1.5)).toThrow();
  expect(()=>executeMarketTrade(state,{},100000,now,'mechanical','buy',1,'wrong-price',1)).toThrow(/price changed/);
 });
 it('reserves space for active shipments and never overfills per-resource storage',()=>{
  const trip:CollectorTrip={path:[[23,38],[23.01,38],[23,38]],outboundMetres:800,distance:1600,startedAt:0,endsAt:1000,part:'mechanical',quantity:12};
  const base={...emptyCollector(),stock:{mechanical:135},trip};
  const state=addCollector(base,'light','second',{collectorBasics:1});
  expect(collectorVehicles(state)[0].trip).toBe(trip);
  expect(collectorStorageUsage(state).reserved).toBe(12);
  expect(marketQuote(state,{},100000,now,'mechanical','buy',4).reason).toMatch(/warehouse/);
  expect(marketQuote(state,{},100000,now,'mechanical','buy',3).maxQuantity).toBe(3);
 });
 it('limits daily volume, moves prices with demand, and preserves history after rollover',()=>{
  const state=initial(),before=marketUnitPrices(state,'rare',now),qty=MARKET_DAILY_LIMIT.rare;
  const quote=marketQuote(state,{},100000,now,'rare','buy',qty);
  const next=executeMarketTrade(state,{},100000,now,'rare','buy',qty,'rare-order',quote.totalCents).state;
  const after=marketUnitPrices(next,'rare',now);
  expect(after.buyAvailable).toBe(0);
  expect(after.buyCents).toBeGreaterThan(before.buyCents);
  expect(marketUnitPrices(next,'rare',now+day).buyAvailable).toBe(qty);
  expect(marketForDay(next,now+day).history).toHaveLength(1);
 });
});
