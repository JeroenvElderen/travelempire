import type {BankSettings,BankEntry} from './simulation/taxi';
export const defaultBank=():BankSettings=>({savings:0,reserve:0,autoSavePercent:0,minimumOperatingCash:5000,entries:[]});
export function bankOf(value?:BankSettings):BankSettings{
 const initial=defaultBank();
 return {...initial,...value,savings:Math.max(0,value?.savings??0),reserve:Math.max(0,value?.reserve??0),entries:value?.entries??[]};
}
export function bankEntry(description:string,amount:number,account:BankEntry['account'],type:BankEntry['type']):BankEntry{
 return {id:crypto.randomUUID(),time:Date.now(),description,amount,account,type};
}
export function appendBankEntries(bank:BankSettings,entries:BankEntry[]):BankSettings{
 return {...bank,entries:[...entries,...bank.entries].slice(0,500)};
}
export function transferBank(bank:BankSettings,from:BankEntry['account'],to:BankEntry['account'],amount:number,operatingCash:number){
 if(from===to||!Number.isFinite(amount)||amount<=0)throw Error('Enter a valid transfer amount.');
 const rounded=Math.round(amount*100)/100;
 if(rounded<=0)throw Error('Minimum transfer is €0.01.');
 const available=from==='operating'?operatingCash:from==='savings'?bank.savings:bank.reserve;
 if(rounded>available+0.0001)throw Error('Insufficient funds in the source account.');
 const updated={...bank,savings:bank.savings+(to==='savings'?rounded:0)-(from==='savings'?rounded:0),
  reserve:bank.reserve+(to==='reserve'?rounded:0)-(from==='reserve'?rounded:0)};
 const entries=[bankEntry('Transfer to '+to,-rounded,from,'transfer'),bankEntry('Transfer from '+from,rounded,to,'transfer')];
 return {bank:appendBankEntries(updated,entries),operatingDelta:(to==='operating'?rounded:0)-(from==='operating'?rounded:0)};
}
