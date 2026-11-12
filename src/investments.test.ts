import {describe,it,expect} from 'vitest';
import {buyPropertyShare,emptyPortfolio,ownership,propertyOperations,propertyValuationCents,propertyCapacity,settlePropertyDividends} from './investments';
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
 it('gives each hotel a consistent physical room count and nightly revenue',()=>{
  const asset={id:hotel.id,kind:hotel.kind,valuationCents:propertyValuationCents(hotel)};
  const morning=propertyOperations(asset,200*24+8);
  const evening=propertyOperations(asset,200*24+20);
  expect(propertyCapacity(asset)).toBe(morning.capacity);
  expect(morning.unitKind).toBe('room');
  expect(morning.ratePeriod).toBe('night');
  expect(morning.capacity).toBeGreaterThan(10);
  expect(morning.occupiedUnits+morning.vacantUnits).toBe(morning.capacity);
  expect(morning.occupiedUnits).toBe(evening.occupiedUnits);
  expect(morning.grossCents).toBe(evening.grossCents);
  expect(morning.grossCents).toBeCloseTo(
   morning.occupiedUnits*morning.unitRateEuros*100/24,0);
  expect(morning.fixedCostCents+morning.variableCostCents).toBe(morning.costCents);
 });
 it('produces hourly parking revenue per occupied space',()=>{
  const asset={id:parking.id,kind:parking.kind,valuationCents:propertyValuationCents(parking)};
  const daytime=propertyOperations(asset,200*24+14);
  const nighttime=propertyOperations(asset,200*24+2);
  expect(daytime.unitKind).toBe('space');
  expect(daytime.ratePeriod).toBe('hour');
  expect(daytime.occupiedUnits+daytime.vacantUnits).toBe(daytime.capacity);
  expect(daytime.occupiedUnits).toBeGreaterThan(nighttime.occupiedUnits);
  expect(daytime.grossCents).toBe(daytime.occupiedUnits*Math.round(daytime.unitRateEuros*100));
  expect(daytime.costCents).toBe(daytime.fixedCostCents+daytime.variableCostCents);
 });
 it('keeps saved property capacity and payouts stable after additional share purchases',()=>{
  const original=buyPropertyShare(emptyPortfolio(),parking,1200000,day);
  const before=original.holdings[parking.id];
  const extended=buyPropertyShare(original,parking,1000000,day);
  const after=extended.holdings[parking.id];
  expect(propertyCapacity(before)).toBe(propertyCapacity(after));
  expect(propertyOperations(before,200*24)).toEqual(propertyOperations(after,200*24));
  const first=settlePropertyDividends(original,day+hour);
  const expanded=settlePropertyDividends(extended,day+hour);
  expect(expanded.incomeCents).toBeGreaterThan(first.incomeCents);
  expect(settlePropertyDividends(expanded.portfolio,day+hour).incomeCents).toBe(0);
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
  expect(settlePropertyDividends(portfolio,day*2).incomeCents).toBe(0);
  const next=settlePropertyDividends(portfolio,day*2+hour);
  expect(next.hours).toBe(1);
 });
});
