import {
 allResearch,normalizeResources,prerequisites,resourceKeys,researchCosts,safeBag,
 type OperationalContext,type ResearchProject,type ResourceBag,type ResourceCosts,type ResourceKey,type ResourceState
} from './researchProgress';

/** Intro progression uses cumulative settled activity, not spendable inventory.
 * The dealership unlock is Level 4. All milestone thresholds are cumulative.
 */
export const STARTER_STAGES=[
 {level:1,name:'First Customers',jobs:10,revenue:300,unlocks:'Research Level 2'},
 {level:2,name:'Growing Service',jobs:20,revenue:900,unlocks:'Research Level 3'},
 {level:3,name:'Trusted Operator',jobs:30,revenue:1800,unlocks:'Research Level 4'},
 {level:4,name:'Vehicle Dealership',jobs:50,revenue:3500,unlocks:'Dealership and all research divisions'}
] as const;

export const STARTER_LEVELS=STARTER_STAGES.length;
export type AutomaticState=ResourceState&{levels:Partial<Record<string,number>>;active?:{id:string;level:number;startedAt:number;endsAt:number}};

/** Some joined branches require more than the first level of a parent. */
export const PARENT_LEVEL_REQUIREMENTS:Record<string,Readonly<Record<string,number>>>={
 airportMarkets:{premium:2},
 regionalReposition:{fleetAnalytics:2,routing:2},
 safetyCertification:{defensive:2},
 networkLogistics:{depotEfficiency:3},
 customerRetention:{loyalty:2},
 treasuryForecast:{efficiency:2}
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
  missing.push('Starter Level 4 · Vehicle Dealership');
 return missing;
}
export function starterProgress(earned:ResourceCosts,completed:number){
 const next=STARTER_STAGES[Math.max(0,Math.min(3,completed))];
 return {
  completed:Math.min(STARTER_LEVELS,Math.max(0,completed)),
  next:completed>=STARTER_LEVELS?null:next,
  jobs:Math.max(0,earned.passengers??0),revenue:Math.max(0,earned.revenue??0)
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

type Candidate={id:string;level:number;key:string;goal:ResourceCosts;given:ResourceCosts};
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
 let resources=safeBag(base.resources);
 const earned=safeBag(base.earned);
 const contributions:Record<string,ResourceCosts>={...(base.contributions??{})};
 const resourceCursor:Partial<Record<ResourceKey,number>>={...(base.resourceCursor??{})};
 if(base.automaticVersion!==1||base.selected||base.queue?.length||base.starterLevel!==starterLevel)changed=true;
 // Existing companies never have to re-earn access to equipment or services.
 if(context.freshStart){
  while(starterLevel<STARTER_LEVELS){
   const stage=STARTER_STAGES[starterLevel];
   if(earned.passengers<stage.jobs||earned.revenue<stage.revenue)break;
   starterLevel++;changed=true;
  }
 }
 // Starter milestones must happen before the other divisions can start.
 if(starterLevel<STARTER_LEVELS){
  return changed?{...base,levels,starterLevel,automaticVersion:1,
   selected:undefined,queue:[],resources,contributions,resourceCursor}:base;
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
    goal:effectiveCosts(project.id,level,levels,legacy),given:{...(contributions[key]??{})}});
  }
  if(!candidates.length)break;
  const participating=candidates.filter(candidate=>hasAllStreams(candidate,earned));
  let deliveredThisWave=false;
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
  for(const candidate of candidates){
   if(resourceKeys.every(resource=>
    (candidate.given[resource]??0)+1e-8>=(candidate.goal[resource]??0))){
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
  queue:[],resources,contributions,resourceCursor}:base;
}
