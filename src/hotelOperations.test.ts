import {describe,it,expect} from 'vitest';
import {newHotelSite,roomIssues,emptyConstruction,supplyStock,type HotelFloor,type HotelSite} from './internalConstruction';
import {defaultHotelOperations,changeHotelSetting,setHotelOperating,hotelActiveAt,roomInventory,
 openingIssues,settleHotelOperations,consumeSupply,activeHotelPeriods} from './hotelOperations';
import {settlePropertyDividends,type PropertyPortfolio} from './investments';

const dayHour=24*3000+13;
function prepared():HotelSite{
 const site=newHotelSite('hotel-test','Test Hotel','new',37.97,23.73,dayHour);
 const floor:HotelFloor={
  id:'floor-0',label:'Ground floor',
  rooms:[
   ...Array.from({length:5},(_,i)=>({id:'guest-'+i,name:'Room '+(101+i),type:'guest' as const,x:i*3,y:0,width:3,height:3})),
   {id:'bath',name:'Bathroom',type:'bathroom',x:0,y:4,width:3,height:3},
   {id:'lobby',name:'Reception',type:'lobby',x:3,y:4,width:3,height:3},
   {id:'kitchen',name:'Kitchen',type:'kitchen',x:6,y:4,width:3,height:3},
   {id:'restaurant',name:'Restaurant',type:'restaurant',x:9,y:4,width:4,height:3},
   {id:'bar',name:'Bar',type:'bar',x:13,y:4,width:4,height:3},
   {id:'storage',name:'Storage',type:'storage',x:17,y:4,width:3,height:3}
  ],
  objects:[
   ...Array.from({length:5},(_,i)=>({id:'bed-'+i,code:'bed' as const,x:i*3,y:0,rotated:false})),
   {id:'toilet',code:'toilet',x:0,y:4,rotated:false},
   {id:'sink',code:'sink',x:1,y:4,rotated:false},
   {id:'shower',code:'shower',x:2,y:4,rotated:false},
   {id:'reception',code:'reception',x:3,y:4,rotated:false},
   {id:'oven',code:'oven',x:6,y:4,rotated:false},
   {id:'fridge',code:'fridge',x:8,y:4,rotated:false},
   {id:'kitchen-sink',code:'sink',x:6,y:5,rotated:false},
   {id:'table',code:'table',x:9,y:4,rotated:false},
   {id:'chair',code:'chair',x:11,y:4,rotated:false},
   {id:'bar-counter',code:'bar-counter',x:13,y:4,rotated:false}
  ],walls:[]
 };
 const stock:HotelSite['stock']={};
 for(const [code,amount] of [
  ['linen',10],['cleaner',40],['toiletries',100],['eggs',200],['bread',100],['milk',100],
  ['chicken',100],['vegetables',100],['wine',100],['beer',100],['soft-drinks',100]
 ] as const)stock[code]=[{id:code,quantity:amount,expiresHour:dayHour+1000}];
 const staff={reception:1,housekeeping:1,kitchen:1,bar:1};
 return {...site,built:[floor],stock,operations:{...defaultHotelOperations(dayHour),staff}};
}
describe('operated hotels',()=>{
 it('requires rooms, a bathroom, a lobby, employees and linen before opening',()=>{
  const empty=newHotelSite('x','Empty','new',38,23,dayHour);
  expect(openingIssues(empty,dayHour).some(s=>s.includes('lobby'))).toBe(true);
  expect(()=>setHotelOperating(empty,true,dayHour)).toThrow('lobby');
  const equipped=prepared();
  expect(roomInventory(equipped,dayHour).readyRooms).toHaveLength(5);
  expect(roomIssues(equipped.built[0],equipped.built[0].rooms.find(r=>r.type==='bathroom')!)).toHaveLength(0);
  expect(openingIssues(equipped,dayHour)).toHaveLength(0);
 });
 it('updates room prices and employee counts with recruitment costs',()=>{
  const site=prepared();
  const raised=changeHotelSetting(site,'rateCents',15500,dayHour);
  expect(raised.site.operations?.rateCents).toBe(15500);
  const staffed=changeHotelSetting(raised.site,'bar',2,dayHour);
  expect(staffed.recruitmentCents).toBe(14500);
  expect(staffed.site.operations?.staff.bar).toBe(2);
  expect(()=>changeHotelSetting(site,'rateCents',20,dayHour)).toThrow('Price');
 });
 it('books real rooms once, charges wages and does not settle an hour twice',()=>{
  const site=setHotelOperating(prepared(),true,dayHour);
  expect(hotelActiveAt(site.operations,dayHour)).toBe(true);
  const state={...emptyConstruction(dayHour),sites:{[site.id]:site}};
  const first=settleHotelOperations(state,dayHour+27);
  const ops=first.state.sites[site.id].operations!;
  expect(ops.guests.length).toBeLessThanOrEqual(5);
  expect(ops.totals.guests).toBeGreaterThan(0);
  expect(ops.totals.roomCents).toBeGreaterThan(0);
  expect(ops.totals.wagesCents).toBeGreaterThan(0);
  expect(ops.recentDays.length).toBeGreaterThan(0);
  const repeated=settleHotelOperations(first.state,dayHour+27);
  expect(repeated.companyNetCents).toBe(0);
  expect(repeated.state).toBe(first.state);
 });
 it('consumes inventory only when sufficient stock is available',()=>{
  const site=prepared(),before=supplyStock(site,'wine',dayHour);
  const served=consumeSupply(site,'wine',0.2,dayHour)!;
  expect(supplyStock(served,'wine',dayHour)).toBeCloseTo(before-0.2,4);
  expect(supplyStock(site,'wine',dayHour)).toBe(before);
  expect(consumeSupply(site,'wine',before+1,dayHour)).toBeNull();
 });
 it('credits only the controlling share of hotel operating profits',()=>{
  const site={...setHotelOperating(prepared(),true,dayHour),sourceHoldingId:'holding-1'};
  const state={...emptyConstruction(dayHour),sites:{[site.id]:site}};
  const settled=settleHotelOperations(state,dayHour+27,()=>0.60);
  const record=settled.reports[0];
  expect(record.share).toBe(.6);
  expect(settled.companyNetCents).toBe(Math.round(record.netCents*.6));
  expect(settled.grossCents).toBe(Math.round(record.grossCents*.6));
  expect(settled.expenseCents).toBe(Math.round(record.expenseCents*.6));
 });
 it('suppresses dividends only during operated hours, preserving before and after',()=>{
  const holding={id:'holding-1',name:'Property 1',kind:'hotel' as const,
   position:[23.7,38] as [number,number],valuationCents:80000000,
   investedCents:80000000,dividendsCents:0,lastHour:dayHour-2};
  const portfolio:PropertyPortfolio={holdings:{'holding-1':holding}};
  const baseline=settlePropertyDividends(portfolio,(dayHour+4)*3600000);
  const periods=new Map([['holding-1',[{fromHour:dayHour,toHour:dayHour+2}]]]);
  const managed=settlePropertyDividends(portfolio,(dayHour+4)*3600000,periods);
  expect(managed.incomeCents).toBeLessThan(baseline.incomeCents);
  expect(managed.portfolio.holdings['holding-1'].lastHour).toBe(dayHour+4);
  const site={...prepared(),sourceHoldingId:'holding-1',
   operations:{...defaultHotelOperations(dayHour),periods:[{fromHour:dayHour,toHour:dayHour+2}]}};
  expect(activeHotelPeriods({...emptyConstruction(dayHour),sites:{[site.id]:site}}).get('holding-1')).toHaveLength(1);
 });
 it('closes to new bookings while retaining past operating history',()=>{
  const opened=setHotelOperating(prepared(),true,dayHour);
  const closed=setHotelOperating(opened,false,dayHour+2);
  expect(hotelActiveAt(closed.operations,dayHour+1)).toBe(true);
  expect(hotelActiveAt(closed.operations,dayHour+2)).toBe(false);
  expect(()=>setHotelOperating(closed,false,dayHour+3)).toThrow('already closed');
 });
});
