import {describe,it,expect} from 'vitest';
import type {Company} from '../company';
import type {FleetState,Taxi,BusinessLoan} from './taxi';
import {advanceSecuredLoans,appraisedVehicleValue,createSecuredLoan,lendingAssessment,
 securedQuote,LOAN_TERMS} from './securedLoans';

const company:Company={
 id:'test',name:'Test Taxi',createdAt:'2026-11-11T00:00:00.000Z',
 startingCapital:250000,cash:250000,currency:'EUR',
 regionClaimStatus:'pending',depotStatus:'not_placed',
 headquarters:{lng:23.9,lat:37.9,label:'Test Headquarters',region:'Attica',country:'Greece',countryCode:'GRC'},depots:[]
};
const emptyFleet=():FleetState=>({taxis:[],revenue:0,completed:0,loans:[]});
const vehicle=(id:string,price:number,kind:'taxi'|'explorer'='taxi'):Taxi=>({
 id,kind,name:id,driver:'Driver',position:[23.9,37.9],
 status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,
 fare:0,completed:0,ownership:'owned',purchasePrice:price,
 vehicleYear:2026,vehicleCondition:100
});
const dueLoan=(principal=5000):BusinessLoan=>({
 ...createSecuredLoan(principal,.08,180),
 accruedGameSeconds:86400,dailyPayment:100
});
describe('asset-backed custom business lending',()=>{
 it('uses the company value as the maximum first secured loan for strong credit',()=>{
  const assets=lendingAssessment(company,emptyFleet(),0);
  expect(assets.companyValue).toBeGreaterThanOrEqual(249000);
  expect(assets.score).toBeGreaterThanOrEqual(700);
  expect(assets.available).toBe(assets.companyValue);
  expect(securedQuote(company,emptyFleet(),0,assets.available,730).approved).toBe(true);
 });
 it('requires credit approval, a valid term and remaining asset-backed capacity',()=>{
  const base=emptyFleet();
  const assets=lendingAssessment(company,base,0);
  expect(securedQuote(company,base,0,assets.available+1000,730).approved).toBe(false);
  expect(securedQuote(company,base,0,2000,12).approved).toBe(false);
  expect(LOAN_TERMS).toContain(730);
  const poor={...base,creditMisses:25};
  expect(securedQuote(company,poor,0,2000,730).approved).toBe(false);
 });
 it('uses actual cash to pay scheduled instalments without default',()=>{
  const loan=dueLoan();
  const result=advanceSecuredLoans([loan],0,120,[]);
  expect(result.paymentCount).toBe(1);
  expect(result.payments).toBe(100);
  expect(result.missed).toBe(0);
  expect(result.loans[0].remainingDays).toBe(179);
  expect(result.repossessions).toHaveLength(0);
 });
 it('does not invent loan payments when the company lacks cash',()=>{
  const loan=dueLoan();
  const result=advanceSecuredLoans([loan],0,0,[]);
  expect(result.payments).toBe(0);
  expect(result.missed).toBe(1);
  expect(result.loans[0].remainingDays).toBe(180);
  expect(result.loans[0].balance).toBeGreaterThan(loan.balance);
 });
 it('reposesses an owned paid taxi after three consecutive missed instalments',()=>{
  const loan={...dueLoan(),accruedGameSeconds:3*86400};
  const taxi=vehicle('collateral',3000);
  const explorer=vehicle('free-explorer',0,'explorer');
  const result=advanceSecuredLoans([loan],0,0,[taxi,explorer]);
  expect(result.missed).toBe(3);
  expect(result.repossessions).toHaveLength(1);
  expect(result.repossessions[0].vehicleId).toBe('collateral');
  expect(result.repossessions[0].value).toBe(2100);
  expect(result.taxis).toEqual([explorer]);
  expect(result.loans[0].balance).toBeLessThan(loan.balance);
  expect(result.payments).toBe(0);
 });
 it('never repossesses leased vehicles or free explorers',()=>{
  const lease={...vehicle('leased',5000),ownership:'leased' as const};
  const explorer=vehicle('explorer',0,'explorer');
  expect(appraisedVehicleValue(lease)).toBe(0);
  const result=advanceSecuredLoans([{...dueLoan(),accruedGameSeconds:3*86400}],
   0,0,[lease,explorer]);
  expect(result.repossessions).toHaveLength(0);
  expect(result.taxis).toHaveLength(2);
 });
 it('repeated evaluation does not charge or repossess again before the next game day',()=>{
  const loan=dueLoan();
  const once=advanceSecuredLoans([loan],0,120,[]);
  const twice=advanceSecuredLoans(once.loans,0,120,[]);
  expect(twice.payments).toBe(0);
  expect(twice.paymentCount).toBe(0);
 });
});
