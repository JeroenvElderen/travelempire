/** Hotel interior collections: deterministic, atomic furnishing of EXISTING rooms.
 * This doesn't draw rooms, make purchases, change construction timing or touch
 * furniture in neighbouring rooms. It uses the canonical placeFurniture checks.
 */
import {
 furniture,placeFurniture,furnitureSize,type FurnitureCode,type RoomType,
 type HotelFloor,type HotelSite,type ObjectPlacement,type Room,
} from './internalConstruction';
import {
 buildFurnitureCatalogue,furnitureIsCompatible,
 type FurnitureStyle,type FurnitureTier,type FurnitureFinish,type FurnitureProduct,
} from './furnitureCatalog';

export type CollectionRoomType=Extract<RoomType,'guest'|'bathroom'|'lobby'|'office'|'restaurant'|'kitchen'>;
export type CollectionMode='fill'|'replace';
export type CollectionPiece={code:FurnitureCode;label:string};
export type RoomCollection={
 roomType:CollectionRoomType;name:string;description:string;
 pieces:readonly CollectionPiece[];
};
export const ROOM_COLLECTIONS:readonly RoomCollection[]=[
 {roomType:'guest',name:'Complete bedroom',description:'Bed, storage, desk, lighting and guest comforts',
  pieces:[
   {code:'bed',label:'Bed'},{code:'wardrobe',label:'Wardrobe'},
   {code:'desk',label:'Writing desk'},{code:'nightstand',label:'Bedside table'},
   {code:'television',label:'Television'},{code:'lamp',label:'Floor lamp'},
   {code:'plant',label:'Decorative plant'},
  ]},
 {roomType:'bathroom',name:'Bathroom collection',description:'All essential sanitary fittings and mirrors',
  pieces:[
   {code:'shower',label:'Shower'},{code:'toilet',label:'Toilet'},
   {code:'sink',label:'Washbasin'},{code:'mirror',label:'Mirror'},
   {code:'towel-rack',label:'Towel stand'},
  ]},
 {roomType:'lobby',name:'Reception & lounge',description:'Guest check-in and comfortable lounge seating',
  pieces:[
   {code:'reception',label:'Reception counter'},{code:'sofa',label:'Sofa'},
   {code:'coffee-table',label:'Coffee table'},{code:'armchair',label:'Armchair'},
   {code:'lamp',label:'Floor lamp'},{code:'plant',label:'Decorative plant'},
  ]},
 {roomType:'office',name:'Office workspace',description:'Workspace, computer equipment and storage',
  pieces:[
   {code:'desk',label:'Desk'},{code:'office-chair',label:'Office chair'},
   {code:'computer',label:'Computer'},{code:'shelves',label:'Storage'},
   {code:'printer',label:'Printer'},{code:'plant',label:'Decorative plant'},
  ]},
 {roomType:'restaurant',name:'Dining room',description:'Dining tables, chairs and warm interior accents',
  pieces:[
   {code:'table',label:'Dining table'},{code:'chair',label:'Dining chair'},
   {code:'chair',label:'Second dining chair'},{code:'lamp',label:'Lamp'},
   {code:'plant',label:'Plant'},
  ]},
 {roomType:'kitchen',name:'Professional kitchen',description:'Cooking, preparation, cooling and wash-up equipment',
  pieces:[
   {code:'oven',label:'Oven'},{code:'fridge',label:'Fridge'},
   {code:'sink',label:'Kitchen sink'},{code:'prep',label:'Preparation table'},
   {code:'shelves',label:'Storage shelves'},
  ]},
];
export const COLLECTION_STYLES:readonly FurnitureStyle[]=[
 'modern','mediterranean','scandinavian','luxury','industrial','classic',
];
const FURNISHING_MODELS=buildFurnitureCatalogue(furniture);
const MODEL_BY_ID=new Map(FURNISHING_MODELS.map(m=>[m.id,m]));
const FINISH_BY_STYLE:Readonly<Record<FurnitureStyle,FurnitureFinish>>={
 modern:'charcoal',mediterranean:'oak',scandinavian:'ivory',
 luxury:'marble',industrial:'walnut',classic:'walnut',
};
const TIER_BY_STYLE:Readonly<Record<FurnitureStyle,FurnitureTier>>={
 modern:'essential',mediterranean:'signature',scandinavian:'essential',
 luxury:'premium',industrial:'signature',classic:'signature',
};
export const furnitureCollectionFor=(roomType:RoomType):RoomCollection|null=>
 ROOM_COLLECTIONS.find(c=>c.roomType===roomType)??null;
