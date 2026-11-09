import {describe,it,expect} from 'vitest';
import {buyPropertyShare,emptyPortfolio,ownership,propertyValuationCents,settlePropertyDividends} from './investments';
import type {InvestablePOI} from './investments';

const hotel:InvestablePOI={id:'osm-hotel-123',name:'Example Hotel',kind:'hotel',position:[22.9,37.6]};
const day=86400000;

describe('fractional property investments',()=>{
 it('adds repeated purchases to the same holding without changing its valuation',()=>{
  const first=buyPropertyShare(emptyPortfolio(),hotel,1500000,day);
  const second=buyPropertyShare(first,hotel,1500000,day);
  expect(second.holdings[hotel.id].investedCents).toBe(3000000);
  expect(ownership(second.holdings[hotel.id])).toBeCloseTo(3000000/propertyValuationCents(hotel));
  expect(second.holdings[hotel.id].valuationCents).toBe(first.holdings[hotel.id].valuationCents);
 });
 it('can reach exactly 100 percent and rejects purchases exceeding the value',()=>{
  const value=propertyValuationCents(hotel);
  const full=buyPropertyShare(emptyPortfolio(),hotel,value,day);
  expect(ownership(full.holdings[hotel.id])).toBe(1);
  expect(()=>buyPropertyShare(full,hotel,100,day)).toThrow();
 });
 it('pays dividends once for each simulated day and not again on refresh',()=>{
  const investment=buyPropertyShare(emptyPortfolio(),hotel,1500000,day);
  const first=settlePropertyDividends(investment,day*2);
  expect(first.incomeCents).toBeGreaterThan(0);
  const duplicate=settlePropertyDividends(first.portfolio,day*2);
  expect(duplicate.incomeCents).toBe(0);
  expect(duplicate.portfolio).toBe(first.portfolio);
 });
 it('never pays unlimited offline dividends',()=>{
  const investment=buyPropertyShare(emptyPortfolio(),hotel,1500000,0);
  const result=settlePropertyDividends(investment,day*1000);
  expect(result.days).toBe(30);
 });
});
