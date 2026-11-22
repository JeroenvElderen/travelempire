import {maximum,technologyParents} from './researchProgress';
import {PARENT_LEVEL_REQUIREMENTS,STARTER_STAGES,researchNodeId} from './researchAutomatic';
import {RESEARCH_LANES,RESEARCH_NODE_SIZE} from './researchGraph';

export type HierarchyNode={
 id:string;projectId:string;level:number;category:number;
 kind:'starter'|'research';rank:number;x:number;y:number;
};
export type HierarchyEdge={from:string;to:string;path:string;kind:'starter'|'prerequisite'|'level'};
export type ResearchHierarchy={
 width:number;height:number;nodes:HierarchyNode[];edges:HierarchyEdge[];
 byId:Map<string,HierarchyNode>;initialId:string;
};
const NODE=RESEARCH_NODE_SIZE;
const H_GAP=91;
const V_GAP=96;
const MARGIN=138;
const TOP=105;

/**
 * Lay out the actual prerequisite DAG by depth, not category columns.
 * A technology's five levels are sequential nodes; a cross-branch unlock has
 * lines from every required parent level. All edges travel downward.
 * Layout and ordering are deterministic and independent of research progress.
 */
export function buildResearchHierarchy(ids:readonly string[]):ResearchHierarchy{
 const known=new Set(ids);
 const categories=new Map<string,number>();
 const projectOrder=new Map<string,number>();
 RESEARCH_LANES.forEach((group,index)=>group.forEach((id,offset)=>{
  categories.set(id,index);projectOrder.set(id,offset);
 }));
 const definitions=new Map<string,{id:string;projectId:string;level:number;category:number;
  kind:'starter'|'research';parents:string[]}>();
 for(const stage of STARTER_STAGES){
  const id='starter:'+stage.level;
  definitions.set(id,{id,projectId:'starter',level:stage.level,category:-1,kind:'starter',
   parents:stage.level>1?['starter:'+(stage.level-1)]:[]});
 }
 for(const projectId of ids){
  for(let level=1;level<=maximum(projectId);level++){
   const id=researchNodeId(projectId,level);
   const parents=level>1?[researchNodeId(projectId,level-1)]:
    technologyParents(projectId).length?
     technologyParents(projectId).map(parent=>
      researchNodeId(parent,PARENT_LEVEL_REQUIREMENTS[projectId]?.[parent]??1)):
     ['starter:4'];
   definitions.set(id,{id,projectId,level,category:categories.get(projectId)??11,
    kind:'research',parents});
  }
 }
 const rankCache=new Map<string,number>();
 const visiting=new Set<string>();
 const rankOf=(id:string):number=>{
  if(rankCache.has(id))return rankCache.get(id)!;
  if(visiting.has(id))throw new Error('Cyclic technology prerequisites: '+id);
  const def=definitions.get(id);
  if(!def)throw new Error('Missing technology prerequisite: '+id);
  visiting.add(id);
  const rank=def.parents.length?
   Math.max(...def.parents.map(parent=>rankOf(parent)+1)):0;
  visiting.delete(id);rankCache.set(id,rank);return rank;
 };
 for(const id of definitions.keys())rankOf(id);
 const maxRank=Math.max(...rankCache.values());
 const layers:Array<typeof definitions extends Map<string,infer T>?T[]:never> =
  Array.from({length:maxRank+1},()=>[]);
 for(const def of definitions.values())layers[rankOf(def.id)].push(def);
 // Keep related subtrees near each other; the layout is still decided by
 // dependency ranks, not artificially vertical divisions.
 const categoryOrder=[0,2,4,6,1,5,3,7,8,9,10,11];
 const position=(category:number)=>categoryOrder.indexOf(category);
 const sort=(a:typeof layers[number][number],b:typeof layers[number][number])=>{
  if(a.kind==='starter'||b.kind==='starter')return 0;
  return position(a.category)-position(b.category)||
   (projectOrder.get(a.projectId)??0)-(projectOrder.get(b.projectId)??0)||
   a.level-b.level;
 };
 for(const layer of layers)layer.sort(sort);
 const widest=Math.max(...layers.map(l=>l.length));
 const width=Math.max(1020,widest*H_GAP+MARGIN*2);
 const height=(maxRank+1)*V_GAP+TOP+80;
 const nodes:HierarchyNode[]=[];
 const byId=new Map<string,HierarchyNode>();
 for(let layerIndex=0;layerIndex<layers.length;layerIndex++){
  const layer=layers[layerIndex];
  const span=(layer.length-1)*H_GAP;
  const initial=(width-span)/2-NODE/2;
  for(let i=0;i<layer.length;i++){
   const def=layer[i];
   const node={id:def.id,projectId:def.projectId,level:def.level,category:def.category,
    kind:def.kind,rank:layerIndex,x:initial+i*H_GAP,y:TOP+layerIndex*V_GAP};
   nodes.push(node);byId.set(node.id,node);
  }
 }
 const edges:HierarchyEdge[]=[];
 for(const def of definitions.values()){
  const child=byId.get(def.id)!;
  for(const parentId of def.parents){
   const parent=byId.get(parentId)!;
   const sx=parent.x+NODE/2,sy=parent.y+NODE;
   const ex=child.x+NODE/2,ey=child.y;
   const centerY=sy+Math.min(29,Math.max(12,(ey-sy)/2));
   let path:string;
   if(Math.abs(sx-ex)<1)path='M '+sx+' '+sy+' V '+ey;
   else{
    const sign=ex>sx?1:-1;
    const radius=6;
    path='M '+sx+' '+sy+' V '+(centerY-radius)+
     ' Q '+sx+' '+centerY+' '+(sx+sign*radius)+' '+centerY+
     ' H '+(ex-sign*radius)+' Q '+ex+' '+centerY+' '+ex+' '+(centerY+radius)+
     ' V '+ey;
   }
   edges.push({from:parentId,to:def.id,path,
    kind:child.kind==='starter'||parent.kind==='starter'?'starter':
     def.level>1?'level':'prerequisite'});
  }
 }
 return {width,height,nodes,edges,byId,initialId:'starter:1'};
}
