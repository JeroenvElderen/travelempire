import {describe,it,expect} from 'vitest';
import {
 newHotelSite,drawRoom,placeFurniture,addFloor,constructionQuote,updateFloor,
 type Room,type HotelSite,
} from './internalConstruction';
import {toggleHotelAccessDoor} from './hotelAccess';
import {
 toggleHotelSafetyFixture,suggestHotelSafetyFixture,analyzeHotelSafety,
 SAFETY_FIXTURE_COST_CENTS,
} from './hotelSafety';
import {roomInventory,openingIssues,defaultHotelOperations} from './hotelOperations';

const H=456000;
const room=(id:string,type:Room['type'],x:number,y:number,width:number,height:number):Room=>
 ({id,name:id,type,x,y,width,height});
function hotel():HotelSite{
 const s:HotelSite={...newHotelSite('h','New hotel','new',37.98,23.72,H),
  accessRulesVersion:2,safetyRulesVersion:1};
 const furnish=(f:HotelSite['draft'][number],fi:number)=>{
  let next=drawRoom(f,room('hall-'+fi,'corridor',4,3,10,2),s);
  next=drawRoom(next,room('stairs-'+fi,'stairwell',10,0,2,3),s);
  next=drawRoom(next,room('lift-'+fi,'elevator',12,0,2,3),s);
  next=drawRoom(next,room('guest-'+fi,'guest',14,3,5,4),s);
  next=drawRoom(next,room('bath-'+fi,'bathroom',19,3,3,3),s);
  next=placeFurniture(next,{id:'bed-'+fi,code:'bed',x:15,y:3,rotated:false},s);
  next=placeFurniture(next,{id:'toilet-'+fi,code:'toilet',x:19,y:3,rotated:false},s);
  next=placeFurniture(next,{id:'sink-'+fi,code:'sink',x:20,y:3,rotated:false},s);
  next=placeFurniture(next,{id:'shower-'+fi,code:'shower',x:21,y:3,rotated:false},s);
  next=toggleHotelAccessDoor(next,s,{id:'guest-door-'+fi,type:'door',x:14,y:4,orientation:'v'});
  next=toggleHotelAccessDoor(next,s,{id:'stair-door-'+fi,type:'door',x:10,y:3,orientation:'h'});
  next=toggleHotelAccessDoor(next,s,{id:'lift-door-'+fi,type:'door',x:12,y:3,orientation:'h'});
  return next;
 };
 let ground=drawRoom(s.draft[0],room('lobby','lobby',0,2,4,4),s);
 ground=placeFurniture(ground,{id:'reception',code:'reception',x:0,y:2,rotated:false},s);
 ground=furnish(ground,0);
 ground=toggleHotelAccessDoor(ground,s,{id:'outside',type:'door',x:0,y:3,orientation:'v'});
 ground=toggleHotelAccessDoor(ground,s,{id:'to-hall',type:'door',x:4,y:4,orientation:'v'});
 const withFloor=addFloor({...s,draft:[ground]});
 return {...withFloor,draft:[ground,furnish(withFloor.draft[1],1)]};
}
const install=(s:HotelSite):HotelSite=>{
 const drafts=s.draft.map((floor,fi)=>{
  let f=floor;
  f=toggleHotelSafetyFixture(f,s,{id:'alarm-'+fi,kind:'smoke-alarm',x:16,y:4},fi);
  f=toggleHotelSafetyFixture(f,s,{id:'ext-'+fi,kind:'fire-extinguisher',x:6,y:4},fi);
  if(fi===0)f=toggleHotelSafetyFixture(f,s,{id:'sign',kind:'exit-sign',x:1,y:4},fi);
  return f;
 });
 return {...s,draft:drafts};
};
const operating=(s:HotelSite):HotelSite=>({...s,built:s.draft,
 operations:{...defaultHotelOperations(H),staff:{reception:1,housekeeping:1,kitchen:0,bar:0}},
 stock:{cleaner:[{id:'cl',quantity:20,expiresHour:H+500}],
  linen:[{id:'ln',quantity:20,expiresHour:H+500}]}});
