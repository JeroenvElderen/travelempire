import {describe,expect,it} from 'vitest';
import {energyRangeKm} from './energy';
import {PassengerStopSpatialIndex} from './passengerDepotDemand';
import {meters,passengerRouteMetres,routeDiscovered,tickTaxi,
 type Point,type RoadGraph,type Taxi} from './taxi';
import {taxiCanStartRepositioning,taxiCanCompleteRepositioning,
 taxiDemandScore,taxiRepositionWorthwhile,projectedTaxiSupply,taxiCanLeaveMarket,
 TAXI_REPOSITION_COOLDOWN_MS,TAXI_REPOSITION_MIN_METRES,
 TAXI_REPOSITION_MAX_METRES} from './taxiRepositioning';

const point=(x:number):Point=>[x,38];
const make=()=>{
 const nodes=new Map<string,Point>([
  ['A',point(23)],['B',point(23.002)],['C',point(23.004)],
  ['D',point(23.2)],['upperC',point(23.004)],
 ]);
 const edges:RoadGraph['edges']=new Map([...nodes.keys()].map(k=>[k,[]]));
 const connect=(a:string,b:string,id:string,taxiOnly=false)=>{
  for(const [from,to] of [[a,b],[b,a]]){
   edges.get(from)!.push({id,to,meters:meters(nodes.get(from)!,nodes.get(to)!),
    speedKph:50,highway:'residential',taxiOnly});
  }
 };
 connect('A','B','ab');connect('B','C','bc');
 // D is a disconnected island and upperC is an overlapping grade-separated node.
 const graph:RoadGraph={nodes,edges,nodeKeys:[...nodes.keys()]};
 return {graph,nodes,discovered:new Set(['ab','bc'])};
};
const taxi=(overrides:Partial<Taxi>={}):Taxi=>({
 id:'taxi-1',name:'Taxi 1',driver:'Driver',kind:'taxi',
 position:point(23),status:'IDLE',path:[],edgeIds:[],leg:0,
 distanceIntoLeg:0,completed:0,fare:0,...overrides,
});

describe('Taxi Phase 2 — demand-aware positioning',()=>{
 it('prioritises genuine waiting demand over artificial circular movement',()=>{
  const home={localStops:5,pendingPickups:0,competingIdleTaxis:1};
  const hot={localStops:100,pendingPickups:2,competingIdleTaxis:0};
  expect(taxiRepositionWorthwhile(home,hot,4000)).toBe(true);
  expect(taxiRepositionWorthwhile(hot,home,4000)).toBe(false);
  expect(taxiRepositionWorthwhile(home,home,4000)).toBe(false);
  expect(taxiDemandScore(hot)).toBeGreaterThan(taxiDemandScore(home));
 });
 it('will not reposition a taxi toward an oversupplied, busy-looking region',()=>{
  const current={localStops:60,pendingPickups:0,competingIdleTaxis:0};
  const crowded={localStops:100,pendingPickups:0,competingIdleTaxis:7};
  expect(taxiRepositionWorthwhile(current,crowded,2800)).toBe(false);
 });
 it('rejects trivial moves and faraway speculative demand',()=>{
  const current={localStops:1,pendingPickups:0,competingIdleTaxis:0};
  const target={localStops:120,pendingPickups:5,competingIdleTaxis:0};
  expect(taxiRepositionWorthwhile(current,target,500)).toBe(false);
  expect(taxiRepositionWorthwhile(current,target,16000)).toBe(false);
  expect(TAXI_REPOSITION_MIN_METRES).toBeGreaterThan(1000);
  expect(TAXI_REPOSITION_MAX_METRES).toBeLessThan(10000);
 });
 it('only moves on-duty idle vehicles after a wait and long cooldown',()=>{
  const now=500000;
  expect(taxiCanStartRepositioning(taxi(),now,true,now-61000)).toBe(true);
  expect(taxiCanStartRepositioning(taxi(),now,true,now-40000)).toBe(false);
  expect(taxiCanStartRepositioning(taxi(),now,false,now-62000)).toBe(false);
  expect(taxiCanStartRepositioning(taxi({lastRepositionAt:now-10000}),
   now,true,now-62000)).toBe(false);
  expect(taxiCanStartRepositioning(taxi({lastRepositionAt:now-TAXI_REPOSITION_COOLDOWN_MS}),
   now,true,now-62000)).toBe(true);
 });
 it('does not interrupt paid journeys, genuine rest, ferry, servicing or refuelling',()=>{
  const now=500000;
  for(const vehicle of [
   taxi({status:'TO_PICKUP'}),taxi({status:'TO_DROPOFF'}),
   taxi({status:'RETURNING'}),taxi({status:'REPOSITIONING'}),
   taxi({status:'PAUSED',shiftParked:true}),
   taxi({status:'IDLE',scheduledShiftParked:true}),
   taxi({status:'IDLE',restStopId:'hotel'}),
   taxi({status:'IDLE',refillRequested:true}),
   taxi({status:'IDLE',refillDestination:point(23)}),
   taxi({status:'IDLE',serviceDestination:point(23)}),
   taxi({status:'IDLE',recoveryPending:true}),
   taxi({kind:'explorer'}),
   taxi({deliveryUntil:now+60000}),
  ]){
   expect(taxiCanStartRepositioning(vehicle,now,true,0)).toBe(false);
  }
 });
 it('protects fuel reserves and never chooses an excessively long empty route',()=>{
  const vehicle=taxi();
  expect(taxiCanCompleteRepositioning(vehicle,4000)).toBe(true);
  expect(taxiCanCompleteRepositioning(vehicle,12000)).toBe(false);
  expect(taxiCanCompleteRepositioning(vehicle,400)).toBe(false);
  const almostEmpty=taxi({energyRemaining:.5});
  expect(energyRangeKm(almostEmpty)).toBeLessThan(24);
  expect(taxiCanStartRepositioning(almostEmpty,500000,true,0)).toBe(false);
  expect(taxiCanCompleteRepositioning(almostEmpty,7500)).toBe(false);
 });
 it('counts local discovered stops without a second all-Greece graph copy',()=>{
  const {nodes}=make(),index=new PassengerStopSpatialIndex();
  // The overlapping upper-level node is not a discovered passenger stop.
  for(const [id,p] of nodes)if(id!=='upperC')index.add(id,p);
  expect(index.countNear(point(23),key=>nodes.get(key),500)).toBe(3);
  expect(index.countNear(point(23),key=>nodes.get(key),500,2)).toBe(2);
  expect(index.countNear(point(23),key=>nodes.get(key),100)).toBe(1);
  index.clear();
  expect(index.countNear(point(23),key=>nodes.get(key),500)).toBe(0);
 });
});

