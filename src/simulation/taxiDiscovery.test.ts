import {describe,expect,it} from 'vitest';
import {tickTaxi,type Taxi,type RoadGraph,type Point} from './taxi';

const a:Point=[0,0],b:Point=[0.001,0];
const ka='0.000000,0.000000',kb='0.001000,0.000000';
const graph:RoadGraph={
 nodes:new Map([[ka,a],[kb,b]]),nodeKeys:[ka,kb],
 edges:new Map([
  [ka,[{to:kb,id:'red-road',meters:111,speedKph:30,highway:'residential'}]],
  [kb,[{to:ka,id:'red-road',meters:111,speedKph:30,highway:'residential'}]]
 ])
};
const taxi=(overrides:Partial<Taxi>={}):Taxi=>({
 id:'taxi-1',kind:'taxi',name:'Taxi 1',driver:'Driver',
 position:a,status:'RETURNING',path:[a,b],edgeIds:['red-road'],
 leg:0,distanceIntoLeg:0,pauseAtHome:true,fare:0,completed:0,
 ...overrides
});
describe('passenger taxis never reveal roads',()=>{
 it('does not reveal a traversed road while returning to a depot',()=>{
  const result=tickTaxi(taxi(),graph,120);
  expect(result.discovered).toEqual([]);
 });
 it('does not reveal pickup-route roads, even when a new leg starts',()=>{
  const result=tickTaxi(taxi({status:'TO_PICKUP',dropoff:b}),graph,120);
  expect(result.discovered).toEqual([]);
 });
 it('does not reveal roads after completing a passenger journey',()=>{
  const result=tickTaxi(taxi({status:'TO_DROPOFF',fare:20,journeyEdges:['legacy-undiscovered-road']}),graph,120);
  expect(result.discovered).toEqual([]);
 });
});

describe('POI explorer discovers real harbour approach roads',()=>{
 it('discovers all road types driven, even if the planner omitted discoveryEdgeIds',()=>{
  const result=tickTaxi(taxi({kind:'explorer',explorerRole:'poi',status:'EXPLORING',
   discoveryEdgeIds:[]}),graph,120);
  expect(result.discovered).toContain('red-road');
 });
 it('discovers access roads driven on operational return journeys',()=>{
  const result=tickTaxi(taxi({kind:'explorer',explorerRole:'poi',status:'RETURNING',
   discoveryEdgeIds:[],pauseAtHome:true}),graph,120);
  expect(result.discovered).toContain('red-road');
 });
 it('does not grant the same privilege to other explorer roles',()=>{
  const result=tickTaxi(taxi({kind:'explorer',explorerRole:'primary',status:'EXPLORING',
   discoveryEdgeIds:[]}),graph,120);
  expect(result.discovered).toEqual([]);
 });
});
