/** Phase 1 hotel architecture: verified doorways and ground-floor guest access.
 * Uses existing 1-metre room rectangles and Wall(type='door') segments.
 * No flood fill over the world map, OSM routing, or additional saved geometry.
 * New plots opt in via accessRulesVersion=1. Older sites remain fully usable.
 */
import {
  toggleWall,roomIssues,furnitureSize,
  type HotelFloor,type HotelSite,type Room,type Wall,
} from './internalConstruction';

export type AccessStatus='connected'|'missing-door'|'disconnected'|'no-entry'|'no-reception'|'upper-floor-pending';
export type DoorPair={
  first:Room|null;second:Room|null;exterior:boolean;clear:boolean;
};
export type GuestAccess={roomId:string;name:string;status:AccessStatus;doorCount:number};
export type FloorAccessReport={
  floorIndex:number;legacy:boolean;groundFloor:boolean;
  entranceDoors:number;receptionConnected:boolean;
  guestRooms:number;connectedGuests:number;pendingUpperGuests:number;
  circulationRooms:number;connectedCirculation:number;
  guests:GuestAccess[];reachableRoomIds:string[];
  warnings:string[];
};
const circulation=(room:Room|null):room is Room=>
  room!==null&&(room.type==='corridor'||room.type==='lobby');
const within=(room:Room,x:number,y:number)=>x>=room.x&&x<room.x+room.width&&
  y>=room.y&&y<room.y+room.height;
const roomAt=(floor:HotelFloor,x:number,y:number):Room|null=>
 floor.rooms.find(room=>within(room,x,y))??null;
const furnitureAt=(floor:HotelFloor,x:number,y:number):boolean=>
 floor.objects.some(item=>{
  const size=furnitureSize(item);
  return x>=item.x&&x<item.x+size.width&&y>=item.y&&y<item.y+size.height;
 });
/** The actual 1m cells on the two sides of a drawn door segment. */
export function accessDoorPair(floor:HotelFloor,site:HotelSite,door:Pick<Wall,'x'|'y'|'orientation'>):DoorPair{
 const {x,y,orientation}=door;
 const legal=Number.isInteger(x)&&Number.isInteger(y)&&
  (orientation==='h'?x>=0&&x<site.width&&y>=0&&y<=site.height:
   x>=0&&x<=site.width&&y>=0&&y<site.height);
 if(!legal)return {first:null,second:null,exterior:false,clear:false};
 const ax=orientation==='h'?x:x-1,ay=orientation==='h'?y-1:y;
 const bx=orientation==='h'?x:x,by=orientation==='h'?y:y;
 const interiorA=ax>=0&&ax<site.width&&ay>=0&&ay<site.height;
 const interiorB=bx>=0&&bx<site.width&&by>=0&&by<site.height;
 return {
  first:interiorA?roomAt(floor,ax,ay):null,
  second:interiorB?roomAt(floor,bx,by):null,
  exterior:!interiorA||!interiorB,
  clear:(!interiorA||!furnitureAt(floor,ax,ay))&&
   (!interiorB||!furnitureAt(floor,bx,by)),
 };
}
/** Doors must join two DIFFERENT rooms, or link a circulation area to
 * the outside edge of the purchased plot. Empty grid is not a corridor.
 * A full-metre doorway cannot be covered by furniture on either side.
 */
export function hotelAccessDoorValid(
 floor:HotelFloor,site:HotelSite,door:Pick<Wall,'x'|'y'|'orientation'>,
):boolean{
 const p=accessDoorPair(floor,site,door);
 if(!p.clear)return false;
 if(p.first&&p.second)return p.first.id!==p.second.id;
 return p.exterior&&(circulation(p.first)||circulation(p.second));
}
/** Use existing construction toggle rules so changing a wall to a door,
 * removing a door, and undo/redo keep the SAME quotes and save format.
 */
export function toggleHotelAccessDoor(
 floor:HotelFloor,site:HotelSite,door:Wall,
):HotelFloor{
 const old=floor.walls.find(w=>w.x===door.x&&w.y===door.y&&
  w.orientation===door.orientation);
 if(old?.type==='door')return toggleWall(floor,door,site);
 if(!hotelAccessDoorValid(floor,site,door))
  throw new Error('Place a 1 m doorway between adjacent rooms or on an exterior lobby/corridor wall. Keep the doorway clear of furniture.');
 return toggleWall(floor,door,site);
}

function doorSegments(room:Room):Pick<Wall,'x'|'y'|'orientation'>[]{
 const list:Pick<Wall,'x'|'y'|'orientation'>[]=[];
 for(let x=room.x;x<room.x+room.width;x++){
  list.push({x,y:room.y,orientation:'h'});
  list.push({x,y:room.y+room.height,orientation:'h'});
 }
 for(let y=room.y;y<room.y+room.height;y++){
  list.push({x:room.x,y,orientation:'v'});
  list.push({x:room.x+room.width,y,orientation:'v'});
 }
 return list;
}
/** For touch screens, suggest a real boundary segment next to a corridor
 * or lobby. The user can also precisely tap any valid edge manually.
 */
