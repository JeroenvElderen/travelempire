import {describe,expect,it} from 'vitest';
import {createDepotStarterExplorers} from './depotStarterExplorers';

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
});
