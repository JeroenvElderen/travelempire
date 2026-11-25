import {
 allResearch,normalizeResources,prerequisites,resourceKeys,researchCosts,safeBag,
 type OperationalContext,type ResearchProject,type ResourceBag,type ResourceCosts,type ResourceKey,type ResourceState
} from './researchProgress';
import {collectorResearchCosts,allocateCollectorResearch,finishCollectorResearch} from './collectorResearch';
import {allocateResearchProducts,type ProductionLedger} from './researchProductionEngine';
import {productRequirements,type ProductBag,PRODUCT_KEYS} from './researchProducts';

/** Five introductory milestones from the approved tech-tree design.
 * Jobs and discovered roads are cumulative operating achievements, never
 * bank cash or individually spent research inventory. Existing saves keep
 * their completed levels and have their next stage assessed automatically.
 */
export const STARTER_STAGES=[
 {level:1,name:'Start Up',jobs:10,roads:50,unlocks:'Operations I'},
 {level:2,name:'Operations I',jobs:20,roads:200,unlocks:'Operations II'},
 {level:3,name:'Operations II',jobs:30,roads:500,unlocks:'Operations III'},
 {level:4,name:'Operations III',jobs:40,roads:1000,unlocks:'Operations IV'},
 {level:5,name:'Operations IV',jobs:50,roads:2000,unlocks:'Dealership and nine research divisions'}
] as const;

export const STARTER_LEVELS=STARTER_STAGES.length;
export type AutomaticState=ResourceState&{levels:Partial<Record<string,number>>;active?:{id:string;level:number;startedAt:number;endsAt:number}};

/** Some joined branches require more than the first level of a parent. */
export const PARENT_LEVEL_REQUIREMENTS:Record<string,Readonly<Record<string,number>>>={
 airportMarkets:{premium:2},
 regionalReposition:{fleetAnalytics:2,routing:2,navigation:2},
 safetyCertification:{defensive:2},
 networkLogistics:{depotEfficiency:3},
 customerRetention:{loyalty:2},
 treasuryForecast:{efficiency:2},
 // New branches demand specific parent levels before automatic product
 // manufacturing begins; completed older saves are never rolled back.
 fareBundles:{peakPricing:2},
 eventSurgeForecast:{fleetAnalytics:2,peakPricing:2},
 vipTransfers:{peakPricing:2},
 smartPooling:{routing:2},
 terrainMapping:{survey:2},
 resortOperations:{procurement:2},
 smartTariffs:{peakPricing:2},
 liquiditySignals:{procurement:2},
 financeAutomation:{efficiency:2},
 tyreTelemetry:{engine:2,durability:2},
 hybridPowertrains:{durability:2}
};
export const REQUIRED_LEVELS=(id:string,parent:string)=>
 PARENT_LEVEL_REQUIREMENTS[id]?.[parent]??1;

export const researchNodeId=(id:string,level:number)=>id+':'+level;
export function technologyLevelRequirements(
 id:string,level:number,levels:Partial<Record<string,number>>,context:OperationalContext
):string[]{
 const missing:string[]=[];
 if(level>1&&(levels[id]??0)<level-1)missing.push(id+' Level '+(level-1));
 if(level===1){
  const bases=prerequisites(id,levels,context);
  missing.push(...bases);
  // Escalated level requirements apply only to parents already checked by
  // the base prerequisite evaluator.
  const requirements=PARENT_LEVEL_REQUIREMENTS[id]??{};
  for(const [parent,required] of Object.entries(requirements)){
   if((levels[parent]??0)>=1&&(levels[parent]??0)<required)
    missing.push(parent+' Level '+required);
  }
 }
 if(context.freshStart&&((context.starterLevel??0)<STARTER_LEVELS))
  missing.push('Starter Level 5 · Vehicle Dealership');
 return missing;
}
export function starterProgress(earned:ResourceCosts,completed:number){
 const next=STARTER_STAGES[Math.max(0,Math.min(STARTER_LEVELS-1,completed))];
 return {
  completed:Math.min(STARTER_LEVELS,Math.max(0,completed)),
  next:completed>=STARTER_LEVELS?null:next,
  jobs:Math.max(0,earned.passengers??0),roads:Math.max(0,earned.roads??0),revenue:Math.max(0,earned.revenue??0)
 };
}
export function automaticUnlocked(state:ResourceState|undefined,companyIsNew:boolean){
 return !companyIsNew||(state?.starterLevel??0)>=STARTER_LEVELS;
}
export function effectiveCosts(
 id:string,level:number,levels:Partial<Record<string,number>>,legacy:readonly ResearchProject[]
):ResourceCosts{
 const base=researchCosts(id,level,legacy);
 const factor=id==='efficiency'?1:1-Math.min(.25,(levels.efficiency??0)*.05);
 return Object.fromEntries(Object.entries(base).map(([key,value])=>[key,Math.max(1,Math.ceil(value*factor))])) as ResourceCosts;
}

