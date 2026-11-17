import {describe,expect,it} from 'vitest';
import {
 emptyTransportAnalytics,recordCompletedTransportFares,
 recordExpiredTransportRequests,recordTransportReroute,
 transportAnalyticsReport,transportAreaFor,TRANSPORT_MAX_DAYS,
 type TransportFareEvent,
} from './transportAnalytics';
import {tickTaxi,meters,type Taxi,type Point,type RoadGraph} from './taxi';

const DAY='2026-11-17';
const NOW=Date.parse(DAY+'T10:00:00Z');
const job=(id:string,overrides:Partial<TransportFareEvent>={}):TransportFareEvent=>({
 id,fare:25,pickup:[23.7275,37.9838],passengerType:'business',
 pickupPlaceKind:'business',pickupPlaceName:'Athens city centre',
 estimatedDirectCost:7.5,satisfaction:92,estimatedTrafficDelaySeconds:80,
 ...overrides,
});

describe('Phase 5 persisted passenger and traffic analytics',()=>{
 it('counts only completed paid fares and is idempotent by request ID',()=>{
  const a=recordCompletedTransportFares(undefined,DAY,[job('ride-1')])!;
  const b=recordCompletedTransportFares(a,DAY,[job('ride-1')])!;
  expect(b).toBe(a);
  const c=recordCompletedTransportFares(a,DAY,[job('ride-2',{fare:50,passengerType:'tourist'})])!;
  const report=transportAnalyticsReport(c,NOW,'today');
  expect(report.trips).toBe(2);
  expect(report.revenue).toBe(75);
  expect(report.costQuotedTrips).toBe(2);
  expect(report.estimatedDirectContribution).toBeCloseTo(60);
  expect(report.averageSatisfaction).toBe(92);
  expect(report.estimatedTrafficDelaySeconds).toBe(160);
  expect(report.categories.map(v=>v.name)).toContain('Business');
  expect(report.categories.map(v=>v.name)).toContain('Tourists');
  expect(report.areas[0].name).toBe('Athens city centre');
 });
 it('separates expired bookings from paid fares with duplicate protection',()=>{
  const one=recordExpiredTransportRequests(undefined,DAY,[
   {id:'missed-1',passengerType:'family'},{id:'missed-2',passengerType:'tourist'},
   {id:'missed-1',passengerType:'family'},
  ])!;
  const repeated=recordExpiredTransportRequests(one,DAY,[
   {id:'missed-1',passengerType:'family'},
  ])!;
  expect(repeated).toBe(one);
  const report=transportAnalyticsReport(one,NOW,'today');
  expect(report.missed).toBe(2);
  expect(report.trips).toBe(0);
  expect(report.revenue).toBe(0);
  expect(report.categories.find(c=>c.id==='family')?.missed).toBe(1);
 });
 it('records successful detour savings without inventing income',()=>{
  const one=recordTransportReroute(undefined,DAY,100)!;
  const two=recordTransportReroute(one,DAY,80)!;
  expect(recordTransportReroute(two,DAY,-5)).toBe(two);
  const r=transportAnalyticsReport(two,NOW,'today');
  expect(r.reroutes).toBe(2);
  expect(r.estimatedSecondsSaved).toBe(180);
  expect(r.revenue).toBe(0);
  expect(r.estimatedTrafficDelaySeconds).toBe(0);
 });
 it('marks partial cost quotes as missing, not zero-cost profit',()=>{
  const state=recordCompletedTransportFares(undefined,DAY,[
   job('known'),job('legacy',{estimatedDirectCost:undefined,satisfaction:undefined,
    estimatedTrafficDelaySeconds:undefined}),
  ])!;
  const r=transportAnalyticsReport(state,NOW,'today');
  expect(r.revenue).toBe(50);
  expect(r.costQuotedTrips).toBe(1);
  expect(r.estimatedDirectContribution).toBeNull();
  expect(r.trafficDelayTrips).toBe(1);
  expect(r.averageSatisfaction).toBe(92);
 });
 it('uses the simulated day, not the device date, for report windows',()=>{
  let state=recordCompletedTransportFares(undefined,'2026-11-09',[job('old')])!;
  state=recordCompletedTransportFares(state,DAY,[job('recent')])!;
  expect(transportAnalyticsReport(state,NOW,'today').revenue).toBe(25);
  expect(transportAnalyticsReport(state,NOW,'7d').revenue).toBe(25);
  expect(transportAnalyticsReport(state,NOW,'30d').revenue).toBe(50);
 });
 it('caps historical days and stable dedup IDs for iPhone Safari saves',()=>{
  let state=emptyTransportAnalytics();
  for(let n=0;n<TRANSPORT_MAX_DAYS+15;n++){
   const day=new Date(Date.UTC(2026,0,1+n)).toISOString().slice(0,10);
   state=recordCompletedTransportFares(state,day,[job('request-'+n)])!;
  }
  expect(Object.keys(state.days).length).toBe(TRANSPORT_MAX_DAYS);
  expect(state.recentPaidIds.length).toBe(TRANSPORT_MAX_DAYS+15);
  expect(transportAnalyticsReport(undefined,NOW,'30d').trips).toBe(0);
 });
 it('uses regional discovered-road buckets instead of geocoding every trip',()=>{
  const a=transportAreaFor([23.7275,37.9838],'Athens centre');
  expect(a.id).toBe(transportAreaFor([23.729,37.987]).id);
  expect(a.name).toBe('Athens centre');
  expect(transportAreaFor([NaN,37]).id).toBe('unknown');
 });
 it('never posts revenue from zero, negative or invalid fare events',()=>{
  const state=emptyTransportAnalytics();
  expect(recordCompletedTransportFares(state,DAY,[job('zero',{fare:0}),
   job('invalid',{fare:Infinity})])).toBe(state);
 });
});

