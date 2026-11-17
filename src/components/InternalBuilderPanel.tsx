import {useEffect,useLayoutEffect,useMemo,useRef,useState,type PointerEvent} from 'react';
import {Building2,Plus,HardHat,Hammer,Layers3,DoorOpen,Sofa,Trash2,RotateCw,MapPin,ShoppingCart,Ship,Truck,Users,Clock3,ChevronLeft,Package,CheckCircle2,AlertCircle,Grid2X2,Landmark,Undo2,Redo2,Copy,Hand,ArrowLeft,ArrowRight,ArrowUp,ArrowDown,Crosshair,BedDouble,UtensilsCrossed,Wine,UserCheck,TrendingUp,CalendarClock,ShieldCheck} from 'lucide-react';
import type {Company} from '../company';
import type {PropertyPortfolio} from '../investments';
import {ownership} from '../investments';
import {
 type HotelSite,type HotelFloor,type RoomType,type BuilderTool,type FurnitureCode,type TradeMode,type ConstructionState,
 type Wall,
 roomTypes,furniture,drawRoom,toggleWall,placeFurniture,updateFloor,addFloor,constructionQuote,progressProject,
 roomIssues,furnitureSize,supplies,supplyStock,hotelPlotCostCents,validHotelPlotSize,type HotelPlotSize,type SupplyCode,euros,RECRUITMENT_CENTS,WORKER_HOURLY_CENTS,MAX_FLOORS
} from '../internalConstruction';
import {defaultHotelOperations,hotelActiveAt,openingIssues,roomInventory,hotelRoles,HOTEL_STAFF_HIRING_CENTS,
 type HotelRole} from '../hotelOperations';
import {planZoom,zoomScrollAt,pinchViewport,type PinchOrigin,type PlanScroll} from './blueprintViewport';
import {analyzeHotelFloorAccess,suggestRoomAccessDoor,toggleHotelAccessDoor,type AccessStatus} from '../hotelAccess';
import {BLUEPRINT_ROOM_TEMPLATES,addBlueprintTemplate,editBlueprintRoom,hotelBlueprintHealth,
 type BlueprintRoomGeometry,type RoomTemplateId,
 editBlueprintFurniture,furnitureAtCell,furnitureDragPosition,hotelGuestRoomQuality} from '../hotelBlueprintEditing';