type Candidate={id:string;level:number;key:string;goal:ResourceCosts;given:ResourceCosts;productGoal:ProductBag};
const hasAllStreams=(candidate:Candidate,earned:ResourceBag)=>
 resourceKeys.every(key=>!candidate.goal[key]||earned[key]>0);

/** All eligible nodes compete fairly for each newly earned resource. No user
 * selection, queue, manual contribution, or timer is required. One resource
 * unit can only be delivered to one technology. Previously contributed
 * supplies remain assigned to their node across reloads.
 */
export function advanceAutomaticTree<T extends AutomaticState>(
 state:T,legacy:readonly ResearchProject[],context:OperationalContext
):T{
 const base=normalizeResources(state);
 let changed=base!==state;
 let starterLevel=context.freshStart?Math.max(0,Math.min(STARTER_LEVELS,base.starterLevel??0)):STARTER_LEVELS;
 let levels={...base.levels};
 let collector=base.collector;
 const projectById=new Map(allResearch(legacy).map(p=>[p.id,p]));
 let resources=safeBag(base.resources);
 const earned=safeBag(base.earned);
 const contributions:Record<string,ResourceCosts>={...(base.contributions??{})};
 const resourceCursor:Partial<Record<ResourceKey,number>>={...(base.resourceCursor??{})};
 let production:ProductionLedger={
  productInventory:base.productInventory,productProduced:base.productProduced,
  productConsumed:base.productConsumed,productContributions:base.productContributions,
  productRawSpent:base.productRawSpent,productCursor:base.productCursor
 };
 if(base.automaticVersion!==1||base.selected||base.queue?.length||base.starterLevel!==starterLevel)changed=true;
 // Existing companies never have to re-earn access to equipment or services.
 if(context.freshStart){
  while(starterLevel<STARTER_LEVELS){
   const stage=STARTER_STAGES[starterLevel];
   if(earned.passengers<stage.jobs||Math.max(context.roads,earned.roads)<stage.roads)break;
   starterLevel++;changed=true;
  }
 }
 // Starter milestones must happen before the other divisions can start.
 if(starterLevel<STARTER_LEVELS){
  return changed?{...base,levels,starterLevel,automaticVersion:1,
   selected:undefined,queue:[],resources,contributions,resourceCursor,...production,productVersion:1}:base;
 }
 const all=allResearch(legacy);
 // Each completion can open another level or a cross-branch dependency. A
 // bounded chain prevents pathological loops while allowing big saved balances.
 for(let wave=0;wave<220;wave++){
  const candidates:Candidate[]=[];
  for(const project of all){
   const current=levels[project.id]??0;
   const max=project.id==='explorerExpansion'||!legacy.some(p=>p.id===project.id)?1:5;
   if(current>=max)continue;
   // A previously paid, timed project is allowed to settle on its old clock.
   if(base.active?.id===project.id)continue;
   const level=current+1;
   if(technologyLevelRequirements(project.id,level,levels,{...context,starterLevel}).length)continue;
   const key=researchNodeId(project.id,level);
   candidates.push({id:project.id,level,key,
    goal:effectiveCosts(project.id,level,levels,legacy),given:{...(contributions[key]??{})},productGoal:productRequirements(project.id,level,legacy)});
  }
  if(!candidates.length)break;
  const participating=candidates.filter(candidate=>hasAllStreams(candidate,earned));
  let deliveredThisWave=false;
  // Materialise nested research recipes only for eligible projects and only
  // when all recipe inputs can be fulfilled in one atomic transaction.
  const manufactured=allocateResearchProducts(participating.map(candidate=>({
   key:candidate.key,goal:candidate.productGoal
  })),levels,resources,production);
  if(manufactured.changed){
   resources=manufactured.resources;production=manufactured.ledger;
   changed=true;deliveredThisWave=true;
  }
  // Every key uses an independent rotating cursor; selection order cannot
  // permanently starve a sibling branch.
  for(const resource of resourceKeys){
   const eligible=participating.filter(candidate=>
    (candidate.goal[resource]??0)>(candidate.given[resource]??0));
   if(!eligible.length||resources[resource]<=0)continue;
   const count=eligible.length;
   const start=(resourceCursor[resource]??0)%count;
   const rotated=eligible.slice(start).concat(eligible.slice(0,start));
   // Fill eligible nodes in fair rounds. A first pass may leave inventory
   // behind because one project needs less than its allotment. Reallocate
   // that remainder immediately, so running the same snapshot twice is
   // idempotent and no resources are minted, duplicated or stranded.
   let remaining=resources[resource];
   while(remaining>0){
    const waiting=rotated.filter(candidate=>
     (candidate.goal[resource]??0)>(candidate.given[resource]??0));
    if(!waiting.length)break;
    const share=Math.max(1,Math.floor(remaining/waiting.length));
    let distributed=0;
    for(const candidate of waiting){
     if(!remaining)break;
     const need=Math.max(0,(candidate.goal[resource]??0)-(candidate.given[resource]??0));
     const amount=Math.min(need,share,remaining);
     if(amount<=0)continue;
     candidate.given[resource]=(candidate.given[resource]??0)+amount;
     contributions[candidate.key]=candidate.given;
     resources[resource]-=amount;
     remaining-=amount;
     distributed+=amount;
     deliveredThisWave=true;changed=true;
    }
    if(distributed<=0)break;
   }
   if(deliveredThisWave)resourceCursor[resource]=(start+1)%count;
  }
  let unlocked=false;
  // Logistics upgrades take precedence among operationally ready nodes, so
  // a single starter collector can unlock a larger fleet without starvation.
  const ordered=[...candidates].sort((a,b)=>Number(b.id.startsWith('collector'))-Number(a.id.startsWith('collector'))||((projectById.get(a.id) as {tier?:number})?.tier??a.level)-((projectById.get(b.id) as {tier?:number})?.tier??b.level));
  for(const candidate of ordered){
   if(resourceKeys.every(resource=>
    (candidate.given[resource]??0)+1e-8>=(candidate.goal[resource]??0))&&
    PRODUCT_KEYS.every(product=>
     (production.productContributions?.[candidate.key]?.[product]??0)>=
     (candidate.productGoal[product]??0))){
    if(collector){
     const project=projectById.get(candidate.id)!;
     const costs=collectorResearchCosts(project,candidate.level);
     const allocated=allocateCollectorResearch(collector,candidate.key,costs);
     if(allocated!==collector){collector=allocated;changed=true;deliveredThisWave=true;}
     const next=finishCollectorResearch(collector,candidate.key,costs);
     if(!next)continue;
     collector=next;
    }
    levels[candidate.id]=candidate.level;
    unlocked=true;changed=true;
   }
  }
  if(!unlocked)break;
  // If a completion opens more research, do another wave using the unused
  // resources. No double spending: previously delivered counters are retained.
  if(!deliveredThisWave&&wave>50)break;
 }
 return changed?{...base,levels,starterLevel,automaticVersion:1,selected:undefined,
  queue:[],resources,contributions,resourceCursor,...production,productVersion:1,collector}:base;
}
