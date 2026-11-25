import {describe,it,expect} from 'vitest';
import {allProjects,projects,empty} from './research';
import {maximum,safeBag} from './researchProgress';
import {advanceAutomaticTree} from './researchAutomatic';
import {collectorResearchCosts,consumeCollectorResearch,allocateCollectorResearch,finishCollectorResearch} from './collectorResearch';
import {COLLECTOR_PARTS,emptyCollector} from './resourceCollectors';
describe('multi-resource research recipes',()=>{
 it('uses all eight material types across every technology and level',()=>{
  const used=new Set<string>();
  for(const project of allProjects)for(let level=1;level<=maximum(project.id);level++){
   const costs=collectorResearchCosts(project,level);
   expect(Object.keys(costs).length).toBeGreaterThanOrEqual(2);
   for(const [key,value] of Object.entries(costs)){used.add(key);expect(value).toBeGreaterThan(0);expect(Number.isInteger(value)).toBe(true);}
  }
  expect([...used].sort()).toEqual([...COLLECTOR_PARTS].sort());
  expect(collectorResearchCosts({id:'portAnalytics',category:8,tier:1},1).marine).toBeGreaterThan(0);
  expect(collectorResearchCosts({id:'engine',category:1},5).rare).toBeGreaterThan(0);
 });
 it('uses specialized recipes and higher-level requirements',()=>{
  const base=collectorResearchCosts({id:'engine',category:1},1);
  expect(base).toEqual({mechanical:10,energy:5,electronics:5,research:5});
  expect(collectorResearchCosts({id:'engine',category:1},5).mechanical).toBeGreaterThan(base.mechanical!);
  expect(collectorResearchCosts({id:'collectorRegional',category:2,tier:4},1).construction).toBeGreaterThan(0);
 });
 it('consumes all materials atomically and never spends a partially available recipe',()=>{
  const state={...emptyCollector(),stock:{mechanical:10,energy:1}};
  expect(consumeCollectorResearch(state,{mechanical:4,energy:2})).toBeNull();
  expect(state.stock.mechanical).toBe(10);
  const next=consumeCollectorResearch(state,{mechanical:4,energy:1})!;
  expect(next.stock).toEqual({mechanical:6,energy:0});
  expect(next.researchSpent).toEqual({mechanical:4,energy:1});
  expect(next.delivered).toEqual({});
 });
 it('blocks automatic completion until every material is available, then spends once',()=>{
  const context={freshStart:false,roads:10000,explorers:5,depots:2};
  const earned=safeBag({passengers:10000,roads:100000,revenue:10000000,distance:100000,maintenance:1000});
  const initial={...empty(),earned,resources:earned,researchV3:true as const,collector:{...emptyCollector(),stock:{business:4}}};
  const blocked=advanceAutomaticTree(initial,projects,context);
  expect(blocked.levels.pricing??0).toBe(0);
  expect(blocked.collector?.researchAllocated?.['pricing:1']?.business).toBe(4);
  const ready={...blocked,collector:{...blocked.collector!,stock:{business:6,research:10,electronics:5}}};
  const done=advanceAutomaticTree(ready,projects,context);
  expect(done.levels.pricing).toBe(1);
  expect(done.collector?.stock.business).toBe(0);
  expect(done.collector?.researchSpent).toEqual({business:10,research:10,electronics:5});
  const again=advanceAutomaticTree(done,projects,context);
  expect(again.collector?.researchSpent).toEqual(done.collector?.researchSpent);
 });
});

it('stores partial research allocations and completes without double spending',()=>{
 const initial={...emptyCollector(),stock:{mechanical:10}};
 const a=allocateCollectorResearch(initial,'engine:1',{mechanical:25,energy:5});
 expect(a.stock.mechanical).toBe(0);
 expect(a.researchAllocated?.['engine:1']).toEqual({mechanical:10});
 expect(finishCollectorResearch(a,'engine:1',{mechanical:25,energy:5})).toBeNull();
 const b=allocateCollectorResearch({...a,stock:{mechanical:15,energy:5}},'engine:1',{mechanical:25,energy:5});
 const done=finishCollectorResearch(b,'engine:1',{mechanical:25,energy:5})!;
 expect(done.researchSpent).toEqual({mechanical:25,energy:5});
 expect(done.researchAllocated).toEqual({});
 expect(finishCollectorResearch(done,'engine:1',{mechanical:25,energy:5})).toBeNull();
});
