import {maximum,technologyParents} from './researchProgress';
import {PARENT_LEVEL_REQUIREMENTS,STARTER_STAGES,researchNodeId} from './researchAutomatic';
import {RESEARCH_LANES} from './researchGraph';

/** Gameplay rules remain in researchAutomatic/researchProgress.
 * This is an authored, readable *presentation* of the same 176 levels.
 * Nodes belonging to one technology are kept together; other branches split
 * near their actual parent rather than being distributed into wide rows.
 */
export const RESEARCH_TILE_SIZE=46;
export type HierarchyNode={
 id:string;projectId:string;level:number;category:number;
 kind:'starter'|'research';rank:number;x:number;y:number;
};
export type HierarchyEdge={from:string;to:string;path:string;kind:'starter'|'prerequisite'|'level';visible:boolean};
export type HierarchyJunction={id:string;x:number;y:number;inputs:number};
export type ResearchHierarchy={
 width:number;height:number;nodes:HierarchyNode[];edges:HierarchyEdge[];
 junctions:HierarchyJunction[];byId:Map<string,HierarchyNode>;initialId:string;
};
export const INDEPENDENT_RESEARCH_ROOTS=['pricing','procurement'] as const;
const INDEPENDENT_ROOTS=new Set<string>(INDEPENDENT_RESEARCH_ROOTS);
const COLUMN=72,ROW=70,TOP=78,PADDING=130;
const MAX_COLUMN=11;
const INITIAL_RANK=STARTER_STAGES.length;
/** Each visible connection is to ONE primary ancestor. A badge and the
 * details drawer disclose *all* prerequisites, never hidden from gameplay.
 */
const MAIN_PATH:Readonly<Record<string,string>>={
 airportMarkets:'demandIntelligence',regionalReposition:'routing',
 profitAwareFleet:'multiDepotDispatch',vehicleLifecycle:'conditionPrediction',
 coordinatedFrontiers:'navigation',safetyCertification:'advancedScheduling',
 networkLogistics:'preventiveCalendar',customerRetention:'regionalReputation',
 treasuryForecast:'creditRiskModels',tourismNetwork:'tourismPartnerships'
};
const ROOT_COLUMNS:Readonly<Record<string,number>>={
 pricing:-6,fleetAnalytics:-3,depotEfficiency:0,survey:3,procurement:6
};
const ROOT_SEQUENCE=['pricing','fleetAnalytics','depotEfficiency','survey','procurement'];
const BRANCH_SEQUENCE:Readonly<Record<string,readonly string[]>>={
 pricing:['peakPricing','demandIntelligence','advertising'],
 fleetAnalytics:['dispatchResearch','trainingResearch'],
 depotEfficiency:['workshopResearch','engine','parkingYield','modularBuilding'],
 survey:['navigation','portAnalytics'],
 procurement:['insuranceResearch','efficiency','creditRiskModels','corporateDueDiligence'],
 engine:['fuelInjection','durability','lightweight','powertrainAdaptation'],
 navigation:['patrol','explorerExpansion','coordinatedFrontiers'],
 trainingResearch:['ecoDriving','defensive','driverSpecialisation'],
 advertising:['brand','regionalReputation','occupancyForecast'],
 regionalReposition:['multiDepotDispatch','advancedScheduling']
};
type Technology={
 id:string;category:number;levels:number;index:number;
 parents:{id:string;level:number}[];primary:string|undefined;
};
function lateralOffset(index:number,count:number):number{
 if(count<=1)return 0;
 return index*2-(count-1);
}
function mapPath(from:HierarchyNode,to:HierarchyNode):string{
 const startX=from.x+RESEARCH_TILE_SIZE/2,startY=from.y+RESEARCH_TILE_SIZE;
 const endX=to.x+RESEARCH_TILE_SIZE/2,endY=to.y;
 if(Math.abs(startX-endX)<1)return `M ${startX} ${startY} V ${endY}`;
 // Bus travels just below the branch point. The short horizontal fan avoids
 // long lines through the other levels of that research family.
 const busY=Math.min(endY-8,startY+13);
 return `M ${startX} ${startY} V ${busY} H ${endX} V ${endY}`;
}

