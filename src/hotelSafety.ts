/** Phase 4: playable hotel fire safety and barrier-free circulation.
 * These are simplified GAME design requirements, not legal fire codes,
 * evacuation instructions or accessibility certification.
 * Only sites with safetyRulesVersion=1 enforce booking eligibility.
 */
import {
 furnitureSize,roomIssues,type HotelFloor,type HotelSite,type Room,
 type SafetyFixture,type SafetyFixtureKind,
} from './internalConstruction';
import {accessDoorPair,hotelAccessDoorValid} from './hotelAccess';

export const SAFETY_FIXTURE_COST_CENTS:Readonly<Record<SafetyFixtureKind,number>>={
 'smoke-alarm':9500,'fire-extinguisher':18000,'exit-sign':12000,
};
export const SAFETY_FIXTURE_LABEL:Readonly<Record<SafetyFixtureKind,string>>={
 'smoke-alarm':'Smoke alarm','fire-extinguisher':'Fire extinguisher',
 'exit-sign':'Illuminated exit sign',
};
const circulation=(r:Room|null|undefined):r is Room=>
 r!=null&&(r.type==='corridor'||r.type==='lobby');
const egressRoom=(r:Room|null|undefined):r is Room=>
 circulation(r)||r?.type==='stairwell';
const wheelchairRoom=(r:Room|null|undefined):r is Room=>
 (circulation(r)||r?.type==='elevator')&&!!r&&r.width>=2&&r.height>=2;
const inRoom=(room:Room,x:number,y:number)=>
 x>=room.x&&y>=room.y&&x<room.x+room.width&&y<room.y+room.height;
const key=(fi:number,id:string)=>fi+':'+id;
const roomAt=(f:HotelFloor,x:number,y:number)=>
 f.rooms.find(r=>inRoom(r,x,y))??null;
const exteriorDoorRoom=(floor:HotelFloor,site:HotelSite):Set<string>=>{
 const entries=new Set<string>();
 for(const door of floor.walls){
  if(door.type!=='door'||!hotelAccessDoorValid(floor,site,door))continue;
  const side=accessDoorPair(floor,site,door);
  if(side.exterior){
   if(circulation(side.first))entries.add(side.first.id);
   if(circulation(side.second))entries.add(side.second.id);
  }
 }
 return entries;
};
/** Fixtures are overlay objects, never floor obstacles. Each grid-cell fixture
 * can be replaced or removed without duplicating an earlier installation.
 */
export function toggleHotelSafetyFixture(
 floor:HotelFloor,site:HotelSite,fixture:SafetyFixture,floorIndex=0,
):HotelFloor{
 if(!Object.hasOwn(SAFETY_FIXTURE_COST_CENTS,fixture.kind))
  throw Error('Unknown safety equipment.');
 if(!Number.isInteger(fixture.x)||!Number.isInteger(fixture.y)||
  fixture.x<0||fixture.y<0||fixture.x>=site.width||fixture.y>=site.height)
  throw Error('Safety equipment must be placed on the building grid.');
 const room=roomAt(floor,fixture.x,fixture.y);
 if(!room)throw Error('Place safety equipment inside a room.');
 if(fixture.kind==='fire-extinguisher'&&!circulation(room))
  throw Error('Fire extinguishers must be placed in a lobby or corridor.');
 if(fixture.kind==='exit-sign'&&
  (floorIndex!==0||!circulation(room)||!exteriorDoorRoom(floor,site).has(room.id)))
  throw Error('Exit signs must be placed in a ground-floor lobby or corridor with a valid exterior doorway.');
 if(fixture.kind==='smoke-alarm'&&room.type==='stairwell'||fixture.kind==='smoke-alarm'&&room.type==='elevator')
  throw Error('Place smoke alarms in guest rooms or circulation areas.');
 const existing=(floor.safetyFixtures??[]).find(f=>
  f.x===fixture.x&&f.y===fixture.y);
 if(existing?.kind===fixture.kind)return {...floor,
  safetyFixtures:(floor.safetyFixtures??[]).filter(f=>f.id!==existing.id)};
 if(existing)return {...floor,safetyFixtures:(floor.safetyFixtures??[]).map(f=>
  f.id===existing.id?{...existing,kind:fixture.kind}:f)};
 return {...floor,safetyFixtures:[...(floor.safetyFixtures??[]),fixture]};
}
/** Finds a central, unoccupied *fixture* grid cell in the selected room.
 * Smoke alarms can coexist with floor furniture. Exterior exit signs are only
 * suggested for rooms containing a legitimate ground-level entrance.
 */
