import {describe,expect,it} from 'vitest';
import type {Point,RoadGraph} from './taxi';
import type {RoadFeature} from '../components/purpleRoadDiff';
import {advanceAmbientCar,ambientVehicleBudget,spawnAmbientCar} from './livingNpcTraffic';
import {meters} from './taxi';

const a:Point=[23.70,38.00],b:Point=[23.702,38.00],c:Point=[23.704,38.00],d:Point=[23.706,38.00];
const graph:RoadGraph={
 nodes:new Map([['a',a],['b',b],['c',c],['d',d]]),
 nodeKeys:['a','b','c','d'],
 edges:new Map([
  ['a',[{to:'b',meters:175,id:'ab',speedKph:36,highway:'residential'}]],
  ['b',[{to:'c',meters:175,id:'bc',speedKph:40,highway:'residential'}]],
  ['c',[{to:'d',meters:175,id:'cd',speedKph:40,highway:'residential'}]],
  ['d',[]],
 ]),
};
const road:RoadFeature={type:'Feature',id:'ab',
 properties:{roadId:'ab',fromNode:'a',toNode:'b',forward:true,reverse:false},
 geometry:{type:'LineString',coordinates:[a,b]}};
const now=Date.parse('2026-11-16T08:00:00Z');
describe('ambient NPC movement',()=>{
 it('creates a full taxi-style movement state from the real directed graph',()=>{
  const agent=spawnAmbientCar(road,graph,new Set(['ab','bc','cd']));
  expect(agent?.taxi.path).toEqual([a,b]);
  expect(agent?.taxi.edgeIds).toEqual(['ab']);
  expect(agent?.taxi.position[0]).toBeGreaterThan(a[0]);
  expect(agent?.taxi.position[0]).toBeLessThan(b[0]);
 });
 it('never spawns on undiscovered roads or against a one-way',()=>{
  expect(spawnAmbientCar(road,graph,new Set())).toBeNull();
  const wrong={...road,properties:{...road.properties,fromNode:'b',toNode:'a'}};
  const safelyDirected=spawnAmbientCar(wrong,graph,new Set(['ab']));
  expect(safelyDirected?.fromNode).toBe('a');
  expect(safelyDirected?.toNode).toBe('b');
 });
 it('moves smoothly without teleporting, continues to connected segments, and stops at a dead end',()=>{
  const known=new Set(['ab','bc','cd']);
  let agent=spawnAmbientCar(road,graph,known);
  expect(agent).not.toBeNull();
  const observed=new Set<string>();
  for(let i=0;i<330&&agent;i++){
   const previous=agent.taxi.position;
   agent=advanceAmbientCar(agent,graph,known,0.25,now);
   if(!agent)break;
   observed.add(agent.taxi.edgeIds[0]);
   expect(meters(previous,agent.taxi.position)).toBeLessThan(5);
   expect(known.has(agent.taxi.edgeIds[0])).toBe(true);
  }
  expect(observed.has('bc')).toBe(true);
  expect(observed.has('cd')).toBe(true);
 });
 it('does not enter a missing discovered connector',()=>{
  const known=new Set(['ab']);
  let agent=spawnAmbientCar(road,graph,known);
  expect(agent).not.toBeNull();
  for(let i=0;i<100&&agent;i++)agent=advanceAmbientCar(agent,graph,known,0.25,now);
  expect(agent).toBeNull();
 });
 it('keeps the mobile NPC budget bounded',()=>{
  expect(ambientVehicleBudget(18,100,true,1000)).toBeLessThanOrEqual(24);
  expect(ambientVehicleBudget(12,100,false,1000)).toBe(0);
 });
});
