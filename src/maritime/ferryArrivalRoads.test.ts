import {describe,it,expect} from 'vitest';
import {ferryArrivalRoadIds} from './ferryArrivalRoads';
import type {RoadGraph} from '../simulation/taxi';

const graph=(nodes:Record<string,[number,number]>,roads:Array<[string,string,string,boolean?]>):RoadGraph=>{
 const edges=new Map<string,Array<{id:string;to:string;meters:number;speedKph:number;taxiOnly?:boolean}>>();
 for(const [a,b,id,taxiOnly] of roads){
  for(const [from,to] of [[a,b],[b,a]]){
   const list=edges.get(from)??[];
   list.push({id,to,meters:10,speedKph:30,taxiOnly});
   edges.set(from,list);
  }
 }
 return {nodes:new Map(Object.entries(nodes)),edges,nodeKeys:Object.keys(nodes)};
};
describe('ferry arrival 50m road seed',()=>{
 it('discovers only the connected local edges and never a long edge outside the radius',()=>{
  const g=graph({a:[0,0],b:[0.0001,0],c:[0.0002,0],far:[0.002,0],isolated:[0,0.00035],isolated2:[0.0001,0.00035]},
   [['a','b','ab'],['b','c','bc'],['c','far','long'],['isolated','isolated2','separate']]);
  expect(ferryArrivalRoadIds(g,[0,0])).toEqual(['ab','bc']);
 });
 it('ignores taxi-only links and empty graph',()=>{
  const g=graph({a:[0,0],b:[0.0001,0]},[['a','b','restricted',true]]);
  expect(ferryArrivalRoadIds(g,[0,0])).toEqual([]);
 });
});
