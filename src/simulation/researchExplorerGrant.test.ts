import {describe,expect,it} from 'vitest';
import {grantExplorerInfrastructure,EXPANSION_ROLES} from './researchExplorerGrant';
import type {FleetState,Taxi} from './taxi';

const initial:Taxi={
 id:'original-highway',kind:'explorer',explorerRole:'highway',
 name:'Highway Explorer',driver:'Autonomous',position:[23.9,37.9],
 status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,
 fare:0,completed:0
};
const fleet=():FleetState=>({taxis:[initial],revenue:420,completed:7,
 exploredEdgeIds:['already-purple'],explorerExpansionApplied:true});
describe('Universal Explorer Infrastructure reward',()=>{
 it('grants two explorers for each of five roles even when legacy applied flag is set',()=>{
  const result=grantExplorerInfrastructure(fleet(),[23.901,37.902]);
  expect(result.taxis).toHaveLength(11);
  for(const role of EXPANSION_ROLES)
   expect(result.taxis.filter(t=>t.explorerRole===role)).toHaveLength(role==='highway'?3:2);
  expect(result.explorerExpansionVehiclesGranted).toBe(true);
  expect(result.revenue).toBe(420);
  expect(result.completed).toBe(7);
  expect(result.exploredEdgeIds).toEqual(['already-purple']);
 });
 it('keeps existing vehicles and starts all free additions at the supplied purple road',()=>{
  const result=grantExplorerInfrastructure(fleet(),[23.901,37.902]);
  expect(result.taxis[0]).toBe(initial);
  expect(result.taxis.slice(1).every(t=>
   t.position[0]===23.901&&t.position[1]===37.902&&
   t.status==='IDLE'&&t.depotId==='main'&&t.purchasePrice===0)).toBe(true);
 });
 it('never grants vehicles again on refresh or repeated completion checks',()=>{
  const once=grantExplorerInfrastructure(fleet(),[23.901,37.902]);
  expect(grantExplorerInfrastructure(once,[23.9,37.9])).toBe(once);
 });
 it('uses stable IDs to fill only missing rewards after an interrupted save',()=>{
  const base=fleet();
  const first=grantExplorerInfrastructure(base,[23.901,37.902]);
  const partial={...base,taxis:[...base.taxis,...first.taxis.slice(1,4)]};
  const recovered=grantExplorerInfrastructure(partial,[23.901,37.902]);
  expect(recovered.taxis).toHaveLength(11);
  expect(new Set(recovered.taxis.map(t=>t.id)).size).toBe(11);
 });
});