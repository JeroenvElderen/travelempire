import {describe,expect,it} from 'vitest';
import {dispatchScout,type Point,type RoadGraph,type Taxi} from './taxi';

const a:Point=[23,37],b:Point=[23.0005,37],c:Point=[23.001,37],d:Point=[23.0015,37];
const graph:RoadGraph={
 nodes:new Map([['a',a],['b',b],['c',c],['d',d]]),
 nodeKeys:['a','b','c','d'],
 edges:new Map([
  ['a',[{to:'b',meters:44,id:'known',speedKph:30,highway:'service'}]],
  ['b',[{to:'c',meters:44,id:'unrevealed-connector',speedKph:60,highway:'primary'}]],
  ['c',[{to:'d',meters:44,id:'residential-target',speedKph:30,highway:'residential'}]],
  ['d',[]]
 ])
};
const scout:Taxi={id:'r',kind:'explorer',explorerRole:'residential',name:'Residential',driver:'Autonomous',
 position:a,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0};
const allowed=new Set(['known','unrevealed-connector','residential-target']);
const target=new Set(['residential-target']);

describe('strict connected road discovery',()=>{
 it('cannot jump over an unrevealed road of another class to reach its own class',async()=>{
  const assignment=await dispatchScout(scout,graph,new Set(['known']),a,
   new Set(),new Set(),undefined,allowed,target,undefined,undefined,undefined,
   undefined,undefined,new Set(['a','b']),undefined,target);
  expect(assignment.status).toBe('IDLE');
 });
 it('can reach that road once the connector has been discovered',async()=>{
  const assignment=await dispatchScout(scout,graph,new Set(['known','unrevealed-connector']),a,
   new Set(),new Set(),undefined,allowed,target,undefined,undefined,undefined,
   undefined,undefined,new Set(['a','b','c']),undefined,target);
  expect(assignment.status).toBe('EXPLORING');
  expect(assignment.edgeIds).toEqual(['known','unrevealed-connector','residential-target']);
  expect(assignment.discoveryEdgeIds).toEqual(['residential-target']);
 });
 it('must begin from a discovered road junction',async()=>{
  const detached=await dispatchScout({...scout,position:c},graph,new Set(['known']),a,
   new Set(),new Set(),undefined,allowed,target,undefined,undefined,undefined,
   undefined,undefined,new Set(['a','b']),undefined,target);
  expect(detached.status).toBe('IDLE');
 });
});
