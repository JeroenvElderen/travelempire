import {describe,it,expect} from 'vitest';
import {
 newHotelSite,drawRoom,placeFurniture,addFloor,constructionQuote,updateFloor,
 type HotelSite,type Room,type Wall,
} from './internalConstruction';
import {toggleHotelAccessDoor} from './hotelAccess';
import {
 VERTICAL_CORES,addVerticalCore,analyzeHotelBuildingAccess,
 hotelVerticalCongestionModifier,
} from './hotelVerticalAccess';
import {roomInventory,openingIssues,defaultHotelOperations} from './hotelOperations';

const HOUR=456000;
const door=(id:string,x:number,y:number,orientation:'v'|'h'='v'):Wall=>({
 id,type:'door',x,y,orientation,
});
const room=(id:string,type:Room['type'],x:number,y:number,width:number,height:number):Room=>({
 id,type,x,y,width,height,name:id,
});
function hotel(){
 const site:HotelSite={...newHotelSite('vertical-hotel','Hotel', 'new',37.98,23.72,HOUR),
  accessRulesVersion:2};
 let ground=site.draft[0];
 ground=drawRoom(ground,room('lobby','lobby',0,2,4,4),site);
 ground=drawRoom(ground,room('hall-ground','corridor',4,3,4,2),site);
 ground=drawRoom(ground,room('stairs-ground','stairwell',8,2,2,3),site);
 ground=placeFurniture(ground,{id:'reception',code:'reception',x:0,y:2,rotated:false},site);
 let upper={...site,draft:[ground]};
 upper=addFloor(upper);
 let first=upper.draft[1];
 first=drawRoom(first,room('stairs-first','stairwell',8,2,2,3),site);
 first=drawRoom(first,room('hall-first','corridor',10,3,3,2),site);
 first=drawRoom(first,room('guest-first','guest',13,2,4,4),site);
 first=drawRoom(first,room('bath-first','bathroom',17,2,3,3),site);
 first=placeFurniture(first,{id:'bed',code:'bed',x:14,y:2,rotated:false},site);
 first=placeFurniture(first,{id:'toilet',code:'toilet',x:17,y:2,rotated:false},site);
 first=placeFurniture(first,{id:'sink',code:'sink',x:18,y:2,rotated:false},site);
 first=placeFurniture(first,{id:'shower',code:'shower',x:19,y:2,rotated:false},site);
 return {site:{...upper,draft:[ground,first]},ground,first};
}
function withDoors(site:HotelSite){
 let ground=site.draft[0],upper=site.draft[1];
 ground=toggleHotelAccessDoor(ground,site,door('outside',0,3));
 ground=toggleHotelAccessDoor(ground,site,door('to-reception',4,3));
 ground=toggleHotelAccessDoor(ground,site,door('to-stairs',8,3));
 upper=toggleHotelAccessDoor(upper,site,door('from-stairs',10,3));
 upper=toggleHotelAccessDoor(upper,site,door('guest',13,3));
 return {...site,draft:[ground,upper]};
}
function ready(site:HotelSite){
 return {...site,built:site.draft,operations:{...defaultHotelOperations(HOUR),staff:{
  reception:1,housekeeping:1,kitchen:0,bar:0,
 }},stock:{
  cleaner:[{id:'clean',quantity:10,expiresHour:HOUR+1000}],
  linen:[{id:'linen',quantity:10,expiresHour:HOUR+1000}],
 }};
}
describe('Hotel architecture Phase 2 — true multi-floor routes',()=>{
 it('adds actual room types, physical dimensions and distinct lift capacities',()=>{
  expect(VERTICAL_CORES.stairwell).toMatchObject({width:2,height:3,capacityPerHour:60});
  expect(VERTICAL_CORES.elevator).toMatchObject({width:2,height:2,carCapacity:8,capacityPerHour:96});
  const {site}=hotel();
  expect(site.draft[0].rooms.find(r=>r.type==='stairwell')).toBeDefined();
 });
 it('auto-places a stairwell beside a corridor and aligns it on the next floor',()=>{
  const base=newHotelSite('auto','Hotel','new',37.98,23.72,HOUR);
  const withHall=updateFloor(base,0,f=>drawRoom(f,room('hall','corridor',0,3,6,2),base));
  const both=addFloor(withHall);
  const first=addVerticalCore(both,0,'stairwell','stair-a');
  const second=addVerticalCore(first,1,'stairwell','stair-b');
  const a=first.draft[0].rooms.find(r=>r.id==='stair-a')!;
  const b=second.draft[1].rooms.find(r=>r.id==='stair-b')!;
  expect({x:a.x,y:a.y,width:a.width,height:a.height})
   .toEqual({x:b.x,y:b.y,width:b.width,height:b.height});
  expect(second.draft[0]).toBe(first.draft[0]);
  expect(second.draft[1].rooms).toHaveLength(1);
 });
 it('rejects aligned shaft placement when another room occupies the landing',()=>{
  const {site}=hotel();
  expect(()=>addVerticalCore(site,1,'stairwell','another')).toThrow('Cannot align');
  const withActive={...site,projects:[{
   id:'p',method:'contractor' as const,status:'active' as const,
   startHour:0,deliveryHour:1,finishHour:2,budgetCents:1,
   materials:[],furnitureCents:0,labourCents:0,target:site.draft,
  }]};
  expect(()=>addVerticalCore(withActive,1,'elevator','new')).toThrow('Finish');
 });
 it('does not invent a vertical link before clear doorways exist',()=>{
  const {site}=hotel();
  const report=analyzeHotelBuildingAccess(site.draft,site);
  expect(report.links).toHaveLength(1);
  expect(report.links[0].connected).toBe(false);
  expect(report.connectedUpperGuestRooms).toBe(0);
  expect(report.floors[1].guests[0].status).toBe('missing-door');
  expect(report.receptionConnected).toBe(false);
 });
 it('connects a guest through outside door, reception, aligned stairs and upper corridor',()=>{
  const {site}=hotel(),connected=withDoors(site);
  const report=analyzeHotelBuildingAccess(connected.draft,connected);
  expect(report.receptionConnected).toBe(true);
  expect(report.connectedGuestRooms).toBe(1);
  expect(report.connectedUpperGuestRooms).toBe(1);
  expect(report.floors[1].guests[0].status).toBe('connected');
  expect(report.floors[1].reachableRoomIds).toContain('stairs-first');
  expect(report.floors[1].reachableRoomIds).toContain('hall-first');
  expect(report.links).toMatchObject([{type:'stairwell',fromFloor:0,
   toFloor:1,connected:true,capacityPerHour:60}]);
  expect(report.verticalCapacityPerHour).toBe(60);
  expect(report.peakGuestMovesPerHour).toBe(4);
  expect(report.verticalUtilisationPercent).toBe(7);
 });
 it('breaks a route when a stairwell door is removed even with aligned geometry',()=>{
  const {site}=hotel(),connected=withDoors(site);
  const floor=connected.draft[0],other=connected.draft[1];
  const disconnected=toggleHotelAccessDoor(floor,connected,door('remove-ground',8,3));
  const report=analyzeHotelBuildingAccess([disconnected,other],connected);
  expect(report.connectedUpperGuestRooms).toBe(0);
  expect(report.links[0].connected).toBe(false);
 });
 it('requires EXACT identical stair/elevator footprints on adjacent floors',()=>{
  const {site}=hotel(),connected=withDoors(site);
  const replaced={...connected,draft:[connected.draft[0],{
   ...connected.draft[1],rooms:connected.draft[1].rooms.map(r=>
    r.type==='stairwell'?{...r,x:r.x+1}:r),
  }]};
  const report=analyzeHotelBuildingAccess(replaced.draft,replaced);
  expect(report.links).toHaveLength(0);
  expect(report.floors[1].guests[0].status).toBe('no-vertical-link');
  const wrongKind={...connected,draft:[connected.draft[0],{
   ...connected.draft[1],rooms:connected.draft[1].rooms.map(r=>
    r.type==='stairwell'?{...r,type:'elevator' as const}:r),
  }]};
  expect(analyzeHotelBuildingAccess(wrongKind.draft,wrongKind).links).toHaveLength(0);
 });
 it('connects three floors only through an uninterrupted aligned shaft',()=>{
  const {site}=hotel();
  const base=withDoors(site);
  const third=addFloor(base);
  const withShaft=addVerticalCore(third,2,'stairwell','stair-third');
  const linked=updateFloor(withShaft,2,f=>{
   let upper=drawRoom(f,room('hall-third','corridor',10,3,3,2),withShaft);
   upper=drawRoom(upper,room('guest-third','guest',13,2,4,4),withShaft);
   upper=toggleHotelAccessDoor(upper,withShaft,door('stairs-third',10,3));
   return toggleHotelAccessDoor(upper,withShaft,door('guest-third-door',13,3));
  });
  const valid=analyzeHotelBuildingAccess(linked.draft,linked);
  expect(valid.links).toHaveLength(2);
  expect(valid.links.every(l=>l.connected)).toBe(true);
  expect(valid.floors[2].guests[0].status).toBe('connected');
  expect(valid.verticalCapacityPerHour).toBe(60);
  const broken={...linked,draft:linked.draft.map((f,i)=>i===1?
   {...f,rooms:f.rooms.filter(r=>r.type!=='stairwell')}:f)};
  const disconnected=analyzeHotelBuildingAccess(broken.draft,broken);
  expect(disconnected.floors[2].guests[0].status).toBe('no-vertical-link');
  expect(disconnected.connectedUpperGuestRooms).toBe(0);
 });
 it('does not allow isolated upper-floor exterior entrances to replace reception',()=>{
  const {site}=hotel();
  let first=drawRoom(site.draft[1],room('upper-outer-hall','corridor',0,8,3,2),site);
  first=toggleHotelAccessDoor(first,site,door('upper-outer',0,8));
  const report=analyzeHotelBuildingAccess([site.draft[0],first],site);
  expect(report.connectedUpperGuestRooms).toBe(0);
  expect(report.floors[0].entranceDoors).toBe(0);
  expect(report.receptionConnected).toBe(false);
 });
 it('a matching elevator with cabin capacity also unlocks the upper room',()=>{
  const {site}=hotel();
  const swapped={...site,draft:site.draft.map(f=>({
   ...f,rooms:f.rooms.map(r=>r.type==='stairwell'?{
    ...r,type:'elevator' as const,width:2,height:3,
   }:r),
  }))};
  const connected=withDoors(swapped),report=analyzeHotelBuildingAccess(connected.draft,connected);
  expect(report.floors[1].connectedGuests).toBe(1);
  expect(report.links[0]).toMatchObject({type:'elevator',carCapacity:8,
   capacityPerHour:96,connected:true});
  expect(report.verticalCapacityPerHour).toBe(96);
 });
 it('construction quotations include real modules once per new or changed floor',()=>{
  const base=newHotelSite('cost','Hotel','new',37.98,23.72,HOUR);
  const stairs=addVerticalCore(base,0,'stairwell','st');
  const quote=constructionQuote(stairs,'contractor',0);
  expect(quote.materials.find(m=>m.id==='stairwell-module')).toMatchObject({
   quantity:1,unitCents:750000,totalCents:750000,
  });
  const elevator=addVerticalCore(base,0,'elevator','lift');
  const elevatorQuote=constructionQuote(elevator,'contractor',0);
  expect(elevatorQuote.materials.find(m=>m.id==='elevator-module')).toMatchObject({
   quantity:1,unitCents:3200000,
  });
  const built={...stairs,built:stairs.draft};
  expect(constructionQuote(built,'contractor',0).changes).toBe(0);
  expect(constructionQuote(built,'contractor',0).materials).toEqual([]);
 });
 it('unconnected upper rooms lose eligibility only for Phase 2 opt-in sites',()=>{
  const {site}=hotel();
  const v2=ready(site);
  expect(roomInventory(v2,HOUR).readyRooms).toHaveLength(0);
  const v1={...v2,accessRulesVersion:1 as const};
  const legacy={...v2,accessRulesVersion:undefined};
  expect(roomInventory(v1,HOUR).readyRooms).toHaveLength(1);
  expect(roomInventory(legacy,HOUR).readyRooms).toHaveLength(1);
  const connected=ready(withDoors(site));
  expect(roomInventory(connected,HOUR).readyRooms).toHaveLength(1);
  expect(openingIssues(connected,HOUR)).toEqual([]);
 });
 it('adds missing vertical-link warnings and avoids booking disconnected guests',()=>{
  const {site}=hotel(),partially=withDoors(site);
  const noShaft={...partially,draft:[partially.draft[0],{
   ...partially.draft[1],rooms:partially.draft[1].rooms.filter(r=>r.type!=='stairwell'),
  }]};
  const report=analyzeHotelBuildingAccess(noShaft.draft,noShaft);
  expect(report.floors[1].warnings.join(' ')).toContain('aligned');
  expect(report.connectedUpperGuestRooms).toBe(0);
  expect(roomInventory(ready(noShaft),HOUR).readyRooms).toHaveLength(0);
 });
 it('models upper-floor throughput and a bounded congestion demand penalty',()=>{
  const {site}=hotel(),connected=withDoors(site);
  const report=analyzeHotelBuildingAccess(connected.draft,connected);
  expect(hotelVerticalCongestionModifier(report)).toBe(0);
  const overloaded={...report,connectedUpperGuestRooms:250,
   peakGuestMovesPerHour:1000,verticalCapacityPerHour:60};
  expect(hotelVerticalCongestionModifier(overloaded)).toBe(-.1);
  const mild={...report,connectedUpperGuestRooms:17,
   peakGuestMovesPerHour:68,verticalCapacityPerHour:60};
  expect(hotelVerticalCongestionModifier(mild)).toBeLessThan(0);
  expect(hotelVerticalCongestionModifier(mild)).toBeGreaterThan(-.1);
  expect(hotelVerticalCongestionModifier({...report,connectedUpperGuestRooms:0})).toBe(0);
 });
});
