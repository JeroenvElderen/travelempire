/** Monetary input for property investments is stored as integer cents.
 * The range control and exact entry share the same maximum, ensuring a
 * preview can never promise a purchase beyond cash or available shares.
 */
export function investmentLimitCents(
 remainingCents:number,companyCashEuros:number
):number{
 const cash=Math.max(0,Math.floor((Number.isFinite(companyCashEuros)?companyCashEuros:0)*100+1e-7));
 return Math.max(0,Math.min(Math.floor(remainingCents),cash));
}
export function selectedInvestmentCents(raw:string,maxCents:number):number{
 if(raw.trim()===''||!/^\d+(?:\.\d{0,2})?$/.test(raw.trim()))return 0;
 const n=Number(raw);
 if(!Number.isFinite(n))return 0;
 const cents=Math.round(n*100);
 return cents>=1&&cents<=maxCents?cents:0;
}
export function defaultInvestmentEuros(maxCents:number):string{
 return (Math.min(maxCents,1500000)/100).toFixed(2);
}
export function asEuros(cents:number):string{
 return (cents/100).toFixed(2);
}
