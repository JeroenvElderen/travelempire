import {describe,it,expect} from 'vitest';
import {shiftRestTargets,isAtShiftRestStop} from './shiftRest';
import type {Company} from '../company';
import {tickTaxi,type Taxi,type RoadGraph} from './taxi';
import type {RestStop} from './driverRest';

const company={
 headquarters:{lng:23.9,lat:37.9},
 depots:[{id:'d1',name:'Main depot',lng:23.901,lat:37.9,capacity:20}]
} as Company;
const taxi={id:'t1',position:[23.9,37.9],depotId:'d1'} as Taxi;
const stops:RestStop[]=[
 {id:'h1',name:'Hotel',kind:'hotel',position:[23.9005,37.9]},
 {id:'p1',name:'Parking',kind:'parking',position:[23.9003,37.9]},
 {id:'r1',name:'Rest area',kind:'rest_area',position:[23.9007,37.9]}
];
describe('scheduled taxi rest destinations',()=>{
 it('uses nearby hotels for overnight rest and keeps assigned depot as fallback',()=>{
  const choices=shiftRestTargets(taxi,stops,company,true);
  expect(choices[0].id).toBe('h1');
  expect(choices.map(c=>c.kind)).toEqual(['hotel','depot']);
 });
 it('prefers nearby parking for short breaks and excludes hotels',()=>{
  const choices=shiftRestTargets(taxi,stops,company,false);
  expect(choices[0].id).toBe('p1');
  expect(choices.every(c=>c.kind!=='hotel')).toBe(true);
 });
 it('requires actual arrival before displaying a sleeping indicator',()=>{
  const stop=shiftRestTargets(taxi,stops,company,true)[0];
  expect(isAtShiftRestStop({...taxi,position:[23.95,37.95]},stop)).toBe(false);
  expect(isAtShiftRestStop({...taxi,position:[23.9005,37.9]},stop)).toBe(true);
 });
 it('falls back to headquarters if no other depot or stop exists',()=>{
  const result=shiftRestTargets({...taxi,depotId:'missing'},[],company,true);
  expect(result).toHaveLength(1);
  expect(result[0].name).toBe('Headquarters');
 });
 it('waits until a returning taxi reaches the hotel before switching to PAUSED',()=>{
  const nodes=new Map([
   ['A',[23.9,37.9] as [number,number]],
   ['B',[23.9005,37.9] as [number,number]]
  ]);
  const graph:RoadGraph={nodes,nodeKeys:['A','B'],edges:new Map([
   ['A',[{id:'ab',to:'B',meters:45,speedKph:30,highway:'service'}]],
   ['B',[{id:'ab',to:'A',meters:45,speedKph:30,highway:'service'}]]
  ])};
  const travelling={...taxi,kind:'taxi' as const,status:'RETURNING' as const,
   position:[23.9,37.9] as [number,number],path:[nodes.get('A')!,nodes.get('B')!],
   edgeIds:['ab'],leg:0,distanceIntoLeg:0,pauseAtHome:true,shiftParked:true,
   scheduledShiftParked:true,restStopId:'h1',restStopName:'Hotel',
   fare:0,completed:0,driver:'Test',name:'Taxi 1'};
  expect(tickTaxi(travelling,graph,0.1).taxi.status).toBe('RETURNING');
  const arrived=tickTaxi(travelling,graph,60).taxi;
  expect(arrived.status).toBe('PAUSED');
  expect(arrived.position).toEqual(nodes.get('B'));
  expect(arrived.restStopId).toBe('h1');
 });
});
