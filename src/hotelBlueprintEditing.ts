/** Safe precision editing and ready-to-furnish room templates.
 * All geometry is in the existing 1 m building grid. No new saved schema
 * or construction payments: updates remain draft layouts until approved.
 */
import {
 drawRoom,placeFurniture,furnitureSize,roomIssues,roomTypes,
 type Room,type RoomType,type HotelFloor,type HotelSite,type FurnitureCode,type ObjectPlacement,
} from './internalConstruction';
import {analyzeRoomAtmosphere} from './hotelAtmosphere';

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

/** Find the topmost item using its actual rotated footprint, not the text
 * painted on the SVG. Enables precise tap, drag and arrow-key-equivalent edits.
 */
export function furnitureAtCell(floor:HotelFloor,x:number,y:number):ObjectPlacement|null{
 for(let i=floor.objects.length-1;i>=0;i--){
  const object=floor.objects[i],size=furnitureSize(object);
  if(x>=object.x&&y>=object.y&&x<object.x+size.width&&y<object.y+size.height)return object;
 }
 return null;
}
export type FurnitureEdit=Partial<Pick<ObjectPlacement,'x'|'y'|'rotated'>>;
/** Edit atomically using the SAME room and overlap constraints as adding it.
 * This never buys furniture again, changes its stable ID or reorders the save.
 */
export function editBlueprintFurniture(
 floor:HotelFloor,site:HotelSite,objectId:string,changes:FurnitureEdit,
):HotelFloor{
 const before=floor.objects.find(o=>o.id===objectId);
 if(!before)throw Error('Select a furniture item to edit.');
 const updated={...before,...changes};
 if(updated.x===before.x&&updated.y===before.y&&updated.rotated===before.rotated)return floor;
 const without={...floor,objects:floor.objects.filter(o=>o.id!==objectId)};
 const checked=placeFurniture(without,updated,site);
 const replacement=checked.objects[checked.objects.length-1];
 return {...floor,objects:floor.objects.map(o=>o.id===objectId?replacement:o)};
}
/** A finger drag is translated to integer grid-cell changes, never fractions.
 * Derive from the original coordinate, not from incremental pointer frames.
 */
export function furnitureDragPosition(
 original:Pick<ObjectPlacement,'x'|'y'>,
 deltaPixels:{x:number;y:number},zoom:number,
):{x:number;y:number}{
 const cellPixels=30*Math.max(.25,Math.min(2.5,Number.isFinite(zoom)?zoom:1));
 return {x:original.x+Math.round(deltaPixels.x/cellPixels),
  y:original.y+Math.round(deltaPixels.y/cellPixels)};
}
export type HotelDesignQuality={
 score:number;tier:'Needs work'|'Basic'|'Standard'|'Comfort'|'Premium';
 suggestions:string[];
};
/** Guest-room design quality: space, furnishings, supporting bathroom and
 * free circulation area. A GAME balancing metric, not a real building code.
 * It does not change room validity or demolish older saved hotel layouts.
 */
