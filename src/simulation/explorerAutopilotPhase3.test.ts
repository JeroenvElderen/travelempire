import {describe,expect,it} from 'vitest';
import {
 canRetryStalledExplorer,evaluateExplorerRoute,
 explorerFerryEligible,explorerMovementEligible,watchExplorerProgress,
 type ExplorerExhaustionProof,
} from './explorerRecoveryController';
import type {Point,RoadGraph,Taxi} from './taxi';

const A:Point=[23,38],B:Point=[23.001,38],C:Point=[23.002,38];
const graph=()=>{
 const nodes=new Map<string,Point>([['A',A],['B',B],['C',C]]);
 const edges:RoadGraph['edges']=new Map([
  ['A',[{id:'purple',to:'B',meters:111,speedKph:40,highway:'residential'}]],
  ['B',[{id:'red',to:'C',meters:111,speedKph:40,highway:'residential'}]],
  ['C',[]],
 ]);
 return {nodes,edges,nodeKeys:[...nodes.keys()]};
};
const endpoints=()=>new Map<string,[string,string]>([
 ['purple',['A','B']],['red',['B','C']],
]);
const explorer=():Taxi=>({
 id:'explorer',name:'Local',driver:'AI',kind:'explorer',
 explorerRole:'residential',status:'EXPLORING',position:A,
 path:[A,B,C],edgeIds:['purple','red'],
 discoveryEdgeIds:['red'],escapeTransitEdgeIds:[],
 scoutingRuns:3,leg:0,distanceIntoLeg:0,fare:0,completed:0,
});

describe('Explorer Autopilot Phase 3 — saved route continuity and road streaming',()=>{
 it('preserves a valid saved mission after Safari reload',()=>{
  expect(evaluateExplorerRoute(graph(),explorer(),new Set(['purple','red']),
   endpoints(),new Set(['purple']))).toEqual({
    state:'valid',reason:'connected-directed-route',
   });
 });
 it('waits for the IndexedDB discovery snapshot before judging a restored route',()=>{
  const current=evaluateExplorerRoute(graph(),explorer(),
   new Set(['purple','red']),endpoints(),new Set());
  expect(current).toEqual({state:'waiting-for-tiles',
   reason:'discovery-state-loading',edgeId:'purple'});
  // The identical saved route becomes valid once IndexedDB restores purple.
  expect(evaluateExplorerRoute(graph(),explorer(),
   new Set(['purple','red']),endpoints(),new Set(['purple'])).state).toBe('valid');
 });
 it('waits for absent tiles without clearing the saved mission',()=>{
  const route=evaluateExplorerRoute(graph(),explorer(),new Set(['purple']),
   endpoints(),new Set(['purple']));
  expect(route).toEqual({state:'waiting-for-tiles',
   reason:'saved-route-tiles-loading',edgeId:'red'});
  const complete=evaluateExplorerRoute(graph(),explorer(),new Set(['purple','red']),
   endpoints(),new Set(['purple']));
  expect(complete.state).toBe('valid');
 });
 it('rejects previously saved routes containing an unassigned undiscovered red shortcut',()=>{
  const t={...explorer(),discoveryEdgeIds:[]};
  const result=evaluateExplorerRoute(graph(),t,new Set(['purple','red']),
   endpoints(),new Set(['purple']));
  expect(result).toEqual({state:'invalid',reason:'invalid-road-permission',edgeId:'red'});
 });
 it('rejects a reversed one-way route rather than pretending the nodes connect',()=>{
  const t={...explorer(),position:C,path:[C,B],edgeIds:['red'],leg:0};
  const result=evaluateExplorerRoute(graph(),t,new Set(['purple','red']),
   endpoints(),new Set(['purple']));
  expect(result).toEqual({
   state:'invalid',reason:'one-way-or-layer-disconnected',edgeId:'red',
  });
 });
 it('refuses bridges that visually touch tunnels at a different OSM node',()=>{
  const g=graph();
  g.nodes.set('upperB',B);
  g.edges.set('upperB',[{id:'bridge',to:'C',meters:111,
   highway:'residential',speedKph:40,bridge:true,layer:1}]);
  const t={...explorer(),edgeIds:['purple','bridge'],
   discoveryEdgeIds:['bridge']};
  const ids=endpoints();ids.set('bridge',['upperB','C']);
  const result=evaluateExplorerRoute(g,t,new Set(['purple','bridge']),
   ids,new Set(['purple']));
  expect(result).toEqual({state:'invalid',
   reason:'one-way-or-layer-disconnected',edgeId:'bridge'});
 });
 it('accepts a verified mid-segment start only when the segment points downstream',()=>{
  const midpoint:Point=[23.0005,38];
  const t={...explorer(),position:midpoint,
   path:[midpoint,B,C]};
  expect(evaluateExplorerRoute(graph(),t,new Set(['purple','red']),
   endpoints(),new Set(['purple'])).state).toBe('valid');
  const backwards={...t,path:[midpoint,A,C]};
  expect(evaluateExplorerRoute(graph(),backwards,new Set(['purple','red']),
   endpoints(),new Set(['purple'])).state).toBe('invalid');
 });
});

