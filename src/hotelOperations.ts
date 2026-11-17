/** Hotel operations on top of internally built rooms, stocks and the shared game clock.
 * Each occupied room is a real guest stay with check-in and checkout, housekeeping
 * consumes purchased products, restaurant/bar orders consume actual stock.
 *
 * All prices and financial movements use integer cents. Hotel supply purchases have
 * already been expensed when ordered, so sold stock is not charged again.
 */
import {type ConstructionState,type HotelSite,type HotelFloor,type Room,type SupplyCode,
 type StockBatch,supplies,supplyStock,roomIssues} from './internalConstruction';
import {hotelGuestRoomQuality,hotelDesignDemandModifier} from './hotelBlueprintEditing';
import {analyzeRoomAtmosphere,hotelAtmosphereDemandModifier} from './hotelAtmosphere';
import {analyzeHotelSafety} from './hotelSafety';
import {analyzeHotelFloorAccess} from './hotelAccess';
import {analyzeHotelBuildingAccess,hotelVerticalCongestionModifier} from './hotelVerticalAccess';

export type HotelRole='reception'|'housekeeping'|'kitchen'|'bar';
export type HotelStaff=Record<HotelRole,number>;
export type HotelPeriod={fromHour:number;toHour?:number};
export type HotelGuest={id:string;roomId:string;checkInHour:number;checkOutHour:number;nightsPaid:number;rateCents:number};
export type HotelDayReport={
 day:number;roomCents:number;foodCents:number;barCents:number;wagesCents:number;utilitiesCents:number;
 guests:number;breakfasts:number;dinners:number;drinks:number;cleaned:number;unserved:number;
};
export type HotelTotals={
 roomCents:number;foodCents:number;barCents:number;wagesCents:number;utilitiesCents:number;
 guests:number;breakfasts:number;dinners:number;drinks:number;cleaned:number;unserved:number;
};
export type HotelOperations={
 periods:HotelPeriod[];
 lastSettledHour:number;
 rateCents:number;breakfastPriceCents:number;dinnerPriceCents:number;drinkPriceCents:number;
 staff:HotelStaff;
 guests:HotelGuest[];
 dirtyRoomIds:string[];
 totals:HotelTotals;
 recentDays:HotelDayReport[];
};
export type HotelSettlement={
 state:ConstructionState;
 companyNetCents:number;
 grossCents:number;expenseCents:number;hotelCount:number;
 reports:Array<{siteId:string;name:string;grossCents:number;expenseCents:number;netCents:number;share:number}>;
};
export const hotelRoles:ReadonlyArray<{id:HotelRole;label:string;wageCents:number;shift:string}>=[
 {id:'reception',label:'Reception',wageCents:750,shift:'24h coverage'},
 {id:'housekeeping',label:'Housekeeping',wageCents:1350,shift:'09:00–17:00'},
 {id:'kitchen',label:'Kitchen / chef',wageCents:1850,shift:'07–11h, 18–22h'},
 {id:'bar',label:'Bartenders',wageCents:1500,shift:'18:00–24:00'}
];
export const HOTEL_STAFF_HIRING_CENTS=14500;
export const HOTEL_MAX_STAFF_PER_ROLE=15;
export const HOTEL_MAX_SETTLEMENT_HOURS=30*24;
export const DEFAULT_HOTEL_RATE_CENTS=11500;
export const emptyTotals=():HotelTotals=>({
 roomCents:0,foodCents:0,barCents:0,wagesCents:0,utilitiesCents:0,
 guests:0,breakfasts:0,dinners:0,drinks:0,cleaned:0,unserved:0
});
const roundRate=(n:number)=>Math.round(n/100)*100;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const hash=(str:string):number=>{
 let h=2166136261;for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);return h>>>0;
};
const random01=(key:string)=>hash(key)/4294967296;
export function hotelActiveAt(ops:HotelOperations|undefined,hour:number):boolean{
 return (ops?.periods??[]).some(p=>p.fromHour<=hour&&(p.toHour===undefined||hour<p.toHour));
}
export function defaultHotelOperations(hour:number):HotelOperations{
 return {periods:[],lastSettledHour:hour,rateCents:DEFAULT_HOTEL_RATE_CENTS,
  breakfastPriceCents:1400,dinnerPriceCents:2600,drinkPriceCents:650,
  staff:{reception:0,housekeeping:0,kitchen:0,bar:0},
  guests:[],dirtyRoomIds:[],totals:emptyTotals(),recentDays:[]};
}
function buildingAt(site:HotelSite,hour:number):HotelFloor[]{
 // Construction targets record exactly when each floor-plan became usable.
 // This prevents retroactive guest revenue after long tab suspensions.
 const finished=site.projects.filter(p=>p.finishHour<=hour).sort((a,b)=>a.finishHour-b.finishHour);
 if(finished.length)return finished[finished.length-1].target;
 if(site.projects.length)return [{id:'floor-0',label:'Ground floor',rooms:[],walls:[],objects:[]}];
 return site.built;
}
export type RoomInventory={readyRooms:Array<{room:Room;floor:HotelFloor}>;bathrooms:number;
  hasLobby:boolean;hasKitchen:boolean;hasRestaurant:boolean;hasBar:boolean;reasons:string[];
  verticalGuestCapacityPerHour:number;verticalPeakGuestMovementsPerHour:number;
  verticalCongestionModifier:number;atmosphereDemandModifier:number;
  fireReadyRooms:number;wheelchairAccessibleRooms:number;safetyScore:number|null;};
