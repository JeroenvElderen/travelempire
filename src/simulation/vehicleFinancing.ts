import type {Company} from '../company';
import type {FleetState} from './taxi';
import {DRIVER_COST} from './taxi';
import {bankOf} from '../banking';
import {financeQuote,FINANCE_TERMS} from '../economy';
import {lendingAssessment,securedRate} from './securedLoans';

const money=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;

/** New vehicles supply their own collateral, even when the general company
 * credit facility has no headroom. The advance is limited by credit score and
 * the acquisition price. Business and acquisition debt are already reflected
 * in the general headroom; neither is forgiven or silently refinanced.
 */
export function vehicleCollateralAdvanceRatio(score:number):number{
 return score>=750?.90:score>=700?.85:score>=650?.75:score>=600?.65:
  score>=550?.55:score>=500?.45:0;
}

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
 const vehicleAdvanceRatio=vehicleCollateralAdvanceRatio(assessment.score);
 const assetCredit=validPrice&&validQuantity?money(unitPrice*quantity*vehicleAdvanceRatio):0;
 const businessAvailable=assessment.available;
 const available=money(businessAvailable+assetCredit);
 const minimumOperatingCash=bankOf(fleet.bank).minimumOperatingCash;
 const spendableCash=Math.max(0,money(company.cash-minimumOperatingCash));
 const totalPrice=validPrice&&validQuantity?money(unitPrice*quantity):0;
 const minimumDepositPercent=totalPrice>0?Math.max(10,Math.ceil((1-available/totalPrice)*100)):10;
 const minimumUpfront=totalPrice>0?money(totalPrice*Math.min(100,minimumDepositPercent)/100+
  DRIVER_COST*quantity):0;
 const creditMessage=minimumDepositPercent>90?
  'Insufficient credit even with a 90% deposit. Reduce the order size or repay existing debt.':
  `This order has €${available.toLocaleString('en-IE')} available including new-vehicle collateral. It needs at least ${minimumDepositPercent}% deposit (€${minimumUpfront.toLocaleString('en-IE')} upfront including drivers). Reduce vehicle quantity or increase the deposit.`;
 const reason=!validPrice?'Select a vehicle with a valid price.':
  !validQuantity?'Choose between 1 and 50 vehicles.':
  !validDeposit?'Choose a deposit between 10% and 90%.':
  !validTerm?'Choose a supported repayment period.':
  assessment.score<500?'Your credit score is below 500. Repay debt and avoid missed payments to qualify.':
  principal>available+.001?creditMessage:
  upfront>spendableCash+.001?
   `The upfront payment is €${upfront.toLocaleString('en-IE')}, but only €${spendableCash.toLocaleString('en-IE')} is spendable after the €${minimumOperatingCash.toLocaleString('en-IE')} cash reserve. Reduce the number of vehicles or increase available cash.`:
  '';
 return {...assessment,rate,principal,upfront,dailyPayment,totalInterest,
  businessAvailable,assetCredit,vehicleAdvanceRatio,minimumDepositPercent,
  minimumUpfront,minimumOperatingCash,spendableCash,available,
  approved:reason==='',reason};
}
