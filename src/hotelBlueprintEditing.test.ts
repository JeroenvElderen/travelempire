import {describe,expect,it} from 'vitest';
import {
 newHotelSite,drawRoom,placeFurniture,toggleWall,updateFloor,constructionQuote,
 type Room,type HotelSite,
} from './internalConstruction';
import {
 addBlueprintTemplate,BLUEPRINT_ROOM_TEMPLATES,editBlueprintRoom,hotelBlueprintHealth,
} from './hotelBlueprintEditing';

const site=(width=24,height=16):HotelSite=>newHotelSite('hotel-1','Test hotel','new',
 37.98,23.72,100,undefined,{width,height});
const room=(id:string,x:number,y:number,width=5,height=4):Room=>({
 id,name:'Guest '+id,type:'guest',x,y,width,height,
});
const add=(floor:HotelSite['draft'][number],s:HotelSite,template:typeof BLUEPRINT_ROOM_TEMPLATES[number]['id'],id:string)=>
 addBlueprintTemplate(floor,s,template,id,i=>id+'-furn-'+i);

describe('precision hotel floor-plan editing',()=>{
 it('offers six plus validated rooms with normal construction pricing',()=>{
  const s=site();
  expect(BLUEPRINT_ROOM_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  let plan=s.draft[0];
  plan=add(plan,s,'guest-double','guest-a');
  plan=add(plan,s,'bathroom-ready','bath-a');
  expect(plan.rooms).toHaveLength(2);
  expect(plan.objects.length).toBeGreaterThan(7);
  expect(hotelBlueprintHealth(plan,s).roomsWithIssues).toBe(0);
  const drafted=updateFloor(s,0,()=>plan);
  const quote=constructionQuote(drafted,'contractor',0);
  expect(quote.materialCents).toBeGreaterThan(0);
  expect(quote.furnitureCents).toBeGreaterThan(0);
  expect(quote.totalCents).toBe(quote.labourCents+quote.materialCents+quote.furnitureCents);
 });
 it('every template meets its own basic furnishings requirements',()=>{
  for(const t of BLUEPRINT_ROOM_TEMPLATES){
   const s=site(64,64);
   const floor=add(s.draft[0],s,t.id,'new-'+t.id);
   const health=hotelBlueprintHealth(floor,s);
   expect(floor.objects).toHaveLength(t.equipment.length);
   expect(floor.rooms[0].type).toBe(t.roomType);
   expect(floor.rooms[0].width).toBe(t.width);
   expect(floor.rooms[0].height).toBe(t.height);
   expect(health.roomsWithIssues).toBe(0);
  }
 });
 it('places rooms in free space and never overlaps existing rooms',()=>{
  const s=site(12,12);
  const first=add(s.draft[0],s,'guest-double','a');
  const second=add(first,s,'guest-double','b');
  expect(first.rooms[0].x).toBe(0);
  expect(second.rooms[1].x>0||second.rooms[1].y>0).toBe(true);
  expect(second.rooms).toHaveLength(2);
  expect(second.objects).toHaveLength(first.objects.length*2);
 });
 it('detects when a small plot cannot accommodate another template',()=>{
  const s=site(12,12);
  let f=s.draft[0];
  // Six 5×4 m rooms fit into a 12×12 m plot; the seventh must be rejected.
  for(let i=0;i<6;i++)f=add(f,s,'guest-double',String(i));
  expect(()=>add(f,s,'guest-double','extra')).toThrow('No space');
 });
 it('moves a furnished room atomically and preserves equipment IDs and relative coordinates',()=>{
  const s=site();
  const before=add(s.draft[0],s,'guest-double','a');
  const after=editBlueprintRoom(before,s,'a',{x:5,y:5,width:5,height:4});
  expect(after.rooms[0]).toMatchObject({x:5,y:5,width:5,height:4,id:'a'});
  expect(after.objects).toHaveLength(before.objects.length);
  expect(after.objects.map(o=>o.id)).toEqual(before.objects.map(o=>o.id));
  expect(after.objects.map(o=>[o.x-5,o.y-5])).toEqual(before.objects.map(o=>[o.x,o.y]));
  expect(before.rooms[0].x).toBe(0);
  expect(hotelBlueprintHealth(after,s).roomsWithIssues).toBe(0);
 });
 it('rejects shrinking a room around furniture instead of deleting furniture',()=>{
  const s=site();
  const before=add(s.draft[0],s,'guest-double','a');
  expect(()=>editBlueprintRoom(before,s,'a',{x:0,y:0,width:3,height:4})).toThrow('Furniture');
  expect(before.objects).toHaveLength(5);
 });
 it('rejects moving into other rooms or outside purchased plot boundaries',()=>{
  const s=site();
  const base=drawRoom(s.draft[0],room('a',0,0),s);
  const withSecond=drawRoom(base,room('b',7,0),s);
  expect(()=>editBlueprintRoom(withSecond,s,'a',{x:7,y:0,width:5,height:4})).toThrow('overlap');
  expect(()=>editBlueprintRoom(withSecond,s,'a',{x:23,y:0,width:5,height:4})).toThrow('outside');
  expect(()=>editBlueprintRoom(withSecond,s,'a',{x:0,y:0,width:1,height:1})).toThrow('smaller');
  expect(withSecond.rooms[0]).toMatchObject({x:0,y:0,width:5,height:4});
 });
 it('does not silently detach custom walls and doorways when editing a room',()=>{
  const s=site();
  const first=drawRoom(s.draft[0],room('a',1,1),s);
  const withDoor=toggleWall(first,{id:'door-a',type:'door',orientation:'v',x:1,y:2},s);
  expect(()=>editBlueprintRoom(withDoor,s,'a',{x:2,y:1,width:5,height:4})).toThrow('walls or doors');
  expect(withDoor.walls).toHaveLength(1);
 });
 it('tracks drafted area and furnishing readiness without changing operating guest counts',()=>{
  const s=site();
  let floor=drawRoom(s.draft[0],room('a',0,0),s);
  expect(hotelBlueprintHealth(floor,s)).toMatchObject({
   rooms:1,guestRooms:1,readyGuestRooms:0,roomsWithIssues:1,plannedArea:20,
  });
  floor=placeFurniture(floor,{id:'bed',code:'bed',x:0,y:0,rotated:false},s);
  expect(hotelBlueprintHealth(floor,s)).toMatchObject({
   readyGuestRooms:1,roomsWithIssues:0,plannedArea:20,
  });
 });
 it('keeps finished hotel sites protected while projects are under construction',()=>{
  const s=site(),added=add(s.draft[0],s,'guest-double','a');
  const draft=updateFloor(s,0,()=>added);
  const locked={...draft,projects:[{id:'active',status:'active' as const,method:'contractor' as const,
   startHour:100,deliveryHour:105,finishHour:200,budgetCents:2000,materials:[],
   furnitureCents:0,labourCents:0,target:draft.draft}]};
  expect(()=>updateFloor(locked,0,f=>editBlueprintRoom(f,locked,'a',{x:2,y:2,width:5,height:4})))
   .toThrow('Finish the current construction project');
 });
});
