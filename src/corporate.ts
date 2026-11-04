import type {Company} from './company';
import type {FleetState,CorporateState,CorporateSubsidiary,CorporateLoan,CorporateEvent} from './simulation/taxi';
import {accountingOf,balanceSheet} from './accounting';
import {valueCompany} from './equity';
export const CORPORATE_MARKET=[
 {id:'athens-city',name:'Athens City Taxis',city:'Athens',fleetCount:12,depotCount:2,price:185000,cash:18000,vehicleAssets:150000,depotAssets:32000,externalDebt:15000,revenuePerDay:950,expensesPerDay:620},
 {id:'patras-mobility',name:'Patras Mobility',city:'Patras',fleetCount:8,depotCount:1,price:120000,cash:12000,vehicleAssets:95000,depotAssets:17000,externalDebt:10000,revenuePerDay:650,expensesPerDay:430},
 {id:'thessaloniki-transit',name:'Thessaloniki Transport Group',city:'Thessaloniki',fleetCount:25,depotCount:3,price:460000,cash:40000,vehicleAssets:380000,depotAssets:65000,externalDebt:35000,revenuePerDay:1900,expensesPerDay:1280}
] as const;
export type CorporateMarketOffer=typeof CORPORATE_MARKET[number];
const round=(n:number)=>Math.round(n*100)/100;
const dayOf=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const sum=(items:number[])=>items.reduce((a,b)=>a+b,0);
export const corporateOf=(s?:CorporateState):CorporateState=>s?{...s,subsidiaries:s.subsidiaries.map(x=>({...x})),loans:s.loans.map(x=>({...x})),events:[...s.events]}:{subsidiaries:[],loans:[],events:[],totalAcquisitionSpend:0,totalInterest:0,totalRevenue:0,totalExpenses:0,totalTaxes:0};
const event=(kind:CorporateEvent['kind'],id:string,description:string,amount:number,parentCashDelta:number,subsidiaryCashDelta:number,ms:number):CorporateEvent=>({id:crypto.randomUUID(),gameTime:ms,kind,subsidiaryId:id,description,amount:round(amount),parentCashDelta:round(parentCashDelta),subsidiaryCashDelta:round(subsidiaryCashDelta)});
export function negotiatePrice(offer:CorporateMarketOffer,discountPercent:number){
 if(!Number.isFinite(discountPercent)||discountPercent<0||discountPercent>10)throw Error('Negotiation discount must be 0–10%.');
 return round(offer.price*(1-discountPercent/100));
}
export function corporateCreditCapacity(fleet:FleetState){
 const ordinary=(fleet.loans??[]).reduce((a,l)=>a+l.balance,0);
 const corporate=(fleet.corporate?.loans??[]).reduce((a,l)=>a+l.balance,0);
 return Math.max(0,75000-ordinary-corporate);
}
export function acquireCompany(stateValue:CorporateState|undefined,fleet:FleetState,offerId:string,discount:number,loanPercent:number,operatingCash:number,minimumReserve:number,gameMs:number){
 const state=corporateOf(stateValue);
 const offer=CORPORATE_MARKET.find(o=>o.id===offerId);
 if(!offer)throw Error('Company not found in the acquisition marketplace.');
 if(state.subsidiaries.some(s=>s.id===offer.id))throw Error('This company has already been acquired.');
 if(!Number.isFinite(loanPercent)||loanPercent<0||loanPercent>100)throw Error('Invalid acquisition financing.');
 const price=negotiatePrice(offer,discount);
 const loanAmount=round(price*loanPercent/100);
 if(loanAmount>corporateCreditCapacity({...fleet,corporate:state}))throw Error('Acquisition borrowing exceeds the shared €75,000 debt ceiling.');
 const downPayment=round(price-loanAmount);
 if(downPayment>operatingCash-minimumReserve)throw Error('Insufficient operating cash after the minimum reserve.');
 const annualRate=.09,term=180,dailyPayment=round(loanAmount*annualRate/365/(1-Math.pow(1+annualRate/365,-term)));
 const loan:CorporateLoan|undefined=loanAmount>0?{id:crypto.randomUUID(),principal:loanAmount,balance:loanAmount,annualRate,dailyPayment,remainingDays:term,targetId:offer.id}:undefined;
 const subsidiary:CorporateSubsidiary={id:offer.id,name:offer.name,city:offer.city,createdDay:dayOf(gameMs),source:'acquired',ownershipPercent:100,fleetCount:offer.fleetCount,depotCount:offer.depotCount,drivers:offer.fleetCount,cash:offer.cash,vehicleAssets:offer.vehicleAssets,depotAssets:offer.depotAssets,goodwill:round(price-(offer.cash+offer.vehicleAssets+offer.depotAssets-offer.externalDebt)),externalDebt:offer.externalDebt,revenuePerDay:offer.revenuePerDay,expensesPerDay:offer.expensesPerDay,retainedEarnings:0,taxPaid:0,accumulatedRevenue:0,accumulatedExpenses:0,lastSettledDay:dayOf(gameMs),active:true};
 const events=[event('acquisition',offer.id,'Acquire '+offer.name,price,-price,0,gameMs)];
 if(loan)events.unshift(event('loan',offer.id,'Acquisition loan drawdown',loanAmount,loanAmount,0,gameMs));
 return {state:{...state,subsidiaries:[...state.subsidiaries,subsidiary],loans:loan?[...state.loans,loan]:state.loans,events:[...events,...state.events].slice(0,1000),totalAcquisitionSpend:state.totalAcquisitionSpend+price},parentCashDelta:-downPayment,events,subsidiary};
}
export function foundSubsidiary(stateValue:CorporateState|undefined,name:string,city:string,capital:number,operatingCash:number,minimumReserve:number,gameMs:number){
 const state=corporateOf(stateValue);
 if(!name.trim()||name.trim().length>60||!city.trim())throw Error('Enter a subsidiary name and city.');
 if(!Number.isFinite(capital)||capital<10000||capital>1000000)throw Error('Founding capital must be between €10,000 and €1,000,000.');
 if(capital>operatingCash-minimumReserve)throw Error('Insufficient operating cash after reserve.');
 const id=crypto.randomUUID();
 const subsidiary:CorporateSubsidiary={id,name:name.trim(),city:city.trim(),createdDay:dayOf(gameMs),source:'founded',ownershipPercent:100,fleetCount:0,depotCount:0,drivers:0,cash:round(capital),vehicleAssets:0,depotAssets:0,goodwill:0,externalDebt:0,revenuePerDay:0,expensesPerDay:0,retainedEarnings:0,taxPaid:0,accumulatedRevenue:0,accumulatedExpenses:0,lastSettledDay:dayOf(gameMs),active:true};
 const e=event('formation',id,'Subsidiary capital contribution',capital,-capital,capital,gameMs);
 return {state:{...state,subsidiaries:[...state.subsidiaries,subsidiary],events:[e,...state.events].slice(0,1000)},parentCashDelta:-capital,events:[e],subsidiary};
}
export function transferCorporateCash(stateValue:CorporateState|undefined,id:string,amount:number,direction:'to'|'from',operatingCash:number,minimumReserve:number,gameMs:number){
 const state=corporateOf(stateValue),sub=state.subsidiaries.find(s=>s.id===id&&s.active);
 if(!sub)throw Error('Active subsidiary not found.');
 if(!Number.isFinite(amount)||amount<=0||round(amount)!==amount)throw Error('Enter a positive amount in euros and cents.');
 if(direction==='to'&&amount>operatingCash-minimumReserve)throw Error('Insufficient parent cash after reserve.');
 if(direction==='from'&&amount>sub.cash)throw Error('Insufficient subsidiary cash.');
 const parentCashDelta=direction==='to'?-amount:amount;
 const e=event('transfer',id,direction==='to'?'Intercompany capital transfer to subsidiary':'Intercompany capital transfer to parent',amount,parentCashDelta,-parentCashDelta,gameMs);
 return {state:{...state,subsidiaries:state.subsidiaries.map(s=>s.id===id?{...s,cash:round(s.cash-parentCashDelta)}:s),events:[e,...state.events].slice(0,1000)},parentCashDelta,events:[e]};
}
export function mergeSubsidiaries(stateValue:CorporateState|undefined,sourceId:string,targetId:string,gameMs:number){
 const state=corporateOf(stateValue);
 const source=state.subsidiaries.find(s=>s.id===sourceId&&s.active),target=state.subsidiaries.find(s=>s.id===targetId&&s.active);
 if(!source||!target||source.id===target.id)throw Error('Choose two different active subsidiaries.');
 if(source.ownershipPercent!==100||target.ownershipPercent!==100)throw Error('Only wholly owned subsidiaries can be merged.');
 const merged:CorporateSubsidiary={...target,fleetCount:target.fleetCount+source.fleetCount,depotCount:target.depotCount+source.depotCount,drivers:target.drivers+source.drivers,cash:round(target.cash+source.cash),vehicleAssets:round(target.vehicleAssets+source.vehicleAssets),depotAssets:round(target.depotAssets+source.depotAssets),goodwill:round(target.goodwill+source.goodwill),externalDebt:round(target.externalDebt+source.externalDebt),revenuePerDay:round(target.revenuePerDay+source.revenuePerDay),expensesPerDay:round(target.expensesPerDay+source.expensesPerDay),retainedEarnings:round(target.retainedEarnings+source.retainedEarnings),taxPaid:round(target.taxPaid+source.taxPaid),accumulatedRevenue:round(target.accumulatedRevenue+source.accumulatedRevenue),accumulatedExpenses:round(target.accumulatedExpenses+source.accumulatedExpenses)};
 const e=event('merger',target.id,'Merge '+source.name+' into '+target.name,0,0,0,gameMs);
 return {state:{...state,subsidiaries:state.subsidiaries.map(s=>s.id===sourceId?{...s,active:false,cash:0,vehicleAssets:0,depotAssets:0,externalDebt:0,revenuePerDay:0,expensesPerDay:0,retainedEarnings:0}:s.id===targetId?merged:s),loans:state.loans.map(l=>l.targetId===sourceId?{...l,targetId}:l),events:[e,...state.events].slice(0,1000)},parentCashDelta:0,events:[e]};
}
export function restructureSubsidiary(stateValue:CorporateState|undefined,id:string,deltaVehicles:number,deltaDepots:number,gameMs:number){
 const state=corporateOf(stateValue),sub=state.subsidiaries.find(s=>s.id===id&&s.active);
 if(!sub||!Number.isInteger(deltaVehicles)||!Number.isInteger(deltaDepots)||Math.abs(deltaVehicles)>10||Math.abs(deltaDepots)>5)throw Error('Invalid restructuring request.');
 if(sub.fleetCount+deltaVehicles<0||sub.depotCount+deltaDepots<0)throw Error('Cannot remove more assets than the subsidiary owns.');
 const vehiclePrice=15000,depotPrice=10000;
 const cashDelta=-deltaVehicles*vehiclePrice-deltaDepots*depotPrice;
 if(sub.cash+cashDelta<0)throw Error('Subsidiary cannot afford the proposed asset purchase.');
 const e=event('restructure',id,'Reallocate subsidiary fleet/depot assets',Math.abs(cashDelta),0,cashDelta,gameMs);
 return {state:{...state,subsidiaries:state.subsidiaries.map(s=>s.id===id?{...s,fleetCount:s.fleetCount+deltaVehicles,depotCount:s.depotCount+deltaDepots,drivers:Math.max(0,s.drivers+deltaVehicles),cash:round(s.cash+cashDelta),vehicleAssets:round(s.vehicleAssets+deltaVehicles*vehiclePrice),depotAssets:round(s.depotAssets+deltaDepots*depotPrice),revenuePerDay:Math.max(0,round(s.revenuePerDay+deltaVehicles*65)),expensesPerDay:Math.max(0,round(s.expensesPerDay+deltaVehicles*45+deltaDepots*35))}:s),events:[e,...state.events].slice(0,1000)},parentCashDelta:0,events:[e]};
}
export function transferSubsidiaryAssets(stateValue:CorporateState|undefined,sourceId:string,targetId:string,vehicles:number,depots:number,gameMs:number){
 const state=corporateOf(stateValue);
 const source=state.subsidiaries.find(s=>s.id===sourceId&&s.active),target=state.subsidiaries.find(s=>s.id===targetId&&s.active);
 if(!source||!target||source.id===target.id)throw Error('Select two different active subsidiaries.');
 if(!Number.isSafeInteger(vehicles)||!Number.isSafeInteger(depots)||vehicles<0||depots<0||(!vehicles&&!depots))throw Error('Select a positive whole number of vehicles or depots.');
 if(vehicles>source.fleetCount||depots>source.depotCount)throw Error('Insufficient assets at the source subsidiary.');
 const vehicleAssets=round(source.fleetCount?source.vehicleAssets*vehicles/source.fleetCount:0);
 const depotAssets=round(source.depotCount?source.depotAssets*depots/source.depotCount:0);
 const revenue=round(source.fleetCount?source.revenuePerDay*vehicles/source.fleetCount:0);
 const expenseFraction=Math.min(1,(source.fleetCount?vehicles/source.fleetCount*.85:0)+(source.depotCount?depots/source.depotCount*.15:0));
 const expenses=round(source.expensesPerDay*expenseFraction);
 const drivers=Math.min(source.drivers,vehicles);
 const nextSource={...source,fleetCount:source.fleetCount-vehicles,depotCount:source.depotCount-depots,drivers:source.drivers-drivers,vehicleAssets:round(source.vehicleAssets-vehicleAssets),depotAssets:round(source.depotAssets-depotAssets),revenuePerDay:round(source.revenuePerDay-revenue),expensesPerDay:round(source.expensesPerDay-expenses)};
 const nextTarget={...target,fleetCount:target.fleetCount+vehicles,depotCount:target.depotCount+depots,drivers:target.drivers+drivers,vehicleAssets:round(target.vehicleAssets+vehicleAssets),depotAssets:round(target.depotAssets+depotAssets),revenuePerDay:round(target.revenuePerDay+revenue),expensesPerDay:round(target.expensesPerDay+expenses)};
 const e=event('asset-transfer',target.id,'Move '+vehicles+' vehicles and '+depots+' depots from '+source.name+' to '+target.name,vehicleAssets+depotAssets,0,0,gameMs);
 return {state:{...state,subsidiaries:state.subsidiaries.map(s=>s.id===sourceId?nextSource:s.id===targetId?nextTarget:s),events:[e,...state.events].slice(0,1000)},parentCashDelta:0,events:[e]};
}
export function advanceCorporate(stateValue:CorporateState|undefined,gameMs:number,corporateTaxRate=22){
 const state=corporateOf(stateValue);
 const today=dayOf(gameMs);
 if(!state.lastProcessedDay)return {state:{...state,lastProcessedDay:today},parentCashDelta:0,events:[] as CorporateEvent[],interest:0};
 if(state.lastProcessedDay>=today)return {state,parentCashDelta:0,events:[] as CorporateEvent[],interest:0};
 const elapsed=Math.min(365,Math.floor((Date.parse(today)-Date.parse(state.lastProcessedDay))/86400000));
 let subsidiaries=state.subsidiaries.map(s=>({...s})),loans=state.loans.map(l=>({...l})),revenue=0,expenses=0,taxes=0,interest=0,parentCashDelta=0;
 const events:CorporateEvent[]=[];
 for(let i=0;i<elapsed;i++){
  const tickMs=Date.parse(state.lastProcessedDay)+(i+1)*86400000;
  for(const sub of subsidiaries){
   if(!sub.active||sub.lastSettledDay>=dayOf(tickMs))continue;
   const dailyRevenue=sub.revenuePerDay;
   const dailyExpenses=sub.expensesPerDay;
   const tax=Math.max(0,round((dailyRevenue-dailyExpenses)*corporateTaxRate/100));
   const net=round(dailyRevenue-dailyExpenses-tax);
   sub.cash=round(sub.cash+net);sub.retainedEarnings=round(sub.retainedEarnings+net);sub.accumulatedRevenue=round(sub.accumulatedRevenue+dailyRevenue);sub.accumulatedExpenses=round(sub.accumulatedExpenses+dailyExpenses);sub.taxPaid=round(sub.taxPaid+tax);sub.lastSettledDay=dayOf(tickMs);
   revenue+=dailyRevenue;expenses+=dailyExpenses;taxes+=tax;
  }
  for(const loan of loans){
   if(loan.remainingDays<=0||loan.balance<=0)continue;
   const dailyInterest=round(loan.balance*loan.annualRate/365);
   const paid=Math.min(round(loan.balance+dailyInterest),loan.remainingDays===1?round(loan.balance+dailyInterest):loan.dailyPayment);
   const principal=round(paid-dailyInterest);
   loan.balance=Math.max(0,round(loan.balance-principal));loan.remainingDays--;interest+=dailyInterest;parentCashDelta-=paid;
   events.push(event('repayment',loan.targetId,'Acquisition loan instalment',paid,-paid,0,tickMs));
  }
 }
 return {state:{...state,subsidiaries,loans,events:[...events.reverse(),...state.events].slice(0,1000),lastProcessedDay:dayOf(Date.parse(state.lastProcessedDay)+elapsed*86400000),totalInterest:round(state.totalInterest+interest),totalRevenue:round(state.totalRevenue+revenue),totalExpenses:round(state.totalExpenses+expenses),totalTaxes:round(state.totalTaxes+taxes)},parentCashDelta:round(parentCashDelta),events,interest:round(interest)};
}
export function consolidatedGroup(company:Company,fleet:FleetState){
 const state=corporateOf(fleet.corporate);
 const active=state.subsidiaries.filter(s=>s.active);
 const parent=balanceSheet(fleet,company.cash);
 const subsidiaryCash=sum(active.map(s=>s.cash));
 const subsidiaryAssets=sum(active.map(s=>s.cash+s.vehicleAssets+s.depotAssets+s.goodwill));
 const subsidiaryDebt=sum(active.map(s=>s.externalDebt));
 const acquisitionDebt=sum(state.loans.map(l=>l.balance));
 const parentPeriods=accountingOf(fleet.accounting).periods;
 const parentRevenue=sum(parentPeriods.map(p=>p.netRevenue));
 const parentExpenses=sum(parentPeriods.map(p=>p.netExpenses+p.depreciation));
 const parentTaxes=sum(parentPeriods.map(p=>p.corporateTax));
 // Intercompany transfers, formation capital and share purchases are excluded from P&L.
 // Parent acquisition loans remain separate liabilities; subsidiary cash stays in the subsidiary.
 const assets=round(parent.assets+subsidiaryAssets);
 const liabilities=round(parent.loans+parent.taxLiabilities+subsidiaryDebt+acquisitionDebt);
 const parentCashTaxes=sum(parentPeriods.map(p=>p.corporateTaxPaid+p.vatPaid));
 const equityFinancing=sum((fleet.equity?.events??[]).map(e=>e.amount));
 const loanDrawdowns=sum(state.events.filter(e=>e.kind==='loan').map(e=>e.parentCashDelta));
 const loanRepayments=sum(state.events.filter(e=>e.kind==='repayment').map(e=>e.parentCashDelta));
 const subsidiaryAssetInvestment=sum(state.events.filter(e=>e.kind==='restructure').map(e=>e.subsidiaryCashDelta));
 const cashFlow={
  operating:round(parentRevenue-parentExpenses-parentCashTaxes+state.totalRevenue-state.totalExpenses-state.totalTaxes),
  investing:round(-state.totalAcquisitionSpend+subsidiaryAssetInvestment),
  financing:round(loanDrawdowns+loanRepayments+equityFinancing),
  intercompanyEliminated:round(sum(state.events.filter(e=>e.kind==='transfer'||e.kind==='formation').map(e=>Math.abs(e.parentCashDelta)))),
 };
 const revenue=round(parentRevenue+state.totalRevenue);
 const expenses=round(parentExpenses+state.totalExpenses);
 const taxes=round(parentTaxes+state.totalTaxes);
 return {activeCount:active.length,fleetCount:sum(active.map(s=>s.fleetCount)),depotCount:sum(active.map(s=>s.depotCount)),subsidiaryCash:round(subsidiaryCash),assets,liabilities,equity:round(assets-liabilities),revenue,expenses,taxes,profit:round(revenue-expenses-taxes),parentRevenue:round(parentRevenue),subsidiaryRevenue:state.totalRevenue,subsidiaryExpenses:state.totalExpenses,acquisitionDebt:round(acquisitionDebt),subsidiaryDebt:round(subsidiaryDebt),cashFlow};
}
export function corporateValuation(company:Company,fleet:FleetState,gameMs:number){
 return valueCompany(company,fleet,gameMs).value;
}
