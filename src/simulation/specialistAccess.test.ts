import {describe,expect,it} from 'vitest';
import {specialistCanDepart,unlockedSpecialistRoles} from './specialistAccess';
import type {RoadGraph,Taxi,Point} from './taxi';

const nodes=new Map<string,Point>([
 ['A',[0,0]],['B',[0.001,0]],['C',[0.002,0]],['D',[0.003,0]],
 ['X',[1,0]],['Y',[1.001,0]]
]);
const graph:RoadGraph={nodes,nodeKeys:[...nodes.keys()],edges:new Map()};
const add=(a:string,b:string,id:string,highway:string)=>{
 const list=graph.edges.get(a)??[];
 list.push({id,to:b,meters:111,speedKph:40,highway});
 graph.edges.set(a,list);
};
add('A','B','seed-service','service');
add('B','A','seed-service','service');
add('B','C','local-next','residential');
add('C','B','local-next','residential');
add('C','D','highway-next','motorway');
add('D','C','highway-next','motorway');
add('X','Y','distant-highway','motorway');
add('Y','X','distant-highway','motorway');

const access=(connected:string[],purple:string[],poi:string[]=[])=>unlockedSpecialistRoles(
 graph,new Set(connected),new Set(purple),new Set(poi));

describe('strict connected specialist road-class activation',()=>{
 it('does not release the Highway Explorer from the purple parking-road seed',()=>{
  const roles=access(['A','B'],['seed-service']);
  expect(specialistCanDepart({kind:'explorer',explorerRole:'highway'},roles)).toBe(false);
  expect(specialistCanDepart({kind:'explorer',explorerRole:'primary'},roles)).toBe(false);
  expect(specialistCanDepart({kind:'explorer',explorerRole:'secondary'},roles)).toBe(false);
  expect(specialistCanDepart({kind:'explorer',explorerRole:'poi'},roles)).toBe(false);
  expect(specialistCanDepart({kind:'explorer',explorerRole:'residential'},roles)).toBe(true);
 });
 it('unlocks the highway once local discovery connects purple to a motorway junction',()=>{
  const roles=access(['A','B','C'],['seed-service','local-next']);
  expect(roles.has('highway')).toBe(true);
 });
 it('does not unlock a motorway that is in an unrelated distant component',()=>{
  const roles=access(['A','B'],['seed-service','distant-highway']);
  expect(roles.has('highway')).toBe(false);
 });
 it('unlocks POI only at an indexed access road adjoining connected purple',()=>{
  expect(access(['A','B'],['seed-service'],['distant-highway']).has('poi')).toBe(false);
  expect(access(['A','B'],['seed-service'],['local-next']).has('poi')).toBe(true);
 });
 it('does not allow a specialist if the purple network is empty',()=>{
  expect(access([],[]).size).toBe(0);
 });
 it('never restricts passenger taxis using the specialist role lock',()=>{
  expect(specialistCanDepart({kind:'taxi',explorerRole:'highway'},new Set())).toBe(true);
 });
});
