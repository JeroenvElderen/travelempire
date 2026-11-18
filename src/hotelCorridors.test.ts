import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
 newHotelSite,drawRoom,placeFurniture,updateFloor,constructionQuote,
 type Room,type HotelSite,type HotelFloor,
} from './internalConstruction';
import {
 drawCorridorSection,joinAdjacentCorridors,removeLastCorridorSection,
 corridorSectionCount,
} from './hotelCorridors';
import {
 roomSections,roomArea,roomPerimeter,containsRoomCell,containsRoomRect,
 roomsOverlap,roomBoundaryEdges,roomOutlinePath,roomShapeEqual,
 roomCenterCell,
} from './hotelRoomGeometry';
import {toggleHotelAccessDoor,accessDoorPair,hotelAccessDoorValid,suggestRoomAccessDoor} from './hotelAccess';
import {analyzeHotelFloorAccess} from './hotelAccess';
import {ArchitecturalRooms} from './components/HotelArchitecturalPlan';
import {buildIsoScene} from './hotelVisualisation';
import HotelIsometricPreview from './components/HotelIsometricPreview';
const newSite=(width=24,height=16)=>newHotelSite(
 'corridor-hotel','Shaped corridors','new',37.98,23.72,100,undefined,{width,height},
);
const part=(x:number,y:number,width:number,height:number)=>({x,y,width,height});
const room=(id:string,type:Room['type'],x:number,y:number,width:number,height:number):Room=>({
 id,type,name:id,x,y,width,height,
});
const paint=(floor:HotelFloor,site:HotelSite,s:{x:number;y:number;width:number;height:number},
 id='new',label='Corridor')=>drawCorridorSection(floor,site,s,id,label);
