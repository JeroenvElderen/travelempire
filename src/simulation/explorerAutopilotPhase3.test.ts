import {describe,expect,it} from 'vitest';
import {
 canRetryStalledExplorer,evaluateExplorerRoute,safeExplorerRoutePrefix,
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
  expect(result).toEqual({state:'invalid',reason:'invalid-road-permission',edgeId:'red',leg:1});
 });
 it('rejects a reversed one-way route rather than pretending the nodes connect',()=>{
  const t={...explorer(),position:C,path:[C,B],edgeIds:['red'],leg:0};
  const result=evaluateExplorerRoute(graph(),t,new Set(['purple','red']),
   endpoints(),new Set(['purple']));
  expect(result).toEqual({
   state:'invalid',reason:'one-way-or-layer-disconnected',edgeId:'red',leg:0,
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
   reason:'one-way-or-layer-disconnected',edgeId:'bridge',leg:1});
 });

 it('preserves a safe driven prefix when a future route segment violates one-way direction',()=>{
  const g=graph(),t=explorer();
  // The first purple segment is valid, but the future red segment turns
  // against a one-way edge; never abort the purple approach mid-drive.
  g.edges.set('B',[]);
  const health=evaluateExplorerRoute(g,t,new Set(['purple','red']),
   endpoints(),new Set(['purple']));
  expect(health).toEqual({
   state:'invalid',reason:'one-way-or-layer-disconnected',edgeId:'red',leg:1,
  });
  // A legal purple departure from B permits the scout to stop there.
  g.edges.set('B',[{id:'purple',to:'A',meters:111,speedKph:40,highway:'residential'}]);
  const safe=safeExplorerRoutePrefix(g,t,health,endpoints(),new Set(['purple']));
  expect(safe).toEqual({path:[A,B],edgeIds:['purple'],
   discoveryEdgeIds:[],escapeTransitEdgeIds:[]});
 });
 it('never trims an unsafe future route onto an isolated one-way red endpoint',()=>{
  const g=graph(),t=explorer();
  const health={state:'invalid' as const,
   reason:'one-way-or-layer-disconnected' as const,edgeId:'red',leg:1};
  // B cannot depart on any discovered road: stopping there would strand it.
  expect(safeExplorerRoutePrefix(g,t,health,endpoints(),new Set(['purple']))).toBeNull();
 });
 it('does not overwrite the current segment when the current edge is illegal',()=>{
  const g=graph(),t=explorer();
  const health={state:'invalid' as const,
   reason:'one-way-or-layer-disconnected' as const,edgeId:'purple',leg:0};
  expect(safeExplorerRoutePrefix(g,t,health,endpoints(),new Set(['purple']))).toBeNull();
 });
 it('holds planned road travel when a required tile has not loaded yet',()=>{
  const g=graph(),t=explorer();
  const health=evaluateExplorerRoute(g,t,new Set(['purple']),endpoints(),
   new Set(['purple']));
  expect(health.state).toBe('waiting-for-tiles');
  expect(safeExplorerRoutePrefix(g,t,health,endpoints(),new Set(['purple']))).toBeNull();
 });
 it('does not falsely reject reverse driving on a two-way OSM micro-segment',()=>{
  // 1.7 metre roads are shorter than the normal 3 m endpoint coordinate
  // tolerance. Both directions may match geometry, but the next segment
  // resolves the ONLY legal node continuation (B -> A -> C).
  const microA:Point=[23,38],microB:Point=[23.000019,38];
  const microC:Point=[23,38.00015];
  const g:RoadGraph={nodes:new Map([['A',microA],['B',microB],['C',microC]]),
   nodeKeys:['A','B','C'],edges:new Map([
    ['A',[{id:'tiny',to:'B',meters:1.7,speedKph:20,highway:'residential'},
      {id:'red',to:'C',meters:16.7,speedKph:20,highway:'residential'}]],
    ['B',[{id:'tiny',to:'A',meters:1.7,speedKph:20,highway:'residential'}]],
    ['C',[]],
   ])};
  const actual={...explorer(),position:microB,
   path:[microB,microA,microC],edgeIds:['tiny','red'],
   discoveryEdgeIds:['red'],leg:0,distanceIntoLeg:0};
  const checked=evaluateExplorerRoute(g,actual,new Set(['tiny','red']),
   new Map([['tiny',['A','B']],['red',['A','C']]]),new Set(['tiny']));
  expect(checked).toEqual({state:'valid',reason:'connected-directed-route'});
 });
 it('still rejects a micro-road joining an unrelated overlapping bridge node',()=>{
  const microA:Point=[23,38],microB:Point=[23.000019,38];
  const microC:Point=[23,38.00015];
  const g:RoadGraph={nodes:new Map([
   ['A',microA],['B',microB],['upperA',microA],['C',microC]]),
   nodeKeys:['A','B','upperA','C'],edges:new Map([
    ['A',[{id:'tiny',to:'B',meters:1.7,speedKph:20,highway:'residential'}]],
    ['B',[{id:'tiny',to:'A',meters:1.7,speedKph:20,highway:'residential'}]],
    ['upperA',[{id:'bridge',to:'C',meters:16.7,speedKph:20,
      highway:'residential',layer:1,bridge:true}]],
    ['C',[]],
   ])};
  const disconnected={...explorer(),position:microB,
   path:[microB,microA,microC],edgeIds:['tiny','bridge'],
   discoveryEdgeIds:['bridge'],leg:0,distanceIntoLeg:0};
  const checked=evaluateExplorerRoute(g,disconnected,new Set(['tiny','bridge']),
   new Map([['tiny',['A','B']],['bridge',['upperA','C']]]),new Set(['tiny']));
  expect(checked).toEqual({state:'invalid',
   reason:'one-way-or-layer-disconnected',edgeId:'bridge',leg:1});
 });
 it('rejects reverse travel on a genuinely one-way micro-segment',()=>{
  const microA:Point=[23,38],microB:Point=[23.000019,38];
  const g:RoadGraph={nodes:new Map([['A',microA],['B',microB]]),
   nodeKeys:['A','B'],edges:new Map([
    ['A',[{id:'tiny',to:'B',meters:1.7,speedKph:20,highway:'residential'}]],
    ['B',[]],
   ])};
  // Even though the endpoints are closer than the coordinate tolerance,
  // physical travel B -> A is opposite to the only directed OSM edge A -> B.
  const reverse={...explorer(),position:microB,path:[microB,microA],
   edgeIds:['tiny'],discoveryEdgeIds:[],leg:0,distanceIntoLeg:0};
  expect(evaluateExplorerRoute(g,reverse,new Set(['tiny']),
   new Map([['tiny',['A','B']]]),new Set(['tiny']))).toEqual({
    state:'invalid',reason:'one-way-or-layer-disconnected',edgeId:'tiny',leg:0,
   });
  // A subsequent return to node A cannot be forged by an incompatible edge.
  const continued={...reverse,path:[microB,microA,microB],
   edgeIds:['tiny','tiny']};
  expect(evaluateExplorerRoute(g,continued,new Set(['tiny']),
   new Map([['tiny',['A','B']]]),new Set(['tiny'])).state).toBe('invalid');
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
  let sample=start;
  for(const now of [21000,41000,61000,81000])sample=watchExplorerProgress(sample.watch,t,now);
  const stalled=watchExplorerProgress(sample.watch,t,92000);
  expect(stalled.stalledMs).toBe(91000);
  const moved=watchExplorerProgress(stalled.watch,{...t,leg:1,position:B},93000);
  expect(moved.stalledMs).toBe(0);
  expect(watchExplorerProgress(moved.watch,{...t,leg:1,position:B},95000).stalledMs).toBe(2000);
 });
 it('accumulates small movements instead of falsely reporting a stalled scout',()=>{
  const t=explorer();
  let sample=watchExplorerProgress(undefined,t,1000);
  for(let i=1;i<=10;i++){
   sample=watchExplorerProgress(sample.watch,{...t,distanceIntoLeg:i*.5},1000+i*1000);
   expect(sample.stalledMs).toBeLessThan(4000);
  }
 });
 it('does not count successor planning as physical movement and resets after missing observations',()=>{
  const t=explorer();
  const start=watchExplorerProgress(undefined,t,1000);
  const appended=watchExplorerProgress(start.watch,{...t,scoutingRuns:4,edgeIds:[...t.edgeIds,'next']},21000);
  expect(appended.stalledMs).toBe(20000);
  expect(watchExplorerProgress(appended.watch,t,100000).stalledMs).toBe(0);
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
