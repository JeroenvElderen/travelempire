/** Read-only hotel architectural visualisation helpers.
 * This module changes NO simulation, blueprints, construction prices or
 * eligibility. All coordinates derive from existing 1 m floor-plan data.
 * Pure math only: no WebGL context, map tiles, image textures, or timers.
 */
import type {HotelFloor,HotelSite,Room,RoomType,Wall,ObjectPlacement} from './internalConstruction';

export type IsoAngle=0|1|2|3;
export type IsoScope='floor'|'building';
export type IsoPoint={x:number;y:number};
export type IsoLevel={index:number;floor:HotelFloor;z:number};
export type IsoScene={
 levels:IsoLevel[];viewBox:string;
 primitiveCount:number;detailed:boolean;truncated:boolean;
};
export const MAX_PREVIEW_PRIMITIVES=900;
export const MAX_PREVIEW_ROOMS=350;
export const ISO_COLORS:Readonly<Record<RoomType,string>>={
 guest:'#7198bd',bathroom:'#81b8bf',kitchen:'#a68ba9',
 restaurant:'#c5a377',bar:'#bb91ad',lobby:'#8bbcb1',
 storage:'#8a9baa',staff:'#8b9bad',corridor:'#9daabc',
 office:'#9aafd0',meeting:'#b4accd',
 stairwell:'#71baa5',elevator:'#80b5d9',
};
export const roomShortLabel=(room:Room):string=>
 room.type==='stairwell'?'STAIRS':room.type==='elevator'?'LIFT':room.name.length>20?
 room.name.slice(0,19)+'…':room.name;
/** Rotation around the purchased plot, NOT modifications to saved room data. */
export function isoRotate(
 x:number,y:number,width:number,height:number,angle:IsoAngle,
):IsoPoint{
 switch(angle){
 case 0:return {x,y};
 case 1:return {x:height-y,y:x};
 case 2:return {x:width-x,y:height-y};
 case 3:return {x:y,y:width-x};
 }
}
/** Local SVG isometric projection; slab elevation is a visual separation. */
export function isoProject(
 x:number,y:number,z:number,width:number,height:number,angle:IsoAngle,
):IsoPoint{
 const v=isoRotate(x,y,width,height,angle);
 return {x:(v.x-v.y)*9,y:(v.x+v.y)*4.7-z};
}
export function isoCorners(
 x:number,y:number,w:number,h:number,z:number,
 plotWidth:number,plotHeight:number,angle:IsoAngle,
):[IsoPoint,IsoPoint,IsoPoint,IsoPoint]{
 return [
  isoProject(x,y,z,plotWidth,plotHeight,angle),
  isoProject(x+w,y,z,plotWidth,plotHeight,angle),
  isoProject(x+w,y+h,z,plotWidth,plotHeight,angle),
  isoProject(x,y+h,z,plotWidth,plotHeight,angle),
 ];
}
export const pointString=(points:readonly IsoPoint[]):string=>
 points.map(p=>p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
export function roomContains(room:Room,item:Pick<ObjectPlacement,'x'|'y'>):boolean{
 return item.x>=room.x&&item.y>=room.y&&
 item.x<room.x+room.width&&item.y<room.y+room.height;
}
export function wallSegment(
 wall:Pick<Wall,'x'|'y'|'orientation'>,
):{start:IsoPoint;end:IsoPoint}{
 return wall.orientation==='h'?
  {start:{x:wall.x,y:wall.y},end:{x:wall.x+1,y:wall.y}}:
  {start:{x:wall.x,y:wall.y},end:{x:wall.x,y:wall.y+1}};
}
/** A visible preview is scoped and complexity-capped for mobile Safari.
 * On large blueprints, preserve every floor slab but cap room geometry;
 * never silently alter the saved floor or apply an arbitrary construction cap.
 */
export function buildIsoScene(
 site:HotelSite,scope:IsoScope,selectedFloor:number,angle:IsoAngle,
):IsoScene{
 const floors=scope==='floor'?site.draft.map((floor,index)=>({floor,index}))
  .filter(({index})=>index===selectedFloor):
  site.draft.map((floor,index)=>({floor,index}));
 const raw=floors.reduce((n,{floor})=>n+
  floor.rooms.length*3+floor.objects.length*2+floor.walls.length+
  (floor.lights?.length??0)+(floor.safetyFixtures?.length??0),0);
 const roomCount=floors.reduce((n,{floor})=>n+floor.rooms.length,0);
 const detailed=raw<=MAX_PREVIEW_PRIMITIVES&&roomCount<=MAX_PREVIEW_ROOMS;
 const levels=floors.map(({floor,index})=>({
  index,
  floor:detailed?floor:{
   ...floor,
   // The simplified overview contains only shell geometry.
   rooms:floor.rooms.slice(0,MAX_PREVIEW_ROOMS),
   objects:[],walls:[],lights:[],safetyFixtures:[],
  },
  z:index*24,
 }));
 const cornerCoordinates:IsoPoint[]=[];
 const top=Math.max(0,...levels.map(l=>l.z));
 for(const z of [0,top+10]){
  for(const [x,y] of [[0,0],[site.width,0],[site.width,site.height],[0,site.height]])
   cornerCoordinates.push(isoProject(x,y,z,site.width,site.height,angle));
 }
 const x0=Math.min(...cornerCoordinates.map(p=>p.x))-30;
 const y0=Math.min(...cornerCoordinates.map(p=>p.y))-30;
 const x1=Math.max(...cornerCoordinates.map(p=>p.x))+30;
 const y1=Math.max(...cornerCoordinates.map(p=>p.y))+30;
 return {levels,viewBox:[x0,y0,x1-x0,y1-y0].map(v=>v.toFixed(1)).join(' '),
  primitiveCount:raw,detailed,truncated:!detailed&&roomCount>MAX_PREVIEW_ROOMS};
}
export type PlanCounts={rooms:number;furniture:number;windows:number;doors:number;
 stairs:number;lifts:number;safety:number;lighting:number;};
export function planCounts(floor:HotelFloor):PlanCounts{
 return {rooms:floor.rooms.length,furniture:floor.objects.length,
  doors:floor.walls.filter(w=>w.type==='door').length,
  windows:floor.walls.filter(w=>w.type==='window'||w.type==='panoramic-window').length,
  stairs:floor.rooms.filter(r=>r.type==='stairwell').length,
  lifts:floor.rooms.filter(r=>r.type==='elevator').length,
  safety:floor.safetyFixtures?.length??0,lighting:floor.lights?.length??0};
}
