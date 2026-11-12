import {describe,expect,it} from 'vitest';
import {createPassengerRequest,passengerPairKey,pricedPassengerFare,tickTaxi,
 type Point,type RoadGraph,type Taxi} from './taxi';

const A:Point=[23.9,37.9], B:Point=[23.903,37.9], C:Point=[23.905,37.9];
const ka='23.900000,37.900000',kb='23.903000,37.900000',kc='23.905000,37.900000';
const graph:RoadGraph={
 nodes:new Map([[ka,A],[kb,B],[kc,C]]),nodeKeys:[ka,kb,kc],
 edges:new Map([
  [ka,[{to:kb,id:'ab',meters:264,speedKph:30,highway:'residential'}]],
  [kb,[{to:ka,id:'ab',meters:264,speedKph:30,highway:'residential'},
       {to:kc,id:'bc',meters:176,speedKph:30,highway:'residential'}]],
  [kc,[{to:kb,id:'bc',meters:176,speedKph:30,highway:'residential'}]]
 ])
};
const purple=new Set(['ab','bc']);
describe('actual-distance fare and repeated passenger routes',()=>{
 it('reprices at pickup from the actual passenger route instead of a stale quote',()=>{
  const assigned:Taxi={
   id:'taxi-1',kind:'taxi',name:'Taxi',driver:'Driver',position:A,
   status:'TO_PICKUP',path:[A,B],edgeIds:['ab'],leg:0,distanceIntoLeg:0,
   pickup:B,dropoff:C,fare:20,jobSurgeMultiplier:1.25,
   activeJobId:'unique-passenger-job',completed:0
  };
  const pickedUp=tickTaxi(assigned,graph,120,purple);
  expect(pickedUp.taxi.status).toBe('TO_DROPOFF');
  expect(pickedUp.taxi.jobDistanceMeters).toBeGreaterThan(150);
  expect(pickedUp.taxi.jobDistanceMeters).toBeLessThan(200);
  expect(pickedUp.taxi.fare).toBe(
   pricedPassengerFare(pickedUp.taxi.jobDistanceMeters!,1.25));
  expect(pickedUp.taxi.fare).toBeLessThan(10);
  expect(pickedUp.earned).toBe(0);
  const arrived=tickTaxi(pickedUp.taxi,graph,120,purple);
  expect(arrived.finished).toBe(true);
  expect(arrived.earned).toBe(pickedUp.taxi.fare);
  expect(arrived.taxi.status).toBe('IDLE');
  expect(arrived.taxi.activeJobId).toBeUndefined();
 });
 it('does not generate a previously used pickup/dropoff pair again',()=>{
  const excluded=new Set([
   passengerPairKey(A,B),passengerPairKey(B,A),
   passengerPairKey(B,C),passengerPairKey(C,B),
   passengerPairKey(A,C),passengerPairKey(C,A)
  ]);
  expect(createPassengerRequest(graph,purple,A,Date.now(),1,
   new Set([ka,kb,kc]),excluded)).toBeNull();
 });
});