describe('One connected corridor rather than multiple rectangular rooms',()=>{
 it('draws an L-shaped hallway with one identity, exact area and no phantom filled corner',()=>{
  const site=newSite();
  let floor=paint(site.draft[0],site,part(0,0,3,8),'hall','My hallway');
  floor=paint(floor,site,part(0,6,12,2));
  expect(floor.rooms).toHaveLength(1);
  const hall=floor.rooms[0];
  expect(hall.id).toBe('hall');
  expect(hall.name).toBe('My hallway');
  expect(hall.type).toBe('corridor');
  expect(hall.sections).toHaveLength(2);
  expect(roomArea(hall)).toBe(3*8+12*2-3*2);
  expect(hall).toMatchObject({x:0,y:0,width:12,height:8});
  expect(containsRoomCell(hall,9,1)).toBe(false);
  expect(containsRoomCell(hall,9,6)).toBe(true);
  expect(containsRoomRect(hall,part(3,0,1,1))).toBe(false);
  expect(roomPerimeter(hall)).toBeGreaterThan(20);
  expect(roomOutlinePath(hall)).toContain('M ');
 });
 it('joins the vertical and horizontal legs of a T while preserving one label',()=>{
  const site=newSite();
  let floor=paint(site.draft[0],site,part(5,0,2,12),'hall','Corridor A');
  floor=paint(floor,site,part(1,7,12,2));
  expect(floor.rooms).toHaveLength(1);
  expect(corridorSectionCount(floor.rooms[0])).toBe(2);
  expect(containsRoomCell(floor.rooms[0],1,7)).toBe(true);
  expect(containsRoomCell(floor.rooms[0],12,8)).toBe(true);
  expect(containsRoomCell(floor.rooms[0],12,1)).toBe(false);
 });
 it('allows a U-shaped route and prevents occupying its hollow centre',()=>{
  const site=newSite();
  let floor=paint(site.draft[0],site,part(1,1,2,10),'hall','Corridor A');
  floor=paint(floor,site,part(9,1,2,10));
  // The separated right leg initially remains a different logical room.
  expect(floor.rooms).toHaveLength(2);
  floor=paint(floor,site,part(1,9,10,2));
  expect(floor.rooms).toHaveLength(1);
  expect(containsRoomCell(floor.rooms[0],5,5)).toBe(false);
  expect(containsRoomCell(floor.rooms[0],5,10)).toBe(true);
  expect(roomArea(floor.rooms[0])).toBe(2*10*2+10*2-2*2*2);
 });
 it('joins existing touching corridors in one click',()=>{
  const site=newSite();
  let floor=drawRoom(site.draft[0],room('left','corridor',1,1,2,9),site);
  floor=drawRoom(floor,room('bridge','corridor',3,7,9,2),site);
  floor=drawRoom(floor,room('right','corridor',12,1,2,9),site);
  const merged=joinAdjacentCorridors(floor,site,'left');
  expect(merged.rooms).toHaveLength(1);
  expect(merged.rooms[0].id).toBe('left');
  expect(merged.rooms[0].sections).toHaveLength(4);
  expect(roomArea(merged.rooms[0])).toBe(2*9*2+9*2);
  expect(floor.rooms).toHaveLength(3);
 });
 it('automatically merges an existing disconnected pair when a bridge is drawn',()=>{
  const site=newSite();
  let floor=drawRoom(site.draft[0],room('left','corridor',1,1,2,9),site);
  floor=drawRoom(floor,room('right','corridor',12,1,2,9),site);
  floor=paint(floor,site,part(3,7,9,2));
  expect(floor.rooms).toHaveLength(1);
  expect(roomArea(floor.rooms[0])).toBe(2*9*2+9*2);
 });
 it('keeps diagonal-only corridors separate rather than inventing a connection',()=>{
  const site=newSite();
  let floor=paint(site.draft[0],site,part(1,1,2,2),'first','First');
  floor=paint(floor,site,part(3,3,2,2),'second','Second');
  expect(floor.rooms).toHaveLength(2);
  expect(()=>joinAdjacentCorridors(floor,site,'first')).toThrow('no directly adjoining');
 });
 it('rejects a bridge through a bedroom or stairwell with no partial save changes',()=>{
  const site=newSite();
  let floor=paint(site.draft[0],site,part(1,1,2,8),'first','First');
  floor=drawRoom(floor,room('bed','guest',3,1,6,8),site);
  const before=JSON.stringify(floor);
  expect(()=>paint(floor,site,part(1,7,11,2))).toThrow('overlap an existing room');
  expect(JSON.stringify(floor)).toBe(before);
 });
 it('rejects connecting through a wall but keeps all original door and wall data',()=>{
  const site=newSite();
  let floor=drawRoom(site.draft[0],room('left','corridor',1,1,2,8),site);
  floor=drawRoom(floor,room('right','corridor',3,1,2,8),site);
  floor={...floor,walls:[{id:'divider',x:3,y:2,orientation:'v',type:'wall'}]};
  expect(()=>joinAdjacentCorridors(floor,site,'left')).toThrow('wall');
  expect(floor.rooms).toHaveLength(2);
  expect(floor.walls).toHaveLength(1);
 });
 it('removes redundant interior door when two corridors are explicitly joined',()=>{
  const site=newSite();
  let floor=drawRoom(site.draft[0],room('left','corridor',1,1,2,8),site);
  floor=drawRoom(floor,room('right','corridor',3,1,2,8),site);
  floor=toggleHotelAccessDoor(floor,site,{id:'passage',type:'door',x:3,y:3,orientation:'v'});
  const merged=joinAdjacentCorridors(floor,site,'left');
  expect(merged.rooms).toHaveLength(1);
  expect(merged.walls).toHaveLength(0);
 });
 it('keeps original corridors in saves readable with no migration',()=>{
  const legacy=room('legacy','corridor',2,2,3,7);
  expect(legacy.sections).toBeUndefined();
  expect(roomSections(legacy)).toEqual([part(2,2,3,7)]);
  expect(roomArea(legacy)).toBe(21);
  expect(roomShapeEqual(legacy,{...legacy})).toBe(true);
  const roundTripped=JSON.parse(JSON.stringify(legacy)) as Room;
  expect(roomCellKeysFor(roundTripped)).toBe(21);
 });
});
const roomCellKeysFor=(r:Room)=>roomArea(r);
describe('Actual hotel navigation and quote consistency',()=>{
 it('allows door placement onto a real corridor section, not a phantom bounding wall',()=>{
  const site=newSite();
  let floor=paint(site.draft[0],site,part(1,1,3,8),'hall');
  floor=paint(floor,site,part(1,7,12,2));
  floor=drawRoom(floor,room('guest','guest',4,1,4,5),site);
  const good={x:4,y:2,orientation:'v' as const};
  expect(hotelAccessDoorValid(floor,site,good)).toBe(true);
  const bad={x:8,y:2,orientation:'v' as const};
  expect(hotelAccessDoorValid(floor,site,bad)).toBe(false);
  const withDoor=toggleHotelAccessDoor(floor,site,{...good,type:'door',id:'entry'});
  expect(accessDoorPair(withDoor,site,good).first?.id).toBe('hall');
  expect(accessDoorPair(withDoor,site,good).second?.id).toBe('guest');
  expect(suggestRoomAccessDoor(withDoor,site,'hall')).not.toBeNull();
 });
 it('room selection and furniture validation never fill empty bounding corners',()=>{
  const site=newSite();
  let floor=paint(site.draft[0],site,part(1,1,3,8),'hall');
  floor=paint(floor,site,part(1,7,12,2));
  const hall=floor.rooms[0];
  expect(roomsOverlap(hall,room('in-hole','guest',6,1,4,4))).toBe(false);
  floor=drawRoom(floor,room('in-hole','guest',6,1,4,4),site);
  expect(floor.rooms).toHaveLength(2);
  expect(()=>placeFurniture(floor,{id:'lamp',code:'lamp',x:11,y:2,rotated:false},site))
   .toThrow('inside a room');
 });
 it('charges only extra corridor floor area when extending an already built passage',()=>{
  const site=newSite(),f=paint(site.draft[0],site,part(1,1,2,8),'hall');
  const built={...site,built:[f],draft:[f]};
  const extension=paint(f,site,part(1,7,9,2));
  const updated=updateFloor(built,0,()=>extension);
  const q=constructionQuote(updated,'contractor',0);
  expect(q.changes).toBe(1);
  expect(q.furnitureCents).toBe(0);
  const area=roomArea(extension.rooms[0])-roomArea(f.rooms[0]);
  expect(area).toBe(16);
  expect(q.materials.find(m=>m.id==='flooring')?.quantity).toBe(area);
  expect(constructionQuote({...updated,built:updated.draft},'contractor',0).changes).toBe(0);
 });
 it('removes the last drawn part without removing unrelated rooms or furniture',()=>{
  const site=newSite();
  let floor=paint(site.draft[0],site,part(1,1,2,8),'hall');
  floor=paint(floor,site,part(1,7,9,2));
  const restored=removeLastCorridorSection(floor,site,'hall');
  expect(restored.rooms).toHaveLength(1);
  expect(roomArea(restored.rooms[0])).toBe(16);
  expect(restored.rooms[0].id).toBe('hall');
  expect(floor.rooms[0].sections).toHaveLength(2);
 });
 it('renders one external outline in the architectural and isometric previews',()=>{
  const site=newSite(),f=paint(site.draft[0],site,part(1,1,3,8),'hall');
  const shaped=paint(f,site,part(1,7,12,2));
  const markup=renderToStaticMarkup(createElement('svg',{},
   createElement(ArchitecturalRooms,{floor:shaped})));
  expect(markup).toContain('Corridor');
  expect(markup).toContain('path');
  expect(markup).toContain('m²');
  expect(markup).not.toContain('Corridor 2');
  const isometric=renderToStaticMarkup(createElement(HotelIsometricPreview,{
   site:{...site,draft:[shaped]},floorIndex:0,onExit:()=>{},
  }));
  expect(isometric).toContain('Isometric building cutaway');
  expect(isometric).toContain('Corridor');
  expect(buildIsoScene({...site,draft:[shaped]},'building',0,0).levels).toHaveLength(1);
 });
 it('room boundaries include every real side of the composite shape',()=>{
  const site=newSite();
  let f=paint(site.draft[0],site,part(1,1,2,8),'hall');
  f=paint(f,site,part(1,7,9,2));
  const edges=roomBoundaryEdges(f.rooms[0]);
  expect(edges.some(e=>e.x===10&&e.y===7&&e.orientation==='v')).toBe(true);
  expect(edges.some(e=>e.x===3&&e.y===2&&e.orientation==='v')).toBe(true);
  expect(roomCenterCell(f.rooms[0])).toBeTruthy();
 });
});
