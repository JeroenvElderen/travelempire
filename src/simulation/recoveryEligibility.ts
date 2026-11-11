import type {Taxi} from './taxi';
import {energyPercent} from './energy';

/** Automatic trucks are for actual breakdowns, never ordinary scheduled
 * rest travel or a worker waiting to finish routing a parking stop.
 * The user can still explicitly call a heavy recovery truck.
 */
export function shouldAutomaticallyRecover(vehicle:Taxi,stalledMs:number):boolean{
 if(vehicle.recoveryPending||vehicle.ferryTrip)return false;
 if(vehicle.status==='PAUSED'||vehicle.status==='REFUELLING'||vehicle.status==='SERVICING')return false;
 if(energyPercent(vehicle)<=0)return true;
 const passengerTaxi=!vehicle.kind||vehicle.kind==='taxi';
 if(!passengerTaxi)return false;
 if(vehicle.scheduledShiftParked||vehicle.shiftParked||vehicle.restStopId||
  vehicle.refillDestination||vehicle.serviceDestination)return false;
 // A valid assigned return route may be stationary during tile loading.
 // Give the existing route worker time rather than towing it for a 30s gap.
 return vehicle.status==='RETURNING'&&vehicle.edgeIds.length===0&&stalledMs>=120000;
}
