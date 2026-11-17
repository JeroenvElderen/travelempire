/** Safe precision editing and ready-to-furnish room templates.
 * All geometry is in the existing 1 m building grid. No new saved schema
 * or construction payments: updates remain draft layouts until approved.
 */
import {
 drawRoom,placeFurniture,furnitureSize,roomIssues,roomTypes,
 type Room,type RoomType,type HotelFloor,type HotelSite,type FurnitureCode,
} from './internalConstruction';

export type BlueprintRoomGeometry=Pick<Room,'x'|'y'|'width'|'height'>;
export type RoomTemplateId=
 'guest-double'|'guest-single'|'bathroom-ready'|'lobby-ready'|
 'kitchen-ready'|'restaurant-ready'|'office-ready';
export type BlueprintRoomTemplate={
 id:RoomTemplateId;name:string;roomType:RoomType;width:number;height:number;
 equipment:ReadonlyArray<{code:FurnitureCode;x:number;y:number;rotated?:boolean}>;
};
export const BLUEPRINT_ROOM_TEMPLATES:readonly BlueprintRoomTemplate[]=[
 {id:'guest-double',name:'Double guest room',roomType:'guest',width:5,height:4,equipment:[
  {code:'bed',x:0,y:0},{code:'wardrobe',x:4,y:0},
  {code:'television',x:4,y:2},{code:'desk',x:0,y:3},{code:'lamp',x:3,y:3},
 ]},
 {id:'guest-single',name:'Single guest room',roomType:'guest',width:4,height:4,equipment:[
  {code:'single-bed',x:0,y:0},{code:'wardrobe',x:3,y:0},
  {code:'television',x:3,y:2},{code:'desk',x:0,y:3},
 ]},
 {id:'bathroom-ready',name:'Equipped bathroom',roomType:'bathroom',width:3,height:3,equipment:[
  {code:'shower',x:0,y:0},{code:'toilet',x:1,y:0},{code:'sink',x:2,y:0},
 ]},
 {id:'lobby-ready',name:'Hotel reception',roomType:'lobby',width:6,height:4,equipment:[
  {code:'reception',x:0,y:0},{code:'sofa',x:3,y:1},
  {code:'lamp',x:5,y:3},{code:'computer',x:2,y:0},
 ]},
 {id:'kitchen-ready',name:'Commercial kitchen',roomType:'kitchen',width:6,height:4,equipment:[
  {code:'oven',x:0,y:0},{code:'fridge',x:2,y:0},
  {code:'sink',x:3,y:0},{code:'freezer',x:4,y:0},
  {code:'prep',x:0,y:2},
 ]},
 {id:'restaurant-ready',name:'Dining room',roomType:'restaurant',width:6,height:5,equipment:[
  {code:'table',x:0,y:0},{code:'chair',x:2,y:0},
  {code:'table',x:3,y:2},{code:'chair',x:5,y:2},
 ]},
 {id:'office-ready',name:'Office',roomType:'office',width:5,height:4,equipment:[
  {code:'desk',x:0,y:0},{code:'computer',x:2,y:0},
  {code:'office-chair',x:0,y:1},{code:'printer',x:3,y:0},
 ]},
] as const;
const contained=(r:BlueprintRoomGeometry,o:{x:number;y:number;width:number;height:number})=>
 o.x>=r.x&&o.y>=r.y&&o.x+o.width<=r.x+r.width&&o.y+o.height<=r.y+r.height;
const wallNearRoom=(room:BlueprintRoomGeometry,wall:HotelFloor['walls'][number])=>{
 const x1=wall.x,y1=wall.y;
 const x2=x1+(wall.orientation==='h'?1:0),y2=y1+(wall.orientation==='v'?1:0);
 return Math.min(x1,x2)<=room.x+room.width&&Math.max(x1,x2)>=room.x&&
  Math.min(y1,y2)<=room.y+room.height&&Math.max(y1,y2)>=room.y;
};
/** Move or resize a room and ALL its furniture atomically. Reject overlap,
 * furniture protrusion and attached custom walls rather than losing content.
 */