describe('Taxi Phase 2 — real roads, same taxi speeds, no phantom revenue',()=>{
 it('requires physically connected Explorer-discovered directed roads',()=>{
  const {graph,discovered}=make();
  const route=routeDiscovered(graph,'A','C',discovered,'',false,12000);
  expect(route?.edgeIds).toEqual(['ab','bc']);
  expect(passengerRouteMetres(route!.path)).toBeGreaterThan(300);
  expect(routeDiscovered(graph,'A','D',discovered,'',false,12000)).toBeNull();
  expect(routeDiscovered(graph,'A','upperC',discovered,'',false,12000)).toBeNull();
  discovered.delete('bc');
  expect(routeDiscovered(graph,'A','C',discovered,'',false,12000)).toBeNull();
 });
 it('an uncharged reposition journey moves via tickTaxi but earns and discovers nothing',()=>{
  const {graph,nodes,discovered}=make();
  const moving=taxi({status:'REPOSITIONING',position:nodes.get('A')!,
   path:[nodes.get('A')!,nodes.get('B')!,nodes.get('C')!],
   edgeIds:['ab','bc'],repositionTarget:nodes.get('C')!,
   lastRepositionAt:100,fare:0});
  let current=moving;
  let earned=0,discoveredRoads=0;
  for(let i=0;i<40&&current.status==='REPOSITIONING';i++){
   const result=tickTaxi(current,graph,5,discovered);
   earned+=result.earned;
   discoveredRoads+=result.discovered.length;
   current=result.taxi;
  }
  expect(current.status).toBe('IDLE');
  expect(current.position).toEqual(nodes.get('C'));
  expect(current.completed).toBe(0);
  expect(current.lastRepositionAt).toBe(100);
  expect(current.repositionTarget).toBeUndefined();
  expect(earned).toBe(0);
  expect(discoveredRoads).toBe(0);
 });
 it('stops at first real road junction after a shift/fuel interruption',()=>{
  const {graph,nodes,discovered}=make();
  let current=taxi({status:'REPOSITIONING',position:nodes.get('A')!,
   path:[nodes.get('A')!,nodes.get('B')!,nodes.get('C')!],
   edgeIds:['ab','bc'],repositionStopPending:true,
   repositionTarget:nodes.get('C')!,lastRepositionAt:100});
  let earned=0;
  for(let i=0;i<40&&current.status==='REPOSITIONING';i++){
   const result=tickTaxi(current,graph,5,discovered);
   earned+=result.earned;
   current=result.taxi;
  }
  expect(current.status).toBe('IDLE');
  expect(current.position).toEqual(nodes.get('B'));
  expect(current.position).not.toEqual(nodes.get('C'));
  expect(current.repositionStopPending).toBeUndefined();
  expect(current.repositionTarget).toBeUndefined();
  expect(earned).toBe(0);
 });
});


describe('fleet-aware repositioning',()=>{
 it('counts committed arrivals and upcoming drop-offs once, not their old locations',()=>{
  const origin=point(23),target=point(23.06);
  const fleet=[
   taxi({id:'self',position:target}),
   taxi({id:'idle',position:target}),
   taxi({id:'incoming',position:origin,status:'REPOSITIONING',repositionTarget:target}),
   taxi({id:'passenger',position:origin,status:'TO_DROPOFF',dropoff:target}),
   taxi({id:'interrupted',status:'REPOSITIONING',repositionTarget:target,repositionStopPending:true}),
   taxi({id:'resting',position:target,status:'PAUSED',shiftParked:true}),
   taxi({id:'fuel',position:target,status:'REFUELLING'}),
   taxi({id:'offduty',position:target}),
  ];
  const available=new Set(['self','idle']);
  expect(projectedTaxiSupply(target,fleet,'self',available)).toBe(2.5);
  expect(projectedTaxiSupply(origin,fleet,'self',available)).toBe(0);
 });
 it('keeps enough idle taxis to cover waiting customers before speculative moves',()=>{
  expect(taxiCanLeaveMarket(1,0)).toBe(false);
  expect(taxiCanLeaveMarket(3,2)).toBe(false);
  expect(taxiCanLeaveMarket(1,1)).toBe(true);
  expect(taxiCanLeaveMarket(0,0)).toBe(true);
 });
 it('discourages a second taxi from moving to the same single-customer market',()=>{
  const home={localStops:60,pendingPickups:0,competingIdleTaxis:0};
  const target={localStops:60,pendingPickups:1,competingIdleTaxis:0};
  expect(taxiRepositionWorthwhile(home,target,2800)).toBe(true);
  expect(taxiRepositionWorthwhile(home,{...target,competingIdleTaxis:1},2800)).toBe(false);
 });
});