export function hotelGuestRoomQuality(floor:HotelFloor,room:Room,site?:HotelSite):HotelDesignQuality{
 if(room.type!=='guest')return {score:0,tier:'Needs work',suggestions:[]};
 const objects=floor.objects.filter(o=>
  contained(room,{...o,...furnitureSize(o)}));
 const codes=new Set(objects.map(o=>o.code));
 const bathroom=floor.rooms.some(r=>r.type==='bathroom'&&roomIssues(floor,r).length===0);
 const hasBed=codes.has('bed')||codes.has('single-bed');
 const size=room.width*room.height;
 let score=38+Math.min(17,Math.max(0,size-9));
 if(hasBed)score+=18;else score-=20;
 if(codes.has('wardrobe'))score+=8;
 if(codes.has('television'))score+=8;
 if(codes.has('desk'))score+=6;
 if(codes.has('lamp'))score+=4;
 if(codes.has('sofa'))score+=5;
 if(bathroom)score+=10;else score-=14;
 const occupied=objects.reduce((n,o)=>{const a=furnitureSize(o);return n+a.width*a.height;},0);
 if(size>0&&occupied/size>.65)score-=12;
 // Only atmosphere-enabled plots use the new quality adjustment. Existing
 // hotels and older builds retain their previous score and booking demand.
 const atmosphere=site?.atmosphereRulesVersion===1?analyzeRoomAtmosphere(floor,room,site):null;
 if(atmosphere)score+=Math.round((atmosphere.score-50)*.14);
 if(!hasBed)score=Math.min(score,32);
 if(!bathroom)score=Math.min(score,49);
 score=Math.round(Math.min(100,Math.max(0,score)));
 const tier:HotelDesignQuality['tier']=score<35?'Needs work':score<55?'Basic':
  score<70?'Standard':score<85?'Comfort':'Premium';
 const suggestions:string[]=[];
 if(!hasBed)suggestions.push('Add a bed');
 if(!bathroom)suggestions.push('Equip a bathroom on this floor');
 if(!codes.has('wardrobe'))suggestions.push('Add a wardrobe');
 if(!codes.has('television'))suggestions.push('Add a television');
 if(!codes.has('desk'))suggestions.push('Add a desk');
 if(!codes.has('lamp'))suggestions.push('Add a lamp');
 if(size<15)suggestions.push('Consider a larger room');
 if(size>0&&occupied/size>.65)suggestions.push('Leave more free floor space');
 if(atmosphere)suggestions.push(...atmosphere.advice.filter(t=>!t.startsWith('Well-lit')));
 return {score,tier,suggestions};
}

/** Convert design score to a modest bounded occupancy effect. Equipment and
 * generous room sizes improve bookings; unfinished designs do worse. The
 * canonical room availability, prices and staffing checks remain unchanged.
 */
export function hotelDesignDemandModifier(score:number):number{
 if(!Number.isFinite(score))return 0;
 return Math.max(-.06,Math.min(.10,(score-60)*.0025));
}

export type HotelBlueprintHealth={
 rooms:number;guestRooms:number;readyGuestRooms:number;
 furnishedRooms:number;roomsWithIssues:number;
 plannedArea:number;usablePercent:number;
 averageGuestRoomQuality:number|null;
 guestRoomQuality:readonly {roomId:string;name:string;quality:HotelDesignQuality}[];
 issues:readonly {roomId:string;name:string;messages:string[]}[];
};
/** Draft-only construction quality indicators; not hotel operating occupancy. */
export function hotelBlueprintHealth(floor:HotelFloor,site:HotelSite):HotelBlueprintHealth{
 const issues=floor.rooms.map(room=>({roomId:room.id,name:room.name,
  messages:roomIssues(floor,room)})).filter(item=>item.messages.length>0);
 const unfinished=new Set(issues.map(item=>item.roomId));
 const plannedArea=floor.rooms.reduce((total,r)=>total+r.width*r.height,0);
 const guestRoomQuality=floor.rooms.filter(r=>r.type==='guest').map(room=>({
  roomId:room.id,name:room.name,quality:hotelGuestRoomQuality(floor,room,site),
 }));
 return {rooms:floor.rooms.length,
  guestRoomQuality,
  averageGuestRoomQuality:guestRoomQuality.length?
   Math.round(guestRoomQuality.reduce((sum,item)=>sum+item.quality.score,0)/guestRoomQuality.length):null,
  guestRooms:floor.rooms.filter(r=>r.type==='guest').length,
  readyGuestRooms:floor.rooms.filter(r=>r.type==='guest'&&!unfinished.has(r.id)).length,
  furnishedRooms:floor.rooms.filter(r=>!unfinished.has(r.id)).length,
  roomsWithIssues:issues.length,
  plannedArea,usablePercent:site.width*site.height?
   Math.round(100*plannedArea/(site.width*site.height)):0,issues};
}
