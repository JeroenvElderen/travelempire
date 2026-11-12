import {describe,expect,it} from 'vitest';
import {buildDailySummary,dayBaseline,gameDay} from './dailySummary';
import type {FleetState} from './taxi';
const fleet=(overrides:Partial<FleetState>={}):FleetState=>({
 taxis:[],revenue:0,completed:0,exploredEdgeIds:[],
 ...overrides
});
describe('midnight daily summary',()=>{
 it('uses UTC game-day boundaries rather than the real local calendar',()=>{
  expect(gameDay(Date.parse('2026-11-24T23:59:59Z'))).toBe('2026-11-24');
  expect(gameDay(Date.parse('2026-11-25T00:00:00Z'))).toBe('2026-11-25');
 });
 it('reports booked profits, trips, distance, discoveries and outstanding debts',()=>{
  const baseline=dayBaseline('2026-11-24',fleet({exploredEdgeIds:['old']}),5000,2);
  const summary=buildDailySummary('2026-11-24',fleet({
   exploredEdgeIds:['old','a','b'],
   financeHistory:[{day:'2026-11-24',revenue:8000,expenses:2000,trips:4,categories:{fuel:100,maintenance:0,exploration:400,payroll:1000,insurance:50,overhead:450,interest:0}}],
   vehicleFinanceHistory:[{day:'2026-11-24',taxiId:'taxi',name:'Taxi',revenue:6000,expenses:1000,km:150,trips:4}],
   ferryRevenueByDay:{'2026-11-24':1500},
   loans:[{id:'loan',principal:1000,balance:800,annualRate:0,termDays:10,remainingDays:8,dailyPayment:100,accruedGameSeconds:0}]
  }),baseline,9000,3);
  expect(summary).toMatchObject({revenue:8000,expenses:2000,net:6000,trips:4,
   ferryRevenue:1500,taxiRevenue:6000,otherRevenue:500,roadsDiscovered:2,
   harboursDiscovered:1,distanceKm:150,cashChange:4000,loanBalance:800});
 });
 it('builds chart data, passenger and ferry milestones from recorded game history',()=>{
  const previous={day:'2026-11-23',revenue:2000,expenses:1000,trips:1};
  const current={day:'2026-11-24',revenue:4500,expenses:2000,trips:3};
  const summary=buildDailySummary('2026-11-24',fleet({
   financeHistory:[previous,current],
   ferryRevenueByDay:{'2026-11-24':700},
   transactions:[{id:'f',time:Date.parse('2026-11-24T16:00:00Z'),description:'Ferry fare · port',amount:700}],
  }),dayBaseline('2026-11-24',fleet(),100,0),200,0);
  expect(summary.weekly).toHaveLength(2);
  expect(summary.previousNet).toBe(1000);
  expect(summary.previousRevenue).toBe(2000);
  expect(summary.ferryCrossings).toBe(1);
  expect(summary.net).toBe(2500);
 });
 it('does not treat loan proceeds as operating revenue',()=>{
  const summary=buildDailySummary('2026-11-24',fleet(),dayBaseline('2026-11-24',fleet(),1000,0),201000,0);
  expect(summary.revenue).toBe(0);
  expect(summary.net).toBe(0);
  expect(summary.cashChange).toBe(200000);
 });
});
