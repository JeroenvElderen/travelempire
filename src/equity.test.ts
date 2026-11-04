import {describe,it,expect} from 'vitest';
import {equityOf,issueShares,payDividend,buybackShares,ownership,distributableProfit,recordValuation,valueCompany} from './equity';
import type {Company} from './company';
import type {FleetState} from './simulation/taxi';
const company={id:'test',name:'Test',cash:20000,depots:[]} as unknown as Company;
const fleet={taxis:[],revenue:0,completed:0,accounting:{settings:{corporateRate:22,vatRate:13,settlement:'monthly'},periods:[{month:'2026-11',grossRevenue:15000,netRevenue:13000,grossExpenses:4000,netExpenses:3500,vatCollected:2000,vatInput:500,depreciation:0,corporateTax:2090,vatPaid:0,corporateTaxPaid:0,closed:false}]}} as FleetState;
describe('shareholder finance',()=>{
 it('starts at 100% founder ownership and dilutes without operating income',()=>{
  const initial=equityOf();
  const issued=issueShares(initial,'investor-0','Investor',25000,100000,Date.UTC(2026,10,1));
  expect(ownership(initial,'founder')).toBe(100);
  expect(ownership(issued.state,'founder')).toBe(80);
  expect(issued.cashDelta).toBe(25000);
  expect(initial.holders).toHaveLength(1);
 });
 it('allocates dividends exactly once and protects the reserve',()=>{
  const issued=issueShares(undefined,'investor-0','Investor',25000,100000,Date.UTC(2026,10,1));
  const profit=distributableProfit(fleet,issued.state);
  const paid=payDividend(issued.state,1000,20000,profit,5000,Date.UTC(2026,10,2));
  expect(paid.cashDelta).toBe(-1000);
  expect(paid.events.reduce((a,e)=>a+e.amount,0)).toBe(-1000);
  expect(distributableProfit(fleet,paid.state)).toBeCloseTo(profit-1000);
  expect(()=>payDividend(paid.state,16000,20000,profit,5000,Date.now())).toThrow();
 });
 it('retires investor shares and restores founder ownership',()=>{
  const issued=issueShares(undefined,'investor-0','Investor',25000,100000,Date.UTC(2026,10,1));
  const retired=buybackShares(issued.state,'investor-0',1000,125000,20000,5000,Date.UTC(2026,10,3));
  expect(retired.cashDelta).toBe(-10000);
  expect(ownership(retired.state,'founder')).toBeGreaterThan(80);
  expect(()=>buybackShares(retired.state,'founder',1,125000,20000,5000,Date.now())).toThrow();
 });
 it('records one snapshot per simulated day',()=>{
  const valuation=valueCompany(company,fleet,Date.UTC(2026,10,1));
  const first=recordValuation(undefined,valuation,Date.UTC(2026,10,1));
  const second=recordValuation(first,valuation,Date.UTC(2026,10,1));
  expect(second).toBe(first);
  expect(first.valuationHistory).toHaveLength(1);
 });
});
