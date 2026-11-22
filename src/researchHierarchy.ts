import {maximum,newProjects,technologyParents} from './researchProgress';
import {PARENT_LEVEL_REQUIREMENTS,STARTER_STAGES,researchNodeId} from './researchAutomatic';
import {RESEARCH_LANES,RESEARCH_NODE_SIZE} from './researchGraph';

export type HierarchyNode={
 id:string;projectId:string;level:number;category:number;
 kind:'starter'|'research';rank:number;x:number;y:number;
};
export type HierarchyEdge={from:string;to:string;path:string;kind:'starter'|'prerequisite'|'level';visible:boolean};
export type HierarchyJunction={id:string;x:number;y:number;inputs:number};
export type ResearchHierarchy={
 width:number;height:number;nodes:HierarchyNode[];edges:HierarchyEdge[];
 junctions:HierarchyJunction[];
 byId:Map<string,HierarchyNode>;initialId:string;
};

/** These two research families begin independently after Starter Level 4.
 * The gameplay unlock still requires Starter Level 4, but there is no
 * arbitrary line tying their technology paths to the central trunk.
 */
export const INDEPENDENT_RESEARCH_ROOTS=['pricing','procurement'] as const;
const independentRoots=new Set<string>(INDEPENDENT_RESEARCH_ROOTS);

const NODE=RESEARCH_NODE_SIZE;
const COLUMN=92;
const ROW=95;
const TOP=75;
const PADDING=145;
const STARTER_RANK=STARTER_STAGES.length;
const ROOT_COLUMNS:Readonly<Record<string,number>>={
 pricing:-5,fleetAnalytics:-2,depotEfficiency:0,survey:2,procurement:5
};
const ROOT_ORDER=['pricing','fleetAnalytics','depotEfficiency','survey','procurement'] as const;
/** Choose the one drawn branch for each technology. All other prerequisite
 * relationships are still enforced by the research engine and shown on tap.
 * One visual parent keeps the map legible without altering gameplay rules.
 */
const DRAWN_PARENT:Readonly<Record<string,string>>={
 airportMarkets:'demandIntelligence',
 regionalReposition:'routing',
 profitAwareFleet:'multiDepotDispatch',
 vehicleLifecycle:'conditionPrediction',
 coordinatedFrontiers:'navigation',
 safetyCertification:'advancedScheduling',
 networkLogistics:'preventiveCalendar',
 customerRetention:'regionalReputation',
 treasuryForecast:'creditRiskModels'
};
const visibleParent=(def:TechnologyDefinition):string|undefined=>{
 const preferred=DRAWN_PARENT[def.id];
 if(preferred&&def.parents.some(parent=>parent.id===preferred))return preferred;
 return def.parents[0]?.id;
};
const childOrder:Readonly<Record<string,readonly string[]>>={
 pricing:['peakPricing','demandIntelligence','advertising'],
 fleetAnalytics:['dispatchResearch','trainingResearch'],
 depotEfficiency:['workshopResearch','engine','parkingYield','modularBuilding'],
 survey:['navigation','portAnalytics'],
 procurement:['insuranceResearch','efficiency','creditRiskModels','corporateDueDiligence'],
 navigation:['patrol','explorerExpansion','coordinatedFrontiers'],
 engine:['fuelInjection','durability','lightweight','powertrainAdaptation'],
 advertising:['brand','regionalReputation','occupancyForecast'],
 regionalReposition:['multiDepotDispatch','advancedScheduling']
};
const orderedChild=(parent:string,id:string,defaultOrder:number)=>{
 const branch=childOrder[parent];const index=branch?.indexOf(id)??-1;
 return index<0?100+defaultOrder:index;
};

type TechnologyDefinition={
 id:string;category:number;cap:number;rank:number;parents:{id:string;level:number}[];order:number;
};

