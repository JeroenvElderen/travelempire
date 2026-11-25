import {describe,expect,it} from 'vitest';
import {ferryVoyageEconomics,standardFerryFare,FERRY_PASSENGER_CAPACITY} from './ferryEconomics';
describe('shared ferry economics',()=>{
 it('uses Greek-local departure hours, not UTC arrival hours',()=>{
  const rush=Date.parse('2026-01-12T05:30:00Z'); // 07:30 Athens
  const quiet=Date.parse('2026-01-12T02:30:00Z'); // 04:30 Athens
  expect(ferryVoyageEconomics(60,rush).passengers).toBeGreaterThan(ferryVoyageEconomics(60,quiet).passengers);
 });
 it('models seasonal and weekend demand within vessel capacity',()=>{
  const winter=Date.parse('2026-01-12T09:00:00Z'),summer=Date.parse('2026-07-13T08:00:00Z');
  expect(ferryVoyageEconomics(60,summer).passengers).toBeGreaterThan(ferryVoyageEconomics(60,winter).passengers);
  const busy=ferryVoyageEconomics(240,summer,1);
  expect(busy.passengers).toBeLessThanOrEqual(FERRY_PASSENGER_CAPACITY);
  expect(busy.occupancy).toBeLessThanOrEqual(1);
 });
 it('does not guarantee extra profit from excessive ticket prices',()=>{
  const at=Date.parse('2026-07-13T08:00:00Z');
  const normal=ferryVoyageEconomics(60,at),expensive=ferryVoyageEconomics(60,at,100);
  expect(expensive.passengers).toBeLessThan(normal.passengers);
  expect(expensive.net).toBeLessThan(normal.net);
  expect(normal.net).toBeCloseTo(normal.revenue-normal.cost);
  expect(normal.ticket).toBe(standardFerryFare(60));
  expect(ferryVoyageEconomics(600,at).ticket).toBe(100);
 });
});