export function suggestHotelSafetyFixture(
 floor:HotelFloor,site:HotelSite,kind:SafetyFixtureKind,
 roomId:string,floorIndex=0,
):{x:number;y:number}|null{
 const room=floor.rooms.find(r=>r.id===roomId);
 if(!room)return null;
 if(kind==='fire-extinguisher'&&!circulation(room))return null;
 if(kind==='exit-sign'&&(floorIndex!==0||!exteriorDoorRoom(floor,site).has(roomId)))return null;
 if(kind==='smoke-alarm'&&(room.type==='elevator'||room.type==='stairwell'))return null;
 const cx=room.x+(room.width-1)/2,cy=room.y+(room.height-1)/2;
 const cells=[] as {x:number;y:number;dist:number}[];
 for(let y=room.y;y<room.y+room.height;y++)for(let x=room.x;x<room.x+room.width;x++)
  cells.push({x,y,dist:Math.abs(cx-x)+Math.abs(cy-y)});
 cells.sort((a,b)=>a.dist-b.dist);
 const candidate=cells.find(c=>!(floor.safetyFixtures??[]).some(f=>f.x===c.x&&f.y===c.y));
 return candidate?{x:candidate.x,y:candidate.y}:null;
}
export type HotelSafetyGuest={
 floorIndex:number;roomId:string;name:string;
 smokeAlarm:boolean;evacuationRoute:boolean;exitSign:boolean;
 extinguisherCoverage:boolean;wheelchairRoute:boolean;
 fireReady:boolean;accessible:boolean;issues:string[];
};
export type HotelSafetyFloor={
 floorIndex:number;guests:number;fireReadyRooms:number;accessibleRooms:number;
 smokeAlarms:number;extinguishers:number;exitSigns:number;
 validExits:number;warnings:string[];
};
export type HotelSafetyReport={
 floors:HotelSafetyFloor[];guests:HotelSafetyGuest[];
 totalGuestRooms:number;fireReadyRooms:number;wheelchairRooms:number;
 fireReadyKeys:string[];accessibleKeys:string[];
 exitCount:number;signedExitCount:number;
 score:number;grade:'Critical'|'Needs work'|'Fair'|'Good'|'Excellent';
 issues:string[];
};
type Graph=Map<string,Set<string>>;
const connect=(graph:Graph,a:string,b:string)=>{
 graph.get(a)?.add(b);graph.get(b)?.add(a);
};
const walk=(graph:Graph,starts:Iterable<string>):Set<string>=>{
 const seen=new Set(starts),queue=[...seen];
 for(let i=0;i<queue.length;i++)
  for(const other of graph.get(queue[i])??[]){
   if(seen.has(other))continue;
   seen.add(other);queue.push(other);
  }
 return seen;
};
/** Graph walk from valid ground-floor exits through real, clear doors.
 * Fire evacuation is NEVER routed through elevators; wheelchair travel is
 * NEVER routed through stairs. Shafts align in position, size AND type.
 */
