import {COLLECTOR_PARTS,type CollectorPart,type CollectorState,type CollectorStock} from './resourceCollectors';

type Project={id:string;category:number;tier?:number};
/** Each division has a distinct material profile. Basic technologies require
 * two types; higher tiers add research, energy, electronics and rare parts. */
const profiles:readonly (readonly [CollectorPart,CollectorPart,CollectorPart])[]=[
 ['business','research','electronics'], // passenger markets
 ['mechanical','energy','electronics'], // vehicle engineering
 ['electronics','business','research'], // dispatch
 ['research','electronics','energy'], // exploration
 ['business','research','mechanical'], // drivers
 ['mechanical','construction','energy'], // facilities
 ['business','electronics','research'], // marketing
 ['business','research','electronics'], // finance
 ['marine','mechanical','energy'], // maritime
 ['business','construction','energy'], // hotels
 ['construction','mechanical','energy'], // building
 ['business','research','electronics'], // corporate
];
const collectorProfiles:Record<string,readonly [CollectorPart,CollectorPart,CollectorPart]>={
 collectorBasics:['mechanical','business','electronics'],
 collectorMedium:['mechanical','construction','energy'],
 collectorHeavy:['mechanical','construction','energy'],
 collectorUtility:['mechanical','energy','construction'],
 collectorCargo:['construction','mechanical','business'],
 collectorLoading:['mechanical','electronics','energy'],
 collectorPriority:['business','electronics','research'],
 collectorRouting:['electronics','research','energy'],
 collectorDispatch:['electronics','business','research'],
 collectorRegional:['construction','business','electronics'],
 collectorIndustrial:['mechanical','construction','energy'],
 collectorNational:['electronics','construction','business'],
};
export function collectorResearchCosts(project:Project,level:number):CollectorStock{
 const stage=Math.max(1,Math.min(5,project.tier??level));
 const [primary,secondary,third]=collectorProfiles[project.id]??profiles[project.category]??profiles[3];
 const result:CollectorStock={};
 const add=(part:CollectorPart,units:number)=>{result[part]=(result[part]??0)+units;};
 const i=stage-1;
 add(primary,[10,25,50,100,200][i]);
 add(secondary,[5,10,25,50,100][i]);
 add(third,[5,15,30,75,150][i]);
 add('research',[5,10,25,50,100][i]);
 if(stage>=3)add('rare',[0,0,5,15,40][i]);
 return result;
}
export function consumeCollectorResearch(state:CollectorState,costs:CollectorStock):CollectorState|null{
 if(COLLECTOR_PARTS.some(part=>(state.stock[part]??0)<(costs[part]??0)))return null;
 const stock={...state.stock},researchSpent={...state.researchSpent};
 for(const part of COLLECTOR_PARTS){
  const quantity=costs[part]??0;if(!quantity)continue;
  stock[part]=(stock[part]??0)-quantity;
  researchSpent[part]=(researchSpent[part]??0)+quantity;
 }
 return {...state,stock,researchSpent};
}

/** Assign physical stock to a research node without requiring the whole recipe
 * to fit into a warehouse at once. Allocations survive saves and are no
 * longer tradable. Completion records lifetime consumption exactly once. */
export function allocateCollectorResearch(state:CollectorState,key:string,costs:CollectorStock):CollectorState{
 const given={...state.researchAllocated?.[key]},stock={...state.stock};let changed=false;
 for(const part of COLLECTOR_PARTS){
  const quantity=Math.min(Math.max(0,(costs[part]??0)-(given[part]??0)),stock[part]??0);
  if(quantity<=0)continue;
  stock[part]=(stock[part]??0)-quantity;given[part]=(given[part]??0)+quantity;changed=true;
 }
 return changed?{...state,stock,researchAllocated:{...state.researchAllocated,[key]:given}}:state;
}
export function finishCollectorResearch(state:CollectorState,key:string,costs:CollectorStock):CollectorState|null{
 const given=state.researchAllocated?.[key]??{};
 if(COLLECTOR_PARTS.some(p=>(given[p]??0)<(costs[p]??0)))return null;
 const researchSpent={...state.researchSpent},researchAllocated={...state.researchAllocated},stock={...state.stock};
 for(const p of COLLECTOR_PARTS){
  const need=costs[p]??0,allocated=given[p]??0;
  if(need)researchSpent[p]=(researchSpent[p]??0)+need;
  if(allocated>need)stock[p]=(stock[p]??0)+allocated-need;
 }
 delete researchAllocated[key];
 return {...state,stock,researchSpent,researchAllocated};
}
