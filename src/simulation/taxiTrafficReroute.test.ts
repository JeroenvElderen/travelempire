import {afterEach,describe,expect,it} from 'vitest';
import {meters,tickTaxi,type Point,type RoadGraph,type Taxi} from './taxi';
import {setTrafficIncidents} from './trafficConditions';
import {planTaxiTrafficDetour,adoptTaxiTrafficDetour,type MovingTrafficSnapshot} from './taxiTrafficReroute';

const A:Point=[23.720,37.980],B:Point=[23.723,37.980],
 C:Point=[23.740,37.980],D:Point=[23.731,37.982];
const nodes=new Map<string,Point>([['A',A],['B',B],['C',C],['D',D]]);
const edges:RoadGraph['edges']=new Map([...nodes.keys()].map(k=>[k,[]]));
const add=(from:string,to:string,id:string,speedKph:number)=>{
 edges.get(from)!.push({to,id,speedKph,meters:meters(nodes.get(from)!,nodes.get(to)!)});
};
add('A','B','ab',45);add('B','C','bc',65);add('B','D','bd',50);add('D','C','dc',50);
// Return road is not present: plans must honour the directed graph.
const graph:RoadGraph={nodes,edges,nodeKeys:[...nodes.keys()]};
const clock=Date.parse('2026-11-16T06:30:00Z');
const position:Point=[A[0]+(B[0]-A[0])*.35,A[1]];
const distance=meters(A,position);
const snapshot=():MovingTrafficSnapshot=>({
 status:'TO_DROPOFF',jobId:'ride-1',roadId:'ab',
 fromNode:'A',toNode:'B',segmentStart:A,segmentEnd:B,
 position,distanceIntoLeg:distance,
 remainingPath:[A,B,C],remainingEdgeIds:['ab','bc'],
 destination:C,gameAt:clock,
});
const discovered=new Set(['ab','bc','bd','dc']);
const taxi=():Taxi=>({
 id:'t1',name:'Taxi 1',driver:'Sofia',kind:'taxi',
 status:'TO_DROPOFF',path:[A,B,C],edgeIds:['ab','bc'],
 position,leg:0,distanceIntoLeg:distance,
 pickup:A,dropoff:C,activeJobId:'ride-1',
 fare:89.95,completed:8,jobDrivenMeters:230,
 jobPassengerType:'business',jobPassengerCount:2,
});
afterEach(()=>setTrafficIncidents([]));

describe('traffic-aware passenger rerouting',()=>{
 it('finds a real alternative around an active collision',()=>{
  setTrafficIncidents([{roadId:'bc',kind:'collision',startedAt:clock-60000,endsAt:clock+600000}]);
  const result=planTaxiTrafficDetour(graph,snapshot(),discovered);
  expect(result.reason).toBe('ok');
  expect(result.plan?.edgeIds).toEqual(['ab','bd','dc']);
  expect(result.plan?.path).toEqual([A,B,D,C]);
  expect(result.plan?.savedSeconds).toBeGreaterThan(35);
 });
 it('preserves the exact directed road and in-progress passenger job',()=>{
  setTrafficIncidents([{roadId:'bc',kind:'collision',startedAt:clock-60000,endsAt:clock+600000}]);
  const plan=planTaxiTrafficDetour(graph,snapshot(),discovered).plan!;
  expect(plan).toBeTruthy();
  const advance=taxi();
  advance.distanceIntoLeg+=8;
  advance.position=[A[0]+(B[0]-A[0])*(advance.distanceIntoLeg/meters(A,B)),A[1]];
  const result=adoptTaxiTrafficDetour(advance,plan,snapshot());
  expect(result?.position).toEqual(advance.position);
  expect(result?.distanceIntoLeg).toBe(advance.distanceIntoLeg);
  expect(result?.path).toEqual([A,B,D,C]);
  expect(result?.leg).toBe(0);
  expect(result?.fare).toBe(89.95);
  expect(result?.activeJobId).toBe('ride-1');
  expect(result?.jobDrivenMeters).toBe(230);
  expect(result?.completed).toBe(8);
  const moving=tickTaxi(result!,graph,1,discovered,clock);
  expect(moving.taxi.status).toBe('TO_DROPOFF');
  expect(moving.taxi.position[0]).toBeGreaterThan(advance.position[0]);
  expect(moving.taxi.leg).toBe(0);
  expect(moving.earned).toBe(0);
  expect(moving.discovered).toEqual([]);
 });
 it('never crosses undiscovered road links with a passenger aboard',()=>{
  setTrafficIncidents([{roadId:'bc',kind:'collision',startedAt:clock-60000,endsAt:clock+600000}]);
  const result=planTaxiTrafficDetour(graph,snapshot(),new Set(['ab','bc']));
  expect(result.plan).toBeNull();
 });
 it('does not replace an unaffected shortest route',()=>{
  const result=planTaxiTrafficDetour(graph,snapshot(),discovered);
  expect(result.plan).toBeNull();
 });
 it('rejects stale results after job change, new edge or different level',()=>{
  const plan={path:[A,B,D,C],edgeIds:['ab','bd','dc'],previousSeconds:500,proposedSeconds:200,savedSeconds:300};
  expect(adoptTaxiTrafficDetour({...taxi(),activeJobId:'ride-2'},plan,snapshot())).toBeNull();
  expect(adoptTaxiTrafficDetour({...taxi(),leg:1,distanceIntoLeg:3,position:B},plan,snapshot())).toBeNull();
  expect(adoptTaxiTrafficDetour({...taxi(),path:[[23.72,37.99],B,C]},plan,snapshot())).toBeNull();
  expect(adoptTaxiTrafficDetour({...taxi(),status:'PAUSED'},plan,snapshot())).toBeNull();
 });
 it('rejects non-directed and off-road starting positions safely',()=>{
  setTrafficIncidents([{roadId:'bc',kind:'collision',startedAt:clock-60000,endsAt:clock+600000}]);
  const wrong={...snapshot(),fromNode:'B',toNode:'A'};
  expect(planTaxiTrafficDetour(graph,wrong,discovered).plan).toBeNull();
  expect(planTaxiTrafficDetour(graph,{...snapshot(),position:[23.723,38.1]},discovered).plan).toBeNull();
 });
});
