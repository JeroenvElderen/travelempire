import {describe,expect,it} from 'vitest';
import {missingDepotAccessSeeds} from './depotRoadSeeds';
import type {RoadGraph,Taxi} from './taxi';
import type {Company} from '../company';

const company={
 headquarters:{lng:23.7,lat:37.9,label:'HQ',region:'Attica',country:'Greece',countryCode:'GR'},
 depots:[{id:'andros',name:'Andros',lng:24.84,lat:37.83,capacity:10}],
} satisfies Pick<Company,'headquarters'|'depots'>;
function graph():RoadGraph{
 const nodes=new Map<string,[number,number]>([
  ['main',[23.7,37.9]],['hq-end',[23.7002,37.9]],
  ['port',[24.84,37.83]],['island-end',[24.8402,37.83]],
 ]);
 return {nodes,nodeKeys:[...nodes.keys()],edges:new Map([
  ['main',[{id:'hq-road',to:'hq-end',meters:17,speedKph:40}]],
  ['hq-end',[{id:'hq-road',to:'main',meters:17,speedKph:40}]],
  ['port',[{id:'island-road',to:'island-end',meters:18,speedKph:40}]],
  ['island-end',[{id:'island-road',to:'port',meters:18,speedKph:40}]],
 ])};
}
function starter(depotId:string):Taxi{
 return {id:'starter-'+depotId,kind:'explorer',explorerRole:'residential',
  depotId,name:'Local explorer',driver:'Autonomous',position:depotId==='main'?
   [23.7,37.9]:[24.84,37.83],status:'IDLE',
  path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0};
}
describe('recovering real OSM depot access for legacy explorer saves',()=>{
 it('seeds just the actual roads at two owned depots when purple is missing',()=>{
  expect(missingDepotAccessSeeds(company,{taxis:[starter('main'),starter('andros')]},
   graph(),new Set())).toEqual([
   {depotId:'main',edgeId:'hq-road'},{depotId:'andros',edgeId:'island-road'},
  ]);
 });
 it('does not repeatedly seed a road that is already discovered',()=>{
  expect(missingDepotAccessSeeds(company,{taxis:[starter('main'),starter('andros')]},
   graph(),new Set(['hq-road','island-road']))).toEqual([]);
 });
 it('does not seed an island outside the loaded graph',()=>{
  const missing=graph();
  missing.nodes.delete('port');missing.nodes.delete('island-end');
  missing.nodeKeys=['main','hq-end'];
  missing.edges.delete('port');missing.edges.delete('island-end');
  expect(missingDepotAccessSeeds(company,{taxis:[starter('andros')]},missing,new Set())).toEqual([]);
 });
 it('does not seed taxi-only or private transit corridors',()=>{
  const restricted=graph();
  restricted.edges.set('port',[{id:'restricted-only',to:'island-end',meters:12,speedKph:20,taxiOnly:true}]);
  expect(missingDepotAccessSeeds(company,{taxis:[starter('andros')]},restricted,new Set())).toEqual([]);
 });
 it('never seeds a depot road kilometres away',()=>{
  const far=graph();
  far.nodes.set('port',[24.9,37.9]);
  far.nodes.set('island-end',[24.9002,37.9]);
  far.nodeKeys=[...far.nodes.keys()];
  expect(missingDepotAccessSeeds(company,{taxis:[starter('andros')]},far,new Set())).toEqual([]);
 });
 it('never gives a new purple road to a depot without resident explorers',()=>{
  expect(missingDepotAccessSeeds(company,{taxis:[]},graph(),new Set())).toEqual([]);
 });
});
