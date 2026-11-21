import type {Company} from '../company';
import type {FleetState} from './taxi';
import {DRIVER_COST} from './taxi';
import {financeQuote,FINANCE_TERMS} from '../economy';
import {lendingAssessment,securedRate} from './securedLoans';

const money=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;

/** One credit decision for the dealership and its purchase handlers.
 * Vehicle financing shares the business's asset-backed borrowing headroom,
 * rather than a separate €75k ceiling or a two-vehicle limit.
 */
export function vehicleFinanceQuote(
 company:Company,fleet:FleetState,gameNow:number,
 unitPrice:number,quantity:number,depositPercent:number,days:number
){
 const assessment=lendingAssessment(company,fleet,gameNow);
 const rate=securedRate(assessment.score,days);
 const validPrice=Number.isFinite(unitPrice)&&unitPrice>0;
 const validQuantity=Number.isInteger(quantity)&&quantity>=1&&quantity<=50;
 const validDeposit=Number.isInteger(depositPercent)&&depositPercent>=10&&depositPercent<=90;
 const validTerm=FINANCE_TERMS.includes(days as typeof FINANCE_TERMS[number]);
 const quote=validPrice&&validDeposit&&validTerm?financeQuote(unitPrice,depositPercent,days,rate):null;
 const principal=quote&&validQuantity?money(quote.principal*quantity):0;
 const upfront=quote&&validQuantity?money((quote.deposit+DRIVER_COST)*quantity):0;
 const dailyPayment=quote&&validQuantity?money(quote.instalment*quantity):0;
 const totalInterest=quote&&validQuantity?money(quote.interest*quantity):0;
 const reason=!validPrice?'Select a vehicle with a valid price.':
  !validQuantity?'Choose between 1 and 50 vehicles.':
  !validDeposit?'Choose a deposit between 10% and 90%.':
  !validTerm?'Choose a supported repayment period.':
  assessment.score<500?'Your credit score is below the required 500. Repay debts and avoid missed payments.':
  principal>assessment.available+.001?`Financing requires €${principal.toLocaleString('en-IE')}, but only €${assessment.available.toLocaleString('en-IE')} of borrowing capacity remains. Increase the deposit or repay existing debt.`:
  upfront>company.cash+.001?`You need €${upfront.toLocaleString('en-IE')} upfront (including drivers), but your operating cash is €${company.cash.toLocaleString('en-IE')}.`:
  '';
 return {...assessment,rate,principal,upfront,dailyPayment,totalInterest,
  approved:reason==='',reason};
}
