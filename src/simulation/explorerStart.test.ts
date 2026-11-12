import {describe,expect,it} from 'vitest';
import {nearest,type RoadGraph,type Point} from './taxi';
import {resolvePurpleExplorerStart,prependPurpleStart} from './explorerStart';

function makeGraph(oneWay=false):RoadGraph{
 const nodes=new Map<string,Point>([
  ['A',[0,0]],['B',[0.002,0]],['X',[0.001,0.00002]],
  ['Y',[0.001,0.0004]]]);
 const edges:RoadGraph['edges']=new Map([
  ['A',[{id:'purple',to:'B',meters:222,speedKph:30,highway:'service'}]],
  ['B',oneWay?[]:[{id:'purple',to:'A',meters:222,speedKph:30,highway:'service'}]],
  ['X',[{id:'red',to:'Y',meters:45,speedKph:30,highway:'residential'}]],
  ['Y',[{id:'red',to:'X',meters:45,speedKph:30,highway:'residential'}]]
 ]);
 return {nodes,edges,nodeKeys:[...nodes.keys()]};
}
const endpoints=new Map<string,[string,string]>([
 ['purple',['A','B']],['red',['X','Y']]
]);
describe('purple road explorer starting position',()=>{
 it('selects the purple segment beneath a depot rather than the nearest red node',()=>{
  const graph=makeGraph();
  const depot:Point=[0.001,0];
  expect(nearest(graph,depot)).toBe('X');
  const start=resolvePurpleExplorerStart(graph,depot,new Set(['purple']),endpoints);
  expect(start?.roadId).toBe('purple');
  expect(['A','B']).toContain(start?.node);
  expect(start?.connector?.edgeId).toBe('purple');
  const plan=prependPurpleStart({path:[graph.nodes.get(start!.node)!,
   graph.nodes.get('X')!],edgeIds:['red'],discoveryEdgeIds:['red']},start!);
  expect(plan.path[0]).toEqual(depot);
  expect(plan.edgeIds).toEqual(['purple','red']);
  expect(plan.discoveryEdgeIds).toEqual(['red']);
 });
 it('approaches a one-way purple segment only in its permitted direction',()=>{
  const graph=makeGraph(true);
  const depot:Point=[0.0001,0];
  const start=resolvePurpleExplorerStart(graph,depot,new Set(['purple']),endpoints);
  expect(start?.node).toBe('B');
  expect(start?.connector?.edgeId).toBe('purple');
 });
 it('keeps a scout at the origin of a directed discovered road',()=>{
  const graph=makeGraph(true);
  const start=resolvePurpleExplorerStart(graph,[0,0],new Set(['purple']),endpoints);
  expect(start?.node).toBe('A');
  expect(start?.connector).toBeUndefined();
 });
 it('does not teleport onto a remote discovered road',()=>{
  const graph=makeGraph();
  expect(resolvePurpleExplorerStart(graph,[0.001,0.001],
   new Set(['purple']),endpoints)).toBeNull();
 });
 it('does not allow a red road to act as a starting connection',()=>{
  const graph=makeGraph();
  const start=resolvePurpleExplorerStart(graph,[0.001,0.00002],
   new Set(['purple']),endpoints,1);
  expect(start).toBeNull();
 });
 it('does not duplicate a connector when already at the legal endpoint',()=>{
  const graph=makeGraph();
  const start=resolvePurpleExplorerStart(graph,[0,0],
   new Set(['purple']),endpoints);
  expect(start?.node).toBe('A');
  expect(start?.connector).toBeUndefined();
 });
});