export function analyzeHotelSafety(
 floors:readonly HotelFloor[],site:HotelSite,
):HotelSafetyReport{
 const evacuation:Graph=new Map(),wheelchair:Graph=new Map();
 const byFloor=floors.map(f=>new Map(f.rooms.map(r=>[r.id,r])));
 const roomsByKey=new Map<string,{floorIndex:number;room:Room}>();
 const guestDoors=new Map<string,Array<{other:string;otherType:Room['type']}>>();
 for(const [fi,floor] of floors.entries()){
  for(const room of floor.rooms){
   const n=key(fi,room.id);
   roomsByKey.set(n,{floorIndex:fi,room});
   if(egressRoom(room))evacuation.set(n,new Set());
   if(wheelchairRoom(room))wheelchair.set(n,new Set());
  }
  for(const wall of floor.walls){
   if(wall.type!=='door'||!hotelAccessDoorValid(floor,site,wall))continue;
   const pair=accessDoorPair(floor,site,wall),a=pair.first,b=pair.second;
   if(!a||!b||a.id===b.id)continue;
   const ak=key(fi,a.id),bk=key(fi,b.id);
   if(egressRoom(a)&&egressRoom(b))connect(evacuation,ak,bk);
   if(wheelchairRoom(a)&&wheelchairRoom(b))connect(wheelchair,ak,bk);
   if(a.type==='guest'&&circulation(b)){
    guestDoors.set(ak,[...(guestDoors.get(ak)??[]),
     {other:bk,otherType:b.type}]);
   }
   if(b.type==='guest'&&circulation(a)){
    guestDoors.set(bk,[...(guestDoors.get(bk)??[]),
     {other:ak,otherType:a.type}]);
   }
  }
 }
 // Identical stair/elevator shafts must be continuous on *each* level.
 for(let fi=0;fi<floors.length-1;fi++)
  for(const from of floors[fi].rooms){
   if(from.type!=='stairwell'&&from.type!=='elevator')continue;
   for(const to of floors[fi+1].rooms){
    if(to.type!==from.type||to.x!==from.x||to.y!==from.y||
     to.width!==from.width||to.height!==from.height)continue;
    if(from.type==='stairwell')
     connect(evacuation,key(fi,from.id),key(fi+1,to.id));
    if(from.type==='elevator')
     connect(wheelchair,key(fi,from.id),key(fi+1,to.id));
   }
  }
 const exits=floors[0]?exteriorDoorRoom(floors[0],site):new Set<string>();
 // Multiple door openings in the same exit-bearing room are represented
 // conservatively as a single egress location.
 const exitsKeys=[...exits].map(id=>key(0,id));
 const signedKeys=exitsKeys.filter(n=>{
  const room=roomsByKey.get(n)?.room;
  return !!room&&(floors[0]?.safetyFixtures??[]).some(f=>
   f.kind==='exit-sign'&&inRoom(room,f.x,f.y));
 });
 const evacuationReach=walk(evacuation,exitsKeys);
 const signedReach=walk(evacuation,signedKeys);
 const wheelchairReach=walk(wheelchair,exitsKeys);
 const floorReports:HotelSafetyFloor[]=[];
 const allGuests:HotelSafetyGuest[]=[];
 for(const [fi,floor] of floors.entries()){
  const guests=floor.rooms.filter(r=>r.type==='guest');
  const fixtures=floor.safetyFixtures??[];
  const extinguisherInReachable=fixtures.some(f=>{
   if(f.kind!=='fire-extinguisher')return false;
   const room=roomAt(floor,f.x,f.y);
   return !!room&&evacuationReach.has(key(fi,room.id));
  });
  for(const room of guests){
   const n=key(fi,room.id);
   const corridorDoors=guestDoors.get(n)??[];
   const evacuationRoute=corridorDoors.some(d=>evacuationReach.has(d.other));
   const exitSign=corridorDoors.some(d=>signedReach.has(d.other));
   const smokeAlarm=fixtures.some(f=>f.kind==='smoke-alarm'&&inRoom(room,f.x,f.y));
   const clearFloor=room.width>=4&&room.height>=4&&
    floor.objects.filter(o=>inRoom(room,o.x,o.y)).reduce((a,o)=>{
     const size=furnitureSize(o);return a+size.width*size.height;
    },0)<room.width*room.height*.60;
   const wheelchairRoute=clearFloor&&corridorDoors.some(d=>
    wheelchairReach.has(d.other));
   const fireReady=smokeAlarm&&evacuationRoute&&exitSign&&extinguisherInReachable;
   const issues:string[]=[];
   if(!smokeAlarm)issues.push('Install a smoke alarm');
   if(!evacuationRoute)issues.push('Connect an emergency route using corridors and stairs');
   else if(!exitSign)issues.push('Mark a reachable ground-floor exit with a sign');
   if(!extinguisherInReachable)issues.push('Place a reachable extinguisher on this floor');
   if(!wheelchairRoute)issues.push('No barrier-free corridor/elevator route from reception');
   allGuests.push({floorIndex:fi,roomId:room.id,name:room.name,
    smokeAlarm,evacuationRoute,exitSign,extinguisherCoverage:extinguisherInReachable,
    wheelchairRoute,fireReady,accessible:wheelchairRoute,issues});
  }
  const these=allGuests.filter(g=>g.floorIndex===fi);
  const warnings:string[]=[];
  if(these.some(g=>!g.smokeAlarm))warnings.push('Add smoke alarms in guest rooms.');
  if(these.some(g=>!g.evacuationRoute))warnings.push('Provide a signed corridor/stair escape route to the ground floor.');
  if(these.some(g=>!g.extinguisherCoverage))warnings.push('Place a fire extinguisher in a reachable lobby or corridor.');
  if(fi===0&&exitsKeys.length>0&&!signedKeys.length)
   warnings.push('Add an exit sign in the entrance corridor or lobby.');
  if(these.length&&!these.some(g=>g.accessible))
   warnings.push('No barrier-free guest room route on this floor.');
  floorReports.push({floorIndex:fi,guests:these.length,
   fireReadyRooms:these.filter(g=>g.fireReady).length,
   accessibleRooms:these.filter(g=>g.accessible).length,
   smokeAlarms:fixtures.filter(f=>f.kind==='smoke-alarm').length,
   extinguishers:fixtures.filter(f=>f.kind==='fire-extinguisher').length,
   exitSigns:fixtures.filter(f=>f.kind==='exit-sign').length,
   validExits:fi===0?exitsKeys.length:0,warnings});
 }
 const fireReady=allGuests.filter(g=>g.fireReady);
 const accessible=allGuests.filter(g=>g.accessible);
 const score=allGuests.length?Math.round(
  70*(fireReady.length/allGuests.length)+
  15*(signedKeys.length>0?1:0)+
  15*(accessible.length>0?1:0)):0;
 const grade:HotelSafetyReport['grade']=score<20?'Critical':score<45?'Needs work':
  score<70?'Fair':score<90?'Good':'Excellent';
 const issues:string[]=[];
 if(allGuests.length&&!exitsKeys.length)issues.push('Build a ground-floor exterior exit connected to reception.');
 if(allGuests.length&&!signedKeys.length)issues.push('Install an exit sign at a valid exterior entrance.');
 if(allGuests.length&&!fireReady.length)issues.push('Equip at least one guest room with a smoke alarm, reachable extinguisher and staircase-safe evacuation route.');
 if(allGuests.length&&!accessible.length)issues.push('Provide at least one barrier-free guest room through an accessible entrance and corridor/elevator route.');
 return {floors:floorReports,guests:allGuests,totalGuestRooms:allGuests.length,
  fireReadyRooms:fireReady.length,wheelchairRooms:accessible.length,
  fireReadyKeys:fireReady.map(g=>key(g.floorIndex,g.roomId)),
  accessibleKeys:accessible.map(g=>key(g.floorIndex,g.roomId)),
  exitCount:exitsKeys.length,signedExitCount:signedKeys.length,
  score,grade,issues};
}
