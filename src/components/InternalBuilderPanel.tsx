import {useEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import {Building2,Plus,HardHat,Hammer,Layers3,DoorOpen,Sofa,Trash2,RotateCw,MapPin,ShoppingCart,Users,Clock3,ChevronLeft,Package,CheckCircle2,AlertCircle,Grid2X2,Landmark,Undo2,Redo2,Copy} from 'lucide-react';
import type {Company} from '../company';
import type {PropertyPortfolio} from '../investments';
import {ownership} from '../investments';
import {
 type HotelSite,type HotelFloor,type RoomType,type BuilderTool,type FurnitureCode,type TradeMode,type ConstructionState,
 type Wall,
 roomTypes,furniture,drawRoom,toggleWall,placeFurniture,updateFloor,addFloor,constructionQuote,progressProject,
 roomIssues,furnitureSize,supplies,supplyStock,type SupplyCode,euros,RECRUITMENT_CENTS,WORKER_HOURLY_CENTS,MAX_FLOORS,LAND_PRICE_CENTS
} from '../internalConstruction';
import './internal-builder.css';
type Props={
 company:Company|null;state:ConstructionState;portfolio:PropertyPortfolio;gameHour:number;cash:number;error:string;
 onSelectLand:()=>void;onAddHeadquarters:()=>string|null;onAdoptHolding:(id:string)=>string|null;onChangeSite:(site:HotelSite)=>string|null;
 onStartProject:(id:string,method:TradeMode)=>string|null;onOrderSupplies:(siteId:string,code:SupplyCode,quantity:number)=>string|null;onHireWorker:()=>string|null;
};
type Tab='sites'|'blueprint'|'projects'|'supplies'|'crew';
const tone:Record<RoomType,string>={guest:'#38557a',bathroom:'#4b6680',kitchen:'#65516f',restaurant:'#695d81',bar:'#66486b',lobby:'#3f6672',storage:'#4c5d65',staff:'#4d5a79',corridor:'#414c64',office:'#445a7a',meeting:'#535079'};
const category:Record<RoomType,string>={guest:'Guest room',bathroom:'Bathroom',kitchen:'Kitchen',restaurant:'Restaurant',bar:'Bar',lobby:'Lobby',storage:'Storage',staff:'Staff room',corridor:'Corridor',office:'Office',meeting:'Meeting room'};
type Cell={x:number;y:number;fx:number;fy:number};
const id=()=>crypto.randomUUID();
export default function InternalBuilderPanel({company,state,portfolio,gameHour,cash,error,onSelectLand,onAddHeadquarters,onAdoptHolding,onChangeSite,onStartProject,onOrderSupplies,onHireWorker}:Props){
 const [tab,setTab]=useState<Tab>('sites');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [floorIndex,setFloorIndex]=useState(0);
 const [tool,setTool]=useState<BuilderTool|'select'>('room');
 const [roomType,setRoomType]=useState<RoomType>('guest');
 const [itemCode,setItemCode]=useState<FurnitureCode>('bed');
 const [rotate,setRotate]=useState(false);
 const [method,setMethod]=useState<TradeMode>('contractor');
 const [supplyCode,setSupplyCode]=useState<SupplyCode>('eggs');
 const [supplyQuantity,setSupplyQuantity]=useState(10);
 const [zoom,setZoom]=useState(1);
 const [status,setStatus]=useState('');
 const [anchor,setAnchor]=useState<Cell|null>(null);
 const pointer=useRef<Cell|null>(null);
 const history=useRef<{siteId:string|null;undo:HotelSite[];redo:HotelSite[]}>({siteId:null,undo:[],redo:[]});
 const sites=Object.values(state.sites);
 const site=selectedId?state.sites[selectedId]??null:null;
 const floor=site?.draft[Math.min(floorIndex,site.draft.length-1)]??null;
 const active=site?.projects.find(p=>p.status==='active');
 const quote=useMemo(()=>{if(!site||active)return null;try{return constructionQuote(site,method,state.workers);}catch{return null;}},[site,method,state.workers,active]);
 const selectedFurniture=furniture.find(f=>f.code===itemCode)!;
 const selectedSupply=supplies.find(f=>f.code===supplyCode)!;
 const available=Object.values(portfolio.holdings).filter(h=>h.kind==='hotel'&&ownership(h)>=0.5&&!sites.some(site=>site.sourceHoldingId===h.id));
 useEffect(()=>{if(!site&&sites.length&&selectedId===null){setSelectedId(sites[0].id);}},[site,sites.length,selectedId]);
 const choose=(idValue:string)=>{history.current={siteId:idValue,undo:[],redo:[]};setSelectedId(idValue);setFloorIndex(0);setAnchor(null);setTab('blueprint');setStatus('');};
 const recordEdit=(old:HotelSite)=>{
  if(history.current.siteId!==old.id)history.current={siteId:old.id,undo:[],redo:[]};
  history.current.undo.push(old);
  if(history.current.undo.length>35)history.current.undo.shift();
  history.current.redo=[];
 };
 const restoreHistory=(direction:'undo'|'redo')=>{
  if(!site||active)return;
  const h=history.current;
  if(h.siteId!==site.id)return;
  const stack=direction==='undo'?h.undo:h.redo;
  const restore=stack.pop();
  if(!restore)return;
  const issue=onChangeSite(restore);
  if(issue){stack.push(restore);setStatus(issue);return;}
  (direction==='undo'?h.redo:h.undo).push(site);
  setStatus(direction==='undo'?'Last blueprint change undone.':'Blueprint change redone.');
  setAnchor(null);
 };
 const modify=(fn:(old:HotelFloor)=>HotelFloor)=>{
  if(!site||!floor)return;
  try{const next=updateFloor(site,floorIndex,fn);const message=onChangeSite(next);if(!message)recordEdit(site);setStatus(message??'Blueprint updated. Approve construction when ready.');}catch(e){setStatus(e instanceof Error?e.message:'Invalid layout change.');}
 };
 const cellFromEvent=(e:PointerEvent<SVGSVGElement>):Cell|null=>{
  if(!site)return null;
  const rect=e.currentTarget.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*site.width;
  const y=(e.clientY-rect.top)/rect.height*site.height;
  if(x<0||y<0||x>=site.width||y>=site.height)return null;
  return {x:Math.floor(x),y:Math.floor(y),fx:x-Math.floor(x),fy:y-Math.floor(y)};
 };
 const makeRoom=(a:Cell,b:Cell)=>{
  if(!site||!floor)return;
  const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),width=Math.abs(a.x-b.x)+1,height=Math.abs(a.y-b.y)+1;
  const label=category[roomType]+' '+(floor.rooms.filter(r=>r.type===roomType).length+1);
  modify(f=>drawRoom(f,{id:id(),name:label,type:roomType,x,y,width,height},site));
  setAnchor(null);
 };
 const interact=(where:Cell,from:Cell|null)=>{
  if(!site||!floor||active)return;
  if(tool==='select'){const room=floor.rooms.find(r=>where.x>=r.x&&where.x<r.x+r.width&&where.y>=r.y&&where.y<r.y+r.height);setStatus(room?room.name+' · '+(roomIssues(floor,room).join(', ')||'Furnished'):'Tap a room to inspect it.');return;}
  if(tool==='room'){
   if(from&&(from.x!==where.x||from.y!==where.y)){makeRoom(from,where);return;}
   if(anchor){makeRoom(anchor,where);return;}
   setAnchor(where);setStatus('Choose the opposite corner, or drag to draw a room.');return;
  }
  if(tool==='furniture'){
   modify(f=>placeFurniture(f,{id:id(),code:itemCode,x:where.x,y:where.y,rotated:rotate},site));
   return;
  }
  if(tool==='wall'||tool==='door'){
   const distances=[where.fy,1-where.fx,1-where.fy,where.fx];
   const edge=distances.indexOf(Math.min(...distances));
   const wall:Wall={id:id(),x:edge===1?where.x+1:where.x,y:edge===2?where.y+1:where.y,
    orientation:edge%2===0?'h':'v',type:tool==='door'?'door':'wall'};
   modify(f=>toggleWall(f,wall,site));return;
  }
  if(tool==='erase'){
   const obj=[...floor.objects].reverse().find(o=>{const sz=furnitureSize(o);return where.x>=o.x&&where.y>=o.y&&where.x<o.x+sz.width&&where.y<o.y+sz.height;});
   if(obj){modify(f=>({...f,objects:f.objects.filter(o=>o.id!==obj.id)}));return;}
   const wall=floor.walls.find(w=>w.orientation==='h'?Math.abs(w.y-(where.y+where.fy))<0.3&&w.x===where.x:Math.abs(w.x-(where.x+where.fx))<0.3&&w.y===where.y);
   if(wall){modify(f=>({...f,walls:f.walls.filter(w=>w.id!==wall.id)}));return;}
   const room=floor.rooms.find(r=>where.x>=r.x&&where.x<r.x+r.width&&where.y>=r.y&&where.y<r.y+r.height);
   if(room){modify(f=>({...f,rooms:f.rooms.filter(r=>r.id!==room.id),objects:f.objects.filter(o=>!(o.x>=room.x&&o.y>=room.y&&o.x<room.x+room.width&&o.y<room.y+room.height))}));return;}
   setStatus('Nothing to remove at this position.');
  }
 };
 const duplicateRoom=(roomId:string)=>{
  if(!site||!floor||active)return;
  const original=floor.rooms.find(r=>r.id===roomId);
  if(!original)return;
  const originals=floor.objects.filter(o=>o.x>=original.x&&o.y>=original.y&&o.x<original.x+original.width&&o.y<original.y+original.height);
  for(let y=0;y<=site.height-original.height;y++){
   for(let x=0;x<=site.width-original.width;x++){
    const room={...original,id:id(),name:category[original.type]+' '+(floor.rooms.filter(r=>r.type===original.type).length+1),x,y};
    let updated:HotelFloor;
    try{
     updated=drawRoom(floor,room,site);
     for(const o of originals)updated=placeFurniture(updated,{...o,id:id(),x:o.x-original.x+x,y:o.y-original.y+y},site);
    }catch{continue;}
    modify(()=>updated);
    setStatus('Room layout and furnishings duplicated. Approve construction to purchase the additional items.');
    return;
   }
  }
  setStatus('No space for another room of this size on this floor.');
 };
 const projectStart=()=>{
  if(!site)return;
  const feedback=onStartProject(site.id,method);
  setStatus(feedback??'Construction approved. Materials ordered and work scheduled.');
  if(!feedback)setTab('projects');
 };
 const addBuildingFloor=()=>{
  if(!site)return;
  try{
   const next=addFloor(site);const msg=onChangeSite(next);
   setStatus(msg??'New floor added to the blueprint.');if(!msg){recordEdit(site);setFloorIndex(next.draft.length-1);}
  }catch(e){setStatus(e instanceof Error?e.message:'Could not add floor.');}
 };
 return <section className="internal-builder">
  <header className="ib-header"><span className="ib-header-icon"><Building2 size={22}/></span><div><h1>Building Development</h1><p>Your hotels, headquarters &amp; construction</p></div></header>
  <nav className="ib-tabs" aria-label="Hotel development sections">
   {([['sites','Properties',Building2],['blueprint','2D builder',Grid2X2],['projects','Construction',HardHat],['supplies','Supplies',Package],['crew','My crew',Users]] as const).map(([idValue,label,Icon])=><button type="button" key={idValue} className={tab===idValue?'selected':''} aria-current={tab===idValue?'page':undefined} onClick={()=>{setTab(idValue);setStatus('');setAnchor(null);}}><Icon size={17}/><span>{label}</span></button>)}
  </nav>
  {(status||error)&&<div className="ib-feedback" role="status"><AlertCircle size={15}/>{error||status}</div>}
  {!company&&<div className="ib-empty"><Landmark size={22}/><strong>Create a company to develop hotels.</strong><p>Your building projects use the company treasury and game clock.</p></div>}
  {company&&tab==='sites'&&<div className="ib-section">
   <div className="ib-heading"><div><h2>My development sites</h2><small>Construct, renovate and furnish your own buildings</small></div><div className="ib-heading-actions"><button type="button" className="ib-secondary" onClick={()=>{const msg=onAddHeadquarters();if(msg)setStatus(msg);else{setSelectedId('hq:'+company.id);setFloorIndex(0);setTab('blueprint');setStatus('HQ building blueprint opened.');}}}><Landmark size={15}/> Headquarters</button><button type="button" className="ib-primary" onClick={onSelectLand}><MapPin size={16}/> Buy land</button></div></div>
   <div className="ib-stat-row"><span><strong>{sites.length}</strong> sites</span><span><strong>{sites.filter(s=>s.projects.some(p=>p.status==='active')).length}</strong> under construction</span><span><strong>{euros(Math.round(cash*100))}</strong> cash</span></div>
   <div className="ib-cards">
    {sites.map(s=><article key={s.id} className="ib-site-card"><span className="ib-site-icon"><Building2 size={20}/></span><div><strong>{s.name}</strong><small>{s.kind==='new'?'Own development plot':s.kind==='headquarters'?'Company headquarters':'Existing hotel renovation'} · {s.draft.length} floor(s)</small><small>{s.projects.some(p=>p.status==='active')?'Construction underway':s.projects.length?'Built / ready for further work':'Blueprint planning'}</small></div><button className="ib-primary" onClick={()=>choose(s.id)}>Open <ChevronLeft size={15}/></button></article>)}
    {sites.length===0&&<div className="ib-empty"><Building2 size={23}/><strong>No construction sites yet</strong><p>Open your headquarters, buy a simulated development plot or renovate a hotel you control.</p></div>}
   </div>
   <div className="ib-heading"><div><h2>Hotels you control</h2><small>At least 50% ownership required to plan a renovation</small></div></div>
   {available.length===0?<p className="ib-muted">No unregistered controlling hotel interests. Buy shares in Investments to acquire an existing hotel.</p>:<div className="ib-cards">{available.map(h=><article key={h.id} className="ib-site-card"><span className="ib-site-icon"><Building2 size={19}/></span><div><strong>{h.name}</strong><small>{Math.round(ownership(h)*100)}% owned · Existing hotel</small></div><button type="button" onClick={()=>{const message=onAdoptHolding(h.id);if(message)setStatus(message);else{setSelectedId('hotel:'+h.id);setTab('blueprint');setStatus('Hotel added. Its original investment income remains separate from building plans.');}}}>Plan renovation</button></article>)}</div>}
   <p className="ib-note">Plots are simulated development opportunities at selected map locations, not real-world land listings. Existing passive hotel shares are preserved; hotel guest operations will be developed separately.</p>
  </div>}
  {company&&tab==='blueprint'&&(!site||!floor)?<div className="ib-empty"><Grid2X2 size={22}/><strong>Select a building site first</strong><button className="ib-primary" onClick={()=>setTab('sites')}>Choose property</button></div>:null}
  {company&&tab==='blueprint'&&site&&floor&&<div className="ib-section ib-editor">
   <div className="ib-heading"><div><h2>{site.name}</h2><small>{site.width} × {site.height} m · {site.kind==='new'?'New development':site.kind==='headquarters'?'Headquarters interior':'Hotel renovation'}</small></div><button className="ib-secondary" onClick={()=>setTab('sites')}>All sites</button></div>
   <div className="ib-floor-bar"><div className="ib-floor-switch"><Layers3 size={15}/><select aria-label="Selected floor" value={floorIndex} onChange={e=>{setFloorIndex(Number(e.target.value));setAnchor(null);}}>{site.draft.map((f,i)=><option key={f.id} value={i}>{f.label}</option>)}</select></div><button type="button" disabled={active!==undefined||site.draft.length>=MAX_FLOORS} onClick={addBuildingFloor}><Plus size={14}/> Add floor</button><div className="ib-history-controls"><button type="button" title="Undo" aria-label="Undo blueprint change" disabled={!!active||history.current.siteId!==site.id||!history.current.undo.length} onClick={()=>restoreHistory('undo')}><Undo2 size={15}/></button><button type="button" title="Redo" aria-label="Redo blueprint change" disabled={!!active||history.current.siteId!==site.id||!history.current.redo.length} onClick={()=>restoreHistory('redo')}><Redo2 size={15}/></button></div><div className="ib-zoom"><button onClick={()=>setZoom(v=>Math.max(.7,Math.round((v-.15)*100)/100))} aria-label="Zoom out">−</button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(v=>Math.min(1.8,Math.round((v+.15)*100)/100))} aria-label="Zoom in">+</button></div></div>
   <div className="ib-tools" role="group" aria-label="Building tools">
    {([['select','Inspect',Grid2X2],['room','Room',Plus],['wall','Wall',Hammer],['door','Door',DoorOpen],['furniture','Furnish',Sofa],['erase','Erase',Trash2]] as const).map(([key,label,Icon])=><button type="button" key={key} disabled={!!active&&key!=='select'} className={tool===key?'selected':''} onClick={()=>{setTool(key);setAnchor(null);}}><Icon size={17}/><span>{label}</span></button>)}
   </div>
   {tool==='room'&&<div className="ib-controls"><label>Room type<select value={roomType} disabled={!!active} onChange={e=>{setRoomType(e.target.value as RoomType);setAnchor(null);}}>{roomTypes.map(r=><option key={r.id} value={r.id}>{r.label} · min {r.minWidth}×{r.minHeight}</option>)}</select></label><span className="ib-muted">Drag corner to corner, or tap two corners</span></div>}
   {tool==='furniture'&&<div className="ib-controls"><label>Furniture<select value={itemCode} disabled={!!active} onChange={e=>setItemCode(e.target.value as FurnitureCode)}>{furniture.map(f=><option key={f.code} value={f.code}>{f.name} · {euros(f.priceCents)}</option>)}</select></label><button type="button" onClick={()=>setRotate(v=>!v)} className={rotate?'selected ib-secondary':'ib-secondary'}><RotateCw size={15}/> {rotate?'Rotated':'Rotate'}</button><span className="ib-muted">{selectedFurniture.width} × {selectedFurniture.height} cells</span></div>}
   {(tool==='wall'||tool==='door')&&<div className="ib-hint">Tap near the edge of a grid cell to {tool==='door'?'add or remove a doorway':'draw or remove a wall segment'}.</div>}
   {active&&<div className="ib-hint">The blueprint is locked while construction is underway. Inspection is still available.</div>}
   <div className="ib-plan-scroller"><svg className="ib-floor-canvas" width={Math.round(site.width*30*zoom)} height={Math.round(site.height*30*zoom)} viewBox={`0 0 ${site.width} ${site.height}`} aria-label={floor.label+' building plan'} onPointerDown={e=>{pointer.current=cellFromEvent(e);}} onPointerUp={e=>{const end=cellFromEvent(e);if(end)interact(end,pointer.current);pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}} style={{touchAction:tool==='select'?'pan-x pan-y':'none'}}>
     <rect width={site.width} height={site.height} fill="#111c31"/>
     {Array.from({length:site.width+1},(_,i)=><line key={'x'+i} x1={i} y1={0} x2={i} y2={site.height} stroke="#42506c" strokeWidth=".025"/>)}
     {Array.from({length:site.height+1},(_,i)=><line key={'y'+i} x1={0} y1={i} x2={site.width} y2={i} stroke="#42506c" strokeWidth=".025"/>)}
     {floor.rooms.map(r=><g key={r.id}><rect x={r.x} y={r.y} width={r.width} height={r.height} fill={tone[r.type]} fillOpacity=".87" stroke="#d3d5e6" strokeWidth=".10"/><text x={r.x+r.width/2} y={r.y+.65} fontSize=".40" textAnchor="middle" fill="#ffffff">{r.name}</text></g>)}
     {floor.walls.map(w=><line key={w.id} x1={w.x} y1={w.y} x2={w.orientation==='h'?w.x+1:w.x} y2={w.orientation==='v'?w.y+1:w.y} stroke={w.type==='door'?'#89d9b6':'#f5eeff'} strokeWidth={w.type==='door'?'.22':'.14'} strokeDasharray={w.type==='door'?'.26 .12':undefined}/>)}
     {floor.objects.map(o=>{const size=furnitureSize(o);return <g key={o.id}><rect x={o.x+.08} y={o.y+.08} width={size.width-.16} height={size.height-.16} rx=".13" fill="#c1a0ed" stroke="#e7daff" strokeWidth=".035"/><text x={o.x+size.width/2} y={o.y+size.height/2+.1} fontSize=".35" fill="#201735" textAnchor="middle">{furniture.find(f=>f.code===o.code)?.name.slice(0,11)}</text></g>})}
     {anchor&&<rect x={anchor.x} y={anchor.y} width="1" height="1" fill="none" stroke="#ffdc84" strokeDasharray=".15 .12" strokeWidth=".1"/>}
    </svg></div>
   <div className="ib-plan-footer"><span>{floor.rooms.length} rooms · {floor.objects.length} objects · {floor.walls.length} custom walls</span><span>Grid: 1 m · {floor.label}</span></div>
   <div className="ib-heading"><div><h2>Room requirements</h2><small>Check equipment before opening your hotel</small></div></div>
   <div className="ib-room-list">{floor.rooms.map(r=>{const issues=roomIssues(floor,r);return <div className="ib-room" key={r.id}><span className="ib-room-dot" style={{background:tone[r.type]}}/><div><strong>{r.name}</strong><small>{r.width}×{r.height} m · {r.type}</small></div><span className={issues.length?'ib-room-warning':'ib-room-success'}>{issues.length?issues[0]:'Equipped'}</span><button className="ib-room-duplicate" aria-label={'Duplicate '+r.name} title={'Duplicate '+r.name} disabled={!!active} onClick={()=>duplicateRoom(r.id)}><Copy size={16}/></button></div>})}{floor.rooms.length===0&&<p className="ib-muted">Use Draw Room to add your first room.</p>}</div>
   <div className="ib-build-actions"><div><strong>Approve the blueprint</strong><small>Check a material quote, choose workers and start a timed project.</small></div><button className="ib-primary" disabled={!!active} onClick={()=>setTab('projects')}><HardHat size={15}/> View quote</button></div>
  </div>}
  {company&&tab==='projects'&&<div className="ib-section">
   <div className="ib-heading"><div><h2>Construction projects</h2><small>Material deliveries, work schedules and budgets</small></div></div>
   {site&&<div className="ib-project-shell"><div className="ib-heading"><div><h2>{site.name}</h2><small>{active?'Construction in progress':'New work proposal'}</small></div><button className="ib-secondary" onClick={()=>setTab('blueprint')}>Floor plan</button></div>
    {active?<div className="ib-progress-panel"><div className="ib-project-row"><strong>{gameHour<active.deliveryHour?'Materials in transit':'Construction underway'}</strong><span>{progressProject(active,gameHour).toFixed(0)}%</span></div><div className="ib-meter"><span style={{width:progressProject(active,gameHour)+'%'}}/></div><div className="ib-project-row"><small>Delivery at game hour {active.deliveryHour}</small><small>Completion hour {active.finishHour}</small></div><p className="ib-note">Materials and project charges were paid when work was approved. Own crews also draw hourly wages.</p></div>:
    <>
     <div className="ib-methods"><label>Construction method<select value={method} onChange={e=>setMethod(e.target.value as TradeMode)}><option value="contractor">Hire external contractor</option><option value="own">Use my construction crew ({state.workers} workers)</option></select></label></div>
     {quote&&quote.changes>0?<><div className="ib-costs"><div><span>Materials & groundworks</span><strong>{euros(quote.materialCents)}</strong></div><div><span>Furniture & equipment</span><strong>{euros(quote.furnitureCents)}</strong></div><div><span>{method==='own'?'Site tools / equipment':'Contractor labour'}</span><strong>{euros(quote.labourCents)}</strong></div><div className="ib-total"><span>Pay now</span><strong>{euros(quote.totalCents)}</strong></div></div>
      <details className="ib-material-details"><summary><Package size={16}/> Material order · {quote.materials.length} items</summary><div>{quote.materials.map(m=><div key={m.id}><span>{m.name} · {m.quantity} {m.unit}</span><strong>{euros(m.totalCents)}</strong></div>)}</div></details>
      <div className="ib-stat-row"><span><Clock3 size={14}/> {quote.deliveryHours}h delivery</span><span><HardHat size={14}/> {quote.constructionHours}h work</span><span><ShoppingCart size={14}/> {euros(quote.totalCents)}</span></div>
      <button type="button" className="ib-primary ib-full" disabled={cash*100<quote.totalCents} onClick={projectStart}>{cash*100<quote.totalCents?'Insufficient cash':'Order materials & start construction'}</button>
     </>:<div className="ib-empty"><HardHat size={23}/><strong>{method==='own'&&state.workers<2?'Hire at least two workers':'No pending construction work'}</strong><p>{method==='own'&&state.workers<2?'Your own crew requires at least two employees.':'Draw rooms, place furniture or add a new floor to create a project quote.'}</p></div>}
    </>}
   </div>}
   {!site&&<div className="ib-empty"><Building2 size={23}/><strong>Choose a property to manage construction</strong><button onClick={()=>setTab('sites')} className="ib-secondary">My properties</button></div>}
   {site&&site.projects.length>0&&<><div className="ib-heading"><h2>Project history</h2></div><div className="ib-cards">{[...site.projects].reverse().slice(0,12).map(p=><div key={p.id} className="ib-history-row"><span>{p.status==='complete'?<CheckCircle2 size={17}/>:<Clock3 size={17}/>}</span><div><strong>{p.method==='own'?'Own construction crew':'Contracted construction'}</strong><small>{p.status==='complete'?'Completed':'In progress'} · Game hour {p.startHour}</small></div><strong>{euros(p.budgetCents)}</strong></div>)}</div></>}
  </div>}
  {company&&tab==='supplies'&&<div className="ib-section">
   <div className="ib-heading"><div><h2>Kitchen, bar &amp; housekeeping</h2><small>Order products, receive deliveries and maintain separate building stock</small></div></div>
   {!site?<div className="ib-empty"><Package size={23}/><strong>Select a building first</strong><button type="button" className="ib-secondary" onClick={()=>setTab('sites')}>My buildings</button></div>:
   <div className="ib-supplies">
    <div className="ib-heading"><div><h2>{site.name}</h2><small>Stock is purchased from the same company treasury</small></div></div>
    <div className="ib-inventory-grid">
     {supplies.map(item=><div key={item.code} className="ib-inventory-row"><div><strong>{item.name}</strong><small>{item.category} · {euros(item.unitCents)} / {item.unit}</small></div><span>{supplyStock(site,item.code,gameHour)} {item.unit}</span></div>)}
    </div>
    <div className="ib-supply-order">
     <div><strong><ShoppingCart size={15}/> New supplier order</strong><small>Goods arrive after the listed number of simulated hours.</small></div>
     <div className="ib-controls">
      <label>Product<select value={supplyCode} onChange={e=>setSupplyCode(e.target.value as SupplyCode)}>{supplies.map(i=><option value={i.code} key={i.code}>{i.name} · {i.category}</option>)}</select></label>
      <label>Quantity<input type="number" inputMode="numeric" min="1" max="200" step="1" value={supplyQuantity} onChange={e=>setSupplyQuantity(Number(e.target.value))}/></label>
     </div>
     <div className="ib-stat-row"><span><strong>{euros(selectedSupply.unitCents*supplyQuantity)}</strong> total</span><span><Clock3 size={14}/> {selectedSupply.deliveryHours} game hours delivery</span><span>Perishable life {Math.round(selectedSupply.expiryHours/24)} game days</span></div>
     <button className="ib-primary ib-full" disabled={!Number.isInteger(supplyQuantity)||supplyQuantity<1||supplyQuantity>200||cash*100<selectedSupply.unitCents*supplyQuantity} onClick={()=>{const msg=onOrderSupplies(site.id,supplyCode,supplyQuantity);setStatus(msg??'Order placed. Items will arrive on the game clock.');}}><ShoppingCart size={15}/> Place supply order</button>
    </div>
    <div className="ib-heading"><div><h2>Deliveries</h2><small>Only completed deliveries enter your physical inventory</small></div></div>
    {(site.supplyOrders??[]).length?<div className="ib-cards">{[...(site.supplyOrders??[])].reverse().slice(0,30).map(order=><div className="ib-history-row" key={order.id}><span>{order.status==='delivered'?<CheckCircle2 size={16}/>:<Clock3 size={16}/>}</span><div><strong>{supplies.find(item=>item.code===order.code)?.name??order.code} × {order.quantity}</strong><small>{order.status==='delivered'?'Delivered':'In transit'} · Arrival game hour {order.deliveryHour}</small></div><strong>{euros(order.quantity*order.unitCents)}</strong></div>)}</div>:<p className="ib-muted">No supply orders yet.</p>}
    <p className="ib-note">Kitchen items require a constructed kitchen, bar items a bar, and housekeeping goods a storage room. Storage capacity is limited. Food expires. Guest consumption, recipes and restaurant sales will be added in a later operating stage.</p>
   </div>}
  </div>}
  {company&&tab==='crew'&&<div className="ib-section">
   <div className="ib-heading"><div><h2>Internal construction team</h2><small>Hire workers to build your own developments</small></div></div>
   <div className="ib-stat-row"><span><Users size={14}/><strong>{state.workers}</strong> workers</span><span><strong>{euros(state.workers*WORKER_HOURLY_CENTS)}</strong>/game hour payroll</span></div>
   <article className="ib-crew-card"><span className="ib-site-icon"><Users size={23}/></span><div><strong>Construction worker</strong><small>€{Math.round(RECRUITMENT_CENTS/100).toLocaleString('en-IE')} hiring & training · {euros(WORKER_HOURLY_CENTS)}/game hour</small><small>Workers are paid every simulated hour, including while idle.</small></div><button type="button" className="ib-primary" disabled={cash*100<RECRUITMENT_CENTS} onClick={()=>{const msg=onHireWorker();setStatus(msg??'Worker joined your internal construction division.');}}><Plus size={14}/> Hire</button></article>
   <p className="ib-note">Hiring is optional. External contractors charge fixed project fees. Your own team requires at least two workers and incurs continuing wages, so schedule jobs carefully.</p>
  </div>}
 </section>;
}
