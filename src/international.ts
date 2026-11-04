import type {FleetState,CorporateState,CorporateEvent,CorporateSubsidiary} from './simulation/taxi';
import {corporateOf,foundSubsidiary,corporateCreditCapacity} from './corporate';
export const INTERNATIONAL_COUNTRIES=[
 {code:'GRC',name:'Greece',currency:'EUR',eurPerUnit:1,corporateTax:22,licenseCost:0,setupCost:0},
 {code:'IRL',name:'Ireland',currency:'EUR',eurPerUnit:1,corporateTax:12.5,licenseCost:3500,setupCost:4000},
 {code:'NLD',name:'Netherlands',currency:'EUR',eurPerUnit:1,corporateTax:25.8,licenseCost:4000,setupCost:5000},
 {code:'DEU',name:'Germany',currency:'EUR',eurPerUnit:1,corporateTax:30,licenseCost:5000,setupCost:6000},
 {code:'GBR',name:'United Kingdom',currency:'GBP',eurPerUnit:1.17,corporateTax:25,licenseCost:5000,setupCost:6500},
 {code:'POL',name:'Poland',currency:'PLN',eurPerUnit:.235,corporateTax:19,licenseCost:2500,setupCost:3000},
 {code:'SWE',name:'Sweden',currency:'SEK',eurPerUnit:.091,corporateTax:20.6,licenseCost:4500,setupCost:5500},
 {code:'USA',name:'United States',currency:'USD',eurPerUnit:.92,corporateTax:26,licenseCost:7500,setupCost:9000}
] as const;
export type CountryCode=typeof INTERNATIONAL_COUNTRIES[number]['code'];
export const countryFor=(code:string)=>INTERNATIONAL_COUNTRIES.find(c=>c.code===code)??INTERNATIONAL_COUNTRIES[0];
export const euro=(local:number,code:string)=>Math.round(local*countryFor(code).eurPerUnit*100)/100;
export const local=(amountEUR:number,code:string)=>Math.round(amountEUR/countryFor(code).eurPerUnit*100)/100;
export const FOREIGN_MARKET=[
 {id:'dublin-cabs',name:'Dublin City Cabs',city:'Dublin',countryCode:'IRL',price:58000,vehicles:5,depots:1,revenue:390,expenses:255},
 {id:'london-rides',name:'London Rides Ltd',city:'London',countryCode:'GBR',price:72000,vehicles:7,depots:1,revenue:570,expenses:380},
 {id:'warsaw-mobility',name:'Warsaw Mobility',city:'Warsaw',countryCode:'POL',price:42000,vehicles:6,depots:1,revenue:410,expenses:270},
 {id:'stockholm-taxi',name:'Stockholm Taxi AB',city:'Stockholm',countryCode:'SWE',price:68000,vehicles:6,depots:2,revenue:510,expenses:345},
 {id:'berlin-transfer',name:'Berlin Transfer GmbH',city:'Berlin',countryCode:'DEU',price:63000,vehicles:6,depots:1,revenue:475,expenses:325},
 {id:'amsterdam-cabs',name:'Amsterdam Cabs BV',city:'Amsterdam',countryCode:'NLD',price:64000,vehicles:5,depots:2,revenue:480,expenses:310}
] as const;
const round=(n:number)=>Math.round(n*100)/100;
const record=(kind:CorporateEvent['kind'],id:string,description:string,amount:number,parentCashDelta:number,subsidiaryCashDelta:number,gameTime:number):CorporateEvent=>({id:crypto.randomUUID(),kind,subsidiaryId:id,description,amount:round(amount),parentCashDelta:round(parentCashDelta),subsidiaryCashDelta:round(subsidiaryCashDelta),gameTime});
export function establishForeignSubsidiary(stateValue:CorporateState|undefined,name:string,city:string,code:CountryCode,capital:number,parentCash:number,reserve:number,gameMs:number){
 const country=countryFor(code);
 if(country.code==='GRC')throw Error('Use domestic subsidiary formation for Greece.');
 const fees=country.licenseCost+country.setupCost;
 if(capital+fees>parentCash-reserve)throw Error('Insufficient funds for capital, licensing and setup.');
 const created=foundSubsidiary(stateValue,name,city,capital,parentCash-fees,reserve,gameMs);
 const updated:CorporateSubsidiary={...created.subsidiary,countryCode:code,currencyCode:country.currency,localCash:local(capital,code),fxRateToEUR:country.eurPerUnit,foreignTaxRate:country.corporateTax,licensePaid:true};
 const e=record('formation',updated.id,'Foreign licensing and registration: '+country.name,fees,-fees,0,gameMs);
 return {state:{...created.state,subsidiaries:created.state.subsidiaries.map(s=>s.id===updated.id?updated:s),events:[e,...created.state.events].slice(0,1000)},parentCashDelta:round(-capital-fees),events:[...created.events,e],subsidiary:updated};
}
export function acquireForeignBusiness(stateValue:CorporateState|undefined,fleet:FleetState,id:string,loanPercent:number,parentCash:number,reserve:number,gameMs:number){
 const offer=FOREIGN_MARKET.find(o=>o.id===id);
 if(!offer)throw Error('Foreign business not found.');
 const state=corporateOf(stateValue);
 if(state.subsidiaries.some(s=>s.id===id))throw Error('This business is already acquired.');
 if(!Number.isFinite(loanPercent)||loanPercent<0||loanPercent>100)throw Error('Financing must be between 0% and 100%.');
 const country=countryFor(offer.countryCode);
 const fees=country.licenseCost;
 const loanAmount=round(offer.price*loanPercent/100);
 if(loanAmount>corporateCreditCapacity({...fleet,corporate:state}))throw Error('Insufficient shared acquisition credit.');
 const down=round(offer.price-loanAmount+fees);
 if(down>parentCash-reserve)throw Error('Insufficient parent operating cash after reserve.');
 const subsidiaryCash=round(offer.price*.08);
 const vehicleAssets=round(offer.price*.65),depotAssets=round(offer.price*.18),externalDebt=round(offer.price*.12);
 const goodwill=round(offer.price-(subsidiaryCash+vehicleAssets+depotAssets-externalDebt));
 const subsidiary:CorporateSubsidiary={id,name:offer.name,city:offer.city,source:'acquired',createdDay:new Date(gameMs).toISOString().slice(0,10),ownershipPercent:100,fleetCount:offer.vehicles,depotCount:offer.depots,drivers:offer.vehicles,cash:subsidiaryCash,vehicleAssets,depotAssets,goodwill,externalDebt,revenuePerDay:offer.revenue,expensesPerDay:offer.expenses,retainedEarnings:0,taxPaid:0,accumulatedRevenue:0,accumulatedExpenses:0,lastSettledDay:new Date(gameMs).toISOString().slice(0,10),active:true,countryCode:country.code,currencyCode:country.currency,localCash:local(subsidiaryCash,country.code),fxRateToEUR:country.eurPerUnit,foreignTaxRate:country.corporateTax,licensePaid:true};
 const loan=loanAmount>0?{id:crypto.randomUUID(),principal:loanAmount,balance:loanAmount,annualRate:.09,dailyPayment:round(loanAmount*.09/365/(1-Math.pow(1+.09/365,-180))),remainingDays:180,targetId:id}:null;
 const events=[record('acquisition',id,'Foreign acquisition: '+offer.name,offer.price,-offer.price,0,gameMs),record('acquisition',id,'Foreign operating license',fees,-fees,0,gameMs)];
 if(loan)events.unshift(record('loan',id,'International acquisition loan',loanAmount,loanAmount,0,gameMs));
 return {state:{...state,subsidiaries:[...state.subsidiaries,subsidiary],loans:loan?[...state.loans,loan]:state.loans,events:[...events,...state.events].slice(0,1000),totalAcquisitionSpend:round(state.totalAcquisitionSpend+offer.price+fees)},parentCashDelta:-down,events,subsidiary};
}
export function crossBorderTransfer(stateValue:CorporateState|undefined,id:string,localAmount:number,direction:'to'|'from',parentCash:number,reserve:number,gameMs:number){
 const state=corporateOf(stateValue),sub=state.subsidiaries.find(s=>s.id===id&&s.active);
 if(!sub||!sub.countryCode||sub.countryCode==='GRC')throw Error('Select an active foreign subsidiary.');
 if(!Number.isFinite(localAmount)||localAmount<=0||round(localAmount)!==localAmount)throw Error('Enter a positive local-currency amount with at most two decimals.');
 const amountEUR=euro(localAmount,sub.countryCode);
 const fee=round(Math.max(1,amountEUR*.005));
 if(direction==='to'&&amountEUR+fee>parentCash-reserve)throw Error('Insufficient parent cash after reserve and FX fee.');
 if(direction==='from'&&localAmount>(sub.localCash??local(sub.cash,sub.countryCode)))throw Error('Insufficient local-currency cash.');
 const parentCashDelta=direction==='to'?-(amountEUR+fee):amountEUR-fee;
 const subsidiaryDelta=direction==='to'?amountEUR:-amountEUR;
 const e=record('transfer',id,'Cross-border '+countryFor(sub.countryCode).currency+' transfer; FX fee €'+fee,amountEUR,parentCashDelta,subsidiaryDelta,gameMs);
 const result=state.subsidiaries.map(s=>s.id===id?{...s,cash:round(s.cash+subsidiaryDelta),localCash:round((s.localCash??local(s.cash,s.countryCode??'GRC'))+(direction==='to'?localAmount:-localAmount))}:s);
 return {state:{...state,subsidiaries:result,events:[e,...state.events].slice(0,1000)},parentCashDelta,events:[e],fee};
}
export function internationalSnapshot(stateValue:CorporateState|undefined){
 const state=corporateOf(stateValue),foreign=state.subsidiaries.filter(s=>s.active&&s.countryCode&&s.countryCode!=='GRC');
 return {foreignCount:foreign.length,countries:new Set(foreign.map(s=>s.countryCode)).size,foreignCashEUR:round(foreign.reduce((a,s)=>a+s.cash,0)),dailyRevenueEUR:round(foreign.reduce((a,s)=>a+s.revenuePerDay,0)),dailyExpensesEUR:round(foreign.reduce((a,s)=>a+s.expensesPerDay,0)),dailyTaxEUR:round(foreign.reduce((a,s)=>a+Math.max(0,(s.revenuePerDay-s.expensesPerDay)*(s.foreignTaxRate??22)/100),0)),forecast30DaysEUR:round(foreign.reduce((a,s)=>a+30*(s.revenuePerDay-s.expensesPerDay)*(1-(s.foreignTaxRate??22)/100),0))};
}
