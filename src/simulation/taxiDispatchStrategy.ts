/** Taxi Autopilot 2.0 — Phase 1.
 * Pure business decisions only: no physics, speed or driving-policy changes.
 * All route distances and pickup ETAs are measured by the existing legal
 * OSM routing system. Projected profit is an estimate, not a cash movement.
 */
import {energySpec} from './energy';
import type {Taxi,PassengerRequest} from './taxi';

export type TaxiDispatchMode='max-jobs'|'balanced'|'max-profit';
export const TAXI_DISPATCH_MODES:readonly TaxiDispatchMode[]=
 ['max-jobs','balanced','max-profit'];

export const isTaxiDispatchMode=(mode:unknown):mode is TaxiDispatchMode=>
 mode==='max-jobs'||mode==='balanced'||mode==='max-profit';

export type TaxiJobEstimate={
 fare:number;approachMetres:number;passengerMetres:number;
 pickupEtaSeconds:number;tripEtaSeconds:number;fuelCost:number;
 maintenanceCost:number;labourCost:number;insuranceCost:number;
 operatingCost:number;contribution:number;
};
/** These are the unmodified baseline game rates: maintenance €0.075/km,
 * driving wage €0.009/s and insurance €0.00085/s. Research and discounts
 * can improve actual settlement; the projection is intentionally cautious.
 */
export function estimateTaxiJob(
 taxi:Pick<Taxi,'vehicleFuel'|'drivingPolicy'|'vehicleRevenueBonus'>,
 request:Pick<PassengerRequest,'fare'|'tripDistanceMeters'|'tripTravelSeconds'>,
 approachMetres:number,pickupEtaSeconds:number,
):TaxiJobEstimate|null{
 const passengerMetres=request.tripDistanceMeters;
 const tripEtaSeconds=request.tripTravelSeconds;
 if(passengerMetres===undefined||tripEtaSeconds===undefined||
  !Number.isFinite(passengerMetres)||!Number.isFinite(tripEtaSeconds)||
  passengerMetres<=0||tripEtaSeconds<=0||
  !Number.isFinite(approachMetres)||approachMetres<0||
  !Number.isFinite(pickupEtaSeconds)||pickupEtaSeconds<0||
  !Number.isFinite(request.fare)||request.fare<=0)return null;
 const distanceKm=(approachMetres+passengerMetres)/1000;
 const spec=energySpec(taxi);
 const fuelFactor=taxi.drivingPolicy==='economy'?0.85:
  taxi.drivingPolicy==='performance'?1.12:1;
 const fuelCost=distanceKm/100*spec.per100km*spec.pricePerUnit*fuelFactor;
 const maintenanceCost=distanceKm*.075;
 const seconds=pickupEtaSeconds+tripEtaSeconds;
 const labourCost=seconds*.009;
 const insuranceCost=seconds*.00085;
 const operatingCost=fuelCost+maintenanceCost+labourCost+insuranceCost;
 // The actual economy applies researched bonuses at completed drop-off.
 // Include only known vehicle bonus, never invent research levels.
 const fare=request.fare*Math.min(1.6,
  1+Math.max(0,Math.min(200,taxi.vehicleRevenueBonus??0))/100);
 return {fare,approachMetres,passengerMetres,pickupEtaSeconds,
  tripEtaSeconds,fuelCost,maintenanceCost,labourCost,insuranceCost,
  operatingCost,contribution:fare-operatingCost};
}

export function taxiJobAcceptable(mode:TaxiDispatchMode,
 estimate:TaxiJobEstimate|null):boolean{
 // Legacy jobs without a valid route quote remain available to the fastest
 // taxi; they cannot be asserted profitable without enough data.
 if(!estimate)return mode!=='max-profit';
 if(mode==='max-jobs')return true;
 if(mode==='balanced')return estimate.contribution>=.25;
 // Profit mode should avoid earning a few cents at the cost of tying up
 // a driver/vehicle for an entire journey, but never block other modes.
 return estimate.contribution>=Math.max(2,estimate.fare*.12);
}

/** Larger scores win. No change to legal route, speed or fare settlement.
 * Maximum Profit optimises direct contribution PER WORKING HOUR, including
 * the unpaid pickup drive. A big gross fare is not necessarily efficient.
 */
export function taxiDispatchScore(mode:TaxiDispatchMode,
 pickupEtaSeconds:number,estimate:TaxiJobEstimate|null):number{
 if(!Number.isFinite(pickupEtaSeconds)||pickupEtaSeconds<0)return -Infinity;
 if(mode==='max-jobs'||!estimate)return -pickupEtaSeconds;
 const minutes=pickupEtaSeconds/60;
 return mode==='balanced'?
  estimate.contribution*.45-minutes:
  estimate.contribution/Math.max(1/12,
   (estimate.pickupEtaSeconds+estimate.tripEtaSeconds)/3600);
}

/** Do not redo the expensive passenger-routing check if another worker
 * response changes the discovered network. Existing assignment validation
 * remains the authority for legal pickup and full passenger routes.
 */
export function selectTaxiJobCandidate<T extends {pickupEtaSeconds:number;estimate:TaxiJobEstimate|null}>(
 mode:TaxiDispatchMode,candidates:readonly T[],
):T|null{
 let best:T|null=null,score=-Infinity;
 for(const candidate of candidates){
  if(!taxiJobAcceptable(mode,candidate.estimate))continue;
  const value=taxiDispatchScore(mode,candidate.pickupEtaSeconds,candidate.estimate);
  if(value>score){score=value;best=candidate;}
 }
 return best;
}
