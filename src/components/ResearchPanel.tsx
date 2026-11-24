import {useEffect,useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent,WheelEvent as ReactWheelEvent} from 'react';
import {X,Coins,LocateFixed,CheckCircle2,LockKeyhole,ChevronDown} from 'lucide-react';
import type {Company} from '../company';
import * as Research from '../research';
import {ADVANCED_CATEGORIES,RESOURCE_INFO,resourceKeys,safeBag,technologyParents,type ResourceKey,type OperationalContext} from '../researchProgress';
import {STARTER_STAGES,STARTER_LEVELS,REQUIRED_LEVELS,effectiveCosts,technologyLevelRequirements} from '../researchAutomatic';
import {buildResearchHierarchy,DIVISIONS,RESEARCH_TILE_SIZE,type DivisionKey,type HierarchyNode} from '../researchHierarchy';
import {supplierStock,SUPPLIER_COLORS} from '../generatedSuppliers';
import {BUSINESS_UNLOCKS} from '../researchUnlocks';
import {collectorResearchCosts} from '../collectorResearch';
import {COLLECTOR_PARTS,COLLECTOR_NAMES,collectorVehicles,collectorLimit,collectorPurchaseLock,collectorCapacity,collectorStorageCapacity,collectorStorageUsage,collectorExpenseTotal,emptyCollectorExpenses,collectorFuelRate,COLLECTOR_SERVICE_KM,COLLECTOR_FUEL_PRICE,collectorWarehouses,REGIONAL_WAREHOUSE_PRICE,COLLECTOR_MODELS,type CollectorModel,type CollectorPart} from '../resourceCollectors';
import ResearchTechIcon,{ResearchResourceIcon,ResearchProductIcon} from './ResearchTechIcon';
import {productRequirements,recipeById,recipeIngredients,PRODUCT_KEYS,recipeAvailable} from '../researchProducts';
import './research-v4.css';

type Props={company:Company|null;state:Research.ResearchState;discoveredRoads:number;
 explorerSpecializations:number;depots:number;gameNow:number;freshStart?:boolean;collectorCash?:number;onBuyCollector?:(model:CollectorModel)=>string|null;onConfigureCollector?:(id:string,change:{priority?:CollectorPart|null;paused?:boolean;warehouseId?:string})=>void;onBuyWarehouse?:(id:string)=>string|null;onClose:()=>void};
type Vector={x:number;y:number};
type Camera={x:number;y:number;scale:number};
type Gesture={tapId:string|null;pointerId:number;down:Vector;moved:boolean;multi:boolean};
type Pinch={distance:number;scale:number;anchor:Vector};
const MIN_SCALE=.27,MAX_SCALE=2.4;
const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,n));
const fmt=(n:number)=>Math.floor(Math.max(0,n||0)).toLocaleString('en-IE');
const small=(n:number)=>n>=1e6?(n/1e6).toFixed(1).replace(/\.0$/,'')+'m':n>=10000?
 (n/1000).toFixed(1).replace(/\.0$/,'')+'k':fmt(n);
const divisionNames:Record<DivisionKey,string>=Object.fromEntries(
 DIVISIONS.map(division=>[division.key,division.name])
) as Record<DivisionKey,string>;

