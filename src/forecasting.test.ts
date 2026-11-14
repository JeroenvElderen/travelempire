import {describe,it,expect} from 'vitest';
import {forecastBusiness,type ForecastPlan} from './forecasting';
import type {Company} from './company';
import type {FleetState} from './simulation/taxi';
const start=Date.UTC(2026,10,1);
const company:Company={id:'test',name:'Test',createdAt:'2026-11-01',headquarters:{lng:0,lat:0,label:'Test',region:'Test',country:'Greece',countryCode:'GRC'},startingCapital:100000,cash:10000,currency:'EUR',regionClaimStatus:'pending',depotStatus:'not_placed'};
const fleet:FleetState={taxis:[],revenue:1000,completed:10,financeHistory:[{day:'2026-11-01',revenue:1000,expenses:200,trips:10,categories:{fuel:100,maintenance:0,exploration:0,payroll:50,insurance:0,overhead:50,interest:0}}]};
const plan:ForecastPlan={scenario:'expected',days:30,vehicleId:'prius-used',vehicleCount:1,mode:'none',depositPercent:25,financeDays:90,depotId:'main',depotUpgrade:'none',newDepot:false};
describe('finance forecasting',()=>{
 it('is deterministic and does not mutate saved finance data',()=>{
  const before=JSON.stringify(fleet);
  const first=forecastBusiness(company,fleet,plan,start,start);
  const second=forecastBusiness(company,fleet,plan,start,start);
  expect(first).toEqual(second);
  expect(JSON.stringify(fleet)).toBe(before);
  expect(first.points).toHaveLength(31);
 });
 it('reduces closing cash for upfront fleet purchases',()=>{
  const baseline=forecastBusiness(company,fleet,plan,start,start);
  const expanded=forecastBusiness(company,fleet,{...plan,mode:'cash'},start,start);
  expect(expanded.investmentCost).toBeGreaterThan(0);
  expect(expanded.warnings.some(w=>w.includes('exceeds current operating cash'))).toBe(true);
  expect(expanded.points[0].cash).toBeLessThan(baseline.points[0].cash);
 });
 it('schedules repayments and respects the requested horizon',()=>{
  const finance=forecastBusiness(company,fleet,{...plan,mode:'finance',days:90},start,start);
  expect(finance.points).toHaveLength(91);
  expect(finance.totalLoanPayments).toBeGreaterThan(0);
  expect(finance.points[0].capitalSpending).toBeGreaterThan(0);
 });
 it('uses complete booked ferry expenses even when categories omit them',()=>{
  const withFerry={...fleet,financeHistory:[{day:'2026-11-01',revenue:1000,expenses:800,trips:0,categories:{fuel:0,maintenance:0,exploration:0,payroll:0,insurance:0,overhead:0,interest:0}}]};
  const projection=forecastBusiness(company,withFerry,plan,start,start);
  expect(projection.baselineDailyExpenses).toBe(800);
  expect(projection.baselineDailyRevenue).toBe(1000);
 });
 it('projects contractual bank deductions without counting them as operating expenses',()=>{
  const withBank={...fleet,bankPartnerships:[{id:'growth',bank:'Growth Capital Bank',principal:10000,revenueShare:18,repaymentMultiple:1.45,repaymentCap:14500,repaid:0,startedAt:start}]};
  const baseline=forecastBusiness(company,fleet,plan,start,start);
  const projection=forecastBusiness(company,withBank,plan,start,start);
  expect(projection.totalBankRevenueShares).toBeGreaterThan(0);
  expect(projection.totalOperatingExpenses).toBe(baseline.totalOperatingExpenses);
  expect(projection.closingCash).toBeLessThan(baseline.closingCash);
 });
 it('models savings transfers without counting them as expenses',()=>{
  const saved={...fleet,bank:{savings:0,reserve:0,autoSavePercent:10,minimumOperatingCash:0,entries:[]}};
  const projection=forecastBusiness(company,saved,plan,start,start);
  expect(projection.totalSavingsTransfers).toBeGreaterThan(0);
  expect(projection.closingSavings).toBeGreaterThan(0);
 });
});
