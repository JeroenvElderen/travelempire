import {describe,expect,it} from 'vitest';
import {buildParkedCars,parkedCarSprites,type ParkingRoad} from './parkedCars';

const parkingRows=():ParkingRoad[]=>Array.from({length:6},(_,i)=>({
 id:'parking-aisle-'+i,
 a:[23.9+i*0.0001,37.9] as [number,number],
 b:[23.9+i*0.0001,37.9012] as [number,number],
 highway:'service'
}));
describe('decorative parked cars',()=>{
 it('populates a dense set of parallel parking aisles with stable car locations',()=>{
  const roads=parkingRows();
  const first=buildParkedCars(roads,120);
  expect(first.length).toBeGreaterThan(0);
  expect(first.length).toBeLessThanOrEqual(120);
  expect(buildParkedCars(roads,120)).toEqual(first);
  expect(first.every(car=>car.position[0]>23.899&&car.position[0]<23.902)).toBe(true);
 });
 it('does not place cars along an isolated ordinary service road',()=>{
  expect(buildParkedCars([parkingRows()[0]])).toEqual([]);
 });
 it('does not populate a group of non-service roads',()=>{
  const roads=parkingRows().map(road=>({...road,highway:'residential'}));
  expect(buildParkedCars(roads)).toEqual([]);
 });
 it('respects a small per-viewport vehicle budget',()=>{
  expect(buildParkedCars(parkingRows(),3).length).toBeLessThanOrEqual(3);
 });
 it('produces five compact transparent RGBA icons',()=>{
  const sprites=parkedCarSprites();
  expect(sprites).toHaveLength(5);
  expect(sprites.every(sprite=>sprite.data.length===sprite.width*sprite.height*4)).toBe(true);
  expect(sprites.every(sprite=>sprite.data[3]===0)).toBe(true);
 });
 it('fills narrow U-shaped parking strips between their parallel arms',()=>{
  const roads:ParkingRoad[]=[];
  // Six parking strips, each with two 5-metre-spaced long arms and
  // a short end cap (the typical road-line pattern of an airport car park).
  for(let strip=0;strip<6;strip++){
   const x=23.9+strip*0.00018;
   const width=0.00006;
   roads.push(
    {id:'u-'+strip+'-left',a:[x,37.9],b:[x,37.9007],highway:'service'},
    {id:'u-'+strip+'-right',a:[x+width,37.9],b:[x+width,37.9007],highway:'service'},
    {id:'u-'+strip+'-cap',a:[x,37.9007],b:[x+width,37.9007],highway:'service'}
   );
  }
  const cars=buildParkedCars(roads,260);
  expect(cars.length).toBeGreaterThan(8);
  expect(cars.length).toBeLessThanOrEqual(260);
  expect(buildParkedCars(roads,260)).toEqual(cars);
  const inside=cars.filter(car=>Array.from({length:6},(_,i)=>{
   const left=23.9+i*0.00018;
   return car.position[0]>left&&car.position[0]<left+0.00006;
  }).some(Boolean));
  expect(inside.length).toBeGreaterThan(0);
 });
 it('does not mistake a lone pair of parallel roads for an airport parking field',()=>{
  const roads:ParkingRoad[]=[
   {id:'side-a',a:[23.9,37.9],b:[23.9,37.9006],highway:'service'},
   {id:'side-b',a:[23.90006,37.9],b:[23.90006,37.9006],highway:'service'}
  ];
  expect(buildParkedCars(roads)).toEqual([]);
 });
});