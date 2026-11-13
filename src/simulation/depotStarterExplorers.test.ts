import {describe,expect,it} from 'vitest';
import {createDepotStarterExplorers,reconcileDepotStarterExplorers,type DepotStarterAnchor} from './depotStarterExplorers';
import type {FleetState} from './taxi';

describe('new depot starter explorers',()=>{
 it('creates the five specialist roles at the new depot without moving HQ vehicles',()=>{
  const position:[number,number]=[23.74,37.97];
  const explorers=createDepotStarterExplorers('depot-new','Athens South',position);
  expect(explorers.map(t=>t.explorerRole)).toEqual(['highway','primary','secondary','residential','poi']);
  expect(explorers).toHaveLength(5);
  expect(explorers.every(t=>t.depotId==='depot-new'&&t.kind==='explorer'&&t.status==='IDLE')).toBe(true);
  expect(explorers.every(t=>t.position[0]===position[0]&&t.position[1]===position[1])).toBe(true);
  expect(explorers.every(t=>t.purchasePrice===0)).toBe(true);
  expect(new Set(explorers.map(t=>t.id)).size).toBe(5);
 });
 it('creates distinct vehicles for each depot, not shared explorer IDs',()=>{
  const a=createDepotStarterExplorers('a','Depot A',[23,37]);
  const b=createDepotStarterExplorers('b','Depot B',[24,38]);
  expect(a.every(t=>t.depotId==='a')).toBe(true);
  expect(b.every(t=>t.depotId==='b')).toBe(true);
  expect(new Set([...a,...b].map(t=>t.id)).size).toBe(10);
 });
 it('grants five separate specialists when adding each of two depots',()=>{
  const initial:FleetState={taxis:[],revenue:0,completed:0};
  const a={id:'first',name:'Depot One',lng:23,lat:37,capacity:5};
  const b={id:'second',name:'Depot Two',lng:24,lat:38,capacity:5};
  const anchors=new Map<string,DepotStarterAnchor>([
   [a.id,{position:[23,37],roadId:'road-a'}],
   [b.id,{position:[24,38],roadId:'road-b'}],
  ]);
  const updated=reconcileDepotStarterExplorers(initial,[a,b],anchors);
  expect(updated.taxis).toHaveLength(10);
  expect(updated.taxis.filter(t=>t.depotId===a.id)).toHaveLength(5);
  expect(updated.taxis.filter(t=>t.depotId===b.id)).toHaveLength(5);
  expect(updated.depotStarterExplorerGrants).toEqual({first:true,second:true});
  expect(updated.exploredEdgeIds).toEqual(['road-a','road-b']);
  expect(reconcileDepotStarterExplorers(updated,[a,b],anchors)).toBe(updated);
 });
 it('restores only missing roles without duplicating existing depot vehicles',()=>{
  const a={id:'first',name:'One',lng:23,lat:37,capacity:5};
  const b={id:'second',name:'Two',lng:24,lat:38,capacity:5};
  const existing=createDepotStarterExplorers(a.id,a.name,[23,37]);
  const secondPartial=createDepotStarterExplorers(b.id,b.name,[24,38]).slice(0,2);
  const fleet:FleetState={taxis:[...existing,...secondPartial],revenue:0,completed:0,
   depotStarterExplorerGrants:{first:true},exploredEdgeIds:['existing']};
  const repaired=reconcileDepotStarterExplorers(fleet,[a,b],
   new Map([[b.id,{position:[24,38],roadId:'road-b'}]]));
  expect(repaired.taxis).toHaveLength(10);
  expect(repaired.taxis.filter(t=>t.depotId===b.id)).toHaveLength(5);
  expect(repaired.taxis.filter(t=>t.depotId===a.id)).toHaveLength(5);
  expect(new Set(repaired.taxis.map(t=>t.id)).size).toBe(10);
  expect(repaired.exploredEdgeIds).toEqual(['existing','road-b']);
 });
 it('does not award replacement explorers after selling one from a previously granted depot',()=>{
  const depot={id:'second',name:'Two',lng:24,lat:38,capacity:5};
  const fleet:FleetState={taxis:createDepotStarterExplorers('second','Two',[24,38]).slice(1),
   revenue:0,completed:0,depotStarterExplorerGrants:{second:true}};
  const result=reconcileDepotStarterExplorers(fleet,[depot],
   new Map([[depot.id,{position:[24,38],roadId:'road'}]]));
  expect(result).toBe(fleet);
 });
 it('waits for a real loaded and directed depot road before retroactive grant',()=>{
  const depot={id:'second',name:'Two',lng:24,lat:38,capacity:5};
  const fleet:FleetState={taxis:[],revenue:0,completed:0};
  expect(reconcileDepotStarterExplorers(fleet,[depot],new Map())).toBe(fleet);
 });
});
