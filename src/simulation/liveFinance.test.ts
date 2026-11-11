import {describe,expect,it} from 'vitest';
import {classifyActivity,dayFinance,dayExpenseBreakdown,recentActivity} from './liveFinance';
import type {FinancePeriod,FinancialTransaction} from './taxi';

const time=Date.UTC(2026,11,17,8,50);
const entry=(description:string,amount:number):FinancialTransaction=>({
 id:description,time,description,amount
});
describe('live finance header',()=>{
 it('calculates operating income and expenses for the simulated day only',()=>{
  const history:FinancePeriod[]=[
   {day:'2026-12-16',revenue:800,expenses:500,trips:8},
   {day:'2026-12-17',revenue:120,expenses:40,trips:2},
   {day:'2026-12-17',revenue:50,expenses:10,trips:0}
  ];
  expect(dayFinance(history,time)).toEqual({income:170,expenses:50,net:120});
 });
 it('does not derive revenue from loan disbursements',()=>{
  const history=[{day:'2026-12-17',revenue:25,expenses:10,trips:1}];
  const transactions=[entry('Secured business loan disbursement',250000),entry('Taxi 1 · passenger fare',25)];
  expect(dayFinance(history,time).net).toBe(15);
  expect(recentActivity(transactions)[0].type).toBe('financing');
  expect(recentActivity(transactions)[1].type).toBe('income');
 });
 it('recognises operating expenses separately from capital flows',()=>{
  expect(classifyActivity(entry('Explorer · automatic refuel',-45))).toBe('expense');
  expect(classifyActivity(entry('Taxi · automatic scheduled service',-150))).toBe('expense');
  expect(classifyActivity(entry('Vehicle purchase',-20000))).toBe('financing');
  expect(classifyActivity(entry('Scheduled loan repayment',-150))).toBe('financing');
  expect(classifyActivity(entry('Property income',120))).toBe('income');
 });
 it('shows real expense categories and residual costs from posted daily history',()=>{
  const history:FinancePeriod[]=[{
   day:'2026-12-17',revenue:100,expenses:45,trips:1,
   categories:{fuel:10,maintenance:5,exploration:0,payroll:15,insurance:2,overhead:3,interest:0}
  }];
  const breakdown=dayExpenseBreakdown(history,time);
  expect(breakdown.find(e=>e.category==='payroll')?.value).toBe(15);
  expect(breakdown.find(e=>e.category==='other')?.value).toBe(10);
  expect(breakdown.every(e=>e.value>0)).toBe(true);
 });
 it('limits the expandable activity list to the newest 20 records',()=>{
  const entries=Array.from({length:25},(_,i)=>entry('Taxi fare '+i,12));
  expect(recentActivity(entries)).toHaveLength(20);
 });
 it('keeps financing and repossession recoveries distinct from profit',()=>{
  expect(classifyActivity(entry('Bank repossession · vehicle debt recovered (non-cash)',0))).toBe('financing');
  expect(classifyActivity(entry('Business loan disbursement',50000))).toBe('financing');
 });
});
