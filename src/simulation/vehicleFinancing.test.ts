import {describe,it,expect} from 'vitest';
import type {Company} from '../company';
import type {FleetState,Taxi} from './taxi';
import {DRIVER_COST} from './taxi';
import {createSecuredLoan} from './securedLoans';
import {vehicleFinanceQuote} from './vehicleFinancing';

const company:Company={
 id:'test',name:'Test Taxi',createdAt:'2026-11-11T00:00:00.000Z',
 startingCapital:250000,cash:250000,currency:'EUR',
 regionClaimStatus:'pending',depotStatus:'not_placed',
 headquarters:{lng:23.9,lat:37.9,label:'Test HQ',region:'Attica',country:'Greece',countryCode:'GRC'},depots:[]
};
const emptyFleet=():FleetState=>({taxis:[],revenue:0,completed:0,loans:[]});
const ownedTaxi:Taxi={
 id:'owned',name:'Owned',driver:'Driver',kind:'taxi',position:[23.9,37.9],
 status:'IDLE',path:[],edgeIds:[],leg:0,distanceIntoLeg:0,
 fare:0,completed:0,ownership:'owned',purchasePrice:60000,vehicleYear:2026,vehicleCondition:100
};
describe('vehicle financing shares the business credit facility',()=>{
 it('finances a batch of more than two cars when capital and credit allow it',()=>{
  const quote=vehicleFinanceQuote(company,emptyFleet(),0,20000,4,25,365);
  expect(quote.approved).toBe(true);
  expect(quote.principal).toBe(60000);
  expect(quote.upfront).toBe(4*(5000+DRIVER_COST));
  expect(quote.dailyPayment).toBeGreaterThan(0);
  expect(quote.rate).toBeGreaterThan(0);
 });
 it('does not block additional loans on a fixed active-loan count',()=>{
  const fleet={...emptyFleet(),loans:[createSecuredLoan(1000,.08,365),createSecuredLoan(1000,.08,365)]};
  expect(vehicleFinanceQuote(company,fleet,0,20000,1,25,365).approved).toBe(true);
 });
 it('permits collateral-secured vehicle finance when general credit is exhausted',()=>{
  const fleet={...emptyFleet(),loans:[createSecuredLoan(300000,.08,365)]};
  const quote=vehicleFinanceQuote(company,fleet,0,20000,1,35,365);
  expect(quote.businessAvailable).toBe(0);
  expect(quote.assetCredit).toBe(13000);
  expect(quote.approved).toBe(true);
  expect(quote.principal).toBe(13000);
 });
 it('requires a larger deposit when the new vehicles do not cover the requested principal',()=>{
  const fleet={...emptyFleet(),loans:[createSecuredLoan(300000,.08,365)]};
  const denied=vehicleFinanceQuote(company,fleet,0,20000,5,10,365);
  expect(denied.approved).toBe(false);
  expect(denied.minimumDepositPercent).toBe(35);
  expect(denied.reason).toContain('at least 35% deposit');
 });
 it('protects the operating cash reserve during financed purchases',()=>{
  const quote=vehicleFinanceQuote({...company,cash:5500},emptyFleet(),0,20000,1,25,365);
  expect(quote.approved).toBe(false);
  expect(quote.spendableCash).toBe(500);
  expect(quote.reason).toContain('reserve');
 });
 it('explains cash shortages even when assets support the loan',()=>{
  const lowCash={...company,cash:1000};
  const fleet={...emptyFleet(),taxis:[ownedTaxi]};
  const quote=vehicleFinanceQuote(lowCash,fleet,0,20000,1,25,365);
  expect(quote.approved).toBe(false);
  expect(quote.reason).toContain('upfront');
 });
 it('rejects poor credit, invalid deposit and unsupported term',()=>{
  const poor={...emptyFleet(),creditMisses:25};
  expect(vehicleFinanceQuote(company,poor,0,20000,1,25,365).reason).toContain('credit score');
  expect(vehicleFinanceQuote(company,emptyFleet(),0,20000,1,95,365).approved).toBe(false);
  expect(vehicleFinanceQuote(company,emptyFleet(),0,20000,1,33,365).approved).toBe(true);
  expect(vehicleFinanceQuote(company,emptyFleet(),0,20000,1,25,12).approved).toBe(false);
 });
});
