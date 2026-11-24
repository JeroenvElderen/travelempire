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
};
export function collectorResearchCosts(project:Project,level:number):CollectorStock{
 const stage=Math.max(1,Math.min(5,project.tier??level));
 const [primary,secondary,third]=collectorProfiles[project.id]??profiles[project.category]??profiles[3];
 const result:CollectorStock={};
 const add=(part:CollectorPart,units:number)=>{result[part]=(result[part]??0)+units;};
 add(primary,2+stage*2);
 add(secondary,stage);
 if(stage>=2)add(third,stage);
 if(stage>=3)add('research',stage-1);
 if(stage>=4){add('energy',2);add('rare',stage-2);}
 if(stage>=5)add('electronics',3);
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
