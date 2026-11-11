import {describe,it,expect} from 'vitest';
import {roundaboutBridges,hasInvalidRedApproach} from './roundaboutTransit';
import {planReachableExplorerRoad} from './explorerRoadPlanner';
import type {Point,RoadGraph} from './taxi';

function testNetwork(closeRing=true):RoadGraph{
 // A short clockwise, one-way loop, entered and exited from purple roads.
 const nodes=new Map<string,Point>([
  ['P',[-.0004,0]],['A',[0,0]],['B',[.0003,0]],
  ['C',[.0003,.0003]],['D',[0,.0003]],['Q',[.0007,.0003]],
  ['TARGET',[.0003,.0007]]
 ]);
 const edges:RoadGraph['edges']=new Map();
 const edge=(a:string,b:string,id:string,highway:string,meters:number)=>{
  edges.set(a,[...(edges.get(a)??[]),{to:b,id,highway,meters,speedKph:30}]);
 };
 edge('P','A','purple-in','residential',45);
 edge('A','P','purple-in','residential',45);
 edge('C','Q','purple-out','residential',45);
 edge('Q','C','purple-out','residential',45);
 edge('A','B','ring-ab','service',33);
 edge('B','C','ring-bc','service',33);
 edge('C','D','ring-cd','service',33);
 if(closeRing)edge('D','A','ring-da','service',33);
 edge('C','TARGET','secondary-target','secondary',44);
 edge('TARGET','C','secondary-target','secondary',44);
 return {nodes,nodeKeys:[...nodes.keys()],edges};
}
const purple=new Set(['purple-in','purple-out']);
const discovered=new Set(['secondary-target']);
describe('strict roundabout and one-way return exceptions',()=>{
 it('identifies the directed roundabout arc to the second purple entrance',()=>{
  const bridges=roundaboutBridges(testNetwork(),'A',purple);
  expect(bridges).toContainEqual({
   to:'C',nodes:['A','B','C'],ids:['ring-ab','ring-bc'],meters:66
  });
 });
 it('permits the short closed ring but never marks the wrong class purple',()=>{
  const result=planReachableExplorerRoad(testNetwork(),'P',purple,
   discovered,new Set(),new Set(),'secondary');
  expect(result.route?.edgeIds).toEqual([
   'purple-in','ring-ab','ring-bc','secondary-target'
  ]);
  expect(result.route?.discoveryEdgeIds).toEqual(['secondary-target']);
  expect(result.route?.escapeTransitEdgeIds).toEqual(['ring-ab','ring-bc']);
  expect(hasInvalidRedApproach(testNetwork(),result.route!.path,
   result.route!.edgeIds,purple,new Set(result.route!.discoveryEdgeIds))).toBe(false);
 });
 it('does not accept a similar red path when the directed loop is broken',()=>{
  const graph=testNetwork(false);
  expect(roundaboutBridges(graph,'A',purple)).toEqual([]);
  expect(planReachableExplorerRoad(graph,'P',purple,discovered,
   new Set(),new Set(),'secondary').route).toBeNull();
  expect(hasInvalidRedApproach(graph,
   [graph.nodes.get('P')!,graph.nodes.get('A')!,graph.nodes.get('B')!,
    graph.nodes.get('C')!,graph.nodes.get('TARGET')!],
   ['purple-in','ring-ab','ring-bc','secondary-target'],
   purple,discovered)).toBe(true);
 });
 it('rejects unrelated red shortcuts and routes without discovery',()=>{
  const graph=testNetwork();
  expect(hasInvalidRedApproach(graph,
   [graph.nodes.get('P')!,graph.nodes.get('A')!,graph.nodes.get('TARGET')!],
   ['purple-in','red-direct'],purple,discovered)).toBe(true);
  expect(hasInvalidRedApproach(graph,
   [graph.nodes.get('P')!,graph.nodes.get('A')!],
   ['purple-in'],purple,new Set())).toBe(true);
 });
 it('allows a directed purple return after discovery without requiring a roundabout',()=>{
  const graph=testNetwork(false);
  const routeIds=['purple-in','secondary-target','red-exit','purple-out'];
  // The special route rule applies only before first discovery; the
  // one-way escape planner separately verifies directed edges back to purple.
  expect(hasInvalidRedApproach(graph,
   [graph.nodes.get('P')!,graph.nodes.get('A')!,graph.nodes.get('C')!,
    graph.nodes.get('Q')!,graph.nodes.get('P')!],
   routeIds,purple,new Set(['secondary-target']))).toBe(false);
 });
});
