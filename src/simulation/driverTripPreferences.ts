/** Passenger-job preference for employed drivers (not a licence to ignore
 * pickup ETA, vehicle economics, fuel, the shift roster or directed roads).
 * Unknown/older drivers are Flexible by default.
 */
import type {DriverRecord,PassengerRequest} from './taxi';
import type {TaxiDispatchMode} from './taxiDispatchStrategy';

export type DriverTripPreference=NonNullable<DriverRecord['tripPreference']>;
export const DRIVER_TRIP_PREFERENCES:readonly DriverTripPreference[]=[
 'flexible','local','regional','long-distance',
];
export const isDriverTripPreference=(value:unknown):value is DriverTripPreference=>
 value==='flexible'||value==='local'||value==='regional'||value==='long-distance';

export function normalDriverTripPreference(value:unknown):DriverTripPreference{
 return isDriverTripPreference(value)?value:'flexible';
}

export function driverTripAffinity(
 preferred:DriverTripPreference,
 tripType:PassengerRequest['tripType'],
):number{
 if(preferred==='flexible'||!tripType)return 0;
 if(preferred==='local')return tripType==='local'?1:-.5;
 if(preferred==='regional')return tripType==='regional'?1:
  tripType==='intercity'?.35:-.4;
 return tripType==='intercity'?1:tripType==='regional'?.6:-.5;
}

/** Small, capped tie-breaker. In fastest-jobs mode a preference can win only
 * a nearby pickup; it never forces an hour-long wait or rejects a fare.
 */
export function driverTripMatchBonus(
 mode:TaxiDispatchMode,
 preference:DriverTripPreference,
 tripType:PassengerRequest['tripType'],
):number{
 const affinity=driverTripAffinity(preference,tripType);
 return affinity*(mode==='max-jobs'?45:mode==='balanced'?1.4:2);
}

/** Used only when selecting a willing driver for an EMPTY regional transfer.
 * The same rules permit all flexible employees to serve the region.
 */
export function driverCoveragePriority(preference:DriverTripPreference):number{
 return preference==='long-distance'?3:
  preference==='regional'?2:preference==='flexible'?1:0;
}