describe('Phase 4 safety equipment and real building access',()=>{
 it('requires valid rooms for equipment and an actual exterior door for signage',()=>{
  const s=hotel(),f=s.draft[0];
  expect(()=>toggleHotelSafetyFixture(f,s,{id:'x',kind:'exit-sign',x:6,y:4}))
   .toThrow('exterior doorway');
  expect(()=>toggleHotelSafetyFixture(s.draft[1],s,{id:'x',kind:'exit-sign',x:6,y:4},1))
   .toThrow('ground-floor');
  expect(()=>toggleHotelSafetyFixture(f,s,{id:'x',kind:'fire-extinguisher',x:16,y:4}))
   .toThrow('lobby or corridor');
  expect(()=>toggleHotelSafetyFixture(f,s,{id:'x',kind:'smoke-alarm',x:10,y:1}))
   .toThrow('guest rooms');
  expect(()=>toggleHotelSafetyFixture(f,s,{id:'x',kind:'smoke-alarm',x:25,y:3}))
   .toThrow('building grid');
  expect(suggestHotelSafetyFixture(f,s,'smoke-alarm','guest-0')).not.toBeNull();
  expect(suggestHotelSafetyFixture(f,s,'fire-extinguisher','guest-0')).toBeNull();
  expect(suggestHotelSafetyFixture(f,s,'exit-sign','lobby')).not.toBeNull();
 });
 it('does not create obstacles, and toggles or changes fixtures atomically',()=>{
  const s=hotel(),f=s.draft[0];
  const a=toggleHotelSafetyFixture(f,s,{id:'a',kind:'smoke-alarm',x:15,y:3});
  expect(a.objects).toEqual(f.objects);
  expect(a.safetyFixtures).toHaveLength(1);
  const b=toggleHotelSafetyFixture(a,s,{id:'b',kind:'smoke-alarm',x:15,y:3});
  expect(b.safetyFixtures).toEqual([]);
  const c=toggleHotelSafetyFixture(f,s,{id:'c',kind:'fire-extinguisher',x:6,y:4});
  const changed=toggleHotelSafetyFixture(c,s,{id:'new',kind:'smoke-alarm',x:6,y:4});
  expect(changed.safetyFixtures).toMatchObject([{id:'c',kind:'smoke-alarm'}]);
 });
 it('connects all guest rooms through stairs for fire and lift for wheelchair access',()=>{
  const s=install(hotel()),report=analyzeHotelSafety(s.draft,s);
  expect(report.totalGuestRooms).toBe(2);
  expect(report.fireReadyRooms).toBe(2);
  expect(report.wheelchairRooms).toBe(2);
  expect(report.exitCount).toBe(1);
  expect(report.signedExitCount).toBe(1);
  expect(report.guests.every(g=>g.fireReady&&g.accessible)).toBe(true);
  expect(report.score).toBe(100);
  expect(report.issues).toEqual([]);
 });
 it('does not treat elevators as evacuation stairs, nor stairs as wheelchair lifts',()=>{
  const s=install(hotel());
  const noStairs={...s,draft:s.draft.map((f,i)=>i===1?{
   ...f,rooms:f.rooms.filter(r=>r.type!=='stairwell')}:f)};
  const fire=analyzeHotelSafety(noStairs.draft,noStairs).guests[1];
  expect(fire.wheelchairRoute).toBe(true);
  expect(fire.evacuationRoute).toBe(false);
  expect(fire.fireReady).toBe(false);
  const noLift={...s,draft:s.draft.map((f,i)=>i===1?{
   ...f,rooms:f.rooms.filter(r=>r.type!=='elevator')}:f)};
  const accessible=analyzeHotelSafety(noLift.draft,noLift).guests[1];
  expect(accessible.evacuationRoute).toBe(true);
  expect(accessible.wheelchairRoute).toBe(false);
 });
 it('blocks rooms missing alarms, floor extinguishers or signed escape exits',()=>{
  const s=install(hotel());
  const missingExt={...s,draft:s.draft.map((f,i)=>i===1?{
   ...f,safetyFixtures:(f.safetyFixtures??[]).filter(v=>v.kind!=='fire-extinguisher')}:f)};
  expect(analyzeHotelSafety(missingExt.draft,missingExt).fireReadyRooms).toBe(1);
  const noSigns={...s,draft:s.draft.map((f,i)=>i===0?{
   ...f,safetyFixtures:(f.safetyFixtures??[]).filter(v=>v.kind!=='exit-sign')}:f)};
  expect(analyzeHotelSafety(noSigns.draft,noSigns).fireReadyRooms).toBe(0);
  const noAlarm={...s,draft:s.draft.map((f,i)=>i===1?{
   ...f,safetyFixtures:(f.safetyFixtures??[]).filter(v=>v.kind!=='smoke-alarm')}:f)};
  expect(analyzeHotelSafety(noAlarm.draft,noAlarm).fireReadyRooms).toBe(1);
 });
 it('preserves the purchased fixture costs in the normal construction quote',()=>{
  const s=install(hotel()),quoted=constructionQuote(s,'contractor',0);
  expect(quoted.furnitureCents).toBeGreaterThanOrEqual(
   2*SAFETY_FIXTURE_COST_CENTS['smoke-alarm']+
   2*SAFETY_FIXTURE_COST_CENTS['fire-extinguisher']+
   SAFETY_FIXTURE_COST_CENTS['exit-sign']);
  const paid={...s,built:s.draft};
  expect(constructionQuote(paid,'contractor',0).changes).toBe(0);
  const extra=updateFloor(paid,0,f=>toggleHotelSafetyFixture(f,paid,
   {id:'extra',kind:'smoke-alarm',x:18,y:5}));
  expect(constructionQuote(extra,'contractor',0).furnitureCents)
   .toBe(SAFETY_FIXTURE_COST_CENTS['smoke-alarm']);
 });
 it('prevents safety editing while construction is underway',()=>{
  const s=hotel(),busy={...s,projects:[{
   id:'p',method:'contractor' as const,status:'active' as const,
   startHour:0,deliveryHour:1,finishHour:2,budgetCents:100,
   materials:[],furnitureCents:0,labourCents:0,target:s.draft,
  }]};
  expect(()=>updateFloor(busy,0,f=>toggleHotelSafetyFixture(f,busy,
   {id:'alarm',kind:'smoke-alarm',x:16,y:4}))).toThrow('Finish');
 });
 it('takes booking eligibility only from completed safety work',()=>{
  const s=hotel(),planned=install(s);
  expect(roomInventory(operating(s),H).readyRooms).toHaveLength(0);
  expect(roomInventory({...operating(s),draft:planned.draft},H).readyRooms).toHaveLength(0);
  const ready=operating(planned);
  expect(roomInventory(ready,H).readyRooms).toHaveLength(2);
  expect(roomInventory(ready,H).safetyScore).toBe(100);
  expect(openingIssues(ready,H)).toEqual([]);
 });
 it('protects existing hotel eligibility until Phase 4 is explicitly enabled',()=>{
  const s=operating(hotel()),older={...s,safetyRulesVersion:undefined};
  expect(roomInventory(s,H).readyRooms).toHaveLength(0);
  expect(roomInventory(older,H).readyRooms).toHaveLength(2);
  expect(roomInventory(older,H).safetyScore).toBeNull();
  expect(openingIssues(older,H)).toEqual([]);
 });
});
