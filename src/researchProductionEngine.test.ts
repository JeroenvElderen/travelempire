import {describe,it,expect} from 'vitest';
import {allocateResearchProducts} from './researchProductionEngine';
import {productRequirements,recipeAvailable,recipeIngredients,PRODUCT_KEYS,RECIPES} from './researchProducts';
import {advanceAutomaticTree} from './researchAutomatic';
import {lockedFeature} from './researchUnlocks';
import {empty,projects} from './research';
import {safeBag,resourceKeys,newProjects} from './researchProgress';

const ledger={};
const ctx={roads:12000,explorers:2,depots:2,freshStart:true};
const bag=(items:Parameters<typeof safeBag>[0])=>safeBag(items);
describe('automatic multi-stage research manufacturing',()=>{
 it('has unique recipes and unlocks for progressively complex research items',()=>{
  expect(RECIPES.length).toBe(PRODUCT_KEYS.length);
  expect(new Set(RECIPES.map(r=>r.id)).size).toBe(PRODUCT_KEYS.length);
  expect(productRequirements('pricing',1,projects)).toEqual({});
  expect(productRequirements('pricing',2,projects).marketBrief).toBe(3);
  expect(productRequirements('pricing',3,projects).demandForecast).toBe(2);
  expect(productRequirements('pricing',4,projects).integratedMobility).toBe(2);
  expect(productRequirements('pricing',5,projects).integratedMobility).toBe(5);
  expect(recipeAvailable('marketBrief',{pricing:1})).toBe(true);
  expect(recipeAvailable('demandForecast',{pricing:5})).toBe(false);
  expect(recipeIngredients('demandForecast').some(i=>i.kind==='product')).toBe(true);
 });
 it('automatically consumes raw income exactly once to manufacture level-two research products',()=>{
  const levels={pricing:1};
  const first=allocateResearchProducts(
   [{key:'pricing:2',goal:{marketBrief:2}}],levels,bag({passengers:20,revenue:400}),ledger);
  expect(first.changed).toBe(true);
  expect(first.resources.passengers).toBe(4);
  expect(first.resources.revenue).toBe(160);
  expect(first.ledger.productContributions?.['pricing:2']?.marketBrief).toBe(2);
  expect(first.ledger.productProduced?.marketBrief).toBe(2);
  expect(first.ledger.productConsumed?.marketBrief).toBe(2);
  expect(first.ledger.productInventory?.marketBrief).toBe(0);
  expect(first.ledger.productRawSpent?.passengers).toBe(16);
  expect(first.ledger.productRawSpent?.revenue).toBe(240);
  const again=allocateResearchProducts(
   [{key:'pricing:2',goal:{marketBrief:2}}],levels,first.resources,first.ledger);
  expect(again.changed).toBe(false);
  expect(again.ledger).toBe(first.ledger);
 });
 it('never consumes partial ingredients on failed recipes or locked recipes',()=>{
  const missing=allocateResearchProducts(
   [{key:'pricing:2',goal:{marketBrief:1}}],{pricing:1},bag({passengers:7,revenue:10000}),ledger);
  expect(missing.changed).toBe(false);
  expect(missing.resources.passengers).toBe(7);
  expect(missing.resources.revenue).toBe(10000);
  const locked=allocateResearchProducts(
   [{key:'pricing:3',goal:{demandForecast:1}}],{pricing:3},bag({passengers:1000,distance:1000,revenue:10000}),ledger);
  expect(locked.changed).toBe(false);
  expect(locked.resources.revenue).toBe(10000);
 });
 it('automatically builds recursive intermediate products with exact resource conservation',()=>{
  const supplied=bag({passengers:48,distance:140,revenue:1560});
  const built=allocateResearchProducts(
   [{key:'pricing:3',goal:{demandForecast:1}}],
   {pricing:1,fleetAnalytics:2},supplied,ledger);
  expect(built.changed).toBe(true);
  expect(built.ledger.productContributions?.['pricing:3']?.demandForecast).toBe(1);
  expect(built.ledger.productProduced?.marketBrief).toBe(3);
  expect(built.ledger.productProduced?.fleetReport).toBe(2);
  expect(built.ledger.productProduced?.demandForecast).toBe(1);
  for(const key of resourceKeys){
   expect(built.resources[key]+(built.ledger.productRawSpent?.[key]??0)).toBe(supplied[key]);
  }
  for(const key of PRODUCT_KEYS){
   expect((built.ledger.productProduced?.[key]??0)-(built.ledger.productConsumed?.[key]??0))
    .toBe(built.ledger.productInventory?.[key]??0);
  }
 });
 it('keeps previously unlocked levels and contributions after upgrading the product system',()=>{
  const state={...empty(),researchV3:true as const,levels:{pricing:2,engine:2},
   earned:bag({passengers:220,revenue:30000,distance:6000}),
   resources:bag({passengers:90,revenue:7000,distance:4000})};
  const upgraded=advanceAutomaticTree(state,projects,{...ctx,freshStart:false});
  expect(upgraded.levels.pricing).toBeGreaterThanOrEqual(2);
  expect(upgraded.levels.engine).toBeGreaterThanOrEqual(2);
  expect(upgraded.productVersion).toBe(1);
 });
});
describe('research-gated business access',()=>{
 const blank=empty();
 it('lets a new company use only map, research and starter fleet at the beginning',()=>{
  for(const feature of ['World','Fleet','Research'])
   expect(lockedFeature(feature,true,blank)).toBeNull();
  for(const feature of ['Dealership','Drivers','Operations','Ferries','Investments','Hotels','Company','Finance','Infrastructure','Tourism'])
   expect(lockedFeature(feature,true,blank)).not.toBeNull();
 });
 it('unlocks each division through its own research and preserves old companies',()=>{
  const save={...blank,starterLevel:4,levels:{portAnalytics:1,advertising:2,depotEfficiency:2,trainingResearch:1,procurement:1,fleetAnalytics:1}};
  for(const feature of ['Dealership','Drivers','Operations','Ferries','Investments','Hotels','Company','Finance'])
   expect(lockedFeature(feature,true,save)).toBeNull();
  for(const feature of ['Dealership','Drivers','Ferries','Hotels','Finance'])
   expect(lockedFeature(feature,false,blank)).toBeNull();
 });
 it('does not demand ferry customers before ferry research can unlock',()=>{
  const ferry=newProjects.find(p=>p.id==='portAnalytics');
  expect(ferry?.resources.ferries??0).toBe(0);
  expect(ferry?.resources.roads).toBeGreaterThan(0);
 });
});
