import {describe,expect,it} from 'vitest';
import {
 newHotelSite,drawRoom,placeFurniture,constructionQuote,updateFloor,
 type HotelSite,type HotelFloor,
} from './internalConstruction';
import {
 editBlueprintFurniture,furnitureAtCell,furnitureDragPosition,
 hotelGuestRoomQuality,hotelDesignDemandModifier,hotelBlueprintHealth,
} from './hotelBlueprintEditing';

const site=():HotelSite=>newHotelSite('room-test','Hotel Test','new',37.98,23.72,100);
function layout(){
 const s=site();
 let f=drawRoom(s.draft[0],{
  id:'guest',type:'guest',name:'Room 101',x:0,y:0,width:7,height:6,
 },s);
 f=placeFurniture(f,{id:'bed',code:'bed',x:1,y:1,rotated:false},s);
 f=placeFurniture(f,{id:'desk',code:'desk',x:4,y:1,rotated:false},s);
 return {s,f};
}
function withBath(s:HotelSite,source:HotelFloor){
 let f=drawRoom(source,{
  id:'bath',type:'bathroom',name:'Bathroom',x:8,y:0,width:3,height:3,
 },s);
 f=placeFurniture(f,{id:'toilet',code:'toilet',x:8,y:0,rotated:false},s);
 f=placeFurniture(f,{id:'sink',code:'sink',x:9,y:0,rotated:false},s);
 return placeFurniture(f,{id:'shower',code:'shower',x:10,y:0,rotated:false},s);
}
describe('mobile furniture placement',()=>{
 it('finds rotated furniture using its actual occupied cells',()=>{
  const {s,f}=layout();
  const withRotation=editBlueprintFurniture(f,s,'desk',{rotated:true});
  expect(furnitureAtCell(f,5,1)?.id).toBe('desk');
  expect(furnitureAtCell(withRotation,5,1)).toBeNull();
  expect(furnitureAtCell(withRotation,4,2)?.id).toBe('desk');
  expect(furnitureAtCell(f,9,9)).toBeNull();
 });
 it('snaps pointer gestures to whole metres regardless of zoom',()=>{
  expect(furnitureDragPosition({x:2,y:3},{x:14,y:31},1)).toEqual({x:2,y:4});
  expect(furnitureDragPosition({x:2,y:3},{x:30,y:-40},2)).toEqual({x:3,y:2});
  expect(furnitureDragPosition({x:2,y:3},{x:0,y:0},1)).toEqual({x:2,y:3});
  expect(furnitureDragPosition({x:2,y:3},{x:60,y:-60},.5)).toEqual({x:6,y:-1});
 });
 it('moves a furnished item without changing its price, code, identity or save order',()=>{
  const {s,f}=layout();
  const moved=editBlueprintFurniture(f,s,'bed',{x:2,y:2});
  expect(moved.objects).toHaveLength(f.objects.length);
  expect(moved.objects[0]).toMatchObject({id:'bed',code:'bed',x:2,y:2,rotated:false});
  expect(moved.objects[1].id).toBe('desk');
  expect(f.objects[0]).toMatchObject({x:1,y:1});
  const built={...s,built:[f],draft:[moved]};
  expect(constructionQuote(built,'contractor',0).furnitureCents).toBe(0);
  expect(constructionQuote(built,'contractor',0).changes).toBe(1);
 });
 it('can rotate or nudge existing equipment in the same room',()=>{
  const {s,f}=layout();
  const rotated=editBlueprintFurniture(f,s,'desk',{rotated:true});
  expect(rotated.objects[1]).toMatchObject({x:4,y:1,rotated:true});
  const nudged=editBlueprintFurniture(rotated,s,'desk',{x:5,y:1});
  expect(nudged.objects[1]).toMatchObject({x:5,y:1,rotated:true});
  expect(nudged.objects.map(o=>o.id)).toEqual(f.objects.map(o=>o.id));
 });
 it('rejects overlaps, leaving room, and outside-plot edits atomically',()=>{
  const {s,f}=layout();
  expect(()=>editBlueprintFurniture(f,s,'desk',{x:1,y:1})).toThrow('overlap');
  expect(()=>editBlueprintFurniture(f,s,'desk',{x:20,y:1})).toThrow('inside a room');
  expect(()=>editBlueprintFurniture(f,s,'desk',{x:24,y:1})).toThrow('boundary');
  expect(()=>editBlueprintFurniture(f,s,'unknown',{x:0})).toThrow('Select');
  expect(f.objects.map(o=>[o.x,o.y])).toEqual([[1,1],[4,1]]);
 });
 it('keeps no-op moves as the same saved floor object',()=>{
  const {s,f}=layout();
  expect(editBlueprintFurniture(f,s,'bed',{x:1,y:1})).toBe(f);
  expect(editBlueprintFurniture(f,s,'bed',{})).toBe(f);
 });
 it('can be edited only through draft updates while construction is unlocked',()=>{
  const {s,f}=layout();
  const pending=updateFloor(s,0,()=>f);
  const active={...pending,projects:[{
   id:'p1',method:'contractor' as const,status:'active' as const,
   startHour:100,deliveryHour:110,finishHour:120,
   budgetCents:1000,materials:[],furnitureCents:0,labourCents:0,target:[f],
  }]};
  expect(()=>updateFloor(active,0,old=>editBlueprintFurniture(old,s,'bed',{x:2})))
   .toThrow('Finish the current construction project');
 });
});

