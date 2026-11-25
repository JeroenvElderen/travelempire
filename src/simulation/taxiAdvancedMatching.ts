/** Phase 4: bounded, deterministic passenger-priority and taxi-bid decisions.
 * All legal route searches remain in the existing dispatch worker. The model
 * operates on already-routed estimates and never creates roads, vehicles,
 * payments, or a second simulation clock.
 */
import {GAME_TIME_SCALE} from './gameClock';
import {regionalTrafficFactor} from './trafficConditions';
import {estimateTaxiJob,taxiDispatchScore,type TaxiJobEstimate,type TaxiDispatchMode,type TaxiQuoteEconomy} from './taxiDispatchStrategy';
import {driverTripMatchBonus,type DriverTripPreference} from './driverTripPreferences';
import type {PassengerRequest,Taxi} from './taxi';

/** Queue expiry is a wall-clock limit for booking acceptance. Taxi movement
 * also uses real elapsed seconds; the 24x clock governs shifts only.
 * No artificially short two-minute limit for genuine airport pickups.
 */
export function passengerPickupPatienceMinutes(
 passenger:Pick<PassengerRequest,'passengerType'|'pickupPlaceKind'>,
):number{
 if(passenger.pickupPlaceKind==='airport'||passenger.pickupPlaceKind==='harbour')return 18;
 if(passenger.pickupPlaceKind==='hotel')return 15;
 switch(passenger.passengerType){
  case 'business':return 10;
  case 'commuter':return 10;
  case 'family':return 16;
  case 'tourist':return 15;
  case 'nightlife':return 12;
  default:return 12;
 }
}
export function withPassengerPickupDeadline<T extends PassengerRequest>(
 request:T,createdAt:number,
):T{
 const deadline=createdAt+passengerPickupPatienceMinutes(request)*60000;
 return {...request,pickupDeadlineAt:deadline,expiresAt:Math.max(request.expiresAt,deadline)};
}
/** Expired quotations are not silently treated as infinite customer patience.
 * Older saved jobs have no explicit pickup deadline and retain the original
 * queue expiration behaviour without retrospectively invalidating their ETA.
 */
export function passengerPickupCanArrive(
 request:Pick<PassengerRequest,'createdAt'|'pickupDeadlineAt'>,
 at:number,pickupEtaSeconds:number,
):boolean{
 if(!Number.isFinite(pickupEtaSeconds)||pickupEtaSeconds<0)return false;
 if(request.pickupDeadlineAt===undefined)return true;
 return Number.isFinite(request.pickupDeadlineAt)&&
  at+pickupEtaSeconds*1000<=request.pickupDeadlineAt;
}
/** A 0-100 satisfaction projection from waiting time compared with the
 * customer's stated pickup patience; not a review or cash transaction.
 */
export function passengerPickupSatisfaction(
 request:Pick<PassengerRequest,'createdAt'|'pickupDeadlineAt'|'passengerType'|'pickupPlaceKind'>,
 at:number,pickupEtaSeconds:number,
):number{
 if(!Number.isFinite(pickupEtaSeconds)||pickupEtaSeconds<0)return 0;
 const patienceMs=(request.pickupDeadlineAt??(request.createdAt+
  passengerPickupPatienceMinutes(request)*60000))-request.createdAt;
 if(!(patienceMs>0))return 0;
 const fraction=Math.max(0,(at-request.createdAt+pickupEtaSeconds*1000)/patienceMs);
 return Math.max(0,Math.min(100,Math.round(100-65*fraction-
  (fraction>1?(fraction-1)*40:0))));
}
/** Use the quoted real discovered-road trip time, refreshed by the relative
 * local congestion at pickup. The exact route and mileage remain authoritative
 * during passenger driving and final fare settlement.
 */
export function currentPassengerTripSeconds(
 mission:Pick<PassengerRequest,'tripTravelSeconds'|'pickup'|'quotedGameAt'>,
 gameAt:number,
):number|undefined{
 const quoted=mission.tripTravelSeconds;
 if(quoted===undefined||!Number.isFinite(quoted)||quoted<=0)return undefined;
 if(!Number.isFinite(gameAt)||mission.quotedGameAt===undefined||
  !Number.isFinite(mission.quotedGameAt))return quoted;
 const before=regionalTrafficFactor(50,mission.quotedGameAt,mission.pickup);
 const current=regionalTrafficFactor(50,gameAt,mission.pickup);
 return quoted*Math.max(.6,Math.min(1.8,before/Math.max(.2,current)));
}
export type AdvancedTaxiBid={
 score:number;pickupEtaSeconds:number;tripEtaSeconds:number;
 estimatedSatisfaction:number;shiftOverrunSeconds:number;
 estimate:TaxiJobEstimate|null;
};
/** A genuine legal pickup ETA is mandatory; candidate can be declined when
 * predicted arrival is after the deadline. Existing accepted trips are never
 * cut short when drivers' shifts finish.
 */
