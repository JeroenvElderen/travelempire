import {describe,expect,it} from 'vitest';
import {routeIsolatedExplorerToMainNetwork} from './explorerComponentRecovery';
import type {Point,RoadGraph} from './taxi';
const graph=():RoadGraph=>{
 const nodes=new Map<string,Point>([['HQ',[0,0]],['M',[.001,0]],
 ['A',[.002,0]],['B',[.003,0]],['X',[.002,.002]]]);
 const edges:RoadGraph['edges']=new Map();
 const add=(a:string,b:string,id:string)=>{
  edges.set(a,[...(edges.get(a)??[]),{id,to:b,meters:100,
   speedKph:30,highway:'service'}]);
 };
 add('HQ','M','purple-main');add('M','HQ','purple-main');
 add('A','B','purple-island');add('B','A','purple-island');
 // Legal directed emergency exit from the isolated component to HQ's roads.
 add('B','M','red-bridge');
 return{nodes,nodeKeys:[...nodes.keys()],edges};
};
describe('isolated directed explorer component recovery',()=>{
 it('drives from a small discovered island to the HQ-connected network',()=>{
  const result=routeIsolatedExplorerToMainNetwork(graph(),'A',
   new Set(['HQ','M']),new Set(['purple-island','purple-main']));
  expect(result?.edgeIds).toEqual(['purple-island','red-bridge']);
  expect(result?.transitRoads).toEqual(['red-bridge']);
  expect(result?.targetNode).toBe('M');
 });
 it('never teleports or follows a one-way bridge backwards',()=>{
  const g=graph();
  g.edges.set('B',(g.edges.get('B')??[]).filter(e=>e.id!=='red-bridge'));
  g.edges.set('M',[...(g.edges.get('M')??[]),{id:'red-bridge',
   to:'B',meters:100,speedKph:30}]);
  expect(routeIsolatedExplorerToMainNetwork(g,'A',new Set(['HQ','M']),
   new Set(['purple-island','purple-main']))).toBeNull();
 });
 it('does not recover an explorer already on the HQ-connected component',()=>{
  expect(routeIsolatedExplorerToMainNetwork(graph(),'M',
   new Set(['HQ','M']),new Set(['purple-main']))).toBeNull();
 });
 it('will not jump between nearby disconnected roads',()=>{
  const g=graph();
  g.edges.set('B',(g.edges.get('B')??[]).filter(e=>e.id!=='red-bridge'));
  expect(routeIsolatedExplorerToMainNetwork(g,'A',new Set(['HQ','M']),
   new Set(['purple-island','purple-main']))).toBeNull();
 });
 it('respects bounded search and does not invent a fallback path',()=>{
  expect(routeIsolatedExplorerToMainNetwork(graph(),'A',new Set(['HQ','M']),
   new Set(['purple-island','purple-main']),1)).toBeNull();
 });
});