export function roomInventory(site:HotelSite,hour:number):RoomInventory{
 const floors=buildingAt(site,hour);
 const rooms=floors.flatMap(f=>f.rooms);
 const exists=(type:Room['type'])=>floors.some(f=>f.rooms.some(r=>r.type===type&&roomIssues(f,r).length===0));
 const bathrooms=rooms.filter(r=>r.type==='bathroom'&&floors.some(f=>f.rooms.includes(r)&&roomIssues(f,r).length===0)).length;
 const groundAccess=site.accessRulesVersion===1&&floors[0]?
  analyzeHotelFloorAccess(floors[0],site,0):null;
 const buildingAccess=site.accessRulesVersion===2?
  analyzeHotelBuildingAccess(floors,site):null;
 const safetyReport=site.safetyRulesVersion===1?
  analyzeHotelSafety(floors,site):null;
 const safeRooms=new Set(safetyReport?.fireReadyKeys??[]);
 const accessibleRooms=new Set(safetyReport?.accessibleKeys??[]);
 const reachable=new Set(groundAccess?.guests.filter(g=>g.status==='connected')
  .map(g=>g.roomId)??[]);
 // New plots need a functional ground-floor entrance and reception route.
 // Existing saved hotels remain grandfathered. Upper-floor linking is Phase 2.
 const readyRooms=floors.flatMap((f,floorIndex)=>f.rooms.filter(r=>
  r.type==='guest'&&roomIssues(f,r).length===0&&
  f.rooms.some(b=>b.type==='bathroom'&&roomIssues(f,b).length===0)&&
  (floorIndex!==0||!groundAccess||reachable.has(r.id))&&
 (!buildingAccess||buildingAccess.floors[floorIndex]?.guests.some(g=>
  g.roomId===r.id&&g.status==='connected'))&&
  (!safetyReport||safeRooms.has(floorIndex+':'+r.id))
 ).map(room=>({room,floor:f})));

 const hasLobby=exists('lobby'),hasKitchen=exists('kitchen'),hasRestaurant=exists('restaurant'),hasBar=exists('bar');
 const reasons:string[]=[];
 if(safetyReport){
  reasons.push(...safetyReport.issues);
  const compliantAccessible=readyRooms.some(({room,floor})=>
   accessibleRooms.has(floors.indexOf(floor)+':'+room.id));
  if(readyRooms.length>0&&!compliantAccessible)
   reasons.push('Prepare at least one furnished, fire-safe wheelchair-accessible guest room.');
 }
 if(!hasLobby)reasons.push('Construct a lobby with a reception desk');
 if(buildingAccess&&floors.some(f=>f.rooms.some(r=>r.type==='guest'))&&
  !buildingAccess.receptionConnected)
  reasons.push('Provide a ground-floor entrance connected to a furnished reception');
 if(buildingAccess&&buildingAccess.upperGuestRooms>0&&
  buildingAccess.connectedUpperGuestRooms===0&&readyRooms.length===0)
  reasons.push('Align stairwells or elevators on consecutive floors and connect their doorways to corridors');
 if(groundAccess&&!groundAccess.receptionConnected&&floors[0].rooms.some(r=>r.type==='lobby'))
  reasons.push('Connect ground-floor reception to a valid exterior entrance through room or corridor doors');
 if(groundAccess&&groundAccess.guestRooms>0&&groundAccess.connectedGuests===0)
  reasons.push('Give at least one furnished ground-floor guest room a connected doorway to reception');
 if(!readyRooms.length)reasons.push('Furnish at least one guest room and a functioning bathroom on its floor');
 return {readyRooms,bathrooms,hasLobby,hasKitchen,hasRestaurant,hasBar,reasons,
  fireReadyRooms:safetyReport?.fireReadyRooms??0,
  wheelchairAccessibleRooms:safetyReport?.wheelchairRooms??0,
  safetyScore:safetyReport?.score??null,
  verticalGuestCapacityPerHour:buildingAccess?.verticalCapacityPerHour??0,
  verticalPeakGuestMovementsPerHour:buildingAccess?.peakGuestMovesPerHour??0,
  atmosphereDemandModifier:site.atmosphereRulesVersion===1&&readyRooms.length?
   hotelAtmosphereDemandModifier(readyRooms.reduce((sum,{room,floor})=>
    sum+analyzeRoomAtmosphere(floor,room,site).score,0)/readyRooms.length):0,
  verticalCongestionModifier:buildingAccess?hotelVerticalCongestionModifier({
   ...buildingAccess,
   connectedUpperGuestRooms:readyRooms.filter(({floor})=>floors.indexOf(floor)>0).length,
   peakGuestMovesPerHour:readyRooms.filter(({floor})=>floors.indexOf(floor)>0).length*4,
  }):0};
}
export function openingIssues(site:HotelSite,hour:number):string[]{
 if(site.kind==='headquarters')return ['Headquarters cannot be operated as a hotel'];
 const issues=roomInventory(site,hour).reasons;
 const staff=site.operations?.staff??defaultHotelOperations(hour).staff;
 if(staff.reception<1)issues.push('Hire at least one receptionist');
 if(staff.housekeeping<1)issues.push('Hire at least one housekeeper');
 if(supplyStock(site,'cleaner',hour)<0.25)issues.push('Purchase cleaning supplies before opening');
 const rooms=roomInventory(site,hour).readyRooms.length;
 if(supplyStock(site,'linen',hour)<rooms)issues.push('Purchase one linen set per rentable room');
 return issues;
}
export function changeHotelSetting(site:HotelSite,key:HotelRole|'rateCents'|'breakfastPriceCents'|'dinnerPriceCents'|'drinkPriceCents',value:number,hour:number):{site:HotelSite;recruitmentCents:number}{
 if(site.kind==='headquarters')throw Error('Headquarters has no hotel operations.');
 if(!Number.isFinite(value))throw Error('Please enter a valid number.');
 const ops=site.operations??defaultHotelOperations(hour);
 if(key==='rateCents'||key==='breakfastPriceCents'||key==='dinnerPriceCents'||key==='drinkPriceCents'){
  const price=roundRate(value);
  const min=key==='rateCents'?5000:300;
  const max=key==='rateCents'?50000:8000;
  if(price<min||price>max)throw Error('Price is outside the allowed range.');
  return {site:{...site,operations:{...ops,[key]:price}},recruitmentCents:0};
 }
 if(!Number.isInteger(value)||value<0||value>HOTEL_MAX_STAFF_PER_ROLE)throw Error('Staffing must be between 0 and 15 per department.');
 if(hotelActiveAt(ops,hour)&&(key==='reception'||key==='housekeeping')&&value<1)
  throw Error('Close the hotel before removing the last receptionist or housekeeper.');
 const previous=ops.staff[key];
 const recruitmentCents=Math.max(0,value-previous)*HOTEL_STAFF_HIRING_CENTS;
 return {site:{...site,operations:{...ops,staff:{...ops.staff,[key]:value}}},recruitmentCents};
}
export function setHotelOperating(site:HotelSite,open:boolean,hour:number):HotelSite{
 if(site.kind==='headquarters')throw Error('A headquarters cannot open as a hotel.');
 const ops=site.operations??defaultHotelOperations(hour);
 const currently=hotelActiveAt(ops,hour);
 if(currently===open)throw Error(open?'Hotel is already open.':'Hotel is already closed.');
 if(open){
  const issues=openingIssues({...site,operations:ops},hour);
  if(issues.length)throw Error(issues[0]+'.');
  return {...site,operations:{...ops,periods:[...ops.periods,{fromHour:hour}],
    lastSettledHour:Math.min(hour,ops.lastSettledHour)}};
 }
 const periods=ops.periods.map(p=>p.toHour===undefined?{...p,toHour:hour}:p);
 return {...site,operations:{...ops,periods}};
}
export function activeHotelPeriods(state:ConstructionState):Map<string,HotelPeriod[]>{
 const periods=new Map<string,HotelPeriod[]>();
 for(const site of Object.values(state.sites)){
  if(site.sourceHoldingId&&site.operations?.periods?.length)
   periods.set(site.sourceHoldingId,site.operations.periods);
 }
 return periods;
}
function deliverAtHour(site:HotelSite,hour:number):HotelSite{
 const arriving=(site.supplyOrders??[]).filter(order=>order.status==='ordered'&&order.deliveryHour<=hour);
 const old=site.stock??{};
 let hasSpoiled=false;
 for(const batches of Object.values(old)){
  if(batches?.some(batch=>batch.expiresHour<=hour)){hasSpoiled=true;break;}
 }
 if(!arriving.length&&!hasSpoiled)return site;
 const stock={...old};
 for(const item of supplies)stock[item.code]=(stock[item.code]??[]).filter(b=>b.expiresHour>hour);
 for(const order of arriving){
  const item=supplies.find(s=>s.code===order.code);
  if(!item)continue;
  stock[order.code]=[...(stock[order.code]??[]),{id:order.id,quantity:order.quantity,expiresHour:order.deliveryHour+item.expiryHours}];
 }
 return {...site,stock,supplyOrders:(site.supplyOrders??[]).map(order=>
  order.status==='ordered'&&order.deliveryHour<=hour?{...order,status:'delivered' as const}:order)};
}
export function consumeSupply(site:HotelSite,code:SupplyCode,quantity:number,hour:number):HotelSite|null{
 if(quantity<=0)return site;
 if(supplyStock(site,code,hour)+1e-7<quantity)return null;
 let remaining=quantity;
 const batches=[...(site.stock?.[code]??[])].sort((a,b)=>a.expiresHour-b.expiresHour);
 const updated:StockBatch[]=[];
 for(const batch of batches){
  if(batch.expiresHour<=hour)continue;
  const take=Math.min(batch.quantity,remaining);
  remaining=Math.max(0,remaining-take);
  if(batch.quantity-take>1e-7)updated.push({...batch,quantity:Math.round((batch.quantity-take)*1000)/1000});
 }
 if(remaining>1e-7)return null;
 return {...site,stock:{...(site.stock??{}),[code]:updated}};
}
type Recipe={code:string;price:'breakfastPriceCents'|'dinnerPriceCents'|'drinkPriceCents';ingredients:Array<[SupplyCode,number]>};
const breakfast:Recipe={code:'breakfast',price:'breakfastPriceCents',ingredients:[['eggs',2],['bread',0.20],['milk',0.20]]};
const dinner:Recipe={code:'dinner',price:'dinnerPriceCents',ingredients:[['chicken',0.25],['vegetables',0.35]]};
const drinks:Recipe[]=[
 {code:'beer',price:'drinkPriceCents',ingredients:[['beer',1]]},
 {code:'wine',price:'drinkPriceCents',ingredients:[['wine',0.20]]},
 {code:'soft-drink',price:'drinkPriceCents',ingredients:[['soft-drinks',1]]}
];
function serve(site:HotelSite,recipe:Recipe,hour:number):HotelSite|null{
 let next=site;
 for(const [code,qty] of recipe.ingredients){
  const n=consumeSupply(next,code,qty,hour);
  if(!n)return null;
  next=n;
 }
 return next;
}
const freshDay=(day:number):HotelDayReport=>({day,...emptyTotals()});
const updatedDay=(days:HotelDayReport[],hour:number,delta:HotelTotals):HotelDayReport[]=>{
 const day=Math.floor(hour/24),last=days[days.length-1];
 if(last?.day===day){
  const n={...last};for(const k of Object.keys(delta) as (keyof HotelTotals)[])n[k]+=delta[k];
  return [...days.slice(0,-1),n].slice(-15);
 }
 const n=freshDay(day);for(const k of Object.keys(delta) as (keyof HotelTotals)[])n[k]+=delta[k];
 return [...days,n].slice(-15);
};
const addTotals=(a:HotelTotals,b:HotelTotals):HotelTotals=>{
 const next={...a};for(const k of Object.keys(b) as (keyof HotelTotals)[])next[k]+=b[k];return next;
};
const wageForHour=(staff:HotelStaff,hourOfDay:number):number=>{
 let wages=staff.reception*hotelRoles[0].wageCents;
 if(hourOfDay>=9&&hourOfDay<17)wages+=staff.housekeeping*hotelRoles[1].wageCents;
 if((hourOfDay>=7&&hourOfDay<11)||(hourOfDay>=18&&hourOfDay<22))wages+=staff.kitchen*hotelRoles[2].wageCents;
 if(hourOfDay>=18&&hourOfDay<24)wages+=staff.bar*hotelRoles[3].wageCents;
 return wages;
};
export function settleHotelOperations(state:ConstructionState,nowHour:number,ownershipByHolding:(holdingId:string)=>number=()=>1):HotelSettlement{
 const end=Math.floor(nowHour),sites={...state.sites};
 let stateChanged=false,companyNetCents=0,grossCents=0,expenseCents=0,hotelCount=0;
 const reports:HotelSettlement['reports']=[];
 for(const [id,source] of Object.entries(sites)){
  const original=source.operations;
  if(!original||!original.periods.length||source.kind==='headquarters')continue;
  const from=Math.max(original.lastSettledHour,end-HOTEL_MAX_SETTLEMENT_HOURS);
  if(from>=end)continue;
  let site=source;
  let guests=original.guests.map(g=>({...g})),dirty=new Set(original.dirtyRoomIds);
  let totals=original.totals??emptyTotals();
  let days=[...(original.recentDays??[])];
  let localGross=0,localExpense=0;
  for(let hour=from;hour<end;hour++){
   site=deliverAtHour(site,hour);
   const enabled=hotelActiveAt(original,hour),time=((hour%24)+24)%24,day=Math.floor(hour/24);
   if(!enabled){guests=[];continue;}
   const inventory=roomInventory(site,hour);
   const validRooms=inventory.readyRooms.map(e=>e.room);
   const validIds=new Set(validRooms.map(r=>r.id));
   // Once a stay ends, housekeeping must prepare the room before it can sell again.
   for(const guest of guests){
    if(guest.checkOutHour<=hour)dirty.add(guest.roomId);
   }
   guests=guests.filter(g=>validIds.has(g.roomId)&&g.checkOutHour>hour);
   const delta=emptyTotals();
   if(time===14){
    const occupied=new Set(guests.map(g=>g.roomId));
    // Target room demand is bounded by existing room inventory and staffed reception.
    const dayKey=site.id+':'+day;
    const season=new Date(day*24*3600000).getUTCMonth();
    const seasonal=season>=5&&season<=8?0.12:season>=10||season<=2?-0.12:0;
    // Furnishings, room size, bathroom availability and usable floor space
    // drive customer appeal, instead of simply counting decorative objects.
    const averageDesign=inventory.readyRooms.reduce((sum,item)=>
     sum+hotelGuestRoomQuality(item.floor,item.room,site).score,0)/Math.max(1,validRooms.length);
    const quality=hotelDesignDemandModifier(averageDesign);
    const pricing=clamp((11000-original.rateCents)/18000,-0.26,0.26);
    // Real installed and accessible lift/stair throughput limits hotel appeal
    // when estimated peak guest movements exceed connected shaft capacity.
    const occupancy=clamp(0.60+seasonal+quality+pricing+
     inventory.verticalCongestionModifier+inventory.atmosphereDemandModifier+
     (random01(dayKey)-.5)*.20,.08,.96);
    const linen=Math.floor(supplyStock(site,'linen',hour));
    const capacity=Math.min(validRooms.length,linen);
    const desired=Math.min(capacity,Math.round(capacity*occupancy));
    for(const currentGuest of guests){
     if(currentGuest.checkInHour<hour&&currentGuest.checkOutHour>hour){
      delta.roomCents+=currentGuest.rateCents;
      currentGuest.nightsPaid++;
     }
    }
    const need=Math.max(0,desired-guests.length);
    let added=0;
    for(const room of validRooms){
     if(added>=need)break;
     if(occupied.has(room.id)||dirty.has(room.id))continue;
     if(random01(dayKey+':'+room.id)>0.82&&validRooms.length>1)continue;
     const nights=1+(hash(dayKey+':stay:'+room.id)%3);
     const checkout=Math.floor(hour/24)*24+11+nights*24;
     const guest:HotelGuest={id:site.id+':'+room.id+':'+day,roomId:room.id,
      checkInHour:hour,checkOutHour:checkout,nightsPaid:1,rateCents:original.rateCents};
     guests.push(guest);occupied.add(room.id);added++;delta.guests++;
     delta.roomCents+=guest.rateCents;
     const amenity=consumeSupply(site,'toiletries',1,hour);
     if(amenity)site=amenity;
    }
   }
   // Service capacity is limited by physical equipment, staff and paid ingredients.
   if(time===8&&inventory.hasKitchen&&inventory.hasRestaurant&&original.staff.kitchen>0){
    const limit=Math.min(guests.length,original.staff.kitchen*12);
    for(let i=0;i<limit;i++){
     if(random01(site.id+':breakfast:'+day+':'+i)>.74)continue;
     const n=serve(site,breakfast,hour);if(!n){delta.unserved++;continue;}
     site=n;delta.foodCents+=original.breakfastPriceCents;delta.breakfasts++;
    }
   }
   if(time===19&&inventory.hasKitchen&&inventory.hasRestaurant&&original.staff.kitchen>0){
    const limit=Math.min(guests.length,original.staff.kitchen*10);
    for(let i=0;i<limit;i++){
     if(random01(site.id+':dinner:'+day+':'+i)>.58)continue;
     const n=serve(site,dinner,hour);if(!n){delta.unserved++;continue;}
     site=n;delta.foodCents+=original.dinnerPriceCents;delta.dinners++;
    }
   }
   if(time===21&&inventory.hasBar&&original.staff.bar>0){
    const limit=Math.min(guests.length,original.staff.bar*16);
    for(let i=0;i<limit;i++){
     if(random01(site.id+':bar:'+day+':'+i)>.57)continue;
     const recipe=drinks[hash(site.id+':drink:'+day+':'+i)%drinks.length];
     const n=serve(site,recipe,hour);if(!n){delta.unserved++;continue;}
     site=n;delta.barCents+=original.drinkPriceCents;delta.drinks++;
    }
   }
   if(time>=9&&time<17&&original.staff.housekeeping>0){
    const limit=original.staff.housekeeping*2;
    let cleaned=0;
    for(const roomId of dirty){
     if(cleaned>=limit)break;
     const n=consumeSupply(site,'cleaner',.25,hour);
     if(!n)break;
     site=n;dirty.delete(roomId);cleaned++;delta.cleaned++;
    }
   }
   // Hotel utilities and staff wages accrue even during low occupancy.
   delta.wagesCents=wageForHour(original.staff,time);
   delta.utilitiesCents=100+validRooms.length*36+
    (inventory.hasKitchen?100:0)+(inventory.hasBar?75:0);
   localGross+=delta.roomCents+delta.foodCents+delta.barCents;
   localExpense+=delta.wagesCents+delta.utilitiesCents;
   totals=addTotals(totals,delta);
   days=updatedDay(days,hour,delta);
  }
  const ops:HotelOperations={...original,lastSettledHour:end,guests,dirtyRoomIds:[...dirty],totals,recentDays:days};
  site={...site,operations:ops};
  sites[id]=site;
  stateChanged=true;
  hotelCount++;
  const share=site.sourceHoldingId?clamp(ownershipByHolding(site.sourceHoldingId),0,1):1;
  const net=localGross-localExpense;
  const ownedNet=Math.round(net*share);
  companyNetCents+=ownedNet;
  grossCents+=Math.round(localGross*share);
  expenseCents+=Math.round(localExpense*share);
  if(localGross||localExpense)reports.push({siteId:id,name:site.name,grossCents:localGross,expenseCents:localExpense,netCents:net,share});
 }
 return {state:stateChanged?{...state,sites}:state,companyNetCents,grossCents,expenseCents,hotelCount,reports};
}