export default function ResearchPanel({company,state,discoveredRoads,explorerSpecializations,depots,gameNow,freshStart=false,collectorCash=0,onBuyCollector,onConfigureCollector,onBuyWarehouse,onClose}:Props){
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
 const [collectorError,setCollectorError]=useState('');
 const storage=state.collector?collectorStorageUsage(state.collector):{stored:0,reserved:0};
 const storageCapacity=state.collector?collectorStorageCapacity(state.collector,state.levels):1200;
 const expenses=state.collector?.expenses??emptyCollectorExpenses();
 const euro=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR'}).format(cents/100);
 const warehouses=state.collector&&company?collectorWarehouses(state.collector,company.depots??[],[company.headquarters.lng,company.headquarters.lat]):[];
 const [zoomLabel,setZoomLabel]=useState('70%');
 const inventory=safeBag(state.resources),earned=safeBag(state.earned);
 const starterLevel=freshStart?state.starterLevel??0:STARTER_LEVELS;
 const context:OperationalContext={roads:discoveredRoads,explorers:explorerSpecializations,depots,
  freshStart,starterLevel};
 const isDone=(node:HierarchyNode)=>node.kind==='division'?starterLevel>=STARTER_LEVELS:
  node.kind==='starter'?starterLevel>=node.level:
  Research.level(state,node.projectId as Research.ResearchId)>=node.level;
 const blocked=(node:HierarchyNode)=>{
  if(isDone(node))return [];
  if(node.kind==='starter')return node.level>1&&starterLevel<node.level-1?['Starter Level '+(node.level-1)]:[];
  if(node.kind==='division')return starterLevel>=STARTER_LEVELS?[]:['Complete Operations IV (50 jobs and 2,000 roads)'];
  return technologyLevelRequirements(node.projectId,node.level,state.levels,context);
 };
 const costs=(node:HierarchyNode)=>node.kind==='division'?{}:node.kind==='starter'?
  {passengers:STARTER_STAGES[node.level-1].jobs,roads:STARTER_STAGES[node.level-1].roads}:
  effectiveCosts(node.projectId,node.level,state.levels,Research.projects);
 const delivered=(node:HierarchyNode)=>node.kind==='starter'?
  {...earned,roads:Math.max(earned.roads,discoveredRoads)}:
  node.kind==='division'?{}:state.contributions?.[node.id]??{};
 const productCosts=(node:HierarchyNode)=>node.kind==='research'?
  productRequirements(node.projectId,node.level,Research.projects):{};
 const productDelivered=(node:HierarchyNode)=>state.productContributions?.[node.id]??{};
 const materialCosts=(node:HierarchyNode)=>node.kind==='research'&&state.collector?collectorResearchCosts(projects.get(node.projectId)??{id:node.projectId,category:node.category},node.level):{};
 const progress=(node:HierarchyNode)=>{
  if(isDone(node))return 100;
  const c=costs(node),d=delivered(node),entries=Object.entries(c);
  const productEntries=Object.entries(productCosts(node));
  const materials=materialCosts(node),parts=COLLECTOR_PARTS.filter(p=>(materials[p]??0)>0);
  const total=entries.length+productEntries.length+parts.length;
  if(!total)return 0;
  const raw=entries.reduce((sum,[key,n])=>
   sum+Math.min(1,(d[key as ResourceKey]??0)/Math.max(1,n)),0);
  const supplied=productDelivered(node);
  const crafted=productEntries.reduce((sum,[key,n])=>
   sum+Math.min(1,(supplied[key]??0)/Math.max(1,n)),0);
  const suppliedParts=parts.reduce((sum,p)=>sum+Math.min(1,(state.collector?.stock[p]??0)/(materials[p]??1)),0);
  return Math.min(99,Math.round((raw+crafted+suppliedParts)*100/total));
 };
 const selected=selectedId?hierarchy.byId.get(selectedId):undefined;
 const selectedProject=selected?.kind==='research'?projects.get(selected.projectId):undefined;
 const selectedDivision=selected?.kind==='division'?divisionNames[selected.division!]:undefined;
 const selectedParents=selected?.kind==='research'&&selected.level===1
  ?technologyParents(selected.projectId):[];
 const selectedRequirements=selectedParents.map(parent=>{
  const level=REQUIRED_LEVELS(selected!.projectId,parent);
  return {parent,name:projects.get(parent)?.name??parent,
   level,done:(state.levels[parent as Research.ResearchId]??0)>=level};
 });
 const selectedBusinessUnlocks=selected?Object.values(BUSINESS_UNLOCKS).filter(rule=>
  'starter' in rule
   ?selected.kind==='starter'&&selected.level===rule.starter
   :selected.kind==='research'&&selected.projectId===rule.id&&selected.level===rule.level
 ).map(rule=>rule.name):[];
 const frontier=hierarchy.nodes.filter(n=>!isDone(n)&&blocked(n).length===0)
  .sort((a,b)=>a.rank-b.rank||a.x-b.x)[0];
 const nextId=starterLevel<STARTER_LEVELS?'starter:'+(starterLevel+1):frontier?.id??'starter:5';
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
  updateTransform({scale:nextScale,x:el.clientWidth/2-(target.x+RESEARCH_TILE_SIZE/2)*nextScale,
   y:el.clientHeight*.40-(target.y+RESEARCH_TILE_SIZE/2)*nextScale});
 };
 useEffect(()=>{
  const element=viewport.current;
  if(!element)return;
  const update=()=>{
   if(!initialized.current){initialized.current=true;centerOn('starter:3',.98);}
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
  balance:inventory[key],total:earned[key]}));
 return <section className="research-factory" role="application" aria-label="Research technology hierarchy">
  <header className="research-factory-header">
   <button className="factory-resources-trigger" type="button" onClick={()=>{setResourceOpen(v=>!v);setSelectedId(null);}}
    aria-expanded={resourceOpen} aria-label="Toggle research resources">
    <Coins size={19}/><span>Resources</span><ChevronDown size={12}/>
   </button>
   <h1>Research <span>Centre</span></h1>
   <button className="factory-close" type="button" aria-label="Close Research" onClick={onClose}><X size={23}/></button>
  </header>
  <div className="factory-viewport" ref={viewport} onPointerDown={onPointerDown}
   onPointerMove={onPointerMove} onPointerUp={onPointerFinish} onPointerCancel={onPointerFinish}
   onWheel={onWheel} onDoubleClick={onDoubleClick}
   aria-label="Drag to pan, pinch to zoom. Tap any technology to view requirements.">
   <div ref={scene} className="factory-scene" style={{width:hierarchy.width,height:hierarchy.height}}>
    <svg className="factory-wires" width={hierarchy.width} height={hierarchy.height}
     viewBox={'0 0 '+hierarchy.width+' '+hierarchy.height} aria-hidden="true">
     {hierarchy.edges.filter(edge=>edge.visible).map((edge,index)=>{
      const parent=hierarchy.byId.get(edge.from);
      const child=hierarchy.byId.get(edge.to);
      const complete=Boolean(parent&&isDone(parent));
      return <path key={index} className={complete?'factory-wire-done':child&&!blocked(child).length?'factory-wire-open':'factory-wire-locked'}
       d={edge.path}/>;
     })}
    </svg>

    {hierarchy.nodes.map(node=>{
     const done=isDone(node);
     const missing=blocked(node);
     const open=!done&&!missing.length;
     const started=open&&progress(node)>0;
     const title=node.kind==='starter'?STARTER_STAGES[node.level-1].name:
      node.kind==='division'?divisionNames[node.division!]:
      projects.get(node.projectId)?.name??node.projectId;
     return <button key={node.id} type="button" data-tech-id={node.id}
      className={'factory-tech'+(node.kind==='division'?' factory-tech-division':'')+
       (node.kind==='starter'?' factory-tech-starter':'')+
       (node.division?' factory-division-'+node.division:'')+
       (done?' factory-tech-done':open?' factory-tech-open':' factory-tech-locked')+
       (started?' factory-tech-in-progress':'')+(selectedId===node.id?' factory-tech-selected':'')}
      style={{left:node.x,top:node.y}} title={title+(node.kind==='research'?' Level '+node.level:'')}
      aria-label={title+(node.kind==='research'?' level '+node.level:'')+
       (done?', completed':open?', collecting resources':', locked')}
      onClick={e=>{if(e.detail===0)setSelectedId(node.id);}}>
      <span className="factory-tech-icon">
       <ResearchTechIcon kind={node.kind} division={node.division}
        projectId={node.projectId} category={node.category} level={node.level} size={28}/>
      </span>
      {node.kind==='division'&&<span className="factory-division-name">{title}</span>}
      {!done&&!open&&<LockKeyhole className="factory-padlock" size={19} strokeWidth={2.7}/>}
      {done&&<span className="factory-check"><CheckCircle2 size={13}/></span>}
      {node.kind==='research'&&<span className="factory-node-level">{node.level}</span>}
      {node.kind==='research'&&node.level===1&&technologyParents(node.projectId).length>=2&&
       <span className="factory-node-join" title={technologyParents(node.projectId).length+' prerequisites'}>
        {technologyParents(node.projectId).length}
       </span>}
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
     <span className="factory-resource-icon"><ResearchResourceIcon resource={item.key} size={18}/></span>
     <div><strong>{item.name}</strong><small>{small(item.balance)} available</small></div>
     <b>{small(item.total)}</b>
    </div>)}
   </div>
   {state.collector&&<>
    <strong className="factory-section-caption">Resource collector · Depot inventory</strong>
    <small className="factory-resources-caption">{collectorVehicles(state.collector).length} / {collectorLimit(state.levels)} collectors · {state.collector.trips} completed deliveries</small>
    <div className="factory-collector-fleet" style={{display:'grid',gap:8,margin:'8px 0'}}>
     <div style={{padding:10,border:'1px solid #8495aa55',borderRadius:8}}>
      <strong>Warehouse storage · {fmt(storage.stored)} / {fmt(storageCapacity)} units</strong>
      <progress aria-label="Warehouse capacity including reserved shipments" style={{width:'100%'}} value={Math.min(storageCapacity,storage.stored+storage.reserved)} max={storageCapacity}/>
      <small style={{display:'block'}}>{fmt(storage.reserved)} incoming · {fmt(Math.max(0,storageCapacity-storage.stored-storage.reserved))} free · {fmt(Math.floor(storageCapacity/8))} units reserved per resource category</small>
      <small>HQ 1,200 units + 2,000 per regional warehouse; depot efficiency increases capacity.</small>
     </div>
     <div style={{padding:10,border:'1px solid #8495aa55',borderRadius:8}}>
      <strong>Lifetime collector operating expenses · {euro(collectorExpenseTotal(expenses))}</strong>
      <small style={{display:'block'}}>Fuel {euro(expenses.fuelCents)} · Wear {euro(expenses.maintenanceCents)} · Service {euro(expenses.serviceCents)}</small>
      <small>Depot refuelling · €{COLLECTOR_FUEL_PRICE.toFixed(2)}/L (simulated)</small>
     </div>
     {collectorVehicles(state.collector).map((vehicle,index)=><div key={vehicle.id} style={{padding:9,border:'1px solid #8495aa55',borderRadius:8}}>
      <strong>{COLLECTOR_MODELS[vehicle.model].name} #{index+1}</strong>
      <small style={{display:'block'}}>{collectorCapacity(vehicle.model,state.levels)} units · {vehicle.trips} trips · {vehicle.distanceKm.toFixed(1)} km</small>
      <small style={{display:'block'}}>{vehicle.trip?'Collecting '+COLLECTOR_NAMES[vehicle.trip.part]+' · '+(vehicle.trip.supplierName??'Local supply point')+(vehicle.paused?' · pausing at depot':''):vehicle.paused?'Paused at depot':vehicle.waitingReason??'Waiting for discovered round-trip route'}</small>
      <small style={{display:'block'}}>{collectorFuelRate(vehicle.model,state.levels).toFixed(1)} L/100 km · {fmt(vehicle.fuelLitres??0)} L purchased · {euro(collectorExpenseTotal(vehicle.expenses??emptyCollectorExpenses()))} lifetime expenses</small>
      <small style={{display:'block'}}>Next service in {fmt(Math.max(0,COLLECTOR_SERVICE_KM-(vehicle.distanceKm-(vehicle.lastServiceKm??0))))} km</small>
      <div style={{display:'flex',gap:6,marginTop:6,flexWrap:'wrap'}}>
       <button type="button" onClick={()=>onConfigureCollector?.(vehicle.id,{paused:!vehicle.paused})}>{vehicle.paused?'Resume':'Pause at depot'}</button>
       <select aria-label={'Collection priority '+(index+1)} disabled={!state.levels.collectorPriority} value={vehicle.priority??''} onChange={e=>onConfigureCollector?.(vehicle.id,{priority:(e.target.value||null) as CollectorPart|null})}>
        <option value="">{state.levels.collectorPriority?'Automatic rotation':'Priority research locked'}</option>
        {COLLECTOR_PARTS.map(part=><option key={part} value={part}>{COLLECTOR_NAMES[part]}</option>)}
       </select>
       <select aria-label={'Assigned warehouse '+(index+1)} disabled={!!vehicle.trip||!vehicle.paused||!state.levels.collectorRegional} value={vehicle.warehouseId??'main'} onChange={e=>onConfigureCollector?.(vehicle.id,{warehouseId:e.target.value})}>
        {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
       </select>
      </div>
     </div>)}
     {state.collector.suppliers&&<><strong>Discovered suppliers · {Object.keys(state.collector.suppliers).length}</strong>
      <div className="factory-resources-grid">
       {COLLECTOR_PARTS.map(part=>{
        const locations=Object.values(state.collector!.suppliers!).filter(s=>s.part===part);
        const units=locations.reduce((n,s)=>n+supplierStock(s,gameNow),0);
        return <div key={part} className="factory-resource"><span className="factory-resource-icon" style={{color:SUPPLIER_COLORS[part]}}>▣</span><div><strong>{COLLECTOR_NAMES[part]}</strong><small>{locations.length} locations · {fmt(units)} supply units</small></div></div>;
       })}
      </div><small>Supplier stock replenishes hourly in game time. Map markers appear when zoomed in.</small></>}
     <strong>Regional warehouses</strong>
     <small>Warehouse deliveries feed the shared research inventory. Pause at depot before administrative redeployment to another warehouse.</small>
     {warehouses.map(w=><div key={w.id} style={{padding:8,border:'1px solid #8495aa55',borderRadius:8}}>
      <strong>{w.name}</strong><small style={{display:'block'}}>{w.trips} deliveries · {Object.values(w.delivered).reduce((sum,n)=>sum+(n??0),0)} lifetime units</small>
     </div>)}
     {(company?.depots??[]).filter(d=>!warehouses.some(w=>w.id===d.id)).map(d=><div key={d.id} style={{padding:8,border:'1px solid #8495aa55',borderRadius:8}}>
      <strong>{d.name}</strong><small style={{display:'block'}}>Warehouse conversion · €{fmt(REGIONAL_WAREHOUSE_PRICE)}</small>
      <button type="button" disabled={!state.levels.collectorRegional||collectorCash<REGIONAL_WAREHOUSE_PRICE||!onBuyWarehouse} onClick={()=>setCollectorError(onBuyWarehouse?.(d.id)??'')}>{!state.levels.collectorRegional?'Regional Collector Network required':'Open warehouse'}</button>
     </div>)}
     {!(company?.depots??[]).length&&<small>Create an additional company depot to open a regional warehouse.</small>}
     <strong>Collector dealership</strong>
     {(Object.keys(COLLECTOR_MODELS) as CollectorModel[]).map(model=>{
      const offer=COLLECTOR_MODELS[model],reason=collectorPurchaseLock(state.collector!,model,state.levels)??(collectorCash<offer.price?'Insufficient cash':null);
      return <div key={model} style={{padding:8,border:'1px solid #8495aa55',borderRadius:8}}>
       <strong>{offer.name}</strong><small style={{display:'block'}}>{collectorCapacity(model,state.levels)} units · €{fmt(offer.price)}</small>
       <button type="button" disabled={!!reason||!onBuyCollector} onClick={()=>setCollectorError(onBuyCollector?.(model)??'')}>{reason??'Purchase collector'}</button>
      </div>;
     })}
     {collectorError&&<small role="alert">{collectorError}</small>}
    </div>
    <div className="factory-resources-grid">
     {COLLECTOR_PARTS.map(part=><div className="factory-resource" key={part}>
      <span className="factory-resource-icon">🚚</span><div><strong>{COLLECTOR_NAMES[part]}</strong><small>{fmt(state.collector?.stock[part]??0)} available · {fmt(state.collector?.researchSpent?.[part]??0)} used in research</small></div><b>{fmt(state.collector?.delivered[part]??0)}</b>
     </div>)}
    </div>
   </>}
   <strong className="factory-section-caption">Processed research products</strong>
   <div className="factory-resources-grid">
    {PRODUCT_KEYS.filter(key=>(state.productProduced?.[key]??0)>0).map(key=><div className="factory-resource" key={key}>
     <span className="factory-resource-icon"><ResearchProductIcon product={key} size={18}/></span>
     <div><strong>{recipeById.get(key)?.name??key}</strong>
      <small>{fmt(state.productInventory?.[key]??0)} in stock</small></div>
     <b>{fmt(state.productProduced?.[key]??0)}</b>
    </div>)}
   </div>
   <small className="factory-resources-caption">Lifetime earned or manufactured on the right. Products are automatically made from ingredients and delivered to research.</small>
  </div>}
  {selected&&<div className="factory-detail-backdrop" role="presentation"
   onPointerDown={e=>e.stopPropagation()} onClick={()=>setSelectedId(null)}>
   <section className={'factory-details'+(selected.division?' factory-division-'+selected.division:'')} role="dialog" aria-label="Technology requirements"
    onClick={e=>e.stopPropagation()}>
    <header><span className="factory-detail-icon">
     <ResearchTechIcon kind={selected.kind} division={selected.division}
      projectId={selected.projectId} category={selected.category} level={selected.level} size={30}/>
    </span>
     <div><small>{selected.kind==='starter'?'STARTER MILESTONES':
      selected.kind==='division'?'RESEARCH DIVISION':
      ADVANCED_CATEGORIES[selectedProject?.category??0]}</small>
      <h2>{selected.kind==='starter'?STARTER_STAGES[selected.level-1].name+' · Level '+selected.level:
       selected.kind==='division'?selectedDivision:
       selectedProject?.name+' · Lv '+selected.level}</h2></div>
     <button type="button" aria-label="Close technology details" onClick={()=>setSelectedId(null)}><X size={20}/></button>
    </header>
    <p>{selected.kind==='starter'?STARTER_STAGES[selected.level-1].unlocks:
     selected.kind==='division'?
      'This division opens after the five startup milestones. Each connected technology progresses automatically from your business activity.':
      selectedProject?.effect}</p>
    {selectedRequirements.length>0&&<div className="factory-dependency-list">
     <strong>{selectedRequirements.length>=2?
      'All '+selectedRequirements.length+' technology branches required':
      'Unlock prerequisite'}</strong>
     {selectedRequirements.map(requirement=><div key={requirement.parent}>
      {requirement.done?<CheckCircle2 size={15} className="factory-requirement-done"/>:
       <LockKeyhole size={15} className="factory-requirement-locked"/>}
      <span>{requirement.name} · Lv {requirement.level}</span>
     </div>)}
    </div>}
    {selectedBusinessUnlocks.length>0&&<div className="factory-feature-unlocks">
     <strong>Unlocks business features</strong>
     {selectedBusinessUnlocks.map(feature=><span key={feature}>🔓 {feature}</span>)}
    </div>}
    {isDone(selected)?<div className="factory-done-message"><CheckCircle2 size={17}/>
     {selected.kind==='division'?'Division unlocked':selected.kind==='starter'?'Milestone completed':'Research complete'}</div>:
     <>
      {blocked(selected).length>0&&<div className="factory-prerequisites"><strong>Requires</strong>
       {blocked(selected).map((req,i)=><span key={i}><LockKeyhole size={13}/>{req}</span>)}</div>}
      <div className="factory-detail-requirements">{resourceKeys.filter(k=>(costs(selected)[k]??0)>0)
       .map(key=>{
        const need=costs(selected)[key]??0;
        const count=Math.min(need,delivered(selected)[key]??0);
        return <div key={key} className="factory-requirement">
         <div><span className="factory-requirement-label">
          <ResearchResourceIcon resource={key} size={15}/>{RESOURCE_INFO[key].name}
         </span>
          <b>{fmt(count)} / {fmt(need)}</b></div>
         <span className="factory-requirement-bar"><i style={{width:Math.min(100,count/need*100)+'%'}}/></span>
        </div>;
       })}</div>
      {selected.kind==='research'&&state.collector&&<div className="factory-product-chains"><strong>Collected research materials</strong>
       {COLLECTOR_PARTS.filter(part=>(materialCosts(selected)[part]??0)>0).map(part=>{
        const need=materialCosts(selected)[part]??0,available=state.collector?.stock[part]??0;
        return <div className="factory-requirement" key={part}><div><span className="factory-requirement-label"><i style={{background:SUPPLIER_COLORS[part],width:10,height:10,borderRadius:3,display:'inline-block'}}/>{COLLECTOR_NAMES[part]}</span><b>{fmt(Math.min(available,need))} / {fmt(need)}</b></div><span className="factory-requirement-bar"><i style={{width:Math.min(100,available/need*100)+'%'}}/></span></div>;
       })}
       <small>All materials must be available together. They are consumed only when research completes. Collect or buy missing stock in Fleet → Collectors.</small>
      </div>}
      {selected.kind==='research'&&PRODUCT_KEYS.some(key=>(productCosts(selected)[key]??0)>0)&&
       <div className="factory-product-chains">
        <strong>Manufactured research requirements</strong>
        {PRODUCT_KEYS.filter(key=>(productCosts(selected)[key]??0)>0).map(key=>{
         const recipe=recipeById.get(key);
         const need=productCosts(selected)[key]??0;
         const made=productDelivered(selected)[key]??0;
         return <details key={key} className="factory-product-chain">
          <summary><span className="factory-requirement-label">
           <ResearchProductIcon product={key} size={17}/>{recipe?.name??key}
          </span>
           <b>{fmt(made)} / {fmt(need)}</b></summary>
          {recipe&&!recipeAvailable(key,state.levels)&&
           <small className="factory-product-lock">Unlock {projects.get(recipe.unlock.project)?.name??recipe.unlock.project} Level {recipe.unlock.level} first</small>}
          <div className="factory-recipe-ingredients">
           {recipeIngredients(key).map(ingredient=><div key={ingredient.kind+':'+ingredient.key}>
            <span className="factory-requirement-label">
             {ingredient.kind==='raw'?
              <ResearchResourceIcon resource={ingredient.key} size={15}/>:
              <ResearchProductIcon product={ingredient.key} size={15}/>}
             {ingredient.kind==='raw'?RESOURCE_INFO[ingredient.key].name:recipeById.get(ingredient.key)?.name}
            </span>
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