export type CuratedPiece={
 code:FurnitureCode;label:string;model:FurnitureProduct;finish:FurnitureFinish;
};
export function curatedCollectionPieces(roomType:RoomType,style:FurnitureStyle):CuratedPiece[]{
 const collection=furnitureCollectionFor(roomType);
 if(!collection)throw Error('Choose a furnished guest room, bathroom, lobby, office, restaurant or kitchen.');
 const tier=TIER_BY_STYLE[style],finish=FINISH_BY_STYLE[style];
 return collection.pieces.map(piece=>{
  const model=MODEL_BY_ID.get(piece.code+':'+tier);
  if(!model||!furnitureIsCompatible(model,roomType))
   throw Error('The '+piece.label+' cannot be used in this room.');
  return {...piece,model,finish};
 });
}
const itemInside=(room:Room,item:ObjectPlacement):boolean=>{
 const size=furnitureSize(item);
 return item.x>=room.x&&item.y>=room.y&&
  item.x+size.width<=room.x+room.width&&item.y+size.height<=room.y+room.height;
};
/** Each door must keep its interior entry tile clear. */
export function roomDoorClearance(floor:HotelFloor,room:Room):readonly {x:number;y:number}[]{
 const cells:Array<{x:number;y:number}>=[];
 for(const door of floor.walls){
  if(door.type!=='door')continue;
  if(door.orientation==='h'&&door.x>=room.x&&door.x<room.x+room.width){
   if(door.y===room.y)cells.push({x:door.x,y:room.y});
   if(door.y===room.y+room.height)cells.push({x:door.x,y:room.y+room.height-1});
  }else if(door.orientation==='v'&&door.y>=room.y&&door.y<room.y+room.height){
   if(door.x===room.x)cells.push({x:room.x,y:door.y});
   if(door.x===room.x+room.width)cells.push({x:room.x+room.width-1,y:door.y});
  }
 }
 return cells;
}
const slotTouches=(item:ObjectPlacement,reserved:readonly {x:number;y:number}[]):boolean=>{
 const sz=furnitureSize(item);
 return reserved.some(cell=>cell.x>=item.x&&cell.x<item.x+sz.width&&
  cell.y>=item.y&&cell.y<item.y+sz.height);
};
/** Functional groups avoid duplicating an existing bed, bath or dining booth
 * when filling missing furnishings. Repeated chairs are counted separately.
 */
const functionOf=(code:FurnitureCode):string=>
 (code==='bed'||code==='single-bed'||code==='sofa-bed')?'bed':
 (code==='shower'||code==='bathtub')?'bath':
 (code==='booth'||code==='table')?'table':code;
const anchorFor=(code:FurnitureCode):readonly [number,number]=>{
 if(code==='bed'||code==='shower'||code==='bathtub'||code==='reception'||code==='oven')
  return [.12,.12];
 if(code==='wardrobe'||code==='fridge'||code==='shelves'||code==='television'||code==='mirror')
  return [.86,.1];
 if(code==='desk'||code==='sink'||code==='prep'||code==='coffee-table')
  return [.7,.75];
 if(code==='toilet'||code==='chair'||code==='armchair'||code==='office-chair')
  return [.1,.8];
 if(code==='lamp'||code==='plant'||code==='towel-rack')return [.88,.86];
 return [.5,.52];
};
export type CollectionPlan={
 roomId:string;style:FurnitureStyle;mode:CollectionMode;
 added:readonly ObjectPlacement[];removed:readonly ObjectPlacement[];
 floor:HotelFloor;furnitureCents:number;
 requested:number;keptExisting:number;
};
/** Returns the complete preview or throws without changing any arguments.
 * The same planner powers the confirmation preview and the actual commit.
 */
