/** Internal hotel development: blueprints, procurement, works and game-clock settlement.
 * Keeps passive property shares untouched. External tendering is intentionally out of scope.
 */
import type {HotelOperations} from './hotelOperations';
import type {ConstructionFreight} from './constructionLogistics';
import {furnitureProductForPlacement,FURNITURE_REFINISH_CENTS} from './furnitureCatalog';
import {roomSections,roomsOverlap,containsRoomRect,containsRoomCell,roomArea,roomPerimeter,roomShapeEqual,type RoomSection} from './hotelRoomGeometry';
export type RoomType='guest'|'bathroom'|'kitchen'|'restaurant'|'bar'|'lobby'|'storage'|'staff'|'corridor'|'office'|'meeting'|'stairwell'|'elevator';
export type BuilderTool='room'|'wall'|'door'|'window'|'lighting'|'safety'|'furniture'|'erase';
export type TradeMode='contractor'|'own';
export type FurnitureCode='bed'|'single-bed'|'wardrobe'|'television'|'desk'|'lamp'|'sofa'|'reception'|'toilet'|'shower'|'sink'|'oven'|'fridge'|'freezer'|'prep'|'table'|'chair'|'bar-counter'|'coffee'|'shelves'|'computer'|'printer'|'office-chair'|'conference-table'|
 'nightstand'|'minibar'|'safe'|'headboard'|'vanity'|'bathtub'|'mirror'|'towel-rack'|'armchair'|'coffee-table'|'tv-stand'|'bench'|'water-cooler'|'reading-chair'|'dishwasher'|'microwave'|'kitchen-island'|'bar-stool'|'booth'|'plant'|'rug'|'sculpture'|'sofa-bed'|'luggage-rack';
export type Room={id:string;type:RoomType;name:string;x:number;y:number;width:number;height:number;
 /** For connected L/T/U corridors only. Bounding box remains x/y/w/h. */
 sections?:RoomSection[];};
export type Wall={id:string;x:number;y:number;orientation:'h'|'v';type:'wall'|'door'|'window'|'panoramic-window'};
export type LightingKind='ceiling'|'ambient';
export type LightingFixture={id:string;kind:LightingKind;x:number;y:number};
/** Equipment is ceiling/wall-mounted in the local 1 m floor grid, not floor furniture. */
export type SafetyFixtureKind='smoke-alarm'|'fire-extinguisher'|'exit-sign';
export type SafetyFixture={id:string;kind:SafetyFixtureKind;x:number;y:number};
export type ObjectPlacement={id:string;code:FurnitureCode;x:number;y:number;rotated:boolean;
 /** Optional catalogue choice and finish; missing values are valid historical saves. */
 modelId?:string;finish?:string;
 /** Optional themed collection identity; legacy objects retain catalogue style. */
 designStyle?:import('./furnitureCatalog').FurnitureStyle;};
export type HotelFloor={id:string;label:string;rooms:Room[];walls:Wall[];objects:ObjectPlacement[];
 /** Optional so every existing saved blueprint remains readable. */
 lights?:LightingFixture[];safetyFixtures?:SafetyFixture[];};