import {freightStage,freightStatusLabel,freightProgress} from '../constructionLogistics';
import {formatConstructionDate,milestoneCountdown} from '../constructionTime';
import './internal-builder.css';
type Props={
 company:Company|null;state:ConstructionState;portfolio:PropertyPortfolio;gameHour:number;gameNowHour:number;cash:number;error:string;
 onSelectLand:(size:HotelPlotSize)=>void;onAddHeadquarters:()=>string|null;onAdoptHolding:(id:string)=>string|null;onChangeSite:(site:HotelSite)=>string|null;
 onStartProject:(id:string,method:TradeMode)=>string|null;onAssignFreight:(projectId:string)=>string|null;onTrackFreight:(projectId:string)=>void;onOrderSupplies:(siteId:string,code:SupplyCode,quantity:number)=>string|null;onHireWorker:()=>string|null;onDismissWorker:()=>string|null;
 onHotelSetting:(siteId:string,key:HotelRole|'rateCents'|'breakfastPriceCents'|'dinnerPriceCents'|'drinkPriceCents',value:number)=>string|null;
 onHotelOpening:(siteId:string,open:boolean)=>string|null;
};
type Tab='sites'|'blueprint'|'projects'|'operations'|'supplies'|'crew';
const tone:Record<RoomType,string>={guest:'#38557a',bathroom:'#4b6680',kitchen:'#65516f',restaurant:'#695d81',bar:'#66486b',lobby:'#3f6672',storage:'#4c5d65',staff:'#4d5a79',corridor:'#414c64',office:'#445a7a',meeting:'#535079'};
const category:Record<RoomType,string>={guest:'Guest room',bathroom:'Bathroom',kitchen:'Kitchen',restaurant:'Restaurant',bar:'Bar',lobby:'Lobby',storage:'Storage',staff:'Staff room',corridor:'Corridor',office:'Office',meeting:'Meeting room'};
type Cell={x:number;y:number;fx:number;fy:number};
const id=()=>crypto.randomUUID();
const exactEuro=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
function PriceInput({title,cents,minimum,maximum,onSave}:{
 title:string;cents:number;minimum:number;maximum:number;onSave:(cents:number)=>void;
}){
 const [draft,setDraft]=useState(String(cents/100));
 useEffect(()=>setDraft(String(cents/100)),[cents]);
 const commit=()=>{
  const value=Number(draft);
  if(!Number.isFinite(value)||value<minimum||value>maximum){setDraft(String(cents/100));return;}
  const next=Math.round(value*100);
  if(next!==cents)onSave(next);
 };
 return <label className="ib-hotel-price">
  <span>{title}</span><div><span>€</span><input aria-label={title+' price in euro'} type="number" inputMode="decimal" min={minimum} max={maximum} step="1" value={draft} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/></div>
 </label>;
}
export default function InternalBuilderPanel({company,state,portfolio,gameHour,gameNowHour,cash,error,onSelectLand,onAddHeadquarters,onAdoptHolding,onChangeSite,onStartProject,onAssignFreight,onTrackFreight,onOrderSupplies,onHireWorker,onDismissWorker,onHotelSetting,onHotelOpening}:Props){
 const [tab,setTab]=useState<Tab>('sites');
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [floorIndex,setFloorIndex]=useState(0);
 const [tool,setTool]=useState<BuilderTool|'select'|'pan'>('pan');
 const [roomType,setRoomType]=useState<RoomType>('guest');
 const [itemCode,setItemCode]=useState<FurnitureCode>('bed');
 const [rotate,setRotate]=useState(false);
 const [method,setMethod]=useState<TradeMode>('contractor');
 const [supplyCode,setSupplyCode]=useState<SupplyCode>('eggs');
 const [supplyQuantity,setSupplyQuantity]=useState(10);
 const [zoom,setZoom]=useState(1);
 const [plotSize,setPlotSize]=useState<HotelPlotSize>({width:24,height:16});
 const plotValid=validHotelPlotSize(plotSize);
 const plotPrice=plotValid?hotelPlotCostCents(plotSize):0;
 const [status,setStatus]=useState('');
 const [anchor,setAnchor]=useState<Cell|null>(null);
 const [selectedRoomId,setSelectedRoomId]=useState<string|null>(null);
 const [selectedFurnitureId,setSelectedFurnitureId]=useState<string|null>(null);
 const [showAccessOverlay,setShowAccessOverlay]=useState(true);
 const [furniturePreview,setFurniturePreview]=useState<{id:string;x:number;y:number}|null>(null);
 const scrollerRef=useRef<HTMLDivElement|null>(null);
 const zoomRef=useRef(zoom);zoomRef.current=zoom;
 const pendingScroll=useRef<PlanScroll|null>(null);
 const pinchOrigin=useRef<PinchOrigin|null>(null);
 type DragPointer={startX:number;startY:number;lastX:number;lastY:number;cell:Cell|null;moved:boolean;gesture:boolean;panOverride:boolean;
  furnitureId?:string;furnitureOrigin?:{x:number;y:number}};
 const pointers=useRef(new Map<number,DragPointer>());
 // Apply the scroll offset only once the SVG's new dimensions have committed.
 // Otherwise Safari clamps it to the old (smaller) scrollable area on zoom-in.
 useLayoutEffect(()=>{
  const next=pendingScroll.current,scroller=scrollerRef.current;
  if(!next||!scroller)return;
  pendingScroll.current=null;
  scroller.scrollLeft=next.left;
  scroller.scrollTop=next.top;
 },[zoom]);
 const zoomTo=(value:number,focus?:{x:number;y:number})=>{
  const scroller=scrollerRef.current;
  const next=planZoom(value);
  if(!scroller||next===zoomRef.current)return;
  pendingScroll.current=zoomScrollAt(
   {left:scroller.scrollLeft,top:scroller.scrollTop},zoomRef.current,next,
   focus??{x:scroller.clientWidth/2,y:scroller.clientHeight/2},
  );
  setZoom(next);
 };
 const panBy=(x:number,y:number)=>{
  scrollerRef.current?.scrollBy({left:x,top:y,behavior:'smooth'});
 };
 const centerPlan=()=>{
  const node=scrollerRef.current;
  if(!node)return;
  node.scrollTo({left:(node.scrollWidth-node.clientWidth)/2,
   top:(node.scrollHeight-node.clientHeight)/2,behavior:'smooth'});
 };

 const history=useRef<{siteId:string|null;undo:HotelSite[];redo:HotelSite[]}>({siteId:null,undo:[],redo:[]});
 const sites=Object.values(state.sites);
 const site=selectedId?state.sites[selectedId]??null:null;
 const floor=site?.draft[Math.min(floorIndex,site.draft.length-1)]??null;
 const selectedRoom=floor?.rooms.find(r=>r.id===selectedRoomId)??null;
 const selectedPlacedFurniture=floor?.objects.find(o=>o.id===selectedFurnitureId)??null;
 const selectedPlacedType=selectedPlacedFurniture?furniture.find(f=>f.code===selectedPlacedFurniture.code):null;
 const blueprintHealth=site&&floor?hotelBlueprintHealth(floor,site):null;
 const accessReport=useMemo(()=>site&&floor?
  analyzeHotelFloorAccess(floor,site,floorIndex):null,[site,floor,floorIndex]);
 const active=site?.projects.find(p=>p.status==='active');
 const quote=useMemo(()=>{if(!site||active)return null;try{return constructionQuote(site,method,state.workers);}catch{return null;}},[site,method,state.workers,active]);
 const selectedFurniture=furniture.find(f=>f.code===itemCode)!;
 const selectedSupply=supplies.find(f=>f.code===supplyCode)!;
 const operations=site?.operations??defaultHotelOperations(gameHour);
 const currentlyOpen=hotelActiveAt(site?.operations,gameHour);
 const preparedRooms=site&&site.kind!=='headquarters'?roomInventory(site,gameHour):null;
 const openProblems=site&&site.kind!=='headquarters'?openingIssues(site,gameHour):[];
 const operatedTotals=operations.totals;
 const operatedGross=operatedTotals.roomCents+operatedTotals.foodCents+operatedTotals.barCents;
 const operatedExpenses=operatedTotals.wagesCents+operatedTotals.utilitiesCents;
 const operatedQuality=preparedRooms?.readyRooms.length?
  Math.round(preparedRooms.readyRooms.reduce((total,item)=>total+
   hotelGuestRoomQuality(item.floor,item.room).score,0)/preparedRooms.readyRooms.length):null;
 const applyHotelSetting=(key:HotelRole|'rateCents'|'breakfastPriceCents'|'dinnerPriceCents'|'drinkPriceCents',value:number)=>{
  if(!site)return;
  const problem=onHotelSetting(site.id,key,value);
  setStatus(problem??'Hotel operating settings saved.');
 };
 const applyHotelStatus=()=>{
  if(!site)return;
  const problem=onHotelOpening(site.id,!currentlyOpen);
  setStatus(problem??(!currentlyOpen?'Hotel opened. Guest bookings begin on the next check-in cycle.':'Hotel closed to new guests. Your passive holdings resume their dividend model.'));
 };

 const available=Object.values(portfolio.holdings).filter(h=>h.kind==='hotel'&&ownership(h)>=0.5&&!sites.some(site=>site.sourceHoldingId===h.id));
 useEffect(()=>{if(!site&&sites.length&&selectedId===null){setSelectedId(sites[0].id);}},[site,sites.length,selectedId]);
 const choose=(idValue:string)=>{
  history.current={siteId:idValue,undo:[],redo:[]};
  pointers.current.clear();pinchOrigin.current=null;pendingScroll.current=null;
  setSelectedId(idValue);setFloorIndex(0);setAnchor(null);setSelectedRoomId(null);setSelectedFurnitureId(null);setFurniturePreview(null);setTab('blueprint');setStatus('');
  setTool('pan');setShowAccessOverlay(true);setZoom(1);
 };
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
  setAnchor(null);setSelectedRoomId(null);setSelectedFurnitureId(null);setFurniturePreview(null);
 };
 const modify=(fn:(old:HotelFloor)=>HotelFloor)=>{
  if(!site||!floor)return;
  try{const next=updateFloor(site,floorIndex,fn);const message=onChangeSite(next);if(!message)recordEdit(site);setStatus(message??'Blueprint updated. Approve construction when ready.');}catch(e){setStatus(e instanceof Error?e.message:'Invalid layout change.');}
 };
 const adjustPlacedFurniture=(changes:{x?:number;y?:number;rotated?:boolean})=>{
  if(!site||!selectedPlacedFurniture||active)return;
  const furnitureId=selectedPlacedFurniture.id;
  modify(f=>editBlueprintFurniture(f,site,furnitureId,changes));
 };
 const focusRoom=(room:HotelFloor['rooms'][number])=>{
  const scroller=scrollerRef.current;
  if(!scroller)return;
  const px=30*zoomRef.current;
  scroller.scrollTo({left:(room.x+room.width/2)*px-scroller.clientWidth/2,
   top:(room.y+room.height/2)*px-scroller.clientHeight/2,behavior:'smooth'});
 };
 const adjustSelectedRoom=(changes:Partial<BlueprintRoomGeometry>)=>{
  if(!site||!selectedRoom||active)return;
  modify(f=>editBlueprintRoom(f,site,selectedRoom.id,{
   x:changes.x??selectedRoom.x,y:changes.y??selectedRoom.y,
   width:changes.width??selectedRoom.width,height:changes.height??selectedRoom.height,
  }));
 };
 const addSuggestedDoor=(roomId:string)=>{
  if(!site||!floor||active)return;
  const edge=suggestRoomAccessDoor(floor,site,roomId);
  if(!edge){setStatus('No clear adjacent corridor, lobby, or exterior entrance available. Move the room or add a corridor first.');return;}
  modify(f=>toggleHotelAccessDoor(f,site,{...edge,id:id(),type:'door'}));
 };
 const enableAccessOnExisting=()=>{
  if(!site||site.accessRulesVersion===1||site.kind==='headquarters'||active||currentlyOpen)return;
  const result=onChangeSite({...site,accessRulesVersion:1});
  setStatus(result??'Room-access rules enabled. Existing layouts remain unchanged until you edit and approve construction.');
 };
 const addTemplate=(templateId:RoomTemplateId)=>{
  if(!site||!floor||active)return;
  const newRoomId=id();
  try{
   const next=updateFloor(site,floorIndex,f=>addBlueprintTemplate(
    f,site,templateId,newRoomId,()=>id()));
   const message=onChangeSite(next);
   if(message){setStatus(message);return;}
   recordEdit(site);
   setSelectedRoomId(newRoomId);setSelectedFurnitureId(null);setTool('select');setAnchor(null);
   setStatus('Furnished room placed. Select it to resize or move. Construction costs will be quoted before approval.');
  }catch(e){setStatus(e instanceof Error?e.message:'Unable to fit this room template.');}
 };
 const cellFromEvent=(e:PointerEvent<SVGSVGElement>):Cell|null=>{
  if(!site)return null;
  const rect=e.currentTarget.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*site.width;
  const y=(e.clientY-rect.top)/rect.height*site.height;
  if(x<0||y<0||x>=site.width||y>=site.height)return null;
  return {x:Math.floor(x),y:Math.floor(y),fx:x-Math.floor(x),fy:y-Math.floor(y)};
 };
 const onPlanPointerDown=(e:PointerEvent<SVGSVGElement>)=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  const cell=cellFromEvent(e);
  const candidate=cell&&(tool==='select'||tool==='furniture')&&!active&&!e.shiftKey&&floor?
   furnitureAtCell(floor,cell.x,cell.y):null;
  const point:DragPointer={startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,
   cell,moved:false,gesture:false,panOverride:e.shiftKey,
   furnitureId:candidate?.id,furnitureOrigin:candidate?{x:candidate.x,y:candidate.y}:undefined};
  if(candidate){setSelectedFurnitureId(candidate.id);setSelectedRoomId(null);}
  pointers.current.set(e.pointerId,point);
  if(pointers.current.size>1){
   setFurniturePreview(null);
   for(const p of pointers.current.values())p.gesture=true;
   const [first,second]=[...pointers.current.values()];
   const box=scrollerRef.current;
   if(first&&second&&box){
    const bounds=box.getBoundingClientRect();
    pinchOrigin.current={
     zoom:zoomRef.current,
     distance:Math.hypot(first.lastX-second.lastX,first.lastY-second.lastY),
     scroll:{left:box.scrollLeft,top:box.scrollTop},
     center:{x:(first.lastX+second.lastX)/2-bounds.left,
      y:(first.lastY+second.lastY)/2-bounds.top},
    };
   }
  }
  try{e.currentTarget.setPointerCapture(e.pointerId);}
  catch{/* iOS may cancel capture during app switching. */}
 };
 const onPlanPointerMove=(e:PointerEvent<SVGSVGElement>)=>{
  const point=pointers.current.get(e.pointerId),scroller=scrollerRef.current;
  if(!point||!scroller)return;
  const dx=e.clientX-point.lastX,dy=e.clientY-point.lastY;
  point.lastX=e.clientX;point.lastY=e.clientY;
  if(Math.hypot(e.clientX-point.startX,e.clientY-point.startY)>7)point.moved=true;
  if(pointers.current.size>1){
   setFurniturePreview(null);
   for(const p of pointers.current.values())p.gesture=true;
   const [first,second]=[...pointers.current.values()];
   const origin=pinchOrigin.current;
   if(first&&second&&origin){
    const bounds=scroller.getBoundingClientRect();
    const view=pinchViewport(origin,{
     distance:Math.hypot(first.lastX-second.lastX,first.lastY-second.lastY),
     center:{x:(first.lastX+second.lastX)/2-bounds.left,
      y:(first.lastY+second.lastY)/2-bounds.top},
    });
    if(view.zoom!==zoomRef.current){
     pendingScroll.current=view.scroll;
     setZoom(view.zoom);
    }else{
     // Two-finger scrolling also works at maximum/minimum zoom.
     pendingScroll.current=null;
     scroller.scrollLeft=view.scroll.left;scroller.scrollTop=view.scroll.top;
    }
   }
   return;
  }
  // After a pinch, ignore the remaining pointer until it has been lifted.
  if(point.gesture)return;
  // Existing furniture can be dragged in Inspect or Furnish mode. Commit only
  // on pointer-up, so a long gesture never generates repeated saves/quotes.
  if(point.furnitureId&&point.furnitureOrigin&&point.moved){
   const target=furnitureDragPosition(point.furnitureOrigin,
    {x:e.clientX-point.startX,y:e.clientY-point.startY},zoomRef.current);
   setFurniturePreview(current=>current&&current.id===point.furnitureId&&
    current.x===target.x&&current.y===target.y?current:
    {id:point.furnitureId!,...target});
   return;
  }
  if(point.furnitureId)return;
  // Room drawing uses one finger to draw. In every other tool, swiping
  // moves the viewport instead of accidentally placing multiple objects.
  if(tool!=='room'||point.panOverride){
   if(point.moved||tool==='pan'||point.panOverride){
    scroller.scrollLeft-=dx;scroller.scrollTop-=dy;
   }
  }
 };
 const onPlanPointerEnd=(e:PointerEvent<SVGSVGElement>,cancel=false)=>{
  const point=pointers.current.get(e.pointerId);
  if(!point)return;
  pointers.current.delete(e.pointerId);
  if(pointers.current.size<2)pinchOrigin.current=null;
  try{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}
  catch{/* Cancelled capture. */}
  setFurniturePreview(null);
  if(cancel||point.gesture||point.panOverride)return;
  if(point.furnitureId&&point.furnitureOrigin){
   setSelectedFurnitureId(point.furnitureId);setSelectedRoomId(null);
   if(point.moved&&site&&!active){
    const target=furnitureDragPosition(point.furnitureOrigin,
     {x:e.clientX-point.startX,y:e.clientY-point.startY},zoomRef.current);
    if(target.x!==point.furnitureOrigin.x||target.y!==point.furnitureOrigin.y)
     modify(f=>editBlueprintFurniture(f,site,point.furnitureId!,target));
   }
   return;
  }
  if(tool==='pan'||(point.moved&&tool!=='room'))return;
  const at=cellFromEvent(e);
  if(at)interact(at,point.cell);
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
  if(tool==='select'){const room=floor.rooms.find(r=>where.x>=r.x&&where.x<r.x+r.width&&where.y>=r.y&&where.y<r.y+r.height);setSelectedFurnitureId(null);setSelectedRoomId(room?.id??null);setStatus(room?room.name+' · '+(roomIssues(floor,room).join(', ')||'Furnished'):'Tap a room to inspect it.');return;}
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
   modify(f=>tool==='door'?toggleHotelAccessDoor(f,site,wall):toggleWall(f,wall,site));return;
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
  setStatus(feedback??'Construction freight booked. Ship arrival, harbour unloading and truck delivery are scheduled before building begins.');
  if(!feedback){history.current={siteId:site.id,undo:[],redo:[]};setTab('projects');}
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
   {([['sites','Properties',Building2],['blueprint','2D builder',Grid2X2],['projects','Construction',HardHat],['operations','Operations',UserCheck],['supplies','Supplies',Package],['crew','My crew',Users]] as const).map(([idValue,label,Icon])=><button type="button" key={idValue} className={tab===idValue?'selected':''} aria-current={tab===idValue?'page':undefined} onClick={()=>{setTab(idValue);setStatus('');setAnchor(null);}}><Icon size={17}/><span>{label}</span></button>)}
  </nav>
  {(status||error)&&<div className="ib-feedback" role="status"><AlertCircle size={15}/>{error||status}</div>}
  {!company&&<div className="ib-empty"><Landmark size={22}/><strong>Create a company to develop hotels.</strong><p>Your building projects use the company treasury and game clock.</p></div>}
  {company&&tab==='sites'&&<div className="ib-section">
   <div className="ib-heading"><div><h2>My development sites</h2><small>Construct, renovate and furnish your own buildings</small></div><div className="ib-heading-actions"><button type="button" className="ib-secondary" onClick={()=>{const msg=onAddHeadquarters();if(msg)setStatus(msg);else{setSelectedId('hq:'+company.id);setFloorIndex(0);setTab('blueprint');setStatus('HQ building blueprint opened.');}}}><Landmark size={15}/> Headquarters</button><button type="button" className="ib-primary" disabled={!plotValid||cash*100<plotPrice} onClick={()=>onSelectLand(plotSize)}><MapPin size={16}/> {plotValid?"Place plot · "+euros(plotPrice):"Invalid plot size"}</button></div></div>
   <div className="ib-plot-planner">
    <div className="ib-plot-heading"><div><strong>Starting development plot</strong><small>Choose the size before picking its location on the world map.</small></div><span>{plotValid?euros(plotPrice):'Invalid dimensions'}</span></div>
    <div className="ib-plot-presets">
     {([
      ['Compact',12,12],['Small',18,16],['Standard',24,16],['Large',32,24],['Estate',48,32]
     ] as const).map(([label,width,height])=><button type="button" key={label} className={plotSize.width===width&&plotSize.height===height?'selected':''} onClick={()=>setPlotSize({width,height})}>{label}<small>{width} × {height} m</small></button>)}
    </div>
    <div className="ib-plot-dimensions">
     <label>Width (metres)<input type="number" inputMode="numeric" step="2" min="12" max="64" value={plotSize.width} onChange={e=>setPlotSize(p=>({...p,width:Number(e.target.value)}))}/></label>
     <span aria-hidden="true">×</span>
     <label>Length (metres)<input type="number" inputMode="numeric" step="2" min="12" max="64" value={plotSize.height} onChange={e=>setPlotSize(p=>({...p,height:Number(e.target.value)}))}/></label>
     <div className="ib-plot-area"><strong>{plotValid?(plotSize.width*plotSize.height).toLocaleString('en-IE')+' m²':'Use even numbers from 12 to 64 m'}</strong><small>Land price scales with total area</small></div>
    </div>
    <p className="ib-note">This changes the actual building grid you can design on. Existing hotels and headquarters retain their original footprints.</p>
   </div>
   <div className="ib-stat-row"><span><strong>{sites.length}</strong> sites</span><span><strong>{sites.filter(s=>s.projects.some(p=>p.status==='active')).length}</strong> under construction</span><span><strong>{euros(Math.round(cash*100))}</strong> cash</span></div>
   <div className="ib-cards">
    {sites.map(s=><article key={s.id} className="ib-site-card"><span className="ib-site-icon"><Building2 size={20}/></span><div><strong>{s.name}</strong><small>{s.kind==='new'?'Own development plot':s.kind==='headquarters'?'Company headquarters':'Existing hotel renovation'} · {s.width} × {s.height} m · {s.draft.length} floor(s)</small><small>{s.projects.some(p=>p.status==='active')?'Construction underway':s.projects.length?'Built / ready for further work':'Blueprint planning'}</small></div><div className="ib-site-actions">{s.kind!=='headquarters'&&<button type="button" className="ib-secondary" onClick={()=>{choose(s.id);setTab('operations');}}>Manage</button>}<button className="ib-primary" onClick={()=>choose(s.id)}>Build <ChevronLeft size={15}/></button></div></article>)}
    {sites.length===0&&<div className="ib-empty"><Building2 size={23}/><strong>No construction sites yet</strong><p>Open your headquarters, buy a simulated development plot or renovate a hotel you control.</p></div>}
   </div>
   <div className="ib-heading"><div><h2>Hotels you control</h2><small>At least 50% ownership required to plan a renovation</small></div></div>
   {available.length===0?<p className="ib-muted">No unregistered controlling hotel interests. Buy shares in Investments to acquire an existing hotel.</p>:<div className="ib-cards">{available.map(h=><article key={h.id} className="ib-site-card"><span className="ib-site-icon"><Building2 size={19}/></span><div><strong>{h.name}</strong><small>{Math.round(ownership(h)*100)}% owned · Existing hotel</small></div><button type="button" onClick={()=>{const message=onAdoptHolding(h.id);if(message)setStatus(message);else{setSelectedId('hotel:'+h.id);setTab('blueprint');setStatus('Hotel added. Its original investment income remains separate from building plans.');}}}>Plan renovation</button></article>)}</div>}
   <p className="ib-note">Plots are simulated development opportunities at selected map locations, not real-world land listings. Existing passive hotel shares are preserved; hotel guest operations will be developed separately.</p>
  </div>}
  {company&&tab==='blueprint'&&(!site||!floor)?<div className="ib-empty"><Grid2X2 size={22}/><strong>Select a building site first</strong><button className="ib-primary" onClick={()=>setTab('sites')}>Choose property</button></div>:null}
  {company&&tab==='blueprint'&&site&&floor&&<div className="ib-section ib-editor">
   <div className="ib-heading"><div><h2>{site.name}</h2><small>{site.width} × {site.height} m · {site.kind==='new'?'New development':site.kind==='headquarters'?'Headquarters interior':'Hotel renovation'}</small></div><button className="ib-secondary" onClick={()=>setTab('sites')}>All sites</button></div>
   {site.kind!=='headquarters'&&<div className="ib-access-mode" role="region" aria-label="Hotel architecture rules"><div><strong>{site.accessRulesVersion===1?'Functional hotel access enabled':'Existing hotel access rules preserved'}</strong><small>{site.accessRulesVersion===1?'Ground-floor guest rooms need a usable door, a connected route to furnished reception and an exterior entrance.':'This older property keeps its existing room eligibility. Opt in to functional access rules when you are ready to renovate.'}</small></div>{site.accessRulesVersion!==1&&<button type="button" className="ib-secondary" disabled={!!active||currentlyOpen} onClick={enableAccessOnExisting}>{currentlyOpen?'Close hotel to enable':'Enable checks'}</button>}</div>}
   <div className="ib-floor-bar"><div className="ib-floor-switch"><Layers3 size={15}/><select aria-label="Selected floor" value={floorIndex} onChange={e=>{setFloorIndex(Number(e.target.value));setAnchor(null);setSelectedRoomId(null);setSelectedFurnitureId(null);setFurniturePreview(null);}}>{site.draft.map((f,i)=><option key={f.id} value={i}>{f.label}</option>)}</select></div><button type="button" disabled={active!==undefined||site.draft.length>=MAX_FLOORS} onClick={addBuildingFloor}><Plus size={14}/> Add floor</button><div className="ib-history-controls"><button type="button" title="Undo" aria-label="Undo blueprint change" disabled={!!active||history.current.siteId!==site.id||!history.current.undo.length} onClick={()=>restoreHistory('undo')}><Undo2 size={15}/></button><button type="button" title="Redo" aria-label="Redo blueprint change" disabled={!!active||history.current.siteId!==site.id||!history.current.redo.length} onClick={()=>restoreHistory('redo')}><Redo2 size={15}/></button></div><div className="ib-zoom"><button type="button" onClick={()=>zoomTo(zoomRef.current-.15)} aria-label="Zoom out">−</button><span>{Math.round(zoom*100)}%</span><button type="button" onClick={()=>zoomTo(zoomRef.current+.15)} aria-label="Zoom in">+</button><button type="button" className="ib-fit-button" onClick={()=>{if(!site)return;const box=scrollerRef.current;const fit=box?Math.min((box.clientWidth-12)/(site.width*30),(box.clientHeight-12)/(site.height*30),2.5):1;pendingScroll.current={left:0,top:0};setZoom(planZoom(fit));if(box&&planZoom(fit)===zoomRef.current){box.scrollLeft=0;box.scrollTop=0;pendingScroll.current=null;}}}>Fit</button></div></div>
   <div className="ib-tools" role="group" aria-label="Building tools">
    {([['pan','Move',Hand],['select','Inspect',Grid2X2],['room','Room',Plus],['wall','Wall',Hammer],['door','Door',DoorOpen],['furniture','Furnish',Sofa],['erase','Erase',Trash2]] as const).map(([key,label,Icon])=><button type="button" key={key} disabled={!!active&&key!=='select'} className={tool===key?'selected':''} onClick={()=>{setTool(key);setAnchor(null);}}><Icon size={17}/><span>{label}</span></button>)}
   </div>
   <div className="ib-hint ib-pan-guide"><Hand size={14}/> {(tool==='select'||tool==='furniture')?
   'Tap existing furniture to edit it, or drag it to a new grid cell. Swipe empty space to pan; use two fingers to pinch-zoom.':tool==='room'?'Drag to draw a room, or tap two corners. Use two fingers to pan and pinch-zoom while drawing.':'Swipe the plan to move without placing objects. Tap to '+(tool==='pan'?'move around':'edit')+'.'} Two fingers pan or zoom in any tool.</div>
   <div className="ib-navigation-row"><span>Move around your plan — works while furnishing</span><div className="ib-pan-arrows" role="group" aria-label="Move floor plan"><button type="button" onClick={()=>panBy(-160,0)} aria-label="Pan left"><ArrowLeft size={16}/></button><button type="button" onClick={()=>panBy(0,-160)} aria-label="Pan up"><ArrowUp size={16}/></button><button type="button" onClick={centerPlan} aria-label="Centre floor plan" title="Centre floor plan"><Crosshair size={16}/></button><button type="button" onClick={()=>panBy(0,160)} aria-label="Pan down"><ArrowDown size={16}/></button><button type="button" onClick={()=>panBy(160,0)} aria-label="Pan right"><ArrowRight size={16}/></button></div></div>
   {tool==='room'&&<div className="ib-room-templates" aria-label="Quick furnished room layouts"><strong>Ready-to-furnish layouts</strong><span>Auto-place a complete room in available space. You can edit it afterwards.</span><div>{BLUEPRINT_ROOM_TEMPLATES.map(template=><button key={template.id} type="button" disabled={!!active} onClick={()=>addTemplate(template.id)}><strong>{template.name}</strong><small>{template.width} × {template.height} m · {template.equipment.length} items</small></button>)}</div></div>}
   {tool==='room'&&<div className="ib-controls"><label>Room type<select value={roomType} disabled={!!active} onChange={e=>{setRoomType(e.target.value as RoomType);setAnchor(null);}}>{roomTypes.map(r=><option key={r.id} value={r.id}>{r.label} · min {r.minWidth}×{r.minHeight}</option>)}</select></label><span className="ib-muted">Drag corner to corner, or tap two corners</span></div>}
   {tool==='furniture'&&<div className="ib-controls"><label>Furniture<select value={itemCode} disabled={!!active} onChange={e=>setItemCode(e.target.value as FurnitureCode)}>{furniture.map(f=><option key={f.code} value={f.code}>{f.name} · {euros(f.priceCents)}</option>)}</select></label><button type="button" onClick={()=>setRotate(v=>!v)} className={rotate?'selected ib-secondary':'ib-secondary'}><RotateCw size={15}/> {rotate?'Rotated':'Rotate'}</button><span className="ib-muted">{selectedFurniture.width} × {selectedFurniture.height} cells</span></div>}
   {(tool==='wall'||tool==='door')&&<div className="ib-hint">{tool==='door'?'Doors connect two adjacent rooms, or link a lobby/corridor to the outside edge of the plot. Tap on the exact shared grid edge, or select a room and use Add doorway. Keep the doorway clear of furniture.':'Tap near the edge of a grid cell to draw or remove a wall segment.'}</div>}}
   {active&&<div className="ib-hint">The blueprint is locked while construction is underway. Inspection is still available.</div>}
   {accessReport&&site.kind!=='headquarters'&&<section className="ib-access-checker" aria-label="Room accessibility checker"><div className="ib-access-checker-heading"><div><strong>Room access · {accessReport.groundFloor?'Ground floor':floor.label}</strong><small>{accessReport.groundFloor?'Reception, corridors and entrance connectivity':'Vertical travel will be added in Phase 2'}</small></div><button type="button" className={showAccessOverlay?'ib-secondary selected':'ib-secondary'} onClick={()=>setShowAccessOverlay(v=>!v)}>{showAccessOverlay?'Hide overlay':'Show overlay'}</button></div><div className="ib-access-counts"><span><strong>{accessReport.groundFloor?accessReport.connectedGuests:'—'}/{accessReport.guestRooms}</strong> connected guest rooms</span><span><strong>{accessReport.entranceDoors}</strong> exterior entrance{accessReport.entranceDoors===1?'':'s'}</span><span className={accessReport.receptionConnected?'good':'bad'}>{accessReport.receptionConnected?'Reception reachable':accessReport.groundFloor?'Reception not connected':'Floor links pending'}</span></div>{accessReport.warnings.slice(0,4).map((warning,i)=><p className="ib-access-warning" key={i}><AlertCircle size={13}/>{warning}</p>)}{site.accessRulesVersion!==1&&<small className="ib-access-grandfather">Preview only · legacy hotels retain current guest bookings until you enable access checks.</small>}</section>}}
   <div className="ib-plan-scroller" ref={scrollerRef}><svg className="ib-floor-canvas" width={Math.round(site.width*30*zoom)} height={Math.round(site.height*30*zoom)} viewBox={`0 0 ${site.width} ${site.height}`} aria-label={floor.label+' building plan'} onPointerDown={onPlanPointerDown} onPointerMove={onPlanPointerMove} onPointerUp={e=>onPlanPointerEnd(e)} onPointerCancel={e=>onPlanPointerEnd(e,true)} style={{touchAction:'none',cursor:tool==='pan'?'grab':tool==='room'?'crosshair':'pointer'}}>
     <rect width={site.width} height={site.height} fill="#111c31"/>
     {Array.from({length:site.width+1},(_,i)=><line key={'x'+i} x1={i} y1={0} x2={i} y2={site.height} stroke="#42506c" strokeWidth=".025"/>)}
     {Array.from({length:site.height+1},(_,i)=><line key={'y'+i} x1={0} y1={i} x2={site.width} y2={i} stroke="#42506c" strokeWidth=".025"/>)}
     {floor.rooms.map(r=><g key={r.id}><rect x={r.x} y={r.y} width={r.width} height={r.height} fill={tone[r.type]} fillOpacity=".87" stroke="#d3d5e6" strokeWidth=".10"/><text x={r.x+r.width/2} y={r.y+.65} fontSize=".40" textAnchor="middle" fill="#ffffff">{r.name}</text></g>)}
     {showAccessOverlay&&accessReport&&floor.rooms.map(room=>{
      const guest=accessReport.guests.find(g=>g.roomId===room.id);
      const traversable=accessReport.reachableRoomIds.includes(room.id);
      const color=guest?(guest.status==='connected'?'#60ddb1':guest.status==='upper-floor-pending'?'#b0b9dd':'#efb179'):
       room.type==='lobby'||room.type==='corridor'?(traversable?'#60ddb1':'#efb179'):null;
      return color?<rect key={'access-'+room.id} x={room.x+.07} y={room.y+.07}
       width={room.width-.14} height={room.height-.14} rx=".12" fill="none"
       stroke={color} strokeWidth=".12" strokeDasharray=".24 .13" pointerEvents="none"/>:null;
     })}
     {selectedRoom&&<rect x={selectedRoom.x+.07} y={selectedRoom.y+.07} width={selectedRoom.width-.14} height={selectedRoom.height-.14} fill="none" stroke="#ffd37a" strokeWidth=".16" strokeDasharray=".32 .14" pointerEvents="none"/>}
     {floor.walls.map(w=><g key={w.id} pointerEvents="none"><line x1={w.x} y1={w.y} x2={w.orientation==='h'?w.x+1:w.x} y2={w.orientation==='v'?w.y+1:w.y} stroke={w.type==='door'?'#89d9b6':'#f5eeff'} strokeWidth={w.type==='door'?'.22':'.14'} strokeDasharray={w.type==='door'?'.25 .12':undefined}/>{w.type==='door'&&<circle cx={w.x} cy={w.y} r=".12" fill="#89d9b6"/>}</g>)}
     {floor.objects.map(o=>{const preview=furniturePreview?.id===o.id?{...o,x:furniturePreview.x,y:furniturePreview.y}:o;
      const size=furnitureSize(preview),selected=selectedFurnitureId===o.id;
      const dragging=furniturePreview?.id===o.id;
      return <g key={o.id} pointerEvents="none" opacity={dragging?0.72:1}>
       <rect x={preview.x+.08} y={preview.y+.08} width={size.width-.16} height={size.height-.16}
        rx=".13" fill={selected?'#efce89':'#c1a0ed'}
        stroke={selected?'#fff2be':'#e7daff'} strokeWidth={selected?'.11':'.035'}
        strokeDasharray={dragging?'.2 .08':undefined}/>
       <text x={preview.x+size.width/2} y={preview.y+size.height/2+.1}
        fontSize=".35" fill="#201735" textAnchor="middle">
        {furniture.find(f=>f.code===o.code)?.name.slice(0,11)}</text></g>})}
     {anchor&&<rect x={anchor.x} y={anchor.y} width="1" height="1" fill="none" stroke="#ffdc84" strokeDasharray=".15 .12" strokeWidth=".1"/>}
    </svg></div>
   <div className="ib-plan-footer"><span>{floor.rooms.length} rooms · {floor.objects.length} objects · {floor.walls.length} custom walls</span><span>Grid: 1 m · {floor.label}</span></div>
   {blueprintHealth&&<div className="ib-blueprint-health" aria-label="Draft floor readiness"><span><strong>{blueprintHealth.plannedArea} m²</strong> rooms drawn</span><span><strong>{blueprintHealth.usablePercent}%</strong> plot used</span><span><strong>{blueprintHealth.readyGuestRooms}/{blueprintHealth.guestRooms}</strong> equipped guest rooms</span><span><strong>{blueprintHealth.roomsWithIssues}</strong> rooms missing items</span><span><strong>{blueprintHealth.averageGuestRoomQuality===null?'—':blueprintHealth.averageGuestRoomQuality+'/100'}</strong> guest design quality</span></div>}
   {selectedRoom&&site.kind!=='headquarters'&&<div className="ib-room-access-actions"><div><strong>{selectedRoom.name} · Access</strong><small>{accessReport?.guests.find(g=>g.roomId===selectedRoom.id)?.status.replaceAll('-',' ')??(selectedRoom.type==='corridor'||selectedRoom.type==='lobby'?'Connect to entrance and reception':'Connect to an adjacent circulation area')}</small></div><button type="button" className="ib-secondary" disabled={!!active} onClick={()=>addSuggestedDoor(selectedRoom.id)}><DoorOpen size={14}/> Add doorway</button></div>}
   {selectedRoom&&<section className="ib-room-inspector" aria-label="Selected room editor"><div className="ib-room-inspector-head"><div><strong>{selectedRoom.name}</strong><small>{selectedRoom.type} · 1 m building grid · furnishings retained</small></div><button type="button" className="ib-secondary" onClick={()=>focusRoom(selectedRoom)}><Crosshair size={14}/> Centre</button></div><div className="ib-room-inspector-controls"><div><strong>Position</strong><small>X {selectedRoom.x} · Y {selectedRoom.y}</small><div className="ib-room-nudge"><button type="button" disabled={!!active} aria-label="Move selected room left" onClick={()=>adjustSelectedRoom({x:selectedRoom.x-1})}><ArrowLeft size={15}/></button><button type="button" disabled={!!active} aria-label="Move selected room up" onClick={()=>adjustSelectedRoom({y:selectedRoom.y-1})}><ArrowUp size={15}/></button><button type="button" disabled={!!active} aria-label="Move selected room down" onClick={()=>adjustSelectedRoom({y:selectedRoom.y+1})}><ArrowDown size={15}/></button><button type="button" disabled={!!active} aria-label="Move selected room right" onClick={()=>adjustSelectedRoom({x:selectedRoom.x+1})}><ArrowRight size={15}/></button></div></div><div><strong>Dimensions</strong><small>{selectedRoom.width} × {selectedRoom.height} m</small><div className="ib-room-resize"><button type="button" disabled={!!active} aria-label="Reduce selected room width" onClick={()=>adjustSelectedRoom({width:selectedRoom.width-1})}>W −</button><button type="button" disabled={!!active} aria-label="Increase selected room width" onClick={()=>adjustSelectedRoom({width:selectedRoom.width+1})}>W +</button><button type="button" disabled={!!active} aria-label="Reduce selected room height" onClick={()=>adjustSelectedRoom({height:selectedRoom.height-1})}>H −</button><button type="button" disabled={!!active} aria-label="Increase selected room height" onClick={()=>adjustSelectedRoom({height:selectedRoom.height+1})}>H +</button></div></div></div><small>Furniture moves with its room. Any invalid overlap, missing space or attached wall is blocked without altering the layout.</small></section>}

   {selectedPlacedFurniture&&<section className="ib-furniture-inspector" aria-label="Selected furniture editor">
    <div className="ib-room-inspector-head"><div><strong>{selectedPlacedType?.name??selectedPlacedFurniture.code}</strong>
     <small>X {selectedPlacedFurniture.x} · Y {selectedPlacedFurniture.y} · {furnitureSize(selectedPlacedFurniture).width} × {furnitureSize(selectedPlacedFurniture).height} m</small></div>
     <button type="button" className="ib-secondary" disabled={!!active} onClick={()=>adjustPlacedFurniture({rotated:!selectedPlacedFurniture.rotated})}><RotateCw size={14}/> Rotate 90°</button>
    </div>
    <div className="ib-room-nudge" role="group" aria-label="Move selected furniture">
     <button type="button" disabled={!!active} aria-label="Move furniture left" onClick={()=>adjustPlacedFurniture({x:selectedPlacedFurniture.x-1})}><ArrowLeft size={15}/></button>
     <button type="button" disabled={!!active} aria-label="Move furniture up" onClick={()=>adjustPlacedFurniture({y:selectedPlacedFurniture.y-1})}><ArrowUp size={15}/></button>
     <button type="button" disabled={!!active} aria-label="Move furniture down" onClick={()=>adjustPlacedFurniture({y:selectedPlacedFurniture.y+1})}><ArrowDown size={15}/></button>
     <button type="button" disabled={!!active} aria-label="Move furniture right" onClick={()=>adjustPlacedFurniture({x:selectedPlacedFurniture.x+1})}><ArrowRight size={15}/></button>
    </div>
    <div className="ib-furniture-inspector-footer"><small>Drag on the floor plan or use these one-metre controls. Invalid moves are safely rejected.</small>
     <button type="button" disabled={!!active} className="ib-secondary" onClick={()=>{
      const target=selectedPlacedFurniture.id;
      modify(f=>({...f,objects:f.objects.filter(o=>o.id!==target)}));setSelectedFurnitureId(null);
     }}><Trash2 size={14}/> Remove</button></div>
   </section>}
   {selectedRoom?.type==='guest'&&<div className="ib-design-hint"><strong>Room design: {hotelGuestRoomQuality(floor,selectedRoom).score}/100 · {hotelGuestRoomQuality(floor,selectedRoom).tier}</strong><span>{hotelGuestRoomQuality(floor,selectedRoom).suggestions.slice(0,3).join(' · ')||'Fully equipped and spacious.'}</span></div>}
   {blueprintHealth&&blueprintHealth.guestRoomQuality.length>0&&<div className="ib-design-summary"><strong>Guest room design opportunities</strong><div>{blueprintHealth.guestRoomQuality.filter(q=>q.quality.suggestions.length>0).sort((a,b)=>a.quality.score-b.quality.score).slice(0,3).map(q=><p key={q.roomId}><b>{q.name} · {q.quality.score}/100</b><span>{q.quality.suggestions[0]}</span></p>)}</div><small>Design quality affects simulated hotel booking demand after construction. Not a legal building inspection or property valuation.</small></div>}
   <div className="ib-heading"><div><h2>Room requirements</h2><small>Check equipment before opening your hotel</small></div></div>
   <div className="ib-room-list">{floor.rooms.map(r=>{const issues=roomIssues(floor,r);const access=accessReport?.guests.find(g=>g.roomId===r.id);return <div className="ib-room" key={r.id}><span className="ib-room-dot" style={{background:tone[r.type]}}/><div><strong>{r.name}</strong><small>{r.width}×{r.height} m · {r.type}</small></div><span className={issues.length||access&&access.status!=='connected'&&access.status!=='upper-floor-pending'?'ib-room-warning':'ib-room-success'}>{issues.length?issues[0]:access?access.status==='connected'?'Accessible':access.status==='upper-floor-pending'?'Upper-floor review':access.status==='missing-door'?'Needs doorway':access.status==='no-entry'?'Needs entrance':'No reception route':'Equipped'}</span><button type="button" className="ib-room-edit" onClick={()=>{setTool('select');setSelectedRoomId(r.id);focusRoom(r);}} aria-label={'Edit '+r.name}>Edit</button><button className="ib-room-duplicate" aria-label={'Duplicate '+r.name} title={'Duplicate '+r.name} disabled={!!active} onClick={()=>duplicateRoom(r.id)}><Copy size={16}/></button></div>})}{floor.rooms.length===0&&<p className="ib-muted">Use Draw Room to add your first room.</p>}</div>
   <div className="ib-build-actions"><div><strong>Approve the blueprint</strong><small>Check a material quote, choose workers and start a timed project.</small></div><button className="ib-primary" disabled={!!active} onClick={()=>setTab('projects')}><HardHat size={15}/> View quote</button></div>
  </div>}
  {company&&tab==='projects'&&<div className="ib-section">
   <div className="ib-heading"><div><h2>Construction projects</h2><small>Material deliveries, work schedules and budgets</small></div></div>
   {site&&<div className="ib-project-shell"><div className="ib-heading"><div><h2>{site.name}</h2><small>{active?'Construction in progress':'New work proposal'}</small></div><button className="ib-secondary" onClick={()=>setTab('blueprint')}>Floor plan</button></div>
    {active?<div className="ib-progress-panel">
     {!active.freight&&gameHour<active.deliveryHour&&<div className="ib-cargo-panel" role="region" aria-label="Upgrade existing building material delivery">
      <div className="ib-cargo-head"><Ship size={18}/><div><strong>Assign a ship and truck to this existing project</strong><small>Materials were already paid for. No additional charge.</small></div></div>
      <p className="ib-note">This project was started before cargo shipping was added. We automatically schedule its delivery when harbour and road data are ready. If the route has not appeared, open the world map to load nearby roads and try again.</p>
      <button type="button" className="ib-primary ib-full" onClick={()=>{const issue=onAssignFreight(active.id);setStatus(issue??'Cargo ship and road delivery assigned. Open the tracking button below to follow the vessel.');}}><Ship size={16}/> Assign cargo delivery · free</button>
     </div>}
     {!active.freight&&gameHour>=active.deliveryHour&&<p className="ib-note">This project was started before ship deliveries existed. Its materials have already arrived under the original schedule; construction continues without resetting your progress.</p>}
     {active.freight&&gameHour<active.deliveryHour&&<div className="ib-cargo-panel">
      <div className="ib-cargo-head"><Ship size={17}/><div><strong>{freightStatusLabel[freightStage(active.freight,gameNowHour)]}</strong><small>Contracted ship and truck delivery · materials & furniture</small></div></div>
      <div className="ib-meter"><span style={{width:freightProgress(active.freight,gameNowHour)+'%'}}/></div>
      <div className="ib-cargo-route"><span>{active.freight.originPortName}</span><span>→</span><span>{active.freight.destinationPortName}</span><span>→</span><span>{site.name}</span></div>
      <button type="button" className="ib-primary ib-full" onClick={()=>onTrackFreight(active.id)}><Ship size={17}/> {freightStage(active.freight,gameNowHour)==='trucking'?'Track delivery truck on map':'Track cargo ship on map'}</button>
      <div className="ib-cargo-stages">
       <div className={gameNowHour>=active.freight.shippingHour?'reached':''}><Ship size={15}/><span>Ship departure</span><strong>{formatConstructionDate(active.freight.shippingHour)}</strong><small className="ib-milestone-countdown">{milestoneCountdown(active.freight.shippingHour,gameNowHour,'Departed')}</small></div>
       <div className={gameNowHour>=active.freight.seaArrivalHour?'reached':''}><Package size={15}/><span>Harbour arrival</span><strong>{formatConstructionDate(active.freight.seaArrivalHour)}</strong><small className="ib-milestone-countdown">{milestoneCountdown(active.freight.seaArrivalHour,gameNowHour,'Arrived')}</small></div>
       <div className={gameNowHour>=active.freight.truckDepartureHour?'reached':''}><Truck size={15}/><span>Truck dispatch</span><strong>{formatConstructionDate(active.freight.truckDepartureHour)}</strong><small className="ib-milestone-countdown">{milestoneCountdown(active.freight.truckDepartureHour,gameNowHour,'Dispatched')}</small></div>
       <div className={gameNowHour>=active.freight.deliveryHour?'reached':''}><CheckCircle2 size={15}/><span>Site delivery</span><strong>{formatConstructionDate(active.freight.deliveryHour)}</strong><small className="ib-milestone-countdown">{milestoneCountdown(active.freight.deliveryHour,gameNowHour,'Delivered')}</small></div>
      </div>
      <small>All times use the in-game calendar (UTC). Live countdowns use game time; 1 game hour = 2.5 real minutes.</small>
      <small>{Math.round(active.freight.roadDistanceMeters/1000)} km road journey · cargo follows loaded ferry corridors and drivable roads. No teleporting.</small>
     </div>}
     <div className="ib-project-row"><strong>{gameHour<active.deliveryHour?'Waiting for building materials':'Construction underway'}</strong><span>{progressProject(active,gameHour).toFixed(0)}%</span></div><div className="ib-meter"><span style={{width:progressProject(active,gameHour)+'%'}}/></div><div className="ib-project-timing"><div><span>Materials delivery</span><strong>{formatConstructionDate(active.deliveryHour)}</strong><small>{milestoneCountdown(active.deliveryHour,gameNowHour,'Delivered')}</small></div><div><span>Estimated completion</span><strong>{formatConstructionDate(active.finishHour)}</strong><small>{milestoneCountdown(active.finishHour,gameNowHour,'Completed')}</small></div></div>
     <p className="ib-note">Construction can only progress after the ship unloads and the truck reaches the hotel site. Materials and project charges were paid when approved. Own crews also draw hourly wages.</p>
    </div>:
    <>
     <div className="ib-methods"><label>Construction method<select value={method} onChange={e=>setMethod(e.target.value as TradeMode)}><option value="contractor">Hire external contractor</option><option value="own">Use my construction crew ({state.workers} workers)</option></select></label></div>
     {quote&&quote.changes>0?<><div className="ib-costs"><div><span>Materials & groundworks</span><strong>{euros(quote.materialCents)}</strong></div><div><span>Furniture & equipment</span><strong>{euros(quote.furnitureCents)}</strong></div><div><span>{method==='own'?'Site tools / equipment':'Contractor labour'}</span><strong>{euros(quote.labourCents)}</strong></div><div className="ib-total"><span>Pay now</span><strong>{euros(quote.totalCents)}</strong></div></div>
      <details className="ib-material-details"><summary><Package size={16}/> Material order · {quote.materials.length} items</summary><div>{quote.materials.map(m=><div key={m.id}><span>{m.name} · {m.quantity} {m.unit}</span><strong>{euros(m.totalCents)}</strong></div>)}</div></details>
      <div className="ib-stat-row"><span><Clock3 size={14}/> {quote.deliveryHours}h baseline procurement + sea & road freight</span><span><HardHat size={14}/> {quote.constructionHours}h work</span><span><ShoppingCart size={14}/> {euros(quote.totalCents)}</span></div>
      <button type="button" className="ib-primary ib-full" disabled={cash*100<quote.totalCents} onClick={projectStart}>{cash*100<quote.totalCents?'Insufficient cash':'Book cargo ship, truck & construction'}</button>
     </>:<div className="ib-empty"><HardHat size={23}/><strong>{method==='own'&&state.workers<2?'Hire at least two workers':'No pending construction work'}</strong><p>{method==='own'&&state.workers<2?'Your own crew requires at least two employees.':'Draw rooms, place furniture or add a new floor to create a project quote.'}</p></div>}
    </>}
   </div>}
   {!site&&<div className="ib-empty"><Building2 size={23}/><strong>Choose a property to manage construction</strong><button onClick={()=>setTab('sites')} className="ib-secondary">My properties</button></div>}
   {site&&site.projects.length>0&&<><div className="ib-heading"><h2>Project history</h2></div><div className="ib-cards">{[...site.projects].reverse().slice(0,12).map(p=><div key={p.id} className="ib-history-row"><span>{p.status==='complete'?<CheckCircle2 size={17}/>:<Clock3 size={17}/>}</span><div><strong>{p.method==='own'?'Own construction crew':'Contracted construction'}</strong><small>{p.status==='complete'?'Completed':'In progress'} · Started {formatConstructionDate(p.startHour)}</small></div><strong>{euros(p.budgetCents)}</strong></div>)}</div></>}
  </div>}
  {company&&tab==='operations'&&<div className="ib-section ib-hotel-operations">
   <div className="ib-heading"><div><h2>Hotel operations</h2><small>Live bookings, staff, guest services and operating profit</small></div></div>
   {!site||site.kind==='headquarters'?<div className="ib-empty"><BedDouble size={22}/><strong>Choose a hotel to operate</strong><p>Buy a development plot or take control of an existing hotel, then construct guest rooms and a reception.</p><button className="ib-secondary" onClick={()=>setTab('sites')}>My buildings</button></div>:
   <>
    <div className="ib-hotel-head">
     <div><span className="ib-mini-label">OPERATED PROPERTY</span><h2>{site.name}</h2><small>{site.kind==='existing'?'Existing hotel · Managed operating share':'New hotel · Owned business'}</small></div>
     <span className={currentlyOpen?'ib-hotel-open':'ib-hotel-closed'}>{currentlyOpen?'Open for guests':'Not operating'}</span>
    </div>
    <div className="ib-hotel-kpis">
     <div><BedDouble size={16}/><small>Ready rooms</small><strong>{preparedRooms?.readyRooms.length??0}</strong></div>
     <div><UserCheck size={16}/><small>Guests staying</small><strong>{operations.guests.length}</strong></div>
     <div><TrendingUp size={16}/><small>Room occupancy</small><strong>{preparedRooms?.readyRooms.length?Math.round(100*operations.guests.length/preparedRooms.readyRooms.length):0}%</strong></div>
     <div><CalendarClock size={16}/><small>Total check-ins</small><strong>{operatedTotals.guests}</strong></div>
    </div>
    {!currentlyOpen&&<div className="ib-hotel-checklist"><strong><ShieldCheck size={16}/> Opening checklist</strong>
     {openProblems.length?openProblems.map((issue,i)=><div className="ib-hotel-issue" key={i}><AlertCircle size={14}/>{issue}</div>):<p><CheckCircle2 size={15}/> Requirements met. Your hotel is ready to receive guests.</p>}
    </div>}
    <div className="ib-hotel-open-actions">
     <button type="button" className={currentlyOpen?'ib-secondary':'ib-primary'} disabled={!currentlyOpen&&openProblems.length>0} onClick={applyHotelStatus}>{currentlyOpen?'Close hotel to new bookings':'Open hotel for guests'}</button>
     <span>Bookings settle on the simulated game clock · Check-in 14:00 · Checkout 11:00</span>
    </div>
    <div className="ib-hotel-quick-links"><button type="button" className="ib-secondary" onClick={()=>setTab('blueprint')}><Grid2X2 size={15}/> Edit floor plan</button><button type="button" className="ib-secondary" onClick={()=>setTab('supplies')}><Package size={15}/> Buy stock</button></div>
    <div className="ib-hotel-section-heading"><h3>Room pricing &amp; menus</h3><small>Charge guests for each occupied night and completed service</small></div>
    <div className="ib-hotel-price-grid">
     {([
      ['rateCents','Room / night',operations.rateCents,50,500],
      ['breakfastPriceCents','Breakfast',operations.breakfastPriceCents,3,80],
      ['dinnerPriceCents','Dinner',operations.dinnerPriceCents,3,80],
      ['drinkPriceCents','Bar drink',operations.drinkPriceCents,3,80]
     ] as const).map(([key,label,price,min,max])=><PriceInput key={site.id+key} title={label} cents={price} minimum={min} maximum={max} onSave={v=>applyHotelSetting(key,v)}/>)}
    </div>
    <div className="ib-hotel-section-heading"><h3>Employees</h3><small>Wages are charged when their department is on duty</small></div>
    <div className="ib-hotel-staff-grid">
     {hotelRoles.map(role=><div className="ib-hotel-staff" key={role.id}>
      <div><strong>{role.label}</strong><small>{role.shift} · {exactEuro(role.wageCents)}/hour per worker</small></div>
      <div className="ib-hotel-counter">
       <button type="button" aria-label={'Reduce '+role.label} disabled={!operations.staff[role.id]||(currentlyOpen&&(role.id==='housekeeping'||role.id==='reception')&&operations.staff[role.id]===1)} onClick={()=>applyHotelSetting(role.id,operations.staff[role.id]-1)}>−</button>
       <strong>{operations.staff[role.id]}</strong>
       <button type="button" aria-label={'Hire '+role.label} disabled={operations.staff[role.id]>=15||cash*100<HOTEL_STAFF_HIRING_CENTS} onClick={()=>applyHotelSetting(role.id,operations.staff[role.id]+1)}>+</button>
      </div>
     </div>)}
    </div>
    <p className="ib-note">Each hire costs {euros(HOTEL_STAFF_HIRING_CENTS)} once. Reception and housekeeping are mandatory to open. Kitchen and bar services only sell when equipped, staffed and stocked.</p>
    <div className="ib-hotel-section-heading"><h3>Operating performance</h3><small>Lifetime totals since opening · guest design {operatedQuality===null?'—':operatedQuality+'/100'}</small></div>
    <div className="ib-hotel-income">
     <div><span>Room revenue</span><strong>{euros(operatedTotals.roomCents)}</strong></div>
     <div><span>Food revenue · {operatedTotals.breakfasts+operatedTotals.dinners} meals</span><strong>{euros(operatedTotals.foodCents)}</strong></div>
     <div><span>Bar revenue · {operatedTotals.drinks} drinks</span><strong>{euros(operatedTotals.barCents)}</strong></div>
     <div><span>Wages &amp; utilities</span><strong>−{euros(operatedExpenses)}</strong></div>
     <div className="ib-hotel-income-total"><span>Operating result</span><strong className={operatedGross-operatedExpenses>=0?'ib-positive':'ib-negative'}>{euros(operatedGross-operatedExpenses)}</strong></div>
    </div>
    <p className="ib-note">Stock purchases, staff recruitment and construction are paid separately when ordered. For an acquired hotel, company cash receives only your ownership share of its operating result. Passive dividends stop during operated hours.</p>
    {operations.recentDays.length>0&&<div className="ib-hotel-chart">
     <strong>Daily operating result · recent days</strong>
     {operations.recentDays.slice(-7).map(day=>{
      const net=day.roomCents+day.foodCents+day.barCents-day.wagesCents-day.utilitiesCents;
      const max=Math.max(1,...operations.recentDays.slice(-7).map(d=>Math.abs(d.roomCents+d.foodCents+d.barCents-d.wagesCents-d.utilitiesCents)));
      return <div className="ib-hotel-day" key={day.day}><small>{new Date(day.day*86400000).toLocaleDateString('en-IE',{day:'2-digit',month:'short',timeZone:'UTC'})}</small><div className="ib-hotel-bar-track"><div className={net>=0?'ib-hotel-bar-positive':'ib-hotel-bar-negative'} style={{width:Math.max(1,100*Math.abs(net)/max)+'%'}}/></div><strong>{euros(net)}</strong></div>;
     })}
    </div>}
    <div className="ib-hotel-section-heading"><h3>Rooms &amp; housekeeping</h3><small>Guest stays occupy rooms until checkout; cleaners reset dirty rooms</small></div>
    <div className="ib-room-list">
     {(preparedRooms?.readyRooms??[]).map(({room})=>{
      const guest=operations.guests.find(g=>g.roomId===room.id);
      const dirty=operations.dirtyRoomIds.includes(room.id);
      return <div key={room.id} className="ib-room"><span className="ib-room-dot" style={{background:guest?'#9372cf':dirty?'#dcab72':'#4a9c80'}}/><div><strong>{room.name}</strong><small>{guest?'Guest staying · checkout '+new Date(guest.checkOutHour*3600000).toLocaleString('en-IE',{weekday:'short',hour:'2-digit',hour12:false,timeZone:'UTC'}):dirty?'Needs housekeeping':'Ready for next guest'}</small></div><span className={guest?'ib-hotel-tag occupied':dirty?'ib-hotel-tag dirty':'ib-hotel-tag'}>{guest?'Occupied':dirty?'Dirty':'Ready'}</span></div>;
     })}
     {(preparedRooms?.readyRooms.length??0)===0&&<p className="ib-muted">Construct and furnish rooms and bathrooms to unlock guest bookings.</p>}
    </div>
    <div className="ib-hotel-service-summary">
     <div><UtensilsCrossed size={17}/><strong>Restaurant</strong><small>{preparedRooms?.hasKitchen&&preparedRooms.hasRestaurant?'Equipped':'Kitchen + restaurant required'} · {operatedTotals.unserved} unavailable orders</small></div>
     <div><Wine size={17}/><strong>Bar</strong><small>{preparedRooms?.hasBar?'Equipped':'Bar counter required'} · {operatedTotals.drinks} drinks sold</small></div>
    </div>
   </>}
  </div>}
  {company&&tab==='supplies'&&<div className="ib-section">
   <div className="ib-heading"><div><h2>Kitchen, bar &amp; housekeeping</h2><small>Order products, receive deliveries and maintain separate building stock</small></div></div>
   {!site?<div className="ib-empty"><Package size={23}/><strong>Select a building first</strong><button type="button" className="ib-secondary" onClick={()=>setTab('sites')}>My buildings</button></div>:
   <div className="ib-supplies">
    <div className="ib-heading"><div><h2>{site.name}</h2><small>Stock is purchased from the same company treasury</small></div></div>
    <div className="ib-inventory-grid">
     {supplies.map(item=><div key={item.code} className="ib-inventory-row"><div><strong>{item.name}</strong><small>{item.category} · {exactEuro(item.unitCents)} / {item.unit}</small></div><span>{supplyStock(site,item.code,gameHour)} {item.unit}</span></div>)}
    </div>
    <div className="ib-supply-order">
     <div><strong><ShoppingCart size={15}/> New supplier order</strong><small>Goods arrive after the listed number of simulated hours.</small></div>
     <div className="ib-controls">
      <label>Product<select value={supplyCode} onChange={e=>setSupplyCode(e.target.value as SupplyCode)}>{supplies.map(i=><option value={i.code} key={i.code}>{i.name} · {i.category}</option>)}</select></label>
      <label>Quantity<input type="number" inputMode="numeric" min="1" max="200" step="1" value={supplyQuantity} onChange={e=>setSupplyQuantity(Number(e.target.value))}/></label>
     </div>
     <div className="ib-stat-row"><span><strong>{exactEuro(selectedSupply.unitCents*supplyQuantity)}</strong> total</span><span><Clock3 size={14}/> {selectedSupply.deliveryHours} game hours delivery</span><span>Perishable life {Math.round(selectedSupply.expiryHours/24)} game days</span></div>
     <button className="ib-primary ib-full" disabled={!Number.isInteger(supplyQuantity)||supplyQuantity<1||supplyQuantity>200||cash*100<selectedSupply.unitCents*supplyQuantity} onClick={()=>{const msg=onOrderSupplies(site.id,supplyCode,supplyQuantity);setStatus(msg??'Order placed. Items will arrive on the game clock.');}}><ShoppingCart size={15}/> Place supply order</button>
    </div>
    <div className="ib-heading"><div><h2>Deliveries</h2><small>Only completed deliveries enter your physical inventory</small></div></div>
    {(site.supplyOrders??[]).length?<div className="ib-cards">{[...(site.supplyOrders??[])].reverse().slice(0,30).map(order=><div className="ib-history-row" key={order.id}><span>{order.status==='delivered'?<CheckCircle2 size={16}/>:<Clock3 size={16}/>}</span><div><strong>{supplies.find(item=>item.code===order.code)?.name??order.code} × {order.quantity}</strong><small>{order.status==='delivered'?'Delivered':'In transit'} · {formatConstructionDate(order.deliveryHour)} · {milestoneCountdown(order.deliveryHour,gameNowHour,'Arrived')}</small></div><strong>{exactEuro(order.quantity*order.unitCents)}</strong></div>)}</div>:<p className="ib-muted">No supply orders yet.</p>}
    <p className="ib-note">Kitchen items require a constructed kitchen, bar items a bar, and housekeeping goods a storage room. Storage capacity is limited. Food expires. Guest consumption, recipes and restaurant sales will be added in a later operating stage.</p>
   </div>}
  </div>}
  {company&&tab==='crew'&&<div className="ib-section">
   <div className="ib-heading"><div><h2>Internal construction team</h2><small>Hire workers to build your own developments</small></div></div>
   <div className="ib-stat-row"><span><Users size={14}/><strong>{state.workers}</strong> workers</span><span><strong>{euros(state.workers*WORKER_HOURLY_CENTS)}</strong>/game hour payroll</span></div>
   <article className="ib-crew-card"><span className="ib-site-icon"><Users size={23}/></span><div><strong>Construction worker</strong><small>€{Math.round(RECRUITMENT_CENTS/100).toLocaleString('en-IE')} hiring & training · {euros(WORKER_HOURLY_CENTS)}/game hour</small><small>Workers are paid every simulated hour, including while idle.</small></div><button type="button" className="ib-primary" disabled={cash*100<RECRUITMENT_CENTS} onClick={()=>{const msg=onHireWorker();setStatus(msg??'Worker joined your internal construction division.');}}><Plus size={14}/> Hire</button></article>
   <div className="ib-crew-actions"><button type="button" className="ib-secondary" disabled={state.workers===0} onClick={()=>{const msg=onDismissWorker();setStatus(msg??'Worker dismissed. Hourly payroll will decrease.');}}><Trash2 size={14}/> Dismiss one worker</button></div>
   <p className="ib-note">Hiring is optional. External contractors charge fixed project fees. Your own team requires at least two workers and incurs continuing wages, so schedule jobs carefully. Workers cannot be dismissed during an active self-build project.</p>
  </div>}
 </section>;
}
