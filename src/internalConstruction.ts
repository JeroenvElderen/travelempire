/** Internal hotel development: blueprints, procurement, works and game-clock settlement.
 * Keeps passive property shares untouched. External tendering is intentionally out of scope.
 */
export type RoomType='guest'|'bathroom'|'kitchen'|'restaurant'|'bar'|'lobby'|'storage'|'staff'|'corridor';
export type BuilderTool='room'|'wall'|'door'|'furniture'|'erase';
export type TradeMode='contractor'|'own';
export type FurnitureCode='bed'|'single-bed'|'wardrobe'|'television'|'desk'|'lamp'|'sofa'|'reception'|'toilet'|'shower'|'sink'|'oven'|'fridge'|'freezer'|'prep'|'table'|'chair'|'bar-counter'|'coffee'|'shelves';
export type Room={id:string;type:RoomType;name:string;x:number;y:number;width:number;height:number};
export type Wall={id:string;x:number;y:number;orientation:'h'|'v';type:'wall'|'door'};
export type ObjectPlacement={id:string;code:FurnitureCode;x:number;y:number;rotated:boolean};
export type HotelFloor={id:string;label:string;rooms:Room[];walls:Wall[];objects:ObjectPlacement[]};
export type MaterialLine={id:string;name:string;unit:string;quantity:number;unitCents:number;totalCents:number};
export type BuildQuote={materials:MaterialLine[];materialCents:number;furnitureCents:number;labourCents:number;totalCents:number;workUnits:number;deliveryHours:number;constructionHours:number;changes:number};
export type ConstructionProject={id:string;method:TradeMode;startHour:number;deliveryHour:number;finishHour:number;budgetCents:number;materials:MaterialLine[];furnitureCents:number;labourCents:number;target:HotelFloor[];status:'active'|'complete'};
export type HotelSite={
 id:string;name:string;kind:'new'|'existing';sourceHoldingId?:string;
 longitude:number;latitude:number;width:number;height:number;
 draft:HotelFloor[];built:HotelFloor[];projects:ConstructionProject[];createdHour:number;
};
export type ConstructionState={version:1;sites:Record<string,HotelSite>;workers:number;lastPayrollHour:number};
export const HOTEL_GRID_WIDTH=24;
export const HOTEL_GRID_HEIGHT=16;
export const MAX_FLOORS=5;
export const LAND_PRICE_CENTS=4500000;
export const HOUR_MS=3600000;
export const WORKER_HOURLY_CENTS=1800;
export const RECRUITMENT_CENTS=125000;
export const roomTypes:ReadonlyArray<{id:RoomType;label:string;minWidth:number;minHeight:number}>=[
 {id:'guest',label:'Guest room',minWidth:3,minHeight:3},
 {id:'bathroom',label:'Bathroom',minWidth:2,minHeight:2},
 {id:'kitchen',label:'Kitchen',minWidth:3,minHeight:3},
 {id:'restaurant',label:'Restaurant',minWidth:3,minHeight:3},
 {id:'bar',label:'Bar',minWidth:3,minHeight:3},
 {id:'lobby',label:'Reception / lobby',minWidth:3,minHeight:3},
 {id:'storage',label:'Storage',minWidth:2,minHeight:2},
 {id:'staff',label:'Staff room',minWidth:2,minHeight:2},
 {id:'corridor',label:'Corridor',minWidth:2,minHeight:2}
];
export const furniture:ReadonlyArray<{code:FurnitureCode;name:string;priceCents:number;width:number;height:number;requires?:RoomType[]}>=[
 {code:'bed',name:'Double bed',priceCents:105000,width:2,height:2,requires:['guest']},
 {code:'single-bed',name:'Single bed',priceCents:62000,width:1,height:2,requires:['guest']},
 {code:'wardrobe',name:'Wardrobe',priceCents:38000,width:1,height:1,requires:['guest','staff']},
 {code:'television',name:'Television',priceCents:49000,width:1,height:1,requires:['guest','bar','lobby']},
 {code:'desk',name:'Desk',priceCents:42000,width:2,height:1,requires:['guest','staff','lobby']},
 {code:'lamp',name:'Floor lamp',priceCents:9000,width:1,height:1},
 {code:'sofa',name:'Sofa',priceCents:63000,width:2,height:1,requires:['lobby','guest','staff']},
 {code:'reception',name:'Reception desk',priceCents:145000,width:2,height:1,requires:['lobby']},
 {code:'toilet',name:'Toilet',priceCents:33000,width:1,height:1,requires:['bathroom']},
 {code:'shower',name:'Shower',priceCents:64000,width:1,height:1,requires:['bathroom']},
 {code:'sink',name:'Sink',priceCents:28000,width:1,height:1,requires:['bathroom','kitchen','bar']},
 {code:'oven',name:'Commercial oven',priceCents:320000,width:2,height:1,requires:['kitchen']},
 {code:'fridge',name:'Refrigerator',priceCents:174000,width:1,height:1,requires:['kitchen','bar','storage']},
 {code:'freezer',name:'Freezer',priceCents:207000,width:1,height:1,requires:['kitchen','storage']},
 {code:'prep',name:'Preparation table',priceCents:89000,width:2,height:1,requires:['kitchen']},
 {code:'table',name:'Dining table',priceCents:39000,width:2,height:1,requires:['restaurant','bar','staff']},
 {code:'chair',name:'Dining chair',priceCents:12500,width:1,height:1,requires:['restaurant','bar','staff','lobby']},
 {code:'bar-counter',name:'Bar counter',priceCents:218000,width:3,height:1,requires:['bar']},
 {code:'coffee',name:'Coffee machine',priceCents:87000,width:1,height:1,requires:['bar','kitchen','lobby']},
 {code:'shelves',name:'Shelving',priceCents:48000,width:1,height:1,requires:['storage','bar','kitchen']}
];
const storagePrefix='travelempire.internal-buildings.v1.';
const rectOverlaps=(a:{x:number;y:number;width:number;height:number},b:{x:number;y:number;width:number;height:number})=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export const blankFloor=(index:number):HotelFloor=>({id:'floor-'+index,label:index===0?'Ground floor':'Floor '+index,rooms:[],walls:[],objects:[]});
export const emptyConstruction=(gameHour:number):ConstructionState=>({version:1,sites:{},workers:0,lastPayrollHour:gameHour});
export function loadConstruction(companyId:string|undefined,hour:number):ConstructionState{
 if(!companyId)return emptyConstruction(hour);
 try{
  const parsed:unknown=JSON.parse(localStorage.getItem(storagePrefix+companyId)??'null');
  if(parsed&&typeof parsed==='object'&&'sites' in parsed&&'version' in parsed){
   const saved=parsed as ConstructionState;
   if(saved.version===1&&saved.sites&&typeof saved.sites==='object'&&Number.isFinite(saved.workers)){
    return {...saved,lastPayrollHour:Number.isFinite(saved.lastPayrollHour)?saved.lastPayrollHour:hour};
   }
  }
 }catch{/* Invalid or older storage: start a fresh construction workspace. */}
 return emptyConstruction(hour);
}
export function saveConstruction(companyId:string,state:ConstructionState):void{
 localStorage.setItem(storagePrefix+companyId,JSON.stringify(state));
}
export function newHotelSite(id:string,name:string,kind:'new'|'existing',lat:number,lng:number,hour:number,sourceHoldingId?:string):HotelSite{
 return {id,name,kind,sourceHoldingId,latitude:lat,longitude:lng,width:HOTEL_GRID_WIDTH,height:HOTEL_GRID_HEIGHT,draft:[blankFloor(0)],built:[blankFloor(0)],projects:[],createdHour:hour};
}
export function drawRoom(floor:HotelFloor,room:Room,site:HotelSite):HotelFloor{
 if(!Number.isInteger(room.x)||!Number.isInteger(room.y)||!Number.isInteger(room.width)||!Number.isInteger(room.height))throw Error('Room coordinates must use the building grid.');
 const spec=roomTypes.find(t=>t.id===room.type);
 if(!spec||room.width<spec.minWidth||room.height<spec.minHeight)throw Error('This room is smaller than its required minimum.');
 if(room.x<0||room.y<0||room.x+room.width>site.width||room.y+room.height>site.height)throw Error('Room extends outside the building.');
 if(floor.rooms.some(existing=>rectOverlaps(existing,room)))throw Error('Rooms cannot overlap.');
 return {...floor,rooms:[...floor.rooms,room]};
}
export function toggleWall(floor:HotelFloor,wall:Wall,site:HotelSite):HotelFloor{
 if(!Number.isInteger(wall.x)||!Number.isInteger(wall.y)||wall.x<0||wall.y<0||
    (wall.orientation==='h'&&(wall.x>=site.width||wall.y>site.height))||
    (wall.orientation==='v'&&(wall.x>site.width||wall.y>=site.height)))throw Error('Wall must be within the floor plan.');
 const old=floor.walls.find(w=>w.x===wall.x&&w.y===wall.y&&w.orientation===wall.orientation);
 return {...floor,walls:old?old.type===wall.type?floor.walls.filter(w=>w.id!==old.id):floor.walls.map(w=>w.id===old.id?wall:w):[...floor.walls,wall]};
}
export const furnitureSize=(item:ObjectPlacement)=>{const spec=furniture.find(f=>f.code===item.code);if(!spec)throw Error('Unknown furniture.');return {width:item.rotated?spec.height:spec.width,height:item.rotated?spec.width:spec.height};};
export function placeFurniture(floor:HotelFloor,item:ObjectPlacement,site:HotelSite):HotelFloor{
 if(!Number.isInteger(item.x)||!Number.isInteger(item.y)||item.x<0||item.y<0)throw Error('Invalid furniture position.');
 const spec=furniture.find(f=>f.code===item.code);if(!spec)throw Error('Furniture does not exist.');
 const size=furnitureSize(item),box={x:item.x,y:item.y,...size};
 if(item.x+size.width>site.width||item.y+size.height>site.height)throw Error('Object exceeds the building boundary.');
 const room=floor.rooms.find(r=>box.x>=r.x&&box.y>=r.y&&box.x+box.width<=r.x+r.width&&box.y+box.height<=r.y+r.height);
 if(!room)throw Error('Furniture must fit entirely inside a room.');
 if(spec.requires&&!spec.requires.includes(room.type))throw Error(spec.name+' cannot be placed inside '+room.name+'.');
 if(floor.objects.some(old=>rectOverlaps({...old,...furnitureSize(old)},box)))throw Error('The furniture would overlap another object.');
 return {...floor,objects:[...floor.objects,item]};
}
export function updateFloor(site:HotelSite,index:number,mutate:(floor:HotelFloor)=>HotelFloor):HotelSite{
 if(site.projects.some(p=>p.status==='active'))throw Error('Finish the current construction project before editing another blueprint.');
 if(index<0||index>=site.draft.length)throw Error('Floor not found.');
 return {...site,draft:site.draft.map((f,i)=>i===index?mutate(f):f)};
}
export function addFloor(site:HotelSite):HotelSite{
 if(site.projects.some(p=>p.status==='active'))throw Error('Construction is already underway.');
 if(site.draft.length>=MAX_FLOORS)throw Error('Maximum number of floors reached.');
 return {...site,draft:[...site.draft,blankFloor(site.draft.length)]};
}
const materialData=[
 {id:'concrete',name:'Concrete',unit:'m³',unitCents:13500},
 {id:'brick',name:'Masonry blocks',unit:'units',unitCents:170},
 {id:'timber',name:'Timber / framing',unit:'m',unitCents:1750},
 {id:'wiring',name:'Electrical cable',unit:'m',unitCents:440},
 {id:'plumbing',name:'Plumbing supplies',unit:'units',unitCents:8400},
 {id:'flooring',name:'Floor finish',unit:'m²',unitCents:2100},
 {id:'paint',name:'Paint',unit:'L',unitCents:1550}
] as const;
const floorMetric=(floor:HotelFloor)=>JSON.stringify({rooms:floor.rooms.map(r=>[r.id,r.x,r.y,r.width,r.height,r.type]),walls:floor.walls.map(w=>[w.x,w.y,w.orientation,w.type]),objects:floor.objects.map(o=>[o.id,o.x,o.y,o.code,o.rotated])});
export function constructionQuote(site:HotelSite,method:TradeMode,workers:number):BuildQuote{
 if(site.projects.some(p=>p.status==='active'))throw Error('Construction is already underway.');
 if(method==='own'&&workers<2)throw Error('Hire at least two construction workers to build with your own crew.');
 let area=0,wallCount=0,bathrooms=0,objectsCents=0,newFloors=0,changes=0,demolition=0;
 for(let i=0;i<site.draft.length;i++){
  const draft=site.draft[i],built=site.built[i]??blankFloor(i);
  if(floorMetric(draft)===floorMetric(built))continue;
  changes++;
  if(i>=site.built.length)newFloors++;
  const builtRooms=new Map(built.rooms.map(r=>[r.id,r]));
  for(const r of draft.rooms){
   const old=builtRooms.get(r.id);
   if(old&&old.x===r.x&&old.y===r.y&&old.width===r.width&&old.height===r.height&&old.type===r.type)continue;
   area+=r.width*r.height;wallCount+=2*(r.width+r.height);
   if(r.type==='bathroom'||r.type==='kitchen'||r.type==='bar')bathrooms+=r.type==='bathroom'?1:2;
  }
  demolition+=built.rooms.filter(r=>!draft.rooms.some(next=>next.id===r.id)).reduce((total,r)=>total+r.width*r.height,0);
  const existed=new Map(built.objects.map(o=>[o.id,o]));
  for(const item of draft.objects){
   const prior=existed.get(item.id);
   if(prior&&prior.code===item.code)continue;
   objectsCents+=furniture.find(f=>f.code===item.code)?.priceCents??0;
  }
  wallCount+=draft.walls.filter(w=>!built.walls.some(old=>old.x===w.x&&old.y===w.y&&old.orientation===w.orientation&&old.type===w.type)).length;
 }
 const quantities=[
  Math.ceil(area*0.13+newFloors*22),
  Math.ceil(wallCount*9),
  Math.ceil(wallCount*0.9),
  Math.ceil(area*1.1),
  bathrooms*3,
  Math.ceil(area),
  Math.ceil(area*0.3)
 ];
 const materials=materialData.map((data,i)=>({...data,quantity:quantities[i],totalCents:quantities[i]*data.unitCents})).filter(x=>x.quantity>0);
 const materialCents=materials.reduce((sum,m)=>sum+m.totalCents,0)+newFloors*1200000+demolition*5000;
 const workUnits=Math.max(0,area*1.4+wallCount*0.65+changes*2+demolition+newFloors*35);
 const labourCents=method==='contractor'?Math.ceil(workUnits*6200):Math.ceil(workUnits*1400);
 const deliveryHours=changes?8+Math.ceil(materials.length/3):0;
 const constructionHours=changes?Math.max(8,Math.ceil(workUnits/(method==='contractor'?4.8:Math.max(2,workers)*0.8))):0;
 return {materials,materialCents,furnitureCents:objectsCents,labourCents,totalCents:materialCents+objectsCents+labourCents,workUnits,deliveryHours,constructionHours,changes};
}
export function beginConstruction(site:HotelSite,method:TradeMode,workers:number,nowHour:number,id:string):{site:HotelSite;quote:BuildQuote}{
 const quote=constructionQuote(site,method,workers);
 if(quote.changes===0)throw Error('Draw a room, place furniture or add a floor before starting construction.');
 const project:ConstructionProject={id,method,startHour:nowHour,deliveryHour:nowHour+quote.deliveryHours,
  finishHour:nowHour+quote.deliveryHours+quote.constructionHours,budgetCents:quote.totalCents,
  materials:quote.materials,furnitureCents:quote.furnitureCents,labourCents:quote.labourCents,
  target:JSON.parse(JSON.stringify(site.draft)) as HotelFloor[],status:'active'};
 return {site:{...site,projects:[...site.projects,project]},quote};
}
export function progressProject(project:ConstructionProject,hour:number):number{
 if(hour<=project.deliveryHour)return 0;
 return Math.max(0,Math.min(100,100*(hour-project.deliveryHour)/Math.max(1,project.finishHour-project.deliveryHour)));
}
export function settleConstruction(state:ConstructionState,nowHour:number):{state:ConstructionState;wageCents:number;completed:string[]}{
 const hour=Math.max(state.lastPayrollHour,Math.floor(nowHour));
 // Cap catch-up at 30 game days. No background timer or network request is required.
 const paidHours=Math.min(720,Math.max(0,hour-state.lastPayrollHour));
 const wageCents=Math.round(paidHours*state.workers*WORKER_HOURLY_CENTS);
 const completed:string[]=[];
 let changed=paidHours>0;
 const sites={...state.sites};
 for(const [id,site] of Object.entries(sites)){
  const completedJobs=site.projects.filter(p=>p.status==='active'&&p.finishHour<=hour);
  if(!completedJobs.length)continue;
  const latest=completedJobs[completedJobs.length-1];
  sites[id]={...site,built:latest.target,projects:site.projects.map(p=>p.status==='active'&&p.finishHour<=hour?{...p,status:'complete'}:p)};
  completed.push(site.name);
  changed=true;
 }
 return {state:changed?{...state,sites,lastPayrollHour:hour}:state,wageCents,completed};
}
export function roomIssues(floor:HotelFloor,room:Room):string[]{
 const codes=new Set(floor.objects.filter(o=>o.x>=room.x&&o.y>=room.y&&o.x<room.x+room.width&&o.y<room.y+room.height).map(o=>o.code));
 const needs:Partial<Record<RoomType,FurnitureCode[][]>>={
  guest:[['bed','single-bed']],bathroom:[['toilet'],['sink']],kitchen:[['oven'],['fridge'],['sink']],
  bar:[['bar-counter']],restaurant:[['table'],['chair']],lobby:[['reception']],storage:[['shelves']]
 };
 return (needs[room.type]??[]).filter(group=>!group.some(code=>codes.has(code))).map(group=>'Missing '+group.join(' or '));
}
export const euros=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(cents/100);