export type MaterialLine={id:string;name:string;unit:string;quantity:number;unitCents:number;totalCents:number};
export type BuildQuote={materials:MaterialLine[];materialCents:number;furnitureCents:number;labourCents:number;totalCents:number;workUnits:number;deliveryHours:number;constructionHours:number;changes:number};
export type ConstructionProject={id:string;method:TradeMode;startHour:number;deliveryHour:number;finishHour:number;budgetCents:number;materials:MaterialLine[];furnitureCents:number;labourCents:number;target:HotelFloor[];freight?:ConstructionFreight;status:'active'|'complete'};
export type SupplyCode='eggs'|'milk'|'bread'|'coffee-beans'|'fruit'|'vegetables'|'chicken'|'water'|'soft-drinks'|'wine'|'beer'|'spirits'|'cleaner'|'linen'|'toiletries';
export type SupplyCategory='kitchen'|'bar'|'housekeeping';
export type SupplyOrder={id:string;code:SupplyCode;quantity:number;unitCents:number;orderedHour:number;deliveryHour:number;status:'ordered'|'delivered'};
export type StockBatch={id:string;quantity:number;expiresHour:number};
export const supplies:ReadonlyArray<{code:SupplyCode;name:string;category:SupplyCategory;unit:string;unitCents:number;deliveryHours:number;expiryHours:number}>=[
 {code:'eggs',name:'Eggs',category:'kitchen',unit:'pcs',unitCents:35,deliveryHours:6,expiryHours:14*24},
 {code:'milk',name:'Milk',category:'kitchen',unit:'L',unitCents:150,deliveryHours:6,expiryHours:7*24},
 {code:'bread',name:'Bread',category:'kitchen',unit:'loaves',unitCents:230,deliveryHours:4,expiryHours:4*24},
 {code:'coffee-beans',name:'Coffee beans',category:'kitchen',unit:'kg',unitCents:1400,deliveryHours:8,expiryHours:90*24},
 {code:'fruit',name:'Fresh fruit',category:'kitchen',unit:'kg',unitCents:350,deliveryHours:8,expiryHours:9*24},
 {code:'vegetables',name:'Vegetables',category:'kitchen',unit:'kg',unitCents:400,deliveryHours:8,expiryHours:7*24},
 {code:'chicken',name:'Chicken',category:'kitchen',unit:'kg',unitCents:920,deliveryHours:8,expiryHours:4*24},
 {code:'water',name:'Water bottles',category:'bar',unit:'bottles',unitCents:85,deliveryHours:7,expiryHours:365*24},
 {code:'soft-drinks',name:'Soft drinks',category:'bar',unit:'cans',unitCents:115,deliveryHours:7,expiryHours:180*24},
 {code:'wine',name:'Wine',category:'bar',unit:'bottles',unitCents:900,deliveryHours:12,expiryHours:365*24},
 {code:'beer',name:'Beer',category:'bar',unit:'bottles',unitCents:220,deliveryHours:12,expiryHours:180*24},
 {code:'spirits',name:'Spirits',category:'bar',unit:'bottles',unitCents:1450,deliveryHours:16,expiryHours:365*24},
 {code:'cleaner',name:'Cleaning supplies',category:'housekeeping',unit:'units',unitCents:480,deliveryHours:8,expiryHours:365*24},
 {code:'linen',name:'Linen sets',category:'housekeeping',unit:'sets',unitCents:2900,deliveryHours:20,expiryHours:1000*24},
 {code:'toiletries',name:'Guest toiletries',category:'housekeeping',unit:'packs',unitCents:340,deliveryHours:8,expiryHours:365*24}
];
export type HotelSite={
 id:string;name:string;kind:'new'|'existing'|'headquarters';sourceHoldingId?:string;
 longitude:number;latitude:number;width:number;height:number;
 draft:HotelFloor[];built:HotelFloor[];projects:ConstructionProject[];createdHour:number;
 supplyOrders?:SupplyOrder[];stock?:Partial<Record<SupplyCode,StockBatch[]>>;
 operations?:HotelOperations;
 /** v1 checks ground-floor rooms, v2 adds aligned vertical access. Old saves are grandfathered. */
 accessRulesVersion?:1|2;
 /** New plots opt in to window/lighting-driven atmosphere; legacy hotels preserve demand. */
 atmosphereRulesVersion?:1;
 /** Opt-in simulated fire escape and wheelchair access for new hotels only. */
 safetyRulesVersion?:1;
};
export type ConstructionState={version:1;sites:Record<string,HotelSite>;workers:number;lastPayrollHour:number};
export const HOTEL_GRID_WIDTH=24;
export const HOTEL_GRID_HEIGHT=16;
export const MAX_FLOORS=5;
export const LAND_PRICE_CENTS=4500000;
export const MIN_HOTEL_PLOT_SIDE=12;
export const MAX_HOTEL_PLOT_SIDE=64;
export const HOTEL_PLOT_SIZE_STEP=2;
export type HotelPlotSize={width:number;height:number};
/** Plot prices scale with purchased land area; the historic 24×16 m plot remains €45,000. */
export function validHotelPlotSize(size:HotelPlotSize):boolean{
 return Number.isInteger(size.width)&&Number.isInteger(size.height)&&
  size.width>=MIN_HOTEL_PLOT_SIDE&&size.width<=MAX_HOTEL_PLOT_SIDE&&
  size.height>=MIN_HOTEL_PLOT_SIDE&&size.height<=MAX_HOTEL_PLOT_SIDE&&
  size.width%HOTEL_PLOT_SIZE_STEP===0&&size.height%HOTEL_PLOT_SIZE_STEP===0;
}
export function hotelPlotCostCents(size:HotelPlotSize):number{
 if(!validHotelPlotSize(size))throw new Error('Plot width and length must be even numbers between 12 and 64 metres.');
 return Math.round(LAND_PRICE_CENTS*(size.width*size.height)/(HOTEL_GRID_WIDTH*HOTEL_GRID_HEIGHT));
}
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
 {id:'corridor',label:'Corridor',minWidth:2,minHeight:2},
 {id:'stairwell',label:'Stairwell',minWidth:2,minHeight:3},
 {id:'elevator',label:'Elevator shaft',minWidth:2,minHeight:2},
 {id:'office',label:'Office',minWidth:3,minHeight:3},
 {id:'meeting',label:'Meeting room',minWidth:3,minHeight:3}
];
export const furniture:ReadonlyArray<{code:FurnitureCode;name:string;priceCents:number;width:number;height:number;requires?:RoomType[]}>=[
 {code:'bed',name:'Double bed',priceCents:105000,width:2,height:2,requires:['guest']},
 {code:'single-bed',name:'Single bed',priceCents:62000,width:1,height:2,requires:['guest']},
 {code:'wardrobe',name:'Wardrobe',priceCents:38000,width:1,height:1,requires:['guest','staff']},
 {code:'television',name:'Television',priceCents:49000,width:1,height:1,requires:['guest','bar','lobby']},
 {code:'desk',name:'Desk',priceCents:42000,width:2,height:1,requires:['guest','staff','lobby','office']},
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
 {code:'chair',name:'Dining chair',priceCents:12500,width:1,height:1,requires:['restaurant','bar','staff','lobby','meeting']},
 {code:'bar-counter',name:'Bar counter',priceCents:218000,width:3,height:1,requires:['bar']},
 {code:'coffee',name:'Coffee machine',priceCents:87000,width:1,height:1,requires:['bar','kitchen','lobby']},
 {code:'shelves',name:'Shelving',priceCents:48000,width:1,height:1,requires:['storage','bar','kitchen','office']},
 {code:'computer',name:'Office computer',priceCents:78000,width:1,height:1,requires:['office','meeting','lobby']},
 {code:'printer',name:'Printer',priceCents:28000,width:1,height:1,requires:['office','staff']},
 {code:'office-chair',name:'Office chair',priceCents:19000,width:1,height:1,requires:['office','meeting']},
 {code:'conference-table',name:'Conference table',priceCents:150000,width:3,height:2,requires:['meeting']},
 {code:'nightstand',name:'Bedside table',priceCents:19000,width:1,height:1,requires:['guest']},
 {code:'minibar',name:'Guest minibar',priceCents:74000,width:1,height:1,requires:['guest']},
 {code:'safe',name:'Room safe',priceCents:32000,width:1,height:1,requires:['guest','office']},
 {code:'headboard',name:'Headboard console',priceCents:40000,width:2,height:1,requires:['guest']},
 {code:'vanity',name:'Dressing table',priceCents:65000,width:2,height:1,requires:['guest','bathroom']},
 {code:'bathtub',name:'Bathtub',priceCents:125000,width:2,height:1,requires:['bathroom']},
 {code:'mirror',name:'Standing mirror',priceCents:17000,width:1,height:1,requires:['guest','bathroom','lobby','staff']},
 {code:'towel-rack',name:'Towel stand',priceCents:9500,width:1,height:1,requires:['bathroom']},
 {code:'armchair',name:'Armchair',priceCents:45000,width:1,height:1,requires:['guest','lobby','staff','office']},
 {code:'coffee-table',name:'Coffee table',priceCents:34000,width:2,height:1,requires:['guest','lobby','staff']},
 {code:'tv-stand',name:'Media console',priceCents:38000,width:2,height:1,requires:['guest','lobby','bar']},
 {code:'bench',name:'Lobby bench',priceCents:28000,width:2,height:1,requires:['lobby','staff']},
 {code:'water-cooler',name:'Water dispenser',priceCents:44000,width:1,height:1,requires:['lobby','office','staff']},
 {code:'reading-chair',name:'Reading chair',priceCents:44000,width:1,height:1,requires:['guest','lobby']},
 {code:'dishwasher',name:'Dishwasher',priceCents:96000,width:1,height:1,requires:['kitchen']},
 {code:'microwave',name:'Microwave',priceCents:28000,width:1,height:1,requires:['kitchen','bar']},
 {code:'kitchen-island',name:'Kitchen island',priceCents:130000,width:2,height:2,requires:['kitchen']},
 {code:'bar-stool',name:'Bar stool',priceCents:16000,width:1,height:1,requires:['bar']},
 {code:'booth',name:'Dining booth',priceCents:88000,width:2,height:2,requires:['restaurant','bar']},
 {code:'plant',name:'Potted plant',priceCents:11000,width:1,height:1,requires:['guest','lobby','restaurant','bar','office','staff']},
 {code:'rug',name:'Area rug',priceCents:26000,width:2,height:2,requires:['guest','lobby','staff','office']},
 {code:'sculpture',name:'Decorative sculpture',priceCents:55000,width:1,height:1,requires:['lobby','restaurant','bar']},
 {code:'sofa-bed',name:'Sofa bed',priceCents:93000,width:2,height:2,requires:['guest','staff']},
 {code:'luggage-rack',name:'Luggage rack',priceCents:14000,width:1,height:1,requires:['guest']}
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
export function newHotelSite(
 id:string,name:string,kind:'new'|'existing'|'headquarters',lat:number,lng:number,hour:number,
 sourceHoldingId?:string,plotSize?:HotelPlotSize
):HotelSite{
 if(kind==='new'&&plotSize&&!validHotelPlotSize(plotSize))throw new Error('Invalid development plot dimensions.');
 const width=kind==='new'&&plotSize?plotSize.width:HOTEL_GRID_WIDTH;
 const height=kind==='new'&&plotSize?plotSize.height:HOTEL_GRID_HEIGHT;
 return {id,name,kind,sourceHoldingId,latitude:lat,longitude:lng,width,height,draft:[blankFloor(0)],built:[blankFloor(0)],projects:[],createdHour:hour,supplyOrders:[],stock:{}};
}
export function drawRoom(floor:HotelFloor,room:Room,site:HotelSite):HotelFloor{
 if(!Number.isInteger(room.x)||!Number.isInteger(room.y)||!Number.isInteger(room.width)||!Number.isInteger(room.height))throw Error('Room coordinates must use the building grid.');
 const spec=roomTypes.find(t=>t.id===room.type);
 if(!spec||room.width<spec.minWidth||room.height<spec.minHeight)throw Error('This room is smaller than its required minimum.');
 if(room.x<0||room.y<0||room.x+room.width>site.width||room.y+room.height>site.height)throw Error('Room extends outside the building.');
 if(floor.rooms.some(existing=>roomsOverlap(existing,room)))throw Error('Rooms cannot overlap.');
 return {...floor,rooms:[...floor.rooms,room]};
}
export function toggleWall(floor:HotelFloor,wall:Wall,site:HotelSite):HotelFloor{
 if(!Number.isInteger(wall.x)||!Number.isInteger(wall.y)||wall.x<0||wall.y<0||
    (wall.orientation==='h'&&(wall.x>=site.width||wall.y>site.height))||
    (wall.orientation==='v'&&(wall.x>site.width||wall.y>=site.height)))throw Error('Wall must be within the floor plan.');
 const old=floor.walls.find(w=>w.x===wall.x&&w.y===wall.y&&w.orientation===wall.orientation);
 return {...floor,walls:old?old.type===wall.type?floor.walls.filter(w=>w.id!==old.id):floor.walls.map(w=>w.id===old.id?wall:w):[...floor.walls,wall]};
}
export const furnitureSize=(item:ObjectPlacement)=>{const spec=furnitureProductForPlacement(furniture,item);return {width:item.rotated?spec.height:spec.width,height:item.rotated?spec.width:spec.height};};
export function placeFurniture(floor:HotelFloor,item:ObjectPlacement,site:HotelSite):HotelFloor{
 if(!Number.isInteger(item.x)||!Number.isInteger(item.y)||item.x<0||item.y<0)throw Error('Invalid furniture position.');
 const base=furniture.find(f=>f.code===item.code);if(!base)throw Error('Furniture does not exist.');
 const spec=furnitureProductForPlacement(furniture,item);
 if(item.modelId&&!spec.catalogueModel)throw Error('This furniture model does not exist.');
 const size=furnitureSize(item),box={x:item.x,y:item.y,...size};
 if(item.x+size.width>site.width||item.y+size.height>site.height)throw Error('Object exceeds the building boundary.');
 const room=floor.rooms.find(r=>containsRoomRect(r,box));
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
const verticalCorePrice=(type:RoomType)=>type==='stairwell'?750000:type==='elevator'?3200000:0;
const verticalCoreWork=(type:RoomType)=>type==='stairwell'?12:type==='elevator'?24:0;
const floorMetric=(floor:HotelFloor)=>JSON.stringify({rooms:floor.rooms.map(r=>[r.id,r.x,r.y,r.width,r.height,r.type,r.sections??null]),walls:floor.walls.map(w=>[w.x,w.y,w.orientation,w.type]),objects:floor.objects.map(o=>[o.id,o.x,o.y,o.code,o.rotated,o.modelId??'',o.finish??'',o.designStyle??'']),lights:(floor.lights??[]).map(l=>[l.id,l.x,l.y,l.kind]),safety:(floor.safetyFixtures??[]).map(f=>[f.id,f.x,f.y,f.kind])});
export function constructionQuote(site:HotelSite,method:TradeMode,workers:number):BuildQuote{
 if(site.projects.some(p=>p.status==='active'))throw Error('Construction is already underway.');
 if(method==='own'&&workers<2)throw Error('Hire at least two construction workers to build with your own crew.');
 let area=0,wallCount=0,bathrooms=0,objectsCents=0,newFloors=0,changes=0,demolition=0;
 let stairModules=0,liftModules=0,verticalWork=0;
 let newWindows=0,newPanoramicWindows=0,newLights=0;
 let newSafety=0;
 for(let i=0;i<site.draft.length;i++){
  const draft=site.draft[i],built=site.built[i]??blankFloor(i);
  if(floorMetric(draft)===floorMetric(built))continue;
  changes++;
  if(i>=site.built.length)newFloors++;
  const builtRooms=new Map(built.rooms.map(r=>[r.id,r]));
  for(const r of draft.rooms){
   const old=builtRooms.get(r.id);
   if(old&&roomShapeEqual(old,r))continue;
   area+=Math.max(0,roomArea(r)-(old?roomArea(old):0));
   wallCount+=Math.max(0,roomPerimeter(r)-(old?roomPerimeter(old):0));
   if(r.type==='stairwell')stairModules++;
   if(r.type==='elevator')liftModules++;
   verticalWork+=verticalCoreWork(r.type);
   if(r.type==='bathroom'||r.type==='kitchen'||r.type==='bar')bathrooms+=r.type==='bathroom'?1:2;
  }
  demolition+=built.rooms.filter(r=>!draft.rooms.some(next=>next.id===r.id)).reduce((total,r)=>total+roomArea(r),0);
  const existed=new Map(built.objects.map(o=>[o.id,o]));
  for(const item of draft.objects){
   const prior=existed.get(item.id);
   if(prior&&prior.code===item.code&&prior.modelId===item.modelId){
    if(prior.finish!==item.finish||prior.designStyle!==item.designStyle)
     objectsCents+=FURNITURE_REFINISH_CENTS;
    continue;
   }
   // Buying or replacing a furniture model is priced at the new model's full
   // cost. Pure moves and rotations do not buy it a second time.
   objectsCents+=furnitureProductForPlacement(furniture,item).priceCents;
  }
  const addedWalls=draft.walls.filter(w=>!built.walls.some(old=>old.x===w.x&&old.y===w.y&&old.orientation===w.orientation&&old.type===w.type));
  wallCount+=addedWalls.length;
  newWindows+=addedWalls.filter(w=>w.type==='window').length;
  newPanoramicWindows+=addedWalls.filter(w=>w.type==='panoramic-window').length;
  const priorLights=new Map((built.lights??[]).map(l=>[l.id,l]));
  for(const light of draft.lights??[]){
   const previous=priorLights.get(light.id);
   if(previous?.kind===light.kind)continue;
   newLights++;
   objectsCents+=light.kind==='ceiling'?22000:12000;
  }
  const installed=new Map((built.safetyFixtures??[]).map(f=>[f.id,f]));
  for(const fixture of draft.safetyFixtures??[]){
   const previous=installed.get(fixture.id);
   if(previous?.kind===fixture.kind)continue;
   newSafety++;
   objectsCents+=fixture.kind==='smoke-alarm'?9500:
    fixture.kind==='fire-extinguisher'?18000:12000;
  }
 }
 const quantities=[
  Math.ceil(area*0.13+newFloors*22),
  Math.ceil(wallCount*9),
  Math.ceil(wallCount*0.9),
  Math.ceil(area*1.1)+newLights*2+newSafety,
  bathrooms*3,
  Math.ceil(area),
  Math.ceil(area*0.3)
 ];
 const materials:MaterialLine[]=materialData.map((data,i)=>({...data,quantity:quantities[i],totalCents:quantities[i]*data.unitCents})).filter(x=>x.quantity>0);
 // Glazing is a paid construction component, never a free decorative stroke.
 if(newWindows)materials.push({id:'window-glazing',name:'Exterior window glazing',unit:'panel',quantity:newWindows,unitCents:25000,totalCents:newWindows*25000});
 if(newPanoramicWindows)materials.push({id:'panoramic-glazing',name:'Panoramic glazing',unit:'panel',quantity:newPanoramicWindows,unitCents:60000,totalCents:newPanoramicWindows*60000});
 // Prefabricated stairs and lift machinery enter normal material procurement,
 // scheduled deliveries, project quotes and bank/company accounting.
 for(const [type,count,label] of [['stairwell',stairModules,'Stairwell module'],['elevator',liftModules,'Elevator equipment']] as const){
  if(count>0){const unitCents=verticalCorePrice(type);
   materials.push({id:type+'-module',name:label,unit:'floor',quantity:count,
    unitCents,totalCents:unitCents*count});}
 }
 const materialCents=materials.reduce((sum,m)=>sum+m.totalCents,0)+newFloors*1200000+demolition*5000;
 const workUnits=Math.max(0,area*1.4+wallCount*0.65+changes*2+demolition+newFloors*35+verticalWork+
 newWindows*1.5+newPanoramicWindows*2.5+newLights*2+newSafety*1.5);
 const labourCents=method==='contractor'?Math.ceil(workUnits*6200):Math.ceil(workUnits*1400);
 const deliveryHours=changes?8+Math.ceil(materials.length/3):0;
 const constructionHours=changes?Math.max(8,Math.ceil(workUnits/(method==='contractor'?4.8:Math.max(2,workers)*0.8))):0;
 return {materials,materialCents,furnitureCents:objectsCents,labourCents,totalCents:materialCents+objectsCents+labourCents,workUnits,deliveryHours,constructionHours,changes};
}
export function beginConstruction(site:HotelSite,method:TradeMode,workers:number,nowHour:number,id:string,freight?:ConstructionFreight):{site:HotelSite;quote:BuildQuote}{
 const quote=constructionQuote(site,method,workers);
 if(quote.changes===0)throw Error('Draw a room, place furniture or add a floor before starting construction.');
 if(freight&&freight.deliveryHour<nowHour+quote.deliveryHours)throw Error('Cargo delivery cannot arrive before the original materials lead time.');
 const deliveryHour=freight?.deliveryHour??nowHour+quote.deliveryHours;
 const project:ConstructionProject={id,method,startHour:nowHour,deliveryHour,
  finishHour:deliveryHour+quote.constructionHours,budgetCents:quote.totalCents,freight,
  materials:quote.materials,furnitureCents:quote.furnitureCents,labourCents:quote.labourCents,
  target:JSON.parse(JSON.stringify(site.draft)) as HotelFloor[],status:'active'};
 return {site:{...site,projects:[...site.projects,project]},quote};
}
/** Deliveries are simulated against the company clock. Actual hotel services consume purchased stock via hotelOperations.ts. */
export function supplyStock(site:HotelSite,code:SupplyCode,hour:number):number{
 return (site.stock?.[code]??[]).filter(batch=>batch.expiresHour>hour).reduce((total,batch)=>total+batch.quantity,0);
}
export function orderSupplies(site:HotelSite,code:SupplyCode,quantity:number,hour:number,id:string):{site:HotelSite;costCents:number}{
 const item=supplies.find(s=>s.code===code);if(!item)throw Error('Unknown supply item.');
 if(!Number.isInteger(quantity)||quantity<1||quantity>200)throw Error('Order 1–200 units at a time.');
 const builtRooms=site.built.flatMap(f=>f.rooms);
 const facility=item.category==='kitchen'?'kitchen':item.category==='bar'?'bar':'storage';
 if(!builtRooms.some(r=>r.type===facility))throw Error('Finish constructing a '+facility+' before ordering these supplies.');
 const capacity=builtRooms.reduce((sum,room)=>sum+(room.type==='storage'?200:room.type==='kitchen'?100:room.type==='bar'?120:0),0);
 const already=supplies.reduce((total,supply)=>total+supplyStock(site,supply.code,hour),0)+
 (site.supplyOrders??[]).filter(o=>o.status==='ordered').reduce((total,o)=>total+o.quantity,0);
 if(already+quantity>capacity)throw Error('Not enough storage capacity. Build more storage or reduce this order.');
 const order:SupplyOrder={id,code,quantity,unitCents:item.unitCents,orderedHour:hour,deliveryHour:hour+item.deliveryHours,status:'ordered'};
 return {site:{...site,supplyOrders:[...(site.supplyOrders??[]),order]},costCents:item.unitCents*quantity};
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
  let updatedSite=site;
  const arriving=(site.supplyOrders??[]).filter(order=>order.status==='ordered'&&order.deliveryHour<=hour);
  if(arriving.length){
   const stock={...(site.stock??{})};
   for(const order of arriving){
    const item=supplies.find(item=>item.code===order.code);
    if(!item)continue;
    stock[order.code]=[...(stock[order.code]??[]),{id:order.id,quantity:order.quantity,expiresHour:order.deliveryHour+item.expiryHours}];
   }
   updatedSite={...updatedSite,stock,supplyOrders:(site.supplyOrders??[]).map(order=>order.status==='ordered'&&order.deliveryHour<=hour?{...order,status:'delivered' as const}:order)};
   changed=true;
  }
  const unexpiredStock=Object.fromEntries(Object.entries(updatedSite.stock??{}).map(([code,batches])=>[code,(batches??[]).filter(batch=>batch.expiresHour>hour)])) as HotelSite['stock'];
  if(Object.values(updatedSite.stock??{}).some(batches=>batches?.some(batch=>batch.expiresHour<=hour))){
   updatedSite={...updatedSite,stock:unexpiredStock};changed=true;
  }
  const completedJobs=site.projects.filter(p=>p.status==='active'&&p.finishHour<=hour);
  if(!completedJobs.length){if(updatedSite!==site)sites[id]=updatedSite;continue;}
  const latest=completedJobs[completedJobs.length-1];
  sites[id]={...updatedSite,built:latest.target,projects:site.projects.map(p=>p.status==='active'&&p.finishHour<=hour?{...p,status:'complete' as const}:p)};
  completed.push(site.name);
  changed=true;
 }
 return {state:changed?{...state,sites,lastPayrollHour:hour}:state,wageCents,completed};
}
export function roomIssues(floor:HotelFloor,room:Room):string[]{
 const codes=new Set(floor.objects.filter(o=>containsRoomCell(room,o.x,o.y)).map(o=>o.code));
 const needs:Partial<Record<RoomType,FurnitureCode[][]>>={
  guest:[['bed','single-bed','sofa-bed']],bathroom:[['toilet'],['sink'],['shower','bathtub']],kitchen:[['oven'],['fridge'],['sink']],office:[['desk'],['computer'],['office-chair']],meeting:[['conference-table']],
  bar:[['bar-counter']],restaurant:[['table','booth'],['chair','booth']],lobby:[['reception']],storage:[['shelves']]
 };
 return (needs[room.type]??[]).filter(group=>!group.some(code=>codes.has(code))).map(group=>
  room.type==='guest'?'Missing bed or single-bed':'Missing '+group.join(' or '));
}
export const euros=(cents:number)=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(cents/100);
