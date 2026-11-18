/** Draw and merge physically continuous corridor sections. A single logical
 * Room covers an L/T/U shape; occupied cells remain distinct from its bounding
 * rectangle, and saved rooms without sections stay valid.
 */
import {drawRoom,furnitureSize,type HotelFloor,type HotelSite,type Room,type Wall} from './internalConstruction';
import {
 roomSections,containsRoomCell,roomsOverlap,roomCellKeys,rectsOverlap,
 corridorShape,edgeTouchesRoom,blockingCorridorSeam,
 type RoomSection,
} from './hotelRoomGeometry';
const edgeSides=(wall:Wall)=>({
 a:wall.orientation==='h'?{x:wall.x,y:wall.y-1}:{x:wall.x-1,y:wall.y},
 b:{x:wall.x,y:wall.y},
});
const validPart=(part:RoomSection,site:HotelSite)=>{
 if(![part.x,part.y,part.width,part.height].every(Number.isInteger)||
  part.x<0||part.y<0||part.width<1||part.height<1||
  part.x+part.width>site.width||part.y+part.height>site.height)
  throw Error('Corridor sections must stay inside the purchased plot on the 1 m grid.');
};
const partsJoin=(a:RoomSection,b:RoomSection):boolean=>{
 const wrap=(r:RoomSection):Room=>({...r,id:'cell',name:'cell',type:'corridor'});
 return rectsOverlap(a,b)||edgeTouchesRoom(wrap(a),wrap(b));
};
const connectedSections=(sections:readonly RoomSection[]):boolean=>{
 if(!sections.length)return false;
 const seen=new Set([0]),pending=[0];
 for(let i=0;i<pending.length;i++){
  const index=pending[i];
  for(let j=0;j<sections.length;j++){
   if(seen.has(j)||!partsJoin(sections[index],sections[j]))continue;
   seen.add(j);pending.push(j);
  }
 }
 return seen.size===sections.length;
};
/** Preserve every old room ID except the corridor rooms the user explicitly
 * joins via a continuous segment. Existing walls cannot be swept away.
 */