/** Design a top-down, branching technology map with deliberately separate
 * families and multi-parent joins. Project levels stay in the same vertical
 * lane; children can fork to either side. The lanes are *not* category
 * columns, and the tree need not be one connected component.
 *
 * Coordinates are generated from real research prerequisites so the drawing
 * cannot claim to have an unlock that the simulation doesn't enforce.
 */
export function buildResearchHierarchy(ids:readonly string[]):ResearchHierarchy{
 const categories=new Map<string,number>(),ordering=new Map<string,number>();
 let total=0;
 RESEARCH_LANES.forEach((list,category)=>list.forEach(id=>{
  categories.set(id,category);ordering.set(id,total++);
 }));
 const available=new Set(ids);
 const definitions=new Map<string,TechnologyDefinition>();
 const ranking=new Set<string>();
 const rankOf=(id:string):number=>{
  const existing=definitions.get(id);
  if(existing)return existing.rank;
  if(ranking.has(id))throw Error('Cyclic technology prerequisite: '+id);
  if(!available.has(id))throw Error('Missing research technology: '+id);
  ranking.add(id);
  const parents=technologyParents(id).map(parent=>({
   id:parent,level:PARENT_LEVEL_REQUIREMENTS[id]?.[parent]??1
  }));
  const next=newProjects.find(p=>p.id===id);
  const baseRank=parents.length
   ?Math.max(...parents.map(parent=>rankOf(parent.id)+parent.level-1))+1
   :STARTER_RANK;
  // New late-game technologies open progressively deeper in the graph,
  // instead of producing another perfectly horizontal row of tiles.
  const stagger=parents.length?(next?(next.tier>=3?2:1):1):0;
  const def:TechnologyDefinition={
   id,category:categories.get(id)??11,cap:maximum(id),
   rank:baseRank+stagger,parents,order:ordering.get(id)??999
  };
  definitions.set(id,def);
  ranking.delete(id);
  return def.rank;
 };
 ids.forEach(rankOf);

 const all=[...definitions.values()].sort((a,b)=>
  a.rank-b.rank||
  (ROOT_ORDER.indexOf(a.id as typeof ROOT_ORDER[number])>=0
   ?ROOT_ORDER.indexOf(a.id as typeof ROOT_ORDER[number]):99)-
  (ROOT_ORDER.indexOf(b.id as typeof ROOT_ORDER[number])>=0
   ?ROOT_ORDER.indexOf(b.id as typeof ROOT_ORDER[number]):99)||
  a.order-b.order);

 const children=new Map<string,string[]>();
 for(const def of all){
  const primary=visibleParent(def);
  if(!primary)continue;
  const list=children.get(primary)??[];
  list.push(def.id);
  children.set(primary,list);
 }
 for(const [parent,list] of children.entries())list.sort((a,b)=>
  orderedChild(parent,a,ordering.get(a)??999)-
  orderedChild(parent,b,ordering.get(b)??999));
 const columns=new Map<string,number>();
 const occupied=new Map<number,Set<number>>();
 for(const def of all){
  let preferred:number;
  if(!def.parents.length){
   preferred=ROOT_COLUMNS[def.id]??0;
  }else{
   // Group each fork physically around its one *displayed* parent. Averaging
   // across every dependency caused the cross-screen horizontal wires in the
   // previous version; those other requirements remain enforced off-canvas.
   const primary=visibleParent(def);
   const parentColumn=primary===undefined?undefined:columns.get(primary);
   if(parentColumn===undefined)throw Error('Unplaced visual prerequisite for '+def.id);
   preferred=parentColumn;
   const siblings=children.get(primary!)??[];
   const slot=siblings.indexOf(def.id);
   if(siblings.length>1){
    // A branch takes a short step left or right at the split, rather than
    // jumping to the middle of distant prerequisite columns.
    preferred+=(slot-(siblings.length-1)/2)*1.85;
   }
  }
  const ideal=Math.round(preferred);
  let assigned:number|undefined;
  // A technology reserves the full five-level vertical strip. Collisions
  // are therefore prevented even if multiple branches start on one row.
  for(let radius=0;radius<=75;radius++){
   const options=radius===0?[ideal]:[ideal-radius,ideal+radius];
   const vacant=options.filter(column=>
    Array.from({length:def.cap},(_,i)=>def.rank+i)
     .every(rank=>!occupied.get(rank)?.has(column)));
   if(vacant.length){
    assigned=vacant.sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)||
     Math.abs(a)-Math.abs(b))[0];
    break;
   }
  }
  if(assigned===undefined)throw Error('Research layout could not position '+def.id);
  columns.set(def.id,assigned);
  for(let offset=0;offset<def.cap;offset++){
   const rank=def.rank+offset;
   const row=occupied.get(rank)??new Set<number>();
   row.add(assigned);occupied.set(rank,row);
  }
 }

 const cols=[0,...columns.values()];
 const minColumn=Math.min(...cols),maxColumn=Math.max(...cols);
 const left=PADDING-minColumn*COLUMN;
 const width=(maxColumn-minColumn)*COLUMN+NODE+PADDING*2;
 const bottom=Math.max(STARTER_RANK-1,...all.map(p=>p.rank+p.cap-1));
 const height=TOP+(bottom+1)*ROW+125;
 const byId=new Map<string,HierarchyNode>();
 const nodes:HierarchyNode[]=[];
 const insert=(node:HierarchyNode)=>{nodes.push(node);byId.set(node.id,node)};
 for(const stage of STARTER_STAGES){
  insert({id:'starter:'+stage.level,projectId:'starter',level:stage.level,
   category:-1,kind:'starter',rank:stage.level-1,
   x:left,y:TOP+(stage.level-1)*ROW});
 }
 for(const def of all){
  const x=left+(columns.get(def.id)??0)*COLUMN;
  for(let level=1;level<=def.cap;level++){
   insert({id:researchNodeId(def.id,level),projectId:def.id,level,
    category:def.category,kind:'research',rank:def.rank+level-1,
    x,y:TOP+(def.rank+level-1)*ROW});
  }
 }
 const edges:HierarchyEdge[]=[],junctions:HierarchyJunction[]=[];
 const connect=(fromId:string,toId:string,kind:HierarchyEdge['kind'],visible=true)=>{
  const from=byId.get(fromId),to=byId.get(toId);
  if(!from||!to)throw Error('Unresolved research connection '+fromId+' > '+toId);
  const x1=from.x+NODE/2,y1=from.y+NODE;
  const x2=to.x+NODE/2,y2=to.y;
  // Fork just below the parent tile, before its Level 2 appears. Routing
  // across at the child's row used to draw straight through Levels 2–5,
  // creating visual clutter and seemingly unrelated connections.
  const forkY=y1+Math.max(10,Math.min(17,(y2-y1)*.30));
  const path=Math.abs(x1-x2)<1?
   `M ${x1} ${y1} V ${y2}`:
   `M ${x1} ${y1} V ${forkY} H ${x2} V ${y2}`;
  edges.push({from:fromId,to:toId,path,kind,visible});
 };
 for(let level=2;level<=STARTER_STAGES.length;level++){
  connect('starter:'+(level-1),'starter:'+level,'starter');
 }
 for(const def of all){
  const first=researchNodeId(def.id,1);
  if(def.parents.length){
   const drawn=visibleParent(def);
   for(const parent of def.parents)
    connect(researchNodeId(parent.id,parent.level),first,'prerequisite',parent.id===drawn);
   if(def.parents.length>=2){
    const to=byId.get(first)!;
    junctions.push({id:first,x:to.x+NODE/2,y:to.y-20,inputs:def.parents.length});
   }
  }else if(!independentRoots.has(def.id)){
   connect('starter:4',first,'starter');
  }
  for(let level=2;level<=def.cap;level++)
   connect(researchNodeId(def.id,level-1),researchNodeId(def.id,level),'level');
 }
 return {width,height,nodes,edges,junctions,byId,initialId:'starter:1'};
}
