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
 it('separates both bank shares from operating profit and reconciles negative cash',()=>{
  const day='2027-01-04';
  const companies=fleet({
   financeHistory:[{day,revenue:10000,expenses:1000,trips:3}],
   bankPartnershipPaidByDay:{[day]:4100},
   bankPartnershipPaidByLenderByDay:{[day]:{'Empire Investment Group':2500,'Growth Capital Bank':1600}},
   bankPartnerships:[
    {id:'empire',bank:'Empire Investment Group',principal:10000,revenueShare:25,repaymentMultiple:1.5,repaymentCap:15000,repaid:2500,startedAt:0},
    {id:'growth',bank:'Growth Capital Bank',principal:10000,revenueShare:16,repaymentMultiple:1.5,repaymentCap:15000,repaid:1600,startedAt:0}
   ]
  });
  const summary=buildDailySummary(day,companies,dayBaseline(day,companies,2000,0),-392.33,0);
  expect(summary.net).toBe(9000);
  expect(summary.bankRepayments).toBe(4100);
  expect(summary.cashAfterBankRepayments).toBe(4900);
  expect(summary.activeBankShare).toBe(41);
  expect(summary.openingCash).toBe(2000);
  expect(summary.cashChange).toBe(-2392.33);
  expect(summary.otherCashMovements).toBe(-7292.33);
  expect(summary.bankLenderRepayments).toEqual([
   {bank:'Empire Investment Group',amount:2500,sharePercent:25},
   {bank:'Growth Capital Bank',amount:1600,sharePercent:16}
  ]);
  expect(Math.round((summary.openingCash+summary.cashAfterBankRepayments!+summary.otherCashMovements!)*100)/100).toBe(summary.cash);
 });
 it('distinguishes unrecorded legacy bank history from a genuine zero',()=>{
  const day='2027-01-04';
  const old=fleet({financeHistory:[{day,revenue:200,expenses:100,trips:1}]});
  const legacy=buildDailySummary(day,old,dayBaseline(day,old,0,0),100,0);
  expect(legacy.bankRepayments).toBeNull();
  expect(legacy.cashAfterBankRepayments).toBeNull();
  expect(legacy.otherCashMovements).toBeNull();
  const saved=fleet({...old,bankPartnershipPaidByDay:{[day]:0}});
  const recorded=buildDailySummary(day,saved,dayBaseline(day,saved,0,0),100,0);
  expect(recorded.bankRepayments).toBe(0);
  expect(recorded.cashAfterBankRepayments).toBe(100);
  expect(recorded.otherCashMovements).toBe(0);
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
