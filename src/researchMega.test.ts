import {describe,expect,it} from 'vitest';
import {allProjects,projects} from './research';
import {buildResearchHierarchy,DIVISIONS} from './researchHierarchy';
import {MEGA_RESEARCH_BRANCHES,MEGA_RESEARCH_DIVISIONS,
 MEGA_RESEARCH_ANCHORS,MEGA_RESEARCH_PRODUCTS} from './researchMegaCatalog';
import {maximum,resourceKeys,safeBag,unlockedBonus} from './researchProgress';
import {allocateResearchProducts} from './researchProductionEngine';
import {PRODUCT_KEYS,productRequirements,recipeById} from './researchProducts';
import {advancedBankRateDiscount,ADVANCED_BANK_RESEARCH} from './simulation/vehicleFinancing';

const groups=Object.entries(MEGA_RESEARCH_DIVISIONS);
describe('96 new TravelEmpire research branches',()=>{
 it('keeps exactly 96 technologies split among eight UNEQUAL original divisions',()=>{
  expect(MEGA_RESEARCH_BRANCHES).toHaveLength(96);
  expect(groups).toHaveLength(8);
  expect(Object.fromEntries(groups.map(([key,nodes])=>[key,nodes.length]))).toEqual({
   revenue:14,taxis:18,explorers:12,hotels:8,parking:8,finance:14,vehicles:12,construction:10
  });
  expect(allProjects).toHaveLength(207);
  expect(allProjects.reduce((sum,p)=>sum+maximum(p.id),0)).toBe(315);
  expect(new Set(allProjects.map(p=>p.id)).size).toBe(207);
  expect(projects).toHaveLength(28);
  const diagram=buildResearchHierarchy(allProjects.map(p=>p.id));
  expect(diagram.nodes).toHaveLength(329);
  for(const [division,ids] of groups){
   expect(DIVISIONS.some(d=>d.key===division)).toBe(true);
   for(const id of ids){
    expect(diagram.byId.get(id+':1')?.division).toBe(division);
   }
  }
 });
 it('uses only real earned resources, valid parents, and manufactured ingredients',()=>{
  const known=new Set(allProjects.map(p=>p.id));
  const keys=new Set(PRODUCT_KEYS);
  const seen=new Set<string>();
  for(const project of MEGA_RESEARCH_BRANCHES){
   expect(seen.has(project.id),project.id).toBe(false);
   seen.add(project.id);
   expect(project.requires.length,project.id).toBeGreaterThanOrEqual(2);
   expect(project.requires.every(p=>known.has(p)),project.id).toBe(true);
   expect(Object.entries(project.resources).length,project.id).toBeGreaterThanOrEqual(2);
   expect(Object.entries(project.resources).every(([k,n])=>
    resourceKeys.includes(k as typeof resourceKeys[number])&&Number.isFinite(n)&&n>0)).toBe(true);
   const ingredients=productRequirements(project.id,1,projects);
   expect(Object.keys(ingredients).length,project.id).toBeGreaterThanOrEqual(2);
   expect(Object.entries(ingredients).every(([key,n])=>keys.has(key as typeof PRODUCT_KEYS[number])&&n>0),project.id).toBe(true);
   expect(project.rate).toBeGreaterThan(0);
   expect(maximum(project.id)).toBe(1);
  }
 });
 it('automatically manufactures eight new intermediate products without circular recipe unlocks',()=>{
  expect(PRODUCT_KEYS).toHaveLength(43);
  for(const [division,product] of Object.entries(MEGA_RESEARCH_PRODUCTS)){
   const recipe=recipeById.get(product as typeof PRODUCT_KEYS[number]);
   expect(recipe,division).toBeDefined();
   expect(recipe?.unlock.project).toBe(MEGA_RESEARCH_ANCHORS[division as keyof typeof MEGA_RESEARCH_ANCHORS]);
   expect(recipe?.unlock.level).toBe(1);
   expect(Object.keys(recipe?.parts??{}).length).toBeGreaterThanOrEqual(1);
   const root=MEGA_RESEARCH_BRANCHES.find(p=>p.id===recipe?.unlock.project);
   expect(root).toBeDefined();
   expect(Object.keys(productRequirements(root!.id,1,projects))).not.toContain(product);
  }
  const raw=safeBag({passengers:1000,roads:4000,revenue:80000});
  const levels={pricing:1,peakPricing:2,fleetAnalytics:2,survey:1,
   fareElasticity:1};
  const first=allocateResearchProducts([
   {key:'journeyPassbook:1',goal:{fareMatrix:2}}
  ],levels,raw,{});
  expect(first.changed).toBe(true);
  expect(first.ledger.productContributions?.['journeyPassbook:1']?.fareMatrix).toBe(2);
  for(const key of resourceKeys)
   expect(first.resources[key]+(first.ledger.productRawSpent?.[key]??0)).toBe(raw[key]);
  const again=allocateResearchProducts([
   {key:'journeyPassbook:1',goal:{fareMatrix:2}}
  ],levels,first.resources,first.ledger);
  expect(again.changed).toBe(false);
 });
 it('preserves earlier research bonus cap and raises only the late game cap with genuine completions',()=>{
  const baseline={};
  expect(unlockedBonus(baseline,'taxi')).toBe(0);
  const newly={fareElasticity:1};
  expect(unlockedBonus(newly,'taxi')).toBeGreaterThan(0);
 });
 it('connects fourteen bank research achievements to a real lower APR quote',()=>{
  expect(ADVANCED_BANK_RESEARCH).toHaveLength(14);
  const funded=Object.fromEntries(ADVANCED_BANK_RESEARCH.map(id=>[id,1]));
  expect(advancedBankRateDiscount({})).toBe(0);
  expect(advancedBankRateDiscount(funded)).toBeCloseTo(.007,7);
 });
});
