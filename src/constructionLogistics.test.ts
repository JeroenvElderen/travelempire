import {describe,expect,it} from 'vitest';
import type {FerryNetwork} from './maritime/ferries';
import type {RoadGraph,Point} from './simulation/taxi';
import {meters} from './simulation/taxi';
import {planConstructionFreight,freightStage,freightPosition} from './constructionLogistics';
import {blankFloor,beginConstruction,constructionQuote,newHotelSite,settleConstruction} from './internalConstruction';

const p:Point=[23.7000,37.9000],h:Point=[23.7040,37.9000],s:Point=[23.7080,37.9000];
const o:Point=[23.620,37.915];
const network:FerryNetwork={version:1,ports:[
 {id:'origin',name:'Supplier harbour',position:o},
 {id:'port',name:'Delivery harbour',position:p,roadAccess:p},
 ],routes:[{id:'coastal',from:'origin',to:'port',geometry:[o,[23.65,37.909],p],durationMinutes:195,source:'test'}]};
const graph:RoadGraph={
 nodes:new Map([['port',p],['junction',h],['site',s]]),
 nodeKeys:['port','junction','site'],
 edges:new Map([
  ['port',[{to:'junction',id:'road1',meters:meters(p,h),speedKph:45}]],
  ['junction',[{to:'site',id:'road2',meters:meters(h,s),speedKph:35}]],
  ['site',[]],
 ]),
};
const start=500_000;

describe('hotel materials from cargo vessel to hotel construction',()=>{
 it('plans a genuine sea corridor, harbour unloading and directed truck route',()=>{
  const freight=planConstructionFreight(s,network,graph,start,11);
  expect(freight.originPortId).toBe('origin');
  expect(freight.destinationPortId).toBe('port');
  expect(freight.seaPath).toEqual(network.routes[0].geometry);
  expect(freight.roadPath).toEqual([p,h,s]);
  expect(freight.shippingHour).toBeGreaterThan(start);
  expect(freight.seaArrivalHour).toBeGreaterThan(freight.shippingHour);
  expect(freight.truckDepartureHour).toBe(freight.seaArrivalHour+2);
  expect(freight.deliveryHour).toBeGreaterThanOrEqual(start+11);
  expect(freightStage(freight,start)).toBe('preparing');
  expect(freightStage(freight,freight.shippingHour)).toBe('at-sea');
  expect(freightStage(freight,freight.seaArrivalHour)).toBe('unloading');
  expect(freightStage(freight,freight.truckDepartureHour)).toBe('trucking');
  expect(freightStage(freight,freight.deliveryHour)).toBe('delivered');
  expect(freightPosition(freight,freight.shippingHour)?.kind).toBe('ship');
  expect(freightPosition(freight,freight.truckDepartureHour)?.kind).toBe('truck');
  expect(freightPosition(freight,freight.deliveryHour)).toBeNull();
 });
 it('refuses to teleport a truck through missing or one-way roads',()=>{
  const blocked:RoadGraph={...graph,edges:new Map([
   ['port',[]],
   ['junction',[{to:'port',id:'road1',meters:meters(h,p),speedKph:45}]],
   ['site',[]],
  ])};
  expect(()=>planConstructionFreight(s,network,blocked,start,11)).toThrow(/road-connected harbour/i);
 });
 it('refuses hotels without loaded road access or real shipping corridors',()=>{
  expect(()=>planConstructionFreight([24.5,38.5],network,graph,start,11)).toThrow(/500 metres/);
  expect(()=>planConstructionFreight(s,{version:1,ports:network.ports,routes:[]},graph,start,11)).toThrow(/data are not ready/);
 });
 it('locks building work until the actual truck reaches the property',()=>{
  const site=newHotelSite('hotel','Hotel','new',s[1],s[0],start);
  site.draft=[{...blankFloor(0),rooms:[{id:'guest-a',type:'guest',name:'Guest room',x:1,y:1,width:4,height:4}]}];
  const quote=constructionQuote(site,'contractor',0);
  const freight=planConstructionFreight(s,network,graph,start,quote.deliveryHours);
  const built=beginConstruction(site,'contractor',0,start,'project',freight);
  expect(built.site.projects[0].deliveryHour).toBe(freight.deliveryHour);
  const state={version:1 as const,sites:{hotel:built.site},workers:0,lastPayrollHour:start};
  const before=settleConstruction(state,freight.deliveryHour-1).state;
  expect(before.sites.hotel.built[0].rooms).toHaveLength(0);
  const after=settleConstruction(before,built.site.projects[0].finishHour).state;
  expect(after.sites.hotel.built[0].rooms).toHaveLength(1);
  expect(after.sites.hotel.projects[0].status).toBe('complete');
 });
});