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
 it('escapes a one-way local street via a different road class without discovering it',()=>{
  const graph=makeGraph();
  // C -> D is local discovery; D -> E is an undiscovered primary
  // transit-only exit; E -> B rejoins the purple network.
  graph.edges.set('D',[{to:'E',id:'primary-exit',meters:100,
   highway:'primary',speedKph:50}]);
  graph.edges.set('E',[{to:'B',id:'purple-return',meters:100,
   highway:'service',speedKph:30}]);
  const explored=new Set(['bc','purple-return']);
  const result=planReachableExplorerRoad(graph,'C',explored,
   new Set(['cd']),new Set(),new Set(),'residential');
  expect(result.route?.edgeIds).toEqual(['cd','primary-exit','purple-return']);
  expect(result.route?.discoveryEdgeIds).toEqual(['cd']);
  expect(result.route?.escapeTransitEdgeIds).toEqual(['primary-exit']);
  expect(result.diagnostic.reason).toBe('planned');
 });
 it('never treats a cross-class one-way escape as a legal exit without purple return',()=>{
  const graph=makeGraph();
  graph.edges.set('D',[{to:'E',id:'primary-exit',meters:100,
   highway:'primary',speedKph:50}]);
  graph.edges.set('E',[]);
  const result=planReachableExplorerRoad(graph,'C',new Set(['bc']),
   new Set(['cd']),new Set(),new Set(),'residential');
  expect(result.route).toBeNull();
  expect(result.diagnostic.reason).toBe('one-way-no-legal-exit');
 });
 it('will not use another explorer reserved road for its cross-class escape',()=>{
  const graph=makeGraph();
  graph.edges.set('D',[{to:'E',id:'primary-exit',meters:100,
   highway:'primary',speedKph:50}]);
  graph.edges.set('E',[{to:'B',id:'purple-return',meters:100,
   highway:'service',speedKph:30}]);
  const result=planReachableExplorerRoad(graph,'C',
   new Set(['bc','purple-return']),new Set(['cd']),
   new Set(['primary-exit']),new Set(),'residential');
  expect(result.route).toBeNull();
  expect(result.diagnostic.reason).toBe('one-way-no-legal-exit');
 });
 it('escapes back to purple after a one-way road followed by a two-way segment',()=>{
  const graph=makeGraph();
  graph.nodes.set('F',[0.004,0]);graph.nodeKeys.push('F');
  graph.edges.set('D',[{to:'F',id:'df',meters:110,
   highway:'residential',speedKph:30}]);
  graph.edges.set('F',[
   {to:'D',id:'df',meters:110,highway:'residential',speedKph:30},
   {to:'B',id:'fb',meters:300,highway:'primary',speedKph:50}
  ]);
  const result=planReachableExplorerRoad(graph,'C',new Set(['bc','fb']),
   new Set(['cd','df']),new Set(),new Set(),'residential');
  expect(result.route?.edgeIds).toEqual(['cd','df','fb']);
  expect(result.route?.discoveryEdgeIds).toEqual(['cd','df']);
  expect(result.diagnostic.reason).toBe('planned');
 });
 it('crosses a different undiscovered road class to discover the next eligible road',()=>{
  const graph=makeGraph();
  // A-B purple, B-C red primary, C-D red residential. The Local
  // Explorer must cross B-C without turning that primary road purple.
  const bc=graph.edges.get('B')!.find(e=>e.id==='bc')!;
  bc.highway='primary';
  graph.edges.get('C')!.find(e=>e.id==='bc')!.highway='primary';
  const result=planReachableExplorerRoad(graph,'A',new Set(['ab']),
   new Set(['cd']),new Set(),new Set(),'residential');
  expect(result.route?.edgeIds).toEqual(['ab','bc','cd']);
  expect(result.route?.discoveryEdgeIds).toEqual(['cd']);
  expect(result.route?.escapeTransitEdgeIds).toEqual(['bc']);
  expect(result.diagnostic.reason).toBe('planned');
 });
 it('follows legally directed cross-class connectors without revealing them',()=>{
  const graph=makeGraph();
  graph.edges.set('C',(graph.edges.get('C')??[]).filter(e=>e.id!=='bc'));
  // A one-way transit segment requires an onward legal exit to purple.
  graph.edges.get('D')!.push({to:'B',id:'db-purple',meters:210,
   highway:'service',speedKph:30});
  const result=planReachableExplorerRoad(graph,'A',new Set(['ab','db-purple']),
   new Set(['cd']),new Set(),new Set(),'residential');
  expect(result.route?.edgeIds).toEqual(['ab','bc','cd']);
  expect(result.route?.escapeTransitEdgeIds).toEqual(['bc']);
  expect(result.route?.discoveryEdgeIds).toEqual(['cd']);
 });
 it('does not cross an undiscovered road reserved by another explorer',()=>{
  const graph=makeGraph();
  const result=planReachableExplorerRoad(graph,'A',new Set(['ab']),
   new Set(['cd']),new Set(['bc']),new Set(),'residential');
  expect(result.route).toBeNull();
 });
 it('does not jump between roads crossing geometrically without an OSM junction',()=>{
  const graph=makeGraph();
  graph.nodes.set('Y',[0.0015,-0.0005]);
  graph.nodes.set('Z',[0.0015,0.0005]);
  graph.nodeKeys.push('Y','Z');
  graph.edges.set('Y',[{to:'Z',id:'yz',meters:111,highway:'residential',speedKph:30}]);
  graph.edges.set('Z',[{to:'Y',id:'yz',meters:111,highway:'residential',speedKph:30}]);
  const result=planReachableExplorerRoad(graph,'A',new Set(['ab']),
   new Set(['yz']),new Set(),new Set(),'residential');
  expect(result.route).toBeNull();
 });
});