export function editBlueprintRoom(
 floor:HotelFloor,site:HotelSite,roomId:string,geometry:BlueprintRoomGeometry,
):HotelFloor{
 const original=floor.rooms.find(r=>r.id===roomId);
 if(!original)throw Error('Select a room to edit.');
 if(Object.keys(geometry).some(k=>!Number.isInteger(geometry[k as keyof BlueprintRoomGeometry])))
  throw Error('Room dimensions and position must use whole metres.');
 if(original.x===geometry.x&&original.y===geometry.y&&
  original.width===geometry.width&&original.height===geometry.height)return floor;
 if(floor.walls.some(w=>wallNearRoom(original,w)))
  throw Error('Remove walls or doors touching this room before moving or resizing it.');
 const nextRoom={...original,...geometry};
 const inside= new Set(floor.objects.filter(o=>contained(original,{...o,...furnitureSize(o)}))
  .map(o=>o.id));
 const otherObjects=floor.objects.filter(o=>!inside.has(o.id));
 const draft=drawRoom({...floor,rooms:floor.rooms.filter(r=>r.id!==roomId),objects:otherObjects},nextRoom,site);
 const dx=geometry.x-original.x,dy=geometry.y-original.y;
 let withFurniture=draft;
 for(const object of floor.objects.filter(o=>inside.has(o.id))){
  withFurniture=placeFurniture(withFurniture,{...object,x:object.x+dx,y:object.y+dy},site);
 }
 // Preserve room and furniture order for stable SVG keys/undo/redo.
 const relocated=new Map(withFurniture.objects.map(o=>[o.id,o]));
 return {...floor,rooms:floor.rooms.map(r=>r.id===roomId?nextRoom:r),
  objects:floor.objects.map(o=>relocated.get(o.id)??o)};
}
/** Insert a fully validated standard room into the first free space.
 * Uses exactly the same placement rules/costs as manual construction.
 */
export function addBlueprintTemplate(
 floor:HotelFloor,site:HotelSite,templateId:RoomTemplateId,
 roomId:string,objectId:(index:number)=>string,
):HotelFloor{
 const template=BLUEPRINT_ROOM_TEMPLATES.find(t=>t.id===templateId);
 if(!template)throw Error('Unknown room template.');
 if(floor.rooms.some(r=>r.id===roomId))throw Error('A room with this ID already exists.');
 let attempted=0;
 for(let y=0;y<=site.height-template.height;y++)
  for(let x=0;x<=site.width-template.width;x++){
   const room:Room={id:roomId,type:template.roomType,
    name:roomTypes.find(t=>t.id===template.roomType)!.label+' '+
      (floor.rooms.filter(r=>r.type===template.roomType).length+1),
    x,y,width:template.width,height:template.height};
   let next:HotelFloor;
   try{
    next=drawRoom(floor,room,site);
    for(const [index,item] of template.equipment.entries())
     next=placeFurniture(next,{
      id:objectId(index),code:item.code,
      x:x+item.x,y:y+item.y,rotated:item.rotated??false,
     },site);
   }catch{
    attempted++;continue;
   }
   return next;
  }
 throw Error(attempted?'No space for this furnished room. Move another room or choose a larger plot.':
  'This room template does not fit your plot.');
}
export type HotelBlueprintHealth={
 rooms:number;guestRooms:number;readyGuestRooms:number;
 furnishedRooms:number;roomsWithIssues:number;
 plannedArea:number;usablePercent:number;
 issues:readonly {roomId:string;name:string;messages:string[]}[];
};
/** Draft-only construction quality indicators; not hotel operating occupancy. */
export function hotelBlueprintHealth(floor:HotelFloor,site:HotelSite):HotelBlueprintHealth{
 const issues=floor.rooms.map(room=>({roomId:room.id,name:room.name,
  messages:roomIssues(floor,room)})).filter(item=>item.messages.length>0);
 const unfinished=new Set(issues.map(item=>item.roomId));
 const plannedArea=floor.rooms.reduce((total,r)=>total+r.width*r.height,0);
 return {rooms:floor.rooms.length,
  guestRooms:floor.rooms.filter(r=>r.type==='guest').length,
  readyGuestRooms:floor.rooms.filter(r=>r.type==='guest'&&!unfinished.has(r.id)).length,
  furnishedRooms:floor.rooms.filter(r=>!unfinished.has(r.id)).length,
  roomsWithIssues:issues.length,
  plannedArea,usablePercent:site.width*site.height?
   Math.round(100*plannedArea/(site.width*site.height)):0,issues};
}
