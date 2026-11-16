import {describe,it,expect} from 'vitest';
import {explorerEfficiency,explorerRoleName,explorerSituation,
 mergeExplorerRecoveryHistory,reasonForExplorer,type ExplorerRecoveryEvent,
 type ExplorerLiveVehicle} from './explorerOperations';
import type {Taxi} from './taxi';

const explorer=():Taxi=>({
 id:'x1',kind:'explorer',name:'Local Explorer',driver:'AI',
 explorerRole:'residential',position:[23,38],status:'EXPLORING',
 path:[[23,38],[23.001,38]],edgeIds:['purple'],leg:0,distanceIntoLeg:0,
 completed:0,fare:0,uniqueDiscoveredKm:6,discoveredKm:12,
 discoveryEdgeIds:[],scoutingRuns:3,
});
const live=():ExplorerLiveVehicle=>({
 id:'x1',role:'residential',status:'EXPLORING',missionId:9,
 remainingEdges:12,idleMs:0,retryInMs:0,lastPlannedAt:3000,
 planningAttempts:14,planningSkipReason:null,
});
const event=(id:string,at:number):ExplorerRecoveryEvent=>({
 id,vehicleId:'x1',kind:'stalled-replan',
 description:'Stalled explorer restarted from a connected road junction',at,
});

describe('Explorer Autopilot phase 4 — meaningful fleet efficiency',()=>{
 it('calculates percent only when driven distance exists',()=>{
  expect(explorerEfficiency(4,8)).toBe(50);
  expect(explorerEfficiency(2.5,10)).toBe(25);
  expect(explorerEfficiency(1,0)).toBeNull();
  expect(explorerEfficiency(0,0)).toBeNull();
  expect(explorerEfficiency(15,10)).toBe(100);
  expect(explorerEfficiency(-1,10)).toBe(0);
 });
 it('shows the actual specialist road class, including service and legacy names',()=>{
  expect(explorerRoleName('poi')).toBe('Service & harbour');
  expect(explorerRoleName('residential')).toBe('Local streets');
  expect(explorerRoleName('highway')).toBe('Highway');
  expect(explorerRoleName('motorway')).toBe('Highway');
 });
});
describe('Explorer Autopilot phase 4 — actual status precedence',()=>{
 it('distinguishes normal exploration from a pending successor',()=>{
  expect(explorerSituation(explorer(),live())).toEqual({
   label:'Exploring',detail:'Driving a connected discovery mission',tone:'moving',
  });
  expect(explorerSituation(explorer(),{...live(),planningSkipReason:'pool-successor'}).detail)
   .toBe('Searching for the next connected route');
 });
 it('marks saved route tile loading without reporting a stuck vehicle',()=>{
  expect(explorerSituation(explorer(),{...live(),savedRouteHealth:'waiting-for-tiles'}))
   .toEqual({label:'Loading roads',
    detail:'Keeping the saved mission while road data loads',tone:'waiting'});
 });
 it('does not mislabel ferry transfers or scheduled rest as explorer stalls',()=>{
  const t=explorer();
  const onFerry:Taxi={...t,ferryTrip:{stage:'sailing',routeId:'r',
   fromPortId:'a',toPortId:'b',geometry:[],destination:[23,38.5],
   durationGameMs:10000,ticketEuros:5}};
  expect(explorerSituation(onFerry,{...live(),recoveryReason:'stalled-replanning-from-purple-junction'}).label)
   .toBe('Sailing');
  expect(explorerSituation({...t,status:'PAUSED',restStopId:'hotel-1'},live()).label)
   .toBe('Resting');
 });
 it('only describes ferry readiness when exhaustion is verified',()=>{
  const idle={...explorer(),status:'IDLE' as const};
  expect(explorerSituation(idle,{...live(),exhaustionProven:true}).label)
   .toBe('Area explored');
  expect(explorerSituation(idle,{...live(),exhaustionProven:false}).label)
   .toBe('Searching');
 });
 it('shows current idle planner status rather than a stale Checking Route error',()=>{
  const idle={...explorer(),status:'IDLE' as const};
  const oldRecovery={...live(),status:'IDLE',
   recoveryReason:'invalid-saved-route:one-way-or-layer-disconnected',
   planningSkipReason:'no-purple-segment-near-vehicle',savedRouteHealth:null};
  const result=explorerSituation(idle,oldRecovery);
  expect(result.label).toBe('Searching');
  expect(result.detail).toContain('No discovered start road');
  expect(explorerSituation(idle,{...oldRecovery,planningSkipReason:'legacy-candidate-rejected:one-way-or-layer-disconnected'}).detail)
   .toContain('Rejected an unsafe candidate');
 });
 it('does not show stale Checking Route after a newly assigned healthy mission',()=>{
  const actual=explorerSituation(explorer(),{...live(),
   recoveryReason:'invalid-saved-route:one-way-or-layer-disconnected',
   savedRouteHealth:null,planningSkipReason:'single-worker:planned'});
  expect(actual.label).toBe('Exploring');
  const returning=explorerSituation({...explorer(),status:'RETURNING'},
   {...live(),recoveryReason:'invalid-saved-route:one-way-or-layer-disconnected',
    savedRouteHealth:null,planningSkipReason:'directed-component-recovery'});
  expect(returning.label).toBe('Returning');
  expect(reasonForExplorer('autopilot-planner-queued')).toContain('shared road planner');
 });
 it('translates internal failure codes without exposing raw epoch or node IDs',()=>{
  expect(reasonForExplorer('preferred-class-search-incomplete:search-node-budget'))
   .toContain('preferred class');
  expect(reasonForExplorer('stalled-awaiting-legal-purple-junction'))
   .toContain('legal purple');
  expect(reasonForExplorer('stranded-no-legal-directed-route'))
   .toContain('No legal return');
  expect(reasonForExplorer('unknown:internal-index')).not.toContain('internal-index');
 });
});
describe('Explorer Autopilot phase 4 — bounded, persistent recovery history',()=>{
 it('deduplicates repeated worker messages and sorts newest first',()=>{
  const merged=mergeExplorerRecoveryHistory([event('a',1000),event('b',2000)],
   [event('b',2000),event('c',3000)]);
  expect(merged.map(e=>e.id)).toEqual(['c','b','a']);
 });
 it('caps history and rejects malformed records read from localStorage',()=>{
  const malformed={...event('bad',20),at:NaN};
  const all=[...Array.from({length:100},(_,i)=>event(String(i),i+1)),malformed,event('future',9e15)];
  const merged=mergeExplorerRecoveryHistory([],all,40);
  expect(merged).toHaveLength(40);
  expect(merged[0].id).toBe('99');
  expect(merged.find(e=>e.id==='bad')).toBeUndefined();
 });
 it('keeps bookings and recovery events distinct for each explorer',()=>{
  const booking:ExplorerRecoveryEvent={
   id:'ticket-1',vehicleId:'x2',kind:'ferry-booked',
   description:'Passenger ferry ticket booked',at:5000,
  };
  const merged=mergeExplorerRecoveryHistory([event('recovery-1',4000)],[booking]);
  expect(merged.map(e=>e.vehicleId)).toEqual(['x2','x1']);
  expect(mergeExplorerRecoveryHistory(merged,[],0)).toEqual([]);
 });
});
