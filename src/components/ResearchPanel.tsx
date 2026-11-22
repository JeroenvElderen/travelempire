import {useEffect,useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent,WheelEvent as ReactWheelEvent} from 'react';
import {X,FlaskConical,Coins,LocateFixed,CheckCircle2,LockKeyhole,ChevronDown} from 'lucide-react';
import type {Company} from '../company';
import * as Research from '../research';
import {ADVANCED_CATEGORIES,RESOURCE_INFO,resourceKeys,safeBag,type ResourceKey,type OperationalContext} from '../researchProgress';
import {STARTER_STAGES,STARTER_LEVELS,effectiveCosts,technologyLevelRequirements} from '../researchAutomatic';
import {RESEARCH_GLYPHS,RESEARCH_RESOURCE_GLYPHS,RESEARCH_NODE_SIZE} from '../researchGraph';
import {buildResearchHierarchy,type HierarchyNode} from '../researchHierarchy';
import {BUSINESS_UNLOCKS} from '../researchUnlocks';
import {productRequirements,recipeById,recipeIngredients,PRODUCT_KEYS,recipeAvailable} from '../researchProducts';
import './research-v4.css';

type Props={company:Company|null;state:Research.ResearchState;discoveredRoads:number;
 explorerSpecializations:number;depots:number;gameNow:number;freshStart?:boolean;onClose:()=>void};
type Vector={x:number;y:number};
type Camera={x:number;y:number;scale:number};
type Gesture={tapId:string|null;pointerId:number;down:Vector;moved:boolean;multi:boolean};
type Pinch={distance:number;scale:number;anchor:Vector};
const MIN_SCALE=.27,MAX_SCALE=2.4;
const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n));
const fmt=(n:number)=>Math.floor(Math.max(0,n||0)).toLocaleString('en-IE');
const small=(n:number)=>n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,'')+'m':n>=10000?
 (n/1000).toFixed(1).replace(/\.0$/,'')+'k':fmt(n);
const starterGlyph=['','🚕','📈','🏅','🚘'];

