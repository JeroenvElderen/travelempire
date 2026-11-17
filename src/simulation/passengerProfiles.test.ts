import {describe,expect,it} from 'vitest';
import {passengerProfileFor,passengerCapacity,passengerCompatible} from './passengerProfiles';
const pickup:[number,number]=[23.72,37.98];
describe('passenger bookings',()=>{
 it('uses consistent profiles for one job',()=>{
  const job={id:'ride-a',pickup,tripType:'regional' as const},t=Date.parse('2026-07-06T09:00:00Z');
  expect(passengerProfileFor(job,t)).toEqual(passengerProfileFor(job,t));
 });
 it('makes varied customers with 1–6 passengers',()=>{
  const kinds=new Set<string>();
  for(let i=0;i<200;i++){
   const p=passengerProfileFor({id:'job-'+i,pickup,tripType:'local'},Date.parse('2026-07-06T09:00:00Z'));
   kinds.add(p.passengerType);expect(p.partySize).toBeGreaterThanOrEqual(1);expect(p.partySize).toBeLessThanOrEqual(6);
  }
  expect(kinds.size).toBeGreaterThan(3);
 });
 it('never assigns oversized or premium bookings to unsuitable vehicles',()=>{
  expect(passengerCapacity({vehicleClass:'XL'})).toBe(6);
  expect(passengerCompatible({vehicleClass:'Standard',vehicleSeats:4},{partySize:5})).toBe(false);
  expect(passengerCompatible({vehicleClass:'XL',vehicleSeats:6},{partySize:5,luggageCount:4})).toBe(true);
  expect(passengerCompatible({vehicleClass:'Standard'},{minimumClass:'Premium'})).toBe(false);
  expect(passengerCompatible({vehicleClass:'Premium'},{minimumClass:'Premium'})).toBe(true);
  expect(passengerCompatible({vehicleClass:'Standard'},{})).toBe(true);
 });
});
