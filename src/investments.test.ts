import {describe,it,expect} from 'vitest';
import {buyPropertyShare,emptyPortfolio,ownership,propertyOperations,propertyValuationCents,settlePropertyDividends} from './investments';
import type {InvestablePOI} from './investments';

const hotel:InvestablePOI={id:'osm-hotel-123',name:'Example Hotel',kind:'hotel',position:[22.9,37.6]};
const parking:InvestablePOI={id:'osm-parking-456',name:'Example Parking',kind:'parking',position:[22.9,37.6]};
const hour=3600000;
const day=24*hour;

describe('hourly property investments',()=>{
 it('adds repeated purchases to the same holding without changing its valuation',()=>{
  const first=buyPropertyShare(emptyPortfolio(),hotel,1500000,day);
  const second=buyPropertyShare(first,hotel,1500000,day);
  expect(second.holdings[hotel.id].investedCents).toBe(3000000);
  expect(ownership(second.holdings[hotel.id])).toBeCloseTo(3000000/propertyValuationCents(hotel));
  expect(second.holdings[hotel.id].valuationCents).toBe(first.holdings[hotel.id].valuationCents);
 });
 it('can reach exactly 100 percent and rejects additional ownership',()=>{
  const value=propertyValuationCents(hotel);
  const full=buyPropertyShare(emptyPortfolio(),hotel,value,day);
  expect(ownership(full.holdings[hotel.id])).toBe(1);
  expect(()=>buyPropertyShare(full,hotel,100,day)).toThrow();
 });
 it('only pays completed hours and never double-pays when refreshed',()=>{
  const investment=buyPropertyShare(emptyPortfolio(),hotel,1500000,day);
  expect(settlePropertyDividends(investment,day+hour/2).incomeCents).toBe(0);
  const first=settlePropertyDividends(investment,day+hour);
  expect(first.incomeCents).toBeGreaterThan(0);
  expect(first.hours).toBe(1);
  const duplicate=settlePropertyDividends(first.portfolio,day+hour);
  expect(duplicate.incomeCents).toBe(0);
  expect(duplicate.portfolio).toBe(first.portfolio);
 });
 it('calculates seasonality for hotels and time-of-day demand for parking',()=>{
  const value=propertyValuationCents(hotel);
  const winter=propertyOperations({id:hotel.id,kind:'hotel',valuationCents:value},10*24+12);
  const summer=propertyOperations({id:hotel.id,kind:'hotel',valuationCents:value},200*24+12);
  expect(summer.activityPercent).toBeGreaterThan(winter.activityPercent);
  const parkingValue=propertyValuationCents(parking);
  const dayDemand=propertyOperations({id:parking.id,kind:'parking',valuationCents:parkingValue},200*24+12);
  const nightDemand=propertyOperations({id:parking.id,kind:'parking',valuationCents:parkingValue},200*24+2);
  expect(dayDemand.activityPercent).toBeGreaterThan(nightDemand.activityPercent);
  expect(dayDemand.grossCents).toBeGreaterThan(dayDemand.costCents);
 });
 it('limits catch-up to 30 simulated days',()=>{
  const investment=buyPropertyShare(emptyPortfolio(),hotel,1500000,0);
  const result=settlePropertyDividends(investment,day*1000);
  expect(result.hours).toBe(720);
 });
 it('migrates legacy daily settlements without paying the same day twice',()=>{
  const owned=buyPropertyShare(emptyPortfolio(),hotel,1500000,day);
  const legacy={...owned.holdings[hotel.id],lastDay:1,lastHour:undefined};
  const portfolio={holdings:{[hotel.id]:legacy}};
  expect(settlePropertyDividends(portfolio,day+20*hour).incomeCents).toBe(0);
  const next=settlePropertyDividends(portfolio,day*2);
  expect(next.hours).toBe(1);
 });
});
