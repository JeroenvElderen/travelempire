import {describe,expect,it} from 'vitest';
import {inspectExplorerComponent,componentFailureSignature} from './explorerConnectivity';
import type {RoadGraph,Point} from './taxi';
function roadGraph():RoadGraph{
 const nodes=new Map<string,Point>([
  ['HQ',[0,0]],['A',[.001,0]],['B',[.002,0]],['C',[.003,0]],
  ['T',[.004,0]],['X',[.0015,.0005]],['Y',[.0025,.0005]],
 ]);
 const edges:RoadGraph['edges']=new Map();
 const edge=(from:string,to:string,id:string,highway='residential')=>{
  edges.set(from,[...(edges.get(from)??[]),{to,id,meters:100,speedKph:30,highway}]);
 };
 edge('HQ','A','purple-1');edge('A','HQ','purple-1');
 edge('A','B','purple-2');edge('B','A','purple-2');
 edge('B','C','primary-1','primary');
 edge('C','T','primary-2','primary');
 edge('X','Y','isolated');edge('Y','X','isolated');
 return {nodes,edges,nodeKeys:[...nodes.keys()]};
}
describe('directed explorer network diagnostics',()=>{
 it('identifies a reachable primary-road frontier across purple roads',()=>{
  const graph=roadGraph();
  const result=inspectExplorerComponent(graph,'HQ',new Set(['purple-1','purple-2']),
   new Set(['primary-1','primary-2']),new Set(), 'HQ');
  expect(result).toMatchObject({visited:3,complete:true,discoveredEdges:2,
   eligibleFrontiers:1,hqReachable:true});
 });
 it('does not report visual crossings or disconnected islands as reachable',()=>{
  const graph=roadGraph();
  const result=inspectExplorerComponent(graph,'X',new Set(['purple-1','purple-2','isolated']),
   new Set(['primary-1']),new Set(),'HQ');
  expect(result.visited).toBe(2);
  expect(result.eligibleFrontiers).toBe(0);
  expect(result.hqReachable).toBe(false);
 });
 it('respects direction and reports one-way dead ends',()=>{
  const graph=roadGraph();
  graph.edges.set('A',(graph.edges.get('A')??[]).filter(e=>e.to==='HQ'));
  const result=inspectExplorerComponent(graph,'HQ',new Set(['purple-1','purple-2']),
   new Set(['primary-1']),new Set(),'B');
  expect(result.visited).toBe(2);
  expect(result.hqReachable).toBe(false);
  expect(result.eligibleFrontiers).toBe(0);
 });
 it('distinguishes reserved frontiers from missing frontiers',()=>{
  const result=inspectExplorerComponent(roadGraph(),'HQ',new Set(['purple-1','purple-2']),
   new Set(['primary-1']),new Set(['primary-1']),'HQ');
  expect(result).toMatchObject({eligibleFrontiers:0,reservedFrontiers:1});
 });
 it('keeps capped searches explicitly inconclusive',()=>{
  const result=inspectExplorerComponent(roadGraph(),'HQ',new Set(['purple-1','purple-2']),
   new Set(),new Set(),null,1);
  expect(result).toMatchObject({visited:1,complete:false});
 });
 it('invalidates a negative result after a new tile or discovery',()=>{
  const previous=componentFailureSignature('A',100,20,'highway');
  expect(componentFailureSignature('A',101,20,'highway')).not.toBe(previous);
  expect(componentFailureSignature('A',100,21,'highway')).not.toBe(previous);
  expect(componentFailureSignature('B',100,20,'highway')).not.toBe(previous);
 });
});
