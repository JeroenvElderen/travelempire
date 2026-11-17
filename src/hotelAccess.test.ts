import {describe,it,expect} from 'vitest';
import {
 newHotelSite,drawRoom,placeFurniture,toggleWall,constructionQuote,updateFloor,
 type HotelSite,type HotelFloor,type Wall,
} from './internalConstruction';
import {
 accessDoorPair,hotelAccessDoorValid,toggleHotelAccessDoor,
 suggestRoomAccessDoor,analyzeHotelFloorAccess,
} from './hotelAccess';
import {roomInventory,openingIssues,defaultHotelOperations} from './hotelOperations';

const hour=456000;
const door=(id:string,x:number,y:number,orientation:'h'|'v'='v'):Wall=>
 ({id,x,y,orientation,type:'door'});
function baseline(){
 const site=newHotelSite('new-hotel','New hotel','new',37.98,23.72,hour);
 let floor=site.draft[0];
 floor=drawRoom(floor,{id:'lobby',name:'Reception',type:'lobby',x:0,y:2,width:4,height:4},site);
 floor=drawRoom(floor,{id:'hall',name:'Main corridor',type:'corridor',x:4,y:3,width:4,height:2},site);
 floor=drawRoom(floor,{id:'guest',name:'Room 101',type:'guest',x:8,y:2,width:5,height:4},site);
 floor=drawRoom(floor,{id:'bath',name:'Bathroom',type:'bathroom',x:13,y:2,width:3,height:3},site);
 floor=placeFurniture(floor,{id:'reception',code:'reception',x:0,y:2,rotated:false},site);
 floor=placeFurniture(floor,{id:'bed',code:'bed',x:9,y:2,rotated:false},site);
 floor=placeFurniture(floor,{id:'toilet',code:'toilet',x:13,y:2,rotated:false},site);
 floor=placeFurniture(floor,{id:'sink',code:'sink',x:14,y:2,rotated:false},site);
 floor=placeFurniture(floor,{id:'shower',code:'shower',x:15,y:2,rotated:false},site);
 return {site,floor};
}
function connected(floor:HotelFloor,site:HotelSite):HotelFloor{
 const entry=toggleHotelAccessDoor(floor,site,door('entry',0,3));
 const reception=toggleHotelAccessDoor(entry,site,door('lobby-hall',4,3));
 return toggleHotelAccessDoor(reception,site,door('guest-hall',8,4));
}
function withStock(site:HotelSite,roomFloor:HotelFloor){
 return {...site,accessRulesVersion:1 as const,built:[roomFloor],
  operations:{...defaultHotelOperations(hour),staff:{
   reception:1,housekeeping:1,kitchen:0,bar:0,
  }},
  stock:{linen:[{id:'linen-1',quantity:10,expiresHour:hour+500}],
   cleaner:[{id:'cleaner-1',quantity:10,expiresHour:hour+500}]},
 };
}
describe('Hotel Architecture Phase 1 — functional door and corridor connectivity',()=>{
 it('refuses decorative doors inside a room, outside the grid and opening into empty plot',()=>{
  const {site,floor}=baseline();
  expect(hotelAccessDoorValid(floor,site,door('inner',1,3,'h'))).toBe(false);
  expect(hotelAccessDoorValid(floor,site,door('no-corridor',8,2))).toBe(false);
  expect(hotelAccessDoorValid(floor,site,door('too-far',25,3))).toBe(false);
  expect(()=>toggleHotelAccessDoor(floor,site,door('bad',1,3,'h'))).toThrow('Place a 1 m doorway');
  expect(floor.walls).toHaveLength(0);
 });
 it('only accepts outside doors onto the plot edge of lobby or corridor',()=>{
  const {site,floor}=baseline();
  expect(hotelAccessDoorValid(floor,site,door('entry',0,3))).toBe(true);
  expect(hotelAccessDoorValid(floor,site,door('reception-link',4,3))).toBe(true);
  expect(hotelAccessDoorValid(floor,site,door('guest-link',8,4))).toBe(true);
  expect(accessDoorPair(floor,site,door('entry',0,3)).exterior).toBe(true);
  expect(accessDoorPair(floor,site,door('guest-link',8,4)).first?.id).toBe('hall');
  expect(accessDoorPair(floor,site,door('guest-link',8,4)).second?.id).toBe('guest');
 });
 it('only a fully connected exterior entrance / reception / hall / guest path counts',()=>{
  const {site,floor}=baseline();
  const initial=analyzeHotelFloorAccess(floor,site,0);
  expect(initial.connectedGuests).toBe(0);
  expect(initial.guests[0].status).toBe('missing-door');
  const afterEntry=toggleHotelAccessDoor(floor,site,door('entry',0,3));
  expect(analyzeHotelFloorAccess(afterEntry,site,0).guests[0].status).toBe('missing-door');
  const afterHall=toggleHotelAccessDoor(afterEntry,site,door('lobby-hall',4,3));
  expect(analyzeHotelFloorAccess(afterHall,site,0).connectedGuests).toBe(0);
  const done=toggleHotelAccessDoor(afterHall,site,door('guest-hall',8,4));
  const report=analyzeHotelFloorAccess(done,{...site,accessRulesVersion:1},0);
  expect(report.connectedGuests).toBe(1);
  expect(report.receptionConnected).toBe(true);
  expect(report.entranceDoors).toBe(1);
  expect(report.guests[0]).toMatchObject({status:'connected',doorCount:1});
  expect(report.reachableRoomIds).toContain('hall');
  expect(report.reachableRoomIds).toContain('lobby');
 });
 it('rejects unconnected corridors even if their independent entrance exists',()=>{
  const {site,floor}=baseline();
  let layout=connected(floor,site);
  layout=drawRoom(layout,{id:'side-hall',name:'Remote corridor',type:'corridor',
   x:0,y:9,width:4,height:2},site);
  layout=drawRoom(layout,{id:'isolated-guest',name:'Room 102',type:'guest',
   x:4,y:8,width:4,height:3},site);
  layout=toggleHotelAccessDoor(layout,site,door('side-entry',0,9));
  layout=toggleHotelAccessDoor(layout,site,door('side-room',4,9));
  const report=analyzeHotelFloorAccess(layout,site,0);
  expect(report.entranceDoors).toBe(2);
  expect(report.receptionConnected).toBe(true);
  expect(report.guests.find(g=>g.roomId==='guest')?.status).toBe('connected');
  expect(report.guests.find(g=>g.roomId==='isolated-guest')?.status).toBe('disconnected');
 });
 it('furniture can block a doorway and make the room inaccessible',()=>{
  const {site,floor}=baseline();
  const ready=connected(floor,site);
  const blocked=placeFurniture(ready,{id:'blocked-by-lamp',code:'lamp',
   x:7,y:4,rotated:false},site);
  expect(hotelAccessDoorValid(blocked,site,door('guest-hall',8,4))).toBe(false);
  expect(analyzeHotelFloorAccess(blocked,site,0).connectedGuests).toBe(0);
  expect(()=>toggleHotelAccessDoor(blocked,site,door('another',8,4))).not.toThrow();
  // The existing marked doorway can be removed even when furniture blocks it.
  expect(toggleHotelAccessDoor(blocked,site,door('another',8,4)).walls).toHaveLength(2);
 });
 it('uses existing toggle and construction quotes for door additions and removal',()=>{
  const {site,floor}=baseline();
  const all=connected(floor,site);
  const wall=toggleWall(floor,{...door('wall',4,3),type:'wall'},site);
  const opened=toggleHotelAccessDoor(wall,site,door('opened',4,3));
  expect(opened.walls[0].type).toBe('door');
  expect(toggleHotelAccessDoor(opened,site,door('again',4,3)).walls).toHaveLength(0);
  const draft=updateFloor(site,0,()=>all);
  expect(constructionQuote(draft,'contractor',0).changes).toBeGreaterThan(0);
  expect(constructionQuote(draft,'contractor',0).materialCents).toBeGreaterThan(0);
 });
 it('offers valid one-tap doorway suggestions along real room boundaries',()=>{
  const {site,floor}=baseline();
  const lobby=suggestRoomAccessDoor(floor,site,'lobby');
  expect(lobby).not.toBeNull();
  expect(hotelAccessDoorValid(floor,site,lobby!)).toBe(true);
  expect(accessDoorPair(floor,site,lobby!).exterior).toBe(true);
  const guest=suggestRoomAccessDoor(floor,site,'guest');
  expect(guest).not.toBeNull();
  const pair=accessDoorPair(floor,site,guest!);
  expect(pair.first?.type==='corridor'||pair.second?.type==='corridor').toBe(true);
  expect(suggestRoomAccessDoor(floor,site,'unknown')).toBeNull();
 });
 it('enforces readiness on opted-in new plots, not on legacy saved hotels',()=>{
  const {site,floor}=baseline();
  const oldSite=withStock(site,floor);
  const legacy={...oldSite,accessRulesVersion:undefined};
  expect(roomInventory(legacy,hour).readyRooms).toHaveLength(1);
  expect(openingIssues(legacy,hour)).toEqual([]);
  expect(roomInventory(oldSite,hour).readyRooms).toHaveLength(0);
  expect(openingIssues(oldSite,hour).some(e=>e.includes('entrance'))).toBe(true);
  const built=withStock(site,connected(floor,site));
  expect(roomInventory(built,hour).readyRooms).toHaveLength(1);
  expect(openingIssues(built,hour)).toEqual([]);
 });
 it('does not unlock a furnished guest room if the lobby cannot reach the main door',()=>{
  const {site,floor}=baseline();
  let partial=toggleHotelAccessDoor(floor,site,door('guest-hall',8,4));
  partial=toggleHotelAccessDoor(partial,site,door('lobby-hall',4,3));
  const report=analyzeHotelFloorAccess(partial,site,0);
  expect(report.guests[0].status).toBe('no-entry');
  expect(roomInventory(withStock(site,partial),hour).readyRooms).toHaveLength(0);
 });
 it('does not invent staircases or restrict upper floors before Phase 2',()=>{
  const {site,floor}=baseline();
  const upstairs=analyzeHotelFloorAccess(floor,site,1);
  expect(upstairs.guests[0].status).toBe('upper-floor-pending');
  expect(upstairs.pendingUpperGuests).toBe(1);
  expect(upstairs.warnings.some(w=>w.includes('Phase 2'))).toBe(true);
 });
});
