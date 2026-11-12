import {describe,expect,it} from 'vitest';
import {planConnectedFrontier} from './connectedFrontier';
import type {Point,RoadGraph} from './taxi';
function network():RoadGraph{
 const nodes=new Map<string,Point>([
 ['HQ',[24,38]],['A',[24.01,38]],['B',[24.02,38]],
 ['C',[24.03,38]],['H',[24.04,38]],['I',[24.05,38]],
 ['X',[24.015,38.0001]],['Y',[24.016,38.0001]]
 ]);
 const edges:RoadGraph['edges']=new Map();
 const add=(a:string,b:string,id:string,kind:string)=>{
  const list=edges.get(a)??[];list.push({to:b,id,meters:1000,
   highway:kind,speedKph:50});edges.set(a,list);
 };
 const both=(a:string,b:string,id:string,kind:string)=>{
  add(a,b,id,kind);add(b,a,id,kind);
 };
 both('HQ','A','p1','primary');both('A','B','p2','primary');
 both('B','C','p3','primary');both('C','H','p4','primary');
 both('H','I','m1','motorway');
 both('X','Y','isolated','motorway');
 return {nodes,nodeKeys:[...nodes.keys()],edges};
}
describe('shared connected-frontier explorer routing',()=>{
 it('travels over other discovered classes and reveals only its own class',()=>{
  const graph=network();
  const discovered=new Set(['p1','p2','p3','p4']);
  const result=planConnectedFrontier(graph,'HQ',discovered,
   new Set(['m1']),new Set(),new Set(),'highway');
  expect(result.route?.edgeIds).toEqual(['p1','p2','p3','p4','m1']);
  expect(result.route?.discoveryEdgeIds).toEqual(['m1']);
  expect(result.diagnostic.reason).toBe('planned-connected-frontier');
 });
 it('does not jump to an isolated road despite matching class and proximity',()=>{
  const graph=network();
  const result=planConnectedFrontier(graph,'HQ',new Set(['p1','p2']),
   new Set(['isolated']),new Set(),new Set(),'highway');
  expect(result.route).toBeNull();
  expect(result.diagnostic.reason).toBe('no-connected-class-road');
 });
 it('obeys one-way direction while transferring over purple roads',()=>{
  const graph=network();
  graph.edges.set('A',(graph.edges.get('A')??[]).filter(e=>e.to!=='B'));
  const result=planConnectedFrontier(graph,'HQ',new Set(['p1','p2','p3','p4']),
   new Set(['m1']),new Set(),new Set(),'highway');
  expect(result.route).toBeNull();
 });
 it('respects reserved discovery edges and finds another legal frontier',()=>{
  const graph=network();
  const result=planConnectedFrontier(graph,'H',new Set(['p4']),
   new Set(['m1']),new Set(['m1']),new Set(),'highway');
  expect(result.route).toBeNull();
 });
 it('does not target one-way cul-de-sacs without a legal return',()=>{
  const graph=network();
  graph.edges.set('I',[]);
  const result=planConnectedFrontier(graph,'H',new Set(['p4']),
   new Set(['m1']),new Set(),new Set(),'highway');
  expect(result.route).toBeNull();
  expect(result.diagnostic.reason).toBe('one-way-no-legal-exit');
 });
 it('crosses farther than the former 85 km extended-search ceiling',()=>{
  const graph=network();const explored=new Set<string>();
  let previous='HQ';
  for(let i=0;i<100;i++){
   const node='N'+i,id='long-'+i;
   graph.nodes.set(node,[24+(i+1)*.008,38]);graph.nodeKeys.push(node);
   graph.edges.set(previous,[{to:node,id,meters:1000,speedKph:75,highway:'primary'}]);
   graph.edges.set(node,[{to:previous,id,meters:1000,speedKph:75,highway:'primary'}]);
   explored.add(id);previous=node;
  }
  const destination='target';
  graph.nodes.set(destination,[24.81,38]);graph.nodeKeys.push(destination);
  graph.edges.get(previous)!.push({id:'new-motorway',to:destination,meters:1000,speedKph:90,highway:'motorway'});
  graph.edges.set(destination,[{id:'new-motorway',to:previous,meters:1000,speedKph:90,highway:'motorway'}]);
  const result=planConnectedFrontier(graph,'HQ',explored,
   new Set(['new-motorway']),new Set(),new Set(),'highway');
  expect(result.route?.edgeIds).toHaveLength(101);
 });
});
