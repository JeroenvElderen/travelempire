import {afterEach,describe,expect,it} from 'vitest';
import type {RoadGraph,Point} from '../simulation/taxi';
import {setTrafficIncidents} from '../simulation/trafficConditions';
import {withRoadFeatureId,type RoadFeature} from './purpleRoadDiff';
import {
 ROAD_TRAFFIC_COLORS,roadTrafficBand,trafficBandForFeature,
} from './trafficRoadColors';

const time=Date.parse('2026-11-16T06:30:00Z'); // Monday 08:30 Athens
const athens:Point=[23.7275,37.9838],rural:Point=[21.1,37.2];
const geo=(id:string,from:string,to:string,start:Point,end:Point,tunnel=false):RoadFeature=>
 withRoadFeatureId({type:'Feature',properties:{
  roadId:id,fromNode:from,toNode:to,tunnel,
 },geometry:{type:'LineString',coordinates:[start,end]}});
const makeGraph=():RoadGraph=>{
 const nodes=new Map<string,Point>([['a',athens],['b',[23.7276,37.9839]],
  ['c',rural],['d',[21.1001,37.2001]]]);
 return {nodes,nodeKeys:[...nodes.keys()],edges:new Map([
  ['a',[{to:'b',id:'athens',meters:15,speedKph:40}]],
  ['b',[]],
  ['c',[{to:'d',id:'rural',meters:15,speedKph:40}]],
  ['d',[]],
 ])};
};
afterEach(()=>setTrafficIncidents([]));
describe('mobile traffic road colouring',()=>{
 it('uses real-time-zone regional traffic model rather than visual guesses',()=>{
  expect(roadTrafficBand(40,athens,time,'athens'))
   .not.toBe(roadTrafficBand(40,rural,time,'rural'));
 });
 it('shows severe road incidents and restores flow after expiry',()=>{
  const before=roadTrafficBand(65,athens,time,'incident-road');
  setTrafficIncidents([{roadId:'incident-road',kind:'collision',
   startedAt:time-1000,endsAt:time+60000}]);
  expect(roadTrafficBand(65,athens,time,'incident-road')).toBe('severe');
  expect(roadTrafficBand(65,athens,time,'other-road')).toBe(before);
  expect(roadTrafficBand(65,athens,time+3600000,'incident-road')).not.toBe('severe');
 });
 it('colours only real loaded directed road IDs with geometry',()=>{
  const graph=makeGraph();
  const a=geo('athens','a','b',athens,[23.7276,37.9839]);
  const ruralRoad=geo('rural','c','d',rural,[21.1001,37.2001]);
  expect(trafficBandForFeature(a,graph,time)).toBe(roadTrafficBand(40,athens,time,'athens'));
  expect(trafficBandForFeature(ruralRoad,graph,time)).toBe(roadTrafficBand(40,rural,time,'rural'));
  expect(trafficBandForFeature(geo('missing','a','b',athens,[23.7276,37.9839]),graph,time)).toBeNull();
  expect(trafficBandForFeature(geo('athens','c','d',rural,[21.1001,37.2001]),graph,time)).toBeNull();
 });
 it('tunnels keep the same congestion but remain styled separately',()=>{
  const graph=makeGraph(),road=geo('athens','a','b',athens,[23.7276,37.9839]);
  const tunnel=geo('athens','a','b',athens,[23.7276,37.9839],true);
  expect(trafficBandForFeature(tunnel,graph,time)).toEqual(trafficBandForFeature(road,graph,time));
 });
 it('supplies four distinct accessible map legend colours',()=>{
  expect(new Set(Object.values(ROAD_TRAFFIC_COLORS)).size).toBe(4);
  expect(Object.values(ROAD_TRAFFIC_COLORS).every(value=>/^#[0-9A-F]{6}$/i.test(value))).toBe(true);
 });
});
