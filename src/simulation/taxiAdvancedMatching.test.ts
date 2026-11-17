import {describe,expect,it} from 'vitest';
import type {Taxi,PassengerRequest} from './taxi';
import {
 passengerPickupPatienceMinutes,withPassengerPickupDeadline,
 passengerPickupCanArrive,passengerPickupSatisfaction,
 currentPassengerTripSeconds,advancedTaxiBid,rankPassengerQueue,
} from './taxiAdvancedMatching';

const baseTime=Date.parse('2026-11-16T06:30:00Z');
const t=(patch:Partial<Taxi>={}):Taxi=>({
 id:'cab-1',name:'Car One',driver:'Alex',kind:'taxi',
 position:[23.72,37.98],status:'IDLE',path:[],edgeIds:[],
 leg:0,distanceIntoLeg:0,fare:0,completed:0,vehicleFuel:'Petrol',
 ...patch,
});
const job=(patch:Partial<PassengerRequest>={}):PassengerRequest=>({
 id:'booking-1',pickup:[23.72,37.98],dropoff:[23.80,37.98],
 fare:60,tripDistanceMeters:6500,tripTravelSeconds:700,
 createdAt:baseTime,expiresAt:baseTime+120000,
 tripType:'local',passengerType:'local',
 ...patch,
});

describe('Phase 4 advanced taxi job matching',()=>{
 it('gives airports, families and business customers distinct pickup patience',()=>{
  expect(passengerPickupPatienceMinutes(job({pickupPlaceKind:'airport'}))).toBe(18);
  expect(passengerPickupPatienceMinutes(job({passengerType:'family'}))).toBe(16);
  expect(passengerPickupPatienceMinutes(job({passengerType:'business'}))).toBe(10);
  const request=withPassengerPickupDeadline(job({passengerType:'commuter'}),baseTime);
  expect(request.pickupDeadlineAt).toBe(baseTime+10*60000);
  expect(request.expiresAt).toBe(request.pickupDeadlineAt);
 });
 it('does not accept a new booking whose legal pickup ETA misses the deadline',()=>{
  const r=withPassengerPickupDeadline(job(),baseTime);
  expect(passengerPickupCanArrive(r,baseTime+60000,8*60)).toBe(true);
  expect(passengerPickupCanArrive(r,baseTime+60000,12*60)).toBe(false);
  expect(advancedTaxiBid('max-profit',t(),r,1500,12*60,baseTime+60000,baseTime,72000,'flexible')).toBeNull();
 });
 it('retains legacy requests with no deadline for existing saves',()=>{
  expect(passengerPickupCanArrive(job(),baseTime+10*60000,1800)).toBe(true);
  expect(advancedTaxiBid('max-jobs',t(),job(),600,100,baseTime,baseTime,undefined,'flexible')).not.toBeNull();
 });
 it('scores predicted satisfaction based on real waiting time',()=>{
  const r=withPassengerPickupDeadline(job({passengerType:'business'}),baseTime);
  const quick=passengerPickupSatisfaction(r,baseTime,60);
  const slow=passengerPickupSatisfaction(r,baseTime+5*60000,240);
  expect(quick).toBeGreaterThan(slow);
  expect(slow).toBeGreaterThanOrEqual(0);
  expect(passengerPickupSatisfaction(r,baseTime+30*60000,0)).toBe(0);
 });
 it('converts game-time shift remaining into REAL taxi travel seconds',()=>{
  const r=withPassengerPickupDeadline(job(),baseTime);
  // 2400 in-game seconds = 100 actual seconds, shorter than pickup.
  expect(advancedTaxiBid('balanced',t(),r,1700,220,baseTime,baseTime,2400,'flexible')).toBeNull();
  expect(advancedTaxiBid('balanced',t(),r,1700,220,baseTime,baseTime,24000,'flexible')).not.toBeNull();
 });
 it('prefer drivers with adequate remaining duty, without cancelling valid fares',()=>{
  const r=withPassengerPickupDeadline(job(),baseTime);
  const short=advancedTaxiBid('max-profit',t(),r,800,90,baseTime,baseTime,6000,'flexible');
  const long=advancedTaxiBid('max-profit',t(),r,800,90,baseTime,baseTime,90000,'flexible');
  expect(short).not.toBeNull();
  expect(short!.shiftOverrunSeconds).toBeGreaterThan(0);
  expect(long!.shiftOverrunSeconds).toBe(0);
  expect(long!.score).toBeGreaterThan(short!.score);
 });
 it('improves a willing driver score without overriding deadlines',()=>{
  const r=withPassengerPickupDeadline(job({tripType:'intercity'}),baseTime);
  const flexible=advancedTaxiBid('balanced',t(),r,500,40,baseTime,baseTime,undefined,'flexible');
  const longDriver=advancedTaxiBid('balanced',t(),r,500,40,baseTime,baseTime,undefined,'long-distance');
  expect(longDriver!.score).toBeGreaterThan(flexible!.score);
 });
 it('adjusts existing discovered-road quotes when regional congestion changes',()=>{
  const quiet=Date.parse('2026-11-16T01:30:00Z');
  const rush=Date.parse('2026-11-16T06:30:00Z');
  const mission=job({quotedGameAt:quiet,tripTravelSeconds:1000});
  expect(currentPassengerTripSeconds(mission,rush)).toBeGreaterThan(1000);
  expect(currentPassengerTripSeconds(job({tripTravelSeconds:1000}),rush)).toBe(1000);
 });
 it('ranks profitable hourly opportunities ahead of large but inefficient fares',()=>{
  const efficient=job({id:'efficient',fare:50,tripDistanceMeters:8000,tripTravelSeconds:1000});
  const slow=job({id:'slow',fare:130,tripDistanceMeters:28000,tripTravelSeconds:9000});
  const sorted=rankPassengerQueue([slow,efficient],'max-profit',[t()],baseTime,baseTime);
  expect(sorted[0].id).toBe('efficient');
 });
 it('gives older customers fair priority and does not mutate the queue',()=>{
  const fresh=job({id:'new',createdAt:baseTime,tripTravelSeconds:1000});
  const old=job({id:'old',createdAt:baseTime-8*60000,tripTravelSeconds:1000});
  const source=[fresh,old];
  const ordered=rankPassengerQueue(source,'balanced',[t()],baseTime,baseTime);
  expect(ordered[0].id).toBe('old');
  expect(source[0]).toBe(fresh);
 });
});
