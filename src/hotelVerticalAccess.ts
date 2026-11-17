/** Phase 2: real stairwell/lift connectivity across the existing 1 m hotel
 * blueprint grid. Nothing moves on the world map or allocates guest NPCs.
 * Only sites with accessRulesVersion===2 enforce vertical room eligibility.
 */
import {drawRoom,roomIssues,type HotelFloor,type HotelSite,type Room,type RoomType} from './internalConstruction';
import {accessDoorPair,hotelAccessDoorValid,type AccessStatus,type FloorAccessReport} from './hotelAccess';

export type VerticalCoreType='stairwell'|'elevator';
export const VERTICAL_CORES:Readonly<Record<VerticalCoreType,{
 label:string;width:number;height:number;capacityPerHour:number;carCapacity:number;
 installationCents:number;workUnits:number;
}>>={
 stairwell:{label:'Stairwell',width:2,height:3,capacityPerHour:60,carCapacity:0,
  installationCents:750000,workUnits:12},
 elevator:{label:'Elevator',width:2,height:2,capacityPerHour:96,carCapacity:8,
  installationCents:3200000,workUnits:24},
};
export type VerticalLink={
 type:VerticalCoreType;fromFloor:number;toFloor:number;
 x:number;y:number;width:number;height:number;
 capacityPerHour:number;carCapacity:number;connected:boolean;
};
export type BuildingAccessReport={
 floors:FloorAccessReport[];links:VerticalLink[];
 connectedGuestRooms:number;totalGuestRooms:number;
 upperGuestRooms:number;connectedUpperGuestRooms:number;
 peakGuestMovesPerHour:number;verticalCapacityPerHour:number;
 verticalUtilisationPercent:number|null;
 receptionConnected:boolean;
};
const isCore=(type:RoomType):type is VerticalCoreType=>
 type==='stairwell'||type==='elevator';
const passable=(room:Room|null|undefined):room is Room=>
 room!=null&&(room.type==='lobby'||room.type==='corridor'||isCore(room.type));
const sameCore=(a:Room,b:Room)=>
 a.type===b.type&&a.x===b.x&&a.y===b.y&&
 a.width===b.width&&a.height===b.height;
const node=(floor:number,id:string)=>floor+':'+id;
const overlaps=(a:Pick<Room,'x'|'y'|'width'|'height'>,
 b:Pick<Room,'x'|'y'|'width'|'height'>)=>
 a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
/** A matching shaft on the adjacent floor is mandatory. New positions prefer
 * the boundary of an existing lobby/corridor for convenient manual doors.
 * Never places an overlapping shaft or silently changes the other floors.
 */
export function addVerticalCore(
 site:HotelSite,floorIndex:number,type:VerticalCoreType,id:string,
):HotelSite{
 if(site.projects.some(p=>p.status==='active'))
  throw Error('Finish the current construction project before editing.');
 const floor=site.draft[floorIndex];
 if(!floor)throw Error('Select a valid building floor.');
 const spec=VERTICAL_CORES[type];
 if(floor.rooms.some(r=>r.id===id))throw Error('This room ID is already in use.');
 // When an adjacent floor already has a matching type, enforce alignment;
 // never silently create a different shaft pretending to connect.
 const adjacent=[site.draft[floorIndex-1],site.draft[floorIndex+1]].filter(
  (f):f is HotelFloor=>f!==undefined);
 const expected=adjacent.flatMap(f=>f.rooms.filter(r=>r.type===type));
 const candidatePositions: Array<{x:number;y:number;width:number;height:number}>=[];
 if(expected.length){
  for(const other of expected)candidatePositions.push({
   x:other.x,y:other.y,width:other.width,height:other.height,
  });
 }else{
  for(const room of floor.rooms.filter(r=>r.type==='corridor'||r.type==='lobby')){
   candidatePositions.push(
    {x:room.x+room.width,y:room.y,width:spec.width,height:spec.height},
    {x:room.x-spec.width,y:room.y,width:spec.width,height:spec.height},
    {x:room.x,y:room.y+room.height,width:spec.width,height:spec.height},
    {x:room.x,y:room.y-spec.height,width:spec.width,height:spec.height},
   );
  }
  for(let y=0;y<=site.height-spec.height;y++)
   for(let x=0;x<=site.width-spec.width;x++)
    candidatePositions.push({x,y,width:spec.width,height:spec.height});
 }
 const position=candidatePositions.find(c=>c.x>=0&&c.y>=0&&
  c.x+c.width<=site.width&&c.y+c.height<=site.height&&
  !floor.rooms.some(existing=>overlaps(existing,c)));
 if(!position)throw Error(expected.length?
  'Cannot align this shaft with the adjacent floor. Move conflicting rooms or use a different location.':
  'No space for a stairwell or elevator. Make room next to a corridor.');
 const room:Room={id,type,name:spec.label+' '+
  (floor.rooms.filter(r=>r.type===type).length+1),...position};
 return {...site,draft:site.draft.map((f,i)=>i===floorIndex?drawRoom(f,room,site):f)};
}
/** Inspect all floors as a bounded graph: edges are real clear door segments,
 * and vertical edges exist ONLY for identically aligned consecutive shafts.
 * Crossing a guest room is never treated as a valid circulation shortcut.
 * A component is accessible only if it includes a ground-floor exterior door
 * AND an equipped ground-floor reception.
 */
