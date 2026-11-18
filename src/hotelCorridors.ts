/** Continuous hotel corridors: one connected, irregular room, made from
 * multiple non-overlapping rectangular sections on the existing 1 m grid.
 * All operations are pure, atomic, and preserve historic rectangular rooms.
 */
import {
 drawRoom,roomAtCell,roomIntersectsRect,roomSections,furnitureSize,
 type HotelFloor,type HotelSite,type Room,type RoomRect,type Wall,
} from './internalConstruction';

const key=(x:number,y:number)=>x+':'+y;
const point=(k:string):{x:number;y:number}=>{
 const [x,y]=k.split(':').map(Number);return {x,y};
};
const neighbours=(x:number,y:number)=>[
 key(x+1,y),key(x-1,y),key(x,y+1),key(x,y-1),
];
const rectTiles=(rect:RoomRect):string[]=>{
 const tiles:string[]=[];
 for(let y=rect.y;y<rect.y+rect.height;y++)
  for(let x=rect.x;x<rect.x+rect.width;x++)tiles.push(key(x,y));
 return tiles;
};
/** Tile union -> compact, non-overlapping rectangles. No per-cell save bloat. */
function compactSections(tiles:ReadonlySet<string>):RoomRect[]{
 const rows=new Map<number,number[]>();
 for(const tile of tiles){
  const {x,y}=point(tile);
  if(!rows.has(y))rows.set(y,[]);
  rows.get(y)!.push(x);
 }
 const result:RoomRect[]=[];
 let active=new Map<string,RoomRect>();
 for(const y of [...rows.keys()].sort((a,b)=>a-b)){
  const xs=rows.get(y)!.sort((a,b)=>a-b);
  const runs:Array<{x:number;width:number}>=[];
  for(const x of xs){
   const last=runs[runs.length-1];
   if(last&&last.x+last.width===x)last.width++;
   else runs.push({x,width:1});
  }
  const next=new Map<string,RoomRect>();
  for(const run of runs){
   const id=run.x+':'+run.width;
   const previous=active.get(id);
   if(previous&&previous.y+previous.height===y){
    previous.height++;next.set(id,previous);
   }else next.set(id,{x:run.x,y,width:run.width,height:1});
  }
  for(const [id,rect] of active)if(!next.has(id))result.push(rect);
  active=next;
 }
 result.push(...active.values());
 return result.sort((a,b)=>b.width*b.height-a.width*a.height||
  a.y-b.y||a.x-b.x);
}
const wallSides=(w:Pick<Wall,'x'|'y'|'orientation'>)=>{
 const {x,y,orientation}=w;
 return orientation==='h'?
  [{x,y:y-1},{x,y}]:[{x:x-1,y},{x,y}];
};
function rebuild(
 floor:HotelFloor,site:HotelSite,paint:RoomRect|null,newId:string,
 preferredId?:string,
):HotelFloor{
 const corridorRooms=floor.rooms.filter(r=>r.type==='corridor');
 if(paint){
  if(!Number.isInteger(paint.x)||!Number.isInteger(paint.y)||
   !Number.isInteger(paint.width)||!Number.isInteger(paint.height)||
   paint.width<2||paint.height<2||paint.x<0||paint.y<0||
   paint.x+paint.width>site.width||paint.y+paint.height>site.height)
   throw Error('Draw a corridor section at least 2 × 2 m inside your plot.');
  if(floor.rooms.some(r=>r.type!=='corridor'&&roomIntersectsRect(r,paint)))
   throw Error('The corridor overlaps another room. Draw around it instead.');
 }
 const owners=new Map<string,string>();
 for(const room of corridorRooms)
  for(const rect of roomSections(room))
   for(const tile of rectTiles(rect))owners.set(tile,room.id);
 const all=new Set(owners.keys());
 const painted=paint?rectTiles(paint):[];
 if(paint&&painted.every(tile=>all.has(tile)))
  throw Error('This area is already part of a corridor. Extend into free space.');
 for(const tile of painted)all.add(tile);
 if(!all.size)return floor;
 const groups:Array<Set<string>>=[];
 const seen=new Set<string>();
 for(const start of all){
  if(seen.has(start))continue;
  const group=new Set<string>(),queue=[start];seen.add(start);
  for(let i=0;i<queue.length;i++){
   const tile=queue[i];group.add(tile);
   const {x,y}=point(tile);
   for(const next of neighbours(x,y))
    if(all.has(next)&&!seen.has(next)){seen.add(next);queue.push(next);}
  }
  groups.push(group);
 }
 const usedIds=new Set<string>();
 const merged:Room[]=[];
 const aliases=new Map<string,string>();
 for(const group of groups){
  const matches=corridorRooms.filter(r=>roomSections(r).some(p=>
   rectTiles(p).some(tile=>group.has(tile))));
  const original=matches.find(r=>r.id===preferredId)??matches[0];
  const primary=original??{
   id:newId,type:'corridor' as const,name:'Corridor '+(corridorRooms.length+1),
   x:0,y:0,width:2,height:2,
  };
  if(usedIds.has(primary.id))throw Error('A corridor identifier is already in use.');
  usedIds.add(primary.id);
  for(const m of matches)aliases.set(m.id,primary.id);
  // Keep the original drawn sections as the user's editable units. A global
  // tile-to-rectangle repack would split an L-shaped hall into horizontal
  // stripes, making it impossible to remove a single side branch cleanly.
  const oldParts=matches.flatMap(roomSections);
  const additions=new Set([...group].filter(tile=>!owners.has(tile)));
  const sections=[...oldParts,...compactSections(additions)];
  const [first,...rest]=sections;
  const candidate:Room={...primary,...first,sections:rest.length?rest:undefined};
  // Reuse the canonical room validation against every other room.
  const outside={...floor,rooms:floor.rooms.filter(r=>r.type!=='corridor')};
  drawRoom(outside,candidate,site);
  merged.push(candidate);
 }
 const resultRooms:Room[]=[];
 const emitted=new Set<string>();
 for(const room of floor.rooms){
  if(room.type!=='corridor'){resultRooms.push(room);continue;}
  const parent=aliases.get(room.id);
  if(parent&&!emitted.has(parent)){
   const candidate=merged.find(r=>r.id===parent)!;
   resultRooms.push(candidate);emitted.add(parent);
  }
 }
 for(const r of merged)if(!emitted.has(r.id)){resultRooms.push(r);emitted.add(r.id);}
 const next={...floor,rooms:resultRooms};
 // Only remove partitions that BECAME internal to the same merged corridor.
 // Doors, windows and walls at boundaries with guest rooms remain untouched.
 const walls=floor.walls.filter(w=>{
  const [a,b]=wallSides(w);
  const priorA=roomAtCell(floor,a.x,a.y),priorB=roomAtCell(floor,b.x,b.y);
  const nowA=roomAtCell(next,a.x,a.y),nowB=roomAtCell(next,b.x,b.y);
  return !(nowA?.type==='corridor'&&nowA.id===nowB?.id&&
   (priorA?.id!==priorB?.id));
 });
 return {...next,walls};
}
/** Draw a new section anywhere; touching old corridor(s) joins them automatically.
 * T and L shapes, loops, branches and overlapping paint are supported.
 */
