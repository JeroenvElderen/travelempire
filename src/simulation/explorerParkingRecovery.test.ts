import {describe,expect,it} from 'vitest';
import {explorerWaitingForRoads,explorerOnActualRest} from './explorerParking';
import {evaluateExplorerRoute} from './explorerRecoveryController';
import type {Point,RoadGraph,Taxi} from './taxi';

const roadWait=():Taxi=>({
 id:'old-local',name:'Local Explorer',driver:'AI',kind:'explorer',
 explorerRole:'residential',status:'PAUSED',shiftParked:true,
 position:[23,38],path:[],edgeIds:[],leg:0,distanceIntoLeg:0,
 completed:0,fare:0,
});

describe('Explorer road-wait recovery from saved Safari fleet',()=>{
 it('reactivates an old automatic road-wait rather than inventing a driver break',()=>{
  const parked=roadWait();
  expect(explorerWaitingForRoads(parked)).toBe(true);
  expect(explorerOnActualRest(parked)).toBe(false);
 });
 it('clears even a synthetic 30-minute timer when there is no real rest stop',()=>{
  const stale={...roadWait(),restUntilGameMs:1_794_820_000_000};
  expect(explorerWaitingForRoads(stale)).toBe(true);
  expect(explorerOnActualRest(stale)).toBe(false);
 });
 it('never wakes actual scheduled, overnight, manual or facility-based rest',()=>{
  for(const t of [
   {...roadWait(),scheduledShiftParked:true},
   {...roadWait(),restStopId:'hotel:verified'},
   {...roadWait(),restStopId:'parking:verified',restUntilGameMs:1_794_820_000_000},
   {...roadWait(),pauseAtHome:true},
   {...roadWait(),ferryTrip:{stage:'sailing' as const,routeId:'ferry',
    fromPortId:'a',toPortId:'b',geometry:[],destination:[24,38] as Point,
    durationGameMs:10000,ticketEuros:20}},
   {...roadWait(),recoveryPending:true},
  ]){
   expect(explorerWaitingForRoads(t)).toBe(false);
   expect(explorerOnActualRest(t)).toBe(true);
  }
 });
 it('does not mistake moving, refuelling or non-explorer vehicles for road waits',()=>{
  expect(explorerWaitingForRoads({...roadWait(),status:'EXPLORING'})).toBe(false);
  expect(explorerWaitingForRoads({...roadWait(),refillRequested:true})).toBe(false);
  expect(explorerWaitingForRoads({...roadWait(),kind:'taxi'})).toBe(false);
  expect(explorerWaitingForRoads({...roadWait(),shiftParked:false})).toBe(false);
 });
});

describe('Joined successor route validation',()=>{
 const A:Point=[23,38],B:Point=[23.001,38],
  UpperB:Point=[23.001,38],C:Point=[23.002,38];
 const make=()=>{
  const graph:RoadGraph={
   nodes:new Map([['A',A],['B',B],['upperB',UpperB],['C',C]]),
   nodeKeys:['A','B','upperB','C'],
   edges:new Map([
    ['A',[{id:'purple',to:'B',meters:100,speedKph:40,highway:'residential'}]],
    ['B',[]],
    ['upperB',[{id:'red',to:'C',meters:100,speedKph:40,highway:'secondary',bridge:true,layer:1}]],
    ['C',[]],
   ]),
  };
  const endpoints=new Map<string,[string,string]>([
   ['purple',['A','B']],['red',['upperB','C']],
  ]);
  const current:Taxi={
   id:'scout',kind:'explorer',name:'Explorer',driver:'AI',
   explorerRole:'secondary',status:'EXPLORING',
   position:A,path:[A,B],edgeIds:['purple'],discoveryEdgeIds:[],
   leg:0,distanceIntoLeg:0,completed:0,fare:0,
  };
  return {graph,endpoints,current};
 };
 it('rejects an individually legal successor on a visually adjacent but disconnected bridge',()=>{
  const {graph,endpoints,current}=make();
  const known=new Set(['purple','red']),discovered=new Set(['purple']);
  const future={...current,path:[UpperB,C],edgeIds:['red'],discoveryEdgeIds:['red']};
  expect(evaluateExplorerRoute(graph,future,known,endpoints,discovered).state).toBe('valid');
  const merged={...current,path:[A,B,C],edgeIds:['purple','red'],discoveryEdgeIds:['red']};
  expect(evaluateExplorerRoute(graph,merged,known,endpoints,discovered)).toEqual({
   state:'invalid',reason:'one-way-or-layer-disconnected',edgeId:'red',leg:1,
  });
 });
 it('accepts a joined successor with the same actual OSM junction ID',()=>{
  const {graph,endpoints,current}=make();
  graph.edges.set('B',[{id:'red',to:'C',meters:100,speedKph:40,highway:'secondary'}]);
  endpoints.set('red',['B','C']);
  const merged={...current,path:[A,B,C],edgeIds:['purple','red'],discoveryEdgeIds:['red']};
  expect(evaluateExplorerRoute(graph,merged,new Set(['purple','red']),
   endpoints,new Set(['purple'])).state).toBe('valid');
 });
});