export function analyzeHotelBuildingAccess(
 floors:readonly HotelFloor[],site:HotelSite,
):BuildingAccessReport{
 const adjacency=new Map<string,Set<string>>();
 const nodes=new Map<string,{floor:number;room:Room}>();
 const counts=new Map<string,number>();
 const entrances=new Set<string>();
 const entryCounts=new Array<number>(floors.length).fill(0);
 for(const [fi,floor] of floors.entries()){
  for(const room of floor.rooms){
   const key=node(fi,room.id);
   nodes.set(key,{floor:fi,room});adjacency.set(key,new Set());
  }
  for(const wall of floor.walls){
   if(wall.type!=='door'||!hotelAccessDoorValid(floor,site,wall))continue;
   const pair=accessDoorPair(floor,site,wall),a=pair.first,b=pair.second;
   if(a)counts.set(node(fi,a.id),(counts.get(node(fi,a.id))??0)+1);
   if(b)counts.set(node(fi,b.id),(counts.get(node(fi,b.id))??0)+1);
   if(pair.exterior){
    if(fi===0){
     const room=passable(a)?a:passable(b)?b:null;
     if(room&&(room.type==='lobby'||room.type==='corridor')){
      entrances.add(node(fi,room.id));entryCounts[fi]++;
     }
    }
   }else if(a&&b&&passable(a)&&passable(b)){
    adjacency.get(node(fi,a.id))!.add(node(fi,b.id));
    adjacency.get(node(fi,b.id))!.add(node(fi,a.id));
   }
  }
 }
 const links:VerticalLink[]=[];
 for(let fi=0;fi<floors.length-1;fi++){
  for(const a of floors[fi].rooms){
   if(!isCore(a.type))continue;
   for(const b of floors[fi+1].rooms){
    if(!sameCore(a,b))continue;
    const from=node(fi,a.id),to=node(fi+1,b.id);
    adjacency.get(from)!.add(to);adjacency.get(to)!.add(from);
    links.push({type:a.type,fromFloor:fi,toFloor:fi+1,
     x:a.x,y:a.y,width:a.width,height:a.height,
     capacityPerHour:VERTICAL_CORES[a.type].capacityPerHour,
     carCapacity:VERTICAL_CORES[a.type].carCapacity,connected:false});
   }
  }
 }
 // Multiple independent exterior doors must NOT validate an isolated wing.
 const visited=new Set<string>(),scanned=new Set<string>();
 const allCirculation=[...nodes.entries()].filter(([,v])=>passable(v.room));
 let receptionConnected=false;
 for(const [seed] of allCirculation){
  if(scanned.has(seed))continue;
  const component=new Set<string>([seed]),queue=[seed];scanned.add(seed);
  for(let i=0;i<queue.length;i++){
   for(const next of adjacency.get(queue[i])??[]){
    if(scanned.has(next))continue;
    scanned.add(next);component.add(next);queue.push(next);
   }
  }
  const hasDoor=[...component].some(id=>entrances.has(id));
  const hasReception=[...component].some(id=>{
   const info=nodes.get(id);
   return info?.floor===0&&info.room.type==='lobby'&&
    roomIssues(floors[0],info.room).length===0;
  });
  if(hasDoor&&hasReception){
   receptionConnected=true;
   for(const id of component)visited.add(id);
  }
 }
 for(const link of links){
  const lower=floors[link.fromFloor].rooms.find(r=>r.type===link.type&&
   r.x===link.x&&r.y===link.y&&r.width===link.width&&r.height===link.height);
  const upper=floors[link.toFloor].rooms.find(r=>r.type===link.type&&
   r.x===link.x&&r.y===link.y&&r.width===link.width&&r.height===link.height);
  link.connected=!!lower&&!!upper&&visited.has(node(link.fromFloor,lower.id))&&
   visited.has(node(link.toFloor,upper.id));
 }
 const reports:FloorAccessReport[]=floors.map((floor,fi)=>{
  const guests=floor.rooms.filter(r=>r.type==='guest');
  const floorHasVertical=links.some(l=>l.fromFloor===fi||l.toFloor===fi);
  const floorReached=links.some(l=>l.connected&&l.toFloor===fi);
  const connections=guests.map(room=>{
   const key=node(fi,room.id),doorCount=counts.get(key)??0;
   let status:AccessStatus='disconnected';
   if(!doorCount)status='missing-door';
   else if(!entrances.size)status='no-entry';
   else if(!receptionConnected)status='no-reception';
   else if([...floor.walls].some(w=>{
    if(w.type!=='door'||!hotelAccessDoorValid(floor,site,w))return false;
    const pair=accessDoorPair(floor,site,w);
    return (pair.first?.id===room.id&&pair.second&&
     (pair.second.type==='corridor'||pair.second.type==='lobby')&&
     visited.has(node(fi,pair.second.id)))||
     (pair.second?.id===room.id&&pair.first&&
     (pair.first.type==='corridor'||pair.first.type==='lobby')&&
     visited.has(node(fi,pair.first.id)));
   }))status='connected';
   else if(fi>0&&!floorHasVertical)status='no-vertical-link';
   else if(fi>0&&!floorReached)status='no-vertical-link';
   return {roomId:room.id,name:room.name,status,doorCount};
  });
  const connectedGuests=connections.filter(g=>g.status==='connected').length;
  const warnings:string[]=[];
  if(fi===0){
   if(!entrances.size)warnings.push('Add an exterior entrance to the ground-floor lobby or corridor.');
   else if(!receptionConnected)warnings.push('Connect a furnished reception to the outside entrance.');
  }else{
   if(!floorHasVertical)warnings.push('Place identical aligned stairwells or elevators on this floor and the floor below.');
   else if(!floorReached)warnings.push('Connect the stairwell or elevator to a hallway and the ground-floor reception.');
  }
  const missing=connections.filter(g=>g.status==='missing-door').length;
  const disconnected=guests.length-connectedGuests-missing;
  if(missing)warnings.push(missing+' guest room(s) need a clear doorway.');
  if(disconnected)warnings.push(disconnected+' guest room(s) cannot reach reception.');
  const reachableRoomIds=floor.rooms.filter(r=>visited.has(node(fi,r.id))).map(r=>r.id);
  return {floorIndex:fi,legacy:site.accessRulesVersion!==2,
   groundFloor:fi===0,entranceDoors:entryCounts[fi],
   receptionConnected:fi===0?receptionConnected:floorReached&&receptionConnected,
   guestRooms:guests.length,connectedGuests,pendingUpperGuests:0,
   circulationRooms:floor.rooms.filter(r=>passable(r)).length,
   connectedCirculation:reachableRoomIds.length,
   guests:connections,reachableRoomIds,warnings};
 });
 const upperGuestRooms=reports.slice(1).reduce((n,r)=>n+r.guestRooms,0);
 const connectedUpperGuestRooms=reports.slice(1).reduce((n,r)=>n+r.connectedGuests,0);
 // Conservative capacity for reaching the HIGHEST occupied level:
 // each level traversed must have a valid connected link to the next.
 const highest=reports.reduce((max,r)=>r.connectedGuests>0?Math.max(max,r.floorIndex):max,0);
 let verticalCapacityPerHour=highest===0?0:Infinity;
 for(let floor=0;floor<highest;floor++){
  const available=links.filter(l=>l.connected&&l.fromFloor===floor)
   .reduce((n,l)=>n+l.capacityPerHour,0);
  verticalCapacityPerHour=Math.min(verticalCapacityPerHour,available);
 }
 if(!Number.isFinite(verticalCapacityPerHour))verticalCapacityPerHour=0;
 const peakGuestMovesPerHour=connectedUpperGuestRooms*4;
 return {floors:reports,links,connectedGuestRooms:reports.reduce((n,r)=>n+r.connectedGuests,0),
  totalGuestRooms:reports.reduce((n,r)=>n+r.guestRooms,0),
  upperGuestRooms,connectedUpperGuestRooms,
  peakGuestMovesPerHour,verticalCapacityPerHour,
  verticalUtilisationPercent:verticalCapacityPerHour?
   Math.round(peakGuestMovesPerHour/verticalCapacityPerHour*100):null,
  receptionConnected};
}
/** A bounded service-demand penalty when the upper-floor peak load exceeds
 * actual shaft throughput. Guests still need individually valid paths.
 */
export function hotelVerticalCongestionModifier(
 report:BuildingAccessReport,
):number{
 if(!report.connectedUpperGuestRooms)return 0;
 if(report.verticalCapacityPerHour<=0)return -.1;
 const excess=Math.max(0,report.peakGuestMovesPerHour/report.verticalCapacityPerHour-1);
 return excess>0?-Math.min(.1,excess*.05):0;
}
