import {describe,expect,it} from 'vitest';
import type {FerryNetwork} from './ferries';
import type {RoadGraph,Taxi} from '../simulation/taxi';
import {choosePassengerFerry,ferryPosition,passengerFerryTicketEuros} from './explorerPassengerFerry';

const a:[number,number]=[23,37],b:[number,number]=[23.05,37],c:[number,number]=[23.06,37];
const graph:RoadGraph={
 nodes:new Map([['a',a],['b',b],['c',c]]),
 nodeKeys:['a','b','c'],
 edges:new Map([['a',[]],['b',[{to:'c',meters:900,id:'island-road',highway:'residential',speedKph:30}]],['c',[]]])
};
const network:FerryNetwork={version:1,ports:[
 {id:'mainland',name:'Mainland',position:a,roadAccess:a},
 {id:'island',name:'Island',position:b,roadAccess:b}],
 routes:[{id:'sea-link',from:'mainland',to:'island',geometry:[a,[23.025,37],b],durationMinutes:50,source:'test'}]};
const scout:Taxi={id:'x',kind:'explorer',explorerRole:'residential',name:'Test',driver:'Autonomous',position:a,status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,fare:0,completed:0};

describe('explorer public ferry tickets',()=>{
 it('allows a passenger trip even without any route purchase',()=>{
  const offer=choosePassengerFerry(scout,network,graph,new Set());
  expect(offer?.routeId).toBe('sea-link');
  expect(offer?.ticketEuros).toBe(passengerFerryTicketEuros(50));
  expect(offer?.toPortId).toBe('island');
 });
 it('refuses destinations without new eligible specialist roads',()=>{
  expect(choosePassengerFerry(scout,network,graph,new Set(['island-road']))).toBe(null);
  expect(choosePassengerFerry({...scout,explorerRole:'motorway'},network,graph,new Set())).toBe(null);
 });
 it('does not revisit a completed island',()=>{
  expect(choosePassengerFerry({...scout,ferryVisitedPorts:['island']},network,graph,new Set())).toBe(null);
 });
 it('does not create a sea crossing with missing destination road access',()=>{
  const incomplete:RoadGraph={...graph,nodeKeys:['a'],nodes:new Map([['a',a]]),edges:new Map([['a',[]]])};
  expect(choosePassengerFerry(scout,network,incomplete,new Set())).toBe(null);
 });
 it('interpolates map position along ferry geometry',()=>{
  expect(ferryPosition(network.routes[0].geometry,0)).toEqual(a);
  expect(ferryPosition(network.routes[0].geometry,1)).toEqual(b);
  const middle=ferryPosition(network.routes[0].geometry,0.5);
  expect(middle[0]).toBeGreaterThan(a[0]);
  expect(middle[0]).toBeLessThan(b[0]);
 });
});
