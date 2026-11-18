/** Compound corridor geometry on the existing 1-m grid.
 * A corridor is one logical room with an optional union of rectangles. Older
 * rectangular rooms have no sections and are read without any migration.
 * Every exported geometry operation uses occupied cells, never the bounding
 * rectangle's empty corners.
 */
import type {Room,Wall} from './internalConstruction';
export type RoomSection={x:number;y:number;width:number;height:number};
export type GridEdge=Pick<Wall,'x'|'y'|'orientation'>;
const same=(a:RoomSection,b:RoomSection)=>a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height;
export const roomSections=(room:Room):readonly RoomSection[]=>
 room.type==='corridor'&&room.sections?.length?room.sections:[{x:room.x,y:room.y,width:room.width,height:room.height}];
export const containsRoomCell=(room:Room,x:number,y:number):boolean=>
 roomSections(room).some(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height);
export function containsRoomRect(
 room:Room,rect:RoomSection,
):boolean{
 for(let y=rect.y;y<rect.y+rect.height;y++)
  for(let x=rect.x;x<rect.x+rect.width;x++)
   if(!containsRoomCell(room,x,y))return false;
 return rect.width>0&&rect.height>0;
}
export const rectsOverlap=(a:RoomSection,b:RoomSection):boolean=>
 a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function roomsOverlap(a:Room,b:Room):boolean{
 return roomSections(a).some(part=>roomSections(b).some(other=>rectsOverlap(part,other)));
}
export function roomCellKeys(room:Room):Set<string>{
 const cells=new Set<string>();
 for(const section of roomSections(room))
  for(let y=section.y;y<section.y+section.height;y++)
   for(let x=section.x;x<section.x+section.width;x++)cells.add(x+','+y);
 return cells;
}
export const roomArea=(room:Room):number=>roomCellKeys(room).size;
export function roomBoundaryEdges(room:Room):GridEdge[]{
 const cells=roomCellKeys(room);
 const edges:GridEdge[]=[];
 for(const cell of cells){
  const [x,y]=cell.split(',').map(Number);
  if(!cells.has(x+','+(y-1)))edges.push({x,y,orientation:'h'});
  if(!cells.has(x+','+(y+1)))edges.push({x,y:y+1,orientation:'h'});
  if(!cells.has((x-1)+','+y))edges.push({x,y,orientation:'v'});
  if(!cells.has((x+1)+','+y))edges.push({x:x+1,y,orientation:'v'});
 }
 return edges;
}
export const roomPerimeter=(room:Room)=>roomBoundaryEdges(room).length;
export function edgeTouchesRoom(a:Room,b:Room):boolean{
 const other=roomCellKeys(b);
 for(const cell of roomCellKeys(a)){
  const [x,y]=cell.split(',').map(Number);
  if(other.has((x-1)+','+y)||other.has((x+1)+','+y)||
   other.has(x+','+(y-1))||other.has(x+','+(y+1)))return true;
 }
 return false;
}
export function corridorBoundingBox(sections:readonly RoomSection[]):RoomSection{
 if(!sections.length)throw Error('Corridor must contain at least one section.');
 const x=Math.min(...sections.map(s=>s.x)),y=Math.min(...sections.map(s=>s.y));
 const right=Math.max(...sections.map(s=>s.x+s.width));
 const bottom=Math.max(...sections.map(s=>s.y+s.height));
 return {x,y,width:right-x,height:bottom-y};
}
/** A wall on a joining seam means the space is physically partitioned. */
export function blockingCorridorSeam(
 a:Room,b:Room,walls:readonly Wall[],
):Wall|null{
 const ac=roomCellKeys(a),bc=roomCellKeys(b);
 for(const wall of walls){
  const ax=wall.orientation==='h'?wall.x:wall.x-1;
  const ay=wall.orientation==='h'?wall.y-1:wall.y;
  const bx=wall.x,by=wall.y;
  if((ac.has(ax+','+ay)&&bc.has(bx+','+by))||
   (bc.has(ax+','+ay)&&ac.has(bx+','+by)))
   if(wall.type!=='door')return wall;
 }
 return null;
}
export function corridorShape(
 original:Room,parts:readonly RoomSection[],
):Room{
 if(original.type!=='corridor')throw Error('Only corridors support connected sections.');
 const bounds=corridorBoundingBox(parts);
 return {...original,...bounds,sections:parts.map(s=>({...s}))};
}
export const roomShapeEqual=(a:Room,b:Room):boolean=>
 a.type===b.type&&a.x===b.x&&a.y===b.y&&a.width===b.width&&a.height===b.height&&
 (a.type!=='corridor'||JSON.stringify(roomSections(a))===JSON.stringify(roomSections(b)));
/** Decorators use one room label on its entire occupied footprint. */
export function roomCenterCell(room:Room):{x:number;y:number}{
 const cells=[...roomCellKeys(room)].map(k=>k.split(',').map(Number));
 const cx=room.x+room.width/2,cy=room.y+room.height/2;
 cells.sort((a,b)=>((a[0]+.5-cx)**2+(a[1]+.5-cy)**2)-
  ((b[0]+.5-cx)**2+(b[1]+.5-cy)**2));
 return {x:cells[0]?.[0]??room.x,y:cells[0]?.[1]??room.y};
}
export function sectionSame(a:RoomSection,b:RoomSection):boolean{return same(a,b);}