export function suggestRoomAccessDoor(
 floor:HotelFloor,site:HotelSite,roomId:string,
):Pick<Wall,'x'|'y'|'orientation'>|null{
 const room=floor.rooms.find(r=>r.id===roomId);
 if(!room)return null;
 const candidates: Array<{edge:Pick<Wall,'x'|'y'|'orientation'>;priority:number}>=[];
 for(const edge of doorSegments(room)){
  if(!hotelAccessDoorValid(floor,site,edge))continue;
  const existing=floor.walls.find(w=>w.x===edge.x&&w.y===edge.y&&
   w.orientation===edge.orientation);
  if(existing?.type==='door')continue;
  const pair=accessDoorPair(floor,site,edge);
  const neighbor=pair.first?.id===room.id?pair.second:pair.first;
  const exterior=pair.exterior;
  // For circulation rooms, an exterior entrance is most useful if one does
  // not already exist; next prefer other circulation, then other rooms.
  const priority=circulation(room)&&exterior?0:
   neighbor?.type==='lobby'?1:neighbor?.type==='corridor'?2:
   circulation(room)&&neighbor?3:99;
  if(priority<99)candidates.push({edge,priority});
 }
 candidates.sort((a,b)=>a.priority-b.priority);
 return candidates[0]?.edge??null;
}

export function analyzeHotelFloorAccess(
 floor:HotelFloor,site:HotelSite,floorIndex:number,
):FloorAccessReport{
 const guestRooms=floor.rooms.filter(r=>r.type==='guest');
 const circulations=floor.rooms.filter(r=>circulation(r));
 const graph=new Map<string,Set<string>>(floor.rooms.map(r=>[r.id,new Set()]));
 const roomDoorCounts=new Map<string,number>();
 const entries=new Set<string>();
 let exteriorDoorCount=0;
 for(const wall of floor.walls){
  if(wall.type!=='door'||!hotelAccessDoorValid(floor,site,wall))continue;
  const pair=accessDoorPair(floor,site,wall),a=pair.first,b=pair.second;
  if(a)roomDoorCounts.set(a.id,(roomDoorCounts.get(a.id)??0)+1);
  if(b)roomDoorCounts.set(b.id,(roomDoorCounts.get(b.id)??0)+1);
  if(pair.exterior){const circulationRoom=circulation(a)?a:circulation(b)?b:null;
   if(circulationRoom){entries.add(circulationRoom.id);exteriorDoorCount++;}
  }else if(a&&b){graph.get(a.id)!.add(b.id);graph.get(b.id)!.add(a.id);}
 }
 const groundFloor=floorIndex===0;
 // Traverse separate circulation components. A guest in an isolated external
 // hallway must never be marked connected just because some OTHER entrance
 // reaches reception across the hotel.
 const visited=new Set<string>(),checked=new Set<string>();
 let receptionConnected=false;
 for(const seed of circulations){
  if(checked.has(seed.id))continue;
  const component=new Set<string>([seed.id]),queue=[seed.id];
  checked.add(seed.id);
  for(let i=0;i<queue.length;i++){
   for(const next of graph.get(queue[i])??[]){
    const room=floor.rooms.find(r=>r.id===next);
    if(!circulation(room)||checked.has(next))continue;
    checked.add(next);component.add(next);queue.push(next);
   }
  }
  const hasEntrance=[...component].some(id=>entries.has(id));
  const hasReception=floor.rooms.some(r=>component.has(r.id)&&r.type==='lobby'&&
   roomIssues(floor,r).length===0);
  if(hasEntrance&&hasReception){
   receptionConnected=true;
   for(const id of component)visited.add(id);
  }
 }
 const guestAccess:GuestAccess[]=guestRooms.map(room=>{
  const doors=roomDoorCounts.get(room.id)??0;
  let status:AccessStatus='disconnected';
  if(!groundFloor)status='upper-floor-pending';
  else if(!doors)status='missing-door';
  else if(!entries.size)status='no-entry';
  else if(!receptionConnected)status='no-reception';
  else if([...graph.get(room.id)??[]].some(id=>visited.has(id)))status='connected';
  return {roomId:room.id,name:room.name,status,doorCount:doors};
 });
 const connectedGuests=guestAccess.filter(g=>g.status==='connected').length;
 const warnings:string[]=[];
 if(groundFloor){
  if(!entries.size)warnings.push('Add an outside entrance on a ground-floor lobby or corridor at the plot edge.');
  if(entries.size&&!receptionConnected)warnings.push('Connect the entrance to a furnished reception using corridor/lobby doorways.');
  const missing=guestAccess.filter(g=>g.status==='missing-door').length;
  const disconnected=guestRooms.length-connectedGuests-missing;
  if(missing)warnings.push(missing+' guest room(s) need a usable doorway.');
  if(disconnected)warnings.push(disconnected+' guest room(s) cannot reach reception.');
 }else if(guestRooms.length){
  warnings.push('Upper-floor stairs and lifts are planned for Phase 2. Vertical access is not enforced yet.');
 }
 return {floorIndex,legacy:site.accessRulesVersion!==1,groundFloor,
  entranceDoors:exteriorDoorCount,receptionConnected,
  guestRooms:guestRooms.length,connectedGuests,
  pendingUpperGuests:groundFloor?0:guestRooms.length,
  circulationRooms:circulations.length,connectedCirculation:visited.size,
  guests:guestAccess,reachableRoomIds:[...visited],warnings};
}
