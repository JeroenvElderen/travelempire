import {describe,it,expect} from 'vitest';
import {planReachableExplorerRoad} from './explorerRoadPlanner';
import type {Point,RoadGraph} from './taxi';

const makeGraph=():RoadGraph=>{
 const nodes=new Map<string,Point>([
  ['A',[0,0]],['B',[0.001,0]],['C',[0.002,0]],
  ['D',[0.003,0]],['E',[0.002,0.001]],['X',[0.005,0]]]);
 const edges:RoadGraph['edges']=new Map();
 const add=(a:string,b:string,id:string,meters=110)=>{
  const list=edges.get(a)??[];
  list.push({to:b,id,meters,highway:'residential',speedKph:30});
  edges.set(a,list);
 };
 const both=(a:string,b:string,id:string)=>{add(a,b,id);add(b,a,id);};
 both('A','B','ab');both('B','C','bc');
 both('C','D','cd');both('C','E','ce');
 add('X','D','xd');
 return {nodes,edges,nodeKeys:[...nodes.keys()]};
};
describe('purple-connected explorer routes',()=>{
 it('reaches a class road only through previously discovered purple roads',()=>{
  const graph=makeGraph();
  const result=planReachableExplorerRoad(graph,'A',new Set(['ab','bc']),
   new Set(['cd']),new Set(),new Set(),'residential');
  expect(result.route?.edgeIds).toEqual(['ab','bc','cd']);
  expect(result.route?.discoveryEdgeIds).toEqual(['cd']);
  expect(result.diagnostic.reason).toBe('planned');
 });
 it('does not teleport onto a disconnected road even if it is nearby',()=>{
  const graph=makeGraph();
  const result=planReachableExplorerRoad(graph,'A',new Set(['ab']),
   new Set(['xd']),new Set(),new Set(),'highway');
  expect(result.route).toBeNull();
  expect(result.diagnostic.reason).toBe('no-connected-class-road');
 });
 it('uses another eligible road if the first is reserved',()=>{
  const graph=makeGraph();
  const result=planReachableExplorerRoad(graph,'A',new Set(['ab','bc']),
   new Set(['cd','ce']),new Set(['cd']),new Set(),'residential');
  expect(result.route?.discoveryEdgeIds).toEqual(['ce']);
 });
 it('respects direction for discovered transit',()=>{
  const graph=makeGraph();
  graph.edges.set('B',graph.edges.get('B')!.filter(e=>e.to!=='A'));
  const result=planReachableExplorerRoad(graph,'B',new Set(['ab']),
   new Set(['xd']),new Set(),new Set(),'residential');
  expect(result.route).toBeNull();
 });
 it('explores a two-way dead end because reversing is legal',()=>{
  const graph=makeGraph();
  const route=planReachableExplorerRoad(graph,'C',new Set(['bc']),
   new Set(['cd']),new Set(),new Set(),'residential');
  expect(route.route?.discoveryEdgeIds).toEqual(['cd']);
  expect(route.diagnostic.unsafeOneWaySkipped).toBe(0);
 });
 it('skips a one-way street that has no legal exit and tries another road',()=>{
  const graph=makeGraph();
  // C -> D is a one-way cul-de-sac: its endpoint has no exit at all.
  graph.edges.set('D',[]);
  const route=planReachableExplorerRoad(graph,'C',new Set(['bc']),
   new Set(['cd','ce']),new Set(),new Set(),'residential');
  expect(route.route?.discoveryEdgeIds).toEqual(['ce']);
  expect(route.diagnostic.unsafeOneWaySkipped).toBeGreaterThan(0);
 });
 it('reports no legal exit if every candidate ends at a one-way dead end',()=>{
  const graph=makeGraph();
  graph.edges.set('D',[]);
  const route=planReachableExplorerRoad(graph,'C',new Set(['bc']),
   new Set(['cd']),new Set(),new Set(),'residential');
  expect(route.route).toBeNull();
  expect(route.diagnostic.reason).toBe('one-way-no-legal-exit');
 });
 it('permits a one-way road with a directed exit returning to purple',()=>{
  const graph=makeGraph();
  // C->D one way, D->E eligible one way, E->B already purple.
  graph.edges.set('D',[{to:'E',id:'de',meters:100,
   highway:'residential',speedKph:30}]);
  graph.edges.set('E',[{to:'B',id:'eb',meters:100,
   highway:'residential',speedKph:30}]);
  const route=planReachableExplorerRoad(graph,'C',new Set(['bc','eb']),
   new Set(['cd','de']),new Set(),new Set(),'residential');
  expect(route.route?.edgeIds).toEqual(['cd','de','eb']);
  expect(route.route?.discoveryEdgeIds).toEqual(['cd','de']);
  expect(route.diagnostic.reason).toBe('planned');
 });
 it('respects one-way direction when evaluating an apparent exit',()=>{
  const graph=makeGraph();
  // E->D enters the dead-end, not D->E: it is not a valid escape.
  graph.edges.set('D',[]);
  graph.edges.set('E',[{to:'D',id:'ed',meters:100,
   highway:'residential',speedKph:30}]);
  const route=planReachableExplorerRoad(graph,'C',new Set(['bc']),
   new Set(['cd','ed']),new Set(),new Set(),'residential');
  expect(route.route).toBeNull();
  expect(route.diagnostic.reason).toBe('one-way-no-legal-exit');
 });
});
