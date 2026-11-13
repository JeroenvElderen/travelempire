import {describe,it,expect} from 'vitest';
import {emptyMobilityGraph,appendMobilityRoads,closestMobilityNode,planMobilityRoute,
 advanceMobilitySession,newMobilitySession,type MobilityGraph} from './mobilityExploration';
import type {MobilitySegment} from '../data/mobilityTiles';

const roads:MobilitySegment[]=[
 {id:'walk-one',a:'1',b:'2',coordinates:[[23,38],[23.001,38]],length:87,highway:'footway',walk:3,cycle:0},
 {id:'bicycle-oneway',a:'2',b:'3',coordinates:[[23.001,38],[23.002,38]],length:87,highway:'cycleway',walk:3,cycle:1},
 {id:'steps',a:'3',b:'4',coordinates:[[23.002,38],[23.002,38.001]],length:111,highway:'steps',walk:3,cycle:0},
 {id:'bridge',a:'A',b:'B',coordinates:[[23.001,38.00001],[23.002,38.00001]],length:87,highway:'footway',walk:3,cycle:0,bridge:true,layer:1},
];
function graph(mode:'walk'|'cycle'):MobilityGraph{
 const g=emptyMobilityGraph();appendMobilityRoads(g,roads,mode);return g;
}
describe('separate walking and cycling OSM exploration graph',()=>{
 it('keeps sidewalk and stairs accessible only to pedestrians',()=>{
  expect(graph('walk').ids.size).toBe(4);
  expect(graph('cycle').ids.size).toBe(1);
 });
 it('does not connect a bridge to a lower footway at coincident coordinates',()=>{
  const g=graph('walk');
  expect(planMobilityRoute(g,'1',new Set(['walk-one','bicycle-oneway','steps']))).toBeNull();
 });
 it('respects signed bicycle one-way direction',()=>{
  const g=graph('cycle');
  expect(planMobilityRoute(g,'2',new Set())?.map(e=>e.to)).toEqual(['3']);
  expect(planMobilityRoute(g,'3',new Set())).toBeNull();
 });
 it('walkers can reverse at the end of a car-free footway',()=>{
  const g=graph('walk');
  expect(planMobilityRoute(g,'2',new Set(['bicycle-oneway','steps']))?.map(e=>e.to)).toEqual(['1']);
 });
 it('starts only from actual OSM nodes close to the ferry landing',()=>{
  const g=graph('walk');
  expect(closestMobilityNode(g,[24,38],250)).toBeNull();
  const session=newMobilitySession(g,'walk','p1',[23,38]);
  expect(session?.node).toBe('1');
 });
 it('only marks an OSM segment discovered when fully traversed',()=>{
  const g=graph('walk');
  const session=newMobilitySession(g,'walk','p1',[23,38])!;
  session.path=planMobilityRoute(g,'1',new Set())!;
  const partial=advanceMobilitySession(session,2,10);
  expect(partial.crossed).toEqual([]);
  const complete=advanceMobilitySession(partial.session,5,100);
  expect(complete.crossed).toEqual(['walk-one']);
  expect(complete.session.node).toBe('2');
 });
});
