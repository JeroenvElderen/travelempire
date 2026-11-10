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
});