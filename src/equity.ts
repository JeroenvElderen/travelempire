import type {Company} from './company';
import type {EquityState,EquityHolder,EquityEvent,FleetState,ValuationPoint} from './simulation/taxi';
import {balanceSheet,accountingOf} from './accounting';
import {depotDailyTotal,depotCapacity,upgradesFor,DEPOT_UPGRADES} from './depotFinance';

export const FOUNDER_ID='founder';
export const INITIAL_SHARES=10000;
const round=(n:number)=>Math.round(n*100)/100;
const dayKey=(ms:number)=>new Date(ms).toISOString().slice(0,10);
const sum=(items:number[])=>items.reduce((a,b)=>a+b,0);
export const equityOf=(value?:EquityState):EquityState=>value?{...value,holders:value.holders.map(h=>({...h})),events:[...value.events],valuationHistory:[...value.valuationHistory]}:{holders:[{id:FOUNDER_ID,name:'Founder',shares:INITIAL_SHARES,votesPerShare:1,invested:0,dividendsReceived:0}],events:[],valuationHistory:[],totalDividends:0,issuedCapital:0};
export const shareTotal=(state:EquityState)=>sum(state.holders.map(h=>h.shares));
export const ownership=(state:EquityState,id:string)=>shareTotal(state)>0?100*(state.holders.find(h=>h.id===id)?.shares??0)/shareTotal(state):0;
export const votingPercent=(state:EquityState,id:string)=>{const total=sum(state.holders.map(h=>h.shares*h.votesPerShare));return total>0?100*(state.holders.find(h=>h.id===id)?.shares??0)*(state.holders.find(h=>h.id===id)?.votesPerShare??1)/total:0;};
export type Valuation={value:number;assetValue:number;earningsValue:number;growthValue:number;profitPerDay:number;confidence:number;depotAssets:number;investorConfidence:number;reasons:string[]};
export function valueCompany(company:Company,fleet:FleetState,gameEpochMs:number):Valuation{
 const sheet=balanceSheet(fleet,company.cash);
 const depots=company.depots??[];
 const depotAssets=depots.length*10000+sum(DEPOT_UPGRADES.map(u=>Object.values(fleet.depotUpgrades??{}).reduce((a,levels)=>a+(levels[u.id]??0)*u.cost,0)));
 const assetValue=sheet.equity+depotAssets;
 const periods=accountingOf(fleet.accounting).periods.slice(-3);
 const profit=sum(periods.map(p=>p.netRevenue-p.netExpenses-p.depreciation-p.corporateTax));
 const observedDays=Math.max(1,periods.length*30);
 const profitPerDay=profit/observedDays;
 const earningsValue=Math.max(-Math.max(0,assetValue)*.25,Math.min(1000000,profitPerDay*365*2));
 const history=fleet.financeHistory??[];
 const first=history.length?history[0]:undefined;
 const last=history.length?history[history.length-1]:undefined;
 const growth=first&&last&&first.revenue>0?Math.max(-.5,Math.min(.5,(last.revenue-first.revenue)/first.revenue)):0;
 const growthValue=Math.max(-50000,Math.min(50000,earningsValue*.15*growth));
 const value=Math.max(1000,round(assetValue+earningsValue+growthValue));
 const debt=(fleet.loans??[]).reduce((a,l)=>a+l.balance,0);
 const cashBuffer=company.cash/(Math.max(1,Math.abs(profitPerDay)*30));
 const debtRatio=debt/Math.max(1,sheet.assets);
 const confidence=Math.max(10,Math.min(95,Math.round(50+Math.min(15,periods.length*5)+Math.min(15,cashBuffer*3)-debtRatio*25+(profitPerDay>0?10:-10))));
 const investorConfidence=Math.max(0,Math.min(100,Math.round(confidence+(growth>0?growth*20:0)-(sheet.taxLiabilities>company.cash?15:0))));
 const reasons:string[]=[];
 if(!periods.length)reasons.push('No accounting history: valuation relies mainly on net assets.');
 if(sheet.taxLiabilities>company.cash)reasons.push('Outstanding tax liabilities exceed operating cash.');
 if(debtRatio>.5)reasons.push('High debt relative to tracked assets.');
 if(profitPerDay<0)reasons.push('Recent accounting periods show a loss.');
 if(company.cash<5000)reasons.push('Low operating cash reserve.');
 void gameEpochMs;
 return {value,assetValue:round(assetValue),earningsValue:round(earningsValue),growthValue:round(growthValue),profitPerDay,confidence,investorConfidence,depotAssets,reasons};
}
export type InvestorOffer={id:string;name:string;amount:number;equityPercent:number;preMoney:number;postMoney:number;confidence:number};
const investorNames=['Hellenic Mobility Partners','Aegean Growth Capital','Urban Transit Ventures'];
export function investorOffers(valuation:Valuation,state:EquityState):InvestorOffer[]{
 if(valuation.investorConfidence<35)return [];
 return investorNames.map((name,i)=>{
  const fraction=[.08,.14,.2][i];
  const amount=round(valuation.value*fraction/(1-fraction));
  return {id:'investor-'+i,name,amount,equityPercent:fraction*100,preMoney:valuation.value,postMoney:valuation.value+amount,confidence:valuation.investorConfidence};
 });
}
export function distributableProfit(fleet:FleetState,state:EquityState){
 const profits=sum(accountingOf(fleet.accounting).periods.map(p=>p.netRevenue-p.netExpenses-p.depreciation-p.corporateTax));
 return Math.max(0,round(profits-state.totalDividends));
}
export function issueShares(stateValue:EquityState|undefined,holderId:string,name:string,amount:number,preMoney:number,gameTime:number):{state:EquityState;cashDelta:number;event:EquityEvent}{
 const state=equityOf(stateValue);
 if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(preMoney)||preMoney<=0)throw Error('Invalid investment terms.');
 if(!holderId||!name.trim()||holderId===FOUNDER_ID)throw Error('Choose a valid external investor.');
 const total=shareTotal(state);
 const newShares=Math.max(1,Math.round(total*amount/preMoney));
 const investor=state.holders.find(h=>h.id===holderId);
 const holders=investor?state.holders.map(h=>h.id===holderId?{...h,shares:h.shares+newShares,invested:h.invested+amount}:h):[...state.holders,{id:holderId,name,shares:newShares,votesPerShare:1,invested:amount,dividendsReceived:0}];
 const event:EquityEvent={id:crypto.randomUUID(),gameTime,type:investor?'issue':'investment',holderId,holderName:name,amount:round(amount),shares:newShares,valuation:preMoney,note:'Primary share issue; proceeds to operating cash'};
 return {state:{...state,holders,events:[event,...state.events].slice(0,500),issuedCapital:state.issuedCapital+amount},cashDelta:amount,event};
}
export function payDividend(stateValue:EquityState|undefined,amount:number,availableCash:number,availableProfit:number,minimumReserve:number,gameTime:number):{state:EquityState;cashDelta:number;events:EquityEvent[]}{
 const state=equityOf(stateValue);
 if(!Number.isFinite(amount)||amount<=0||round(amount)!==amount)throw Error('Enter a positive dividend amount in euros and cents.');
 if(amount>availableProfit+.001)throw Error('Dividend exceeds undistributed accounting profits.');
 if(amount>availableCash-minimumReserve+.001)throw Error('Dividend would breach the operating cash reserve.');
 const total=shareTotal(state);if(total<=0)throw Error('No shares issued.');
 let allocated=0;
 const events:EquityEvent[]=[];
 const holders=state.holders.map((h,i)=>{
  const payment=i===state.holders.length-1?round(amount-allocated):round(amount*h.shares/total);
  allocated+=payment;
  events.push({id:crypto.randomUUID(),gameTime,type:'dividend',holderId:h.id,holderName:h.name,amount:-payment,shares:0,valuation:0,note:'Dividend distribution'});
  return {...h,dividendsReceived:h.dividendsReceived+payment};
 });
 return {state:{...state,holders,events:[...events,...state.events].slice(0,500),totalDividends:state.totalDividends+amount},cashDelta:-amount,events};
}
export function buybackShares(stateValue:EquityState|undefined,holderId:string,shares:number,preMoney:number,availableCash:number,minimumReserve:number,gameTime:number):{state:EquityState;cashDelta:number;event:EquityEvent}{
 const state=equityOf(stateValue);
 const holder=state.holders.find(h=>h.id===holderId);
 if(!holder||holderId===FOUNDER_ID)throw Error('Select an external shareholder.');
 if(!Number.isSafeInteger(shares)||shares<=0||shares>holder.shares)throw Error('Invalid share quantity.');
 const total=shareTotal(state);
 const price=round(preMoney*shares/total);
 if(price<=0||price>availableCash-minimumReserve+.001)throw Error('Insufficient cash after maintaining the operating reserve.');
 const holders=state.holders.map(h=>h.id===holderId?{...h,shares:h.shares-shares}:h).filter(h=>h.shares>0);
 const event:EquityEvent={id:crypto.randomUUID(),gameTime,type:'buyback',holderId,holderName:holder.name,amount:-price,shares:-shares,valuation:preMoney,note:'Shares retired; no operating expense'};
 return {state:{...state,holders,events:[event,...state.events].slice(0,500)},cashDelta:-price,event};
}
export function recordValuation(stateValue:EquityState|undefined,valuation:Valuation,gameTime:number):EquityState{
 const state=equityOf(stateValue);
 const day=dayKey(gameTime);
 if(state.lastValuationDay===day)return state;
 const point:ValuationPoint={gameDay:day,value:valuation.value,confidence:valuation.investorConfidence,founderPercent:ownership(state,FOUNDER_ID),equity:valuation.assetValue};
 return {...state,lastValuationDay:day,valuationHistory:[...state.valuationHistory.filter(p=>p.gameDay!==day),point].slice(-365)};
}
