import {describe,expect,it} from 'vitest';
import {validateFerryNetwork,type FerryNetwork} from './ferries';
import type {RoadGraph,Taxi} from '../simulation/taxi';
import {choosePassengerFerry,ferryPosition,passengerFerryTicketEuros} from './explorerPassengerFerry';

const a:[number,number]=[23,37],a2:[number,number]=[23.0005,37];
const b:[number,number]=[23.05,37],c:[number,number]=[23.0505,37],d:[number,number]=[23.051,37];
const graph:RoadGraph={
 nodes:new Map([['a',a],['a2',a2],['b',b],['c',c],['d',d]]),
 nodeKeys:['a','a2','b','c','d'],
 edges:new Map([
  ['a',[{to:'a2',meters:45,id:'mainland-road',highway:'service',speedKph:30}]],
  ['a2',[{to:'a',meters:45,id:'mainland-road',highway:'service',speedKph:30}]],
  ['b',[{to:'c',meters:45,id:'island-residential',highway:'residential',speedKph:30}]],
  ['c',[{to:'d',meters:45,id:'island-service',highway:'service',speedKph:30}]],
  ['d',[]]
 ])
};
const network:FerryNetwork={version:1,ports:[
 {id:'mainland',name:'Mainland',position:a,roadAccess:a},
 {id:'island',name:'Island',position:b,roadAccess:b}],
 routes:[{id:'sea-link',from:'mainland',to:'island',geometry:[a,[23.025,37],b],durationMinutes:50,source:'test'}]};
const scout:Taxi={id:'x',kind:'explorer',explorerRole:'residential',name:'Test',driver:'Autonomous',position:a,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0};

describe('explorer passenger ferry tickets and road hierarchy',()=>{
 it('allows the highest destination class to buy a ticket without owning the route',()=>{
  const offer=choosePassengerFerry(scout,network,graph,new Set(['mainland-road']));
  expect(offer?.routeId).toBe('sea-link');
  expect(offer?.seedRoadId).toBe('island-residential');
  expect(offer?.ticketEuros).toBe(passengerFerryTicketEuros(50));
 });
 it('blocks lower-priority explorers until the highest road class is discovered',()=>{
  expect(choosePassengerFerry({...scout,explorerRole:'service'},network,graph,new Set(['mainland-road']))).toBe(null);
  const offer=choosePassengerFerry({...scout,explorerRole:'service'},network,graph,new Set(['mainland-road','island-residential']));
  expect(offer?.toPortId).toBe('island');
  expect(offer?.seedRoadId).toBeUndefined();
 });
 it('never boards from an undiscovered road',()=>{
  expect(choosePassengerFerry(scout,network,graph,new Set())).toBeNull();
 });
 it('refuses a destination without eligible undiscovered connected roads',()=>{
  expect(choosePassengerFerry(scout,network,graph,new Set(['mainland-road','island-residential']))).toBeNull();
  expect(choosePassengerFerry({...scout,explorerRole:'motorway'},network,graph,new Set(['mainland-road']))).toBeNull();
 });
 it('does not revisit a completed island',()=>{
  expect(choosePassengerFerry({...scout,ferryVisitedPorts:['island']},network,graph,new Set(['mainland-road']))).toBeNull();
 });
 it('does not teleport to a destination without its road graph',()=>{
  const incomplete:RoadGraph={...graph,nodeKeys:['a','a2'],nodes:new Map([['a',a],['a2',a2]]),edges:new Map([['a',graph.edges.get('a')!],['a2',graph.edges.get('a2')!]])};
  expect(choosePassengerFerry(scout,network,incomplete,new Set(['mainland-road']))).toBeNull();
 });
 it('preserves vessel interpolation from port to port',()=>{
  expect(ferryPosition(network.routes[0].geometry,0)).toEqual(a);
  expect(ferryPosition(network.routes[0].geometry,1)).toEqual(b);
 });
 it('completes short/reversed OSM ferry geometry to actual harbour endpoints',()=>{
  const raw={...network,routes:[{...network.routes[0],geometry:[[23.04,37],[23.01,37]] as [number,number][]}]};
  const fixed=validateFerryNetwork(raw);
  expect(fixed.routes[0].geometry[0]).toEqual(a);
  expect(fixed.routes[0].geometry.at(-1)).toEqual(b);
 });
});
