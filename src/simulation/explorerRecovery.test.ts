import {describe,it,expect} from 'vitest';
import {routeStrandedExplorerToPurple} from './explorerRecovery';
import type {RoadGraph,Point} from './taxi';

const makeGraph=():RoadGraph=>{
 const nodes=new Map<string,Point>([
  ['A',[23.900,37.900]],['B',[23.901,37.900]],
  ['C',[23.902,37.900]],['D',[23.903,37.900]],
  ['E',[23.904,37.900]]]);
 const edges:RoadGraph['edges']=new Map();
 const add=(from:string,to:string,id:string)=>{
  const list=edges.get(from)??[];
  list.push({id,to,meters:90,speedKph:35,highway:'service'});
  edges.set(from,list);
 };
 add('A','B','ab');add('B','A','ab');
 add('B','C','bc');add('C','D','cd');
 add('D','E','purple');add('E','D','purple');
 return {nodes,edges,nodeKeys:[...nodes.keys()]};
};
const endpoints=new Map<string,[string,string]>([
 ['ab',['A','B']],['bc',['B','C']],['cd',['C','D']],['purple',['D','E']]
]);
describe('stranded explorer recovery',()=>{
 it('drives from a red access road to the purple network without discovering it',()=>{
  const graph=makeGraph();
  const position:Point=[23.9005,37.900];
  const route=routeStrandedExplorerToPurple(graph,position,new Set(['purple']),
   endpoints,new Set(['ab','bc','cd','purple']));
  expect(route?.edgeIds).toEqual(['ab','bc','cd']);
  expect(route?.path[0]).toEqual(position);
  expect(route?.targetNode).toBe('D');
 });
 it('escapes from the downstream end of a discovered one-way road',()=>{
  const graph=makeGraph();
  // The purple road points INTO B with no legal purple edge leaving B.
  // The explorer must use the directed service-road escape B → C → D.
  graph.edges.set('B',[{id:'bc',to:'C',meters:90,speedKph:35,highway:'service'}]);
  const discovered=new Set(['ab','purple']);
  const route=routeStrandedExplorerToPurple(graph,[23.901,37.900],discovered,
   endpoints,new Set(['ab','bc','cd','purple']));
  expect(route?.targetNode).toBe('D');
  expect(route?.edgeIds).toEqual(['bc','cd']);
 });
 it('rejects a disconnected or wrong-way exit rather than teleporting',()=>{
  const graph=makeGraph();
  graph.edges.set('C',[]);
  const route=routeStrandedExplorerToPurple(graph,[23.9005,37.900],
   new Set(['purple']),endpoints,new Set(['ab','bc','cd']));
  expect(route).toBeNull();
 });
 it('does not create a return trip when the vehicle is already on purple',()=>{
  const graph=makeGraph();
  expect(routeStrandedExplorerToPurple(graph,[23.903,37.900],new Set(['purple']),
   endpoints,new Set(['purple','cd']))).toBeNull();
 });
 it('does not manufacture a road to an off-network location',()=>{
  const graph=makeGraph();
  expect(routeStrandedExplorerToPurple(graph,[24,38],new Set(['purple']),
   endpoints,new Set(['ab','bc']))).toBeNull();
 });
});
