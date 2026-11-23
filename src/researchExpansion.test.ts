import {describe,expect,it} from 'vitest';
import {allProjects,projects} from './research';
import {DIVISIONS,buildResearchHierarchy} from './researchHierarchy';
import {newProjects,maximum,resourceKeys,technologyParents} from './researchProgress';
import {PRODUCT_KEYS,recipeById,productRequirements} from './researchProducts';
import {PARENT_LEVEL_REQUIREMENTS,technologyLevelRequirements} from './researchAutomatic';

/** The expansion adds functional technologies; none is a decorative tile or
 * a fabricated resource. Every technology remains machine-allocated.
 */
const additions=[
 'fareBundles','commuterPasses','eventSurgeForecast','vipTransfers','destinationPackages',
 'smartPooling','fleetShiftHandover','harbourConnections','interIslandTickets','hubTransfers','premiumFerryServices',
 'terrainMapping','expeditionPlanning','roadGraphInference','islandRecon',
 'frontDeskAnalytics','roomYield','conciergeNetwork','resortOperations',
 'parkingDemandPrediction','smartTariffs','automatedAccess','hotelParkingPackages',
 'liquiditySignals','creditPortfolio','financeAutomation','assetBackedFunding','globalSettlement',
 'tyreTelemetry','hybridPowertrains','partsStandardisation','fleetLifecycleAI',
 'siteSurveys','greenBuildings','supplyChains','prefabHotels','mixedUseProjects'
] as const;
const crafted=[
 'ticketingModel','harbourSchedule','roadTelemetry','stayRevenueForecast',
 'parkingFlowModel','creditPortfolioReport','fleetReliabilityMap','developmentBlueprint'
] as const;
describe('new branching research extensions',()=>{
 it('adds exactly 37 new one-level technologies without altering previously completed levels',()=>{
  expect(additions).toHaveLength(37);
  expect(allProjects).toHaveLength(101);
  expect(allProjects.reduce((n,p)=>n+maximum(p.id),0)).toBe(209);
  expect(new Set(allProjects.map(p=>p.id)).size).toBe(allProjects.length);
  expect(new Set(additions).size).toBe(additions.length);
  expect(additions.every(id=>newProjects.some(p=>p.id===id))).toBe(true);
  expect(additions.every(id=>maximum(id)===1)).toBe(true);
  expect(projects).toHaveLength(27);
 });
 it('locates every new technology in exactly one of the eight original divisions',()=>{
  const hierarchy=buildResearchHierarchy(allProjects.map(p=>p.id));
  expect(hierarchy.nodes).toHaveLength(209+5+8);
  for(const id of additions){
   const groups=DIVISIONS.filter(d=>d.projects.includes(id));
   expect(groups.map(g=>g.key),id).toHaveLength(1);
   const node=hierarchy.byId.get(id+':1');
   expect(node?.kind).toBe('research');
   expect(node?.division).toBe(groups[0].key);
  }
  expect(DIVISIONS.map(d=>d.projects.length)).toEqual([18,21,11,7,7,14,15,8]);
 });
 it('branches across multiple technologies and industries rather than a single long chain',()=>{
  const all=new Set(allProjects.map(p=>p.id));
  let joined=0;
  for(const id of additions){
   const project=newProjects.find(p=>p.id===id)!;
   expect(project.requires.length,id).toBeGreaterThan(0);
   expect(project.requires.every(parent=>all.has(parent)),id).toBe(true);
   if(project.requires.length>1)joined++;
   expect(project.effect.length).toBeGreaterThan(18);
   expect(project.rate).toBeGreaterThan(0);
   expect(Object.keys(project.resources).length).toBeGreaterThanOrEqual(2);
   expect(Object.keys(project.resources).every(key=>
    resourceKeys.includes(key as typeof resourceKeys[number]))).toBe(true);
  }
  expect(joined).toBeGreaterThan(25);
  const graph=new Set(buildResearchHierarchy(allProjects.map(p=>p.id)).edges.map(e=>e.from+'>'+e.to));
  expect(graph.has('fareBundles:1>commuterPasses:1')).toBe(true);
  expect(graph.has('smartTariffs:1>hotelParkingPackages:1')).toBe(true);
  expect(graph.has('roomYield:1>hotelParkingPackages:1')).toBe(true);
  expect(graph.has('harbourSurvey:1>islandRecon:1')).toBe(true);
  expect(graph.has('parkingYield:1>mixedUseProjects:1')).toBe(true);
 });
 it('produces eight genuine recipe chains, consumed by descendants of their unlocks',()=>{
  expect(crafted).toHaveLength(8);
  expect(PRODUCT_KEYS).toHaveLength(35);
  for(const id of crafted){
   const recipe=recipeById.get(id);
   expect(recipe,id).toBeDefined();
   expect(additions).toContain(recipe!.unlock.project as typeof additions[number]);
   expect(recipe!.unlock.level).toBe(1);
   expect(Object.keys(recipe!.parts??{}).length,id).toBeGreaterThan(0);
  }
  for(const id of additions){
   const requirements=productRequirements(id,1,projects);
   expect(Object.keys(requirements).length,id).toBeGreaterThan(0);
   for(const [ingredient,needed] of Object.entries(requirements)){
    expect(recipeById.has(ingredient as typeof PRODUCT_KEYS[number]),id).toBe(true);
    expect(needed,id).toBeGreaterThan(0);
   }
  }
 });
 it('requires researched parent levels for the most complex crossroads',()=>{
  const context={roads:200000,explorers:6,depots:4,freshStart:true,starterLevel:5};
  const incomplete={peakPricing:1,procurement:1,survey:1,engine:1,
   parkingDemandPrediction:1,smartTariffs:0,fleetAnalytics:1};
  expect(technologyLevelRequirements('fareBundles',1,incomplete,context))
   .toContain('peakPricing Level 2');
  expect(technologyLevelRequirements('liquiditySignals',1,incomplete,context))
   .toContain('procurement Level 2');
  expect(technologyLevelRequirements('terrainMapping',1,incomplete,context))
   .toContain('survey Level 2');
  expect(PARENT_LEVEL_REQUIREMENTS['eventSurgeForecast'].fleetAnalytics).toBe(2);
 });
});