export function paintHotelCorridor(
 floor:HotelFloor,site:HotelSite,rect:RoomRect,id:string,
 preferredId?:string,
):HotelFloor{
 return rebuild(floor,site,rect,id,preferredId);
}
/** Upgrade existing layouts in place: any edge-connected corridor rooms
 * become one logical room without changing their physical footprint.
 */
export function joinConnectedHotelCorridors(floor:HotelFloor,site:HotelSite):HotelFloor{
 return rebuild(floor,site,null,'unused');
}
export function corridorSectionsFor(room:Room):RoomRect[]{
 return roomSections(room);
}
/** Remove one rectangular section, rejecting disconnection and any
 * equipment or wall attachments that would otherwise be orphaned.
 */
export function removeHotelCorridorSection(
 floor:HotelFloor,site:HotelSite,roomId:string,index:number,
):HotelFloor{
 const room=floor.rooms.find(r=>r.id===roomId);
 if(!room||room.type!=='corridor')throw Error('Select a corridor to edit.');
 const sections=roomSections(room);
 if(!Number.isInteger(index)||index<0||index>=sections.length)
  throw Error('Corridor section not found.');
 const removed=sections[index];
 const remaining=sections.filter((_,i)=>i!==index);
 const lost=rectTiles(removed).filter(tile=>{
  const {x,y}=point(tile);
  return !remaining.some(r=>x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height);
 });
 if(floor.objects.some(o=>{
   const size=furnitureSize(o);
   return lost.some(tile=>{const {x,y}=point(tile);
    return x>=o.x&&x<o.x+size.width&&y>=o.y&&y<o.y+size.height;});
  })||
  (floor.lights??[]).some(l=>lost.includes(key(l.x,l.y)))||
  (floor.safetyFixtures??[]).some(f=>lost.includes(key(f.x,f.y))))
  throw Error('Move furnishings, lights and safety equipment out of this corridor section first.');
 if(floor.walls.some(w=>wallSides(w).some(p=>lost.includes(key(p.x,p.y)))))
  throw Error('Remove attached doors, walls or windows before deleting this corridor section.');
 if(!remaining.length){
  return {...floor,rooms:floor.rooms.filter(r=>r.id!==roomId)};
 }
 const [first,...rest]=remaining;
 const next:Room={...room,...first,sections:rest.length?rest:undefined};
 const others={...floor,rooms:floor.rooms.filter(r=>r.id!==roomId)};
 drawRoom(others,next,site);
 return {...floor,rooms:floor.rooms.map(r=>r.id===roomId?next:r)};
}
export const corridorTileCount=(floor:HotelFloor):number=>
 floor.rooms.filter(r=>r.type==='corridor').reduce((sum,r)=>
  sum+roomSections(r).reduce((n,p)=>n+p.width*p.height,0),0);