describe('Explorer Autopilot Phase 3 — progress monitoring and safe retries',()=>{
 it('separates a genuinely stalled mission from an advancing route',()=>{
  const t=explorer();
  const start=watchExplorerProgress(undefined,t,1000);
  expect(start.stalledMs).toBe(0);
  const stalled=watchExplorerProgress(start.watch,t,92000);
  expect(stalled.stalledMs).toBe(91000);
  const moved=watchExplorerProgress(stalled.watch,{...t,leg:1,position:B},93000);
  expect(moved.stalledMs).toBe(0);
  expect(watchExplorerProgress(moved.watch,{...t,leg:1,position:B},95000).stalledMs).toBe(2000);
 });
 it('excludes ferry crossings, scheduled breaks, recovery, refuelling, and insufficient fuel',()=>{
  const t=explorer();
  expect(explorerMovementEligible(t,1000,55)).toBe(true);
  expect(explorerMovementEligible({...t,ferryTrip:{stage:'waiting',routeId:'x',
   fromPortId:'a',toPortId:'b',geometry:[],destination:B,durationGameMs:1,ticketEuros:1}},1000,55)).toBe(false);
  expect(explorerMovementEligible({...t,deliveryUntil:2000},1000,55)).toBe(false);
  expect(explorerMovementEligible({...t,recoveryPending:true},1000,55)).toBe(false);
  expect(explorerMovementEligible({...t,refillRequested:true},1000,55)).toBe(false);
  expect(explorerMovementEligible({...t,restStopId:'parking:x'},1000,55)).toBe(false);
  expect(explorerMovementEligible(t,1000,5)).toBe(false);
  expect(explorerMovementEligible({...t,status:'RETURNING'},1000,55)).toBe(false);
 });
 it('limits recovery retries and resets the budget only after five minutes',()=>{
  const first=canRetryStalledExplorer(undefined,100000);
  expect(first.allowed).toBe(true);
  const tooSoon=canRetryStalledExplorer(first.next,120000);
  expect(tooSoon.allowed).toBe(false);
  const second=canRetryStalledExplorer(first.next,170000);
  expect(second.allowed).toBe(true);
  expect(canRetryStalledExplorer(second.next,240000).allowed).toBe(false);
  expect(canRetryStalledExplorer(second.next,401000).allowed).toBe(true);
 });
});

describe('Explorer Autopilot Phase 3 — ferry readiness',()=>{
 const proof:ExplorerExhaustionProof={origin:'A',role:'residential',
  at:20000,roadCount:22,discoveredCount:10};
 const ready=(t:Taxi=explorer(),p=proof,at=30000)=>
  explorerFerryEligible({...t,status:'IDLE'},p,at,60,'A',22,10);
 it('accepts only recent conclusive proof for a non-operational idle explorer',()=>{
  expect(ready()).toBe(true);
  expect(explorerFerryEligible({...explorer(),status:'IDLE'},undefined,
   30000,60,'A',22,10)).toBe(false);
  expect(explorerFerryEligible(explorer(),proof,30000,60,'A',22,10)).toBe(false);
  expect(ready(explorer(),proof,150000)).toBe(false);
 });
 it('invalidates exhaustion on new road data or newly discovered roads',()=>{
  const t={...explorer(),status:'IDLE' as const};
  expect(explorerFerryEligible(t,proof,30000,60,'B',22,10)).toBe(false);
  expect(explorerFerryEligible(t,proof,30000,60,'A',23,10)).toBe(false);
  expect(explorerFerryEligible(t,proof,30000,60,'A',22,11)).toBe(false);
 });
 it('never books during a rest, refuelling, actual ferry trip or recovery',()=>{
  expect(ready({...explorer(),recoveryPending:true})).toBe(false);
  expect(ready({...explorer(),refillRequested:true})).toBe(false);
  expect(ready({...explorer(),deliveryUntil:50000})).toBe(false);
  expect(ready(explorer(),proof,30000)).toBe(true);
  expect(explorerFerryEligible({...explorer(),status:'PAUSED',shiftParked:true},
   proof,30000,60,'A',22,10)).toBe(true);
 });
});
