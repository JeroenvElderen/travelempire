import {describe,it,expect} from 'vitest';
import {establishForeignSubsidiary,acquireForeignBusiness,crossBorderTransfer,internationalSnapshot,FOREIGN_MARKET,INTERNATIONAL_COUNTRIES} from './international';
import {advanceCorporate,consolidatedGroup} from './corporate';
import type {FleetState} from './simulation/taxi';
import type {Company} from './company';
const fleet={taxis:[],revenue:0,completed:0} as FleetState;
const date=Date.UTC(2026,10,4);
describe('international group operations',()=>{
 it('establishes licensed foreign subsidiary with local balance and explicit EUR cash cost',()=>{
  const result=establishForeignSubsidiary(undefined,'London Mobility','London','GBR',20000,100000,5000,date);
  expect(result.parentCashDelta).toBe(-31500);
  expect(result.subsidiary.localCash).toBeCloseTo(20000/1.17,2);
  expect(result.subsidiary.foreignTaxRate).toBe(25);
  expect(result.subsidiary.licensePaid).toBe(true);
 });
 it('keeps FX transfers internal except conversion fees',()=>{
  const established=establishForeignSubsidiary(undefined,'London Mobility','London','GBR',20000,100000,5000,date);
  const result=crossBorderTransfer(established.state,established.subsidiary.id,100,'to',68500,5000,date);
  expect(result.parentCashDelta+result.events[0].subsidiaryCashDelta).toBeCloseTo(-result.fee,2);
  expect(result.state.subsidiaries[0].cash).toBeCloseTo(20117,2);
  expect(result.state.totalRevenue).toBe(0);
 });
 it('acquires foreign business without booking acquisition price as revenue',()=>{
  const result=acquireForeignBusiness(undefined,fleet,FOREIGN_MARKET[0].id,50,100000,5000,date);
  expect(result.subsidiary.countryCode).toBe('IRL');
  expect(result.state.totalRevenue).toBe(0);
  expect(result.state.loans).toHaveLength(1);
  expect(result.state.totalAcquisitionSpend).toBe(61500);
 });
 it('uses country-specific taxes and does not duplicate group cash',()=>{
  const result=acquireForeignBusiness(undefined,fleet,FOREIGN_MARKET[0].id,0,100000,5000,date);
  const started=advanceCorporate(result.state,date);
  const next=advanceCorporate(started.state,date+86400000);
  expect(next.state.totalTaxes).toBeCloseTo((390-255)*.125,1);
  const company={cash:100000+result.parentCashDelta} as Company;
  const report=consolidatedGroup(company,{...fleet,corporate:next.state});
  expect(report.subsidiaryCash).toBeCloseTo(next.state.subsidiaries[0].cash,2);
  expect(internationalSnapshot(next.state).foreignCount).toBe(1);
 });
 it('has distinct fixed gameplay currency assumptions',()=>{
  expect(INTERNATIONAL_COUNTRIES.find(c=>c.code==='POL')?.currency).toBe('PLN');
  expect(INTERNATIONAL_COUNTRIES.find(c=>c.code==='GRC')?.eurPerUnit).toBe(1);
 });
});