export default function ResearchPanel({state,discoveredRoads,explorerSpecializations,depots,freshStart=false,onClose}:Props){
 const hierarchy=useMemo(()=>buildResearchHierarchy(Research.allProjects.map(p=>p.id)),[]);
 const projects=useMemo(()=>new Map(Research.allProjects.map(p=>[p.id,p])),[]);
 const viewport=useRef<HTMLDivElement>(null);
 const scene=useRef<HTMLDivElement>(null);
 const pointers=useRef(new Map<number,Vector>());
 const camera=useRef<Camera>({x:0,y:0,scale:.7});
 const gesture=useRef<Gesture|null>(null);
 const pinch=useRef<Pinch|null>(null);
 const initialized=useRef(false);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [resourceOpen,setResourceOpen]=useState(false);
 const [zoomLabel,setZoomLabel]=useState('70%');
 const inventory=safeBag(state.resources),earned=safeBag(state.earned);
 const starterLevel=freshStart?state.starterLevel??0:STARTER_LEVELS;
 const context:OperationalContext={roads:discoveredRoads,explorers:explorerSpecializations,depots,
  freshStart,starterLevel};
 const isDone=(node:HierarchyNode)=>node.kind==='starter'?starterLevel>=node.level:
  Research.level(state,node.projectId as Research.ResearchId)>=node.level;
 const blocked=(node:HierarchyNode)=>{
  if(isDone(node))return [];
  if(node.kind==='starter')return node.level>1&&starterLevel<node.level-1?['Starter Level '+(node.level-1)]:[];
  return technologyLevelRequirements(node.projectId,node.level,state.levels,context);
 };
 const costs=(node:HierarchyNode)=>node.kind==='starter'?
  {passengers:STARTER_STAGES[node.level-1].jobs,revenue:STARTER_STAGES[node.level-1].revenue}:
  effectiveCosts(node.projectId,node.level,state.levels,Research.projects);
 const delivered=(node:HierarchyNode)=>node.kind==='starter'?earned:state.contributions?.[node.id]??{};
 const productCosts=(node:HierarchyNode)=>node.kind==='starter'?{}:
  productRequirements(node.projectId,node.level,Research.projects);
 const productDelivered=(node:HierarchyNode)=>state.productContributions?.[node.id]??{};
 const progress=(node:HierarchyNode)=>{
  if(isDone(node))return 100;
  const c=costs(node),d=delivered(node),entries=Object.entries(c);
  const productEntries=Object.entries(productCosts(node));
  const total=entries.length+productEntries.length;
  if(!total)return 0;
  const raw=entries.reduce((sum,[key,n])=>
   sum+Math.min(1,(d[key as ResourceKey]??0)/Math.max(1,n)),0);
  const supplied=productDelivered(node);
  const crafted=productEntries.reduce((sum,[key,n])=>
   sum+Math.min(1,(supplied[key]??0)/Math.max(1,n)),0);
  return Math.round((raw+crafted)*100/total);
 };
 const selected=selectedId?hierarchy.byId.get(selectedId):undefined;
 const selectedProject=selected?.kind==='research'?projects.get(selected.projectId):undefined;
 const selectedBusinessUnlocks=selected?Object.values(BUSINESS_UNLOCKS).filter(rule=>
  'starter' in rule
   ?selected.kind==='starter'&&selected.level===rule.starter
   :selected.kind==='research'&&selected.projectId===rule.id&&selected.level===rule.level
 ).map(rule=>rule.name):[];
 const frontier=hierarchy.nodes.filter(n=>!isDone(n)&&blocked(n).length===0)
  .sort((a,b)=>a.rank-b.rank||a.x-b.x)[0];
 const nextId=starterLevel<STARTER_LEVELS?'starter:'+(starterLevel+1):frontier?.id??'starter:4';
 const updateTransform=(next:Camera)=>{
  const el=viewport.current;
  if(!el)return;
  const width=el.clientWidth,height=el.clientHeight;
  const sceneW=hierarchy.width*next.scale,sceneH=hierarchy.height*next.scale;
  const horizontalMargin=Math.min(150,width*.42),verticalMargin=Math.min(180,height*.42);
  const x=sceneW<=width? (width-sceneW)/2:
   clamp(next.x,width-sceneW-horizontalMargin,horizontalMargin);
  const y=sceneH<=height? (height-sceneH)/2:
   clamp(next.y,height-sceneH-verticalMargin,verticalMargin);
  camera.current={x,y,scale:next.scale};
  if(scene.current)scene.current.style.transform='translate3d('+x+'px,'+y+'px,0) scale('+next.scale+')';
  setZoomLabel(Math.round(next.scale*100)+'%');
 };
 const centerOn=(id:string,scale?:number)=>{
  const target=hierarchy.byId.get(id),el=viewport.current;
  if(!target||!el)return;
  const nextScale=scale??camera.current.scale;
  updateTransform({scale:nextScale,x:el.clientWidth/2-(target.x+RESEARCH_NODE_SIZE/2)*nextScale,
   y:el.clientHeight*.40-(target.y+RESEARCH_NODE_SIZE/2)*nextScale});
 };
 useEffect(()=>{
  const element=viewport.current;
  if(!element)return;
  const update=()=>{
   if(!initialized.current){initialized.current=true;centerOn(nextId,.76);}
   else updateTransform(camera.current);
  };
  update();
  const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);
  observer?.observe(element);
  return()=>observer?.disconnect();
 },[]);
 const relative=(e:ReactPointerEvent<HTMLDivElement>):Vector=>{
  const rect=e.currentTarget.getBoundingClientRect();
  return {x:e.clientX-rect.left,y:e.clientY-rect.top};
 };
 const onPointerDown=(e:ReactPointerEvent<HTMLDivElement>)=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const position=relative(e);
  pointers.current.set(e.pointerId,position);
  e.currentTarget.setPointerCapture(e.pointerId);
  if(pointers.current.size===1){
   const target=e.target instanceof Element?e.target.closest('[data-tech-id]'):null;
   gesture.current={tapId:target?.getAttribute('data-tech-id')??null,
    pointerId:e.pointerId,down:position,moved:false,multi:false};
  }else if(pointers.current.size>=2){
   if(gesture.current){gesture.current.multi=true;gesture.current.moved=true;}
   const [a,b]=[...pointers.current.values()];
   const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   pinch.current={
    distance:Math.hypot(a.x-b.x,a.y-b.y),
    scale:camera.current.scale,
    anchor:{x:(midpoint.x-camera.current.x)/camera.current.scale,
     y:(midpoint.y-camera.current.y)/camera.current.scale}
   };
  }
 };
 const onPointerMove=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const previous=pointers.current.get(e.pointerId);
  if(!previous)return;
  const position=relative(e);
  pointers.current.set(e.pointerId,position);
  if(pointers.current.size>=2&&pinch.current){
   const [a,b]=[...pointers.current.values()];
   const midpoint={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
   const scale=clamp(pinch.current.scale*Math.hypot(a.x-b.x,a.y-b.y)/
    Math.max(1,pinch.current.distance),MIN_SCALE,MAX_SCALE);
   updateTransform({scale,x:midpoint.x-pinch.current.anchor.x*scale,
    y:midpoint.y-pinch.current.anchor.y*scale});
   return;
  }
  if(pointers.current.size===1){
   if(gesture.current&&Math.hypot(position.x-gesture.current.down.x,position.y-gesture.current.down.y)>6)
    gesture.current.moved=true;
   updateTransform({...camera.current,
    x:camera.current.x+position.x-previous.x,y:camera.current.y+position.y-previous.y});
  }
 };
 const onPointerFinish=(e:ReactPointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;
  if(g?.pointerId===e.pointerId&&!g.moved&&!g.multi&&g.tapId)setSelectedId(g.tapId);
  pointers.current.delete(e.pointerId);
  if(pointers.current.size<2)pinch.current=null;
  if(pointers.current.size===1){
   const [id,pos]=[...pointers.current.entries()][0];
   gesture.current={tapId:null,pointerId:id,down:pos,moved:true,multi:true};
  }else if(pointers.current.size===0)gesture.current=null;
  try{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}catch{/* pointer already released */}
 };
 const zoomAt=(point:Vector,multiplier:number)=>{
  const current=camera.current;
  const scale=clamp(current.scale*multiplier,MIN_SCALE,MAX_SCALE);
  const world={x:(point.x-current.x)/current.scale,y:(point.y-current.y)/current.scale};
  updateTransform({scale,x:point.x-world.x*scale,y:point.y-world.y*scale});
 };
 const onWheel=(e:ReactWheelEvent<HTMLDivElement>)=>{
  e.preventDefault();
  const rect=e.currentTarget.getBoundingClientRect();
  zoomAt({x:e.clientX-rect.left,y:e.clientY-rect.top},Math.exp(-e.deltaY*.0015));
 };
 const onDoubleClick=(e:React.MouseEvent<HTMLDivElement>)=>{
  const rect=e.currentTarget.getBoundingClientRect();
  zoomAt({x:e.clientX-rect.left,y:e.clientY-rect.top},camera.current.scale>.95?.65:1.5);
 };
 const resourceItems=resourceKeys.map(key=>({key,name:RESOURCE_INFO[key].name,
  glyph:RESEARCH_RESOURCE_GLYPHS[key],balance:inventory[key],total:earned[key]}));
 return <section className="research-factory" role="application" aria-label="Research technology hierarchy">
  <header className="research-factory-header">
   <button className="factory-resources-trigger" type="button" onClick={()=>{setResourceOpen(v=>!v);setSelectedId(null);}}
    aria-expanded={resourceOpen} aria-label="Toggle research resources">
    <Coins size={19}/><span>Resources</span><ChevronDown size={12}/>
   </button>
   <h1>TECHNOLOGY</h1>
   <button className="factory-close" type="button" aria-label="Close Research" onClick={onClose}><X size={23}/></button>
  </header>
  <div className="factory-viewport" ref={viewport} onPointerDown={onPointerDown}
   onPointerMove={onPointerMove} onPointerUp={onPointerFinish} onPointerCancel={onPointerFinish}
   onWheel={onWheel} onDoubleClick={onDoubleClick}
   aria-label="Drag to pan, pinch to zoom. Tap any technology to view requirements.">
   <div ref={scene} className="factory-scene" style={{width:hierarchy.width,height:hierarchy.height}}>
    <svg className="factory-wires" width={hierarchy.width} height={hierarchy.height}
     viewBox={'0 0 '+hierarchy.width+' '+hierarchy.height} aria-hidden="true">
     {hierarchy.edges.map((edge,index)=>{
      const parent=hierarchy.byId.get(edge.from);
      const child=hierarchy.byId.get(edge.to);
      const complete=Boolean(parent&&isDone(parent));
      return <path key={index} className={complete?'factory-wire-done':child&&!blocked(child).length?'factory-wire-open':'factory-wire-locked'}
       d={edge.path}/>;
     })}
    </svg>
    <div className="factory-origin" style={{left:hierarchy.width/2-44,top:30}}>
     <FlaskConical size={29}/><span>START</span>
    </div>
    {hierarchy.nodes.map(node=>{
     const done=isDone(node);
     const missing=blocked(node);
     const open=!done&&!missing.length;
     const started=open&&progress(node)>0;
     const title=node.kind==='starter'?STARTER_STAGES[node.level-1].name:
      projects.get(node.projectId)?.name??node.projectId;
     return <button key={node.id} type="button" data-tech-id={node.id}
      className={'factory-tech'+(done?' factory-tech-done':open?' factory-tech-open':' factory-tech-locked')+
       (started?' factory-tech-in-progress':'')+(selectedId===node.id?' factory-tech-selected':'')}
      style={{left:node.x,top:node.y}} title={title+' Level '+node.level}
      aria-label={title+' level '+node.level+(done?', completed':open?', collecting resources':', locked')}
      onClick={e=>{if(e.detail===0)setSelectedId(node.id);}}>
      <span className="factory-tech-icon">{node.kind==='starter'?
       starterGlyph[node.level]:RESEARCH_GLYPHS[node.projectId]??'🔬'}</span>
      {!done&&!open&&<LockKeyhole className="factory-padlock" size={19} strokeWidth={2.7}/>}
      {done&&<span className="factory-check"><CheckCircle2 size={13}/></span>}
      {node.kind==='research'&&<span className="factory-node-level">{node.level}</span>}
      {started&&<span className="factory-progress-indicator" style={{width:progress(node)+'%'}}/>}
     </button>;
    })}
   </div>
  </div>
  <button className="factory-locate" type="button" aria-label="Locate next available research level"
   onClick={()=>centerOn(nextId,.90)}><LocateFixed size={20}/></button>
  <div className="factory-scale" aria-hidden="true">{zoomLabel}</div>
  {resourceOpen&&<div className="factory-resources" aria-label="Research resources" role="dialog">
   <header><strong>Research resources</strong><button type="button" onClick={()=>setResourceOpen(false)} aria-label="Close resource inventory"><X size={17}/></button></header>
   <div className="factory-resources-grid">
    {resourceItems.map(item=><div className="factory-resource" key={item.key}>
     <span>{item.glyph}</span><div><strong>{item.name}</strong><small>{small(item.balance)} available</small></div>
     <b>{small(item.total)}</b>
    </div>)}
   </div>
   <strong className="factory-section-caption">Processed research products</strong>
   <div className="factory-resources-grid">
    {PRODUCT_KEYS.filter(key=>(state.productProduced?.[key]??0)>0).map(key=><div className="factory-resource" key={key}>
     <span>{recipeById.get(key)?.icon??'📦'}</span>
     <div><strong>{recipeById.get(key)?.name??key}</strong>
      <small>{fmt(state.productInventory?.[key]??0)} in stock</small></div>
     <b>{fmt(state.productProduced?.[key]??0)}</b>
    </div>)}
   </div>
   <small className="factory-resources-caption">Lifetime earned or manufactured on the right. Products are automatically made from ingredients and delivered to research.</small>
  </div>}
  {selected&&<div className="factory-detail-backdrop" role="presentation"
   onPointerDown={e=>e.stopPropagation()} onClick={()=>setSelectedId(null)}>
   <section className="factory-details" role="dialog" aria-label="Technology requirements"
    onClick={e=>e.stopPropagation()}>
    <header><span className="factory-detail-icon">{selected.kind==='starter'?
     starterGlyph[selected.level]:RESEARCH_GLYPHS[selected.projectId]??'🔬'}</span>
     <div><small>{selected.kind==='starter'?'STARTER TECHNOLOGY':
      ADVANCED_CATEGORIES[selectedProject?.category??0]}</small>
      <h2>{selected.kind==='starter'?STARTER_STAGES[selected.level-1].name:
       selectedProject?.name} · {selected.kind==='starter'?'Level '+selected.level:'Lv '+selected.level}</h2></div>
     <button type="button" aria-label="Close technology details" onClick={()=>setSelectedId(null)}><X size={20}/></button>
    </header>
    <p>{selected.kind==='starter'?STARTER_STAGES[selected.level-1].unlocks:selectedProject?.effect}</p>
    {selectedBusinessUnlocks.length>0&&<div className="factory-feature-unlocks">
     <strong>Unlocks business features</strong>
     {selectedBusinessUnlocks.map(feature=><span key={feature}>🔓 {feature}</span>)}
    </div>}
    {isDone(selected)?<div className="factory-done-message"><CheckCircle2 size={17}/> Research complete</div>:
     <>
      {blocked(selected).length>0&&<div className="factory-prerequisites"><strong>Requires</strong>
       {blocked(selected).map((req,i)=><span key={i}><LockKeyhole size={13}/>{req}</span>)}</div>}
      <div className="factory-detail-requirements">{resourceKeys.filter(k=>(costs(selected)[k]??0)>0)
       .map(key=>{
        const need=costs(selected)[key]??0;
        const count=Math.min(need,delivered(selected)[key]??0);
        return <div key={key} className="factory-requirement">
         <div><span>{RESEARCH_RESOURCE_GLYPHS[key]} {RESOURCE_INFO[key].name}</span>
          <b>{fmt(count)} / {fmt(need)}</b></div>
         <span className="factory-requirement-bar"><i style={{width:Math.min(100,count/need*100)+'%'}}/></span>
        </div>;
       })}</div>
      {selected.kind==='research'&&PRODUCT_KEYS.some(key=>(productCosts(selected)[key]??0)>0)&&
       <div className="factory-product-chains">
        <strong>Manufactured research requirements</strong>
        {PRODUCT_KEYS.filter(key=>(productCosts(selected)[key]??0)>0).map(key=>{
         const recipe=recipeById.get(key);
         const need=productCosts(selected)[key]??0;
         const made=productDelivered(selected)[key]??0;
         return <details key={key} className="factory-product-chain">
          <summary><span>{recipe?.icon??'📦'} {recipe?.name??key}</span>
           <b>{fmt(made)} / {fmt(need)}</b></summary>
          {recipe&&!recipeAvailable(key,state.levels)&&
           <small className="factory-product-lock">Unlock {projects.get(recipe.unlock.project)?.name??recipe.unlock.project} Level {recipe.unlock.level} first</small>}
          <div className="factory-recipe-ingredients">
           {recipeIngredients(key).map(ingredient=><div key={ingredient.kind+':'+ingredient.key}>
            <span>{ingredient.kind==='raw'?
             RESEARCH_RESOURCE_GLYPHS[ingredient.key]:recipeById.get(ingredient.key)?.icon}
             {' '}{ingredient.kind==='raw'?RESOURCE_INFO[ingredient.key].name:recipeById.get(ingredient.key)?.name}</span>
            <b>× {fmt(ingredient.count)}</b>
           </div>)}
          </div>
          {recipe?.parts&&<small>Intermediate products above are also automatically made from their own recipes.</small>}
         </details>;
        })}
       </div>}
      <small className="factory-auto-caption">Resources and intermediate products are produced and delivered automatically as your company operates.</small>
     </>}
   </section>
  </div>}
 </section>;
}