export function drawCorridorSection(
 floor:HotelFloor,site:HotelSite,section:RoomSection,
 id:string,label:string,selectedCorridorId?:string|null,
):HotelFloor{
 validPart(section,site);
 const sectionRoom:Room={id,name:label,type:'corridor',...section};
 if(floor.rooms.some(r=>r.type!=='corridor'&&roomsOverlap(r,sectionRoom)))
  throw Error('The corridor would overlap an existing room. Draw around it instead.');
 const touched=new Set(floor.rooms.filter(r=>r.type==='corridor'&&
  (roomsOverlap(r,sectionRoom)||edgeTouchesRoom(r,sectionRoom))).map(r=>r.id));
 if(selectedCorridorId){
  const selected=floor.rooms.find(r=>r.id===selectedCorridorId);
  if(!selected||selected.type!=='corridor')throw Error('Choose a corridor to extend.');
  if(!touched.has(selected.id))throw Error('The new section must share an edge with the selected corridor. Draw a connector first.');
 }
 // Joining all touching corridor components is automatic. A connecting
 // section can join two formerly separate corridor IDs into one.
 const targets=[...floor.rooms.filter(r=>touched.has(r.id))];
 let added=true;
 while(added){
  added=false;
  const aggregate:Room=targets.length?corridorShape(targets[0],
   [...targets.flatMap(r=>roomSections(r)),section]):sectionRoom;
  for(const other of floor.rooms){
   if(other.type!=='corridor'||touched.has(other.id))continue;
   if(edgeTouchesRoom(aggregate,other)||roomsOverlap(aggregate,other)){
    touched.add(other.id);targets.push(other);added=true;
   }
  }
 }
 if(targets.length===0){
  if(section.width<2||section.height<2)
   throw Error('Start a corridor at least 2×2 m; extensions can be narrower.');
  return drawRoom(floor,sectionRoom,site);
 }
 const preferred=selectedCorridorId&&touched.has(selectedCorridorId)?
  targets.find(r=>r.id===selectedCorridorId)!:targets[0];
 const sections=[...targets.flatMap(r=>roomSections(r)),section];
 if(sections.length>128)throw Error('This corridor has too many sections. Use a larger drawn section instead.');
 if(!connectedSections(sections))throw Error('Corridor sections must form one connected passage.');
 // Custom walls between touching corridor rooms or newly joined corridor
 // areas must not disappear silently. The user must erase them first.
 for(const target of targets)
  if(target.id!==preferred.id&&blockingCorridorSeam(preferred,target,floor.walls))
   throw Error('A wall separates these corridors. Remove the wall before merging.');
 const combined=corridorShape(preferred,sections);
 const internal=new Set(floor.walls.filter(w=>{
  const {a,b}=edgeSides(w);
  return containsRoomCell(combined,a.x,a.y)&&containsRoomCell(combined,b.x,b.y);
 }).map(w=>w.id));
 if(floor.walls.some(w=>internal.has(w.id)&&w.type!=='door'))
  throw Error('A wall or window divides this corridor. Remove it before merging.');
 if(floor.rooms.some(r=>r.type!=='corridor'&&roomsOverlap(combined,r)))
  throw Error('Corridor sections cannot occupy another room.');
 const keep=floor.rooms.filter(r=>!touched.has(r.id));
 const index=floor.rooms.findIndex(r=>r.id===preferred.id);
 const before=floor.rooms.slice(0,index).filter(r=>!touched.has(r.id));
 const after=keep.filter(r=>!before.includes(r));
 return {...floor,
  rooms:[...before,combined,...after],
  walls:floor.walls.filter(w=>!internal.has(w.id)),
 };
}
export function joinAdjacentCorridors(
 floor:HotelFloor,site:HotelSite,roomId:string,
):HotelFloor{
 const room=floor.rooms.find(r=>r.id===roomId);
 if(!room||room.type!=='corridor')throw Error('Select a corridor to merge.');
 const others=floor.rooms.filter(r=>r.id!==roomId&&r.type==='corridor'&&edgeTouchesRoom(room,r));
 if(!others.length)throw Error('This corridor has no directly adjoining corridor. Draw a connecting section with Room → Corridor.');
 // Reuse exactly the same adjacency and wall validation as the paint tool,
 // by drawing an existing occupied cell on the selected corridor.
 const cell=[...roomCellKeys(room)][0].split(',').map(Number);
 const merged=drawCorridorSection(floor,site,{x:cell[0],y:cell[1],width:1,height:1},
  room.id,room.name,roomId);
 if(merged.rooms.filter(r=>r.type==='corridor').length>=floor.rooms.filter(r=>r.type==='corridor').length)
  throw Error('A wall prevents the corridors from joining.');
 return merged;
}
export const corridorSectionCount=(room:Room):number=>roomSections(room).length;
/** Corridor remove-last is safe only if it leaves the same connected room.
 * Wall and door segments attached to the removed cells are not discarded.
 */
export function removeLastCorridorSection(
 floor:HotelFloor,_site:HotelSite,id:string,
):HotelFloor{
 const room=floor.rooms.find(r=>r.id===id);
 if(!room||room.type!=='corridor'||!room.sections||room.sections.length<2)
  throw Error('Select a corridor with multiple drawn sections.');
 const nextParts=room.sections.slice(0,-1);
 if(!connectedSections(nextParts))throw Error('Removing that section would disconnect the corridor.');
 const next=corridorShape(room,nextParts);
 const old=roomCellKeys(room),current=roomCellKeys(next);
 for(const wall of floor.walls){
  const {a,b}=edgeSides(wall);
  const touched=old.has(a.x+','+a.y)||old.has(b.x+','+b.y);
  const still=current.has(a.x+','+a.y)||current.has(b.x+','+b.y);
  if(touched&&!still)throw Error('Remove the door or wall attached to that corridor section first.');
 }
 for(const item of floor.objects){
  const size=furnitureSize(item);
  for(let y=item.y;y<item.y+size.height;y++)for(let x=item.x;x<item.x+size.width;x++)
   if(containsRoomCell(room,x,y)&&!containsRoomCell(next,x,y))
    throw Error('Move furniture from the removed section first.');
 }
 return {...floor,rooms:floor.rooms.map(r=>r.id===id?next:r)};
}