describe('hotel design quality and demand',()=>{
 it('penalises missing essential equipment and missing bathrooms',()=>{
  const {s,f}=layout();
  const bedroom=f.rooms.find(r=>r.type==='guest')!;
  expect(hotelGuestRoomQuality(f,bedroom).score).toBeLessThanOrEqual(49);
  const withBathroom=withBath(s,f);
  expect(hotelGuestRoomQuality(withBathroom,bedroom).score)
   .toBeGreaterThan(hotelGuestRoomQuality(f,bedroom).score);
  const unmade={...withBathroom,objects:withBathroom.objects.filter(o=>o.id!=='bed')};
  expect(hotelGuestRoomQuality(unmade,bedroom).score).toBeLessThanOrEqual(32);
 });
 it('rewards quality amenities, enough space and furniture variety',()=>{
  const {s,f}=layout();
  const bath=withBath(s,f);
  const bedroom=bath.rooms.find(r=>r.id==='guest')!;
  const starting=hotelGuestRoomQuality(bath,bedroom);
  let nicer=placeFurniture(bath,{id:'wardrobe',code:'wardrobe',x:6,y:0,rotated:false},s);
  nicer=placeFurniture(nicer,{id:'television',code:'television',x:6,y:2,rotated:false},s);
  nicer=placeFurniture(nicer,{id:'lamp',code:'lamp',x:6,y:4,rotated:false},s);
  const upgraded=hotelGuestRoomQuality(nicer,bedroom);
  expect(upgraded.score).toBeGreaterThan(starting.score);
  expect(upgraded.suggestions).not.toContain('Add a wardrobe');
  expect(upgraded.score).toBeLessThanOrEqual(100);
  expect(hotelBlueprintHealth(nicer,s).averageGuestRoomQuality).toBe(upgraded.score);
  expect(hotelBlueprintHealth(nicer,s).readyGuestRooms).toBe(1);
 });
 it('changes simulated hotel demand in a strictly bounded direction',()=>{
  expect(hotelDesignDemandModifier(90)).toBeGreaterThan(hotelDesignDemandModifier(40));
  expect(hotelDesignDemandModifier(-500)).toBe(-.06);
  expect(hotelDesignDemandModifier(400)).toBe(.10);
  expect(hotelDesignDemandModifier(NaN)).toBe(0);
 });
 it('does not mark unbuilt bedroom quality as paid hotel occupancy',()=>{
  const {s,f}=layout();
  const draft={...s,draft:[withBath(s,f)]};
  expect(draft.built[0].rooms).toHaveLength(0);
  expect(hotelBlueprintHealth(draft.draft[0],draft).guestRoomQuality).toHaveLength(1);
  expect(hotelBlueprintHealth(draft.built[0],draft).guestRoomQuality).toHaveLength(0);
 });
});
