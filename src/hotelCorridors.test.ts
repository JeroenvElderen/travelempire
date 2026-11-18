import {describe,it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {
 newHotelSite,drawRoom,placeFurniture,roomArea,roomBounds,roomContainsCell,
 roomContainsRect,roomSections,roomBoundaryEdges,roomAtCell,
 constructionQuote,updateFloor,beginConstruction,
 type HotelFloor,type Room,type Wall,
} from './internalConstruction';
import {
 paintHotelCorridor,joinConnectedHotelCorridors,removeHotelCorridorSection,
 corridorTileCount,
} from './hotelCorridors';
import {toggleHotelAccessDoor,accessDoorPair,analyzeHotelFloorAccess} from './hotelAccess';
import {analyzeHotelBuildingAccess} from './hotelVerticalAccess';
import {analyzeHotelSafety} from './hotelSafety';
import {analyzeRoomAtmosphere,toggleHotelLighting} from './hotelAtmosphere';
import {hotelBlueprintHealth} from './hotelBlueprintEditing';
import {planCounts} from './hotelVisualisation';
import {ArchitecturalRooms} from './components/HotelArchitecturalPlan';
import HotelIsometricPreview from './components/HotelIsometricPreview';
const site=()=>newHotelSite('continuous','Corridor hotel','new',37.98,23.72,100);
const corridor=(id:string,x:number,y:number,width:number,height:number):Room=>({
 id,type:'corridor',name:id,x,y,width,height,
});
const room=(id:string,type:Room['type'],x:number,y:number,width:number,height:number):Room=>({
 id,type,name:id,x,y,width,height,
});
const door=(id:string,x:number,y:number,orientation:'h'|'v'='v'):Wall=>({
 id,x,y,orientation,type:'door',
});
function wings(){
 const s=site();
 let f=s.draft[0];
 // This mirrors the uploaded screenshot: two vertical wings, a central
 // horizontal link, stairs and lift shafts above, and guest rooms outside.
 f=drawRoom(f,corridor('Corridor 1',6,0,2,16),s);
 f=drawRoom(f,corridor('Corridor 2',8,3,8,2),s);
 f=drawRoom(f,corridor('Corridor 3',16,0,2,16),s);
 f=drawRoom(f,room('Guest left','guest',0,5,6,5),s);
 f=drawRoom(f,room('Guest right','guest',18,5,6,5),s);
 f=drawRoom(f,room('Reception','lobby',8,5,8,4),s);
 f=drawRoom(f,room('Stairs','stairwell',8,0,2,3),s);
 f=drawRoom(f,room('Lift','elevator',10,0,2,3),s);
 f=placeFurniture(f,{id:'reception',code:'reception',x:9,y:6,rotated:false},s);
 f=placeFurniture(f,{id:'left-bed',code:'bed',x:1,y:6,rotated:false},s);
 f=placeFurniture(f,{id:'right-bed',code:'bed',x:19,y:6,rotated:false},s);
 f=toggleHotelAccessDoor(f,s,door('exterior',6,0,'h'));
 f=toggleHotelAccessDoor(f,s,door('left-guest',6,6));
 f=toggleHotelAccessDoor(f,s,door('right-guest',18,6));
 f=toggleHotelAccessDoor(f,s,door('lobby',11,5,'h'));
 // These two old doors become unnecessary internal corridor partitions.
 f=toggleHotelAccessDoor(f,s,door('join-left',8,4));
 f=toggleHotelAccessDoor(f,s,door('join-right',16,4));
 return {s,f};
}
describe('Continuous corridor geometry — screenshot-inspired hotel',()=>{
 it('joins three adjoining rectangular corridors into one L/T shaped room',()=>{
  const {s,f}=wings(),before=JSON.stringify(f);
  const next=joinConnectedHotelCorridors(f,s);
  expect(JSON.stringify(f)).toBe(before);
  expect(f.rooms.filter(r=>r.type==='corridor')).toHaveLength(3);
  const joined=next.rooms.filter(r=>r.type==='corridor');
  expect(joined).toHaveLength(1);
  expect(joined[0].id).toBe('Corridor 1');
  expect(roomArea(joined[0])).toBe(2*16*2+8*2);
  expect(corridorTileCount(next)).toBe(corridorTileCount(f));
  expect(next.rooms.length).toBe(f.rooms.length-2);
  expect(joined[0].sections?.length).toBeGreaterThan(0);
  expect(roomContainsCell(joined[0],6,15)).toBe(true);
  expect(roomContainsCell(joined[0],12,3)).toBe(true);
  expect(roomContainsCell(joined[0],16,15)).toBe(true);
  expect(roomContainsCell(joined[0],12,8)).toBe(false);
  expect(roomBounds(joined[0])).toEqual({x:6,y:0,width:12,height:16});
  expect(next.objects).toEqual(f.objects);
 });
 it('removes only partitions now inside the same corridor, not guest/lobby doors',()=>{
  const {s,f}=wings(),next=joinConnectedHotelCorridors(f,s);
  expect(next.walls.map(w=>w.id).sort()).toEqual(
   ['exterior','left-guest','right-guest','lobby'].sort());
  expect(accessDoorPair(next,s,door('left-guest',6,6)).second?.id)
   .toBe('Corridor 1');
  expect(accessDoorPair(next,s,door('right-guest',18,6)).first?.id)
   .toBe('Corridor 1');
  expect(next.rooms.some(r=>r.type==='stairwell')).toBe(true);
  expect(next.rooms.some(r=>r.type==='elevator')).toBe(true);
 });
 it('preserves reception and guest connectivity through a joined hallway',()=>{
  const {s,f}=wings();
  const before=analyzeHotelFloorAccess(f,s,0);
  const after=analyzeHotelFloorAccess(joinConnectedHotelCorridors(f,s),s,0);
  expect(before.connectedGuests).toBe(2);
  expect(after.connectedGuests).toBe(2);
  expect(after.receptionConnected).toBe(true);
  expect(after.circulationRooms).toBe(before.circulationRooms-2);
  expect(after.reachableRoomIds).toContain('Corridor 1');
 });
 it('joining existing built corridors does not repurchase their floor area',()=>{
  const {s,f}=wings();
  const joined=joinConnectedHotelCorridors(f,s);
  const quote=constructionQuote({...s,built:[f],draft:[joined]},'contractor',0);
  expect(quote.materialCents).toBe(0);
  expect(quote.furnitureCents).toBe(0);
  expect(quote.workUnits).toBeGreaterThan(0);
  expect(quote.workUnits).toBeLessThan(10);
  expect(quote.changes).toBe(1);
 });
 it('maintains saved state compatibility, correct plot usage and preview geometry',()=>{
  const {s,f}=wings();
  const joined=joinConnectedHotelCorridors(f,s);
  const restored=JSON.parse(JSON.stringify(joined)) as HotelFloor;
  const merged=restored.rooms.find(r=>r.type==='corridor')!;
  expect(roomArea(merged)).toBe(80);
  expect(planCounts(restored).rooms).toBe(f.rooms.length-2);
  expect(hotelBlueprintHealth(restored,s).plannedArea)
   .toBe(hotelBlueprintHealth(f,s).plannedArea);
  expect(renderToStaticMarkup(createElement(ArchitecturalRooms,{floor:restored})))
   .toContain('Corridor 1');
  expect(renderToStaticMarkup(createElement(HotelIsometricPreview,{
   site:{...s,draft:[restored]},floorIndex:0,onExit:()=>{},
  }))).toContain('Isometric building cutaway');
 });
});
describe('Painting connected corridors',()=>{
 it('automatically creates one room for L, T, branches and overlapping paint',()=>{
  const s=site();
  let f=paintHotelCorridor(s.draft[0],s,{x:2,y:2,width:2,height:9},'hall');
  f=paintHotelCorridor(f,s,{x:4,y:5,width:8,height:2},'unused');
  f=paintHotelCorridor(f,s,{x:10,y:7,width:2,height:5},'unused');
  expect(f.rooms).toHaveLength(1);
  expect(f.rooms[0].id).toBe('hall');
  expect(roomArea(f.rooms[0])).toBe(2*9+8*2+2*5);
  expect(roomContainsCell(f.rooms[0],11,11)).toBe(true);
  expect(roomContainsCell(f.rooms[0],8,4)).toBe(false);
  expect(roomBoundaryEdges(f.rooms[0]).length).toBeGreaterThan(30);
  expect(roomAtCell(f,11,11)?.id).toBe('hall');
  f=paintHotelCorridor(f,s,{x:3,y:5,width:11,height:2},'unused');
  expect(f.rooms).toHaveLength(1);
  expect(roomArea(f.rooms[0])).toBe(2*9+8*2+2*5+4);
  expect(()=>paintHotelCorridor(f,s,{x:2,y:2,width:2,height:2},'unused'))
   .toThrow('already part of a corridor');
 });
 it('does not connect diagonally touching corridor islands',()=>{
  const s=site();
  let f=drawRoom(s.draft[0],corridor('a',2,2,2,2),s);
  f=drawRoom(f,corridor('b',4,4,2,2),s);
  expect(joinConnectedHotelCorridors(f,s).rooms).toHaveLength(2);
  f=paintHotelCorridor(f,s,{x:4,y:2,width:2,height:2},'bridge');
  expect(f.rooms).toHaveLength(1);
  expect(roomArea(f.rooms[0])).toBe(12);
 });
 it('rejects drawing through a bedroom or beyond the plot atomically',()=>{
  const s=site();
  let f=paintHotelCorridor(s.draft[0],s,{x:2,y:2,width:2,height:5},'hall');
  f=drawRoom(f,room('guest','guest',5,3,4,4),s);
  const before=JSON.stringify(f);
  expect(()=>paintHotelCorridor(f,s,{x:4,y:4,width:4,height:2},'bad'))
   .toThrow('overlaps another room');
  expect(()=>paintHotelCorridor(f,s,{x:23,y:0,width:3,height:2},'bad'))
   .toThrow('inside your plot');
  expect(()=>paintHotelCorridor(f,s,{x:3,y:2,width:1,height:5},'bad'))
   .toThrow('at least 2');
  expect(JSON.stringify(f)).toBe(before);
 });
 it('does not create phantom doors or walkable rooms in empty plot cells',()=>{
  const s=site();
  const f=paintHotelCorridor(s.draft[0],s,{x:3,y:3,width:2,height:4},'hall');
  expect(roomContainsRect(f.rooms[0],{x:3,y:3,width:2,height:4})).toBe(true);
  expect(roomContainsRect(f.rooms[0],{x:3,y:3,width:3,height:4})).toBe(false);
  expect(f.walls).toHaveLength(0);
  expect(analyzeHotelBuildingAccess([f],s).floors[0].entranceDoors).toBe(0);
  expect(analyzeHotelSafety([f],s).totalGuestRooms).toBe(0);
 });
 it('respects project edit locks through the existing updateFloor workflow',()=>{
  const s=site();
  const f=paintHotelCorridor(s.draft[0],s,{x:2,y:2,width:2,height:5},'hall');
  const edited=updateFloor(s,0,()=>f);
  const started=beginConstruction(edited,'contractor',0,101,'project');
  expect(()=>updateFloor(started.site,0,old=>paintHotelCorridor(
   old,s,{x:4,y:2,width:2,height:3},'extension'))).toThrow('Finish');
 });
 it('prices only newly added corridor floor tiles when extending a built hallway',()=>{
  const s=site();
  const built=paintHotelCorridor(s.draft[0],s,{x:2,y:2,width:2,height:6},'hall');
  const draft=paintHotelCorridor(built,s,{x:4,y:4,width:5,height:2},'extra');
  const quote=constructionQuote({...s,built:[built],draft:[draft]},'contractor',0);
  expect(quote.materials.find(m=>m.id==='flooring')?.quantity).toBe(10);
  expect(quote.totalCents).toBeGreaterThan(0);
 });
});
describe('Editing irregular corridor sections safely',()=>{
 it('removes a leaf section without deleting the entire corridor',()=>{
  const s=site();
  let f=paintHotelCorridor(s.draft[0],s,{x:2,y:2,width:2,height:8},'hall');
  f=paintHotelCorridor(f,s,{x:4,y:5,width:6,height:2},'branch');
  const before=roomArea(f.rooms[0]);
  const parts=roomSections(f.rooms[0]);
  const index=parts.findIndex(p=>p.x===4&&p.width===6);
  expect(index).toBeGreaterThanOrEqual(0);
  const next=removeHotelCorridorSection(f,s,'hall',index);
  expect(next.rooms).toHaveLength(1);
  expect(roomArea(next.rooms[0])).toBe(before-12);
  expect(roomContainsCell(next.rooms[0],3,8)).toBe(true);
  expect(roomContainsCell(next.rooms[0],8,5)).toBe(false);
 });
 it('refuses removing a bridge that disconnects corridor branches',()=>{
  const s=site();
  let f=paintHotelCorridor(s.draft[0],s,{x:2,y:2,width:2,height:8},'hall');
  f=paintHotelCorridor(f,s,{x:4,y:5,width:6,height:2},'bridge');
  f=paintHotelCorridor(f,s,{x:10,y:2,width:2,height:8},'right');
  const bridgeIndex=roomSections(f.rooms[0]).findIndex(p=>p.x===4&&p.width===6);
  expect(bridgeIndex).toBeGreaterThanOrEqual(0);
  expect(()=>removeHotelCorridorSection(f,s,'hall',bridgeIndex)).toThrow('connected');
 });
 it('preserves fixtures and attached doorways instead of silently orphaning them',()=>{
  const s=site();
  let f=paintHotelCorridor(s.draft[0],s,{x:2,y:2,width:2,height:8},'hall');
  f=paintHotelCorridor(f,s,{x:4,y:5,width:6,height:2},'branch');
  const index=roomSections(f.rooms[0]).findIndex(p=>p.x===4&&p.width===6);
  f=toggleHotelLighting(f,s,{id:'ceiling',kind:'ceiling',x:7,y:5});
  expect(analyzeRoomAtmosphere(f,f.rooms[0],s).artificialLight).toBeGreaterThan(0);
  expect(()=>removeHotelCorridorSection(f,s,'hall',index)).toThrow('Move furnishings');
  const withWall={...f,lights:[],walls:[door('corridor-edge',7,5,'h')]};
  expect(()=>removeHotelCorridorSection(withWall,s,'hall',index)).toThrow('Remove attached');
 });
 it('rejects overlapping or disconnected manually corrupted corridor sections',()=>{
  const s=site();
  const invalid=corridor('hall',2,2,2,4);
  expect(()=>drawRoom(s.draft[0],{...invalid,sections:[
   {x:3,y:3,width:2,height:3},
  ]},s)).toThrow('overlap');
  expect(()=>drawRoom(s.draft[0],{...invalid,sections:[
   {x:10,y:10,width:2,height:2},
  ]},s)).toThrow('connected');
 });
});
