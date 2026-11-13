import {describe,expect,it} from 'vitest';
import {depotParkingChoices,requireDepotParking} from './depotParking';
import type {Company} from '../company';
import type {FleetState,Taxi} from './taxi';

const company={
 headquarters:{lng:23.7,lat:37.9,label:'Athens',region:'Attica',country:'Greece',countryCode:'GR'},
 depots:[{id:'island',name:'Andros depot',lng:24.8,lat:37.8,capacity:10}],
} satisfies Pick<Company,'headquarters'|'depots'>;
const vehicle=(id:string,depotId?:string,kind?:Taxi['kind'],deliveryUntil?:number)=>
 ({id,depotId,kind,deliveryUntil} as Taxi);
const fleet=(taxis:Taxi[],extra:Partial<FleetState>={})=>({
 taxis,upgrades:[],...extra,
} as FleetState);

describe('depot selection and order parking limits',()=>{
 it('treats old vehicles without a depot ID as main depot vehicles',()=>{
  const parking=depotParkingChoices(company,fleet([vehicle('old'),vehicle('other','main')]));
  expect(parking[0]).toMatchObject({id:'main',occupied:2,capacity:5,available:3});
  expect(parking[1]).toMatchObject({id:'island',occupied:0,capacity:10,available:10});
 });
 it('reserves spaces even if cars are still being delivered',()=>{
  const data=fleet([vehicle('pending','island',undefined,Date.now()+90000)]);
  expect(depotParkingChoices(company,data)[1].available).toBe(9);
  expect(()=>requireDepotParking(company,data,'island',10)).toThrow(/9 available/);
  expect(requireDepotParking(company,data,'island',9).id).toBe('island');
 });
 it('does not count any of the five depot explorers as taxi parking',()=>{
  const data=fleet(Array.from({length:5},(_,i)=>vehicle('scout-'+i,'island','explorer')));
  expect(depotParkingChoices(company,data)[1].occupied).toBe(0);
 });
 it('rejects orders exceeding capacity without diverting to headquarters',()=>{
  const data=fleet(Array.from({length:29},(_,i)=>vehicle('vehicle-'+i,'main')),
   {upgrades:['depot-capacity','depot-capacity','depot-capacity','depot-capacity']});
  expect(depotParkingChoices(company,data)[0]).toMatchObject({
   occupied:29,capacity:25,available:0,overCapacity:4,
  });
  expect(()=>requireDepotParking(company,data,'main',1)).toThrow(/29\/25 taxi spaces/);
  expect(requireDepotParking(company,data,'island',10).available).toBe(10);
  expect(()=>requireDepotParking(company,data,'island',11)).toThrow(/10 available/);
 });
 it('counts all existing parking upgrades and rejects unknown depot IDs',()=>{
  const data=fleet([],{depotUpgrades:{island:{capacity:1},main:{capacity:2}}});
  expect(depotParkingChoices(company,data).map(d=>d.capacity)).toEqual([15,15]);
  expect(()=>requireDepotParking(company,data,'not-a-depot',1)).toThrow(/existing delivery depot/);
 });
 it('a batch order must fit as a whole',()=>{
  expect(requireDepotParking(company,fleet([]),'main',5).available).toBe(5);
  expect(()=>requireDepotParking(company,fleet([]),'main',6)).toThrow(/needs 6/);
  expect(()=>requireDepotParking(company,fleet([]),'main',0)).toThrow(/valid number/);
 });
});
