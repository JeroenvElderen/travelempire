import {describe,it,expect} from 'vitest';
import {CORPORATE_MARKET,acquireCompany,foundSubsidiary,transferCorporateCash,mergeSubsidiaries,restructureSubsidiary,advanceCorporate,consolidatedGroup,corporateCreditCapacity} from './corporate';
import type {FleetState} from './simulation/taxi';
import type {Company} from './company';
const date=Date.UTC(2026,10,4);
const fleet={taxis:[],revenue:0,completed:0} as FleetState;
const company={cash:300000,name:'Parent',depots:[]} as unknown as Company;
describe('corporate group finance',()=>{
 it('buys a company with separate cash, loans and no operating revenue',()=>{
  const result=acquireCompany(undefined,fleet,'athens-city',0,20,300000,5000,date);
  expect(result.subsidiary.cash).toBe(18000);
  expect(result.parentCashDelta).toBe(-148000);
  expect(result.state.loans[0].balance).toBe(37000);
  expect(result.state.totalRevenue).toBe(0);
  expect(result.state.totalAcquisitionSpend).toBe(185000);
  expect(()=>acquireCompany(result.state,fleet,'athens-city',0,0,300000,5000,date)).toThrow();
 });
 it('preserves group cash when forming a subsidiary or transferring funds',()=>{
  const formed=foundSubsidiary(undefined,'Branch','Patras',20000,300000,5000,date);
  const moved=transferCorporateCash(formed.state,formed.subsidiary.id,5000,'from',280000,5000,date);
  expect(formed.parentCashDelta+formed.subsidiary.cash).toBe(0);
  expect(moved.parentCashDelta+moved.events[0].subsidiaryCashDelta).toBe(0);
  expect(moved.state.subsidiaries[0].cash).toBe(15000);
  expect(moved.state.totalRevenue).toBe(0);
 });
 it('merges subsidiary assets and does not create cash or profit',()=>{
  const a=foundSubsidiary(undefined,'A','Athens',20000,300000,5000,date);
  const b=foundSubsidiary(a.state,'B','Patras',10000,280000,5000,date);
  const merged=mergeSubsidiaries(b.state,a.subsidiary.id,b.subsidiary.id,date);
  expect(merged.parentCashDelta).toBe(0);
  expect(merged.state.subsidiaries.filter(s=>s.active)).toHaveLength(1);
  expect(merged.state.subsidiaries.find(s=>s.id===b.subsidiary.id)?.cash).toBe(30000);
  expect(merged.state.totalRevenue).toBe(0);
 });
 it('does not double count internal capital transfers in group P&L',()=>{
  const formed=foundSubsidiary(undefined,'Branch','Patras',20000,300000,5000,date);
  const before=consolidatedGroup({...company,cash:280000},{...fleet,corporate:formed.state});
  const moved=transferCorporateCash(formed.state,formed.subsidiary.id,5000,'from',280000,5000,date);
  const after=consolidatedGroup({...company,cash:285000},{...fleet,corporate:moved.state});
  expect(before.assets).toBe(after.assets);
  expect(before.profit).toBe(after.profit);
 });
 it('advances subsidiaries and amortizes acquisition loans only once per game day',()=>{
  const bought=acquireCompany(undefined,fleet,'athens-city',0,20,300000,5000,date);
  const initialized=advanceCorporate(bought.state,date);
  const next=advanceCorporate(initialized.state,date+86400000);
  expect(next.state.totalRevenue).toBe(CORPORATE_MARKET[0].revenuePerDay);
  expect(next.parentCashDelta).toBeLessThan(0);
  expect(next.state.loans[0].balance).toBeLessThan(bought.state.loans[0].balance);
  expect(advanceCorporate(next.state,date+86400000).parentCashDelta).toBe(0);
 });
 it('restructures assets without creating operating income',()=>{
  const formed=foundSubsidiary(undefined,'Branch','Patras',20000,300000,5000,date);
  const updated=restructureSubsidiary(formed.state,formed.subsidiary.id,1,0,date);
  expect(updated.state.subsidiaries[0].cash).toBe(5000);
  expect(updated.state.subsidiaries[0].vehicleAssets).toBe(15000);
  expect(updated.state.totalRevenue).toBe(0);
 });
 it('shares borrowing capacity with ordinary loans',()=>{
  expect(corporateCreditCapacity({...fleet,loans:[{id:'a',principal:20000,balance:20000,annualRate:.09,termDays:90,remainingDays:90,dailyPayment:100,accruedGameSeconds:0}]})).toBe(55000);
 });
});