/** "Builderment-style" deliberate branch composition, not a horizontal
 * spreadsheet of levels: a single four-step starter stem, five compact
 * foundations, local forks, standalone paths and small multi-input markers.
 * Crowded lanes are moved DOWN, never shoved across the canvas.
 */
export function buildResearchHierarchy(ids:readonly string[]):ResearchHierarchy{
 const known=new Set(ids);
 const categories=new Map<string,number>();
 const order=new Map<string,number>();
 RESEARCH_LANES.forEach((group,category)=>group.forEach(id=>{
  categories.set(id,category);order.set(id,order.size);
 }));
 const definitions=new Map<string,Technology>();
 for(const id of ids){
  const parents=technologyParents(id).map(parent=>({
   id:parent,level:PARENT_LEVEL_REQUIREMENTS[id]?.[parent]??1
  }));
  for(const parent of parents)if(!known.has(parent.id))
   throw Error('Missing technology prerequisite: '+id+' -> '+parent.id);
  const preferred=MAIN_PATH[id];
  const primary=parents.find(parent=>parent.id===preferred)?.id??parents[0]?.id;
  definitions.set(id,{
   id,category:categories.get(id)??11,levels:maximum(id),
   index:order.get(id)??999,parents,primary
  });
 }
 const children=new Map<string,string[]>();
 for(const def of definitions.values()){
  if(!def.primary)continue;
  const group=children.get(def.primary)??[];
  group.push(def.id);children.set(def.primary,group);
 }
 for(const [parent,group] of children){
  const sequence=BRANCH_SEQUENCE[parent]??[];
  group.sort((a,b)=>{
   const ai=sequence.indexOf(a),bi=sequence.indexOf(b);
   return (ai<0?100+(order.get(a)??999):ai)-
    (bi<0?100+(order.get(b)??999):bi);
  });
 }
 // Prerequisites are computed using their real required level. The manual
 // root spacing and branch order guide placement without changing tech rules.
 const depthCache=new Map<string,number>(),visiting=new Set<string>();
 const nominalDepth=(id:string):number=>{
  if(depthCache.has(id))return depthCache.get(id)!;
  if(visiting.has(id))throw Error('Cyclic research prerequisites '+id);
  visiting.add(id);
  const def=definitions.get(id);
  if(!def)throw Error('Unknown research '+id);
  const depth=def.parents.length?Math.max(...def.parents.map(parent=>
   nominalDepth(parent.id)+parent.level)):INITIAL_RANK;
  visiting.delete(id);depthCache.set(id,depth);return depth;
 };
 ids.forEach(nominalDepth);
 const scheduled=[...definitions.values()].sort((a,b)=>
  nominalDepth(a.id)-nominalDepth(b.id)||
  (ROOT_SEQUENCE.indexOf(a.id)<0?99:ROOT_SEQUENCE.indexOf(a.id))-
  (ROOT_SEQUENCE.indexOf(b.id)<0?99:ROOT_SEQUENCE.indexOf(b.id))||
  a.index-b.index
 );
 const coords=new Map<string,{column:number;rank:number}>();
 const occupied=new Set<string>();
 for(const def of scheduled){
  if(def.parents.some(parent=>!coords.has(parent.id)))
   throw Error('Unscheduled visual prerequisite for '+def.id);
  let wanted=ROOT_COLUMNS[def.id]??0;
  let earliest:number=INITIAL_RANK;
  if(def.parents.length){
   earliest=Math.max(...def.parents.map(parent=>
    coords.get(parent.id)!.rank+parent.level));
   const primary=coords.get(def.primary!)!;
   const siblings=children.get(def.primary!)??[def.id];
   const siblingIndex=siblings.indexOf(def.id);
   const delta=lateralOffset(siblingIndex,siblings.length);
   wanted=primary.column+delta;
   // A child of a five-level technology belongs on a nearby *side*
   // instead of drawing a confusing line through its parent's own levels.
   if(siblings.length===1&&def.primary){
    wanted+=((categories.get(def.id)??0)%2===0?-1:1);
   }
   // Offset sibling forks by 0–2 rows to create the curved, compact
   // branch hierarchy in the reference rather than a single long row.
   earliest+=siblings.length>1?siblingIndex%3:0;
  }
  if(!def.parents.length){
   const col=ROOT_COLUMNS[def.id];
   if(col===undefined)throw Error('Unmapped research foundation '+def.id);
   wanted=col;
  }
  let choice:{column:number;rank:number;score:number}|undefined;
  const cx=Math.max(-MAX_COLUMN,Math.min(MAX_COLUMN,Math.round(wanted)));
  for(let delay=0;delay<=96;delay++){
   for(let spread=0;spread<=7;spread++){
    for(const candidate of spread===0?[cx]:[cx-spread,cx+spread]){
     if(candidate < -MAX_COLUMN||candidate>MAX_COLUMN)continue;
     const rank=earliest+delay;
     let available=true;
     for(let level=0;level<def.levels;level++)
      if(occupied.has(candidate+':'+(rank+level))){available=false;break;}
     if(!available)continue;
     const parentDistance=def.primary?Math.abs(candidate-coords.get(def.primary)!.column):0;
     const score=delay*7+Math.abs(candidate-wanted)*11+parentDistance*3;
     if(!choice||score<choice.score)
      choice={column:candidate,rank,score};
    }
   }
   // Once a nearby place exists, delaying more than five additional
   // rows can never be preferable. Keep forks visually local.
   if(choice&&delay>5)break;
  }
  if(!choice)throw Error('Research hierarchy failed to place '+def.id);
  coords.set(def.id,{column:choice.column,rank:choice.rank});
  for(let i=0;i<def.levels;i++)occupied.add(choice.column+':'+(choice.rank+i));
 }
 const minCol=Math.min(0,...[...coords.values()].map(p=>p.column));
 const maxCol=Math.max(0,...[...coords.values()].map(p=>p.column));
 const shift=PADDING-minCol*COLUMN;
 const width=(maxCol-minCol)*COLUMN+RESEARCH_TILE_SIZE+PADDING*2;
 const maxRank=Math.max(INITIAL_RANK-1,...[...coords].map(([id,p])=>
  p.rank+definitions.get(id)!.levels-1));
 const height=TOP+(maxRank+1)*ROW+80;
 const nodes:HierarchyNode[]=[];
 const byId=new Map<string,HierarchyNode>();
 const push=(node:HierarchyNode)=>{nodes.push(node);byId.set(node.id,node);};
 for(const stage of STARTER_STAGES)push({
  id:'starter:'+stage.level,projectId:'starter',level:stage.level,
  category:-1,kind:'starter',rank:stage.level-1,
  x:shift,y:TOP+(stage.level-1)*ROW
 });
 for(const def of scheduled){
  const pos=coords.get(def.id)!;
  for(let level=1;level<=def.levels;level++)push({
   id:researchNodeId(def.id,level),projectId:def.id,level,
   category:def.category,kind:'research',
   rank:pos.rank+level-1,x:shift+pos.column*COLUMN,
   y:TOP+(pos.rank+level-1)*ROW
  });
 }
 const edges:HierarchyEdge[]=[],junctions:HierarchyJunction[]=[];
 const link=(fromId:string,toId:string,kind:HierarchyEdge['kind'],visible=true)=>{
  const from=byId.get(fromId),to=byId.get(toId);
  if(!from||!to)throw Error('Unresolved research node '+fromId+' -> '+toId);
  edges.push({from:fromId,to:toId,kind,visible,path:mapPath(from,to)});
 };
 for(let i=2;i<=STARTER_STAGES.length;i++)
  link('starter:'+(i-1),'starter:'+i,'starter');
 for(const def of scheduled){
  const target=researchNodeId(def.id,1);
  for(const parent of def.parents)
   link(researchNodeId(parent.id,parent.level),target,'prerequisite',parent.id===def.primary);
  if(!def.parents.length&&!INDEPENDENT_ROOTS.has(def.id))
   link('starter:4',target,'starter');
  for(let level=2;level<=def.levels;level++)
   link(researchNodeId(def.id,level-1),researchNodeId(def.id,level),'level');
  if(def.parents.length>1){
   const node=byId.get(target)!;
   junctions.push({id:target,x:node.x+RESEARCH_TILE_SIZE/2,y:node.y-11,inputs:def.parents.length});
  }
 }
 return {width,height,nodes,edges,junctions,byId,initialId:'starter:1'};
}