describe('pickup delay is based on the actual discovered passenger route',()=>{
 const A:Point=[23.7275,37.9838],B:Point=[23.7276,37.9838],
 C:Point=[23.7277,37.9838];
 const graph:RoadGraph={
  nodes:new Map([['a',A],['b',B],['c',C]]),nodeKeys:['a','b','c'],
  edges:new Map([
   ['a',[{to:'b',id:'ab',meters:meters(A,B),speedKph:40}]],
   ['b',[{to:'c',id:'bc',meters:meters(B,C),speedKph:40}]],
   ['c',[]],
  ]),
 };
 it('captures congestion once at boarding, then clears at dropoff',()=>{
  const taxi:Taxi={
   id:'cab',name:'Cab',driver:'Alex',kind:'taxi',position:A,status:'TO_PICKUP',
   path:[A,B],edgeIds:['ab'],leg:0,distanceIntoLeg:0,fare:14,completed:0,
   pickup:B,dropoff:C,activeJobId:'ride-paid',jobEstimatedDirectCost:5,
   jobPassengerType:'business',jobPickupCreatedAt:Date.now()-60000,
   jobPickupDeadlineAt:Date.now()+600000,
  };
  const rush=Date.parse('2026-11-16T06:30:00Z');
  const picked=tickTaxi(taxi,graph,5,new Set(['ab','bc']),rush);
  expect(picked.taxi.status).toBe('TO_DROPOFF');
  expect(picked.taxi.jobTrafficDelaySeconds).toBeGreaterThan(0);
  expect(picked.taxi.jobEstimatedDirectCost).toBe(5);
  const completed=tickTaxi(picked.taxi,graph,5,new Set(['ab','bc']),rush);
  expect(completed.taxi.status).toBe('IDLE');
  expect(completed.taxi.jobTrafficDelaySeconds).toBeUndefined();
  expect(completed.taxi.jobEstimatedDirectCost).toBeUndefined();
  expect(completed.earned).toBeGreaterThan(0);
 });
});