export function advancedTaxiBid(
 mode:TaxiDispatchMode,taxi:Taxi,mission:PassengerRequest,
 approachMetres:number,pickupEtaSeconds:number,now:number,gameAt:number,
 remainingDutyGameSeconds:number|undefined,preference:DriverTripPreference,economy?:TaxiQuoteEconomy,
):AdvancedTaxiBid|null{
 if(!passengerPickupCanArrive(mission,now,pickupEtaSeconds))return null;
 const tripEtaSeconds=currentPassengerTripSeconds(mission,gameAt);
 const currentMission=tripEtaSeconds===undefined?mission:
  {...mission,tripTravelSeconds:tripEtaSeconds};
 const estimate=estimateTaxiJob(taxi,currentMission,approachMetres,pickupEtaSeconds,economy);
 const satisfaction=passengerPickupSatisfaction(mission,now,pickupEtaSeconds);
 // Conversion is crucial: the simulation vehicle moves in real seconds,
 // while the driver's roster advances at GAME_TIME_SCALE = 24x.
 const remainingReal=Number.isFinite(remainingDutyGameSeconds)?
  Math.max(0,remainingDutyGameSeconds!)/GAME_TIME_SCALE:undefined;
 const total=pickupEtaSeconds+(estimate?.tripEtaSeconds??tripEtaSeconds??0);
 const overrun=remainingReal===undefined?0:Math.max(0,total-remainingReal);
 // Do not start a pickup that will happen AFTER duty ends. A passenger
 // already accepted continues to their destination under existing policy.
 if(remainingReal!==undefined&&pickupEtaSeconds>remainingReal+30)return null;
 const overrunFraction=total>0?Math.min(1,overrun/total):0;
 const base=taxiDispatchScore(mode,pickupEtaSeconds,estimate)+
  driverTripMatchBonus(mode,preference,mission.tripType);
 const satisfactionBonus=mode==='max-profit'?satisfaction*.06:
  mode==='balanced'?satisfaction*.045:satisfaction*.025;
 const shiftPenalty=overrunFraction*(mode==='max-profit'?28:mode==='balanced'?14:6);
 return {score:base+satisfactionBonus-shiftPenalty,
  pickupEtaSeconds,tripEtaSeconds:tripEtaSeconds??0,
  estimatedSatisfaction:satisfaction,shiftOverrunSeconds:overrun,
  estimate};
}

/** Before any expensive graph search, rank the already-validated waiting
 * bookings by estimated net hourly opportunity and customer urgency.
 * A taxi-specific bid uses REAL route costs later; this is only ordering,
 * not an assignment or an invented pickup distance.
 */
export function rankPassengerQueue(
 queue:readonly PassengerRequest[],mode:TaxiDispatchMode,
 availableTaxis:readonly Taxi[],now:number,gameAt:number,economies?:Readonly<Record<string,TaxiQuoteEconomy>>,
):PassengerRequest[]{
 const fleet=availableTaxis.slice(0,24);
 const priority=(job:PassengerRequest)=>{
  let opportunity=-20;
  const tripSeconds=currentPassengerTripSeconds(job,gameAt);
  if(tripSeconds&&job.tripDistanceMeters){
   const preview={...job,tripTravelSeconds:tripSeconds};
   // Zero empty kilometres is a best-case bound, not an invented route;
   // actual empty travel is charged in advancedTaxiBid.
   for(const taxi of fleet){
    const e=estimateTaxiJob(taxi,preview,0,0,economies?.[taxi.id]);
    if(!e)continue;
    const value=mode==='max-profit'?
     e.contribution/Math.max(1/12,e.tripEtaSeconds/3600):
     mode==='balanced'?e.contribution*.45-e.tripEtaSeconds/600:
     -e.tripEtaSeconds/60*.65;
    if(value>opportunity)opportunity=value;
   }
  }
  const waitedMinutes=Math.max(0,(now-job.createdAt)/60000);
  const deadline=job.pickupDeadlineAt;
  const urgency=deadline===undefined?0:
   Math.max(0,Math.min(1,(now-job.createdAt)/
    Math.max(1,deadline-job.createdAt)));
  // The ageing term prevents permanent starvation under profitable demand.
  const ageing=Math.min(80,waitedMinutes*(mode==='max-profit'?5:7));
  const deadlineBonus=urgency*urgency*(mode==='max-profit'?25:40);
  return opportunity+ageing+deadlineBonus;
 };
 // Compute each opportunity once instead of re-quoting the entire fleet
 // for every comparison in the sort.
 return queue.map(job=>({job,score:priority(job)})).sort((a,b)=>b.score-a.score||
  a.job.createdAt-b.job.createdAt||a.job.id.localeCompare(b.job.id)).map(entry=>entry.job);
}