export function planRoomFurnitureCollection(
 floor:HotelFloor,site:HotelSite,roomId:string,
 style:FurnitureStyle,mode:CollectionMode,
 idFactory:(index:number)=>string=(i)=>'collection-preview-'+i,
):CollectionPlan{
 const room=floor.rooms.find(r=>r.id===roomId);
 if(!room)throw Error('Select an existing room before choosing a furniture collection.');
 const recipe=curatedCollectionPieces(room.type,style);
 if(mode!=='fill'&&mode!=='replace')throw Error('Choose to fill missing furniture or replace the selected room furnishings.');
 const removed=mode==='replace'?floor.objects.filter(item=>itemInside(room,item)):[];
 const preserved=mode==='replace'?floor.objects.filter(item=>!itemInside(room,item)):floor.objects;
 const originalWithin=mode==='fill'?floor.objects.filter(item=>itemInside(room,item)):[];
 const available=new Map<string,number>();
 for(const item of originalWithin){
  const category=functionOf(item.code);
  available.set(category,(available.get(category)??0)+1);
 }
 const requested:CuratedPiece[]=[];
 let keptExisting=0;
 for(const piece of recipe){
  const category=functionOf(piece.code);
  const count=available.get(category)??0;
  if(count>0){available.set(category,count-1);keptExisting++;continue;}
  requested.push(piece);
 }
 // Largest items first, with theme-specific wall and corner preferences.
 const sorted=requested.map((piece,index)=>({piece,index})).sort((a,b)=>{
  const area=(value:CuratedPiece)=>value.model.width*value.model.height;
  return area(b.piece)-area(a.piece)||a.index-b.index;
 });
 const doorCells=roomDoorClearance(floor,room);
 const placements:ObjectPlacement[]=[];
 let planned:HotelFloor={...floor,objects:preserved};
 let cost=0;
 for(const {piece,index} of sorted){
  const anchor=anchorFor(piece.code),candidates:Array<{x:number;y:number;rotated:boolean;priority:number}>=[];
  for(const rotated of [false,true]){
   if(rotated&&piece.model.width===piece.model.height)continue;
   const w=rotated?piece.model.height:piece.model.width;
   const h=rotated?piece.model.width:piece.model.height;
   for(let y=room.y;y<=room.y+room.height-h;y++)
    for(let x=room.x;x<=room.x+room.width-w;x++){
     const dx=(x+w/2-(room.x+anchor[0]*room.width))/Math.max(1,room.width);
     const dy=(y+h/2-(room.y+anchor[1]*room.height))/Math.max(1,room.height);
     candidates.push({x,y,rotated,priority:dx*dx+dy*dy+
      (rotated?.05:0)+((x-room.x)+(y-room.y))*.00001});
    }
  }
  candidates.sort((a,b)=>a.priority-b.priority);
  let placed:ObjectPlacement|null=null;
  for(const c of candidates){
   const object:ObjectPlacement={
    id:idFactory(index),code:piece.code,modelId:piece.model.id,
    designStyle:style,finish:piece.finish,x:c.x,y:c.y,rotated:c.rotated,
   };
   if(slotTouches(object,doorCells))continue;
   try{
    planned=placeFurniture(planned,object,site);
    placed=object;break;
   }catch{/* Try the next available location. No partial construction mutation. */}
  }
  if(!placed)throw Error(
   'The '+piece.model.name+' cannot fit in '+room.name+' without overlapping furnishings or blocking a doorway. '+
   'Try a larger room, a less bulky style, or Replace existing furniture.'
  );
  placements.push(placed);
  cost+=piece.model.priceCents;
 }
 return {roomId,style,mode,floor:planned,added:placements,removed,
  requested:recipe.length,keptExisting,furnitureCents:cost};
}
